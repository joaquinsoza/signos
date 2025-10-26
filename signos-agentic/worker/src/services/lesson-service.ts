// Lesson management and exercise generation
import { Env, Lesson, Exercise, SignWithImages } from '../types';
import { SignMatcher } from './sign-matcher';

export class LessonService {
  private signMatcher: SignMatcher;

  constructor(private env: Env) {
    this.signMatcher = new SignMatcher(env);
  }

  /**
   * Get all lessons
   */
  async getAllLessons(): Promise<Lesson[]> {
    const result = await this.env.DB
      .prepare('SELECT * FROM lessons ORDER BY order_index ASC')
      .all<Lesson>();

    return result.results || [];
  }

  /**
   * Get lesson by ID
   */
  async getLesson(lessonId: string): Promise<Lesson | null> {
    const lesson = await this.env.DB
      .prepare('SELECT * FROM lessons WHERE id = ?')
      .bind(lessonId)
      .first<Lesson>();

    if (!lesson) return null;

    // Get signs for this lesson
    const signs = await this.env.DB
      .prepare('SELECT glosa FROM lesson_signs WHERE lesson_id = ? ORDER BY order_index')
      .bind(lessonId)
      .all<{ glosa: string }>();

    lesson.signs = signs.results?.map(s => s.glosa) || [];

    return lesson;
  }

  /**
   * Get available lessons for user
   */
  async getAvailableLessons(userId: string): Promise<Lesson[]> {
    const result = await this.env.DB
      .prepare(`
        SELECT l.*
        FROM lessons l
        JOIN user_lesson_progress ulp ON l.id = ulp.lesson_id
        WHERE ulp.user_id = ? AND ulp.status IN ('available', 'in_progress')
        ORDER BY l.order_index ASC
      `)
      .bind(userId)
      .all<Lesson>();

    const lessons = result.results || [];

    // Populate signs for each lesson
    for (const lesson of lessons) {
      const signs = await this.env.DB
        .prepare('SELECT glosa FROM lesson_signs WHERE lesson_id = ? ORDER BY order_index')
        .bind(lesson.id)
        .all<{ glosa: string }>();
      lesson.signs = signs.results?.map(s => s.glosa) || [];
    }

    return lessons;
  }

  /**
   * Get lesson categories
   */
  async getLessonCategories(): Promise<string[]> {
    const result = await this.env.DB
      .prepare('SELECT DISTINCT category FROM lessons ORDER BY category')
      .all<{ category: string }>();

    return result.results?.map(r => r.category) || [];
  }

  /**
   * Generate exercise for a lesson
   */
  async generateExercise(lesson: Lesson, exerciseType?: string): Promise<Exercise> {
    if (!lesson.signs || lesson.signs.length === 0) {
      throw new Error('Lesson has no signs');
    }

    // Random exercise type if not specified
    const types: Exercise['type'][] = ['matching', 'translation', 'video_to_text'];
    const type = exerciseType as Exercise['type'] || types[Math.floor(Math.random() * types.length)];

    switch (type) {
      case 'matching':
        return this.generateMatchingExercise(lesson);
      case 'translation':
        return this.generateTranslationExercise(lesson);
      case 'video_to_text':
        return this.generateVideoToTextExercise(lesson);
      default:
        return this.generateMatchingExercise(lesson);
    }
  }

  /**
   * Generate matching exercise (video to word)
   */
  private async generateMatchingExercise(lesson: Lesson): Promise<Exercise> {
    const randomGlosa = lesson.signs![Math.floor(Math.random() * lesson.signs!.length)];
    const sign = await this.signMatcher.findSignByGlosa(randomGlosa);

    if (!sign) {
      throw new Error('Sign not found in database');
    }

    // Generate wrong options from other signs in lesson
    const wrongOptions = lesson.signs!
      .filter(g => g !== randomGlosa)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    const allOptions = [randomGlosa, ...wrongOptions].sort(() => Math.random() - 0.5);

    return {
      type: 'matching',
      question: '¿Qué significa esta seña?',
      options: allOptions,
      correct_answer: randomGlosa,
      signs: [sign],
      hint: `Categoría: ${lesson.category}`,
    };
  }

  /**
   * Generate translation exercise (text to sign)
   */
  private async generateTranslationExercise(lesson: Lesson): Promise<Exercise> {
    const randomGlosa = lesson.signs![Math.floor(Math.random() * lesson.signs!.length)];
    const sign = await this.signMatcher.findSignByGlosa(randomGlosa);

    if (!sign) {
      throw new Error('Sign not found in database');
    }

    return {
      type: 'translation',
      question: `¿Cómo se dice "${randomGlosa.toLowerCase()}" en LSCh?`,
      correct_answer: randomGlosa,
      hint: 'Escribe la palabra que corresponde a la seña',
    };
  }

  /**
   * Generate video to text exercise
   */
  private async generateVideoToTextExercise(lesson: Lesson): Promise<Exercise> {
    const randomGlosa = lesson.signs![Math.floor(Math.random() * lesson.signs!.length)];
    const sign = await this.signMatcher.findSignByGlosa(randomGlosa);

    if (!sign) {
      throw new Error('Sign not found in database');
    }

    return {
      type: 'video_to_text',
      question: 'Mira el video y escribe qué significa esta seña',
      correct_answer: randomGlosa,
      signs: [sign],
      hint: 'Escribe la palabra en español',
    };
  }

  /**
   * Validate user answer
   */
  validateAnswer(exercise: Exercise, userAnswer: string): boolean {
    const normalizedCorrect = exercise.correct_answer.toLowerCase().trim();
    const normalizedUser = userAnswer.toLowerCase().trim();

    // Exact match
    if (normalizedCorrect === normalizedUser) {
      return true;
    }

    // Fuzzy match (allow minor typos)
    return this.levenshteinDistance(normalizedCorrect, normalizedUser) <= 2;
  }

  /**
   * Generate practice exercises from learned signs
   */
  async generatePracticeExercise(userId: string): Promise<Exercise> {
    // Get all completed lessons
    const completedLessons = await this.env.DB
      .prepare(`
        SELECT l.*
        FROM lessons l
        JOIN user_lesson_progress ulp ON l.id = ulp.lesson_id
        WHERE ulp.user_id = ? AND ulp.status = 'completed'
      `)
      .bind(userId)
      .all<Lesson>();

    if (!completedLessons.results || completedLessons.results.length === 0) {
      throw new Error('No completed lessons to practice');
    }

    // Pick random lesson
    const randomLesson = completedLessons.results[Math.floor(Math.random() * completedLessons.results.length)];

    // Get signs for lesson
    const lesson = await this.getLesson(randomLesson.id);
    if (!lesson) {
      throw new Error('Lesson not found');
    }

    // Generate random exercise
    return this.generateExercise(lesson);
  }

  /**
   * Calculate Levenshtein distance for fuzzy matching
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }
}

