import OpenAI from 'openai';
import { RequestTranslator } from '../translators/RequestTranslator.js';
import { ResponseTranslator } from '../translators/ResponseTranslator.js';
import { StreamTranslator } from '../translators/StreamTranslator.js';
import { HookRegistry } from '../hooks/HookRegistry.js';
import { ModelMappingHook } from '../hooks/ModelMappingHook.js';
import { ThinkingModeHook } from '../hooks/ThinkingModeHook.js';
import { Logger } from '../utils/Logger.js';

class MessagesHandler {
  constructor(config) {
    this.config = config;
    this.logger = new Logger('MessagesHandler');
    this.requestTranslator = new RequestTranslator();
    this.responseTranslator = new ResponseTranslator();

    this.hookRegistry = new HookRegistry();
    this.hookRegistry.registerPreRequest(new ModelMappingHook(config));
    this.hookRegistry.registerPreRequest(new ThinkingModeHook(config));

    this.openai = new OpenAI({
      apiKey: config.openaiApiKey,
      baseURL: config.openaiBaseUrl
    });
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
    const openaiResponse = await this.openai.chat.completions.create({
      ...openaiRequest,
      stream: false
    });

    const anthropicResponse = this.responseTranslator.translate(
      openaiResponse,
      originalModel
    );

    res.json(anthropicResponse);
  }

  _handleError(res, error) {
    this.logger.error('Request failed', error);

    if (res.headersSent) {
      return;
    }

    const statusCode = this._getStatusCode(error);
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
