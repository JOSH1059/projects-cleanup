# Project Cleanup Tool

A powerful CLI tool for cleaning up development project directories by removing build artifacts, dependencies, cache files, and other temporary files that accumulate during development.

**👇 See it in action!**

![Project Cleanup Tool Example Console Output](projects-cleanup_ex.png)

## Why Use This Tool?

During development, projects accumulate various temporary files and directories that can consume significant disk space:
- **node_modules** directories (often hundreds of MB each)
- **Build artifacts** (.next, dist, build, out directories)
- **Python cache** (__pycache__, .pytest_cache)
- **Package manager caches** (npm, pnpm, yarn, pip)
- **System junk** (.DS_Store, Thumbs.db, log files)

This tool helps you reclaim disk space by safely identifying and removing these files across multiple projects at once, while protecting legitimate project files.

## Installation

```bash
# Install globally
npm install -g project-cleanup-tool

# Or install directly from GitHub
npm install -g JOSH1059/project-cleanup-tool
```

### Local Development / From Source
```bash
# Clone the repository
$ git clone https://github.com/JOSH1059/project-cleanup-tool.git
$ cd project-cleanup-tool
$ npm install          # install dependencies
$ npm install -g .     # install globally from local source
```

## Usage

This tool can be run using any of these commands:
- `cleanup-projects` (full name)
- `project-cleanup` (descriptive alias)
- `cleanup` (shorter alias)
- `clean` (shortest alias)
- `pcl` (ultra-short alias)

### Preview What Would Be Cleaned

```bash
# Show what would be cleaned without deleting anything
cleanup --dry-run

# Or use the stats command
cleanup stats
```

### Interactive Cleanup

```bash
# Run interactive cleanup (recommended)
cleanup

# Clean a specific directory
cleanup /path/to/your/code --dry-run
```

### Show Configuration

```bash
# Display current cleanup rules
cleanup config
```

## Features

- **🔍 Smart Detection**: Validates that cleanup targets are in legitimate project directories
- **📊 Size Analysis**: Shows file sizes and calculates total space that can be freed
- **✅ Interactive Selection**: Choose exactly what to delete with intuitive checkboxes
- **🛡️ Safety First**: Dry-run mode and confirmation prompts prevent accidental deletion
- **🎨 Beautiful Interface**: Colorful, professional CLI with progress indicators
- **🧹 Package Manager Integration**: Cleans npm, pnpm, yarn, and pip caches
- **📈 Detailed Statistics**: Shows what was deleted and how much space was freed
- **⚡ High Performance**: Efficient scanning and deletion with progress feedback

## Options

All commands support these options:

| Option | Description |
|--------|-------------|
| `[directory]` | Directory to clean (default: current directory) |
| `-d, --dry-run` | Preview what would be deleted without actually deleting |
| `-v, --verbose` | Show detailed error messages and stack traces |
| `--no-interactive` | Run in non-interactive mode |
| `--config <path>` | Path to custom configuration file |

## Commands

| Command | Description |
|---------|-------------|
| `cleanup [directory]` | Run interactive cleanup |
| `cleanup stats [directory]` | Show cleanup statistics without deleting |
| `cleanup config` | Display current configuration |

## Examples

### Basic Usage

```bash
# Preview cleanup for current directory
cleanup --dry-run

# Interactive cleanup with selection
cleanup

# Clean a specific project directory
cleanup ~/Desktop/CODE
```

### Advanced Usage

```bash
# Show detailed information
cleanup --verbose

# Get statistics only
cleanup stats ~/projects

# Check configuration
cleanup config
```

## How It Works

The tool follows a systematic approach:

1. **🔍 Scans** the directory recursively for cleanup targets
2. **📊 Analyzes** each target to determine if it's in a legitimate project
3. **📋 Displays** all found targets with sizes and warnings
4. **✅ Allows Selection** via interactive checkboxes
5. **🛡️ Confirms** deletion before proceeding
6. **🗑️ Deletes** selected items with real-time progress
7. **🧹 Optionally Cleans** package manager caches
8. **📈 Shows Summary** of what was accomplished

## Supported Project Types & Cleanup Targets

### Node.js/JavaScript Projects
- `node_modules/` - Package dependencies
- `.next/` - Next.js build cache
- `dist/`, `build/`, `out/` - Build outputs
- `.turbo/` - Turborepo cache

### Python Projects
- `venv/`, `.venv/` - Virtual environments
- `__pycache__/` - Python bytecode cache
- `.pytest_cache/` - Pytest cache
- `.coverage` - Coverage data

### Java/JVM Projects
- `target/` - Maven build directory
- `.gradle/` - Gradle cache

### Universal Cleanup
- `.DS_Store` - macOS system files
- `Thumbs.db` - Windows thumbnails
- `*.log`, `*.tmp` - Log and temporary files
- `.cache/`, `tmp/`, `temp/` - Cache directories

## Safety Features

- **✅ Project Validation**: Ensures cleanup targets are in actual project directories
- **⚠️ Warning System**: Flags potentially suspicious cleanup targets
- **🛡️ Confirmation Prompts**: Multiple confirmation steps before deletion
- **🔍 Dry Run Mode**: Preview all actions before execution
- **📊 Detailed Reporting**: Clear feedback on what was done

### Smart Project Detection

The tool validates cleanup targets by checking for project indicators:

| Target | Validation Files |
|--------|------------------|
| `node_modules` | package.json, package-lock.json, yarn.lock |
| `.next` | next.config.js, pages/, app/ directories |
| `venv` | requirements.txt, setup.py, pyproject.toml |
| `__pycache__` | Python project files in parent directories |
| `target` | Cargo.toml, pom.xml, build.gradle |

## Package Manager Cache Cleanup

Optionally cleans caches for:
- **npm** (`npm cache clean --force`)
- **pnpm** (`pnpm store prune`)
- **yarn** (`yarn cache clean`)
- **pip** (`pip cache purge`)

## Example Output

Below is a screenshot of the Project Cleanup Tool in action, showing the interactive CLI and summary after a cleanup operation:

```
═══════════════════════════════════════════════════════════
        🧹 PROJECT CLEANUP TOOL
        Version 1.0.0
═══════════════════════════════════════════════════════════

📊 Analyzing targets and calculating sizes...
Analyzing [████████████████████████████████████████] 100% (15/15)

📋 CLEANUP TARGETS FOUND
Found 8 cleanup targets • Total size: 1.2 GB

📁 Directories:
  1. zenik/Kugle-Kasino/node_modules (417 MB)
  2. RPG-AI-api/node_modules (288 MB)
  3. zenik/ZenikDatabase/node_modules (64 MB)
  4. RPG-AI-api/dist (1.0 MB)

🎯 What would you like to do?
❯ Proceed with selecting items to delete
  Exit without making any changes

Select items to delete (use spacebar to select, enter to confirm):
❯ ◉ 📁 zenik/Kugle-Kasino/node_modules (417 MB)
  ◉ 📁 RPG-AI-api/node_modules (288 MB)
  ◯ 📁 zenik/ZenikDatabase/node_modules (64 MB)
  ◉ 📁 RPG-AI-api/dist (1.0 MB)

💾 Total space to be freed: 706 MB

🗑️ Proceed with deletion? Yes

🗑️ DELETING SELECTED TARGETS
  [1/3] Deleting: zenik/Kugle-Kasino/node_modules... ✅ Success
  [2/3] Deleting: RPG-AI-api/node_modules... ✅ Success
  [3/3] Deleting: RPG-AI-api/dist... ✅ Success

📊 CLEANUP SUMMARY
✅ Successfully deleted: 3 items
💾 Space freed: 706 MB

🎉 Cleanup completed successfully!
```

## Configuration

View current configuration with:
```bash
cleanup config
```

The tool is pre-configured with sensible defaults for common development scenarios, but can be customized via configuration files (coming soon).

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Setup

```bash
git clone https://github.com/JOSH1059/project-cleanup-tool.git
cd project-cleanup-tool
npm install
npm link  # For local testing
```

## Changelog

### v1.0.0
- Initial release
- Interactive checkbox selection
- Multi-project type support
- Package manager cache cleanup
- Comprehensive safety features