import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import path from 'path';
import { ServerContext, OTPSession } from '../core/Context.js';
import { PermissionManager } from '../managers/PermissionManager.js';
import { FileManager } from '../managers/FileManager.js';
import { OTPManager } from '../managers/OTPManager.js';
import { EncryptionManager } from '../managers/EncryptionManager.js';
import { EnvironmentConfigSchema } from '../types/schemas.js';
import { resolveScopeConfig, parseDataDirectory } from '../utils/scopeParser.js';
import { registerTools, SessionManager } from './ToolRegistry.js';

// Configuration type
export interface ServerConfig {
  dataDir: string;
  backupDir: string;
  encryptionEnabled: boolean;
  encryptionKey: string | undefined;
  backupEnabled: boolean;
  maxFileSize: number | undefined;
  defaultScope: string | undefined;
}

// Server instance with context and session management
export interface ServerInstance {
  server: McpServer;
  context: ServerContext;
  start: () => Promise<void>;
  updateOTPSession: (session: OTPSession | null) => void;
  getCurrentContext: () => ServerContext;
}

// Parse configuration from environment and command line
export const parseConfiguration = (argv: string[]): ServerConfig => {
  // Parse data directory from command line arguments, fall back to environment variable
  const cmdDataDir = parseDataDirectory(argv);
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

  return {
    dataDir: resolvedDataDir,
    backupDir: resolvedBackupDir,
    encryptionEnabled: process.env.PERSONAL_INFO_ENCRYPTION_ENABLED === 'true',
    encryptionKey: process.env.PERSONAL_INFO_ENCRYPTION_KEY,
    backupEnabled: process.env.PERSONAL_INFO_BACKUP_ENABLED === 'true',
    maxFileSize: process.env.PERSONAL_INFO_MAX_FILE_SIZE ? 
      parseInt(process.env.PERSONAL_INFO_MAX_FILE_SIZE) : undefined,
    defaultScope: process.env.PERSONAL_INFO_DEFAULT_SCOPE
  };
};

// Initialize managers
const initializeManagers = async (config: ServerConfig, argv: string[]): Promise<Omit<ServerContext, 'currentOTPSession'>> => {
  // Parse scope configuration
  const scopeConfig = resolveScopeConfig(argv, {});
  console.error(`📋 Allowed scopes: ${scopeConfig.allowedScopes.join(', ')}`);

  // Initialize managers
  const permissionManager = new PermissionManager(scopeConfig, config.dataDir);
  const encryptionManager = new EncryptionManager({
    enabled: config.encryptionEnabled
  });
  const fileManager = new FileManager(config.dataDir, config.maxFileSize, encryptionManager);
  const otpManager = new OTPManager(config.dataDir);

  await permissionManager.initialize();
  await fileManager.initialize();
  await otpManager.initialize();

  // Re-resolve scope config now that custom scopes are loaded
  const finalScopeConfig = resolveScopeConfig(argv, permissionManager.getCustomScopes());
  
  // Update permission manager with final config
  const finalPermissionManager = new PermissionManager(finalScopeConfig, config.dataDir);
  await finalPermissionManager.initialize();

  // Parse environment configuration
  const envConfig = EnvironmentConfigSchema.parse({
    PERSONAL_INFO_DATA_DIR: config.dataDir,
    PERSONAL_INFO_DEFAULT_SCOPE: config.defaultScope,
    PERSONAL_INFO_MAX_FILE_SIZE: config.maxFileSize,
    PERSONAL_INFO_BACKUP_ENABLED: config.backupEnabled,
    PERSONAL_INFO_BACKUP_DIR: config.backupDir,
    PERSONAL_INFO_ENCRYPTION_ENABLED: config.encryptionEnabled,
    PERSONAL_INFO_ENCRYPTION_KEY: config.encryptionKey
  });

  console.error(`✅ Managers initialized successfully!`);
  console.error(`📁 Data directory: ${config.dataDir}`);
  console.error(`🔒 Final allowed scopes: ${finalPermissionManager.getAllowedScopes().join(', ')}`);

  return {
    config: envConfig,
    permissionManager: finalPermissionManager,
    fileManager,
    otpManager,
    encryptionManager
  };
};

// Create server instance
export const createServerInstance = async (argv: string[]): Promise<ServerInstance> => {
  console.error('🔧 Initializing Personal Information MCP Server...');
  
  const config = parseConfiguration(argv);
  const managers = await initializeManagers(config, argv);
  
  const server = new McpServer({
    name: 'personal-info-mcp-server',
    version: '1.0.0',
  });

  // Create mutable context for session management
  let currentContext: ServerContext = {
    ...managers,
    currentOTPSession: null
  };

  // Create session manager implementation
  const sessionManager: SessionManager = {
    updateOTPSession: (session: OTPSession | null) => {
      console.error(`🔄 Updating OTP session: ${session ? 'active' : 'cleared'}`);
      currentContext = {
        ...currentContext,
        currentOTPSession: session
      };
    },
    getCurrentContext: () => currentContext
  };

  // Register tools with session manager
  registerTools(server, sessionManager);

  // Create server instance with session management
  const serverInstance: ServerInstance = {
    server,
    context: currentContext,
    start: async () => {
      const transport = new StdioServerTransport();
      await server.connect(transport);
      console.error('🚀 Personal Information MCP Server is running');
    },
    updateOTPSession: sessionManager.updateOTPSession,
    getCurrentContext: sessionManager.getCurrentContext
  };

  return serverInstance;
}; 