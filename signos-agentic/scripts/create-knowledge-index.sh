#!/bin/bash

# Script para crear el índice Vectorize de conocimiento

echo "🚀 Creando índice Vectorize para Knowledge RAG..."

# Crear índice
wrangler vectorize create signos-knowledge-index \
  --dimensions=768 \
  --metric=cosine

echo ""
echo "✅ Índice creado!"
echo ""
echo "📋 Agrega esto a worker/wrangler.toml:"
echo ""
echo "[[vectorize]]"
echo "binding = \"KNOWLEDGE_VECTORIZE\""
echo "index_name = \"signos-knowledge-index\""
echo ""

