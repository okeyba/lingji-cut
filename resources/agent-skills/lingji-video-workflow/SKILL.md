---
name: lingji-video-workflow
description: >-
  Use when Codex needs to help with 灵机剪影/Lingji video production from a
  manuscript or project folder: create or open a Lingji project, move original
  material into original.md, draft or revise script.md, coordinate App/MCP AI
  generation steps, inspect generated artifacts, and file-first edit
  project.json timeline overlays or Motion Card TSX files under ai-cards.
  Trigger for requests like 从稿件到视频, 灵机剪影项目处理, 改稿生成视频,
  调整视频卡片/字幕/动画, or continuing a Lingji project workflow.
---

# 灵机剪影稿件到视频工作流

## Overview

Use this skill as the user-level entrypoint for turning a manuscript/material folder into a Lingji video project and refining the result. The workflow combines three capabilities:

- Project orchestration through Lingji desktop/MCP when available.
- File-first script editing for `original.md` and `script.md`.
- File-first video editing for `project.json` timeline data and `ai-cards/<overlayId>/motionCard.tsx`.

Do not claim that generation, export, or validation finished unless you have tool output or files proving it. Generation/export may require the Lingji desktop app or MCP tools; direct file edits only cover existing project files.

## Load References

Read only the reference needed for the current step:

- `references/mcp-workflow.md`: when creating/opening a project, importing media, using Lingji MCP tools, polling async tasks, or handing off App actions.
- `references/script-editing.md`: before directly editing `original.md` or `script.md`.
- `references/video-editing.md`: before directly editing `project.json`, `timeline.subtitle`, overlays, or Motion Card TSX.

For a full “稿件到视频” request, start with `mcp-workflow.md`; load the script/video references only when you reach those edit phases.

## Workflow

1. Identify the source and target.
   - Source can be a manuscript file, material folder, audio/video file, URL, or an existing Lingji project.
   - A Lingji project normally contains `project.json`, `original.md`, `script.md`, `covers/`, `ai-cards/`, and `.lingji/`.
   - If no target project path is given, choose a clear sibling/output directory and tell the user the path.

2. Inspect the current state before acting.
   - If MCP tools are available, prefer `lingji_get_project_state`.
   - Otherwise inspect files directly with byte-capped shell commands.
   - Determine which stages already exist: original material, script, audio/subtitles, analysis/cards, timeline, export.

3. Create or open the project.
   - Prefer Lingji MCP/App project creation when available because it creates the expected skeleton.
   - If MCP is unavailable and no Lingji project exists, explain that the user must open/create the project in Lingji first before direct file-first edits can be safely applied.

4. Prepare the manuscript.
   - Put raw source material into `original.md`.
   - Draft, rewrite, or polish the voiceover script in `script.md`.
   - Prefer MCP script tools when available; otherwise use the script file-first lock protocol.

5. Run or coordinate AI video generation.
   - Use Lingji MCP async tools when present and poll until terminal status.
   - If the current Lingji version only exposes synchronous/project tools, ask the user to run the App’s TTS, subtitle analysis, cover/card generation, arrangement, or export step, then resume from the generated files.
   - Never edit generated media artifacts by hand: `podcast-audio.mp3`, `podcast-subtitles*.srt`, `covers/`, `ai-cards/<id>/image.png`, and rendered MP4 outputs are products of the App pipeline.

6. Refine the video result.
   - For script issues, edit `script.md` and ask the user/App to regenerate downstream audio/subtitles as needed.
   - For timing, placement, subtitle style, overlay motion, or Motion Card animation, use the video file-first protocol.
   - After editing `project.json`, check `.lingji/edit-result.json` and fix until `ok:true`.

7. Verify and report.
   - Report the project path, changed files, generated/expected artifacts, and any App-side steps still required.
   - If the user reported “slow/stuck”, read the latest auto-run JSONL log before giving performance advice.

## File-First Safety

When directly editing a Lingji project:

- Always create `<projectDir>/.lingji/edit-lock.json` before writes.
- Use `owner:"codex"`, `scope:"script"` for `original.md`/`script.md`, and `scope:"video"` for `project.json`/Motion Card edits.
- Refresh `heartbeat` if editing takes more than about 15 seconds.
- Delete the lock when finished, even if a later validation step fails.
- For `project.json`, read `.lingji/edit-result.json` after writing and repair validation errors.

## Boundaries

- Use tools or App workflows for generation/export. Use file-first editing for existing text/timeline/source files.
- Do not put API keys, tokens, or provider secrets into project files or telemetry.
- Do not modify `aiAnalysis` or `script` fields in `project.json` while doing video-domain edits.
- Do not change overlay `id` values unless the user explicitly requests a migration and you update all dependent paths.
