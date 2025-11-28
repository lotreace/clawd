import { spawn, execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, chmodSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
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

      // Set up code -> code-server alias if needed
      const aliasDir = this._setupCodeAlias();

      const env = {
        ...process.env,
        ...this._getEnvVars()
      };

      // Prepend alias directory to PATH if created
      if (aliasDir) {
        env.PATH = `${aliasDir}:${env.PATH || ''}`;
      }

      this.logger.info(`Launching ${command} ${args.join(' ')}`);

      // On Windows, use shell: true for non-.js commands to resolve .cmd/.bat wrappers
      const useShell = !isNodeScript && process.platform === 'win32';

      this.process = spawn(command, args, {
        env,
        stdio: 'inherit',
        shell: useShell
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

  _commandExists(cmd) {
    try {
      execSync(`which ${cmd}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  _setupCodeAlias() {
    // If 'code' already exists, no alias needed
    if (this._commandExists('code')) {
      return null;
    }

    // Check if code-server exists
    if (!this._commandExists('code-server')) {
      return null;
    }

    this.logger.info('Setting up code -> code-server alias');

    // Create a temp directory with a 'code' script that calls code-server
    const aliasDir = join(tmpdir(), 'clawd-bin');
    const codePath = join(aliasDir, 'code');

    try {
      if (!existsSync(aliasDir)) {
        mkdirSync(aliasDir, { recursive: true });
      }

      // Create a shell script that forwards to code-server
      const script = '#!/bin/sh\nexec code-server "$@"\n';
      writeFileSync(codePath, script);
      chmodSync(codePath, 0o755);

      this.logger.info(`Created code alias at ${codePath}`);
      return aliasDir;
    } catch (error) {
      this.logger.warn(`Failed to create code alias: ${error.message}`);
      return null;
    }
  }

  kill() {
    if (this.process) {
      this.process.kill('SIGTERM');
    }
  }
}

export { CLILauncher };
