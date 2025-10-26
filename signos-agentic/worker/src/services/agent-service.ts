// Conversational agent service using Llama
import { Env, AgentContext, AgentResponse, ChatMessage, AGENT_SYSTEM_PROMPT } from '../types';
import { SignMatcher } from './sign-matcher';
import { LessonService } from './lesson-service';
import { UserService } from './user-service';

export class AgentService {
  private signMatcher: SignMatcher;
  private lessonService: LessonService;
  private userService: UserService;

  constructor(private env: Env) {
    this.signMatcher = new SignMatcher(env);
    this.lessonService = new LessonService(env);
    this.userService = new UserService(env);
  }

  /**
   * Process user message and generate agent response
   */
  async processMessage(userId: string, message: string, context: AgentContext): Promise<AgentResponse> {
    // Detect user intent
    const intent = await this.detectIntent(message, context);

    switch (intent.type) {
      case 'start_lesson':
        return this.handleStartLesson(userId, context);
      case 'answer_exercise':
        return this.handleExerciseAnswer(userId, message, context);
      case 'practice':
        return this.handlePractice(userId);
      case 'show_progress':
        return this.handleShowProgress(userId);
      case 'search_sign':
        return this.handleSearchSign(message);
      case 'chat':
      default:
        return this.handleChatMessage(message, context);
    }
  }

  /**
   * Detect user intent from message
   */
  private async detectIntent(message: string, context: AgentContext): Promise<{ type: string; data?: any }> {
    const lowerMsg = message.toLowerCase();

    // Check if answering an exercise
    if (context.current_lesson && context.chat_history.length > 0) {
      const lastMsg = context.chat_history[context.chat_history.length - 1];
      if (lastMsg.role === 'assistant' && lastMsg.metadata?.exercise) {
        return { type: 'answer_exercise' };
      }
    }

    // Keywords for intents
    if (lowerMsg.match(/empezar|comenzar|iniciar|lección|leccion|aprender/)) {
      return { type: 'start_lesson' };
    }

    if (lowerMsg.match(/practicar|práctica|practica|ejercicio/)) {
      return { type: 'practice' };
    }

    if (lowerMsg.match(/progreso|nivel|xp|puntos|racha/)) {
      return { type: 'show_progress' };
    }

    if (lowerMsg.match(/cómo se dice|como se dice|qué significa|que significa|mostrar seña|muestra/)) {
      return { type: 'search_sign' };
    }

    return { type: 'chat' };
  }

  /**
   * Handle starting a lesson
   */
  private async handleStartLesson(userId: string, context: AgentContext): Promise<AgentResponse> {
    const availableLessons = await this.lessonService.getAvailableLessons(userId);

    if (availableLessons.length === 0) {
      return {
        message: '¡Felicitaciones! 🎉 Has completado todas las lecciones disponibles. Puedes practicar lo aprendido escribiendo "practicar".',
        next_action: 'practice_mode',
      };
    }

    const lesson = availableLessons[0];

    // Mark lesson as in progress
    await this.userService.updateLessonProgress(userId, lesson.id, 'in_progress');

    // Generate first exercise
    const exercise = await this.lessonService.generateExercise(lesson);

    // Get signs for the exercise
    const signs = exercise.signs || [];

    return {
      message: `¡Perfecto! 🤟 Comencemos con la lección: **${lesson.title}**\n\n${lesson.description}\n\nAprenderás ${lesson.signs?.length || 0} señas nuevas. ¡Vamos!`,
      exercise,
      signs,
      next_action: 'continue_lesson',
    };
  }

  /**
   * Handle exercise answer
   */
  private async handleExerciseAnswer(userId: string, answer: string, context: AgentContext): Promise<AgentResponse> {
    const lastMsg = context.chat_history[context.chat_history.length - 1];
    const exercise = lastMsg.metadata?.exercise;

    if (!exercise) {
      return {
        message: 'No hay ejercicio activo. Escribe "empezar lección" para comenzar.',
        next_action: 'start_new_lesson',
      };
    }

    // Validate answer
    const isCorrect = this.lessonService.validateAnswer(exercise, answer);

    // Award XP
    const xpEarned = isCorrect ? 10 : 0;
    let xpResult;
    let achievementUnlocked;

    if (isCorrect) {
      xpResult = await this.userService.addXP(userId, xpEarned);
      
      // Update streak
      await this.userService.updateStreak(userId);
    }

    // Record attempt
    await this.userService.recordExerciseAttempt(
      userId,
      context.current_lesson?.id || null,
      exercise.type,
      exercise.question,
      answer,
      exercise.correct_answer,
      isCorrect,
      xpEarned
    );

    if (isCorrect) {
      // Generate next exercise or complete lesson
      const nextExercise = await this.generateNextExercise(userId, context);

      if (!nextExercise) {
        // Lesson completed
        if (context.current_lesson) {
          await this.userService.updateLessonProgress(userId, context.current_lesson.id, 'completed', 100);
        }

        return {
          message: `¡Correcto! ✅ +${xpEarned} XP\n\n🎉 ¡Lección completada! Has aprendido todas las señas.\n\n${xpResult?.level_up ? `🎊 ¡SUBISTE AL NIVEL ${xpResult.new_level}!` : ''}\n\n¿Quieres continuar con la siguiente lección? Escribe "siguiente" o "practicar" para repasar.`,
          xp_earned: xpEarned,
          level_up: xpResult?.level_up,
          next_action: 'start_new_lesson',
        };
      }

      return {
        message: `¡Correcto! ✅ +${xpEarned} XP\n\n${xpResult?.level_up ? `🎊 ¡SUBISTE AL NIVEL ${xpResult.new_level}!\n\n` : ''}Siguiente ejercicio:`,
        exercise: nextExercise,
        signs: nextExercise.signs,
        xp_earned: xpEarned,
        level_up: xpResult?.level_up,
        next_action: 'continue_lesson',
      };
    } else {
      // Wrong answer
      return {
        message: `No del todo ❌\n\nLa respuesta correcta es: **${exercise.correct_answer}**\n\n${exercise.hint || 'Intenta recordar la seña y prueba de nuevo.'}\n\n¿Quieres intentar otro ejercicio? (sí/no)`,
        next_action: 'continue_lesson',
      };
    }
  }

  /**
   * Handle practice mode
   */
  private async handlePractice(userId: string): Promise<AgentResponse> {
    try {
      const exercise = await this.lessonService.generatePracticeExercise(userId);

      return {
        message: '¡Modo práctica activado! 🎯\n\nRepasemos lo que has aprendido:',
        exercise,
        signs: exercise.signs,
        next_action: 'practice_mode',
      };
    } catch (error) {
      return {
        message: 'Aún no has completado ninguna lección. Escribe "empezar lección" para comenzar a aprender.',
        next_action: 'start_new_lesson',
      };
    }
  }

  /**
   * Handle show progress
   */
  private async handleShowProgress(userId: string): Promise<AgentResponse> {
    const user = await this.userService.getUser(userId);
    const progress = await this.userService.getUserLessonProgress(userId);
    const achievements = await this.userService.getUserAchievements(userId);

    const completed = progress.filter(p => p.status === 'completed').length;
    const inProgress = progress.filter(p => p.status === 'in_progress').length;
    const available = progress.filter(p => p.status === 'available').length;

    return {
      message: `📊 **Tu progreso**\n\n` +
        `🏆 Nivel: ${user.current_level}\n` +
        `⭐ XP: ${user.total_xp}\n` +
        `🔥 Racha: ${user.streak_days} días\n\n` +
        `📚 Lecciones:\n` +
        `✅ Completadas: ${completed}\n` +
        `📖 En progreso: ${inProgress}\n` +
        `🔓 Disponibles: ${available}\n\n` +
        `🎖️ Logros desbloqueados: ${achievements.length}\n\n` +
        `¡Sigue así! 🤟`,
      next_action: 'chat',
    };
  }

  /**
   * Handle search for a sign
   */
  private async handleSearchSign(message: string): Promise<AgentResponse> {
    // Extract search term (simple approach)
    const searchTerm = message
      .toLowerCase()
      .replace(/cómo se dice|como se dice|qué significa|que significa|mostrar|muestra|seña de/gi, '')
      .trim()
      .replace(/[¿?]/g, '');

    const signs = await this.signMatcher.findSigns(searchTerm);

    if (signs.length === 0) {
      return {
        message: `No encontré señas para "${searchTerm}" en mi base de datos. 😔\n\n¿Puedes intentar con otra palabra?`,
        next_action: 'chat',
      };
    }

    const topSign = signs[0];

    return {
      message: `Aquí está la seña para "${topSign.glosa}":\n\n📖 **Definición**: ${topSign.definition}\n\n¿Te gustaría ver más señas relacionadas?`,
      signs: [topSign],
      next_action: 'chat',
    };
  }

  /**
   * Handle general chat message
   */
  private async handleChatMessage(message: string, context: AgentContext): Promise<AgentResponse> {
    // Use Llama for conversational response
    const conversationHistory = context.chat_history
      .slice(-5) // Last 5 messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const prompt = `${AGENT_SYSTEM_PROMPT}\n\n` +
      `Usuario: ${context.user.username} (Nivel ${context.user.current_level})\n` +
      `Historial:\n${conversationHistory}\n\n` +
      `Usuario: ${message}\n\n` +
      `Responde de forma amigable y educativa. Si te preguntan sobre una seña, sugiere buscarla. Si quieren aprender, sugiere empezar una lección.`;

    try {
      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: AGENT_SYSTEM_PROMPT },
          { role: 'user', content: message },
        ],
        max_tokens: 256,
      });

      return {
        message: response.response || '¡Hola! 🤟 Soy tu asistente de LSCh. ¿En qué puedo ayudarte hoy?',
        next_action: 'chat',
      };
    } catch (error) {
      console.error('Error calling Llama:', error);
      return {
        message: '¡Hola! 🤟 Puedo ayudarte a:\n\n' +
          '📚 Aprender LSCh con lecciones interactivas (escribe "empezar lección")\n' +
          '🎯 Practicar lo aprendido (escribe "practicar")\n' +
          '🔍 Buscar señas específicas (escribe "cómo se dice X")\n' +
          '📊 Ver tu progreso (escribe "mi progreso")\n\n' +
          '¿Qué te gustaría hacer?',
        next_action: 'chat',
      };
    }
  }

  /**
   * Generate next exercise for current lesson
   */
  private async generateNextExercise(userId: string, context: AgentContext): Promise<any> {
    if (!context.current_lesson) return null;

    const progress = await this.userService.getUserLessonProgress(userId);
    const lessonProgress = progress.find(p => p.lesson_id === context.current_lesson?.id);

    // Simple: after 3 attempts, complete the lesson
    if (lessonProgress && lessonProgress.attempts >= 2) {
      return null;
    }

    return this.lessonService.generateExercise(context.current_lesson);
  }
}

