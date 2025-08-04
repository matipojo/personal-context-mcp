import { ServerContext, ToolHandler, ToolResult } from '../../core/Context.js';
import { safeParse } from '../../core/Validation.js';
import { createTextResponse } from '../../core/Response.js';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Input schema for this tool
export const OTPStatusInputSchema = z.object({});

type OTPStatusInput = z.infer<typeof OTPStatusInputSchema>;

export const otpStatus: ToolHandler = async (args: unknown, context: ServerContext): Promise<ToolResult> => {
  const input = safeParse<OTPStatusInput>(OTPStatusInputSchema, args, 'otp_status');
  
  try {
    const isEnabled = context.otpManager.isEnabled();
    const config = context.otpManager.getConfig();
    const isSessionActive = context.currentOTPSession && Date.now() < context.currentOTPSession.expires;
    
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
        const remaining = Math.floor((context.currentOTPSession!.expires - Date.now()) / 1000 / 60);
        response += `🔓 **Active session:** ${remaining} minutes remaining\n`;
        response += 'You can access encrypted data without re-verification.\n';
      } else {
        response += '🔒 **No active session:** Use `verify_otp` to access encrypted data.\n';
      }
      
      response += '\n## Encryption Status\n\n';
      if (context.encryptionManager.isEnabled()) {
        response += '🔐 **Encryption is ENABLED** - Personal data is encrypted\n';
      } else {
        response += '🔓 **Encryption is DISABLED** - Personal data is stored in plain text\n';
      }
      
    } else {
      response += '❌ **OTP is DISABLED**\n\n';
      response += 'Your personal data is not protected by OTP authentication.\n';
      response += 'Please ask the user to use `setup_otp` tool to enable OTP protection.\n';
    }

    return createTextResponse(response);
  } catch (error) {
    return createTextResponse(`❌ Failed to get OTP status: ${error instanceof Error ? error.message : String(error)}`);
  }
}; 

// Direct registration - all metadata inline
export const registerOtpStatusTool = (server: McpServer, sessionManager: any): void => {
  server.registerTool('otp_status', {
    title: "OTP Status",
    description: "Check the current OTP configuration status and whether OTP verification is required. Don't continue to use any other tools until you get the status of the OTP.",
    inputSchema: OTPStatusInputSchema.shape
  }, async (args: { [x: string]: any }, extra: any) => {
    try {
      const currentContext = sessionManager.getCurrentContext({
        shouldValidateOTPSession: false
      });
      const result = await otpStatus(args, currentContext);
      return result;
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `❌ Error in otp_status: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  });
}; 