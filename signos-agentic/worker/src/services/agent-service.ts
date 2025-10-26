// Conversational agent service using Llama
import { Env, AgentContext, AgentResponse, ChatMessage, AGENT_SYSTEM_PROMPT } from '../types';
import { SignMatcher } from './sign-matcher';
import { LessonService } from './lesson-service';
import { UserService } from './user-service';
import { KnowledgeService } from './knowledge-service';

export class AgentService {
  private signMatcher: SignMatcher;
  private lessonService: LessonService;
  private userService: UserService;
  private knowledgeService: KnowledgeService;

  constructor(private env: Env) {
    this.signMatcher = new SignMatcher(env);
    this.lessonService = new LessonService(env);
    this.userService = new UserService(env);
    this.knowledgeService = new KnowledgeService(env);
  }

  /**
   * Process user message and generate agent response
   */
  async processMessage(userId: string, message: string, context: AgentContext): Promise<AgentResponse> {
    // Detect user intent
    const intent = await this.detectIntent(message, context);

    switch (intent.type) {
      case 'search_sign':
        return this.handleSearchSign(intent.data?.query || message);
      case 'knowledge_query':
        return this.handleKnowledgeQuery(intent.data?.query || message);
      case 'hybrid_query':
        return this.handleHybridQuery(intent.data?.signQuery || '', intent.data?.query || message);
      case 'chat':
      default:
        return this.handleChatMessage(message, context);
    }
  }

  /**
   * Detect user intent from message using intelligent classification
   */
  private async detectIntent(message: string, context: AgentContext): Promise<{ type: string; data?: any }> {
    const lowerMsg = message.toLowerCase();

    // Intelligent RAG selection
    const ragIntent = await this.classifyRAGIntent(lowerMsg);
    
    if (ragIntent.type === 'sign_lookup') {
      return { type: 'search_sign', data: { query: ragIntent.query } };
    }
    
    if (ragIntent.type === 'knowledge') {
      return { type: 'knowledge_query', data: { query: ragIntent.query } };
    }
    
    if (ragIntent.type === 'hybrid') {
      return { type: 'hybrid_query', data: { query: ragIntent.query, signQuery: ragIntent.signQuery } };
    }

    return { type: 'chat' };
  }

  /**
   * Classify which RAG(s) to use based on the query
   */
  private async classifyRAGIntent(message: string): Promise<{
    type: 'sign_lookup' | 'knowledge' | 'hybrid' | 'none';
    query?: string;
    signQuery?: string;
  }> {
    // Pattern 1: Clear sign lookup requests
    // "¿Cómo se dice agua?", "Muestra la seña de hola", "qué significa esta seña"
    const signLookupPatterns = [
      /(?:cómo|como)\s+se\s+dice\s+["']?(\w+)["']?/,
      /(?:cuál|cual)\s+es\s+(?:la\s+)?seña\s+(?:de|para)\s+["']?(\w+)["']?/,
      /mostrar\s+(?:la\s+)?seña\s+(?:de|para)\s+["']?(\w+)["']?/,
      /seña\s+(?:de|para)\s+["']?(\w+)["']?/,
      /señar?\s+["']?(\w+)["']?/,
    ];

    for (const pattern of signLookupPatterns) {
      const match = message.match(pattern);
      if (match) {
        return {
          type: 'sign_lookup',
          query: match[1] || match[0],
        };
      }
    }

    // Pattern 2: Educational/theoretical questions (Knowledge RAG)
    // "¿Qué es la cultura sorda?", "¿Cómo funciona la gramática?", "historia de LSCh"
    const knowledgePatterns = [
      /(?:qué|que)\s+es\s+(?:la|el|los|las)\s+/,
      /(?:cuál|cual)\s+es\s+(?:la|el)\s+(?:historia|origen|diferencia)/,
      /(?:cómo|como)\s+funciona\s+(?:la|el)/,
      /(?:por\s+qué|porque|por\s+que)\s+/,
      /explica(?:me)?\s+/,
      /dame\s+información\s+sobre/,
      /cuéntame\s+sobre/,
      /\b(historia|cultura|gramática|gramatica|origen|diferencia|características|caracteristicas)\b/,
      /\b(expresión|expresion)\s+facial/,
      /\b(dactilología|dactilologia|alfabeto\s+manual)/,
      /\b(comunidad\s+sorda|sordo)/,
      /\b(consejo|tip|recomendación|recomendacion)/,
    ];

    for (const pattern of knowledgePatterns) {
      if (pattern.test(message)) {
        return {
          type: 'knowledge',
          query: message,
        };
      }
    }

    // Pattern 3: Hybrid queries (both RAGs)
    // "¿Cómo se dice agua y qué importancia tiene?", "Muéstrame hola y explica su uso"
    const hybridPatterns = [
      /(?:cómo|como)\s+se\s+dice\s+(\w+).+(?:qué|que|explica|significa|importancia|contexto)/,
      /mostrar\s+(\w+).+(?:y|también|además).+(?:explica|información|sobre)/,
      /seña\s+de\s+(\w+).+(?:y|también).+(?:cuándo|cuando|cómo|como|por\s+qué)/,
    ];

    for (const pattern of hybridPatterns) {
      const match = message.match(pattern);
      if (match) {
        return {
          type: 'hybrid',
          query: message,
          signQuery: match[1],
        };
      }
    }

    // If mentions specific words that are likely signs + asks about them
    const words = message.split(/\s+/);
    const hasSignWord = words.some(word => 
      word.length > 3 && 
      !/^(cómo|como|qué|que|cual|cuál|para|con|sin|por|porque|es|la|el|los|las|un|una)$/i.test(word)
    );

    const hasQuestionWord = /(?:qué|que|cómo|como|cuál|cual|por\s+qué|porque)/i.test(message);

    if (hasSignWord && hasQuestionWord) {
      // Check if it's more about the sign itself or about theory
      const isSignQuery = /(?:se\s+dice|seña|significa|mostrar|muestra)/i.test(message);
      
      if (isSignQuery) {
        return { type: 'sign_lookup', query: message };
      } else {
        return { type: 'knowledge', query: message };
      }
    }

    return { type: 'none' };
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
   * Handle search for a sign (SignMatcher RAG)
   */
  private async handleSearchSign(query: string): Promise<AgentResponse> {
    // Extract search term
    const searchTerm = query
      .toLowerCase()
      .replace(/cómo se dice|como se dice|qué significa|que significa|cuál es la seña|cual es la sena|mostrar|muestra|seña de|sena de/gi, '')
      .trim()
      .replace(/[¿?¡!]/g, '');

    const signs = await this.signMatcher.findSigns(searchTerm);

    if (signs.length === 0) {
      return {
        message: `No encontré la seña para **"${searchTerm}"** en mi base de datos. 😔\n\n` +
          `💡 Tips:\n` +
          `- Intenta con una palabra similar\n` +
          `- Verifica la ortografía\n` +
          `- Prueba con sinónimos\n\n` +
          `O pregúntame: "¿Qué señas hay sobre [tema]?"`,
        next_action: 'chat',
      };
    }

    const topSign = signs[0];
    const confidence = Math.round(topSign.confidence * 100);

    let response = `🤟 **Seña: ${topSign.glosa}**\n\n`;
    response += `📖 **Definición**: ${topSign.definition}\n`;
    response += `🎯 **Confianza**: ${confidence}%\n\n`;

    if (signs.length > 1) {
      response += `💡 **Señas relacionadas**:\n`;
      signs.slice(1, 4).forEach((sign, i) => {
        response += `${i + 1}. ${sign.glosa} (${Math.round(sign.confidence * 100)}%)\n`;
      });
      response += `\n`;
    }

    response += `¿Quieres ver otra seña o aprender más sobre esta? 🤟`;

    return {
      message: response,
      signs: [topSign],
      next_action: 'chat',
    };
  }

  /**
   * Handle knowledge query (educational questions - Knowledge RAG)
   */
  private async handleKnowledgeQuery(message: string): Promise<AgentResponse> {
    // Search knowledge base
    const articles = await this.knowledgeService.searchKnowledge(message);

    if (articles.length === 0) {
      return {
        message: 'No encontré información sobre eso en mi base de conocimientos. 🤔\n\n' +
          '💡 Puedo ayudarte con:\n' +
          '- Historia de LSCh\n' +
          '- Gramática y estructura\n' +
          '- Cultura sorda\n' +
          '- Expresiones faciales\n' +
          '- Diferencias entre lenguas de señas\n' +
          '- Consejos de aprendizaje\n\n' +
          '¿Sobre qué te gustaría saber?',
        next_action: 'chat',
      };
    }

    // Format response with the most relevant article
    const topArticle = articles[0];
    const relevance = Math.round(topArticle.confidence * 100);
    
    let response = `📚 **${topArticle.title}**\n`;
    if (relevance < 100) {
      response += `🎯 Relevancia: ${relevance}%\n`;
    }
    response += `\n${topArticle.content}`;

    // Add related topics if multiple results
    if (articles.length > 1) {
      response += `\n\n💡 **También podrías estar interesado en:**\n`;
      articles.slice(1, 4).forEach((article, index) => {
        response += `${index + 1}. ${article.title}\n`;
      });
      response += `\nPregúntame sobre cualquiera de estos temas.`;
    }

    response += `\n\n¿Tienes más preguntas? 🤟`;

    return {
      message: response,
      next_action: 'chat',
    };
  }

  /**
   * Handle hybrid query (both RAGs - sign + context)
   */
  private async handleHybridQuery(signQuery: string, fullQuery: string): Promise<AgentResponse> {
    // Get sign from SignMatcher RAG
    const signs = await this.signMatcher.findSigns(signQuery);
    
    // Get educational context from Knowledge RAG
    const articles = await this.knowledgeService.searchKnowledge(fullQuery);

    let response = '';
    let responseSign = null;

    // Part 1: Show the sign
    if (signs.length > 0) {
      const topSign = signs[0];
      responseSign = topSign;
      const confidence = Math.round(topSign.confidence * 100);

      response += `🤟 **Seña: ${topSign.glosa}**\n\n`;
      response += `📖 **Definición**: ${topSign.definition}\n`;
      response += `🎯 **Confianza**: ${confidence}%\n\n`;
    } else {
      response += `⚠️ No encontré la seña específica para "${signQuery}", pero te puedo dar contexto educativo:\n\n`;
    }

    // Part 2: Add educational context
    if (articles.length > 0) {
      const topArticle = articles[0];
      
      response += `📚 **Contexto Educativo**: ${topArticle.title}\n\n`;
      
      // Extract most relevant paragraph (first 500 chars)
      const excerpt = topArticle.content.length > 500 
        ? topArticle.content.substring(0, 500) + '...' 
        : topArticle.content;
      
      response += `${excerpt}\n\n`;
      
      if (topArticle.content.length > 500) {
        response += `💡 *Hay más información disponible. Pregúntame: "${topArticle.title}"*\n\n`;
      }
    }

    response += `¿Quieres saber más sobre la seña o sobre el tema? 🤟`;

    return {
      message: response,
      signs: responseSign ? [responseSign] : undefined,
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

