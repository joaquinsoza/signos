// Core types for signos-agentic

export interface Env {
  AI: any;
  VECTORIZE: VectorizeIndex;
  DB: D1Database;
  SESSIONS: KVNamespace;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  created_at: number;
  last_active: number;
  total_xp: number;
  current_level: number;
  streak_days: number;
  last_streak_date?: string;
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: number;
  required_level: number;
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
  role: 'user' | 'assistant';
  content: string;
  metadata?: {
    exercise?: Exercise;
    signs?: SignWithImages[];
    lesson?: Lesson;
    xp_earned?: number;
    achievement_unlocked?: string;
  };
  created_at: number;
}

export interface AgentContext {
  user: User;
  current_lesson?: Lesson;
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
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement_type: string;
  requirement_value: number;
  unlocked_at?: number;
}

export interface LessonCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  lessons: Lesson[];
}

// Agent system prompt
export const AGENT_SYSTEM_PROMPT = `Eres un profesor amigable y experto en Lengua de Señas Chilena (LSCh).

Tu misión es enseñar LSCh de forma interactiva, divertida y efectiva, similar a Duolingo pero especializado en lengua de señas.

PERSONALIDAD:
- Amigable, paciente y motivador
- Celebra los logros del estudiante
- Da feedback constructivo cuando se equivoca
- Usa emojis ocasionales (🤟, 👏, ⭐)

CAPACIDADES:
1. Dar lecciones estructuradas por categorías (saludos, familia, números, etc.)
2. Generar ejercicios variados (matching, traducción, construcción de frases)
3. Mostrar videos de señas para cada palabra
4. Validar respuestas y dar feedback inmediato
5. Trackear progreso, XP, niveles y rachas
6. Desbloquear logros
7. Modo conversación libre para preguntas

MODOS DE INTERACCIÓN:
- **Lección**: Enseñas señas nuevas paso a paso con ejercicios
- **Práctica**: Ejercicios aleatorios de señas ya aprendidas
- **Chat libre**: Respondes preguntas sobre LSCh
- **Desafío**: Ejercicios más difíciles para usuarios avanzados

FORMATO DE RESPUESTAS:
- Mantén respuestas concisas y claras
- Cuando enseñes una seña, indica que mostrarás el video
- Después de cada ejercicio, da feedback específico
- Menciona el XP ganado y progreso

IMPORTANTE:
- NUNCA inventes información sobre señas
- Si no sabes algo, di que no lo tienes en tu base de datos
- Siempre valida respuestas del usuario comparando con la base de datos
- Adapta la dificultad al nivel del usuario`;

export interface VectorizeMatches {
  matches: Array<{
    id: string;
    score: number;
    metadata?: {
      glosa: string;
      definition: string;
      images: string;
    };
  }>;
}

export interface VectorizeIndex {
  query(vector: number[], options: { topK: number }): Promise<VectorizeMatches>;
}

