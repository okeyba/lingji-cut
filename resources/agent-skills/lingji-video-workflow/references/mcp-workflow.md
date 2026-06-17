# Lingji MCP And App Workflow Reference

Use this reference to create/open Lingji projects and coordinate generation steps.

## Connection

Lingji desktop exposes a local MCP server when the app is running:

- Server name: `lingji-editor`
- URL: `http://127.0.0.1:19820/mcp`
- Transport: streamable HTTP
- Auth: none, local `127.0.0.1` only

If MCP tools are not available in the current Codex session, use the file-first references only for existing projects and ask the user to run missing generation/export steps in the Lingji app.

## Prefer MCP For Project And Script Operations

When available, prefer these tools over direct file edits for project creation and script workspace operations:

- `lingji_create_project({ path, options? })`: create an empty Lingji project skeleton.
- `lingji_open_project({ path })`: validate/open an existing project.
- `lingji_get_project_state({ projectPath })`: inspect stage completion.
- `lingji_get_settings()`: inspect sanitized defaults. Never expose or store secrets.
- `lingji_get_project_context()`: read templates, selected template, and selected role before writing.
- `lingji_read_script({ filePath })`: read `original.md` or `script.md`.
- `lingji_update_script({ filePath, content, description? })`: write script/original content with editor synchronization and history.
- `lingji_review_script({ annotations, ... })`: submit review annotations to the editor.

## Media Import

If tools are available:

1. Call `lingji_import_video_source({ sourceType, url? | filePath?, projectDir, syncToOriginal: true })`.
2. Poll `lingji_get_video_import_status({ importId })` until complete.
3. Read `original.md` and continue script work.

`sourceType` can be `douyin`, `local_video`, or `local_audio`.

## Async Generation Pattern

For any Lingji async pipeline tool that returns a `taskId`:

1. Start the task.
2. Poll `lingji_get_task_status({ taskId })`.
3. Continue when `status` is `succeeded`.
4. If `failed`, report `error.code`, `error.message`, and whether it is retryable.
5. If the user asks to stop, use `lingji_cancel_task({ taskId })` when supported.

Polling cadence: every 500 ms for the first 5 seconds, then every 2 seconds.

## Full Manuscript-To-Video Route

1. Create or open a Lingji project.
2. Load or import source material into `original.md`.
3. Read project context/templates.
4. Draft or revise `script.md`.
5. Run or ask the App to run TTS.
6. Run or ask the App to analyze subtitles and generate cover/cards/motion/timeline.
7. Use video file-first edits for timeline, subtitles, card timing, placement, and Motion Card refinements.
8. Run or ask the App to export MP4.
9. Verify expected files exist and report remaining manual steps.

## Current Capability Caveat

Some Lingji versions expose only project/script/import tools and not the full async generation set. In that case:

- Do not simulate generation by writing media artifacts by hand.
- Ask the user to run the missing App step.
- Resume after checking `project.json`, generated audio/subtitle/card folders, or `lingji_get_project_state`.

## Slow Or Stuck Runs

If the user says the system is slow, stuck, or has run for a long time, inspect auto-run JSONL logs before diagnosing:

- macOS log dir: `~/Library/Application Support/灵机剪影/logs/auto-run/`
- Latest run pointer: `LATEST.txt`
- Main event kinds: `stage.start`, `stage.end`, `llm.start`, `llm.firstChunk`, `llm.end`, `card.start`, `card.end`, `highlight.batch.end`

Report total runtime, slowest stages/calls, and one to three concrete next actions.
