class GeminiRequestTranslator {
  translate(geminiRequest, modelFromPath) {
    // First pass: collect all function calls to build name->id mapping
    const toolCallIdMap = this._buildToolCallIdMap(geminiRequest.contents || []);

    const openaiRequest = {
      model: modelFromPath || 'gpt-4o',
      messages: this._translateContents(geminiRequest.contents || [], toolCallIdMap),
      stream: false
    };

    if (geminiRequest.generationConfig) {
      this._applyGenerationConfig(openaiRequest, geminiRequest.generationConfig);
    }

    if (geminiRequest.tools) {
      openaiRequest.tools = this._translateTools(geminiRequest.tools);
    }

    if (geminiRequest.systemInstruction) {
      openaiRequest.messages.unshift({
        role: 'system',
        content: this._extractText(geminiRequest.systemInstruction.parts)
      });
    }

    return openaiRequest;
  }

  _buildToolCallIdMap(contents) {
    // Build a map of function name -> tool call id
    // This ensures function responses can reference the correct ID
    const map = new Map();
    let callIndex = 0;

    for (const content of contents) {
      if (content.parts) {
        for (const part of content.parts) {
          if (part.functionCall) {
            // Use a deterministic ID based on call index
            const id = `call_${callIndex++}_${part.functionCall.name}`;
            map.set(part.functionCall.name, id);
          }
        }
      }
    }

    return map;
  }

  _translateContents(contents, toolCallIdMap) {
    const messages = [];

    for (const content of contents) {
      const role = this._translateRole(content.role);
      const message = { role };

      if (content.parts) {
        const contentParts = this._translateParts(content.parts, toolCallIdMap);
        if (contentParts.toolCalls) {
          message.tool_calls = contentParts.toolCalls;
          if (contentParts.text) {
            message.content = contentParts.text;
          }
        } else if (contentParts.toolResponses && contentParts.toolResponses.length > 0) {
          // Handle multiple tool responses - each becomes its own message
          for (const toolResponse of contentParts.toolResponses) {
            messages.push({
              role: 'tool',
              tool_call_id: toolResponse.id,
              content: toolResponse.content
            });
          }
          continue; // Skip the normal message push
        } else {
          message.content = contentParts.text || '';
        }
      }

      messages.push(message);
    }

    return messages;
  }

  _translateRole(geminiRole) {
    switch (geminiRole) {
      case 'user':
        return 'user';
      case 'model':
        return 'assistant';
      case 'function':
        return 'tool';
      default:
        return 'user';
    }
  }

  _translateParts(parts, toolCallIdMap) {
    const textParts = [];
    let toolCalls = null;
    let toolResponses = null;

    for (const part of parts) {
      if (part.text !== undefined) {
        textParts.push(part.text);
      } else if (part.functionCall) {
        if (!toolCalls) toolCalls = [];
        // Use the pre-computed ID from the map
        const id = toolCallIdMap.get(part.functionCall.name) || `call_${part.functionCall.name}`;
        toolCalls.push({
          id,
          type: 'function',
          function: {
            name: part.functionCall.name,
            arguments: JSON.stringify(part.functionCall.args || {})
          }
        });
      } else if (part.functionResponse) {
        if (!toolResponses) toolResponses = [];
        // Look up the ID from the map using function name
        const id = toolCallIdMap.get(part.functionResponse.name) || `call_${part.functionResponse.name}`;
        toolResponses.push({
          id,
          content: JSON.stringify(part.functionResponse.response || {})
        });
      }
    }

    return {
      text: textParts.join(''),
      toolCalls,
      toolResponses
    };
  }

  _extractText(parts) {
    if (!parts) return '';
    return parts.map(p => p.text || '').join('');
  }

  _applyGenerationConfig(openaiRequest, config) {
    if (config.maxOutputTokens) {
      openaiRequest.max_completion_tokens = config.maxOutputTokens;
    }

    if (config.temperature !== undefined) {
      openaiRequest.temperature = config.temperature;
    }

    if (config.topP !== undefined) {
      openaiRequest.top_p = config.topP;
    }

    if (config.stopSequences) {
      openaiRequest.stop = config.stopSequences;
    }
  }

  _translateTools(tools) {
    const openaiTools = [];

    for (const tool of tools) {
      if (tool.functionDeclarations) {
        for (const fn of tool.functionDeclarations) {
          openaiTools.push({
            type: 'function',
            function: {
              name: fn.name,
              description: fn.description || '',
              parameters: fn.parameters || { type: 'object', properties: {} }
            }
          });
        }
      }
    }

    return openaiTools;
  }

}

export { GeminiRequestTranslator };
