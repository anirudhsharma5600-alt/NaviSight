# Reproducible object-detection evaluation

`model_evaluator.py` scores **actual predictions** against human-labeled ground-truth boxes. It does not load a model, run inference, or make up benchmark results. The same hold-out manifest can be scored again with different confidence or IoU thresholds.

## Manifest format

Save a JSON file with `schema_version: 1`, model/device metadata, dataset metadata, and one entry per evaluated image:

```json
{
  "schema_version": 1,
  "model": {
    "name": "COCO-SSD lite_mobilenet_v2",
    "version": "prototype-2026-11-02",
    "runtime": "TensorFlow.js",
    "device": "Android phone model and OS"
  },
  "dataset": {
    "name": "NaviAble object hold-out v1",
    "split": "test",
    "capture_sessions": 12
  },
  "images": [
    {
      "id": "session-01-frame-0001",
      "capture_session": "session-01",
      "reviewed": true,
      "ground_truth": [
        {"class": "bottle", "bbox": [120, 80, 160, 300]}
      ],
      "predictions": [
        {"class": "bottle", "score": 0.87, "bbox": [123, 82, 158, 296]},
        {"class": "cup", "score": 0.41, "bbox": [120, 80, 160, 300]}
      ],
      "inference_latency_ms": 182,
      "capture_to_audio_ms": 540
    },
    {
      "id": "session-01-frame-0002",
      "capture_session": "session-01",
      "reviewed": true,
      "ground_truth": [],
      "predictions": [],
      "inference_latency_ms": 176
    }
  ]
}
```

Boxes use `[x, y, width, height]` pixels in the same original image coordinate system for labels and predictions. Every image must include `reviewed: true`, which means a person checked the complete image; this prevents an unannotated image from silently being treated as a negative. Include genuine empty scenes and hard negatives. Add `inference_latency_ms` and `capture_to_audio_ms` only when measured on the stated device; leave out unmeasured values. Do not put names, faces, GPS coordinates, or other personal data in the manifest.

## Run

```bash
python model_evaluator.py path/to/holdout_predictions.json --confidence 0 --iou 0.50 --output results.json
```

Use confidence `0` for predictions exported by the app, since the app has already applied its configured and per-class confidence thresholds. The report contains per-class true/false positives and negatives, precision, recall, F1, class confusions, macro precision/recall, and separate p50/p95 values for model inference and end-to-end capture-to-audio time when provided. A wrong class on a sufficiently overlapping box is recorded both as a false positive/false negative and in `class_confusions`.

The evaluator uses one-to-one greedy IoU matching. It does not calculate mAP, run COCO inference, or establish real-time performance by itself. Keep training and validation images out of the final test split, and separate people/capture sessions between splits to reduce near-duplicate leakage. Record the exact model, device, runtime, threshold, and dataset revision with every result.

## Current status

The repository's existing `test_assets/` contains only a handful of sample images and has no complete box annotations or prediction manifest. Therefore there is **no valid general-object accuracy result yet**. In local development, open `/model-evaluation` to annotate local images, run the current detector, and export a manifest. Images stay in the browser; the exported JSON contains labels and predictions, not image pixels.
