#!/usr/bin/env python3
"""Evaluate labeled object-detection predictions without inventing metrics.

The model must be run separately and its predictions saved in the JSON format
documented in README.md. This script scores those real predictions against
ground-truth boxes; it does not run inference or claim device performance.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def box_iou(first: list[float], second: list[float]) -> float:
    """Return intersection-over-union for [x, y, width, height] boxes."""
    ax1, ay1, aw, ah = first
    bx1, by1, bw, bh = second
    ax2, ay2 = ax1 + aw, ay1 + ah
    bx2, by2 = bx1 + bw, by1 + bh

    intersection_width = max(0.0, min(ax2, bx2) - max(ax1, bx1))
    intersection_height = max(0.0, min(ay2, by2) - max(ay1, by1))
    intersection = intersection_width * intersection_height
    union = aw * ah + bw * bh - intersection
    return intersection / union if union > 0 else 0.0


def validate_box(box: Any, context: str) -> list[float]:
    if not isinstance(box, list) or len(box) != 4:
        raise ValueError(f"{context}: bbox must be [x, y, width, height].")
    if any(not isinstance(value, (int, float)) or not math.isfinite(value) for value in box):
        raise ValueError(f"{context}: bbox values must be finite numbers.")
    if box[2] <= 0 or box[3] <= 0:
        raise ValueError(f"{context}: bbox width and height must be positive.")
    return [float(value) for value in box]


def validate_detection(item: Any, context: str, prediction: bool) -> dict[str, Any]:
    if not isinstance(item, dict):
        raise ValueError(f"{context}: detection must be a JSON object.")
    class_name = item.get("class")
    if not isinstance(class_name, str) or not class_name.strip():
        raise ValueError(f"{context}: class must be a non-empty string.")

    result: dict[str, Any] = {
        "class": class_name.strip().lower(),
        "bbox": validate_box(item.get("bbox"), context),
    }
    if prediction:
        score = item.get("score")
        if not isinstance(score, (int, float)) or not math.isfinite(score) or not 0 <= score <= 1:
            raise ValueError(f"{context}: prediction score must be between 0 and 1.")
        result["score"] = float(score)
    return result


def percentile(values: list[float], percent: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = (len(ordered) - 1) * percent
    lower = math.floor(index)
    upper = math.ceil(index)
    if lower == upper:
        return round(ordered[lower], 2)
    fraction = index - lower
    return round(ordered[lower] * (1 - fraction) + ordered[upper] * fraction, 2)


def evaluate(manifest: dict[str, Any], confidence_threshold: float, iou_threshold: float) -> dict[str, Any]:
    if manifest.get("schema_version") != 1:
        raise ValueError("manifest schema_version must be 1; see ml/evaluation/README.md.")
    images = manifest.get("images")
    if not isinstance(images, list) or not images:
        raise ValueError("manifest must contain a non-empty images array.")

    counts: dict[str, Counter[str]] = defaultdict(Counter)
    confusions: Counter[tuple[str, str]] = Counter()
    inference_latencies: list[float] = []
    capture_to_audio_latencies: list[float] = []
    truth_total = 0
    predictions_total = 0

    for image_index, image in enumerate(images):
        context = f"images[{image_index}]"
        if not isinstance(image, dict):
            raise ValueError(f"{context} must be a JSON object.")
        if image.get("reviewed") is not True:
            raise ValueError(f"{context}: set reviewed=true only after checking all labels, including true empty scenes.")
        if "ground_truth" not in image or "predictions" not in image:
            raise ValueError(f"{context}: explicitly provide ground_truth and predictions arrays; use [] for a reviewed empty array.")
        ground_truth_raw = image.get("ground_truth", [])
        predictions_raw = image.get("predictions", [])
        if not isinstance(ground_truth_raw, list) or not isinstance(predictions_raw, list):
            raise ValueError(f"{context}: ground_truth and predictions must be arrays.")

        ground_truth = [
            validate_detection(item, f"{context}.ground_truth[{index}]", False)
            for index, item in enumerate(ground_truth_raw)
        ]
        predictions = [
            validate_detection(item, f"{context}.predictions[{index}]", True)
            for index, item in enumerate(predictions_raw)
        ]
        predictions = [item for item in predictions if item["score"] >= confidence_threshold]
        predictions.sort(key=lambda item: item["score"], reverse=True)
        truth_total += len(ground_truth)
        predictions_total += len(predictions)

        for field, values in (
            ("inference_latency_ms", inference_latencies),
            ("capture_to_audio_ms", capture_to_audio_latencies),
        ):
            latency = image.get(field)
            if latency is not None:
                if not isinstance(latency, (int, float)) or not math.isfinite(latency) or latency < 0:
                    raise ValueError(f"{context}.{field} must be a non-negative number.")
                values.append(float(latency))

        matched_truth: set[int] = set()
        for prediction in predictions:
            best_index = -1
            best_iou = 0.0
            for truth_index, truth in enumerate(ground_truth):
                if truth_index in matched_truth:
                    continue
                overlap = box_iou(prediction["bbox"], truth["bbox"])
                if overlap > best_iou:
                    best_index = truth_index
                    best_iou = overlap

            predicted_class = prediction["class"]
            if best_index >= 0 and best_iou >= iou_threshold:
                matched_truth.add(best_index)
                actual_class = ground_truth[best_index]["class"]
                if predicted_class == actual_class:
                    counts[predicted_class]["tp"] += 1
                else:
                    counts[predicted_class]["fp"] += 1
                    counts[actual_class]["fn"] += 1
                    confusions[(actual_class, predicted_class)] += 1
            else:
                counts[predicted_class]["fp"] += 1

        for truth_index, truth in enumerate(ground_truth):
            if truth_index not in matched_truth:
                counts[truth["class"]]["fn"] += 1

    per_class: dict[str, Any] = {}
    for class_name in sorted(counts):
        tp = counts[class_name]["tp"]
        fp = counts[class_name]["fp"]
        fn = counts[class_name]["fn"]
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        per_class[class_name] = {
            "true_positives": tp,
            "false_positives": fp,
            "false_negatives": fn,
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1": round(f1, 4),
        }

    confusion_rows = [
        {"actual": actual, "predicted": predicted, "count": count}
        for (actual, predicted), count in sorted(confusions.items())
    ]
    measured_classes = [row for row in per_class.values() if row["true_positives"] + row["false_positives"] + row["false_negatives"]]

    result: dict[str, Any] = {
        "status": "evaluated",
        "model": manifest.get("model", {}),
        "dataset": manifest.get("dataset", {}),
        "thresholds": {"confidence": confidence_threshold, "iou": iou_threshold},
        "image_count": len(images),
        "ground_truth_box_count": truth_total,
        "prediction_count_after_confidence_filter": predictions_total,
        "macro_precision": round(sum(row["precision"] for row in measured_classes) / len(measured_classes), 4) if measured_classes else 0.0,
        "macro_recall": round(sum(row["recall"] for row in measured_classes) / len(measured_classes), 4) if measured_classes else 0.0,
        "per_class": per_class,
        "class_confusions": confusion_rows,
        "timing_ms": {
            "inference": {
                "sample_count": len(inference_latencies),
                "p50": percentile(inference_latencies, 0.50),
                "p95": percentile(inference_latencies, 0.95),
            },
            "capture_to_audio": {
                "sample_count": len(capture_to_audio_latencies),
                "p50": percentile(capture_to_audio_latencies, 0.50),
                "p95": percentile(capture_to_audio_latencies, 0.95),
            },
        },
        "limitations": [
            "Scores only the predictions supplied in the manifest; it does not run model inference.",
            "Precision/recall use one-to-one greedy IoU matching; mAP is not calculated.",
            "Inference and capture-to-audio timing are reported separately; only include measured values from the stated device.",
        ],
    }
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path, help="JSON file with ground-truth boxes and actual predictions")
    parser.add_argument("--confidence", type=float, default=0.0, help="Additional score filter; use 0 for app predictions already filtered by the app (default: 0)")
    parser.add_argument("--iou", type=float, default=0.50, help="IoU match threshold (default: 0.50)")
    parser.add_argument("--output", type=Path, help="Optional path to save the result JSON")
    args = parser.parse_args()

    if not 0 <= args.confidence <= 1 or not 0 < args.iou <= 1:
        parser.error("--confidence must be in [0, 1] and --iou must be in (0, 1].")
    try:
        manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
        if not isinstance(manifest, dict):
            raise ValueError("manifest root must be a JSON object.")
        result = evaluate(manifest, args.confidence, args.iou)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        print(f"Evaluation not run: {error}", file=sys.stderr)
        return 2

    result["run"] = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "manifest_file": str(args.manifest),
    }
    serialized = json.dumps(result, indent=2, ensure_ascii=False)
    if args.output:
        args.output.write_text(serialized + "\n", encoding="utf-8")
    print(serialized)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
