import { Logger } from '../utils/Logger.js';

class ThinkingModeHook {
  constructor(config) {
    this.config = config;
    this.logger = new Logger('ThinkingModeHook');
  }

  execute(request, headers) {
    const anthropicBeta = headers['anthropic-beta'] || '';
    const hasInterleavedThinking = anthropicBeta.includes('interleaved-thinking');
    const model = request.model || '';
    const supportsReasoning = this.config.models.supportsReasoning;

    this.logger.info(`Model: ${model}, anthropic-beta: ${anthropicBeta}, supportsReasoning: ${supportsReasoning}`);

    if (!supportsReasoning) {
      this.logger.info(`Skipping reasoning_effort for ${this.config.modelFamily} (not supported)`);
      if (this.config.models.maxTokens && request.max_completion_tokens > this.config.models.maxTokens) {
        this.logger.info(`Capping max_completion_tokens to ${this.config.models.maxTokens}`);
        request.max_completion_tokens = this.config.models.maxTokens;
      }
    } else {
      if (model.includes('gpt-5-high')) {
        request.reasoning_effort = 'high';
        this.logger.info('Set reasoning_effort=high for gpt-5-high (Opus)');
      } else if (model.includes('gpt-5-mini')) {
        this.logger.info('Skipping reasoning_effort for gpt-5-mini (Haiku)');
      } else if (model.includes('gpt-5')) {
        if (hasInterleavedThinking) {
          request.reasoning_effort = 'medium';
          this.logger.info('Set reasoning_effort=medium for gpt-5 (Sonnet, thinking mode)');
        } else {
          request.reasoning_effort = 'low';
          this.logger.info('Set reasoning_effort=low for gpt-5 (Sonnet, normal mode)');
        }
      }

      const thinking = request.thinking;
      if (thinking) {
        this.logger.info(`Found 'thinking' parameter: ${JSON.stringify(thinking)}`);
        if (typeof thinking === 'object' && thinking.type === 'enabled') {
          if (model.includes('gpt-5') && !model.includes('gpt-5-mini') && !model.includes('gpt-5-high')) {
            request.reasoning_effort = 'medium';
            this.logger.info('Set reasoning_effort=medium for gpt-5 (Sonnet with explicit thinking)');
          }
        }
      }
    }

    if (request.thinking) {
      delete request.thinking;
      this.logger.info('Removed thinking parameter from request');
    }

    return request;
  }
}

export { ThinkingModeHook };
