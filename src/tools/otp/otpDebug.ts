import { ServerContext, ToolHandler, ToolResult } from '../../core/Context.js';
import { safeParse } from '../../core/Validation.js';
import { createTextResponse } from '../../core/Response.js';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Input schema for this tool
export const OTPDebugInputSchema = z.object({});

type OTPDebugInput = z.infer<typeof OTPDebugInputSchema>;

export const otpDebug: ToolHandler = async (args: unknown, context: ServerContext): Promise<ToolResult> => {
  const input = safeParse<OTPDebugInput>(OTPDebugInputSchema, args, 'otp_debug');
  
  try {
    const debugInfo = await context.otpManager.getDebugInfo();
    
    let response = '# OTP Debug Information 🔍\n\n';
    
    if (!debugInfo.isEnabled) {
      response += '❌ **OTP is not enabled**\n\n';
      response += 'Use the `setup_otp` tool to enable OTP first.\n';
      return createTextResponse(response);
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

    return createTextResponse(response);
  } catch (error) {
    return createTextResponse(`❌ Failed to get OTP debug info: ${error instanceof Error ? error.message : String(error)}`);
  }
}; 

// Direct registration - all metadata inline
export const registerOtpDebugTool = (server: McpServer, sessionManager: any): void => {
  server.registerTool('otp_debug', {
    title: "OTP Debug",
    description: "Debug OTP issues by showing current expected tokens and configuration. Use this when OTP verification fails.",
    inputSchema: OTPDebugInputSchema.shape
  }, async (args: { [x: string]: any }, extra: any) => {
    try {
      const currentContext = sessionManager.getCurrentContext();
      const result = await otpDebug(args, currentContext);
      return result;
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `❌ Error in otp_debug: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  });
}; 