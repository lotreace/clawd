import { spawn } from 'child_process';
import { Logger } from './utils/Logger.js';

class CLILauncher {
  constructor(config, args = [], targetCli = 'claude') {
    this.config = config;
    this.args = args;
    this.targetCli = targetCli;
    this.logger = new Logger('CLILauncher');
    this.process = null;
  }

  launch() {
    return new Promise((resolve, reject) => {
      const command = this.targetCli;
      const env = {
        ...process.env,
        ...this._getEnvVars()
      };

      this.logger.info(`Launching ${command}...`);
      this.logger.info(`Args: ${this.args.join(' ')}`);

      this.process = spawn(command, this.args, {
        env,
        stdio: 'inherit'
      });

      this.process.on('error', (error) => {
        this.logger.error(`Failed to launch ${command}`, error);
        reject(error);
      });

      this.process.on('close', (code, signal) => {
        if (signal) {
          this.logger.info(`${command} killed by signal ${signal}`);
        } else if (code !== null && code > 128) {
          const signalNum = code - 128;
          this.logger.info(`${command} killed by signal ${signalNum} (exit code ${code})`);
        } else {
          this.logger.info(`${command} exited with code ${code}`);
        }
        resolve({ code, signal });
      });
    });
  }

  _getEnvVars() {
    if (this.targetCli === 'gemini') {
      return this.config.getGeminiEnvVars();
    }
    return this.config.getAnthropicEnvVars();
  }

  kill() {
    if (this.process) {
      this.process.kill('SIGTERM');
    }
  }
}

export { CLILauncher };
