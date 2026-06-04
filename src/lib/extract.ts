import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

import { readFile } from 'node:fs/promises'

// Sanitiza o HTML extraído de arquivos Office (docx/mammoth, xlsx/SheetJS) antes
// de renderizar via set:html. Fonte é não-confiável (docs editados via PR/fork),
// então removemos atributos perigosos (onerror, data-v com breakout), schemes
// javascript:/data: em links, etc. — allow-list só do que de fato renderizamos.
const sanitizeHtml = require('sanitize-html') as typeof import('sanitize-html')

const TABLE_TAGS = ['table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'colgroup', 'col']
const TEXT_TAGS = ['p', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'ul', 'ol', 'li',
  'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div', 'blockquote', 'pre', 'code']
const CELL_ATTRS = { td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan'] }

// docx (mammoth): permite formatação, links e imagens — com schemes seguros.
const DOCX_OPTS: import('sanitize-html').IOptions = {
  allowedTags: [...TABLE_TAGS, ...TEXT_TAGS, 'a', 'img'],
  allowedAttributes: { ...CELL_ATTRS, a: ['href'], img: ['src', 'alt'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
}
// xlsx (SheetJS): célula é texto puro. Sem <a>/<img> — assim qualquer breakout de
// atributo (ex.: data-v="...">​<img onerror>) é descartado, não vira elemento inerte.
const XLSX_OPTS: import('sanitize-html').IOptions = {
  allowedTags: [...TABLE_TAGS, ...TEXT_TAGS],
  allowedAttributes: { ...CELL_ATTRS },
}

const cleanDocx = (html: string): string => sanitizeHtml(html, DOCX_OPTS)
const cleanXlsx = (html: string): string => sanitizeHtml(html, XLSX_OPTS)

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
  return cleanDocx(value)
}

export async function extractXlsxHtml (absPath: string): Promise<string> {
  const XLSX = require('xlsx') as typeof import('xlsx')
  const wb = XLSX.readFile(absPath)
  const first = wb.SheetNames[0]
  return cleanXlsx(XLSX.utils.sheet_to_html(wb.Sheets[first]))
}
