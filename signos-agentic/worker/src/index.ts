// Main worker entry point for signos-agentic
import { Env, ChatMessage, AgentContext } from './types';
import { AgenticService } from './services/agentic-service';
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

      // Embedding generation endpoint (for PDF processing script)
      if (path === '/api/embedding' && request.method === 'POST') {
        return handleGenerateEmbedding(request, env, corsHeaders);
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
 * Handle chat message (anonymous, no user tracking)
 */
async function handleChat(request: Request, env: Env, corsHeaders: any): Promise<Response> {
  const body = await request.json() as {
    message: string;
    session_id?: string;
  };

  if (!body.message) {
    return jsonResponse({ error: 'Missing message' }, corsHeaders, 400);
  }

  const agenticService = new AgenticService(env);

  // Use anonymous session
  const sessionId = body.session_id || `session_${Date.now()}`;

  // Build minimal context (no user, no lessons)
  const context: AgentContext = {
    user: null,
    current_lesson: null,
    chat_history: [],
    available_lessons: [],
  };

  // Process message with agentic reasoning
  const response = await agenticService.processMessage(body.message, context);

  return jsonResponse({
    success: true,
    session_id: sessionId,
    response: response,
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
  
  // Get user - must exist
  let user;
  try {
    user = await userService.getUser(userId);
  } catch (error) {
    console.error(`[handleGetUserProgress] User ${userId} not found`);
    return jsonResponse({ 
      error: 'User not found', 
      message: 'Please create a user first using /api/user endpoint',
      user_id: userId 
    }, corsHeaders, 404);
  }

  const actualUserId = user.id;
  
  const progress = await userService.getUserLessonProgress(actualUserId);
  const achievements = await userService.getUserAchievements(actualUserId);

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
 * Handle generate embedding
 */
async function handleGenerateEmbedding(request: Request, env: Env, corsHeaders: any): Promise<Response> {
  const body = await request.json() as { text: string };
  
  if (!body.text) {
    return jsonResponse({ error: 'Missing text' }, corsHeaders, 400);
  }

  try {
    // Generate embedding
    const response = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
      text: [body.text],
    });

    return jsonResponse({
      success: true,
      embedding: response.data[0],
      dimensions: response.data[0].length,
    }, corsHeaders);
  } catch (error) {
    console.error('Error generating embedding:', error);
    return jsonResponse({
      error: 'Failed to generate embedding',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, corsHeaders, 500);
  }
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

