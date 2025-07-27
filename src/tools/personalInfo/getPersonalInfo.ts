import { ServerContext, ToolHandler, ToolResult } from '../../core/Context.js';
import { safeParse, validateHasListedInfo } from '../../core/Validation.js';
import { createTextResponse, createNotFoundResponse, formatFileInfo } from '../../core/Response.js';
import { getDecryptionOptions } from '../../core/Context.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// Input schema for this tool
export const GetPersonalInfoInputSchema = z.object({
  has_list_available_personal_info: z.boolean().default(false).describe("If true, you already listed all categories"),
  category: z.string().min(1, "Category is required").describe("e.g., 'name', 'phone', 'address', 'hobbies', 'pets', 'family', 'friends', 'work'"),
  subcategory: z.string().optional()
});

type GetPersonalInfoInput = z.infer<typeof GetPersonalInfoInputSchema>;

export const getPersonalInfo: ToolHandler = async (args: unknown, context: ServerContext): Promise<ToolResult> => {
  const input = safeParse<GetPersonalInfoInput>(GetPersonalInfoInputSchema, args, 'get_personal_info');

  validateHasListedInfo(input.has_list_available_personal_info);

  // Get decryption options if OTP is active
  const decryptionOptions = getDecryptionOptions(context);

  const files = await context.fileManager.findFilesByCategory(
    context.permissionManager.getAllowedScopes(),
    input.category,
    input.subcategory,
    decryptionOptions
  );

  if (files.length === 0) {
    return createNotFoundResponse(`${input.category} information`, 'accessible scopes');
  }

  let result = `## ${input.category.charAt(0).toUpperCase() + input.category.slice(1)} Information\n\n`;
  
  for (const file of files) {
    result += formatFileInfo(file);
  }

  return createTextResponse(result);
};

// Direct registration - all metadata inline
export const registerGetPersonalInfoTool = (server: McpServer, sessionManager: any): void => {
  server.registerTool('get_personal_info', {
    title: "Get Personal Information",
    description: "Retrieve personal information based on category and current scope permissions, you can get a wide range of information, personal, pets, family, friends, work, etc and even more. You must list once all the categories with the list_available_personal_info tool before using this tool to understand what you can get.",
    inputSchema: GetPersonalInfoInputSchema.shape
  }, async (args: { [x: string]: any }, extra: any) => {
    try {
      const currentContext = sessionManager.getCurrentContext();
      const result = await getPersonalInfo(args, currentContext);
      return result;
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `❌ Error in get_personal_info: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  });
}; 