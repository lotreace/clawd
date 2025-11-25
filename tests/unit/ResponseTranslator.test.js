import { describe, it, expect } from 'vitest';
import { ResponseTranslator } from '../../src/translators/ResponseTranslator.js';

describe('ResponseTranslator', () => {
  const translator = new ResponseTranslator();

  describe('translate', () => {
    it('should translate a simple text response', () => {
      const openaiResponse = {
        id: 'chatcmpl-123',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Hello!' },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5
        }
      };

      const result = translator.translate(openaiResponse, 'claude-3-sonnet');

      expect(result.type).toBe('message');
      expect(result.role).toBe('assistant');
      expect(result.model).toBe('claude-3-sonnet');
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toEqual({ type: 'text', text: 'Hello!' });
      expect(result.stop_reason).toBe('end_turn');
      expect(result.usage).toEqual({ input_tokens: 10, output_tokens: 5 });
    });

    it('should translate tool call responses', () => {
      const openaiResponse = {
        choices: [{
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'call_123',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: '{"city":"London"}'
              }
            }]
          },
          finish_reason: 'tool_calls'
        }],
        usage: { prompt_tokens: 20, completion_tokens: 15 }
      };

      const result = translator.translate(openaiResponse, 'claude-3-sonnet');

      expect(result.stop_reason).toBe('tool_use');
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toEqual({
        type: 'tool_use',
        id: 'call_123',
        name: 'get_weather',
        input: { city: 'London' }
      });
    });

    it('should handle text and tool calls together', () => {
      const openaiResponse = {
        choices: [{
          message: {
            role: 'assistant',
            content: 'Let me check the weather.',
            tool_calls: [{
              id: 'call_456',
              type: 'function',
              function: { name: 'get_weather', arguments: '{}' }
            }]
          },
          finish_reason: 'tool_calls'
        }],
        usage: { prompt_tokens: 10, completion_tokens: 20 }
      };

      const result = translator.translate(openaiResponse, 'claude-3-sonnet');

      expect(result.content).toHaveLength(2);
      expect(result.content[0].type).toBe('text');
      expect(result.content[1].type).toBe('tool_use');
    });

    it('should translate length finish_reason to max_tokens', () => {
      const openaiResponse = {
        choices: [{
          message: { role: 'assistant', content: 'Partial...' },
          finish_reason: 'length'
        }],
        usage: { prompt_tokens: 100, completion_tokens: 4096 }
      };

      const result = translator.translate(openaiResponse, 'claude-3-sonnet');

      expect(result.stop_reason).toBe('max_tokens');
    });

    it('should throw error when no choices', () => {
      const openaiResponse = { choices: [] };

      expect(() => translator.translate(openaiResponse, 'model'))
        .toThrow('No choices in OpenAI response');
    });

    it('should generate unique message IDs', () => {
      const response = {
        choices: [{
          message: { content: 'Test' },
          finish_reason: 'stop'
        }],
        usage: {}
      };

      const result1 = translator.translate(response, 'model');
      const result2 = translator.translate(response, 'model');

      expect(result1.id).toMatch(/^msg_/);
      expect(result1.id).not.toBe(result2.id);
    });
  });
});
