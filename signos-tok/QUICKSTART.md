# signos-tok Quick Start Guide 🚀

Get up and running in 5 minutes!

---

## Prerequisites

- Node.js 18+ installed
- Cloudflare account
- pnpm (or npm)

---

## Step 1: Install Dependencies (1 min)

```bash
cd signos-tok/worker
pnpm install
```

---

## Step 2: Configure Environment (1 min)

Create `.dev.vars` file:

```bash
# Copy template
cp .dev.vars.example .dev.vars

# Edit with your credentials
# Get from: https://dash.cloudflare.com/
```

**Required values:**
- `CF_ACCOUNT` - Your Cloudflare account ID
- `CF_API_TOKEN` - API token with Workers AI access

---

## Step 3: Create R2 Bucket (1 min)

```bash
npx wrangler r2 bucket create signos-tok-videos
```

---

## Step 4: Start Worker (1 min)

```bash
pnpm dev
```

**Output:**
```
⛅️ wrangler 3.x.x
Your Worker has access to the following bindings:
  - AI
  - VECTORIZE (signos-lsch-index)
  - R2 Bucket (signos-tok-videos)
Ready on http://localhost:8787
```

---

## Step 5: Test It! (1 min)

### Option A: Use CLI

```bash
# In another terminal
cd signos-tok/cli
node generate-video.mjs "hola necesito agua"
```

### Option B: Use API

```bash
curl -X POST http://localhost:8787/api/generate \
  -H "Content-Type: application/json" \
  -d '{"script": "hola necesito agua"}'
```

### Option C: Run Test Suite

```bash
cd signos-tok/worker
pnpm test
```

---

## Expected Output

```json
{
  "success": true,
  "videoId": "video_1234567890_abc",
  "videoUrl": "/api/videos/video_1234567890_abc/manifest.json",
  "signs": [
    {
      "glosa": "HOLA",
      "images": [{ "path": "H/hola_0.jpeg", "sequence": 0 }],
      "definition": "Expresión de saludo",
      "confidence": 0.92,
      "duration": 1500
    },
    {
      "glosa": "NECESITAR",
      "images": [{ "path": "N/necesitar_0.jpeg", "sequence": 0 }],
      "definition": "Tener necesidad de algo",
      "confidence": 0.88,
      "duration": 1500
    },
    {
      "glosa": "AGUA",
      "images": [{ "path": "A/agua_0.jpeg", "sequence": 0 }],
      "definition": "Líquido vital",
      "confidence": 0.95,
      "duration": 1500
    }
  ],
  "duration": 4.5,
  "processingTime": 450
}
```

---

## What Just Happened?

1. ✅ Your text was converted to embeddings
2. ✅ AI searched for matching signs in the database
3. ✅ Llama 3.1 selected the best signs
4. ✅ A video manifest was generated
5. ✅ Everything was stored in R2

---

## Next Steps

### Try More Examples

```bash
# Simple greeting
node cli/generate-video.mjs "hola"

# Question
node cli/generate-video.mjs "cómo estás"

# Request
node cli/generate-video.mjs "necesito ayuda"

# Gratitude
node cli/generate-video.mjs "muchas gracias"
```

---

### Use Interactive Mode

```bash
node cli/generate-video.mjs --interactive
```

---

### Customize Video Settings

```bash
node cli/generate-video.mjs "hola mundo" \
  --fps 60 \
  --duration 2000 \
  --width 1080 \
  --height 1920 \
  --output my-video.json
```

---

### Browse API

Open in browser: http://localhost:8787

---

## Troubleshooting

### Worker won't start

**Error**: `Failed to bind AI`

**Fix**: Make sure `.dev.vars` has correct credentials

---

### No signs found

**Error**: `No signs found for the provided script`

**Fix**: Try simpler Spanish words like "hola", "agua", "gracias"

---

### Bucket not found

**Error**: `R2 bucket 'signos-tok-videos' not found`

**Fix**: Run `npx wrangler r2 bucket create signos-tok-videos`

---

## Learn More

- **[README.md](README.md)** - Full documentation
- **[EXAMPLES.md](EXAMPLES.md)** - Usage examples
- **[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)** - Technical details

---

**Ready to deploy?**

```bash
# Set production secrets
npx wrangler secret put CF_ACCOUNT
npx wrangler secret put CF_API_TOKEN

# Deploy!
pnpm deploy
```

---

🤟 **Happy generating!**

