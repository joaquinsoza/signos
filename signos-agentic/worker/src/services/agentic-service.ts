// True Agentic Service with LLM-driven tool selection
import { Env, AgentContext, AgentResponse, ChatMessage, AGENT_SYSTEM_PROMPT, AGENTIC_TOOLS, ToolCall, ToolResult } from '../types';
import { SignMatcher } from './sign-matcher';
import { KnowledgeService } from './knowledge-service';

export class AgenticService {
  private signMatcher: SignMatcher;
  private knowledgeService: KnowledgeService;

  constructor(private env: Env) {
    this.signMatcher = new SignMatcher(env);
    this.knowledgeService = new KnowledgeService(env);
  }

  /**
   * Process message with true agentic reasoning
   * The LLM decides which tools to use and how to combine results
   */
  async processMessage(
    message: string,
    context: AgentContext
  ): Promise<AgentResponse> {
    console.log('[Agentic] Processing message:', message);

    // Build conversation history for context
    const messages = this.buildConversationHistory(context, message);

    try {
      // Step 1: Let the LLM reason and decide which tools to use
      const reasoning = await this.llmReasoning(messages);
      
      console.log('[Agentic] LLM Reasoning:', reasoning.thought);
      console.log('[Agentic] Tool calls:', reasoning.tool_calls);

      // Step 2: Execute tool calls if any
      const toolResults: ToolResult[] = [];
      if (reasoning.tool_calls && reasoning.tool_calls.length > 0) {
        for (const toolCall of reasoning.tool_calls) {
          const result = await this.executeTool(toolCall);
          toolResults.push(result);
        }
      }

      // Step 3: Generate final response with tool results
      const finalResponse = await this.generateFinalResponse(
        messages,
        reasoning,
        toolResults
      );

      console.log('[Agentic] Final response generated');

      return {
        message: finalResponse,
        signs: this.extractSignsFromResults(toolResults),
        reasoning: reasoning.thought,
        tools_used: reasoning.tool_calls?.map(tc => tc.name) || [],
        next_action: 'chat',
      };
    } catch (error) {
      console.error('[Agentic] Error:', error);
      return {
        message: 'Lo siento, tuve un problema procesando tu mensaje. ¿Podrías intentar de nuevo? 🤔',
        next_action: 'chat',
      };
    }
  }

  /**
   * Build conversation history for LLM context
   */
  private buildConversationHistory(context: AgentContext, newMessage: string): any[] {
    const messages: any[] = [
      {
        role: 'system',
        content: AGENT_SYSTEM_PROMPT,
      },
    ];

    // Add recent chat history (last 5 messages for context)
    const recentHistory = context.chat_history.slice(-5);
    for (const msg of recentHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    // Add current message
    messages.push({
      role: 'user',
      content: newMessage,
    });

    return messages;
  }

  /**
   * Let the LLM reason about the query and decide which tools to use
   */
  private async llmReasoning(messages: any[]): Promise<{
    thought: string;
    tool_calls?: ToolCall[];
  }> {
    // Create a reasoning prompt
    const reasoningPrompt = `Analiza el último mensaje del usuario y decide:
1. ¿Qué está pidiendo el usuario?
2. ¿Qué herramientas necesitas usar? (buscar_sena, buscar_conocimiento, buscar_multiples_senas, o ninguna)
3. ¿Qué argumentos pasarle a cada herramienta?

Herramientas disponibles:
${JSON.stringify(AGENTIC_TOOLS, null, 2)}

Responde en formato JSON:
{
  "thought": "tu razonamiento sobre qué hacer",
  "tool_calls": [
    {"name": "nombre_herramienta", "arguments": {"param": "valor"}}
  ]
}

Si no necesitas herramientas, deja tool_calls como array vacío.`;

    const reasoningMessages = [
      ...messages,
      {
        role: 'system',
        content: reasoningPrompt,
      },
    ];

    try {
      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: reasoningMessages,
        max_tokens: 500,
        temperature: 0.3, // Lower temperature for more focused reasoning
      });

      const responseText = this.extractTextFromAIResponse(response);
      console.log('[Agentic] Raw LLM reasoning:', responseText);

      // Parse JSON response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed;
      }

      // Fallback: try to detect tool needs from text
      return this.fallbackToolDetection(messages[messages.length - 1].content);
    } catch (error) {
      console.error('[Agentic] Error in reasoning:', error);
      return this.fallbackToolDetection(messages[messages.length - 1].content);
    }
  }

  /**
   * Fallback tool detection using patterns (when LLM reasoning fails)
   */
  private fallbackToolDetection(message: string): {
    thought: string;
    tool_calls?: ToolCall[];
  } {
    const lowerMsg = message.toLowerCase();
    const tool_calls: ToolCall[] = [];

    // Check for sign lookup
    const signPatterns = [
      /(?:cómo|como)\s+se\s+dice\s+["']?(\w+)["']?/,
      /seña\s+(?:de|para)\s+["']?(\w+)["']?/,
    ];

    for (const pattern of signPatterns) {
      const match = lowerMsg.match(pattern);
      if (match) {
        tool_calls.push({
          name: 'buscar_sena',
          arguments: { palabra: match[1] },
        });
        break;
      }
    }

    // Check for knowledge query
    const knowledgeKeywords = [
      'historia',
      'cultura',
      'gramática',
      'qué es',
      'cómo funciona',
      'explica',
      'organizaciones',
      'aprender',
    ];

    if (knowledgeKeywords.some(kw => lowerMsg.includes(kw)) && tool_calls.length === 0) {
      tool_calls.push({
        name: 'buscar_conocimiento',
        arguments: { query: message },
      });
    }

    return {
      thought: 'Fallback detection based on patterns',
      tool_calls: tool_calls.length > 0 ? tool_calls : undefined,
    };
  }

  /**
   * Execute a tool call
   */
  private async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    console.log(`[Agentic] Executing tool: ${toolCall.name}`, toolCall.arguments);

    try {
      switch (toolCall.name) {
        case 'buscar_sena':
          return await this.toolBuscarSena(toolCall.arguments.palabra);

        case 'buscar_conocimiento':
          return await this.toolBuscarConocimiento(toolCall.arguments.query);

        case 'buscar_multiples_senas':
          return await this.toolBuscarMultiplesSenas(toolCall.arguments.palabras);

        default:
          return {
            tool: toolCall.name,
            success: false,
            error: `Unknown tool: ${toolCall.name}`,
            result: null,
          };
      }
    } catch (error) {
      console.error(`[Agentic] Tool execution error:`, error);
      return {
        tool: toolCall.name,
        success: false,
        error: String(error),
        result: null,
      };
    }
  }

  /**
   * Tool: Search for a single sign with glossary enrichment
   */
  private async toolBuscarSena(palabra: string): Promise<ToolResult> {
    // 1. Find the sign (images + basic definition)
    const signs = await this.signMatcher.findSigns(palabra);
    
    if (signs.length === 0) {
      return {
        tool: 'buscar_sena',
        success: false,
        result: null,
      };
    }

    const sign = signs[0];

    // 2. Enrich with glossary definition from Knowledge RAG
    try {
      const glossaryResults = await this.knowledgeService.searchKnowledge(
        `definición de ${palabra} señas`
      );

      // Add glossary context if found
      const enrichedSign = {
        ...sign,
        glossary: glossaryResults.length > 0 ? glossaryResults[0] : null,
      };

      console.log(`[Agentic] Enriched sign "${palabra}" with glossary`);

      return {
        tool: 'buscar_sena',
        success: true,
        result: enrichedSign,
      };
    } catch (error) {
      // If glossary lookup fails, return sign without enrichment
      console.warn(`[Agentic] Glossary enrichment failed for "${palabra}":`, error);
      return {
        tool: 'buscar_sena',
        success: true,
        result: sign,
      };
    }
  }

  /**
   * Tool: Search knowledge base
   */
  private async toolBuscarConocimiento(query: string): Promise<ToolResult> {
    const results = await this.knowledgeService.searchKnowledge(query);
    
    return {
      tool: 'buscar_conocimiento',
      success: results.length > 0,
      result: results,
    };
  }

  /**
   * Tool: Search multiple signs with glossary enrichment
   */
  private async toolBuscarMultiplesSenas(palabras: string[]): Promise<ToolResult> {
    const signs = await this.signMatcher.findSignsByGlosas(palabras);
    
    if (signs.length === 0) {
      return {
        tool: 'buscar_multiples_senas',
        success: false,
        result: [],
      };
    }

    // Enrich each sign with glossary (in parallel for efficiency)
    try {
      const enrichedSigns = await Promise.all(
        signs.map(async (sign) => {
          try {
            const glossaryResults = await this.knowledgeService.searchKnowledge(
              `definición de ${sign.glosa} señas`
            );
            return {
              ...sign,
              glossary: glossaryResults.length > 0 ? glossaryResults[0] : null,
            };
          } catch {
            return sign; // Return without enrichment if fails
          }
        })
      );

      console.log(`[Agentic] Enriched ${enrichedSigns.length} signs with glossary`);

      return {
        tool: 'buscar_multiples_senas',
        success: true,
        result: enrichedSigns,
      };
    } catch (error) {
      console.warn('[Agentic] Glossary enrichment failed for multiple signs:', error);
      return {
        tool: 'buscar_multiples_senas',
        success: true,
        result: signs,
      };
    }
  }

  /**
   * Generate final response with tool results
   */
  private async generateFinalResponse(
    messages: any[],
    reasoning: { thought: string; tool_calls?: ToolCall[] },
    toolResults: ToolResult[]
  ): Promise<string> {
    // Build context with tool results
    let toolContext = '';
    
    if (toolResults.length > 0) {
      toolContext = '\n\nResultados de herramientas:\n';
      for (const result of toolResults) {
        if (result.success) {
          toolContext += `\n${result.tool}: ${JSON.stringify(result.result, null, 2)}\n`;
        } else {
          toolContext += `\n${result.tool}: Error - ${result.error}\n`;
        }
      }
    }

    const finalMessages = [
      ...messages,
      {
        role: 'system',
        content: `Genera una respuesta natural y útil para el usuario usando los resultados de las herramientas.${toolContext}

IMPORTANTE:
- NO menciones que usaste herramientas
- Responde naturalmente como si tú tuvieras la información
- Si hay señas, descríbelas con entusiasmo
- Si hay conocimiento educativo, explícalo claramente
- Usa emojis apropiados: 🤟 👍 📚 💡
- Si no encontraste resultados, sugiere alternativas o pregunta para aclarar`,
      },
    ];

    const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: finalMessages,
      max_tokens: 800,
      temperature: 0.7,
    });

    return this.extractTextFromAIResponse(response);
  }

  /**
   * Extract signs from tool results
   */
  private extractSignsFromResults(toolResults: ToolResult[]): any[] | undefined {
    const signs: any[] = [];

    for (const result of toolResults) {
      if (result.success && result.tool.includes('sena')) {
        if (Array.isArray(result.result)) {
          signs.push(...result.result);
        } else if (result.result) {
          signs.push(result.result);
        }
      }
    }

    return signs.length > 0 ? signs : undefined;
  }

  /**
   * Extract text from Workers AI response
   */
  private extractTextFromAIResponse(response: any): string {
    if (typeof response === 'string') return response;
    if (response.response) return response.response;
    if (response.result?.response) return response.result.response;
    if (response.choices?.[0]?.message?.content) return response.choices[0].message.content;
    return JSON.stringify(response);
  }
}

