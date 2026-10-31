# NaviAble AI — Indian Currency Recognition Pipeline

## Model Architecture
- **Base Architecture:** MobileNetV3-Small
- **Input Dimensions:** `[1, 3, 224, 224]` (Float32, normalized with ImageNet mean/std)
- **Output Dimensions:** `[1, 8]` (Logits across 8 classes)
- **Supported Denominations:**
  - `INR_10`: Chocolate Brown (Mahatma Gandhi New Series)
  - `INR_20`: Greenish Yellow (Mahatma Gandhi New Series)
  - `INR_50`: Fluorescent Blue (Mahatma Gandhi New Series)
  - `INR_100`: Lavender (New Series) & Blue-Grey (Old Series)
  - `INR_200`: Bright Yellow-Orange (New Series)
  - `INR_500`: Stone Grey (New Series) & Olive-Green (Old Series)
  - `INR_2000`: Magenta (New Series)
  - `NEGATIVE`: Hard negatives (laptops, screens, documents, receipts, domestic items)

## Two-Stage Verification Process
1. **Stage 1 (Physical Presence):** Edge-aspect ratio check ($\sim 2.15$), backlight/screen rejection, keyboard pattern detection.
2. **Stage 2 (Denomination Inference):** Neural network with open-set rejection (requires confidence $\ge 0.75$, margin $\ge 0.20$, chromatic verification).
