import { ToolTranslator } from './ToolTranslator.js';

class ResponseTranslator {
  constructor() {
    this.toolTranslator = new ToolTranslator();
  }

  translate(openaiResponse, originalModel) {
    const choice = openaiResponse.choices?.[0];
    if (!choice) {
      throw new Error('No choices in OpenAI response');
    }

    const message = choice.message;
    const content = this._buildContentBlocks(message);

    return {
      id: this._generateMessageId(),
      type: 'message',
      role: 'assistant',
      model: originalModel,
      content,
      stop_reason: this._translateStopReason(choice.finish_reason),
      stop_sequence: null,
      usage: this._translateUsage(openaiResponse.usage)
    };
  }

  _buildContentBlocks(message) {
    const blocks = [];

    if (message.content) {
      blocks.push({
        type: 'text',
        text: message.content
      });
    }

    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolUseBlocks = this.toolTranslator.translateToolCallsToAnthropic(message.tool_calls);
      blocks.push(...toolUseBlocks);
    }

    return blocks;
  }

  _translateStopReason(finishReason) {
    switch (finishReason) {
      case 'stop':
        return 'end_turn';
      case 'tool_calls':
        return 'tool_use';
      case 'length':
        return 'max_tokens';
      case 'content_filter':
        return 'end_turn';
      default:
        return 'end_turn';
    }
  }

  _translateUsage(openaiUsage) {
    if (!openaiUsage) {
      return { input_tokens: 0, output_tokens: 0 };
    }

    return {
      input_tokens: openaiUsage.prompt_tokens || 0,
      output_tokens: openaiUsage.completion_tokens || 0
    };
  }

  _generateMessageId() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = 'msg_';
    for (let i = 0; i < 24; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }
}

export { ResponseTranslator };
