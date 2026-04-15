import { ServerContext, ToolHandler, ToolResult } from '../../core/Context.js';
import { OTP_SETUP_APP_RESOURCE_URI } from '../../core/mcpAppUris.js';
import { OTP_SETUP_APP_ID } from '../../core/otpAppPayload.js';
import { safeParse } from '../../core/Validation.js';
import { createOtpSetupMcpAppResponse, createTextResponse } from '../../core/Response.js';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import type { SessionManager } from '../../server/McpServerFactory.js';

// Input schema for this tool
export const SetupOTPInputSchema = z.object({
  issuer: z.string().optional().describe("Service name (defaults to 'Personal MCP Server')"),
  label: z.string().optional().describe("Account label (defaults to 'Personal Data Access')"),
  digits: z.number().min(4).max(8).optional().describe("Number of digits in OTP tokens (default: 6)"),
  period: z.number().min(15).max(300).optional().describe("Token validity period in seconds (default: 30)"),
});

type SetupOTPInput = z.infer<typeof SetupOTPInputSchema>;

export const setupOTP: ToolHandler = async (args: unknown, context: ServerContext): Promise<ToolResult> => {
  const input = safeParse<SetupOTPInput>(SetupOTPInputSchema, args, 'setup_otp');
  
  try {
    // Set up OTP with the provided options
    const setupOptions: any = {};
    if (input.issuer !== undefined) setupOptions.issuer = input.issuer;
    if (input.label !== undefined) setupOptions.label = input.label;
    if (input.digits !== undefined) setupOptions.digits = input.digits;
    if (input.period !== undefined) setupOptions.period = input.period;
    
    const result = await context.otpManager.setupOTP(setupOptions);

    // If encryption is enabled, also enable it in the file manager
    if (context.encryptionManager.isEnabled()) {
      context.fileManager.enableEncryption();
    }

    const base64Data = result.qrCodeDataURL.replace(/^data:image\/png;base64,/, '');
    const issuer = input.issuer ?? 'Personal MCP Server';
    const label = input.label ?? 'Personal Data Access';
    const digits = input.digits ?? 6;
    const period = input.period ?? 30;

    const summary =
      `OTP is configured (${issuer} / ${label}). The QR code, secret, and backup codes are shown in the MCP App panel. ` +
      'Scan the QR with an authenticator app, store the backup codes safely, then call verify_otp to test.';

    return createOtpSetupMcpAppResponse({
      app: OTP_SETUP_APP_ID,
      v: 1,
      summary,
      secret: result.secret,
      backupCodes: result.backupCodes,
      qrPngBase64: base64Data,
      issuer,
      label,
      digits,
      period,
      resourceUri: OTP_SETUP_APP_RESOURCE_URI,
    });
  } catch (error) {
    return createTextResponse(`❌ Failed to set up OTP: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const registerSetupOTPTool = (server: McpServer, sessionManager: SessionManager): void => {
  registerAppTool(
    server,
    'setup_otp',
    {
      title: 'Setup OTP',
      description:
        'Set up One-Time Password (OTP) for encrypted personal data. On MCP App-capable clients, the QR code and backup codes appear in the app panel; otherwise use the structured result.',
      inputSchema: SetupOTPInputSchema.shape,
      _meta: {
        ui: { resourceUri: OTP_SETUP_APP_RESOURCE_URI },
      },
    },
    async (args: Record<string, unknown>) => {
      try {
        const currentContext = sessionManager.getCurrentContext();
        return await setupOTP(args, currentContext);
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `❌ Error in setup_otp: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    },
  );
}; 