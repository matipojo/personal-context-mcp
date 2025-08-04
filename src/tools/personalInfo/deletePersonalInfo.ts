import { ServerContext, ToolHandler, ToolResult } from '../../core/Context.js';
import { safeParse } from '../../core/Validation.js';
import { createTextResponse } from '../../core/Response.js';
import { getDecryptionOptions } from '../../core/Context.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// Input schema for this tool
export const DeletePersonalInfoInputSchema = z.object({
  category: z.string().min(1, "Category is required"),
  subcategory: z.string().optional()
});

type DeletePersonalInfoInput = z.infer<typeof DeletePersonalInfoInputSchema>;

export const deletePersonalInfo: ToolHandler = async (args: unknown, context: ServerContext): Promise<ToolResult> => {
  const input = safeParse<DeletePersonalInfoInput>(DeletePersonalInfoInputSchema, args, 'delete_personal_info');

  // Get decryption options if OTP is active
  const decryptionOptions = getDecryptionOptions(context);

  // Find the existing file
  const files = await context.fileManager.findFilesByCategory(
    input.category,
    input.subcategory,
    decryptionOptions
  );

  if (files.length === 0) {
    throw new Error(`Information not found: ${input.category}${input.subcategory ? ` (${input.subcategory})` : ''}`);
  }

  // Delete the first matching file
  const existingFile = files[0]!;
  const filePath = context.fileManager.getFilePath(input.category, input.subcategory);

  // Create backup if enabled
  if (context.config.PERSONAL_INFO_BACKUP_ENABLED) {
    await context.fileManager.createBackup(filePath, context.config.PERSONAL_INFO_BACKUP_DIR);
  }

  await context.fileManager.deleteFile(filePath);

  return createTextResponse(`✅ Successfully deleted ${input.category}${input.subcategory ? ` (${input.subcategory})` : ''}.`);
};

// Direct registration - all metadata inline
export const registerDeletePersonalInfoTool = (server: McpServer, sessionManager: any): void => {
  server.registerTool('delete_personal_info', {
    title: "Delete Personal Information",
    description: "Delete specific personal information",
    inputSchema: DeletePersonalInfoInputSchema.shape
  }, async (args: { [x: string]: any }, extra: any) => {
    try {
      const currentContext = sessionManager.getCurrentContext();
      const result = await deletePersonalInfo(args, currentContext);
      return result;
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `❌ Error in delete_personal_info: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  });
}; 