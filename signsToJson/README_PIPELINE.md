# Sign Language Dictionary Processing Pipeline

Complete pipeline for extracting Chilean Sign Language (LSCh) dictionary data from PDFs, generating embeddings, and preparing for RAG-based similarity search.

## 🎯 What This Pipeline Does

1. **Extracts** signs from PDF dictionaries into PostgreSQL
2. **Generates** 768-dimensional embeddings for each sign using Cloudflare Workers AI
3. **Uploads** vectors to Cloudflare Vectorize for similarity search
4. **Prepares** sign images and metadata for the Tauri desktop client

---

## 📊 Current State (Completed)

| Component | Status | Count |
|-----------|--------|-------|
| Signs in Database | ✅ | 2,123 |
| Sign Images | ✅ | 2,960 |
| Spanish Translations | ✅ | 4,616 |
| Embeddings Generated | ✅ | 2,123 |
| Vectors in Vectorize | ✅ | 2,123 |
| Images in Tauri App | ✅ | 2,960 |

---

## 🗂️ Generated Files

### In `signsToJson/output/`
- **`signs_complete.json`** (1.4MB) - All signs with metadata, translations, synonyms
- **`signs_vectorized.json`** (41MB) - Signs with 768-dim embeddings
- **`vectorize_upload.ndjson`** (31MB) - NDJSON format for Vectorize bulk upload
- **`image_index.json`** (130KB) - Glosa→image path mapping
- **`images/`** - 2,960 sign images organized by letter (A/, B/, C/, etc.)

### In `signos/tauri-app/public/signs/`
- **`index.json`** - Image index for client-side lookups
- **`A/`, `B/`, `C/`, ...** - Sign images by letter directory

---

## 🔧 Scripts Created

All scripts in `signsToJson/scripts/`:

### 1. `export_to_json.py`
Exports signs from PostgreSQL to JSON format.

```bash
docker exec signos_extractor python /app/scripts/export_to_json.py
```

**Output**: `output/signs_complete.json`

**Schema**:
```json
{
  "id": "sign_1",
  "glosa": "ABANDONAR",
  "definition": "Dejar, desamparar...",
  "category": "v. tr.",
  "variant": 1,
  "translations": ["Abandonar", "dejar", "desamparar"],
  "synonyms": [],
  "images": [{"path": "A/abandonar_0.jpeg", "sequence": 0}],
  "search_text": "abandonar | abandonar | dejar | ..."
}
```

### 2. `generate_embeddings.py`
Generates 768-dimensional embeddings using Cloudflare Workers AI (`@cf/baai/bge-base-en-v1.5`).

```bash
docker exec signos_extractor python /app/scripts/generate_embeddings.py
```

**Requirements**:
- `CF_ACCOUNT` - Cloudflare Account ID
- `CF_API_TOKEN` - Cloudflare API Token

**Output**: `output/signs_vectorized.json` (adds `"embedding": [...]` to each sign)

**Rate**: ~2,100 signs in ~10 minutes

### 3. `prepare_vectorize_upload.py`
Converts to NDJSON format for Cloudflare Vectorize bulk upload.

```bash
docker exec signos_extractor python /app/scripts/prepare_vectorize_upload.py
```

**Output**: `output/vectorize_upload.ndjson`

**Format**:
```json
{"id": "sign_1", "values": [0.123, ...], "metadata": {"glosa": "ABANDONAR", ...}}
```

### 4. `create_image_index.py`
Creates glosa→image path mapping for client lookups.

```bash
docker exec signos_extractor python /app/scripts/create_image_index.py
```

**Output**: `output/image_index.json`

**Format**:
```json
{
  "abandonar": ["/signs/A/abandonar_0.jpeg"],
  "religion": ["/signs/R/religion_0.jpeg", "/signs/R/religion_1.jpeg"]
}
```

---

## 🚀 Quick Start (Re-run Pipeline)

### Prerequisites
- Docker and Docker Compose running
- Cloudflare account with Workers AI access
- PDFs in `signsToJson/pdfs/` directory

### Step 1: Extract PDFs to Database
```bash
cd signsToJson
docker compose up -d

# Run extraction (already done)
docker exec signos_extractor python -m src.extract_lsch \
  --pdf /app/pdfs/Diccionario_LSCh_A-H.pdf \
  --pdf /app/pdfs/Diccionario_LSCh_I-Z.pdf \
  --output-dir /app/output/images \
  --language-code lsch \
  --region Metropolitan \
  --start-page 6
```

### Step 2: Export to JSON
```bash
docker exec signos_extractor python /app/scripts/export_to_json.py
# Output: output/signs_complete.json
```

### Step 3: Generate Embeddings
```bash
# Ensure CF credentials in .env
# CF_ACCOUNT=your_account_id
# CF_API_TOKEN=your_api_token

docker exec signos_extractor python /app/scripts/generate_embeddings.py
# Output: output/signs_vectorized.json (takes ~10 minutes)
```

### Step 4: Upload to Vectorize
```bash
cd ../signos/worker

# Create index (one-time)
npx wrangler vectorize create signos-lsch-index \
  --dimensions=768 \
  --metric=cosine

# Prepare NDJSON
docker exec signos_extractor python /app/scripts/prepare_vectorize_upload.py

# Upload vectors
npx wrangler vectorize insert signos-lsch-index \
  --file=../../signsToJson/output/vectorize_upload.ndjson
```

### Step 5: Copy Images to Tauri
```bash
# Copy images
cp -r ../../signsToJson/output/images/* ../tauri-app/public/signs/

# Generate index
docker exec signos_extractor python /app/scripts/create_image_index.py
cp ../../signsToJson/output/image_index.json ../tauri-app/public/signs/index.json
```

---

## 🔍 Vectorize Index Details

**Name**: `signos-lsch-index`
**Dimensions**: 768
**Metric**: cosine similarity
**Vectors**: 2,123

### Binding in `wrangler.toml`
```toml
[[vectorize]]
binding = "VECTORIZE"
index_name = "signos-lsch-index"
```

### Metadata Stored Per Vector
- `glosa` - Sign name (e.g., "ABANDONAR")
- `definition` - Sign definition
- `translations` - Comma-separated translations
- `images` - JSON array of image paths
- `variant` - Variant number

---

## 📦 Database Schema

### Signs Table
```sql
SELECT COUNT(*) FROM signs;
-- 2,123 signs

SELECT glosa, definition, grammatical_category, variant_number
FROM signs
WHERE glosa = 'ABANDONAR';
```

### Sign Images Table
```sql
SELECT COUNT(*) FROM sign_images;
-- 2,962 images

SELECT image_path, sequence_order
FROM sign_images
WHERE sign_id = 1;
```

### Sign Translations Table
```sql
SELECT COUNT(*) FROM sign_translations;
-- 4,616 translations

SELECT translation, target_language
FROM sign_translations
WHERE sign_id = 1;
```

---

## 🔌 Integration with Worker

The Cloudflare Worker can now query the Vectorize index for similarity search:

```typescript
// In worker/src/index.ts
export default {
  async fetch(request, env) {
    const { VECTORIZE } = env;

    // Generate embedding for user input
    const embedding = await generateEmbedding(userText);

    // Query Vectorize
    const results = await VECTORIZE.query(embedding, {
      topK: 5,
      returnMetadata: true
    });

    // results[0].metadata.glosa → "ABANDONAR"
    // results[0].metadata.images → paths to sign images
  }
}
```

---

## 📝 Environment Variables

### `signsToJson/.env`
```bash
# PostgreSQL
DB_NAME=signos_db
DB_USER=signos
DB_PASSWORD=password
DB_PORT=5432

# Cloudflare (for embeddings)
CF_ACCOUNT=your_account_id
CF_API_TOKEN=your_api_token
```

### `signos/worker/.dev.vars`
```bash
# Worker already has these
CF_ACCOUNT=your_account_id
CF_API_TOKEN=your_api_token
MOCK_MODE=false
```

---

## 🧪 Validation Commands

### Check Database
```bash
docker exec signos_postgres psql -U signos -d signos_db -c \
  "SELECT COUNT(*) FROM signs;"
```

### Check Vectorize Index
```bash
cd signos/worker
npx wrangler vectorize get signos-lsch-index
```

### Check Images
```bash
find signos/tauri-app/public/signs -name "*.jpeg" | wc -l
# Should output: 2960
```

### Check Files
```bash
ls -lh signsToJson/output/
# signs_complete.json (1.4M)
# signs_vectorized.json (41M)
# vectorize_upload.ndjson (31M)
# image_index.json (130K)
```

---

## 🎯 Next Steps

1. **Integrate RAG into Worker** - Use VECTORIZE binding for similarity search
2. **Test Search Quality** - Query "como estas" → should return "HOLA", "SALUDAR"
3. **Add to Tauri Client** - Display sign images based on transcription
4. **Optimize Embeddings** - Fine-tune search_text construction for better matches

---

## 📚 Key Files Reference

| File | Purpose | Size |
|------|---------|------|
| `signs_complete.json` | All signs with metadata | 1.4MB |
| `signs_vectorized.json` | Signs + embeddings | 41MB |
| `vectorize_upload.ndjson` | Vectorize upload format | 31MB |
| `image_index.json` | Glosa→image mapping | 130KB |
| `export_to_json.py` | PostgreSQL → JSON | - |
| `generate_embeddings.py` | Text → 768-dim vectors | - |
| `prepare_vectorize_upload.py` | JSON → NDJSON | - |
| `create_image_index.py` | Images → index.json | - |

---

## 🐛 Troubleshooting

### "No embeddings generated"
- Check `CF_ACCOUNT` and `CF_API_TOKEN` in `.env`
- Verify Cloudflare account has Workers AI access
- Check API token has correct permissions

### "Vectorize upload failed"
- Ensure index created: `wrangler vectorize get signos-lsch-index`
- Verify NDJSON format: `head -1 output/vectorize_upload.ndjson`
- Check file size isn't corrupted

### "Images not found in Tauri"
- Verify copy: `ls signos/tauri-app/public/signs/A/`
- Check index.json exists and has correct paths
- Ensure paths start with `/signs/`

---

**Status**: ✅ All 2,123 signs ready for RAG-based similarity search in Worker
