/**
 * diffUtils — Utility for computing and rendering contract version diffs.
 *
 * Uses the `diff` library to compute word-level and line-level diffs between
 * two versions of contract content (plain text or HTML stripped to text).
 */

import { diffWords, diffLines, type Change } from "diff";

export interface DiffSegment {
  value: string;
  added?: boolean;
  removed?: boolean;
}

/**
 * Strip HTML tags and decode entities to produce plain text for diffing.
 */
export function stripHtml(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

/**
 * Compute a word-level diff between two strings.
 */
export function computeWordDiff(oldText: string, newText: string): DiffSegment[] {
  return diffWords(oldText, newText);
}

/**
 * Compute a line-level diff between two strings.
 */
export function computeLineDiff(oldText: string, newText: string): DiffSegment[] {
  return diffLines(oldText, newText);
}

export interface SideBySideLine {
  left: { text: string; type: "unchanged" | "removed" | "empty" };
  right: { text: string; type: "unchanged" | "added" | "empty" };
  lineNumLeft: number | null;
  lineNumRight: number | null;
}

/**
 * Compute side-by-side lines from a line-level diff.
 */
export function computeSideBySide(oldText: string, newText: string): SideBySideLine[] {
  const changes = diffLines(oldText, newText);
  const result: SideBySideLine[] = [];
  let leftNum = 1;
  let rightNum = 1;

  let i = 0;
  while (i < changes.length) {
    const change = changes[i];
    const lines = change.value.replace(/\n$/, "").split("\n");

    if (!change.added && !change.removed) {
      // Unchanged
      for (const line of lines) {
        result.push({
          left: { text: line, type: "unchanged" },
          right: { text: line, type: "unchanged" },
          lineNumLeft: leftNum++,
          lineNumRight: rightNum++,
        });
      }
      i++;
    } else if (change.removed && i + 1 < changes.length && changes[i + 1].added) {
      // Paired removal + addition
      const removedLines = lines;
      const addedLines = changes[i + 1].value.replace(/\n$/, "").split("\n");
      const maxLen = Math.max(removedLines.length, addedLines.length);
      for (let j = 0; j < maxLen; j++) {
        result.push({
          left: {
            text: j < removedLines.length ? removedLines[j] : "",
            type: j < removedLines.length ? "removed" : "empty",
          },
          right: {
            text: j < addedLines.length ? addedLines[j] : "",
            type: j < addedLines.length ? "added" : "empty",
          },
          lineNumLeft: j < removedLines.length ? leftNum++ : null,
          lineNumRight: j < addedLines.length ? rightNum++ : null,
        });
      }
      i += 2;
    } else if (change.removed) {
      for (const line of lines) {
        result.push({
          left: { text: line, type: "removed" },
          right: { text: "", type: "empty" },
          lineNumLeft: leftNum++,
          lineNumRight: null,
        });
      }
      i++;
    } else if (change.added) {
      for (const line of lines) {
        result.push({
          left: { text: "", type: "empty" },
          right: { text: line, type: "added" },
          lineNumLeft: null,
          lineNumRight: rightNum++,
        });
      }
      i++;
    } else {
      i++;
    }
  }

  return result;
}

/**
 * Compute diff stats (added/removed/unchanged word count).
 */
export function computeDiffStats(oldText: string, newText: string) {
  const changes = diffWords(oldText, newText);
  let added = 0;
  let removed = 0;
  let unchanged = 0;
  for (const c of changes) {
    const count = c.value.split(/\s+/).filter(Boolean).length;
    if (c.added) added += count;
    else if (c.removed) removed += count;
    else unchanged += count;
  }
  return { added, removed, unchanged, total: added + removed + unchanged };
}
