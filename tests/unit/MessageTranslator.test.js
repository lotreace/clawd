import { describe, it, expect } from 'vitest';
import { MessageTranslator } from '../../src/translators/MessageTranslator.js';

describe('MessageTranslator', () => {
  const translator = new MessageTranslator();

  describe('translateToOpenAI', () => {
    it('should translate simple text messages', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ];

      const result = translator.translateToOpenAI(messages, null);

      expect(result).toEqual([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ]);
    });

    it('should include system prompt as first message', () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      const systemPrompt = 'You are a helpful assistant.';

      const result = translator.translateToOpenAI(messages, systemPrompt);

      expect(result[0]).toEqual({
        role: 'system',
        content: 'You are a helpful assistant.'
      });
    });

    it('should handle array system prompts', () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      const systemPrompt = [
        { type: 'text', text: 'Line 1' },
        { type: 'text', text: 'Line 2' }
      ];

      const result = translator.translateToOpenAI(messages, systemPrompt);

      expect(result[0].content).toBe('Line 1\nLine 2');
    });

    it('should translate user messages with content blocks', () => {
      const messages = [{
        role: 'user',
        content: [
          { type: 'text', text: 'What is this?' }
        ]
      }];

      const result = translator.translateToOpenAI(messages, null);

      expect(result[0]).toEqual({
        role: 'user',
        content: 'What is this?'
      });
    });

    it('should translate assistant messages with tool calls', () => {
      const messages = [{
        role: 'assistant',
        content: [
          { type: 'text', text: 'Let me check that.' },
          {
            type: 'tool_use',
            id: 'tool_123',
            name: 'get_weather',
            input: { city: 'London' }
          }
        ]
      }];

      const result = translator.translateToOpenAI(messages, null);

      expect(result[0].role).toBe('assistant');
      expect(result[0].content).toBe('Let me check that.');
      expect(result[0].tool_calls).toHaveLength(1);
      expect(result[0].tool_calls[0]).toEqual({
        id: 'tool_123',
        type: 'function',
        function: {
          name: 'get_weather',
          arguments: '{"city":"London"}'
        }
      });
    });

    it('should translate tool_result blocks to tool messages', () => {
      const messages = [{
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tool_123',
            content: 'The weather is sunny.'
          }
        ]
      }];

      const result = translator.translateToOpenAI(messages, null);

      expect(result[0]).toEqual({
        role: 'tool',
        tool_call_id: 'tool_123',
        content: 'The weather is sunny.'
      });
    });

    it('should translate image blocks', () => {
      const messages = [{
        role: 'user',
        content: [
          { type: 'text', text: 'What is in this image?' },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: 'abc123'
            }
          }
        ]
      }];

      const result = translator.translateToOpenAI(messages, null);

      expect(result[0].content).toHaveLength(2);
      expect(result[0].content[1]).toEqual({
        type: 'image_url',
        image_url: { url: 'data:image/png;base64,abc123' }
      });
    });

    it('should translate URL image blocks', () => {
      const messages = [{
        role: 'user',
        content: [{
          type: 'image',
          source: {
            type: 'url',
            url: 'https://example.com/image.png'
          }
        }]
      }];

      const result = translator.translateToOpenAI(messages, null);

      expect(result[0].content[0]).toEqual({
        type: 'image_url',
        image_url: { url: 'https://example.com/image.png' }
      });
    });
  });
});
