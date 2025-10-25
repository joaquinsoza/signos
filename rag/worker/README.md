# Signos Worker (Cloudflare Workers + Workers AI + Vectorize)

RAG minimal para diccionario de lengua de señas.  
- Vector DB: **Vectorize v2** (índice `signos`)  
- Embeddings: **@cf/google/embeddinggemma-300m** (768 dims)  
- LLM: **@cf/meta/llama-3.1-8b-instruct**

## 1) Requisitos
- Node 18+
- `npm i -g wrangler` (>= 3.75)
- Cuenta Cloudflare con **Workers**, **Workers AI** y **Vectorize** habilitados.

## 2) Crear índice y metadata indexes
```bash
npx wrangler vectorize create signos --dimensions=768 --metric=cosine
npx wrangler vectorize create-metadata-index signos --property-name=glosa --type=string
npx wrangler vectorize create-metadata-index signos --property-name=language_code --type=string
npx wrangler vectorize create-metadata-index signos --property-name=region --type=string
```

> Asegúrate de que las **dimensiones (768)** coinciden con el modelo de embeddings.

## 3) Ejecutar

```bash
npm install
npm run dev   # usa --remote para AI binding
# o
npm run deploy
```

## 4) Endpoints

### Health

```bash
curl https://<tu-worker>.workers.dev/
```

### Ingesta

```bash
curl -X POST https://<tu-worker>.workers.dev/ingest \
  -H "content-type: application/json" -d '{
  "docs":[
    {
      "id":"lsch:ABANDONAR",
      "text":"ABANDONAR. Dejar o apartarse de algo o alguien.",
      "metadata":{
        "glosa":"ABANDONAR",
        "language_code":"lsch",
        "region":"Metropolitan",
        "definition":"Dejar o apartarse de algo o alguien.",
        "images":[
          {"url":"https://r2.example.com/signos/abandonar_0.jpeg","sequence":0},
          {"url":"https://r2.example.com/signos/abandonar_1.jpeg","sequence":1}
        ],
        "synonyms":["DEJAR"]
      }
    }
  ]}'
```

### Lookup exacto (key→value por glosa)

```bash
curl -X POST https://<tu-worker>.workers.dev/get \
  -H "content-type: application/json" -d '{
  "glosa": "ABANDONAR",
  "language_code": "lsch"
}'
```

### Búsqueda semántica

```bash
curl -X POST https://<tu-worker>.workers.dev/search \
  -H "content-type: application/json" -d '{
  "query": "gesto para dejar algo",
  "topK": 5,
  "filter": {"language_code":"lsch"}
}'
```

### RAG end-to-end

```bash
curl -X POST https://<tu-worker>.workers.dev/answer \
  -H "content-type: application/json" -d '{
  "question": "Muéstrame el signo de abandonar con imágenes",
  "topK": 3,
  "filter": {"language_code":"lsch"}
}'
```

## 5) Debug tips

* Corre `npm run dev` (usa `--remote` por defecto).
* Revisa logs: `wrangler tail`.
* Verifica índice:

```bash
npx wrangler vectorize info signos
npx wrangler vectorize list-vectors signos --count 10
```

## 6) Notas

* Sube tus imágenes a **R2** y referencia con URLs públicas o firmadas.
* Si cambias de modelo de embeddings, recrea el índice con la dimensión correcta.
