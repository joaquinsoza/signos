import { useState, useRef } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';

const WORKER_URL = 'wss://signos-stt-worker.joaquinsozag.workers.dev';

interface SignImage {
  path: string;
  sequence: number;
}

interface Sign {
  glosa: string;
  images: SignImage[];
  definition: string;
  confidence: number;
}

interface TranscriptMessage {
  type: 'transcript';
  text: string;
  is_final: boolean;
  timestamp: number;
  latency_ms?: number;
}

interface SignsMessage {
  type: 'signs';
  text: string;
  signs: Sign[];
  timestamp: number;
}

interface ErrorMessage {
  type: 'error';
  error: string;
  timestamp: number;
}

type ServerMessage = TranscriptMessage | SignsMessage | ErrorMessage;

export default function SpeechToSign() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [currentSigns, setCurrentSigns] = useState<Sign[]>([]);
  const [currentSignIndex, setCurrentSignIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const displayTimeoutRef = useRef<number | null>(null);

  const connectWebSocket = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      console.log('[WebSocket] Connecting to:', WORKER_URL);
      
      const ws = new WebSocket(WORKER_URL);
      
      ws.onopen = () => {
        console.log('[WebSocket] Connected');
        wsRef.current = ws;
        setError(null);
        resolve();
      };
      
      ws.onmessage = (event) => {
        try {
          const message: ServerMessage = JSON.parse(event.data);
          console.log('[WebSocket] Message:', message);
          
          switch (message.type) {
            case 'transcript':
              if (message.is_final) {
                setTranscript(message.text);
                setInterimTranscript('');
                // Clear after 3 seconds
                if (displayTimeoutRef.current) clearTimeout(displayTimeoutRef.current);
                displayTimeoutRef.current = window.setTimeout(() => {
                  setTranscript('');
                }, 3000);
              } else {
                setInterimTranscript(message.text);
              }
              break;
              
            case 'signs':
              console.log('[Signs] Received', message.signs.length, 'signs');
              setCurrentSigns(message.signs);
              setCurrentSignIndex(0);
              displaySignSequence(message.signs);
              break;
              
            case 'error':
              console.error('[Server Error]:', message.error);
              setError(message.error);
              break;
          }
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };
      
      ws.onerror = (event) => {
        console.error('[WebSocket] Error:', event);
        setError('Error de conexión con el servidor');
        reject(new Error('WebSocket connection failed'));
      };
      
      ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        wsRef.current = null;
      };
    });
  };

  const startAudioCapture = async (): Promise<void> => {
    try {
      console.log('[Audio] Requesting microphone access...');
      
      const constraints: MediaStreamConstraints = {
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;
      
      console.log('[Audio] Access granted');
      
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      
      await audioContext.audioWorklet.addModule('/audio-processor.js');
      
      const source = audioContext.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
      audioWorkletNodeRef.current = workletNode;
      
      workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(event.data);
        }
      };
      
      source.connect(workletNode);
      workletNode.connect(audioContext.destination);
      
      console.log('[Audio] Pipeline initialized');
    } catch (error) {
      console.error('[Audio] Failed to start:', error);
      throw error;
    }
  };

  const stopAudioCapture = async (): Promise<void> => {
    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.disconnect();
      audioWorkletNodeRef.current = null;
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    if (displayTimeoutRef.current) {
      clearTimeout(displayTimeoutRef.current);
    }
  };

  const toggleListening = async () => {
    if (!isListening) {
      try {
        setError(null);
        await connectWebSocket();
        await startAudioCapture();
        setIsListening(true);
      } catch (error) {
        console.error('[Start] Failed:', error);
        setError('No se pudo iniciar la captura de audio');
        await stopAudioCapture();
      }
    } else {
      await stopAudioCapture();
      setIsListening(false);
      setTranscript('');
      setInterimTranscript('');
      setCurrentSigns([]);
    }
  };

  const displaySignSequence = (signs: Sign[]) => {
    let index = 0;
    
    const interval = setInterval(() => {
      index++;
      if (index >= signs.length) {
        clearInterval(interval);
        setTimeout(() => {
          setCurrentSigns([]);
        }, 2000);
      } else {
        setCurrentSignIndex(index);
      }
    }, 2000);
  };

  const currentSign = currentSigns[currentSignIndex];
  const currentImage = currentSign?.images?.[0]?.path;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Volume2 className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Voz a Señas</h1>
              <p className="text-sm text-gray-400">Habla y ve las señas en tiempo real</p>
            </div>
          </div>
          <a
            href="/"
            className="text-gray-400 hover:text-white transition-colors"
          >
            ← Volver al chat
          </a>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left: Controls & Transcript */}
          <div className="space-y-6">
            {/* Microphone Control */}
            <div className="bg-gray-800 rounded-2xl p-8 text-center space-y-6">
              <h2 className="text-xl font-semibold">Control de Micrófono</h2>
              
              <button
                onClick={toggleListening}
                className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 mx-auto ${
                  isListening
                    ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                    : 'bg-primary hover:bg-primary-dark'
                }`}
              >
                {isListening ? (
                  <MicOff className="w-16 h-16" />
                ) : (
                  <Mic className="w-16 h-16" />
                )}
              </button>

              <p className="text-lg">
                {isListening ? (
                  <span className="text-green-400">🎤 Escuchando...</span>
                ) : (
                  <span className="text-gray-400">Click para empezar</span>
                )}
              </p>

              {error && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>

            {/* Transcript Display */}
            <div className="bg-gray-800 rounded-2xl p-6 min-h-[200px]">
              <h3 className="text-lg font-semibold mb-4">Transcripción</h3>
              <div className="text-2xl">
                <div className="text-gray-300">{transcript}</div>
                <div className="text-gray-500 italic">{interimTranscript}</div>
                {!transcript && !interimTranscript && (
                  <span className="text-gray-500 italic">
                    {isListening ? 'Habla ahora...' : 'Activa el micrófono para comenzar'}
                  </span>
                )}
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-gray-800 rounded-2xl p-6 space-y-3">
              <h3 className="text-lg font-semibold">Instrucciones</h3>
              
              {/* Disclaimer */}
              <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-3 text-sm text-yellow-200">
                ⏱️ <strong>Nota:</strong> La primera conexión puede demorar unos segundos en iniciar.
              </div>

              <ul className="space-y-2 text-gray-400 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-primary">1.</span>
                  <span>Click en el botón del micrófono</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">2.</span>
                  <span>Permite el acceso al micrófono en tu navegador</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">3.</span>
                  <span>Habla claramente en español</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">4.</span>
                  <span>Las señas aparecerán automáticamente</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Right: Sign Display */}
          <div className="bg-gray-800 rounded-2xl p-8 flex flex-col items-center justify-center min-h-[600px]">
            {currentSign ? (
              <div className="space-y-6 text-center w-full">
                <div className="relative w-full aspect-square max-w-md mx-auto bg-gray-900 rounded-xl overflow-hidden">
                  {currentImage ? (
                    <img
                      src={`/signs/${currentImage}`}
                      alt={currentSign.glosa}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                      Sin imagen
                    </div>
                  )}
                </div>
                
                <div>
                  <h2 className="text-4xl font-bold mb-2">{currentSign.glosa}</h2>
                  <p className="text-gray-400 text-lg">{currentSign.definition}</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Confianza: {Math.round(currentSign.confidence * 100)}%
                  </p>
                  
                  {currentSigns.length > 1 && (
                    <p className="text-sm text-primary mt-4">
                      Seña {currentSignIndex + 1} de {currentSigns.length}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 space-y-4">
                <div className="text-6xl mb-4">🤟</div>
                <p className="text-xl">Las señas aparecerán aquí</p>
                <p className="text-sm">Activa el micrófono y comienza a hablar</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

