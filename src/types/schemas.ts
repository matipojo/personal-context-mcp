import { z } from 'zod';

// Tool Names Enum
export enum ToolNames {
  GET_PERSONAL_INFO = 'get_personal_info',
  SAVE_PERSONAL_INFO = 'save_personal_info',
  UPDATE_PERSONAL_INFO = 'update_personal_info',
  LIST_AVAILABLE_PERSONAL_INFO = 'list_available_personal_info',
  DELETE_PERSONAL_INFO = 'delete_personal_info',
  SEARCH_PERSONAL_MEMORIES = 'search_personal_memories',
  CREATE_PERSONAL_SCOPE = 'create_personal_scope',
  LIST_PERSONAL_SCOPES = 'list_personal_scopes',
  BATCH_GET_PERSONAL_INFO = 'batch_get_personal_info',
  BATCH_SAVE_PERSONAL_INFO = 'batch_save_personal_info',
  SETUP_OTP = 'setup_otp',
  VERIFY_OTP = 'verify_otp',
  DISABLE_OTP = 'disable_otp',
  OTP_STATUS = 'otp_status',
  REGENERATE_BACKUP_CODES = 'regenerate_backup_codes',
  OTP_DEBUG = 'otp_debug'
}

// Personal Information File Schema
export const PersonalInfoFileSchema = z.object({
  frontmatter: z.object({
    scope: z.string(),
    category: z.string(),
    subcategory: z.string().optional(),
    created: z.string().datetime(),
    updated: z.string().datetime(),
    tags: z.array(z.string()).default([])
  }),
  content: z.string(),
  filePath: z.string()
});

// Custom Scope Schema
export const CustomScopeSchema = z.object({
  description: z.string().min(1, "Description is required"),
  sensitivity_level: z.number().min(1).max(10).describe("1=public, 10=highly sensitive"),
  parent_scope: z.string().optional(),
  created: z.string().datetime()
});

// Built-in Scope Definition Schema
export const BuiltInScopeSchema = z.object({
  name: z.string(),
  description: z.string(),
  sensitivity_level: z.number().min(1).max(10),
  example_data: z.string()
});

// Environment Configuration Schema
export const EnvironmentConfigSchema = z.object({
  PERSONAL_INFO_DATA_DIR: z.string().default('./data'),
  PERSONAL_INFO_DEFAULT_SCOPE: z.string().default('public'),
  PERSONAL_INFO_MAX_FILE_SIZE: z.number().default(1048576), // 1MB
  PERSONAL_INFO_BACKUP_ENABLED: z.boolean().default(true),
  PERSONAL_INFO_BACKUP_DIR: z.string().default('./backups'),
  PERSONAL_INFO_ENCRYPTION_ENABLED: z.boolean().default(false),
  PERSONAL_INFO_ENCRYPTION_KEY: z.string().optional()
});

// Scope Configuration Schema
export const ScopeConfigSchema = z.object({
  allowedScopes: z.array(z.string()),
  defaultScope: z.string()
});

// Type exports for shared schemas
export type PersonalInfoFile = z.infer<typeof PersonalInfoFileSchema>;
export type CustomScope = z.infer<typeof CustomScopeSchema>;
export type BuiltInScope = z.infer<typeof BuiltInScopeSchema>;
export type EnvironmentConfig = z.infer<typeof EnvironmentConfigSchema>;
export type ScopeConfig = z.infer<typeof ScopeConfigSchema>;

// Built-in scopes definition
export const BUILT_IN_SCOPES: BuiltInScope[] = [
  {
    name: 'public',
    description: 'Publicly shareable information',
    sensitivity_level: 1,
    example_data: 'Name, avatar, bio'
  },
  {
    name: 'contact',
    description: 'Contact information',
    sensitivity_level: 3,
    example_data: 'Email, phone, social media'
  },
  {
    name: 'location',
    description: 'Location-based data',
    sensitivity_level: 5,
    example_data: 'Address, current location, places'
  },
  {
    name: 'personal',
    description: 'Personal details',
    sensitivity_level: 6,
    example_data: 'Age, hobbies, preferences'
  },
  {
    name: 'memories',
    description: 'Personal memories and experiences',
    sensitivity_level: 7,
    example_data: 'Trips, events, relationships'
  },
  {
    name: 'sensitive',
    description: 'Sensitive information',
    sensitivity_level: 9,
    example_data: 'Health data, financial info'
  }
];