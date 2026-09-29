/**
 * Normalized internal representation of a subtitle. Every parser (SRT, VTT)
 * converts INTO this shape, every writer converts FROM it, and translation
 * operates on it directly. SRT specifically is never used as the internal
 * representation — its 1-indexed sequence numbers and comma-decimal
 * timestamps are a serialization detail, not a data model.
 */
export interface SubtitleSegment {
  /** 1-based, stable identity for a segment across translation batches. */
  id: number;
  startMs: number;
  endMs: number;
  text: string;
}

export interface SubtitleDocument {
  segments: SubtitleSegment[];
}

export type SubtitleFormat = "srt" | "vtt";

// --- Media inspection -------------------------------------------------

export interface MediaStreamBase {
  index: number;
  codec: string;
  language: string | null;
  title: string | null;
}

export interface VideoStreamInfo extends MediaStreamBase {
  kind: "video";
  width: number | null;
  height: number | null;
  frameRate: number | null;
}

export interface AudioStreamInfo extends MediaStreamBase {
  kind: "audio";
  channels: number | null;
  sampleRateHz: number | null;
}

export interface SubtitleStreamInfo extends MediaStreamBase {
  kind: "subtitle";
  /** True for image-based formats (PGS, VobSub/dvd_subtitle) that need OCR, not text extraction. */
  isImageBased: boolean;
  default: boolean;
  forced: boolean;
}

export interface MediaInfo {
  path: string;
  container: string;
  durationSec: number | null;
  video: VideoStreamInfo[];
  audio: AudioStreamInfo[];
  subtitles: SubtitleStreamInfo[];
}

/** Reads container/stream metadata for a media file. */
export interface MediaInspector {
  inspect(path: string): Promise<MediaInfo>;
}

// --- Extraction ---------------------------------------------------------

export interface SubtitleExtractor {
  /** Extracts a text-based subtitle stream as an SRT file at `outPath`. Throws if the stream is image-based. */
  extractSubtitle(input: string, streamIndex: number, outPath: string): Promise<void>;
  /** Extracts audio from `input` into a new temporary file sized for speech transcription, returning its path. */
  extractAudioForTranscription(input: string, streamIndex?: number): Promise<string>;
}

// --- Transcription --------------------------------------------------------

export interface TranscribeOptions {
  language?: string;
  /** Absolute path to a local acoustic model file, when the backend needs one. */
  modelPath?: string;
  signal?: AbortSignal;
}

export interface Transcriber {
  readonly id: string;
  /** Whether the backend executable/service this transcriber needs is available right now. */
  isAvailable(): Promise<boolean>;
  transcribe(audioPath: string, options: TranscribeOptions): Promise<SubtitleDocument>;
}

// --- Translation ----------------------------------------------------------

export interface TranslateOptions {
  from?: string;
  to: string;
  model?: string;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

export interface Translator {
  readonly id: string;
  isAvailable(): Promise<boolean>;
  translate(doc: SubtitleDocument, options: TranslateOptions): Promise<SubtitleDocument>;
}

// --- Parsing / writing ------------------------------------------------

export interface SubtitleParser {
  parse(text: string): SubtitleDocument;
}

export interface SubtitleWriter {
  write(doc: SubtitleDocument): string;
}
