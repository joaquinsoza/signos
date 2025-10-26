# 🚀 Instrucciones para Procesar los Diccionarios LSCh

## ✅ Checklist Rápido

### Terminal 1: Worker corriendo
```bash
cd /Users/josefredes/Developer/signos/signos/signos-agentic/worker
pnpm dev
```
✅ Debe mostrar: `🌍 Listening on http://localhost:53973`

---

### Terminal 2: Procesar PDFs

#### Paso 1: Setup Python (solo primera vez)
```bash
cd /Users/josefredes/Developer/signos/signos/signos-agentic/scripts
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

#### Paso 2: Procesar los 3 PDFs del diccionario
```bash
./process-diccionarios.sh
```

**⏱️ Tiempo estimado:** 10-15 minutos (depende del tamaño de los PDFs)

**📊 Output esperado:**
```
📚 Procesando Diccionarios LSCh...

📄 Procesando Diccionario A-H...
📄 Extrayendo texto de: ../../signsToJson/pdfs/Diccionario_LSCh_A-H.pdf
  ✓ Página 1/150
  ✓ Página 2/150
  ...
✅ Diccionario A-H procesado

📄 Procesando Diccionario I-Z...
...
✅ Diccionario I-Z procesado

📄 Procesando documento de 21 páginas...
...
✅ Documento de introducción procesado

✅ ¡Todos los PDFs procesados!
```

---

### Terminal 3: Crear índice y subir (solo primera vez)

#### Paso 3a: Crear índice Vectorize
```bash
cd /Users/josefredes/Developer/signos/signos/signos-agentic/scripts
./create-knowledge-index.sh
```

**📋 Copia el output y actualiza `worker/wrangler.toml`**

#### Paso 3b: Subir embeddings a Vectorize
```bash
# Para testing local:
wrangler vectorize insert signos-knowledge-index \
  --file=all-knowledge-embeddings.ndjson

# O si prefieres producción directamente:
wrangler vectorize insert signos-knowledge-index \
  --file=all-knowledge-embeddings.ndjson \
  --remote
```

---

## ✅ Verificar que Funcionó

### Test en el chat:

1. Ve a http://localhost:3000 (con el worker y frontend corriendo)
2. Escribe alguna de estas preguntas:

```
qué es la cultura sorda
```

```
cómo funciona la gramática de LSCh
```

```
cuál es la historia de la lengua de señas chilena
```

Si el agente responde con información detallada, ¡funciona! 🎉

---

## 🐛 Troubleshooting

### Error: "WORKER_URL not responding"
**Solución:** Verifica que el worker esté corriendo en Terminal 1

### Error: "ModuleNotFoundError: No module named 'pdfplumber'"
**Solución:** Activa el virtualenv:
```bash
source venv/bin/activate
pip install -r requirements.txt
```

### Error: "Vectorize index not found"
**Solución:** Crea el índice primero:
```bash
./create-knowledge-index.sh
```

### Los PDFs tardan mucho
**Normal!** Los diccionarios son grandes. Puedes ver el progreso página por página.

---

## 📊 Qué Archivos se Generan

- `embeddings-ah.ndjson` - Embeddings del diccionario A-H
- `embeddings-iz.ndjson` - Embeddings del diccionario I-Z  
- `embeddings-intro.ndjson` - Embeddings del documento intro
- `all-knowledge-embeddings.ndjson` - **Todos combinados** (este se sube a Vectorize)

---

## 🎯 Resultado Final

El agente podrá responder preguntas educativas usando:
- ✅ Contenido de los diccionarios LSCh completos
- ✅ Documentación de introducción
- ✅ Base de conocimiento incorporada (fallback)

Total de conocimiento: **~300+ páginas de contenido LSCh** 📚

---

**¿Listo? Ejecuta los comandos en orden y en 15 minutos tendrás el Knowledge RAG completo! 🚀**

