import { EventEmitter } from 'events';
import express from 'express';
import { MessagesHandler } from './handlers/MessagesHandler.js';
import { GeminiHandler } from './handlers/GeminiHandler.js';
import { HealthHandler } from './handlers/HealthHandler.js';
import { Logger } from './utils/Logger.js';

class ClawdServer extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.logger = new Logger('ClawdServer');
    this.app = express();
    this.server = null;

    this._setupMiddleware();
    this._setupRoutes();
  }

  _setupMiddleware() {
    this.app.use(express.json({ limit: '50mb' }));
  }

  _setupRoutes() {
    const messagesHandler = new MessagesHandler(this.config);
    const geminiHandler = new GeminiHandler(this.config);
    const healthHandler = new HealthHandler();

    // Pass fatal error handler to handlers
    const onFatalError = (error) => this.emit('fatal', error);
    messagesHandler.onFatalError = onFatalError;
    geminiHandler.onFatalError = onFatalError;

    // Anthropic/Claude endpoints
    this.app.post('/v1/messages', (req, res) => messagesHandler.handle(req, res));

    // Gemini endpoints
    this.app.post('/v1beta/models/:model\\:generateContent', (req, res) => geminiHandler.handleGenerateContent(req, res));
    this.app.post('/v1beta/models/:model\\:streamGenerateContent', (req, res) => geminiHandler.handleStreamGenerateContent(req, res));

    this.app.get('/health', (req, res) => healthHandler.handle(req, res));

    this.app.get('/', (req, res) => {
      res.json({
        service: 'clawd',
        version: '1.0.0',
        endpoints: ['/v1/messages', '/v1beta/models/:model:generateContent', '/v1beta/models/:model:streamGenerateContent', '/health']
      });
    });
  }

  start() {
    return this._tryListen(this.config.port);
  }

  _tryListen(port, maxAttempts = 100) {
    return new Promise((resolve, reject) => {
      const attemptedPort = port;

      if (port - this.config.port >= maxAttempts) {
        reject(new Error(`Could not find free port after ${maxAttempts} attempts`));
        return;
      }

      this.server = this.app.listen(port, this.config.host, () => {
        this.config.port = port; // Update config with actual port
        this.logger.info(`Server listening on http://${this.config.host}:${port}`);
        resolve();
      });

      this.server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          this.logger.info(`Port ${attemptedPort} in use, trying ${attemptedPort + 1}...`);
          this.server = null;
          this._tryListen(port + 1, maxAttempts).then(resolve).catch(reject);
        } else {
          this.logger.error('Server error', error);
          reject(error);
        }
      });
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.logger.info('Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

export { ClawdServer };
