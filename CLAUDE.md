# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**signos** is a real-time Speech-to-Text proof-of-concept that will eventually translate spoken Spanish into Chilean Sign Language animations. This POC validates real-time audio transcription as the foundation.

## Architecture

The system consists of two main components in `signos/`:

1. **Cloudflare Worker** (`worker/`) - TypeScript WebSocket server that proxies audio to Cloudflare's nova-3 AI model
2. **Tauri Desktop App** (`tauri-app/`) - Cross-platform desktop client for audio capture and real-time transcription display

### Data Flow
```
Tauri App (Web Audio API)
  → 16kHz PCM mono audio via WebSocket
  → Cloudflare Worker
  → nova-3 AI (Deepgram multilingual model)
  → Transcriptions back to client
```

### Key Technical Details

- **Audio Format**: 16kHz PCM mono (Int16), processed via AudioWorklet ([audio-processor.js](signos/tauri-app/public/audio-processor.js))
- **WebSocket Streaming**: Bidirectional - binary audio upstream, JSON transcriptions downstream
- **nova-3 Model**: Cloudflare Workers AI binding to Deepgram's multilingual STT model
  - Configured with `language=multi` for Spanish/English code-switching support
  - **Important**: Nova-3 WebSocket only supports `language=multi` or `language=en` - use `multi` for Spanish
- **Mock Mode**: Worker can run in `MOCK_MODE=true` for offline testing without AI API calls

### Worker Implementation ([worker/src/index.ts](signos/worker/src/index.ts))

The Worker establishes a WebSocket connection to nova-3 using `fetch()` with `Upgrade: websocket` header:
- Forwards raw PCM audio from client to nova-3
- Parses nova-3 JSON responses: `{ channel: { alternatives: [{ transcript }] }, speech_final: bool }`
- Sends formatted messages to client: `{ type: 'transcript', text, is_final, latency_ms }`
- Tracks stats (bytes processed, latency samples) and sends periodic updates

### Client Implementation ([tauri-app/src/main.ts](signos/tauri-app/src/main.ts))

The Tauri frontend:
- Captures microphone input with Web Audio API at 16kHz mono
- Converts Float32 audio to Int16 PCM via AudioWorklet processor
- Sends PCM chunks over WebSocket to Worker
- Displays real-time transcriptions with latency metrics

## Development Commands

### Worker (Cloudflare)

```bash
cd signos/worker

# Install dependencies
pnpm install

# Local development with REAL nova-3 AI (requires .dev.vars)
pnpm dev:remote

# Local development with mock AI responses
MOCK_MODE=true pnpm dev

# Deploy to Cloudflare
pnpm deploy
```

**Important**: Always use `pnpm dev:remote` for testing real transcription. Plain `pnpm dev` runs locally without actual AI binding.

### Tauri App

```bash
cd signos/tauri-app

# Install dependencies
pnpm install

# Run development build
pnpm tauri dev

# Build production app
pnpm build && pnpm tauri build
```

## Configuration

### Worker Environment Variables

Create `signos/worker/.dev.vars` (git-ignored):

```bash
MOCK_MODE=false
CF_ACCOUNT=your_cloudflare_account_id
CF_API_TOKEN=your_cloudflare_api_token
```

Get credentials from [Cloudflare Dashboard](https://dash.cloudflare.com/) → Workers & Pages → Account ID and API Tokens.

### Worker Deployment

Environment variables for production must be set via:
```bash
wrangler secret put CF_ACCOUNT
wrangler secret put CF_API_TOKEN
wrangler secret put MOCK_MODE
```

## Testing Workflow

1. Start Worker: `cd signos/worker && pnpm dev:remote`
2. Start Tauri app: `cd signos/tauri-app && pnpm tauri dev`
3. In Tauri app UI:
   - Enter Worker URL: `ws://localhost:8787`
   - Click "Start Recording"
   - Speak in Spanish or English
   - Observe real-time transcriptions with latency metrics

## Common Issues

### No transcriptions appearing
- Verify Worker is using `pnpm dev:remote` (not `pnpm dev`)
- Check Worker logs for "Connected to nova-3 WebSocket successfully"
- Ensure `.dev.vars` has correct `CF_ACCOUNT` and `CF_API_TOKEN`
- Verify `language=multi` in Worker URL params (not `language=es`)

### WebSocket connection fails
- Worker URL must use `ws://` protocol (not `https://`)
- Confirm Worker is running on `localhost:8787`
- Try mock mode first: `MOCK_MODE=true pnpm dev`

### High latency
- Use `pnpm dev:remote` for real AI (local dev doesn't support Workers AI binding)
- Check network connection to Cloudflare API
- Monitor Worker logs for nova-3 connection errors

## Project Structure

```
signos/
├── worker/
│   ├── src/index.ts          # Main WebSocket handler + nova-3 integration
│   ├── wrangler.toml          # Worker config (AI binding, observability)
│   └── .dev.vars              # Local credentials (git-ignored)
│
└── tauri-app/
    ├── src/
    │   ├── main.ts            # WebSocket client + UI logic
    │   └── styles.css         # UI styling
    ├── public/
    │   └── audio-processor.js # AudioWorklet for PCM conversion
    └── src-tauri/
        ├── Cargo.toml         # Rust dependencies
        └── src/lib.rs         # Tauri backend (minimal)
```

## Future Roadmap (from POC context)

This STT POC validates the first stage of signos:
1. ✅ Real-time multilingual Spanish transcription (current POC)
2. 🔜 Text → Chilean Sign Language translation
3. 🔜 3D avatar animation generation
