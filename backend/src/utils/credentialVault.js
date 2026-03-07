/* eslint-disable @typescript-eslint/no-require-imports */
const crypto = require("crypto");

const KEY_ENV_CANDIDATES = [
  "CLOUD_CREDENTIALS_ENCRYPTION_KEY",
  "CLOUD_INTEGRATION_ENCRYPTION_KEY",
];

function resolveSecret() {
  for (const envName of KEY_ENV_CANDIDATES) {
    if (process.env[envName]) {
      return process.env[envName];
    }
  }

  throw new Error(
    "Missing encryption secret. Set CLOUD_CREDENTIALS_ENCRYPTION_KEY or CLOUD_INTEGRATION_ENCRYPTION_KEY"
  );
}

function deriveKey(secret) {
  if (/^[a-fA-F0-9]{64}$/.test(secret)) {
    return Buffer.from(secret, "hex");
  }

  return crypto.createHash("sha256").update(secret, "utf8").digest();
}

function encryptCredentials(credentials) {
  const secret = resolveSecret();
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const plaintext = JSON.stringify(credentials || {});
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  const payload = {
    v: 1,
    alg: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
  };

  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

function decryptCredentials(serializedPayload) {
  const secret = resolveSecret();
  const key = deriveKey(secret);

  const payloadString = Buffer.from(serializedPayload, "base64").toString("utf8");
  const payload = JSON.parse(payloadString);

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(payload.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.data, "base64")),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf8"));
}

module.exports = {
  encryptCredentials,
  decryptCredentials,
};
