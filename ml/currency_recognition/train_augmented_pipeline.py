#!/usr/bin/env python3
"""
NaviAble AI — High-Accuracy Indian Currency Recognition Training & Evaluation Pipeline
Fine-tunes MobileNetV3-Small on the curated 7-class Indian banknote dataset (Modern + Legacy series)
and exports directly to standalone ONNX format for ONNX Runtime Web.
"""

import os
import sys

# Ensure UTF-8 output encoding on Windows console
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

import time
import json
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import models, transforms
from PIL import Image

CLASSES = ["10", "20", "50", "100", "200", "500", "2000", "NEGATIVE"]
CLASS_TO_IDX = {
    "10": 0,
    "20": 1,
    "50": 2,
    "100": 3,
    "200": 4,
    "500": 5,
    "2000": 6,
    "NEGATIVE": 7
}
IDX_TO_NAME = {
    0: "INR_10",
    1: "INR_20",
    2: "INR_50",
    3: "INR_100",
    4: "INR_200",
    5: "INR_500",
    6: "INR_2000",
    7: "NEGATIVE"
}

class CurrencyDataset(torch.utils.data.Dataset):
    def __init__(self, root_dir, transform=None):
        self.root_dir = root_dir
        self.transform = transform
        self.samples = []
        
        for cls_name, cls_idx in CLASS_TO_IDX.items():
            cls_folder = os.path.join(root_dir, cls_name)
            if not os.path.isdir(cls_folder):
                continue
            for fname in os.listdir(cls_folder):
                if fname.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
                    self.samples.append((os.path.join(cls_folder, fname), cls_idx))
                    
    def __len__(self):
        return len(self.samples)
        
    def __getitem__(self, idx):
        path, label = self.samples[idx]
        img = Image.open(path).convert('RGB')
        if self.transform:
            img = self.transform(img)
        return img, label

def get_loaders(dataset_dir, batch_size=32):
    train_transforms = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.ColorJitter(brightness=0.15, contrast=0.15, saturation=0.15),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])
    
    eval_transforms = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])
    
    train_ds = CurrencyDataset(os.path.join(dataset_dir, 'train'), transform=train_transforms)
    val_ds = CurrencyDataset(os.path.join(dataset_dir, 'val'), transform=eval_transforms)
    test_ds = CurrencyDataset(os.path.join(dataset_dir, 'test'), transform=eval_transforms)
    
    train_loader = torch.utils.data.DataLoader(train_ds, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = torch.utils.data.DataLoader(val_ds, batch_size=batch_size, shuffle=False, num_workers=0)
    test_loader = torch.utils.data.DataLoader(test_ds, batch_size=batch_size, shuffle=False, num_workers=0)
    
    return train_loader, val_loader, test_loader, len(train_ds), len(val_ds), len(test_ds)

def evaluate_metrics(model, dataloader, device):
    model.eval()
    all_preds = []
    all_labels = []
    
    with torch.no_grad():
        for inputs, targets in dataloader:
            inputs = inputs.to(device)
            outputs = model(inputs)
            preds = torch.argmax(outputs, dim=1).cpu().numpy()
            all_preds.extend(preds)
            all_labels.extend(targets.numpy())
            
    all_preds = np.array(all_preds)
    all_labels = np.array(all_labels)
    
    num_classes = len(CLASSES)
    conf_matrix = np.zeros((num_classes, num_classes), dtype=int)
    for t, p in zip(all_labels, all_preds):
        conf_matrix[t, p] += 1
        
    metrics = {}
    for i in range(num_classes):
        tp = conf_matrix[i, i]
        fp = conf_matrix[:, i].sum() - tp
        fn = conf_matrix[i, :].sum() - tp
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
        metrics[IDX_TO_NAME[i]] = {
            "precision": float(round(precision, 4)),
            "recall": float(round(recall, 4)),
            "f1": float(round(f1, 4)),
            "support": int(conf_matrix[i, :].sum())
        }
        
    accuracy = float(round((all_preds == all_labels).mean(), 4))
    return accuracy, conf_matrix, metrics

def train(epochs=6, batch_size=32, lr=5e-4):
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"[INFO] Using training device: {device}")
    
    dataset_dir = os.path.join(os.path.dirname(__file__), 'dataset')
    train_loader, val_loader, test_loader, n_train, n_val, n_test = get_loaders(dataset_dir, batch_size)
    print(f"[INFO] Train samples: {n_train} | Val samples: {n_val} | Test samples: {n_test}")
    
    print("[INFO] Building MobileNetV3-Small backbone...")
    model = models.mobilenet_v3_small(weights=models.MobileNet_V3_Small_Weights.DEFAULT)
    in_features = model.classifier[3].in_features
    model.classifier[3] = nn.Linear(in_features, len(CLASSES))
    model = model.to(device)
    
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
    
    best_val_acc = 0.0
    best_weights = None
    
    print("\n--- Training Loop ---")
    for epoch in range(1, epochs + 1):
        t0 = time.time()
        model.train()
        running_loss = 0.0
        running_correct = 0
        
        for inputs, targets in train_loader:
            inputs, targets = inputs.to(device), targets.to(device)
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, targets)
            loss.backward()
            optimizer.step()
            
            running_loss += loss.item() * inputs.size(0)
            preds = torch.argmax(outputs, dim=1)
            running_correct += (preds == targets).sum().item()
            
        scheduler.step()
        train_loss = running_loss / n_train
        train_acc = running_correct / n_train
        
        val_acc, _, _ = evaluate_metrics(model, val_loader, device)
        elapsed = time.time() - t0
        
        print(f"Epoch {epoch:02d}/{epochs:02d} [{elapsed:.1f}s] - Train Loss: {train_loss:.4f} Acc: {train_acc*100:.2f}% | Val Acc: {val_acc*100:.2f}%")
        
        if val_acc >= best_val_acc:
            best_val_acc = val_acc
            best_weights = {k: v.cpu().clone() for k, v in model.state_dict().items()}
            
    print(f"\n[INFO] Best Validation Accuracy: {best_val_acc*100:.2f}%")
    if best_weights:
        model.load_state_dict(best_weights)
        
    # Save PyTorch weights
    pth_path = os.path.join(os.path.dirname(__file__), 'currency_mobilenetv3_best.pth')
    torch.save(best_weights, pth_path)
    print(f"[SAVED] Saved best PyTorch weights to: {pth_path}")
        
    print("\n--- Independent Test Set Evaluation ---")
    test_acc, conf_mat, test_metrics = evaluate_metrics(model, test_loader, device)
    print(f"Independent Test Accuracy: {test_acc*100:.2f}%\n")
    print("Per-Denomination Performance:")
    for cls_name, m in test_metrics.items():
        print(f"  {cls_name:<10} | Precision: {m['precision']*100:.1f}% | Recall: {m['recall']*100:.1f}% | F1: {m['f1']*100:.1f}% (Support: {m['support']})")
        
    print("\nConfusion Matrix (Rows=True, Cols=Predicted):")
    header = "       " + " ".join([f"{c:>7}" for c in CLASSES])
    print(header)
    for i, row in enumerate(conf_mat):
        row_str = f"{CLASSES[i]:>6} " + " ".join([f"{val:>7}" for val in row])
        print(row_str)
        
    # Save evaluation results to JSON
    report = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "metric_validity": "SYNTHETIC_TEMPLATE_SPLIT_ONLY",
        "evaluation_caveat": "The current generator reuses the same raw banknote templates across train, validation, and test via different augmentations. These metrics are not independent real-world accuracy estimates and must not be used as phone-field accuracy claims.",
        "model_architecture": "MobileNetV3-Small",
        "input_resolution": "224x224x3",
        "classes": [IDX_TO_NAME[i] for i in range(len(CLASSES))],
        "class_mapping": CLASS_TO_IDX,
        "train_samples": n_train,
        "val_samples": n_val,
        "test_samples": n_test,
        "best_val_accuracy": float(best_val_acc),
        "test_accuracy": float(test_acc),
        "test_metrics": test_metrics,
        "confusion_matrix": conf_mat.tolist()
    }
    
    report_path = os.path.join(os.path.dirname(__file__), 'training_report.json')
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2)
    print(f"\n[SAVED] Training report saved to: {report_path}")
    
    # Export to ONNX using legacy TorchScript exporter (no dynamo emoji printing bugs)
    onnx_dest = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'models', 'currency', 'model.onnx'))
    os.makedirs(os.path.dirname(onnx_dest), exist_ok=True)
    print(f"[INFO] Exporting trained model to ONNX: {onnx_dest}")
    model.eval()
    model.to('cpu')
    dummy_input = torch.randn(1, 3, 224, 224)
    
    try:
        torch.onnx.export(
            model,
            dummy_input,
            onnx_dest,
            export_params=True,
            opset_version=14,
            do_constant_folding=True,
            input_names=['input'],
            output_names=['output'],
            dynamo=False
        )
    except Exception as e:
        print(f"[FALLBACK] Exporting without dynamo parameter: {e}")
        torch.onnx.export(
            model,
            dummy_input,
            onnx_dest,
            export_params=True,
            opset_version=14,
            do_constant_folding=True,
            input_names=['input'],
            output_names=['output']
        )
    
    size_mb = os.path.getsize(onnx_dest) / (1024 * 1024)
    print(f"[SUCCESS] ONNX model exported successfully ({size_mb:.2f} MB)")
    
    # Also copy to dist if dist exists
    dist_dest = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'dist', 'models', 'currency', 'model.onnx'))
    if os.path.exists(os.path.dirname(dist_dest)):
        import shutil
        shutil.copyfile(onnx_dest, dist_dest)
        print(f"[INFO] Synced ONNX model to dist build folder: {dist_dest}")

if __name__ == '__main__':
    train(epochs=6, batch_size=32, lr=5e-4)
