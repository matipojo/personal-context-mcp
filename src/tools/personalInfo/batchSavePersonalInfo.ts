import { ServerContext, ToolHandler, ToolResult } from '../../core/Context.js';
import { safeParse } from '../../core/Validation.js';
import { createTextResponse, formatBatchResults } from '../../core/Response.js';
import { getDecryptionOptions } from '../../core/Context.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// Input schema for this tool
export const BatchSavePersonalInfoInputSchema = z.object({
  items: z.array(z.object({
    category: z.string().min(1, "Category is required"),
    subcategory: z.string().optional(),
    content: z.string().min(1, "Content is required"),
    isTimeBased: z.boolean().optional(),
    tags: z.array(z.string()).optional()
  })).min(1, "At least one item is required")
});

type BatchSavePersonalInfoInput = z.infer<typeof BatchSavePersonalInfoInputSchema>;

export const batchSavePersonalInfo: ToolHandler = async (args: unknown, context: ServerContext): Promise<ToolResult> => {
  const input = safeParse<BatchSavePersonalInfoInput>(BatchSavePersonalInfoInputSchema, args, 'batch_save_personal_info');

  // Get encryption options if OTP is active
  const encryptionOptions = getDecryptionOptions(context);

  const results: Array<{ success: boolean; category: string; subcategory?: string; action?: string; error?: string }> = [];

  for (const item of input.items) {
    try {
      const now = new Date().toISOString();
      
      // Check if file already exists
      const existingFiles = await context.fileManager.findFilesByCategory(
        item.category,
        item.subcategory,
        encryptionOptions
      );

      const isUpdate = existingFiles.length > 0;
      const action = isUpdate ? 'updated' : 'created';

      const filePath = context.fileManager.getFilePath(item.category, item.subcategory);

      // Create backup if enabled and file exists
      if (isUpdate && context.config.PERSONAL_INFO_BACKUP_ENABLED) {
        await context.fileManager.createBackup(filePath, context.config.PERSONAL_INFO_BACKUP_DIR);
      }

      const fileData = {
        frontmatter: {
          category: item.category,
          subcategory: item.subcategory,
          created: isUpdate ? existingFiles[0]!.frontmatter.created : now,
          updated: now,
          tags: item.tags || []
        },
        content: item.content,
        filePath: ''
      };

      await context.fileManager.writeMarkdownFile(filePath, fileData, encryptionOptions);

      const successResult: any = {
        success: true,
        category: item.category,
        action
      };
      if (item.subcategory) {
        successResult.subcategory = item.subcategory;
      }
      results.push(successResult);
    } catch (error) {
      const errorResult: any = {
        success: false,
        category: item.category,
        error: error instanceof Error ? error.message : String(error)
      };
      if (item.subcategory) {
        errorResult.subcategory = item.subcategory;
      }
      results.push(errorResult);
    }
  }

  const result = formatBatchResults('Batch Save Personal Information', results);
  return createTextResponse(result);
};

// Direct registration - all metadata inline
export const registerBatchSavePersonalInfoTool = (server: McpServer, sessionManager: any): void => {
  server.registerTool('batch_save_personal_info', {
    title: "Batch Save Personal Information",
    description: "Save multiple pieces of personal information in a single request. More efficient than making multiple individual save requests.",
    inputSchema: BatchSavePersonalInfoInputSchema.shape
  }, async (args: { [x: string]: any }, extra: any) => {
    try {
      const currentContext = sessionManager.getCurrentContext();
      const result = await batchSavePersonalInfo(args, currentContext);
      return result;
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `❌ Error in batch_save_personal_info: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  });
}; 