# NaviAble AI: Product and Startup Roadmap

**Updated:** 2 November 2026  
**Purpose:** Take the current accessibility prototype toward a measurable, real-time Android product that can work with supported smart glasses, starting with Meta wearables.

## Product direction

NaviAble should be the assistive perception and voice layer. The user's phone remains the first compute and connectivity device; supported glasses become an optional camera, microphone, speaker, motion, and input accessory. The first commercial version should support a user's existing Android phone (BYOD) and allow compatible glasses to be purchased separately. This lets us validate the service without taking on phone inventory, warranty, and regional supply risk.

The user experience should keep immediate obstacle, object, currency, and known-person functions on-device wherever practical. Rich scene descriptions or optional assistant features may use a network, but loss of internet must not remove the core camera-to-safety-voice path.

## What the repository contains today

- The live app is a React/Vite web app. Its camera path uses the browser camera API and `src/services/objectDetection.ts` loads TensorFlow.js COCO-SSD `lite_mobilenet_v2` (80 COCO classes). It is a useful phone-camera prototype, not yet a native Android application.
- The current model can only name its supported classes. It cannot reliably distinguish every product or identify classes that COCO does not contain. The repository has separate currency and road-hazard work, but no general-object training dataset or completed general-object fine-tuning pipeline.
- `hardware/` and `docs/HARDWARE_GUIDE.md` cover the ESP32/BLE time-of-flight sensor. There is no Meta Wearables Device Access Toolkit integration or Android Gradle app in this repository yet.
- `test_assets/` currently contains six sample images. That is not a representative training or validation dataset.
- `ml/evaluation/model_evaluator.py` previously printed fixed benchmark figures; it did not run inference or calculate metrics. It has now been replaced by a manifest-based scorer, and local development has a `/model-evaluation` page to annotate images and export predictions. There is not yet a labeled prediction manifest. Existing performance numbers in reports must not be presented as independently reproduced phone or field-test results until their data, protocol, and device logs are available.

## Integration decision

Use the **Meta Wearables Device Access Toolkit (DAT) for Android** as the first glasses integration. As of this roadmap date, Meta says DAT 1.0 is a stable release rolling out from 30 September 2026, and lists camera, microphone/audio, motion/IMU, speech, display, and input capabilities. It supports Ray-Ban Meta Gen 1 and Gen 2, Meta Ray-Ban Display, and listed Oakley Meta devices; exact capabilities vary by device. Use the official Android SDK and sample app, not unofficial Bluetooth or camera workarounds.

The web prototype cannot call the native DAT SDK directly. Add a separate native Android host and a small camera-source contract so the perception pipeline can receive frames from either the phone camera or a glasses stream. Keep the existing web app as the prototype and use measured end-to-end latency to decide whether inference initially stays in a WebView or moves to an Android-native runtime. Do not commit to a rewrite before measuring the frame-copy and inference cost.

Use Meta's Mock Device Kit to build and exercise the camera/session/permission path before glasses are available. Meta currently says that the mock kit does not support display glasses, so it cannot stand in for final display-device validation.

Keep these as separate later paths:

- A Meta Web App runs directly on Meta Ray-Ban Display glasses. It is a display-specific interface path; it is not the initial camera pipeline for displayless Ray-Ban Meta glasses.
- Meta AI Connectors are a developer-preview service/API integration. They may expose NaviAble actions inside Meta AI later, but must not sit in the low-latency camera safety loop.
- Add another glasses vendor only when it offers an approved, documented camera/audio SDK and we can test its permissions, capture latency, audio behavior, and support policy.

## Execution agreement and work-hour plan

Estimates below are **hands-on engineering hours**, not calendar promises. They exclude time waiting for a phone, glasses, developer access, consent, or tester feedback. Hardware-dependent work is not counted as passed until tested on the named hardware.

Work one feature or one measured failure at a time. For every cycle:

1. Record the current behavior and the exact failure.
2. Change only the smallest relevant part; preserve existing feature boundaries.
3. Run the existing build checks and the feature's regression checks.
4. Give the user a short, repeatable test with a clear pass/fail result.
5. Stop for the user's test. If it fails, fix that same step. If it passes, report the evidence and ask before starting the next step.

Do not start model fine-tuning until there is a consented, labeled dataset with separate train, validation, and untouched test splits. Do not call an evaluation-page check a real-phone, real-time, or field test.

For every measured run, record: run ID and feature/build version; phone model and Android/browser version; model/version, frame size, detection interval, and thresholds; capture session, lighting, and network state; expected and spoken result; first-audio latency if measured; and pass/fail with tester notes. Do not include a person's name, face image, or precise location in the exported evaluation manifest.

| Order | Work block | Estimated hours | User-visible pass gate |
|---|---|---:|---|
| 0 | Verify the local evaluation workflow and capture the first reviewed sample manifest | 2–4 | Page opens, local images stay local, labels and model predictions are visible, and a valid JSON export downloads. User checks this before any new feature work. |
| 1 | Establish the current object baseline on consented scenes | 4–8 | A reviewed set covers focused objects, similar classes, people-plus-objects, unsupported/empty scenes, distance/size variation, and more than one capture session; baseline confusion and latency are recorded. |
| 2 | Fix focused-object selection and remove unwanted person-first narration | 4–8 | In the user's repeated phone-camera test, speech describes the selected object and does not add an unrequested person announcement. |
| 3 | Add stable position and relative-motion narration | 6–10 | Repeated left/center/right and approaching/receding clips produce consistent direction. Camera motion is tested separately; exact distance is spoken only from a calibrated ToF reading. |
| 4 | Stabilize currency reading as its own feature | 6–10 | Each supported denomination/currency is tested across lighting, angle, and partial-view cases; uncertain readings ask for another scan instead of guessing. |
| 5 | Improve known-person matching as a separate, opt-in feature | 6–10 | Enrolled family and unregistered people are tested separately; low-confidence matches never announce a name. Face images and templates have explicit consent and deletion behavior. |
| 6 | Train/compare the object model only if baseline data shows a real model gap | 8–16 | On the untouched test split, the candidate improves the targeted failure classes while meeting the agreed latency and false-alert limits; otherwise keep the existing model. |
| 7 | Build the native Android phone host and camera/audio source contract | 12–24 | A named Android phone completes the offline camera-to-voice flow, camera restart, and audio routing tests without regressing the approved web prototype. |
| 8 | Integrate Meta glasses through the official Android DAT adapter | 12–24, plus device/access wait | Mock-session tests pass first; then a supported real glasses model passes camera, reconnect, permission, audio, latency, and user-control checks. |
| 9 | Validate premium offer, pricing, support cost, and supervised pilot | 8–12, plus recruitment | Device matrix, bill of materials, service/support costs, target-market interviews, privacy review, and pilot metrics are recorded before a launch claim. |

These ranges are planning estimates. Real-device access, user research, privacy review, and external SDK enrollment may add calendar time. The next step is only **Work block 0**; no later block starts automatically.

## Step-by-step work plan

### Stage 0 — Make our evidence trustworthy

1. [x] Replace the fixed-output evaluator with a scorer that consumes labeled samples and actual model predictions (`ml/evaluation/model_evaluator.py`).
2. [x] Mark unverified mobile/model benchmark tables as unverified historical claims until their source data and execution logs are reproducible.
3. [x] Define pass gates and a repeatable run record for object detection, currency, known-person matching, camera recovery after network loss, and speech timing.
4. [x] Record phone model, OS/browser, model version, frame size, detection interval, network state, and lighting for every measured run.

**Gate:** No investor or judge presentation uses a percentage, FPS, latency, or field-pass claim unless it links to a repeatable run and held-out data.

### Stage 1 — Measure the current phone prototype

Build a labeled test set around the actual use cases: centered/focused objects, similar categories (for example bottle/cup and chair/couch), people in the same frame as an object, small/far objects, partial occlusion, motion blur, indoor/outdoor light, and no-supported-object scenes. Keep capture sessions and people separated between training and hold-out sets to avoid near-duplicate leakage. Include an explicit `unknown / unsupported` outcome.

Measure per-class precision and recall, confusion pairs, false announcements per 10-minute walk, misses for priority hazards, capture-to-first-audio latency (p50/p95), sustained frame rate, memory, and battery/thermal behavior on a small Android device matrix. The exact acceptance thresholds should be agreed with blind/low-vision testers before calling the feature ready; do not optimize only for a single accuracy percentage.

**Gate:** We can reproduce the baseline on held-out scenes and identify the top five failure modes.

### Stage 2 — Improve and train vision models from evidence

1. Keep COCO-SSD as the fallback while the baseline is measured.
2. Collect additional images only with permission and a documented purpose; avoid storing faces or location metadata unless required and explicitly consented to.
3. Label bounding boxes for the priority object set and hard negatives. Use a person/session-separated train, validation, and test split.
4. Compare the current model with candidate lightweight detectors on the same hold-out set and supported Android phones. Include model size, cold-start, sustained latency, precision/recall, and battery in the comparison.
5. Fine-tune a pretrained detector rather than training a general vision model from scratch. Add unsupported/uncertain handling, class-specific calibration, and temporal confirmation. Keep a rollback model and test suite for every model change.

**Gate:** A candidate improves the chosen failure modes without exceeding the agreed latency, battery, and false-alert limits. If it does not, keep the existing model.

### Stage 3 — Build the Android phone product

Create a native Kotlin Android app shell with permission handling, resilient camera/session lifecycle, audio routing, offline operation, and a shared frame-source interface. First support the phone rear camera. Define the supported phone matrix using measured results rather than a marketing guess. Keep currency, family matching, navigation, and the person-safety channel behind their existing boundaries while the camera source is refactored.

**Gate:** A supported Android phone runs the core vision-to-voice flow offline, recovers cleanly after camera/network interruption, and meets the measured latency and battery targets.

### Stage 4 — Connect Meta glasses

1. Register the Android app in Meta's Wearables Developer Center and use Developer Mode and the official permission flow.
2. Use Mock Device Kit to validate session start/stop, camera stream, device loss/reconnect, permissions, speech/input events, and output routing.
3. Add the real glasses frame source through the same interface used by the phone camera.
4. Start with Ray-Ban Meta camera/audio functions. Add display-specific UI only for a compatible display model and supported market.
5. Run stationary, sighted-helper tests first; then supervised blind/low-vision user testing with consent and a safety protocol.

**Gate:** The same tested core pipeline can switch between phone and glasses sources without changing the object, currency, and known-person business logic.

### Stage 5 — Turn it into a premium, supportable product

- **Initial offer:** NaviAble software for a user's compatible Android phone; glasses are optional and bought separately. This avoids bundling an expensive phone before device requirements and support costs are known.
- **Next offer:** a glasses-enabled tier after DAT integration and real-device testing; list supported models and regions precisely.
- **Later offer:** a managed bundle for organizations or customers who need a preconfigured phone/glasses setup, only after procurement, warranty, returns, and support are costed.
- **Price research:** interview blind/low-vision customers, organizations, and potential resellers in the intended launch markets; test willingness to pay for the software, setup, support, and glasses integration separately.
- **Unit economics:** track phone (only if bundled), glasses, accessories, device setup, cloud use, app-store/payment fees, taxes, shipping, returns, warranty, customer support, and acquisition cost. Set price from actual costs and customer research. Do not assume that selling 100 units automatically makes it safe to lower the price; lower it when production/support cost and retention data support that decision.

As a current US hardware reference only, Ray-Ban's official product page lists Ray-Ban Meta Gen 2 from $379 and prescription styles from $499; prices vary by style, prescription, and market. Those are glasses prices, not NaviAble pricing or our cost. Meta's country list currently includes Ray-Ban Meta support in India, while Meta Ray-Ban Display support is listed for Canada, France, Germany, Italy, the UK, and contiguous US. Check the live supported-country and SDK pages again before selecting a launch country.

### Stage 6 — Pilot, launch, and scale

Run a small, opt-in pilot with support and incident reporting. Track activation, weekly use, failed detections, false alerts, latency, crash-free sessions, battery impact, returns, and support time. Fix top failures between cohorts. Expand to the first 100 users only after the supervised pilot gates pass; use those users to learn reliability and cost, not as a substitute for independent validation.

## Commercial and safety rules

- Describe NaviAble as an assistive companion, not a replacement for a cane, guide dog, or orientation-and-mobility training.
- Never claim exact camera distance. Keep image-size estimates separate from ToF sensor measurements.
- Use on-device inference for immediate alerts where possible; make cloud features optional and show when a request leaves the phone.
- Provide clear camera/recording state, consent, deletion controls, and a privacy review before external pilots.
- Publish only supported device/OS combinations and measured performance. Keep Meta partnership or approval claims separate from merely using its public SDK.

## Immediate next task

### Work block 0 — user-visible check, then stop

The evaluation page, manifest scorer, and development-only `/model-evaluation` route are implemented. TypeScript compilation and a production Vite build passed. I also opened the local route in a browser and confirmed the page renders after its lazy-load screen. Image import, box drawing, model prediction, and JSON download still need the user's hands-on check; no reviewed manifest exists yet.

The team-provided Vercel URL was opened on 2 November 2026 and redirected to Vercel's login page, so its deployed app could not be reviewed anonymously. The local evaluation route is development-only and is not expected to exist on that deployment. Do not share login details; ask the team leader for a public demo deployment or a non-sensitive screen recording if external review is needed.

1. In the Antigravity terminal, run `.\start-navi-dev.cmd`. This uses the already-available project Node runtime directly, so `npm` does not need to be on the terminal's PATH. Keep that terminal open while testing.
2. Open `http://localhost:5173/model-evaluation` in the same computer's browser. This is a development-only page; it is not part of the Vercel deployment.
3. Select two or three local sample images, label every visible supported object, run predictions, mark each full image as reviewed, and export the JSON.
4. Confirm that the route works, the predictions and labels are visible, and the downloaded manifest contains no image pixels or original filenames.

For the beginner-level click-by-click instructions, follow [Work block 0 test guide](WORKBLOCK_0_TEST_GUIDE_HI.md). The launcher also prints the exact evaluation URL so the user does not accidentally stay on the main homepage.

If the page fails, send the visible error or a screenshot and remain on Work block 0. If it passes, report the result; then ask the user whether to begin Work block 1. Do not implement Work block 1 before that approval.

After Work block 0 passes, collect varied, consented phone-camera scenes and record device model, OS/browser, model version, frame size, lighting, and network state. Keep capture sessions separated for train/validation/test. Use the baseline to choose one failure class before touching weights or starting training.

## Official references checked on 2 November 2026

- [Meta Wearables Device Access Toolkit](https://developers.meta.com/wearables/device-access-toolkit/)
- [Meta Wearables FAQ: devices, capabilities, mock kit, and publishing](https://developers.meta.com/wearables/faq/)
- [Official Meta Wearables Android SDK and camera sample](https://github.com/facebook/meta-wearables-dat-android)
- [Meta AI-glasses supported countries](https://www.meta.com/help/ai-glasses/4961066940605960/)
- [Meta Ray-Ban Display Web Apps](https://developers.meta.com/wearables/web-apps/)
- [Ray-Ban US product listing and reference pricing](https://www.ray-ban.com/usa/ray-ban-meta-ai-glasses)

## User test list for the next workflow (computer only)

No phone or glasses are needed for this first check.

1. In the Antigravity terminal at the project folder, run `.\start-navi-dev.cmd`; leave the terminal open and wait for the `Local: http://localhost:5173/` line.
2. In that same computer's browser, open `http://localhost:5173/model-evaluation`.
3. Choose two or three images from `test_assets`, draw the correct class box for each visible target, and run the detector. The first run may download model weights; do not upload family photos or private images for this check.
4. Enter `Windows laptop + browser name` in the device field, mark each image reviewed, then download the evaluation JSON. It is a results file; it does not contain the image pixels, and it does not need to be opened or edited.
5. Tell me **pass** if the page loads, predictions appear, and the JSON downloads. If not, send the page screenshot plus the terminal's visible error text. We will fix Work block 0 only; after a pass, I will ask before starting Work block 1.
