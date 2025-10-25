import type { Env, SignMatch, SignWithImages, ImageInfo } from '../types';

/**
 * SignMatcher - Translates text to sign sequences using Vectorize RAG
 * Reused from signos/worker with adaptations for video generation
 */
export class SignMatcher {
  private cache: Map<string, SignMatch[]> = new Map();
  private maxCacheSize = 500;

  constructor(
    private env: Env
  ) {}

  /**
   * Translate Spanish text to sign sequence using Vectorize RAG
   */
  async translateToSigns(text: string): Promise<SignWithImages[]> {
    if (!text.trim()) return [];

    try {
      // Check cache first
      const cached = this.cache.get(text.toLowerCase());
      if (cached) {
        console.log('[SignMatcher] Cache hit for:', text);
        return this.formatSignsForVideo(cached);
      }

      console.log('[SignMatcher] Translating:', text);

      // Step 1: Generate embedding for input text
      const embeddingResult = await this.env.AI.run('@cf/baai/bge-base-en-v1.5', {
        text: [text.toLowerCase()]
      }) as { data: number[][] };

      const queryVector = embeddingResult.data[0];

      // Step 2: Search Vectorize for similar signs
      const vectorResults = await this.env.VECTORIZE.query(queryVector, {
        topK: 15,
        returnMetadata: true
      });

      console.log(`[SignMatcher] Vectorize found ${vectorResults.matches.length} matches`);

      // Step 3: Filter by relevance score
      const relevantMatches = vectorResults.matches
        .filter(match => match.score > 0.60)
        .map(match => ({
          id: match.id,
          glosa: match.metadata.glosa as string,
          translations: match.metadata.translations as string,
          images: match.metadata.images as string,
          definition: match.metadata.definition as string,
          variant: match.metadata.variant as number,
          score: match.score
        }));

      if (relevantMatches.length === 0) {
        console.log('[SignMatcher] No relevant matches found in Vectorize');
        return [];
      }

      console.log(`[SignMatcher] Relevant matches: ${relevantMatches.map(m => `${m.glosa} (${m.score.toFixed(2)})`).join(', ')}`);

      // Step 4: Use LLM to select best signs for sentence
      const selectedSigns = await this.selectBestSigns(text, relevantMatches);

      // Cache result
      this.addToCache(text.toLowerCase(), selectedSigns);

      console.log(`[SignMatcher] ✅ Selected ${selectedSigns.length} signs: ${selectedSigns.map(s => s.glosa).join(', ')}`);

      return this.formatSignsForVideo(selectedSigns);

    } catch (error) {
      console.error('[SignMatcher] Translation error:', error);
      return [];
    }
  }

  /**
   * Use Llama to intelligently select signs from vector matches
   */
  private async selectBestSigns(
    originalText: string,
    matches: SignMatch[]
  ): Promise<SignMatch[]> {
    const matchesContext = matches.map(m =>
      `- ${m.glosa}: ${m.translations} (score: ${m.score.toFixed(2)})`
    ).join('\n');

    const prompt = `You are a Chilean Sign Language (LSCh) translator.

Input text (Spanish): "${originalText}"

Available signs from semantic search:
${matchesContext}

Task: Select the MINIMUM number of signs needed to convey the meaning. Return ONLY a JSON array of glosa names in order.

Rules:
1. Use grammatically essential signs only (skip articles like "el/la/un/una")
2. Prioritize content words (nouns, verbs, adjectives)
3. Maintain natural LSCh word order
4. Return empty array [] if no relevant signs

Output format: ["GLOSA1", "GLOSA2", ...]`;

    try {
      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: 'You are a sign language translation expert. Always respond with valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 200,
        temperature: 0.3
      }) as { response?: string };

      // Parse LLM response
      const responseText = (response.response?.trim() || '[]')
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      console.log('[SignMatcher] LLM raw response:', responseText);
      
      const selectedGlosas: string[] = JSON.parse(responseText);
      console.log('[SignMatcher] LLM selected glosas:', selectedGlosas);

      // Map selected glosas back to full sign data
      return selectedGlosas
        .map(glosa => matches.find(m => m.glosa === glosa))
        .filter((m): m is SignMatch => m !== undefined);

    } catch (error) {
      console.error('[SignMatcher] LLM selection error:', error);
      // Fallback: return top 3 matches by score
      return matches.slice(0, 3);
    }
  }

  /**
   * Format signs for video generation with parsed image info
   */
  private formatSignsForVideo(signs: SignMatch[]): SignWithImages[] {
    return signs.map(sign => {
      let images: ImageInfo[] = [];
      
      try {
        images = JSON.parse(sign.images);
      } catch (e) {
        console.error(`Failed to parse images for ${sign.glosa}:`, e);
        images = [];
      }

      return {
        glosa: sign.glosa,
        images,
        definition: sign.definition,
        confidence: sign.score,
        duration: 1500  // Default 1.5 seconds per sign
      };
    });
  }

  /**
   * Add result to cache with LRU eviction
   */
  private addToCache(key: string, signs: SignMatch[]) {
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, signs);
  }

  /**
   * Get single sign by exact glosa match
   */
  async getSignByGlosa(glosa: string): Promise<SignWithImages | null> {
    try {
      const results = await this.env.VECTORIZE.getByIds([`sign_${glosa}`]);

      if (results.length > 0) {
        const match = results[0];
        const signMatch: SignMatch = {
          id: match.id,
          glosa: match.metadata.glosa as string,
          translations: match.metadata.translations as string,
          images: match.metadata.images as string,
          definition: match.metadata.definition as string,
          variant: match.metadata.variant as number,
          score: 1.0
        };

        return this.formatSignsForVideo([signMatch])[0];
      }
    } catch (error) {
      console.error(`[SignMatcher] Error getting sign ${glosa}:`, error);
    }

    return null;
  }
}
