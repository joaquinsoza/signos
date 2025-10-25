# Tauri Client Integration Plan - Sign Display & Animation

## Overview
Update Tauri desktop app to display Chilean Sign Language signs in real-time, synced with transcriptions using Cloudflare Agents SDK.

---

## Prerequisites
✅ Completed **WORKER_PLAN.md**: Worker sends sign sequences via WebSocket
✅ Sign images copied to `tauri-app/public/signs/`

---

## Phase 1: Client Architecture Setup

### Step 1.1: Install Dependencies
**Terminal**:
```bash
cd signos/tauri-app
pnpm add agents
```

**Verify**:
```bash
cat package.json | grep agents
# Should show: "agents": "^x.x.x"
```

---

### Step 1.2: Update TypeScript Types
**File**: `src/types.ts` (create new file)

```typescript
// Message types from Worker
export interface TranscriptMessage {
  type: 'transcript';
  text: string;
  is_final: boolean;
  timestamp: number;
  latency_ms?: number;
}

export interface SignsMessage {
  type: 'signs';
  text: string;
  signs: SignInfo[];
  timestamp: number;
}

export interface SignInfo {
  glosa: string;
  images: string[];  // Array of image paths
  definition?: string;
  confidence?: number;
}

export interface ConnectedMessage {
  type: 'connected';
  sessionId: string;
  timestamp: number;
}

export interface ErrorMessage {
  type: 'error';
  error: string;
  timestamp: number;
}

export type ServerMessage =
  | TranscriptMessage
  | SignsMessage
  | ConnectedMessage
  | ErrorMessage;

// App configuration
export interface AppConfig {
  workerUrl: string;
  selectedDeviceId: string;
  signDisplayDuration: number;  // ms per sign
  animationSpeed: string;       // 'slow' | 'normal' | 'fast'
}
```

---

## Phase 2: Update Connection Layer

### Step 2.1: Integrate AgentClient
**File**: `src/main.ts`

**Update imports**:
```typescript
import { AgentClient } from 'agents/client';
import type { ServerMessage, SignInfo, AppConfig } from './types';
```

**Update SignosClient class**:
```typescript
class SignosClient {
  private agentClient: AgentClient | null = null;
  private currentSignSequence: SignInfo[] = [];
  private signDisplayQueue: SignInfo[] = [];
  private isDisplayingSign: boolean = false;

  // ... existing properties ...

  private async connectWebSocket(): Promise<void> {
    if (this.agentClient) {
      this.agentClient.close();
    }

    const url = new URL(this.workerUrl.replace('ws://', 'http://').replace('wss://', 'https://'));
    const host = url.host;
    const protocol = this.workerUrl.startsWith('wss://') ? 'wss' : 'ws';

    this.log(`Connecting to Agent: ${protocol}://${host}`);

    try {
      this.agentClient = new AgentClient({
        agent: 'signos-agent',
        name: `session-${Date.now()}`,
        host: host,
        protocol: protocol,
      } as any);

      // Handle incoming messages
      this.agentClient.onmessage = (event: MessageEvent) => {
        this.handleMessage(event.data);
      };

      this.agentClient.onerror = (error: Event) => {
        console.error('AgentClient error:', error);
        this.log('Connection error - check worker is running');
      };

      this.agentClient.onclose = () => {
        this.log('Disconnected from worker');
        this.isRecording = false;
        this.agentClient = null;
      };

      this.agentClient.onopen = () => {
        this.log('Connected to worker successfully');
      };

    } catch (error) {
      console.error('Connection failed:', error);
      this.log(`Failed to connect: ${error}`);
      throw error;
    }
  }

  private handleMessage(data: string): void {
    try {
      const message: ServerMessage = JSON.parse(data);

      switch (message.type) {
        case 'connected':
          this.log(`Session ID: ${message.sessionId}`);
          break;

        case 'transcript':
          this.handleTranscript(message);
          break;

        case 'signs':
          this.handleSigns(message);
          break;

        case 'error':
          this.log(`Error: ${message.error}`);
          break;

        default:
          console.log('Unknown message:', message);
      }
    } catch (error) {
      console.error('Message parsing error:', error);
    }
  }
}
```

---

## Phase 3: Sign Display System

### Step 3.1: Create Sign Display Components
**File**: `index.html`

**Add sign display overlay** (after `recordingView`):
```html
<!-- Sign Display Overlay -->
<div id="signOverlay" class="sign-overlay hidden">
  <div class="sign-container">
    <!-- Sign image with sequence support -->
    <div class="sign-image-wrapper">
      <img id="signImage" class="sign-image" src="" alt="Sign" />
    </div>

    <!-- Sign metadata -->
    <div class="sign-info">
      <div id="signGlosa" class="sign-glosa"></div>
      <div id="signDefinition" class="sign-definition"></div>
    </div>

    <!-- Progress indicator for sequence -->
    <div id="signProgress" class="sign-progress">
      <span id="signCounter">1 / 3</span>
    </div>
  </div>
</div>

<!-- Transcript display (persistent) -->
<div id="transcriptDisplay" class="transcript-display hidden">
  <div id="currentTranscript" class="transcript-current"></div>
  <div id="finalTranscripts" class="transcript-final"></div>
</div>
```

---

### Step 3.2: Add Styles
**File**: `src/styles.css`

```css
/* Sign Overlay - Full screen centered */
.sign-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.sign-overlay:not(.hidden) {
  opacity: 1;
}

.sign-container {
  text-align: center;
  max-width: 600px;
  padding: 2rem;
}

/* Sign Image */
.sign-image-wrapper {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  margin-bottom: 1.5rem;
  animation: signPop 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.sign-image {
  max-width: 400px;
  max-height: 400px;
  width: 100%;
  height: auto;
  display: block;
  margin: 0 auto;
}

@keyframes signPop {
  0% {
    transform: scale(0.3);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

/* Sign Metadata */
.sign-info {
  color: white;
}

.sign-glosa {
  font-size: 2.5rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.sign-definition {
  font-size: 1.1rem;
  color: #aaa;
  font-style: italic;
}

/* Progress Indicator */
.sign-progress {
  margin-top: 1rem;
  color: #666;
  font-size: 1rem;
}

.sign-progress.hidden {
  display: none;
}

/* Transcript Display - Bottom of screen */
.transcript-display {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 1rem 2rem;
  border-radius: 12px;
  max-width: 80%;
  z-index: 900;
  backdrop-filter: blur(10px);
}

.transcript-current {
  font-size: 1.2rem;
  color: #888;
  font-style: italic;
  margin-bottom: 0.5rem;
}

.transcript-final {
  font-size: 1.4rem;
  font-weight: 500;
  line-height: 1.5;
}

/* Speed animations */
.sign-overlay.speed-slow .sign-image-wrapper {
  animation-duration: 0.6s;
}

.sign-overlay.speed-fast .sign-image-wrapper {
  animation-duration: 0.2s;
}

/* Hide helper */
.hidden {
  display: none !important;
}
```

---

### Step 3.3: Implement Sign Display Logic
**File**: `src/main.ts`

**Add to SignosClient class**:
```typescript
class SignosClient {
  private elements: {
    // ... existing elements ...
    signOverlay: HTMLDivElement;
    signImage: HTMLImageElement;
    signGlosa: HTMLDivElement;
    signDefinition: HTMLDivElement;
    signProgress: HTMLDivElement;
    signCounter: HTMLSpanElement;
    transcriptDisplay: HTMLDivElement;
    currentTranscript: HTMLDivElement;
    finalTranscripts: HTMLDivElement;
  };

  constructor() {
    // ... existing initialization ...

    this.elements = {
      // ... existing elements ...
      signOverlay: document.getElementById('signOverlay') as HTMLDivElement,
      signImage: document.getElementById('signImage') as HTMLImageElement,
      signGlosa: document.getElementById('signGlosa') as HTMLDivElement,
      signDefinition: document.getElementById('signDefinition') as HTMLDivElement,
      signProgress: document.getElementById('signProgress') as HTMLDivElement,
      signCounter: document.getElementById('signCounter') as HTMLSpanElement,
      transcriptDisplay: document.getElementById('transcriptDisplay') as HTMLDivElement,
      currentTranscript: document.getElementById('currentTranscript') as HTMLDivElement,
      finalTranscripts: document.getElementById('finalTranscripts') as HTMLDivElement,
    };
  }

  // ========================================
  // Message Handlers
  // ========================================

  private handleTranscript(message: TranscriptMessage): void {
    if (message.is_final) {
      // Add to final transcripts
      const p = document.createElement('p');
      p.textContent = message.text;
      this.elements.finalTranscripts.appendChild(p);

      // Auto-scroll
      this.elements.finalTranscripts.scrollTop = this.elements.finalTranscripts.scrollHeight;

      // Clear interim
      this.elements.currentTranscript.textContent = '';

      this.log(`📝 ${message.text}`);
    } else {
      // Show interim transcript
      this.elements.currentTranscript.textContent = message.text;
    }

    // Show transcript display
    this.elements.transcriptDisplay.classList.remove('hidden');
  }

  private async handleSigns(message: SignsMessage): Promise<void> {
    this.log(`🤟 Received ${message.signs.length} signs for: "${message.text}"`);

    // Add to display queue
    this.signDisplayQueue.push(...message.signs);

    // Start displaying if not already
    if (!this.isDisplayingSign) {
      await this.displaySignQueue();
    }
  }

  // ========================================
  // Sign Display Queue System
  // ========================================

  private async displaySignQueue(): Promise<void> {
    this.isDisplayingSign = true;

    while (this.signDisplayQueue.length > 0) {
      const sign = this.signDisplayQueue.shift()!;
      await this.displaySign(sign);
    }

    this.isDisplayingSign = false;
  }

  private async displaySign(sign: SignInfo): Promise<void> {
    const config = await this.loadConfig();
    const duration = config.signDisplayDuration || 1500;  // Default 1.5s per sign

    console.log(`Displaying sign: ${sign.glosa}`);

    // Show overlay
    this.elements.signOverlay.classList.remove('hidden');

    // Update metadata
    this.elements.signGlosa.textContent = sign.glosa;
    this.elements.signDefinition.textContent = sign.definition || '';

    // Display image sequence
    if (sign.images.length > 1) {
      // Multiple images = movement sequence
      await this.displayImageSequence(sign.images, duration);
    } else if (sign.images.length === 1) {
      // Single static image
      this.elements.signImage.src = sign.images[0];
      this.elements.signProgress.classList.add('hidden');

      await this.sleep(duration);
    }

    // Hide overlay with fade
    this.elements.signOverlay.classList.add('hidden');
    await this.sleep(200);  // Transition time
  }

  private async displayImageSequence(images: string[], totalDuration: number): Promise<void> {
    const durationPerImage = totalDuration / images.length;

    for (let i = 0; i < images.length; i++) {
      this.elements.signImage.src = images[i];

      // Update progress counter
      this.elements.signCounter.textContent = `${i + 1} / ${images.length}`;
      this.elements.signProgress.classList.remove('hidden');

      await this.sleep(durationPerImage);
    }

    this.elements.signProgress.classList.add('hidden');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ========================================
  // Audio Capture & Streaming
  // ========================================

  private async startRecording(): Promise<void> {
    if (!this.agentClient) {
      await this.connectWebSocket();
    }

    // Clear previous transcripts
    this.elements.finalTranscripts.innerHTML = '';
    this.elements.currentTranscript.textContent = '';
    this.signDisplayQueue = [];

    // Start audio capture
    try {
      const constraints: MediaStreamConstraints = {
        audio: this.selectedDeviceId
          ? { deviceId: { exact: this.selectedDeviceId } }
          : true,
        video: false,
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Set up AudioContext and AudioWorklet
      this.audioContext = new AudioContext({ sampleRate: 16000 });

      await this.audioContext.audioWorklet.addModule('/audio-processor.js');

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'audio-processor');

      // Forward audio chunks to worker
      this.audioWorkletNode.port.onmessage = (event) => {
        if (this.agentClient && this.agentClient.readyState === WebSocket.OPEN) {
          this.agentClient.send(event.data);  // Send PCM buffer
        }
      };

      source.connect(this.audioWorkletNode);
      this.audioWorkletNode.connect(this.audioContext.destination);

      this.isRecording = true;
      this.log('🎤 Recording started');

    } catch (error) {
      console.error('Recording error:', error);
      this.log(`Failed to start recording: ${error}`);
    }
  }

  private async stopRecording(): Promise<void> {
    if (this.audioWorkletNode) {
      this.audioWorkletNode.disconnect();
      this.audioWorkletNode = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.agentClient) {
      this.agentClient.close();
      this.agentClient = null;
    }

    this.isRecording = false;
    this.log('Recording stopped');

    // Hide displays
    this.elements.transcriptDisplay.classList.add('hidden');
    this.elements.signOverlay.classList.add('hidden');
  }
}
```

---

## Phase 4: Configuration & Settings

### Step 4.1: Add Sign Display Settings
**File**: `index.html` (in settingsView)

**Add after audio input select**:
```html
<div class="form-group">
  <label for="signDurationInput">Sign Display Duration (ms)</label>
  <input
    type="number"
    id="signDurationInput"
    min="500"
    max="5000"
    step="100"
    value="1500"
  />
  <small>Time each sign is displayed (default: 1500ms)</small>
</div>

<div class="form-group">
  <label for="animationSpeedSelect">Animation Speed</label>
  <select id="animationSpeedSelect">
    <option value="slow">Slow</option>
    <option value="normal" selected>Normal</option>
    <option value="fast">Fast</option>
  </select>
</div>
```

---

### Step 4.2: Update Config Persistence
**File**: `src/main.ts`

**Update AppConfig interface**:
```typescript
interface AppConfig {
  workerUrl: string;
  selectedDeviceId: string;
  signDisplayDuration: number;
  animationSpeed: 'slow' | 'normal' | 'fast';
}

const DEFAULT_CONFIG: AppConfig = {
  workerUrl: 'ws://localhost:8787',
  selectedDeviceId: '',
  signDisplayDuration: 1500,
  animationSpeed: 'normal',
};
```

**Update saveSettings**:
```typescript
private async saveSettings(): Promise<void> {
  const signDurationInput = document.getElementById('signDurationInput') as HTMLInputElement;
  const animationSpeedSelect = document.getElementById('animationSpeedSelect') as HTMLSelectElement;

  const config: AppConfig = {
    workerUrl: this.elements.workerUrlInput.value,
    selectedDeviceId: this.elements.audioInputSelect.value,
    signDisplayDuration: parseInt(signDurationInput.value),
    animationSpeed: animationSpeedSelect.value as 'slow' | 'normal' | 'fast',
  };

  try {
    await writeTextFile(CONFIG_FILE, JSON.stringify(config, null, 2), {
      baseDir: BaseDirectory.AppConfig,
    });

    this.workerUrl = config.workerUrl;
    this.selectedDeviceId = config.selectedDeviceId;

    this.log('Settings saved');
    this.switchView('menu');
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}
```

---

## Phase 5: Testing & Validation

### Step 5.1: Unit Test - Sign Display
**Test Cases**:
1. Single sign with one image
2. Sign sequence (3+ signs)
3. Sign with movement sequence (multiple images)
4. Rapid sign updates (queue handling)

**Manual Test**:
```typescript
// Add to main.ts for testing
private async testSignDisplay() {
  const testSigns: SignInfo[] = [
    {
      glosa: 'HOLA',
      images: ['/signs/HOLA_1_0.png'],
      definition: 'Saludo, expresión de bienvenida',
      confidence: 0.95
    },
    {
      glosa: 'NECESITAR',
      images: ['/signs/NECESITAR_1_0.png', '/signs/NECESITAR_1_1.png'],
      definition: 'Requerir algo',
      confidence: 0.87
    },
    {
      glosa: 'AGUA',
      images: ['/signs/AGUA_1_0.png'],
      definition: 'Líquido vital',
      confidence: 0.92
    }
  ];

  this.signDisplayQueue.push(...testSigns);
  await this.displaySignQueue();
}
```

---

### Step 5.2: Integration Test - Full Flow
**Test Procedure**:
1. Start worker: `cd signos/worker && pnpm run dev --port 8787`
2. Start Tauri: `cd signos/tauri-app && pnpm tauri dev`
3. Settings:
   - Worker URL: `ws://localhost:8787`
   - Sign Duration: `1500`
   - Animation: `normal`
4. Click "Start Recording"
5. Speak: **"Hola, necesito agua"**

**Expected Results**:
- ✅ Transcript appears: "hola necesito agua"
- ✅ Sign overlay shows HOLA for 1.5s
- ✅ Sign overlay shows NECESITAR for 1.5s (with sequence animation)
- ✅ Sign overlay shows AGUA for 1.5s
- ✅ Transcript persists at bottom
- ✅ No flickering or layout issues

---

### Step 5.3: Performance Test
**Metrics to Track**:
```typescript
// Add performance logging
private async displaySign(sign: SignInfo): Promise<void> {
  const startTime = performance.now();

  // ... display logic ...

  const endTime = performance.now();
  console.log(`Sign display time: ${endTime - startTime}ms`);
}
```

**Target Metrics**:
- Sign display latency: < 100ms
- Smooth animations at 60fps
- No memory leaks during long sessions
- Queue handles 10+ rapid signs without lag

---

## Phase 6: Polish & UX

### Step 6.1: Add Loading States
**HTML**:
```html
<div id="loadingIndicator" class="loading-indicator hidden">
  <div class="spinner"></div>
  <p>Loading sign...</p>
</div>
```

**CSS**:
```css
.loading-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.spinner {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
```

---

### Step 6.2: Error Handling
**Add fallback image**:
```typescript
private async displaySign(sign: SignInfo): Promise<void> {
  try {
    // ... existing logic ...

    // Handle missing images
    this.elements.signImage.onerror = () => {
      this.elements.signImage.src = '/signs/placeholder.png';
      this.log(`Image not found for ${sign.glosa}`);
    };

  } catch (error) {
    console.error('Sign display error:', error);
    this.log(`Failed to display ${sign.glosa}`);
  }
}
```

---

### Step 6.3: Accessibility
**Add ARIA labels**:
```html
<div
  id="signOverlay"
  class="sign-overlay hidden"
  role="dialog"
  aria-labelledby="signGlosa"
  aria-describedby="signDefinition"
>
  <img
    id="signImage"
    class="sign-image"
    alt="Sign language demonstration"
    role="img"
  />
</div>
```

---

## Phase 7: Build & Package

### Step 7.1: Production Build
```bash
cd signos/tauri-app

# Build web assets
pnpm build

# Build Tauri app
pnpm tauri build
```

**Expected Output**:
- macOS: `src-tauri/target/release/bundle/dmg/Signos_x.x.x_x64.dmg`
- Windows: `src-tauri/target/release/bundle/msi/Signos_x.x.x_x64.msi`
- Linux: `src-tauri/target/release/bundle/appimage/signos_x.x.x_amd64.AppImage`

---

### Step 7.2: Bundle Size Optimization
**Check bundle size**:
```bash
du -sh src-tauri/target/release/bundle/
```

**Optimize images** (if needed):
```bash
# Compress sign images
cd public/signs
for img in *.png; do
  pngquant --quality=65-80 --ext .png --force "$img"
done
```

---

## Success Criteria

✅ **Complete when**:
1. AgentClient connects to worker successfully
2. Transcriptions appear in real-time at bottom of screen
3. Signs display in full-screen overlay with smooth animations
4. Image sequences animate properly for movement signs
5. Sign queue handles rapid updates without blocking
6. Settings persist across app restarts
7. Production build runs on target platforms
8. Average latency from speech → sign display < 2 seconds

---

## Troubleshooting

### Issue: Signs not displaying
**Check**:
1. Verify images exist: `ls public/signs/ | head`
2. Check browser console for 404 errors
3. Verify image paths match format: `/signs/GLOSA_variant_seq.png`

### Issue: WebSocket connection fails
**Check**:
1. Worker is running: `curl http://localhost:8787/health`
2. URL format: Must be `ws://` not `http://`
3. Firewall settings allow port 8787

### Issue: Slow performance
**Optimize**:
1. Reduce sign display duration to 1000ms
2. Limit queue size to max 10 signs
3. Preload common sign images on app start

---

## Next Steps

✅ All three phases complete!

**Optional Enhancements**:
- Add sign dictionary browser (search/view all signs)
- Save session history (transcripts + signs)
- Export to video with sign animations
- Multi-language support (English STT → LSCh)
