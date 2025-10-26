// Service to find and match signs using Vectorize RAG
import { Env, SignWithImages, VectorizeMatches } from '../types';

export class SignMatcher {
  constructor(private env: Env) {}

  /**
   * Find signs for a given text using Vectorize semantic search
   */
  async findSigns(text: string): Promise<SignWithImages[]> {
    try {
      // Check if Vectorize is available
      if (!this.env.VECTORIZE) {
        console.warn('[SignMatcher] Vectorize not available');
        return [];
      }

      // Get embedding for the search text
      const embedding = await this.getEmbedding(text);
      
      console.log(`[SignMatcher] Searching for: "${text}"`);
      
      // Query Vectorize
      const results = await this.env.VECTORIZE.query(embedding, {
        topK: 10,
        returnValues: true,
        returnMetadata: 'all',
      });

      console.log(`[SignMatcher] Found ${results.matches.length} matches`);
      if (results.matches.length > 0) {
        console.log(`[SignMatcher] Top match: "${results.matches[0].metadata?.glosa}" (score: ${results.matches[0].score})`);
      }

      // Parse results
      return this.parseVectorizeResults(results);
    } catch (error) {
      console.error('Error finding signs:', error);
      return [];
    }
  }

  /**
   * Find a specific sign by glosa
   */
  async findSignByGlosa(glosa: string): Promise<SignWithImages | null> {
    const signs = await this.findSigns(glosa);
    return signs.find(s => s.glosa.toLowerCase() === glosa.toLowerCase()) || null;
  }

  /**
   * Find multiple signs by glosas
   */
  async findSignsByGlosas(glosas: string[]): Promise<SignWithImages[]> {
    const results: SignWithImages[] = [];
    
    for (const glosa of glosas) {
      const sign = await this.findSignByGlosa(glosa);
      if (sign) {
        results.push(sign);
      }
    }
    
    return results;
  }

  /**
   * Get signs for a complete phrase
   */
  async translatePhrase(phrase: string): Promise<SignWithImages[]> {
    // Split phrase into words
    const words = phrase
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 0);

    const signs: SignWithImages[] = [];

    for (const word of words) {
      const wordSigns = await this.findSigns(word);
      if (wordSigns.length > 0) {
        // Take the best match
        signs.push(wordSigns[0]);
      }
    }

    return signs;
  }

  /**
   * Get random signs from a category
   */
  async getRandomSignsFromCategory(category: string, count: number = 5): Promise<SignWithImages[]> {
    // Use category as search term
    const signs = await this.findSigns(category);
    
    // Shuffle and take count
    const shuffled = signs.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /**
   * Generate embedding for text
   */
  private async getEmbedding(text: string): Promise<number[]> {
    try {
      const response: any = await this.env.AI.run('@cf/baai/bge-base-en-v1.5', {
        text: [text],
      });

      console.log('[SignMatcher] Embedding response type:', typeof response, Array.isArray(response));

      // Workers AI returns the embeddings in different formats depending on the model
      if (response && response.data && Array.isArray(response.data) && response.data.length > 0) {
        return response.data[0];
      } else if (Array.isArray(response) && response.length > 0) {
        return response[0];
      } else if (response && typeof response === 'object' && 'shape' in response && 'data' in response) {
        // Handle tensor format
        return response.data;
      } else {
        console.error('[SignMatcher] Unexpected embedding response:', JSON.stringify(response).substring(0, 200));
        throw new Error('Unexpected embedding response format');
      }
    } catch (error) {
      console.error('[SignMatcher] Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * Parse Vectorize results into SignWithImages
   */
  private parseVectorizeResults(results: VectorizeMatches): SignWithImages[] {
    return results.matches
      .filter(match => match.metadata)
      .map(match => {
        const metadata = match.metadata!;
        
        // Parse images JSON
        let images = [];
        try {
          images = JSON.parse(metadata.images);
        } catch (e) {
          console.error('Error parsing images:', e);
          images = [];
        }

        return {
          glosa: metadata.glosa,
          definition: metadata.definition || '',
          images: images,
          confidence: match.score,
        };
      });
  }
}

