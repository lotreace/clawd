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
    this.port = this._parsePort(process.env.CLAWD_PORT);
    this.host = '127.0.0.1';
    this.modelFamily = modelFamily;
    this.models = MODEL_FAMILIES[modelFamily] || MODEL_FAMILIES['gpt-5'];
  }

  _parsePort(portEnv) {
    if (portEnv === undefined || portEnv === null || portEnv === '') {
      return 2001;
    }
    const parsed = parseInt(portEnv, 10);
    return parsed; // Return even if NaN - validation will catch it
  }

  validate() {
    const errors = [];

    if (!this.openaiApiKey) {
      errors.push('OPENAI_API_KEY environment variable is required');
    }

    if (this.port < 1 || this.port > 65535 || isNaN(this.port)) {
      errors.push(`Invalid port: ${this.port}. Must be between 1 and 65535`);
    }

    if (!MODEL_FAMILIES[this.modelFamily]) {
      const validFamilies = Object.keys(MODEL_FAMILIES).join(', ');
      errors.push(`Invalid model family: ${this.modelFamily}. Valid options: ${validFamilies}`);
    }

    if (this.openaiBaseUrl) {
      try {
        new URL(this.openaiBaseUrl);
      } catch {
        errors.push(`Invalid OPENAI_BASE_URL: ${this.openaiBaseUrl}. Must be a valid URL`);
      }
    }

    if (errors.length > 0) {
      throw new Error(errors.join('\n'));
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
