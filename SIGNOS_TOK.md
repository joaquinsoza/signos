# signos-tok - Text to Sign Language Video Generator

**Nuevo proyecto** para generar videos de lengua de señas chilena desde scripts de texto.

---

## 🎯 Propósito

`signos-tok` convierte texto en español a videos de lengua de señas chilena (LSCh) usando:
- **IA para traducción** (Vectorize RAG + Llama 3.1)
- **Generación de manifests de video** desde secuencias de imágenes
- **API RESTful** para integración
- **CLI** para generación rápida

---

## 📁 Ubicación

```
signos/
└── signos-tok/
    ├── worker/          # Cloudflare Worker (API)
    ├── cli/             # Herramienta de línea de comandos
    ├── README.md        # Documentación principal
    ├── QUICKSTART.md    # Guía de inicio rápido
    ├── EXAMPLES.md      # Ejemplos de uso
    └── setup.sh         # Script de instalación
```

---

## 🚀 Inicio Rápido

### 1. Setup Automático

```bash
cd signos-tok
./setup.sh
```

### 2. Iniciar Worker

```bash
cd worker
pnpm dev
```

### 3. Generar tu Primer Video

```bash
cd cli
node generate-video.mjs "hola necesito agua"
```

---

## 🏗️ Arquitectura

```
Texto → SignMatcher (RAG) → SignWithImages[] → VideoGenerator → Manifest → R2
```

### Componentes

1. **SignMatcher**: Traduce texto a señas usando:
   - Vectorize (base de datos de 2,123 señas LSCh)
   - Llama 3.1 (selección inteligente de señas)
   - Cache LRU (frases comunes)

2. **VideoGenerator**: Crea manifests de video:
   - Secuencia frame-por-frame
   - Configuración personalizable (FPS, duración, dimensiones)
   - Almacenamiento en R2

3. **API REST**: Endpoints HTTP:
   - `POST /api/generate` - Generar video
   - `GET /api/translate` - Solo traducir (sin video)
   - `GET /api/videos` - Listar videos
   - `DELETE /api/videos/:id` - Eliminar video

4. **CLI**: Herramienta de línea de comandos:
   - Modo directo: `node generate-video.mjs "texto"`
   - Modo archivo: `--file script.txt`
   - Modo interactivo: `--interactive`

---

## 📊 Diferencias con signos/worker

| Característica | signos/worker | signos-tok |
|----------------|---------------|------------|
| **Input** | Audio en tiempo real | Texto (scripts) |
| **Protocolo** | WebSocket | HTTP REST |
| **Output** | Señas en vivo | Video manifest |
| **Uso** | App Tauri (tiempo real) | Generación batch |
| **Latencia** | < 2s (streaming) | < 1s (completo) |

**Comparten**:
- Mismo índice Vectorize (`signos-lsch-index`)
- Misma lógica de traducción (SignMatcher)
- Mismo diccionario LSCh (2,123 señas)

---

## 📖 Documentación

### Archivos Principales

- **[README.md](signos-tok/README.md)** - Documentación completa
  - Features
  - Arquitectura
  - API reference
  - Deployment

- **[QUICKSTART.md](signos-tok/QUICKSTART.md)** - Guía de 5 minutos
  - Setup paso a paso
  - Primer video
  - Troubleshooting

- **[EXAMPLES.md](signos-tok/EXAMPLES.md)** - Ejemplos de uso
  - Casos básicos
  - Casos avanzados
  - Integraciones (JS, Python, React)
  - Benchmarks

- **[IMPLEMENTATION_PLAN.md](signos-tok/IMPLEMENTATION_PLAN.md)** - Detalles técnicos
  - Fases de implementación
  - Arquitectura detallada
  - Roadmap futuro

---

## 🎬 Ejemplos de Uso

### Ejemplo 1: CLI Básico

```bash
node cli/generate-video.mjs "hola necesito agua"
```

**Output:**
```
📝 Script: "hola necesito agua"
─────────────────────────────────────────
✅ Video generated successfully!
📹 Video ID: video_1234567890_abc
🔗 Video URL: http://localhost:8787/api/videos/video_1234567890_abc/manifest.json
⏱️  Duration: 4.50s
🚀 Processing time: 450ms

🤟 Signs (3):
  1. HOLA
     Definition: Expresión de saludo
     Images: 1
     Confidence: 92.0%
  2. NECESITAR
     Definition: Tener necesidad de algo
     Images: 1
     Confidence: 88.0%
  3. AGUA
     Definition: Líquido vital
     Images: 1
     Confidence: 95.0%
```

---

### Ejemplo 2: API REST

```bash
curl -X POST http://localhost:8787/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "script": "buenos días cómo estás",
    "settings": {
      "fps": 30,
      "signDuration": 2000,
      "width": 720,
      "height": 1280
    }
  }'
```

---

### Ejemplo 3: Integración JavaScript

```javascript
async function generateSignVideo(script) {
  const response = await fetch('http://localhost:8787/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ script })
  });

  const result = await response.json();
  console.log('Video generado:', result.videoId);
  console.log('Señas:', result.signs.map(s => s.glosa).join(', '));
}

generateSignVideo('hola mundo');
```

---

## 🔧 Configuración

### Variables de Entorno (.dev.vars)

```bash
CF_ACCOUNT=tu_cloudflare_account_id
CF_API_TOKEN=tu_cloudflare_api_token
```

### Bindings (wrangler.toml)

```toml
[ai]
binding = "AI"

[[vectorize]]
binding = "VECTORIZE"
index_name = "signos-lsch-index"

[[r2_buckets]]
binding = "VIDEOS"
bucket_name = "signos-tok-videos"
```

---

## 📦 Dependencias

- `@cloudflare/ai` - Workers AI SDK
- `@cloudflare/workers-types` - TypeScript types
- `typescript` - Compilador TypeScript
- `wrangler` - Cloudflare CLI

---

## 🚀 Deployment

```bash
cd signos-tok/worker

# 1. Configurar secrets
npx wrangler secret put CF_ACCOUNT
npx wrangler secret put CF_API_TOKEN

# 2. Desplegar
pnpm deploy
```

---

## 🎯 Casos de Uso

### 1. Contenido Educativo
Generar traducciones de lenguaje de señas para videos educativos

### 2. Accesibilidad Web
Agregar lenguaje de señas a contenido web

### 3. Redes Sociales
Crear videos cortos para TikTok/Instagram en formato LSCh

### 4. Material de Aprendizaje
Generar flashcards y lecciones de vocabulario LSCh

---

## 🔮 Roadmap Futuro

### Fase 9: Video Encoding Real
- [ ] Integración con ffmpeg
- [ ] Generación de MP4/WebM
- [ ] Overlays de texto
- [ ] Música de fondo

### Fase 10: Features Avanzadas
- [ ] Variantes regionales de LSCh
- [ ] Múltiples avatares/señantes
- [ ] Fondos personalizados
- [ ] Expresiones faciales

### Fase 11: Integraciones
- [ ] Plugin WordPress
- [ ] Extensión de navegador
- [ ] SDK móvil
- [ ] Auto-upload a redes sociales

---

## 🤝 Relación con Otros Proyectos

### signos/worker
**Uso**: Traducción en tiempo real (audio → señas → display)
**Comparte**: Vectorize index, SignMatcher logic

### signos/tauri-app
**Uso**: Cliente desktop para STT en tiempo real
**Podría usar**: signos-tok para exportar sesiones a video

### signsToJson
**Provee**: Diccionario LSCh, índice Vectorize, imágenes de señas
**Requerido por**: signos-tok (datos base)

---

## 📊 Performance

| Métrica | Valor |
|---------|-------|
| Latencia traducción | 250-500ms |
| Latencia generación manifest | 50-100ms |
| Latencia total API | 300-600ms |
| Cache hit rate | ~50% (frases comunes) |
| Tamaño manifest | ~5-20 KB |

---

## 🐛 Troubleshooting

### Worker no inicia
**Error**: `Failed to bind AI`
**Solución**: Verificar `.dev.vars` con credenciales correctas

### No se encuentran señas
**Error**: `No signs found for the provided script`
**Solución**: Usar palabras más simples ("hola", "agua", "gracias")

### Bucket R2 no existe
**Error**: `R2 bucket 'signos-tok-videos' not found`
**Solución**: `npx wrangler r2 bucket create signos-tok-videos`

---

## 📝 Estado del Proyecto

**✅ Completado (MVP)**:
- ✅ Worker con API REST
- ✅ SignMatcher (traducción RAG)
- ✅ VideoGenerator (manifests)
- ✅ CLI funcional
- ✅ Tests
- ✅ Documentación completa

**🔜 Próximamente**:
- Video encoding real (ffmpeg)
- Web UI
- Batch processing
- Analytics

---

## 🙏 Créditos

- **Comunidad Sorda Chilena** por el diccionario LSCh
- **Cloudflare** por la plataforma Workers AI
- **Proyecto signos** por la visión de accesibilidad

---

**Construido con ❤️ para la comunidad sorda**

🤟 Haciendo el lenguaje de señas accesible a través de IA

