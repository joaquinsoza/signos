# 🚀 Deployment Guide - SIGNOS Agentic

Guía completa para desplegar SIGNOS Agentic a producción usando Cloudflare.

---

## 📋 Pre-requisitos

- ✅ Cuenta de Cloudflare con:
  - Workers Paid plan (para D1, Vectorize, Workers AI)
  - Pages habilitado
- ✅ Wrangler CLI instalado (`npm install -g wrangler`)
- ✅ Dominio configurado en Cloudflare (opcional pero recomendado)

---

## 🔧 Parte 1: Deploy del Worker

### 1. Crear Recursos en Producción

```bash
cd signos-agentic/worker

# Crear base de datos D1
wrangler d1 create signos-agentic-db

# OUTPUT: Copia el database_id
# 📋 database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# Crear KV namespace
wrangler kv:namespace create SESSIONS

# OUTPUT: Copia el id
# 📋 id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### 2. Actualizar wrangler.toml para Producción

Edita `worker/wrangler.toml`:

```toml
name = "signos-agentic-worker"
main = "src/index.ts"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

# AI binding for conversational agent
[ai]
binding = "AI"

# Vectorize binding for sign lookup (usa el índice existente)
[[vectorize]]
binding = "VECTORIZE"
index_name = "signos-lsch-index"

# D1 database for user progress (IDs de producción)
[[d1_databases]]
binding = "DB"
database_name = "signos-agentic-db"
database_id = "TU-DATABASE-ID-AQUI"  # ← Actualiza con el ID real
preview_database_id = "TU-DATABASE-ID-AQUI"

# KV for session management
[[kv_namespaces]]
binding = "SESSIONS"
id = "TU-KV-ID-AQUI"  # ← Actualiza con el ID real
preview_id = "TU-KV-ID-AQUI"

# Remote mode for local development
[dev]
remote = true
```

### 3. Inicializar Base de Datos en Producción

```bash
# Ejecutar schema en producción
wrangler d1 execute signos-agentic-db --remote --file=./schema.sql

# Verificar que se creó correctamente
wrangler d1 execute signos-agentic-db --remote --command="SELECT COUNT(*) FROM lessons"
# Debería retornar: 6
```

### 4. Verificar Índice Vectorize

```bash
# Verificar que el índice de señas existe
wrangler vectorize get signos-lsch-index

# Si no existe, necesitas crearlo desde signsToJson/
# Ver: signsToJson/README_PIPELINE.md
```

### 5. Deploy Worker

```bash
# Deploy a producción
wrangler deploy

# OUTPUT:
# ✅ Deployed signos-agentic-worker
# 🌍 https://signos-agentic-worker.tu-cuenta.workers.dev
```

**Copia la URL del worker** - la necesitarás para el frontend.

### 6. Verificar Deployment

```bash
# Health check
curl https://signos-agentic-worker.tu-cuenta.workers.dev/health

# Debería retornar:
# {"status":"ok","service":"signos-agentic"}

# Test crear usuario
curl -X POST https://signos-agentic-worker.tu-cuenta.workers.dev/api/user \
  -H "Content-Type: application/json" \
  -d '{"username":"test_prod"}'
```

---

## 🎨 Parte 2: Deploy del Frontend

### Opción A: Deploy con Wrangler (Recomendado)

```bash
cd signos-agentic/frontend

# Crear archivo .env.production con la URL del worker
cat > .env.production << EOF
VITE_WORKER_URL=https://signos-agentic-worker.tu-cuenta.workers.dev
EOF

# Build para producción
pnpm build

# Deploy a Cloudflare Pages
wrangler pages deploy dist --project-name=signos-agentic

# OUTPUT:
# ✅ Deployed to https://signos-agentic.pages.dev
```

### Opción B: Deploy via Git (Automático)

1. **Push código a GitHub**

```bash
cd signos-agentic
git add .
git commit -m "Deploy signos-agentic"
git push origin main
```

2. **Configurar en Cloudflare Dashboard**

- Ve a Cloudflare Dashboard → Pages
- Click "Create a project" → "Connect to Git"
- Selecciona tu repositorio
- Configura:
  - **Project name**: `signos-agentic`
  - **Production branch**: `main`
  - **Framework preset**: Vite
  - **Build command**: `cd signos-agentic/frontend && pnpm install && pnpm build`
  - **Build output directory**: `signos-agentic/frontend/dist`
  - **Root directory**: `/` (o deja en blanco)

3. **Agregar Variables de Entorno**

En Settings → Environment variables:

```
VITE_WORKER_URL = https://signos-agentic-worker.tu-cuenta.workers.dev
```

4. **Deploy**

Click "Save and Deploy" - Cloudflare automáticamente:
- Instalará dependencias
- Hará build
- Desplegará a Pages

---

## 🌐 Parte 3: Configurar Dominio Personalizado (Opcional)

### Para el Worker

```bash
# Agregar ruta personalizada
wrangler routes add "api.signos-agentic.com/*" signos-agentic-worker
```

O en Dashboard:
- Workers & Pages → signos-agentic-worker
- Settings → Triggers → Custom Domains
- Add: `api.signos-agentic.com`

### Para Pages

En Dashboard:
- Pages → signos-agentic
- Custom domains → Set up a custom domain
- Add: `signos-agentic.com` o `app.signos-agentic.com`

**Actualizar frontend:**

```bash
# .env.production
VITE_WORKER_URL=https://api.signos-agentic.com
```

Redeploy el frontend para que use la nueva URL.

---

## 📊 Parte 4: Monitoreo y Analytics

### 1. Ver Logs en Tiempo Real

```bash
# Worker logs
wrangler tail signos-agentic-worker

# Ver últimas 100 peticiones
wrangler tail signos-agentic-worker --format json
```

### 2. Analytics en Dashboard

- Workers & Pages → signos-agentic-worker → Analytics
- Métricas disponibles:
  - Requests/segundo
  - CPU time
  - Errores
  - Latencia

### 3. Configurar Alertas

En Dashboard:
- Notifications → Add
- Tipo: Worker exceeded error rate
- Configure threshold (ej: 5% error rate)

---

## 🔐 Parte 5: Seguridad y Optimización

### 1. Rate Limiting

Edita `worker/src/index.ts` para agregar rate limiting:

```typescript
// Simple rate limiting usando KV
async function checkRateLimit(ip: string, env: Env): Promise<boolean> {
  const key = `ratelimit:${ip}`;
  const count = await env.SESSIONS.get(key);
  
  if (count && parseInt(count) > 100) {
    return false; // Rate limited
  }
  
  await env.SESSIONS.put(key, String(parseInt(count || '0') + 1), {
    expirationTtl: 60 // 1 minuto
  });
  
  return true;
}
```

### 2. CORS Configuración

Si necesitas restringir CORS en producción:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://signos-agentic.pages.dev',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
```

### 3. Caching

Para endpoints que no cambian frecuentemente:

```typescript
// Cache responses por 5 minutos
if (path === '/api/lessons') {
  const response = jsonResponse(data, corsHeaders);
  response.headers.set('Cache-Control', 'public, max-age=300');
  return response;
}
```

---

## 🧪 Parte 6: Testing en Producción

### 1. Smoke Tests

```bash
# Script de prueba
cat > test-production.sh << 'EOF'
#!/bin/bash
WORKER_URL="https://signos-agentic-worker.tu-cuenta.workers.dev"

echo "🧪 Testing production deployment..."

# 1. Health check
echo "1️⃣ Health check..."
curl -s "$WORKER_URL/health" | grep "ok" && echo "✅ Health OK" || echo "❌ Health FAIL"

# 2. Create user
echo "2️⃣ Create user..."
USER=$(curl -s -X POST "$WORKER_URL/api/user" \
  -H "Content-Type: application/json" \
  -d '{"username":"test_'$(date +%s)'"}')
USER_ID=$(echo $USER | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "✅ User created: $USER_ID"

# 3. Send chat message
echo "3️⃣ Send chat message..."
curl -s -X POST "$WORKER_URL/api/chat" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":\"$USER_ID\",\"message\":\"hola\"}" | grep "success" && echo "✅ Chat OK" || echo "❌ Chat FAIL"

# 4. Get progress
echo "4️⃣ Get progress..."
curl -s "$WORKER_URL/api/user/progress?user_id=$USER_ID" | grep "success" && echo "✅ Progress OK" || echo "❌ Progress FAIL"

echo "🎉 Tests completed!"
EOF

chmod +x test-production.sh
./test-production.sh
```

### 2. Load Testing (Opcional)

```bash
# Instalar hey (HTTP load generator)
# macOS: brew install hey
# Linux: go install github.com/rakyll/hey@latest

# Test con 100 requests, 10 concurrent
hey -n 100 -c 10 https://signos-agentic-worker.tu-cuenta.workers.dev/health
```

---

## 🔄 Parte 7: CI/CD Automático

### GitHub Actions

Crea `.github/workflows/deploy.yml`:

```yaml
name: Deploy SIGNOS Agentic

on:
  push:
    branches: [main]

jobs:
  deploy-worker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install pnpm
        run: npm install -g pnpm
      
      - name: Install dependencies
        run: |
          cd signos-agentic/worker
          pnpm install
      
      - name: Deploy Worker
        run: |
          cd signos-agentic/worker
          npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
  
  deploy-frontend:
    runs-on: ubuntu-latest
    needs: deploy-worker
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install pnpm
        run: npm install -g pnpm
      
      - name: Install and Build
        run: |
          cd signos-agentic/frontend
          pnpm install
          pnpm build
        env:
          VITE_WORKER_URL: https://signos-agentic-worker.tu-cuenta.workers.dev
      
      - name: Deploy to Pages
        run: |
          cd signos-agentic/frontend
          npx wrangler pages deploy dist --project-name=signos-agentic
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

**Configurar Secret:**
- GitHub repo → Settings → Secrets and variables → Actions
- New repository secret:
  - Name: `CLOUDFLARE_API_TOKEN`
  - Value: Tu Cloudflare API token

---

## 📈 Parte 8: Escalabilidad

### Limits de Cloudflare Workers

**Free Plan:**
- 100,000 requests/día
- 10ms CPU time/request
- 128MB memory

**Paid Plan ($5/mes):**
- 10M requests/mes incluidos
- 50ms CPU time/request
- 128MB memory

### Optimizaciones para Escalar

1. **Cache de lecciones** (no cambian frecuentemente)
2. **Batch queries a D1** (reduce round trips)
3. **Lazy loading** en frontend
4. **CDN para imágenes de señas**

---

## 🆘 Troubleshooting Producción

### Worker retorna 500

```bash
# Ver logs
wrangler tail signos-agentic-worker

# Verificar bindings
wrangler deployments list signos-agentic-worker
```

### Database errors

```bash
# Verificar tablas
wrangler d1 execute signos-agentic-db --remote \
  --command="SELECT name FROM sqlite_master WHERE type='table'"

# Re-ejecutar schema si es necesario
wrangler d1 execute signos-agentic-db --remote --file=./schema.sql
```

### Frontend no conecta con Worker

1. Verificar CORS en worker
2. Verificar `VITE_WORKER_URL` en Pages settings
3. Redeploy frontend

---

## ✅ Checklist Final

Antes de considerar el deployment completo:

- [ ] Worker deployado y respondiendo en `/health`
- [ ] D1 database inicializada con lecciones
- [ ] Vectorize index poblado con señas
- [ ] Frontend deployado en Pages
- [ ] Variables de entorno configuradas
- [ ] Dominio personalizado configurado (opcional)
- [ ] Tests de producción pasando
- [ ] Monitoreo configurado
- [ ] CI/CD configurado (opcional)
- [ ] Documentación actualizada con URLs reales

---

## 🎉 ¡Listo!

Tu plataforma SIGNOS Agentic está en producción y lista para enseñar LSCh a miles de usuarios.

**URLs finales:**
- Frontend: https://signos-agentic.pages.dev
- API Worker: https://signos-agentic-worker.tu-cuenta.workers.dev
- Custom domain: https://app.signos-agentic.com (si configuraste)

**Próximos pasos:**
1. Compartir con la comunidad
2. Recolectar feedback
3. Iterar y mejorar
4. ¡Celebrar! 🎊

---

**¿Problemas? Contacta o revisa los logs con `wrangler tail`**

