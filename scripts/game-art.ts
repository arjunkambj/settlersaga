#!/usr/bin/env bun
// Game art generator: makes and edits SetterSaga assets with OpenAI's
// GPT-Image-2.6 models through the Image API. Run `pnpm art --help`.
// Docs: https://developers.openai.com/api/docs/guides/image-generation
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

const API_BASE = "https://api.openai.com/v1/images";
const TIMEOUT_MS = 5 * 60_000;
const MAX_ATTEMPTS = 3;
const KEY_FILE = path.resolve(import.meta.dir, "../apps/web/.env.local");

const MODELS = {
  flare: "gpt-image-2.6-flare",
  sunburst: "gpt-image-2.6-sunburst",
} as const;

const FORMATS = ["png", "webp", "jpeg", "svg", "gif"] as const;
const QUALITIES = ["low", "medium", "high", "xhigh", "max", "auto"] as const;
const COMPLEXITIES = ["low", "medium", "high"] as const;
const BACKGROUNDS = ["transparent", "opaque", "auto"] as const;
const MODERATIONS = ["auto", "low"] as const;

type Format = (typeof FORMATS)[number];

// USD per million tokens, from the GPT-Image-2.6 model pages.
const PRICE_PER_MILLION = { textInput: 5, imageInput: 8, imageOutput: 30 };

const HELP = `Make or edit game art with GPT-Image-2.6 (Flare or Sunburst).

Usage:
  pnpm art generate -p "<prompt>" -o <file> [options]
  pnpm art edit -i <image> [-i <reference> ...] -p "<prompt>" -o <file> [options]

Prompt and output:
  -p, --prompt <text>        Prompt text
      --prompt-file <path>   Read the prompt from a file (better for long prompts)
  -o, --out <path>           Output file; the extension picks the format if --format is unset
      --force                Overwrite existing files
      --dry-run              Print the request without calling the API

Model and look:
  -m, --model <name>         flare (default, fast) | sunburst (detail) | any full model id
      --final                Final asset: Sunburst at high quality (overrides -m and -q)
  -q, --quality <level>      low | medium (default) | high | xhigh | max | auto
      --complexity <level>   low | medium | high (API default: high). Planning before rendering
  -s, --size <WxH>           auto, 1024x1024, 1536x1024, 1024x1536, or custom
                             (multiples of 16, ratio up to 3:1, 655,360 to 8,294,400 pixels)
  -b, --background <kind>    transparent | opaque | auto (transparent needs png, webp or svg)
  -f, --format <fmt>         png (default) | webp | jpeg | svg | gif
      --compression <0-100>  For jpeg or webp
      --n <count>            Images per request, 1 to 10 (files get -1, -2 ... suffixes)
      --moderation <level>   auto (default) | low

GIF (with --format gif):
      --frames <2-16>        Frame count (API default 9)
      --frame-ms <20-2000>   Milliseconds per frame (API default 200)

Edit only:
  -i, --image <path>         Image to change; repeat for reference images (first one is edited)
      --mask <path>          PNG with alpha, same size as the first image
      --markup <path>        Transparent PNG overlay (circles, arrows) showing where to change

The key is OPENAI_API_KEY from the environment, else from apps/web/.env.local.`;

interface Usage {
  input_tokens: number;
  output_tokens: number;
  input_tokens_details?: { text_tokens?: number; image_tokens?: number };
}

interface ImagesResponse {
  data: { b64_json: string }[];
  size?: string;
  quality?: string;
  usage?: Usage;
  svg_usage?: { input_tokens: number; output_tokens: number; model?: string };
}

interface ApiErrorBody {
  error?: {
    message?: string;
    type?: string;
    code?: string;
    moderation_details?: { moderation_stage?: string; categories?: string[] };
  };
}

function fail(message: string): never {
  console.error(`game-art: ${message}`);
  process.exit(1);
}

function oneOf<T extends string>(
  flag: string,
  value: string | undefined,
  allowed: readonly T[],
): T | undefined {
  if (value === undefined) return undefined;
  if (!(allowed as readonly string[]).includes(value)) {
    fail(`${flag} must be one of: ${allowed.join(", ")} (got "${value}")`);
  }
  return value as T;
}

function intInRange(
  flag: string,
  value: string | undefined,
  min: number,
  max: number,
): number | undefined {
  if (value === undefined) return undefined;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    fail(`${flag} must be a whole number from ${min} to ${max} (got "${value}")`);
  }
  return number;
}

function sizeProblem(size: string, format: Format): string | undefined {
  if (size === "auto") return undefined;
  const match = /^(\d+)x(\d+)$/.exec(size);
  if (!match) return `--size must be "auto" or WIDTHxHEIGHT (got "${size}")`;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width % 16 !== 0 || height % 16 !== 0) {
    return "--size width and height must be multiples of 16";
  }
  if (format === "gif") return undefined;
  if (width / height > 3 || height / width > 3) return "--size aspect ratio must be within 3:1";
  if (Math.max(width, height) > 3840) return "--size edges must be 3840 pixels or less";
  const pixels = width * height;
  if (pixels < 655_360 || pixels > 8_294_400) {
    return "--size must total 655,360 to 8,294,400 pixels; for small sprites, generate at 1024 and downscale";
  }
  return undefined;
}

// Reads WIDTHxHEIGHT from a PNG header, or undefined for other formats.
async function pngSize(file: string): Promise<string | undefined> {
  const header = await Bun.file(file).slice(0, 24).arrayBuffer();
  if (header.byteLength < 24) return undefined;
  const view = new DataView(header);
  const isPng = view.getUint32(0) === 0x89504e47 && view.getUint32(12) === 0x49484452;
  return isPng ? `${view.getUint32(16)}x${view.getUint32(20)}` : undefined;
}

// Generate defaults to 1024x1024; edits keep the first image's size when the API
// accepts it (the API's own default can resize, e.g. 1024 in, 1254 out);
// GIFs let the API pick a frame size.
async function defaultSize(
  command: "generate" | "edit",
  format: Format,
  firstImage: string | undefined,
): Promise<string | undefined> {
  if (format === "gif") return undefined;
  if (command === "generate") return "1024x1024";
  const inputSize = firstImage ? await pngSize(firstImage) : undefined;
  return inputSize && !sizeProblem(inputSize, format) ? inputSize : undefined;
}

function resolveModel(name: string): string {
  return name in MODELS ? MODELS[name as keyof typeof MODELS] : name;
}

function describeError(status: number, requestId: string, body: ApiErrorBody): string {
  const error = body.error;
  const lines = [
    `OpenAI returned ${status} (request ${requestId}): ${error?.message ?? "no message"}`,
  ];
  if (error?.code === "moderation_blocked") {
    const details = error.moderation_details;
    lines.push(
      `Blocked by moderation at the ${details?.moderation_stage ?? "unknown"} stage` +
        (details?.categories?.length ? ` (${details.categories.join(", ")})` : "") +
        ". Rephrase the prompt or change the input images before retrying.",
    );
  } else if (error?.code === "insufficient_quota") {
    lines.push("The account is out of credit. Add billing at platform.openai.com.");
  } else if (status === 401) {
    lines.push("The API key was rejected. Check OPENAI_API_KEY in apps/web/.env.local.");
  } else if (status === 403) {
    lines.push(
      "GPT Image models may need organization verification at platform.openai.com/settings/organization/general.",
    );
  }
  return lines.join("\n");
}

async function send(
  endpoint: "generations" | "edits",
  body: string | FormData,
  apiKey: string,
): Promise<{ result: ImagesResponse; requestId: string }> {
  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
  if (typeof body === "string") headers["Content-Type"] = "application/json";

  for (let attempt = 1; ; attempt++) {
    const response = await fetch(`${API_BASE}/${endpoint}`, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const requestId = response.headers.get("x-request-id") ?? "unknown";
    if (response.ok) return { result: (await response.json()) as ImagesResponse, requestId };

    const errorBody = (await response.json().catch(() => ({}))) as ApiErrorBody;
    const retryable =
      response.status >= 500 ||
      (response.status === 429 && errorBody.error?.code !== "insufficient_quota");
    if (!retryable || attempt === MAX_ATTEMPTS) {
      fail(describeError(response.status, requestId, errorBody));
    }
    const delaySeconds = 2 ** attempt;
    console.error(`game-art: ${response.status} from OpenAI, retrying in ${delaySeconds}s`);
    await Bun.sleep(delaySeconds * 1000);
  }
}

async function readApiKey(): Promise<string | undefined> {
  const fromEnvironment = process.env.OPENAI_API_KEY?.trim();
  if (fromEnvironment) return fromEnvironment;
  const keyFile = Bun.file(KEY_FILE);
  if (!(await keyFile.exists())) return undefined;
  const match = /^\s*(?:export\s+)?OPENAI_API_KEY\s*=\s*["']?([^"'\s#]+)/m.exec(
    await keyFile.text(),
  );
  return match?.[1];
}

function estimateUsd(usage: Usage): number {
  const imageInput = usage.input_tokens_details?.image_tokens ?? 0;
  const textInput = usage.input_tokens_details?.text_tokens ?? usage.input_tokens - imageInput;
  return (
    (textInput * PRICE_PER_MILLION.textInput +
      imageInput * PRICE_PER_MILLION.imageInput +
      usage.output_tokens * PRICE_PER_MILLION.imageOutput) /
    1_000_000
  );
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      prompt: { type: "string", short: "p" },
      "prompt-file": { type: "string" },
      out: { type: "string", short: "o" },
      force: { type: "boolean" },
      "dry-run": { type: "boolean" },
      model: { type: "string", short: "m", default: "flare" },
      final: { type: "boolean" },
      quality: { type: "string", short: "q", default: "medium" },
      complexity: { type: "string" },
      size: { type: "string", short: "s" },
      background: { type: "string", short: "b" },
      format: { type: "string", short: "f" },
      compression: { type: "string" },
      n: { type: "string" },
      moderation: { type: "string" },
      frames: { type: "string" },
      "frame-ms": { type: "string" },
      image: { type: "string", short: "i", multiple: true },
      mask: { type: "string" },
      markup: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });

  const command = positionals[0];
  if (values.help || command === undefined) {
    console.log(HELP);
    return;
  }
  if (command !== "generate" && command !== "edit") {
    fail(`unknown command "${command}"; use generate or edit`);
  }

  if (values.prompt && values["prompt-file"]) fail("use --prompt or --prompt-file, not both");
  const prompt = values["prompt-file"]
    ? (await Bun.file(values["prompt-file"]).text()).trim()
    : values.prompt?.trim();
  if (!prompt) fail("a prompt is required (--prompt or --prompt-file)");
  if (!values.out) fail("--out is required");

  const outExtension = path.extname(values.out).slice(1).toLowerCase();
  const extensionFormat = outExtension === "jpg" ? "jpeg" : outExtension;
  const format =
    oneOf("--format", values.format, FORMATS) ??
    oneOf("--out extension", extensionFormat || "png", FORMATS) ??
    "png";
  if (values.format && extensionFormat && extensionFormat !== format) {
    fail(`--out ends in .${outExtension} but --format is ${format}`);
  }

  const model = resolveModel(values.final ? "sunburst" : values.model);
  const quality = values.final ? "high" : oneOf("--quality", values.quality, QUALITIES);
  const complexity = oneOf("--complexity", values.complexity, COMPLEXITIES);
  const background = oneOf("--background", values.background, BACKGROUNDS);
  const moderation = oneOf("--moderation", values.moderation, MODERATIONS);
  const n = intInRange("--n", values.n, 1, 10) ?? 1;
  const compression = intInRange("--compression", values.compression, 0, 100);
  const frames = intInRange("--frames", values.frames, 2, 16);
  const frameMs = intInRange("--frame-ms", values["frame-ms"], 20, 2000);
  const images = values.image ?? [];

  // Rules from the image generation guide, checked here so a bad request costs nothing.
  if (compression !== undefined && format !== "jpeg" && format !== "webp") {
    fail("--compression works only with jpeg or webp");
  }
  if (background === "transparent" && !["png", "webp", "svg"].includes(format)) {
    fail("a transparent background needs png, webp or svg");
  }
  if ((frames !== undefined || frameMs !== undefined) && format !== "gif") {
    fail("--frames and --frame-ms work only with --format gif");
  }
  if (format === "svg" && n !== 1) fail("svg output needs --n 1");
  if (command === "generate" && (images.length || values.mask || values.markup)) {
    fail("--image, --mask and --markup belong to the edit command");
  }
  if (command === "edit") {
    if (images.length === 0) fail("edit needs at least one --image");
    if (format === "svg") fail("svg output works only with generate");
    if (values.mask && values.markup) fail("use --mask or --markup, not both");
    for (const file of [...images, values.mask, values.markup]) {
      if (file && !existsSync(file)) fail(`file not found: ${file}`);
    }
    if (values.markup && path.extname(values.markup).toLowerCase() !== ".png") {
      fail("--markup must be a transparent PNG");
    }
  }

  const size = values.size ?? (await defaultSize(command, format, images[0]));
  const problem = size ? sizeProblem(size, format) : undefined;
  if (problem) fail(problem);

  const fileExtension = format === "jpeg" ? "jpg" : format;
  const base = outExtension ? values.out.slice(0, -(outExtension.length + 1)) : values.out;
  const outputs = Array.from({ length: n }, (_, index) =>
    n === 1 ? `${base}.${fileExtension}` : `${base}-${index + 1}.${fileExtension}`,
  );
  const existing = outputs.filter((file) => existsSync(file));
  if (existing.length && !values.force) {
    fail(`would overwrite ${existing.join(", ")}; pass --force to replace`);
  }

  const fields: Record<string, string | number> = { model, prompt, output_format: format };
  if (quality) fields.quality = quality;
  if (complexity) fields.complexity = complexity;
  if (size) fields.size = size;
  if (background) fields.background = background;
  if (moderation) fields.moderation = moderation;
  if (n > 1) fields.n = n;
  if (compression !== undefined) fields.output_compression = compression;
  if (frames !== undefined) fields.frame_count = frames;
  if (frameMs !== undefined) fields.frame_duration_ms = frameMs;

  const endpoint = command === "generate" ? "generations" : "edits";

  if (values["dry-run"]) {
    const shownPrompt =
      prompt.length > 80 ? `${prompt.slice(0, 80)}... (${prompt.length} chars)` : prompt;
    console.log(
      JSON.stringify(
        {
          endpoint: `${API_BASE}/${endpoint}`,
          fields: { ...fields, prompt: shownPrompt },
          images,
          mask: values.mask,
          markup: values.markup,
          outputs,
        },
        null,
        2,
      ),
    );
    return;
  }

  const apiKey = await readApiKey();
  if (!apiKey) fail("OPENAI_API_KEY is empty; paste your key into apps/web/.env.local");

  let body: string | FormData;
  if (command === "generate") {
    body = JSON.stringify(fields);
  } else {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.append(key, String(value));
    const imageField = images.length > 1 ? "image[]" : "image";
    for (const file of images) form.append(imageField, Bun.file(file), path.basename(file));
    if (values.mask) form.append("mask", Bun.file(values.mask), path.basename(values.mask));
    if (values.markup) form.append("markup", Bun.file(values.markup), path.basename(values.markup));
    body = form;
  }

  const started = performance.now();
  const { result, requestId } = await send(endpoint, body, apiKey);
  const seconds = ((performance.now() - started) / 1000).toFixed(1);

  if (result.data.length !== outputs.length) {
    console.error(`game-art: asked for ${outputs.length} images, got ${result.data.length}`);
  }
  for (const [index, item] of result.data.entries()) {
    const file = outputs[index] ?? `${base}-${index + 1}.${fileExtension}`;
    await mkdir(path.dirname(file), { recursive: true });
    await Bun.write(file, Buffer.from(item.b64_json, "base64"));
    console.log(`saved ${file}`);
  }

  const cost = result.usage ? ` · about $${estimateUsd(result.usage).toFixed(3)}` : "";
  console.log(
    `${model} · ${result.quality ?? quality ?? "auto"} · ${result.size ?? size ?? "auto"} · ${seconds}s${cost} · request ${requestId}`,
  );
  if (result.usage) {
    console.log(`tokens: ${result.usage.input_tokens} in, ${result.usage.output_tokens} out`);
  }
  if (result.svg_usage) {
    console.log(
      `svg author tokens (billed at the author model's rate): ${result.svg_usage.input_tokens} in, ${result.svg_usage.output_tokens} out`,
    );
  }
}

try {
  await main();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
