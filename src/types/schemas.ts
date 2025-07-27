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

// Tool Input Schemas
export const GetPersonalInfoInputSchema = z.object({
  has_list_available_personal_info: z.boolean().default(false).describe("If true, you already listed all categories"),
  category: z.string().min(1, "Category is required").describe("e.g., 'name', 'phone', 'address', 'hobbies', 'pets', 'family', 'friends', 'work'"),
  subcategory: z.string().optional()
});

export const SavePersonalInfoInputSchema = z.object({
  category: z.string().min(1, "Category is required"),
  subcategory: z.string().optional(),
  content: z.string().min(1, "Content is required"),
  scope: z.string().min(1, "Scope is required").describe("public, contact, location, personal, memories, sensitive, or custom scope"),
  tags: z.array(z.string()).optional()
});

export const UpdatePersonalInfoInputSchema = z.object({
  category: z.string().min(1, "Category is required"),
  subcategory: z.string().optional(),
  content: z.string().optional(),
  scope: z.string().optional(),
  tags: z.array(z.string()).optional()
});

export const ListAvailableInfoInputSchema = z.object({
  scope_filter: z.string().optional()
});

export const DeletePersonalInfoInputSchema = z.object({
  category: z.string().min(1, "Category is required"),
  subcategory: z.string().optional()
});

export const SearchMemoriesInputSchema = z.object({
  query: z.string().min(1, "Query is required"),
  tags: z.array(z.string()).optional(),
  date_range: z.object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format")
  }).optional()
});

export const CreateScopeInputSchema = z.object({
  scope_name: z.string()
    .regex(/^[a-z][a-z0-9_-]*$/, "Must start with lowercase letter, contain only lowercase letters, numbers, underscores, and hyphens")
    .min(2, "Must be at least 2 characters")
    .max(50, "Must be at most 50 characters"),
  description: z.string().min(5, "Description must be at least 5 characters"),
  parent_scope: z.string().optional(),
  sensitivity_level: z.number().min(1).max(10).default(5).describe("1=public, 10=highly sensitive")
});

export const ListScopesInputSchema = z.object({
  include_custom_only: z.boolean().optional(),
  show_hierarchy: z.boolean().optional()
});

// Batch operation schemas
export const BatchGetPersonalInfoInputSchema = z.object({
  has_list_available_personal_info: z.boolean().default(false).describe("If true, you already listed all categories"),
  requests: z.array(z.object({
    category: z.string().min(1, "Category is required").describe("e.g., 'name','phone', 'address', 'hobbies', 'pets', 'family', 'friends', 'work'"),
    subcategory: z.string().optional()
  })).min(1, "At least one request is required")
});

export const BatchSavePersonalInfoInputSchema = z.object({
  items: z.array(z.object({
    category: z.string().min(1, "Category is required"),
    subcategory: z.string().optional(),
    content: z.string().min(1, "Content is required"),
    scope: z.string().min(1, "Scope is required").describe("public, contact, location, personal, memories, sensitive, or custom scope"),
    tags: z.array(z.string()).optional()
  })).min(1, "At least one item is required")
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

// Type exports
export type PersonalInfoFile = z.infer<typeof PersonalInfoFileSchema>;
export type CustomScope = z.infer<typeof CustomScopeSchema>;
export type BuiltInScope = z.infer<typeof BuiltInScopeSchema>;
export type GetPersonalInfoInput = z.infer<typeof GetPersonalInfoInputSchema>;
export type SavePersonalInfoInput = z.infer<typeof SavePersonalInfoInputSchema>;
export type UpdatePersonalInfoInput = z.infer<typeof UpdatePersonalInfoInputSchema>;
export type ListAvailableInfoInput = z.infer<typeof ListAvailableInfoInputSchema>;
export type DeletePersonalInfoInput = z.infer<typeof DeletePersonalInfoInputSchema>;
export type SearchMemoriesInput = z.infer<typeof SearchMemoriesInputSchema>;
export type CreateScopeInput = z.infer<typeof CreateScopeInputSchema>;
export type ListScopesInput = z.infer<typeof ListScopesInputSchema>;
export type BatchGetPersonalInfoInput = z.infer<typeof BatchGetPersonalInfoInputSchema>;
export type BatchSavePersonalInfoInput = z.infer<typeof BatchSavePersonalInfoInputSchema>;
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

// OTP Setup Input Schema
export const SetupOTPInputSchema = z.object({
  issuer: z.string().optional().describe("Service name (defaults to 'Personal MCP Server')"),
  label: z.string().optional().describe("Account label (defaults to 'Personal Data Access')"),
  digits: z.number().min(4).max(8).optional().describe("Number of digits in OTP tokens (default: 6)"),
  period: z.number().min(15).max(300).optional().describe("Token validity period in seconds (default: 30)")
});

// OTP Verification Input Schema
export const VerifyOTPInputSchema = z.object({
  token: z.string().describe("OTP token from authenticator app or backup code"),
  useBackupCode: z.boolean().default(false).describe("Set to true if using a backup code"),
  userId: z.string().optional()
});

// OTP Status Input Schema
export const OTPStatusInputSchema = z.object({});

// Regenerate Backup Codes Input Schema
export const RegenerateBackupCodesInputSchema = z.object({});

// OTP Debug Input Schema
export const OTPDebugInputSchema = z.object({});