# Clawd

Run [Claude Code CLI](https://github.com/anthropics/claude-code) or [Gemini CLI](https://github.com/google-gemini/gemini-cli) with OpenAI or Azure OpenAI backends.

Clawd is a local proxy that translates between Anthropic/Gemini APIs and OpenAI's Chat Completions API, allowing you to use Claude Code or Gemini CLI with GPT models.

## Installation

```bash
npm install -g @lotreace/clawd
```

Then run:

```bash
clawd
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

## Gemini CLI Support

Use the `--gemini` flag to launch Gemini CLI instead of Claude Code:

```bash
# Run with Gemini CLI
clawd --gemini

# Non-interactive with prompt
clawd --gemini "explain this codebase"
```

## Model Mapping

### Claude Code

Claude Code requests different model tiers. Clawd maps them to OpenAI models:

| Claude Tier | gpt-4o Family | gpt-5 Family |
|-------------|---------------|--------------|
| Haiku       | gpt-4o-mini   | gpt-5-mini   |
| Sonnet      | gpt-4o        | gpt-5        |
| Opus        | gpt-4o        | gpt-5-high   |

### Gemini CLI

Gemini CLI model selections are mapped as follows:

| Gemini Model | gpt-4o Family | gpt-5 Family |
|--------------|---------------|--------------|
| gemini-2.5-pro | gpt-4o | gpt-5 |
| gemini-2.5-flash | gpt-4o-mini | gpt-5-mini |
| gemini-2.5-flash-lite | gpt-4o-mini | gpt-5-mini |

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
# Run clawd with Claude Code (uses saved config if exists)
clawd

# Non-interactive with prompt
clawd -p "explain this codebase"

# Run with Gemini CLI instead
clawd --gemini
clawd --gemini "list all files"

# Reconfigure provider/model
clawd --clawd-config

# Show current configuration
clawd --clawd-show-config

# Enable debug logging
CLAWD_LOG=clawd.log clawd

# Use custom port
CLAWD_PORT=3000 clawd
```

## How It Works

1. Clawd starts a local proxy server on `127.0.0.1:2001`
2. It launches Claude Code CLI (or Gemini CLI with `--gemini`) pointed at this proxy
3. Requests are translated to OpenAI format
4. Responses are translated back to Anthropic/Gemini format
5. Full streaming support for messages and tool use

## Features

- **Interactive setup wizard** - Easy first-time configuration
- **Model family selection** - Choose between gpt-4o and gpt-5 families
- **Azure support** - Works with Azure OpenAI Service
- **Gemini CLI support** - Use `--gemini` flag to run Gemini CLI instead of Claude Code
- **Thinking mode** - Translates Claude's thinking to OpenAI's reasoning_effort (gpt-5 only)
- **Tool use** - Full support for Claude Code and Gemini CLI tools
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

```bash
clawd --clawd-config
```

### Enable debug logging

```bash
CLAWD_LOG=clawd.log clawd
cat clawd.log
```

## Run in dev mode

```bash
npx clawd
```


## License

MIT
