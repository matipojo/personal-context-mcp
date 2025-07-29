import { ServerContext, ToolHandler, ToolResult } from '../../core/Context.js';
import { safeParse, validateBatchOperation } from '../../core/Validation.js';
import { formatBatchResults, createTextResponse } from '../../core/Response.js';
import { getDecryptionOptions } from '../../core/Context.js';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Input schema for this tool
export const BatchSavePersonalInfoInputSchema = z.object({
  items: z.array(z.object({
    category: z.string().min(1, "Category is required"),
    subcategory: z.string().optional(),
    content: z.string().min(1, "Content is required"),
    scope: z.string().min(1, "Scope is required").describe("public, contact, personal, memories, sensitive, or custom scope"),
    tags: z.array(z.string()).optional(),
    isTimeBased: z.boolean().optional().describe("If true, adds timestamp to filename for time-based information like meetings, tasks, and memories")
  })).min(1, "At least one item is required")
});

type BatchSavePersonalInfoInput = z.infer<typeof BatchSavePersonalInfoInputSchema>;

export const batchSavePersonalInfo: ToolHandler = async (args: unknown, context: ServerContext): Promise<ToolResult> => {
  const input = safeParse<BatchSavePersonalInfoInput>(BatchSavePersonalInfoInputSchema, args, 'batch_save_personal_info');

  // Get decryption/encryption options if OTP is active
  const encryptionOptions = getDecryptionOptions(context);

  // Validate batch operation
  validateBatchOperation(input.items, context);

  const results: Array<{ category: string; subcategory?: string; success: boolean; action: 'created' | 'updated'; error?: string }> = [];

  for (const item of input.items) {
    try {
      const filePath = item.isTimeBased
        ? context.fileManager.getTimeBasedFilePath(item.scope, item.category, item.subcategory)
        : context.fileManager.getFilePath(item.scope, item.category, item.subcategory);
      
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
          scope: item.scope,
          category: item.category,
          subcategory: item.subcategory,
          created: existingFile?.frontmatter.created || now,
          updated: now,
          tags: item.tags || existingFile?.frontmatter.tags || []
        },
        content: item.content,
        filePath: ''
      };

      await context.fileManager.writeMarkdownFile(filePath, fileData, encryptionOptions);

      const successResult: any = {
        category: item.category,
        success: true,
        action: isUpdate ? 'updated' : 'created'
      };
      if (item.subcategory) {
        successResult.subcategory = item.subcategory;
      }
      results.push(successResult);

    } catch (error) {
      const errorResult: any = {
        category: item.category,
        success: false,
        action: 'created' as const,
        error: error instanceof Error ? error.message : String(error)
      };
      if (item.subcategory) {
        errorResult.subcategory = item.subcategory;
      }
      results.push(errorResult);
    }
  }

  const resultText = formatBatchResults('Batch Save Results', results);
  return createTextResponse(resultText);
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