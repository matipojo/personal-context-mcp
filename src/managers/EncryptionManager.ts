import CryptoJS from 'crypto-js';
import { z } from 'zod';

// Schema for encryption configuration
const EncryptionConfigSchema = z.object({
  algorithm: z.enum(['AES']).default('AES'),
  keySize: z.number().min(128).max(512).default(256),
  ivSize: z.number().min(96).max(256).default(128),
  iterations: z.number().min(1000).max(100000).default(10000),
  enabled: z.boolean().default(false)
});

export type EncryptionConfig = z.infer<typeof EncryptionConfigSchema>;

export interface EncryptedData {
  data: string;
  iv: string;
  salt: string;
  tag?: string;
  algorithm: string;
  keySize: number;
  iterations: number;
  timestamp: string;
  // Add version to support migration from old format
  encryptionVersion?: number;
}

export interface DecryptionOptions {
  secret: string;
  otpToken?: string;
  userId?: string;
}

export class EncryptionManager {
  private config: EncryptionConfig;
  private static readonly CURRENT_ENCRYPTION_VERSION = 2;

  constructor(config: Partial<EncryptionConfig> = {}) {
    this.config = EncryptionConfigSchema.parse(config);
  }

  /**
   * Enable encryption
   */
  enableEncryption(): void {
    this.config.enabled = true;
  }

  /**
   * Disable encryption
   */
  disableEncryption(): void {
    this.config.enabled = false;
  }

  /**
   * Check if encryption is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Encrypt data using a master secret ONLY (no OTP tokens)
   * OTP is used only for access control, not encryption
   */
  async encryptData(
    plaintext: string,
    options: DecryptionOptions
  ): Promise<EncryptedData> {
    if (!this.config.enabled) {
      throw new Error('Encryption is not enabled');
    }

    try {
      // Generate a random salt
      const salt = CryptoJS.lib.WordArray.random(16);
      
      // Generate a random IV
      const iv = CryptoJS.lib.WordArray.random(this.config.ivSize / 8);

      // FIXED: Derive encryption key from ONLY master secret and user ID
      // OTP tokens are NOT included to prevent permanent data loss
      const key = this.deriveStableKey(options.secret, salt, options.userId);

      // Encrypt the data
      const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });

      return {
        data: encrypted.toString(),
        iv: iv.toString(),
        salt: salt.toString(),
        algorithm: this.config.algorithm,
        keySize: this.config.keySize,
        iterations: this.config.iterations,
        timestamp: new Date().toISOString(),
        encryptionVersion: EncryptionManager.CURRENT_ENCRYPTION_VERSION
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Decrypt data with support for both old and new encryption formats
   */
  async decryptData(
    encryptedData: EncryptedData,
    options: DecryptionOptions
  ): Promise<string> {
    if (!this.config.enabled) {
      throw new Error('Encryption is not enabled');
    }

    try {
      // Recreate the key using the appropriate method based on version
      const salt = CryptoJS.enc.Hex.parse(encryptedData.salt);
      let key: CryptoJS.lib.WordArray;

      if (encryptedData.encryptionVersion === 2) {
        // New format: stable key without OTP
        key = this.deriveStableKey(
          options.secret,
          salt,
          options.userId,
          encryptedData.iterations || this.config.iterations
        );
      } else {
        // Legacy format: includes OTP token (may fail for old files)
        console.warn('⚠️  Attempting to decrypt legacy format with OTP token');
        key = this.deriveLegacyKey(
          options.secret,
          salt,
          options.otpToken,
          options.userId,
          encryptedData.iterations || this.config.iterations
        );
      }

      // Parse IV
      const iv = CryptoJS.enc.Hex.parse(encryptedData.iv);

      // Decrypt the data
      const decrypted = CryptoJS.AES.decrypt(encryptedData.data, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });

      const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
      
      if (!plaintext) {
        throw new Error('Failed to decrypt data - invalid key or corrupted data');
      }

      return plaintext;
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Encrypt file content if encryption is enabled
   */
  async encryptFileContent(
    content: string,
    options: DecryptionOptions
  ): Promise<string> {
    if (!this.config.enabled) {
      return content; // Return plain content if encryption is disabled
    }

    const encrypted = await this.encryptData(content, options);
    
    // Return as JSON string for storage
    return JSON.stringify(encrypted);
  }

  /**
   * Decrypt file content if it's encrypted
   */
  async decryptFileContent(
    content: string,
    options: DecryptionOptions
  ): Promise<string> {
    if (!this.config.enabled) {
      return content; // Return as-is if encryption is disabled
    }

    try {
      // Try to parse as encrypted data
      const encryptedData: EncryptedData = JSON.parse(content);
      
      // Validate it looks like encrypted data
      if (!encryptedData.data || !encryptedData.iv || !encryptedData.salt) {
        // Might be plain text, return as-is
        return content;
      }

      return await this.decryptData(encryptedData, options);
    } catch (error) {
      // If parsing fails, it might be plain text
      if (error instanceof SyntaxError) {
        return content;
      }
      throw error;
    }
  }

  /**
   * Check if content appears to be encrypted
   */
  isContentEncrypted(content: string): boolean {
    try {
      const parsed = JSON.parse(content);
      return !!(parsed.data && parsed.iv && parsed.salt && parsed.algorithm);
    } catch {
      return false;
    }
  }

  /**
   * NEW: Derive a stable encryption key (without OTP tokens)
   * This prevents permanent data loss from time-based tokens
   */
  private deriveStableKey(
    masterSecret: string,
    salt: CryptoJS.lib.WordArray,
    userId?: string,
    iterations?: number
  ): CryptoJS.lib.WordArray {
    // Combine stable key material only
    let keyMaterial = masterSecret;
    
    // User ID can be included as it's stable
    if (userId) {
      keyMaterial += userId;
    }

    // DO NOT include OTP tokens here - they change every 30 seconds!

    // Use PBKDF2 to derive the key
    return CryptoJS.PBKDF2(keyMaterial, salt, {
      keySize: this.config.keySize / 32, // Convert bits to words
      iterations: iterations || this.config.iterations,
      hasher: CryptoJS.algo.SHA256
    });
  }

  /**
   * LEGACY: Old key derivation method (for backward compatibility)
   * This will likely fail for files encrypted more than 30 seconds ago
   */
  private deriveLegacyKey(
    masterSecret: string,
    salt: CryptoJS.lib.WordArray,
    otpToken?: string,
    userId?: string,
    iterations?: number
  ): CryptoJS.lib.WordArray {
    // Combine all key material (legacy method)
    let keyMaterial = masterSecret;
    
    if (otpToken) {
      keyMaterial += otpToken;
    }
    
    if (userId) {
      keyMaterial += userId;
    }

    // Use PBKDF2 to derive the key
    return CryptoJS.PBKDF2(keyMaterial, salt, {
      keySize: this.config.keySize / 32, // Convert bits to words
      iterations: iterations || this.config.iterations,
      hasher: CryptoJS.algo.SHA256
    });
  }

  /**
   * Get current encryption configuration
   */
  getConfig(): EncryptionConfig {
    return { ...this.config };
  }

  /**
   * Update encryption configuration
   */
  updateConfig(newConfig: Partial<EncryptionConfig>): void {
    this.config = EncryptionConfigSchema.parse({
      ...this.config,
      ...newConfig
    });
  }

  /**
   * Generate a master secret for encryption
   */
  static generateMasterSecret(length: number = 32): string {
    return CryptoJS.lib.WordArray.random(length).toString();
  }

  /**
   * Validate decryption options
   */
  private validateDecryptionOptions(options: DecryptionOptions): void {
    if (!options.secret) {
      throw new Error('Master secret is required for encryption/decryption');
    }
  }
} 