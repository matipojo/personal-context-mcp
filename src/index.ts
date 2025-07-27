#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import path from 'path';
import { 
  EnvironmentConfigSchema,
  GetPersonalInfoInputSchema,
  SavePersonalInfoInputSchema,
  UpdatePersonalInfoInputSchema,
  ListAvailableInfoInputSchema,
  DeletePersonalInfoInputSchema,
  SearchMemoriesInputSchema,
  CreateScopeInputSchema,
  ListScopesInputSchema,
  BatchGetPersonalInfoInputSchema,
  BatchSavePersonalInfoInputSchema,
  SetupOTPInputSchema,
  VerifyOTPInputSchema,
  OTPStatusInputSchema,
  RegenerateBackupCodesInputSchema,
  OTPDebugInputSchema,
  ToolNames
} from './types/schemas.js';
import { resolveScopeConfig } from './utils/scopeParser.js';
import { parseDataDirectory } from './utils/scopeParser.js';
import { PermissionManager } from './managers/PermissionManager.js';
import { FileManager } from './managers/FileManager.js';
import { OTPManager, type OTPVerificationResult } from './managers/OTPManager.js';
import { EncryptionManager } from './managers/EncryptionManager.js';

class PersonalInfoMCPServer {
  private server: Server;
  private permissionManager!: PermissionManager;
  private fileManager!: FileManager;
  private otpManager!: OTPManager;
  private encryptionManager!: EncryptionManager;
  private config: ReturnType<typeof EnvironmentConfigSchema.parse>;
  private currentOTPSession: { token: string; expires: number; userId?: string } | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'personal-info-mcp-server',
        version: '1.0.0',
      }
    );

    // Parse data directory from command line arguments, fall back to environment variable
    const cmdDataDir = parseDataDirectory(process.argv);
    const rawDataDir = cmdDataDir || process.env.PERSONAL_INFO_DATA_DIR || './data';
    
    // Resolve relative paths to absolute paths based on current working directory
    const resolvedDataDir = path.isAbsolute(rawDataDir) 
      ? rawDataDir 
      : path.resolve(process.cwd(), rawDataDir);
    
    // Log path resolution for debugging
    if (rawDataDir !== resolvedDataDir) {
      console.error(`📁 Data directory resolved: "${rawDataDir}" → "${resolvedDataDir}"`);
    } else {
      console.error(`📁 Data directory (absolute): "${resolvedDataDir}"`);
    }
    
    // Resolve backup directory path as well
    const rawBackupDir = process.env.PERSONAL_INFO_BACKUP_DIR || './backups';
    const resolvedBackupDir = path.isAbsolute(rawBackupDir) 
      ? rawBackupDir 
      : path.resolve(process.cwd(), rawBackupDir);
    
    // Parse environment configuration
    this.config = EnvironmentConfigSchema.parse({
      PERSONAL_INFO_DATA_DIR: resolvedDataDir,
      PERSONAL_INFO_DEFAULT_SCOPE: process.env.PERSONAL_INFO_DEFAULT_SCOPE,
      PERSONAL_INFO_MAX_FILE_SIZE: process.env.PERSONAL_INFO_MAX_FILE_SIZE ? 
        parseInt(process.env.PERSONAL_INFO_MAX_FILE_SIZE) : undefined,
      PERSONAL_INFO_BACKUP_ENABLED: process.env.PERSONAL_INFO_BACKUP_ENABLED === 'true',
      PERSONAL_INFO_BACKUP_DIR: resolvedBackupDir,
      PERSONAL_INFO_ENCRYPTION_ENABLED: process.env.PERSONAL_INFO_ENCRYPTION_ENABLED === 'true',
      PERSONAL_INFO_ENCRYPTION_KEY: process.env.PERSONAL_INFO_ENCRYPTION_KEY
    });

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: ToolNames.SAVE_PERSONAL_INFO,
            description: 'Save or update personal information. You should save things on every time when user enters new personal information that not saved yet.',
            inputSchema: {
              type: 'object',
              properties: {
                category: { type: 'string' },
                subcategory: { type: 'string' },
                content: { type: 'string' },
                scope: { 
                  type: 'string',
                  description: 'Scope for the information (public, contact, location, personal, memories, sensitive, or custom scope)'
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Optional tags for categorization'
                }
              },
              required: ['category', 'content', 'scope']
            }
          },
          {
            name: ToolNames.UPDATE_PERSONAL_INFO,
            description: 'Update existing personal information. Only updates specified fields, leaving others unchanged.',
            inputSchema: {
              type: 'object',
              properties: {
                category: { 
                  type: 'string',
                  description: 'Category of information to update'
                },
                subcategory: { 
                  type: 'string',
                  description: 'Optional subcategory filter'
                },
                content: { 
                  type: 'string',
                  description: 'New content (optional - if not provided, content remains unchanged)'
                },
                scope: { 
                  type: 'string',
                  description: 'New scope for the information (optional - if not provided, scope remains unchanged)'
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'New tags (optional - if not provided, tags remain unchanged)'
                }
              },
              required: ['category']
            }
          },
          {
            name: ToolNames.LIST_AVAILABLE_PERSONAL_INFO,
            description: `List all available personal information within current scope. use it when the user needs personal information, 
            for example, when the user asks writing a message, or on shopping and the address is needed, .`,
            inputSchema: {
              type: 'object',
              properties: {
                scope_filter: {
                  type: 'string',
                  description: 'Optional scope filter to narrow results'
                }
              }
            }
          },
          {
            name: ToolNames.DELETE_PERSONAL_INFO,
            description: 'Delete specific personal information',
            inputSchema: {
              type: 'object',
              properties: {
                category: { type: 'string' },
                subcategory: { type: 'string' }
              },
              required: ['category']
            }
          },
          {
            name: ToolNames.SEARCH_PERSONAL_MEMORIES,
            description: 'Search through memories and experiences',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query' },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Filter by tags'
                },
                date_range: {
                  type: 'object',
                  properties: {
                    start: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
                    end: { type: 'string', description: 'End date (YYYY-MM-DD)' }
                  },
                  description: 'Filter by date range'
                }
              },
              required: ['query']
            }
          },
          {
            name: ToolNames.CREATE_PERSONAL_SCOPE,
            description: 'Create a new custom scope for organizing personal information',
            inputSchema: {
              type: 'object',
              properties: {
                scope_name: {
                  type: 'string',
                  description: 'Name of the new scope (lowercase, alphanumeric, underscores, hyphens)'
                },
                description: {
                  type: 'string',
                  description: 'Description of what this scope contains'
                },
                parent_scope: {
                  type: 'string',
                  description: 'Optional parent scope for inheritance'
                },
                sensitivity_level: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 10,
                  description: 'Sensitivity level (1=public, 10=highly sensitive)'
                }
              },
              required: ['scope_name', 'description']
            }
          },
          {
            name: ToolNames.LIST_PERSONAL_SCOPES,
            description: 'List all available scopes (built-in and custom) with their details',
            inputSchema: {
              type: 'object',
              properties: {
                include_custom_only: {
                  type: 'boolean',
                  description: 'If true, only show custom scopes'
                },
                show_hierarchy: {
                  type: 'boolean',
                  description: 'If true, show scope inheritance hierarchy'
                }
              }
            }
          },
          {
            name: ToolNames.BATCH_GET_PERSONAL_INFO,
            description: `Retrieve multiple categories of personal information in a single request.
            Retrieve personal information based on category and current scope permissions, 
            you can get a wide range of information, personal, pets, family, friends, work, etc and even more.
            You must list once all the categories with the list_available_personal_info tool before using this tool to understand what you can get.`,
            inputSchema: {
              type: 'object',
              properties: {
                has_list_available_personal_info: {
                  type: 'boolean',
                  description: 'If true, you already listed all the categories with the list_available_personal_info tool'
                },
                requests: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      category: {
                        type: 'string',
                        description: 'Category of information to retrieve (e.g., "name","phone", "address", "hobbies", "pets", "family", "friends", "work")'
                      },
                      subcategory: {
                        type: 'string',
                        description: 'Optional subcategory filter'
                      }
                    },
                    required: ['category']
                  },
                  description: 'Array of requests for different categories/subcategories'
                }
              },
              required: ['requests']
            }
          },
          {
            name: ToolNames.BATCH_SAVE_PERSONAL_INFO,
            description: 'Save multiple pieces of personal information in a single request. More efficient than making multiple individual save requests.',
            inputSchema: {
              type: 'object',
              properties: {
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      category: { type: 'string' },
                      subcategory: { type: 'string' },
                      content: { type: 'string' },
                      scope: { 
                        type: 'string',
                        description: 'Scope for the information (public, contact, location, personal, memories, sensitive, or custom scope)'
                      },
                      tags: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Optional tags for categorization'
                      }
                    },
                    required: ['category', 'content', 'scope']
                  },
                  description: 'Array of personal information items to save'
                }
              },
              required: ['items']
            }
          },
          {
            name: ToolNames.SETUP_OTP,
            description: 'Set up One-Time Password (OTP) authentication for accessing encrypted personal data. Returns QR code and backup codes.',
            inputSchema: {
              type: 'object',
              properties: {
                issuer: {
                  type: 'string',
                  description: 'Service name (defaults to "Personal MCP Server")'
                },
                label: {
                  type: 'string',
                  description: 'Account label (defaults to "Personal Data Access")'
                },
                digits: {
                  type: 'integer',
                  minimum: 4,
                  maximum: 8,
                  description: 'Number of digits in OTP tokens (default: 6)'
                },
                period: {
                  type: 'integer',
                  minimum: 15,
                  maximum: 300,
                  description: 'Token validity period in seconds (default: 30)'
                }
              }
            }
          },
          {
            name: ToolNames.VERIFY_OTP,
            description: 'Verify an OTP token to access encrypted personal data. Required before reading encrypted information.',
            inputSchema: {
              type: 'object',
              properties: {
                token: {
                  type: 'string',
                  description: 'OTP token from authenticator app or backup code'
                },
                useBackupCode: {
                  type: 'boolean',
                  description: 'Set to true if using a backup code instead of OTP token'
                },
                userId: {
                  type: 'string',
                  description: 'Optional user identifier for multi-user scenarios'
                }
              },
              required: ['token']
            }
          },
          {
            name: ToolNames.OTP_STATUS,
            description: `Check the current OTP configuration status and whether OTP verification is required. 
            Don't continue to use any other tools until you get the status of the OTP.`,
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: ToolNames.DISABLE_OTP,
            description: 'Disable OTP authentication and encryption for personal data.',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: ToolNames.REGENERATE_BACKUP_CODES,
            description: 'Generate new backup codes for emergency access. Previous backup codes will be invalidated.',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: ToolNames.OTP_DEBUG,
            description: 'Debug OTP issues by showing current expected tokens and configuration. Use this when OTP verification fails.',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          }
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case ToolNames.GET_PERSONAL_INFO:
            return await this.handleGetPersonalInfo(args);
          case ToolNames.SAVE_PERSONAL_INFO:
            return await this.handleSavePersonalInfo(args);
          case ToolNames.UPDATE_PERSONAL_INFO:
            return await this.handleUpdatePersonalInfo(args);
          case ToolNames.LIST_AVAILABLE_PERSONAL_INFO:
            return await this.handleListAvailableInfo(args);
          case ToolNames.DELETE_PERSONAL_INFO:
            return await this.handleDeletePersonalInfo(args);
          case ToolNames.SEARCH_PERSONAL_MEMORIES:
            return await this.handleSearchMemories(args);
          case ToolNames.CREATE_PERSONAL_SCOPE:
            return await this.handleCreateScope(args);
          case ToolNames.LIST_PERSONAL_SCOPES:
            return await this.handleListScopes(args);
          case ToolNames.BATCH_GET_PERSONAL_INFO:
            return await this.handleBatchGetPersonalInfo(args);
          case ToolNames.BATCH_SAVE_PERSONAL_INFO:
            return await this.handleBatchSavePersonalInfo(args);
          case ToolNames.SETUP_OTP:
            return await this.handleSetupOTP(args);
          case ToolNames.VERIFY_OTP:
            return await this.handleVerifyOTP(args);
          case ToolNames.OTP_STATUS:
            return await this.handleOTPStatus(args);
          case ToolNames.DISABLE_OTP:
            return await this.handleDisableOTP(args);
          case ToolNames.REGENERATE_BACKUP_CODES:
            return await this.handleRegenerateBackupCodes(args);
          case ToolNames.OTP_DEBUG:
            return await this.handleOTPDebug(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${errorMessage}`
            }
          ]
        };
      }
    });
  }

  private async handleGetPersonalInfo(args: unknown) {
    const input = GetPersonalInfoInputSchema.parse(args);

    if (!input.has_list_available_personal_info) {
      throw new Error('You must list once all the categories with the list_available_personal_info tool before using this tool');
    }

    // Get decryption options if OTP is active
    const decryptionOptions = this.getDecryptionOptions();

    const files = await this.fileManager.findFilesByCategory(
      this.permissionManager.getAllowedScopes(),
      input.category,
      input.subcategory,
      decryptionOptions
    );

    if (files.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No ${input.category} information found in accessible scopes.`
          }
        ]
      };
    }

    let result = `## ${input.category.charAt(0).toUpperCase() + input.category.slice(1)} Information\n\n`;
    
    for (const file of files) {
      result += `### ${file.frontmatter.category}`;
      if (file.frontmatter.subcategory) {
        result += ` - ${file.frontmatter.subcategory}`;
      }
      result += `\n\n${file.content}\n\n`;
      result += `*Scope: ${file.frontmatter.scope}, Tags: ${file.frontmatter.tags.join(', ')}, Updated: ${file.frontmatter.updated}*\n\n---\n\n`;
    }

    return {
      content: [
        {
          type: 'text',
          text: result
        }
      ]
    };
  }

  private async handleSavePersonalInfo(args: unknown) {
    const input = SavePersonalInfoInputSchema.parse(args);

    // Get encryption options if OTP is active (this will throw if OTP verification is required)
    const encryptionOptions = this.getDecryptionOptions();

    // Check if we have permission to write to this scope
    if (!this.permissionManager.isAccessAllowed(input.scope)) {
      throw new Error(`Access denied: scope '${input.scope}' is not allowed`);
    }

    // Validate the scope exists
    if (!this.permissionManager.isValidScope(input.scope)) {
      throw new Error(`Invalid scope: '${input.scope}'`);
    }

    const filePath = this.fileManager.getFilePath(input.scope, input.category, input.subcategory);
    const now = new Date().toISOString();

    // Check if file exists to determine if this is an update
    const isUpdate = await this.fileManager.fileExists(filePath);

    // Create backup if updating existing file
    if (isUpdate && this.config.PERSONAL_INFO_BACKUP_ENABLED) {
      await this.fileManager.createBackup(filePath, this.config.PERSONAL_INFO_BACKUP_DIR);
    }

    const existingFile = isUpdate ? await this.fileManager.readMarkdownFile(filePath, encryptionOptions) : null;

    const fileData = {
      frontmatter: {
        scope: input.scope,
        category: input.category,
        subcategory: input.subcategory,
        created: existingFile?.frontmatter.created || now,
        updated: now,
        tags: input.tags || existingFile?.frontmatter.tags || []
      },
      content: input.content,
      filePath: ''
    };

    await this.fileManager.writeMarkdownFile(filePath, fileData, encryptionOptions);

    return {
      content: [
        {
          type: 'text',
          text: `Successfully ${isUpdate ? 'updated' : 'created'} ${input.category}${input.subcategory ? ` (${input.subcategory})` : ''} in scope '${input.scope}'.`
        }
      ]
    };
  }

  private async handleUpdatePersonalInfo(args: unknown) {
    const input = UpdatePersonalInfoInputSchema.parse(args);

    // Get encryption options if OTP is active (this will throw if OTP verification is required)
    const encryptionOptions = this.getDecryptionOptions();

    // First, find the existing file to get current scope if not provided
    const files = await this.fileManager.findFilesByCategory(
      this.permissionManager.getAllowedScopes(),
      input.category,
      input.subcategory,
      encryptionOptions
    );

    if (files.length === 0) {
      throw new Error(`Information not found: ${input.category}${input.subcategory ? ` (${input.subcategory})` : ''}`);
    }

    // Use the first matching file
    const existingFile = files[0]!; // Safe because we checked files.length > 0
    const targetScope = input.scope || existingFile.frontmatter.scope;

    // Check if we have permission to write to this scope
    if (!this.permissionManager.isAccessAllowed(targetScope)) {
      throw new Error(`Access denied: scope '${targetScope}' is not allowed`);
    }

    // Validate the scope exists
    if (!this.permissionManager.isValidScope(targetScope)) {
      throw new Error(`Invalid scope: '${targetScope}'`);
    }

    const filePath = this.fileManager.getFilePath(targetScope, input.category, input.subcategory);
    const now = new Date().toISOString();

    // Create backup if enabled
    if (this.config.PERSONAL_INFO_BACKUP_ENABLED) {
      await this.fileManager.createBackup(filePath, this.config.PERSONAL_INFO_BACKUP_DIR);
    }

    const fileData = {
      frontmatter: {
        scope: targetScope,
        category: input.category,
        subcategory: input.subcategory || existingFile.frontmatter.subcategory,
        created: existingFile.frontmatter.created,
        updated: now,
        tags: input.tags || existingFile.frontmatter.tags
      },
      content: input.content || existingFile.content,
      filePath: ''
    };

    await this.fileManager.writeMarkdownFile(filePath, fileData, encryptionOptions);

    return {
      content: [
        {
          type: 'text',
          text: `Successfully updated ${input.category}${input.subcategory ? ` (${input.subcategory})` : ''} in scope '${targetScope}'.`
        }
      ]
    };
  }

  private async handleListAvailableInfo(args: unknown) {
    const input = ListAvailableInfoInputSchema.parse(args);
    
    // Get decryption options if OTP is active
    const decryptionOptions = this.getDecryptionOptions();
    
    let allowedScopes = this.permissionManager.getAllowedScopes();
    if (input.scope_filter) {
      const filterScopes = input.scope_filter.split(',').map(s => s.trim());
      allowedScopes = allowedScopes.filter(scope => filterScopes.includes(scope));
    }

    const files = await this.fileManager.listFiles(allowedScopes, decryptionOptions);

    if (files.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No personal information found in accessible scopes.'
          }
        ]
      };
    }

    // Group files by scope
    const filesByScope: Record<string, typeof files> = {};
    for (const file of files) {
      if (!filesByScope[file.frontmatter.scope]) {
        filesByScope[file.frontmatter.scope] = [];
      }
      filesByScope[file.frontmatter.scope]!.push(file);
    }

    let result = '# Available Personal Information\n\n';
    
    for (const [scope, scopeFiles] of Object.entries(filesByScope)) {
      result += `## ${scope.charAt(0).toUpperCase() + scope.slice(1)} Scope\n\n`;
      
      for (const file of scopeFiles) {
        result += `- **${file.frontmatter.category}`;
        if (file.frontmatter.subcategory) {
          result += ` (${file.frontmatter.subcategory})`;
        }
        result += `**\n`;
        result += `  - Tags: ${file.frontmatter.tags.join(', ') || 'none'}\n`;
        result += `  - Updated: ${file.frontmatter.updated}\n\n`;
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: result
        }
      ]
    };
  }

  private async handleDeletePersonalInfo(args: unknown) {
    const input = DeletePersonalInfoInputSchema.parse(args);
    
    const files = await this.fileManager.findFilesByCategory(
      this.permissionManager.getAllowedScopes(),
      input.category,
      input.subcategory
    );

    if (files.length === 0) {
      throw new Error(`No ${input.category} information found to delete`);
    }

    let deletedCount = 0;
    for (const file of files) {
      // Check permission for each file's scope
      if (this.permissionManager.isAccessAllowed(file.frontmatter.scope)) {
        const fullPath = this.fileManager.getFilePath(
          file.frontmatter.scope, 
          file.frontmatter.category, 
          file.frontmatter.subcategory
        );
        
        // Create backup if enabled
        if (this.config.PERSONAL_INFO_BACKUP_ENABLED) {
          await this.fileManager.createBackup(fullPath, this.config.PERSONAL_INFO_BACKUP_DIR);
        }
        
        await this.fileManager.deleteFile(fullPath);
        deletedCount++;
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: `Successfully deleted ${deletedCount} ${input.category} file(s).`
        }
      ]
    };
  }

  private async handleSearchMemories(args: unknown) {
    const input = SearchMemoriesInputSchema.parse(args);
    
    // Get decryption options if OTP is active
    const decryptionOptions = this.getDecryptionOptions();
    
    const files = await this.fileManager.searchFiles(
      this.permissionManager.getAllowedScopes(),
      input.query,
      input.tags,
      input.date_range,
      decryptionOptions
    );

    if (files.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No memories found matching query: "${input.query}"`
          }
        ]
      };
    }

    let result = `# Search Results for "${input.query}"\n\n`;
    result += `Found ${files.length} matching item(s):\n\n`;

    for (const file of files) {
      result += `## ${file.frontmatter.category}`;
      if (file.frontmatter.subcategory) {
        result += ` - ${file.frontmatter.subcategory}`;
      }
      result += `\n\n${file.content}\n\n`;
      result += `*Scope: ${file.frontmatter.scope}, Tags: ${file.frontmatter.tags.join(', ')}, Created: ${file.frontmatter.created}*\n\n---\n\n`;
    }

    return {
      content: [
        {
          type: 'text',
          text: result
        }
      ]
    };
  }

  private async handleCreateScope(args: unknown) {
    const input = CreateScopeInputSchema.parse(args);
    
    const customScope = {
      description: input.description,
      sensitivity_level: input.sensitivity_level,
      parent_scope: input.parent_scope,
      created: new Date().toISOString()
    };

    await this.permissionManager.saveCustomScope(input.scope_name, customScope);

    return {
      content: [
        {
          type: 'text',
          text: `Successfully created custom scope '${input.scope_name}' with sensitivity level ${input.sensitivity_level}.`
        }
      ]
    };
  }

  private async handleListScopes(args: unknown) {
    const input = ListScopesInputSchema.parse(args);
    
    let result = '# Available Scopes\n\n';

    if (!input.include_custom_only) {
      result += '## Built-in Scopes\n\n';
      result += '| Scope | Description | Sensitivity | Example Data |\n';
      result += '|-------|-------------|-------------|---------------|\n';
      
      const builtInScopes = [
        { name: 'public', description: 'Publicly shareable information', sensitivity_level: 1, example_data: 'Name, avatar, bio' },
        { name: 'contact', description: 'Contact information', sensitivity_level: 3, example_data: 'Email, phone, social media' },
        { name: 'location', description: 'Location-based data', sensitivity_level: 5, example_data: 'Address, current location, places' },
        { name: 'personal', description: 'Personal details', sensitivity_level: 6, example_data: 'Age, hobbies, preferences' },
        { name: 'memories', description: 'Personal memories and experiences', sensitivity_level: 7, example_data: 'Trips, events, relationships' },
        { name: 'sensitive', description: 'Sensitive information', sensitivity_level: 9, example_data: 'Health data, financial info' }
      ];

      for (const scope of builtInScopes) {
        result += `| **${scope.name}** | ${scope.description} | ${scope.sensitivity_level} | ${scope.example_data} |\n`;
      }
      result += '\n';
    }

    const customScopes = this.permissionManager.getCustomScopes();
    if (Object.keys(customScopes).length > 0) {
      result += '## Custom Scopes\n\n';
      
      if (input.show_hierarchy) {
        const hierarchy = this.permissionManager.getScopeHierarchy();
        for (const [name, scope] of Object.entries(customScopes)) {
          result += `- **${name}** (sensitivity: ${scope.sensitivity_level})\n`;
          result += `  - ${scope.description}\n`;
          if (scope.parent_scope) {
            result += `  - Parent: ${scope.parent_scope}\n`;
          }
          const scopeHierarchy = hierarchy[name];
          if (scopeHierarchy && scopeHierarchy.children.length > 0) {
            result += `  - Children: ${scopeHierarchy.children.join(', ')}\n`;
          }
          result += `  - Created: ${scope.created}\n\n`;
        }
      } else {
        result += '| Scope | Description | Sensitivity | Parent | Created |\n';
        result += '|-------|-------------|-------------|--------|----------|\n';
        
        for (const [name, scope] of Object.entries(customScopes)) {
          result += `| **${name}** | ${scope.description} | ${scope.sensitivity_level} | ${scope.parent_scope || 'none'} | ${scope.created} |\n`;
        }
      }
    } else if (input.include_custom_only) {
      result += 'No custom scopes have been created yet.\n';
    }

    // Show currently allowed scopes
    result += '\n## Currently Allowed Scopes\n\n';
    const allowedScopes = this.permissionManager.getAllowedScopes();
    result += allowedScopes.map(scope => `- ${scope}`).join('\n');

    return {
      content: [
        {
          type: 'text',
          text: result
        }
      ]
    };
  }

  private async handleBatchGetPersonalInfo(args: unknown) {
    const input = BatchGetPersonalInfoInputSchema.parse(args);

    if (!input.has_list_available_personal_info) {
      throw new Error('You must list once all the categories with the list_available_personal_info tool before using this tool');
    }

    const results: Array<{ category: string; subcategory?: string; found: boolean; content?: string; error?: string }> = [];

    for (const request of input.requests) {
      try {
        const files = await this.fileManager.findFilesByCategory(
          this.permissionManager.getAllowedScopes(),
          request.category,
          request.subcategory
        );

        if (files.length === 0) {
          const result: any = {
            category: request.category,
            found: false,
            error: `No ${request.category} information found in accessible scopes.`
          };
          if (request.subcategory) {
            result.subcategory = request.subcategory;
          }
          results.push(result);
        } else {
          let content = '';
          for (const file of files) {
            content += `### ${file.frontmatter.category}`;
            if (file.frontmatter.subcategory) {
              content += ` - ${file.frontmatter.subcategory}`;
            }
            content += `\n\n${file.content}\n\n`;
            content += `*Scope: ${file.frontmatter.scope}, Tags: ${file.frontmatter.tags.join(', ')}, Updated: ${file.frontmatter.updated}*\n\n---\n\n`;
          }
          
          const result: any = {
            category: request.category,
            found: true,
            content: content
          };
          if (request.subcategory) {
            result.subcategory = request.subcategory;
          }
          results.push(result);
        }
              } catch (error) {
          const result: any = {
            category: request.category,
            found: false,
            error: error instanceof Error ? error.message : String(error)
          };
          if (request.subcategory) {
            result.subcategory = request.subcategory;
          }
          results.push(result);
        }
    }

    // Build the response
    let result = '# Batch Personal Information Results\n\n';
    result += `Retrieved ${results.length} request(s):\n\n`;

    for (const res of results) {
      result += `## ${res.category.charAt(0).toUpperCase() + res.category.slice(1)}`;
      if (res.subcategory) {
        result += ` (${res.subcategory})`;
      }
      result += '\n\n';

      if (res.found && res.content) {
        result += res.content;
      } else {
        result += `❌ ${res.error || 'No information found'}\n\n`;
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: result
        }
      ]
    };
  }

  private async handleBatchSavePersonalInfo(args: unknown) {
    const input = BatchSavePersonalInfoInputSchema.parse(args);

    // Get decryption/encryption options if OTP is active
    const encryptionOptions = this.getDecryptionOptions();

    const results: Array<{ category: string; subcategory?: string; success: boolean; action: 'created' | 'updated'; error?: string }> = [];

    for (const item of input.items) {
      try {
        // Check if we have permission to write to this scope
        if (!this.permissionManager.isAccessAllowed(item.scope)) {
          const result: any = {
            category: item.category,
            success: false,
            action: 'created',
            error: `Access denied: scope '${item.scope}' is not allowed`
          };
          if (item.subcategory) {
            result.subcategory = item.subcategory;
          }
          results.push(result);
          continue;
        }

        // Validate the scope exists
        if (!this.permissionManager.isValidScope(item.scope)) {
          const result: any = {
            category: item.category,
            success: false,
            action: 'created',
            error: `Invalid scope: '${item.scope}'`
          };
          if (item.subcategory) {
            result.subcategory = item.subcategory;
          }
          results.push(result);
          continue;
        }

        const filePath = this.fileManager.getFilePath(item.scope, item.category, item.subcategory);
        const now = new Date().toISOString();

        // Check if file exists to determine if this is an update
        const isUpdate = await this.fileManager.fileExists(filePath);

        // Create backup if updating existing file
        if (isUpdate && this.config.PERSONAL_INFO_BACKUP_ENABLED) {
          await this.fileManager.createBackup(filePath, this.config.PERSONAL_INFO_BACKUP_DIR);
        }

        const existingFile = isUpdate ? await this.fileManager.readMarkdownFile(filePath) : null;

        const fileData = {
          frontmatter: {
            scope: item.scope,
            category: item.category,
            subcategory: item.subcategory,
            created: existingFile?.frontmatter.created || now,
            updated: now,
            tags: item.tags || existingFile?.frontmatter.tags || []
          },
          content: item.content,
          filePath: ''
        };

        await this.fileManager.writeMarkdownFile(filePath, fileData, encryptionOptions);

        const successResult: any = {
          category: item.category,
          success: true,
          action: isUpdate ? 'updated' : 'created'
        };
        if (item.subcategory) {
          successResult.subcategory = item.subcategory;
        }
        results.push(successResult);

      } catch (error) {
        const errorResult: any = {
          category: item.category,
          success: false,
          action: 'created',
          error: error instanceof Error ? error.message : String(error)
        };
        if (item.subcategory) {
          errorResult.subcategory = item.subcategory;
        }
        results.push(errorResult);
      }
    }

    // Build the response
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);
    
    let result = '# Batch Save Results\n\n';
    result += `Processed ${results.length} item(s): ${successfulResults.length} successful, ${failedResults.length} failed\n\n`;

    if (successfulResults.length > 0) {
      result += '## ✅ Successfully Saved\n\n';
      for (const res of successfulResults) {
        result += `- **${res.category}`;
        if (res.subcategory) {
          result += ` (${res.subcategory})`;
        }
        result += `** - ${res.action}\n`;
      }
      result += '\n';
    }

    if (failedResults.length > 0) {
      result += '## ❌ Failed to Save\n\n';
      for (const res of failedResults) {
        result += `- **${res.category}`;
        if (res.subcategory) {
          result += ` (${res.subcategory})`;
        }
        result += `** - ${res.error}\n`;
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: result
        }
      ]
    };
  }

  // Helper method to get decryption options from current OTP session
  private getDecryptionOptions(): any {
    // If encryption is enabled, enforce OTP requirements
    if (this.encryptionManager.isEnabled()) {
      // If OTP is not enabled but encryption is, require OTP setup first
      if (!this.otpManager.isEnabled()) {
        throw new Error('🔒 Encryption is enabled but OTP is not set up. Please use setup_otp tool first to secure your data.');
      }

      // If no active OTP session, require verification
      if (!this.currentOTPSession || Date.now() > this.currentOTPSession.expires) {
        throw new Error('🔒 OTP verification required. Please use verify_otp tool first to access encrypted data.');
      }

      console.error('🔓 Using OTP session for decryption:', {
        hasToken: !!this.currentOTPSession.token,
        expires: new Date(this.currentOTPSession.expires).toISOString(),
        userId: this.currentOTPSession.userId
      });

      return {
        secret: this.config.PERSONAL_INFO_ENCRYPTION_KEY || 'default-secret',
        otpToken: this.currentOTPSession.token,
        userId: this.currentOTPSession.userId
      };
    }

    // If encryption is not enabled, return null (no encryption needed)
    return null;
  }

  private async handleSetupOTP(args: unknown) {
    try {
      const input = SetupOTPInputSchema.parse(args);
      
      // Set up OTP with the provided options
      const setupOptions: any = {};
      if (input.issuer !== undefined) setupOptions.issuer = input.issuer;
      if (input.label !== undefined) setupOptions.label = input.label;
      if (input.digits !== undefined) setupOptions.digits = input.digits;
      if (input.period !== undefined) setupOptions.period = input.period;
      
      const result = await this.otpManager.setupOTP(setupOptions);

      // If encryption is enabled, also enable it in the file manager
      if (this.encryptionManager.isEnabled()) {
        this.fileManager.enableEncryption();
      }

      let response = '# OTP Setup Complete! 🔐\n\n';
      response += 'Your One-Time Password authentication has been successfully configured.\n\n';
      response += '## 📱 Set up your Authenticator App\n\n';
      response += 'Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password, etc.)\n\n';
      response += `### QR Code Image\n\n`;
      response += `![OTP QR Code](${result.qrCodeDataURL})\n\n`;
      response += `**📁 QR Code Files Saved:**\n`;
      response += `- PNG Image: \`data/.security/qr-codes/otp-qrcode.png\`\n`;
      response += `- SVG Image: \`data/.security/qr-codes/otp-qrcode.svg\`\n`;
      response += `- URI Text: \`data/.security/qr-codes/otp-uri.txt\`\n\n`;
      response += `### Manual Entry (if QR code doesn't work)\n\n`;
      response += `**Secret Key:** \`${result.secret}\`\n`;
      response += `**URI:** \`${result.qrCodeUri}\`\n\n`;
      response += '## 🆘 Emergency Backup Codes\n\n';
      response += '**⚠️ IMPORTANT:** Save these backup codes in a secure location. Each can only be used once.\n\n';
      
      result.backupCodes.forEach((code, index) => {
        response += `${index + 1}. \`${code}\`\n`;
      });
      
      response += '\n## 🔑 Next Steps\n\n';
      response += '1. Scan the QR code with your authenticator app\n';
      response += '2. Use the `verify_otp` tool with a token from your app to test\n';
      response += '3. Once verified, your personal data will be encrypted with OTP-enhanced security\n';
      response += '4. You\'ll need to verify an OTP token before accessing encrypted information\n\n';
      response += '## ⚙️ Configuration\n\n';
      response += `- **Digits:** ${input.digits || 6}\n`;
      response += `- **Period:** ${input.period || 30} seconds\n`;
      response += `- **Issuer:** ${input.issuer || 'Personal MCP Server'}\n`;

      return {
        content: [
          {
            type: 'text',
            text: response
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Failed to set up OTP: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }

  private async handleVerifyOTP(args: unknown) {
    try {
      const input = VerifyOTPInputSchema.parse(args);
      
      if (!this.otpManager.isEnabled()) {
        return {
          content: [
            {
              type: 'text',
              text: '❌ OTP is not enabled. Use the `setup_otp` tool first.'
            }
          ]
        };
      }

      const result = await this.otpManager.verifyToken(input.token, input.useBackupCode);
      
      if (result.isValid) {
        // Create a session that lasts for the token period + some buffer
        const sessionDuration = 5 * 60 * 1000; // 5 minutes
        const session: any = {
          token: input.token,
          expires: Date.now() + sessionDuration
        };
        if (input.userId !== undefined) {
          session.userId = input.userId;
        }
        this.currentOTPSession = session;

        let response = '✅ OTP Token Verified Successfully! 🔓\n\n';
        response += 'You now have access to encrypted personal data.\n\n';
        
        if (result.timeRemaining) {
          response += `⏰ **Token expires in:** ${Math.floor(result.timeRemaining / 1000)} seconds\n`;
        }
        
        response += `🔑 **Session valid for:** ${Math.floor(sessionDuration / 1000 / 60)} minutes\n\n`;
        
        if (input.useBackupCode) {
          response += '⚠️ **Backup code used:** This code cannot be used again.\n\n';
        }
        
        response += 'You can now access your encrypted personal information using the regular tools.';

        return {
          content: [
            {
              type: 'text',
              text: response
            }
          ]
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Invalid OTP token. Please check your authenticator app and try again.`
            }
          ]
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Failed to verify OTP: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }

  private async handleOTPStatus(args: unknown) {
    try {
      OTPStatusInputSchema.parse(args);
      
      const isEnabled = this.otpManager.isEnabled();
      const config = this.otpManager.getConfig();
      const isSessionActive = this.currentOTPSession && Date.now() < this.currentOTPSession.expires;
      
      let response = '# OTP Status 🔐\n\n';
      
      if (isEnabled) {
        response += '✅ **OTP is ENABLED**\n\n';
        response += '## Configuration\n\n';
        if (config) {
          response += `- **Digits:** ${config.digits}\n`;
          response += `- **Period:** ${config.period} seconds\n`;
          response += `- **Issuer:** ${config.issuer}\n`;
          response += `- **Label:** ${config.label}\n`;
        }
        
        response += '\n## Session Status\n\n';
        if (isSessionActive) {
          const remaining = Math.floor((this.currentOTPSession!.expires - Date.now()) / 1000 / 60);
          response += `🔓 **Active session:** ${remaining} minutes remaining\n`;
          response += 'You can access encrypted data without re-verification.\n';
        } else {
          response += '🔒 **No active session:** Use `verify_otp` to access encrypted data.\n';
        }
        
        response += '\n## Encryption Status\n\n';
        if (this.encryptionManager.isEnabled()) {
          response += '🔐 **Encryption is ENABLED** - Personal data is encrypted\n';
        } else {
          response += '🔓 **Encryption is DISABLED** - Personal data is stored in plain text\n';
        }
        
      } else {
        response += '❌ **OTP is DISABLED**\n\n';
        response += 'Your personal data is not protected by OTP authentication.\n';
        response += 'Use the `setup_otp` tool to enable OTP protection.\n';
      }

      return {
        content: [
          {
            type: 'text',
            text: response
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Failed to get OTP status: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }

  private async handleDisableOTP(args: unknown) {
    try {
      OTPStatusInputSchema.parse(args);
      
      await this.otpManager.disableOTP();
      this.encryptionManager.disableEncryption();
      this.fileManager.disableEncryption();
      this.currentOTPSession = null;

      const response = '✅ OTP Disabled Successfully 🔓\n\n' +
        'OTP authentication and encryption have been disabled.\n' +
        'Your personal data is now stored without encryption.\n\n' +
        '⚠️ **Security Notice:** Your data is no longer protected by OTP authentication.';

      return {
        content: [
          {
            type: 'text',
            text: response
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Failed to disable OTP: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }

  private async handleRegenerateBackupCodes(args: unknown) {
    try {
      RegenerateBackupCodesInputSchema.parse(args);
      
      if (!this.otpManager.isEnabled()) {
        return {
          content: [
            {
              type: 'text',
              text: '❌ OTP is not enabled. Use the `setup_otp` tool first.'
            }
          ]
        };
      }

      const backupCodes = await this.otpManager.regenerateBackupCodes();
      
      let response = '✅ New Backup Codes Generated! 🆘\n\n';
      response += '**⚠️ IMPORTANT:** Your old backup codes are now invalid. Save these new codes in a secure location.\n\n';
      response += '## 🔑 Emergency Backup Codes\n\n';
      
      backupCodes.forEach((code, index) => {
        response += `${index + 1}. \`${code}\`\n`;
      });
      
      response += '\n**Note:** Each backup code can only be used once for emergency access.';

      return {
        content: [
          {
            type: 'text',
            text: response
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Failed to regenerate backup codes: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }

  private async handleOTPDebug(args: unknown) {
    try {
      OTPDebugInputSchema.parse(args);
      
      const debugInfo = await this.otpManager.getDebugInfo();
      
      let response = '# OTP Debug Information 🔍\n\n';
      
      if (!debugInfo.isEnabled) {
        response += '❌ **OTP is not enabled**\n\n';
        response += 'Use the `setup_otp` tool to enable OTP first.\n';
        return {
          content: [
            {
              type: 'text',
              text: response
            }
          ]
        };
      }

      response += '✅ **OTP is enabled**\n\n';
      response += '## Current Status\n\n';
      response += `**Current Timestamp:** ${debugInfo.timestamp}\n`;
      
      if (debugInfo.currentToken) {
        response += `**Current Expected Token:** \`${debugInfo.currentToken}\`\n`;
        response += `**Next Token:** \`${debugInfo.nextToken}\`\n`;
        response += `**Time Remaining:** ${Math.floor(debugInfo.timeRemaining! / 1000)} seconds\n\n`;
      }

      if (debugInfo.config) {
        response += '## Configuration\n\n';
        response += `**Digits:** ${debugInfo.config.digits}\n`;
        response += `**Period:** ${debugInfo.config.period} seconds\n`;
        response += `**Algorithm:** ${debugInfo.config.algorithm}\n`;
        response += `**Window:** ${debugInfo.config.window}\n`;
        response += `**Issuer:** ${debugInfo.config.issuer}\n`;
        response += `**Label:** ${debugInfo.config.label}\n`;
        response += `**Secret Preview:** ${debugInfo.secretPreview}\n\n`;
      }

      response += '## Troubleshooting\n\n';
      response += '1. **Check your authenticator app** - Make sure it shows the same issuer/label\n';
      response += '2. **Verify the current token** - Try the current expected token above\n';
      response += '3. **Check clock synchronization** - Ensure your device and server clocks are synchronized\n';
      response += '4. **Try waiting** - Wait for the next token period and try again\n';
      response += '5. **Use backup codes** - If all else fails, use a backup code\n\n';
      
      response += '## Clock Synchronization\n\n';
      response += `**Server Time:** ${new Date().toISOString()}\n`;
      response += `**Server Timezone:** ${Intl.DateTimeFormat().resolvedOptions().timeZone}\n`;
      response += '**Your Device Time:** Check that your device shows the same time\n\n';
      
      response += '💡 **Tip:** If the current expected token doesn\'t work, there might be a clock synchronization issue.';

      return {
        content: [
          {
            type: 'text',
            text: response
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Failed to get OTP debug info: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }

  async initialize(): Promise<void> {
    try {
      console.error('🔧 Initializing Personal Information MCP Server...');
      
      // Parse command line arguments for scope configuration
      const scopeConfig = resolveScopeConfig(process.argv, {});
      console.error(`📋 Allowed scopes: ${scopeConfig.allowedScopes.join(', ')}`);

      // Initialize managers
      this.permissionManager = new PermissionManager(scopeConfig, this.config.PERSONAL_INFO_DATA_DIR);
      this.encryptionManager = new EncryptionManager({
        enabled: this.config.PERSONAL_INFO_ENCRYPTION_ENABLED
      });
      this.fileManager = new FileManager(this.config.PERSONAL_INFO_DATA_DIR, this.config.PERSONAL_INFO_MAX_FILE_SIZE, this.encryptionManager);
      this.otpManager = new OTPManager(this.config.PERSONAL_INFO_DATA_DIR);

      await this.permissionManager.initialize();
      await this.fileManager.initialize();
      await this.otpManager.initialize();

      // Re-resolve scope config now that custom scopes are loaded
      const finalScopeConfig = resolveScopeConfig(process.argv, this.permissionManager.getCustomScopes());
      
      // Update permission manager with final config
      this.permissionManager = new PermissionManager(finalScopeConfig, this.config.PERSONAL_INFO_DATA_DIR);
      await this.permissionManager.initialize();

      console.error(`✅ Server initialized successfully!`);
      console.error(`📁 Data directory: ${this.config.PERSONAL_INFO_DATA_DIR}`);
      console.error(`🔒 Final allowed scopes: ${this.permissionManager.getAllowedScopes().join(', ')}`);
      
    } catch (error) {
      console.error('❌ Failed to initialize server:', error);
      process.exit(1);
    }
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('🚀 Personal Information MCP Server is running');
  }
}

// Start the server
async function main(): Promise<void> {
  const server = new PersonalInfoMCPServer();
  await server.initialize();
  await server.start();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.error('\n⏹️  Shutting down Personal Information MCP Server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('\n⏹️  Shutting down Personal Information MCP Server...');
  process.exit(0);
});

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}); 