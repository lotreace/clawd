import OpenAI, { AzureOpenAI } from 'openai';
import { GeminiRequestTranslator } from '../translators/GeminiRequestTranslator.js';
import { GeminiResponseTranslator } from '../translators/GeminiResponseTranslator.js';
import { GeminiStreamTranslator } from '../translators/GeminiStreamTranslator.js';
import { Logger } from '../utils/Logger.js';

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

const GEMINI_MODEL_MAPPING = {
  // Pro models -> Sonnet tier (main models)
  'gemini-2.5-pro': { 'gpt-4o': 'gpt-4o', 'gpt-5': 'gpt-5' },
  'gemini-1.5-pro': { 'gpt-4o': 'gpt-4o', 'gpt-5': 'gpt-5' },
  // Flash models -> Haiku tier (mini models)
  'gemini-2.5-flash': { 'gpt-4o': 'gpt-4o-mini', 'gpt-5': 'gpt-5-mini' },
  'gemini-2.5-flash-lite': { 'gpt-4o': 'gpt-4o-mini', 'gpt-5': 'gpt-5-mini' },
  'gemini-2.0-flash': { 'gpt-4o': 'gpt-4o-mini', 'gpt-5': 'gpt-5-mini' },
  'gemini-1.5-flash': { 'gpt-4o': 'gpt-4o-mini', 'gpt-5': 'gpt-5-mini' }
};

class GeminiHandler {
  constructor(config) {
    this.config = config;
    this.logger = new Logger('GeminiHandler');
    this.requestTranslator = new GeminiRequestTranslator();
    this.responseTranslator = new GeminiResponseTranslator();
    this.openai = this._createOpenAIClient(config);
  }

  _createOpenAIClient(config) {
    if (config.useAzure) {
      this.logger.info('Using Azure OpenAI client for Gemini');
      return new AzureOpenAI({
        apiKey: config.azureApiKey,
        endpoint: config.azureEndpoint,
        apiVersion: config.azureApiVersion,
        baseURL: undefined
      });
    } else {
      this.logger.info('Using standard OpenAI client for Gemini');
      return new OpenAI({
        apiKey: config.openaiApiKey,
        baseURL: config.openaiBaseUrl
      });
    }
  }

  async handleGenerateContent(req, res) {
    try {
      const geminiModel = req.params.model;
      const geminiRequest = req.body;

      this.logger.debug(`Received Gemini request for model: ${geminiModel}`);

      const openaiModel = this._mapModel(geminiModel);
      let openaiRequest = this.requestTranslator.translate(geminiRequest, openaiModel);

      // Apply reasoning mode and strip unsupported params for gpt-5
      openaiRequest = this._applyReasoningMode(openaiRequest);

      this.logger.debug(`Translated to OpenAI model: ${openaiRequest.model}`);

      await this._handleNonStreaming(res, openaiRequest, geminiModel);
    } catch (error) {
      this._handleError(res, error);
    }
  }

  async handleStreamGenerateContent(req, res) {
    try {
      const geminiModel = req.params.model;
      const geminiRequest = req.body;

      this.logger.debug(`Received Gemini streaming request for model: ${geminiModel}`);

      const openaiModel = this._mapModel(geminiModel);
      let openaiRequest = this.requestTranslator.translate(geminiRequest, openaiModel);
      openaiRequest.stream = true;
      openaiRequest.stream_options = { include_usage: true };

      // Apply reasoning mode and strip unsupported params for gpt-5
      openaiRequest = this._applyReasoningMode(openaiRequest);

      this.logger.debug(`Translated to OpenAI model: ${openaiRequest.model}`);

      await this._handleStreaming(res, openaiRequest, geminiModel);
    } catch (error) {
      this._handleError(res, error);
    }
  }

  _mapModel(geminiModel) {
    const mapping = GEMINI_MODEL_MAPPING[geminiModel];
    if (mapping) {
      return mapping[this.config.modelFamily] || this.config.models.sonnet;
    }
    return this.config.models.sonnet;
  }

  _applyReasoningMode(request) {
    const model = request.model || '';
    const supportsReasoning = this.config.models.supportsReasoning;

    if (!supportsReasoning) {
      // gpt-4o family - no changes needed, supports top_p and temperature
      if (this.config.models.maxTokens && request.max_completion_tokens > this.config.models.maxTokens) {
        this.logger.info(`Capping max_completion_tokens to ${this.config.models.maxTokens}`);
        request.max_completion_tokens = this.config.models.maxTokens;
      }
      return request;
    }

    // gpt-5 family - strip unsupported params and apply reasoning
    delete request.top_p;
    delete request.temperature;
    this.logger.info('Stripped top_p and temperature for gpt-5 model');

    // Apply reasoning effort based on model tier
    if (model.includes('gpt-5-mini')) {
      // Haiku tier - skip reasoning for mini models
      this.logger.info('Skipping reasoning_effort for gpt-5-mini');
    } else if (model.includes('gpt-5-high')) {
      // Opus tier - always use high
      request.reasoning_effort = 'high';
      this.logger.info('Set reasoning_effort=high for gpt-5-high');
    } else if (model.includes('gpt-5')) {
      // Sonnet tier - use configured effort
      const configuredEffort = this.config.reasoningEffort || 'low';
      if (configuredEffort !== 'none') {
        request.reasoning_effort = configuredEffort;
        this.logger.info(`Set reasoning_effort=${configuredEffort} for gpt-5`);
      }
    }

    return request;
  }

  async _handleStreaming(res, openaiRequest, originalModel) {
    const streamTranslator = new GeminiStreamTranslator(res, originalModel);

    const stream = await this.openai.chat.completions.create({
      ...openaiRequest,
      stream: true
    });

    await streamTranslator.processStream(stream);
  }

  async _handleNonStreaming(res, openaiRequest, originalModel) {
    const openaiResponse = await this._executeWithRetry(async () => {
      return await this.openai.chat.completions.create({
        ...openaiRequest,
        stream: false
      });
    });

    const geminiResponse = this.responseTranslator.translate(
      openaiResponse,
      originalModel
    );

    res.json(geminiResponse);
  }

  async _executeWithRetry(fn) {
    let lastError;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (!this._isRetryable(error)) {
          throw error;
        }

        const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        this.logger.warn(`Request failed (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${backoffMs}ms...`, {
          status: error.status,
          message: error.message
        });

        await this._sleep(backoffMs);
      }
    }

    throw lastError;
  }

  _isRetryable(error) {
    const status = error.status || error.response?.status;
    return status === 429 || (status >= 500 && status < 600);
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _handleError(res, error) {
    this.logger.error('Gemini request failed', error);

    if (res.headersSent) {
      return;
    }

    const statusCode = this._getStatusCode(error);

    res.status(statusCode).json({
      error: {
        code: statusCode,
        message: error.message || 'An error occurred',
        status: this._getGeminiErrorStatus(statusCode)
      }
    });
  }

  _getStatusCode(error) {
    if (error.status) {
      return error.status;
    }
    if (error.response?.status) {
      return error.response.status;
    }
    return 500;
  }

  _getGeminiErrorStatus(statusCode) {
    switch (statusCode) {
      case 400:
        return 'INVALID_ARGUMENT';
      case 401:
        return 'UNAUTHENTICATED';
      case 403:
        return 'PERMISSION_DENIED';
      case 404:
        return 'NOT_FOUND';
      case 429:
        return 'RESOURCE_EXHAUSTED';
      default:
        return 'INTERNAL';
    }
  }
}

export { GeminiHandler };
