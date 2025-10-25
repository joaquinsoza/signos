import SignVideoPlayer from './SignVideoPlayer';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  signs?: any[];
  videoId?: string;
  timestamp: number;
}

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`px-4 py-6 ${isUser ? 'bg-[#343541]' : 'bg-[#444654]'}`}>
      <div className="max-w-3xl mx-auto flex gap-4">
        {/* Avatar */}
        <div
          className={`w-8 h-8 rounded-sm flex items-center justify-center flex-shrink-0 ${
            isUser ? 'bg-[#5436da]' : 'bg-[#10a37f]'
          }`}
        >
          <span className="text-white text-sm">
            {isUser ? '👤' : '🤟'}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-4">
          <div className="text-white whitespace-pre-wrap">{message.content}</div>

          {/* Signs Display */}
          {message.signs && message.signs.length > 0 && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span>🤟</span>
                <span>{message.signs.length} seña{message.signs.length !== 1 ? 's' : ''} generada{message.signs.length !== 1 ? 's' : ''}</span>
              </div>
              
              <div className="grid grid-cols-1 gap-3">
                {message.signs.map((sign, index) => (
                  <div
                    key={index}
                    className="bg-[#343541] rounded-lg p-4 border border-gray-700"
                  >
                    <div className="flex items-start gap-4">
                      {/* Sign Image Preview */}
                      {sign.images && sign.images.length > 0 && (
                        <div className="w-24 h-24 bg-gray-800 rounded-lg overflow-hidden flex-shrink-0 border border-gray-700">
                          <img
                            src={`/signs/${sign.images[0].path}`}
                            alt={sign.glosa}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              target.parentElement!.innerHTML = `
                                <div class="w-full h-full flex flex-col items-center justify-center text-center">
                                  <div class="text-3xl mb-1">🤟</div>
                                  <div class="text-xs text-gray-500">${sign.images.length} frames</div>
                                </div>
                              `;
                            }}
                          />
                        </div>
                      )}
                      
                      {/* Sign Info */}
                      <div className="flex-1 space-y-2">
                        <div>
                          <h3 className="text-lg font-semibold text-white">{sign.glosa}</h3>
                          <p className="text-sm text-gray-400 mt-1">{sign.definition}</p>
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>Confianza: {(sign.confidence * 100).toFixed(1)}%</span>
                          <span>•</span>
                          <span>Duración: {(sign.duration / 1000).toFixed(1)}s</span>
                          <span>•</span>
                          <span>{sign.images?.length || 0} imágenes</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Video Player */}
              {message.videoId && (
                <SignVideoPlayer videoId={message.videoId} signs={message.signs} />
              )}
            </div>
          )}

          {/* Timestamp */}
          <div className="text-xs text-gray-600">
            {new Date(message.timestamp).toLocaleTimeString('es-CL', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

