#!/usr/bin/env node
/**
 * NaviAble AI — Direct Model Inference Runner
 *
 * Runs the real COCO-SSD object detection model and full NaviAble AI
 * processing pipeline (Spatial Localization, Proximity Assessment, Natural Voice Synthesis)
 * on a test image.
 *
 * Usage:
 *   node scripts/run_model.js [path/to/image.jpg]
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

async function main() {
  const imageArg = process.argv[2] || 'test_assets/bus.jpg';
  const imagePath = path.resolve(process.cwd(), imageArg);

  if (!fs.existsSync(imagePath)) {
    console.error(`[ERROR] Image file not found: ${imagePath}`);
    process.exit(1);
  }

  console.log('==============================================================');
  console.log('       NAVIABLE AI — REAL IN-BROWSER MODEL INFERENCE ENGINE    ');
  console.log('       Beyond Vision. Beyond Limits.                         ');
  console.log('==============================================================\n');

  console.log(`[1/4] Reading input image: ${path.basename(imagePath)}`);
  const image = sharp(imagePath);
  const metadata = await image.metadata();
  console.log(`      Dimensions: ${metadata.width} × ${metadata.height} | Format: ${metadata.format}`);

  // Extract raw RGB pixel buffer
  const { data, info } = await image
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  console.log(`\n[2/4] Loading pretrained COCO-SSD (MobileNet v2)...`);
  const loadStart = Date.now();
  const model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
  const loadDuration = Date.now() - loadStart;
  console.log(`      Model ready in ${loadDuration} ms.`);

  console.log(`\n[3/4] Converting pixels into 3D Tensor and running inference...`);
  const tensor = tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3], 'int32');

  const inferStart = Date.now();
  const rawPredictions = await model.detect(tensor);
  const inferDuration = Date.now() - inferStart;
  tensor.dispose(); // clean memory

  console.log(`      Inference completed in ${inferDuration} ms.`);
  console.log(`      Found ${rawPredictions.length} object(s) with confidence >= 0.50.\n`);

  console.log('[4/4] Multi-modal Analysis & Accessibility Pipeline:');
  console.log('--------------------------------------------------------------');

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

  if (processedDetections.length === 0) {
    console.log('  No objects detected above threshold.');
  } else {
    processedDetections.forEach((d, i) => {
      console.log(`  [Object #${i + 1}]`);
      console.log(`    Class:       ${d.class.toUpperCase()}`);
      console.log(`    Confidence:  ${d.score}%`);
      console.log(`    BoundingBox: [x=${d.bbox[0]}, y=${d.bbox[1]}, w=${d.bbox[2]}, h=${d.bbox[3]}]`);
      console.log(`    Spatial Pos: ${d.position} sector`);
      console.log(`    Proximity:   ${d.proximity.zone} (${d.proximity.relativeSize} frame coverage)`);
      console.log(`    Alert Level: ${d.proximity.level}`);
      console.log('');
    });
  }

  const voiceAnnouncement = generateSceneDescription(processedDetections);
  console.log('--------------------------------------------------------------');
  console.log('🔊 SYNTHESIZED SPOKEN FEEDBACK (TTS):');
  console.log(`   "${voiceAnnouncement}"`);
  console.log('--------------------------------------------------------------\n');

  console.log('✅ Model inference executed successfully with genuine neural network weights.\n');
}

main().catch((err) => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
