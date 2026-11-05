# Navi AI Engineering Protocol

This project workflow is adapted from the engineering prompt supplied by the user. It guides development work; it does not replace higher-priority system, safety, or repository instructions.

Team responsibilities and the first-person data policy are recorded in [`NAVI_AI_TEAM_CHARTER.md`](NAVI_AI_TEAM_CHARTER.md). Follow those roles for delegated audits; keep one implementation owner for each work block.

## Goal

Build Navi AI as a stable, understandable, maintainable assistive-technology prototype while helping its beginner developers learn the engineering basics. Optimize for correctness, stability, understandability, and maintainability before feature count or code volume.

## Project-first rules

- Work only on Navi AI's actual requirements.
- Inspect the existing project before changing it: structure, architecture, dependencies, entry points, current behavior, errors, branch, and uncommitted work.
- Do not assume a file or feature is absent until checking. Do not overwrite existing code without reading it.
- Preserve working components unless the requested change has a clear technical reason to affect them.
- Avoid unnecessary features, libraries, abstractions, redesigns, and dependency upgrades.
- Keep changes small and targeted; do not rewrite the project to fix a local issue.

## Task workflow

1. **Analyze:** Identify the exact request and, for a bug, trace the root cause. Check whether existing behavior already solves it.
2. **Plan:** Choose the smallest reliable change and identify the files that need it.
3. **Implement:** Follow existing conventions and avoid unrelated modifications.
4. **Verify:** Run only checks that the user requested or that are part of the assigned task. Verify real behavior when possible; clearly label work as tested, partially tested, or untested. A successful build alone does not prove the app works.
5. **Report:** Explain what changed, which files changed, why, what was verified, known limitations, and the next essential task.

## Accuracy and debugging

- Never invent test results, ignore errors, or call a partial implementation complete.
- Read the complete error, locate its source, check related code and dependencies, apply the smallest correct fix, then verify when authorized.
- Do not repeatedly try random fixes, suppress an error just to make the page run, or add a workaround that creates a hidden problem.
- Prefer official documentation and verified APIs over guesses. Explain uncertainty when evidence is incomplete.
- Do not present demo data as real functionality unless the user explicitly asks for a demo.

## Beginner communication

- Use simple Hinglish for user-facing explanations.
- For significant changes, briefly explain the purpose, basic logic, how the relevant files work together, and how the user can check the result.
- Keep explanations short and focused; do not force the developers to write everything manually or hide all engineering context from them.

## Scope, priority, and approval

- Prioritize P0 critical errors, P1 core reliability, P2 measured accuracy/performance, P3 essential requirements, and P4 optional enhancements.
- Before proposing a feature, confirm what user problem it solves, whether it is needed, whether it meaningfully improves Navi AI, and what complexity it adds. Defer optional work while P0/P1 issues remain.
- Work one feature or one measured failure at a time. After each work block, provide a clear pass/fail check and wait for the user's result or approval before the next block.
- Ask before major architecture changes, destructive operations, dependency replacement, changes to unrelated features, risky Git operations, or actions involving external services, credentials, or sensitive data.
- Never delete or overwrite teammates' work, force-push, or commit/push automatically. Inspect branch differences and working changes before integration.

## Navi AI product evidence and privacy

- Keep object detection, currency recognition, and known-person matching within their intended boundaries; do not mix identities into ordinary object narration.
- Use consented test images. Avoid names, face images, and precise location in exported evaluation manifests.
- Distinguish image-based size estimates from calibrated sensor distance. Do not claim exact distance from a camera image.
- A local browser evaluation is not proof of phone-camera reliability, glasses support, real-time capture-to-audio latency, or field safety. Record device, app/model version, session, conditions, expected result, latency (only if measured), and tester notes for meaningful performance claims.
- Do not begin model fine-tuning until a consented labeled dataset has separate train, validation, and untouched test splits.

## Current checkpoint and next gate

As of 3 November 2026, the assistant completed the local Work block 0 evaluation workflow using `test_assets/cat.jpg` and `test_assets/bus.jpg`. Each image has one reviewed ground-truth box. The bundled detector returned `cat` at 98% and `bus` at 98%; the JSON was downloaded to `C:\Users\ABC\Downloads\NaviAble-object-baseline-v1-validation.json` and was not opened or edited. These two sample results validate the local workflow only, not broad accuracy or real-device latency.

The user approved Work block 1. A six-image batch from `test_assets/` was loaded. In this new run, `cat.jpg` has a correctly placed reviewed box. `bus.jpg` has a bus label and box, but its position still needs a fresh visual alignment check before it is marked reviewed. `person.jpg`, `sofa.jpg`, `traffic.jpg`, and `multi_200_100.jpg` remain unreviewed; no Work block 1 inference or export has been completed. The latest local UI call reports `Local browser use is disabled in Work settings`, so browser-dependent labeling and inference are paused until that control is available. Continue only with project sample assets, never the user's personal photo folders, and reset the temporary browser viewport override when possible.

On 5 November, all six source images were visually reviewed offline. The object targets include `cat`, `bus`, `person`, `couch` (the model label for a sofa), and `person`/`bicycle` in the crowded cycling photo. The banknote image depicts currency, but the detector has no currency class; do not enter a `currency` ground-truth label in this object-evaluation run. Treat it as a no-target/hard-negative only after checking for every supported class. The current evaluator overlay was unavailable, so the existing bus box has not been verified. No new annotations, predictions, or exports were produced by this offline review.

The detector code audit found COCO-SSD `lite_mobilenet_v2` with a fixed 80-class vocabulary. Asha identified a possible global/per-class minimum-score mismatch and a movement estimate that can confuse camera motion with object motion; keep the detector unchanged until the baseline is complete, then validate one issue at a time.
