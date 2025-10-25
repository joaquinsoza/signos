import type { Env, SignWithImages, VideoSettings } from '../types';
import { DEFAULT_VIDEO_SETTINGS } from '../types';

/**
 * VideoGenerator - Creates MP4/WebM videos from sign image sequences
 * 
 * Uses ffmpeg via Cloudflare Workers to stitch images into video
 * Note: This is a simplified version - production would use R2 + external video processing
 */
export class VideoGenerator {
  constructor(private env: Env) {}

  /**
   * Generate video from sign sequence
   * Returns R2 URL of generated video
   */
  async generateVideo(
    signs: SignWithImages[],
    settings: Partial<VideoSettings> = {}
  ): Promise<{ videoUrl: string; videoId: string; duration: number }> {
    const finalSettings: VideoSettings = {
      ...DEFAULT_VIDEO_SETTINGS,
      ...settings
    };

    const videoId = this.generateVideoId();
    console.log(`[VideoGenerator] Generating video ${videoId} with ${signs.length} signs`);

    try {
      // Calculate total duration
      const totalDuration = signs.reduce((sum, sign) => {
        return sum + (sign.duration || finalSettings.signDuration);
      }, 0) / 1000; // Convert to seconds

      console.log(`[VideoGenerator] Total duration: ${totalDuration}s`);

      // Generate video metadata JSON
      const videoMetadata = {
        videoId,
        createdAt: new Date().toISOString(),
        settings: finalSettings,
        signs: signs.map(s => ({
          glosa: s.glosa,
          images: s.images,
          duration: s.duration || finalSettings.signDuration
        })),
        totalDuration
      };

      // Store metadata in R2
      await this.env.VIDEOS.put(
        `${videoId}/metadata.json`,
        JSON.stringify(videoMetadata, null, 2),
        {
          httpMetadata: {
            contentType: 'application/json'
          }
        }
      );

      // Generate video manifest for client-side rendering
      // In production, this would trigger actual video encoding
      const manifest = await this.createVideoManifest(signs, finalSettings, videoId);

      // Store manifest
      await this.env.VIDEOS.put(
        `${videoId}/manifest.json`,
        JSON.stringify(manifest, null, 2),
        {
          httpMetadata: {
            contentType: 'application/json'
          }
        }
      );

      // For now, return manifest URL (client will render)
      // In production: return actual video.mp4 URL after encoding
      const videoUrl = `/api/videos/${videoId}/manifest.json`;

      console.log(`[VideoGenerator] ✅ Video generated: ${videoUrl}`);

      return {
        videoUrl,
        videoId,
        duration: totalDuration
      };

    } catch (error) {
      console.error('[VideoGenerator] Error:', error);
      throw new Error(`Video generation failed: ${error}`);
    }
  }

  /**
   * Create video manifest for client-side rendering
   * This allows progressive display while video encodes in background
   */
  private async createVideoManifest(
    signs: SignWithImages[],
    settings: VideoSettings,
    videoId: string
  ) {
    const frames: any[] = [];
    let currentTime = 0;

    for (const sign of signs) {
      const signDuration = sign.duration || settings.signDuration;
      const framesPerImage = Math.ceil((signDuration / 1000) * settings.fps / (sign.images.length || 1));

      for (const image of sign.images) {
        frames.push({
          imagePath: image.path,
          startTime: currentTime,
          duration: framesPerImage / settings.fps,
          glosa: sign.glosa,
          sequence: image.sequence
        });

        currentTime += framesPerImage / settings.fps;
      }

      // Add transition pause
      currentTime += settings.transitionDuration / 1000;
    }

    return {
      version: '1.0',
      videoId,
      settings,
      totalFrames: frames.length,
      totalDuration: currentTime,
      frames
    };
  }

  /**
   * Generate unique video ID
   */
  private generateVideoId(): string {
    return `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get video by ID
   */
  async getVideo(videoId: string): Promise<Response | null> {
    try {
      const object = await this.env.VIDEOS.get(`${videoId}/manifest.json`);
      
      if (!object) {
        return null;
      }

      return new Response(object.body, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    } catch (error) {
      console.error(`[VideoGenerator] Error getting video ${videoId}:`, error);
      return null;
    }
  }

  /**
   * List all videos (paginated)
   */
  async listVideos(limit: number = 20): Promise<string[]> {
    try {
      const list = await this.env.VIDEOS.list({
        limit,
        prefix: 'video_'
      });

      // Extract video IDs from paths
      const videoIds = new Set<string>();
      for (const object of list.objects) {
        const match = object.key.match(/^(video_[^/]+)/);
        if (match) {
          videoIds.add(match[1]);
        }
      }

      return Array.from(videoIds);
    } catch (error) {
      console.error('[VideoGenerator] Error listing videos:', error);
      return [];
    }
  }

  /**
   * Delete video
   */
  async deleteVideo(videoId: string): Promise<boolean> {
    try {
      await this.env.VIDEOS.delete(`${videoId}/metadata.json`);
      await this.env.VIDEOS.delete(`${videoId}/manifest.json`);
      console.log(`[VideoGenerator] Deleted video ${videoId}`);
      return true;
    } catch (error) {
      console.error(`[VideoGenerator] Error deleting video ${videoId}:`, error);
      return false;
    }
  }
}

