// User progress dashboard component
import { UserProgress } from '../lib/api';
import { Trophy, Star, Flame, BookOpen, Award } from 'lucide-react';

interface ProgressDashboardProps {
  progress: UserProgress;
}

export default function ProgressDashboard({ progress }: ProgressDashboardProps) {
  const { user, lessons, achievements } = progress;

  // Calculate XP progress to next level
  const xpForNextLevel = (user.level * user.level) * 50;
  const xpProgress = (user.xp / xpForNextLevel) * 100;

  return (
    <div className="space-y-4">
      {/* User stats header */}
      <div className="bg-gradient-to-r from-primary to-secondary rounded-lg p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">{user.username}</h2>
            <p className="text-white/80">Nivel {user.level}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{user.xp}</div>
            <div className="text-sm text-white/80">XP Total</div>
          </div>
        </div>

        {/* XP Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>Progreso al siguiente nivel</span>
            <span>{Math.round(xpProgress)}%</span>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-500"
              style={{ width: `${Math.min(xpProgress, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Streak */}
        <div className="bg-dark-card rounded-lg p-4 flex items-center gap-3">
          <div className="p-3 bg-orange-500/20 rounded-lg">
            <Flame className="w-6 h-6 text-orange-500" />
          </div>
          <div>
            <div className="text-2xl font-bold">{user.streak}</div>
            <div className="text-sm text-gray-400">Días racha</div>
          </div>
        </div>

        {/* Lessons completed */}
        <div className="bg-dark-card rounded-lg p-4 flex items-center gap-3">
          <div className="p-3 bg-green-500/20 rounded-lg">
            <BookOpen className="w-6 h-6 text-green-500" />
          </div>
          <div>
            <div className="text-2xl font-bold">{lessons.completed}</div>
            <div className="text-sm text-gray-400">Lecciones</div>
          </div>
        </div>

        {/* Achievements */}
        <div className="bg-dark-card rounded-lg p-4 flex items-center gap-3">
          <div className="p-3 bg-yellow-500/20 rounded-lg">
            <Award className="w-6 h-6 text-yellow-500" />
          </div>
          <div>
            <div className="text-2xl font-bold">{achievements}</div>
            <div className="text-sm text-gray-400">Logros</div>
          </div>
        </div>

        {/* Total lessons */}
        <div className="bg-dark-card rounded-lg p-4 flex items-center gap-3">
          <div className="p-3 bg-blue-500/20 rounded-lg">
            <Trophy className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <div className="text-2xl font-bold">{lessons.total}</div>
            <div className="text-sm text-gray-400">Disponibles</div>
          </div>
        </div>
      </div>

      {/* Lessons breakdown */}
      <div className="bg-dark-card rounded-lg p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          Progreso de Lecciones
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Completadas</span>
            <span className="font-semibold text-green-500">{lessons.completed}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">En progreso</span>
            <span className="font-semibold text-yellow-500">{lessons.in_progress}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Disponibles</span>
            <span className="font-semibold text-blue-500">{lessons.available}</span>
          </div>
        </div>
      </div>

      {/* Recent achievements */}
      {progress.achievements_list && progress.achievements_list.length > 0 && (
        <div className="bg-dark-card rounded-lg p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            Logros Recientes
          </h3>
          <div className="space-y-2">
            {progress.achievements_list.slice(0, 3).map((achievement: any) => (
              <div
                key={achievement.id}
                className="flex items-center gap-3 p-2 bg-dark-bg rounded-lg"
              >
                <span className="text-2xl">{achievement.icon}</span>
                <div>
                  <div className="font-medium">{achievement.name}</div>
                  <div className="text-xs text-gray-400">{achievement.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

