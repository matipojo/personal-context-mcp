import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ServerContext, OTPSession } from '../core/Context.js';

// Import all tool registration functions
import { registerUpdatePersonalInfoTool } from '../tools/personalInfo/updatePersonalInfo.js';
import { registerListAvailableInfoTool } from '../tools/personalInfo/listAvailableInfo.js';
import { registerDeletePersonalInfoTool } from '../tools/personalInfo/deletePersonalInfo.js';
import { registerBatchGetPersonalInfoTool } from '../tools/personalInfo/batchGetPersonalInfo.js';
import { registerBatchSavePersonalInfoTool } from '../tools/personalInfo/batchSavePersonalInfo.js';
import { registerSearchMemoriesTool } from '../tools/memories/searchMemories.js';
import { registerSetupOTPTool } from '../tools/otp/setupOTP.js';
import { registerVerifyOTPTool } from '../tools/otp/verifyOTP.js';
import { registerOtpStatusTool } from '../tools/otp/otpStatus.js';
import { registerDisableOTPTool } from '../tools/otp/disableOTP.js';
import { registerLockOTPTool } from '../tools/otp/lockOTP.js';

// Session manager interface
export interface SessionManager {
  updateOTPSession: (session: OTPSession | null) => void;
  getCurrentContext: () => ServerContext;
}

// Register all tools with the MCP server
export const registerTools = (server: McpServer, sessionManager: SessionManager): void => {
  // Register all personal info tools
  registerUpdatePersonalInfoTool(server, sessionManager);
  registerListAvailableInfoTool(server, sessionManager);
  registerDeletePersonalInfoTool(server, sessionManager);
  registerBatchGetPersonalInfoTool(server, sessionManager);
  registerBatchSavePersonalInfoTool(server, sessionManager);

  // Register memory tools
  registerSearchMemoriesTool(server, sessionManager);

  // Register OTP tools
  registerSetupOTPTool(server, sessionManager);
  registerVerifyOTPTool(server, sessionManager);
  registerOtpStatusTool(server, sessionManager);
  registerDisableOTPTool(server, sessionManager);
  registerLockOTPTool(server, sessionManager);

  console.error(`✅ Tools registered successfully!`);
}; 