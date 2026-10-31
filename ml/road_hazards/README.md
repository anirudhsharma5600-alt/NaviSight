# NaviAble AI — Road Hazard and Pothole Model Training

## Overview
This module trains the lightweight **YOLOv8n** model on the **Road Damage Dataset 2022 (RDD2022)** to identify surface hazards on sidewalks and roads:
1. `D00`: Longitudinal Cracks
2. `D10`: Transverse Cracks
3. `D20`: Alligator Cracks
4. `D40`: Potholes / Ground Depressions
5. `BrokenPavement`: Uneven kerbs and sidewalk fissures
6. `OpenDrain`: Missing manhole covers and street gratings

## Training Instructions
1. Download RDD2022 dataset from GRDDC 2022 challenge: `https://crddc2022.sekilab.global/`
2. Run parser to convert to YOLO annotations:
   ```bash
   python rdd2022_loader.py
   ```
3. Run training script:
   ```bash
   python train_pothole_model.py --data rdd2022.yaml --epochs 50 --batch 16 --output_onnx ../../public/models/pothole/model.onnx
   ```
4. For Google Colab training, open and run `train_road_hazards_colab.ipynb` with GPU runtime.

## Safety & Disclaimer
Road hazard detection is strictly assistive. NaviAble never guarantees that a walkway is 100% free of obstructions or defects.
