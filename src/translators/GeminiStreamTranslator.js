class GeminiStreamTranslator {
  constructor(res, originalModel) {
    this.res = res;
    this.originalModel = originalModel;
    this.accumulatedText = '';
    this.accumulatedToolCalls = [];
    this.usage = { promptTokenCount: 0, candidatesTokenCount: 0 };
  }

  async processStream(openaiStream) {
    // Gemini streaming uses Server-Sent Events format
    this.res.setHeader('Content-Type', 'text/event-stream');
    this.res.setHeader('Cache-Control', 'no-cache');
    this.res.setHeader('Connection', 'keep-alive');

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
    const choice = chunk.choices?.[0];
    if (!choice) return;

    const delta = choice.delta;
    if (!delta) return;

    if (delta.content) {
      this.accumulatedText += delta.content;
      this._emitChunk(delta.content, null, choice.finish_reason);
    }

    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        const toolIndex = tc.index;

        if (!this.accumulatedToolCalls[toolIndex]) {
          this.accumulatedToolCalls[toolIndex] = {
            name: tc.function?.name || '',
            args: ''
          };
        }

        if (tc.function?.name) {
          this.accumulatedToolCalls[toolIndex].name = tc.function.name;
        }

        if (tc.function?.arguments) {
          this.accumulatedToolCalls[toolIndex].args += tc.function.arguments;
        }
      }
    }

    if (chunk.usage) {
      this.usage.promptTokenCount = chunk.usage.prompt_tokens || 0;
      this.usage.candidatesTokenCount = chunk.usage.completion_tokens || 0;
    }

    if (choice.finish_reason) {
      this._emitFinalChunk(choice.finish_reason);
    }
  }

  _emitChunk(text, toolCalls, finishReason) {
    const parts = [];

    if (text) {
      parts.push({ text });
    }

    const chunk = {
      candidates: [{
        content: {
          parts,
          role: 'model'
        },
        index: 0
      }]
    };

    this._writeChunk(chunk);
  }

  _emitFinalChunk(finishReason) {
    const parts = [];

    if (this.accumulatedToolCalls.length > 0) {
      for (const tc of this.accumulatedToolCalls) {
        if (tc && tc.name) {
          let args = {};
          try {
            args = JSON.parse(tc.args || '{}');
          } catch {
            args = {};
          }
          parts.push({
            functionCall: {
              name: tc.name,
              args
            }
          });
        }
      }
    }

    const chunk = {
      candidates: [{
        content: {
          parts: parts.length > 0 ? parts : [{ text: '' }],
          role: 'model'
        },
        finishReason: this._translateFinishReason(finishReason),
        index: 0
      }],
      usageMetadata: {
        promptTokenCount: this.usage.promptTokenCount,
        candidatesTokenCount: this.usage.candidatesTokenCount,
        totalTokenCount: this.usage.promptTokenCount + this.usage.candidatesTokenCount
      },
      modelVersion: this.originalModel
    };

    this._writeChunk(chunk);
  }

  _translateFinishReason(finishReason) {
    switch (finishReason) {
      case 'stop':
        return 'STOP';
      case 'tool_calls':
        return 'STOP';
      case 'length':
        return 'MAX_TOKENS';
      case 'content_filter':
        return 'SAFETY';
      default:
        return 'STOP';
    }
  }

  _writeChunk(data) {
    // Gemini SSE format: "data: {json}\n\n"
    this.res.write('data: ' + JSON.stringify(data) + '\n\n');
  }

  _finalize() {
    this.res.end();
  }

  _handleError(error) {
    const errorResponse = {
      error: {
        code: 500,
        message: error.message || 'Stream error',
        status: 'INTERNAL'
      }
    };
    this.res.write('data: ' + JSON.stringify(errorResponse) + '\n\n');
    this.res.end();
  }
}

export { GeminiStreamTranslator };
