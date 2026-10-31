#!/usr/bin/env python3
"""
NaviAble AI — Road Hazard and Pothole Detection Training Script
Fine-tunes YOLOv8n on the RDD2022 dataset and exports the resulting
model to ONNX format for web deployment.

Usage:
    python train_pothole_model.py --data rdd2022.yaml --epochs 50 --batch 16 --output_onnx pothole_model.onnx
"""

import argparse
import os
import sys

def check_dependencies():
    try:
        from ultralytics import YOLO
    except ImportError:
        print("[ERROR] Ultralytics is not installed. Run: pip install ultralytics")
        sys.exit(1)

def train_and_export(data_config: str, epochs: int, batch_size: int, imgsz: int, output_onnx: str):
    from ultralytics import YOLO

    print(f"[INFO] Initializing YOLOv8n pretrained weights...")
    model = YOLO("yolov8n.pt")

    print(f"[INFO] Launching training for {epochs} epochs on {data_config} (imgsz={imgsz}, batch={batch_size})...")
    results = model.train(
        data=data_config,
        epochs=epochs,
        batch=batch_size,
        imgsz=imgsz,
        save=True,
        plots=True,
        device=0 if os.environ.get("CUDA_VISIBLE_DEVICES") != "" else "cpu"
    )

    print("\n[INFO] Training complete. Evaluating validation split...")
    metrics = model.val()
    print(f"[METRICS] mAP50-95: {metrics.box.map:.4f} | mAP50: {metrics.box.map50:.4f}")

    print(f"[INFO] Exporting model to ONNX with opset=14...")
    exported_path = model.export(format="onnx", opset=14, dynamic=True, simplify=True)
    
    if os.path.exists(exported_path) and exported_path != output_onnx:
        import shutil
        shutil.copy(exported_path, output_onnx)
        print(f"[SUCCESS] ONNX model successfully saved to: {output_onnx}")
    else:
        print(f"[SUCCESS] ONNX model exported to: {exported_path}")

def main():
    parser = argparse.ArgumentParser(description="Train Pothole and Road Damage Detector")
    parser.add_argument("--data", type=str, default="rdd2022.yaml", help="Path to data configuration YAML file")
    parser.add_argument("--epochs", type=int, default=50, help="Number of training epochs")
    parser.add_argument("--batch", type=int, default=16, help="Batch size")
    parser.add_argument("--imgsz", type=int, default=640, help="Input image dimension")
    parser.add_argument("--output_onnx", type=str, default="pothole_model.onnx", help="Exported ONNX file path")
    args = parser.parse_args()

    check_dependencies()
    train_and_export(args.data, args.epochs, args.batch, args.imgsz, args.output_onnx)

if __name__ == "__main__":
    main()

