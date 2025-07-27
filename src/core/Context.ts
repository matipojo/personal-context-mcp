import { PermissionManager } from '../managers/PermissionManager.js';
import { FileManager } from '../managers/FileManager.js';
import { OTPManager } from '../managers/OTPManager.js';
import { EncryptionManager } from '../managers/EncryptionManager.js';
import { EnvironmentConfigSchema } from '../types/schemas.js';

export interface ServerContext {
  readonly config: ReturnType<typeof EnvironmentConfigSchema.parse>;
  readonly permissionManager: PermissionManager;
  readonly fileManager: FileManager;
  readonly otpManager: OTPManager;
  readonly encryptionManager: EncryptionManager;
  readonly currentOTPSession: OTPSession | null;
}

export interface OTPSession {
  readonly token: string;
  readonly expires: number;
  readonly userId?: string;
}

export interface ToolResult {
  [x: string]: unknown;
  content: Array<{
    type: 'text';
    text: string;
  } | {
    type: 'image';
    data: string;
    mimeType: string;
  }>;
}

export type ToolHandler<T = unknown> = (
  args: T,
  context: ServerContext
) => Promise<ToolResult>;

// Helper type for updating OTP session
export interface ServerContextWithOTP extends Omit<ServerContext, 'currentOTPSession'> {
  readonly currentOTPSession: OTPSession;
}

// Utility function to create context with updated OTP session
export const withOTPSession = (
  context: ServerContext,
  session: OTPSession | null
): ServerContext => ({
  ...context,
  currentOTPSession: session
});

// Utility function to get decryption options from context
export const getDecryptionOptions = (context: ServerContext): any => {
  // If encryption is enabled, enforce OTP requirements for ACCESS CONTROL
  if (context.encryptionManager.isEnabled()) {
    // If OTP is not enabled but encryption is, require OTP setup first
    if (!context.otpManager.isEnabled()) {
      throw new Error('🔒 Encryption is enabled but OTP is not set up. Please use setup_otp tool first to secure your data.');
    }

    // If no active OTP session, require verification
    if (!context.currentOTPSession || Date.now() > context.currentOTPSession.expires) {
      throw new Error('🔒 OTP verification required. Please use verify_otp tool first to access encrypted data.');
    }

    console.error('🔓 Using OTP session for access control:', {
      hasToken: !!context.currentOTPSession.token,
      expires: new Date(context.currentOTPSession.expires).toISOString(),
      userId: context.currentOTPSession.userId
    });

    // FIXED: Use stable encryption key without time-based OTP tokens
    // OTP is only used for access control, not encryption key derivation
    return {
      secret: context.config.PERSONAL_INFO_ENCRYPTION_KEY || 'default-secret',
      // Note: otpToken is still passed for legacy file compatibility but not used in new encryption
      otpToken: context.currentOTPSession.token,
      userId: context.currentOTPSession.userId
    };
  }

  // If encryption is not enabled, return null (no encryption needed)
  return null;
}; 