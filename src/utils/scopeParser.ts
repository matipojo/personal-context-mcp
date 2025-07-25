import { BUILT_IN_SCOPES, type ScopeConfig, type CustomScope } from '../types/schemas.js';

/**
 * Parse command-line arguments to extract data directory
 */
export function parseDataDirectory(args: string[]): string | undefined {
  // Look for --data-dir=value format first
  let dataDirArgIndex = args.findIndex(arg => arg.startsWith('--data-dir='));
  
  if (dataDirArgIndex !== -1) {
    // Handle --data-dir=value format
    const dataDirArg = args[dataDirArgIndex];
    if (!dataDirArg) {
      return undefined;
    }
    return dataDirArg.split('=')[1];
  } else {
    // Look for --data-dir value format (space-separated)
    dataDirArgIndex = args.findIndex(arg => arg === '--data-dir');
    if (dataDirArgIndex !== -1 && dataDirArgIndex < args.length - 1) {
      return args[dataDirArgIndex + 1];
    }
  }
  
  return undefined;
}

/**
 * Parse command-line arguments to extract scope configuration
 */
export function parseScopeArguments(args: string[]): ScopeConfig {
  // Look for --scope=value format first
  let scopeArgIndex = args.findIndex(arg => arg.startsWith('--scope='));
  let scopeValue: string | undefined;
  
  if (scopeArgIndex !== -1) {
    // Handle --scope=value format
    const scopeArg = args[scopeArgIndex];
    if (!scopeArg) {
      throw new Error('Scope argument not found');
    }
    scopeValue = scopeArg.split('=')[1];
  } else {
    // Look for --scope value format (space-separated)
    scopeArgIndex = args.findIndex(arg => arg === '--scope');
    if (scopeArgIndex !== -1 && scopeArgIndex < args.length - 1) {
      scopeValue = args[scopeArgIndex + 1];
    }
  }
  
  if (scopeArgIndex === -1 || !scopeValue) {
    // No scope argument provided, use default
    return {
      allowedScopes: ['public'],
      defaultScope: 'public'
    };
  }
  
  if (!scopeValue) {
    throw new Error('Invalid scope argument format. Use --scope=public,contact or --scope public,contact');
  }

  let allowedScopes: string[];

  if (scopeValue === 'all') {
    // Expand 'all' to include all built-in scopes
    // Note: Custom scopes will be added later during initialization
    allowedScopes = BUILT_IN_SCOPES.map(scope => scope.name);
  } else {
    // Parse comma-separated scope list
    allowedScopes = scopeValue.split(',').map(scope => scope.trim()).filter(scope => scope.length > 0);
  }

  if (allowedScopes.length === 0) {
    throw new Error('At least one scope must be specified');
  }

  return {
    allowedScopes,
    defaultScope: allowedScopes[0]! // Use first scope as default
  };
}

/**
 * Expand 'all' scope to include all available scopes (built-in + custom)
 */
export function expandAllScope(customScopes: Record<string, CustomScope>): string[] {
  const builtInScopeNames = BUILT_IN_SCOPES.map(scope => scope.name);
  const customScopeNames = Object.keys(customScopes);
  
  return [...builtInScopeNames, ...customScopeNames];
}

/**
 * Validate that provided scopes exist in available scopes
 */
export function validateScopes(scopes: string[], availableScopes: string[]): { valid: boolean; invalidScopes: string[] } {
  const invalidScopes = scopes.filter(scope => !availableScopes.includes(scope));
  
  return {
    valid: invalidScopes.length === 0,
    invalidScopes
  };
}

/**
 * Get all built-in scope names
 */
export function getBuiltInScopeNames(): string[] {
  return BUILT_IN_SCOPES.map(scope => scope.name);
}

/**
 * Check if a scope is a built-in scope
 */
export function isBuiltInScope(scopeName: string): boolean {
  return BUILT_IN_SCOPES.some(scope => scope.name === scopeName);
}

/**
 * Get sensitivity level for a scope (built-in or custom)
 */
export function getScopeSensitivityLevel(scopeName: string, customScopes: Record<string, CustomScope>): number {
  // Check built-in scopes first
  const builtInScope = BUILT_IN_SCOPES.find(scope => scope.name === scopeName);
  if (builtInScope) {
    return builtInScope.sensitivity_level;
  }

  // Check custom scopes
  const customScope = customScopes[scopeName];
  if (customScope) {
    return customScope.sensitivity_level;
  }

  // Unknown scope
  throw new Error(`Unknown scope: ${scopeName}`);
}

/**
 * Sort scopes by sensitivity level (lowest to highest)
 */
export function sortScopesBySensitivity(scopes: string[], customScopes: Record<string, CustomScope>): string[] {
  return scopes.sort((a, b) => {
    const sensitivityA = getScopeSensitivityLevel(a, customScopes);
    const sensitivityB = getScopeSensitivityLevel(b, customScopes);
    return sensitivityA - sensitivityB;
  });
}

/**
 * Resolve scope configuration by expanding 'all' and validating scopes
 */
export function resolveScopeConfig(
  args: string[], 
  customScopes: Record<string, CustomScope>
): ScopeConfig {
  const initialConfig = parseScopeArguments(args);
  
  // Check if the original argument was 'all' and expand it to include custom scopes
  let scopeValue: string | undefined;
  
  // Look for --scope=value format first
  let scopeArgIndex = args.findIndex(arg => arg.startsWith('--scope='));
  if (scopeArgIndex !== -1) {
    const scopeArg = args[scopeArgIndex];
    if (scopeArg) {
      scopeValue = scopeArg.split('=')[1];
    }
  } else {
    // Look for --scope value format (space-separated)
    scopeArgIndex = args.findIndex(arg => arg === '--scope');
    if (scopeArgIndex !== -1 && scopeArgIndex < args.length - 1) {
      scopeValue = args[scopeArgIndex + 1];
    }
  }
  
  if (scopeValue === 'all') {
    initialConfig.allowedScopes = expandAllScope(customScopes);
  }

  // Validate all scopes
  const allAvailableScopes = [...getBuiltInScopeNames(), ...Object.keys(customScopes)];
  const validation = validateScopes(initialConfig.allowedScopes, allAvailableScopes);
  
  if (!validation.valid) {
    throw new Error(`Invalid scopes: ${validation.invalidScopes.join(', ')}. Available scopes: ${allAvailableScopes.join(', ')}`);
  }

  return initialConfig;
}

/**
 * Parse environment variable for default scope
 */
export function parseDefaultScope(envValue?: string): string {
  if (!envValue) {
    return 'public';
  }

  // Validate that the default scope is a valid built-in scope
  if (!isBuiltInScope(envValue)) {
    console.warn(`Invalid default scope in environment: ${envValue}. Using 'public' instead.`);
    return 'public';
  }

  return envValue;
} 