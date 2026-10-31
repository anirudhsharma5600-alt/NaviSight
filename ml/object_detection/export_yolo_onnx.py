"""
NaviAble AI — YOLOv8 / YOLOv11 ONNX Exporter for WebGPU
Exports ultralytics YOLO models to WebGPU-compatible ONNX graphs with Opset 14.
"""

import sys

def export_yolo_for_web(model_weights="yolov8n.pt", output_path="public/models/objects/yolov8n.onnx"):
    try:
        from ultralytics import YOLO
    except ImportError:
        print("[ERROR] ultralytics not installed. Install via: pip install ultralytics")
        return
        
    print(f"[INFO] Loading YOLO weights from: {model_weights}")
    model = YOLO(model_weights)
    
    print(f"[INFO] Exporting to ONNX (opset=14, dynamic=True, simplify=True)...")
    exported = model.export(
        format="onnx",
        opset=14,
        dynamic=True,
        simplify=True
    )
    print(f"[SUCCESS] WebGPU/WASM compatible ONNX model ready: {exported}")

if __name__ == "__main__":
    weights = sys.argv[1] if len(sys.argv) > 1 else "yolov8n.pt"
    export_yolo_for_web(weights)

