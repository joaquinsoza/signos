# 📚 Scripts para Knowledge RAG

Scripts para procesar PDFs y otros documentos para el sistema de Knowledge RAG.

---

## 🎯 Pipeline Completo

```
PDF → Extraer Texto → Limpiar → Chunks → Embeddings → Vectorize
```

---

## 🚀 Setup

### 1. Instalar dependencias Python

```bash
cd scripts
python3 -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configurar variables de entorno

Crear archivo `.env`:

```bash
WORKER_URL=http://localhost:8787
```

### 3. Crear índice Vectorize

```bash
chmod +x create-knowledge-index.sh
./create-knowledge-index.sh
```

---

## 📄 Procesar PDFs

### Procesar un solo PDF

```bash
python process-pdf.py \
  --pdf ../data/pdfs/historia-lsch.pdf \
  --title "Historia de la Lengua de Señas Chilena" \
  --category historia \
  --tags "historia,LSCh,origen" \
  --output historia-embeddings.ndjson
```

### Procesar directorio completo (batch)

```bash
python process-pdf.py \
  --pdf-dir ../data/pdfs/ \
  --category gramatica \
  --batch \
  --output gramatica-embeddings.ndjson
```

---

## ⬆️ Subir a Vectorize

### Opción 1: Local (desarrollo)

```bash
wrangler vectorize insert signos-knowledge-index \
  --file=knowledge-embeddings.ndjson \
  --local
```

### Opción 2: Producción

```bash
wrangler vectorize insert signos-knowledge-index \
  --file=knowledge-embeddings.ndjson
```

---

## 📊 Ejemplos de Uso

### Ejemplo 1: Manual de Gramática LSCh

```bash
# 1. Colocar PDF en data/pdfs/
cp ~/Downloads/manual-gramatica-lsch.pdf data/pdfs/

# 2. Procesar
python process-pdf.py \
  --pdf data/pdfs/manual-gramatica-lsch.pdf \
  --title "Manual de Gramática LSCh" \
  --category gramatica \
  --tags "gramatica,sintaxis,verbos,sustantivos"

# 3. Subir
wrangler vectorize insert signos-knowledge-index \
  --file=knowledge-embeddings.ndjson
```

### Ejemplo 2: Documentos de Cultura Sorda

```bash
# Procesar varios PDFs
python process-pdf.py \
  --pdf-dir data/pdfs/cultura/ \
  --category cultura \
  --batch \
  --output cultura-embeddings.ndjson

# Subir
wrangler vectorize insert signos-knowledge-index \
  --file=cultura-embeddings.ndjson
```

### Ejemplo 3: Tesis sobre LSCh

```bash
python process-pdf.py \
  --pdf data/pdfs/tesis-linguistica-lsch.pdf \
  --title "Análisis Lingüístico de LSCh" \
  --category linguistica \
  --tags "linguistica,analisis,tesis,universidad"
```

---

## 🔧 Parámetros del Script

### `--pdf` (string)
Ruta a un PDF individual

### `--pdf-dir` (string)
Directorio con múltiples PDFs

### `--title` (string, requerido con --pdf)
Título del documento

### `--category` (string, requerido)
Categoría del contenido
- `historia`: Historia de lenguas de señas
- `gramatica`: Gramática y estructura
- `cultura`: Cultura sorda
- `tecnica`: Técnicas de señado
- `linguistica`: Lingüística comparativa
- `aprendizaje`: Métodos de aprendizaje

### `--tags` (string, opcional)
Tags separados por comas

### `--output` (string, default: knowledge-embeddings.ndjson)
Archivo de salida

### `--batch` (flag)
Modo batch para procesar directorio

---

## 📁 Estructura de Datos

### Input (PDF)
```
manual-lsch.pdf
```

### Output (NDJSON)
```json
{"id": "manual-lsch_chunk_0", "values": [0.1, 0.2, ...], "metadata": {...}}
{"id": "manual-lsch_chunk_1", "values": [0.3, 0.4, ...], "metadata": {...}}
```

### Metadata incluye:
- `title`: Título del documento
- `content`: Contenido del chunk (truncado)
- `category`: Categoría
- `tags`: Tags en JSON
- `source`: Nombre del archivo fuente
- `chunk_index`: Índice del chunk
- `total_chunks`: Total de chunks

---

## 🎯 Chunking Strategy

- **Tamaño de chunk**: 1000 caracteres
- **Overlap**: 200 caracteres
- **Estrategia**: Corta en punto o párrafo cuando es posible
- **Limpieza**: Normaliza espacios y caracteres especiales

---

## 🧪 Testing

### Test del pipeline completo

```bash
# 1. Crear PDF de prueba (o usar existente)
echo "Este es un documento de prueba sobre lengua de señas." > test.txt

# 2. Convertir a PDF (con cualquier herramienta)

# 3. Procesar
python process-pdf.py \
  --pdf test.pdf \
  --title "Test Document" \
  --category aprendizaje \
  --output test-embeddings.ndjson

# 4. Verificar output
cat test-embeddings.ndjson | jq .
```

---

## 🐛 Troubleshooting

### Error: "WORKER_URL not responding"

**Solución**: Asegúrate de que el worker esté corriendo:
```bash
cd ../worker
pnpm dev
```

### Error: "PDF extraction failed"

**Solución**: Verifica que el PDF no esté encriptado o corrupto.

### Error: "No text extracted"

**Solución**: Algunos PDFs son solo imágenes. Necesitas OCR:
```bash
pip install pytesseract
```

### Chunks muy grandes

**Solución**: Ajusta `CHUNK_SIZE` en el script:
```python
CHUNK_SIZE = 500  # Chunks más pequeños
```

---

## 📊 Estimaciones

### Por PDF (100 páginas):
- Extracción: ~30 segundos
- Chunking: ~5 segundos
- Embeddings: ~2-3 minutos (depende del worker)
- Total: **~4 minutos**

### Costos Vectorize:
- Storage: $0.04 por millón de dimensiones/mes
- Queries: $0.01 por millón de dimensiones leídas
- Writes: Gratis

**Ejemplo**: 10 PDFs, 50 chunks cada uno = 500 vectores
- Storage: ~$0.02/mes
- Muy económico! 💰

---

## 🚀 Automatización

### Cron job para procesar PDFs nuevos

```bash
#!/bin/bash
# auto-process-pdfs.sh

PDFS_DIR="/path/to/pdfs"
WATCH_DIR="$PDFS_DIR/new"

# Procesar PDFs nuevos
for pdf in $WATCH_DIR/*.pdf; do
  echo "Processing $pdf..."
  python process-pdf.py \
    --pdf "$pdf" \
    --category aprendizaje \
    --batch
  
  # Subir a Vectorize
  wrangler vectorize insert signos-knowledge-index \
    --file=knowledge-embeddings.ndjson
  
  # Mover a procesados
  mv "$pdf" "$PDFS_DIR/processed/"
done
```

---

## 📝 Fuentes de Contenido Recomendadas

### PDFs sugeridos para el Knowledge Base:

1. **Historia**
   - Historia de la educación de sordos en Chile
   - Ley 20.422 (reconocimiento oficial de LSCh)
   - Biografías de líderes sordos

2. **Gramática**
   - Manuales de gramática LSCh
   - Tesis lingüísticas
   - Artículos académicos sobre estructura

3. **Cultura**
   - Documentos sobre cultura sorda
   - Normas sociales y etiqueta
   - Arte y expresión en comunidad sorda

4. **Técnica**
   - Guías de expresiones faciales
   - Manuales de dactilología
   - Técnicas de interpretación

5. **Aprendizaje**
   - Métodos de enseñanza
   - Planes de estudio
   - Tips y mejores prácticas

---

## 🤝 Contribuir

¿Tienes PDFs educativos sobre LSCh?

1. Verifica que sean de dominio público o tengas derechos
2. Colócalos en `data/pdfs/`
3. Procesa con el script
4. Comparte el output para revisión

---

**🤟 Construyendo la base de conocimiento más completa sobre LSCh**

