import { describe, it, expect } from 'vitest';
import { ToolTranslator } from '../../src/translators/ToolTranslator.js';

describe('ToolTranslator', () => {
  const translator = new ToolTranslator();

  describe('translateToolDefinitions', () => {
    it('should translate Anthropic tool definitions to OpenAI format', () => {
      const anthropicTools = [{
        name: 'get_weather',
        description: 'Get the weather for a city',
        input_schema: {
          type: 'object',
          properties: {
            city: { type: 'string' }
          },
          required: ['city']
        }
      }];

      const result = translator.translateToolDefinitions(anthropicTools);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get the weather for a city',
          parameters: {
            type: 'object',
            properties: {
              city: { type: 'string' }
            },
            required: ['city']
          }
        }
      });
    });

    it('should return undefined for null or empty tools', () => {
      expect(translator.translateToolDefinitions(null)).toBeUndefined();
      expect(translator.translateToolDefinitions(undefined)).toBeUndefined();
    });

    it('should handle tools without description', () => {
      const tools = [{ name: 'simple_tool', input_schema: { type: 'object' } }];
      const result = translator.translateToolDefinitions(tools);

      expect(result[0].function.description).toBe('');
    });
  });

  describe('translateToolChoice', () => {
    it('should translate "auto" choice', () => {
      expect(translator.translateToolChoice({ type: 'auto' })).toBe('auto');
    });

    it('should translate "any" to "required"', () => {
      expect(translator.translateToolChoice({ type: 'any' })).toBe('required');
    });

    it('should translate "none" choice', () => {
      expect(translator.translateToolChoice({ type: 'none' })).toBe('none');
    });

    it('should translate specific tool choice', () => {
      const result = translator.translateToolChoice({
        type: 'tool',
        name: 'get_weather'
      });

      expect(result).toEqual({
        type: 'function',
        function: { name: 'get_weather' }
      });
    });

    it('should return undefined for null choice', () => {
      expect(translator.translateToolChoice(null)).toBeUndefined();
    });
  });

  describe('translateToolCallsToAnthropic', () => {
    it('should translate OpenAI tool calls to Anthropic format', () => {
      const openaiToolCalls = [{
        id: 'call_123',
        type: 'function',
        function: {
          name: 'get_weather',
          arguments: '{"city":"London"}'
        }
      }];

      const result = translator.translateToolCallsToAnthropic(openaiToolCalls);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'tool_use',
        id: 'call_123',
        name: 'get_weather',
        input: { city: 'London' }
      });
    });

    it('should return empty array for null tool calls', () => {
      expect(translator.translateToolCallsToAnthropic(null)).toEqual([]);
    });

    it('should handle malformed JSON arguments gracefully', () => {
      const toolCalls = [{
        id: 'call_123',
        function: {
          name: 'test',
          arguments: 'not valid json'
        }
      }];

      const result = translator.translateToolCallsToAnthropic(toolCalls);

      expect(result[0].input).toEqual({});
    });
  });
});
