import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppResource, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { OTP_SETUP_APP_RESOURCE_URI } from '../core/mcpAppUris.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function registerOtpSetupMcpAppResource(server: McpServer): void {
  registerAppResource(
    server,
    'OTP setup',
    OTP_SETUP_APP_RESOURCE_URI,
    { description: 'OTP QR code, secret, and backup codes (MCP App)' },
    async (_uri: URL) => {
      const htmlPath = path.join(__dirname, '../mcp-apps/index.html');
      const text = await fs.readFile(htmlPath, 'utf-8');
      return {
        contents: [
          {
            uri: OTP_SETUP_APP_RESOURCE_URI,
            mimeType: RESOURCE_MIME_TYPE,
            text,
          },
        ],
      };
    },
  );
}
