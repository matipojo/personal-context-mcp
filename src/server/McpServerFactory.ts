import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { OTPManager } from '../managers/OTPManager.js';
import { FileManager } from '../managers/FileManager.js';
import { EncryptionManager } from '../managers/EncryptionManager.js';
import { 
  EnvironmentConfigSchema,
} from '../types/schemas.js';
import { ServerContext, type OTPSession } from '../core/Context.js';
import { registerTools } from './ToolRegistry.js';
import path from 'path';
import os from 'os';
import { validateOTPSession } from '../core/Validation.js';

// Session manager interface
export interface SessionManager {
  updateOTPSession: (session: OTPSession | null) => void;
  getCurrentContext: (options: { shouldValidateOTPSession?: boolean }) => ServerContext;
}

// Configuration parsing
interface ServerConfig {
  dataDir: string;
  maxFileSize: number;
  backupEnabled: boolean;
  backupDir: string;
  encryptionEnabled: boolean;
  encryptionKey: string;
}

export const parseConfiguration = 
  (argv: string[]): ServerConfig => {
  // Parse data directory from command line or environment
  const dataDirFromArgs = parseDataDirectory(argv);
  const rawDataDir = dataDirFromArgs || process.env.PERSONAL_INFO_DATA_DIR || path.join(os.homedir(), '.personal-context-data');
  
  // Resolve relative paths to absolute paths based on current working directory
  const dataDir = path.isAbsolute(rawDataDir) 
    ? rawDataDir 
    : path.resolve(process.cwd(), rawDataDir);
  
  // Resolve backup directory path as well
  const rawBackupDir = process.env.PERSONAL_INFO_BACKUP_DIR || path.join(os.homedir(), '.personal-context-data', 'backups');
  const backupDir = path.isAbsolute(rawBackupDir) 
    ? rawBackupDir 
    : path.resolve(process.cwd(), rawBackupDir);

  return {
    dataDir,
    maxFileSize: parseInt(process.env.PERSONAL_INFO_MAX_FILE_SIZE || '1048576'),
    backupEnabled: process.env.PERSONAL_INFO_BACKUP_ENABLED !== 'false',
    backupDir,
    encryptionEnabled: process.env.PERSONAL_INFO_ENCRYPTION_ENABLED === 'true',
    encryptionKey: process.env.PERSONAL_INFO_ENCRYPTION_KEY || ''
  };
};

// Helper function to parse data directory from command line arguments
function parseDataDirectory(args: string[]): string | undefined {
  // Look for --data-dir=value format first
  let dataDirArgIndex = args.findIndex(arg => arg.startsWith('--data-dir='));
  
  if (dataDirArgIndex !== -1) {
    // Handle --data-dir=value format
    const dataDirArg = args[dataDirArgIndex];
    if (!dataDirArg) {
      return undefined;
    }
    return dataDirArg.split('=')[1];
  } else {
    // Look for --data-dir value format (space-separated)
    dataDirArgIndex = args.findIndex(arg => arg === '--data-dir');
    if (dataDirArgIndex !== -1 && dataDirArgIndex < args.length - 1) {
      return args[dataDirArgIndex + 1];
    }
  }
  
  return undefined;
}

// Initialize managers
const initializeManagers = async (config: ServerConfig): Promise<Omit<ServerContext, 'currentOTPSession'>> => {
  // Log path resolution for debugging
  console.error(`📁 Data directory: ${config.dataDir}`);
  console.error(`💾 Backup directory: ${config.backupDir}`);

  // Initialize managers
  const encryptionManager = new EncryptionManager({
    enabled: config.encryptionEnabled
  });
  const fileManager = new FileManager(config.dataDir, config.maxFileSize, encryptionManager);
  const otpManager = new OTPManager(config.dataDir);

  await fileManager.initialize();
  await otpManager.initialize();

  // Parse environment configuration
  const envConfig = EnvironmentConfigSchema.parse({
    PERSONAL_INFO_DATA_DIR: config.dataDir,
    PERSONAL_INFO_MAX_FILE_SIZE: config.maxFileSize,
    PERSONAL_INFO_BACKUP_ENABLED: config.backupEnabled,
    PERSONAL_INFO_BACKUP_DIR: config.backupDir,
    PERSONAL_INFO_ENCRYPTION_ENABLED: config.encryptionEnabled,
    PERSONAL_INFO_ENCRYPTION_KEY: config.encryptionKey
  });

  console.error(`✅ Managers initialized successfully!`);

  return {
    config: envConfig,
    fileManager,
    otpManager,
    encryptionManager
  };
};

// Create server instance
export const createServerInstance = async (argv: string[]): Promise<{ 
  server: McpServer; 
  updateOTPSession: (session: OTPSession | null) => void;
}> => {
  const config = parseConfiguration(argv);
  const managerContext = await initializeManagers(config);
  
  // Create server
  const server = new McpServer({
    name: 'personal-mcp',
    version: '1.0.0'
  }, {
    capabilities: {
      tools: {}
    }
  });

  // Session state management
  let currentOTPSession: OTPSession | null = null;
  
  const getCurrentContext = (config: { shouldValidateOTPSession?: boolean } = { shouldValidateOTPSession: true }): ServerContext => {
    const context = {
      ...managerContext,
      currentOTPSession
    };
    if (config.shouldValidateOTPSession) {
      validateOTPSession(context);
    }
    return context;
  };

  const updateOTPSession = (session: OTPSession | null): void => {
    currentOTPSession = session;
  };

  const sessionManager: SessionManager = {
    getCurrentContext,
    updateOTPSession
  };

  // Register tools
  registerTools(server, sessionManager);

  return { server, updateOTPSession };
}; 