import { MessageTranslator } from './MessageTranslator.js';
import { ToolTranslator } from './ToolTranslator.js';

class RequestTranslator {
  constructor() {
    this.messageTranslator = new MessageTranslator();
    this.toolTranslator = new ToolTranslator();
  }

  translate(anthropicRequest) {
    const openaiRequest = {
      model: anthropicRequest.model,
      messages: this.messageTranslator.translateToOpenAI(
        anthropicRequest.messages,
        anthropicRequest.system
      ),
      stream: anthropicRequest.stream || false
    };

    if (anthropicRequest.max_tokens) {
      openaiRequest.max_completion_tokens = anthropicRequest.max_tokens;
    }

    if (anthropicRequest.temperature !== undefined) {
      openaiRequest.temperature = anthropicRequest.temperature;
    }

    if (anthropicRequest.top_p !== undefined) {
      openaiRequest.top_p = anthropicRequest.top_p;
    }

    if (anthropicRequest.stop_sequences) {
      openaiRequest.stop = anthropicRequest.stop_sequences;
    }

    if (anthropicRequest.tools) {
      const tools = this.toolTranslator.translateToolDefinitions(anthropicRequest.tools);
      if (tools && tools.length > 0) {
        openaiRequest.tools = tools;
      }
    }

    if (anthropicRequest.tool_choice) {
      const toolChoice = this.toolTranslator.translateToolChoice(anthropicRequest.tool_choice);
      if (toolChoice) {
        openaiRequest.tool_choice = toolChoice;
      }
    }

    if (openaiRequest.stream) {
      openaiRequest.stream_options = { include_usage: true };
    }

    return openaiRequest;
  }
}

export { RequestTranslator };
