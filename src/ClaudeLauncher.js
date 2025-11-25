import { spawn } from 'child_process';
import { Logger } from './utils/Logger.js';

class ClaudeLauncher {
  constructor(config, args = []) {
    this.config = config;
    this.args = args;
    this.logger = new Logger('ClaudeLauncher');
    this.process = null;
  }

  launch() {
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        ...this.config.getAnthropicEnvVars()
      };

      this.logger.info('Launching Claude Code...');
      this.logger.info(`ANTHROPIC_BASE_URL=${env.ANTHROPIC_BASE_URL}`);
      this.logger.info(`Args: ${this.args.join(' ')}`);

      this.process = spawn('claude', this.args, {
        env,
        stdio: 'inherit'
      });

      this.process.on('error', (error) => {
        this.logger.error('Failed to launch Claude', error);
        reject(error);
      });

      this.process.on('close', (code, signal) => {
        if (signal) {
          this.logger.info(`Claude killed by signal ${signal}`);
        } else if (code !== null && code > 128) {
          // Exit codes > 128 typically mean killed by signal (128 + signal number)
          const signalNum = code - 128;
          this.logger.info(`Claude killed by signal ${signalNum} (exit code ${code})`);
        } else {
          this.logger.info(`Claude exited with code ${code}`);
        }
        resolve({ code, signal });
      });
    });
  }

  kill() {
    if (this.process) {
      this.process.kill('SIGTERM');
    }
  }
}

export { ClaudeLauncher };
