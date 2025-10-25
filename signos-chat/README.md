# SIGNOS Chat 🤟

Chat web minimalista estilo OpenAI para generar videos de lengua de señas chilena (LSCh) desde texto.

## 🎯 Features

- 💬 **Chat Interface** - Interfaz estilo ChatGPT/OpenAI
- 🤟 **LSCh Generation** - Genera videos de señas en tiempo real
- 🎬 **Video Player** - Reproduce secuencias de señas
- 📱 **Responsive** - Funciona en desktop y móvil
- ⚡ **Real-time** - Respuestas instantáneas del worker
- 🎨 **Minimalista** - Diseño limpio y enfocado

## 🚀 Quick Start

### 1. Instalar dependencias

```bash
pnpm install
```

### 2. Configurar Worker URL

Edita `.env.local` con el puerto correcto del worker:

```bash
NEXT_PUBLIC_WORKER_URL=http://localhost:51937
```

### 3. Iniciar el worker de signos-tok

```bash
cd ../signos-tok/worker
npx wrangler dev --experimental-vectorize-bind-to-prod
```

### 4. Iniciar Next.js

```bash
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000)

## 💡 Uso

1. Escribe cualquier texto en español en el chat
2. Presiona Enter o click en el botón enviar
3. El sistema generará las señas correspondientes
4. Reproduce el video con el botón Play
5. Descarga el manifest si lo necesitas

### Ejemplos de frases:

- "hola necesito agua"
- "buenos días cómo estás"
- "gracias por todo"
- "necesito ayuda urgente"

## 🏗️ Arquitectura

```
signos-chat (Next.js)
    ↓ HTTP POST
signos-tok worker (Cloudflare)
    ↓ RAG
Vectorize (2,123 señas LSCh)
    ↓
Video Manifest
    ↓
Chat UI
```

## 📁 Estructura

```
signos-chat/
├── app/
│   ├── page.tsx           # Main chat page
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Global styles
├── components/
│   ├── ChatMessage.tsx    # Message component
│   └── SignVideoPlayer.tsx # Video player
├── lib/
│   └── api.ts             # API client
└── .env.local             # Worker URL config
```

## 🎨 Diseño

Inspirado en ChatGPT con:
- Dark theme (#343541, #444654)
- Colores de rol (user: purple, assistant: green)
- Typography clean (Inter font)
- Smooth animations
- Responsive layout

## 🔧 Configuración Avanzada

### Cambiar Worker URL

```typescript
// lib/api.ts
const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:51937';
```

### Personalizar colores

```typescript
// app/globals.css
// Modifica las clases de Tailwind
bg-[#343541] // Background principal
bg-[#444654] // Background mensajes assistant
bg-[#202123] // Background header/cards
```

### Ajustar animaciones

```typescript
// components/SignVideoPlayer.tsx
intervalRef.current = setInterval(() => {
  // Cambiar 500ms por tu preferencia
}, 500);
```

## 📊 API Endpoints Usados

- `POST /api/generate` - Genera video desde texto
- `GET /api/translate` - Solo traduce (sin video)
- `GET /api/videos/:id` - Obtiene manifest del video

## 🐛 Troubleshooting

### Worker no conecta

```bash
# Verificar que el worker esté corriendo
curl http://localhost:51937

# Si no responde, reiniciar:
cd ../signos-tok/worker
pkill -f "wrangler dev"
npx wrangler dev --experimental-vectorize-bind-to-prod
```

### Puerto incorrecto

El worker puede iniciar en puertos aleatorios. Busca en los logs:

```bash
tail -f /tmp/signos-final.log | grep "Ready on"
# Actualiza NEXT_PUBLIC_WORKER_URL con el puerto correcto
```

### No encuentra señas

El worker necesita Vectorize. Asegúrate de usar:
```bash
npx wrangler dev --experimental-vectorize-bind-to-prod
```

## 🚀 Deploy

### Vercel (Recomendado)

```bash
# 1. Push a GitHub
git add .
git commit -m "Add signos-chat"
git push

# 2. Deploy en Vercel
# - Conecta el repo
# - Agrega NEXT_PUBLIC_WORKER_URL (URL production del worker)
# - Deploy
```

### Variables de entorno en producción

```bash
NEXT_PUBLIC_WORKER_URL=https://signos-tok-worker.tu-dominio.workers.dev
```

## 📝 TODO

- [ ] Agregar imágenes reales de señas
- [ ] Implementar audio TTS
- [ ] Guardar historial de chat
- [ ] Exportar chat a PDF
- [ ] Modo oscuro/claro
- [ ] Compartir videos generados

## 🤝 Integración

Este frontend se integra con:
- **signos-tok/worker** - Backend de generación
- **Vectorize** - Base de datos de señas
- **Workers AI** - Embeddings y LLM

## 📄 License

MIT

---

**Built with ❤️ for the Deaf community**

🤟 Making sign language accessible through AI

