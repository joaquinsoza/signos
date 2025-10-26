// Main worker entry point for signos-agentic
import { Env, ChatMessage, AgentContext } from './types';
import { AgentService } from './services/agent-service';
import { UserService } from './services/user-service';
import { LessonService } from './services/lesson-service';
import { SignMatcher } from './services/sign-matcher';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Health check
      if (path === '/' || path === '/health') {
        return jsonResponse({ status: 'ok', service: 'signos-agentic' }, corsHeaders);
      }

      // Chat endpoint - main conversational interface
      if (path === '/api/chat' && request.method === 'POST') {
        return handleChat(request, env, corsHeaders);
      }

      // User endpoints
      if (path === '/api/user' && request.method === 'POST') {
        return handleCreateUser(request, env, corsHeaders);
      }

      if (path.startsWith('/api/user/') && request.method === 'GET') {
        return handleGetUser(path, env, corsHeaders);
      }

      if (path === '/api/user/progress' && request.method === 'GET') {
        return handleGetUserProgress(url, env, corsHeaders);
      }

      // Lesson endpoints
      if (path === '/api/lessons' && request.method === 'GET') {
        return handleGetLessons(url, env, corsHeaders);
      }

      if (path.startsWith('/api/lessons/') && request.method === 'GET') {
        return handleGetLesson(path, env, corsHeaders);
      }

      // Sign search endpoint
      if (path === '/api/signs/search' && request.method === 'GET') {
        return handleSearchSigns(url, env, corsHeaders);
      }

      return jsonResponse({ error: 'Not found' }, corsHeaders, 404);
    } catch (error) {
      console.error('Error:', error);
      return jsonResponse(
        { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
        corsHeaders,
        500
      );
    }
  },
};

/**
 * Handle chat message
 */
async function handleChat(request: Request, env: Env, corsHeaders: any): Promise<Response> {
  const body = await request.json() as {
    user_id: string;
    message: string;
    session_id?: string;
  };

  if (!body.user_id || !body.message) {
    return jsonResponse({ error: 'Missing user_id or message' }, corsHeaders, 400);
  }

  const agentService = new AgentService(env);
  const userService = new UserService(env);
  const lessonService = new LessonService(env);

  // Get user
  const user = await userService.getUser(body.user_id);

  // Get chat history
  const sessionId = body.session_id || `session_${Date.now()}`;
  const historyResult = await env.DB
    .prepare(`
      SELECT * FROM chat_messages
      WHERE user_id = ? AND session_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `)
    .bind(body.user_id, sessionId)
    .all<ChatMessage>();

  const chatHistory = (historyResult.results || []).reverse();

  // Get current lesson (if any in progress)
  const progressResult = await env.DB
    .prepare(`
      SELECT l.* FROM lessons l
      JOIN user_lesson_progress ulp ON l.id = ulp.lesson_id
      WHERE ulp.user_id = ? AND ulp.status = 'in_progress'
      LIMIT 1
    `)
    .bind(body.user_id)
    .first();

  let currentLesson = null;
  if (progressResult) {
    currentLesson = await lessonService.getLesson(progressResult.id as string);
  }

  // Get available lessons
  const availableLessons = await lessonService.getAvailableLessons(body.user_id);

  // Build context
  const context: AgentContext = {
    user,
    current_lesson: currentLesson,
    chat_history: chatHistory,
    available_lessons: availableLessons,
  };

  // Process message
  const response = await agentService.processMessage(body.user_id, body.message, context);

  // Save messages to DB
  const userMsgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await env.DB
    .prepare(`
      INSERT INTO chat_messages (id, user_id, session_id, role, content, created_at)
      VALUES (?, ?, ?, 'user', ?, ?)
    `)
    .bind(userMsgId, body.user_id, sessionId, body.message, Date.now())
    .run();

  const assistantMsgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const metadata = {
    exercise: response.exercise,
    signs: response.signs,
    xp_earned: response.xp_earned,
    level_up: response.level_up,
    achievement_unlocked: response.achievement_unlocked,
  };

  await env.DB
    .prepare(`
      INSERT INTO chat_messages (id, user_id, session_id, role, content, metadata, created_at)
      VALUES (?, ?, ?, 'assistant', ?, ?, ?)
    `)
    .bind(assistantMsgId, body.user_id, sessionId, response.message, JSON.stringify(metadata), Date.now())
    .run();

  return jsonResponse({
    success: true,
    session_id: sessionId,
    response: response,
    user: {
      xp: user.total_xp,
      level: user.current_level,
      streak: user.streak_days,
    },
  }, corsHeaders);
}

/**
 * Handle create user
 */
async function handleCreateUser(request: Request, env: Env, corsHeaders: any): Promise<Response> {
  const body = await request.json() as {
    username: string;
    email?: string;
  };

  if (!body.username) {
    return jsonResponse({ error: 'Missing username' }, corsHeaders, 400);
  }

  const userService = new UserService(env);
  const user = await userService.getOrCreateUser(body.username, body.email);

  return jsonResponse({
    success: true,
    user,
  }, corsHeaders);
}

/**
 * Handle get user
 */
async function handleGetUser(path: string, env: Env, corsHeaders: any): Promise<Response> {
  const userId = path.split('/').pop();
  if (!userId) {
    return jsonResponse({ error: 'Missing user ID' }, corsHeaders, 400);
  }

  const userService = new UserService(env);
  const user = await userService.getUser(userId);

  return jsonResponse({
    success: true,
    user,
  }, corsHeaders);
}

/**
 * Handle get user progress
 */
async function handleGetUserProgress(url: URL, env: Env, corsHeaders: any): Promise<Response> {
  const userId = url.searchParams.get('user_id');
  if (!userId) {
    return jsonResponse({ error: 'Missing user_id' }, corsHeaders, 400);
  }

  const userService = new UserService(env);
  const user = await userService.getUser(userId);
  const progress = await userService.getUserLessonProgress(userId);
  const achievements = await userService.getUserAchievements(userId);

  const completed = progress.filter(p => p.status === 'completed').length;
  const inProgress = progress.filter(p => p.status === 'in_progress').length;
  const available = progress.filter(p => p.status === 'available').length;

  return jsonResponse({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      level: user.current_level,
      xp: user.total_xp,
      streak: user.streak_days,
    },
    lessons: {
      completed,
      in_progress: inProgress,
      available,
      total: progress.length,
    },
    achievements: achievements.length,
    achievements_list: achievements,
  }, corsHeaders);
}

/**
 * Handle get lessons
 */
async function handleGetLessons(url: URL, env: Env, corsHeaders: any): Promise<Response> {
  const userId = url.searchParams.get('user_id');
  const lessonService = new LessonService(env);

  if (userId) {
    const lessons = await lessonService.getAvailableLessons(userId);
    return jsonResponse({
      success: true,
      lessons,
    }, corsHeaders);
  } else {
    const lessons = await lessonService.getAllLessons();
    return jsonResponse({
      success: true,
      lessons,
    }, corsHeaders);
  }
}

/**
 * Handle get lesson
 */
async function handleGetLesson(path: string, env: Env, corsHeaders: any): Promise<Response> {
  const lessonId = path.split('/').pop();
  if (!lessonId) {
    return jsonResponse({ error: 'Missing lesson ID' }, corsHeaders, 400);
  }

  const lessonService = new LessonService(env);
  const lesson = await lessonService.getLesson(lessonId);

  if (!lesson) {
    return jsonResponse({ error: 'Lesson not found' }, corsHeaders, 404);
  }

  return jsonResponse({
    success: true,
    lesson,
  }, corsHeaders);
}

/**
 * Handle search signs
 */
async function handleSearchSigns(url: URL, env: Env, corsHeaders: any): Promise<Response> {
  const query = url.searchParams.get('q');
  if (!query) {
    return jsonResponse({ error: 'Missing query parameter' }, corsHeaders, 400);
  }

  const signMatcher = new SignMatcher(env);
  const signs = await signMatcher.findSigns(query);

  return jsonResponse({
    success: true,
    query,
    signs,
    count: signs.length,
  }, corsHeaders);
}

/**
 * Helper: JSON response
 */
function jsonResponse(data: any, headers: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

