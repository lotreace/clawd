import { appendFileSync } from 'fs';

let logFile = null;

class Logger {
  constructor(name) {
    this.name = name;
  }

  static setLogFile(path) {
    logFile = path;
  }

  _format(level, message) {
    const timestamp = new Date().toISOString();
    return `${timestamp} [${level}] ${this.name}: ${message}`;
  }

  _write(formatted) {
    if (logFile) {
      appendFileSync(logFile, formatted + '\n');
    } else {
      console.log(formatted);
    }
  }

  _writeError(formatted, error = null) {
    if (logFile) {
      appendFileSync(logFile, formatted + '\n');
      if (error) {
        appendFileSync(logFile, error.stack || String(error) + '\n');
      }
    } else {
      console.error(formatted);
      if (error) {
        console.error(error);
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
