import { authenticator, totp } from 'otplib';
import fs from 'fs-extra';
import path from 'path';
import { z } from 'zod';
import QRCode from 'qrcode';

// Schema for OTP configuration
const OTPConfigSchema = z.object({
  secret: z.string(),
  issuer: z.string().default('Personal MCP Server'),
  label: z.string().default('Personal Data Access'),
  digits: z.number().min(4).max(8).default(6),
  period: z.number().min(15).max(300).default(30),
  window: z.number().min(0).max(10).default(1),
  algorithm: z.enum(['sha1', 'sha256', 'sha512']).default('sha1'),
  enabled: z.boolean().default(false)
});

export type OTPConfig = z.infer<typeof OTPConfigSchema>;

export interface OTPVerificationResult {
  isValid: boolean;
  timeRemaining?: number;
  token?: string;
}

export class OTPManager {
  private configPath: string;
  private config: OTPConfig | null = null;

  constructor(dataDir: string) {
    this.configPath = path.join(dataDir, '.security', 'otp-config.json');
  }

  /**
   * Initialize the OTP manager
   */
  async initialize(): Promise<void> {
    await fs.ensureDir(path.dirname(this.configPath));
    await this.loadConfig();
  }

  /**
   * Set up OTP authentication
   */
  async setupOTP(options: Partial<OTPConfig> & { qrSize?: number } = {}): Promise<{
    secret: string;
    qrCodeUri: string;
    qrCodeDataURL: string;
    qrCodeSVG: string;
    backupCodes: string[];
  }> {
    // Generate a cryptographically secure secret
    const secret = options.secret || authenticator.generateSecret();
    
    const config: OTPConfig = OTPConfigSchema.parse({
      secret,
      issuer: options.issuer || 'Personal MCP Server',
      label: options.label || 'Personal Data Access',
      digits: options.digits || 6,
      period: options.period || 30,
      window: options.window || 1,
      algorithm: options.algorithm || 'sha1',
      enabled: true
    });

    // Generate QR code URI for authenticator apps
    const qrCodeUri = authenticator.keyuri(
      config.label,
      config.issuer,
      config.secret
    );

    // Generate backup codes (10 single-use codes)
    const backupCodes = this.generateBackupCodes();

    // Use provided QR code size or default to 128
    const qrSize = options.qrSize || 128;

    // Generate QR code as data URL (PNG image)
    const qrCodeDataURL = await QRCode.toDataURL(qrCodeUri, {
      errorCorrectionLevel: 'M',
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      width: qrSize
    });

    // Generate QR code as SVG (scalable)
    const qrCodeSVG = await QRCode.toString(qrCodeUri, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      width: qrSize
    });

    // Save configuration
    await this.saveConfig(config, backupCodes);
    this.config = config;

    // Optionally save QR code as file
    await this.saveQRCodeFile(qrCodeUri, qrCodeDataURL, qrCodeSVG);

    console.error('OTP setup completed successfully');
    return {
      secret: config.secret,
      qrCodeUri,
      qrCodeDataURL,
      qrCodeSVG,
      backupCodes
    };
  }

  /**
   * Verify an OTP token
   */
  async verifyToken(token: string, useBackupCode: boolean = false): Promise<OTPVerificationResult> {
    if (!this.config || !this.config.enabled) {
      throw new Error('OTP is not enabled');
    }

    // Clean the token (remove spaces, etc.)
    const cleanToken = token.replace(/\s/g, '');

    // If using backup code
    if (useBackupCode) {
      return this.verifyBackupCode(cleanToken);
    }

    try {
      // Configure Authenticator with our settings (use authenticator, not totp for Google compatibility)
      authenticator.options = {
        digits: this.config.digits,
        period: this.config.period,
        algorithm: this.config.algorithm as any,
        window: this.config.window
      };

      console.error('🔍 OTP Debug Info:');
      console.error('  - Token provided:', cleanToken);
      console.error('  - Secret (first 8 chars):', this.config.secret.substring(0, 8) + '...');
      console.error('  - Algorithm:', this.config.algorithm);
      console.error('  - Digits:', this.config.digits);
      console.error('  - Period:', this.config.period);
      console.error('  - Window:', this.config.window);
      
      // Generate current expected token using authenticator (Google-compatible)
      const currentExpected = authenticator.generate(this.config.secret);
      console.error('  - Current expected token (authenticator):', currentExpected);
      
      // Also try TOTP for comparison
      totp.options = {
        digits: this.config.digits,
        period: this.config.period,
        algorithm: this.config.algorithm as any
      };
      const totpExpected = totp.generate(this.config.secret);
      console.error('  - Current expected token (totp):', totpExpected);
      console.error('  - Encoding difference detected:', currentExpected !== totpExpected);

      // Try verification with authenticator (Google-compatible)
      const isValid = authenticator.verify({
        token: cleanToken,
        secret: this.config.secret
      });

      console.error('  - Verification result:', isValid);

      if (isValid) {
        // Calculate time remaining manually
        const now = Math.floor(Date.now() / 1000);
        const period = this.config.period;
        const timeInCurrentPeriod = now % period;
        const timeRemaining = (period - timeInCurrentPeriod) * 1000; // Convert to milliseconds
        
        return {
          isValid: true,
          timeRemaining,
          token: cleanToken
        };
      }

      // Try with larger window using authenticator
      authenticator.options = { ...authenticator.options, window: 5 };
      const isValidLargeWindow = authenticator.verify({
        token: cleanToken,
        secret: this.config.secret
      });
      
      console.error('  - Verification with larger window (±5):', isValidLargeWindow);

      return { isValid: false };
    } catch (error) {
      console.error('OTP verification error:', error);
      return { isValid: false };
    }
  }

  /**
   * Generate a current token (useful for testing)
   */
  async generateCurrentToken(): Promise<string> {
    if (!this.config || !this.config.enabled) {
      throw new Error('OTP is not enabled');
    }

    authenticator.options = {
      digits: this.config.digits,
      period: this.config.period,
      algorithm: this.config.algorithm as any
    };

    return authenticator.generate(this.config.secret);
  }

  /**
   * Check if OTP is enabled and configured
   */
  isEnabled(): boolean {
    return this.config?.enabled === true;
  }

  /**
   * Get OTP configuration (without secret)
   */
  getConfig(): Omit<OTPConfig, 'secret'> | null {
    if (!this.config) return null;

    const { secret, ...configWithoutSecret } = this.config;
    return configWithoutSecret;
  }

  /**
   * Disable OTP
   */
  async disableOTP(): Promise<void> {
    if (this.config) {
      this.config.enabled = false;
      await this.saveConfig(this.config);
    }
  }

  /**
   * Enable OTP (if previously configured)
   */
  async enableOTP(): Promise<void> {
    if (this.config) {
      this.config.enabled = true;
      await this.saveConfig(this.config);
    }
  }

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(): Promise<string[]> {
    if (!this.config) {
      throw new Error('OTP is not configured');
    }

    const backupCodes = this.generateBackupCodes();
    await this.saveConfig(this.config, backupCodes);
    return backupCodes;
  }

  /**
   * Debug method to get current OTP information
   */
  async getDebugInfo(): Promise<{
    isEnabled: boolean;
    currentToken?: string;
    nextToken?: string;
    timeRemaining?: number;
    timestamp: number;
    config?: Omit<OTPConfig, 'secret'>;
    secretPreview?: string;
  }> {
    if (!this.config || !this.config.enabled) {
      return {
        isEnabled: false,
        timestamp: Math.floor(Date.now() / 1000)
      };
    }

    try {
      // Configure Authenticator (Google-compatible)
      authenticator.options = {
        digits: this.config.digits,
        period: this.config.period,
        algorithm: this.config.algorithm as any
      };

      const currentToken = authenticator.generate(this.config.secret);
      
      // Calculate time remaining manually since totp.timeRemaining() seems buggy
      const now = Math.floor(Date.now() / 1000);
      const period = this.config.period;
      const timeInCurrentPeriod = now % period;
      const timeRemaining = (period - timeInCurrentPeriod) * 1000; // Convert to milliseconds
      
      // Calculate next token by temporarily modifying the time
      const currentTime = Date.now();
      const futureTime = currentTime + (this.config.period * 1000);
      
      // Temporarily override Date.now for next token calculation
      const originalNow = Date.now;
      Date.now = () => futureTime;
      const nextToken = totp.generate(this.config.secret);
      Date.now = originalNow;

      const { secret, ...configWithoutSecret } = this.config;

      return {
        isEnabled: true,
        currentToken,
        nextToken,
        timeRemaining,
        timestamp: Math.floor(Date.now() / 1000),
        config: configWithoutSecret,
        secretPreview: secret.substring(0, 8) + '...'
      };
    } catch (error) {
      console.error('Error getting debug info:', error);
      return {
        isEnabled: true,
        timestamp: Math.floor(Date.now() / 1000)
      };
    }
  }

  /**
   * Load OTP configuration from disk
   */
  private async loadConfig(): Promise<void> {
    try {
      if (await fs.pathExists(this.configPath)) {
        const data = await fs.readJson(this.configPath);
        this.config = OTPConfigSchema.parse(data.config);
        console.error('OTP configuration loaded');
      }
    } catch (error) {
      console.warn('Failed to load OTP configuration:', error);
      this.config = null;
    }
  }

  /**
   * Save OTP configuration to disk
   */
  private async saveConfig(config: OTPConfig, backupCodes?: string[]): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(this.configPath));
      
      const data: any = {
        config,
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      };

      if (backupCodes) {
        data.backupCodes = backupCodes.map(code => ({
          code,
          used: false,
          created: new Date().toISOString()
        }));
      } else if (await fs.pathExists(this.configPath)) {
        // Preserve existing backup codes
        const existing = await fs.readJson(this.configPath);
        data.backupCodes = existing.backupCodes || [];
        data.created = existing.created;
      }

      await fs.writeJson(this.configPath, data, { spaces: 2 });
      console.error('OTP configuration saved');
    } catch (error) {
      throw new Error(`Failed to save OTP configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate backup codes for emergency access
   */
  private generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric backup codes
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Save QR code as files for easy access
   */
  private async saveQRCodeFile(uri: string, dataURL: string, svg: string): Promise<void> {
    try {
      const qrDir = path.join(path.dirname(this.configPath), 'qr-codes');
      await fs.ensureDir(qrDir);

      // Save QR code URI
      await fs.writeFile(path.join(qrDir, 'otp-uri.txt'), uri, 'utf-8');

      // Save QR code as PNG (from data URL)
      const base64Data = dataURL.replace(/^data:image\/png;base64,/, '');
      await fs.writeFile(path.join(qrDir, 'otp-qrcode.png'), base64Data, 'base64');

      // Save QR code as SVG
      await fs.writeFile(path.join(qrDir, 'otp-qrcode.svg'), svg, 'utf-8');

      console.error('QR code files saved to:', qrDir);
    } catch (error) {
      console.warn('Failed to save QR code files:', error);
    }
  }

  /**
   * Verify a backup code
   */
  private async verifyBackupCode(code: string): Promise<OTPVerificationResult> {
    try {
      if (!await fs.pathExists(this.configPath)) {
        return { isValid: false };
      }

      const data = await fs.readJson(this.configPath);
      const backupCodes = data.backupCodes || [];

      const matchingCode = backupCodes.find((bc: any) => 
        bc.code === code.toUpperCase() && !bc.used
      );

      if (matchingCode) {
        // Mark the backup code as used
        matchingCode.used = true;
        matchingCode.usedAt = new Date().toISOString();
        
        await fs.writeJson(this.configPath, data, { spaces: 2 });
        
        return {
          isValid: true,
          token: code
        };
      }

      return { isValid: false };
    } catch (error) {
      console.error('Backup code verification error:', error);
      return { isValid: false };
    }
  }
} 