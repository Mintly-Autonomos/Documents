// scripts/make-test-office.mjs
// Gera arquivos Office mínimos válidos (OOXML é um zip), usando as libs oficiais de cada formato.
import { writeFileSync, mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'

mkdirSync('docs/test', { recursive: true })

try { execSync('npm ls docx', { stdio: 'ignore' }) } catch {
  execSync('npm i -D docx exceljs pptxgenjs', { stdio: 'inherit' })
}

const { Document, Packer, Paragraph, TextRun } = await import('docx')
const ExcelJS = (await import('exceljs')).default
const PptxGenJS = (await import('pptxgenjs')).default

const doc = new Document({ sections: [{ children: [new Paragraph({ children: [new TextRun('Documento de teste — Mintly Docs')] })] }] })
writeFileSync('docs/test/exemplo.docx', await Packer.toBuffer(doc))

const wb = new ExcelJS.Workbook()
const ws = wb.addWorksheet('Teste')
ws.addRow(['Coluna A', 'Coluna B'])
ws.addRow(['valor 1', 42])
writeFileSync('docs/test/exemplo.xlsx', Buffer.from(await wb.xlsx.writeBuffer()))

const pptx = new PptxGenJS()
pptx.addSlide().addText('Slide de teste — Mintly Docs', { x: 1, y: 1, fontSize: 24 })
await pptx.writeFile({ fileName: 'docs/test/exemplo.pptx' })

console.log('[make-test-office] gerados docx/xlsx/pptx em docs/test/')
