import { ServerContext, ToolHandler, ToolResult } from '../../core/Context.js';
import { safeParse } from '../../core/Validation.js';
import { createTextResponse, formatAvailableInfo } from '../../core/Response.js';
import { getDecryptionOptions } from '../../core/Context.js';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Input schema for this tool
export const ListAvailableInfoInputSchema = z.object({
  scope_filter: z.string().optional()
});

type ListAvailableInfoInput = z.infer<typeof ListAvailableInfoInputSchema>;

export const listAvailableInfo: ToolHandler = async (args: unknown, context: ServerContext): Promise<ToolResult> => {
  const input = safeParse<ListAvailableInfoInput>(ListAvailableInfoInputSchema, args, 'list_available_personal_info');
  
  // Get decryption options if OTP is active
  const decryptionOptions = getDecryptionOptions(context);
  
  let allowedScopes = context.permissionManager.getAllowedScopes();
  if (input.scope_filter) {
    const filterScopes = input.scope_filter.split(',').map(s => s.trim());
    allowedScopes = allowedScopes.filter(scope => filterScopes.includes(scope));
  }

  const files = await context.fileManager.listFiles(allowedScopes, decryptionOptions);

  if (files.length === 0) {
    return createTextResponse('No personal information found in accessible scopes.');
  }

  // Group files by scope
  const filesByScope: Record<string, typeof files> = {};
  for (const file of files) {
    if (!filesByScope[file.frontmatter.scope]) {
      filesByScope[file.frontmatter.scope] = [];
    }
    filesByScope[file.frontmatter.scope]!.push(file);
  }

  const result = formatAvailableInfo(filesByScope);
  return createTextResponse(result);
}; 

// Direct registration - all metadata inline
export const registerListAvailableInfoTool = (server: McpServer, sessionManager: any): void => {
  server.registerTool('list_available_personal_info', {
    title: "List Available Personal Information",
    description: "List all available personal information within current scope. use it when the user needs personal information, for example, when the user asks writing a message, or on shopping and the address is needed, .",
    inputSchema: ListAvailableInfoInputSchema.shape
  }, async (args: { [x: string]: any }, extra: any) => {
    try {
      const currentContext = sessionManager.getCurrentContext();
      const result = await listAvailableInfo(args, currentContext);
      return result;
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `❌ Error in list_available_personal_info: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  });
}; 