import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createCredentialsCipher, parseKeyring } from "../src/index.ts";

const newKey = () => randomBytes(32).toString("base64");
const secret = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
const organizationId = "0199c1a0-0000-7000-8000-000000000001";
const otherOrganizationId = "0199c1a0-0000-7000-8000-000000000002";

describe("credentials cipher", () => {
  it("round-trips a secret and never stores the plaintext", async () => {
    const cipher = createCredentialsCipher(`1:${newKey()}`);

    const encrypted = await cipher.encrypt(secret, organizationId);

    assert.equal(encrypted.keyVersion, 1);
    assert.ok(!Buffer.from(encrypted.ciphertext, "base64").includes(secret));
    assert.equal(await cipher.decrypt(encrypted.ciphertext, organizationId), secret);
  });

  it("encrypts the same secret differently each time", async () => {
    const cipher = createCredentialsCipher(`1:${newKey()}`);

    const first = await cipher.encrypt(secret, organizationId);
    const second = await cipher.encrypt(secret, organizationId);

    assert.notEqual(first.ciphertext, second.ciphertext);
  });

  it("refuses to decrypt for a different organization", async () => {
    const cipher = createCredentialsCipher(`1:${newKey()}`);
    const { ciphertext } = await cipher.encrypt(secret, organizationId);

    await assert.rejects(cipher.decrypt(ciphertext, otherOrganizationId), /different organization/);
  });

  it("refuses to decrypt tampered ciphertext", async () => {
    const cipher = createCredentialsCipher(`1:${newKey()}`);
    const { ciphertext } = await cipher.encrypt(secret, organizationId);
    const bytes = Buffer.from(ciphertext, "base64");
    bytes[bytes.length - 1] = bytes[bytes.length - 1]! ^ 1;

    await assert.rejects(cipher.decrypt(bytes.toString("base64"), organizationId));
    await assert.rejects(cipher.decrypt("c2hvcnQ=", organizationId));
  });

  it("encrypts with the newest key and still decrypts values from older keys", async () => {
    const oldKey = newKey();
    const oldValue = await createCredentialsCipher(`1:${oldKey}`).encrypt(secret, organizationId);
    const rotated = createCredentialsCipher(`2:${newKey()},1:${oldKey}`);

    const newValue = await rotated.encrypt(secret, organizationId);

    assert.equal(rotated.currentKeyVersion, 2);
    assert.equal(newValue.keyVersion, 2);
    assert.equal(await rotated.decrypt(oldValue.ciphertext, organizationId), secret);
    await assert.rejects(createCredentialsCipher(`2:${newKey()}`).decrypt(oldValue.ciphertext, organizationId));
  });

  it("rejects malformed keyrings without echoing key material", () => {
    const shortKey = randomBytes(16).toString("base64");

    assert.throws(() => parseKeyring(""), /At least one/);
    assert.throws(() => parseKeyring(newKey()), /<version>:<base64 key>/);
    assert.throws(() => parseKeyring(`0:${newKey()}`), /positive integer/);
    assert.throws(() => parseKeyring(`1:${shortKey}`), (error: Error) => {
      return /32 bytes/.test(error.message) && !error.message.includes(shortKey);
    });
    assert.throws(() => parseKeyring(`1:${newKey()},1:${newKey()}`), /more than once/);
  });
});
