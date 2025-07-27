import { ServerContext, ToolHandler, ToolResult } from '../../core/Context.js';
import { safeParse, validateOTPEnabled } from '../../core/Validation.js';
import { createTextResponse, createOTPNotEnabledResponse } from '../../core/Response.js';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Input schema for this tool
export const RegenerateBackupCodesInputSchema = z.object({});

type RegenerateBackupCodesInput = z.infer<typeof RegenerateBackupCodesInputSchema>;

export const regenerateBackupCodes: ToolHandler = async (args: unknown, context: ServerContext): Promise<ToolResult> => {
  const input = safeParse<RegenerateBackupCodesInput>(RegenerateBackupCodesInputSchema, args, 'regenerate_backup_codes');
  
  try {
    if (!context.otpManager.isEnabled()) {
      return createOTPNotEnabledResponse();
    }

    const backupCodes = await context.otpManager.regenerateBackupCodes();
    
    let response = '✅ New Backup Codes Generated! 🆘\n\n';
    response += '**⚠️ IMPORTANT:** Your old backup codes are now invalid. Save these new codes in a secure location.\n\n';
    response += '## 🔑 Emergency Backup Codes\n\n';
    
    backupCodes.forEach((code, index) => {
      response += `${index + 1}. \`${code}\`\n`;
    });
    
    response += '\n**Note:** Each backup code can only be used once for emergency access.';

    return createTextResponse(response);
  } catch (error) {
    return createTextResponse(`❌ Failed to regenerate backup codes: ${error instanceof Error ? error.message : String(error)}`);
  }
}; 

// Direct registration - all metadata inline
export const registerRegenerateBackupCodesTool = (server: McpServer, sessionManager: any): void => {
  server.registerTool('regenerate_backup_codes', {
    title: "Regenerate Backup Codes",
    description: "Generate new backup codes for emergency access. Previous backup codes will be invalidated.",
    inputSchema: RegenerateBackupCodesInputSchema.shape
  }, async (args: { [x: string]: any }, extra: any) => {
    try {
      const currentContext = sessionManager.getCurrentContext();
      const result = await regenerateBackupCodes(args, currentContext);
      return result;
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `❌ Error in regenerate_backup_codes: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  });
}; 