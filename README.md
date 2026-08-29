# Video Frame Generator by Tanvir Ahmed

Minimal Electron desktop app that extracts high-quality JPEG frames from video files in a selected folder, then classifies those images locally into safe vs flagged folders.

## Description

Select one folder. The app scans **only files directly inside that folder** (no nested/subfolders), calculates how many screenshots each video needs from its duration, extracts evenly spaced frames with FFmpeg, and saves them to:

```text
SelectedFolder/Generated Images/
```

After frame extraction finishes, a **local** image risk classifier runs (no cloud moderation APIs). Originals are kept, and copies are placed under:

```text
SelectedFolder/Generated Images/
├── *.jpg                 # originals (never deleted)
├── safe-images/
├── flagged-images/
└── classification-report.json
```

Live progress, cancel support, and per-video error handling are included. Existing generated images are never overwritten.

You can also use **Classify Images or Videos** on the dashboard:

- **Classify Image** — copies top-level images into `safe-images/` and `flagged-images/` (originals kept).
- **Classify Video** — samples temporary frames only, then copies each video into `safe-videos/` or `flagged-videos/` (no permanent Generated Images from this action).

## Requirements

- Windows 10/11 (primary target)
- [Node.js](https://nodejs.org/) 18 or newer
- npm 9 or newer

FFmpeg and FFprobe are **bundled** via `ffmpeg-static` and `ffprobe-static`. You do not need to install FFmpeg on your PATH for development or production builds.

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

This compiles the Electron main/preload processes, starts the Vite React UI, then launches Electron against `http://localhost:5173`.

## Production Build

```bash
npm run build
```

This typechecks the renderer, builds the UI into `dist/`, bundles Electron into `dist-electron/`, and packages a Windows installer under `release/` with electron-builder.

## Other Scripts

```bash
npm run lint
npm run format
npm run typecheck
```

## FFmpeg Information

- Frame extraction uses the bundled `ffmpeg` binary (`-q:v 2` JPEG quality).
- Duration detection uses the bundled `ffprobe` binary.
- If binaries are missing or unreadable, the UI shows:

  > FFmpeg is required to process videos. Please install/configure FFmpeg and make sure ffmpeg and ffprobe are available.

## Local Image Classification

Classification runs **on-device** with [Transformers.js](https://huggingface.co/docs/transformers.js) (`@xenova/transformers`) and CLIP (`Xenova/clip-vit-base-patch32`) via zero-shot image classification.

- **No** OpenAI / Google Vision / AWS Rekognition / Azure / paid moderation APIs.
- Inference is local after the model is available.
- First run may download model weights from Hugging Face (~150MB) into a local cache; later runs can work offline from that cache.
- Logo / character / watermark hits are recorded as **risk indicators** (`potential_copyright_risk`), not legal copyright determinations.
- If one image fails to classify, the rest continue; the original file is always preserved.

### Model cache location

By default the model cache is:

```text
{Electron userData}/models
```

Override with `IMAGE_CLASSIFICATION_MODEL_CACHE`.

### Classification environment variables

| Variable | Default | Meaning |
|----------|---------|---------|
| `IMAGE_CLASSIFICATION_ENABLED` | `true` | Set `false` to skip classification |
| `IMAGE_CLASSIFICATION_CONCURRENCY` | `2` | Max parallel image inferences |
| `IMAGE_CLASSIFICATION_MODEL_ID` | `Xenova/clip-vit-base-patch32` | Hugging Face / local-compatible model id |
| `IMAGE_CLASSIFICATION_MODEL_CACHE` | Electron `userData/models` | ONNX / transformers cache directory |
| `IMAGE_CLASSIFICATION_SKIP_EXISTING` | `true` | Skip images already present in `safe-images` or `flagged-images` |
| `IMAGE_CLASSIFICATION_THRESHOLDS` | _(built-in 0.25)_ | Optional JSON overrides, e.g. `{"nudity":0.2,"weapon":0.35}` |

Default thresholds (centralized in code; tuned for CLIP multi-label softmax, not binary detectors):

```js
{
  nudity: 0.25,
  sexualContent: 0.25,
  violence: 0.25,
  gore: 0.25,
  weapon: 0.25,
  drugs: 0.25,
  hateSymbol: 0.25,
  logo: 0.25,
  watermark: 0.25,
  recognizableCharacter: 0.25
}
```

## Video Branding (Watermark + Moving Text)

Section **3. Video Branding** adds a lightweight branding pass that runs entirely locally with the bundled FFmpeg — no external AI or API calls. Originals are never modified or overwritten.

- **Watermark** — either an **Image Logo** (PNG with transparency works best; JPG/WEBP also supported) or a **Text Logo** rendered locally to a transparent PNG. Configure position (9 anchors), size, opacity, edge margin, and for text: font, size, weight, colour, and shadow.
- **Moving Text** — a subtle overlay that drifts smoothly across the frame on a slow sine path with different horizontal and vertical periods, so it never jumps and always stays fully inside the frame. Speed presets: Very Slow (default), Slow, Normal.
- **Preview** — pick any scanned video and enable an overlay. A real 5-second clip is rendered automatically after settings settle, using the exact same filter graph and encoder settings as the final output, then played back in the app. Adjust settings to refresh the live preview; a retry action is available if a render fails.
- **Apply to All Videos** — processes the folder sequentially. Each video fails independently, so a corrupted file is logged and skipped without stopping the batch.

Details:

- Every enabled overlay is applied in a **single `-filter_complex` with one encode pass**; resolution, aspect ratio, and orientation are unchanged (rotated videos are detected and sized correctly).
- Encoding tries a hardware encoder (`h264_nvenc` / `h264_qsv` / `h264_amf`) when available and automatically falls back to `libx264 -crf 18`. Audio is copied, falling back to AAC when the source stream cannot be remuxed.
- Overlay sizes are percentages of the video's own width/height, so mixed-resolution folders stay visually consistent.
- Output goes to `{SelectedFolder}/Branded Videos/` by default, or any folder chosen with **Change Output Folder**. Name collisions get a `_02`, `_03`, … suffix, and the output folder can never be the source folder.
- A `branding-report.json` is written to the output folder with per-video status, duration, encoder, and failure reason.
- Branding, frame extraction, and classification are mutually exclusive — only one job runs at a time.

## How the Application Works

1. Click **Select Folder** and choose a root folder.
2. The app lists video files **only in that folder** (extensions such as `.mp4`, `.mov`, `.mkv`, …; case-insensitive). Nested folders are ignored.
3. Review totals, then click **Start Processing**.
4. A `Generated Images` folder is created (or reused) inside the selected folder.
5. Videos are processed **sequentially**:
   - Probe duration with FFprobe
   - Image count = `Math.ceil(durationSeconds / 60)` (minimum 1)
   - Extract frames at evenly spaced timestamps (avoiding the very start/end)
   - Save as `{videoName}_01.jpg`, `{videoName}_02.jpg`, … with collision-safe names
6. After all videos finish (if not cancelled), each top-level generated image is classified locally and **copied** into `safe-images/` or `flagged-images/`.
7. Watch live stats, progress, current file, and the processing log.
8. Use **Cancel** to stop starting new videos and abort the current FFmpeg/FFprobe process when possible. Completed images are kept. Classification is skipped when the run is cancelled before the classification step.

## Supported Video Extensions

`.mp4` `.mov` `.mkv` `.avi` `.webm` `.m4v` `.mpeg` `.mpg` `.wmv` `.flv` `.3gp`
