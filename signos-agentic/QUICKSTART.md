# 🚀 Quick Start - SIGNOS Agentic

Guía rápida de 10 minutos para tener la plataforma corriendo localmente.

---

## ⚡ Setup en 5 pasos

### 1️⃣ Instalar Dependencias (2 min)

```bash
cd signos-agentic

# Worker
cd worker
pnpm install

# Frontend
cd ../frontend
pnpm install
```

### 2️⃣ Configurar D1 Database (2 min)

```bash
cd worker

# Crear base de datos
wrangler d1 create signos-agentic-db

# OUTPUT:
# ✅ Successfully created DB 'signos-agentic-db'
# 📋 database_id = "abc-123-xyz"
```

**Copia el `database_id`** y actualiza `worker/wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "signos-agentic-db"
database_id = "PEGA-TU-ID-AQUI"  # ← Actualiza esto
```

### 3️⃣ Inicializar Database (1 min)

```bash
# Desde worker/
pnpm run db:init-local
```

Verás:
```
✅ 6 lecciones creadas
✅ 18 señas asociadas
✅ 6 logros creados
```

### 4️⃣ Crear KV Namespace (1 min)

```bash
# Desde worker/
wrangler kv:namespace create SESSIONS

# OUTPUT:
# 📋 id = "xyz789"
```

**Copia el `id`** y actualiza `worker/wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "SESSIONS"
id = "PEGA-TU-ID-AQUI"  # ← Actualiza esto
```

### 5️⃣ Iniciar Todo (1 min)

**Terminal 1 - Worker:**
```bash
cd worker
pnpm dev
```

Verás:
```
⛅️ wrangler 3.x.x
🌍 Listening on http://localhost:8787
```

**Terminal 2 - Frontend:**
```bash
cd frontend
echo "VITE_WORKER_URL=http://localhost:8787" > .env
pnpm dev
```

Verás:
```
  VITE v5.x.x  ready in 300 ms

  ➜  Local:   http://localhost:3000/
```

---

## ✅ Verificar que Funciona

### 1. Abrir la App

Abre http://localhost:3000 en tu navegador.

Deberías ver:
- ✅ Pantalla de chat
- ✅ Barra superior con Nivel 1, 0 XP, 0 Racha
- ✅ Mensaje de bienvenida del agente

### 2. Primer Mensaje

Escribe en el chat:
```
empezar lección
```

Deberías ver:
- ✅ Respuesta del agente
- ✅ Información de la lección "Saludos Básicos"
- ✅ Un ejercicio interactivo

### 3. Responder Ejercicio

Si el ejercicio pregunta "¿Qué significa esta seña?", selecciona una opción y haz click en "Enviar Respuesta".

Deberías ver:
- ✅ Feedback del agente (correcto/incorrecto)
- ✅ XP ganado (+10 XP)
- ✅ Siguiente ejercicio

---

## 🎉 ¡Listo!

Ya tienes SIGNOS Agentic corriendo localmente.

### Próximos pasos:

1. **Completa tu primera lección** para desbloquear logros
2. **Revisa tu progreso** en la pestaña "Progreso"
3. **Explora comandos**: "practicar", "mi progreso", "cómo se dice agua"

---

## 🐛 Problemas Comunes

### Worker no inicia

**Error**: `Failed to bind AI`

**Solución**: Asegúrate de que:
- Tienes cuenta Cloudflare con Workers AI habilitado
- `wrangler.toml` tiene `remote = true` en `[dev]`

### Database error

**Error**: `D1_ERROR: no such table: users`

**Solución**: Reinicializa la DB:
```bash
cd worker
pnpm run db:init-local
```

### Frontend no conecta

**Error**: `Network error` en la consola

**Solución**: 
1. Verifica que el worker esté corriendo en `http://localhost:8787`
2. Verifica que `.env` tenga `VITE_WORKER_URL=http://localhost:8787`
3. Reinicia el frontend: `pnpm dev`

### Puerto 8787 ocupado

Si el worker inicia en otro puerto (ej: 8788):

```bash
cd frontend
echo "VITE_WORKER_URL=http://localhost:8788" > .env
pnpm dev
```

---

## 📚 Siguiente Lectura

- **[README.md](README.md)** - Documentación completa
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Deploy a producción
- **worker/schema.sql** - Estructura de la base de datos

---

**¿Funcionó todo? ¡Empieza a aprender LSCh! 🤟**

**¿Algo no funciona? Revisa los logs:**
```bash
# Worker logs
cd worker
wrangler tail

# Frontend - consola del navegador (F12)
```

