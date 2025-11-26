import { appendFileSync } from 'fs';

let logFile = null;
let loggingEnabled = false;

class Logger {
  constructor(name) {
    this.name = name;
  }

  static setLogFile(path) {
    logFile = path;
    loggingEnabled = true;
  }

  static isEnabled() {
    return loggingEnabled;
  }

  _format(level, message) {
    const timestamp = new Date().toISOString();
    return `${timestamp} [${level}] ${this.name}: ${message}`;
  }

  _write(formatted) {
    if (!loggingEnabled) {
      return;
    }
    if (logFile) {
      appendFileSync(logFile, formatted + '\n');
    }
  }

  _writeError(formatted, error = null) {
    if (!loggingEnabled) {
      return;
    }
    if (logFile) {
      appendFileSync(logFile, formatted + '\n');
      if (error) {
        appendFileSync(logFile, error.stack || String(error) + '\n');
      }
    }
  }

  info(message) {
    this._write(this._format('INFO', message));
  }

  error(message, error = null) {
    this._writeError(this._format('ERROR', message), error);
  }

  debug(message) {
    if (process.env.DEBUG) {
      this._write(this._format('DEBUG', message));
    }
  }

  warn(message) {
    this._write(this._format('WARN', message));
  }
}

export { Logger };
