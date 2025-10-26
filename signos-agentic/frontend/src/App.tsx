// Main application component
import ChatInterface from './components/ChatInterface';

export default function App() {

  return (
    <div className="min-h-screen bg-dark-bg text-white flex flex-col">
      {/* Header */}
      <header className="bg-dark-card border-b border-dark-hover px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-center">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🤟</div>
            <div>
              <h1 className="text-xl font-bold">SIGNOS Chat</h1>
              <p className="text-xs text-gray-400">Aprende LSCh con IA</p>
            </div>
          </div>
        </div>
      </header>

      {/* Chat Interface */}
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        <ChatInterface />
      </div>
    </div>
  );
}

