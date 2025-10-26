// User management and progress tracking service
import { Env, User, Achievement, UserLessonProgress } from '../types';

export class UserService {
  constructor(private env: Env) {}

  /**
   * Get or create a user
   */
  async getOrCreateUser(username: string, email?: string): Promise<User> {
    // Try to get existing user
    const existing = await this.env.DB
      .prepare('SELECT * FROM users WHERE username = ?')
      .bind(username)
      .first<User>();

    if (existing) {
      // Update last active
      await this.updateLastActive(existing.id);
      return existing;
    }

    // Create new user
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    await this.env.DB
      .prepare(`
        INSERT INTO users (id, username, email, created_at, last_active, total_xp, current_level, streak_days)
        VALUES (?, ?, ?, ?, ?, 0, 1, 0)
      `)
      .bind(userId, username, email || null, now, now)
      .run();

    // Initialize first lesson as available
    await this.env.DB
      .prepare(`
        INSERT INTO user_lesson_progress (user_id, lesson_id, status)
        SELECT ?, id, 'available' FROM lessons WHERE order_index = 1
      `)
      .bind(userId)
      .run();

    return this.getUser(userId);
  }

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<User> {
    const user = await this.env.DB
      .prepare('SELECT * FROM users WHERE id = ?')
      .bind(userId)
      .first<User>();

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  /**
   * Add XP to user
   */
  async addXP(userId: string, xp: number): Promise<{ xp_earned: number; level_up: boolean; new_level: number }> {
    const user = await this.getUser(userId);
    const newXP = user.total_xp + xp;
    const newLevel = this.calculateLevel(newXP);
    const levelUp = newLevel > user.current_level;

    await this.env.DB
      .prepare('UPDATE users SET total_xp = ?, current_level = ? WHERE id = ?')
      .bind(newXP, newLevel, userId)
      .run();

    // Check for achievements
    await this.checkAndUnlockAchievements(userId);

    return {
      xp_earned: xp,
      level_up: levelUp,
      new_level: newLevel,
    };
  }

  /**
   * Update streak
   */
  async updateStreak(userId: string): Promise<number> {
    const user = await this.getUser(userId);
    const today = new Date().toISOString().split('T')[0];
    const lastStreak = user.last_streak_date;

    let newStreak = user.streak_days;

    if (!lastStreak) {
      // First time
      newStreak = 1;
    } else {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (lastStreak === yesterdayStr) {
        // Continue streak
        newStreak += 1;
      } else if (lastStreak !== today) {
        // Streak broken
        newStreak = 1;
      }
      // If lastStreak === today, keep current streak
    }

    await this.env.DB
      .prepare('UPDATE users SET streak_days = ?, last_streak_date = ? WHERE id = ?')
      .bind(newStreak, today, userId)
      .run();

    // Check for streak achievements
    await this.checkAndUnlockAchievements(userId);

    return newStreak;
  }

  /**
   * Get user progress on lessons
   */
  async getUserLessonProgress(userId: string): Promise<UserLessonProgress[]> {
    const result = await this.env.DB
      .prepare('SELECT * FROM user_lesson_progress WHERE user_id = ?')
      .bind(userId)
      .all<UserLessonProgress>();

    return result.results || [];
  }

  /**
   * Update lesson progress
   */
  async updateLessonProgress(
    userId: string,
    lessonId: string,
    status: UserLessonProgress['status'],
    score?: number
  ): Promise<void> {
    const updates: string[] = ['status = ?'];
    const bindings: any[] = [status];

    if (score !== undefined) {
      updates.push('score = ?');
      bindings.push(score);
    }

    if (status === 'completed') {
      updates.push('completed_at = ?');
      bindings.push(Date.now());
    }

    bindings.push(userId, lessonId);

    await this.env.DB
      .prepare(`
        UPDATE user_lesson_progress
        SET ${updates.join(', ')}, attempts = attempts + 1
        WHERE user_id = ? AND lesson_id = ?
      `)
      .bind(...bindings)
      .run();

    // If completed, unlock next lesson
    if (status === 'completed') {
      await this.unlockNextLesson(userId, lessonId);
    }
  }

  /**
   * Record exercise attempt
   */
  async recordExerciseAttempt(
    userId: string,
    lessonId: string | null,
    exerciseType: string,
    question: string,
    userAnswer: string,
    correctAnswer: string,
    isCorrect: boolean,
    xpEarned: number
  ): Promise<void> {
    const attemptId = `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await this.env.DB
      .prepare(`
        INSERT INTO exercise_attempts
        (id, user_id, lesson_id, exercise_type, question, user_answer, correct_answer, is_correct, xp_earned, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        attemptId,
        userId,
        lessonId,
        exerciseType,
        question,
        userAnswer,
        correctAnswer,
        isCorrect ? 1 : 0,
        xpEarned,
        Date.now()
      )
      .run();
  }

  /**
   * Get user achievements
   */
  async getUserAchievements(userId: string): Promise<Achievement[]> {
    const result = await this.env.DB
      .prepare(`
        SELECT a.*, ua.unlocked_at
        FROM achievements a
        JOIN user_achievements ua ON a.id = ua.achievement_id
        WHERE ua.user_id = ?
        ORDER BY ua.unlocked_at DESC
      `)
      .bind(userId)
      .all<Achievement>();

    return result.results || [];
  }

  /**
   * Private: Calculate level from XP
   */
  private calculateLevel(xp: number): number {
    // Simple formula: level = floor(sqrt(xp / 50)) + 1
    return Math.floor(Math.sqrt(xp / 50)) + 1;
  }

  /**
   * Private: Unlock next lesson
   */
  private async unlockNextLesson(userId: string, currentLessonId: string): Promise<void> {
    // Get current lesson order
    const lesson = await this.env.DB
      .prepare('SELECT order_index FROM lessons WHERE id = ?')
      .bind(currentLessonId)
      .first<{ order_index: number }>();

    if (!lesson) return;

    // Get next lesson
    const nextLesson = await this.env.DB
      .prepare('SELECT id FROM lessons WHERE order_index = ?')
      .bind(lesson.order_index + 1)
      .first<{ id: string }>();

    if (!nextLesson) return;

    // Check if already exists
    const existing = await this.env.DB
      .prepare('SELECT * FROM user_lesson_progress WHERE user_id = ? AND lesson_id = ?')
      .bind(userId, nextLesson.id)
      .first();

    if (!existing) {
      // Create as available
      await this.env.DB
        .prepare('INSERT INTO user_lesson_progress (user_id, lesson_id, status) VALUES (?, ?, ?)')
        .bind(userId, nextLesson.id, 'available')
        .run();
    } else {
      // Update to available if locked
      await this.env.DB
        .prepare('UPDATE user_lesson_progress SET status = ? WHERE user_id = ? AND lesson_id = ? AND status = ?')
        .bind('available', userId, nextLesson.id, 'locked')
        .run();
    }
  }

  /**
   * Private: Check and unlock achievements
   */
  private async checkAndUnlockAchievements(userId: string): Promise<Achievement | null> {
    const user = await this.getUser(userId);
    
    // Get all achievements
    const achievements = await this.env.DB
      .prepare('SELECT * FROM achievements')
      .all<Achievement>();

    for (const achievement of achievements.results || []) {
      // Check if already unlocked
      const unlocked = await this.env.DB
        .prepare('SELECT * FROM user_achievements WHERE user_id = ? AND achievement_id = ?')
        .bind(userId, achievement.id)
        .first();

      if (unlocked) continue;

      // Check requirement
      let shouldUnlock = false;

      switch (achievement.requirement_type) {
        case 'xp_total':
          shouldUnlock = user.total_xp >= achievement.requirement_value;
          break;
        case 'streak_days':
          shouldUnlock = user.streak_days >= achievement.requirement_value;
          break;
        case 'lessons_completed':
          const completed = await this.env.DB
            .prepare('SELECT COUNT(*) as count FROM user_lesson_progress WHERE user_id = ? AND status = ?')
            .bind(userId, 'completed')
            .first<{ count: number }>();
          shouldUnlock = (completed?.count || 0) >= achievement.requirement_value;
          break;
      }

      if (shouldUnlock) {
        await this.env.DB
          .prepare('INSERT INTO user_achievements (user_id, achievement_id, unlocked_at) VALUES (?, ?, ?)')
          .bind(userId, achievement.id, Date.now())
          .run();
        return achievement;
      }
    }

    return null;
  }

  /**
   * Update last active timestamp
   */
  private async updateLastActive(userId: string): Promise<void> {
    await this.env.DB
      .prepare('UPDATE users SET last_active = ? WHERE id = ?')
      .bind(Date.now(), userId)
      .run();
  }
}

