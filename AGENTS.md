# Navi AI project instructions

Use this file as durable working memory for assistants working in this repository. The longer workflow is in [`docs/NAVI_AI_ENGINEERING_PROTOCOL.md`](docs/NAVI_AI_ENGINEERING_PROTOCOL.md), team responsibilities in [`docs/NAVI_AI_TEAM_CHARTER.md`](docs/NAVI_AI_TEAM_CHARTER.md), and product plan in [`docs/STARTUP_PRODUCT_ROADMAP.md`](docs/STARTUP_PRODUCT_ROADMAP.md).

## Project and collaboration

- Navi AI is an existing accessibility prototype. Inspect its structure, architecture, dependencies, current behavior, and Git status before making changes; do not assume it is a blank project.
- The developers are beginners. Explain significant changes in short, clear Hinglish and only teach the concepts needed for the current task.
- Work on the exact requested problem. Preserve working behavior, make the smallest relevant change, and avoid unrelated features, rewrites, or dependency changes.
- For debugging, read the full error, trace the root cause, inspect related code, then make a targeted fix. Do not guess repeatedly or hide errors.
- State what changed, why, which files changed, what was actually verified, and remaining limitations. Never claim tests, training, or real-device behavior that was not observed.
- Run checks only when the user asks for testing/verification or verification is part of the assigned task. Report exactly what was run.

## User's step-by-step gate

- Work one feature or work block at a time. Give a short, repeatable pass/fail check and stop for the user's result or approval before beginning the next block.
- Do not start Work block 1 or later roadmap work automatically. The user decides when the next block begins.
- Keep implementation and evaluation separate: a developer-page sample run is not a phone, glasses, real-time, or field test.
- Use project samples in `test_assets/` when appropriate. Do not browse personal folders for test images or use personal/family photos unless the user specifically asks and the privacy requirements are addressed.
- Treat object confidence on a handful of sample images as a workflow result, not a claim of overall model accuracy.

## Priority and safety

- Priority: P0 critical errors, P1 core reliability, P2 measured accuracy/performance, P3 essential product requirements, P4 optional enhancements.
- Keep consent, privacy, accessibility, and uncertainty handling central to camera, currency, and known-person work.
- Do not claim exact distance from image size; distinguish visual estimates from calibrated sensor measurements.
- Do not perform destructive Git operations, overwrite teammate work, commit, or push without explicit authorization. Inspect branch and uncommitted changes first.
- Ask before major architecture changes, dependency replacement, unrelated feature changes, or consequential external actions.
- Use scoped specialist roles when the task benefits from them: Asha (vision/camera), Kabir (data/evaluation), Zoya (Android/hardware/wearables), Sana (accessibility/QA/safety). These are task-invoked, temporary agents, not always-running employees. Keep one implementation owner per work block; specialist audits default to read-only.
- The user is Founder/Product Owner and makes product/work-block decisions. Codex is CEO/Technical Lead only as a requested project workflow title; it is not a legal corporate appointment.

## Current checkpoint — 5 November 2026

- Work block 0's local evaluation workflow was completed by the assistant using only `test_assets/cat.jpg` and `test_assets/bus.jpg`.
- Both images received one reviewed ground-truth box. The detector returned `cat` at 98% and `bus` at 98%; the evaluation JSON downloaded to `C:\Users\ABC\Downloads\NaviAble-object-baseline-v1-validation.json`.
- This confirms the laptop browser workflow with two bundled sample images only. The browser inference timings are not end-to-end camera-to-audio latency and do not establish general model accuracy or phone/glasses performance.
- Proof images are in `artifacts/workblock-0-evaluation.png` and `artifacts/workblock-0-bus-evaluation.png`.
- Work block 1 was explicitly approved and started. Six bundled samples were loaded in the local evaluator. In that new run, `cat.jpg` has a correctly placed reviewed ground-truth box; `bus.jpg` has a bus label/box but the box still needs a fresh visual alignment check before review. `person.jpg`, `sofa.jpg`, `traffic.jpg`, and `multi_200_100.jpg` have not yet been labeled/reviewed. No inference or new manifest export has been completed for Work block 1.
- Offline visual review on 5 November confirmed the visible targets: cat, bus, person, couch (the model's class name for a sofa), and people/bicycles in the crowded cycling photo. The banknote photo contains currency, but currency is not one of the detector's 80 classes; do not label it `currency` in this object-evaluation run. It can be a reviewed no-target/hard-negative image only after checking all supported object classes. The evaluator overlay was unavailable, so the existing bus box was not rechecked. No labels, predictions, or export were added from this source review.
- The latest UI attempt returned `Local browser use is disabled in Work settings`, so continue with source/image review that does not require the blocked browser, then resume UI labeling/inference/export only when local browser control is available. Do not switch to the user's personal folders. A temporary 1268×1000 hidden-browser viewport override was set during annotation work; reset it when browser control becomes available.
- Current model audit note: the detector is COCO-SSD `lite_mobilenet_v2` (fixed 80 COCO classes). A visual dataset cannot add classes to it. Asha identified that class thresholds below 0.40 may be pre-filtered by the model call's global 0.40 minScore; record as a candidate bug to test after baseline, and do not change it during baseline capture. Motion-by-box-growth may also confuse camera motion with approach; do not claim reliable relative motion without phone/video testing.
- Public dataset policy and the named task-scoped roles are in `docs/NAVI_AI_TEAM_CHARTER.md`. Real-time performance ultimately requires consented first-person phone/glasses sessions; static public datasets are for offline diversity checks only.
- The current Git branch at the Work block 1 checkpoint is `test2`; `artifacts/` was untracked when inspected. Do not remove or overwrite it without checking first.

## Feature reliability checkpoint — 5 November 2026

- The user is testing on Android Chrome. They reported Auto-read Currency ON, one saved family photo, repeated ₹100 speech, and at least one detected-but-silent event while no other speech was playing. The silent event's class and selected voice mode are still unknown.
- First feature block: `src/pages/Dashboard.tsx` now announces a confirmed auto-currency denomination once per camera-session note event, instead of repeating it every five seconds. A confirmed no-banknote scan or camera restart resets that event; manual Scan Currency remains an explicit repeat action. The denomination is recorded only when the speech broker accepts it. This is a repeat-control change only; it does not correct a wrong first denomination.
- Verification: TypeScript build and production Vite build passed when run through the bundled Node runtime. Oxlint exited successfully with existing warnings. `npm`/`npm.cmd` is absent from PATH. No Android/browser behavior test has been run for the change; wait for the user's device result before starting another feature block.
- Currency training audit: the report labels its 100% result as synthetic-template-split-only; the same raw note templates occur in train/validation/test. Do not use that score as real-world accuracy or blindly change thresholds. A valid next accuracy study needs consented phone captures, split by physical note and session before augmentation, with genuine negative scenes.
- Family audit: Vision already has an optional saved-family toggle using the same camera stream. It is off by default and runs full face detection serially behind object/currency analysis; normal voice confirmation requires two matches. One reference photo may make matching brittle. Do not lower identity thresholds without consented false-match/missed-match and latency testing.
- Voice audit: the central broker can suppress speech in `silent_visual`, on cooldown/priority conflicts, or because person narration intentionally stays quiet for far-away people. Its callers do not always retry rejected announcements. `Hey Navi` wake-word mode requires the voice page in the foreground, and commands do not yet control Auto-read Currency or Family match. Gather the missed class and voice mode before changing this path. The current project is a web app, not a native Android runtime.
