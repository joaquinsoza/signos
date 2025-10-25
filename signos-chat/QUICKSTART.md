# 🚀 Quick Start - SIGNOS Chat

## Inicio Rápido (2 pasos)

### 1️⃣ Iniciar el Worker

```bash
cd signos-tok/worker
npx wrangler dev --experimental-vectorize-bind-to-prod
```

**Importante:** Anota el puerto donde inicia (ej: `Ready on http://localhost:51937`)

### 2️⃣ Iniciar Next.js

```bash
cd signos-chat

# Si el puerto del worker es diferente a 51937, actualiza .env.local:
echo "NEXT_PUBLIC_WORKER_URL=http://localhost:TU_PUERTO" > .env.local

pnpm dev
```

Abre: **http://localhost:3000** 🎉

---

## 🎬 Cómo Usar

1. Abre http://localhost:3000
2. Escribe cualquier frase en español
3. ¡Mira las señas generadas!

### Ejemplos de frases:

```
hola necesito agua
buenos días cómo estás
gracias por todo
necesito ayuda urgente
```

---

## 📱 Features

- 💬 **Chat Interface** - Estilo ChatGPT
- 🤟 **2,123 señas LSCh** - Diccionario completo
- 🎬 **Video Player** - Reproduce las señas
- ⚡ **Tiempo real** - Respuestas < 1 segundo
- 🎨 **Dark Mode** - Diseño minimalista

---

## 🐛 Troubleshooting

### Error: Cannot connect to worker

```bash
# Verificar que el worker esté corriendo:
curl http://localhost:51937

# Si no responde, reiniciar:
cd signos-tok/worker
pkill -f "wrangler dev"
npx wrangler dev --experimental-vectorize-bind-to-prod
```

### El worker inicia en puerto diferente

```bash
# Buscar el puerto en los logs:
tail -f /tmp/signos-final.log | grep "Ready on"

# Actualizar .env.local:
echo "NEXT_PUBLIC_WORKER_URL=http://localhost:NUEVO_PUERTO" > .env.local

# Reiniciar Next.js:
pkill -f "next dev"
pnpm dev
```

### No encuentra señas

El worker DEBE iniciarse con el flag especial:
```bash
npx wrangler dev --experimental-vectorize-bind-to-prod
# ☝️ Este flag conecta a Vectorize de producción
```

---

## 🏗️ Arquitectura

```
┌─────────────────┐
│  Next.js Chat   │ ← http://localhost:3000
│   (Frontend)    │
└────────┬────────┘
         │ HTTP POST
         ↓
┌─────────────────┐
│ signos-tok      │ ← http://localhost:51937
│   Worker        │
└────────┬────────┘
         │ RAG
         ↓
┌─────────────────┐
│   Vectorize     │
│ (2,123 señas)   │
└─────────────────┘
```

---

## 🎯 Endpoints API

- `POST /api/generate` - Genera video completo
- `GET /api/translate` - Solo traduce a señas
- `GET /api/videos/:id` - Obtiene manifest del video

---

## 📊 Performance

```
Latencia promedio: 792ms
Vectorize query: ~500ms
LLM selection: ~200ms
Manifest gen: ~100ms
```

---

## 🚀 Next Steps

1. ✅ Chat funcionando
2. 📸 Agregar imágenes reales de señas
3. 🎥 Renderizar videos MP4 reales
4. 🔊 Integrar TTS para audio
5. 📤 Compartir videos
6. 📱 App móvil con Tauri

---

**¡Ya está listo para usar! 🤟**

Abre http://localhost:3000 y empieza a generar señas.

