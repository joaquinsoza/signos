/**
 * Signos STT Worker - TypeScript Implementation
 * Real-time Speech-to-Text using Cloudflare Workers AI (nova-3)
 *
 * nova-3 is Deepgram's multilingual speech recognition model
 * with support for Spanish and language detection via WebSocket streaming.
 */

interface Env {
	AI: Ai;
	SESSION_STORE?: KVNamespace;
	MOCK_MODE?: string;
	CF_ACCOUNT: string;
	CF_API_TOKEN: string;
}

interface TranscriptMessage {
	type: 'transcript';
	text: string;
	is_final: boolean;
	timestamp: number;
	latency_ms?: number;
	language?: string;
}

interface StatsMessage {
	type: 'stats';
	bytes_received: number;
	chunks_processed: number;
	avg_latency_ms: number;
	timestamp: number;
}

interface ErrorMessage {
	type: 'error';
	error: string;
	timestamp: number;
}

type ClientMessage = TranscriptMessage | StatsMessage | ErrorMessage;

/**
 * Mock STT for testing when AI is unavailable
 */
function mockTranscribe(): string {
	const mockPhrases = [
		'Hola, ¿cómo estás?',
		'Todo bien, gracias por preguntar.',
		'Este es un sistema de transcripción en tiempo real.',
		'Funciona muy bien con español chileno.',
		'La tecnología es increíble.',
	];
	return mockPhrases[Math.floor(Math.random() * mockPhrases.length)];
}

/**
 * Handle WebSocket connection with nova-3 WebSocket streaming
 * Uses direct fetch() to Cloudflare AI API for true WebSocket streaming
 */
async function handleWebSocket(
	clientWs: WebSocket,
	serverWs: WebSocket,
	env: Env
): Promise<void> {
	const useMock = env.MOCK_MODE === 'true';

	console.log(`New WebSocket connection (mock_mode: ${useMock})`);

	serverWs.accept();

	if (useMock) {
		// Mock mode: Simple passthrough with fake transcriptions
		handleMockMode(clientWs, serverWs);
		return;
	}

	// Real mode: Connect to nova-3 via WebSocket
	try {
		// Build nova-3 WebSocket URL with parameters
		// NOTE: Nova-3 WebSocket only supports language=multi or language=en
		// Use 'multi' for Spanish - it enables multilingual code-switching
		const params = new URLSearchParams({
			encoding: 'linear16',
			sample_rate: '16000',
			language: 'multi', // Multilingual mode (supports Spanish + 9 other languages)
			smart_format: 'true',
			punctuate: 'true',
			interim_results: 'true', // Enable real-time partial results (reduces latency)
			vad_events: 'true', // Voice Activity Detection events
		});

		const url = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT}/ai/run/@cf/deepgram/nova-3?${params.toString()}`;

		console.log('[SETUP] Connecting to nova-3 WebSocket...');
		console.log('[SETUP] URL:', url);
		console.log('[SETUP] Account ID:', env.CF_ACCOUNT);
		console.log('[SETUP] API Token (first 10 chars):', env.CF_API_TOKEN?.substring(0, 10) + '...');

		// Use fetch with Upgrade header to establish WebSocket connection
		const resp = await fetch(url, {
			headers: {
				'Upgrade': 'websocket',
				'Authorization': `Bearer ${env.CF_API_TOKEN}`,
			},
		});

		console.log('[SETUP] Fetch response status:', resp.status);
		console.log('[SETUP] Response headers:', JSON.stringify([...resp.headers.entries()]));

		const novaWs = resp.webSocket;

		if (!novaWs) {
			const errorText = await resp.text();
			console.error('[SETUP] nova-3 WebSocket request error:', errorText);
			throw new Error(`Failed to establish nova-3 WebSocket: ${resp.status}`);
		}

		// Accept the WebSocket to handle it in this Worker
		novaWs.accept();

		console.log('[SETUP] ✅ Connected to nova-3 WebSocket successfully');
		console.log('[SETUP] nova-3 WebSocket readyState:', novaWs.readyState);
		console.log('[SETUP] Language mode: multi (supports Spanish auto-detection)');

		// Stats tracking
		let totalBytes = 0;
		let updatesReceived = 0;
		const latencySamples: number[] = [];
		let lastAudioTime = Date.now();

		// Forward audio from client → nova-3 (non-async listener)
		serverWs.addEventListener('message', (event: MessageEvent) => {
			if (event.data instanceof ArrayBuffer) {
				totalBytes += event.data.byteLength;
				lastAudioTime = Date.now();

				// Forward raw PCM audio directly to nova-3
				novaWs.send(event.data);

				console.log(`[CLIENT→NOVA] Forwarded ${event.data.byteLength} bytes (total: ${totalBytes})`);
			} else {
				console.log(`[CLIENT→WORKER] Received non-ArrayBuffer message:`, typeof event.data, event.data);
			}
		});

		// Receive transcriptions from nova-3 → client
		novaWs.addEventListener('message', (event: MessageEvent) => {
			console.log(`[NOVA→WORKER] Received message, type: ${typeof event.data}`);

			if (typeof event.data === 'string') {
				console.log(`[NOVA→WORKER] Raw string data:`, event.data);
			} else if (event.data instanceof ArrayBuffer) {
				console.log(`[NOVA→WORKER] ArrayBuffer received (${event.data.byteLength} bytes)`);
				return; // Skip binary messages
			}

			try {
				const novaMessage = JSON.parse(event.data);
				const latency = Date.now() - lastAudioTime;
				latencySamples.push(latency);
				updatesReceived++;

				console.log(`[NOVA→WORKER] Parsed JSON (update #${updatesReceived}):`, JSON.stringify(novaMessage, null, 2));

				// Extract transcript from nova-3 WebSocket response
				// Actual response format: { type: "Results", channel: { alternatives: [{ transcript }] }, speech_final: bool }
				const transcript = novaMessage?.channel?.alternatives?.[0]?.transcript || '';
				const speechFinal = novaMessage?.speech_final || false; // True when speech segment ends
				const isFinal = speechFinal; // Use speech_final for is_final flag

				console.log(`[NOVA→WORKER] Extracted transcript: "${transcript}" (speech_final: ${speechFinal})`);

				// Send transcript to client
				const message: TranscriptMessage = {
					type: 'transcript',
					text: transcript,
					is_final: isFinal,
					timestamp: Date.now(),
					latency_ms: latency,
				};

				console.log(`[WORKER→CLIENT] Sending:`, JSON.stringify(message));
				serverWs.send(JSON.stringify(message));

				// Send stats every 10 updates
				if (updatesReceived % 10 === 0) {
					const avgLatency =
						latencySamples.length > 0
							? latencySamples.reduce((a: number, b: number) => a + b, 0) / latencySamples.length
							: 0;

					const stats: StatsMessage = {
						type: 'stats',
						bytes_received: totalBytes,
						chunks_processed: updatesReceived,
						avg_latency_ms: Math.round(avgLatency),
						timestamp: Date.now(),
					};

					console.log(`[WORKER→CLIENT] Sending stats:`, stats);
					serverWs.send(JSON.stringify(stats));
				}
			} catch (error) {
				console.error('[NOVA→WORKER] Failed to parse message:', error);
				console.error('[NOVA→WORKER] Raw data that failed:', event.data);
			}
		});

		// Handle errors
		novaWs.addEventListener('error', (event: Event) => {
			console.error('[NOVA] WebSocket error event:', event);

			const errorMsg: ErrorMessage = {
				type: 'error',
				error: 'nova-3 WebSocket error',
				timestamp: Date.now(),
			};
			serverWs.send(JSON.stringify(errorMsg));
		});

		// Handle close
		novaWs.addEventListener('close', (event: CloseEvent) => {
			console.log(`[NOVA] Connection closed. Code: ${event.code}, Reason: "${event.reason}", Clean: ${event.wasClean}`);
			console.log(`[NOVA] Session stats - Total bytes: ${totalBytes}, Updates received: ${updatesReceived}`);
			serverWs.close();
		});

		serverWs.addEventListener('close', (event: CloseEvent) => {
			console.log(`[CLIENT] Disconnected. Code: ${event.code}, Reason: "${event.reason}"`);
			console.log('[CLIENT→NOVA] Closing nova-3 connection');
			novaWs.close();
		});

	} catch (error) {
		console.error('Failed to connect to nova-3:', error);

		const errorMsg: ErrorMessage = {
			type: 'error',
			error: `Failed to connect to nova-3: ${error instanceof Error ? error.message : String(error)}`,
			timestamp: Date.now(),
		};

		serverWs.send(JSON.stringify(errorMsg));
		serverWs.close();
	}
}

/**
 * Handle mock mode (for testing without AI)
 */
function handleMockMode(clientWs: WebSocket, serverWs: WebSocket): void {
	let totalBytes = 0;
	let mockChunkCount = 0;

	serverWs.addEventListener('message', (event: MessageEvent) => {
		if (event.data instanceof ArrayBuffer) {
			totalBytes += event.data.byteLength;

			// Send mock transcription every ~500ms worth of audio
			if (totalBytes % 16000 < event.data.byteLength) {
				mockChunkCount++;

				const message: TranscriptMessage = {
					type: 'transcript',
					text: mockTranscribe(),
					is_final: true,
					timestamp: Date.now(),
					language: 'es',
				};

				serverWs.send(JSON.stringify(message));

				// Send stats
				if (mockChunkCount % 5 === 0) {
					const stats: StatsMessage = {
						type: 'stats',
						bytes_received: totalBytes,
						chunks_processed: mockChunkCount,
						avg_latency_ms: 150, // Fake latency
						timestamp: Date.now(),
					};

					serverWs.send(JSON.stringify(stats));
				}
			}
		}
	});

	serverWs.addEventListener('close', () => {
		console.log(`Mock session ended. Total bytes: ${totalBytes}, chunks: ${mockChunkCount}`);
	});
}

/**
 * Main fetch handler
 */
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// CORS handling for preflight
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type, Upgrade',
				},
			});
		}

		// Check for WebSocket upgrade
		const upgradeHeader = request.headers.get('Upgrade');
		if (upgradeHeader !== 'websocket') {
			return new Response('Expected WebSocket upgrade', { status: 426 });
		}

		// Create WebSocket pair for client connection
		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair);

		// Handle WebSocket in background
		ctx.waitUntil(handleWebSocket(client, server, env));

		// Return client WebSocket to user
		return new Response(null, {
			status: 101,
			webSocket: client,
			headers: {
				'Access-Control-Allow-Origin': '*',
			},
		});
	},
};
