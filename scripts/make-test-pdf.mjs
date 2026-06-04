// scripts/make-test-pdf.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { PDFDocument, StandardFonts } from 'pdf-lib'

mkdirSync('docs/test', { recursive: true })
const pdf = await PDFDocument.create()
const font = await pdf.embedFont(StandardFonts.Helvetica)
const page = pdf.addPage([595, 842])
page.drawText('Documento PDF de teste — Mintly Docs', { x: 50, y: 780, size: 18, font })
page.drawText('Este texto deve ser indexavel pela busca full-text (Pagefind).', { x: 50, y: 750, size: 12, font })
writeFileSync('docs/test/exemplo.pdf', await pdf.save())
console.log('[make-test-pdf] gerado docs/test/exemplo.pdf')
