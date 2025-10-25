/**
 * SignCache - In-memory LRU cache for sign translations
 * Improves performance by caching common phrases
 */

import type { SignMatch } from '../types';

export class SignCache {
	private cache: Map<string, SignMatch[]> = new Map();
	private maxSize: number = 500;

	set(query: string, signs: SignMatch[]): void {
		const key = query.toLowerCase().trim();

		// Simple LRU: remove oldest entry if at capacity
		if (this.cache.size >= this.maxSize) {
			const firstKey = this.cache.keys().next().value;
			this.cache.delete(firstKey);
		}

		this.cache.set(key, signs);
	}

	get(query: string): SignMatch[] | null {
		const key = query.toLowerCase().trim();
		return this.cache.get(key) || null;
	}

	clear(): void {
		this.cache.clear();
	}

	size(): number {
		return this.cache.size;
	}
}
