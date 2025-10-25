'use client';

import { useState, useEffect, useRef } from 'react';

interface SignVideoPlayerProps {
  videoId: string;
  signs: any[];
}

export default function SignVideoPlayer({ videoId, signs }: SignVideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Calculate total frames from all signs
    const total = signs.reduce((sum, sign) => sum + (sign.images?.length || 0), 0);
    setTotalFrames(total);
  }, [signs]);

  const play = () => {
    if (isPlaying) return;
    
    setIsPlaying(true);
    let frame = 0;
    
    intervalRef.current = setInterval(() => {
      frame++;
      if (frame >= totalFrames) {
        frame = 0;
        setIsPlaying(false);
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
      setCurrentFrame(frame);
    }, 500); // 500ms per frame
  };

  const pause = () => {
    setIsPlaying(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const reset = () => {
    pause();
    setCurrentFrame(0);
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Get current sign and image based on frame
  const getCurrentSignImage = () => {
    let frameCount = 0;
    for (const sign of signs) {
      const signFrames = sign.images?.length || 0;
      if (currentFrame < frameCount + signFrames) {
        const imageIndex = currentFrame - frameCount;
        return {
          sign: sign.glosa,
          image: sign.images?.[imageIndex],
        };
      }
      frameCount += signFrames;
    }
    return null;
  };

  const current = getCurrentSignImage();

  return (
    <div className="bg-[#202123] rounded-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-white flex items-center gap-2">
          <span>🎬</span>
          <span>Reproducción de Video</span>
        </h4>
        <div className="text-xs text-gray-500">
          Frame {currentFrame + 1} / {totalFrames}
        </div>
      </div>

      {/* Video Display Area */}
      <div className="bg-black rounded-lg aspect-[9/16] max-w-xs mx-auto mb-4 flex items-center justify-center relative overflow-hidden">
        {current && current.image ? (
          <div className="relative w-full h-full">
            <img
              src={`/signs/${current.image.path}`}
              alt={current.sign}
              className="w-full h-full object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
              <div className="text-2xl font-bold text-white text-center">{current.sign}</div>
            </div>
          </div>
        ) : (
          <div className="text-center p-8">
            <div className="text-6xl mb-4">🤟</div>
            {!isPlaying && currentFrame === 0 && (
              <div className="text-gray-500 text-sm mt-4">
                Presiona Play para iniciar
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      {totalFrames > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            disabled={currentFrame === 0}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
            title="Reiniciar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-5 h-5 text-white"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"
              />
            </svg>
          </button>

          <button
            onClick={isPlaying ? pause : play}
            className="p-3 bg-[#10a37f] hover:bg-[#0d8c6e] rounded-lg transition flex items-center justify-center w-12 h-12"
            title={isPlaying ? 'Pausar' : 'Reproducir'}
          >
            {isPlaying ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-6 h-6 text-white"
              >
                <path
                  fillRule="evenodd"
                  d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-6 h-6 text-white"
              >
                <path
                  fillRule="evenodd"
                  d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

