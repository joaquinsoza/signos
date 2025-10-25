'use client';

import { useState, useRef, useEffect } from 'react';
import ChatMessage from '@/components/ChatMessage';
import SignVideoPlayer from '@/components/SignVideoPlayer';
import { generateSignVideo } from '@/lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  signs?: any[];
  videoId?: string;
  timestamp: number;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const result = await generateSignVideo(input.trim());

      if (result.success) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `He generado el video con ${result.signs?.length || 0} señas para: "${input.trim()}"`,
          signs: result.signs,
          videoId: result.videoId,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `Lo siento, no pude encontrar señas para: "${input.trim()}". ${result.error || 'Intenta con palabras más simples.'}`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Error de conexión con el servidor. Asegúrate de que el worker esté corriendo.',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#343541]">
      {/* Header */}
      <header className="bg-[#202123] border-b border-gray-800 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🤟</span>
            <h1 className="text-xl font-semibold text-white">SIGNOS</h1>
          </div>
          <span className="text-xs text-gray-400 px-2 py-1 bg-gray-700 rounded">LSCh Video Generator</span>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 py-20">
              <div className="text-6xl mb-6">🤟</div>
              <h2 className="text-3xl font-semibold text-white mb-4">SIGNOS Chat</h2>
              <p className="text-gray-400 mb-8 max-w-md">
                Escribe cualquier texto en español y generaré un video de lengua de señas chilena (LSCh) para ti.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
                <button
                  onClick={() => setInput('hola necesito agua')}
                  className="p-4 bg-[#202123] hover:bg-[#2a2b32] rounded-lg text-left text-sm text-gray-300 border border-gray-700 transition"
                >
                  <span className="block font-medium mb-1">💬 Conversación básica</span>
                  <span className="text-gray-500">"hola necesito agua"</span>
                </button>
                <button
                  onClick={() => setInput('buenos días cómo estás')}
                  className="p-4 bg-[#202123] hover:bg-[#2a2b32] rounded-lg text-left text-sm text-gray-300 border border-gray-700 transition"
                >
                  <span className="block font-medium mb-1">👋 Saludos</span>
                  <span className="text-gray-500">"buenos días cómo estás"</span>
                </button>
                <button
                  onClick={() => setInput('gracias por todo')}
                  className="p-4 bg-[#202123] hover:bg-[#2a2b32] rounded-lg text-left text-sm text-gray-300 border border-gray-700 transition"
                >
                  <span className="block font-medium mb-1">🙏 Gratitud</span>
                  <span className="text-gray-500">"gracias por todo"</span>
                </button>
                <button
                  onClick={() => setInput('necesito ayuda urgente')}
                  className="p-4 bg-[#202123] hover:bg-[#2a2b32] rounded-lg text-left text-sm text-gray-300 border border-gray-700 transition"
                >
                  <span className="block font-medium mb-1">🆘 Emergencia</span>
                  <span className="text-gray-500">"necesito ayuda urgente"</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="py-6">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              {isLoading && (
                <div className="px-4 py-6 bg-[#444654]">
                  <div className="max-w-3xl mx-auto flex gap-4">
                    <div className="w-8 h-8 rounded-sm bg-[#10a37f] flex items-center justify-center flex-shrink-0">
                      <span className="text-white">🤟</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-700 bg-[#343541] p-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="relative flex items-center bg-[#40414f] rounded-lg shadow-lg">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu mensaje en español..."
              disabled={isLoading}
              className="flex-1 bg-transparent text-white px-4 py-3 outline-none disabled:opacity-50 placeholder:text-gray-500"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="absolute right-2 p-2 rounded-md text-gray-400 hover:text-white hover:bg-[#202123] disabled:opacity-50 disabled:hover:bg-transparent transition"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
              </svg>
            </button>
          </div>
          <div className="mt-2 text-xs text-center text-gray-500">
            Powered by Cloudflare Workers AI • {messages.length} mensajes
          </div>
        </form>
      </div>
    </div>
  );
}

