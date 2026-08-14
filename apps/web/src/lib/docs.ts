import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const DOCS_DIR = path.join(process.cwd(), "..", "..", "docs");

export interface DocSummary {
  slug: string;
  title: string;
}

export interface Doc extends DocSummary {
  content: string;
}

function titleFromContent(content: string, fallback: string): string {
  const heading = /^#\s+(.+)$/m.exec(content);
  return heading?.[1]?.trim() ?? fallback;
}

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export async function listDocs(): Promise<DocSummary[]> {
  let entries: string[];
  try {
    entries = await readdir(DOCS_DIR);
  } catch {
    return [];
  }

  const slugs = entries
    .filter((entry) => entry.endsWith(".md"))
    .map((entry) => entry.replace(/\.md$/, ""));

  const docs = await Promise.all(
    slugs.map(async (slug) => {
      const content = await readFile(path.join(DOCS_DIR, `${slug}.md`), "utf8");
      return { slug, title: titleFromContent(content, titleFromSlug(slug)) };
    }),
  );

  return docs.sort((a, b) => a.title.localeCompare(b.title));
}

const SAFE_SLUG_PATTERN = /^[a-z0-9-]+$/;

export async function getDoc(slug: string): Promise<Doc | null> {
  if (!SAFE_SLUG_PATTERN.test(slug)) {
    return null;
  }

  try {
    const content = await readFile(path.join(DOCS_DIR, `${slug}.md`), "utf8");
    return { slug, title: titleFromContent(content, titleFromSlug(slug)), content };
  } catch {
    return null;
  }
}
