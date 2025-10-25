# Worker Integration Plan - Real-Time Sign Translation

## Overview
Upgrade Cloudflare Worker to use Vectorize RAG for translating transcribed Spanish text into Chilean Sign Language in real-time using Agents SDK.

---

## Prerequisites
✅ Completed **SIGN_TO_JSON.md**: Vectorize index populated with sign embeddings

---

## Phase 1: Worker Configuration

### Step 1.1: Update wrangler.toml
**File**: `signos/worker/wrangler.toml`

**Add Vectorize binding**:
```toml
# Uncomment and configure:
[[vectorize]]
binding = "VECTORIZE"
index_name = "signos-lsch-index"
```

**Full configuration should have**:
```toml
name = "signos-agent"
main = "src/index.ts"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[[durable_objects.bindings]]
name = "SignosAgent"
class_name = "SignosAgent"
script_name = "signos-agent"

[ai]
binding = "AI"

[[vectorize]]
binding = "VECTORIZE"
index_name = "signos-lsch-index"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["SignosAgent"]
```

---

### Step 1.2: Update Environment Types
**File**: `signos/worker/src/types.ts` (create if doesn't exist)

```typescript
export interface Env {
  SignosAgent: DurableObjectNamespace<SignosAgent>;
  AI: Ai;
  VECTORIZE: Vectorize;
  CF_ACCOUNT: string;
  CF_API_TOKEN: string;
  MOCK_MODE?: string;
}

export interface AgentState {
  isRecording: boolean;
  sessionId: string;
  nova3Connection: WebSocket | null;
  transcriptBuffer: string;
  lastSignUpdate: number;
}

export interface SignMatch {
  id: string;
  glosa: string;
  translations: string;
  images: string;  // JSON string of image array
  definition: string;
  variant: number;
  score: number;
}
```

---

## Phase 2: Implement Sign Translation Service

### Step 2.1: Create Sign Matcher Service
**File**: `signos/worker/src/services/sign-matcher.ts` (new file)

```typescript
import { Ai } from '@cloudflare/ai';
import type { Env, SignMatch } from '../types';

export class SignMatcher {
  constructor(
    private env: Env,
    private ai: Ai
  ) {}

  /**
   * Translate Spanish text to sign sequence using Vectorize RAG
   */
  async translateToSigns(text: string): Promise<SignMatch[]> {
    if (!text.trim()) return [];

    try {
      // Step 1: Generate embedding for input text
      const embeddingResult = await this.ai.run('@cf/baai/bge-base-en-v1.5', {
        text: [text.toLowerCase()]
      });

      const queryVector = embeddingResult.data[0];

      // Step 2: Search Vectorize for similar signs
      const vectorResults = await this.env.VECTORIZE.query(queryVector, {
        topK: 10,
        returnMetadata: true,
        namespace: 'lsch'  // Optional: organize by sign language
      });

      // Step 3: Filter by relevance score
      const relevantMatches = vectorResults.matches
        .filter(match => match.score > 0.65)  // Threshold for relevance
        .map(match => ({
          id: match.id,
          glosa: match.metadata.glosa as string,
          translations: match.metadata.translations as string,
          images: match.metadata.images as string,
          definition: match.metadata.definition as string,
          variant: match.metadata.variant as number,
          score: match.score
        }));

      // Step 4: Use LLM to select best signs for sentence
      if (relevantMatches.length > 0) {
        return await this.selectBestSigns(text, relevantMatches);
      }

      return [];

    } catch (error) {
      console.error('Sign translation error:', error);
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
      const response = await this.ai.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: 'You are a sign language translation expert. Always respond with valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 200,
        temperature: 0.3
      });

      // Parse LLM response
      const responseText = response.response?.trim() || '[]';
      const selectedGlosas: string[] = JSON.parse(responseText);

      // Map selected glosas back to full sign data
      return selectedGlosas
        .map(glosa => matches.find(m => m.glosa === glosa))
        .filter((m): m is SignMatch => m !== undefined);

    } catch (error) {
      console.error('LLM selection error:', error);
      // Fallback: return top 3 matches by score
      return matches.slice(0, 3);
    }
  }

  /**
   * Get single sign by exact glosa match (for common words)
   */
  async getSignByGlosa(glosa: string): Promise<SignMatch | null> {
    const results = await this.env.VECTORIZE.getByIds([`sign_${glosa}`]);

    if (results.length > 0) {
      const match = results[0];
      return {
        id: match.id,
        glosa: match.metadata.glosa as string,
        translations: match.metadata.translations as string,
        images: match.metadata.images as string,
        definition: match.metadata.definition as string,
        variant: match.metadata.variant as number,
        score: 1.0
      };
    }

    return null;
  }
}
```

---

### Step 2.2: Update SignosAgent to Use Sign Matcher
**File**: `signos/worker/src/signos-agent.ts`

**Add imports**:
```typescript
import { Agent, Connection, ConnectionContext, WSMessage } from 'agents';
import { Ai } from '@cloudflare/ai';
import { SignMatcher } from './services/sign-matcher';
import type { Env, AgentState } from './types';
```

**Update SignosAgent class**:
```typescript
export class SignosAgent extends Agent<Env, AgentState> {
  private nova3Socket: WebSocket | null = null;
  private signMatcher: SignMatcher | null = null;

  async onInit() {
    await this.state.set('isRecording', false);
    await this.state.set('sessionId', `session-${Date.now()}`);
    await this.state.set('transcriptBuffer', '');
    await this.state.set('lastSignUpdate', 0);

    // Initialize AI and SignMatcher
    const ai = new Ai(this.env.AI);
    this.signMatcher = new SignMatcher(this.env, ai);
  }

  async onConnect(connection: Connection, ctx: ConnectionContext) {
    console.log('Client connected to SignosAgent');

    // Send welcome message
    await connection.send(JSON.stringify({
      type: 'connected',
      sessionId: await this.state.get('sessionId'),
      timestamp: Date.now()
    }));

    // Connect to nova-3 for STT
    await this.connectToNova3(connection);
  }

  async onMessage(connection: Connection, message: WSMessage) {
    // Binary data = audio from client
    if (message instanceof ArrayBuffer) {
      await this.forwardAudioToNova(message);
      return;
    }

    // Text messages (future commands)
    if (typeof message === 'string') {
      try {
        const data = JSON.parse(message);
        await this.handleClientCommand(connection, data);
      } catch (e) {
        console.error('Invalid message:', e);
      }
    }
  }

  async onClose(connection: Connection, code: number, reason: string) {
    console.log(`Client disconnected: ${code} - ${reason}`);

    // Close nova-3 connection
    if (this.nova3Socket) {
      this.nova3Socket.close();
      this.nova3Socket = null;
    }
  }

  // ========================================
  // Nova-3 STT Integration
  // ========================================

  private async connectToNova3(connection: Connection) {
    const cfAccount = this.env.CF_ACCOUNT;
    const cfToken = this.env.CF_API_TOKEN;

    if (!cfAccount || !cfToken) {
      await connection.send(JSON.stringify({
        type: 'error',
        error: 'Missing CF_ACCOUNT or CF_API_TOKEN',
        timestamp: Date.now()
      }));
      return;
    }

    const nova3Url = `wss://api.cloudflare.com/client/v4/accounts/${cfAccount}/ai/run/@cf/deepgram/nova-3`;

    try {
      const response = await fetch(nova3Url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cfToken}`,
          'Upgrade': 'websocket'
        },
        body: JSON.stringify({
          language: 'multi',  // Spanish + English
          interim_results: true
        })
      });

      if (!response.webSocket) {
        throw new Error('Failed to establish nova-3 WebSocket');
      }

      this.nova3Socket = response.webSocket;
      this.nova3Socket.accept();

      // Handle nova-3 responses
      this.nova3Socket.addEventListener('message', async (event) => {
        await this.handleNova3Message(connection, event.data);
      });

      console.log('Connected to nova-3 successfully');

    } catch (error) {
      console.error('Nova-3 connection error:', error);
      await connection.send(JSON.stringify({
        type: 'error',
        error: 'Failed to connect to nova-3',
        timestamp: Date.now()
      }));
    }
  }

  private async forwardAudioToNova(audioData: ArrayBuffer) {
    if (this.nova3Socket && this.nova3Socket.readyState === 1) {
      this.nova3Socket.send(audioData);
    }
  }

  private async handleNova3Message(connection: Connection, data: string) {
    try {
      const nova3Response = JSON.parse(data);

      // Extract transcript
      const transcript = nova3Response.channel?.alternatives?.[0]?.transcript;
      const isFinal = nova3Response.speech_final === true;

      if (!transcript) return;

      // Send transcript to client
      await connection.send(JSON.stringify({
        type: 'transcript',
        text: transcript,
        is_final: isFinal,
        timestamp: Date.now()
      }));

      // Translate to signs on final transcript
      if (isFinal && transcript.trim().length > 0) {
        await this.translateAndSendSigns(connection, transcript);
      }

    } catch (error) {
      console.error('Nova-3 message parsing error:', error);
    }
  }

  // ========================================
  // Sign Translation Logic
  // ========================================

  private async translateAndSendSigns(connection: Connection, text: string) {
    if (!this.signMatcher) return;

    try {
      console.log(`Translating: "${text}"`);

      // Get sign sequence from Vectorize RAG
      const signs = await this.signMatcher.translateToSigns(text);

      if (signs.length === 0) {
        console.log('No signs found for:', text);
        return;
      }

      // Format for client
      const signInfos = signs.map(sign => ({
        glosa: sign.glosa,
        images: JSON.parse(sign.images),  // Parse JSON array
        definition: sign.definition,
        confidence: sign.score
      }));

      // Send to client
      await connection.send(JSON.stringify({
        type: 'signs',
        text: text,
        signs: signInfos,
        timestamp: Date.now()
      }));

      console.log(`Sent ${signs.length} signs:`, signs.map(s => s.glosa).join(', '));

    } catch (error) {
      console.error('Sign translation error:', error);
    }
  }

  private async handleClientCommand(connection: Connection, data: any) {
    switch (data.type) {
      case 'ping':
        await connection.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;

      case 'stop_recording':
        await this.state.set('isRecording', false);
        if (this.nova3Socket) {
          this.nova3Socket.close();
          this.nova3Socket = null;
        }
        break;

      default:
        console.log('Unknown command:', data.type);
    }
  }
}
```

---

## Phase 3: Testing & Validation

### Step 3.1: Local Development Test
**Terminal 1** - Start Worker:
```bash
cd signos/worker
pnpm run dev --port 8787
```

**Expected logs**:
```
✓ SignosAgent Durable Object binding: [connected]
✓ VECTORIZE binding: signos-lsch-index
✓ Ready on http://localhost:8787
```

---

### Step 3.2: Test Vectorize Connectivity
**Create**: `signos/worker/scripts/test_sign_search.ts`

```typescript
// Quick test script for Vectorize
import { SignMatcher } from '../src/services/sign-matcher';

const testQueries = [
  "hola cómo estás",
  "necesito agua",
  "gracias",
  "buenos días",
  "ayuda por favor"
];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const ai = new Ai(env.AI);
    const matcher = new SignMatcher(env, ai);

    const results = [];

    for (const query of testQueries) {
      const signs = await matcher.translateToSigns(query);
      results.push({
        query,
        signs: signs.map(s => ({
          glosa: s.glosa,
          score: s.score,
          translations: s.translations
        }))
      });
    }

    return new Response(JSON.stringify(results, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
```

**Test**:
```bash
curl http://localhost:8787/test-signs | jq
```

**Expected Output**:
```json
[
  {
    "query": "hola cómo estás",
    "signs": [
      { "glosa": "HOLA", "score": 0.89, "translations": "hola,saludar" },
      { "glosa": "CÓMO", "score": 0.82, "translations": "cómo,de qué manera" },
      { "glosa": "ESTAR", "score": 0.78, "translations": "estar,encontrarse" }
    ]
  }
]
```

---

### Step 3.3: Integration Test with Tauri Client
**Steps**:
1. Start worker: `cd signos/worker && pnpm run dev --port 8787`
2. Start Tauri: `cd signos/tauri-app && pnpm tauri dev`
3. In Tauri app:
   - Worker URL: `ws://localhost:8787`
   - Click "Start Recording"
   - Speak: **"Hola, necesito agua por favor"**

**Expected Behavior**:
1. Transcript appears: "hola necesito agua por favor"
2. Signs display in sequence:
   - HOLA → shows image
   - NECESITAR → shows image
   - AGUA → shows image

**Logs to check**:
```
Worker console:
  ✓ Connected to nova-3 successfully
  ✓ Translating: "hola necesito agua por favor"
  ✓ Sent 3 signs: HOLA, NECESITAR, AGUA

Client console:
  ✓ Received signs message with 3 signs
  ✓ Displaying sign: HOLA
  ✓ Displaying sign: NECESITAR
  ✓ Displaying sign: AGUA
```

---

## Phase 4: Performance Optimization

### Step 4.1: Add Caching Layer
**File**: `signos/worker/src/services/sign-cache.ts`

```typescript
export class SignCache {
  private cache: Map<string, SignMatch[]> = new Map();
  private maxSize: number = 500;

  set(query: string, signs: SignMatch[]) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(query.toLowerCase(), signs);
  }

  get(query: string): SignMatch[] | null {
    return this.cache.get(query.toLowerCase()) || null;
  }

  clear() {
    this.cache.clear();
  }
}
```

**Update SignMatcher**:
```typescript
export class SignMatcher {
  private cache = new SignCache();

  async translateToSigns(text: string): Promise<SignMatch[]> {
    const cached = this.cache.get(text);
    if (cached) {
      console.log('Cache hit for:', text);
      return cached;
    }

    const signs = await this.performTranslation(text);
    this.cache.set(text, signs);
    return signs;
  }
}
```

---

### Step 4.2: Batch Processing for Long Sentences
**Update**: Split long text into chunks if needed

```typescript
private async translateAndSendSigns(connection: Connection, text: string) {
  const sentences = text.split(/[.!?]/).filter(s => s.trim().length > 0);

  for (const sentence of sentences) {
    const signs = await this.signMatcher.translateToSigns(sentence.trim());

    if (signs.length > 0) {
      await connection.send(JSON.stringify({
        type: 'signs',
        text: sentence,
        signs: signs.map(s => ({
          glosa: s.glosa,
          images: JSON.parse(s.images),
          definition: s.definition,
          confidence: s.score
        })),
        timestamp: Date.now()
      }));

      // Small delay between sentences to not overwhelm client
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
}
```

---

## Phase 5: Deployment

### Step 5.1: Deploy to Cloudflare
```bash
cd signos/worker

# Ensure secrets are set
wrangler secret put CF_ACCOUNT
wrangler secret put CF_API_TOKEN

# Deploy
pnpm deploy
```

**Expected Output**:
```
✅ Deployed signos-agent
   URL: https://signos-agent.your-subdomain.workers.dev
```

---

### Step 5.2: Update Production Environment
**Update Tauri client default URL**:
```typescript
// tauri-app/src/main.ts
const DEFAULT_CONFIG: AppConfig = {
  workerUrl: 'wss://signos-agent.your-subdomain.workers.dev',  // Production
  selectedDeviceId: '',
};
```

---

## Success Criteria

✅ **Complete when**:
1. Worker can query Vectorize and return relevant signs
2. LLM (Llama 3.1) selects appropriate signs from matches
3. Signs sent to client in real-time after transcripts
4. Test query "hola necesito agua" returns HOLA, NECESITAR, AGUA
5. Average latency < 500ms from transcript to signs
6. Worker deployed to production with proper secrets

---

## Next Steps

→ Proceed to **CLIENT_PLAN.md** to update Tauri app to display signs with animations
