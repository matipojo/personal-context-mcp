import { ServerContext, ToolHandler, ToolResult } from '../../core/Context.js';
import { safeParse } from '../../core/Validation.js';
import { createTextResponse } from '../../core/Response.js';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Input schema for this tool
export const CreateScopeInputSchema = z.object({
  scope_name: z.string()
    .regex(/^[a-z][a-z0-9_-]*$/, "Must start with lowercase letter, contain only lowercase letters, numbers, underscores, and hyphens")
    .min(2, "Must be at least 2 characters")
    .max(50, "Must be at most 50 characters"),
  description: z.string().min(5, "Description must be at least 5 characters"),
  parent_scope: z.string().optional(),
  sensitivity_level: z.number().min(1).max(10).default(5).describe("1=public, 10=highly sensitive")
});

type CreateScopeInput = z.infer<typeof CreateScopeInputSchema>;

export const createScope: ToolHandler = async (args: unknown, context: ServerContext): Promise<ToolResult> => {
  const input = safeParse<CreateScopeInput>(CreateScopeInputSchema, args, 'create_personal_scope');
  
  const customScope = {
    description: input.description,
    sensitivity_level: input.sensitivity_level,
    parent_scope: input.parent_scope,
    created: new Date().toISOString()
  };

  await context.permissionManager.saveCustomScope(input.scope_name, customScope);

  return createTextResponse(
    `Successfully created custom scope '${input.scope_name}' with sensitivity level ${input.sensitivity_level}.`
  );
}; 

// Direct registration - all metadata inline
export const registerCreateScopeTool = (server: McpServer, sessionManager: any): void => {
  server.registerTool('create_personal_scope', {
    title: "Create Personal Scope",
    description: "Create a new custom scope for organizing personal information",
    inputSchema: CreateScopeInputSchema.shape
  }, async (args: { [x: string]: any }, extra: any) => {
    try {
      const currentContext = sessionManager.getCurrentContext();
      const result = await createScope(args, currentContext);
      return result;
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `❌ Error in create_personal_scope: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  });
}; 