export const apiKeyPermissions = ["full_access", "sending_access"] as const;
export type ApiKeyPermission = (typeof apiKeyPermissions)[number];
