// Main chat interface component
import { useState, useRef, useEffect } from 'react';
import { sendChatMessage, ChatResponse } from '../lib/api';
import { Send, Loader2, Sparkles } from 'lucide-react';
import ExerciseCard from './ExerciseCard';
import SignVideoPlayer from './SignVideoPlayer';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  metadata?: ChatResponse['response'];
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '¡Hola! 🤟 Soy tu asistente de Lengua de Señas Chilena.\n\n¿En qué puedo ayudarte?',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (message?: string) => {
    const textToSend = message || input;
    if (!textToSend.trim() || isLoading) return;

    // Add user message
    const userMessage: Message = {
      role: 'user',
      content: textToSend,
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await sendChatMessage(textToSend, sessionId);
      
      if (!sessionId) {
        setSessionId(response.session_id);
      }

      // Add assistant message
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.response.message,
        metadata: response.response,
      };
      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Lo siento, hubo un error. Por favor intenta de nuevo.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleExerciseSubmit = (answer: string) => {
    handleSend(answer);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-4 ${
                message.role === 'user'
                  ? 'bg-primary text-white'
                  : 'bg-dark-card'
              }`}
            >
              {/* Message content */}
              <div className="whitespace-pre-wrap">{message.content}</div>

              {/* XP/Level up notification */}
              {message.metadata?.xp_earned && message.metadata.xp_earned > 0 && (
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                  <span className="text-yellow-500 font-semibold">
                    +{message.metadata.xp_earned} XP
                  </span>
                  {message.metadata.level_up && (
                    <span className="text-green-500 font-semibold">
                      🎊 ¡Nivel subido!
                    </span>
                  )}
                </div>
              )}

              {/* Signs video player */}
              {message.metadata?.signs && message.metadata.signs.length > 0 && (
                <div className="mt-4">
                  <SignVideoPlayer signs={message.metadata.signs} autoplay />
                </div>
              )}

              {/* Exercise */}
              {message.metadata?.exercise && (
                <div className="mt-4">
                  <ExerciseCard
                    exercise={message.metadata.exercise}
                    onSubmit={handleExerciseSubmit}
                  />
                </div>
              )}

              {/* Achievement notification */}
              {message.metadata?.achievement_unlocked && (
                <div className="mt-2 p-3 bg-yellow-500/20 border border-yellow-500 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{message.metadata.achievement_unlocked.icon}</span>
                    <div>
                      <div className="font-semibold">{message.metadata.achievement_unlocked.name}</div>
                      <div className="text-sm opacity-80">
                        {message.metadata.achievement_unlocked.description}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-dark-card rounded-lg p-4">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-dark-hover p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Escribe tu mensaje..."
            className="flex-1 p-3 bg-dark-card border border-dark-hover rounded-lg focus:border-primary outline-none"
            disabled={isLoading}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="p-3 bg-primary hover:bg-primary/80 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

