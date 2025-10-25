// API client for signos-tok worker

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:51937';

export interface VideoGenerationResult {
  success: boolean;
  videoUrl?: string;
  videoId?: string;
  signs?: Array<{
    glosa: string;
    images: Array<{ path: string; sequence: number }>;
    definition: string;
    confidence: number;
    duration: number;
  }>;
  duration?: number;
  processingTime?: number;
  error?: string;
}

export async function generateSignVideo(script: string): Promise<VideoGenerationResult> {
  try {
    const response = await fetch(`${WORKER_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        script,
        settings: {
          fps: 30,
          signDuration: 1500,
          width: 720,
          height: 1280,
          format: 'mp4',
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error generating video:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function translateText(text: string) {
  try {
    const response = await fetch(`${WORKER_URL}/api/translate?text=${encodeURIComponent(text)}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error translating text:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function getVideoManifest(videoId: string) {
  try {
    const response = await fetch(`${WORKER_URL}/api/videos/${videoId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting video manifest:', error);
    return null;
  }
}

