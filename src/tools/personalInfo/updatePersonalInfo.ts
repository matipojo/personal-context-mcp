import { ServerContext, ToolHandler, ToolResult } from '../../core/Context.js';
import { safeParse, validateAndPrepareScope } from '../../core/Validation.js';
import { createSuccessResponse } from '../../core/Response.js';
import { getDecryptionOptions } from '../../core/Context.js';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Input schema for this tool
export const UpdatePersonalInfoInputSchema = z.object({
  category: z.string().min(1, "Category is required"),
  subcategory: z.string().optional(),
  content: z.string().optional(),
  scope: z.string().optional(),
  tags: z.array(z.string()).optional()
});

type UpdatePersonalInfoInput = z.infer<typeof UpdatePersonalInfoInputSchema>;

export const updatePersonalInfo: ToolHandler = async (args: unknown, context: ServerContext): Promise<ToolResult> => {
  const input = safeParse<UpdatePersonalInfoInput>(UpdatePersonalInfoInputSchema, args, 'update_personal_info');

  // Get encryption options if OTP is active (this will throw if OTP verification is required)
  const encryptionOptions = getDecryptionOptions(context);

  // First, find the existing file to get current scope if not provided
  const files = await context.fileManager.findFilesByCategory(
    context.permissionManager.getAllowedScopes(),
    input.category,
    input.subcategory,
    encryptionOptions
  );

  if (files.length === 0) {
    throw new Error(`Information not found: ${input.category}${input.subcategory ? ` (${input.subcategory})` : ''}`);
  }

  // Use the first matching file
  const existingFile = files[0]!; // Safe because we checked files.length > 0
  const targetScope = input.scope || existingFile.frontmatter.scope;

  // Check if we have permission to write to this scope
  if (!context.permissionManager.isAccessAllowed(targetScope)) {
    throw new Error(`Access denied: scope '${targetScope}' is not allowed`);
  }

  // Validate the scope exists
  if (!context.permissionManager.isValidScope(targetScope)) {
    throw new Error(`Invalid scope: '${targetScope}'`);
  }

  const filePath = context.fileManager.getFilePath(targetScope, input.category, input.subcategory);
  const now = new Date().toISOString();

  // Create backup if enabled
  if (context.config.PERSONAL_INFO_BACKUP_ENABLED) {
    await context.fileManager.createBackup(filePath, context.config.PERSONAL_INFO_BACKUP_DIR);
  }

  const fileData = {
    frontmatter: {
      scope: targetScope,
      category: input.category,
      subcategory: input.subcategory || existingFile.frontmatter.subcategory,
      created: existingFile.frontmatter.created,
      updated: now,
      tags: input.tags || existingFile.frontmatter.tags
    },
    content: input.content || existingFile.content,
    filePath: ''
  };

  await context.fileManager.writeMarkdownFile(filePath, fileData, encryptionOptions);

  const entity = `${input.category}${input.subcategory ? ` (${input.subcategory})` : ''}`;
  return createSuccessResponse('updated', entity, targetScope);
};

// Direct registration - all metadata inline
export const registerUpdatePersonalInfoTool = (server: McpServer, sessionManager: any): void => {
  server.registerTool('update_personal_info', {
    title: "Update Personal Information",
    description: "Update existing personal information. Only updates specified fields, leaving others unchanged.",
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