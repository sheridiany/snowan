// Byte-stable edits on the raw markdown source. The rendered view is read-only
// XMarkdown; the only interactive mutation it allows is toggling a GFM checkbox,
// which must rewrite EXACTLY that one source line and leave every other byte intact
// (the KB index is hash-incremental — a lossy reserializer would re-embed on every
// keystroke). So we never round-trip through a parser; we splice the line in place.

const TASK_RE = /^(\s*[-*]\s+)\[( |x|X)\](.*)$/;

// Flip the checkbox on the Nth task line (matching XMarkdown's own task ordering),
// rewriting only that line's "[ ]"/"[x]" marker.
export function toggleTaskByOrdinal(body: string, ordinal: number): string {
  const lines = body.split('\n');
  let seen = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(TASK_RE);
    if (!m) continue;
    seen += 1;
    if (seen === ordinal) {
      const nextMark = m[2].toLowerCase() === 'x' ? ' ' : 'x';
      lines[i] = `${m[1]}[${nextMark}]${m[3]}`;
      break;
    }
  }
  return lines.join('\n');
}

// Append a carried-over task line under the "随手记" section if present, else at
// the end of the document. Used by the band's 「→ 移到今天」.
export function appendCarryover(body: string, line: string): string {
  const item = line.trim();
  const text = body.replace(/\n+$/, '');
  const lines = text.split('\n');
  const captureIdx = lines.findIndex((l) => /^##\s/.test(l) && l.includes('随手记'));
  if (captureIdx === -1) return `${text}\n${item}\n`;

  // Insert just before the next "## " heading after 随手记 (or at document end).
  let end = lines.length;
  for (let i = captureIdx + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      end = i;
      break;
    }
  }
  // Drop trailing blank lines inside the section so the new item sits flush.
  let insertAt = end;
  while (insertAt > captureIdx + 1 && lines[insertAt - 1].trim() === '') insertAt -= 1;
  lines.splice(insertAt, 0, item);
  return lines.join('\n');
}

// Insert an AI-drafted block under a target "## " heading, replacing the blank
// placeholder lines beneath it. Drafts are tagged with an origin marker so an
// accepted block is identifiable in the vault (direction §6).
export function insertUnderHeading(body: string, headingMatch: string, draft: string): string {
  const lines = body.split('\n');
  const headIdx = lines.findIndex((l) => /^##\s/.test(l) && l.includes(headingMatch));
  const block = draft.trim();
  if (headIdx === -1) return `${body.replace(/\n+$/, '')}\n\n${block}\n`;

  let end = lines.length;
  for (let i = headIdx + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      end = i;
      break;
    }
  }
  // Replace everything between the heading and the next section with the draft,
  // keeping one trailing blank line before the next heading.
  const before = lines.slice(0, headIdx + 1);
  const after = lines.slice(end);
  const next = [...before, '', block, '', ...after];
  return next.join('\n').replace(/\n{3,}/g, '\n\n');
}
