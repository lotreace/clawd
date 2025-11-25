import express from 'express';
import { MessagesHandler } from './handlers/MessagesHandler.js';
import { HealthHandler } from './handlers/HealthHandler.js';
import { Logger } from './utils/Logger.js';

class ClawdServer {
  constructor(config) {
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
    const healthHandler = new HealthHandler();

    this.app.post('/v1/messages', (req, res) => messagesHandler.handle(req, res));

    this.app.get('/health', (req, res) => healthHandler.handle(req, res));

    this.app.get('/', (req, res) => {
      res.json({
        service: 'clawd',
        version: '1.0.0',
        endpoints: ['/v1/messages', '/health']
      });
    });
  }

  start() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.config.port, this.config.host, () => {
        this.logger.info(`Server listening on http://${this.config.host}:${this.config.port}`);
        resolve();
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
