class ToolTranslator {
  translateToolDefinitions(anthropicTools) {
    if (!anthropicTools || !Array.isArray(anthropicTools)) {
      return undefined;
    }

    return anthropicTools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description || '',
        parameters: tool.input_schema || { type: 'object', properties: {} }
      }
    }));
  }

  translateToolChoice(anthropicChoice) {
    if (!anthropicChoice) {
      return undefined;
    }

    if (typeof anthropicChoice === 'string') {
      return anthropicChoice;
    }

    switch (anthropicChoice.type) {
      case 'auto':
        return 'auto';
      case 'any':
        return 'required';
      case 'none':
        return 'none';
      case 'tool':
        return {
          type: 'function',
          function: { name: anthropicChoice.name }
        };
      default:
        return 'auto';
    }
  }

  translateToolCallsToAnthropic(openaiToolCalls) {
    if (!openaiToolCalls || !Array.isArray(openaiToolCalls)) {
      return [];
    }

    return openaiToolCalls.map(tc => ({
      type: 'tool_use',
      id: tc.id,
      name: tc.function.name,
      input: this._parseArguments(tc.function.arguments)
    }));
  }

  _parseArguments(args) {
    if (!args) {
      return {};
    }

    if (typeof args === 'object') {
      return args;
    }

    try {
      return JSON.parse(args);
    } catch {
      return {};
    }
  }
}

export { ToolTranslator };
