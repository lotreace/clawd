import OpenAI, { AzureOpenAI } from 'openai';
import { RequestTranslator } from '../translators/RequestTranslator.js';
import { ResponseTranslator } from '../translators/ResponseTranslator.js';
import { StreamTranslator } from '../translators/StreamTranslator.js';
import { HookRegistry } from '../hooks/HookRegistry.js';
import { ModelMappingHook } from '../hooks/ModelMappingHook.js';
import { ThinkingModeHook } from '../hooks/ThinkingModeHook.js';
import { Logger } from '../utils/Logger.js';

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

class MessagesHandler {
  constructor(config) {
    this.config = config;
    this.logger = new Logger('MessagesHandler');
    this.requestTranslator = new RequestTranslator();
    this.responseTranslator = new ResponseTranslator();
    this.onFatalError = null; // Set by ClawdServer

    this.hookRegistry = new HookRegistry();
    this.hookRegistry.registerPreRequest(new ModelMappingHook(config));
    this.hookRegistry.registerPreRequest(new ThinkingModeHook(config));

    this.openai = this._createOpenAIClient(config);
  }

  _createOpenAIClient(config) {
    if (config.useAzure) {
      this.logger.info('Using Azure OpenAI client');
      // Explicitly set baseURL to undefined to prevent conflict with endpoint
      // The openai package may auto-detect OPENAI_BASE_URL from environment
      return new AzureOpenAI({
        apiKey: config.azureApiKey,
        endpoint: config.azureEndpoint,
        apiVersion: config.azureApiVersion,
        baseURL: undefined
      });
    } else {
      this.logger.info('Using standard OpenAI client');
      return new OpenAI({
        apiKey: config.openaiApiKey,
        baseURL: config.openaiBaseUrl
      });
    }
  }

  async handle(req, res) {
    try {
      const anthropicRequest = req.body;
      const originalModel = anthropicRequest.model;
      const headers = req.headers;

      this.logger.debug(`Received request for model: ${originalModel}`);

      let openaiRequest = this.requestTranslator.translate(anthropicRequest);

      openaiRequest = this.hookRegistry.executePreRequest(openaiRequest, headers);

      this.logger.debug(`Translated to OpenAI model: ${openaiRequest.model}`);

      if (anthropicRequest.stream) {
        await this._handleStreaming(res, openaiRequest, originalModel);
      } else {
        await this._handleNonStreaming(res, openaiRequest, originalModel);
      }
    } catch (error) {
      this._handleError(res, error);
    }
  }

  async _handleStreaming(res, openaiRequest, originalModel) {
    const streamTranslator = new StreamTranslator(res, originalModel);

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

    const anthropicResponse = this.responseTranslator.translate(
      openaiResponse,
      originalModel
    );

    res.json(anthropicResponse);
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
    this.logger.error('Request failed', error);

    const statusCode = this._getStatusCode(error);

    // 403 is fatal - notify main process to kill CLI
    if (statusCode === 403 && this.onFatalError) {
      this.onFatalError(error);
    }

    if (res.headersSent) {
      return;
    }

    const errorType = this._getErrorType(statusCode);

    res.status(statusCode).json({
      type: 'error',
      error: {
        type: errorType,
        message: error.message || 'An error occurred'
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

  _getErrorType(statusCode) {
    switch (statusCode) {
      case 400:
        return 'invalid_request_error';
      case 401:
        return 'authentication_error';
      case 403:
        return 'permission_error';
      case 404:
        return 'not_found_error';
      case 429:
        return 'rate_limit_error';
      default:
        return 'api_error';
    }
  }
}

export { MessagesHandler };
