import { ServerContext, ToolHandler, ToolResult } from '../../core/Context.js';
import { safeParse, validateHasListedInfo } from '../../core/Validation.js';
import { createTextResponse, createNotFoundResponse, formatFileInfo } from '../../core/Response.js';
import { getDecryptionOptions } from '../../core/Context.js';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Input schema for this tool
export const BatchGetPersonalInfoInputSchema = z.object({
  has_list_available_personal_info: z.boolean().default(false).describe("If true, you already listed all categories"),
  requests: z.array(z.object({
    category: z.string().min(1, "Category is required").describe("e.g., 'name','phone', 'address', 'hobbies', 'pets', 'family', 'friends', 'work'"),
    subcategory: z.string().optional()
  })).min(1, "At least one request is required")
});

type BatchGetPersonalInfoInput = z.infer<typeof BatchGetPersonalInfoInputSchema>;

export const batchGetPersonalInfo: ToolHandler = async (args: unknown, context: ServerContext): Promise<ToolResult> => {
  const input = safeParse<BatchGetPersonalInfoInput>(BatchGetPersonalInfoInputSchema, args, 'batch_get_personal_info');

  validateHasListedInfo(input.has_list_available_personal_info);

  // Get decryption options if OTP is active
  const decryptionOptions = getDecryptionOptions(context);

  const results: Array<{ category: string; subcategory?: string; found: boolean; content?: string; error?: string }> = [];

  for (const request of input.requests) {
    try {
      const files = await context.fileManager.findFilesByCategory(
        context.permissionManager.getAllowedScopes(),
        request.category,
        request.subcategory,
        decryptionOptions
      );

      if (files.length === 0) {
        const result: any = {
          category: request.category,
          found: false,
          error: `No ${request.category} information found in accessible scopes.`
        };
        if (request.subcategory) {
          result.subcategory = request.subcategory;
        }
        results.push(result);
      } else {
        let content = '';
        for (const file of files) {
          content += formatFileInfo(file);
        }
        
        const result: any = {
          category: request.category,
          found: true,
          content: content
        };
        if (request.subcategory) {
          result.subcategory = request.subcategory;
        }
        results.push(result);
      }
    } catch (error) {
      const result: any = {
        category: request.category,
        found: false,
        error: error instanceof Error ? error.message : String(error)
      };
      if (request.subcategory) {
        result.subcategory = request.subcategory;
      }
      results.push(result);
    }
  }

  // Build the response
  let result = '# Batch Personal Information Results\n\n';
  result += `Retrieved ${results.length} request(s):\n\n`;

  for (const res of results) {
    result += `## ${res.category.charAt(0).toUpperCase() + res.category.slice(1)}`;
    if (res.subcategory) {
      result += ` (${res.subcategory})`;
    }
    result += '\n\n';

    if (res.found && res.content) {
      result += res.content;
    } else {
      result += `❌ ${res.error || 'No information found'}\n\n`;
    }
  }

  return createTextResponse(result);
}; 

// Direct registration - all metadata inline
export const registerBatchGetPersonalInfoTool = (server: McpServer, sessionManager: any): void => {
  server.registerTool('batch_get_personal_info', {
    title: "Batch Get Personal Information",
    description: "Retrieve multiple categories of personal information in a single request. Retrieve personal information based on category and current scope permissions, you can get a wide range of information, personal, pets, family, friends, work, etc and even more. You must list once all the categories with the list_available_personal_info tool before using this tool to understand what you can get.",
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