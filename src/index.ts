#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServerInstance } from './server/McpServerFactory.js';

// Main function using functional composition
async function main(): Promise<void> {
  try {
    console.error('🔧 Initializing Personal Information MCP Server...');
    
    // Create server instance with functional approach
    const { server, updateOTPSession } = await createServerInstance(process.argv);
    
    // Connect to stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.error('🚀 Personal Information MCP Server is running');
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
const handleShutdown = (signal: string) => {
  console.error(`\n⏹️  Received ${signal}, shutting down Personal Information MCP Server...`);
  process.exit(0);
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

// Run the server
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}); 