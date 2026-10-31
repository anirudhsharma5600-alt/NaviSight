const ort = require('onnxruntime-web');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const CLASSES = ['INR_10', 'INR_20', 'INR_50', 'INR_100', 'INR_200', 'INR_500', 'INR_2000'];
const IMAGENET_MEAN = [0.485, 0.456, 0.406];
const IMAGENET_STD = [0.229, 0.224, 0.225];

function softmax(arr) {
  let max = -Infinity;
  for (let v of arr) if (v > max) max = v;
  const exp = arr.map(v => Math.exp(v - max));
  const sum = exp.reduce((a, b) => a + b, 0);
  return exp.map(v => v / sum);
}

// Exactly emulate extractTensorFromRegion from currencyDetection.ts
async function extractTensorFromRegionEmulation(imgPath, isMobilePortrait = true) {
  const meta = await sharp(imgPath).metadata();
  const srcWidth = meta.width;
  const srcHeight = meta.height;

  let sx = 0, sy = 0, sw = srcWidth, sh = srcHeight;
  if (isMobilePortrait) {
    // Mobile Portrait: height > width
    // In actual phone: phone is held upright, so srcHeight > srcWidth
    sw = Math.round(srcWidth * 0.90);
    sh = Math.round(sw / 2.25);
    sx = Math.round((srcWidth - sw) / 2);
    sy = Math.round((srcHeight - sh) / 2);
  } else {
    // Landscape
    sw = Math.round(srcWidth * 0.72);
    sh = Math.round(sw / 2.25);
    sx = Math.round((srcWidth - sw) / 2);
    sy = Math.round((srcHeight - sh) / 2);
  }

  // Ensure crop is within bounds
  sx = Math.max(0, Math.min(srcWidth - 1, sx));
  sy = Math.max(0, Math.min(srcHeight - 1, sy));
  sw = Math.max(10, Math.min(srcWidth - sx, sw));
  sh = Math.max(10, Math.min(srcHeight - sy, sh));

  console.log(`Original dimensions: ${srcWidth}x${srcHeight}, Crop box: [sx=${sx}, sy=${sy}, sw=${sw}, sh=${sh}]`);

  const { data } = await sharp(imgPath)
    .extract({ left: sx, top: sy, width: sw, height: sh })
    .resize(224, 224, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const floatData = new Float32Array(3 * 224 * 224);
  const total = 224 * 224;
  let sumR = 0, sumG = 0, sumB = 0;
  let minBrightness = 255, maxBrightness = 0;
  let laplacianSum = 0;

  for (let i = 0; i < total; i++) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];

    sumR += r; sumG += g; sumB += b;
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    if (luma < minBrightness) minBrightness = luma;
    if (luma > maxBrightness) maxBrightness = luma;

    floatData[i] = (r / 255.0 - IMAGENET_MEAN[0]) / IMAGENET_STD[0];
    floatData[total + i] = (g / 255.0 - IMAGENET_MEAN[1]) / IMAGENET_STD[1];
    floatData[total * 2 + i] = (b / 255.0 - IMAGENET_MEAN[2]) / IMAGENET_STD[2];

    if (i % 224 < 223) {
      const nextR = data[(i + 1) * 3];
      const nextG = data[(i + 1) * 3 + 1];
      const nextB = data[(i + 1) * 3 + 2];
      const nextLuma = 0.299 * nextR + 0.587 * nextG + 0.114 * nextB;
      laplacianSum += Math.abs(nextLuma - luma);
    }
  }

  const contrast = maxBrightness - minBrightness;
  const blurScore = laplacianSum / total;

  return {
    tensor: new ort.Tensor('float32', floatData, [1, 3, 224, 224]),
    chroma: {
      r: sumR / total,
      g: sumG / total,
      b: sumB / total,
      contrast
    },
    blurScore
  };
}

// Direct full image resize (no crop) for reference comparison
async function extractTensorFullDirect(imgPath) {
  const { data } = await sharp(imgPath)
    .resize(224, 224, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const floatData = new Float32Array(3 * 224 * 224);
  const total = 224 * 224;
  let sumR = 0, sumG = 0, sumB = 0;
  let minBrightness = 255, maxBrightness = 0;

  for (let i = 0; i < total; i++) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];
    sumR += r; sumG += g; sumB += b;
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    if (luma < minBrightness) minBrightness = luma;
    if (luma > maxBrightness) maxBrightness = luma;
    floatData[i] = (r / 255.0 - IMAGENET_MEAN[0]) / IMAGENET_STD[0];
    floatData[total + i] = (g / 255.0 - IMAGENET_MEAN[1]) / IMAGENET_STD[1];
    floatData[total * 2 + i] = (b / 255.0 - IMAGENET_MEAN[2]) / IMAGENET_STD[2];
  }

  return {
    tensor: new ort.Tensor('float32', floatData, [1, 3, 224, 224]),
    chroma: {
      r: sumR / total,
      g: sumG / total,
      b: sumB / total,
      contrast: maxBrightness - minBrightness
    },
    blurScore: 10
  };
}

async function runForensics() {
  console.log('--- FORENSIC STEP 1: MODEL INSPECTION ---');
  const modelPath = path.resolve('public/models/currency/model.onnx');
  console.log('Model path:', modelPath);
  console.log('Model exists:', fs.existsSync(modelPath));
  const stats = fs.statSync(modelPath);
  console.log('Model size:', stats.size, 'bytes');

  const session = await ort.InferenceSession.create(modelPath);
  console.log('Session initialized successfully!');
  console.log('Input names:', session.inputNames);
  console.log('Output names:', session.outputNames);

  console.log('\n--- FORENSIC STEP 2: TEST INFERENCE ON ₹500 SAMPLES ---');

  const testCases = [
    { label: '500 Old Series (Obverse)', file: 'ml/currency_recognition/raw_samples/500_old_obverse.jpg' },
    { label: '500 Old Series (Reverse)', file: 'ml/currency_recognition/raw_samples/500_old_reverse.jpg' },
    { label: '500 New Series (Obverse)', file: 'ml/currency_recognition/raw_samples/500_obverse.jpg' },
    { label: '500 New Series (Reverse)', file: 'ml/currency_recognition/raw_samples/500_reverse.jpg' },
    { label: '100 New Series (Obverse)', file: 'ml/currency_recognition/raw_samples/100_obverse.png' },
    { label: '100 Old Series (Obverse)', file: 'ml/currency_recognition/raw_samples/100_old_obverse.jpg' },
  ];

  for (const tc of testCases) {
    console.log(`\n========================================`);
    console.log(`Test: ${tc.label} [${tc.file}]`);
    console.log(`========================================`);

    // Mode A: Direct Full Image (like training)
    const directData = await extractTensorFullDirect(tc.file);
    const outDirect = await session.run({ input: directData.tensor });
    const directLogits = Array.from(outDirect.output.data);
    const directProbs = softmax(directLogits);
    let topDirectIdx = 0;
    for (let i = 1; i < directProbs.length; i++) {
      if (directProbs[i] > directProbs[topDirectIdx]) topDirectIdx = i;
    }
    console.log('[DIRECT FULL RESIZE]');
    console.log('Raw Logits:', directLogits.map(v => v.toFixed(3)).join(', '));
    console.log('Softmax Probs:', CLASSES.map((c, i) => `${c}: ${(directProbs[i]*100).toFixed(1)}%`).join(' | '));
    console.log(`Top-1: ${CLASSES[topDirectIdx]} (${(directProbs[topDirectIdx]*100).toFixed(2)}%)`);

    // Mode B: 2.25:1 Center Aspect Ratio Crop (currencyDetection.ts runtime behavior)
    // Note: raw sample images are horizontal/landscape (w > h)
    const cropData = await extractTensorFromRegionEmulation(tc.file, false);
    const outCrop = await session.run({ input: cropData.tensor });
    const cropLogits = Array.from(outCrop.output.data);
    const cropProbs = softmax(cropLogits);
    let topCropIdx = 0;
    for (let i = 1; i < cropProbs.length; i++) {
      if (cropProbs[i] > cropProbs[topCropIdx]) topCropIdx = i;
    }
    console.log('[ASPECT RATIO CROP - RUNTIME SIMULATION]');
    console.log('Raw Logits:', cropLogits.map(v => v.toFixed(3)).join(', '));
    console.log('Softmax Probs:', CLASSES.map((c, i) => `${c}: ${(cropProbs[i]*100).toFixed(1)}%`).join(' | '));
    console.log(`Top-1: ${CLASSES[topCropIdx]} (${(cropProbs[topCropIdx]*100).toFixed(2)}%)`);
    console.log(`Chroma: Contrast=${cropData.chroma.contrast.toFixed(1)}, R=${cropData.chroma.r.toFixed(1)}, G=${cropData.chroma.g.toFixed(1)}, B=${cropData.chroma.b.toFixed(1)}, BlurScore=${cropData.blurScore.toFixed(2)}`);

    // Threshold evaluation from currencyDetection.ts
    const prob = cropProbs[topCropIdx];
    let isConfident = true;
    let failReason = 'none';
    if (cropData.chroma.contrast < 35) {
      isConfident = false;
      failReason = 'low_contrast (<35)';
    } else if (cropData.blurScore < 2.0 && cropData.chroma.contrast < 45) {
      isConfident = false;
      failReason = 'blur_detected (<2.0 & contrast <45)';
    } else if (prob < 0.48) {
      isConfident = false;
      failReason = 'low_confidence (<0.48)';
    }
    console.log(`Passes Quality Filters: ${isConfident} (Fail reason: ${failReason})`);
  }
}

runForensics().catch(err => {
  console.error('Forensic Error:', err);
});

