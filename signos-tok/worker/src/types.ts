// Environment bindings
export interface Env {
  AI: Ai;
  VECTORIZE: Vectorize;
  VIDEOS: R2Bucket;
  CF_ACCOUNT: string;
  CF_API_TOKEN: string;
}

// Sign match from Vectorize
export interface SignMatch {
  id: string;
  glosa: string;
  translations: string;
  images: string;  // JSON string of ImageInfo array
  definition: string;
  variant: number;
  score: number;
}

// Individual sign image info
export interface ImageInfo {
  path: string;
  sequence: number;
}

// Sign with parsed images
export interface SignWithImages {
  glosa: string;
  images: ImageInfo[];
  definition: string;
  confidence: number;
  duration: number;  // milliseconds per sign
}

// Video generation request
export interface VideoGenerationRequest {
  script: string;
  title?: string;
  settings?: VideoSettings;
}

// Video generation settings
export interface VideoSettings {
  fps: number;              // frames per second (default: 30)
  signDuration: number;     // milliseconds per sign (default: 1500)
  transitionDuration: number; // milliseconds for transitions (default: 300)
  width: number;            // video width (default: 720)
  height: number;           // video height (default: 1280)
  format: 'mp4' | 'webm';   // output format (default: mp4)
  backgroundColor: string;  // hex color (default: #000000)
}

// Default settings
export const DEFAULT_VIDEO_SETTINGS: VideoSettings = {
  fps: 30,
  signDuration: 1500,
  transitionDuration: 300,
  width: 720,
  height: 1280,
  format: 'mp4',
  backgroundColor: '#000000'
};

// Video generation response
export interface VideoGenerationResponse {
  success: boolean;
  videoUrl?: string;
  videoId?: string;
  signs?: SignWithImages[];
  duration?: number;  // total video duration in seconds
  error?: string;
  processingTime?: number;  // milliseconds
}

// Job status for async processing
export interface VideoJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  script: string;
  settings: VideoSettings;
  videoUrl?: string;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

