import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { experimental_generateImage as generateImage } from "ai";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv({ path: path.resolve(import.meta.dirname, "../.env") });

const MODEL = "xai/grok-imagine-image-2.0-preview";
const OUTPUT_DIR = path.resolve(import.meta.dirname, "../../../apps/web/public/assets/generated");

const server = new McpServer({
  name: "settersaga-asset-gen",
  version: "0.0.1",
});

server.registerTool(
  "generate_game_asset",
  {
    title: "Generate game asset",
    description:
      "Generate a game art asset (tile, card, icon, etc.) as an image and save it into apps/web/public/assets/generated.",
    inputSchema: {
      prompt: z.string().describe("Description of the asset to generate"),
      filename: z
        .string()
        .describe("File name without extension, e.g. 'brick-tile' or 'settler-card-01'"),
      aspectRatio: z
        .enum(["1:1", "16:9", "9:16", "4:3", "3:4"])
        .optional()
        .describe("Aspect ratio of the generated image, defaults to 1:1"),
    },
  },
  async ({ prompt, filename, aspectRatio }) => {
    if (!process.env.AI_GATEWAY_API_KEY) {
      return {
        isError: true,
        content: [{ type: "text", text: "AI_GATEWAY_API_KEY is not set in the MCP server environment." }],
      };
    }

    const { image } = await generateImage({
      model: MODEL,
      prompt,
      aspectRatio: aspectRatio ?? "1:1",
    });

    await mkdir(OUTPUT_DIR, { recursive: true });
    const safeName = filename.replace(/[^a-z0-9-_]/gi, "-");
    const extension = image.mediaType?.split("/")[1] ?? "png";
    const outputPath = path.join(OUTPUT_DIR, `${safeName}.${extension}`);
    await writeFile(outputPath, image.uint8Array);

    const relativePath = path.relative(path.resolve(import.meta.dirname, "../../.."), outputPath);
    return {
      content: [{ type: "text", text: `Saved asset to ${relativePath}` }],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
