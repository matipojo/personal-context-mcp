import { ToolResult } from './Context.js';

// Pure functions for building responses
export const createTextResponse = (text: string): ToolResult => ({
  content: [
    {
      type: 'text' as const,
      text
    }
  ]
});

export const createSuccessResponse = (action: string, entity: string): ToolResult => {
  return createTextResponse(`✅ Successfully ${action} ${entity}.`);
};

export const createErrorResponse = (message: string): ToolResult => {
  return createTextResponse(`❌ ${message}`);
};

export const createNotFoundResponse = (entity: string): ToolResult => {
  return createTextResponse(`No ${entity} information found.`);
};

export const createOTPRequiredResponse = (): ToolResult => {
  return createTextResponse('🔒 OTP verification required. Please use verify_otp tool first to access encrypted data.');
};

export const createOTPNotEnabledResponse = (): ToolResult => {
  return createTextResponse('❌ OTP is not enabled. Use the `setup_otp` tool first.');
};

// Helper for creating image responses
export const createImageResponse = (base64Data: string, mimeType: string = 'image/png'): ToolResult => ({
  content: [
    {
      type: 'image' as const,
      data: base64Data,
      mimeType
    }
  ]
});

// Helper for creating combined text and image responses
export const createTextAndImageResponse = (text: string, base64Data: string, mimeType: string = 'image/png'): ToolResult => ({
  content: [
    {
      type: 'text' as const,
      text
    },
    {
      type: 'image' as const,
      data: base64Data,
      mimeType
    }
  ]
});

// Helper for building markdown-formatted responses
export const createMarkdownResponse = (title: string, sections: Array<{ title: string; content: string }>): ToolResult => {
  let result = `# ${title}\n\n`;
  
  for (const section of sections) {
    result += `## ${section.title}\n\n${section.content}\n\n`;
  }
  
  return createTextResponse(result);
};

// Helper for building file information display
export const formatFileInfo = (file: any): string => {
  let result = `### ${file.frontmatter.category}`;
  if (file.frontmatter.subcategory) {
    result += ` - ${file.frontmatter.subcategory}`;
  }
  result += `\n\n${file.content}\n\n`;
  result += `*Tags: ${file.frontmatter.tags.join(', ')}, Updated: ${file.frontmatter.updated}*\n\n---\n\n`;
  return result;
};

// Helper for building lists of available information by category
export const formatAvailableInfo = (filesByCategory: Record<string, any[]>): string => {
  let result = '# Available Personal Information\n\n';
  
  for (const [category, categoryFiles] of Object.entries(filesByCategory)) {
    result += `## ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n`;
    
    for (const file of categoryFiles) {
      result += `- **${file.frontmatter.category}`;
      if (file.frontmatter.subcategory) {
        result += ` (${file.frontmatter.subcategory})`;
      }
      result += `**\n`;
      result += `  - Tags: ${file.frontmatter.tags.join(', ') || 'none'}\n`;
      result += `  - Updated: ${file.frontmatter.updated}\n\n`;
    }
  }
  
  return result;
};

// Helper for building search results
export const formatSearchResults = (query: string, files: any[]): string => {
  let result = `# Search Results for "${query}"\n\n`;
  result += `Found ${files.length} matching item(s):\n\n`;

  for (const file of files) {
    result += formatFileInfo(file);
  }

  return result;
};

// Helper for building batch operation results
export const formatBatchResults = (
  title: string,
  results: Array<{ success: boolean; category: string; subcategory?: string; action?: string; error?: string }>
): string => {
  const successfulResults = results.filter(r => r.success);
  const failedResults = results.filter(r => !r.success);
  
  let result = `# ${title}\n\n`;
  result += `Processed ${results.length} item(s): ${successfulResults.length} successful, ${failedResults.length} failed\n\n`;

  if (successfulResults.length > 0) {
    result += '## ✅ Successfully Processed\n\n';
    for (const res of successfulResults) {
      result += `- **${res.category}`;
      if (res.subcategory) {
        result += ` (${res.subcategory})`;
      }
      result += `** - ${res.action || 'processed'}\n`;
    }
    result += '\n';
  }

  if (failedResults.length > 0) {
    result += '## ❌ Failed to Process\n\n';
    for (const res of failedResults) {
      result += `- **${res.category}`;
      if (res.subcategory) {
        result += ` (${res.subcategory})`;
      }
      result += `** - ${res.error}\n`;
    }
  }

  return result;
}; 