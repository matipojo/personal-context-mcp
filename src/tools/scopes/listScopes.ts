import { ServerContext, ToolHandler, ToolResult } from '../../core/Context.js';
import { safeParse } from '../../core/Validation.js';
import { createTextResponse } from '../../core/Response.js';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Input schema for this tool
export const ListScopesInputSchema = z.object({
  include_custom_only: z.boolean().optional(),
  show_hierarchy: z.boolean().optional()
});

type ListScopesInput = z.infer<typeof ListScopesInputSchema>;

// Helper function to build built-in scopes table
const buildBuiltInScopesTable = (): string => {
  let result = '## Built-in Scopes\n\n';
  result += '| Scope | Description | Sensitivity | Example Data |\n';
  result += '|-------|-------------|-------------|---------------|\n';
  
  const builtInScopes = [
    { name: 'public', description: 'Publicly shareable information', sensitivity_level: 1, example_data: 'Name, avatar, bio' },
    { name: 'contact', description: 'Contact information', sensitivity_level: 3, example_data: 'Email, phone, address, social media' },
    { name: 'personal', description: 'Personal details', sensitivity_level: 6, example_data: 'Age, hobbies, preferences' },
    { name: 'memories', description: 'Personal memories and experiences', sensitivity_level: 7, example_data: 'Trips, events, relationships' },
    { name: 'sensitive', description: 'Sensitive information', sensitivity_level: 9, example_data: 'Health data, financial info' }
  ];

  for (const scope of builtInScopes) {
    result += `| **${scope.name}** | ${scope.description} | ${scope.sensitivity_level} | ${scope.example_data} |\n`;
  }
  result += '\n';
  
  return result;
};

// Helper function to build custom scopes section
const buildCustomScopesSection = (customScopes: Record<string, any>, context: ServerContext, input: ListScopesInput): string => {
  if (Object.keys(customScopes).length === 0) {
    return input.include_custom_only ? 'No custom scopes have been created yet.\n' : '';
  }

  let result = '## Custom Scopes\n\n';
  
  if (input.show_hierarchy) {
    const hierarchy = context.permissionManager.getScopeHierarchy();
    for (const [name, scope] of Object.entries(customScopes)) {
      result += `- **${name}** (sensitivity: ${scope.sensitivity_level})\n`;
      result += `  - ${scope.description}\n`;
      if (scope.parent_scope) {
        result += `  - Parent: ${scope.parent_scope}\n`;
      }
      const scopeHierarchy = hierarchy[name];
      if (scopeHierarchy && scopeHierarchy.children.length > 0) {
        result += `  - Children: ${scopeHierarchy.children.join(', ')}\n`;
      }
      result += `  - Created: ${scope.created}\n\n`;
    }
  } else {
    result += '| Scope | Description | Sensitivity | Parent | Created |\n';
    result += '|-------|-------------|-------------|--------|----------|\n';
    
    for (const [name, scope] of Object.entries(customScopes)) {
      result += `| **${name}** | ${scope.description} | ${scope.sensitivity_level} | ${scope.parent_scope || 'none'} | ${scope.created} |\n`;
    }
  }
  
  return result;
};

// Helper function to build allowed scopes section
const buildAllowedScopesSection = (context: ServerContext): string => {
  let result = '\n## Currently Allowed Scopes\n\n';
  const allowedScopes = context.permissionManager.getAllowedScopes();
  result += allowedScopes.map(scope => `- ${scope}`).join('\n');
  return result;
};

export const listScopes: ToolHandler = async (args: unknown, context: ServerContext): Promise<ToolResult> => {
  const input = safeParse<ListScopesInput>(ListScopesInputSchema, args, 'list_personal_scopes');
  
  let result = '# Available Scopes\n\n';

  // Add built-in scopes section if not filtering for custom only
  if (!input.include_custom_only) {
    result += buildBuiltInScopesTable();
  }

  // Add custom scopes section
  const customScopes = context.permissionManager.getCustomScopes();
  result += buildCustomScopesSection(customScopes, context, input);

  // Add currently allowed scopes
  result += buildAllowedScopesSection(context);

  return createTextResponse(result);
}; 

// Direct registration - all metadata inline
export const registerListScopesTool = (server: McpServer, sessionManager: any): void => {
  server.registerTool('list_personal_scopes', {
    title: "List Personal Scopes",
    description: "List all available scopes (built-in and custom) with their details",
    inputSchema: ListScopesInputSchema.shape
  }, async (args: { [x: string]: any }, extra: any) => {
    try {
      const currentContext = sessionManager.getCurrentContext();
      const result = await listScopes(args, currentContext);
      return result;
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `❌ Error in list_personal_scopes: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  });
}; 