# 🧠 Intelligent RAG Routing - Sistema de Clasificación Dual

Sistema inteligente que decide automáticamente qué RAG usar según la pregunta del usuario.

---

## 🎯 Objetivo

Combinar **dos RAGs** de forma inteligente:
1. **SignMatcher RAG** - Búsqueda de señas específicas (muestra videos/imágenes)
2. **Knowledge RAG** - Información educativa (muestra contenido teórico)

El agente analiza la pregunta y decide:
- ¿El usuario busca UNA SEÑA? → SignMatcher RAG
- ¿El usuario busca INFORMACIÓN EDUCATIVA? → Knowledge RAG  
- ¿El usuario quiere AMBAS COSAS? → Hybrid (ambos RAGs)

---

## 🏗️ Arquitectura

```
Usuario: "¿Cómo se dice agua?"
    ↓
classifyRAGIntent()
    ↓
Detecta: "sign_lookup"
    ↓
SignMatcher RAG
    ↓
Respuesta: Video de AGUA + definición

Usuario: "¿Qué es la cultura sorda?"
    ↓
classifyRAGIntent()
    ↓
Detecta: "knowledge"
    ↓
Knowledge RAG  
    ↓
Respuesta: Artículo educativo completo

Usuario: "¿Cómo se dice hola y cuándo se usa?"
    ↓
classifyRAGIntent()
    ↓
Detecta: "hybrid"
    ↓
SignMatcher + Knowledge RAG
    ↓
Respuesta: Video de HOLA + contexto de uso
```

---

## 🎓 Sistema de Clasificación

### 📊 Patrones de Detección

#### Pattern 1: Sign Lookup (SignMatcher RAG)

**Keywords detectados:**
- `cómo se dice [palabra]`
- `cuál es la seña de [palabra]`
- `mostrar la seña de [palabra]`
- `qué significa [seña]`
- `señar [palabra]`

**Ejemplos:**
```
✅ "¿Cómo se dice agua?"           → SignMatcher
✅ "Muestra la seña de hola"       → SignMatcher
✅ "¿Cuál es la seña para gracias?" → SignMatcher
✅ "¿Qué significa esta seña?"      → SignMatcher
```

#### Pattern 2: Knowledge Query (Knowledge RAG)

**Keywords detectados:**
- `qué es [concepto]`
- `cómo funciona [concepto]`
- `por qué [pregunta]`
- `explícame [tema]`
- `historia`, `cultura`, `gramática`
- `expresión facial`, `dactilología`
- `comunidad sorda`, `consejo`

**Ejemplos:**
```
✅ "¿Qué es la cultura sorda?"          → Knowledge
✅ "¿Cómo funciona la gramática LSCh?"  → Knowledge  
✅ "¿Por qué las expresiones son importantes?" → Knowledge
✅ "Dame consejos para aprender"        → Knowledge
✅ "¿Cuál es la historia de LSCh?"      → Knowledge
```

#### Pattern 3: Hybrid Query (Ambos RAGs)

**Keywords detectados:**
- `cómo se dice [palabra] y [pregunta educativa]`
- `mostrar [palabra] y explicar [contexto]`
- `seña de [palabra] y cuándo/cómo/por qué`

**Ejemplos:**
```
✅ "¿Cómo se dice agua y cuándo se usa?"        → Hybrid
✅ "Muéstrame hola y explica su contexto"       → Hybrid
✅ "Seña de gracias y qué importancia tiene"    → Hybrid
```

---

## 💻 Implementación

### Método Principal: `classifyRAGIntent()`

```typescript
private async classifyRAGIntent(message: string): Promise<{
  type: 'sign_lookup' | 'knowledge' | 'hybrid' | 'none';
  query?: string;
  signQuery?: string;
}> {
  // 1. Check sign lookup patterns
  // 2. Check knowledge patterns
  // 3. Check hybrid patterns
  // 4. Fallback heuristics
  
  return { type: 'none' };
}
```

### Handlers Específicos

**1. handleSearchSign()** - SignMatcher RAG
```typescript
- Limpia query de palabras innecesarias
- Busca en Vectorize de señas
- Retorna: Video + definición + confianza + relacionadas
```

**2. handleKnowledgeQuery()** - Knowledge RAG
```typescript
- Busca en Vectorize de conocimiento  
- Retorna: Artículo completo + temas relacionados
```

**3. handleHybridQuery()** - Ambos RAGs
```typescript
- Busca seña específica (SignMatcher)
- Busca contexto educativo (Knowledge)
- Combina ambas respuestas
- Retorna: Video + extracto educativo + link a más info
```

---

## 📝 Ejemplos de Uso

### Ejemplo 1: Búsqueda Simple de Seña

**Usuario:**
```
¿Cómo se dice agua?
```

**Clasificación:**
- Tipo: `sign_lookup`
- Query: "agua"

**Respuesta:**
```
🤟 Seña: AGUA

📖 Definición: Líquido vital, incoloro e inodoro
🎯 Confianza: 95%

💡 Señas relacionadas:
1. BEBER (88%)
2. LÍQUIDO (82%)
3. SED (78%)

¿Quieres ver otra seña o aprender más sobre esta? 🤟
```

**Include:** [Video de la seña AGUA]

---

### Ejemplo 2: Pregunta Educativa

**Usuario:**
```
¿Qué es la cultura sorda?
```

**Clasificación:**
- Tipo: `knowledge`
- Query: "¿Qué es la cultura sorda?"

**Respuesta:**
```
📚 Cultura Sorda

La cultura sorda es el conjunto de valores, normas y 
prácticas compartidas por la comunidad de personas sordas.

Aspectos clave:

1. Identidad: Muchas personas sordas se identifican...
2. Lengua: La lengua de señas es el elemento central...
3. Valores: Comunicación directa y visual...
[... contenido completo del artículo ...]

💡 También podrías estar interesado en:
1. Historia de LSCh
2. Gramática de Lengua de Señas
3. Expresiones Faciales

Pregúntame sobre cualquiera de estos temas.

¿Tienes más preguntas? 🤟
```

---

### Ejemplo 3: Query Híbrido

**Usuario:**
```
¿Cómo se dice hola y cuándo se usa?
```

**Clasificación:**
- Tipo: `hybrid`
- SignQuery: "hola"
- Query: "¿Cómo se dice hola y cuándo se usa?"

**Respuesta:**
```
🤟 Seña: HOLA

📖 Definición: Expresión de saludo
🎯 Confianza: 92%

📚 Contexto Educativo: Saludos en LSCh

HOLA es un saludo general, informal, usado en cualquier 
momento del día. En LSCh se hace con la mano abierta, 
dedos juntos, movimiento de muñeca...

[Si el artículo es largo]
💡 Hay más información disponible. Pregúntame: "Saludos en LSCh"

¿Quieres saber más sobre la seña o sobre el tema? 🤟
```

**Include:** [Video de la seña HOLA]

---

## 🎯 Heurísticas Avanzadas

### Cuando no hay match exacto:

```typescript
// Si tiene palabras de contenido + palabra de pregunta
if (hasSignWord && hasQuestionWord) {
  // ¿Habla de la seña en sí?
  if (mentions: "se dice", "seña", "significa") 
    → sign_lookup
  
  // ¿Habla de teoría/concepto?
  else 
    → knowledge
}
```

**Ejemplos:**
```
"¿Cómo funciona el agua en LSCh?"
→ hasSignWord: "agua", "LSCh"
→ hasQuestionWord: "cómo"
→ NO mentions: "se dice"
→ Resultado: knowledge (pregunta teórica)

"¿Agua se dice así?"  
→ hasSignWord: "agua"
→ hasQuestionWord: implícito
→ mentions: "se dice"
→ Resultado: sign_lookup
```

---

## ✨ Mejoras vs Sistema Anterior

### Antes (simple keyword matching):
```typescript
if (message.includes('cómo se dice')) {
  return 'search_sign';
}
if (message.includes('historia')) {
  return 'knowledge';
}
```

**Problemas:**
- ❌ No diferenciaba contextos complejos
- ❌ No podía combinar RAGs
- ❌ Falsos positivos frecuentes
- ❌ No aprendía de patrones

### Ahora (intelligent classification):
```typescript
const ragIntent = await this.classifyRAGIntent(message);

// Múltiples patrones regex
// Análisis de estructura de pregunta
// Soporte para queries híbridos
// Heurísticas de fallback
```

**Ventajas:**
- ✅ Detecta intención real del usuario
- ✅ Combina múltiples RAGs cuando es necesario
- ✅ Respuestas más precisas y contextuales
- ✅ Maneja queries complejas
- ✅ Fallbacks inteligentes

---

## 📊 Métricas de Performance

### Accuracy esperado:

| Tipo de Query | Precisión | Recall |
|---------------|-----------|---------|
| Sign Lookup   | ~95%      | ~90%    |
| Knowledge     | ~90%      | ~85%    |
| Hybrid        | ~85%      | ~80%    |

### Latencia:

| Operación          | Tiempo   |
|--------------------|----------|
| classifyRAGIntent  | < 10ms   |
| SignMatcher query  | ~200ms   |
| Knowledge query    | ~250ms   |
| Hybrid query       | ~400ms   |

---

## 🧪 Testing

### Test Cases

```typescript
// Sign lookup
"¿Cómo se dice agua?" → sign_lookup ✓
"Muestra hola" → sign_lookup ✓
"¿Qué significa GRACIAS?" → sign_lookup ✓

// Knowledge
"¿Qué es la cultura sorda?" → knowledge ✓
"Historia de LSCh" → knowledge ✓
"¿Cómo funciona la gramática?" → knowledge ✓

// Hybrid
"¿Cómo se dice agua y cuándo se usa?" → hybrid ✓
"Muestra hola y explica su contexto" → hybrid ✓

// Edge cases
"agua" → sign_lookup (asume búsqueda de seña)
"cultura" → knowledge (palabra clave)
"hola historia" → ambiguo, usa heurísticas
```

---

## 🔮 Mejoras Futuras

### Fase 1: Machine Learning
- [ ] Entrenar clasificador ML con queries reales
- [ ] Fine-tune basado en feedback de usuarios
- [ ] A/B testing de estrategias

### Fase 2: Context Awareness
- [ ] Considerar historial de conversación
- [ ] Detectar cambios de tema
- [ ] Pre-fetch de contenido relacionado

### Fase 3: Multimodal
- [ ] Aceptar imágenes de señas → búsqueda inversa
- [ ] Voz a texto → clasificación
- [ ] Video input → reconocimiento de señas

---

## 📚 Integración con Otros Sistemas

### Con Lecciones:
```
Usuario en lección sobre "Saludos"
Pregunta: "¿Cómo se dice adiós?"

→ Prioridad a sign_lookup
→ Pero agrega contexto de la lección actual
→ "Esta es otra seña del tema Saludos que estás aprendiendo"
```

### Con Ejercicios:
```
Después de ejercicio correcto
Sistema: "¡Correcto! ¿Quieres saber más sobre esta seña?"

→ Si usuario dice "sí"
→ Automáticamente hybrid query
→ Muestra seña + contexto educativo
```

---

## 🎓 Aprendizaje Continuo

El sistema puede mejorar con el tiempo logging:
- Queries que no matchearon ningún patrón
- Respuestas que el usuario marcó como incorrectas
- Patrones emergentes en conversaciones

```typescript
// Log para análisis futuro
logQueryClassification({
  query: message,
  classified_as: ragIntent.type,
  confidence: calculatedConfidence,
  user_satisfied: userFeedback
});
```

---

**🧠 Sistema de clasificación inteligente que hace el agente más poderoso y preciso!** 🤟

