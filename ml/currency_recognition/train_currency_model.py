#!/usr/bin/env python3
"""
NaviAble AI — Indian Currency Recognition Training Script
Fine-tunes a MobileNetV3-Small classifier on Indian currency notes
and exports the trained weights directly to ONNX format.

Usage:
    python train_currency_model.py --data_dir ./dataset --epochs 25 --batch_size 32 --output_onnx model.onnx
"""

import argparse
import os
import sys
import time
import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import datasets, models, transforms

CLASSES = ["10", "20", "50", "100", "200", "500", "2000"]

def get_data_loaders(data_dir: str, batch_size: int):
    train_transforms = transforms.Compose([
        transforms.RandomResizedCrop(224),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(15),
        transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])

    val_transforms = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])

    train_dir = os.path.join(data_dir, "train")
    val_dir = os.path.join(data_dir, "val")

    if not os.path.exists(train_dir):
        raise FileNotFoundError(f"Training directory not found at: {train_dir}")
    if not os.path.exists(val_dir):
        raise FileNotFoundError(f"Validation directory not found at: {val_dir}")

    train_dataset = datasets.ImageFolder(train_dir, train_transforms)
    val_dataset = datasets.ImageFolder(val_dir, val_transforms)

    train_loader = torch.utils.data.DataLoader(
        train_dataset, batch_size=batch_size, shuffle=True, num_workers=2, pin_memory=True
    )
    val_loader = torch.utils.data.DataLoader(
        val_dataset, batch_size=batch_size, shuffle=False, num_workers=2, pin_memory=True
    )

    return train_loader, val_loader, len(train_dataset), len(val_dataset)

def build_model(num_classes: int = 7):
    print("[INFO] Loading pretrained MobileNetV3-Small backbone...")
    weights = models.MobileNet_V3_Small_Weights.DEFAULT
    model = models.mobilenet_v3_small(weights=weights)
    
    # Replace the final linear projection layer
    in_features = model.classifier[3].in_features
    model.classifier[3] = nn.Linear(in_features, num_classes)
    return model

def train_model(model, train_loader, val_loader, num_train, num_val, epochs: int, device: torch.device):
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    best_acc = 0.0
    best_weights = None

    print(f"[INFO] Starting training on device: {device}")
    for epoch in range(epochs):
        t0 = time.time()
        
        # Training phase
        model.train()
        running_loss = 0.0
        running_corrects = 0

        for inputs, labels in train_loader:
            inputs, labels = inputs.to(device), labels.to(device)
            optimizer.zero_grad()

            outputs = model(inputs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            _, preds = torch.max(outputs, 1)
            running_loss += loss.item() * inputs.size(0)
            running_corrects += torch.sum(preds == labels.data)

        scheduler.step()
        train_loss = running_loss / num_train
        train_acc = running_corrects.double() / num_train

        # Validation phase
        model.eval()
        val_loss = 0.0
        val_corrects = 0

        with torch.no_grad():
            for inputs, labels in val_loader:
                inputs, labels = inputs.to(device), labels.to(device)
                outputs = model(inputs)
                loss = criterion(outputs, labels)

                _, preds = torch.max(outputs, 1)
                val_loss += loss.item() * inputs.size(0)
                val_corrects += torch.sum(preds == labels.data)

        val_loss = val_loss / num_val
        val_acc = val_corrects.double() / num_val
        elapsed = time.time() - t0

        print(f"Epoch {epoch+1:02d}/{epochs:02d} [{elapsed:.1f}s] - "
              f"Train Loss: {train_loss:.4f} Acc: {train_acc:.4f} | "
              f"Val Loss: {val_loss:.4f} Acc: {val_acc:.4f}")

        if val_acc > best_acc:
            best_acc = val_acc
            best_weights = model.state_dict()

    print(f"\n[INFO] Best Validation Accuracy: {best_acc:.4f}")
    if best_weights is not None:
        model.load_state_dict(best_weights)
    return model

def export_onnx(model, output_path: str, device: torch.device):
    print(f"[INFO] Exporting model to ONNX format: {output_path}")
    model.eval()
    model.to("cpu")
    dummy_input = torch.randn(1, 3, 224, 224, requires_grad=False)

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
    print(f"[SUCCESS] Exported ONNX model to {output_path} ({os.path.getsize(output_path) / (1024*1024):.2f} MB)")

def main():
    parser = argparse.ArgumentParser(description="Train Indian Currency Recognition Model")
    parser.add_argument("--data_dir", type=str, required=True, help="Path to prepared dataset directory")
    parser.add_argument("--epochs", type=int, default=25, help="Number of training epochs")
    parser.add_argument("--batch_size", type=int, default=32, help="Mini-batch size")
    parser.add_argument("--output_onnx", type=str, default="currency_model.onnx", help="Path to save exported ONNX model")
    args = parser.parse_args()

    device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
    train_loader, val_loader, n_train, n_val = get_data_loaders(args.data_dir, args.batch_size)
    model = build_model(num_classes=len(CLASSES)).to(device)

    trained_model = train_model(model, train_loader, val_loader, n_train, n_val, args.epochs, device)
    export_onnx(trained_model, args.output_onnx, device)

if __name__ == "__main__":
    main()

