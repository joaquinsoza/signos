# 📚 Knowledge RAG - Base de Conocimiento Educativa

Sistema de RAG (Retrieval-Augmented Generation) para responder preguntas educativas sobre Lengua de Señas Chilena.

---

## 🎯 Propósito

Complementar el sistema de lecciones con conocimiento educativo sobre:
- Historia de LSCh
- Gramática y estructura lingüística
- Cultura sorda
- Técnicas de aprendizaje
- Expresiones faciales
- Diferencias entre lenguas de señas
- Dactilología (alfabeto manual)
- Y más...

---

## 🏗️ Arquitectura

```
Usuario pregunta: "¿Cuál es la historia de LSCh?"
    ↓
Agent detecta intent: knowledge_query
    ↓
KnowledgeService.searchKnowledge(query)
    ↓
    ├─→ SI Vectorize disponible: Query vector DB
    └─→ NO Vectorize: Fallback a contenido estático
    ↓
Retorna artículos relevantes
    ↓
Agent formatea y responde
```

---

## 📦 Estado Actual

### ✅ Implementado

**1. KnowledgeService** (`worker/src/services/knowledge-service.ts`)
- Búsqueda semántica con embeddings
- Fallback a contenido estático (7 artículos base)
- Categorización de contenido

**2. Integración con Agent**
- Detección automática de preguntas educativas
- Formato de respuestas estructuradas
- Sugerencias de temas relacionados

**3. Contenido Base** (Fallback mientras no hay Vectorize)
- Historia de LSCh
- Gramática y estructura
- Cultura sorda
- Expresiones faciales
- Diferencias entre lenguas de señas
- Consejos para aprender
- Dactilología

### 🔜 Pendiente

**1. Índice Vectorize para Knowledge**
- Crear índice `signos-knowledge-index`
- Poblar con artículos educativos
- Habilitar binding en wrangler.toml

**2. Más Contenido**
- Artículos adicionales (50+ temas)
- Referencias a estudios
- Videos educativos
- Infografías

---

## 🎯 Preguntas que Puede Responder

### Historia
- "¿Cuál es la historia de la lengua de señas chilena?"
- "¿Cuándo se creó la primera escuela para sordos en Chile?"
- "¿Cómo surgió la LSCh?"

### Gramática
- "¿Cómo funciona la gramática de LSCh?"
- "¿Cuál es el orden de las palabras en lengua de señas?"
- "¿Cómo se expresan los tiempos verbales?"

### Cultura
- "¿Qué es la cultura sorda?"
- "¿Cuáles son los valores de la comunidad sorda?"
- "¿Cómo interactuar con personas sordas?"

### Técnicas
- "¿Cómo son las expresiones faciales en LSCh?"
- "¿Por qué son importantes las expresiones faciales?"
- "¿Qué es la dactilología?"

### Comparaciones
- "¿Las lenguas de señas son universales?"
- "¿Cuál es la diferencia entre LSCh y ASL?"
- "¿Por qué hay diferentes lenguas de señas?"

### Aprendizaje
- "¿Cómo puedo aprender LSCh?"
- "¿Cuánto tiempo toma aprender lengua de señas?"
- "¿Qué debo evitar al aprender LSCh?"

---

## 🚀 Uso

### En el Chat

Usuario puede preguntar naturalmente:

```
Usuario: qué es la cultura sorda

Agente: 📚 Cultura Sorda

La cultura sorda es el conjunto de valores, normas y 
prácticas compartidas por la comunidad de personas sordas...

[Contenido completo del artículo]

¿Tienes más preguntas? 🤟
```

### Palabras Clave que Activan Knowledge RAG

- historia, origen
- cultura, comunidad
- gramática, estructura
- expresión, facial
- diferencia, universal
- qué es, cómo
- por qué, porque
- consejo, tip
- dactilo, alfabeto

---

## 📝 Contenido Fallback Actual

### 1. Historia de LSCh
- Orígenes desde 1852
- Reconocimiento legal (Ley 20.422, 2010)
- Evolución y desarrollo

### 2. Gramática
- Estructura de frases
- Componentes de una seña
- Ejemplos comparativos con español

### 3. Cultura Sorda
- Identidad cultural
- Valores comunitarios
- Normas sociales
- Artes y expresión

### 4. Expresiones Faciales
- Funciones gramaticales
- Funciones adverbiales
- Funciones emocionales
- Tips prácticos

### 5. Diferencias entre Lenguas de Señas
- Lenguas principales (LSCh, ASL, LSM, etc.)
- Por qué no son universales
- Ejemplos de diferencias

### 6. Consejos de Aprendizaje
- Inmersión en la comunidad
- Práctica regular
- Errores comunes
- Recursos recomendados

### 7. Dactilología
- Cuándo usar alfabeto manual
- Características del alfabeto LSCh
- Tips de práctica

---

## 🔧 Crear Índice Vectorize (Futuro)

### Paso 1: Crear Índice

```bash
# Crear índice
wrangler vectorize create signos-knowledge-index \
  --dimensions=768 \
  --metric=cosine

# Agregar a wrangler.toml
[[vectorize]]
binding = "KNOWLEDGE_VECTORIZE"
index_name = "signos-knowledge-index"
```

### Paso 2: Preparar Contenido

Crear archivo `knowledge-content.json`:

```json
[
  {
    "id": "article_001",
    "title": "Historia de LSCh",
    "content": "Contenido completo...",
    "category": "historia",
    "tags": ["historia", "origen", "Chile", "sordos"]
  },
  {
    "id": "article_002",
    "title": "Gramática LSCh",
    "content": "Contenido completo...",
    "category": "gramatica",
    "tags": ["gramatica", "estructura", "sintaxis"]
  }
]
```

### Paso 3: Generar Embeddings

```python
# Script: scripts/generate-knowledge-embeddings.py
import json
import requests

WORKER_URL = "https://your-worker.workers.dev"

with open('knowledge-content.json') as f:
    articles = json.load(f)

embeddings = []
for article in articles:
    # Generar embedding del contenido
    response = requests.post(f"{WORKER_URL}/generate-embedding", 
                            json={"text": article['content']})
    embedding = response.json()['embedding']
    
    embeddings.append({
        "id": article['id'],
        "values": embedding,
        "metadata": {
            "title": article['title'],
            "content": article['content'][:1000],  # Truncar si es muy largo
            "category": article['category']
        }
    })

# Guardar para upload
with open('knowledge-embeddings.ndjson', 'w') as f:
    for emb in embeddings:
        f.write(json.dumps(emb) + '\n')
```

### Paso 4: Upload a Vectorize

```bash
# Upload embeddings
wrangler vectorize insert signos-knowledge-index \
  --file=knowledge-embeddings.ndjson
```

### Paso 5: Habilitar en Worker

Descomentar en `wrangler.toml`:

```toml
[[vectorize]]
binding = "KNOWLEDGE_VECTORIZE"
index_name = "signos-knowledge-index"
```

---

## 📊 Estructura de Artículos

### Formato JSON

```json
{
  "id": "unique_id",
  "title": "Título del Artículo",
  "content": "Contenido completo en markdown o texto plano",
  "category": "historia|gramatica|cultura|tecnica|linguistica|aprendizaje",
  "tags": ["tag1", "tag2", "tag3"],
  "author": "Nombre del autor (opcional)",
  "source": "Fuente o referencia (opcional)",
  "last_updated": "2024-01-01"
}
```

### Categorías

- `historia`: Historia de lenguas de señas
- `gramatica`: Estructura lingüística
- `cultura`: Cultura sorda
- `tecnica`: Técnicas de señado
- `linguistica`: Lingüística comparativa
- `aprendizaje`: Tips y métodos de aprendizaje

---

## 🎨 Mejoras Futuras

### Fase 1: Contenido Enriquecido
- [ ] 50+ artículos educativos
- [ ] Referencias académicas
- [ ] Enlaces a videos
- [ ] Imágenes explicativas

### Fase 2: Búsqueda Avanzada
- [ ] Filtros por categoría
- [ ] Búsqueda multilingüe
- [ ] Sugerencias relacionadas
- [ ] Historial de búsquedas

### Fase 3: Contribución Comunitaria
- [ ] Sistema de submissions
- [ ] Revisión por expertos
- [ ] Votación de calidad
- [ ] Wiki colaborativa

### Fase 4: Multimedia
- [ ] Videos educativos integrados
- [ ] Infografías interactivas
- [ ] Podcasts sobre cultura sorda
- [ ] Tours virtuales de escuelas

---

## 🧪 Testing

### Test Manual

```bash
# Con el worker corriendo
curl -X POST http://localhost:8787/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test_user",
    "message": "qué es la cultura sorda"
  }'
```

### Preguntas de Test

1. "¿Cuál es la historia de LSCh?"
2. "¿Cómo funciona la gramática?"
3. "¿Qué son las expresiones faciales?"
4. "¿Las lenguas de señas son universales?"
5. "Dame consejos para aprender"

---

## 📈 Métricas

**Con Fallback (actual):**
- 7 artículos base
- ~100% cobertura temas básicos
- Latencia: < 50ms
- Sin búsqueda semántica real

**Con Vectorize (futuro):**
- 50+ artículos
- Búsqueda semántica precisa
- Latencia: ~200-300ms
- Resultados más relevantes

---

## 🤝 Contribuir Contenido

¿Quieres agregar contenido educativo?

1. Crea artículo en formato JSON
2. Incluye fuentes/referencias
3. Revisa ortografía y gramática
4. Envía para revisión

**Ejemplo de artículo:**

```json
{
  "id": "clasificadores-lsch",
  "title": "Clasificadores en LSCh",
  "content": "Los clasificadores son elementos gramaticales que representan objetos, personas o conceptos mediante configuraciones específicas de la mano...",
  "category": "gramatica",
  "tags": ["clasificadores", "gramatica", "avanzado"],
  "source": "Diccionario LSCh, Universidad de Chile"
}
```

---

**🤟 Construyendo conocimiento accesible sobre lengua de señas**

