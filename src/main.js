import { resolve } from 'path';
import { Config } from './config/Config.js';
import { ClawdServer } from './ClawdServer.js';
import { ClaudeLauncher } from './ClaudeLauncher.js';
import { Logger } from './utils/Logger.js';

async function run(modelFamily) {
  const logFile = process.env.CLAWD_LOG || resolve(process.cwd(), 'clawd.log');
  Logger.setLogFile(logFile);

  const logger = new Logger('clawd');

  const config = new Config(modelFamily);
  const claudeArgs = process.argv.slice(2);

  logger.info(`Log file: ${logFile}`);
  logger.info(`Model family: ${modelFamily}`);
  logger.info(`Claude args: ${claudeArgs.join(' ')}`);

  try {
    config.validate();
  } catch (error) {
    logger.error(error.message);
    console.error(error.message);
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

    const { code, signal } = await launcher.launch();

    await server.stop();

    if (signal) {
      // Re-send the signal to ourselves to propagate it correctly
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 0);
    }
  } catch (error) {
    logger.error('Fatal error', error);
    await server.stop();
    process.exit(1);
  }
}

export { run };
