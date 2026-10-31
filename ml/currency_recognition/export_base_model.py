import os
import torch
import torchvision.models as models

def main():
    out_dir = os.path.join(os.getcwd(), 'public', 'models', 'currency')
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, 'model.onnx')

    print("[INFO] Building MobileNetV3-Small architecture for 7 Indian currency classes...")
    m = models.mobilenet_v3_small(weights=models.MobileNet_V3_Small_Weights.DEFAULT)
    in_features = m.classifier[3].in_features
    m.classifier[3] = torch.nn.Linear(in_features, 7)
    m.eval()

    dummy = torch.randn(1, 3, 224, 224)
    print(f"[INFO] Exporting to ONNX: {out_path}")
    torch.onnx.export(
        m,
        dummy,
        out_path,
        input_names=['input'],
        output_names=['output'],
        opset_version=18,
    )

    size_mb = os.path.getsize(out_path) / (1024 * 1024)
    print(f"[SUCCESS] ONNX model exported successfully ({size_mb:.2f} MB)")

if __name__ == '__main__':
    main()
