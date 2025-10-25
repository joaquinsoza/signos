# Testing Guide - Worker Sign Translation

Quick guide to test the RAG-based sign translation **before** implementing the full client.

---

## Prerequisites

✅ Worker running locally: `pnpm run dev`
✅ Vectorize index populated with 2,123 signs
✅ Environment variables set in `.dev.vars`

---

## Option 1: Browser Test (Simplest)

### Step 1: Start Worker in Mock Mode

```bash
cd signos/worker

# Edit .dev.vars - set MOCK_MODE=true
echo "MOCK_MODE=true" >> .dev.vars

# Start worker
pnpm run dev
```

### Step 2: Open Test Page

```bash
# Open in browser
open http://localhost:8787/test-signs.html

# Or navigate to:
# http://localhost:8787/test-signs.html
```

### Step 3: Test

1. Click **"Connect to Worker"**
2. Worker will be in mock mode (generates fake Spanish phrases)
3. Send dummy audio by keeping the page open
4. Watch the **Message Log** for sign responses

**Expected Output in Message Log:**
```
SIGNS
For: "Hola, ¿cómo estás?"
HOLA (92%)  CÓMO (85%)  ESTAR (88%)
```

---

## Option 2: Node.js Test Script (More Control)

### Step 1: Install Dependencies

```bash
cd signos/worker
pnpm add -D ws
```

### Step 2: Run Test Script

```bash
# Ensure worker is in mock mode
echo "MOCK_MODE=true" > .dev.vars

# Start worker
pnpm run dev

# In another terminal:
node test-signs.mjs
```

### Expected Output

```
🧪 Signos Worker Sign Translation Test

🔌 Connecting to ws://localhost:8787...
✅ Connected to worker

🎤 Starting audio stream (mock mode will generate transcripts)...

📝 Transcript: "Hola, ¿cómo estás?"
🤟 Signs received for: "Hola, ¿cómo estás?"
   Count: 3
   1. HOLA (confidence: 92%)
      Definition: Expresión de saludo
      Images: 1 frame(s)
   2. CÓMO (confidence: 85%)
      Definition: Pregunta de modo
      Images: 1 frame(s)
   3. ESTAR (confidence: 88%)
      Definition: Verbo de estado
      Images: 1 frame(s)

⏹️  Stopped sending audio

⏳ Waiting 5000ms for sign responses...

============================================================
📊 TEST SUMMARY
============================================================

1. Input: "Hola, ¿cómo estás?"
   Signs: HOLA, CÓMO, ESTAR
   Count: 3

2. Input: "Todo bien, gracias por preguntar."
   Signs: TODO, BIEN, GRACIAS
   Count: 3

✅ Sign translation is working!
   Total phrases processed: 5
```

---

## Option 3: Check Worker Logs Directly

### Step 1: Start Worker (Mock Mode)

```bash
cd signos/worker
echo "MOCK_MODE=true" > .dev.vars
pnpm run dev
```

### Step 2: Watch Logs

Connect to worker and look for these log patterns:

```
[SignMatcher] Translating: "hola necesito agua"
[SignMatcher] Vectorize found 12 matches for: "hola necesito agua"
[SignMatcher] Relevant matches: HOLA (0.92), NECESITAR (0.88), AGUA (0.95), ...
[SignMatcher] LLM raw response: ["HOLA", "NECESITAR", "AGUA"]
[SignMatcher] LLM selected glosas: ["HOLA", "NECESITAR", "AGUA"]
[SignMatcher] ✅ Sent 3 signs: HOLA, NECESITAR, AGUA
[WORKER→CLIENT] Sending: {"type":"signs","text":"hola necesito agua",...}
```

---

## Option 4: Test with Real Tauri Client (Partial)

**Quick minimal test** without implementing full CLIENT_PLAN.md:

### Step 1: Update Tauri Client (Minimal)

Edit `signos/tauri-app/src/main.ts` - just add console logging:

```typescript
// In handleMessage or equivalent:
case 'signs':
    console.log('🤟 SIGNS RECEIVED:', message);
    console.log('Signs:', message.signs.map(s => s.glosa).join(', '));
    this.log(`Received ${message.signs.length} signs`);
    break;
```

### Step 2: Run Full Stack

```bash
# Terminal 1: Worker (REAL mode, not mock)
cd signos/worker
echo "MOCK_MODE=false" > .dev.vars
pnpm run dev

# Terminal 2: Tauri
cd signos/tauri-app
pnpm tauri dev
```

### Step 3: Test

1. In Tauri app: Connect to `ws://localhost:8787`
2. Click "Start Recording"
3. Speak: **"Hola necesito agua"**
4. Check **browser dev console** (in Tauri webview)

**Expected in console:**
```javascript
🤟 SIGNS RECEIVED: {
  type: 'signs',
  text: 'hola necesito agua',
  signs: [
    { glosa: 'HOLA', images: [...], confidence: 0.92 },
    { glosa: 'NECESITAR', images: [...], confidence: 0.88 },
    { glosa: 'AGUA', images: [...], confidence: 0.95 }
  ]
}
Signs: HOLA, NECESITAR, AGUA
```

---

## Validation Checklist

### ✅ Worker is working if you see:

- [x] WebSocket connects successfully
- [x] Mock transcripts generated (in mock mode)
- [x] `[SignMatcher] Translating: "..."` in logs
- [x] `[SignMatcher] Vectorize found N matches`
- [x] `[SignMatcher] ✅ Sent N signs: ...` in logs
- [x] Client receives `{"type":"signs",...}` messages

### ❌ Common Issues

**No signs received:**
```bash
# Check Vectorize index
cd signos/worker
npx wrangler vectorize get signos-lsch-index
# Should show 2,123 vectors

# Check binding in wrangler.toml
grep -A 2 "vectorize" wrangler.toml
# Should show:
# [[vectorize]]
# binding = "VECTORIZE"
# index_name = "signos-lsch-index"
# remote = true
```

**LLM errors:**
- Check AI binding: `grep -A 2 "\[ai\]" wrangler.toml`
- Should have `remote = true`

**Vectorize query fails:**
- Restart worker with fresh credentials
- Check CF_ACCOUNT and CF_API_TOKEN in `.dev.vars`

---

## Performance Tests

### Test 1: Latency

Check worker logs for timing:

```
[SignMatcher] Translation took 327ms
```

**Target**: < 500ms total

### Test 2: Cache Hit Rate

Send same phrase twice:

```javascript
// First time: ~300ms (Vectorize + LLM)
// Second time: ~0ms (cache hit)
```

Worker logs should show:
```
[SignMatcher] Cache hit for: hola
```

### Test 3: Quality

Test phrases and verify sign selection makes sense:

| Input | Expected Signs | Why |
|-------|---------------|-----|
| "hola" | HOLA | Direct match |
| "necesito agua" | NECESITAR, AGUA | Content words only (skips article) |
| "cómo estás" | CÓMO, ESTAR | Verb conjugation simplified |
| "buenos días" | BUENO, DÍA | Plural simplified |

---

## Next Steps

### If tests pass ✅

**You're ready for CLIENT_PLAN.md!** The worker is sending signs correctly.

Proceed to implement:
1. Display sign images in Tauri
2. Add animation transitions
3. Queue management for sign sequences

### If tests fail ❌

**Debug first before client work:**

1. Check Vectorize index: `npx wrangler vectorize get signos-lsch-index`
2. Review worker logs carefully
3. Test embedding generation manually
4. Verify LLM is accessible

---

## Quick Decision Guide

**My Recommendation:**

### For Speed: Option 1 (Browser Test)
- Fastest to validate worker is working
- No code changes needed
- Good for "does it work at all?" check

### For Confidence: Option 2 (Node.js Script)
- More controlled testing
- See full request/response cycle
- Good for "is the output correct?" validation

### For Full System: Option 4 (Minimal Tauri)
- Tests real WebSocket flow
- Validates message formats
- Good before implementing full UI

---

## What I'd Do

```bash
# 1. Quick smoke test (30 seconds)
cd signos/worker
open http://localhost:8787/test-signs.html
# Click connect, watch for signs

# 2. If that works, run automated test (1 minute)
node test-signs.mjs

# 3. If both pass → proceed to CLIENT_PLAN.md
```

**If both pass**: Worker RAG is 100% working, safe to build client UI

**If either fails**: Fix worker first, don't touch client yet
