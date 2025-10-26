// Exercise card component
import { useState } from 'react';
import { Exercise } from '../lib/api';
import SignVideoPlayer from './SignVideoPlayer';
import { Lightbulb } from 'lucide-react';

interface ExerciseCardProps {
  exercise: Exercise;
  onSubmit: (answer: string) => void;
}

export default function ExerciseCard({ exercise, onSubmit }: ExerciseCardProps) {
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [showHint, setShowHint] = useState(false);

  const handleSubmit = () => {
    if (selectedAnswer.trim()) {
      onSubmit(selectedAnswer);
      setSelectedAnswer('');
      setShowHint(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="bg-dark-card rounded-lg p-6 space-y-4">
      {/* Exercise question */}
      <div className="text-center">
        <h3 className="text-xl font-semibold mb-2">{exercise.question}</h3>
        <span className="inline-block px-3 py-1 bg-primary/20 text-primary text-sm rounded-full">
          {exercise.type === 'matching' && '🎯 Emparejar'}
          {exercise.type === 'translation' && '✍️ Traducir'}
          {exercise.type === 'video_to_text' && '👀 Video a texto'}
          {exercise.type === 'build_phrase' && '🏗️ Construir frase'}
        </span>
      </div>

      {/* Show sign video if present */}
      {exercise.signs && exercise.signs.length > 0 && (
        <div className="my-6">
          <SignVideoPlayer signs={exercise.signs} autoplay />
        </div>
      )}

      {/* Multiple choice options */}
      {exercise.options && exercise.options.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {exercise.options.map((option, index) => (
            <button
              key={index}
              onClick={() => setSelectedAnswer(option)}
              className={`p-4 rounded-lg border-2 transition ${
                selectedAnswer === option
                  ? 'border-primary bg-primary/20 text-white'
                  : 'border-dark-hover hover:border-primary/50 text-gray-300'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {/* Text input for open-ended questions */}
      {(!exercise.options || exercise.options.length === 0) && (
        <input
          type="text"
          value={selectedAnswer}
          onChange={(e) => setSelectedAnswer(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Escribe tu respuesta..."
          className="w-full p-4 bg-dark-bg border-2 border-dark-hover rounded-lg focus:border-primary outline-none"
          autoFocus
        />
      )}

      {/* Hint */}
      {exercise.hint && (
        <div className="text-center">
          {!showHint ? (
            <button
              onClick={() => setShowHint(true)}
              className="text-sm text-gray-400 hover:text-primary flex items-center gap-2 mx-auto"
            >
              <Lightbulb className="w-4 h-4" />
              Ver pista
            </button>
          ) : (
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-500 text-sm">
              <Lightbulb className="w-4 h-4 mt-0.5" />
              <span>{exercise.hint}</span>
            </div>
          )}
        </div>
      )}

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!selectedAnswer.trim()}
        className="w-full py-3 bg-primary hover:bg-primary/80 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition"
      >
        Enviar Respuesta
      </button>
    </div>
  );
}

