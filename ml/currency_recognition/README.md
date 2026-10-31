# Indian Currency Recognition — Training Pipeline

## Overview
This pipeline trains a lightweight `MobileNetV3-Small` deep neural network to classify 7 denominations of Indian banknotes:
- ₹10 (Chocolate Brown)
- ₹20 (Greenish Yellow)
- ₹50 (Fluorescent Blue)
- ₹100 (Lavender)
- ₹200 (Bright Yellow)
- ₹500 (Stone Grey)
- ₹2000 (Magenta)

---

## Dataset Preparation
- **Source:** Kaggle "Indian Currency Notes" dataset or similar curated collection (~1,786 images across 7 classes).
- **Directory Layout:**
  ```text
  dataset/
  ├── train/
  │   ├── 10/
  │   ├── 20/
  │   ├── 50/
  │   ├── 100/
  │   ├── 200/
  │   ├── 500/
  │   └── 2000/
  └── val/
      ├── 10/
      ├── 20/
      ...
  ```

---

## Training on Google Colab (Step-by-Step)
1. Open [Google Colab](https://colab.research.google.com).
2. Set Runtime to **GPU** (`Runtime -> Change runtime type -> T4 GPU`).
3. Upload `train_currency_model.py` and your dataset zip.
4. Unzip your dataset:
   ```bash
   unzip dataset.zip -d ./dataset
   ```
5. Install dependencies:
   ```bash
   pip install torch torchvision onnx onnxruntime Pillow
   ```
6. Run the training script:
   ```bash
   python train_currency_model.py --data_dir ./dataset --epochs 25 --batch_size 32 --output_onnx model.onnx
   ```
7. Download `model.onnx` and place it in NaviAble AI at:
   `public/models/currency/model.onnx`

---

## Output Metrics & Validation
- **Target Top-1 Accuracy:** > 96%
- **Input Dimensions:** 3 x 224 x 224 (Normalized with ImageNet mean & std)
- **Output:** 7 class logits (Softmax for probability distribution)
- **ONNX Model Size:** ~9.5 MB
