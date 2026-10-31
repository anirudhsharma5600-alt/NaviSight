# NaviAble AI — Model Documentation

## Object Detection Model

### COCO-SSD (MobileNet v2)

- **Source**: TensorFlow.js Model Zoo
- **npm Package**: `@tensorflow-models/coco-ssd`
- **Base Architecture**: MobileNet v2 (lite variant)
- **Training Dataset**: [MS COCO (Common Objects in Context)](https://cocodataset.org/)
- **License**: Apache 2.0
- **Model Size**: ~5MB (downloaded at runtime from TensorFlow CDN)

### Supported Classes (80)

The model detects these 80 object categories:

| # | Class | # | Class | # | Class | # | Class |
|---|-------|---|-------|---|-------|---|-------|
| 1 | person | 21 | elephant | 41 | cup | 61 | dining table |
| 2 | bicycle | 22 | bear | 42 | fork | 62 | toilet |
| 3 | car | 23 | zebra | 43 | knife | 63 | tv |
| 4 | motorcycle | 24 | giraffe | 44 | spoon | 64 | laptop |
| 5 | airplane | 25 | backpack | 45 | bowl | 65 | mouse |
| 6 | bus | 26 | umbrella | 46 | banana | 66 | remote |
| 7 | train | 27 | handbag | 47 | apple | 67 | keyboard |
| 8 | truck | 28 | tie | 48 | sandwich | 68 | cell phone |
| 9 | boat | 29 | suitcase | 49 | orange | 69 | microwave |
| 10 | traffic light | 30 | frisbee | 50 | broccoli | 70 | oven |
| 11 | fire hydrant | 31 | skis | 51 | carrot | 71 | toaster |
| 12 | stop sign | 32 | snowboard | 52 | hot dog | 72 | sink |
| 13 | parking meter | 33 | sports ball | 53 | pizza | 73 | refrigerator |
| 14 | bench | 34 | kite | 54 | donut | 74 | book |
| 15 | bird | 35 | baseball bat | 55 | cake | 75 | clock |
| 16 | cat | 36 | baseball glove | 56 | chair | 76 | vase |
| 17 | dog | 37 | skateboard | 57 | couch | 77 | scissors |
| 18 | horse | 38 | surfboard | 58 | potted plant | 78 | teddy bear |
| 19 | sheep | 39 | tennis racket | 59 | bed | 79 | hair drier |
| 20 | cow | 40 | bottle | 60 | — | 80 | toothbrush |

### Important Notes

- The model does **NOT** detect: doors, stairs, potholes, road hazards, traffic signs (text), or custom categories.
- "traffic light" and "stop sign" are detected by shape/appearance, not by text reading.
- Detection accuracy depends on lighting, camera quality, and object distance.
- The `lite_mobilenet_v2` base is chosen for speed; `mobilenet_v2` offers better accuracy but is slower.

### How to Test

1. Open the application at `http://localhost:5173/dashboard`
2. Click "Start Camera" — the model will load automatically
3. Point the camera at any of the 80 supported objects
4. Bounding boxes, labels, confidence scores, and positions will appear
5. The "Describe Surroundings" button generates a spoken scene description

### Configuration

In the Dashboard settings panel:
- **Confidence Threshold**: 10% to 95% (default 45%)
- **Detection Interval**: 100ms to 1000ms (default 200ms)
- **Max Detections**: 15 per frame (default)
- **IOU Threshold**: 0.5 for Non-Maximum Suppression

---

## OCR / Text Recognition Model

### Tesseract.js

- **Source**: [Tesseract.js](https://github.com/naptha/tesseract.js)
- **npm Package**: `tesseract.js`
- **Engine**: Tesseract OCR 5.x (compiled to WebAssembly)
- **License**: Apache 2.0
- **Language Data**: Downloaded at runtime from CDN (~15MB per language)

### Supported Languages

- English (`eng`) — default
- Hindi (`hin`) — Devanagari script
- Punjabi (`pan`) — Gurmukhi script
- Combined (`eng+hin`) — multilingual

### Image Preprocessing

The OCR reader applies optional preprocessing:
- **Grayscale conversion** (default: on) — improves contrast for text
- **High contrast** (default: on) — enhances text/background separation

### How to Test

1. Open `http://localhost:5173/ocr`
2. Either start the camera and capture an image, or upload a photo
3. Select the language
4. Enable/disable preprocessing options
5. Results show recognized text with confidence percentage and word count
6. Use "Read Aloud" for spoken output with Pause/Resume controls

---

## Speech / Voice Models

### Web Speech API (Browser Native)

- **Speech Recognition**: `webkitSpeechRecognition` (Chrome/Edge only)
- **Text-to-Speech**: `SpeechSynthesis` (all modern browsers)
- **Processing**: Entirely local in Chrome; may use cloud in some browsers
- **No npm packages required** — built into the browser

### Important Notes

- Speech recognition works in **Chrome and Edge** only
- Firefox and Safari have limited or no speech recognition support
- Text-to-speech is widely supported across all modern browsers
- No continuous audio upload — click-to-talk only

