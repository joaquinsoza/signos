// Type definitions for the LSCh agentic application
import { D1Database, KVNamespace, VectorizeIndex, Ai } from '@cloudflare/workers-types';

export interface Env {
  AI: Ai;
  VECTORIZE?: VectorizeIndex; // SignMatcher index
  KNOWLEDGE_VECTORIZE?: VectorizeIndex; // Knowledge base index
  DB: D1Database;
  SESSIONS: KVNamespace;
}

// ============ Tool Definitions for LLM Function Calling ============

export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

export interface ToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  tool: string;
  result: any;
  success: boolean;
  error?: string;
}

// ============ User & Progress Types ============

export interface User {
  id: string;
  username: string;
  created_at: number;
  last_active: number;
  xp: number;
  level: number;
  streak_days: number;
  total_lessons_completed: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  xp_reward: number;
  unlocked_at?: number;
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  level: number;
  xp_reward: number;
  order_index: number;
  signs?: string[]; // Array of glosas
}

export interface UserLessonProgress {
  user_id: string;
  lesson_id: string;
  status: 'locked' | 'available' | 'in_progress' | 'completed';
  score: number;
  attempts: number;
  completed_at?: number;
}

export interface SignWithImages {
  glosa: string;
  images: Array<{ path: string; sequence: number }>;
  definition: string;
  confidence: number;
}

export interface Exercise {
  type: 'matching' | 'translation' | 'build_phrase' | 'video_to_text';
  question: string;
  options?: string[];
  correct_answer: string;
  signs?: SignWithImages[];
  hint?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  metadata?: {
    exercise?: Exercise;
    signs?: SignWithImages[];
    lesson?: Lesson;
    xp_earned?: number;
    achievement_unlocked?: string;
    reasoning?: string; // Agent's internal reasoning
  };
  created_at: number;
}

export interface AgentContext {
  user: User | null;
  current_lesson?: Lesson | null;
  chat_history: ChatMessage[];
  available_lessons: Lesson[];
}

export interface AgentResponse {
  message: string;
  exercise?: Exercise;
  signs?: SignWithImages[];
  xp_earned?: number;
  level_up?: boolean;
  achievement_unlocked?: Achievement;
  next_action?: 'continue_lesson' | 'start_new_lesson' | 'practice_mode' | 'chat';
  reasoning?: string; // Show the agent's thought process
  tools_used?: string[]; // Which tools were used
}

// ============ Knowledge Base Types ============

export interface KnowledgeItem {
  id: string;
  content: string;
  title: string;
  category: string;
  tags: string[];
  chunk_index: number;
  total_chunks: number;
}

// ============ System Prompts ============

export const AGENT_SYSTEM_PROMPT = `Eres un asistente inteligente experto en Lengua de Señas Chilena (LSCh).

## TU IDENTIDAD
- Eres bilingüe: español y Lengua de Señas Chilena
- Tienes conocimiento profundo sobre cultura sorda, historia de LSCh, y gramática de lenguas de señas
- Eres paciente, inclusivo y celebras la diversidad lingüística
- Usas emojis apropiados: 🤟 (I love you), 🙌, 👍, 📚, 💡, etc.

## TUS CAPACIDADES (TOOLS DISPONIBLES)

Tienes acceso a estas herramientas que puedes usar según sea necesario:

1. **buscar_sena(palabra: string)**: Busca señas en el diccionario LSCh
   - Úsala cuando el usuario pregunte "¿cómo se dice X?" o quiera ver una seña específica
   - Retorna imágenes y definiciones de señas

2. **buscar_conocimiento(query: string)**: Busca información educativa sobre LSCh
   - Úsala para preguntas sobre historia, cultura, gramática, organizaciones
   - Retorna chunks de contenido educativo relevante

3. **buscar_multiples_senas(palabras: string[])**: Busca varias señas a la vez
   - Úsala cuando el usuario quiera traducir frases o múltiples palabras
   - Más eficiente que llamar buscar_sena múltiples veces

## CÓMO RAZONAR

1. **Analiza la intención**: ¿Qué quiere realmente el usuario?
2. **Decide qué herramientas usar**: Puedes usar una, varias, o ninguna
3. **Combina resultados**: Si usas múltiples herramientas, integra los resultados de forma coherente
4. **Responde naturalmente**: No menciones que usaste herramientas, simplemente da la información

## EJEMPLOS DE USO

Usuario: "¿Cómo se dice agua?"
→ Usa: buscar_sena("agua")
→ Responde con la seña y su definición

Usuario: "Cuéntame sobre la historia de LSCh"
→ Usa: buscar_conocimiento("historia LSCh")
→ Responde con información histórica relevante

Usuario: "¿Cómo se dice hola y cómo es la cultura sorda?"
→ Usa: buscar_sena("hola") + buscar_conocimiento("cultura sorda")
→ Responde combinando ambos resultados

Usuario: "¿Cuál es la seña de casa y explícame la gramática de LSCh?"
→ Usa: buscar_sena("casa") + buscar_conocimiento("gramática LSCh")
→ Responde integrando seña + información gramatical

## ESTILO DE RESPUESTA

- **Directo y útil**: No des rodeos, responde lo que se pregunta
- **Educativo**: Aprovecha para enseñar detalles interesantes
- **Visual**: Usa emojis y formato para claridad
- **Contextual**: Si muestras señas, explica su uso; si das teoría, da ejemplos
- **Inclusivo**: Celebra la cultura sorda y la LSCh como lengua completa

## LO QUE NO DEBES HACER

❌ No inventes señas o información
❌ No digas "no sé" sin intentar buscar
❌ No mentions que estás usando "herramientas" o "funciones"
❌ No des respuestas vacías o genéricas
❌ No trates la LSCh como inferior al español

¡Adelante! Ayuda al usuario de la mejor manera posible. 🤟`;

export const AGENTIC_TOOLS: Tool[] = [
  {
    name: 'buscar_sena',
    description: 'Busca una seña específica en el diccionario de Lengua de Señas Chilena. Retorna imágenes y definición de la seña.',
    parameters: {
      type: 'object',
      properties: {
        palabra: {
          type: 'string',
          description: 'La palabra en español para la cual buscar la seña en LSCh (ej: "agua", "casa", "familia")',
        },
      },
      required: ['palabra'],
    },
  },
  {
    name: 'buscar_conocimiento',
    description: 'Busca información educativa sobre LSCh: historia, cultura sorda, gramática, organizaciones, aprendizaje, etc.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'La consulta educativa sobre LSCh (ej: "historia de LSCh", "cultura sorda Chile", "gramática espacial")',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'buscar_multiples_senas',
    description: 'Busca múltiples señas a la vez. Útil para traducir frases o listas de palabras.',
    parameters: {
      type: 'object',
      properties: {
        palabras: {
          type: 'array',
          items: { type: 'string' },
          description: 'Lista de palabras en español para buscar sus señas (ej: ["hola", "gracias", "familia"])',
        },
      },
      required: ['palabras'],
    },
  },
];
