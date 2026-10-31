"""
NaviAble AI — Shared Evaluation Metrics Calculator
Computes Precision, Recall, F1, Confusion Matrix, FPR, FNR, and Latency.
"""

from typing import Dict, List, Any
import numpy as np

def compute_classification_metrics(y_true: List[int], y_pred: List[int], class_names: List[str]) -> Dict[str, Any]:
    """Computes comprehensive multi-class classification metrics."""
    num_classes = len(class_names)
    cm = np.zeros((num_classes, num_classes), dtype=int)
    
    for t, p in zip(y_true, y_pred):
        if 0 <= t < num_classes and 0 <= p < num_classes:
            cm[t, p] += 1
            
    total_samples = len(y_true)
    correct_samples = int(np.trace(cm))
    accuracy = correct_samples / total_samples if total_samples > 0 else 0.0
    
    per_class = {}
    for i, name in enumerate(class_names):
        tp = int(cm[i, i])
        fp = int(np.sum(cm[:, i]) - tp)
        fn = int(np.sum(cm[i, :]) - tp)
        tn = int(total_samples - (tp + fp + fn))
        
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
        fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
        fnr = fn / (fn + tp) if (fn + tp) > 0 else 0.0
        
        per_class[name] = {
            "tp": tp,
            "fp": fp,
            "fn": fn,
            "tn": tn,
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1": round(f1, 4),
            "false_positive_rate": round(fpr, 4),
            "false_negative_rate": round(fnr, 4),
            "support": int(np.sum(cm[i, :]))
        }
        
    return {
        "overall_accuracy": round(accuracy, 4),
        "total_samples": total_samples,
        "per_class": per_class,
        "confusion_matrix": cm.tolist()
    }

def compute_detection_iou(box1: List[float], box2: List[float]) -> float:
    """Computes Intersection-over-Union between two boxes [x, y, w, h]."""
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[0] + box1[2], box2[0] + box2[2])
    y2 = min(box1[1] + box1[3], box2[1] + box2[3])
    
    intersection = max(0, x2 - x1) * max(0, y2 - y1)
    area1 = box1[2] * box1[3]
    area2 = box2[2] * box2[3]
    union = area1 + area2 - intersection
    return intersection / union if union > 0 else 0.0
