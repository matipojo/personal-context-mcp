import fs from 'fs-extra';
import path from 'path';
import { 
  type CustomScope, 
  type ScopeConfig,
  CustomScopeSchema,
  BUILT_IN_SCOPES 
} from '../types/schemas.js';
import { 
  isBuiltInScope,
  getScopeSensitivityLevel,
  getBuiltInScopeNames 
} from '../utils/scopeParser.js';

export class PermissionManager {
  private allowedScopes: string[];
  private customScopes: Record<string, CustomScope> = {};
  private customScopesPath: string;
  private dataDir: string;

  constructor(scopeConfig: ScopeConfig, dataDir: string) {
    this.allowedScopes = scopeConfig.allowedScopes;
    this.dataDir = dataDir;
    this.customScopesPath = path.join(dataDir, '.scopes', 'custom-scopes.json');
  }

  /**
   * Initialize the permission manager by loading custom scopes
   */
  async initialize(): Promise<void> {
    await this.loadCustomScopes();
    await this.validateAllowedScopes();
  }

  /**
   * Check if access to a file with given scope is allowed
   */
  isAccessAllowed(fileScope: string): boolean {
    return this.allowedScopes.includes(fileScope);
  }

  /**
   * Check if a scope is valid (built-in or custom)
   */
  isValidScope(scope: string): boolean {
    return isBuiltInScope(scope) || scope in this.customScopes;
  }

  /**
   * Get sensitivity level for a scope
   */
  getSensitivityLevel(scope: string): number {
    return getScopeSensitivityLevel(scope, this.customScopes);
  }

  /**
   * Get all available scopes (built-in + custom)
   */
  getAllAvailableScopes(): string[] {
    return [...getBuiltInScopeNames(), ...Object.keys(this.customScopes)];
  }

  /**
   * Get only the allowed scopes for this session
   */
  getAllowedScopes(): string[] {
    return [...this.allowedScopes];
  }

  /**
   * Get custom scopes
   */
  getCustomScopes(): Record<string, CustomScope> {
    return { ...this.customScopes };
  }

  /**
   * Load custom scopes from file
   */
  async loadCustomScopes(): Promise<void> {
    try {
      if (await fs.pathExists(this.customScopesPath)) {
        const content = await fs.readFile(this.customScopesPath, 'utf-8');
        const rawScopes = JSON.parse(content);
        
        // Validate each custom scope
        this.customScopes = {};
        for (const [name, scope] of Object.entries(rawScopes)) {
          try {
            const validatedScope = CustomScopeSchema.parse(scope);
            this.customScopes[name] = validatedScope;
          } catch (error) {
            console.warn(`Invalid custom scope '${name}':`, error);
          }
        }
        
        console.error(`Loaded ${Object.keys(this.customScopes).length} custom scopes`);
      } else {
        // Create the directory and empty file if it doesn't exist
        await fs.ensureDir(path.dirname(this.customScopesPath));
        await fs.writeFile(this.customScopesPath, '{}', 'utf-8');
        console.error('Created empty custom scopes file');
      }
    } catch (error) {
      console.warn('Failed to load custom scopes:', error);
      this.customScopes = {};
    }
  }

  /**
   * Save a new custom scope
   */
  async saveCustomScope(name: string, scope: CustomScope): Promise<void> {
    // Validate the scope name doesn't conflict with built-in scopes
    if (isBuiltInScope(name)) {
      throw new Error(`Cannot create custom scope '${name}': conflicts with built-in scope`);
    }

    // Validate the scope object
    const validatedScope = CustomScopeSchema.parse(scope);

    // Validate parent scope if specified
    if (validatedScope.parent_scope && !this.isValidScope(validatedScope.parent_scope)) {
      throw new Error(`Invalid parent scope: ${validatedScope.parent_scope}`);
    }

    // Add to memory
    this.customScopes[name] = validatedScope;

    // Save to file
    await this.saveCustomScopesToFile();

    // Create directory for the new scope
    const scopeDir = path.join(this.dataDir, name);
    await fs.ensureDir(scopeDir);

    console.error(`Created custom scope '${name}' with sensitivity level ${validatedScope.sensitivity_level}`);
  }

  /**
   * Delete a custom scope
   */
  async deleteCustomScope(name: string): Promise<void> {
    if (isBuiltInScope(name)) {
      throw new Error(`Cannot delete built-in scope '${name}'`);
    }

    if (!(name in this.customScopes)) {
      throw new Error(`Custom scope '${name}' does not exist`);
    }

    // Check if any other custom scopes depend on this one
    const dependentScopes = Object.entries(this.customScopes)
      .filter(([_, scope]) => scope.parent_scope === name)
      .map(([scopeName]) => scopeName);

    if (dependentScopes.length > 0) {
      throw new Error(`Cannot delete scope '${name}': it is referenced by: ${dependentScopes.join(', ')}`);
    }

    // Check if there are files in this scope
    const scopeDir = path.join(this.dataDir, name);
    if (await fs.pathExists(scopeDir)) {
      const files = await fs.readdir(scopeDir);
      if (files.length > 0) {
        throw new Error(`Cannot delete scope '${name}': directory contains ${files.length} files. Delete them first.`);
      }
      await fs.remove(scopeDir);
    }

    // Remove from memory
    delete this.customScopes[name];

    // Save to file
    await this.saveCustomScopesToFile();

    console.error(`Deleted custom scope '${name}'`);
  }

  /**
   * Get scope hierarchy showing parent-child relationships
   */
  getScopeHierarchy(): Record<string, { children: string[]; parent?: string; sensitivity: number }> {
    const hierarchy: Record<string, { children: string[]; parent?: string; sensitivity: number }> = {};

    // Initialize with built-in scopes
    for (const scope of BUILT_IN_SCOPES) {
      hierarchy[scope.name] = {
        children: [],
        sensitivity: scope.sensitivity_level
      };
    }

    // Add custom scopes
    for (const [name, scope] of Object.entries(this.customScopes)) {
      const hierarchyEntry: { children: string[]; parent?: string; sensitivity: number } = {
        children: [],
        sensitivity: scope.sensitivity_level
      };
      
      if (scope.parent_scope) {
        hierarchyEntry.parent = scope.parent_scope;
      }
      
      hierarchy[name] = hierarchyEntry;

      // Add to parent's children if parent exists
      if (scope.parent_scope && hierarchy[scope.parent_scope]) {
        hierarchy[scope.parent_scope]!.children.push(name);
      }
    }

    return hierarchy;
  }

  /**
   * Filter scopes based on access permissions and optional additional filter
   */
  filterScopes(scopes: string[], additionalFilter?: string): string[] {
    let filtered = scopes.filter(scope => this.isAccessAllowed(scope));

    if (additionalFilter) {
      const filterScopes = additionalFilter.split(',').map(s => s.trim());
      filtered = filtered.filter(scope => filterScopes.includes(scope));
    }

    return filtered;
  }

  /**
   * Check if the current session has access to a specific sensitivity level
   */
  hasAccessToSensitivityLevel(level: number): boolean {
    return this.allowedScopes.some(scope => {
      try {
        return this.getSensitivityLevel(scope) >= level;
      } catch {
        return false;
      }
    });
  }

  /**
   * Private method to save custom scopes to file
   */
  private async saveCustomScopesToFile(): Promise<void> {
    await fs.ensureDir(path.dirname(this.customScopesPath));
    await fs.writeFile(
      this.customScopesPath, 
      JSON.stringify(this.customScopes, null, 2), 
      'utf-8'
    );
  }

  /**
   * Validate that all allowed scopes are valid
   */
  private async validateAllowedScopes(): Promise<void> {
    const allAvailable = this.getAllAvailableScopes();
    const invalid = this.allowedScopes.filter(scope => !allAvailable.includes(scope));
    
    if (invalid.length > 0) {
      throw new Error(`Invalid allowed scopes: ${invalid.join(', ')}. Available: ${allAvailable.join(', ')}`);
    }
  }
} 