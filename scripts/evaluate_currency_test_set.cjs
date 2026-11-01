/**
 * NaviAble AI — Currency Model Comprehensive Benchmark & Test Set Evaluation
 * 
 * Evaluates public/models/currency/model.onnx on the 240 independent test images
 * across all 8 classes (10, 20, 50, 100, 200, 500, 2000, and NEGATIVE).
 * 
 * Computes:
 * - 8x8 Confusion Matrix
 * - Per-Class Precision, Recall, F1-Score, Support
 * - Overall Accuracy
 * - Latency Metrics (Mean, Median, Min, Max, P95)
 * - Memory & Throughput
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const ort = require('onnxruntime-web');

const MODEL_PATH = path.resolve('public/models/currency/model.onnx');
const TEST_DIR = path.resolve('ml/currency_recognition/dataset/test');

const CLASSES = ['INR_10', 'INR_20', 'INR_50', 'INR_100', 'INR_200', 'INR_500', 'INR_2000', 'NEGATIVE'];
const DIR_TO_CLASS = {
  '10': 'INR_10',
  '20': 'INR_20',
  '50': 'INR_50',
  '100': 'INR_100',
  '200': 'INR_200',
  '500': 'INR_500',
  '2000': 'INR_2000',
  'NEGATIVE': 'NEGATIVE',
};

const IMAGENET_MEAN = [0.485, 0.456, 0.406];
const IMAGENET_STD = [0.229, 0.224, 0.225];

function softmax(logits) {
  let max = -Infinity;
  for (let i = 0; i < logits.length; i++) {
    if (logits[i] > max) max = logits[i];
  }
  const exp = new Float64Array(logits.length);
  let sum = 0;
  for (let i = 0; i < logits.length; i++) {
    exp[i] = Math.exp(logits[i] - max);
    sum += exp[i];
  }
  return Array.from(exp).map(e => e / sum);
}

async function preprocessImage(filePath) {
  const { data } = await sharp(filePath)
    .resize(224, 224, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const floatData = new Float32Array(3 * 224 * 224);
  const planeSize = 224 * 224;

  for (let i = 0; i < planeSize; i++) {
    const r = data[i * 3] / 255.0;
    const g = data[i * 3 + 1] / 255.0;
    const b = data[i * 3 + 2] / 255.0;

    floatData[i] = (r - IMAGENET_MEAN[0]) / IMAGENET_STD[0];
    floatData[planeSize + i] = (g - IMAGENET_MEAN[1]) / IMAGENET_STD[1];
    floatData[planeSize * 2 + i] = (b - IMAGENET_MEAN[2]) / IMAGENET_STD[2];
  }

  return new ort.Tensor('float32', floatData, [1, 3, 224, 224]);
}

async function main() {
  console.log('========================================================================');
  console.log('  NAVIABLE AI — CURRENCY MODEL 240-IMAGE TEST SET BENCHMARK             ');
  console.log('========================================================================\n');

  const startLoad = performance.now();
  const session = await ort.InferenceSession.create(MODEL_PATH, {
    executionProviders: ['cpu'],
  });
  const loadDuration = Math.round(performance.now() - startLoad);
  console.log(`[MODEL LOADED] ${MODEL_PATH} in ${loadDuration} ms`);

  // Confusion matrix: rows = true class, cols = predicted class
  const matrix = Array.from({ length: 8 }, () => Array(8).fill(0));
  const latencies = [];

  let totalTested = 0;
  let totalCorrect = 0;

  const subdirs = fs.readdirSync(TEST_DIR);
  for (const subdir of subdirs) {
    const trueClass = DIR_TO_CLASS[subdir];
    if (!trueClass) continue;
    const trueIdx = CLASSES.indexOf(trueClass);

    const fullDirPath = path.join(TEST_DIR, subdir);
    const files = fs.readdirSync(fullDirPath).filter(f => /\.(jpg|jpeg|png)$/i.test(f));

    for (const file of files) {
      const imgPath = path.join(fullDirPath, file);
      const tensor = await preprocessImage(imgPath);

      const t0 = performance.now();
      const results = await session.run({ [session.inputNames[0]]: tensor });
      const dt = performance.now() - t0;
      latencies.push(dt);

      const outputTensor = results[session.outputNames[0]];
      const probs = softmax(outputTensor.data);

      let maxIdx = 0;
      let maxProb = -Infinity;
      for (let i = 0; i < probs.length; i++) {
        if (probs[i] > maxProb) {
          maxProb = probs[i];
          maxIdx = i;
        }
      }

      matrix[trueIdx][maxIdx]++;
      totalTested++;
      if (trueIdx === maxIdx) {
        totalCorrect++;
      }

      // tensor cleanup
      tensor.dispose && tensor.dispose();
      outputTensor.dispose && outputTensor.dispose();
    }
  }

  // Calculate Precision, Recall, F1 for each class
  console.log('\n--- CONFUSION MATRIX (Rows: Actual, Columns: Predicted) ---');
  console.log('Actual \\ Pred\t' + CLASSES.map(c => c.replace('INR_', '₹').padEnd(7)).join(' '));

  const metrics = {};
  for (let i = 0; i < 8; i++) {
    const rowStr = matrix[i].map(n => String(n).padEnd(7)).join(' ');
    console.log(`${CLASSES[i].replace('INR_', '₹').padEnd(12)}\t${rowStr}`);

    const TP = matrix[i][i];
    let FP = 0;
    for (let r = 0; r < 8; r++) {
      if (r !== i) FP += matrix[r][i];
    }
    let FN = 0;
    for (let c = 0; c < 8; c++) {
      if (c !== i) FN += matrix[i][c];
    }
    let TN = totalTested - (TP + FP + FN);

    const precision = TP + FP > 0 ? TP / (TP + FP) : 0;
    const recall = TP + FN > 0 ? TP / (TP + FN) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    const fpr = FP + TN > 0 ? FP / (FP + TN) : 0;
    const fnr = TP + FN > 0 ? FN / (TP + FN) : 0;

    metrics[CLASSES[i]] = {
      TP, FP, FN, TN,
      precision,
      recall,
      f1,
      fpr,
      fnr,
      support: TP + FN,
    };
  }

  console.log('\n--- PER-CLASS PERFORMANCE METRICS ---');
  console.log('Class'.padEnd(12) + 'Precision'.padEnd(12) + 'Recall'.padEnd(12) + 'F1-Score'.padEnd(12) + 'FPR'.padEnd(10) + 'Support');
  console.log('-'.repeat(65));
  for (const c of CLASSES) {
    const m = metrics[c];
    console.log(
      `${c.padEnd(12)}${(m.precision * 100).toFixed(1)}%`.padEnd(24) +
      `${(m.recall * 100).toFixed(1)}%`.padEnd(12) +
      `${(m.f1 * 100).toFixed(1)}%`.padEnd(12) +
      `${(m.fpr * 100).toFixed(2)}%`.padEnd(10) +
      `${m.support}`
    );
  }

  latencies.sort((a, b) => a - b);
  const meanLat = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const medianLat = latencies[Math.floor(latencies.length / 2)];
  const p95Lat = latencies[Math.floor(latencies.length * 0.95)];
  const minLat = latencies[0];
  const maxLat = latencies[latencies.length - 1];
  const fps = 1000 / meanLat;

  console.log('\n--- LATENCY & THROUGHPUT (ONNX Runtime CPU) ---');
  console.log(`• Total Images Tested: ${totalTested}`);
  console.log(`• Overall Accuracy:    ${((totalCorrect / totalTested) * 100).toFixed(2)}% (${totalCorrect}/${totalTested})`);
  console.log(`• Mean Latency:        ${meanLat.toFixed(2)} ms`);
  console.log(`• Median Latency:      ${medianLat.toFixed(2)} ms`);
  console.log(`• 95th Percentile:     ${p95Lat.toFixed(2)} ms`);
  console.log(`• Min Latency:         ${minLat.toFixed(2)} ms`);
  console.log(`• Max Latency:         ${maxLat.toFixed(2)} ms`);
  console.log(`• Throughput:          ~${fps.toFixed(1)} FPS`);
  console.log('========================================================================\n');
}

main().catch(err => {
  console.error('Benchmark Error:', err);
  process.exit(1);
});
