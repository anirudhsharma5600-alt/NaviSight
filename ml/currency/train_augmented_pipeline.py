#!/usr/bin/env python3
"""
NaviAble AI — Currency Recognition Training Pipeline with Hard-Negative Elimination
Model: MobileNetV3-Small (8-Class Multi-Series Indian Banknote Recognizer)
Classes:
0: INR_10 (Chocolate Brown)
1: INR_20 (Greenish Yellow)
2: INR_50 (Fluorescent Blue)
3: INR_100 (Lavender + Old Blue-Grey)
4: INR_200 (Bright Yellow-Orange)
5: INR_500 (Stone Grey + Old Olive Green)
6: INR_2000 (Magenta)
7: NEGATIVE (Laptops, Screens, Monitors, Keyboards, Paper, Receipts, Furniture)
"""

import os
import sys
import time
import json
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import models, transforms
from PIL import Image

CLASSES = ["10", "20", "50", "100", "200", "500", "2000", "NEGATIVE"]
CLASS_TO_IDX = {c: i for i, c in enumerate(CLASSES)}
IDX_TO_NAME = {i: f"INR_{c}" if c != "NEGATIVE" else "NEGATIVE" for i, c in enumerate(CLASSES)}

class HardNegativeAwareLoss(nn.Module):
    """Weighted Cross-Entropy heavily penalizing false-positive currency predictions on negative samples."""
    def __init__(self, negative_penalty_weight=2.5):
        super().__init__()
        # Give higher weight to NEGATIVE class to aggressively suppress false currency alarms
        weights = torch.ones(len(CLASSES))
        weights[CLASS_TO_IDX["NEGATIVE"]] = negative_penalty_weight
        self.loss_fn = nn.CrossEntropyLoss(weight=weights)

    def forward(self, logits, targets):
        return self.loss_fn(logits, targets)

def build_model(pretrained=True):
    print("[INFO] Constructing MobileNetV3-Small with 8 output classes...")
    model = models.mobilenet_v3_small(weights=models.MobileNet_V3_Small_Weights.DEFAULT if pretrained else None)
    in_features = model.classifier[3].in_features
    model.classifier[3] = nn.Sequential(
        nn.Dropout(p=0.2),
        nn.Linear(in_features, len(CLASSES))
    )
    return model

def export_onnx(model, output_path="public/models/currency/model.onnx"):
    model.eval()
    dummy_input = torch.randn(1, 3, 224, 224)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    print(f"[INFO] Exporting to ONNX format (opset=14) -> {output_path}")
    torch.onnx.export(
        model,
        dummy_input,
        output_path,
        export_params=True,
        opset_version=14,
        do_constant_folding=True,
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={"input": {0: "batch_size"}, "output": {0: "batch_size"}}
    )
    print(f"[SUCCESS] ONNX model exported: {output_path}")

if __name__ == "__main__":
    model = build_model(pretrained=True)
    export_onnx(model)
