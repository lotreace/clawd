class AnthropicStreamBuilder {
  constructor(messageId, model) {
    this.messageId = messageId;
    this.model = model;
  }

  buildMessageStart(inputTokens = 0) {
    return {
      type: 'message_start',
      message: {
        id: this.messageId,
        type: 'message',
        role: 'assistant',
        model: this.model,
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: {
          input_tokens: inputTokens,
          output_tokens: 0
        }
      }
    };
  }

  buildContentBlockStart(index, blockType, options = {}) {
    if (blockType === 'text') {
      return {
        type: 'content_block_start',
        index,
        content_block: {
          type: 'text',
          text: ''
        }
      };
    }

    if (blockType === 'tool_use') {
      return {
        type: 'content_block_start',
        index,
        content_block: {
          type: 'tool_use',
          id: options.id,
          name: options.name,
          input: {}
        }
      };
    }

    throw new Error(`Unknown block type: ${blockType}`);
  }

  buildTextDelta(index, text) {
    return {
      type: 'content_block_delta',
      index,
      delta: {
        type: 'text_delta',
        text
      }
    };
  }

  buildInputJsonDelta(index, partialJson) {
    return {
      type: 'content_block_delta',
      index,
      delta: {
        type: 'input_json_delta',
        partial_json: partialJson
      }
    };
  }

  buildContentBlockStop(index) {
    return {
      type: 'content_block_stop',
      index
    };
  }

  buildMessageDelta(stopReason, outputTokens = 0) {
    return {
      type: 'message_delta',
      delta: {
        stop_reason: stopReason,
        stop_sequence: null
      },
      usage: {
        output_tokens: outputTokens
      }
    };
  }

  buildMessageStop() {
    return {
      type: 'message_stop'
    };
  }

  translateStopReason(finishReason) {
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
}

export { AnthropicStreamBuilder };
