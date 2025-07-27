import { ServerContext, ToolHandler, ToolResult } from '../../core/Context.js';
import { safeParse, validateAndPrepareScope } from '../../core/Validation.js';
import { createSuccessResponse } from '../../core/Response.js';
import { getDecryptionOptions } from '../../core/Context.js';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Input schema for this tool
export const SavePersonalInfoInputSchema = z.object({
  category: z.string().min(1, "Category is required"),
  subcategory: z.string().optional(),
  content: z.string().min(1, "Content is required"),
  scope: z.string().min(1, "Scope is required").describe("public, contact, location, personal, memories, sensitive, or custom scope"),
  tags: z.array(z.string()).optional()
});

type SavePersonalInfoInput = z.infer<typeof SavePersonalInfoInputSchema>;

export const savePersonalInfo: ToolHandler = async (args: unknown, context: ServerContext): Promise<ToolResult> => {
  const input = safeParse<SavePersonalInfoInput>(SavePersonalInfoInputSchema, args, 'save_personal_info');

  // Get encryption options if OTP is active (this will throw if OTP verification is required)
  const encryptionOptions = getDecryptionOptions(context);

  // Validate scope permissions
  validateAndPrepareScope(input.scope, context);

  const filePath = context.fileManager.getFilePath(input.scope, input.category, input.subcategory);
  const now = new Date().toISOString();

  // Check if file exists to determine if this is an update
  const isUpdate = await context.fileManager.fileExists(filePath);

  // Create backup if updating existing file
  if (isUpdate && context.config.PERSONAL_INFO_BACKUP_ENABLED) {
    await context.fileManager.createBackup(filePath, context.config.PERSONAL_INFO_BACKUP_DIR);
  }

  const existingFile = isUpdate ? await context.fileManager.readMarkdownFile(filePath, encryptionOptions) : null;

  const fileData = {
    frontmatter: {
      scope: input.scope,
      category: input.category,
      subcategory: input.subcategory,
      created: existingFile?.frontmatter.created || now,
      updated: now,
      tags: input.tags || existingFile?.frontmatter.tags || []
    },
    content: input.content,
    filePath: ''
  };

  await context.fileManager.writeMarkdownFile(filePath, fileData, encryptionOptions);

  const action = isUpdate ? 'updated' : 'created';
  const entity = `${input.category}${input.subcategory ? ` (${input.subcategory})` : ''}`;
  
  return createSuccessResponse(action, entity, input.scope);
};

// Direct registration - all metadata inline
export const registerSavePersonalInfoTool = (server: McpServer, sessionManager: any): void => {
  server.registerTool('save_personal_info', {
    title: "Save Personal Information",
    description: "Save or update personal information. You should save things on every time when user enters new personal information that not saved yet.",
    inputSchema: SavePersonalInfoInputSchema.shape
  }, async (args: { [x: string]: any }, extra: any) => {
    try {
      const currentContext = sessionManager.getCurrentContext();
      const result = await savePersonalInfo(args, currentContext);
      return result;
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `❌ Error in save_personal_info: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  });
}; 