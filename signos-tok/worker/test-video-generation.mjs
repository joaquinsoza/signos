/**
 * Test script for signos-tok Worker
 * 
 * Usage:
 *   node test-video-generation.mjs
 * 
 * Prerequisites:
 *   - Worker running on http://localhost:8787
 *   - Run: pnpm dev
 */

const WORKER_URL = 'http://localhost:8787';

async function testGenerateVideo() {
  console.log('🎬 Testing video generation...\n');

  const scripts = [
    'hola',
    'hola necesito agua',
    'buenos días cómo estás',
    'gracias por todo'
  ];

  for (const script of scripts) {
    console.log(`\n📝 Script: "${script}"`);
    console.log('─'.repeat(60));

    try {
      const response = await fetch(`${WORKER_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script,
          settings: {
            fps: 30,
            signDuration: 1500,
            width: 720,
            height: 1280,
            format: 'mp4'
          }
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log(`✅ Success!`);
        console.log(`   Video ID: ${result.videoId}`);
        console.log(`   Video URL: ${result.videoUrl}`);
        console.log(`   Duration: ${result.duration.toFixed(2)}s`);
        console.log(`   Processing time: ${result.processingTime}ms`);
        console.log(`   Signs (${result.signs.length}):`);
        
        result.signs.forEach(sign => {
          console.log(`     - ${sign.glosa} (${sign.images.length} images, confidence: ${sign.confidence.toFixed(2)})`);
        });
      } else {
        console.log(`❌ Failed: ${result.error}`);
      }

    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

async function testTranslate() {
  console.log('\n\n🔤 Testing translation (no video)...\n');

  const texts = [
    'hola mundo',
    'necesito ayuda',
    'gracias'
  ];

  for (const text of texts) {
    console.log(`\n📝 Text: "${text}"`);
    
    try {
      const response = await fetch(`${WORKER_URL}/api/translate?text=${encodeURIComponent(text)}`);
      const result = await response.json();

      if (result.success) {
        console.log(`✅ Found ${result.signs.length} signs:`);
        result.signs.forEach(sign => {
          console.log(`   - ${sign.glosa}: ${sign.definition}`);
        });
      } else {
        console.log(`❌ Failed: ${result.error}`);
      }

    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

async function testListVideos() {
  console.log('\n\n📋 Testing list videos...\n');

  try {
    const response = await fetch(`${WORKER_URL}/api/videos`);
    const result = await response.json();

    if (result.success) {
      console.log(`✅ Found ${result.count} videos:`);
      result.videos.forEach(videoId => {
        console.log(`   - ${videoId}`);
      });
    } else {
      console.log(`❌ Failed: ${result.error}`);
    }

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

async function main() {
  console.log('═'.repeat(60));
  console.log('🤟 signos-tok Worker Test Suite');
  console.log('═'.repeat(60));

  // Check if worker is running
  try {
    const response = await fetch(WORKER_URL);
    if (!response.ok) {
      throw new Error('Worker not responding');
    }
  } catch (error) {
    console.log('\n❌ Error: Worker not running on http://localhost:8787');
    console.log('   Start it with: pnpm dev\n');
    process.exit(1);
  }

  await testTranslate();
  await testGenerateVideo();
  await testListVideos();

  console.log('\n═'.repeat(60));
  console.log('✅ All tests completed!');
  console.log('═'.repeat(60));
  console.log('\nNext steps:');
  console.log('  1. Check video manifest: curl http://localhost:8787/api/videos/[video_id]');
  console.log('  2. View all videos: curl http://localhost:8787/api/videos');
  console.log('  3. Delete video: curl -X DELETE http://localhost:8787/api/videos/[video_id]\n');
}

main();

