// Main application component
import { useState, useEffect } from 'react';
import { createUser, getUserProgress, User, UserProgress } from './lib/api';
import ChatInterface from './components/ChatInterface';
import ProgressDashboard from './components/ProgressDashboard';
import { MessageSquare, BarChart3, Menu, X } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'progress'>('chat');
  const [isLoading, setIsLoading] = useState(true);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Initialize user on mount
  useEffect(() => {
    initUser();
  }, []);

  const initUser = async () => {
    try {
      // Check if user exists in localStorage
      let userId = localStorage.getItem('signos_user_id');
      
      if (!userId) {
        // Create new user
        const username = `user_${Date.now()}`;
        const newUser = await createUser(username);
        setUser(newUser);
        localStorage.setItem('signos_user_id', newUser.id);
        userId = newUser.id;
      } else {
        // Load existing user progress
        const userProgress = await getUserProgress(userId);
        setUser(userProgress.user as any);
        setProgress(userProgress);
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Error initializing user:', error);
      setIsLoading(false);
    }
  };

  const handleXPUpdate = async (xp: number, level: number, streak: number) => {
    if (user) {
      setUser({
        ...user,
        total_xp: xp,
        current_level: level,
        streak_days: streak,
      });
    }

    // Refresh progress
    if (user?.id) {
      try {
        const updatedProgress = await getUserProgress(user.id);
        setProgress(updatedProgress);
      } catch (error) {
        console.error('Error updating progress:', error);
      }
    }
  };

  const refreshProgress = async () => {
    if (!user?.id) return;
    
    try {
      const updatedProgress = await getUserProgress(user.id);
      setProgress(updatedProgress);
    } catch (error) {
      console.error('Error refreshing progress:', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'progress' && user?.id) {
      refreshProgress();
    }
  }, [activeTab, user?.id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">Error al cargar usuario</p>
          <button
            onClick={initUser}
            className="mt-4 px-4 py-2 bg-primary rounded-lg"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg text-white flex flex-col">
      {/* Header */}
      <header className="bg-dark-card border-b border-dark-hover px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🤟</div>
            <div>
              <h1 className="text-xl font-bold">SIGNOS Agentic</h1>
              <p className="text-xs text-gray-400">Aprende LSCh con IA</p>
            </div>
          </div>

          {/* User stats (desktop) */}
          <div className="hidden md:flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏆</span>
              <div>
                <div className="text-sm text-gray-400">Nivel</div>
                <div className="font-bold">{user.current_level}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">⭐</span>
              <div>
                <div className="text-sm text-gray-400">XP</div>
                <div className="font-bold">{user.total_xp}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔥</span>
              <div>
                <div className="text-sm text-gray-400">Racha</div>
                <div className="font-bold">{user.streak_days}</div>
              </div>
            </div>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="md:hidden p-2"
          >
            {showMobileMenu ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile menu */}
        {showMobileMenu && (
          <div className="md:hidden mt-4 pt-4 border-t border-dark-hover">
            <div className="flex justify-around">
              <div className="text-center">
                <div className="text-2xl">🏆</div>
                <div className="text-xs text-gray-400">Nivel</div>
                <div className="font-bold">{user.current_level}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl">⭐</div>
                <div className="text-xs text-gray-400">XP</div>
                <div className="font-bold">{user.total_xp}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl">🔥</div>
                <div className="text-xs text-gray-400">Racha</div>
                <div className="font-bold">{user.streak_days}</div>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col md:flex-row max-w-7xl mx-auto w-full">
        {/* Tabs (mobile) */}
        <div className="md:hidden border-b border-dark-hover">
          <div className="flex">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-3 flex items-center justify-center gap-2 ${
                activeTab === 'chat'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-gray-400'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
              <span>Chat</span>
            </button>
            <button
              onClick={() => setActiveTab('progress')}
              className={`flex-1 py-3 flex items-center justify-center gap-2 ${
                activeTab === 'progress'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-gray-400'
              }`}
            >
              <BarChart3 className="w-5 h-5" />
              <span>Progreso</span>
            </button>
          </div>
        </div>

        {/* Chat section */}
        <div
          className={`flex-1 ${
            activeTab === 'chat' ? 'flex' : 'hidden'
          } md:flex flex-col border-r border-dark-hover`}
        >
          <ChatInterface userId={user.id} onXPUpdate={handleXPUpdate} />
        </div>

        {/* Progress section */}
        <div
          className={`w-full md:w-96 ${
            activeTab === 'progress' ? 'block' : 'hidden'
          } md:block overflow-y-auto p-4`}
        >
          {progress ? (
            <ProgressDashboard progress={progress} />
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-400">Cargando progreso...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

