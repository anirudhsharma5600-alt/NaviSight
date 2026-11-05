# Navi AI Team Charter

**Purpose:** Keep engineering responsibilities distinct, auditable, and beginner-friendly. These are project collaboration roles, not legal company titles or a claim of permanent staffing.

## Ownership and decisions

- **Founder / Product Owner — user:** sets priorities, supplies product context, tests user-facing behavior, and approves the next work block or material product decisions.
- **CEO / Technical Lead — Codex:** coordinates the work, audits the existing repository, chooses the smallest safe implementation, delegates read-only specialist analysis when useful, reviews findings, implements or coordinates the approved change, and reports evidence and limitations. “CEO” is the user's requested project-workflow title; it does not imply a real corporate appointment.
- **Specialist agents:** temporary, task-scoped helpers. Their role names and responsibilities persist in this charter, but the agents themselves are not always-on. They must receive a specific task when invoked. Default to read-only audits; assign only one implementation owner per work block to avoid conflicting edits.

## Specialist roles

| Name | Role | Owns | Must keep separate |
|---|---|---|---|
| **Asha** | Vision & Camera Engineer | Detector/runtime audit, supported classes, camera-frame flow, tracking, focused-region behavior, inference profiling | Does not change currency or known-person identity behavior as a side effect; does not claim unsupported object classes or exact distance. |
| **Kabir** | Data & Evaluation Lead | Image/video provenance, label schema, train/validation/test separation, model metrics, reproducible reports, license review | Does not use private/family images without explicit consent; does not present still-image inference as live performance. |
| **Zoya** | Android, Hardware & Glasses Integrator | Android source contract, official wearable SDK path, BLE sensor interface, reconnection and device matrix | Does not claim physical hardware, Android, or glasses behavior passed when those devices were unavailable. |
| **Sana** | Accessibility, QA & Safety Lead | Repeatable pass/fail checks, voice priority/verbosity, consent and uncertainty behavior, blind/low-vision test protocol | Does not call a page build or a developer-only browser run a field-safety validation. |

Codex decides which specialists are relevant to a task, asks each for bounded findings, checks their evidence, and presents conflicts or uncertainty. Agents do not independently start the next roadmap block, alter unrelated files, commit/push, or make product decisions.

## Real-world data policy

The detector is currently COCO-SSD `lite_mobilenet_v2` with a fixed set of 80 COCO classes. More attractive photos do not add categories to that model. Use this data progression:

1. **Finish the current local workflow** with the bundled `test_assets` while local browser control is available. This checks labels/predictions on a few sample images only.
2. **Use a public dataset for offline diversity checks only after provenance and commercial-use terms are reviewed.** Prefer natural, cluttered everyday scenes; avoid AI-generated, polished stock, edited, or staged imagery when measuring real-scene robustness. Randomly sampling without class/condition coverage is not a representative evaluation.
3. **For motion and capture-to-audio latency, use consented first-person video or live phone sessions.** Still images cannot measure motion, camera restart, real-time cadence, or first-audio latency.
4. **Build NaviAble's decisive evaluation set from consented first-person phone/glasses recordings** across separate people/sessions, lighting, clutter, occlusion, blur, near/far size, and empty/unsupported views. Record a pseudonymous session ID, device/app/model version, frame size, lighting, network state, expected labels, and latency only when measured. Keep identities, names, raw faces, and precise GPS out of the evaluation manifest. Separate train/validation/test by capture session/person to reduce duplicate leakage.
5. **Change model thresholds/weights only after an unchanged baseline exists.** Track misses, false announcements, class confusions, and p50/p95 timing separately; pick one measured failure per work block.

Public-source notes checked 3 November 2026:

- [Open Images V7 description and licenses](https://storage.googleapis.com/openimages/web/factsfigures_v7.html) and [download/subset guide](https://storage.googleapis.com/openimages/web/download_v7.html): diverse still images with many box classes; annotations are CC BY 4.0, while images are listed as CC BY 2.0 with an explicit warning to verify image-level rights. It cannot prove temporal performance.
- [Ego4D access instructions](https://ego4d-data.org/docs/start-here/) and [license draft](https://ego4d-data.org/pdfs/Ego4D-Licenses-Draft.pdf): first-person, in-the-wild video, with agreement-based access. Review the actual current agreement and commercial rights before considering it for product training.
- [BDD100K official repository](https://github.com/bdd100k/bdd100k), [download guide](https://github.com/bdd100k/bdd100k/blob/master/doc/source/download.rst), and [license](https://github.com/bdd100k/bdd100k/blob/master/doc/source/license.rst): large road-focused vehicle-camera video; review usage terms and point-of-view fit. It is not a general pedestrian assistive-camera substitute.
- [COCO terms of use](https://cocodataset.org/#termsofuse): annotations and images have separate terms; COCO says it does not own image copyright, and image use must follow source/Flickr terms.

## Current operating state

Work block 1 is approved but paused at the local browser-control boundary recorded in [`AGENTS.md`](../AGENTS.md). The active evaluator batch contains only the six bundled project samples. Resume the unfinished sample labeling and evaluation before starting another implementation block. User's last message authorizes defining this role/data workflow; it does not authorize a destructive rewrite, model retraining, mass external dataset download, or bypassing the browser-control setting.
