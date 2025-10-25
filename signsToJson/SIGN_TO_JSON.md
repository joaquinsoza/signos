# Sign Database Generation & Vectorization Plan

## Overview
Extract Chilean Sign Language (LSCh) dictionary from PDFs, generate embeddings, and prepare data for Cloudflare Vectorize integration.

---

## Phase 1: PDF Extraction & JSON Generation

### Step 1.1: Set Up Python Environment
**Location**: `signsToJson/`

```bash
cd signsToJson
docker-compose up -d
# OR without Docker:
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**What this does**: Sets up PostgreSQL database and Python dependencies for PDF processing.

---

### Step 1.2: Run PDF Extraction (Dry Run First)
**Command**:
```bash
python -m src.extract_lsch \
  --pdf pdfs/Diccionario_LSCh_A-H.pdf \
  --pdf pdfs/Diccionario_LSCh_I-Z.pdf \
  --output-dir output/images \
  --language-code lsch \
  --region Metropolitan \
  --start-page 6 \
  --dry-run \
  --preview-output output/preview.json \
  --log-level INFO
```

**Expected Output**:
- `output/preview.json` - First 100 signs with metadata
- `output/images/` - Extracted sign images organized by glosa
- Console validation report showing success rate

**Validation Checklist**:
- [ ] Success rate > 85%
- [ ] Images extracted for most signs
- [ ] Glosa names are uppercase and valid
- [ ] Translations present in Spanish

---

### Step 1.3: Review & Fix Extraction Issues
**Action Items**:
1. Open `output/preview.json` and inspect:
   - `validation_report` section for missing data
   - `sample_errors` for parsing failures
   - `entries[0]` structure

2. Common fixes:
   - **Missing images**: Check `entry_splitter.py` logic
   - **Failed glosa parsing**: Update regex in `parser.py`
   - **Duplicate signs**: Review `variant_number` handling

3. Re-run extraction on specific page range if needed:
```bash
python -m src.extract_lsch \
  --pdf pdfs/Diccionario_LSCh_A-H.pdf \
  --output-dir output/images \
  --start-page 10 \
  --end-page 20 \
  --dry-run \
  --preview-output output/test.json
```

---

### Step 1.4: Full Extraction to Database
**Command** (once validation passes):
```bash
python -m src.extract_lsch \
  --pdf pdfs/Diccionario_LSCh_A-H.pdf \
  --pdf pdfs/Diccionario_LSCh_I-Z.pdf \
  --output-dir output/images \
  --language-code lsch \
  --region Metropolitan \
  --start-page 6 \
  --log-level INFO
```

**What this does**:
- Extracts ~1000+ signs from both PDF dictionaries
- Saves images to `output/images/{glosa}_{variant}_{seq}.png`
- Stores structured data in PostgreSQL tables:
  - `signs` - Core sign data (glosa, definition, category)
  - `sign_translations` - Spanish translations
  - `sign_images` - Image paths with sequence order
  - `sign_relations` - Synonyms/antonyms

**Expected Duration**: 5-15 minutes depending on PDF size

---

## Phase 2: Generate Embeddings for Vectorize

### Step 2.1: Export Database to JSON
**Create script**: `signsToJson/scripts/export_to_json.py`

```python
import json
import psycopg2
from pathlib import Path

def export_signs_to_json(output_path: str):
    """Export all signs with embeddings metadata to JSON."""
    conn = psycopg2.connect(
        host="localhost",
        port=5432,
        database="signos_db",
        user="signos",
        password="your_password"
    )

    cursor = conn.cursor()

    # Query complete sign data with all relations
    query = """
        SELECT
            s.id,
            s.glosa,
            s.definition,
            s.grammatical_category,
            s.variant_number,
            json_agg(DISTINCT st.translation) FILTER (WHERE st.id IS NOT NULL) as translations,
            json_agg(DISTINCT sr.related_word) FILTER (WHERE sr.id IS NOT NULL AND sr.relation_type = 'synonym') as synonyms,
            json_agg(
                jsonb_build_object(
                    'path', si.image_path,
                    'sequence', si.sequence_order
                ) ORDER BY si.sequence_order
            ) FILTER (WHERE si.id IS NOT NULL) as images
        FROM signs s
        LEFT JOIN sign_translations st ON s.id = st.sign_id
        LEFT JOIN sign_relations sr ON s.id = sr.sign_id
        LEFT JOIN sign_images si ON s.id = si.sign_id
        WHERE s.dictionary_id = (SELECT id FROM dictionaries WHERE language_code = 'lsch' LIMIT 1)
        GROUP BY s.id
        ORDER BY s.glosa;
    """

    cursor.execute(query)
    rows = cursor.fetchall()

    signs = []
    for row in rows:
        sign_id, glosa, definition, category, variant, translations, synonyms, images = row

        # Build search text for embeddings (what user might say)
        search_terms = [glosa.lower()]
        if translations:
            search_terms.extend([t.lower() for t in translations if t])
        if synonyms:
            search_terms.extend([s.lower() for s in synonyms if s])
        if definition:
            search_terms.append(definition.lower())

        signs.append({
            "id": f"sign_{sign_id}",
            "glosa": glosa,
            "definition": definition,
            "category": category,
            "variant": variant,
            "translations": translations or [],
            "synonyms": synonyms or [],
            "images": images or [],
            "search_text": " | ".join(search_terms),  # For embedding generation
        })

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(signs, f, indent=2, ensure_ascii=False)

    print(f"Exported {len(signs)} signs to {output_path}")
    conn.close()

if __name__ == '__main__':
    export_signs_to_json('output/signs_complete.json')
```

**Run**:
```bash
python scripts/export_to_json.py
```

**Expected Output**: `output/signs_complete.json` with ~1000+ sign entries

---

### Step 2.2: Generate Embeddings with Workers AI
**Create script**: `signsToJson/scripts/generate_embeddings.py`

```python
import json
import requests
import os
from typing import List, Dict

CF_ACCOUNT_ID = os.getenv("CF_ACCOUNT")
CF_API_TOKEN = os.getenv("CF_API_TOKEN")

def generate_embedding(text: str) -> List[float]:
    """Generate embedding using Cloudflare Workers AI."""
    url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/ai/run/@cf/baai/bge-base-en-v1.5"

    headers = {
        "Authorization": f"Bearer {CF_API_TOKEN}",
        "Content-Type": "application/json"
    }

    response = requests.post(url, headers=headers, json={
        "text": [text]
    })

    if response.status_code != 200:
        raise Exception(f"API error: {response.text}")

    result = response.json()
    return result["result"]["data"][0]  # 768-dimensional vector

def add_embeddings_to_signs(input_json: str, output_json: str):
    """Add embedding vectors to each sign."""
    with open(input_json, 'r', encoding='utf-8') as f:
        signs = json.load(f)

    print(f"Generating embeddings for {len(signs)} signs...")

    for i, sign in enumerate(signs):
        try:
            # Use search_text for embedding (translations + definition)
            embedding = generate_embedding(sign["search_text"])
            sign["embedding"] = embedding

            if (i + 1) % 50 == 0:
                print(f"Progress: {i + 1}/{len(signs)}")

        except Exception as e:
            print(f"Error generating embedding for {sign['glosa']}: {e}")
            sign["embedding"] = None

    # Filter out signs without embeddings
    valid_signs = [s for s in signs if s.get("embedding")]

    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(valid_signs, f, indent=2, ensure_ascii=False)

    print(f"Saved {len(valid_signs)} signs with embeddings to {output_json}")

if __name__ == '__main__':
    add_embeddings_to_signs('output/signs_complete.json', 'output/signs_vectorized.json')
```

**Run**:
```bash
export CF_ACCOUNT="your_account_id"
export CF_API_TOKEN="your_api_token"
python scripts/generate_embeddings.py
```

**Expected Output**: `output/signs_vectorized.json` with 768-dim embeddings per sign

**Duration**: ~5-10 minutes for 1000 signs (API rate limits apply)

---

## Phase 3: Prepare for Cloudflare Vectorize

### Step 3.1: Create Vectorize Index
**Command**:
```bash
cd ../signos/worker
wrangler vectorize create signos-lsch-index \
  --dimensions=768 \
  --metric=cosine
```

**Expected Output**:
```
✅ Created index 'signos-lsch-index'
   Dimensions: 768
   Metric: cosine
```

---

### Step 3.2: Convert to Vectorize Upload Format
**Create script**: `signsToJson/scripts/prepare_vectorize_upload.py`

```python
import json

def prepare_vectorize_format(input_json: str, output_ndjson: str):
    """Convert to Vectorize batch upload format (NDJSON)."""
    with open(input_json, 'r', encoding='utf-8') as f:
        signs = json.load(f)

    with open(output_ndjson, 'w', encoding='utf-8') as f:
        for sign in signs:
            if not sign.get("embedding"):
                continue

            # Vectorize format: id, values, metadata
            vectorize_entry = {
                "id": sign["id"],
                "values": sign["embedding"],
                "metadata": {
                    "glosa": sign["glosa"],
                    "definition": sign.get("definition", ""),
                    "translations": ",".join(sign.get("translations", [])),
                    "images": json.dumps(sign.get("images", [])),
                    "variant": sign.get("variant", 1)
                }
            }

            f.write(json.dumps(vectorize_entry) + '\n')

    print(f"Prepared {len(signs)} vectors for Vectorize upload")

if __name__ == '__main__':
    prepare_vectorize_format('output/signs_vectorized.json', 'output/vectorize_upload.ndjson')
```

**Run**:
```bash
python scripts/prepare_vectorize_upload.py
```

**Expected Output**: `output/vectorize_upload.ndjson` (NDJSON format)

---

### Step 3.3: Upload to Vectorize
**Command**:
```bash
wrangler vectorize insert signos-lsch-index \
  --file=../../signsToJson/output/vectorize_upload.ndjson
```

**Expected Output**:
```
✅ Inserted 1247 vectors into 'signos-lsch-index'
```

**Verify Upload**:
```bash
wrangler vectorize get signos-lsch-index
```

---

## Phase 4: Copy Images to Tauri Client

### Step 4.1: Copy Sign Images
**Command**:
```bash
# From project root
mkdir -p signos/tauri-app/public/signs
cp -r signsToJson/output/images/* signos/tauri-app/public/signs/

# Verify
ls -lh signos/tauri-app/public/signs/ | head -20
```

**Expected**: ~2000-4000 image files (multiple images per sign for sequences)

---

### Step 4.2: Generate Image Index JSON
**Create script**: `signsToJson/scripts/create_image_index.py`

```python
import json
from pathlib import Path

def create_image_index(images_dir: str, output_json: str):
    """Map glosa -> image paths for Tauri client."""
    images_path = Path(images_dir)

    index = {}
    for img_file in images_path.glob("*.png"):
        # Format: GLOSA_variant_sequence.png
        parts = img_file.stem.split('_')
        if len(parts) >= 2:
            glosa = '_'.join(parts[:-2])  # Reconstruct glosa
            variant = parts[-2]

            key = f"{glosa}_v{variant}"
            if key not in index:
                index[key] = []

            index[key].append(f"/signs/{img_file.name}")

    # Sort images by sequence
    for key in index:
        index[key].sort()

    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(index, f, indent=2)

    print(f"Indexed {len(index)} sign variants")

if __name__ == '__main__':
    create_image_index(
        'output/images',
        '../signos/tauri-app/public/signs/index.json'
    )
```

**Run**:
```bash
python scripts/create_image_index.py
```

**Expected Output**: `signos/tauri-app/public/signs/index.json` with glosa -> image paths mapping

---

## Phase 5: Validation & Testing

### Step 5.1: Validate Vectorize Search
**Create test script**: `signos/worker/scripts/test_vectorize.ts`

```typescript
// Test Vectorize similarity search
import { Ai } from '@cloudflare/ai';

const testQueries = [
  "hola",
  "gracias",
  "agua",
  "necesito ayuda",
  "buenos días"
];

async function testVectorize(env: Env) {
  const ai = new Ai(env.AI);

  for (const query of testQueries) {
    // Generate query embedding
    const embedding = await ai.run('@cf/baai/bge-base-en-v1.5', {
      text: [query]
    });

    // Search Vectorize
    const results = await env.VECTORIZE.query(embedding.data[0], {
      topK: 3,
      returnMetadata: true
    });

    console.log(`\nQuery: "${query}"`);
    results.matches.forEach((match, i) => {
      console.log(`  ${i + 1}. ${match.metadata.glosa} (score: ${match.score})`);
      console.log(`     Translations: ${match.metadata.translations}`);
    });
  }
}
```

---

### Step 5.2: Quality Checks
**Checklist**:
- [ ] Vectorize index contains 1000+ vectors
- [ ] Image files are in `tauri-app/public/signs/`
- [ ] `signs/index.json` maps glosas to image paths
- [ ] Test queries return relevant signs (score > 0.7)
- [ ] Each sign has at least 1 image
- [ ] Spanish translations are present in metadata

---

## Success Criteria

✅ **Complete when**:
1. PostgreSQL database has 1000+ signs extracted from PDFs
2. `signs_vectorized.json` contains embeddings for all signs
3. Vectorize index `signos-lsch-index` has 1000+ vectors uploaded
4. Sign images copied to `tauri-app/public/signs/`
5. Test queries return accurate sign matches

---

## Next Steps

→ Proceed to **WORKER_PLAN.md** to integrate Vectorize RAG into the Cloudflare Worker
