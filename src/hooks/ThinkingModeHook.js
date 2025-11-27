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
      // Apply reasoning effort based on model tier
      if (model.includes('gpt-5-mini')) {
        // Haiku tier - skip reasoning for mini models
        this.logger.info('Skipping reasoning_effort for gpt-5-mini (Haiku)');
      } else if (model.includes('gpt-5-high')) {
        // Opus tier - always use high
        request.reasoning_effort = 'high';
        this.logger.info('Set reasoning_effort=high for gpt-5-high (Opus)');
      } else if (model.includes('gpt-5')) {
        // Sonnet tier - use configured effort
        const configuredEffort = this.config.reasoningEffort || 'low';
        if (configuredEffort !== 'none') {
          request.reasoning_effort = configuredEffort;
          this.logger.info(`Set reasoning_effort=${configuredEffort} for gpt-5 (Sonnet)`);
        } else {
          this.logger.info('Reasoning effort disabled (none) for gpt-5 (Sonnet)');
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
