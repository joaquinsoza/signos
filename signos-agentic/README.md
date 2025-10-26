# SIGNOS Agentic 🤟

**Plataforma web agéntica para aprender Lengua de Señas Chilena (LSCh) de forma interactiva**

Aprende LSCh al estilo Duolingo con un agente conversacional impulsado por IA, ejercicios gamificados y videos de señas en tiempo real.

---

## 🎯 Características

### 🤖 Agente Conversacional con IA
- Profesor virtual impulsado por **Llama 3.1** de Cloudflare Workers AI
- Conversaciones naturales y contextuales
- Adapta la dificultad según tu nivel
- Feedback inmediato y personalizado

### 📚 Sistema de Lecciones Estructuradas
- **6+ lecciones** organizadas por categorías (saludos, familia, números, comida, etc.)
- Progresión gradual por niveles
- Desbloqueo automático de contenido
- Sistema de prerrequisitos

### 🎮 Gamificación Completa
- **XP y Niveles**: Gana puntos con cada ejercicio
- **Rachas diarias**: Mantén tu motivación
- **Logros**: Desbloquea badges especiales
- **Progreso visual**: Tracking completo de tu aprendizaje

### 🎯 Tipos de Ejercicios
1. **Matching**: Video → Palabra
2. **Traducción**: Palabra → Seña
3. **Video a texto**: Observa y escribe
4. **Construcción de frases**: Combina señas

### 🎬 Videos de Señas LSCh
- **2,123 señas** del diccionario oficial
- Múltiples imágenes por seña
- Reproducción animada frame-por-frame
- Definiciones y contexto

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────┐
│   Cloudflare Pages (React + Vite)          │
│   - Chat Interface                          │
│   - Video Player                            │
│   - Progress Dashboard                      │
│   - Gamification UI                         │
└─────────────────┬───────────────────────────┘
                  ↓ REST API
┌─────────────────────────────────────────────┐
│   Cloudflare Worker (TypeScript)           │
│   - Agent Service (Llama 3.1)              │
│   - Lesson Service                          │
│   - User Service                            │
│   - Sign Matcher (RAG)                      │
└──┬────────┬─────────┬──────────┬───────────┘
   ↓        ↓         ↓          ↓
┌────┐  ┌────┐  ┌──────────┐  ┌────┐
│ D1 │  │ KV │  │Vectorize │  │ AI │
│    │  │    │  │          │  │    │
│User│  │Ses-│  │2,123     │  │Llama│
│Data│  │sion│  │señas     │  │3.1 │
└────┘  └────┘  └──────────┘  └────┘
```

### Stack Tecnológico

**Frontend:**
- React 18 + TypeScript
- Vite
- Tailwind CSS
- Lucide Icons

**Backend:**
- Cloudflare Workers
- Workers AI (Llama 3.1 + BGE embeddings)
- D1 Database (SQLite)
- Vectorize (vector DB)
- KV (sessions)

---

## 🚀 Quick Start

### Prerrequisitos

- Node.js 18+
- pnpm (o npm)
- Cuenta de Cloudflare con Workers AI habilitado
- Wrangler CLI instalado

### 1. Clonar y Setup

```bash
cd signos-agentic

# Instalar dependencias del worker
cd worker
pnpm install

# Instalar dependencias del frontend
cd ../frontend
pnpm install
```

### 2. Configurar Worker

```bash
cd worker

# Crear base de datos D1
pnpm run db:create

# Copiar el database_id del output al wrangler.toml

# Inicializar schema
pnpm run db:init-local

# Crear KV namespace
pnpm run kv:create

# Copiar el id al wrangler.toml
```

Edita `wrangler.toml` con los IDs correctos:

```toml
[[d1_databases]]
binding = "DB"
database_name = "signos-agentic-db"
database_id = "tu-database-id-aqui"

[[kv_namespaces]]
binding = "SESSIONS"
id = "tu-kv-id-aqui"
```

### 3. Iniciar Worker (Dev)

```bash
cd worker
pnpm dev
```

El worker estará disponible en `http://localhost:8787`

### 4. Iniciar Frontend

```bash
cd frontend

# Crear archivo .env
echo "VITE_WORKER_URL=http://localhost:8787" > .env

pnpm dev
```

La app estará disponible en `http://localhost:3000`

### 5. ¡Empieza a Aprender! 🎉

Abre `http://localhost:3000` y:

1. El sistema creará automáticamente un usuario
2. Escribe "empezar lección" para comenzar
3. Responde los ejercicios
4. Gana XP y desbloquea logros
5. ¡Aprende LSCh! 🤟

---

## 📁 Estructura del Proyecto

```
signos-agentic/
├── worker/                    # Backend (Cloudflare Worker)
│   ├── src/
│   │   ├── index.ts          # API routes
│   │   ├── types.ts          # TypeScript types
│   │   └── services/
│   │       ├── agent-service.ts      # Agente conversacional
│   │       ├── lesson-service.ts     # Sistema de lecciones
│   │       ├── user-service.ts       # Gestión de usuarios
│   │       └── sign-matcher.ts       # RAG para señas
│   ├── schema.sql            # Database schema
│   ├── wrangler.toml         # Worker config
│   └── package.json
│
├── frontend/                  # Frontend (React + Vite)
│   ├── src/
│   │   ├── App.tsx           # Aplicación principal
│   │   ├── main.tsx          # Entry point
│   │   ├── lib/
│   │   │   └── api.ts        # API client
│   │   └── components/
│   │       ├── ChatInterface.tsx       # Chat UI
│   │       ├── ExerciseCard.tsx        # Ejercicios
│   │       ├── SignVideoPlayer.tsx     # Video player
│   │       └── ProgressDashboard.tsx   # Dashboard
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
└── README.md                  # Este archivo
```

---

## 🎓 Uso de la Plataforma

### Comandos del Chat

El agente entiende intenciones naturales:

**Aprendizaje:**
- "empezar lección"
- "comenzar a aprender"
- "siguiente lección"

**Práctica:**
- "practicar"
- "repasar"
- "ejercicio"

**Búsqueda:**
- "cómo se dice agua"
- "muéstrame la seña de hola"
- "qué significa esta palabra"

**Progreso:**
- "mi progreso"
- "cuánto XP tengo"
- "qué nivel soy"

### Flujo de Aprendizaje

1. **Inicio de Lección**
   - El agente presenta la lección
   - Explica qué aprenderás
   - Muestra las señas

2. **Ejercicios**
   - Responde preguntas
   - El agente valida tus respuestas
   - Ganas XP por respuestas correctas

3. **Completar Lección**
   - Desbloqueas la siguiente lección
   - Posible subida de nivel
   - Logros desbloqueados

4. **Práctica**
   - Repasa señas aprendidas
   - Ejercicios aleatorios
   - Mantén tu racha

---

## 📊 API Endpoints

### `POST /api/chat`

Envía mensaje al agente

```json
{
  "user_id": "user_123",
  "message": "empezar lección",
  "session_id": "session_456" // opcional
}
```

### `POST /api/user`

Crear usuario

```json
{
  "username": "juan",
  "email": "juan@example.com" // opcional
}
```

### `GET /api/user/progress?user_id={id}`

Obtener progreso del usuario

### `GET /api/lessons?user_id={id}`

Listar lecciones (disponibles para el usuario)

### `GET /api/signs/search?q={query}`

Buscar señas por texto

---

## 🚀 Deployment

### Deploy Worker a Cloudflare

```bash
cd worker

# Configurar secrets (si es necesario)
wrangler secret put CF_ACCOUNT
wrangler secret put CF_API_TOKEN

# Crear recursos en producción
wrangler d1 create signos-agentic-db
wrangler kv:namespace create SESSIONS

# Actualizar wrangler.toml con IDs de producción

# Inicializar DB
pnpm run db:init

# Deploy
pnpm deploy
```

### Deploy Frontend a Cloudflare Pages

```bash
cd frontend

# Build
pnpm build

# Deploy con Wrangler
pnpm deploy
```

O conecta el repo a Cloudflare Pages dashboard:

1. Ve a Cloudflare Dashboard → Pages
2. Conecta tu repositorio
3. Configura:
   - Build command: `pnpm build`
   - Build output: `dist`
   - Root directory: `signos-agentic/frontend`
4. Agrega variable de entorno:
   - `VITE_WORKER_URL=https://signos-agentic-worker.tu-dominio.workers.dev`

---

## 🎨 Personalización

### Agregar Nuevas Lecciones

Edita `worker/schema.sql` y agrega en la sección de `INSERT INTO lessons`:

```sql
INSERT INTO lessons (id, title, description, category, difficulty, required_level, xp_reward, order_index)
VALUES ('lesson_nueva', 'Nueva Lección', 'Descripción', 'categoria', 2, 5, 25, 7);

INSERT INTO lesson_signs (lesson_id, glosa, order_index)
VALUES 
  ('lesson_nueva', 'PALABRA1', 1),
  ('lesson_nueva', 'PALABRA2', 2);
```

### Agregar Nuevos Logros

```sql
INSERT INTO achievements (id, name, description, icon, requirement_type, requirement_value)
VALUES ('achievement_new', 'Logro Nuevo', 'Descripción', '🏆', 'xp_total', 2000);
```

### Modificar Sistema de XP

Edita `worker/src/services/user-service.ts`:

```typescript
private calculateLevel(xp: number): number {
  // Tu fórmula personalizada
  return Math.floor(Math.sqrt(xp / 50)) + 1;
}
```

---

## 🧪 Testing

### Test Worker Localmente

```bash
cd worker
pnpm dev

# En otra terminal
curl http://localhost:8787/health
```

### Test Crear Usuario

```bash
curl -X POST http://localhost:8787/api/user \
  -H "Content-Type: application/json" \
  -d '{"username":"test_user"}'
```

### Test Chat

```bash
curl -X POST http://localhost:8787/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"user_xxx",
    "message":"empezar lección"
  }'
```

---

## 🐛 Troubleshooting

### Worker no inicia

**Error**: `Failed to bind AI` o `Failed to bind Vectorize`

**Solución**: 
- Verifica que tu cuenta Cloudflare tenga Workers AI habilitado
- Usa `remote = true` en wrangler.toml para dev
- Asegúrate de que el índice Vectorize existe

### Base de datos no inicializa

**Solución**:
```bash
# Eliminar y recrear
wrangler d1 delete signos-agentic-db
wrangler d1 create signos-agentic-db
pnpm run db:init-local
```

### Frontend no conecta con Worker

**Solución**:
- Verifica que `VITE_WORKER_URL` esté correcto en `.env`
- Verifica que el worker esté corriendo
- Revisa la consola del navegador para errores CORS

### No encuentra señas

**Causa**: El índice Vectorize no está poblado

**Solución**: Necesitas poblar el índice con las señas del diccionario. Ver `signsToJson/README_PIPELINE.md` en el proyecto principal.

---

## 🔮 Roadmap Futuro

### Fase 1: Mejoras Inmediatas
- [ ] Exportar progreso a PDF
- [ ] Compartir logros en redes sociales
- [ ] Sistema de amigos / competencia
- [ ] Modo oscuro/claro

### Fase 2: Contenido
- [ ] Más lecciones (20+ total)
- [ ] Lecciones temáticas (médico, escuela, trabajo)
- [ ] Videos reales de señantes
- [ ] Audio TTS para definiciones

### Fase 3: Features Avanzadas
- [ ] Reconocimiento de señas con cámara (MediaPipe)
- [ ] Modo multiplayer / desafíos
- [ ] Certificados de completación
- [ ] App móvil nativa

### Fase 4: Internacionalización
- [ ] Soporte para otras lenguas de señas (ASL, LSM, etc.)
- [ ] Interfaz multiidioma
- [ ] Comunidad de contribuidores

---

## 🤝 Integración con otros proyectos

### signos/worker
RAG en tiempo real con WebSocket para la app Tauri

### signos-tok/worker  
Generación de videos de señas desde texto

**Integración futura**: El agente podría usar signos-tok para generar videos combinados de frases completas.

### signsToJson
Pipeline de extracción del diccionario LSCh

**Dependencia**: Necesario para poblar el índice Vectorize con las 2,123 señas.

---

## 📄 License

MIT License - Built for educational purposes

---

## 🙏 Créditos

- **Comunidad Sorda Chilena** por el diccionario LSCh oficial
- **Cloudflare** por Workers AI platform
- **Meta** por Llama 3.1

---

**Construido con ❤️ para la comunidad sorda**

🤟 Haciendo el lenguaje de señas accesible a través de IA

---

## 📞 Soporte

¿Preguntas o problemas? 

- Revisa la sección de Troubleshooting
- Consulta la documentación de Cloudflare Workers
- Revisa los logs del worker: `wrangler tail`

---

**¡Empieza tu viaje de aprendizaje de LSCh hoy! 🎉**

