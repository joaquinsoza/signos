// Signos - Minimal STT Client

import { exit } from '@tauri-apps/plugin-process';

interface TranscriptMessage {
    type: 'transcript';
    text: string;
    is_final: boolean;
    timestamp: number;
    latency_ms: number;
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

type ServerMessage = TranscriptMessage | StatsMessage | ErrorMessage;
type AppView = 'menu' | 'settings' | 'recording';

class SignosClient {
    private currentView: AppView = 'menu';
    private ws: WebSocket | null = null;
    private audioContext: AudioContext | null = null;
    private mediaStream: MediaStream | null = null;
    private audioWorkletNode: AudioWorkletNode | null = null;
    private isRecording: boolean = false;
    private workerUrl: string = 'ws://localhost:8787';
    private selectedDeviceId: string = '';

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
        workerUrlInput: HTMLInputElement;
        audioInputSelect: HTMLSelectElement;
        saveSettingsBtn: HTMLButtonElement;
        cancelSettingsBtn: HTMLButtonElement;
        debugLog: HTMLDivElement;
    };

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
            workerUrlInput: document.getElementById('workerUrl') as HTMLInputElement,
            audioInputSelect: document.getElementById('audioInput') as HTMLSelectElement,
            saveSettingsBtn: document.getElementById('saveSettingsBtn') as HTMLButtonElement,
            cancelSettingsBtn: document.getElementById('cancelSettingsBtn') as HTMLButtonElement,
            debugLog: document.getElementById('debugLog') as HTMLDivElement,
        };

        this.initializeEventListeners();
        this.loadAudioDevices();
        this.showView('menu');
    }

    private initializeEventListeners(): void {
        this.elements.startBtn.addEventListener('click', () => this.start());
        this.elements.settingsBtn.addEventListener('click', () => this.openSettings());
        this.elements.exitBtn.addEventListener('click', () => this.exitApp());
        this.elements.stopBtn.addEventListener('click', () => this.stop());
        this.elements.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        this.elements.cancelSettingsBtn.addEventListener('click', () => this.showView('menu'));
    }

    private async openSettings(): Promise<void> {
        await this.loadAudioDevices();
        this.showView('settings');
    }

    private async loadAudioDevices(): Promise<void> {
        try {
            // Request microphone permission first to get device labels
            const stream: MediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());

            const devices: MediaDeviceInfo[] = await navigator.mediaDevices.enumerateDevices();
            const audioInputs: MediaDeviceInfo[] = devices.filter((device: MediaDeviceInfo) => device.kind === 'audioinput');

            this.elements.audioInputSelect.innerHTML = '';

            if (audioInputs.length === 0) {
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
            });

            // Select first device by default if none selected
            if (!this.selectedDeviceId && audioInputs.length > 0) {
                this.selectedDeviceId = audioInputs[0].deviceId;
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('Failed to enumerate devices:', message);

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

        this.log('Recording stopped', 'success');

        // Clear debug log
        this.elements.debugLog.innerHTML = '';

        this.showView('menu');
    }

    private saveSettings(): void {
        this.workerUrl = this.elements.workerUrlInput.value.trim();
        this.selectedDeviceId = this.elements.audioInputSelect.value;
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
        this.log(`"${message.text}" (${message.latency_ms}ms)`, 'success');
    }

    private handleStats(message: StatsMessage): void {
        this.log(`Stats: ${message.chunks_processed} chunks, ${message.avg_latency_ms}ms avg`, 'info');
    }

    private handleError(message: ErrorMessage): void {
        this.log(`Server error: ${message.error}`, 'error');
    }

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
