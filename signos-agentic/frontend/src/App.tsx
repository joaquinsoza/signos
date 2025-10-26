import ChatInterface from './components/ChatInterface';

function App() {
  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8 h-screen">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full max-h-screen">
          
          {/* Left Side - Chat Interface */}
          <div className="flex flex-col">
            <ChatInterface />
          </div>

          {/* Right Side - Landing Info */}
          <div className="hidden lg:flex flex-col justify-center text-white space-y-6 px-8 overflow-y-auto">
            
            {/* Hero Section */}
            <div className="space-y-4">
              <div className="inline-block">
                <span className="text-5xl">🤟</span>
              </div>
              
              <h1 className="text-4xl font-bold leading-tight">
                Aprende Lengua de Señas Chilena
              </h1>
              
              <p className="text-lg text-gray-300 leading-relaxed">
                Tu asistente inteligente para aprender LSCh. Busca señas, descubre la cultura sorda, 
                y explora la gramática de esta hermosa lengua visual.
              </p>
            </div>

            {/* Features */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-200">
                ¿Qué puedo hacer?
              </h2>
              
              <div className="grid grid-cols-1 gap-4">
                <FeatureCard
                  icon="🔍"
                  title="Buscar Señas"
                  description="Más de 2,100 señas con imágenes y definiciones completas"
                  example="¿Cómo se dice agua?"
                />
                
                <FeatureCard
                  icon="📚"
                  title="Aprender Historia"
                  description="Descubre los orígenes de LSCh desde 1852"
                  example="Cuéntame sobre la historia de LSCh"
                />
                
                <FeatureCard
                  icon="🎭"
                  title="Explorar Cultura"
                  description="Conoce la comunidad sorda y sus organizaciones"
                  example="¿Qué es ASOCH?"
                />
                
                <FeatureCard
                  icon="✨"
                  title="Entender Gramática"
                  description="Aprende cómo funciona la estructura de LSCh"
                  example="¿Cómo funciona la gramática espacial?"
                />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-gray-700">
              <StatCard number="2,123" label="Señas" />
              <StatCard number="418" label="Recursos educativos" />
              <StatCard number="100%" label="Gratis" />
            </div>

            {/* Footer */}
            <div className="text-sm text-gray-400 pt-4">
              <p>
                Powered by Cloudflare Workers AI • RAG • Vectorize
              </p>
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
    <div className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-all duration-200 border border-gray-700">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1">
          <h3 className="font-semibold text-base mb-1">{title}</h3>
          <p className="text-gray-400 text-sm mb-2">{description}</p>
          <p className="text-gray-500 text-xs italic">
            Ej: "{example}"
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
      <div className="text-2xl font-bold text-white mb-1">{number}</div>
      <div className="text-sm text-gray-400">{label}</div>
    </div>
  );
}

export default App;
