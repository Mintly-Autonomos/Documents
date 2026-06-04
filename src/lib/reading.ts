export interface Heading { depth: number, slug: string, text: string }

export function readingTimeMin (raw: string): number {
  const words = raw.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 200))
}

export function tocFromHeadings (headings: Heading[]): Heading[] {
  return headings.filter((h) => h.depth === 2 || h.depth === 3)
}
