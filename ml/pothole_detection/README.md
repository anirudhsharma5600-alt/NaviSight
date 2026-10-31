# Road Hazard and Pothole Detection — Training Pipeline

## Overview
This pipeline fine-tunes a `YOLOv8n` object detector to recognize 4 primary road damage categories based on the standard Road Damage Dataset (RDD2022):
- **D00:** Longitudinal Cracks
- **D10:** Transverse Cracks
- **D20:** Alligator / Crocodile Cracks
- **D40:** Potholes & Depressions

---

## Dataset: RDD2022
- **Origin:** Global Road Damage Detection Challenge (GRDDC 2022).
- **Scale:** 40,000+ labeled road images collected from real-world vehicles across India, Japan, Czech Republic, Norway, China, and the United States.
- **Official Repository:** [https://github.com/sekilab/RoadDamageDetector](https://github.com/sekilab/RoadDamageDetector)

---

## Training on Google Colab / GPU
1. Open [Google Colab](https://colab.research.google.com) and attach a **T4 GPU** runtime.
2. Install `ultralytics` and ONNX:
   ```bash
   pip install ultralytics onnx onnxruntime
   ```
3. Prepare a `rdd2022.yaml` configuration pointing to your dataset splits:
   ```yaml
   path: ./rdd2022
   train: images/train
   val: images/val
   names:
     0: Longitudinal Crack
     1: Transverse Crack
     2: Alligator Crack
     3: Pothole
   ```
4. Run the fine-tuning script:
   ```bash
   python train_pothole_model.py --data rdd2022.yaml --epochs 50 --imgsz 640 --batch 16
   ```
5. The script automatically exports the final weights to ONNX (`pothole_model.onnx`).
6. Copy `pothole_model.onnx` to NaviAble AI at:
   `public/models/pothole/model.onnx`

