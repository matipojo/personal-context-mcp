import { ServerContext, ToolHandler, ToolResult } from '../../core/Context.js';
import { safeParse, validateHasListedInfo } from '../../core/Validation.js';
import { createTextResponse, formatFileInfo } from '../../core/Response.js';
import { getDecryptionOptions } from '../../core/Context.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// Input schema for this tool
export const BatchGetPersonalInfoInputSchema = z.object({
  requests: z.array(z.object({
    category: z.string().min(1, "Category is required"),
    subcategory: z.string().optional()
  })).min(1, "At least one request is required"),
  has_list_available_personal_info: z.boolean().default(false).describe("If true, you already listed all categories")
});

type BatchGetPersonalInfoInput = z.infer<typeof BatchGetPersonalInfoInputSchema>;

export const batchGetPersonalInfo: ToolHandler = async (args: unknown, context: ServerContext): Promise<ToolResult> => {
  const input = safeParse<BatchGetPersonalInfoInput>(BatchGetPersonalInfoInputSchema, args, 'batch_get_personal_info');

  // Validate that the user has listed available info first
  validateHasListedInfo(input.has_list_available_personal_info);

  // Get decryption options if OTP is active
  const decryptionOptions = getDecryptionOptions(context);

  let result = '# Batch Personal Information Results\n\n';
  let foundCount = 0;

  for (const request of input.requests) {
    try {
      const files = await context.fileManager.findFilesByCategory(
        request.category,
        request.subcategory,
        decryptionOptions
      );

      if (files.length > 0) {
        foundCount++;
        for (const file of files) {
          result += formatFileInfo(file);
        }
      } else {
        result += `### ${request.category}${request.subcategory ? ` - ${request.subcategory}` : ''}\n\n`;
        result += `*No information found*\n\n---\n\n`;
      }
    } catch (error) {
      result += `### ${request.category}${request.subcategory ? ` - ${request.subcategory}` : ''}\n\n`;
      result += `*Error: ${error instanceof Error ? error.message : String(error)}*\n\n---\n\n`;
    }
  }

  result += `\n**Summary:** Found information for ${foundCount} out of ${input.requests.length} requested categories.`;

  return createTextResponse(result);
};

// Direct registration - all metadata inline
export const registerBatchGetPersonalInfoTool = (server: McpServer, sessionManager: any): void => {
  server.registerTool('batch_get_personal_info', {
    title: "Batch Get Personal Information",
    description: "Retrieve multiple categories of personal information in a single request. Retrieve personal information based on category and current permissions, you can get a wide range of information, personal, pets, family, friends, work, etc and even more. You must list once all the categories with the list_available_personal_info tool before using this tool to understand what you can get.",
    inputSchema: BatchGetPersonalInfoInputSchema.shape
  }, async (args: { [x: string]: any }, extra: any) => {
    try {
      const currentContext = sessionManager.getCurrentContext();
      const result = await batchGetPersonalInfo(args, currentContext);
      return result;
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `❌ Error in batch_get_personal_info: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  });
}; 