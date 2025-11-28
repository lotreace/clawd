import { resolve, dirname, join } from 'path';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { Config } from './config/Config.js';
import { ConfigStore } from './config/ConfigStore.js';
import { ClawdServer } from './ClawdServer.js';
import { CLILauncher } from './CLILauncher.js';
import { SetupWizard } from './setup/SetupWizard.js';
import { Logger } from './utils/Logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Subcommands that don't need the proxy (just pass through to CLI)
const CLAUDE_PASSTHROUGH_COMMANDS = ['mcp', 'plugin', 'migrate-installer', 'setup-token', 'doctor', 'update', 'install'];
const GEMINI_PASSTHROUGH_COMMANDS = ['mcp', 'extensions', 'extension'];
const GEMINI_PASSTHROUGH_FLAGS = ['--list-extensions', '-l', '--list-sessions', '--delete-session'];

// Map CLI names to their npm package bin paths
const CLI_PACKAGES = {
  claude: '@anthropic-ai/claude-code/cli.js',
  gemini: '@google/gemini-cli/dist/index.js'
};

function shouldPassthrough(args, targetCli) {
  // Filter out clawd-specific flags to get the actual CLI args
  const cliArgs = args.filter(arg => arg !== '--gemini');

  if (cliArgs.length === 0) {
    return false;
  }

  const firstArg = cliArgs[0];

  if (targetCli === 'gemini') {
    // Check for passthrough subcommands
    if (GEMINI_PASSTHROUGH_COMMANDS.includes(firstArg)) {
      return true;
    }
    // Check for passthrough flags anywhere in args
    if (cliArgs.some(arg => GEMINI_PASSTHROUGH_FLAGS.includes(arg))) {
      return true;
    }
  } else {
    // Claude
    if (CLAUDE_PASSTHROUGH_COMMANDS.includes(firstArg)) {
      return true;
    }
  }

  return false;
}

function resolveCLIPath(targetCli) {
  const packagePath = CLI_PACKAGES[targetCli];
  if (!packagePath) {
    return { command: targetCli, isNodeScript: false };
  }

  // Try to find the CLI in clawd's node_modules (works for global install)
  const localPath = join(__dirname, '..', 'node_modules', packagePath);
  if (existsSync(localPath)) {
    return { command: localPath, isNodeScript: true };
  }

  // Fallback to global command
  return { command: targetCli, isNodeScript: false };
}

function runPassthrough(targetCli, args) {
  return new Promise((resolvePromise) => {
    const cliArgs = args.filter(arg => arg !== '--gemini');
    const { command, isNodeScript } = resolveCLIPath(targetCli);

    const spawnCommand = isNodeScript ? process.execPath : command;
    const spawnArgs = isNodeScript ? [command, ...cliArgs] : cliArgs;

    const proc = spawn(spawnCommand, spawnArgs, {
      stdio: 'inherit'
    });

    proc.on('error', (error) => {
      const cliName = targetCli === 'gemini' ? 'Gemini CLI' : 'Claude Code';
      const cliCommand = targetCli === 'gemini' ? 'gemini' : 'claude';

      console.error(`\nFailed to run ${cliName}: ${error.message}`);

      if (error.code === 'ENOENT') {
        console.error(`\nThe "${cliCommand}" command was not found.`);
        console.error(`Attempted path: ${command}`);
        console.error(`\nTo fix this, install the CLI globally:`);
        if (targetCli === 'gemini') {
          console.error('  npm install -g @google/gemini-cli');
        } else {
          console.error('  npm install -g @anthropic-ai/claude-code');
        }
        console.error(`\nOr reinstall clawd to bundle the CLI:`);
        console.error('  npm install -g @lotreace/clawd');
      }

      resolvePromise(1);
    });

    proc.on('close', (code) => {
      resolvePromise(code ?? 0);
    });
  });
}

function printHelp() {
  console.log(`
Clawd - Claude Code CLI with OpenAI-compatible backends

Usage: clawd [options]

Options:
  --help, -h              Show this help message
  --version, -v           Show version number
  --clawd-config          Run the configuration wizard
  --clawd-show-config     Show current configuration
  --gemini                Launch Gemini CLI instead of Claude Code

Environment Variables (OpenAI):
  OPENAI_API_KEY            (required) OpenAI API key
  OPENAI_BASE_URL           (optional) OpenAI-compatible endpoint URL

Environment Variables (Azure):
  AZURE_OPENAI_ENDPOINT     (required) Azure OpenAI endpoint URL
  AZURE_OPENAI_API_KEY      (required) Azure OpenAI API key
  AZURE_DEPLOYMENT_HAIKU    (optional) Override deployment name for Haiku-tier (default: model name)
  AZURE_DEPLOYMENT_SONNET   (optional) Override deployment name for Sonnet-tier (default: model name)
  AZURE_DEPLOYMENT_OPUS     (optional) Override deployment name for Opus-tier (default: model name)
  AZURE_API_VERSION         (optional) Azure API version (fallback: OPENAI_API_VERSION, default: 2024-02-15-preview)

Common:
  CLAWD_PORT                (optional) Local proxy port (default: 2001)
  CLAWD_LOG                 (optional) Log file path (logging disabled if not set)
`);
}

function createConfig(storedConfig) {
  const modelFamily = storedConfig?.modelFamily || 'gpt-4o';
  const useAzure = storedConfig?.provider === 'azure';
  const reasoningEffort = storedConfig?.reasoningEffort || 'low';
  return new Config(modelFamily, useAzure, reasoningEffort);
}

async function run() {
  // Only enable logging if CLAWD_LOG is explicitly set
  if (process.env.CLAWD_LOG) {
    const logFile = resolve(process.cwd(), process.env.CLAWD_LOG);
    Logger.setLogFile(logFile);
  }

  const logger = new Logger('clawd');
  const configStore = new ConfigStore();
  const claudeArgs = process.argv.slice(2);

  // Check for clawd-specific flags
  const hasHelp = claudeArgs.includes('--help') || claudeArgs.includes('-h');
  const hasVersion = claudeArgs.includes('--version') || claudeArgs.includes('-v');
  const hasConfig = claudeArgs.includes('--clawd-config');
  const hasShowConfig = claudeArgs.includes('--clawd-show-config');
  const hasGemini = claudeArgs.includes('--gemini');

  // Determine target CLI
  const targetCli = hasGemini ? 'gemini' : 'claude';

  // Check if this is a passthrough command (no proxy needed)
  if (shouldPassthrough(claudeArgs, targetCli)) {
    const exitCode = await runPassthrough(targetCli, claudeArgs);
    process.exit(exitCode);
  }

  if (hasVersion) {
    const pkg = await import('../package.json', { with: { type: 'json' } });
    console.log(`clawd ${pkg.default.version}`);
    process.exit(0);
  }

  if (hasHelp) {
    printHelp();
    process.exit(0);
  }

  // Load stored config if it exists
  let storedConfig = configStore.exists() ? configStore.load() : null;

  if (hasShowConfig) {
    if (storedConfig) {
      console.log('\nCurrent configuration:\n');
      console.log(`  Config file: ${configStore.getConfigPath()}`);
      console.log(`  Provider:    ${storedConfig.provider}`);
      console.log(`  Model:       ${storedConfig.modelFamily}`);
      if (storedConfig.reasoningEffort) {
        console.log(`  Reasoning:   ${storedConfig.reasoningEffort}`);
      }
      console.log('');
    } else {
      console.log('\nNo configuration found. Run "clawd" to set up.\n');
    }
    process.exit(0);
  }

  // Run wizard if: no config, missing env vars, or --config flag
  let config = createConfig(storedConfig);
  if (!storedConfig || !config.hasRequiredEnvVars() || hasConfig) {
    const wizard = new SetupWizard(configStore);
    storedConfig = await wizard.run(storedConfig);
    config = createConfig(storedConfig);
  }

  if (Logger.isEnabled()) {
    logger.info(`Config: ${configStore.getConfigPath()}`);
    logger.info(`Provider: ${storedConfig?.provider || 'openai'}`);
    logger.info(`Model family: ${config.modelFamily}`);
    logger.info(`Claude args: ${claudeArgs.join(' ')}`);
  }

  try {
    config.validate();
  } catch (error) {
    if (Logger.isEnabled()) {
      logger.error(error.message);
    }
    console.error('\n' + error.message);
    console.log('\nPlease set the required environment variables and try again.\n');
    process.exit(1);
  }

  // Filter out clawd-specific flags before passing to target CLI
  const cliArgs = claudeArgs.filter(arg => arg !== '--gemini');

  const server = new ClawdServer(config);
  const launcher = new CLILauncher(config, cliArgs, targetCli);

  const shutdown = async () => {
    logger.info('Shutting down...');
    launcher.kill();
    await server.stop();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  try {
    await server.start();
  } catch (error) {
    console.error(`\nFailed to start server: ${error.message}`);
    process.exit(1);
  }

  try {
    const cliName = targetCli === 'gemini' ? 'Gemini CLI' : 'Claude Code';
    console.log(`Launching ${cliName}...\n`);
    const { code, signal, cliPath } = await launcher.launch();

    await server.stop();

    if (signal) {
      // Re-send the signal to ourselves to propagate it correctly
      process.kill(process.pid, signal);
    } else if (code !== 0) {
      // CLI exited with non-zero code
      console.error(`\n${cliName} exited with error code ${code}`);
      if (cliPath) {
        console.error(`CLI path: ${cliPath}`);
      }
      process.exit(code ?? 1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    const cliName = targetCli === 'gemini' ? 'Gemini CLI' : 'Claude Code';
    const cliCommand = targetCli === 'gemini' ? 'gemini' : 'claude';

    console.error(`\nFailed to launch ${cliName}: ${error.message}`);

    if (error.code === 'ENOENT') {
      console.error(`\nThe "${cliCommand}" command was not found.`);
      if (error.cliPath) {
        console.error(`Attempted path: ${error.cliPath}`);
      }
      console.error(`\nTo fix this, install the CLI globally:`);
      if (targetCli === 'gemini') {
        console.error('  npm install -g @google/gemini-cli');
      } else {
        console.error('  npm install -g @anthropic-ai/claude-code');
      }
      console.error(`\nOr reinstall clawd to bundle the CLI:`);
      console.error('  npm install -g @lotreace/clawd');
    } else {
      // Other spawn errors
      console.error(`\nError details: ${error.stack || error.message}`);
    }

    logger.error('Fatal error', error);
    await server.stop();
    process.exit(1);
  }
}

export { run };
