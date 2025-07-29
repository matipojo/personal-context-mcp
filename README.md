# Personal Information MCP Server

A TypeScript-based Model Context Protocol (MCP) server for managing personal information with granular scope-based permissions. This server integrates seamlessly with Claude Desktop and other MCP-compatible clients.

## Features

🔐 **Scope-Based Permissions**: Control access with granular scopes (public, contact, personal, memories, sensitive)  
📁 **File-Based Storage**: Store information in organized markdown files with YAML frontmatter  
🛠️ **Custom Scopes**: Create custom scopes for specialized information categories  
🔍 **Advanced Search**: Search through memories and experiences with tag and date filtering  
⚡ **Real-time Operations**: Get, save, update, and delete personal information instantly  
🔒 **OTP Authentication**: Secure access with One-Time Password authentication and data encryption  
🏗️ **Extensible Architecture**: Built with TypeScript for reliability and maintainability

## Quick Start

### Prerequisites

- Node.js 18 or later
- npm or yarn
- Claude Desktop (optional, for testing)

### Installation

1. **Clone or download this repository**
   ```bash
   git clone <repository-url>
   cd personal-mcp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Test the server**
   ```bash
   npm start -- --scope=public,contact
   ```

## Configuration

### Environment Variables

Create a `.env` file (optional) to customize the server:

```bash
# Data directory (default: ./data)
PERSONAL_INFO_DATA_DIR=./data

# Default scope when none specified (default: public)
PERSONAL_INFO_DEFAULT_SCOPE=public

# Maximum file size in bytes (default: 1MB)
PERSONAL_INFO_MAX_FILE_SIZE=1048576

# Enable/disable backups (default: true)
PERSONAL_INFO_BACKUP_ENABLED=true
PERSONAL_INFO_BACKUP_DIR=./backups

# Optional encryption (implemented with OTP authentication)
PERSONAL_INFO_ENCRYPTION_ENABLED=false
PERSONAL_INFO_ENCRYPTION_KEY=
```

### Scope Configuration

Start the server with specific scope permissions:

```bash
# Public information only
npm start -- --scope=public

# Public and contact information
npm start -- --scope=public,contact

# Multiple specific scopes
npm start -- --scope=public,contact,personal,memories

# All scopes (including custom ones)
npm start -- --scope=all
```

## Claude Desktop Integration

Add this configuration to your Claude Desktop config file:

**Location:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

**Configuration:**
```json
{
  "mcpServers": {
    "personal-info": {
      "command": "node",
      "args": ["/absolute/path/to/personal-mcp/dist/index.js", "--scope=public,contact"],
      "env": {
        "PERSONAL_INFO_DATA_DIR": "./data"
      }
    },
    "personal-info-full": {
      "command": "node", 
      "args": ["/absolute/path/to/personal-mcp/dist/index.js", "--scope=all"],
      "env": {
        "PERSONAL_INFO_DATA_DIR": "./data"
      }
    }
  }
}
```

## Available Tools

### Core Tools

1. **`batch_get_personal_info`** - Retrieve multiple categories of information
   ```
   Parameters: requests (array of category/subcategory objects), has_list_available_personal_info (optional)
   Example: Get multiple types of information in a single request
   ```

2. **`batch_save_personal_info`** - Save multiple pieces of information
   ```
   Parameters: items (array of category, content, scope, subcategory, tags)
   Example: Save multiple types of information efficiently
   ```

3. **`list_available_personal_info`** - List all accessible information
   ```
   Parameters: scope_filter (optional)
   Example: See what information is available in your scopes
   ```

4. **`update_personal_info`** - Update existing information
   ```
   Parameters: category (required), content, scope, subcategory, tags (optional)
   Example: Update existing contact info or preferences
   ```

5. **`delete_personal_info`** - Delete specific information
   ```
   Parameters: category (required), subcategory (optional)
   Example: Remove outdated contact information
   ```

6. **`search_personal_memories`** - Search through memories and experiences
   ```
   Parameters: query (required), tags, date_range (optional)
   Example: Find memories from a specific trip or time period
   ```

### Scope Management Tools

7. **`create_personal_scope`** - Create custom scopes
   ```
   Parameters: scope_name, description (required), parent_scope, sensitivity_level (optional)
   Example: Create a "work" scope for professional information
   ```

8. **`list_personal_scopes`** - List all available scopes
   ```
   Parameters: include_custom_only, show_hierarchy (optional)
   Example: See all built-in and custom scopes with details
   ```

### OTP Authentication Tools

9. **`otp_status`** - Check OTP configuration and session status
   ```
   Parameters: random_string (dummy parameter)
   Example: Verify if OTP is enabled and if session is active
   ```

10. **`setup_otp`** - Set up One-Time Password authentication
    ```
    Parameters: issuer, label, digits, period, qrSize (all optional)
    Example: Enable OTP protection for personal data
    ```

11. **`verify_otp`** - Verify an OTP token for access
    ```
    Parameters: token (required), useBackupCode, userId (optional)
    Example: Verify OTP token to access encrypted data
    ```

12. **`disable_otp`** - Disable OTP authentication
    ```
    Parameters: random_string (dummy parameter)
    Example: Remove OTP protection from personal data
    ```

13. **`regenerate_backup_codes`** - Generate new backup codes
    ```
    Parameters: random_string (dummy parameter)
    Example: Create new emergency backup codes
    ```

14. **`otp_debug`** - Debug OTP issues
    ```
    Parameters: random_string (dummy parameter)
    Example: Troubleshoot OTP verification problems
    ```

## Usage Examples

### Basic Information Management

**Save your phone number:**
```
User: "Save my phone number +1-555-123-4567 as my personal mobile"
Assistant: Uses batch_save_personal_info(items: [{category: "phone", subcategory: "personal-mobile", content: "+1-555-123-4567", scope: "contact"}])
```

**Get contact information:**
```
User: "What's my phone number?"
Assistant: Uses batch_get_personal_info(requests: [{category: "phone"}]) → Returns all phone numbers in accessible scopes
```

**Save a memory:**
```
User: "Save that I went to Japan in March 2024 and loved the cherry blossoms in Kyoto"
Assistant: Uses batch_save_personal_info(items: [{category: "trip", subcategory: "japan-2024", content: "...", scope: "memories", tags: ["travel", "japan", "spring"]}])
```

### Advanced Features

**Create a custom scope:**
```
User: "Create a scope called 'work' for my professional information"
Assistant: Uses create_personal_scope(scope_name: "work", description: "Professional information and work-related data")
```

**Search memories:**
```
User: "Find all my travel memories from 2024"
Assistant: Uses search_personal_memories(query: "travel", tags: ["travel"], date_range: {start: "2024-01-01", end: "2024-12-31"})
```

## File Structure

The server organizes data in a hierarchical structure:

```
data/
├── .scopes/
│   └── custom-scopes.json         # Custom scope definitions
├── public/                        # Public information
│   ├── name.md
│   └── bio.md
├── contact/                       # Contact information
│   ├── phone-personal-mobile.md
│   └── email-personal.md
├── personal/                      # Personal details
│   ├── hobbies.md
│   └── preferences.md
├── memories/                      # Memories and experiences
│   └── trip-japan-2024.md
├── sensitive/                     # Sensitive information
│   └── health-allergies.md
└── work/                          # Custom scope example
    └── current-project.md
```

### File Format

Each file uses YAML frontmatter with markdown content:

```markdown
---
scope: contact
category: phone
subcategory: personal-mobile
created: 2024-01-15T10:30:00Z
updated: 2024-01-15T10:30:00Z
tags: [contact, mobile, primary]
---

# Phone - Personal Mobile

+1 (555) 123-4567

## Notes
- Primary contact number
- Available 9 AM - 10 PM PST
- Supports text messages
```

## Built-in Scopes

| Scope | Sensitivity Level | Description | Example Data |
|-------|-------------------|-------------|--------------|
| **public** | 1 | Publicly shareable information | Name, avatar, bio |
| **contact** | 3 | Contact information | Email, phone, address, social media |
| **personal** | 6 | Personal details | Age, hobbies, preferences |
| **memories** | 7 | Personal memories and experiences | Trips, events, relationships |
| **sensitive** | 9 | Sensitive information | Health data, financial info |

## Development

### Project Structure

```
src/
├── index.ts                       # Main server entry point
├── types/
│   └── schemas.ts                 # Zod validation schemas
├── utils/
│   └── scopeParser.ts            # Command-line parsing utilities
├── core/
│   ├── Context.ts                # Server context and types
│   ├── Response.ts               # Response utilities
│   └── Validation.ts             # Validation utilities
├── managers/
│   ├── PermissionManager.ts      # Scope-based access control
│   ├── FileManager.ts            # File operations and management
│   ├── EncryptionManager.ts      # Data encryption with AES
│   └── OTPManager.ts             # OTP authentication management
├── server/
│   ├── McpServerFactory.ts       # Server configuration and setup
│   └── ToolRegistry.ts           # Tool registration system
└── tools/                        # Individual tool implementations
    ├── personalInfo/              # Personal information tools
    ├── memories/                  # Memory search tools
    ├── scopes/                    # Scope management tools
    └── otp/                       # OTP authentication tools
```

### Available Scripts

```bash
# Build and Development
npm run build        # Build TypeScript to dist/
npm run dev          # Watch mode compilation
npm start           # Start the server
npm run clean       # Clean build artifacts
npm run rebuild     # Clean and rebuild

# Testing and Debugging
npm run inspect      # Launch MCP Inspector with default scopes and ./data directory (includes OTP encryption)
npm test            # Run tests (implemented with Jest)
npm run test:watch  # Run tests in watch mode
npm run type-check  # Type checking only
```

#### MCP Inspector Commands

The `inspect` command launches the MCP Inspector tool for interactive testing:

- **`npm run inspect`**: Default command with standard scopes (`public,contact,personal,memories`) and OTP encryption enabled

The inspect command automatically:
- Builds the project first
- Uses `--data-dir ./data` command line argument
- Enables OTP encryption for testing encrypted data features
- Opens a web interface for testing MCP tools

**Command Line Arguments**: The server now supports `--data-dir` to specify data directory location:
```bash
# Absolute path
node dist/index.js --scope public,contact --data-dir /path/to/data

# Relative path (resolved from current working directory)
node dist/index.js --scope public,contact --data-dir ./data
node dist/index.js --scope public,contact --data-dir ../shared-data

# Space-separated format also supported
node dist/index.js --scope public,contact --data-dir /path/to/data
```

**Path Resolution**: 
- Relative paths (starting with `./` or `../`) are resolved relative to the current working directory
- Absolute paths are used as-is
- The server logs the resolved path during startup for debugging

After running any inspect command, open the provided URL in your browser to test the server interactively.

### Building from Source

```bash
# Development setup
git clone <repository-url>
cd personal-mcp
npm install
npm run build

# Run with debugging
npm run dev         # In one terminal (watch mode)
npm start -- --scope=all  # In another terminal
```

## Security Considerations

🔒 **Scope Isolation**: Each scope operates independently with no data leakage  
🛡️ **Input Validation**: All input is validated using Zod schemas  
📁 **Path Security**: File operations are contained within the data directory  
💾 **Atomic Operations**: File writes are atomic to prevent corruption  
🔍 **Access Logging**: All operations respect scope permissions  
🔐 **Data Encryption**: AES encryption for sensitive data with OTP authentication  
🔑 **OTP Protection**: Time-based one-time passwords with backup codes  
⏰ **Session Management**: Temporary sessions with automatic expiration

## Troubleshooting

### Common Issues

**"Invalid scope" errors:**
- Check that custom scopes are properly created with `create_personal_scope`
- Verify scope names match exactly (case-sensitive)
- Ensure scope is included in startup arguments

**File not found errors:**
- Check data directory permissions
- Verify file paths don't contain invalid characters
- Ensure directory structure exists

**Permission denied:**
- Verify the requested scope is in your allowed scopes
- Check that the scope exists (built-in or custom)
- Restart server after creating new custom scopes

**Build errors:**
- Ensure Node.js 18+ is installed
- Delete `node_modules` and run `npm install` again
- Check for TypeScript compilation errors with `npm run type-check`

### Debug Mode

Run with additional logging:
```bash
DEBUG=* npm start -- --scope=all
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests (if applicable)
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Roadmap

- 📊 Data analytics and insights
- 🔄 Data synchronization options
- 📱 Web interface
- 📈 Performance optimizations
- 🔌 Plugin system for custom tools 