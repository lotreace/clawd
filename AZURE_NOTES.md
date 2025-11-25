# Azure OpenAI Integration Notes

This document describes how to modify clawd to support Azure OpenAI endpoints.

## Overview

Azure OpenAI uses a different URL structure and authentication mechanism than the standard OpenAI API. The main differences are:

1. **URL Structure**: Azure uses deployment-based URLs instead of model names in the request body
2. **Authentication**: Azure uses API keys in the `api-key` header instead of `Authorization: Bearer`
3. **API Version**: Azure requires an `api-version` query parameter

## Environment Variables to Add

Add these new environment variables to `src/config/Config.js`:

```javascript
// Azure-specific configuration
this.azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;     // e.g., https://your-resource.openai.azure.com
this.azureApiKey = process.env.AZURE_OPENAI_API_KEY;
this.azureApiVersion = process.env.AZURE_API_VERSION || '2024-02-15-preview';
this.azureDeployments = {
  haiku: process.env.AZURE_DEPLOYMENT_HAIKU || 'gpt-4o-mini',
  sonnet: process.env.AZURE_DEPLOYMENT_SONNET || 'gpt-4o',
  opus: process.env.AZURE_DEPLOYMENT_OPUS || 'gpt-4o'
};
this.useAzure = !!this.azureEndpoint;  // Auto-detect Azure mode
```

## Files to Modify

### 1. `src/config/Config.js`

Add Azure configuration properties and validation:

```javascript
class Config {
  constructor(modelFamily = 'gpt-5') {
    // Existing config...

    // Azure configuration
    this.azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
    this.azureApiKey = process.env.AZURE_OPENAI_API_KEY;
    this.azureApiVersion = process.env.AZURE_API_VERSION || '2024-02-15-preview';
    this.useAzure = !!this.azureEndpoint;

    // Azure deployment names (map Claude tiers to Azure deployments)
    this.azureDeployments = {
      haiku: process.env.AZURE_DEPLOYMENT_HAIKU,
      sonnet: process.env.AZURE_DEPLOYMENT_SONNET,
      opus: process.env.AZURE_DEPLOYMENT_OPUS
    };
  }

  validate() {
    const errors = [];

    if (this.useAzure) {
      // Azure validation
      if (!this.azureApiKey) {
        errors.push('AZURE_OPENAI_API_KEY is required when using Azure');
      }
      if (!this.azureDeployments.sonnet) {
        errors.push('AZURE_DEPLOYMENT_SONNET is required (at minimum)');
      }
    } else {
      // Standard OpenAI validation
      if (!this.openaiApiKey) {
        errors.push('OPENAI_API_KEY environment variable is required');
      }
    }

    // ... rest of validation
  }
}
```

### 2. `src/handlers/MessagesHandler.js`

Modify the OpenAI client initialization to support Azure:

```javascript
import { AzureOpenAI } from 'openai';

class MessagesHandler {
  constructor(config) {
    this.config = config;
    // ... existing code ...

    if (config.useAzure) {
      this.openai = new AzureOpenAI({
        apiKey: config.azureApiKey,
        endpoint: config.azureEndpoint,
        apiVersion: config.azureApiVersion,
        deployment: config.azureDeployments.sonnet  // Default deployment
      });
    } else {
      this.openai = new OpenAI({
        apiKey: config.openaiApiKey,
        baseURL: config.openaiBaseUrl
      });
    }
  }
}
```

### 3. `src/hooks/ModelMappingHook.js`

Add Azure deployment mapping:

```javascript
class ModelMappingHook {
  execute(request, headers) {
    const model = request.model;
    let targetModel;

    if (this.config.useAzure) {
      // For Azure, we need deployment names instead of model names
      targetModel = this._mapToAzureDeployment(model);
    } else {
      targetModel = this._mapToOpenAIModel(model);
    }

    return { ...request, model: targetModel };
  }

  _mapToAzureDeployment(model) {
    if (model.includes('haiku')) {
      return this.config.azureDeployments.haiku || this.config.azureDeployments.sonnet;
    }
    if (model.includes('opus')) {
      return this.config.azureDeployments.opus || this.config.azureDeployments.sonnet;
    }
    return this.config.azureDeployments.sonnet;
  }
}
```

### 4. Create Azure-specific bin script

Create `bin/clawdaz.js` for Azure:

```javascript
#!/usr/bin/env node
import { main } from '../src/main.js';

// Azure uses gpt-4o compatible deployments
main('gpt-4o');
```

## Azure OpenAI SDK Usage

The `openai` npm package (v4+) has built-in Azure support via `AzureOpenAI`:

```javascript
import { AzureOpenAI } from 'openai';

const client = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiVersion: '2024-02-15-preview',
  deployment: 'your-deployment-name'
});

// Usage is identical to standard OpenAI
const response = await client.chat.completions.create({
  model: 'gpt-4o',  // This is ignored when deployment is set
  messages: [{ role: 'user', content: 'Hello' }]
});
```

## Azure URL Structure

Standard OpenAI:
```
POST https://api.openai.com/v1/chat/completions
```

Azure OpenAI:
```
POST https://{resource}.openai.azure.com/openai/deployments/{deployment}/chat/completions?api-version={version}
```

The `AzureOpenAI` class handles this URL construction automatically.

## Testing Azure Integration

1. Set up environment variables:
```bash
export AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com"
export AZURE_OPENAI_API_KEY="your-azure-api-key"
export AZURE_DEPLOYMENT_SONNET="your-gpt4o-deployment"
export AZURE_API_VERSION="2024-02-15-preview"
```

2. Run clawd:
```bash
./bin/clawdaz.js -p "say hello"
```

## Key Differences to Handle

| Aspect | Standard OpenAI | Azure OpenAI |
|--------|----------------|--------------|
| Auth Header | `Authorization: Bearer sk-...` | `api-key: ...` |
| Base URL | `https://api.openai.com/v1` | `https://{resource}.openai.azure.com` |
| Model Selection | `model` field in request body | URL path (`/deployments/{name}`) |
| API Version | Not required | Required query param |
| Rate Limits | Per-key | Per-deployment |

## Implementation Checklist

- [ ] Add Azure environment variables to Config.js
- [ ] Add Azure validation in Config.validate()
- [ ] Import and use AzureOpenAI in MessagesHandler.js
- [ ] Update ModelMappingHook to map to Azure deployments
- [ ] Create bin/clawdaz.js entry point
- [ ] Add Azure deployment mapping to MODEL_FAMILIES or create AZURE_DEPLOYMENTS
- [ ] Update CLAUDE.md with Azure usage instructions
- [ ] Add Azure-specific tests
- [ ] Test streaming with Azure (same API, should work)
- [ ] Test tool calls with Azure deployments

## Notes

- Azure deployments must be created in the Azure portal before use
- Each deployment is tied to a specific model version
- Azure has different rate limiting (per deployment, not per key)
- Content filtering is enabled by default on Azure and may block some requests
- The `AzureOpenAI` class from the openai package handles all Azure-specific URL construction and headers
