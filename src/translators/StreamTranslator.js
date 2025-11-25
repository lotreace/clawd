import { StreamState } from '../streaming/StreamState.js';
import { AnthropicStreamBuilder } from '../streaming/AnthropicStreamBuilder.js';
import { SSEWriter } from '../utils/SSEWriter.js';

class StreamTranslator {
  constructor(res, originalModel) {
    this.sseWriter = new SSEWriter(res);
    this.state = new StreamState();
    this.messageId = this._generateMessageId();
    this.builder = new AnthropicStreamBuilder(this.messageId, originalModel);
    this.originalModel = originalModel;
    this._textBlockClosed = false;
  }

  async processStream(openaiStream) {
    try {
      for await (const chunk of openaiStream) {
        this._processChunk(chunk);
      }
      this._finalize();
    } catch (error) {
      this._handleError(error);
    }
  }

  _processChunk(chunk) {
    if (!this.state.messageStartSent) {
      this._emitMessageStart(chunk);
    }

    const choice = chunk.choices?.[0];
    if (!choice) {
      return;
    }

    const delta = choice.delta;
    if (!delta) {
      return;
    }

    if (delta.content) {
      this._processTextDelta(delta.content);
    }

    if (delta.tool_calls) {
      this._processToolCalls(delta.tool_calls);
    }

    if (choice.finish_reason) {
      this._processFinishReason(choice.finish_reason);
    }

    if (chunk.usage) {
      this.state.setUsage(chunk.usage.prompt_tokens, chunk.usage.completion_tokens);
    }
  }

  _emitMessageStart(chunk) {
    const inputTokens = chunk.usage?.prompt_tokens || 0;
    const event = this.builder.buildMessageStart(inputTokens);
    this.sseWriter.writeEvent('message_start', event);
    this.state.markMessageStartSent();
    this.state.setUsage(inputTokens, 0);
  }

  _processTextDelta(text) {
    const isFirstText = this.state.startTextBlock();
    if (isFirstText) {
      const event = this.builder.buildContentBlockStart(
        this.state.getTextBlockIndex(),
        'text'
      );
      this.sseWriter.writeEvent('content_block_start', event);
    }

    this.state.appendText(text);
    const event = this.builder.buildTextDelta(
      this.state.getTextBlockIndex(),
      text
    );
    this.sseWriter.writeEvent('content_block_delta', event);
  }

  _processToolCalls(toolCalls) {
    for (const tc of toolCalls) {
      const toolIndex = tc.index;

      if (tc.id) {
        if (this.state.hasTextBlock() && !this._textBlockClosed) {
          const stopEvent = this.builder.buildContentBlockStop(
            this.state.getTextBlockIndex()
          );
          this.sseWriter.writeEvent('content_block_stop', stopEvent);
          this._textBlockClosed = true;
        }

        const blockIndex = this.state.startToolCall(toolIndex, tc.id, tc.function?.name || '');
        const startEvent = this.builder.buildContentBlockStart(blockIndex, 'tool_use', {
          id: tc.id,
          name: tc.function?.name || ''
        });
        this.sseWriter.writeEvent('content_block_start', startEvent);
      }

      if (tc.function?.arguments) {
        this.state.appendToolArguments(toolIndex, tc.function.arguments);
        const tool = this.state.getToolCall(toolIndex);
        if (tool) {
          const deltaEvent = this.builder.buildInputJsonDelta(
            tool.blockIndex,
            tc.function.arguments
          );
          this.sseWriter.writeEvent('content_block_delta', deltaEvent);
        }
      }
    }
  }

  _processFinishReason(finishReason) {
    if (this.state.hasTextBlock() && !this._textBlockClosed) {
      const stopEvent = this.builder.buildContentBlockStop(
        this.state.getTextBlockIndex()
      );
      this.sseWriter.writeEvent('content_block_stop', stopEvent);
      this._textBlockClosed = true;
    }

    for (const tool of this.state.getAllToolCalls()) {
      const stopEvent = this.builder.buildContentBlockStop(tool.blockIndex);
      this.sseWriter.writeEvent('content_block_stop', stopEvent);
    }

    const stopReason = this.builder.translateStopReason(finishReason);
    const usage = this.state.getUsage();
    const deltaEvent = this.builder.buildMessageDelta(stopReason, usage.output_tokens);
    this.sseWriter.writeEvent('message_delta', deltaEvent);
  }

  _finalize() {
    const stopEvent = this.builder.buildMessageStop();
    this.sseWriter.writeEvent('message_stop', stopEvent);
    this.sseWriter.end();
  }

  _handleError(error) {
    const errorEvent = {
      type: 'error',
      error: {
        type: 'api_error',
        message: error.message || 'Stream error'
      }
    };
    this.sseWriter.writeEvent('error', errorEvent);
    this.sseWriter.end();
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

export { StreamTranslator };
