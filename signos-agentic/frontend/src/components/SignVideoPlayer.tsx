// Sign video player component - displays sign language videos
import { useState, useEffect, useRef } from 'react';
import { SignWithImages } from '../lib/api';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface SignVideoPlayerProps {
  signs: SignWithImages[];
  autoplay?: boolean;
  loop?: boolean;
}

export default function SignVideoPlayer({ signs, autoplay = false, loop = false }: SignVideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(autoplay);
  const [currentSignIndex, setCurrentSignIndex] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const intervalRef = useRef<number | null>(null);

  const BASE_URL = '/signs'; // Assuming signs are in public/signs

  // Get current sign and image
  const currentSign = signs[currentSignIndex];
  const currentImage = currentSign?.images[currentImageIndex];
  const imagePath = currentImage ? `${BASE_URL}/${currentImage.path}` : null;
  
  // Check if we need controls: hide if single sign with single image
  const needsControls = signs.length > 1 || (currentSign?.images.length || 0) > 1;

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = window.setInterval(() => {
        setCurrentImageIndex(prev => {
          const nextIndex = prev + 1;
          
          // If we've shown all images of current sign
          if (nextIndex >= currentSign.images.length) {
            setCurrentSignIndex(prevSign => {
              const nextSign = prevSign + 1;
              
              // If we've shown all signs
              if (nextSign >= signs.length) {
                if (loop) {
                  return 0; // Loop back to start
                } else {
                  setIsPlaying(false); // Stop playing
                  return prevSign;
                }
              }
              
              return nextSign;
            });
            
            return 0; // Reset to first image of next sign
          }
          
          return nextIndex;
        });
      }, 500); // 500ms per frame
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, currentSign, signs.length, loop]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleRestart = () => {
    setCurrentSignIndex(0);
    setCurrentImageIndex(0);
    setIsPlaying(true);
  };

  if (!signs || signs.length === 0) {
    return (
      <div className="w-full aspect-[9/16] bg-dark-card rounded-lg flex items-center justify-center">
        <p className="text-gray-400">No hay señas para mostrar</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Video display */}
      <div className="relative aspect-[9/16] bg-dark-card rounded-lg overflow-hidden">
        {imagePath ? (
          <img
            src={imagePath}
            alt={currentSign.glosa}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            Cargando...
          </div>
        )}

        {/* Sign info overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <h3 className="text-white text-2xl font-bold">{currentSign.glosa}</h3>
          <p className="text-gray-300 text-sm">{currentSign.definition}</p>
        </div>
      </div>

      {/* Controls - Only show if there are multiple signs or multiple images */}
      {needsControls && (
        <div className="mt-4 flex items-center justify-center gap-4">
          <button
            onClick={handleRestart}
            className="p-3 rounded-full bg-dark-card hover:bg-dark-hover transition"
            title="Reiniciar"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <button
            onClick={handlePlayPause}
            className="p-4 rounded-full bg-primary hover:bg-primary/80 transition"
            title={isPlaying ? 'Pausar' : 'Reproducir'}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6" />
            )}
          </button>

          <div className="text-sm text-gray-400">
            Seña {currentSignIndex + 1} de {signs.length}
          </div>
        </div>
      )}

      {/* Progress indicator - Only show if multiple signs */}
      {signs.length > 1 && (
        <div className="mt-4">
          <div className="flex gap-1">
            {signs.map((_, index) => (
              <div
                key={index}
                className={`h-1 flex-1 rounded-full transition ${
                  index <= currentSignIndex ? 'bg-primary' : 'bg-dark-card'
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

