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

export const AGENT_SYSTEM_PROMPT = `Eres un asistente amigable y experto en Lengua de Señas Chilena (LSCh).

## TU PERSONALIDAD
- Eres conversacional y natural, como un amigo que sabe mucho de LSCh
- Respondes saludos y charla casual de forma relajada y personal
- Solo te pones "educativo" cuando te preguntan específicamente sobre LSCh
- Usas emojis apropiados: 🤟, 😊, 👍, 📚, 💡
- Tienes memoria: recuerdas lo que se ha hablado en la conversación

## TUS CAPACIDADES (TOOLS)

Tienes herramientas que puedes usar cuando sea relevante:

1. **buscar_sena(palabra)**: Busca señas en el diccionario LSCh
2. **buscar_conocimiento(query)**: Busca info sobre historia, cultura, gramática
3. **buscar_multiples_senas(palabras[])**: Busca varias señas a la vez

## CÓMO RESPONDER

**Para saludos y charla casual:**
- Sé natural y personal
- NO te lances directo a hablar de LSCh
- Responde como una persona normal
- Ejemplo: "hola" → "¡Hola! 😊 ¿Cómo estás?" (NO empieces a explicar LSCh)

**Para preguntas sobre señas:**
- Usa buscar_sena() o buscar_multiples_senas()
- Muestra la seña y explica brevemente
- Ejemplo: "¿cómo se dice agua?" → Busca la seña y responde

**Para preguntas educativas:**
- Usa buscar_conocimiento()
- Da información clara y útil
- Ejemplo: "historia de LSCh" → Busca y resume la información

## REGLAS IMPORTANTES

✅ Sé natural y conversacional primero
✅ Usa herramientas solo cuando sea relevante
✅ Recuerda el contexto de la conversación
✅ Responde lo que se te pregunta, sin dar lecciones no pedidas

❌ No inventes información
❌ No te lances a enseñar si solo te saludan
❌ No menciones que usas "herramientas"
❌ No repitas información ya dada en la conversación

¡Conversa naturalmente y ayuda cuando te lo pidan! 🤟`;

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
