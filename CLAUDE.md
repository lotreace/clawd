# Clawd

A Node.js wrapper that enables Claude Code CLI to work with OpenAI-compatible APIs by translating between Anthropic's Messages API and OpenAI's Chat Completions API.

## Overview

Clawd acts as a local proxy server that:
1. Starts an Express server on `127.0.0.1:2001`
2. Intercepts requests from Claude Code CLI
3. Translates Anthropic Messages API format to OpenAI Chat Completions format
4. Forwards requests to an OpenAI-compatible endpoint
5. Translates responses back to Anthropic format
6. Supports full streaming for messages and tool use

## Quick Start

```bash
# First run - interactive setup wizard
clawd

# Subsequent runs - uses saved config
clawd -p "your prompt"

# usage of clawd and caude
clawd --help
```

On first run, clawd will prompt you to select:
1. **Provider**: OpenAI or Azure OpenAI
2. **Model family**: gpt-4o or gpt-5

Configuration is saved to `.clawd/config.json` in the current directory.

## Model Mapping

| Claude Model | gpt-4o Family | gpt-5 Family |
|--------------|---------------|--------------|
| Haiku        | gpt-4o-mini   | gpt-5-mini   |
| Sonnet       | gpt-4o        | gpt-5        |
| Opus         | gpt-4o        | gpt-5-high   |

For Azure, the same model names are used as default deployment names. Override with `AZURE_DEPLOYMENT_*` env vars if your deployment names differ.

## Environment Variables

### OpenAI

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Yes | - | Your OpenAI API key |
| `OPENAI_BASE_URL` | No | `https://api.openai.com/v1` | OpenAI-compatible endpoint |

### Azure OpenAI

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AZURE_OPENAI_ENDPOINT` | Yes | - | Azure OpenAI endpoint (e.g., `https://your-resource.openai.azure.com`) |
| `AZURE_OPENAI_API_KEY` | Yes | - | Azure OpenAI API key |
| `AZURE_DEPLOYMENT_HAIKU` | No | Model family haiku name | Override deployment name for Haiku-tier |
| `AZURE_DEPLOYMENT_SONNET` | No | Model family sonnet name | Override deployment name for Sonnet-tier |
| `AZURE_DEPLOYMENT_OPUS` | No | Model family opus name | Override deployment name for Opus-tier |
| `AZURE_API_VERSION` | No | `2024-02-15-preview` | Azure API version |

### Common

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CLAWD_PORT` | No | `2001` | Local server port |
| `CLAWD_LOG` | No | - | Log file path (logging disabled if not set) |

## Usage

### OpenAI

```bash
# Set your API key
export OPENAI_API_KEY=your-key-here

# Run clawd (first time: setup wizard, then launches Claude)
clawd

# Non-interactive mode
clawd -p "your prompt"

# All Claude Code arguments are passed through
clawd --help
```

### Azure OpenAI

```bash
# Set Azure configuration
export AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com"
export AZURE_OPENAI_API_KEY="your-azure-api-key"

# Run clawd (setup wizard will ask for model family)
clawd

# Optional: override deployment names if they differ from model names
export AZURE_DEPLOYMENT_HAIKU="custom-haiku-deployment"
export AZURE_DEPLOYMENT_SONNET="custom-sonnet-deployment"
export AZURE_DEPLOYMENT_OPUS="custom-opus-deployment"
```

## Configuration

Clawd stores configuration in `.clawd/config.json`:

```json
{
  "provider": "openai",
  "modelFamily": "gpt-4o"
}
```

Or for Azure:

```json
{
  "provider": "azure",
  "modelFamily": "gpt-4o"
}
```

To reconfigure, delete `.clawd/config.json` and run `clawd` again.

## Architecture

```
src/
├── main.js                    # Entry point
├── ClawdServer.js             # Express server setup
├── ClaudeLauncher.js          # Spawns Claude Code subprocess
├── config/
│   ├── Config.js              # Configuration and model families
│   └── ConfigStore.js         # Reads/writes .clawd/config.json
├── setup/
│   └── SetupWizard.js         # Interactive setup prompts
├── handlers/
│   └── MessagesHandler.js     # Request/response handling
├── hooks/
│   ├── HookRegistry.js        # Hook management
│   ├── ModelMappingHook.js    # Maps Claude models to OpenAI models
│   └── ThinkingModeHook.js    # Handles thinking mode translation
├── translators/
│   ├── RequestTranslator.js   # Anthropic → OpenAI request
│   ├── ResponseTranslator.js  # OpenAI → Anthropic response
│   └── StreamTranslator.js    # Streaming response translation
└── utils/
    └── Logger.js              # File logging utility
```

## Key Features

### Thinking Mode Translation

For gpt-5 models, Claude's thinking mode is translated to OpenAI's `reasoning_effort`:
- gpt-5-high: `reasoning_effort: "high"`
- gpt-5 with thinking: `reasoning_effort: "medium"`
- gpt-5 without thinking: `reasoning_effort: "low"`
- gpt-5-mini: No reasoning_effort (not supported)
- gpt-4o family: No reasoning_effort (not supported)

### Tool Use Support

Full support for Claude Code's tool use:
- Tool definitions translated to OpenAI function format
- Tool calls and results properly mapped
- Streaming tool use with incremental updates

## Contributing

### Setup

```bash
git clone <repo>
cd clawd
npm install
```

### Running Tests

```bash
npm test              # Run all tests
npm run test:unit     # Unit tests only
npm run test:integration  # Integration tests only
```

### Development

1. Make changes to files in `src/`
2. Test locally: `./bin/clawd.js -p "test prompt"`
3. Enable logging: `CLAWD_LOG=clawd.log ./bin/clawd.js -p "test"`
4. Run tests before submitting

### Code Style

- ES6 modules (`.js` with `"type": "module"`)
- OOP style - each class in its own file
- Class filename matches class name
- Use Logger for all logging (not console.log)
