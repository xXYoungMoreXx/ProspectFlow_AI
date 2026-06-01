import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export class SettingsCrypto {
  private readonly algorithm = "aes-256-gcm";
  private readonly key: Buffer;

  constructor(encryptionKey: string) {
    this.key = Buffer.from(encryptionKey, "base64");
    if (this.key.length !== 32) {
      throw new Error("Invalid encryption key length. Expected 32 bytes (base64 encoded).");
    }
  }

  encrypt(text: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const tag = cipher.getAuthTag().toString("hex");

    return `${iv.toString("hex")}:${tag}:${encrypted}`;
  }

  decrypt(encryptedData: string): string {
    const [ivHex, tagHex, encryptedText] = encryptedData.split(":");
    if (!ivHex || !tagHex || !encryptedText) {
      throw new Error("Invalid encrypted data format");
    }

    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const decipher = createDecipheriv(this.algorithm, this.key, iv, { authTagLength: 16 });

    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }

  static mask(value: string): string {
    if (!value) return "";
    if (value.length <= 8) return "********";
    return `${value.slice(0, 4)}****${value.slice(-4)}`;
  }
}
