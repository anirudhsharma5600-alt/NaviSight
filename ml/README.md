# NaviAble AI — ML Training Center

This directory contains standalone Python training pipelines, dataset specifications, validation scripts, and ONNX export routines for models that require offline GPU training.

## Model Portfolio Overview

| Subsystem | Base Architecture | Dataset | Format | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Object Detection** | MobileNet v2 | MS COCO (80 classes) | TensorFlow.js Web Model | **Operational (In-Browser)** |
| **OCR Reader** | LSTM / Tesseract Engine | Eng/Hin/Pan traineddata | WebAssembly (Tesseract.js) | **Operational (In-Browser)** |
| **Proximity Engine** | Relative Area + Visual Depth | Heuristic + Kalman Filter | Client-Side Audio/Telemetry | **Operational (In-Browser)** |
| **Indian Currency** | MobileNetV3-Small | Indian Currency Dataset (~1,786 images) | ONNX | **Pipeline Ready / Training Pending** |
| **Road Hazards** | YOLOv8n | RDD2022 (Road Damage Dataset) | ONNX | **Pipeline Ready / Training Pending** |

---

## Directory Structure

```
ml/
├── README.md
├── currency_recognition/
│   ├── README.md
│   ├── train_currency_model.py
│   └── evaluate_currency.py
└── pothole_detection/
    ├── README.md
    ├── train_pothole_model.py
    └── evaluate_pothole.py
```

---

## Training Environment Requirements

Because in-browser environments and standard non-GPU containers cannot train deep learning weights:
- **Recommended Environment:** Google Colab (Free T4 GPU runtime) or an NVIDIA RTX GPU with CUDA 12+.
- **Python Version:** 3.10+
- **Key Dependencies:**
  ```bash
  pip install torch torchvision onnx onnxruntime ultralytics opencv-python Pillow
  ```

---

## Exporting Trained Weights to NaviAble AI

When training finishes, models are exported to ONNX format:
1. Place the generated `.onnx` files into the project's public models directory:
   - Currency: `public/models/currency/model.onnx`
   - Road Hazards: `public/models/pothole/model.onnx`
2. NaviAble AI's web services (`src/services/currencyDetection.ts` and `src/services/potholeDetection.ts`) will automatically detect the presence of these model files via HTTP HEAD requests and activate real inference mode.

