// AudioWorklet Processor for PCM conversion
// Runs in a separate thread for better performance

class PCMProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 4096; // Process in chunks
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];

        if (input.length > 0) {
            const channelData = input[0]; // Mono channel

            for (let i = 0; i < channelData.length; i++) {
                this.buffer[this.bufferIndex++] = channelData[i];

                // When buffer is full, convert to PCM and send
                if (this.bufferIndex >= this.bufferSize) {
                    this.sendPCMData();
                    this.bufferIndex = 0;
                }
            }
        }

        // Return true to keep processor alive
        return true;
    }

    sendPCMData() {
        // Convert Float32 samples (-1.0 to 1.0) to Int16 PCM
        const pcmData = new Int16Array(this.bufferSize);

        for (let i = 0; i < this.bufferSize; i++) {
            // Clamp to -1.0 to 1.0 range and convert to 16-bit integer
            const sample = Math.max(-1, Math.min(1, this.buffer[i]));
            pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }

        // Send as ArrayBuffer to main thread
        this.port.postMessage(pcmData.buffer, [pcmData.buffer]);
    }
}

registerProcessor('pcm-processor', PCMProcessor);
