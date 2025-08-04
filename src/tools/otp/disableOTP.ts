import { OTPStatusInputSchema } from './otpStatus.js';
import { ServerContext, ToolHandler, ToolResult } from '../../core/Context.js';
import { safeParse } from '../../core/Validation.js';
import { createTextResponse, createOTPNotEnabledResponse } from '../../core/Response.js';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

type DisableOTPInput = z.infer<typeof OTPStatusInputSchema>;

export const disableOTP: ToolHandler = async (args: unknown, context: ServerContext): Promise<ToolResult> => {
  const input = safeParse<DisableOTPInput>(OTPStatusInputSchema, args, 'disable_otp');
  
  try {
    await context.otpManager.disableOTP();
    
    const response = '✅ OTP Disabled Successfully 🔓\n\n' +
      'OTP authentication and encryption have been disabled.\n' +
      'Your personal data is now stored without encryption.\n\n' +
      '⚠️ **Security Notice:** Your data is no longer protected by OTP authentication.';

    return createTextResponse(response);
  } catch (error) {
    return createTextResponse(`❌ Failed to disable OTP: ${error instanceof Error ? error.message : String(error)}`);
  }
}; 

// Direct registration - all metadata inline with OTP session clearing
export const registerDisableOTPTool = (server: McpServer, sessionManager: any): void => {
  server.registerTool('disable_otp', {
    title: "Disable OTP",
    description: "Disable OTP authentication and encryption for personal data.",
    inputSchema: OTPStatusInputSchema.shape
  }, async (args: { [x: string]: any }, extra: any) => {
    try {
      const currentContext = sessionManager.getCurrentContext();
      const result = await disableOTP(args, currentContext);

      // Clear OTP session when OTP is disabled
      sessionManager.updateOTPSession(null);
      console.error('🔒 OTP session cleared');

      return result;
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `❌ Error in disable_otp: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  });
}; 