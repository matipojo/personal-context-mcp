import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';
import * as yaml from 'yaml';
import { 
  type PersonalInfoFile, 
  PersonalInfoFileSchema 
} from '../types/schemas.js';
import { EncryptionManager, type DecryptionOptions } from './EncryptionManager.js';

export class FileManager {
  private dataDir: string;
  private maxFileSize: number;
  private encryptionManager: EncryptionManager;

  constructor(dataDir: string, maxFileSize: number = 1048576, encryptionManager?: EncryptionManager) { // 1MB default
    this.dataDir = dataDir;
    this.maxFileSize = maxFileSize;
    this.encryptionManager = encryptionManager || new EncryptionManager();
  }

  /**
   * Initialize the file manager by ensuring data directory exists
   */
  async initialize(): Promise<void> {
    await fs.ensureDir(this.dataDir);
    
    // Ensure scope directories exist for built-in scopes
    const builtInScopes = ['public', 'contact', 'personal', 'memories', 'sensitive'];
    for (const scope of builtInScopes) {
      await fs.ensureDir(path.join(this.dataDir, scope));
    }

    console.error(`File manager initialized with data directory: ${this.dataDir}`);
  }

  /**
   * Read a markdown file with YAML frontmatter
   */
  async readMarkdownFile(filePath: string, decryptionOptions?: DecryptionOptions): Promise<PersonalInfoFile> {
    try {
      // Check file exists
      if (!(await fs.pathExists(filePath))) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Check file size
      const stats = await fs.stat(filePath);
      if (stats.size > this.maxFileSize) {
        throw new Error(`File too large: ${filePath} (${stats.size} bytes, max: ${this.maxFileSize})`);
      }

      let content = await fs.readFile(filePath, 'utf-8');
      
      // Decrypt content if encryption is enabled and decryption options are provided
      if (this.encryptionManager.isEnabled() && decryptionOptions) {
        content = await this.encryptionManager.decryptFileContent(content, decryptionOptions);
      }
      
      const { frontmatter, body } = this.parseFrontmatter(content);

      const file: PersonalInfoFile = {
        frontmatter,
        content: body,
        filePath: path.relative(this.dataDir, filePath)
      };

      // Validate the file structure
      return PersonalInfoFileSchema.parse(file);
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Write a markdown file with YAML frontmatter
   */
  async writeMarkdownFile(filePath: string, data: PersonalInfoFile, encryptionOptions?: DecryptionOptions): Promise<void> {
    try {
      // Validate input data
      const validatedData = PersonalInfoFileSchema.parse(data);

      // Ensure directory exists
      await fs.ensureDir(path.dirname(filePath));

      // Create file content with frontmatter
      let content = this.createFileContent(validatedData.frontmatter, validatedData.content);
      
      // Encrypt content if encryption is enabled and encryption options are provided
      if (this.encryptionManager.isEnabled() && encryptionOptions) {
        content = await this.encryptionManager.encryptFileContent(content, encryptionOptions);
      }

      // Check content size
      if (Buffer.byteLength(content, 'utf-8') > this.maxFileSize) {
        throw new Error(`Content too large (${Buffer.byteLength(content, 'utf-8')} bytes, max: ${this.maxFileSize})`);
      }

      // Atomic write: write to temp file then rename
      const tempPath = `${filePath}.tmp`;
      await fs.writeFile(tempPath, content, 'utf-8');
      await fs.move(tempPath, filePath);

      console.error(`Written file: ${path.relative(this.dataDir, filePath)}`);
    } catch (error) {
      throw new Error(`Failed to write file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * List all files within allowed scopes
   */
  async listFiles(allowedScopes: string[], decryptionOptions?: DecryptionOptions): Promise<PersonalInfoFile[]> {
    const files: PersonalInfoFile[] = [];

    for (const scope of allowedScopes) {
      const scopeDir = path.join(this.dataDir, scope);
      
      if (await fs.pathExists(scopeDir)) {
        try {
          // Normalize path for glob pattern (use forward slashes for cross-platform compatibility)
          const pattern = path.join(scopeDir, '*.md').replace(/\\/g, '/');
          const filePaths = await glob(pattern);

          for (const filePath of filePaths) {
            try {
              const file = await this.readMarkdownFile(filePath, decryptionOptions);
              files.push(file);
            } catch (error) {
              console.warn(`Skipping invalid file ${filePath}:`, error);
            }
          }
        } catch (error) {
          console.warn(`Failed to list files in scope ${scope}:`, error);
        }
      }
    }

    return files;
  }

  /**
   * Delete a file
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
        console.error(`Deleted file: ${path.relative(this.dataDir, filePath)}`);

        // Clean up empty directory if it's a scope directory
        const dir = path.dirname(filePath);
        if (await this.isEmptyDirectory(dir)) {
          const scopeName = path.basename(dir);
          // Only remove if it's not a built-in scope directory
          const builtInScopes = ['public', 'contact', 'personal', 'memories', 'sensitive'];
          if (!builtInScopes.includes(scopeName)) {
            await fs.remove(dir);
            console.error(`Removed empty scope directory: ${scopeName}`);
          }
        }
      }
    } catch (error) {
      throw new Error(`Failed to delete file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if a file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    return fs.pathExists(filePath);
  }

  /**
   * Ensure directory exists for a scope
   */
  async ensureDirectoryExists(dirPath: string): Promise<void> {
    await fs.ensureDir(dirPath);
  }

  /**
   * Get file path for a category and subcategory
   */
  getFilePath(scope: string, category: string, subcategory?: string): string {
    const filename = subcategory 
      ? `${category}-${subcategory}.md`
      : `${category}.md`;
    
    return path.join(this.dataDir, scope, filename);
  }

  /**
   * Get time-based file path for a category and subcategory with timestamp
   */
  getTimeBasedFilePath(scope: string, category: string, subcategory?: string, timestamp?: string): string {
    const timeStr = timestamp || new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19); // YYYY-MM-DDTHH-mm-ss format
    const filename = subcategory 
      ? `${category}-${subcategory}-${timeStr}.md`
      : `${category}-${timeStr}.md`;
    
    return path.join(this.dataDir, scope, filename);
  }

  /**
   * Find files by category and optionally subcategory
   */
  async findFilesByCategory(
    allowedScopes: string[], 
    category: string, 
    subcategory?: string,
    decryptionOptions?: DecryptionOptions
  ): Promise<PersonalInfoFile[]> {
    const allFiles = await this.listFiles(allowedScopes, decryptionOptions);
    
    return allFiles.filter(file => {
      const matchesCategory = file.frontmatter.category === category;
      const matchesSubcategory = !subcategory || file.frontmatter.subcategory === subcategory;
      return matchesCategory && matchesSubcategory;
    });
  }

  /**
   * Search files by content and metadata
   */
  async searchFiles(
    allowedScopes: string[], 
    query: string, 
    tags?: string[],
    dateRange?: { start: string; end: string },
    decryptionOptions?: DecryptionOptions
  ): Promise<PersonalInfoFile[]> {
    const allFiles = await this.listFiles(allowedScopes, decryptionOptions);
    const queryLower = query.toLowerCase();

    return allFiles.filter(file => {
      // Text search in content and category
      const contentMatch = 
        file.content.toLowerCase().includes(queryLower) ||
        file.frontmatter.category.toLowerCase().includes(queryLower) ||
        (file.frontmatter.subcategory?.toLowerCase().includes(queryLower) ?? false);

      // Tag filter
      const tagMatch = !tags || tags.every(tag => file.frontmatter.tags.includes(tag));

      // Date range filter
      let dateMatch = true;
      if (dateRange) {
        const fileDate = new Date(file.frontmatter.created);
        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        dateMatch = fileDate >= startDate && fileDate <= endDate;
      }

      return contentMatch && tagMatch && dateMatch;
    });
  }

  /**
   * Get file metadata without reading full content
   */
  async getFileMetadata(filePath: string, decryptionOptions?: DecryptionOptions): Promise<PersonalInfoFile['frontmatter'] | null> {
    try {
      if (!(await fs.pathExists(filePath))) {
        return null;
      }

      let content = await fs.readFile(filePath, 'utf-8');
      
      // Decrypt content if encryption is enabled and decryption options are provided
      if (this.encryptionManager.isEnabled() && decryptionOptions) {
        content = await this.encryptionManager.decryptFileContent(content, decryptionOptions);
      }
      
      const { frontmatter } = this.parseFrontmatter(content);
      return frontmatter;
    } catch (error) {
      console.warn(`Failed to read metadata from ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Create a backup of a file before modifying it
   */
  async createBackup(filePath: string, backupDir: string): Promise<string | null> {
    try {
      if (!(await fs.pathExists(filePath))) {
        return null;
      }

      await fs.ensureDir(backupDir);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `${path.basename(filePath)}.${timestamp}.backup`);
      
      await fs.copy(filePath, backupPath);
      return backupPath;
    } catch (error) {
      console.warn(`Failed to create backup for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Enable encryption with the provided configuration
   */
  enableEncryption(config?: Partial<EncryptionManager['config']>): void {
    if (config) {
      this.encryptionManager.updateConfig(config);
    }
    this.encryptionManager.enableEncryption();
  }

  /**
   * Disable encryption
   */
  disableEncryption(): void {
    this.encryptionManager.disableEncryption();
  }

  /**
   * Check if a file is encrypted
   */
  async isFileEncrypted(filePath: string): Promise<boolean> {
    try {
      if (!(await fs.pathExists(filePath))) {
        return false;
      }
      
      const content = await fs.readFile(filePath, 'utf-8');
      return this.encryptionManager.isContentEncrypted(content);
    } catch {
      return false;
    }
  }

  /**
   * Get encryption manager instance
   */
  getEncryptionManager(): EncryptionManager {
    return this.encryptionManager;
  }

  /**
   * Validate file path to prevent directory traversal
   */
  validateFilePath(filePath: string): boolean {
    const resolvedPath = path.resolve(filePath);
    const resolvedDataDir = path.resolve(this.dataDir);
    return resolvedPath.startsWith(resolvedDataDir);
  }

  /**
   * Parse frontmatter from markdown content
   */
  private parseFrontmatter(content: string): { frontmatter: PersonalInfoFile['frontmatter']; body: string } {
    const lines = content.split('\n').map(line => line.replace(/\r$/, '')); // Remove trailing \r from Windows line endings
    
    if (lines[0] !== '---') {
      throw new Error('Invalid file format: missing frontmatter delimiter');
    }

    const endIndex = lines.findIndex((line, index) => index > 0 && line === '---');
    if (endIndex === -1) {
      throw new Error('Invalid file format: unclosed frontmatter');
    }

    const frontmatterLines = lines.slice(1, endIndex);
    const bodyLines = lines.slice(endIndex + 1);

    try {
      const frontmatter = yaml.parse(frontmatterLines.join('\n'));
      
      // Ensure required fields exist and have defaults
      const processedFrontmatter = {
        scope: frontmatter.scope || 'public',
        category: frontmatter.category || 'unknown',
        subcategory: frontmatter.subcategory,
        created: frontmatter.created || new Date().toISOString(),
        updated: frontmatter.updated || new Date().toISOString(),
        tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : []
      };

      return {
        frontmatter: processedFrontmatter,
        body: bodyLines.join('\n').trim()
      };
    } catch (error) {
      throw new Error(`Invalid YAML frontmatter: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create file content with frontmatter
   */
  private createFileContent(frontmatter: PersonalInfoFile['frontmatter'], content: string): string {
    const yamlContent = yaml.stringify(frontmatter);
    return `---\n${yamlContent}---\n\n${content}\n`;
  }

  /**
   * Check if directory is empty
   */
  private async isEmptyDirectory(dirPath: string): Promise<boolean> {
    try {
      if (!(await fs.pathExists(dirPath))) {
        return true;
      }

      const files = await fs.readdir(dirPath);
      return files.length === 0;
    } catch {
      return false;
    }
  }
} 