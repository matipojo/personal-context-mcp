import { ServerContext, ToolHandler, ToolResult } from '../../core/Context.js';
import { safeParse } from '../../core/Validation.js';
import { createTextResponse } from '../../core/Response.js';
import { getDecryptionOptions } from '../../core/Context.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// Input schema for this tool
export const UpdatePersonalInfoInputSchema = z.object({
  category: z.string().min(1, "Category is required"),
  subcategory: z.string().optional(),
  content: z.string().optional(),
  tags: z.array(z.string()).optional()
});

type UpdatePersonalInfoInput = z.infer<typeof UpdatePersonalInfoInputSchema>;

export const updatePersonalInfo: ToolHandler = async (args: unknown, context: ServerContext): Promise<ToolResult> => {
  const input = safeParse<UpdatePersonalInfoInput>(UpdatePersonalInfoInputSchema, args, 'update_personal_info');

  // Get encryption options if OTP is active (this will throw if OTP verification is required)
  const encryptionOptions = getDecryptionOptions(context);

  // First, find the existing file to update
  const files = await context.fileManager.findFilesByCategory(
    input.category,
    input.subcategory,
    encryptionOptions
  );

  if (files.length === 0) {
    throw new Error(`Information not found: ${input.category}${input.subcategory ? ` (${input.subcategory})` : ''}`);
  }

  // Use the first matching file
  const existingFile = files[0]!; // Safe because we checked files.length > 0
  const filePath = context.fileManager.getFilePath(input.category, input.subcategory);
  const now = new Date().toISOString();

  // Create backup if enabled
  if (context.config.PERSONAL_INFO_BACKUP_ENABLED) {
    await context.fileManager.createBackup(filePath, context.config.PERSONAL_INFO_BACKUP_DIR);
  }

  const fileData = {
    frontmatter: {
      category: input.category,
      subcategory: input.subcategory,
      created: existingFile.frontmatter.created,
      updated: now,
      tags: input.tags || existingFile.frontmatter.tags
    },
    content: input.content || existingFile.content,
    filePath: existingFile.filePath
  };

  await context.fileManager.writeMarkdownFile(filePath, fileData, encryptionOptions);

  return createTextResponse(`✅ Successfully updated ${input.category}${input.subcategory ? ` (${input.subcategory})` : ''}.`);
};

// Direct registration - all metadata inline
export const registerUpdatePersonalInfoTool = (server: McpServer, sessionManager: any): void => {
  server.registerTool('update_personal_info', {
    title: "Update Personal Information",
    description: "Update existing personal information",
    inputSchema: UpdatePersonalInfoInputSchema.shape
  }, async (args: { [x: string]: any }, extra: any) => {
    try {
      const currentContext = sessionManager.getCurrentContext();
      const result = await updatePersonalInfo(args, currentContext);
      return result;
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `❌ Error in update_personal_info: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  });
}; 