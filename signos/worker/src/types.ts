/**
 * Signos Worker - Type Definitions
 */

// ========================================
// Environment & Bindings
// ========================================

export interface Env {
	AI: Ai;
	VECTORIZE: VectorizeIndex;
	SESSION_STORE?: KVNamespace;
	MOCK_MODE?: string;
	CF_ACCOUNT: string;
	CF_API_TOKEN: string;
}

// ========================================
// WebSocket Messages (Client ↔ Worker)
// ========================================

export interface TranscriptMessage {
	type: 'transcript';
	text: string;
	is_final: boolean;
	timestamp: number;
	latency_ms?: number;
	language?: string;
}

export interface SignsMessage {
	type: 'signs';
	text: string; // Original transcript
	signs: SignInfo[];
	timestamp: number;
}

export interface StatsMessage {
	type: 'stats';
	bytes_received: number;
	chunks_processed: number;
	avg_latency_ms: number;
	timestamp: number;
}

export interface ErrorMessage {
	type: 'error';
	error: string;
	timestamp: number;
}

export type ClientMessage = TranscriptMessage | SignsMessage | StatsMessage | ErrorMessage;

// ========================================
// Sign Data Structures
// ========================================

export interface SignMatch {
	id: string;
	glosa: string;
	translations: string; // Comma-separated
	images: string; // JSON string of image array
	definition: string;
	variant: number;
	score: number;
}

export interface SignInfo {
	glosa: string;
	images: ImagePath[];
	definition: string;
	confidence: number;
}

export interface ImagePath {
	path: string;
	sequence: number;
}

// ========================================
// nova-3 Response Types
// ========================================

export interface Nova3Response {
	type: string;
	channel?: {
		alternatives?: Array<{
			transcript: string;
			confidence?: number;
		}>;
	};
	speech_final?: boolean;
	is_final?: boolean;
}
