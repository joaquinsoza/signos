#!/bin/bash

# Script para procesar los diccionarios LSCh

echo "📚 Procesando Diccionarios LSCh..."
echo ""

# Activar virtualenv si existe
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# PDF 1: Diccionario A-H
echo "📄 Procesando Diccionario A-H..."
python process-pdf.py \
  --pdf ../../signsToJson/pdfs/Diccionario_LSCh_A-H.pdf \
  --title "Diccionario de Lengua de Señas Chilena A-H" \
  --category linguistica \
  --tags "diccionario,LSCh,vocabulario,A-H" \
  --output embeddings-ah.ndjson

echo ""
echo "✅ Diccionario A-H procesado"
echo ""

# PDF 2: Diccionario I-Z
echo "📄 Procesando Diccionario I-Z..."
python process-pdf.py \
  --pdf ../../signsToJson/pdfs/Diccionario_LSCh_I-Z.pdf \
  --title "Diccionario de Lengua de Señas Chilena I-Z" \
  --category linguistica \
  --tags "diccionario,LSCh,vocabulario,I-Z" \
  --output embeddings-iz.ndjson

echo ""
echo "✅ Diccionario I-Z procesado"
echo ""

# PDF 3: 21 pages (muestra)
echo "📄 Procesando documento de 21 páginas..."
python process-pdf.py \
  --pdf ../../signsToJson/pdfs/21pages.pdf \
  --title "Introducción a Lengua de Señas Chilena" \
  --category aprendizaje \
  --tags "introduccion,LSCh,basico" \
  --output embeddings-intro.ndjson

echo ""
echo "✅ Documento de introducción procesado"
echo ""

# Combinar todos los embeddings
echo "📦 Combinando embeddings..."
cat embeddings-ah.ndjson embeddings-iz.ndjson embeddings-intro.ndjson > all-knowledge-embeddings.ndjson

echo ""
echo "✅ ¡Todos los PDFs procesados!"
echo ""
echo "📊 Resumen:"
wc -l embeddings-*.ndjson all-knowledge-embeddings.ndjson

echo ""
echo "📤 Próximo paso: Subir a Vectorize"
echo ""
echo "Opción 1 - Local (para testing):"
echo "  wrangler vectorize insert signos-knowledge-index --file=all-knowledge-embeddings.ndjson --local"
echo ""
echo "Opción 2 - Producción:"
echo "  # Primero crear el índice:"
echo "  ./create-knowledge-index.sh"
echo "  # Luego subir:"
echo "  wrangler vectorize insert signos-knowledge-index --file=all-knowledge-embeddings.ndjson"
echo ""

