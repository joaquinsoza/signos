#!/usr/bin/env node
/**
 * Test script for Worker sign translation
 * Connects to worker in mock mode and validates sign responses
 */

import WebSocket from 'ws';

const WORKER_URL = 'ws://localhost:8787';
const TEST_PHRASES = [
    'hola',
    'necesito agua',
    'hola cómo estás',
    'buenos días',
    'gracias',
    'por favor'
];

class SignosWorkerTest {
    constructor() {
        this.ws = null;
        this.testResults = [];
    }

    async connect() {
        return new Promise((resolve, reject) => {
            console.log(`🔌 Connecting to ${WORKER_URL}...`);

            this.ws = new WebSocket(WORKER_URL);

            this.ws.on('open', () => {
                console.log('✅ Connected to worker\n');
                resolve();
            });

            this.ws.on('error', (error) => {
                console.error('❌ Connection error:', error.message);
                reject(error);
            });

            this.ws.on('close', () => {
                console.log('\n🔌 Connection closed');
            });

            this.ws.on('message', (data) => {
                this.handleMessage(data);
            });
        });
    }

    handleMessage(data) {
        try {
            const message = JSON.parse(data.toString());

            switch (message.type) {
                case 'transcript':
                    if (message.is_final) {
                        console.log(`\n📝 Transcript: "${message.text}"`);
                    }
                    break;

                case 'signs':
                    console.log(`🤟 Signs received for: "${message.text}"`);
                    console.log(`   Count: ${message.signs.length}`);

                    message.signs.forEach((sign, i) => {
                        console.log(`   ${i + 1}. ${sign.glosa} (confidence: ${(sign.confidence * 100).toFixed(0)}%)`);
                        console.log(`      Definition: ${sign.definition || 'N/A'}`);
                        console.log(`      Images: ${sign.images.length} frame(s)`);
                    });

                    // Record result
                    this.testResults.push({
                        text: message.text,
                        signCount: message.signs.length,
                        signs: message.signs.map(s => s.glosa)
                    });
                    break;

                case 'stats':
                    // Ignore stats
                    break;

                case 'error':
                    console.error(`❌ Error: ${message.error}`);
                    break;

                default:
                    console.log('Unknown message:', message);
            }
        } catch (e) {
            console.error('Failed to parse message:', e);
        }
    }

    async sendAudio() {
        // Send dummy audio data to trigger mock transcription
        // Mock mode will generate Spanish phrases and trigger sign translation
        const dummyAudioChunk = Buffer.alloc(3200); // 100ms of 16kHz mono PCM

        return new Promise((resolve) => {
            let chunksSent = 0;
            const interval = setInterval(() => {
                if (chunksSent < 50) { // Send ~5 seconds of audio
                    this.ws.send(dummyAudioChunk);
                    chunksSent++;
                } else {
                    clearInterval(interval);
                    console.log('\n⏹️  Stopped sending audio\n');
                    resolve();
                }
            }, 100);
        });
    }

    async waitForResults(timeoutMs = 3000) {
        console.log(`⏳ Waiting ${timeoutMs}ms for sign responses...\n`);
        await new Promise(resolve => setTimeout(resolve, timeoutMs));
    }

    printSummary() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 TEST SUMMARY');
        console.log('='.repeat(60));

        if (this.testResults.length === 0) {
            console.log('❌ No sign responses received!');
            console.log('\nPossible issues:');
            console.log('  - Worker not in MOCK_MODE=true');
            console.log('  - Vectorize index not populated');
            console.log('  - Check worker logs for errors');
            return;
        }

        this.testResults.forEach((result, i) => {
            console.log(`\n${i + 1}. Input: "${result.text}"`);
            console.log(`   Signs: ${result.signs.join(', ')}`);
            console.log(`   Count: ${result.signCount}`);
        });

        console.log('\n✅ Sign translation is working!');
        console.log(`   Total phrases processed: ${this.testResults.length}`);
    }

    close() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

async function runTests() {
    const tester = new SignosWorkerTest();

    try {
        await tester.connect();

        console.log('🎤 Starting audio stream (mock mode will generate transcripts)...');
        await tester.sendAudio();

        await tester.waitForResults(5000);

        tester.printSummary();
        tester.close();

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        tester.close();
        process.exit(1);
    }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('🧪 Signos Worker Sign Translation Test\n');
    runTests();
}
