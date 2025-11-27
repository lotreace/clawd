class GeminiResponseTranslator {
  translate(openaiResponse, originalModel) {
    const choice = openaiResponse.choices?.[0];
    if (!choice) {
      throw new Error('No choices in OpenAI response');
    }

    const message = choice.message;
    const parts = this._buildParts(message);

    return {
      candidates: [{
        content: {
          parts,
          role: 'model'
        },
        finishReason: this._translateFinishReason(choice.finish_reason),
        index: 0,
        safetyRatings: []
      }],
      usageMetadata: this._translateUsage(openaiResponse.usage),
      modelVersion: originalModel
    };
  }

  _buildParts(message) {
    const parts = [];

    if (message.content) {
      parts.push({ text: message.content });
    }

    if (message.tool_calls && message.tool_calls.length > 0) {
      for (const toolCall of message.tool_calls) {
        parts.push({
          functionCall: {
            name: toolCall.function.name,
            args: JSON.parse(toolCall.function.arguments || '{}')
          }
        });
      }
    }

    if (parts.length === 0) {
      parts.push({ text: '' });
    }

    return parts;
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

  _translateUsage(openaiUsage) {
    if (!openaiUsage) {
      return {
        promptTokenCount: 0,
        candidatesTokenCount: 0,
        totalTokenCount: 0
      };
    }

    const promptTokens = openaiUsage.prompt_tokens || 0;
    const completionTokens = openaiUsage.completion_tokens || 0;

    return {
      promptTokenCount: promptTokens,
      candidatesTokenCount: completionTokens,
      totalTokenCount: promptTokens + completionTokens
    };
  }
}

export { GeminiResponseTranslator };
