import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Config, MODEL_FAMILIES } from '../../src/config/Config.js';

describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should use default values', () => {
      const config = new Config();

      expect(config.port).toBe(2001);
      expect(config.host).toBe('127.0.0.1');
      expect(config.modelFamily).toBe('gpt-5');
      expect(config.openaiBaseUrl).toBe('https://api.openai.com/v1');
    });

    it('should use custom port from environment', () => {
      process.env.CLAWD_PORT = '3000';

      const config = new Config();

      expect(config.port).toBe(3000);
    });

    it('should use custom base URL from environment', () => {
      process.env.OPENAI_BASE_URL = 'https://custom.api.com/v1';

      const config = new Config();

      expect(config.openaiBaseUrl).toBe('https://custom.api.com/v1');
    });

    it('should support gpt-5 model family', () => {
      const config = new Config('gpt-5');

      expect(config.models.haiku).toBe('gpt-5-mini');
      expect(config.models.sonnet).toBe('gpt-5');
      expect(config.models.opus).toBe('gpt-5-high');
      expect(config.models.supportsReasoning).toBe(true);
    });

    it('should support gpt-4o model family', () => {
      const config = new Config('gpt-4o');

      expect(config.models.haiku).toBe('gpt-4o-mini');
      expect(config.models.sonnet).toBe('gpt-4o');
      expect(config.models.opus).toBe('gpt-4o');
      expect(config.models.supportsReasoning).toBe(false);
    });

    it('should fall back to gpt-5 for unknown model family', () => {
      const config = new Config('unknown-family');

      expect(config.models).toEqual(MODEL_FAMILIES['gpt-5']);
    });
  });

  describe('validate', () => {
    it('should pass with valid configuration', () => {
      const config = new Config();

      expect(() => config.validate()).not.toThrow();
    });

    it('should fail without API key', () => {
      delete process.env.OPENAI_API_KEY;

      const config = new Config();

      expect(() => config.validate()).toThrow('OPENAI_API_KEY');
    });

    it('should fail with invalid port - too low', () => {
      process.env.CLAWD_PORT = '0';

      const config = new Config();

      expect(() => config.validate()).toThrow('Invalid port');
    });

    it('should fail with invalid port - too high', () => {
      process.env.CLAWD_PORT = '70000';

      const config = new Config();

      expect(() => config.validate()).toThrow('Invalid port');
    });

    it('should fail with invalid port - NaN', () => {
      process.env.CLAWD_PORT = 'not-a-number';

      const config = new Config();

      expect(() => config.validate()).toThrow('Invalid port');
    });

    it('should fail with invalid model family', () => {
      const config = new Config('invalid-model');

      expect(() => config.validate()).toThrow('Invalid model family');
    });

    it('should fail with invalid base URL', () => {
      process.env.OPENAI_BASE_URL = 'not-a-url';

      const config = new Config();

      expect(() => config.validate()).toThrow('Invalid OPENAI_BASE_URL');
    });

    it('should collect multiple errors', () => {
      delete process.env.OPENAI_API_KEY;
      process.env.CLAWD_PORT = '-1';

      const config = new Config('invalid');

      expect(() => config.validate()).toThrow(/OPENAI_API_KEY.*Invalid port.*Invalid model family/s);
    });
  });

  describe('getAnthropicEnvVars', () => {
    it('should return environment variables for Claude', () => {
      const config = new Config('gpt-5');

      const envVars = config.getAnthropicEnvVars();

      expect(envVars.ANTHROPIC_BASE_URL).toBe('http://127.0.0.1:2001');
      expect(envVars.ANTHROPIC_AUTH_TOKEN).toBe('sk-clawd');
      expect(envVars.ANTHROPIC_DEFAULT_HAIKU_MODEL).toBe('gpt-5-mini');
      expect(envVars.ANTHROPIC_DEFAULT_SONNET_MODEL).toBe('gpt-5');
      expect(envVars.ANTHROPIC_DEFAULT_OPUS_MODEL).toBe('gpt-5-high');
    });

    it('should use configured port', () => {
      process.env.CLAWD_PORT = '3001';

      const config = new Config();
      const envVars = config.getAnthropicEnvVars();

      expect(envVars.ANTHROPIC_BASE_URL).toBe('http://127.0.0.1:3001');
    });
  });
});
