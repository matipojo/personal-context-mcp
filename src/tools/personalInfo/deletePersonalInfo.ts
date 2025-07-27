import { ServerContext, ToolHandler, ToolResult } from '../../core/Context.js';
import { safeParse } from '../../core/Validation.js';
import { createSuccessResponse, createNotFoundResponse, createTextResponse } from '../../core/Response.js';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Input schema for this tool
export const DeletePersonalInfoInputSchema = z.object({
  category: z.string().min(1, "Category is required"),
  subcategory: z.string().optional()
});

type DeletePersonalInfoInput = z.infer<typeof DeletePersonalInfoInputSchema>;

export const deletePersonalInfo: ToolHandler = async (args: unknown, context: ServerContext): Promise<ToolResult> => {
  const input = safeParse<DeletePersonalInfoInput>(DeletePersonalInfoInputSchema, args, 'delete_personal_info');
  
  const files = await context.fileManager.findFilesByCategory(
    context.permissionManager.getAllowedScopes(),
    input.category,
    input.subcategory
  );

  if (files.length === 0) {
    throw new Error(`No ${input.category} information found to delete`);
  }

  let deletedCount = 0;
  for (const file of files) {
    // Check permission for each file's scope
    if (context.permissionManager.isAccessAllowed(file.frontmatter.scope)) {
      const fullPath = context.fileManager.getFilePath(
        file.frontmatter.scope, 
        file.frontmatter.category, 
        file.frontmatter.subcategory
      );
      
      // Create backup if enabled
      if (context.config.PERSONAL_INFO_BACKUP_ENABLED) {
        await context.fileManager.createBackup(fullPath, context.config.PERSONAL_INFO_BACKUP_DIR);
      }
      
      await context.fileManager.deleteFile(fullPath);
      deletedCount++;
    }
  }

  return createSuccessResponse(`deleted`, `${deletedCount} ${input.category} file(s).`);
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