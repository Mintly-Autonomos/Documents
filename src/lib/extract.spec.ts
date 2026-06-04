import { describe, it, expect } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { extractDocxHtml, extractXlsxHtml, extractPdfText } from './extract'

const dir = mkdtempSync(join(tmpdir(), 'extract-'))

describe('extract', () => {
  it('docx -> html contendo o texto', async () => {
    const { Document, Packer, Paragraph, TextRun } = await import('docx')
    const doc = new Document({ sections: [{ children: [new Paragraph({ children: [new TextRun('OlaDocx')] })] }] })
    const p = join(dir, 'a.docx'); writeFileSync(p, await Packer.toBuffer(doc))
    const html = await extractDocxHtml(p)
    expect(html).toContain('OlaDocx')
  })

  it('xlsx -> html de tabela contendo os valores', async () => {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('S')
    ws.addRow(['CabA', 'CabB']); ws.addRow(['v1', 'v2'])
    const p = join(dir, 'a.xlsx'); writeFileSync(p, Buffer.from(await wb.xlsx.writeBuffer()))
    const html = await extractXlsxHtml(p)
    expect(html).toContain('<table')
    expect(html).toContain('CabA')
    expect(html).toContain('v2')
  })

  it('docx -> sanitiza link javascript: (XSS)', async () => {
    const { Document, Packer, Paragraph, TextRun, ExternalHyperlink } = await import('docx')
    const doc = new Document({ sections: [{ children: [new Paragraph({ children: [
      new ExternalHyperlink({ children: [new TextRun('clique')], link: 'javascript:alert(1)' }),
    ] })] }] })
    const p = join(dir, 'xss.docx'); writeFileSync(p, await Packer.toBuffer(doc))
    const html = await extractDocxHtml(p)
    expect(html).not.toContain('javascript:')
  })

  it('xlsx -> sanitiza breakout de atributo (XSS)', async () => {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('S')
    ws.addRow(['a"><img src=x onerror=alert(1)>'])
    const p = join(dir, 'xss.xlsx'); writeFileSync(p, Buffer.from(await wb.xlsx.writeBuffer()))
    const html = await extractXlsxHtml(p)
    // o breakout de atributo do SheetJS viraria um <img onerror> ao vivo; sanitizado,
    // nenhum elemento <img> é criado (o payload sobra só como texto escapado inerte).
    expect(html).not.toMatch(/<img/i)
  })

  it('pdf -> texto contendo o conteudo', async () => {
    const { PDFDocument, StandardFonts } = await import('pdf-lib')
    const pdf = await PDFDocument.create(); const font = await pdf.embedFont(StandardFonts.Helvetica)
    pdf.addPage().drawText('TextoPdf123', { x: 50, y: 700, size: 14, font })
    const p = join(dir, 'a.pdf'); writeFileSync(p, await pdf.save())
    const text = await extractPdfText(p)
    expect(text).toContain('TextoPdf123')
  })
})
