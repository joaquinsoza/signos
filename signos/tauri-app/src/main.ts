// Signos - Minimal STT Client

import { exit } from '@tauri-apps/plugin-process';
import { BaseDirectory, exists, readTextFile, writeTextFile, mkdir } from '@tauri-apps/plugin-fs';

interface TranscriptMessage {
    type: 'transcript';
    text: string;
    is_final: boolean;
    timestamp: number;
    latency_ms?: number;
}

interface ImagePath {
    path: string;
    sequence: number;
}

interface SignInfo {
    glosa: string;
    images: ImagePath[];
    definition: string;
    confidence: number;
}

interface SignsMessage {
    type: 'signs';
    text: string;
    signs: SignInfo[];
    timestamp: number;
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

type ServerMessage = TranscriptMessage | SignsMessage | StatsMessage | ErrorMessage;
type AppView = 'menu' | 'settings' | 'recording';

interface AppConfig {
    workerUrl: string;
    selectedDeviceId: string;
    signDisplayDuration: number;
    animationSpeed: 'slow' | 'normal' | 'fast';
}

const CONFIG_FILE = 'config.json';
const DEFAULT_CONFIG: AppConfig = {
    workerUrl: 'ws://localhost:8787',
    selectedDeviceId: '',
    signDisplayDuration: 1500,
    animationSpeed: 'normal',
};

class SignosClient {
    private currentView: AppView = 'menu';
    private ws: WebSocket | null = null;
    private audioContext: AudioContext | null = null;
    private mediaStream: MediaStream | null = null;
    private audioWorkletNode: AudioWorkletNode | null = null;
    private isRecording: boolean = false;
    private workerUrl: string = 'ws://localhost:8787';
    private selectedDeviceId: string = '';

    // Sign display state
    private signDisplayQueue: SignInfo[] = [];
    private isDisplayingSign: boolean = false;
    private config: AppConfig = DEFAULT_CONFIG;

    private views: {
        menu: HTMLElement;
        settings: HTMLElement;
        recording: HTMLElement;
    };

    private elements: {
        startBtn: HTMLButtonElement;
        settingsBtn: HTMLButtonElement;
        exitBtn: HTMLButtonElement;
        stopBtn: HTMLButtonElement;
        toggleDebugBtn: HTMLButtonElement;
        workerUrlInput: HTMLInputElement;
        audioInputSelect: HTMLSelectElement;
        signDurationInput: HTMLInputElement;
        animationSpeedSelect: HTMLSelectElement;
        saveSettingsBtn: HTMLButtonElement;
        cancelSettingsBtn: HTMLButtonElement;
        debugLog: HTMLDivElement;
        signOverlay: HTMLDivElement;
        signImage: HTMLImageElement;
        signGlosa: HTMLDivElement;
        signDefinition: HTMLDivElement;
        signProgress: HTMLDivElement;
        signCounter: HTMLSpanElement;
        bgImage: HTMLImageElement;
    };

    private isDebugVisible: boolean = false;

    constructor() {
        this.views = {
            menu: document.getElementById('menuView') as HTMLElement,
            settings: document.getElementById('settingsView') as HTMLElement,
            recording: document.getElementById('recordingView') as HTMLElement,
        };

        this.elements = {
            startBtn: document.getElementById('startBtn') as HTMLButtonElement,
            settingsBtn: document.getElementById('settingsBtn') as HTMLButtonElement,
            exitBtn: document.getElementById('exitBtn') as HTMLButtonElement,
            stopBtn: document.getElementById('stopBtn') as HTMLButtonElement,
            toggleDebugBtn: document.getElementById('toggleDebugBtn') as HTMLButtonElement,
            workerUrlInput: document.getElementById('workerUrl') as HTMLInputElement,
            audioInputSelect: document.getElementById('audioInput') as HTMLSelectElement,
            signDurationInput: document.getElementById('signDurationInput') as HTMLInputElement,
            animationSpeedSelect: document.getElementById('animationSpeedSelect') as HTMLSelectElement,
            saveSettingsBtn: document.getElementById('saveSettingsBtn') as HTMLButtonElement,
            cancelSettingsBtn: document.getElementById('cancelSettingsBtn') as HTMLButtonElement,
            debugLog: document.getElementById('debugLog') as HTMLDivElement,
            signOverlay: document.getElementById('signOverlay') as HTMLDivElement,
            signImage: document.getElementById('signImage') as HTMLImageElement,
            signGlosa: document.getElementById('signGlosa') as HTMLDivElement,
            signDefinition: document.getElementById('signDefinition') as HTMLDivElement,
            signProgress: document.getElementById('signProgress') as HTMLDivElement,
            signCounter: document.getElementById('signCounter') as HTMLSpanElement,
            bgImage: document.querySelector('#recordingView .bg-image') as HTMLImageElement,
        };

        this.initializeEventListeners();
        this.initialize();
    }

    private async initialize(): Promise<void> {
        await this.loadConfig();
        await this.loadAudioDevices();
        this.showView('menu');
    }

    private async loadConfig(): Promise<void> {
        try {
            console.log('[Config] Checking if config exists...');
            const configExists: boolean = await exists(CONFIG_FILE, { baseDir: BaseDirectory.AppData });
            console.log('[Config] Config exists:', configExists);

            if (configExists) {
                const configJson: string = await readTextFile(CONFIG_FILE, { baseDir: BaseDirectory.AppData });
                this.config = { ...DEFAULT_CONFIG, ...JSON.parse(configJson) };
                console.log('[Config] Loaded config:', this.config);

                this.workerUrl = this.config.workerUrl;
                this.selectedDeviceId = this.config.selectedDeviceId;

                this.elements.workerUrlInput.value = this.workerUrl;
                this.elements.signDurationInput.value = String(this.config.signDisplayDuration);
                this.elements.animationSpeedSelect.value = this.config.animationSpeed;
            } else {
                console.log('[Config] Creating default config...');
                await this.saveConfig();
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('[Config] Failed to load config:', message, error);
        }
    }

    private async saveConfig(): Promise<void> {
        try {
            this.config = {
                workerUrl: this.elements.workerUrlInput.value,
                selectedDeviceId: this.elements.audioInputSelect.value,
                signDisplayDuration: parseInt(this.elements.signDurationInput.value),
                animationSpeed: this.elements.animationSpeedSelect.value as 'slow' | 'normal' | 'fast',
            };

            this.workerUrl = this.config.workerUrl;
            this.selectedDeviceId = this.config.selectedDeviceId;

            console.log('[Config] Saving config:', this.config);

            // Ensure directory exists
            try {
                await mkdir('', { baseDir: BaseDirectory.AppData, recursive: true });
            } catch (e) {
                // Directory might already exist, ignore error
            }

            await writeTextFile(CONFIG_FILE, JSON.stringify(this.config, null, 2), {
                baseDir: BaseDirectory.AppData,
            });
            console.log('[Config] Config saved successfully');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('[Config] Failed to save config:', message, error);
        }
    }

    private initializeEventListeners(): void {
        this.elements.startBtn.addEventListener('click', () => this.start());
        this.elements.settingsBtn.addEventListener('click', () => this.openSettings());
        this.elements.exitBtn.addEventListener('click', () => this.exitApp());
        this.elements.stopBtn.addEventListener('click', () => this.stop());
        this.elements.toggleDebugBtn.addEventListener('click', () => this.toggleDebug());
        this.elements.saveSettingsBtn.addEventListener('click', async () => await this.saveSettings());
        this.elements.cancelSettingsBtn.addEventListener('click', () => this.showView('menu'));
    }

    private toggleDebug(): void {
        this.isDebugVisible = !this.isDebugVisible;

        if (this.isDebugVisible) {
            this.elements.debugLog.classList.remove('hidden');
            this.elements.toggleDebugBtn.textContent = 'Hide Debug';
        } else {
            this.elements.debugLog.classList.add('hidden');
            this.elements.toggleDebugBtn.textContent = 'Show Debug';
        }
    }

    private async openSettings(): Promise<void> {
        await this.loadAudioDevices();
        this.showView('settings');
    }

    private async loadAudioDevices(): Promise<void> {
        try {
            console.log('[AudioDevices] Requesting microphone permission...');

            // Check if navigator.mediaDevices is available
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('navigator.mediaDevices.getUserMedia not supported');
            }

            // Request microphone permission first to get device labels
            const stream: MediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('[AudioDevices] Permission granted, stream:', stream);
            stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());

            const devices: MediaDeviceInfo[] = await navigator.mediaDevices.enumerateDevices();
            console.log('[AudioDevices] All devices:', devices);

            const audioInputs: MediaDeviceInfo[] = devices.filter((device: MediaDeviceInfo) => device.kind === 'audioinput');
            console.log('[AudioDevices] Audio inputs found:', audioInputs.length);
            audioInputs.forEach((device: MediaDeviceInfo, idx: number) => {
                console.log(`[AudioDevices] Device ${idx + 1}:`, {
                    deviceId: device.deviceId,
                    label: device.label,
                    kind: device.kind,
                    groupId: device.groupId
                });
            });

            this.elements.audioInputSelect.innerHTML = '';

            if (audioInputs.length === 0) {
                console.warn('[AudioDevices] No audio inputs detected');
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'No audio inputs found';
                this.elements.audioInputSelect.appendChild(option);
                return;
            }

            // Add each device with its actual label
            audioInputs.forEach((device: MediaDeviceInfo, index: number) => {
                const option = document.createElement('option');
                option.value = device.deviceId;

                // Use device label or fallback to generic name
                let label = device.label || `Audio Input ${index + 1}`;

                // Clean up label (remove " (Built-in)" or similar suffixes for cleaner display)
                label = label.replace(/\s*\([^)]*\)\s*$/, '').trim();

                option.textContent = label;

                if (device.deviceId === this.selectedDeviceId) {
                    option.selected = true;
                }

                this.elements.audioInputSelect.appendChild(option);
                console.log(`[AudioDevices] Added option: ${label} (${device.deviceId})`);
            });

            // Select first device by default if none selected
            if (!this.selectedDeviceId && audioInputs.length > 0) {
                this.selectedDeviceId = audioInputs[0].deviceId;
                console.log(`[AudioDevices] Auto-selected first device: ${this.selectedDeviceId}`);
            }

            console.log('[AudioDevices] Load complete, total inputs:', audioInputs.length);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('[AudioDevices] Failed to enumerate devices:', message, error);

            this.elements.audioInputSelect.innerHTML = '';
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Error loading devices';
            this.elements.audioInputSelect.appendChild(option);
        }
    }

    private showView(view: AppView): void {
        this.currentView = view;

        this.views.menu.classList.toggle('hidden', view !== 'menu');
        this.views.settings.classList.toggle('hidden', view !== 'settings');
        this.views.recording.classList.toggle('hidden', view !== 'recording');
    }

    private log(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
        const time = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.className = `debug-entry ${type}`;
        entry.innerHTML = `<span class="time">[${time}]</span> ${message}`;
        this.elements.debugLog.appendChild(entry);
        this.elements.debugLog.scrollTop = this.elements.debugLog.scrollHeight;

        console.log(`[${type.toUpperCase()}] ${message}`);
    }

    private async start(): Promise<void> {
        try {
            this.showView('recording');
            this.log('Starting recording...', 'info');

            await this.connectWebSocket();
            await this.startAudioCapture();

            this.isRecording = true;
            this.log('Recording started', 'success');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            this.log(`Failed to start: ${message}`, 'error');
            this.showView('menu');
        }
    }

    private async stop(): Promise<void> {
        this.log('Stopping recording...', 'info');

        this.isRecording = false;

        if (this.audioWorkletNode) {
            this.audioWorkletNode.disconnect();
            this.audioWorkletNode = null;
        }

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
            this.mediaStream = null;
        }

        if (this.audioContext) {
            await this.audioContext.close();
            this.audioContext = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        // Clear displays
        this.signDisplayQueue = [];
        this.elements.signOverlay.classList.add('hidden');
        this.elements.debugLog.innerHTML = '';
        this.elements.debugLog.classList.add('hidden');

        // Reset debug state
        this.isDebugVisible = false;
        this.elements.toggleDebugBtn.textContent = 'Show Debug';

        this.log('Recording stopped', 'success');

        this.showView('menu');
    }

    private async saveSettings(): Promise<void> {
        this.workerUrl = this.elements.workerUrlInput.value.trim();
        this.selectedDeviceId = this.elements.audioInputSelect.value;
        await this.saveConfig();
        this.showView('menu');
    }

    private async exitApp(): Promise<void> {
        if (this.isRecording) {
            await this.stop();
        }
        await exit(0);
    }

    private async connectWebSocket(): Promise<void> {
        return new Promise((resolve: (value: void) => void, reject: (reason?: Error) => void) => {
            if (!this.workerUrl) {
                reject(new Error('Please configure Worker URL in settings'));
                return;
            }

            this.log(`Connecting to ${this.workerUrl}...`, 'info');

            try {
                this.ws = new WebSocket(this.workerUrl);

                this.ws.onopen = () => {
                    this.log('WebSocket connected', 'success');
                    resolve();
                };

                this.ws.onmessage = (event: MessageEvent) => {
                    this.handleMessage(event.data);
                };

                this.ws.onerror = () => {
                    this.log('WebSocket error', 'error');
                    reject(new Error('WebSocket connection failed'));
                };

                this.ws.onclose = () => {
                    this.log('WebSocket disconnected', 'info');
                };
            } catch (error) {
                reject(error as Error);
            }
        });
    }

    private handleMessage(data: string): void {
        try {
            const message: ServerMessage = JSON.parse(data);

            switch (message.type) {
                case 'transcript':
                    this.handleTranscript(message);
                    break;
                case 'signs':
                    this.handleSigns(message);
                    break;
                case 'stats':
                    this.handleStats(message);
                    break;
                case 'error':
                    this.handleError(message);
                    break;
                default:
                    this.log('Unknown message type', 'info');
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            this.log(`Failed to parse message: ${msg}`, 'error');
        }
    }

    private handleTranscript(message: TranscriptMessage): void {
        if (message.is_final) {
            this.log(`📝 "${message.text}"`, 'success');
        } else {
            // Log interim transcript
            console.log(`[Transcript] Interim: "${message.text}"`);
        }
    }

    private async handleSigns(message: SignsMessage): Promise<void> {
        this.log(`🤟 ${message.signs.length} signs for: "${message.text}"`, 'success');

        // Add to display queue
        this.signDisplayQueue.push(...message.signs);

        // Start displaying if not already
        if (!this.isDisplayingSign) {
            await this.displaySignQueue();
        }
    }

    private handleStats(message: StatsMessage): void {
        // Silently log stats to console only
        console.log(`[Stats] ${message.chunks_processed} chunks, ${message.avg_latency_ms}ms avg`);
    }

    private handleError(message: ErrorMessage): void {
        this.log(`Server error: ${message.error}`, 'error');
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
        const duration = this.config.signDisplayDuration || 1500;

        console.log(`[SignDisplay] Showing: ${sign.glosa}`);
        console.log(`[SignDisplay] Images:`, sign.images);

        // Display image sequence by replacing background image
        if (sign.images.length > 1) {
            // Multiple images = movement sequence
            await this.displayImageSequence(sign.images, duration);
        } else if (sign.images.length === 1) {
            // Single static image
            const imagePath = `/signs/${sign.images[0].path}`;
            console.log(`[SignDisplay] Setting background image src to: ${imagePath}`);
            this.elements.bgImage.src = imagePath;

            await this.sleep(duration);
        }

        // Reset to background image
        this.elements.bgImage.src = '/bg.png';
    }

    private async displayImageSequence(images: ImagePath[], totalDuration: number): Promise<void> {
        const durationPerImage = totalDuration / images.length;

        for (let i = 0; i < images.length; i++) {
            const imagePath = `/signs/${images[i].path}`;
            console.log(`[SignDisplay] Sequence ${i + 1}/${images.length}: ${imagePath}`);
            this.elements.bgImage.src = imagePath;

            await this.sleep(durationPerImage);
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ========================================
    // Audio Capture
    // ========================================

    private async startAudioCapture(): Promise<void> {
        this.log('Requesting audio access...', 'info');

        const constraints: MediaStreamConstraints = {
            audio: this.selectedDeviceId
                ? {
                    deviceId: { exact: this.selectedDeviceId },
                    channelCount: 1,
                    sampleRate: 16000,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                }
                : {
                    channelCount: 1,
                    sampleRate: 16000,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                }
        };

        this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

        this.log('Audio access granted', 'success');

        this.audioContext = new AudioContext({ sampleRate: 16000 });

        await this.audioContext.audioWorklet.addModule('/audio-processor.js');

        const source = this.audioContext.createMediaStreamSource(this.mediaStream);

        this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor');

        this.audioWorkletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                const pcmData = event.data;
                this.ws.send(pcmData);
            }
        };

        source.connect(this.audioWorkletNode);
        this.audioWorkletNode.connect(this.audioContext.destination);

        this.log('Audio pipeline initialized', 'success');
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new SignosClient();
});
