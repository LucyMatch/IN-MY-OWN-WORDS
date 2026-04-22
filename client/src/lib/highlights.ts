import type { HighlightRange } from '@shared/types'

/**
 * Split text into blocks the same way ReadingPane does.
 * Index 0 is the chapter/scene heading; body paragraphs follow.
 */
export function splitIntoParagraphs(text: string): string[] {
  return text ? text.split(/\n\n+/) : []
}

/**
 * Given the full blocks array and the current window.getSelection(),
 * compute the HighlightRange[] for the selection.
 *
 * Returns null if the selection is empty or doesn't fall within the
 * paragraph elements that carry data-paragraph-index attributes.
 * paragraphRoot is the element wrapping all rendered blocks.
 */
export function computeRangesFromSelection(
  blocks: string[],
  paragraphRoot: HTMLElement,
): HighlightRange[] | null {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null

  const range = sel.getRangeAt(0)

  const startP = findParagraphAncestor(range.startContainer, paragraphRoot)
  const endP = findParagraphAncestor(range.endContainer, paragraphRoot)
  if (!startP || !endP) return null

  const startIdx = Number(startP.dataset.paragraphIndex)
  const endIdx = Number(endP.dataset.paragraphIndex)
  if (Number.isNaN(startIdx) || Number.isNaN(endIdx)) return null

  // getRangeAt(0) is always in document order, so startIdx <= endIdx in
  // practice. Normalize defensively in case of unusual browser behaviour.
  const [lowIdx, highIdx] =
    startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx]

  const startOffsetInPara =
    startIdx <= endIdx
      ? offsetWithinParagraph(startP, range.startContainer, range.startOffset)
      : offsetWithinParagraph(endP, range.endContainer, range.endOffset)
  const endOffsetInPara =
    startIdx <= endIdx
      ? offsetWithinParagraph(endP, range.endContainer, range.endOffset)
      : offsetWithinParagraph(startP, range.startContainer, range.startOffset)

  const ranges: HighlightRange[] = []

  if (lowIdx === highIdx) {
    const [s, e] =
      startOffsetInPara <= endOffsetInPara
        ? [startOffsetInPara, endOffsetInPara]
        : [endOffsetInPara, startOffsetInPara]
    if (s === e) return null
    ranges.push({ paragraphIndex: lowIdx, start: s, end: e })
  } else {
    ranges.push({
      paragraphIndex: lowIdx,
      start: startOffsetInPara,
      end: blocks[lowIdx].length,
    })
    for (let i = lowIdx + 1; i < highIdx; i++) {
      ranges.push({ paragraphIndex: i, start: 0, end: blocks[i].length })
    }
    ranges.push({ paragraphIndex: highIdx, start: 0, end: endOffsetInPara })
  }

  return ranges
}

/**
 * Build the `text` field for a Highlight from its ranges and the blocks array.
 * Concatenates range text with '\n\n' between paragraph boundaries.
 */
export function buildHighlightText(
  blocks: string[],
  ranges: HighlightRange[],
): string {
  return ranges
    .map((r) => blocks[r.paragraphIndex].slice(r.start, r.end))
    .join('\n\n')
}

/**
 * Render a single paragraph's content, splitting around any ranges that
 * belong to it. Returns a flat array of segment descriptors: plain text or
 * marked text. ReadingPane converts these to DOM elements.
 *
 * Pure — no event handlers, no refs, no React.
 */
export function segmentParagraph(
  paragraphText: string,
  rangesForParagraph: Array<HighlightRange & { highlightId: string }>,
): Array<
  | { type: 'text'; text: string }
  | { type: 'mark'; text: string; highlightId: string }
> {
  if (rangesForParagraph.length === 0) {
    return [{ type: 'text', text: paragraphText }]
  }

  const sorted = [...rangesForParagraph].sort((a, b) => a.start - b.start)

  const segments: Array<
    | { type: 'text'; text: string }
    | { type: 'mark'; text: string; highlightId: string }
  > = []
  let cursor = 0
  for (const r of sorted) {
    if (r.start > cursor) {
      segments.push({ type: 'text', text: paragraphText.slice(cursor, r.start) })
    }
    segments.push({
      type: 'mark',
      text: paragraphText.slice(r.start, r.end),
      highlightId: r.highlightId,
    })
    cursor = r.end
  }
  if (cursor < paragraphText.length) {
    segments.push({ type: 'text', text: paragraphText.slice(cursor) })
  }
  return segments
}

// ----- internal helpers -----

function findParagraphAncestor(
  node: Node,
  root: HTMLElement,
): HTMLElement | null {
  let n: Node | null = node
  while (n && n !== root) {
    if (
      n.nodeType === Node.ELEMENT_NODE &&
      (n as HTMLElement).dataset.paragraphIndex !== undefined
    ) {
      return n as HTMLElement
    }
    n = n.parentNode
  }
  return null
}

/**
 * Compute the character offset of (node, offset) within the paragraph
 * element's plain text content. Walks text nodes in document order.
 * Falls back to the paragraph's full text length if the node isn't found
 * (e.g. element-level boundary at end of paragraph).
 */
function offsetWithinParagraph(
  paragraph: HTMLElement,
  node: Node,
  offset: number,
): number {
  let total = 0
  const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT)
  let current: Node | null = walker.nextNode()
  while (current) {
    if (current === node) return total + offset
    total += current.textContent?.length ?? 0
    current = walker.nextNode()
  }
  return Math.min(total, paragraph.textContent?.length ?? 0)
}
