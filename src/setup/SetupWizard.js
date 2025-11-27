import { select } from '@inquirer/prompts';

class SetupWizard {
  constructor(configStore) {
    this.configStore = configStore;
  }

  async run(existingConfig = null) {
    console.log('\n┌─────────────────────────────────────────────────┐');
    console.log('│  Clawd Setup                                    │');
    console.log('└─────────────────────────────────────────────────┘\n');

    const provider = await this._selectProvider(existingConfig?.provider);
    const modelFamily = await this._selectModelFamily(existingConfig?.modelFamily);

    let reasoningEffort = null;
    if (modelFamily === 'gpt-5') {
      reasoningEffort = await this._selectReasoningEffort(existingConfig?.reasoningEffort);
    }

    const config = { provider, modelFamily, reasoningEffort };
    this.configStore.save(config);

    this._printSummary(config);

    return config;
  }

  async _selectProvider(defaultValue) {
    return await select({
      message: 'Select your API provider:',
      default: defaultValue,
      choices: [
        {
          name: 'OpenAI',
          value: 'openai',
          description: 'Use OpenAI API directly'
        },
        {
          name: 'Azure OpenAI',
          value: 'azure',
          description: 'Use Azure OpenAI Service'
        }
      ]
    });
  }

  async _selectModelFamily(defaultValue) {
    return await select({
      message: 'Select model family:',
      default: defaultValue,
      choices: [
        {
          name: 'gpt-4o',
          value: 'gpt-4o',
          description: 'gpt-4o, gpt-4o-mini'
        },
        {
          name: 'gpt-5',
          value: 'gpt-5',
          description: 'gpt-5, gpt-5-mini, gpt-5-high (with reasoning)'
        }
      ]
    });
  }

  async _selectReasoningEffort(defaultValue) {
    return await select({
      message: 'Select reasoning effort for Sonnet (gpt-5):',
      default: defaultValue || 'low',
      choices: [
        {
          name: 'none',
          value: 'none',
          description: 'Disabled - no reasoning tokens'
        },
        {
          name: 'minimal',
          value: 'minimal',
          description: 'Fastest - few or no reasoning tokens'
        },
        {
          name: 'low',
          value: 'low',
          description: 'Quick responses, minimal reasoning (default)'
        },
        {
          name: 'medium',
          value: 'medium',
          description: 'Balanced depth and speed'
        },
        {
          name: 'high',
          value: 'high',
          description: 'Maximum reasoning depth'
        }
      ]
    });
  }

  _printSummary(config) {
    console.log('\n┌─────────────────────────────────────────────────┐');
    console.log('│  Configuration saved                            │');
    console.log('└─────────────────────────────────────────────────┘\n');

    console.log(`  Config file: ${this.configStore.getConfigPath()}`);
    console.log(`  Provider:    ${config.provider}`);
    console.log(`  Model:       ${config.modelFamily}`);
    if (config.reasoningEffort) {
      console.log(`  Reasoning:   ${config.reasoningEffort} (Sonnet only, Opus always uses high)`);
    }

    if (config.provider === 'openai') {
      this._printEnvStatus('OPENAI_API_KEY', process.env.OPENAI_API_KEY);
      if (process.env.OPENAI_BASE_URL) {
        console.log(`  Base URL:    ${process.env.OPENAI_BASE_URL}`);
      }
    } else {
      this._printEnvStatus('AZURE_OPENAI_ENDPOINT', process.env.AZURE_OPENAI_ENDPOINT);
      this._printEnvStatus('AZURE_OPENAI_API_KEY', process.env.AZURE_OPENAI_API_KEY);
    }

    console.log('');
  }

  _printEnvStatus(varName, value) {
    if (value) {
      const masked = this._maskValue(value);
      console.log(`  ${varName}: ${masked}`);
    } else {
      console.log(`  ${varName}: \x1b[33m(not set)\x1b[0m`);
    }
  }

  _maskValue(value) {
    if (!value) return '(not set)';
    if (value.length <= 10) return value;
    return value.substring(0, 10) + '...';
  }
}

export { SetupWizard };
