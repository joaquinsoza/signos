# Signos STT POC

> Real-time Speech-to-Text using Cloudflare Workers AI (nova-3) and Tauri

Proof of Concept for real-time multilingual speech transcription (Spanish/English) using Cloudflare's nova-3 model via WebSocket streaming.

## 🎯 Goal

Validate real-time audio transcription as the foundation for **Signos**, which will translate spoken Spanish into Chilean Sign Language animations.

---

## 🏗️ Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌──────────────┐
│  Tauri Desktop  │ ←─WS──→ │ Cloudflare Worker│ ←─WS──→ │  nova-3 AI   │
│      App        │         │   (TypeScript)   │         │    Model     │
└─────────────────┘         └──────────────────┘         └──────────────┘
       │                             │
  Web Audio API              WebSocket Streaming
  16kHz PCM Mono             Multilingual (es/en)
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and **pnpm**
- **Rust** 1.70+ (for Tauri)
- **Cloudflare Account** + **API Token**

### 1. Setup Worker

```bash
cd worker

# Install dependencies
pnpm install

# Configure credentials in .dev.vars
CF_ACCOUNT=your_account_id
CF_API_TOKEN=your_api_token
MOCK_MODE=false

# Run locally with real AI
pnpm dev:remote
```

### 2. Setup Tauri App

```bash
cd tauri-app

# Install dependencies
pnpm install

# Run development server
pnpm tauri dev
```

### 3. Start Recording

1. Launch the Tauri app
2. Enter Worker URL: `ws://localhost:8787`
3. Click "Start Recording"
4. Speak in Spanish or English
5. Watch real-time transcriptions

---

## 📊 Features

- ✅ Real-time audio capture (16kHz mono PCM)
- ✅ WebSocket bidirectional streaming
- ✅ Nova-3 multilingual transcription (Spanish/English)
- ✅ Smart formatting and punctuation
- ✅ Latency tracking
- ✅ Mock mode for offline testing

---

## 🔧 Configuration

### Worker Environment Variables

Create `worker/.dev.vars`:

```bash
MOCK_MODE=false
CF_ACCOUNT=your_cloudflare_account_id
CF_API_TOKEN=your_cloudflare_api_token
```

Get credentials from [Cloudflare Dashboard](https://dash.cloudflare.com/).

---

## 📁 Project Structure

```
STTpoc/
├── worker/                 # Cloudflare Worker (TypeScript)
│   ├── src/index.ts       # WebSocket server + nova-3 integration
│   ├── wrangler.toml      # Worker configuration
│   └── .dev.vars          # Local credentials (gitignored)
│
├── tauri-app/             # Desktop client
│   ├── src/main.ts        # WebSocket client + UI
│   ├── public/audio-processor.js  # AudioWorklet PCM conversion
│   └── src-tauri/         # Tauri backend (Rust)
│
└── README.md              # This file
```

---

## 🐛 Troubleshooting

### No transcriptions appearing

- Check Worker logs: Audio should be forwarded to nova-3
- Verify `language=multi` in URL params (not `es`)
- Ensure API credentials are correct

### WebSocket connection fails

- Verify Worker URL uses `ws://` not `https://`
- Check Worker is running: `pnpm dev:remote`
- Test with mock mode first: `MOCK_MODE=true`

### High latency

- Use `pnpm dev:remote` for real AI (not `pnpm dev`)
- Check network connection
- Monitor Worker logs for errors

---

## 📝 License

MIT

---

**Built for Skyward Hackathon**
