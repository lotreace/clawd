class StreamState {
  constructor() {
    this.messageStartSent = false;
    this.currentBlockIndex = -1;
    this.textBlockStarted = false;
    this.textBlockIndex = -1;
    this.activeToolCalls = new Map();
    this.accumulatedText = '';
    this.inputTokens = 0;
    this.outputTokens = 0;
  }

  markMessageStartSent() {
    this.messageStartSent = true;
  }

  startTextBlock() {
    if (!this.textBlockStarted) {
      this.currentBlockIndex++;
      this.textBlockIndex = this.currentBlockIndex;
      this.textBlockStarted = true;
      return true;
    }
    return false;
  }

  appendText(text) {
    this.accumulatedText += text;
  }

  startToolCall(index, id, name) {
    this.currentBlockIndex++;
    this.activeToolCalls.set(index, {
      blockIndex: this.currentBlockIndex,
      id,
      name,
      arguments: ''
    });
    return this.currentBlockIndex;
  }

  appendToolArguments(index, args) {
    const tool = this.activeToolCalls.get(index);
    if (tool) {
      tool.arguments += args;
    }
  }

  getToolCall(index) {
    return this.activeToolCalls.get(index);
  }

  hasTextBlock() {
    return this.textBlockStarted;
  }

  getTextBlockIndex() {
    return this.textBlockIndex;
  }

  getAllToolCalls() {
    return Array.from(this.activeToolCalls.values());
  }

  setUsage(inputTokens, outputTokens) {
    if (inputTokens !== undefined) {
      this.inputTokens = inputTokens;
    }
    if (outputTokens !== undefined) {
      this.outputTokens = outputTokens;
    }
  }

  getUsage() {
    return {
      input_tokens: this.inputTokens,
      output_tokens: this.outputTokens
    };
  }
}

export { StreamState };
