#!/usr/bin/env python3
"""
NaviAble AI — Road Hazard and Pothole Detection Training Script
Architecture: YOLOv8n (Pretrained on COCO, Fine-tuned on RDD2022)
Target Export: ONNX Opset 14 (WebGPU / WASM execution for browser)

Classes:
0: Longitudinal Crack (D00)
1: Transverse Crack (D10)
2: Alligator Crack (D20)
3: Pothole / Surface Depression (D40)
4: Broken Pavement
5: Open Drain
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
    # Training configuration with realistic augmentations for road navigation
    results = model.train(
        data=data_config,
        epochs=epochs,
        batch=batch_size,
        imgsz=imgsz,
        save=True,
        plots=True,
        hsv_h=0.015,     # Color hue jitter
        hsv_s=0.5,       # Saturation jitter
        hsv_v=0.4,       # Brightness jitter for shadows and sun flare
        degrees=10.0,    # Handheld camera tilt
        translate=0.1,   # Walking translation
        scale=0.3,       # Distance scale variation
        perspective=0.0005,
        flipud=0.0,      # Do NOT flip upside down (ground must remain at bottom)
        fliplr=0.5,      # Left-right flip is valid
        mosaic=1.0,      # Mosaic augmentation for multi-hazard scenes
        device=0 if os.environ.get("CUDA_VISIBLE_DEVICES") != "" else "cpu"
    )

    print("\n[INFO] Training complete. Evaluating validation split...")
    metrics = model.val()
    print(f"[METRICS] mAP50-95: {metrics.box.map:.4f} | mAP50: {metrics.box.map50:.4f}")

    print(f"[INFO] Exporting model to ONNX with opset=14 for onnxruntime-web...")
    exported_path = model.export(
        format="onnx",
        opset=14,
        dynamic=True,
        simplify=True
    )
    
    if os.path.exists(exported_path) and exported_path != output_onnx:
        import shutil
        shutil.copy(exported_path, output_onnx)
        print(f"[SUCCESS] ONNX model successfully saved to: {output_onnx}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="NaviAble AI YOLOv8n Road Hazard Fine-Tuning")
    parser.add_argument("--data", type=str, default="rdd2022.yaml", help="Path to dataset YAML config")
    parser.add_argument("--epochs", type=int, default=50, help="Number of training epochs")
    parser.add_argument("--batch", type=int, default=16, help="Batch size")
    parser.add_argument("--imgsz", type=int, default=640, help="Input resolution")
    parser.add_argument("--output_onnx", type=str, default="public/models/pothole/model.onnx", help="Export path")

    args = parser.parse_args()
    check_dependencies()
    train_and_export(args.data, args.epochs, args.batch, args.imgsz, args.output_onnx)
