#!/usr/bin/env node
/**
 * NaviAble AI — Multi-Condition Indian Currency Verification & Regression Test
 *
 * Verifies that:
 * 1. ₹100 Banknotes (both modern Lavender and legacy series) are recognized with high confidence.
 * 2. ₹500 Banknotes (both modern Stone Grey and legacy series) are recognized with high confidence.
 * 3. ₹20 Banknotes (Greenish Yellow) continue to be recognized reliably without regression.
 * 4. Hard negatives (Laptops, LCD monitors, Code editors, Keyboards, Receipts, Documents, White pages)
 *    are strictly blocked and emit NO_BANKNOTE_DETECTED.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const sharp = require('sharp');
const ort = require('onnxruntime-web');

const CLASSES = ['INR_10', 'INR_20', 'INR_50', 'INR_100', 'INR_200', 'INR_500', 'INR_2000', 'NEGATIVE'];
const IMAGENET_MEAN = [0.485, 0.456, 0.406];
const IMAGENET_STD = [0.229, 0.224, 0.225];

async function stage1DetectBanknotePresence(imgPath) {
  const { data } = await sharp(imgPath)
    .resize(112, 112, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const totalPixels = 112 * 112;
  let sumR = 0, sumG = 0, sumB = 0, sumLuma = 0;
  let minLuma = 255, maxLuma = 0;
  let darkPixelCount = 0, brightPixelCount = 0;
  let horizontalGradientSum = 0, verticalGradientSum = 0;

  for (let i = 0; i < totalPixels; i++) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    sumR += r; sumG += g; sumB += b; sumLuma += luma;
    if (luma < minLuma) minLuma = luma;
    if (luma > maxLuma) maxLuma = luma;
    if (luma < 42) darkPixelCount++;
    if (luma > 225) brightPixelCount++;

    if (i % 112 < 111) {
      const nextLuma = 0.299 * data[(i + 1) * 3] + 0.587 * data[(i + 1) * 3 + 1] + 0.114 * data[(i + 1) * 3 + 2];
      horizontalGradientSum += Math.abs(nextLuma - luma);
    }
    if (i < totalPixels - 112) {
      const downLuma = 0.299 * data[(i + 112) * 3] + 0.587 * data[(i + 112) * 3 + 1] + 0.114 * data[(i + 112) * 3 + 2];
      verticalGradientSum += Math.abs(downLuma - luma);
    }
  }

  const avgR = sumR / totalPixels;
  const avgG = sumG / totalPixels;
  const avgB = sumB / totalPixels;
  const avgLuma = sumLuma / totalPixels;
  const contrast = maxLuma - minLuma;
  const darkRatio = darkPixelCount / totalPixels;
  const brightRatio = brightPixelCount / totalPixels;
  const hGrad = horizontalGradientSum / totalPixels;
  const vGrad = verticalGradientSum / totalPixels;

  const maxChannel = Math.max(avgR, avgG, avgB);
  const minChannel = Math.min(avgR, avgG, avgB);
  const saturation = maxChannel > 0 ? (maxChannel - minChannel) / maxChannel : 0;
  const maxChannelDiff = maxChannel - minChannel;

  // 1. Dark monitor / code editor
  if (darkRatio > 0.40 || (avgLuma < 55 && contrast < 95) || (avgLuma < 45 && avgR < 50 && avgG < 50 && avgB < 55)) {
    return { hasBanknotePresence: false, reason: 'Dark computer monitor or terminal screen (non-banknote)' };
  }
  // 2. Keyboard
  if (darkRatio > 0.28 && brightRatio > 0.20 && (hGrad > 2.8 || vGrad > 2.8)) {
    return { hasBanknotePresence: false, reason: 'Computer keyboard or hardware surface detected' };
  }
  // 3. Digital displays / web browsers
  if ((avgLuma > 110 && saturation < 0.055 && maxChannelDiff < 14) ||
      (avgLuma > 150 && saturation < 0.06 && avgB >= avgR + 10)) {
    return { hasBanknotePresence: false, reason: 'Computer screen / laptop display / web page (non-banknote)' };
  }
  // 4. Document / receipt
  if (brightRatio > 0.65 || (avgLuma > 195 && saturation < 0.05 && maxChannelDiff < 10)) {
    return { hasBanknotePresence: false, reason: 'Uniform light surface / printed document / receipt page' };
  }
  // 5. Solid featureless wall
  if (contrast < 30 && hGrad < 1.1 && vGrad < 1.1) {
    return { hasBanknotePresence: false, reason: 'Featureless solid surface (wall, desk, or floor)' };
  }

  // 6. Chromatic match
  let hasValid = false;
  let theme = 'Unknown';
  if (avgR > 125 && avgG > 95 && avgR > avgG + 25 && avgR > avgB + 55 && saturation >= 0.20) {
    hasValid = true; theme = 'Bright Yellow-Orange (₹200)';
  } else if (avgG > 100 && avgR > 100 && avgLuma > 185 && avgG >= avgR - 15 && avgR > avgB + 35 && saturation >= 0.14) {
    hasValid = true; theme = 'Greenish Yellow (₹20)';
  } else if (avgR > 90 && avgG > 55 && avgR > avgG + 15 && avgG > avgB && saturation >= 0.15) {
    hasValid = true; theme = 'Chocolate Brown (₹10)';
  } else if (avgB > 105 && avgB > avgR + 10 && avgG > avgR + 5 && saturation >= 0.12) {
    hasValid = true; theme = 'Fluorescent Blue (₹50)';
  } else if ((avgB > 95 && avgB > avgG + 3 && saturation >= 0.07 && maxChannelDiff >= 12) ||
             (avgR > 190 && avgG > 190 && avgB > 180 && saturation < 0.08 && hGrad > 1.2 && vGrad > 1.2)) {
    hasValid = true; theme = 'Lavender (₹100)';
  } else if ((((avgG >= avgR - 12 && avgG >= avgB + 8) || (avgR >= avgG && avgR > avgB + 18 && avgG > avgB + 8)) &&
              avgLuma > 70 && avgLuma < 210 && hGrad > 1.1 && vGrad > 1.1 && saturation >= 0.08 && maxChannelDiff >= 14)) {
    hasValid = true; theme = 'Stone Grey / Olive (₹500)';
  } else if (avgR > 120 && avgB > 90 && avgG < 180 && (avgR - avgG) > 15 && saturation >= 0.16) {
    hasValid = true; theme = 'Magenta (₹2000)';
  }

  return { hasBanknotePresence: hasValid, theme, reason: hasValid ? undefined : 'No Indian banknote chromatic pattern detected' };
}

async function stage2Classify(session, imgPath) {
  const { data } = await sharp(imgPath)
    .resize(224, 224, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const float32Data = new Float32Array(3 * 224 * 224);
  const totalPixels = 224 * 224;
  for (let i = 0; i < totalPixels; i++) {
    float32Data[i] = (data[i * 3] / 255.0 - IMAGENET_MEAN[0]) / IMAGENET_STD[0];
    float32Data[totalPixels + i] = (data[i * 3 + 1] / 255.0 - IMAGENET_MEAN[1]) / IMAGENET_STD[1];
    float32Data[totalPixels * 2 + i] = (data[i * 3 + 2] / 255.0 - IMAGENET_MEAN[2]) / IMAGENET_STD[2];
  }
  const tensor = new ort.Tensor('float32', float32Data, [1, 3, 224, 224]);
  const results = await session.run({ input: tensor });
  const logits = Array.from(results.output.data);
  let max = -Infinity;
  for (let v of logits) if (v > max) max = v;
  const exp = logits.map(v => Math.exp(v - max));
  const sum = exp.reduce((a, b) => a + b, 0);
  const probs = exp.map(v => v / sum);

  const ranked = CLASSES.map((cls, idx) => ({ cls, prob: probs[idx] })).sort((a, b) => b.prob - a.prob);
  const top = ranked[0];
  const runnerUp = ranked[1];
  const margin = top.prob - (runnerUp ? runnerUp.prob : 0);

  return {
    topClass: top.cls,
    confidence: top.prob,
    margin,
    isHardNegative: top.cls === 'NEGATIVE',
  };
}

async function runEndToEnd(session, imgPath) {
  const s1 = await stage1DetectBanknotePresence(imgPath);
  if (!s1.hasBanknotePresence) {
    return {
      state: 'NO_BANKNOTE_DETECTED',
      rejectionStage: 'STAGE_A_PRESENCE',
      reason: s1.reason,
      denomination: null,
      confidence: 0,
    };
  }

  const s2 = await stage2Classify(session, imgPath);
  if (s2.isHardNegative) {
    return {
      state: 'NO_BANKNOTE_DETECTED',
      rejectionStage: 'STAGE_B_HARD_NEGATIVE',
      reason: 'Neural classifier identified ordinary object (NEGATIVE)',
      denomination: null,
      confidence: 0,
    };
  }

  if (s2.confidence < 0.70 || s2.margin < 0.15) {
    return {
      state: 'LOW_CONFIDENCE',
      rejectionStage: 'STAGE_B_LOW_CONFIDENCE',
      reason: `Confidence ${(s2.confidence * 100).toFixed(1)}% < 70% or margin < 15%`,
      denomination: s2.topClass,
      confidence: s2.confidence,
    };
  }

  return {
    state: 'DENOMINATION_RECOGNISED',
    denomination: s2.topClass,
    confidence: s2.confidence,
    theme: s1.theme,
  };
}

(async () => {
  console.log('='.repeat(72));
  console.log('  NAVIABLE AI — CURRENCY FIX VERIFICATION REPORT');
  console.log('='.repeat(72));

  const modelPath = path.resolve('public/models/currency/model.onnx');
  const session = await ort.InferenceSession.create(modelPath);
  console.log(`[MODEL LOADED] ${modelPath}\n`);

  // 1. Verify ₹100 recognition
  console.log('--- 1. ₹100 BANKNOTE RECOGNITION (Modern + Legacy) ---');
  const inr100Files = ['100_obverse.png', '100_reverse.png', '100_old_obverse.jpg', '100_old_reverse.jpg'];
  for (const f of inr100Files) {
    const res = await runEndToEnd(session, path.join('ml/currency_recognition/raw_samples', f));
    console.log(`  • ${f.padEnd(20)} -> ${res.state} | ${res.denomination} (${(res.confidence * 100).toFixed(1)}%)`);
    assert.strictEqual(res.state, 'DENOMINATION_RECOGNISED', `Expected ₹100 banknote to be recognized: ${f}`);
    assert.strictEqual(res.denomination, 'INR_100', `Expected denomination INR_100: ${f}`);
  }
  console.log('  ✓ ₹100 recognition: 4/4 PASSED\n');

  // 2. Verify ₹500 recognition
  console.log('--- 2. ₹500 BANKNOTE RECOGNITION (Modern + Legacy) ---');
  const inr500Files = ['500_obverse.jpg', '500_reverse.jpg', '500_old_obverse.jpg', '500_old_reverse.jpg'];
  for (const f of inr500Files) {
    const res = await runEndToEnd(session, path.join('ml/currency_recognition/raw_samples', f));
    console.log(`  • ${f.padEnd(20)} -> ${res.state} | ${res.denomination} (${(res.confidence * 100).toFixed(1)}%)`);
    assert.strictEqual(res.state, 'DENOMINATION_RECOGNISED', `Expected ₹500 banknote to be recognized: ${f}`);
    assert.strictEqual(res.denomination, 'INR_500', `Expected denomination INR_500: ${f}`);
  }
  console.log('  ✓ ₹500 recognition: 4/4 PASSED\n');

  // 3. Verify ₹20 recognition
  console.log('--- 3. ₹20 BANKNOTE RECOGNITION (Non-Regression Verification) ---');
  const inr20Files = ['20_obverse.jpg', '20_reverse.jpg'];
  for (const f of inr20Files) {
    const res = await runEndToEnd(session, path.join('ml/currency_recognition/raw_samples', f));
    console.log(`  • ${f.padEnd(20)} -> ${res.state} | ${res.denomination} (${(res.confidence * 100).toFixed(1)}%)`);
    assert.strictEqual(res.state, 'DENOMINATION_RECOGNISED', `Expected ₹20 banknote to be recognized: ${f}`);
    assert.strictEqual(res.denomination, 'INR_20', `Expected denomination INR_20: ${f}`);
  }
  console.log('  ✓ ₹20 recognition: 2/2 PASSED\n');

  // 4. Verify Hard Negative Rejection (Laptops, Screens, Monitors, Keyboards, Receipts)
  console.log('--- 4. HARD-NEGATIVE REJECTION (Laptops, Monitors, Keyboards, Receipts) ---');
  const negDir = 'ml/currency_recognition/dataset/test/NEGATIVE';
  const negFiles = fs.readdirSync(negDir).filter(f => /\.(jpg|png)$/i.test(f));
  let rejectedCount = 0;
  for (const f of negFiles) {
    const res = await runEndToEnd(session, path.join(negDir, f));
    if (res.state === 'NO_BANKNOTE_DETECTED') {
      rejectedCount++;
    } else {
      console.error(`  [FALSE POSITIVE FAIL]: ${f} -> ${res.state} as ${res.denomination}`);
    }
  }
  console.log(`  Total Hard-Negatives Tested: ${negFiles.length}`);
  console.log(`  Total Hard-Negatives Rejected as NO_BANKNOTE_DETECTED: ${rejectedCount} / ${negFiles.length}`);
  assert.strictEqual(rejectedCount, negFiles.length, 'All hard-negatives must be rejected as NO_BANKNOTE_DETECTED');
  console.log('  ✓ False Currency Detection Prevention: 100% PASSED\n');

  console.log('='.repeat(72));
  console.log('  ALL CURRENCY VERIFICATION TESTS PASSED SUCCESSFULLY!  ');
  console.log('='.repeat(72));
})();

