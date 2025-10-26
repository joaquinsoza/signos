// Integration with signos-tok worker for video generation
import { SignWithImages } from '../types';

// URL of signos-tok worker (configure based on environment)
const SIGNOS_TOK_URL = 'http://localhost:51937'; // Update for production

export interface VideoManifest {
  videoId: string;
  videoUrl: string;
  signs: SignWithImages[];
  duration: number;
  totalFrames: number;
}

export class VideoIntegration {
  /**
   * Generate video from sign sequence using signos-tok worker
   */
  async generateVideo(signs: SignWithImages[]): Promise<VideoManifest | null> {
    try {
      // Build script from glosas
      const script = signs.map(s => s.glosa.toLowerCase()).join(' ');
      
      // Call signos-tok worker
      const response = await fetch(`${SIGNOS_TOK_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        console.error('[VideoIntegration] Failed to generate video:', response.statusText);
        return null;
      }

      const data = await response.json();

      if (!data.success) {
        console.error('[VideoIntegration] Video generation failed:', data.error);
        return null;
      }

      return {
        videoId: data.videoId,
        videoUrl: data.videoUrl,
        signs: data.signs || signs,
        duration: data.duration || 0,
        totalFrames: data.totalFrames || 0,
      };
    } catch (error) {
      console.error('[VideoIntegration] Error calling signos-tok:', error);
      return null;
    }
  }

  /**
   * Get video manifest by ID
   */
  async getVideoManifest(videoId: string): Promise<any> {
    try {
      const response = await fetch(`${SIGNOS_TOK_URL}/api/videos/${videoId}`);
      
      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('[VideoIntegration] Error getting manifest:', error);
      return null;
    }
  }

  /**
   * Check if signos-tok worker is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${SIGNOS_TOK_URL}/`, {
        method: 'GET',
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

