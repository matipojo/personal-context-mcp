import { ServerContext } from './Context.js';

// Validation utilities for functional approach
export const validateScopeAccess = (scope: string, context: ServerContext): void => {
  if (!context.permissionManager.isAccessAllowed(scope)) {
    throw new Error(`Access denied: scope '${scope}' is not allowed`);
  }
};

export const validateScopeExists = (scope: string, context: ServerContext): void => {
  if (!context.permissionManager.isValidScope(scope)) {
    throw new Error(`Invalid scope: '${scope}'`);
  }
};

export const validateOTPEnabled = (context: ServerContext): void => {
  if (!context.otpManager.isEnabled()) {
    throw new Error('❌ OTP is not enabled. Use the `setup_otp` tool first.');
  }
};

export const validateOTPSession = (context: ServerContext): void => {
  if (!context.currentOTPSession || Date.now() > context.currentOTPSession.expires) {
    throw new Error('🔒 OTP verification required. Please use verify_otp tool first to access encrypted data.');
  }
};

export const validateHasListedInfo = (hasListed: boolean): void => {
  if (!hasListed) {
    throw new Error('You must list once all the categories with the list_available_personal_info tool before using this tool');
  }
};

// Utility function to validate and prepare scope for operations
export const validateAndPrepareScope = (scope: string, context: ServerContext): void => {
  validateScopeAccess(scope, context);
  validateScopeExists(scope, context);
};

// Utility function to validate multiple scopes
export const validateScopes = (scopes: string[], context: ServerContext): void => {
  for (const scope of scopes) {
    validateAndPrepareScope(scope, context);
  }
};

// Utility to check if file operation is allowed
export const validateFileOperation = (scope: string, operation: 'read' | 'write' | 'delete', context: ServerContext): void => {
  validateAndPrepareScope(scope, context);
  
  // Additional checks could be added here for specific operations
  // For example, checking if delete operations are allowed in certain scopes
};

// Utility to validate batch operation inputs
export const validateBatchOperation = <T extends { scope: string }>(items: T[], context: ServerContext): void => {
  if (items.length === 0) {
    throw new Error('Batch operation requires at least one item');
  }
  
  const uniqueScopes = [...new Set(items.map(item => item.scope))];
  validateScopes(uniqueScopes, context);
};

// Safe parsing function that throws descriptive errors
export const safeParse = <T>(schema: any, args: unknown, toolName: string): T => {
  try {
    return schema.parse(args);
  } catch (error) {
    throw new Error(`Invalid arguments for ${toolName}: ${error instanceof Error ? error.message : String(error)}`);
  }
}; 