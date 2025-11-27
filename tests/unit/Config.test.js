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
      expect(config.modelFamily).toBe('gpt-4o');
      expect(config.openaiBaseUrl).toBe('https://api.openai.com/v1');
      expect(config.useAzure).toBe(false);
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

    it('should fall back to gpt-4o for unknown model family', () => {
      const config = new Config('unknown-family');

      expect(config.models).toEqual(MODEL_FAMILIES['gpt-4o']);
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

  describe('Azure configuration', () => {
    beforeEach(() => {
      delete process.env.OPENAI_API_KEY;
      process.env.AZURE_OPENAI_ENDPOINT = 'https://test-resource.openai.azure.com';
      process.env.AZURE_OPENAI_API_KEY = 'azure-test-key';
    });

    it('should enable Azure mode when useAzure is true', () => {
      const config = new Config('gpt-4o', true);

      expect(config.useAzure).toBe(true);
      expect(config.azureEndpoint).toBe('https://test-resource.openai.azure.com');
      expect(config.azureApiKey).toBe('azure-test-key');
    });

    it('should use default API version', () => {
      const config = new Config('gpt-4o', true);

      expect(config.azureApiVersion).toBe('2024-02-15-preview');
    });

    it('should use custom API version from environment', () => {
      process.env.AZURE_API_VERSION = '2024-06-01';

      const config = new Config('gpt-4o', true);

      expect(config.azureApiVersion).toBe('2024-06-01');
    });

    it('should use model names as default deployment names', () => {
      const config = new Config('gpt-4o', true);

      expect(config.models.haiku).toBe('gpt-4o-mini');
      expect(config.models.sonnet).toBe('gpt-4o');
      expect(config.models.opus).toBe('gpt-4o');
    });

    it('should allow overriding deployment names via env vars', () => {
      process.env.AZURE_DEPLOYMENT_HAIKU = 'custom-haiku';
      process.env.AZURE_DEPLOYMENT_SONNET = 'custom-sonnet';
      process.env.AZURE_DEPLOYMENT_OPUS = 'custom-opus';

      const config = new Config('gpt-4o', true);

      expect(config.models.haiku).toBe('custom-haiku');
      expect(config.models.sonnet).toBe('custom-sonnet');
      expect(config.models.opus).toBe('custom-opus');
    });

    it('should pass validation with valid Azure config', () => {
      const config = new Config('gpt-4o', true);

      expect(() => config.validate()).not.toThrow();
    });

    it('should fail validation without Azure endpoint', () => {
      delete process.env.AZURE_OPENAI_ENDPOINT;

      const config = new Config('gpt-4o', true);

      expect(() => config.validate()).toThrow('AZURE_OPENAI_ENDPOINT');
    });

    it('should fail validation without Azure API key', () => {
      delete process.env.AZURE_OPENAI_API_KEY;

      const config = new Config('gpt-4o', true);

      expect(() => config.validate()).toThrow('AZURE_OPENAI_API_KEY');
    });

    it('should fail validation with invalid Azure endpoint URL', () => {
      process.env.AZURE_OPENAI_ENDPOINT = 'not-a-valid-url';

      const config = new Config('gpt-4o', true);

      expect(() => config.validate()).toThrow('Invalid AZURE_OPENAI_ENDPOINT');
    });

    it('should not require OPENAI_API_KEY in Azure mode', () => {
      const config = new Config('gpt-4o', true);

      expect(() => config.validate()).not.toThrow();
    });

    it('should use gpt-5 model names for Azure when gpt-5 family selected', () => {
      const config = new Config('gpt-5', true);

      expect(config.models.haiku).toBe('gpt-5-mini');
      expect(config.models.sonnet).toBe('gpt-5');
      expect(config.models.opus).toBe('gpt-5-high');
    });
  });

  describe('hasRequiredEnvVars', () => {
    it('should return true when OpenAI API key is set', () => {
      const config = new Config();

      expect(config.hasRequiredEnvVars()).toBe(true);
    });

    it('should return false when OpenAI API key is missing', () => {
      delete process.env.OPENAI_API_KEY;

      const config = new Config();

      expect(config.hasRequiredEnvVars()).toBe(false);
    });

    it('should return true when Azure credentials are set', () => {
      delete process.env.OPENAI_API_KEY;
      process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com';
      process.env.AZURE_OPENAI_API_KEY = 'azure-key';

      const config = new Config('gpt-4o', true);

      expect(config.hasRequiredEnvVars()).toBe(true);
    });

    it('should return false when Azure credentials are missing', () => {
      delete process.env.OPENAI_API_KEY;

      const config = new Config('gpt-4o', true);

      expect(config.hasRequiredEnvVars()).toBe(false);
    });
  });

  describe('reasoning effort', () => {
    it('should use default reasoning effort of low', () => {
      const config = new Config();

      expect(config.reasoningEffort).toBe('low');
    });

    it('should accept valid reasoning effort values', () => {
      const validEfforts = ['none', 'minimal', 'low', 'medium', 'high'];

      for (const effort of validEfforts) {
        const config = new Config('gpt-4o', false, effort);
        expect(config.reasoningEffort).toBe(effort);
        expect(() => config.validate()).not.toThrow();
      }
    });

    it('should fail validation with invalid reasoning effort', () => {
      const config = new Config('gpt-4o', false, 'invalid');

      expect(() => config.validate()).toThrow('Invalid reasoning effort');
    });
  });
});
