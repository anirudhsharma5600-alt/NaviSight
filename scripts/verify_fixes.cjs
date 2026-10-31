const ort = require('onnxruntime-web');
const sharp = require('sharp');
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

async function prepareTensor(imgPath) {
  const { data, info } = await sharp(imgPath)
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

  const contrast = maxBrightness - minBrightness;
  return {
    tensor: new ort.Tensor('float32', floatData, [1, 3, 224, 224]),
    chroma: {
      r: sumR / total,
      g: sumG / total,
      b: sumB / total,
      contrast
    }
  };
}

function determineDesign(cls, chroma) {
  if (cls === 'INR_500') {
    const diffYellowBlue = (chroma.r + chroma.g) / 2 - chroma.b;
    if (diffYellowBlue > 36 || (chroma.r > 120 && chroma.g > 110 && chroma.b < 100)) {
      return 'Mahatma Gandhi Legacy Series (Olive/Orange) - Dandi March';
    }
    return 'Mahatma Gandhi New Series (Stone Grey) - Red Fort';
  }
  if (cls === 'INR_100') {
    if (chroma.b > chroma.r + 6) {
      return 'Mahatma Gandhi New Series (Lavender) - Rani ki Vav';
    }
    return 'Mahatma Gandhi Legacy Series (Blue-Green) - Kanchenjunga';
  }
  const designs = {
    INR_10: 'Mahatma Gandhi New Series (Chocolate Brown) - Sun Temple',
    INR_20: 'Mahatma Gandhi New Series (Greenish Yellow) - Ellora Caves',
    INR_50: 'Mahatma Gandhi New Series (Fluorescent Blue) - Hampi Chariot',
    INR_200: 'Mahatma Gandhi New Series (Bright Yellow-Orange) - Sanchi Stupa',
    INR_2000: 'Mahatma Gandhi New Series (Magenta) - Mangalyaan'
  };
  return designs[cls] || 'Standard Series';
}

async function testCurrencyLogic(session, imgPath) {
  const { tensor, chroma } = await prepareTensor(imgPath);
  const out = await session.run({ input: tensor });
  const probs = softmax(Array.from(out.output.data));

  let maxIdx = 0;
  for (let i = 1; i < probs.length; i++) {
    if (probs[i] > probs[maxIdx]) maxIdx = i;
  }

  const cls = CLASSES[maxIdx];
  const conf = probs[maxIdx];
  const design = determineDesign(cls, chroma);

  if (chroma.contrast < 30 || conf < 0.48) {
    return {
      success: false,
      speech: 'Sorry, I cannot recognise this note clearly. Please scan again.',
      cls: 'Uncertain',
      design: 'None',
      conf
    };
  }

  const amounts = { INR_10: 10, INR_20: 20, INR_50: 50, INR_100: 100, INR_200: 200, INR_500: 500, INR_2000: 2000 };
  return {
    success: true,
    speech: `This is a ${amounts[cls]}-rupee note.`,
    cls,
    amount: amounts[cls],
    design,
    conf
  };
}

async function run() {
  console.log('================================================================');
  console.log('   NAVIABLE AI — MULTI-SERIES CURRENCY & SPEECH VERIFICATION    ');
  console.log('================================================================\n');

  const modelPath = path.resolve(__dirname, '../public/models/currency/model.onnx');
  const session = await ort.InferenceSession.create(modelPath);

  // 1. ₹500 Banknote Test (Modern AND Legacy Series)
  console.log('[TEST 1] Testing ₹500 Banknote Designs (Modern Stone Grey + Older Olive Legacy)...');
  const res500NewObv = await testCurrencyLogic(session, 'ml/currency_recognition/raw_samples/500_obverse.jpg');
  const res500NewRev = await testCurrencyLogic(session, 'ml/currency_recognition/raw_samples/500_reverse.jpg');
  const res500OldObv = await testCurrencyLogic(session, 'ml/currency_recognition/raw_samples/500_old_obverse.jpg');
  const res500OldRev = await testCurrencyLogic(session, 'ml/currency_recognition/raw_samples/500_old_reverse.jpg');

  console.log(`  • [NEW] ₹500 Front: ${res500NewObv.cls} (${(res500NewObv.conf*100).toFixed(1)}%) | Design: ${res500NewObv.design}`);
  console.log(`    Spoken: "${res500NewObv.speech}"`);
  console.log(`  • [NEW] ₹500 Back:  ${res500NewRev.cls} (${(res500NewRev.conf*100).toFixed(1)}%) | Design: ${res500NewRev.design}`);
  console.log(`    Spoken: "${res500NewRev.speech}"`);
  console.log(`  • [OLD] ₹500 Front: ${res500OldObv.cls} (${(res500OldObv.conf*100).toFixed(1)}%) | Design: ${res500OldObv.design}`);
  console.log(`    Spoken: "${res500OldObv.speech}"`);
  console.log(`  • [OLD] ₹500 Back:  ${res500OldRev.cls} (${(res500OldRev.conf*100).toFixed(1)}%) | Design: ${res500OldRev.design}`);
  console.log(`    Spoken: "${res500OldRev.speech}"`);

  const pass500 = res500NewObv.cls === 'INR_500' && res500NewRev.cls === 'INR_500' &&
                  res500OldObv.cls === 'INR_500' && res500OldRev.cls === 'INR_500' &&
                  res500OldObv.speech === 'This is a 500-rupee note.';
  console.log(`  => ₹500 Multi-Series Test Status: ${pass500 ? 'PASS' : 'FAIL'}\n`);

  // 2. ₹100 Banknote Test (Modern Lavender + Older Blue-Green)
  console.log('[TEST 2] Testing ₹100 Banknote Designs (Modern Lavender + Older Blue-Green)...');
  const res100New = await testCurrencyLogic(session, 'ml/currency_recognition/raw_samples/100_obverse.png');
  const res100Old = await testCurrencyLogic(session, 'ml/currency_recognition/raw_samples/100_old_obverse.jpg');
  console.log(`  • [NEW] ₹100 Front: ${res100New.cls} (${(res100New.conf*100).toFixed(1)}%) | Design: ${res100New.design}`);
  console.log(`  • [OLD] ₹100 Front: ${res100Old.cls} (${(res100Old.conf*100).toFixed(1)}%) | Design: ${res100Old.design}`);
  const pass100 = res100New.cls === 'INR_100' && res100Old.cls === 'INR_100';
  console.log(`  => ₹100 Multi-Series Test Status: ${pass100 ? 'PASS' : 'FAIL'}\n`);

  // 3. Other Denominations (₹10, ₹20, ₹50, ₹200)
  console.log('[TEST 3] Testing Other Indian Denominations (₹10, ₹20, ₹50, ₹200)...');
  const res10 = await testCurrencyLogic(session, 'ml/currency_recognition/raw_samples/10_obverse.jpg');
  const res20 = await testCurrencyLogic(session, 'ml/currency_recognition/raw_samples/20_obverse.jpg');
  const res50 = await testCurrencyLogic(session, 'ml/currency_recognition/raw_samples/50_obverse.jpg');
  const res200 = await testCurrencyLogic(session, 'ml/currency_recognition/raw_samples/200_obverse.jpg');
  console.log(`  • ₹10 Note:  ${res10.cls} (${(res10.conf*100).toFixed(1)}%) -> "${res10.speech}"`);
  console.log(`  • ₹20 Note:  ${res20.cls} (${(res20.conf*100).toFixed(1)}%) -> "${res20.speech}"`);
  console.log(`  • ₹50 Note:  ${res50.cls} (${(res50.conf*100).toFixed(1)}%) -> "${res50.speech}"`);
  console.log(`  • ₹200 Note: ${res200.cls} (${(res200.conf*100).toFixed(1)}%) -> "${res200.speech}"`);
  const passOthers = res10.cls === 'INR_10' && res20.cls === 'INR_20' && res50.cls === 'INR_50' && res200.cls === 'INR_200';
  console.log(`  => Other Denominations Status: ${passOthers ? 'PASS' : 'FAIL'}\n`);

  // 4. Mode B: Multiple Notes Total Calculation (No fake ₹300 denomination)
  console.log('[TEST 4] Testing Mode B: Multiple Notes Calculation...');
  const notesVisible = [res200.amount, res100New.amount];
  const total = notesVisible.reduce((a, b) => a + b, 0);
  console.log(`  • Visible Notes: [₹${res200.amount}, ₹${res100New.amount}]`);
  console.log(`  • Calculated Total: ₹${total}`);
  const passMulti = total === 300;
  console.log(`  => Multiple Notes Calculation Status: ${passMulti ? 'PASS' : 'FAIL'}\n`);

  console.log('================================================================');
  console.log(` OVERALL VERIFICATION: ${pass500 && pass100 && passOthers && passMulti ? 'PASS' : 'FAIL'}`);
  console.log('================================================================\n');
}

run().catch(err => {
  console.error('[FATAL] Verification failed:', err);
  process.exit(1);
});
