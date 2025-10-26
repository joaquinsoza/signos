// API client for signos-agentic worker

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'http://localhost:8787';

export interface User {
  id: string;
  username: string;
  email?: string;
  total_xp: number;
  current_level: number;
  streak_days: number;
}

export interface ChatResponse {
  success: boolean;
  session_id: string;
  response: {
    message: string;
    exercise?: Exercise;
    signs?: SignWithImages[];
    xp_earned?: number;
    level_up?: boolean;
    achievement_unlocked?: any;
    next_action?: string;
  };
  user: {
    xp: number;
    level: number;
    streak: number;
  };
}

export interface Exercise {
  type: 'matching' | 'translation' | 'build_phrase' | 'video_to_text';
  question: string;
  options?: string[];
  correct_answer: string;
  signs?: SignWithImages[];
  hint?: string;
}

export interface SignWithImages {
  glosa: string;
  images: Array<{ path: string; sequence: number }>;
  definition: string;
  confidence: number;
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
  signs?: string[];
}

export interface UserProgress {
  user: {
    id: string;
    username: string;
    level: number;
    xp: number;
    streak: number;
  };
  lessons: {
    completed: number;
    in_progress: number;
    available: number;
    total: number;
  };
  achievements: number;
  achievements_list: any[];
}

/**
 * Create or get user
 */
export async function createUser(username: string, email?: string): Promise<User> {
  const response = await fetch(`${WORKER_URL}/api/user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email }),
  });

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || 'Failed to create user');
  }

  return data.user;
}

/**
 * Get user by ID
 */
export async function getUser(userId: string): Promise<User> {
  const response = await fetch(`${WORKER_URL}/api/user/${userId}`);
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to get user');
  }

  return data.user;
}

/**
 * Send chat message
 */
export async function sendChatMessage(
  userId: string,
  message: string,
  sessionId?: string
): Promise<ChatResponse> {
  const response = await fetch(`${WORKER_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      message,
      session_id: sessionId,
    }),
  });

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || 'Failed to send message');
  }

  return data;
}

/**
 * Get user progress
 */
export async function getUserProgress(userId: string): Promise<UserProgress> {
  const response = await fetch(`${WORKER_URL}/api/user/progress?user_id=${userId}`);
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to get progress');
  }

  return data;
}

/**
 * Get lessons
 */
export async function getLessons(userId?: string): Promise<Lesson[]> {
  const url = userId
    ? `${WORKER_URL}/api/lessons?user_id=${userId}`
    : `${WORKER_URL}/api/lessons`;

  const response = await fetch(url);
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to get lessons');
  }

  return data.lessons;
}

/**
 * Search signs
 */
export async function searchSigns(query: string): Promise<SignWithImages[]> {
  const response = await fetch(`${WORKER_URL}/api/signs/search?q=${encodeURIComponent(query)}`);
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to search signs');
  }

  return data.signs;
}

