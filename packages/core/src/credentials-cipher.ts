import {
  AlgorithmSuiteIdentifier,
  buildClient,
  CommitmentPolicy,
  MultiKeyringNode,
  RawAesKeyringNode,
  RawAesWrappingSuiteIdentifier,
} from "@aws-crypto/client-node";

const keyNamespace = "atlair-mail/credentials";
const keyLength = 32;

const { encrypt, decrypt } = buildClient({
  commitmentPolicy: CommitmentPolicy.REQUIRE_ENCRYPT_REQUIRE_DECRYPT,
  maxEncryptedDataKeys: 1,
});

export interface EncryptedValue {
  ciphertext: string;
  keyVersion: number;
}

export interface CredentialsCipher {
  currentKeyVersion: number;
  encrypt(plaintext: string, organizationId: string): Promise<EncryptedValue>;
  decrypt(ciphertext: string, organizationId: string): Promise<string>;
}

export function parseKeyring(value: string): Map<number, Uint8Array> {
  const keyring = new Map<number, Uint8Array>();
  for (const entry of value.split(",").map((part) => part.trim()).filter(Boolean)) {
    const separator = entry.indexOf(":");
    const version = Number(entry.slice(0, separator));
    const key = Buffer.from(entry.slice(separator + 1), "base64");
    if (separator < 1 || !Number.isInteger(version) || version < 1) {
      throw new Error("Each encryption key must look like <version>:<base64 key> with a positive integer version");
    }
    if (key.length !== keyLength) {
      throw new Error(`Encryption key version ${version} must decode to ${keyLength} bytes`);
    }
    if (keyring.has(version)) {
      throw new Error(`Encryption key version ${version} is listed more than once`);
    }
    keyring.set(version, new Uint8Array(key));
  }
  if (keyring.size === 0) {
    throw new Error("At least one encryption key is required");
  }
  return keyring;
}

const aesKeyring = (version: number, key: Uint8Array) =>
  new RawAesKeyringNode({
    keyNamespace,
    keyName: `v${version}`,
    unencryptedMasterKey: key.slice(),
    wrappingSuite: RawAesWrappingSuiteIdentifier.AES256_GCM_IV12_TAG16_NO_PADDING,
  });

export function createCredentialsCipher(keyringValue: string): CredentialsCipher {
  const keys = parseKeyring(keyringValue);
  const currentKeyVersion = Math.max(...keys.keys());
  const encryptKeyring = aesKeyring(currentKeyVersion, keys.get(currentKeyVersion)!);
  const decryptKeyring = new MultiKeyringNode({
    children: [...keys].map(([version, key]) => aesKeyring(version, key)),
  });

  return {
    currentKeyVersion,

    async encrypt(plaintext, organizationId) {
      const { result } = await encrypt(encryptKeyring, plaintext, {
        suiteId: AlgorithmSuiteIdentifier.ALG_AES256_GCM_IV12_TAG16_HKDF_SHA512_COMMIT_KEY,
        encryptionContext: { organizationId },
      });
      return { ciphertext: result.toString("base64"), keyVersion: currentKeyVersion };
    },

    async decrypt(ciphertext, organizationId) {
      const { plaintext, messageHeader } = await decrypt(decryptKeyring, Buffer.from(ciphertext, "base64"));
      if (messageHeader.encryptionContext.organizationId !== organizationId) {
        throw new Error("Ciphertext belongs to a different organization");
      }
      return plaintext.toString("utf8");
    },
  };
}
