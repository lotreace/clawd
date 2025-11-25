const MODEL_FAMILIES = {
  'gpt-5': {
    haiku: 'gpt-5-mini',
    sonnet: 'gpt-5',
    opus: 'gpt-5-high',
    supportsReasoning: true
  },
  'gpt-4o': {
    haiku: 'gpt-4o-mini',
    sonnet: 'gpt-4o',
    opus: 'gpt-4o',
    supportsReasoning: false,
    maxTokens: 16384
  }
};

class Config {
  constructor(modelFamily = 'gpt-5') {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.openaiBaseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    this.port = parseInt(process.env.CLAWD_PORT, 10) || 2001;
    this.host = '127.0.0.1';
    this.modelFamily = modelFamily;
    this.models = MODEL_FAMILIES[modelFamily] || MODEL_FAMILIES['gpt-5'];
  }

  validate() {
    if (!this.openaiApiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
  }

  getAnthropicEnvVars() {
    return {
      ANTHROPIC_BASE_URL: `http://${this.host}:${this.port}`,
      ANTHROPIC_AUTH_TOKEN: 'sk-clawd',
      ANTHROPIC_DEFAULT_HAIKU_MODEL: this.models.haiku,
      ANTHROPIC_DEFAULT_SONNET_MODEL: this.models.sonnet,
      ANTHROPIC_DEFAULT_OPUS_MODEL: this.models.opus
    };
  }
}

export { Config, MODEL_FAMILIES };
