import { ServerContext, ToolHandler, ToolResult, OTPSession } from '../../core/Context.js';
import { safeParse } from '../../core/Validation.js';
import { createTextResponse, createOTPNotEnabledResponse } from '../../core/Response.js';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Input schema for this tool
export const VerifyOTPInputSchema = z.object({
  token: z.string().describe("OTP token from authenticator app or backup code"),
  useBackupCode: z.boolean().default(false).describe("Set to true if using a backup code"),
  userId: z.string().optional()
});

type VerifyOTPInput = z.infer<typeof VerifyOTPInputSchema>;

export const verifyOTP: ToolHandler = async (args: unknown, context: ServerContext): Promise<ToolResult & { isVerified?: boolean }> => {
  const input = safeParse<VerifyOTPInput>(VerifyOTPInputSchema, args, 'verify_otp');
  
  if (!context.otpManager.isEnabled()) {
    return createOTPNotEnabledResponse();
  }

  const result = await context.otpManager.verifyToken(input.token, input.useBackupCode);
  
  if (result.isValid) {
    // Create a session that lasts for the token period + some buffer
    const sessionDuration = 5 * 60 * 1000; // 5 minutes
    const session: OTPSession = {
      token: input.token,
      expires: Date.now() + sessionDuration,
      ...(input.userId && { userId: input.userId })
    };

    // Note: In functional approach, we don't mutate context directly.
    // The caller should handle the session update.
    // For now, we'll include session info in response.

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
      ...createTextResponse(response),
      isVerified: true
    };
  } else {
    return {
      ...createTextResponse(`❌ Invalid OTP token. Please check your authenticator app and try again.`),
      isVerified: false
    };
  }
}; 

// Direct registration - all metadata inline with OTP session handling
export const registerVerifyOTPTool = (server: McpServer, sessionManager: any): void => {
  server.registerTool('verify_otp', {
    title: "Verify OTP",
    description: "Verify an OTP token to access encrypted personal data. Required before reading encrypted information.",
    inputSchema: VerifyOTPInputSchema.shape
  }, async (args: { [x: string]: any }, extra: any) => {
    try {
      const currentContext = sessionManager.getCurrentContext({
        shouldValidateOTPSession: false
      });
      const result = await verifyOTP(args, currentContext);

      // Special handling for successful OTP verification
      if (result.isVerified) {
        const sessionDuration = 5 * 60 * 1000; // 5 minutes
        const newSession = {
          token: args.token,
          expires: Date.now() + sessionDuration,
          ...(args.userId && { userId: args.userId })
        };
        sessionManager.updateOTPSession(newSession);
        console.error('🔓 OTP session created successfully');
      }

      return result;
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `❌ Error in verify_otp: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  });
}; 