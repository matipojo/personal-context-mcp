#!/usr/bin/env node

import { createServerInstance } from './server/McpServerFactory.js';

// Main function using functional composition
async function main(): Promise<void> {
  try {
    // Create server instance with functional approach
    const serverInstance = await createServerInstance(process.argv);
    
    // Start the server
    await serverInstance.start();
    
    // Note: OTP session management would be handled by updating the context
    // when OTP verification succeeds. This can be done by:
    // 1. Modifying the verifyOTP handler to return session info
    // 2. Having a session management layer that updates the context
    // 3. Using the updateOTPSession method on serverInstance
    
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