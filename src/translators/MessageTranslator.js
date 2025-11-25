class MessageTranslator {
  translateToOpenAI(anthropicMessages, systemPrompt) {
    const openaiMessages = [];

    if (systemPrompt) {
      openaiMessages.push({
        role: 'system',
        content: this._translateSystemContent(systemPrompt)
      });
    }

    for (const msg of anthropicMessages) {
      const translated = this._translateMessage(msg);
      if (translated) {
        if (Array.isArray(translated)) {
          openaiMessages.push(...translated);
        } else {
          openaiMessages.push(translated);
        }
      }
    }

    return openaiMessages;
  }

  _translateSystemContent(systemPrompt) {
    if (typeof systemPrompt === 'string') {
      return systemPrompt;
    }
    if (Array.isArray(systemPrompt)) {
      return systemPrompt
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n');
    }
    return String(systemPrompt);
  }

  _translateMessage(msg) {
    const { role, content } = msg;

    if (role === 'user') {
      return this._translateUserMessage(content);
    }

    if (role === 'assistant') {
      return this._translateAssistantMessage(content);
    }

    return null;
  }

  _translateUserMessage(content) {
    if (typeof content === 'string') {
      return { role: 'user', content };
    }

    if (!Array.isArray(content)) {
      return { role: 'user', content: String(content) };
    }

    const messages = [];
    const userContentParts = [];
    const toolResults = [];

    for (const block of content) {
      if (block.type === 'text') {
        userContentParts.push({ type: 'text', text: block.text });
      } else if (block.type === 'image') {
        userContentParts.push(this._translateImageBlock(block));
      } else if (block.type === 'tool_result') {
        toolResults.push(block);
      }
    }

    for (const toolResult of toolResults) {
      messages.push({
        role: 'tool',
        tool_call_id: toolResult.tool_use_id,
        content: this._translateToolResultContent(toolResult.content)
      });
    }

    if (userContentParts.length > 0) {
      if (userContentParts.length === 1 && userContentParts[0].type === 'text') {
        messages.push({ role: 'user', content: userContentParts[0].text });
      } else {
        messages.push({ role: 'user', content: userContentParts });
      }
    }

    return messages.length === 1 ? messages[0] : messages;
  }

  _translateAssistantMessage(content) {
    if (typeof content === 'string') {
      return { role: 'assistant', content };
    }

    if (!Array.isArray(content)) {
      return { role: 'assistant', content: String(content) };
    }

    let textContent = '';
    const toolCalls = [];

    for (const block of content) {
      if (block.type === 'text') {
        textContent += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          type: 'function',
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input)
          }
        });
      }
    }

    const message = { role: 'assistant' };

    if (textContent) {
      message.content = textContent;
    } else {
      message.content = null;
    }

    if (toolCalls.length > 0) {
      message.tool_calls = toolCalls;
    }

    return message;
  }

  _translateImageBlock(block) {
    const { source } = block;

    if (source.type === 'base64') {
      return {
        type: 'image_url',
        image_url: {
          url: `data:${source.media_type};base64,${source.data}`
        }
      };
    }

    if (source.type === 'url') {
      return {
        type: 'image_url',
        image_url: { url: source.url }
      };
    }

    return { type: 'text', text: '[Unsupported image format]' };
  }

  _translateToolResultContent(content) {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n');
    }

    return String(content);
  }
}

export { MessageTranslator };
