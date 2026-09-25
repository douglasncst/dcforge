# Subtitle Forge

An experimental, local-first CLI to extract, transcribe, translate and
export video/audio subtitles.

```
subtitle-forge run movie.mkv --to pt-BR
```

> **Status: experimental.** This is a first, real, end-to-end version — not
> a prototype — but the interfaces, flags, and exact output are still
> expected to change. `whisper.cpp` and Ollama integration in particular
> are implemented against their documented behavior and have not been
> exercised against real installations of either in the environment this
> was built in (see [Manual testing](#manual-testing-status) below);
> confirm they work before relying on `run`/`transcribe` for anything you
> care about.

## What it does

Point it at a video (or an existing subtitle file) and it produces a
translated, timestamp-accurate SRT/VTT — deciding on its own whether it
needs to transcribe audio or can reuse a subtitle already in the file:

```
Video/Audio file
      │
      ▼
  Inspect (ffprobe) ── reads streams: video, audio, subtitle languages/codecs
      │
      ▼
  Usable text subtitle already in the file?
      │
  ┌───┴────────────────────┐
  │ yes                    │ no
  ▼                        ▼
Extract subtitle      Extract audio ──▶ Transcribe (Whisper, local)
  │                        │
  └───────────┬────────────┘
              ▼
   Normalized SubtitleDocument  (id, startMs, endMs, text — not SRT itself)
              │
              ▼
   Already the target language? ── yes ──▶ (skip straight to Validate)
              │ no
              ▼
   Translate (Ollama, local, batched)
              │
              ▼
   Validate (errors block export; warnings don't)
              │
              ▼
      SRT or VTT file written next to the input
```

Quick answers to the questions that matter before you run anything:

- **Extracts vs. transcribes:** `inspect` (via ffprobe) checks whether the
  file already has a text-based subtitle stream. If yes, `extract` pulls it
  out (ffmpeg) — no Whisper involved. If no, it extracts audio and hands it
  to **Whisper** (`transcribe`).
- **Ollama is used only for translation** — `translate`, and `run` when the
  source isn't already your target language. It's never involved in
  transcription or extraction.
- **What runs locally:** FFmpeg, FFprobe, and Whisper always do — they're
  local binaries. Ollama is a local *service* by default
  (`http://127.0.0.1:11434`); see [Local-first design](#local-first-design)
  for exactly what that does and doesn't guarantee.
- **Files it generates:** one subtitle file, named `<input>.<lang>.srt` (or
  `.vtt`) next to the input — e.g. `movie.mkv` → `movie.pt-BR.srt`. It never
  modifies or overwrites the input, and never overwrites an existing output
  without `--overwrite`. Temporary audio/subtitle files go through the OS
  temp directory and are cleaned up automatically.
- **External dependencies:** FFmpeg/FFprobe, a Whisper backend
  (`whisper.cpp`) with a model file, and Ollama with a pulled model — none
  bundled, none auto-installed. See [Requirements](#requirements).
- **Check what's actually available:** `subtitle-forge doctor` — reports
  each tool found or missing, right now, on your machine.
- **First real test:** [on Linux](#linux--macos) or
  [on Windows](#windows) — both are supported, see
  [Testing on your machine](#testing-on-your-machine).
- **What's NOT verified against real tools yet:** see
  [Manual testing status](#manual-testing-status) — read it before trusting
  `run`/`transcribe` with anything you care about.

## Features

- **`inspect`**: container, video/audio/subtitle streams, languages,
  codecs, default/forced flags — from ffprobe's structured JSON, not
  scraped text.
- **`extract`**: pull an existing text-based subtitle stream out as SRT.
  Refuses to mistranslate an image-based one (PGS/VobSub) as text.
- **`transcribe`**: extract audio and transcribe it locally with Whisper
  (`whisper.cpp`) — original language, no translation.
- **`translate`**: translate an SRT/VTT file with a local Ollama model,
  preserving every timestamp and segment exactly.
- **`validate`**: check a subtitle file for structural errors (bad
  timestamps, duplicate/out-of-order segments, empty text) and warnings
  (suspicious overlaps, absurd durations).
- **`run`**: the full pipeline, inspect → extract-or-transcribe →
  translate → validate → write, in one command.
- **`doctor`**: reports which of FFmpeg, FFprobe, a Whisper backend, and
  Ollama (plus a named model) are actually available right now.

## Requirements

- **Node.js 22.12+** (this package only; independent of the rest of the
  `dcforge` repository).
- **FFmpeg / FFprobe** on `PATH`, for `inspect`, `extract`, `transcribe`,
  and `run`. Not needed for `translate` or `validate` alone.
- **A local Whisper backend** ([`whisper.cpp`](https://github.com/ggml-org/whisper.cpp),
  binary `whisper-cli` or the older `main`) on `PATH`, plus a local model
  file, for `transcribe` and `run` when there's no usable existing
  subtitle. See [Whisper](#whisper) below for why this backend and how to
  get a model.
- **[Ollama](https://ollama.com)** running locally, plus a pulled model,
  for `translate` and `run`. See [Ollama](#ollama) below.

None of these are bundled or auto-installed. Run `subtitle-forge doctor` to
see what's actually found.

## Installation

```sh
cd subtitle-forge
npm install
npm run build
npm link
```

`npm link` puts a `subtitle-forge` binary on your `PATH`. Alternatively,
run from source without linking:

```sh
npm run dev -- inspect movie.mkv
```

## Quick start

```sh
subtitle-forge doctor
subtitle-forge inspect movie.mkv
subtitle-forge validate subtitle.srt
subtitle-forge translate subtitle.srt --translator ollama --model llama3.2 --to pt-BR
subtitle-forge run movie.mkv --to pt-BR --translator ollama --model llama3.2
```

## Pipeline

See the diagram in [What it does](#what-it-does) above for the full flow.
`run --dry-run` prints the resolved plan (strategy, transcriber, translator,
model, output path) without running any expensive step.

### Architecture

The pipeline never depends on a specific provider directly — it depends on
small interfaces (`src/core/types.ts`): `MediaInspector`, `SubtitleExtractor`,
`Transcriber`, `Translator`, `SubtitleParser`/`SubtitleWriter`. Today there
is exactly one implementation of each transcription/translation interface
(`WhisperCppTranscriber`, `OllamaTranslator`); adding another provider later
means implementing the interface, not rewriting the pipeline.

The internal subtitle representation (`SubtitleDocument`/`SubtitleSegment`,
`{ id, startMs, endMs, text }`) is never SRT itself — SRT and VTT are
serialization formats parsers/writers convert to and from. Translation
operates on this normalized model, never touching timestamps.

## Local-first design

The default path — `whisper.cpp` for transcription, Ollama for translation
— never needs a network connection beyond your own Ollama instance. Pass
`--local` to make that a hard guarantee instead of just the default: it
refuses to run at all unless the Ollama endpoint is loopback
(`127.0.0.1`/`localhost`), rather than silently sending subtitle text
somewhere else. There is no silent fallback to an online provider anywhere
— a step that can't run locally fails with a clear error.

**Ollama itself is a local service, not a privacy boundary by itself:**
subtitle text is sent to whatever endpoint `--ollama-url` names. By default
that's `http://127.0.0.1:11434` (your own machine). If you point it at a
remote address without `--local`, that's respected as your explicit choice
— it's just never called "local".

## FFmpeg

Detected via `commandExists` (spawns `ffmpeg -version`/`ffprobe -version`);
missing either produces a clear "not found, install and add to PATH"
error, never a crash. Every external command is run through
[`node:child_process.spawn`](https://nodejs.org/api/child_process.html)
with argv as a real array — **never** through a shell — so paths with
spaces, parentheses, accents, or other Unicode are passed through exactly,
not re-parsed. Covered by `test/ffmpeg.test.ts` and
`test/paths.test.ts`.

Audio for transcription is extracted as mono 16kHz PCM WAV — the input
shape both major local speech backends expect.

## Whisper

**Backend chosen: [`whisper.cpp`](https://github.com/ggml-org/whisper.cpp).**

Considered against `faster-whisper` (Python/CTranslate2) and other local
options, on:

- **Installation story.** whisper.cpp ships as a single compiled binary
  with no Python environment to manage — meaningfully simpler to get
  running consistently across Linux, macOS, and Windows, all of which this
  project targets as supported platforms.
- **Structured output.** `--output-json`/`-oj` gives per-segment
  timestamps directly, matching this project's internal model without
  reparsing SRT.
- **Maturity and platform support.** CPU everywhere, optional GPU
  (Metal/CUDA/Vulkan) backends, actively maintained, packaged in common
  package managers.

`faster-whisper` is excellent and often faster/more accurate per model
size, but its Python + `pip install` + virtual-environment story is more
moving parts for a first version aimed at "clone and run" on someone's own
PC. This can change later — it's exactly the kind of alternative the
`Transcriber` interface exists to let in without touching the pipeline.

**No model is ever downloaded automatically.** Pass `--model` (`transcribe`)
or `--whisper-model` (`run`) with the path to a local `ggml`/`gguf` model
file. Models are listed at the whisper.cpp repository; a good starting
point for a first try is a small English or multilingual model. `doctor`
reports whether the `whisper-cli` (or `main`) binary itself is found; it
does not (and cannot generically) verify a specific model file exists —
that's reported at transcribe time if it's missing or wrong.

## Ollama

Checked against Ollama's documented local HTTP API
(`POST /api/generate`, `GET /api/version`, `GET /api/tags`), not
undocumented behavior. Default endpoint `http://127.0.0.1:11434`,
overridable with `--ollama-url`. Model selection is always explicit via
`--model` — nothing is hardcoded to one model.

Translation prompts request structured JSON
(`{"segments": [{"id": N, "text": "..."}]}`) using `format: "json"`. Since
that only guarantees syntactically valid JSON — not that it matches this
shape or contains the right ids — every response is validated
(`src/translation/responseValidation.ts`): missing ids, duplicate ids, and
non-string text are all rejected, triggering a limited retry (2 extra
attempts) before failing clearly. **The model never controls timestamps or
segment identity** — only text; `SubtitleSegment.id`, `startMs`, `endMs`
are always reapplied from the original document. A batch that never
produces a valid response fails without writing anything — the original
subtitle file is never touched, never partially overwritten.

Every request has a timeout (120s) and is abortable; a signal passed to
`translate()`'s options propagates into the in-flight HTTP request.

### Batching and context

Segments are translated in batches (default 20 per call, configurable),
each with a few preceding segments' *original* text included as read-only
context — enough for something like *"I got it."* to translate with the
right sense of what was just said, without sending an entire movie's
subtitles into one call. The model is explicitly told those context lines
are for reference only and must not be re-translated or re-returned; the
validator rejects a response that includes an id that wasn't requested.
This is a first pass, not a claim of solved context-dependent translation —
see [Known limitations](#known-limitations).

## Privacy

- **`--local`**: no media, audio, subtitle text, or translation prompt is
  intentionally sent anywhere off this machine. A step that can't satisfy
  that fails instead of silently falling back to something that would.
- **Default (no `--local`)**: FFmpeg and Whisper run entirely locally
  regardless. Subtitle text is sent to the Ollama endpoint you configured
  — by default your own machine's loopback address, but your choice if you
  point it elsewhere.
- **No telemetry, hidden or otherwise**, anywhere in this package.

## Security

Threat model and mitigations, matching what actually touches untrusted
input:

| Concern | Mitigation |
|---|---|
| Malicious/crafted input path (spaces, `&&`, Unicode) reaching a shell | Every external command uses `spawn(cmd, argv)` with `shell: false` — argv is never string-interpolated into a shell command |
| Path traversal via user-supplied output paths | `assertSafeToWrite` resolves and compares paths; never writes over the input file, even with `--overwrite` |
| Temp files leaking sensitive audio/text | Created with unpredictable names under the OS temp dir, cleaned up on success, on error (`try/finally`), and on process exit/SIGINT/SIGTERM |
| The model's JSON output "controlling" the program | Structurally validated against the exact requested ids before use; never used to set timestamps; a bad response fails the batch instead of being trusted |
| Unbounded retries on a broken Ollama endpoint | Capped at 2 retries per batch, each request has a timeout |
| Silently overwriting the user's original file | Output path is always distinct from input; existing output needs `--overwrite` |
| Secrets in logs | `--verbose` prints external commands, batches, and timing — never a token, and Ollama needs no API key to begin with |

## Known limitations

- **Not tested against real ffmpeg/Whisper/Ollama installations** in the
  environment this was built in — none were available. See
  [Manual testing status](#manual-testing-status).
- **VTT support covers plain cues only.** `NOTE`/`STYLE`/`REGION` blocks
  and cue settings (`position:`, `align:`, ...) are recognized and skipped
  on parse, not interpreted or preserved on write. A styled VTT round-trips
  as plain text. Full styling support is a later phase.
- **Language detection is minimal.** The source language comes from
  `--from`, or from an existing subtitle stream's language tag, or is
  unknown. There's no acoustic language detection independent of Whisper's
  own (Whisper's detected language isn't currently surfaced back into the
  pipeline's decision of whether to translate).
- **OCR for image-based subtitles (PGS/VobSub) isn't implemented.**
  `extract` and the pipeline detect these and fail clearly rather than
  mistranslating them as text.
- **Translation context is a first pass**, not a solved problem — a few
  preceding lines of context, not full-document coherence. See
  [Batching and context](#batching-and-context).
- **No persistent configuration file.** Flags only, deliberately, for this
  first version.

## Manual testing status

**Run in this environment:** the full mocked test suite (`npm test`),
`npm run typecheck`, `npm run build`, `npm audit`, `npm pack --dry-run`,
and `npm run test:integration` (which correctly detected and reported that
ffmpeg, ffprobe, a Whisper backend, and Ollama are **all absent** here —
see its printed capability report — and skipped every real-tool check
accordingly; nothing was reported as passing that didn't actually run).

**Not run, because the tools aren't installed in this environment:**
`inspect`/`extract`/`transcribe`/`run` against a real video file, real
Whisper transcription, real Ollama translation, and anything involving
Unicode/spaced real file paths on an actual filesystem beyond what the
unit tests cover synthetically. These need to be tried on a machine that
actually has FFmpeg, a Whisper backend, and Ollama installed — see
[Testing on your machine](#testing-on-your-machine).

## Testing on your machine

Subtitle Forge targets Linux, macOS, and Windows as supported platforms —
nothing in the implementation depends on a shell-specific feature (every
external command runs via `spawn(cmd, argv)`, never a shell; see
[FFmpeg](#ffmpeg)). Installation is identical everywhere; only the example
paths below differ.

```sh
cd subtitle-forge
npm install
npm run build
npm link

subtitle-forge doctor
```

If `doctor` reports FFmpeg, Whisper, or Ollama as missing, install that
tool first — `doctor` names exactly what's missing and, for a model,
what to pull.

### Linux / macOS

```sh
subtitle-forge inspect /path/to/movie.mkv
subtitle-forge validate /path/to/subtitle.srt
subtitle-forge translate /path/to/subtitle.srt --translator ollama --model llama3.2 --to pt-BR
subtitle-forge run /path/to/movie.mkv --to pt-BR --translator ollama --model llama3.2 --dry-run
```

Drop `--dry-run` once the plan it prints looks right. With a local Whisper
model set up:

```sh
subtitle-forge run /path/to/movie.mkv \
  --to pt-BR \
  --transcriber whisper --whisper-model /path/to/ggml-small.bin \
  --translator ollama --model llama3.2
```

### Windows

Same commands, PowerShell syntax (Windows paths, `` ` `` for line
continuation instead of `\`):

```powershell
subtitle-forge inspect "C:\Videos\movie.mkv"
subtitle-forge validate "C:\Subs\movie.srt"
subtitle-forge translate "C:\Subs\movie.srt" --translator ollama --model llama3.2 --to pt-BR
subtitle-forge run "C:\Videos\movie.mkv" --to pt-BR --translator ollama --model llama3.2 --dry-run
```

```powershell
subtitle-forge run "C:\Videos\movie.mkv" `
  --to pt-BR `
  --transcriber whisper --whisper-model "C:\models\ggml-small.bin" `
  --translator ollama --model llama3.2
```

## Development

```sh
npm run dev -- inspect movie.mkv   # run from source, no build needed
npm run typecheck                  # checks src/ and test/
npm test                           # mocked; never needs ffmpeg/Whisper/Ollama
npm run test:integration           # opt-in; uses whatever of those is actually installed
npm run build
```

## Tests

133 tests across 16 files (`npm test`), all mocking the external boundary
(spawned processes, `fetch`) — covering the SRT/VTT parser and writer
(CRLF/LF/BOM/multiline/empty/invalid entries), the validator, ffprobe JSON
parsing and stream selection, ffmpeg argument construction (including
Unicode/spaced paths, never a shell), the whisper.cpp JSON output format,
Ollama request/response handling (batching, retries, an exhausted-retries
failure that never corrupts output, progress reporting), output path
derivation and the overwrite guard, `--local`'s loopback check, temp file
lifecycle (creation, cleanup, exit/signal hooks, and a guard against ever
being pointed at the OS temp/home/root directory), the full pipeline
end-to-end with fake dependencies, and the CLI itself (`--help`,
`--version`, an unknown command, `doctor`, `validate`'s exit codes and
`--json` output, and the "missing tool" error paths this sandbox
genuinely exercises for real).

See [`test/integration/README.md`](test/integration/README.md) for the
separate, opt-in suite against real local tools.

## Roadmap

- **Phase 1** (this round): local SRT pipeline — inspect, extract,
  transcribe, translate, validate, `run`, `doctor`.
- **Phase 2**: better automatic stream selection (multiple audio/subtitle
  tracks, language preference, forced-subtitle handling).
- **Phase 3**: OCR for image-based subtitles (PGS/VobSub).
- **Phase 4**: optional online providers, behind the same `Transcriber`/
  `Translator` interfaces — never replacing local-first as the default.
- **Phase 5**: optional GUI, only if it turns out to earn its complexity.
- **Phase 6**: batch processing (a whole directory/season at once).
- **Phase 7**: glossary / custom terminology for translation.
- **Phase 8**: translation memory / cache across runs.
- **Phase 9**: translation quality evaluation.

## License

Apache-2.0, matching the rest of this repository.
