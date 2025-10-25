#!/usr/bin/env node

/**
 * CLI for generating sign language videos from text scripts
 * 
 * Usage:
 *   node generate-video.mjs "hola necesito agua"
 *   node generate-video.mjs --file script.txt
 *   node generate-video.mjs --interactive
 * 
 * Options:
 *   --worker-url URL    Worker URL (default: http://localhost:8787)
 *   --file PATH         Read script from file
 *   --output PATH       Save manifest to file
 *   --fps N             Video FPS (default: 30)
 *   --duration N        Milliseconds per sign (default: 1500)
 *   --width N           Video width (default: 720)
 *   --height N          Video height (default: 1280)
 *   --format FORMAT     Output format: mp4|webm (default: mp4)
 *   --interactive       Interactive mode
 *   --help              Show this help
 */

import { readFileSync, writeFileSync } from 'fs';
import { createInterface } from 'readline';

const args = process.argv.slice(2);

// Default configuration
const config = {
  workerUrl: 'http://localhost:8787',
  script: '',
  file: null,
  output: null,
  settings: {
    fps: 30,
    signDuration: 1500,
    width: 720,
    height: 1280,
    format: 'mp4'
  },
  interactive: false,
  help: false
};

// Parse arguments
for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--worker-url':
      config.workerUrl = args[++i];
      break;
    case '--file':
      config.file = args[++i];
      break;
    case '--output':
      config.output = args[++i];
      break;
    case '--fps':
      config.settings.fps = parseInt(args[++i]);
      break;
    case '--duration':
      config.settings.signDuration = parseInt(args[++i]);
      break;
    case '--width':
      config.settings.width = parseInt(args[++i]);
      break;
    case '--height':
      config.settings.height = parseInt(args[++i]);
      break;
    case '--format':
      config.settings.format = args[++i];
      break;
    case '--interactive':
      config.interactive = true;
      break;
    case '--help':
      config.help = true;
      break;
    default:
      if (!args[i].startsWith('--')) {
        config.script = args[i];
      }
  }
}

function showHelp() {
  console.log(`
🤟 signos-tok CLI - Generate Sign Language Videos

Usage:
  node generate-video.mjs "your script here"
  node generate-video.mjs --file script.txt
  node generate-video.mjs --interactive

Options:
  --worker-url URL    Worker URL (default: http://localhost:8787)
  --file PATH         Read script from file
  --output PATH       Save manifest to file
  --fps N             Video FPS (default: 30)
  --duration N        Milliseconds per sign (default: 1500)
  --width N           Video width (default: 720)
  --height N          Video height (default: 1280)
  --format FORMAT     Output format: mp4|webm (default: mp4)
  --interactive       Interactive mode
  --help              Show this help

Examples:
  node generate-video.mjs "hola necesito agua"
  node generate-video.mjs --file script.txt --output video.json
  node generate-video.mjs --interactive --worker-url https://your-worker.dev
`);
  process.exit(0);
}

async function generateVideo(script) {
  console.log(`\n📝 Script: "${script}"`);
  console.log('─'.repeat(60));

  try {
    console.log('⏳ Translating to signs...');
    
    const response = await fetch(`${config.workerUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        script,
        settings: config.settings
      })
    });

    const result = await response.json();

    if (!result.success) {
      console.log(`❌ Error: ${result.error}`);
      return null;
    }

    console.log(`✅ Video generated successfully!\n`);
    console.log(`📹 Video ID: ${result.videoId}`);
    console.log(`🔗 Video URL: ${config.workerUrl}${result.videoUrl}`);
    console.log(`⏱️  Duration: ${result.duration.toFixed(2)}s`);
    console.log(`🚀 Processing time: ${result.processingTime}ms\n`);
    
    console.log(`🤟 Signs (${result.signs.length}):`);
    result.signs.forEach((sign, i) => {
      console.log(`  ${i + 1}. ${sign.glosa}`);
      console.log(`     Definition: ${sign.definition}`);
      console.log(`     Images: ${sign.images.length}`);
      console.log(`     Confidence: ${(sign.confidence * 100).toFixed(1)}%`);
    });

    // Save to file if requested
    if (config.output) {
      writeFileSync(config.output, JSON.stringify(result, null, 2));
      console.log(`\n💾 Saved to: ${config.output}`);
    }

    console.log('\n' + '─'.repeat(60));
    console.log(`\n🎬 Next steps:`);
    console.log(`   1. Get manifest: curl ${config.workerUrl}${result.videoUrl}`);
    console.log(`   2. Render video using the manifest and sign images\n`);

    return result;

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return null;
  }
}

async function interactiveMode() {
  console.log('\n🤟 signos-tok Interactive Mode');
  console.log('Type your script and press Enter. Type "exit" to quit.\n');

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const prompt = () => {
    rl.question('📝 Script: ', async (script) => {
      if (script.toLowerCase() === 'exit') {
        console.log('\n👋 Goodbye!\n');
        rl.close();
        return;
      }

      if (script.trim()) {
        await generateVideo(script.trim());
      }

      prompt();
    });
  };

  prompt();
}

async function main() {
  console.log('═'.repeat(60));
  console.log('🤟 signos-tok CLI - Sign Language Video Generator');
  console.log('═'.repeat(60));

  if (config.help) {
    showHelp();
  }

  // Check worker connectivity
  try {
    const response = await fetch(config.workerUrl);
    if (!response.ok) throw new Error('Worker not responding');
    console.log(`✅ Connected to worker: ${config.workerUrl}\n`);
  } catch (error) {
    console.log(`\n❌ Error: Cannot connect to worker at ${config.workerUrl}`);
    console.log(`   Make sure the worker is running: pnpm dev\n`);
    process.exit(1);
  }

  // Interactive mode
  if (config.interactive) {
    await interactiveMode();
    return;
  }

  // File mode
  if (config.file) {
    try {
      const script = readFileSync(config.file, 'utf-8').trim();
      await generateVideo(script);
    } catch (error) {
      console.log(`❌ Error reading file: ${error.message}`);
      process.exit(1);
    }
    return;
  }

  // Direct script mode
  if (config.script) {
    await generateVideo(config.script);
    return;
  }

  // No input provided
  console.log('\n❌ Error: No script provided');
  console.log('   Use --help for usage information\n');
  process.exit(1);
}

main();

