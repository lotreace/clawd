# Clawd

A Node.js shim that enables Claude Code CLI to work with OpenAI-compatible APIs by translating between Anthropic's Messages API and OpenAI's Chat Completions API.

## Overview

Clawd acts as a local proxy server that:
1. Starts an Express server on `127.0.0.1:2001`
2. Intercepts requests from Claude Code CLI
3. Translates Anthropic Messages API format to OpenAI Chat Completions format
4. Forwards requests to an OpenAI-compatible endpoint
5. Translates responses back to Anthropic format
6. Supports full streaming for messages and tool use

## Commands

- `clawd` - Uses gpt-5 model family (gpt-5-mini, gpt-5, gpt-5-high)
- `clawd4` - Uses gpt-4o model family (gpt-4o-mini, gpt-4o)

## Model Mapping

| Claude Model | clawd (gpt-5) | clawd4 (gpt-4o) |
|--------------|---------------|-----------------|
| Haiku        | gpt-5-mini    | gpt-4o-mini     |
| Sonnet       | gpt-5         | gpt-4o          |
| Opus         | gpt-5-high    | gpt-4o          |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Yes | - | Your OpenAI API key |
| `OPENAI_BASE_URL` | No | `https://api.openai.com/v1` | OpenAI-compatible endpoint |
| `CLAWD_PORT` | No | `2001` | Local server port |
| `CLAWD_LOG` | No | `./clawd.log` | Log file path |

## Usage

```bash
# Set your API key
export OPENAI_API_KEY=your-key-here

# Run with gpt-5 family
clawd -p "your prompt"

# Run with gpt-4o family
clawd4 -p "your prompt"

# All Claude Code arguments are passed through
clawd --help
```

## Architecture

```
src/
├── main.js                    # Entry point with run(modelFamily)
├── ClawdServer.js             # Express server setup
├── ClaudeLauncher.js          # Spawns Claude Code subprocess
├── config/
│   └── Config.js              # Configuration and model families
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
3. Check logs: `cat clawd.log`
4. Run tests before submitting

### Code Style

- ES6 modules (`.js` with `"type": "module"`)
- OOP style - each class in its own file
- Class filename matches class name
- Use Logger for all logging (not console.log)

### Adding a New Model Family

1. Add entry to `MODEL_FAMILIES` in `src/config/Config.js`
2. Create new bin script in `bin/` that calls `run('your-family')`
3. Add bin entry to `package.json`
4. Update `ThinkingModeHook.js` if model has special reasoning support
