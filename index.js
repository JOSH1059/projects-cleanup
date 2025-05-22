#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const { program } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const cliProgress = require('cli-progress');
const inquirer = require('inquirer');
const fsExtra = require('fs-extra');
const { glob } = require('glob');

// Enhanced CLI with professional libraries
const packageJson = require('./package.json');

// Configuration
const CONFIG = {
  cleanupDirs: [
    'node_modules', '.next', 'dist', 'build', 'out', '.output',
    'venv', '.venv', '__pycache__', '.pytest_cache', '.coverage',
    'coverage', '.nyc_output', '.cache', 'tmp', 'temp', '.turbo',
    '.nuxt', '.vuepress/dist', '.docusaurus', 'target', '.gradle'
  ],
  cleanupFiles: [
    '.DS_Store', 'Thumbs.db', '*.log', 'npm-debug.log*',
    'yarn-debug.log*', 'yarn-error.log*', '*.tmp', '*.temp'
  ],
  projectValidators: {
    'node_modules': ['package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'],
    '.next': ['next.config.js', 'next.config.ts', 'pages', 'app', 'src/pages', 'src/app'],
    'dist': ['package.json', 'webpack.config.js', 'vite.config.js', 'rollup.config.js', 'tsconfig.json'],
    'build': ['package.json', 'webpack.config.js', 'vite.config.js', 'rollup.config.js', 'tsconfig.json'],
    'out': ['package.json', 'next.config.js', 'next.config.ts'],
    '.output': ['nuxt.config.js', 'nuxt.config.ts'],
    'venv': ['requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile'],
    '.venv': ['requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile'],
    '__pycache__': ['setup.py', 'pyproject.toml', 'requirements.txt', 'Pipfile'],
    '.pytest_cache': ['pytest.ini', 'setup.cfg', 'pyproject.toml'],
    'target': ['Cargo.toml', 'pom.xml', 'build.gradle'],
    '.gradle': ['build.gradle', 'gradle.properties']
  }
};

// Enhanced Progress Bar using cli-progress
class EnhancedProgressBar {
  constructor(total, label = 'Progress') {
    this.progressBar = new cliProgress.SingleBar({
      format: chalk.cyan(`${label} |{bar}| {percentage}% | {value}/{total} | ETA: {eta_formatted} | {custom}`),
      barCompleteChar: '█',
      barIncompleteChar: '░',
      hideCursor: true,
      stopOnComplete: true,
      clearOnComplete: false
    });
    this.total = total;
    this.progressBar.start(total, 0);
  }

  update(current, custom = '') {
    this.progressBar.update(current, { custom });
  }

  stop() {
    this.progressBar.stop();
  }
}

class CleanupTool {
  constructor(codeDir, options = {}) {
    this.codeDir = path.resolve(codeDir);
    this.options = options;
    this.targets = [];
    this.stats = {
      totalFiles: 0,
      totalSize: 0,
      deleted: 0,
      failed: 0,
      skipped: 0
    };
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  async getDirectorySize(dirPath) {
    try {
      let totalSize = 0;
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);
        try {
          if (item.isDirectory()) {
            totalSize += await this.getDirectorySize(itemPath);
          } else {
            const stats = await fs.stat(itemPath);
            totalSize += stats.size;
          }
        } catch (error) {
          // Skip files we can't access
        }
      }
      
      return totalSize;
    } catch (error) {
      return 0;
    }
  }

  async isValidProject(targetPath, targetName) {
    const validators = CONFIG.projectValidators[targetName];
    if (!validators) return true;

    const projectDir = path.dirname(targetPath);
    
    for (const validator of validators) {
      const validatorPath = path.join(projectDir, validator);
      try {
        const stats = await fs.stat(validatorPath);
        if (stats.isFile() || stats.isDirectory()) {
          return true;
        }
      } catch (error) {
        // File doesn't exist, continue checking
      }
    }

    // Special handling for Python cache directories
    if (['__pycache__', '.pytest_cache', '.coverage'].includes(targetName)) {
      let checkDir = projectDir;
      while (checkDir !== path.dirname(checkDir) && checkDir.startsWith(this.codeDir)) {
        for (const validator of ['setup.py', 'pyproject.toml', 'requirements.txt', 'Pipfile']) {
          try {
            await fs.stat(path.join(checkDir, validator));
            return true;
          } catch (error) {
            // Continue checking
          }
        }
        checkDir = path.dirname(checkDir);
      }
      return false;
    }

    return false;
  }

  async findTargets() {
    const spinner = ora({
      text: 'Scanning directories...',
      color: 'cyan',
      spinner: 'dots12'
    }).start();

    const targets = [];

    try {
      await this.scanDirectory(this.codeDir, targets);
      spinner.succeed('Directory scan complete');
      
      if (targets.length === 0) {
        return [];
      }

      console.log(chalk.blue('\n📊 Analyzing targets and calculating sizes...'));
      const progressBar = new EnhancedProgressBar(targets.length, 'Analyzing');

      const validatedTargets = [];
      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        const targetName = path.basename(target.path);
        
        target.isValid = await this.isValidProject(target.path, targetName);
        target.size = await this.getDirectorySize(target.path);
        target.formattedSize = this.formatBytes(target.size);
        
        validatedTargets.push(target);
        progressBar.update(i + 1, target.relativePath);
      }

      progressBar.stop();
      return validatedTargets.sort((a, b) => b.size - a.size);
    } catch (error) {
      spinner.fail('Scan failed');
      throw error;
    }
  }

  async scanDirectory(dirPath, targets) {
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);
        
        // Skip hidden directories and git folders (except specific cleanup dirs)
        if (item.name.startsWith('.') && !CONFIG.cleanupDirs.includes(item.name)) {
          continue;
        }
        
        if (item.isDirectory()) {
          if (CONFIG.cleanupDirs.includes(item.name)) {
            targets.push({
              path: itemPath,
              type: 'directory',
              name: item.name,
              relativePath: path.relative(this.codeDir, itemPath)
            });
          } else {
            // Recursively scan subdirectories
            await this.scanDirectory(itemPath, targets);
          }
        } else {
          // Check for cleanup files using glob patterns
          for (const pattern of CONFIG.cleanupFiles) {
            if (this.matchesPattern(item.name, pattern)) {
              targets.push({
                path: itemPath,
                type: 'file',
                name: item.name,
                relativePath: path.relative(this.codeDir, itemPath)
              });
              break;
            }
          }
        }
      }
    } catch (error) {
      // Skip directories we can't access
    }
  }

  matchesPattern(filename, pattern) {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(filename);
    }
    return filename === pattern;
  }

  displayTargets(targets) {
    if (targets.length === 0) {
      console.log(chalk.green('\n🎉 No cleanup targets found! Your directory is already clean.\n'));
      return false;
    }

    const totalSize = targets.reduce((sum, target) => sum + target.size, 0);
    
    console.log('\n' + chalk.bold.blue('📋 CLEANUP TARGETS FOUND'));
    console.log(chalk.gray('═'.repeat(80)));
    console.log(chalk.red(`Found ${targets.length} cleanup targets • Total size: ${chalk.bold(this.formatBytes(totalSize))}\n`));

    // Group targets by type for better display
    const directories = targets.filter(t => t.type === 'directory');
    const files = targets.filter(t => t.type === 'file');

    if (directories.length > 0) {
      console.log(chalk.bold('📁 Directories:'));
      directories.forEach((target, index) => {
        const warning = !target.isValid ? chalk.yellow(' ⚠️') : '';
        const size = chalk.dim(`(${target.formattedSize})`);
        console.log(`${chalk.yellow((index + 1).toString().padStart(3))}. ${chalk.cyan(target.relativePath)} ${size}${warning}`);
      });
    }

    if (files.length > 0) {
      console.log(chalk.bold('\n📄 Files:'));
      files.forEach((target, index) => {
        const size = chalk.dim(`(${target.formattedSize})`);
        console.log(`${chalk.yellow((directories.length + index + 1).toString().padStart(3))}. ${chalk.cyan(target.relativePath)} ${size}`);
      });
    }

    console.log('\n' + chalk.yellow('⚠️  = Might not be a legitimate project folder'));
    console.log(chalk.gray('═'.repeat(80)) + '\n');
    
    return true;
  }

  async selectTargets(targets) {
    // First, ask if they want to proceed with deletion
    const { proceed } = await inquirer.prompt([
      {
        type: 'list',
        name: 'proceed',
        message: '🎯 What would you like to do?',
        choices: [
          {
            name: 'Proceed with selecting items to delete',
            value: true,
            short: 'Proceed'
          },
          {
            name: 'Exit without making any changes',
            value: false,
            short: 'Exit'
          }
        ]
      }
    ]);

    if (!proceed) {
      console.log(chalk.yellow('\n🚪 Cleanup cancelled. No changes were made.\n'));
      process.exit(0);
    }

    // Go straight to interactive selection with checkboxes
    const { selectedTargets } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedTargets',
        message: 'Select items to delete (use spacebar to select, enter to confirm):',
        choices: targets.map((target, index) => ({
          name: `${target.type === 'directory' ? '📁' : '📄'} ${target.relativePath} (${target.formattedSize})${!target.isValid ? ' ⚠️' : ''}`,
          value: target,
          short: target.relativePath
        })),
        pageSize: 15,
        validate: (answer) => {
          if (answer.length === 0) {
            return 'You must select at least one item to continue.';
          }
          return true;
        }
      }
    ]);

    return selectedTargets;
  }

  async confirmDeletion(selectedTargets) {
    const totalSize = selectedTargets.reduce((sum, target) => sum + target.size, 0);
    
    console.log(chalk.green(`\n📝 Selected ${selectedTargets.length} items for deletion:`));
    console.log(chalk.dim('─'.repeat(60)));
    
    selectedTargets.forEach(target => {
      const icon = target.type === 'directory' ? '📁' : '📄';
      const warning = !target.isValid ? chalk.yellow(' ⚠️') : '';
      console.log(`  ${chalk.yellow('•')} ${icon} ${chalk.cyan(target.relativePath)} ${chalk.dim(`(${target.formattedSize})`)}${warning}`);
    });

    console.log(chalk.dim('─'.repeat(60)));
    console.log(chalk.bold(`💾 Total space to be freed: ${chalk.green(this.formatBytes(totalSize))}\n`));

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: '🗑️  Proceed with deletion?',
        default: false
      }
    ]);

    return confirm;
  }

  async deleteTargets(targets) {
    console.log(chalk.red('\n🗑️  DELETING SELECTED TARGETS'));
    console.log(chalk.gray('═'.repeat(50)));

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const progress = `[${i + 1}/${targets.length}]`;
      
      try {
        process.stdout.write(`  ${chalk.dim(progress)} Deleting: ${chalk.cyan(target.relativePath)}... `);
        await fsExtra.remove(target.path);
        console.log(chalk.green('✅ Success'));
        this.stats.deleted++;
      } catch (error) {
        console.log(chalk.red(`❌ Failed (${error.message})`));
        this.stats.failed++;
      }
    }

    console.log(chalk.gray('═'.repeat(50)));
  }

  async cleanupPackageManagers() {
    const spinner = ora('Cleaning package manager caches...').start();
    
    const managers = [
      { name: 'npm', command: 'npm cache clean --force' },
      { name: 'pnpm', command: 'pnpm store prune' },
      { name: 'yarn', command: 'yarn cache clean' },
      { name: 'pip', command: 'pip cache purge' }
    ];

    const results = [];
    for (const manager of managers) {
      try {
        execSync(`which ${manager.name}`, { stdio: 'ignore' });
        execSync(manager.command, { stdio: 'ignore' });
        results.push({ name: manager.name, status: 'success' });
      } catch (error) {
        results.push({ name: manager.name, status: 'not found' });
      }
    }

    spinner.stop();
    
    console.log(chalk.blue('\n🧹 Package Manager Cache Cleanup:'));
    results.forEach(result => {
      if (result.status === 'success') {
        console.log(`  ${chalk.green('✅')} ${result.name} cache cleared`);
      }
    });
  }

  displaySummary(selectedTargets) {
    const totalSize = selectedTargets.reduce((sum, target) => sum + target.size, 0);
    
    console.log('\n' + chalk.bold.green('📊 CLEANUP SUMMARY'));
    console.log(chalk.gray('═'.repeat(40)));
    console.log(`${chalk.green('✅ Successfully deleted:')} ${this.stats.deleted} items`);
    if (this.stats.failed > 0) {
      console.log(`${chalk.red('❌ Failed to delete:')} ${this.stats.failed} items`);
    }
    console.log(`${chalk.blue('💾 Space freed:')} ${chalk.bold(this.formatBytes(totalSize))}`);
    console.log(`${chalk.cyan('⏱️  Directory:')} ${this.codeDir}`);
    console.log(chalk.gray('═'.repeat(40)));
  }

  async run(isDryRun = false) {
    // Display header
    console.log(chalk.bold.blue('\n' + '═'.repeat(60)));
    console.log(chalk.bold.blue('        🧹 PROJECT CLEANUP TOOL'));
    console.log(chalk.bold.blue(`        Version ${packageJson.version}`));
    if (packageJson.author) {
      console.log(chalk.bold.blue(`        Author: ${packageJson.author}`));
    }
    console.log(chalk.bold.blue('═'.repeat(60)));
    console.log(`${chalk.blue('📁 Working Directory:')} ${chalk.cyan(this.codeDir)}`);
    
    if (isDryRun) {
      console.log(chalk.yellow.bold('🔍 DRY RUN MODE - No files will be deleted'));
    }

    try {
      // Find and analyze targets
      this.targets = await this.findTargets();
      
      // Display results
      if (!this.displayTargets(this.targets)) {
        return;
      }

      if (isDryRun) {
        console.log(chalk.yellow.bold('✨ Dry run complete. Remove --dry-run flag to actually delete files.\n'));
        return;
      }

      // Interactive selection
      const selectedTargets = await this.selectTargets(this.targets);
      
      if (selectedTargets.length === 0) {
        console.log(chalk.yellow('\n🤷 No items selected for deletion.\n'));
        return;
      }

      // Confirm deletion
      if (!(await this.confirmDeletion(selectedTargets))) {
        console.log(chalk.yellow('\n🚪 Cleanup cancelled.\n'));
        return;
      }

      // Delete files
      await this.deleteTargets(selectedTargets);
      
      // Optional package manager cleanup
      const { cleanCaches } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'cleanCaches',
          message: '🧹 Also clean package manager caches?',
          default: true
        }
      ]);

      if (cleanCaches) {
        await this.cleanupPackageManagers();
      }

      // Show summary
      this.displaySummary(selectedTargets);
      console.log(chalk.green.bold('\n🎉 Cleanup completed successfully!\n'));

    } catch (error) {
      console.error(chalk.red(`\n💥 Error: ${error.message}\n`));
      if (this.options.verbose) {
        console.error(chalk.dim(error.stack));
      }
      process.exit(1);
    }
  }
}

// CLI Configuration using Commander
program
  .name('cleanup-projects')
  .description('Clean up development project directories by removing build artifacts, dependencies, and cache files')
  .version(packageJson.version)
  .argument('[directory]', 'Directory to clean (defaults to current directory)', process.cwd())
  .option('-d, --dry-run', 'Preview what would be deleted without actually deleting')
  .option('-v, --verbose', 'Show detailed error messages')
  .option('--no-interactive', 'Run in non-interactive mode (select all by default)')
  .option('--config <path>', 'Path to custom configuration file')
  .action(async (directory, options) => {
    try {
      // Verify directory exists
      await fs.access(directory);
      
      const tool = new CleanupTool(directory, options);
      await tool.run(options.dryRun);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.error(chalk.red(`❌ Directory not found: ${directory}`));
      } else {
        console.error(chalk.red(`💥 Fatal error: ${error.message}`));
        if (options.verbose) {
          console.error(chalk.dim(error.stack));
        }
      }
      process.exit(1);
    }
  });

// Additional commands
program
  .command('stats [directory]')
  .description('Show statistics about cleanup targets without deleting')
  .action(async (directory = process.cwd()) => {
    try {
      const tool = new CleanupTool(directory);
      await tool.run(true); // Force dry run
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Show current configuration')
  .action(() => {
    console.log(chalk.blue('\n📋 Current Configuration:'));
    console.log(chalk.gray('═'.repeat(40)));
    console.log(chalk.yellow('Cleanup Directories:'));
    CONFIG.cleanupDirs.forEach(dir => console.log(`  • ${dir}`));
    console.log(chalk.yellow('\nCleanup Files:'));
    CONFIG.cleanupFiles.forEach(file => console.log(`  • ${file}`));
    console.log();
  });

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n🛑 Operation interrupted by user.'));
  process.exit(0);
});

// Parse command line arguments
program.parse();