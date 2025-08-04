import { ServerContext, ToolHandler, ToolResult } from '../../core/Context.js';
import { safeParse } from '../../core/Validation.js';
import { createTextResponse, formatSearchResults } from '../../core/Response.js';
import { getDecryptionOptions } from '../../core/Context.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// Input schema for this tool
export const SearchInFilesInputSchema = z.object({
  query: z.string().min(1, "Query is required"),
  tags: z.array(z.string()).optional(),
  date_range: z.object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format")
  }).optional()
});

type SearchInFilesInput = z.infer<typeof SearchInFilesInputSchema>;

export const searchInFiles: ToolHandler = async (args: unknown, context: ServerContext): Promise<ToolResult> => {
  const input = safeParse<SearchInFilesInput>(SearchInFilesInputSchema, args, 'search_in_personal_info_files');
  
  // Get decryption options if OTP is active
  const decryptionOptions = getDecryptionOptions(context);
  
  const files = await context.fileManager.searchFiles(
    input.query,
    input.tags,
    input.date_range,
    decryptionOptions
  );

  if (files.length === 0) {
    return createTextResponse(`No memories found matching query: "${input.query}"`);
  }

  const result = formatSearchResults(input.query, files);
  return createTextResponse(result);
};

// Direct registration - all metadata inline
export const registerSearchInFilesTool = (server: McpServer, sessionManager: any): void => {
  server.registerTool('search_in_personal_info_files', {
    title: "Search in Personal Information Files",
    description: "Search through personal information files",
    inputSchema: SearchInFilesInputSchema.shape
  }, async (args: { [x: string]: any }, extra: any) => {
    try {
      const currentContext = sessionManager.getCurrentContext();
      const result = await searchInFiles(args, currentContext);
      return result;
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `❌ Error in search_personal_memories: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  });
}; 