# NAVIABLE AI: ₹100 AND ₹500 CURRENCY RECOGNITION ERROR ANALYSIS
**Document Version:** 3.2.0  
**Audit Date:** 2026-11-01  
**Investigation Scope:** Root Cause Analysis of ₹100 and ₹500 Recognition Failures  
**Status:** ROOT CAUSES IDENTIFIED & VERIFIED EMPIRICALLY  

---

## 1. Executive Summary

Empirical testing confirmed that while NaviAble AI's currency reader correctly recognizes ₹20 notes, it consistently failed to recognize ₹100 and ₹500 notes. 

A rigorous audit revealed that the failure was caused by a combination of **three distinct defects** in both the software filtering pipeline and the neural network weights:

1. **Stage 1 False Display Screen Rejection:** Stage 1 `detectBanknotePresence` incorrectly classified genuine ₹100 notes as "Computer screens / laptop displays" because their natural lavender spectrum has elevated Blue relative to Red ($avgB \ge avgR + 2$).
2. **Stage 1 & 2 Restrictive Color Gate on ₹500 & ₹100:** 
   - Authentic ₹100 notes have subtle pastel dyes with saturation between $0.08$ and $0.13$. Stage 1 enforced an unrealistic threshold of $\text{saturation} \ge 0.14$, causing immediate rejection.
   - Stage 1 enforced $G \ge R - 5$ for ₹500. Under warm ambient room lighting or for older Mahatma Gandhi ₹500 notes ($R \approx 184, G \approx 171$), $R$ exceeds $G$, causing immediate rejection.
   - Stage 2 contained a hardcoded filter requiring $B > G + 4$ and $R > G + 2$ for ₹100. In real rooms with warm lighting, $B$ drops below $G$, causing Stage 2 to override the model prediction and announce *"No banknote detected"*.
3. **Neural Network Negative Bias on New ₹100 Obverse:** In the ONNX neural model, `100_obverse.png` (the front of the Mahatma Gandhi New Series ₹100 note) was classified as `NEGATIVE` (68.9% confidence) because synthetic hard-negative web browser images overlapped with the lavender hue.

---

## 2. Model & Class Mapping Audit

### A. Class Order and Mapping
- Model Output Shape: `[1, 8]`
- Defined Class Array:
  ```typescript
  export const CURRENCY_CLASSES = [
    'INR_10',   // Index 0
    'INR_20',   // Index 1
    'INR_50',   // Index 2
    'INR_100',  // Index 3
    'INR_200',  // Index 4
    'INR_500',  // Index 5
    'INR_2000', // Index 6
    'NEGATIVE', // Index 7
  ]
  ```
- **Finding:** The class mapping and indices in `currencyDetection.ts` correctly matched the PyTorch training dictionary `CLASS_TO_IDX` (`10: 0, 20: 1, 50: 2, 100: 3, 200: 4, 500: 5, 2000: 6, NEGATIVE: 7`). The indices themselves were not swapped.

---

## 3. Dataset Audit & Sample Profile

### A. Raw Banknote Template Inventory
| Denomination | Obverse (Front) | Reverse (Back) | Older Series Template | Total Templates |
|---|---|---|---|:---:|
| **INR_20** | `20_obverse.jpg` (RGB) | `20_reverse.jpg` (RGB) | None | 2 |
| **INR_100** | `100_obverse.png` (RGBA) | `100_reverse.png` (RGB) | `100_old_obverse.jpg`, `100_old_reverse.jpg` | 4 |
| **INR_500** | `500_obverse.jpg` (RGB) | `500_reverse.jpg` (RGB) | `500_old_obverse.jpg`, `500_old_reverse.jpg` | 4 |

### B. Empirical Chromatic Profile of Actual Banknotes
| Template | Average R | Average G | Average B | Luma | Saturation | B - G | R - G |
|---|---|---|---|---|---|---|---|
| `100_obverse.png` (New Lavender) | 167.5 | 160.0 | 184.5 | 165.0 | **0.13** | +24.4 | +7.4 |
| `100_reverse.png` (New Lavender) | 181.8 | 171.0 | 188.4 | 176.2 | **0.09** | +17.4 | +10.9 |
| `100_old_obverse.jpg` (Old Blue-Grey)| 198.0 | 196.0 | 186.3 | 195.5 | **0.06** | -9.7 | +2.0 |
| `20_obverse.jpg` (New Yellow-Green) | 218.8 | 216.0 | 155.8 | 210.0 | **0.29** | -60.1 | +2.8 |
| `500_obverse.jpg` (New Stone Grey) | 178.8 | 181.7 | 154.7 | 177.7 | **0.15** | -27.0 | -2.9 |
| `500_old_obverse.jpg` (Old Olive) | 184.0 | 171.0 | 131.9 | 170.4 | **0.28** | -39.1 | +13.0 |

---

## 4. Root Causes Breakdown

### Root Cause 1: Stage 1 Anti-Screen Filter Trapped ₹100 Notes
In `detectBanknotePresence`, Rule 3 was designed to reject cool-white digital display screens:
```typescript
if (avgLuma > 120 && saturation < 0.12 && (avgB >= avgR + 2 || maxChannelDiff < 16)) {
  return { hasBanknotePresence: false, rejectionReason: 'Computer screen / laptop display' }
}
```
Because the Mahatma Gandhi New Series ₹100 note has a lavender tint where $avgB (184.5) > avgR (167.5) + 2$ and subtle saturation ($0.09$ to $0.13$), **Rule 3 incorrectly flagged all ₹100 notes as computer screens**, aborting inference before the neural network could ever execute!

### Root Cause 2: Incompatible Stage 1 Color Rules for ₹500
The Stage 1 rule for ₹500 was:
```typescript
else if (avgG >= avgR - 5 && avgG >= avgB - 5 && avgLuma > 80 && avgLuma < 190 && hGrad > 1.2 && vGrad > 1.2 && saturation >= 0.10)
```
In real conditions:
- Older Mahatma Gandhi ₹500 notes have olive-brown dye with $avgR = 184.0$ and $avgG = 171.0$ ($R - G = 13.0$). Because $171 < 184 - 5$, older ₹500 notes were always rejected.
- When holding a new ₹500 note under warm indoor LED or tungsten lighting, ambient red illumination elevates $R$ above $G$, causing the heuristic to fail.

### Root Cause 3: Neural Model Output Confusion on `100_obverse.png`
When testing the raw ONNX model on `100_obverse.png`:
- Predicted Class: `NEGATIVE` (**68.9%**)
- Probability for `INR_100`: only **10.3%**
The synthetic hard-negative dataset included e-commerce browser pages and chat apps whose light-blue/gray backgrounds heavily conflicted with the Mahatma Gandhi New Series obverse, causing the neural weights to misclassify the front of ₹100 notes as hard negatives.

### Root Cause 4: Stage 2 Lavender Chromatic Guard Overrode Model Predictions
In `recognizeBanknote`:
```typescript
else if (topMatch.cls === 'INR_100' && !(chromaticProfile.b > chromaticProfile.g + 4 && chromaticProfile.r > chromaticProfile.g + 2)) {
  isConfident = false
  spokenText = noBanknoteSpeech
}
```
Even if a model predicted ₹100, if the camera captured the note under warm lighting, $B$ dropped below $G + 4$, causing this guard to suppress the prediction and speak *"No banknote detected"*.

---

## 5. Engineering Action Plan

1. **Retrain MobileNetV3-Small:**
   - Retrain with diverse real-world photographic augmentations (perspective tilt, folds, real warm/cool lighting shifts, hand shadow, blur).
   - Ensure `100_obverse.png` and `100_reverse.png` achieve $\ge 98\%$ confidence as `INR_100`.
   - Ensure all ₹500 variants achieve $\ge 98\%$ confidence as `INR_500`.
   - Prevent `NEGATIVE` from absorbing genuine banknotes.
2. **Overhaul Stage 1 `detectBanknotePresence`:**
   - Differentiate screens using pixel grid variance, edge frequency, and moiré rather than broad average channel comparisons that catch lavender.
   - Relax denomination-specific spectral bounds to accommodate real-world lighting shifts ($sat \ge 0.05$).
3. **Overhaul Stage 2 Calibration:**
   - Remove hardcoded chromatic overrides that contradict the neural network.
   - Use soft Bayesian chromatic confidence fusion rather than binary vetoes.
4. **Preserve ₹20 Recognition:**
   - Ensure ₹20 performance remains at 100% precision and recall.

---

*End of Currency Error Analysis.*

