import { resolve } from 'path';
import { Config } from './config/Config.js';
import { ConfigStore } from './config/ConfigStore.js';
import { ClawdServer } from './ClawdServer.js';
import { ClaudeLauncher } from './ClaudeLauncher.js';
import { SetupWizard } from './setup/SetupWizard.js';
import { Logger } from './utils/Logger.js';

function printHelp() {
  console.log(`
Clawd - Claude Code CLI with OpenAI-compatible backends

Usage: clawd [options]

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

  // Always show config menu
  const wizard = new SetupWizard(configStore);
  storedConfig = await wizard.run(storedConfig);

  let config = createConfig(storedConfig);

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

  const server = new ClawdServer(config);
  const launcher = new ClaudeLauncher(config, claudeArgs);

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
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${config.port} is already in use. Try setting CLAWD_PORT to a different port.`);
    }
    process.exit(1);
  }

  try {
    const { code, signal } = await launcher.launch();

    await server.stop();

    if (signal) {
      // Re-send the signal to ourselves to propagate it correctly
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 0);
    }
  } catch (error) {
    console.error(`\nFailed to launch Claude: ${error.message}`);
    if (error.code === 'ENOENT') {
      console.error('The "claude" command was not found. Make sure Claude Code CLI is installed.');
      console.error('Install with: npm install -g @anthropic-ai/claude-code');
    }
    logger.error('Fatal error', error);
    await server.stop();
    process.exit(1);
  }
}

export { run };
