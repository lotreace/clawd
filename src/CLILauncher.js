import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Logger } from './utils/Logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Map CLI names to their npm package bin paths
const CLI_PACKAGES = {
  claude: '@anthropic-ai/claude-code/cli.js',
  gemini: '@google/gemini-cli/dist/index.js'
};

class CLILauncher {
  constructor(config, args = [], targetCli = 'claude') {
    this.config = config;
    this.args = args;
    this.targetCli = targetCli;
    this.logger = new Logger('CLILauncher');
    this.process = null;
  }

  _resolveCLIPath() {
    const packagePath = CLI_PACKAGES[this.targetCli];
    if (!packagePath) {
      return this.targetCli; // Fallback to global command
    }

    // Try to find the CLI in clawd's node_modules (works for global install)
    const localPath = join(__dirname, '..', 'node_modules', packagePath);
    if (existsSync(localPath)) {
      this.logger.info(`Using bundled CLI: ${localPath}`);
      return localPath;
    }

    // Fallback to global command
    this.logger.info(`Bundled CLI not found, using global: ${this.targetCli}`);
    return this.targetCli;
  }

  launch() {
    return new Promise((resolve, reject) => {
      const cliPath = this._resolveCLIPath();
      const isNodeScript = cliPath.endsWith('.js');

      // If it's a .js file, run it with node; otherwise run as command
      const command = isNodeScript ? process.execPath : cliPath;
      const args = isNodeScript ? [cliPath, ...this.args] : this.args;

      const env = {
        ...process.env,
        ...this._getEnvVars()
      };

      this.logger.info(`Launching ${command} ${args.join(' ')}`);

      this.process = spawn(command, args, {
        env,
        stdio: 'inherit'
      });

      this.process.on('error', (error) => {
        this.logger.error(`Failed to launch ${this.targetCli}`, error);
        // Attach CLI path to error for better error messages
        error.cliPath = cliPath;
        reject(error);
      });

      this.process.on('close', (code, signal) => {
        if (signal) {
          this.logger.info(`${this.targetCli} killed by signal ${signal}`);
        } else if (code !== null && code > 128) {
          const signalNum = code - 128;
          this.logger.info(`${this.targetCli} killed by signal ${signalNum} (exit code ${code})`);
        } else {
          this.logger.info(`${this.targetCli} exited with code ${code}`);
        }
        // Include CLI path in result for error reporting
        resolve({ code, signal, cliPath });
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
