# signos-tok 🤟

**Text-to-Sign Language Video Generator** powered by Cloudflare Workers AI

Generate sign language videos from text scripts using Chilean Sign Language (LSCh) dictionary with AI-powered translation.

---

## 🎯 Features

- **Text-to-Sign Translation**: Converts Spanish text to Chilean Sign Language sequences using RAG (Vectorize + Llama 3.1)
- **Video Generation**: Creates video manifests from sign image sequences
- **RESTful API**: Simple HTTP API for integration
- **CLI Tool**: Command-line interface for quick video generation
- **R2 Storage**: Videos stored in Cloudflare R2 buckets
- **Real-time Processing**: Fast translation and video generation (< 1s)

---

## 🏗️ Architecture

```
Text Script
    ↓
SignMatcher (RAG)
  - Vectorize embedding search
  - Llama 3.1 sign selection
    ↓
SignWithImages[]
    ↓
VideoGenerator
  - Create video manifest
  - Store in R2
    ↓
Video URL
```

### Technology Stack

- **Cloudflare Workers**: Serverless compute
- **Workers AI**: 
  - `@cf/baai/bge-base-en-v1.5` for embeddings
  - `@cf/meta/llama-3.1-8b-instruct` for sign selection
- **Vectorize**: Vector database (2,123 LSCh signs)
- **R2**: Object storage for videos
- **TypeScript**: Type-safe development

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Cloudflare account with Workers AI enabled
- pnpm (or npm)
- Vectorize index populated with signs (see `signsToJson/README_PIPELINE.md`)

### 1. Install Dependencies

```bash
cd signos-tok/worker
pnpm install
```

### 2. Configure Environment

Create `.dev.vars` file:

```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars`:

```bash
CF_ACCOUNT=your_cloudflare_account_id
CF_API_TOKEN=your_cloudflare_api_token
```

### 3. Create R2 Bucket

```bash
wrangler r2 bucket create signos-tok-videos
```

### 4. Start Worker

```bash
pnpm dev
```

Worker will be available at: http://localhost:8787

---

## 📚 API Documentation

### Endpoints

#### `POST /api/generate`

Generate a video from text script.

**Request:**

```json
{
  "script": "hola necesito agua por favor",
  "title": "My Video",
  "settings": {
    "fps": 30,
    "signDuration": 1500,
    "width": 720,
    "height": 1280,
    "format": "mp4"
  }
}
```

**Response:**

```json
{
  "success": true,
  "videoUrl": "/api/videos/video_1234567890_abc/manifest.json",
  "videoId": "video_1234567890_abc",
  "signs": [
    {
      "glosa": "HOLA",
      "images": [
        { "path": "H/hola_0.jpeg", "sequence": 0 }
      ],
      "definition": "Expresión de saludo",
      "confidence": 0.92,
      "duration": 1500
    }
  ],
  "duration": 4.5,
  "processingTime": 450
}
```

#### `GET /api/translate?text=...`

Translate text to signs without generating video.

**Example:**

```bash
curl "http://localhost:8787/api/translate?text=hola+mundo"
```

**Response:**

```json
{
  "success": true,
  "text": "hola mundo",
  "signs": [...],
  "count": 2
}
```

#### `GET /api/videos/:id`

Get video manifest by ID.

```bash
curl http://localhost:8787/api/videos/video_1234567890_abc
```

#### `GET /api/videos`

List all generated videos.

```bash
curl http://localhost:8787/api/videos?limit=20
```

#### `DELETE /api/videos/:id`

Delete a video.

```bash
curl -X DELETE http://localhost:8787/api/videos/video_1234567890_abc
```

---

## 🖥️ CLI Usage

### Basic Usage

```bash
cd signos-tok/cli

# Generate from text
node generate-video.mjs "hola necesito agua"

# Generate from file
node generate-video.mjs --file script.txt

# Interactive mode
node generate-video.mjs --interactive
```

### Advanced Options

```bash
# Custom settings
node generate-video.mjs "hola mundo" \
  --fps 60 \
  --duration 2000 \
  --width 1080 \
  --height 1920 \
  --format mp4 \
  --output video.json

# Use production worker
node generate-video.mjs "gracias" \
  --worker-url https://signos-tok-worker.your-domain.workers.dev
```

### CLI Options

- `--worker-url URL` - Worker URL (default: http://localhost:8787)
- `--file PATH` - Read script from file
- `--output PATH` - Save manifest to file
- `--fps N` - Video FPS (default: 30)
- `--duration N` - Milliseconds per sign (default: 1500)
- `--width N` - Video width (default: 720)
- `--height N` - Video height (default: 1280)
- `--format FORMAT` - Output format: mp4|webm (default: mp4)
- `--interactive` - Interactive mode
- `--help` - Show help

---

## 🧪 Testing

### Run Test Suite

```bash
# Start worker first
pnpm dev

# In another terminal
pnpm test
```

This will test:
- Text translation
- Video generation
- Video listing
- Multiple scripts

### Manual Testing

```bash
# Test translation
curl "http://localhost:8787/api/translate?text=hola"

# Generate video
curl -X POST http://localhost:8787/api/generate \
  -H "Content-Type: application/json" \
  -d '{"script": "hola necesito agua"}'

# List videos
curl http://localhost:8787/api/videos

# Get video manifest
curl http://localhost:8787/api/videos/[video_id]
```

---

## 📊 Video Manifest Format

The worker generates a JSON manifest that describes the video:

```json
{
  "version": "1.0",
  "videoId": "video_1234567890_abc",
  "settings": {
    "fps": 30,
    "signDuration": 1500,
    "width": 720,
    "height": 1280,
    "format": "mp4"
  },
  "totalFrames": 45,
  "totalDuration": 4.5,
  "frames": [
    {
      "imagePath": "H/hola_0.jpeg",
      "startTime": 0,
      "duration": 0.5,
      "glosa": "HOLA",
      "sequence": 0
    }
  ]
}
```

This manifest can be used to:
1. **Client-side rendering**: Display images in sequence
2. **Server-side encoding**: Generate actual video file with ffmpeg
3. **Preview**: Show sign sequence before encoding

---

## 🎬 Example Scripts

### Simple Greetings

```bash
node generate-video.mjs "hola"
node generate-video.mjs "buenos días"
node generate-video.mjs "cómo estás"
node generate-video.mjs "gracias"
```

### Requests

```bash
node generate-video.mjs "necesito agua"
node generate-video.mjs "necesito ayuda por favor"
node generate-video.mjs "dónde está el baño"
```

### Sentences

```bash
node generate-video.mjs "hola me llamo Juan"
node generate-video.mjs "quiero aprender lengua de señas"
node generate-video.mjs "muchas gracias por tu ayuda"
```

---

## 🚀 Deployment

### Deploy to Cloudflare

```bash
cd signos-tok/worker

# Set secrets
wrangler secret put CF_ACCOUNT
wrangler secret put CF_API_TOKEN

# Deploy
pnpm deploy
```

### Update Production URL

After deployment, update CLI default URL:

```bash
# Use production worker
export WORKER_URL=https://signos-tok-worker.your-domain.workers.dev
node generate-video.mjs "hola"
```

---

## 🔧 Configuration

### Video Settings

Default settings in `src/types.ts`:

```typescript
export const DEFAULT_VIDEO_SETTINGS: VideoSettings = {
  fps: 30,                    // Frames per second
  signDuration: 1500,         // Milliseconds per sign
  transitionDuration: 300,    // Transition between signs
  width: 720,                 // Video width (portrait)
  height: 1280,               // Video height (TikTok format)
  format: 'mp4',              // Output format
  backgroundColor: '#000000'  // Background color
};
```

### Vectorize Index

The worker uses the same Vectorize index as `signos/worker`:

- **Index name**: `signos-lsch-index`
- **Dimensions**: 768
- **Metric**: cosine similarity
- **Vectors**: 2,123 LSCh signs

See `signsToJson/README_PIPELINE.md` for index creation.

---

## 📁 Project Structure

```
signos-tok/
├── worker/
│   ├── src/
│   │   ├── index.ts              # Main API routes
│   │   ├── types.ts              # TypeScript types
│   │   └── services/
│   │       ├── sign-matcher.ts   # RAG translation
│   │       └── video-generator.ts # Video manifest creation
│   ├── package.json
│   ├── wrangler.toml
│   ├── tsconfig.json
│   └── test-video-generation.mjs
│
├── cli/
│   └── generate-video.mjs        # CLI tool
│
└── README.md
```

---

## 🐛 Troubleshooting

### Worker not starting

**Error**: `Failed to bind AI`

**Solution**: Make sure you're using remote mode:

```bash
pnpm dev  # Uses remote = true in wrangler.toml
```

### No signs found

**Error**: `No signs found for the provided script`

**Causes**:
1. Vectorize index not populated
2. Input text too complex
3. Words not in LSCh dictionary

**Solutions**:
- Use simpler Spanish words
- Check index: `wrangler vectorize get signos-lsch-index`
- Try common words: "hola", "agua", "gracias"

### R2 bucket not found

**Error**: `R2 bucket 'signos-tok-videos' not found`

**Solution**: Create the bucket:

```bash
wrangler r2 bucket create signos-tok-videos
```

### High latency

**Optimization tips**:
- Cache common phrases (already implemented)
- Reduce `topK` in Vectorize query
- Lower similarity threshold
- Use production deployment (faster than local)

---

## 🔮 Future Enhancements

### Phase 1: Video Encoding
- Integrate ffmpeg for actual video generation
- Support multiple video formats (MP4, WebM, GIF)
- Add text overlays with glosa names

### Phase 2: Advanced Features
- Regional LSCh variants
- Custom avatar/signer selection
- Background music/captions
- Batch processing

### Phase 3: Integration
- TikTok/Instagram upload API
- WordPress plugin
- Mobile app SDK
- Real-time streaming

---

## 📖 Related Documentation

- **[signos/worker](../signos/worker/README_RAG.md)** - Real-time STT + sign translation
- **[signsToJson](../signsToJson/README_PIPELINE.md)** - Dictionary extraction & Vectorize index
- **[CLIENT_PLAN.md](../CLIENT_PLAN.md)** - Tauri desktop app

---

## 🤝 Contributing

Contributions welcome! Areas to improve:

1. **Video Encoding**: Add real video generation with ffmpeg
2. **UI**: Build web interface for video generation
3. **Performance**: Optimize sign selection algorithm
4. **Languages**: Add support for other sign languages (ASL, LSM, etc.)

---

## 📄 License

MIT License - Built for educational purposes.

---

## 🙏 Acknowledgments

- **Chilean Deaf Community** for LSCh dictionary
- **Cloudflare** for Workers AI platform
- **Signos team** for the vision

---

**Built with ❤️ for accessibility**

🤟 Making sign language accessible through AI

