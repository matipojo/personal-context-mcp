import { ServerContext, ToolHandler, ToolResult } from '../../core/Context.js';
import { safeParse } from '../../core/Validation.js';
import { createTextResponse, formatAvailableInfo } from '../../core/Response.js';
import { getDecryptionOptions } from '../../core/Context.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// Input schema for this tool
export const ListAvailableInfoInputSchema = z.object({
  category_filter: z.string().optional()
});

type ListAvailableInfoInput = z.infer<typeof ListAvailableInfoInputSchema>;

export const listAvailableInfo: ToolHandler = async (args: unknown, context: ServerContext): Promise<ToolResult> => {
  const input = safeParse<ListAvailableInfoInput>(ListAvailableInfoInputSchema, args, 'list_available_personal_info');
  
  // Get decryption options if OTP is active
  const decryptionOptions = getDecryptionOptions(context);
  
  const files = await context.fileManager.listFiles(decryptionOptions);

  // Apply category filter if provided
  let filteredFiles = files;
  if (input.category_filter) {
    const filterCategories = input.category_filter.split(',').map(s => s.trim());
    filteredFiles = files.filter(file => filterCategories.includes(file.frontmatter.category));
  }

  if (filteredFiles.length === 0) {
    return createTextResponse('No personal information found.');
  }

  // Group files by category
  const filesByCategory: Record<string, typeof files> = {};
  for (const file of filteredFiles) {
    if (!filesByCategory[file.frontmatter.category]) {
      filesByCategory[file.frontmatter.category] = [];
    }
    filesByCategory[file.frontmatter.category]!.push(file);
  }

  const result = formatAvailableInfo(filesByCategory);
  return createTextResponse(result);
}; 

// Direct registration - all metadata inline
export const registerListAvailableInfoTool = (server: McpServer, sessionManager: any): void => {
  server.registerTool('list_available_personal_info', {
    title: "List Available Personal Information",
    description: "List all available personal information within current permissions",
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