import ChatInterface from '../components/ChatInterface';

export default function ChatPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8 h-screen">
        <div className="h-full max-h-screen flex flex-col">
          {/* Header with back button on mobile */}
          <div className="lg:hidden mb-4">
            <a
              href="/"
              className="text-gray-400 hover:text-white transition-colors inline-flex items-center gap-2"
            >
              ← Volver
            </a>
          </div>
          
          {/* Chat Interface */}
          <div className="flex-1 min-h-0">
            <ChatInterface />
          </div>
        </div>
      </div>
    </div>
  );
}

