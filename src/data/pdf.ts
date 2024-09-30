import { BaseDirectory, readBinaryFile, writeBinaryFile } from '@tauri-apps/api/fs';
import { LineBreaker } from 'css-line-break';
import { PDFDocument, PDFFont, rgb, StandardFonts } from 'pdf-lib';
import { PageOptions, pdfFile } from './storage';
import { resolveText, Variables } from './variables';

function parseColor(color: string) {
  const result = /rgb\((\d+), (\d+), (\d+)\)/g.exec(color);
  return result
    ? {
        r: Number(result[1]) / 255,
        g: Number(result[2]) / 255,
        b: Number(result[3]) / 255,
      }
    : { r: 0, g: 0, b: 0 };
}

function getLines(font: PDFFont, size: number, text: string, maxWidth: number) {
  const breaker = LineBreaker(text, {
    lineBreak: 'strict',
    wordBreak: 'normal',
  });

  const lines: { line: string; req: boolean }[] = [];
  let line = '';

  const width = (line: string) => font.widthOfTextAtSize(line, size);
  const add = (line: string, req: boolean) => lines.push({ line, req });

  while (true) {
    const { done, value } = breaker.next();
    if (done) break;
    let word = value.slice().replaceAll('\n', '');

    if (width(line + word) < maxWidth) {
      line += word;
      if (value.required) {
        console.debug('(1) add', line);
        add(line, true);
        line = '';
      }
    } else {
      console.debug('(2) add', line);
      if (line.trim() !== '') add(line, false);
      line = '';
      // if the word is too long without any break points, allow any spot to have a line break
      while (width(word) > maxWidth) {
        if (line.trim() === '') line = '';
        // try adding characters one by one (binary search would probably be better)
        for (let splitIdx = 0; splitIdx < word.length; splitIdx++) {
          if (width(line + word.slice(0, splitIdx + 1)) > maxWidth) {
            // push the previous part of the word that fit, or the single letter if it's itself too big
            if (line === '') splitIdx = Math.max(splitIdx, 1);
            console.debug('(3) add', line + word.slice(0, splitIdx));
            add(line + word.slice(0, splitIdx), false);
            line = '';
            word = word.slice(splitIdx);
            break;
          }
        }
      }
      if (value.required) {
        console.debug('(4) add', word);
        add(word, true);
      } else line = word;
    }
  }
  if (line !== '') {
    console.debug('(4) add', line);
    add(line, false);
  }
  return lines;
}

async function writePdf(
  path: string,
  pdf: PDFDocument,
  options: PageOptions[],
  variables: Variables,
  info: Record<string, unknown>
) {
  const pages = pdf.getPages();
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const texts = options[i].texts;

    page.setFont(font);
    const { width, height } = page.getSize();

    for (const text of texts) {
      const size = text.fontSize;
      const { r, g, b } = parseColor(text.color);
      const color = rgb(r, g, b);

      const x = text.x * width;
      let y = text.y * height + size;
      const maxWidth = text.width * width;

      const string = resolveText(text.text, variables, info);

      for (const { line } of getLines(font, text.fontSize, string, maxWidth)) {
        let drawX = x;
        if (text.align !== 'Left') {
          const diff = maxWidth - font.widthOfTextAtSize(line, size);
          drawX += text.align === 'Center' ? diff / 2 : diff;
        }
        console.debug('line', line, 'at', drawX, height - y);
        page.drawText(line, {
          x: drawX,
          y: height - y,
          size,
          color,
        });
        y += size * (text.lineSpacing + 1);
      }
    }
  }

  const bytes = await pdf.save();
  await writeBinaryFile(path, bytes, { dir: BaseDirectory.AppLocalData });
}

export function savePdf(
  path: string,
  options: PageOptions[],
  variables: Variables,
  info: Record<string, unknown>
) {
  void readBinaryFile(pdfFile, { dir: BaseDirectory.AppLocalData })
    .then((data) => PDFDocument.load(data))
    .then((pdf) => writePdf(path, pdf, options, variables, info));
}
