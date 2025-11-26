# Clawd

Run [Claude Code CLI](https://github.com/anthropics/claude-code) with OpenAI or Azure OpenAI backends.

Clawd is a local proxy that translates between Anthropic's Messages API and OpenAI's Chat Completions API, allowing you to use Claude Code with GPT models.

## Installation

```bash
npm install -g clawd
```

Or run directly:

```bash
npx clawd
```

## Quick Start

### OpenAI

```bash
# Set your API key
export OPENAI_API_KEY=sk-...

# Run clawd
clawd
```

### Azure OpenAI

```bash
# Set Azure credentials
export AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com"
export AZURE_OPENAI_API_KEY="your-api-key"

# Run clawd
clawd
```

On first run, clawd will prompt you to select:
1. **Provider**: OpenAI or Azure OpenAI
2. **Model family**: gpt-4o or gpt-5

Your selection is saved to `.clawd/config.json`. To reconfigure, delete this file and run clawd again.

## Model Mapping

Claude Code requests different model tiers. Clawd maps them to OpenAI models:

| Claude Tier | gpt-4o Family | gpt-5 Family |
|-------------|---------------|--------------|
| Haiku       | gpt-4o-mini   | gpt-5-mini   |
| Sonnet      | gpt-4o        | gpt-5        |
| Opus        | gpt-4o        | gpt-5-high   |

## Environment Variables

### OpenAI

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | Your OpenAI API key |
| `OPENAI_BASE_URL` | No | Custom endpoint (default: `https://api.openai.com/v1`) |

### Azure OpenAI

| Variable | Required | Description |
|----------|----------|-------------|
| `AZURE_OPENAI_ENDPOINT` | Yes | Azure OpenAI endpoint URL |
| `AZURE_OPENAI_API_KEY` | Yes | Azure OpenAI API key |
| `AZURE_DEPLOYMENT_HAIKU` | No | Override Haiku deployment name |
| `AZURE_DEPLOYMENT_SONNET` | No | Override Sonnet deployment name |
| `AZURE_DEPLOYMENT_OPUS` | No | Override Opus deployment name |
| `AZURE_API_VERSION` | No | API version (default: `2024-02-15-preview`) |

For Azure, deployment names default to the model names from your selected family (e.g., `gpt-4o`, `gpt-4o-mini`). Use the override variables if your deployment names differ.

### Common

| Variable | Required | Description |
|----------|----------|-------------|
| `CLAWD_PORT` | No | Proxy port (default: `2001`) |
| `CLAWD_LOG` | No | Enable logging to specified file |

## Usage Examples

```bash
# Interactive mode
clawd

# Non-interactive with prompt
clawd -p "explain this codebase"

# Enable debug logging
CLAWD_LOG=clawd.log clawd

# Use custom port
CLAWD_PORT=3000 clawd

# Pass any Claude Code arguments
clawd --help
clawd --version
```

## How It Works

1. Clawd starts a local proxy server on `127.0.0.1:2001`
2. It launches Claude Code CLI pointed at this proxy
3. Requests from Claude Code are translated to OpenAI format
4. Responses are translated back to Anthropic format
5. Full streaming support for messages and tool use

## Features

- **Interactive setup wizard** - Easy first-time configuration
- **Model family selection** - Choose between gpt-4o and gpt-5 families
- **Azure support** - Works with Azure OpenAI Service
- **Thinking mode** - Translates Claude's thinking to OpenAI's reasoning_effort (gpt-5 only)
- **Tool use** - Full support for Claude Code's tools (Read, Write, Bash, etc.)
- **Streaming** - Real-time streaming for all responses

## Troubleshooting

### "OPENAI_API_KEY environment variable is required"

Set your API key:
```bash
export OPENAI_API_KEY=sk-...
```

### "AZURE_OPENAI_ENDPOINT environment variable is required"

Set your Azure credentials:
```bash
export AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com"
export AZURE_OPENAI_API_KEY="your-api-key"
```

### Reconfigure provider or model

Delete the config file and run again:
```bash
rm -rf .clawd
clawd
```

### Enable debug logging

```bash
CLAWD_LOG=clawd.log clawd
cat clawd.log
```

## License

MIT
