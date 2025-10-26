import ChatInterface from './components/ChatInterface';

function App() {
  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8 h-screen">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full max-h-screen">
          
          {/* Left Side - Chat Interface */}
          <div className="flex flex-col h-full min-h-0">
            <ChatInterface />
          </div>

          {/* Right Side - Landing Info */}
          <div className="hidden lg:flex flex-col justify-center text-white space-y-4 px-8 py-4">
            
            {/* Hero Section */}
            <div className="space-y-2">
              <div className="inline-block">
                <span className="text-4xl">🤟</span>
              </div>
              
              <h1 className="text-3xl font-bold leading-tight">
                Aprende Lengua de Señas Chilena
              </h1>
              
              <p className="text-base text-gray-300 leading-snug">
                Tu asistente inteligente para aprender LSCh. Busca señas, descubre la cultura sorda, 
                y explora la gramática de esta hermosa lengua visual.
              </p>

              {/* Speech to Sign Button */}
              <div className="pt-2">
                <a
                  href="/speech-to-sign"
                  className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-lg font-medium transition-all duration-200 text-sm"
                >
                  🎤 Voz a Señas
                </a>
                <p className="text-xs text-gray-400 mt-1">
                  Habla y ve las señas en tiempo real
                </p>
              </div>
            </div>

            {/* Features */}
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-gray-200">
                ¿Qué puedo hacer?
              </h2>
              
              <div className="grid grid-cols-2 gap-2">
                <FeatureCard
                  icon="🔍"
                  title="Buscar Señas"
                  description="2,100+ señas con imágenes"
                  example="¿Cómo se dice agua?"
                />
                
                <FeatureCard
                  icon="📚"
                  title="Aprender Historia"
                  description="Orígenes de LSCh desde 1852"
                  example="Historia de LSCh"
                />
                
                <FeatureCard
                  icon="🎭"
                  title="Explorar Cultura"
                  description="Comunidad sorda chilena"
                  example="¿Qué es ASOCH?"
                />
                
                <FeatureCard
                  icon="✨"
                  title="Entender Gramática"
                  description="Estructura de LSCh"
                  example="Gramática espacial"
                />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-700">
              <StatCard number="2,123" label="Señas" />
              <StatCard number="418" label="Recursos" />
              <StatCard number="100%" label="Gratis" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Feature Card Component
function FeatureCard({ 
  icon, 
  title, 
  description, 
  example 
}: { 
  icon: string; 
  title: string; 
  description: string; 
  example: string;
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
      <div className="flex items-start gap-2">
        <span className="text-xl">{icon}</span>
        <div className="flex-1">
          <h3 className="font-semibold text-sm mb-0.5">{title}</h3>
          <p className="text-gray-400 text-xs mb-1">{description}</p>
          <p className="text-gray-500 text-xs italic truncate">
            "{example}"
          </p>
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ number, label }: { number: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-xl font-bold text-primary">{number}</div>
      <div className="text-xs text-gray-400">{label}</div>
    </div>
  );
}

export default App;
