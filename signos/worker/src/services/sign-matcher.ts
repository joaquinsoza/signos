/**
 * SignMatcher - RAG-based Sign Language Translation Service
 * Uses Cloudflare Vectorize for semantic search and Llama for intelligent selection
 */

import type { Env, SignMatch } from '../types';
import { SignCache } from './sign-cache';

export class SignMatcher {
	private cache: SignCache;

	constructor(
		private env: Env,
		private ai: Ai
	) {
		this.cache = new SignCache();
	}

	/**
	 * Translate Spanish text to sign sequence using Vectorize RAG
	 */
	async translateToSigns(text: string): Promise<SignMatch[]> {
		if (!text.trim()) return [];

		// Check cache first
		const cached = this.cache.get(text);
		if (cached) {
			console.log('[SignMatcher] Cache hit for:', text);
			return cached;
		}

		try {
			// Step 1: Generate embedding for input text
			const embeddingResult = await this.ai.run('@cf/baai/bge-base-en-v1.5', {
				text: [text.toLowerCase()],
			});

			const queryVector = embeddingResult.data[0];

			// Step 2: Search Vectorize for similar signs
			const vectorResults = await this.env.VECTORIZE.query(queryVector, {
				topK: 15,
				returnMetadata: true,
			});

			console.log(`[SignMatcher] Vectorize found ${vectorResults.matches.length} matches for: "${text}"`);

			// Step 3: Filter by relevance score
			const relevantMatches = vectorResults.matches
				.filter((match) => match.score > 0.60) // Lower threshold for better recall
				.map((match) => ({
					id: match.id,
					glosa: match.metadata.glosa as string,
					translations: match.metadata.translations as string,
					images: match.metadata.images as string,
					definition: match.metadata.definition as string,
					variant: match.metadata.variant as number,
					score: match.score,
				}));

			if (relevantMatches.length === 0) {
				console.log('[SignMatcher] No relevant matches found');
				return [];
			}

			console.log(
				'[SignMatcher] Relevant matches:',
				relevantMatches.map((m) => `${m.glosa} (${m.score.toFixed(2)})`).join(', ')
			);

			// Step 4: Use LLM to select best signs for sentence
			const selectedSigns = await this.selectBestSigns(text, relevantMatches);

			// Cache the result
			this.cache.set(text, selectedSigns);

			return selectedSigns;
		} catch (error) {
			console.error('[SignMatcher] Translation error:', error);
			return [];
		}
	}

	/**
	 * Use Llama to intelligently select signs from vector matches
	 */
	private async selectBestSigns(originalText: string, matches: SignMatch[]): Promise<SignMatch[]> {
		const matchesContext = matches
			.map((m) => `- ${m.glosa}: ${m.translations} (score: ${m.score.toFixed(2)})`)
			.join('\n');

		const prompt = `You are a Chilean Sign Language (LSCh) translator.

Input text (Spanish): "${originalText}"

Available signs from semantic search:
${matchesContext}

Task: Select the MINIMUM number of signs needed to convey the meaning. Return ONLY a JSON array of glosa names in order.

Rules:
1. Use grammatically essential signs only (skip articles like "el/la/un/una")
2. Prioritize content words (nouns, verbs, adjectives)
3. Maintain natural LSCh word order (often different from Spanish)
4. Return empty array [] if no relevant signs
5. Maximum 5 signs per sentence

Output format: ["GLOSA1", "GLOSA2", ...]`;

		try {
			const response = await this.ai.run('@cf/meta/llama-3.1-8b-instruct', {
				messages: [
					{
						role: 'system',
						content: 'You are a sign language translation expert. Always respond with valid JSON only.',
					},
					{ role: 'user', content: prompt },
				],
				max_tokens: 200,
				temperature: 0.3,
			});

			// Parse LLM response
			const responseText = response.response?.trim() || '[]';
			console.log('[SignMatcher] LLM raw response:', responseText);

			// Extract JSON from response (handles markdown code blocks)
			const jsonMatch = responseText.match(/\[[\s\S]*\]/);
			const jsonStr = jsonMatch ? jsonMatch[0] : responseText;

			const selectedGlosas: string[] = JSON.parse(jsonStr);

			console.log('[SignMatcher] LLM selected glosas:', selectedGlosas);

			// Map selected glosas back to full sign data
			const selectedSigns = selectedGlosas
				.map((glosa) => matches.find((m) => m.glosa.toUpperCase() === glosa.toUpperCase()))
				.filter((m): m is SignMatch => m !== undefined);

			return selectedSigns;
		} catch (error) {
			console.error('[SignMatcher] LLM selection error:', error);
			// Fallback: return top 3 matches by score
			console.log('[SignMatcher] Falling back to top 3 matches');
			return matches.slice(0, 3);
		}
	}

	/**
	 * Get single sign by exact glosa match (for common words)
	 */
	async getSignByGlosa(glosa: string): Promise<SignMatch | null> {
		try {
			const results = await this.env.VECTORIZE.getByIds([`sign_${glosa.toLowerCase()}`]);

			if (results.length > 0) {
				const match = results[0];
				return {
					id: match.id,
					glosa: match.metadata.glosa as string,
					translations: match.metadata.translations as string,
					images: match.metadata.images as string,
					definition: match.metadata.definition as string,
					variant: match.metadata.variant as number,
					score: 1.0,
				};
			}

			return null;
		} catch (error) {
			console.error('[SignMatcher] getSignByGlosa error:', error);
			return null;
		}
	}
}
