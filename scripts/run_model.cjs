#!/usr/bin/env node
/**
 * NaviAble AI — Direct Model Inference Runner (CommonJS)
 *
 * Runs the real COCO-SSD object detection model and full NaviAble AI
 * processing pipeline (Spatial Localization, Proximity Assessment, Natural Voice Synthesis)
 * on one or more test images.
 *
 * Usage:
 *   node scripts/run_model.cjs                  # Runs on all test_assets/
 *   node scripts/run_model.cjs --all            # Runs on all test_assets/
 *   node scripts/run_model.cjs test_assets/bus.jpg
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const tf = require('@tensorflow/tfjs');
const cocoSsd = require('@tensorflow-models/coco-ssd');

// ─── Proximity Zone Calculations (from proximityEngine.ts) ───
function calcProximity(bbox, imgWidth, imgHeight) {
  const [x, y, w, h] = bbox;
  const frameArea = imgWidth * imgHeight;
  const objArea = w * h;
  const relativeSize = objArea / frameArea;

  let zone = 'FAR';
  let level = 'WARNING';
  if (relativeSize >= 0.25) {
    zone = 'NEAR';
    level = 'CRITICAL';
  } else if (relativeSize >= 0.08) {
    zone = 'MEDIUM';
    level = 'DANGER';
  }

  return {
    relativeSize: (relativeSize * 100).toFixed(1) + '%',
    zone,
    level,
  };
}

// ─── Position Calculation (from objectDetection.ts) ───
function calcPosition(bbox, imgWidth) {
  const centerX = bbox[0] + bbox[2] / 2;
  const rel = centerX / imgWidth;
  if (rel < 0.33) return 'LEFT';
  if (rel > 0.66) return 'RIGHT';
  return 'CENTRE';
}

// ─── Context Engine Natural Language Description (from contextEngine.ts) ───
function generateSceneDescription(detections) {
  if (!detections || detections.length === 0) {
    return 'Navi does not see any recognizable objects in this frame.';
  }

  const counts = {};
  const positions = {};

  detections.forEach((d) => {
    counts[d.class] = (counts[d.class] || 0) + 1;
    if (!positions[d.class]) positions[d.class] = new Set();
    positions[d.class].add(d.position);
  });

  const parts = Object.keys(counts).map((cls) => {
    const count = counts[cls];
    const posArr = Array.from(positions[cls]);
    let posStr = 'in the centre';
    if (posArr.length === 1) {
      posStr = posArr[0] === 'LEFT' ? 'on the left' : posArr[0] === 'RIGHT' ? 'on the right' : 'in the centre';
    } else {
      posStr = 'across your field of view';
    }
    const plural = count === 1 ? `a ${cls}` : `${count} ${cls}s`;
    return `${plural} ${posStr}`;
  });

  if (parts.length === 1) return `Navi can see ${parts[0]}.`;
  if (parts.length === 2) return `Navi can see ${parts[0]} and ${parts[1]}.`;
  const last = parts.pop();
  return `Navi can see ${parts.join(', ')}, and ${last}.`;
}

async function processImage(model, imagePath) {
  const baseName = path.basename(imagePath);
  const image = sharp(imagePath);
  const metadata = await image.metadata();

  const { data, info } = await image
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const tensor = tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3], 'int32');

  const inferStart = Date.now();
  const rawPredictions = await model.detect(tensor);
  const inferDuration = Date.now() - inferStart;
  tensor.dispose();

  const processedDetections = rawPredictions.map((pred) => {
    const pos = calcPosition(pred.bbox, info.width);
    const prox = calcProximity(pred.bbox, info.width, info.height);
    return {
      class: pred.class,
      score: Math.round(pred.score * 100),
      bbox: pred.bbox.map((v) => Math.round(v)),
      position: pos,
      proximity: prox,
    };
  });

  const voiceAnnouncement = generateSceneDescription(processedDetections);

  return {
    file: baseName,
    dimensions: `${info.width} × ${info.height}`,
    durationMs: inferDuration,
    detections: processedDetections,
    announcement: voiceAnnouncement,
  };
}

async function main() {
  const args = process.argv.slice(2);
  let targetFiles = [];

  const testAssetsDir = path.resolve(process.cwd(), 'test_assets');

  if (args.length === 0 || args.includes('--all')) {
    if (fs.existsSync(testAssetsDir)) {
      targetFiles = fs.readdirSync(testAssetsDir)
        .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
        .map((f) => path.join(testAssetsDir, f));
    }
  } else {
    targetFiles = args.map((arg) => path.resolve(process.cwd(), arg));
  }

  if (targetFiles.length === 0) {
    console.error('[ERROR] No image files found to process.');
    process.exit(1);
  }

  console.log('==============================================================');
  console.log('       NAVIABLE AI — REAL IN-BROWSER MODEL INFERENCE ENGINE    ');
  console.log('       Beyond Vision. Beyond Limits.                         ');
  console.log('==============================================================\n');

  console.log(`[1/3] Loading pretrained COCO-SSD (MobileNet v2)...`);
  const loadStart = Date.now();
  const model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
  const loadDuration = Date.now() - loadStart;
  console.log(`      Model ready in ${loadDuration} ms.\n`);

  console.log(`[2/3] Processing ${targetFiles.length} image(s)...`);
  console.log('--------------------------------------------------------------');

  const summary = [];

  for (let idx = 0; idx < targetFiles.length; idx++) {
    const filePath = targetFiles[idx];
    if (!fs.existsSync(filePath)) {
      console.warn(`[WARN] Skipping missing file: ${filePath}`);
      continue;
    }

    const res = await processImage(model, filePath);
    summary.push(res);

    console.log(`\n📸 Frame [${idx + 1}/${targetFiles.length}]: ${res.file} (${res.dimensions})`);
    console.log(`   Inference Time: ${res.durationMs} ms | Detections: ${res.detections.length}`);

    if (res.detections.length === 0) {
      console.log('   No objects detected with confidence >= 50%.');
    } else {
      res.detections.forEach((d, i) => {
        console.log(
          `   #${i + 1} ${d.class.toUpperCase()} (${d.score}%) | ${d.position} sector | Proximity: ${d.proximity.zone} (${d.proximity.relativeSize}) [${d.proximity.level}]`
        );
      });
    }

    console.log(`   🔊 Spoken: "${res.announcement}"`);
  }

  console.log('\n==============================================================');
  console.log('[3/3] Inference Batch Summary:');
  console.log('--------------------------------------------------------------');
  summary.forEach((s) => {
    const classes = s.detections.map((d) => `${d.class}(${d.score}%)`).join(', ') || 'None';
    console.log(`• ${s.file.padEnd(14)} | ${s.durationMs.toString().padStart(4)} ms | ${classes}`);
  });

  const totalInferMs = summary.reduce((acc, s) => acc + s.durationMs, 0);
  const avgInferMs = Math.round(totalInferMs / summary.length);
  console.log('--------------------------------------------------------------');
  console.log(`Average inference latency per frame: ${avgInferMs} ms (~${(1000 / avgInferMs).toFixed(1)} FPS CPU)`);
  console.log('✅ Real neural network inference run complete across all assets.\n');
}

main().catch((err) => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
