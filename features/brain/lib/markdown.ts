import { readFileSync } from "fs";
import { join, resolve, normalize } from "path";

const BRAIN_ROOT = join(process.cwd(), "content", "brain");

export type MarkdownDocument = {
  body: string;
  sourcePath: string;
  title: string | null;
};

function isSafeBrainPath(resolved: string): boolean {
  const normalizedRoot = normalize(BRAIN_ROOT);
  const normalizedResolved = normalize(resolved);
  return normalizedResolved.startsWith(normalizedRoot);
}

export function readBrainMarkdown(
  relativePath: string,
): MarkdownDocument | null {
  const resolved = resolve(BRAIN_ROOT, "..", "..", relativePath);

  if (!isSafeBrainPath(resolved)) {
    return null;
  }

  let raw: string;
  try {
    raw = readFileSync(resolved, "utf8");
  } catch {
    return null;
  }

  const firstLine = raw.trimStart().split("\n")[0] ?? "";
  const title = firstLine.startsWith("# ")
    ? firstLine.slice(2).trim()
    : null;

  return { body: raw, sourcePath: relativePath, title };
}
