# NaviAble AI — General Object Detection

## Active Production Model
- **Current Browser Model:** COCO-SSD with MobileNetV2 backbone
- **Framework:** TensorFlow.js (`@tensorflow-models/coco-ssd`)
- **Classes:** 80 COCO categories (pedestrians, vehicles, obstacles, signs, domestic furniture)
- **Runtime:** On-device WebGL / WASM acceleration (zero server latency)

## Upgrading to YOLOv8n / YOLOv11n (Optional)
To export and test YOLOv8n in ONNX Runtime Web:
```bash
python export_yolo_onnx.py yolov8n.pt
```
The resulting ONNX graph uses Opset 14 and dynamic batching for WebGPU.
