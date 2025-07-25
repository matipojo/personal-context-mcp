# Personal Information MCP Server

A TypeScript-based Model Context Protocol (MCP) server for managing personal information with granular scope-based permissions. This server integrates seamlessly with Claude Desktop and other MCP-compatible clients.

## Features

🔐 **Scope-Based Permissions**: Control access with granular scopes (public, contact, location, personal, memories, sensitive)  
📁 **File-Based Storage**: Store information in organized markdown files with YAML frontmatter  
🛠️ **Custom Scopes**: Create custom scopes for specialized information categories  
🔍 **Advanced Search**: Search through memories and experiences with tag and date filtering  
⚡ **Real-time Operations**: Get, save, update, and delete personal information instantly  
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

# Optional encryption (not implemented yet)
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

1. **`get_personal_info`** - Retrieve information by category
   ```
   Parameters: category (required), subcategory (optional)
   Example: Get phone numbers, addresses, hobbies
   ```

2. **`save_personal_info`** - Save or update information
   ```
   Parameters: category, content, scope (required), subcategory, tags (optional)
   Example: Save contact info, memories, preferences
   ```

3. **`list_available_personal_info`** - List all accessible information
   ```
   Parameters: scope_filter (optional)
   Example: See what information is available in your scopes
   ```

4. **`delete_personal_info`** - Delete specific information
   ```
   Parameters: category (required), subcategory (optional)
   Example: Remove outdated contact information
   ```

5. **`search_personal_memories`** - Search through memories and experiences
   ```
   Parameters: query (required), tags, date_range (optional)
   Example: Find memories from a specific trip or time period
   ```

### Scope Management Tools

6. **`create_personal_scope`** - Create custom scopes
   ```
   Parameters: scope_name, description (required), parent_scope, sensitivity_level (optional)
   Example: Create a "work" scope for professional information
   ```

7. **`list_personal_scopes`** - List all available scopes
   ```
   Parameters: include_custom_only, show_hierarchy (optional)
   Example: See all built-in and custom scopes with details
   ```

## Usage Examples

### Basic Information Management

**Save your phone number:**
```
User: "Save my phone number +1-555-123-4567 as my personal mobile"
Assistant: Uses save_personal_info(category: "phone", subcategory: "personal-mobile", content: "+1-555-123-4567", scope: "contact")
```

**Get contact information:**
```
User: "What's my phone number?"
Assistant: Uses get_personal_info(category: "phone") → Returns all phone numbers in accessible scopes
```

**Save a memory:**
```
User: "Save that I went to Japan in March 2024 and loved the cherry blossoms in Kyoto"
Assistant: Uses save_personal_info(category: "trip", subcategory: "japan-2024", content: "...", scope: "memories", tags: ["travel", "japan", "spring"])
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
├── location/                      # Location data
│   └── address-home.md
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
| **contact** | 3 | Contact information | Email, phone, social media |
| **location** | 5 | Location-based data | Address, current location |
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
├── managers/
│   ├── PermissionManager.ts      # Scope-based access control
│   └── FileManager.ts            # File operations and management
└── tools/                        # (Future: Individual tool classes)
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
npm run inspect      # Launch MCP Inspector with default scopes and ./data directory
npm run inspect:all  # Launch MCP Inspector with all scopes
npm run inspect:public # Launch MCP Inspector with public scope only
npm run inspect:simple # Launch MCP Inspector without specifying data directory (uses default)
npm run inspect:debug # Launch MCP Inspector with verbose logging
npm test            # Run tests (when implemented)
npm run type-check  # Type checking only
```

#### MCP Inspector Commands

The `inspect` commands launch the MCP Inspector tool for interactive testing:

- **`npm run inspect`**: Default command with standard scopes (`public,contact,location,personal,memories`)
- **`npm run inspect:all`**: Includes all built-in and custom scopes  
- **`npm run inspect:public`**: Only public scope for minimal testing
- **`npm run inspect:simple`**: Basic version without specifying data directory (uses server default `./data`)
- **`npm run inspect:debug`**: Adds verbose logging for troubleshooting

All inspect commands automatically:
- Build the project first
- Use `--data-dir ./data` command line argument (except for `:simple`)
- Open a web interface for testing MCP tools

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

- 🔐 File encryption support
- 📊 Data analytics and insights
- 🔄 Data synchronization options
- 📱 Web interface
- 🧪 Comprehensive test suite
- 📈 Performance optimizations
- 🔌 Plugin system for custom tools 