import { FileManager } from '../managers/FileManager.js';
import { OTPManager } from '../managers/OTPManager.js';
import { EncryptionManager } from '../managers/EncryptionManager.js';
import { EnvironmentConfigSchema } from '../types/schemas.js';

export interface ServerContext {
  readonly config: ReturnType<typeof EnvironmentConfigSchema.parse>;
  readonly fileManager: FileManager;
  readonly otpManager: OTPManager;
  readonly encryptionManager: EncryptionManager;
  readonly currentOTPSession: OTPSession | null;
}

export interface OTPSession {
  readonly token: string;
  readonly expires: number;
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

// Utility function to get decryption options from context
export const getDecryptionOptions = (context: ServerContext): any => {
  
  if (context.encryptionManager.isEnabled()) {
    return {
      secret: context.config.PERSONAL_INFO_ENCRYPTION_KEY || 'default-secret',
    };
  }

  return null;
};
