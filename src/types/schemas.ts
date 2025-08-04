import { z } from 'zod';
import os from 'os';
import path from 'path';

// Tool Names Enum
export enum ToolNames {
  UPDATE_PERSONAL_INFO = 'update_personal_info',
  LIST_AVAILABLE_PERSONAL_INFO = 'list_available_personal_info',
  DELETE_PERSONAL_INFO = 'delete_personal_info',
  SEARCH_PERSONAL_MEMORIES = 'search_personal_memories',
  BATCH_GET_PERSONAL_INFO = 'batch_get_personal_info',
  BATCH_SAVE_PERSONAL_INFO = 'batch_save_personal_info',
  SETUP_OTP = 'setup_otp',
  VERIFY_OTP = 'verify_otp',
  DISABLE_OTP = 'disable_otp',
  OTP_STATUS = 'otp_status'
}

// Personal Information File Schema
export const PersonalInfoFileSchema = z.object({
  frontmatter: z.object({
    category: z.string(),
    subcategory: z.string().optional(),
    created: z.string().datetime(),
    updated: z.string().datetime(),
    tags: z.array(z.string()).default([])
  }),
  content: z.string(),
  filePath: z.string()
});

// Environment Configuration Schema
export const EnvironmentConfigSchema = z.object({
  PERSONAL_INFO_DATA_DIR: z.string().default(path.join(os.homedir(), '.personal-context-data')),
  PERSONAL_INFO_DEFAULT_SCOPE: z.string().default('public'),
  PERSONAL_INFO_MAX_FILE_SIZE: z.number().default(1048576), // 1MB
  PERSONAL_INFO_BACKUP_ENABLED: z.boolean().default(true),
  PERSONAL_INFO_BACKUP_DIR: z.string().default(path.join(os.homedir(), '.personal-context-data', 'backups')),
  PERSONAL_INFO_ENCRYPTION_ENABLED: z.boolean().default(false),
  PERSONAL_INFO_ENCRYPTION_KEY: z.string().optional()
});

// Type exports for shared schemas
export type PersonalInfoFile = z.infer<typeof PersonalInfoFileSchema>;
export type EnvironmentConfig = z.infer<typeof EnvironmentConfigSchema>;