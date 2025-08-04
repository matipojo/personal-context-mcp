import { OTPStatusInputSchema } from './otpStatus.js';
import { ServerContext, ToolHandler, ToolResult } from '../../core/Context.js';
import { safeParse } from '../../core/Validation.js';
import { createTextResponse } from '../../core/Response.js';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

type LockOTPInput = z.infer<typeof OTPStatusInputSchema>;

export const lockOTP: ToolHandler = async (args: unknown, context: ServerContext): Promise<ToolResult> => {
  const input = safeParse<LockOTPInput>(OTPStatusInputSchema, args, 'lock_otp');
  
  try {
    const isOTPEnabled = context.otpManager.isEnabled();
    const hadActiveSession = context.currentOTPSession && Date.now() < context.currentOTPSession.expires;
    
    if (!isOTPEnabled) {
      return createTextResponse('❌ OTP is not enabled. There is no session to lock.');
    }

    let response = '🔒 **OTP Session Locked** 🔒\n\n';
    
    if (hadActiveSession) {
      const remainingMinutes = Math.floor((context.currentOTPSession!.expires - Date.now()) / 1000 / 60);
      response += `Your active OTP session (${remainingMinutes} minutes remaining) has been terminated.\n\n`;
    } else {
      response += 'No active OTP session was found to lock.\n\n';
    }
    
    response += '🔐 **Access to encrypted data is now blocked.**\n\n';
    response += 'To access your personal information again, you will need to:\n';
    response += '1. Use the `verify_otp` tool with your authenticator app\n';
    response += '2. Enter a valid OTP token to create a new session\n\n';
    response += '⚠️ This action helps protect your data when you step away from your device.';

    return createTextResponse(response);
  } catch (error) {
    return createTextResponse(`❌ Failed to lock OTP session: ${error instanceof Error ? error.message : String(error)}`);
  }
}; 

// Direct registration - all metadata inline
export const registerLockOTPTool = (server: McpServer, sessionManager: any): void => {
  server.registerTool('lock_otp', {
    title: "Lock OTP Session",
    description: "Immediately lock the current OTP session and block access to encrypted personal data. Requires re-verification with verify_otp to access data again.",
    inputSchema: OTPStatusInputSchema.shape
  }, async (args: { [x: string]: any }, extra: any) => {
    try {
      const currentContext = sessionManager.getCurrentContext();
      const result = await lockOTP(args, currentContext);

      // Clear the OTP session after successful lock
      sessionManager.updateOTPSession(null);
      console.error('🔒 OTP session cleared - access locked');

      return result;
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `❌ Error in lock_otp: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  });
};