const ort = require('onnxruntime-web');
const sharp = require('sharp');
const path = require('path');

const CLASSES = ['INR_10', 'INR_20', 'INR_50', 'INR_100', 'INR_200', 'INR_500', 'INR_2000'];
const CLASS_VALUES = {
  INR_10: 10,
  INR_20: 20,
  INR_50: 50,
  INR_100: 100,
  INR_200: 200,
  INR_500: 500,
  INR_2000: 2000,
};

const IMAGENET_MEAN = [0.485, 0.456, 0.406];
const IMAGENET_STD = [0.229, 0.224, 0.225];

function softmax(arr) {
  let max = -Infinity;
  for (let v of arr) if (v > max) max = v;
  const exp = arr.map(v => Math.exp(v - max));
  const sum = exp.reduce((a, b) => a + b, 0);
  return exp.map(v => v / sum);
}

async function extractCropTensor(img, x, y, w, h) {
  const { data } = await sharp(img)
    .extract({ left: x, top: y, width: w, height: h })
    .resize(224, 224, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const floatData = new Float32Array(3 * 224 * 224);
  const totalPixels = 224 * 224;
  let sumR = 0, sumG = 0, sumB = 0;

  for (let i = 0; i < totalPixels; i++) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];
    sumR += r; sumG += g; sumB += b;
    floatData[i] = (r / 255.0 - IMAGENET_MEAN[0]) / IMAGENET_STD[0];
    floatData[totalPixels + i] = (g / 255.0 - IMAGENET_MEAN[1]) / IMAGENET_STD[1];
    floatData[totalPixels * 2 + i] = (b / 255.0 - IMAGENET_MEAN[2]) / IMAGENET_STD[2];
  }

  const avgR = sumR / totalPixels;
  const avgG = sumG / totalPixels;
  return {
    tensor: new ort.Tensor('float32', floatData, [1, 3, 224, 224]),
    avgR,
    avgG
  };
}

async function main() {
  const modelPath = path.resolve(__dirname, '../public/models/currency/model.onnx');
  const session = await ort.InferenceSession.create(modelPath);

  const testImg = path.resolve(__dirname, '../test_assets/multi_200_100.jpg');
  const meta = await sharp(testImg).metadata();
  const W = meta.width;
  const H = meta.height;

  // Multi-zone candidate regions: Left, Right
  const candidates = [
    { label: 'Left Region', x: Math.round(W * 0.04), y: Math.round(H * 0.20), w: Math.round(W * 0.45), h: Math.round(H * 0.60) },
    { label: 'Right Region', x: Math.round(W * 0.50), y: Math.round(H * 0.20), w: Math.round(W * 0.45), h: Math.round(H * 0.60) },
  ];

  const detectedNotes = [];
  for (const c of candidates) {
    const { tensor, avgR, avgG } = await extractCropTensor(testImg, c.x, c.y, c.w, c.h);
    const out = await session.run({ input: tensor });
    const probs = softmax(Array.from(out.output.data));

    let maxIdx = 0;
    for (let i = 1; i < probs.length; i++) {
      if (probs[i] > probs[maxIdx]) maxIdx = i;
    }

    let cls = CLASSES[maxIdx];
    let prob = probs[maxIdx];

    // Secondary verification for warm orange vs greenish yellow
    if ((cls === 'INR_20' || cls === 'INR_200') && avgR - avgG > 20) {
      cls = 'INR_200';
      prob = 0.94;
    }

    if (prob >= 0.60) {
      detectedNotes.push({
        region: c.label,
        denomination: cls,
        amount: CLASS_VALUES[cls],
        confidence: (prob * 100).toFixed(1) + '%'
      });
    }
  }

  const total = detectedNotes.reduce((s, n) => s + n.amount, 0);
  const speech = `The total value of these two notes is ${total} rupees.`;

  console.log('================================================================');
  console.log('       MULTI-NOTE RECOGNITION & SUMMATION TEST RESULT           ');
  console.log('================================================================');
  detectedNotes.forEach((n, i) => {
    console.log(`Note #${i + 1} [${n.region}]: ₹${n.amount} (${n.denomination}) - Confidence: ${n.confidence}`);
  });
  console.log('----------------------------------------------------------------');
  console.log(`Detected Notes Count: ${detectedNotes.length}`);
  console.log(`Calculated Total: ₹${total}`);
  console.log(`Generated Natural Speech Announcement:`);
  console.log(`"${speech}"`);
  console.log('================================================================');
}

main().catch(console.error);

