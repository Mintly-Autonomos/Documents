import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

import { readFile } from 'node:fs/promises'

export async function extractPdfText (absPath: string): Promise<string> {
  // pdf-parse v2: API baseada em classe PDFParse
  const { PDFParse } = await import('pdf-parse')
  const buf = await readFile(absPath)
  const parser = new PDFParse({ data: buf })
  const result = await parser.getText()
  return result.text.trim()
}

export async function extractDocxHtml (absPath: string): Promise<string> {
  const mammoth = require('mammoth') as typeof import('mammoth')
  const { value } = await mammoth.convertToHtml({ path: absPath })
  return value
}

export async function extractXlsxHtml (absPath: string): Promise<string> {
  const XLSX = require('xlsx') as typeof import('xlsx')
  const wb = XLSX.readFile(absPath)
  const first = wb.SheetNames[0]
  return XLSX.utils.sheet_to_html(wb.Sheets[first])
}
