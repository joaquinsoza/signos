/**
 * signos-tok Worker - Text to Sign Language Video Generation
 * 
 * Endpoints:
 * - POST /api/generate - Generate video from text script
 * - GET /api/videos/:id - Get generated video
 * - GET /api/videos - List all videos
 * - DELETE /api/videos/:id - Delete video
 * - GET /api/translate - Translate text to signs (no video)
 */

import { SignMatcher } from './services/sign-matcher';
import { VideoGenerator } from './services/video-generator';
import type { 
  Env, 
  VideoGenerationRequest, 
  VideoGenerationResponse,
  VideoSettings 
} from './types';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Initialize services
      const signMatcher = new SignMatcher(env);
      const videoGenerator = new VideoGenerator(env);

      // Route: POST /api/generate - Generate video from script
      if (path === '/api/generate' && request.method === 'POST') {
        const startTime = Date.now();
        
        const body: VideoGenerationRequest = await request.json();
        
        if (!body.script || typeof body.script !== 'string') {
          return jsonResponse(
            { success: false, error: 'Missing or invalid "script" field' },
            { status: 400, headers: corsHeaders }
          );
        }

        console.log(`[Worker] Generating video for script: "${body.script}"`);

        // Step 1: Translate script to signs
        const signs = await signMatcher.translateToSigns(body.script);

        if (signs.length === 0) {
          return jsonResponse(
            { 
              success: false, 
              error: 'No signs found for the provided script. Try using simpler Spanish words.' 
            },
            { status: 200, headers: corsHeaders }
          );
        }

        // Step 2: Generate video
        const videoResult = await videoGenerator.generateVideo(
          signs,
          body.settings
        );

        const processingTime = Date.now() - startTime;

        const response: VideoGenerationResponse = {
          success: true,
          videoUrl: videoResult.videoUrl,
          videoId: videoResult.videoId,
          signs,
          duration: videoResult.duration,
          processingTime
        };

        console.log(`[Worker] ✅ Video generated in ${processingTime}ms`);

        return jsonResponse(response, { headers: corsHeaders });
      }

      // Route: GET /api/videos/:id - Get video by ID
      if (path.startsWith('/api/videos/') && request.method === 'GET') {
        const videoId = path.split('/')[3];
        
        if (!videoId) {
          return jsonResponse(
            { success: false, error: 'Video ID required' },
            { status: 400, headers: corsHeaders }
          );
        }

        const video = await videoGenerator.getVideo(videoId);
        
        if (!video) {
          return jsonResponse(
            { success: false, error: 'Video not found' },
            { status: 404, headers: corsHeaders }
          );
        }

        return video;
      }

      // Route: GET /api/videos - List all videos
      if (path === '/api/videos' && request.method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const videos = await videoGenerator.listVideos(limit);

        return jsonResponse(
          { success: true, videos, count: videos.length },
          { headers: corsHeaders }
        );
      }

      // Route: DELETE /api/videos/:id - Delete video
      if (path.startsWith('/api/videos/') && request.method === 'DELETE') {
        const videoId = path.split('/')[3];
        
        if (!videoId) {
          return jsonResponse(
            { success: false, error: 'Video ID required' },
            { status: 400, headers: corsHeaders }
          );
        }

        const deleted = await videoGenerator.deleteVideo(videoId);

        return jsonResponse(
          { success: deleted },
          { headers: corsHeaders }
        );
      }

      // Route: GET /api/translate - Translate text to signs (no video)
      if (path === '/api/translate' && request.method === 'GET') {
        const text = url.searchParams.get('text');

        if (!text) {
          return jsonResponse(
            { success: false, error: 'Missing "text" query parameter' },
            { status: 400, headers: corsHeaders }
          );
        }

        const signs = await signMatcher.translateToSigns(text);

        return jsonResponse(
          { success: true, text, signs, count: signs.length },
          { headers: corsHeaders }
        );
      }

      // Route: GET / - API documentation
      if (path === '/' && request.method === 'GET') {
        return new Response(getApiDocs(), {
          headers: { ...corsHeaders, 'Content-Type': 'text/html' }
        });
      }

      // 404 - Route not found
      return jsonResponse(
        { success: false, error: 'Not found' },
        { status: 404, headers: corsHeaders }
      );

    } catch (error) {
      console.error('[Worker] Error:', error);
      
      return jsonResponse(
        { 
          success: false, 
          error: error instanceof Error ? error.message : 'Internal server error' 
        },
        { status: 500, headers: corsHeaders }
      );
    }
  }
};

/**
 * Helper: JSON response with proper headers
 */
function jsonResponse(data: any, options: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status: options.status || 200,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
}

/**
 * API documentation HTML
 */
function getApiDocs(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>signos-tok API</title>
  <style>
    body { font-family: system-ui; max-width: 800px; margin: 40px auto; padding: 20px; }
    h1 { color: #333; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
    pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
    .endpoint { margin: 30px 0; }
    .method { 
      display: inline-block; 
      padding: 4px 8px; 
      border-radius: 3px; 
      font-weight: bold; 
      color: white; 
    }
    .post { background: #49cc90; }
    .get { background: #61affe; }
    .delete { background: #f93e3e; }
  </style>
</head>
<body>
  <h1>🤟 signos-tok API</h1>
  <p>Generate sign language videos from text scripts using AI</p>

  <div class="endpoint">
    <h3><span class="method post">POST</span> /api/generate</h3>
    <p>Generate a video from a text script</p>
    <pre>
// Request
{
  "script": "hola necesito agua por favor",
  "title": "My Video",
  "settings": {
    "fps": 30,
    "signDuration": 1500,
    "width": 720,
    "height": 1280,
    "format": "mp4"
  }
}

// Response
{
  "success": true,
  "videoUrl": "/api/videos/video_123/manifest.json",
  "videoId": "video_123",
  "signs": [...],
  "duration": 4.5,
  "processingTime": 450
}</pre>
  </div>

  <div class="endpoint">
    <h3><span class="method get">GET</span> /api/translate?text=...</h3>
    <p>Translate text to signs without generating video</p>
    <pre>
// Example: /api/translate?text=hola+mundo

// Response
{
  "success": true,
  "text": "hola mundo",
  "signs": [
    {
      "glosa": "HOLA",
      "images": [...],
      "definition": "Expresión de saludo",
      "confidence": 0.92
    }
  ],
  "count": 2
}</pre>
  </div>

  <div class="endpoint">
    <h3><span class="method get">GET</span> /api/videos/:id</h3>
    <p>Get generated video manifest by ID</p>
  </div>

  <div class="endpoint">
    <h3><span class="method get">GET</span> /api/videos</h3>
    <p>List all generated videos</p>
  </div>

  <div class="endpoint">
    <h3><span class="method delete">DELETE</span> /api/videos/:id</h3>
    <p>Delete a video</p>
  </div>

  <hr>
  <p><strong>Technology Stack:</strong></p>
  <ul>
    <li>Cloudflare Workers AI - Embeddings & LLM</li>
    <li>Vectorize - Sign language RAG database</li>
    <li>R2 Storage - Video storage</li>
    <li>Chilean Sign Language (LSCh) Dictionary</li>
  </ul>
</body>
</html>`;
}

