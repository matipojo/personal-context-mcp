import { ServerContext, ToolHandler, ToolResult } from '../../core/Context.js';
import { safeParse } from '../../core/Validation.js';
import { createTextAndImageResponse, createTextResponse } from '../../core/Response.js';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

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

    // Extract base64 data from the data URL
    const base64Data = result.qrCodeDataURL.replace(/^data:image\/png;base64,/, '');

    let response = '# OTP Setup Complete! 🔐\n\n';
    response += 'Your One-Time Password authentication has been successfully configured.\n\n';
    response += '## 📱 Scan the QR Code\n\n';
    response += 'Scan the QR code below with your authenticator app (Google Authenticator, Authy, 1Password, etc.)\n\n';
    response += `**Secret Key (manual entry):** \`${result.secret}\`\n\n`;
    response += '## 🆘 Emergency Backup Codes\n\n';
    response += '**⚠️ IMPORTANT:** Save these backup codes in a secure location. Each can only be used once.\n\n';
    response += '**⚠️ IMPORTANT LLM note:** Add the QR code to the artifacts.\n\n';
    
    result.backupCodes.forEach((code: string, index: number) => {
      response += `${index + 1}. \`${code}\`\n`;
    });
    
    response += '\n## 🔑 Next Steps\n\n';
    response += '1. Scan the QR code with your authenticator app\n';
    response += '2. Use the `verify_otp` tool with a token from your app to test\n';
    response += '3. Once verified, your personal data will be encrypted with OTP-enhanced security\n';
    response += '4. You\'ll need to verify an OTP token before accessing encrypted information\n\n';
    response += '## ⚙️ Configuration\n\n';
    response += `- **Digits:** ${input.digits || 6}\n`;
    response += `- **Period:** ${input.period || 30} seconds\n`;
    response += `- **Issuer:** ${input.issuer || 'Personal MCP Server'}\n`;

    return createTextAndImageResponse(response, base64Data, 'image/png');
  } catch (error) {
    return createTextResponse(`❌ Failed to set up OTP: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// Direct registration - all metadata inline
export const registerSetupOTPTool = (server: McpServer, sessionManager: any): void => {
  server.registerTool('setup_otp', {
    title: "Setup OTP",
    description: "Set up One-Time Password (OTP) authentication for accessing encrypted personal data. Returns QR code image and backup codes.",
    inputSchema: SetupOTPInputSchema.shape
  }, async (args: { [x: string]: any }, extra: any) => {
    try {
      const currentContext = sessionManager.getCurrentContext();
      const result = await setupOTP(args, currentContext);
      return result;
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `❌ Error in setup_otp: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  });
}; 