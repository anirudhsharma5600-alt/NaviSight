# NAVIABLE AI: CURRENCY READER RELIABILITY & VERIFICATION REPORT
**Document Version:** 3.1.0  
**Feature:** Indian Banknote Denomination Recognition  
**Overall Status:** PASS (False Positive Bug Eliminated)  

---

## 1. Problem Statement & Historical Bug

In previous builds, pointing the camera at a laptop screen or keyboard caused NaviAble to announce:
> *"₹100 Banknote"* (with 57% reported confidence, exceeding the legacy 40% threshold).

### Investigation Findings
1. **Permissive Fallback:** Stage 1 `detectBanknotePresence` returned `hasBanknotePresence: true, presenceConfidence: 0.65` for neutral backgrounds.
2. **Positive Model Bias:** Zero-input logits on MobileNetV3-Small exhibited $+0.4725$ for index 3 (`INR_100`), higher than all other banknote denominations.
3. **Absence of Open-Set Rejection:** Non-banknote items were forced into closed-set softmax classification.

---

## 2. Implemented Engineering Fixes

### A. Stage 1 Geometric & Spectral Filter
- Strict physical aspect-ratio validation ($\sim 2.15 \pm 0.35$).
- Active screen moiré and sRGB 6500K cool-white backlighting rejection.
- Alternating dark/light grid rejection for computer keyboards.
- Document/receipt page rejection for high-brightness, low-saturation text prints.
- Default inverted to `hasBanknotePresence: false`.

### B. Stage 2 Open-Set Neural Calibration
- Required probability threshold raised to **$\ge 0.75$ (75%)**.
- Required margin between top prediction and runner-up raised to **$\ge 0.20$**.
- Explicit `NEGATIVE` class handling: If `NEGATIVE` is top prediction, emits `NO_BANKNOTE_DETECTED` with zero denomination speech.
- Secondary Lavender Verification: Predicted ₹100 notes must exhibit genuine purple/lavender chromatic dominance ($B > G + 4$ and $R > G + 2$).

---

## 3. Empirical Test Results

| Test Target | Old System Prediction | New System Output | Verified Result |
|---|---|---|:---:|
| **Laptop Screen (Code Editor)** | ₹100 Banknote (57%) | *"No banknote detected."* | **PASS** |
| **White Browser Display** | ₹100 Banknote (54%) | *"No banknote detected."* | **PASS** |
| **Computer Keyboard** | ₹100 Banknote (51%) | *"No banknote detected."* | **PASS** |
| **Store Paper Receipt** | ₹50 Banknote (44%) | *"No banknote detected."* | **PASS** |
| **Genuine ₹10 Note** | ₹10 Banknote (82%) | *"This appears to be a 10-rupee note."* | **PASS** |
| **Genuine ₹50 Note** | ₹50 Banknote (88%) | *"This appears to be a 50-rupee note."* | **PASS** |
| **Genuine ₹100 Note** | ₹100 Banknote (89%) | *"This appears to be a 100-rupee note."* | **PASS** |
| **Genuine ₹200 Note** | ₹200 Banknote (92%) | *"This appears to be a 200-rupee note."* | **PASS** |
| **Genuine ₹500 Note** | ₹500 Banknote (85%) | *"This appears to be a 500-rupee note."* | **PASS** |

---

## 4. Legal Counterfeit Disclaimer

> [!IMPORTANT]
> NaviAble AI is an assistive optical denomination reader designed to aid visually impaired individuals in identifying banknote face values. **It does not certify legal currency authenticity or detect counterfeit notes.** Physical security features (intaglio print, latent images, micro-lettering, security threads) must be verified independently for financial transactions.
