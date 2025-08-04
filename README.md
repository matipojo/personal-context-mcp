# Personal MCP Server

A Model Context Protocol (MCP) server for managing personal information with dynamic topic-based organization, OTP authentication, and encryption support.

## Features

- **Topic-Based Organization**: Files organized by category (tasks, meetings, contact, personal, etc.)
- **Dynamic Categories**: No predefined restrictions - create any category that fits your needs
- **Rich Metadata**: Support for subcategories, tags, and timestamps
- **Search & Discovery**: Full-text search across all personal information
- **Batch Operations**: Efficient bulk operations for saving and retrieving data
- **Encryption Support**: Optional AES-256 encryption for sensitive data
- **OTP Authentication**: Time-based OTP for secure access to encrypted data
- **Backup System**: Automatic backups before data modifications

## Quick Start

### Installation

```bash
npm install
npm run build
```

### Basic Usage

Start the server:

```bash
npm start
```

Or with custom data directory:

```bash
npm start -- --data-dir=/path/to/your/data
```

### Configuration Options

- `--data-dir`: Specify data directory (default: `./data`)

### Environment Variables

```bash
# Data storage
PERSONAL_INFO_DATA_DIR=./data
PERSONAL_INFO_MAX_FILE_SIZE=1048576  # 1MB
PERSONAL_INFO_BACKUP_ENABLED=true
PERSONAL_INFO_BACKUP_DIR=./backups

# Security (optional)
PERSONAL_INFO_ENCRYPTION_ENABLED=false
PERSONAL_INFO_ENCRYPTION_KEY=""
```

## Available Tools

### Core Information Management

- **`list_available_personal_info`**: List all available information by category
- **`update_personal_info`**: Update existing personal information
- **`delete_personal_info`**: Delete specific personal information
- **`batch_get_personal_info`**: Retrieve multiple categories at once
- **`batch_save_personal_info`**: Save multiple items efficiently
- **`search_personal_memories`**: Search through all stored information

### Security & Authentication

- **`setup_otp`**: Set up OTP authentication for encryption
- **`verify_otp`**: Verify OTP token to access encrypted data
- **`otp_status`**: Check current OTP configuration status
- **`lock_otp`**: Immediately lock current OTP session and block access
- **`disable_otp`**: Disable OTP and encryption

## Topic-Based Organization

### File Structure

Information is organized by topic/category in a simple directory structure:

```
data/
├── tasks/
│   ├── project-alpha-planning.md
│   └── meeting-preparation.md
├── contact/
│   ├── phone-personal-mobile.md
│   └── email-work.md
├── meetings/
│   ├── team-standup-2024-01-15.md
│   └── client-review-2024-01-16.md
├── personal/
│   ├── hobbies.md
│   └── preferences.md
└── health/
    └── allergies.md
```

### File Format

Each file uses YAML frontmatter with markdown content:

```markdown
---
category: contact
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

### Dynamic Categories

Categories are created automatically when you save information. Common categories include:

| Category | Description | Example Content |
|----------|-------------|-----------------|
| **tasks** | Work and personal tasks | Project plans, todo items, deadlines |
| **meetings** | Meeting notes and minutes | Standup notes, client calls, retrospectives |
| **contact** | Contact information | Phone numbers, emails, addresses |
| **personal** | Personal details | Hobbies, preferences, personal notes |
| **health** | Health information | Medical records, fitness data, allergies |
| **work** | Professional information | Projects, colleagues, work notes |
| **family** | Family information | Family member details, relationships |
| **travel** | Travel information | Trip plans, itineraries, memories |

## Security Features

### OTP Authentication

For sensitive data, enable OTP authentication:

1. **Setup OTP**: Use `setup_otp` tool to generate QR code and backup codes
2. **Verify Access**: Use `verify_otp` tool before accessing encrypted data
3. **Check Status**: Use `otp_status` tool to see current authentication state
4. **Lock Session**: Use `lock_otp` tool to immediately terminate access when stepping away

### Encryption

- **AES-256 encryption** for file contents
- **Stable encryption keys** (not time-based)
- **OTP used for access control**, not key derivation
- **Backwards compatible** with existing unencrypted files

## Examples

### Saving Personal Information

```json
{
  "tool": "batch_save_personal_info",
  "arguments": {
    "items": [
      {
        "category": "contact",
        "subcategory": "personal-email",
        "content": "john.doe@email.com",
        "tags": ["primary", "personal"]
      },
      {
        "category": "tasks",
        "subcategory": "project-alpha",
        "content": "Complete API documentation by Friday",
        "tags": ["work", "urgent"]
      }
    ]
  }
}
```

### Searching Information

```json
{
  "tool": "search_personal_memories",
  "arguments": {
    "query": "project alpha",
    "tags": ["work"],
    "date_range": {
      "start": "2024-01-01",
      "end": "2024-01-31"
    }
  }
}
```

### Listing Available Information

```json
{
  "tool": "list_available_personal_info",
  "arguments": {
    "category_filter": "contact,tasks"
  }
}
```

## Development

### Project Structure

```
src/
├── index.ts                       # Main server entry point
├── types/
│   └── schemas.ts                 # Zod validation schemas
├── core/
│   ├── Context.ts                # Server context and types
│   ├── Response.ts               # Response utilities
│   └── Validation.ts             # Validation utilities
├── managers/
│   ├── FileManager.ts            # File operations and organization
│   ├── OTPManager.ts             # OTP authentication
│   └── EncryptionManager.ts      # Encryption/decryption
├── server/
│   ├── McpServerFactory.ts      # Server initialization
│   └── ToolRegistry.ts          # Tool registration
└── tools/
    ├── personalInfo/             # Personal info management tools
    ├── memories/                 # Search and memory tools
    └── otp/                      # Authentication tools
```

### Building and Testing

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run the server
npm start

# Run with custom data directory
npm start -- --data-dir=./test-data
```

## Migration from Scope-Based System

If migrating from an older version that used scope-based organization:

1. **File Location**: Move files from `data/scope/` to `data/category/`
2. **Frontmatter**: Remove `scope` field from YAML frontmatter
3. **Categories**: Map old scopes to new categories as needed
4. **Access Control**: All data is now accessible (no scope-based restrictions)

Example migration:
- `data/contact/phone.md` → `data/contact/phone.md` (same location)
- `data/personal/hobbies.md` → `data/personal/hobbies.md` (same location)
- Remove `scope: contact` from frontmatter

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions:
- Create an issue on GitHub
- Check existing documentation
- Review example usage patterns 