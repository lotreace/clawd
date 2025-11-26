import { Logger } from '../utils/Logger.js';

class ModelMappingHook {
  constructor(config) {
    this.config = config;
    this.logger = new Logger('ModelMappingHook');
  }

  execute(request, headers) {
    const model = (request.model || '').toLowerCase();
    const models = this.config.models;

    if (model.includes('opus')) {
      request.model = models.opus;
    } else if (model.includes('sonnet')) {
      request.model = models.sonnet;
    } else if (model.includes('haiku')) {
      request.model = models.haiku;
    }

    const mode = this.config.useAzure ? 'Azure deployment' : 'OpenAI model';
    this.logger.info(`Mapped to ${mode}: ${request.model}`);
    return request;
  }
}

export { ModelMappingHook };
