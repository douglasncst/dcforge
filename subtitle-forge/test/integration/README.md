# Integration tests

`npm run test:integration` exercises whatever of ffmpeg, ffprobe, a local
Whisper backend, and Ollama are actually installed on **this** machine.
`npm test` (the default suite, and the only one CI runs) never touches any
of them — everything there mocks the external boundary.

## What it does and doesn't claim

Each tool is detected at the top of the run, and the result is printed
before anything else:

```
Integration test capabilities:
  ffmpeg: available — will run real checks
  ffprobe: available — will run real checks
  Whisper backend: NOT available — those checks are skipped, not passed
  Ollama: available — will run real checks
```

A tool that isn't found makes its whole `describe` block **skipped**, which
vitest reports distinctly from passed or failed — never read a "0 failed"
summary as "everything works"; read the capability report and the skip
list. This suite is designed so a passing run can only mean the tools that
were actually present worked, not that the harness quietly skipped its way
to green.

## Fixtures

No video/audio file is checked into the repository. Where a real ffmpeg is
available, tests generate tiny synthetic clips on the fly with ffmpeg's
`lavfi` test sources (`testsrc`, `sine`, `anullsrc`) — a few seconds of
color bars and a tone, never real footage, never anything copyrighted.

## Deeper checks (opt in with env vars)

Two checks need something this suite cannot provide on its own and are
skipped even when their tool is present, unless you opt in:

- **`WHISPER_TEST_MODEL_PATH=/path/to/model.bin`**: runs a real
  transcription of a synthetic silent clip, and checks that transcribing a
  synthetic 5s tone never yields a segment ending past the clip's real
  duration. No model is ever downloaded automatically — point this at one
  you already have.
- **`OLLAMA_TEST_MODEL=llama3.2`**: runs a real translation of one segment
  against a model you've already pulled (`ollama pull llama3.2`).

## Running

```sh
cd subtitle-forge
npm run test:integration
```
