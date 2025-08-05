# Personal MCP Server

A Model Context Protocol (MCP) server for managing personal information with dynamic topic-based organization, OTP authentication, and encryption support.

## Features

- **Topic-Based Organization**: Files organized by category (tasks, meetings, contact, personal, etc.)
- **Dynamic Categories**: No predefined restrictions - create any category that fits your needs
- **Rich Metadata**: Support for subcategories, tags, and timestamps
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

### Basic Usage - Save to `.personal-context-data` in user home directory
```json
   {
  "mcpServers": {
    "personal-info": {
      "command": "node",
      "args": [
        "<path/to/personal-mcp>/dist/index.js"
      ]
    }
  }
}
```


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

### Configuration Example
```json
   {
  "mcpServers": {
    "shared-memory-info": {
      "command": "node",
      "args": [
        "<path/to/personal-mcp>/dist/index.js"
      ]
      "env": {
        "PERSONAL_INFO_DATA_DIR": "<path/to/shared/folder>/shared-mcp-memory",
      }
    }
  }
}
```

## Available Tools

### Core Information Management

- **`list_available_personal_info`**: List all available information by category
- **`update_personal_info`**: Update existing personal information
- **`delete_personal_info`**: Delete specific personal information
- **`batch_get_personal_info`**: Retrieve multiple categories at once
- **`batch_save_personal_info`**: Save multiple items efficiently

### Security & Authentication

- **`setup_otp`**: Set up OTP authentication for encryption
- **`verify_otp`**: Verify OTP token to access encrypted data
- **`otp_status`**: Check current OTP configuration status
- **`lock_otp`**: Immediately lock current OTP session and block access
- **`disable_otp`**: Disable OTP and encryption

## Topic-Based Organization

### File Structure example (auto generated)

Information is organized by topic/category in a simple directory structure for example:

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


## Development


### Building and Testing

```bash
# Install dependencies
npm install

# Build TypeScript and watch for changes
npm run dev
```

## License

MIT License - see LICENSE file for details.

## Vibe Coding Disclaimer ⚠️
The code is written by AI, so it may not be the best code.
Use it at your own risk.