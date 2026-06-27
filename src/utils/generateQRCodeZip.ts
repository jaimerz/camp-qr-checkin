import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import QRCode from 'qrcode';
import { Participant } from '../types';
import { QRCodeZipOptions } from './types';

type QRCodeZipExportNames = Record<string, string>;

const MIN_NAME_FONT_SIZE = 12;
const MAX_NAME_LINES = 3;
const LABEL_TOP_SPACING = 14;
const CANVAS_PADDING = 18;
const LINE_HEIGHT_MULTIPLIER = 1.15;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load QR image'));
    image.src = src;
  });
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const lines: string[] = [];
  let currentLine = words[0];

  for (let index = 1; index < words.length; index++) {
    const word = words[index];
    const candidate = `${currentLine} ${word}`;

    if (context.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  lines.push(currentLine);
  return lines;
}

function fitTextLines(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  desiredFontSize: number
): { lines: string[]; fontSize: number } {
  let fontSize = Math.max(MIN_NAME_FONT_SIZE, Math.floor(desiredFontSize));

  while (fontSize >= MIN_NAME_FONT_SIZE) {
    context.font = `600 ${fontSize}px Arial, sans-serif`;
    const lines = wrapText(context, text, maxWidth);

    if (lines.length <= MAX_NAME_LINES) {
      return { lines, fontSize };
    }

    fontSize -= 1;
  }

  context.font = `600 ${MIN_NAME_FONT_SIZE}px Arial, sans-serif`;
  const lines = wrapText(context, text, maxWidth).slice(0, MAX_NAME_LINES);

  if (lines.length > 0) {
    const lastIndex = lines.length - 1;
    let lastLine = lines[lastIndex];

    while (context.measureText(`${lastLine}…`).width > maxWidth && lastLine.length > 0) {
      lastLine = lastLine.slice(0, -1);
    }

    lines[lastIndex] = `${lastLine}…`;
  }

  return { lines, fontSize: MIN_NAME_FONT_SIZE };
}

async function createCompositeQrImageDataUrl(
  qrCode: string,
  exportName: string,
  options: QRCodeZipOptions
): Promise<string> {
  const qrDataUrl = await QRCode.toDataURL(qrCode, {
    width: options.size,
    margin: 1,
    color: {
      dark: options.qrColor,
      light: options.background === 'transparent' ? undefined : '#FFFFFF',
    },
  });

  const qrImage = await loadImage(qrDataUrl);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas context is not available');
  }

  const labelWidth = options.size;
  const fittedText = fitTextLines(context, exportName, labelWidth, options.nameSize);
  const lineHeight = fittedText.fontSize * LINE_HEIGHT_MULTIPLIER;
  const textBlockHeight = Math.max(lineHeight, fittedText.lines.length * lineHeight);

  canvas.width = options.size + CANVAS_PADDING * 2;
  canvas.height = options.size + LABEL_TOP_SPACING + textBlockHeight + CANVAS_PADDING * 2;

  if (options.background !== 'transparent') {
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  const qrX = (canvas.width - options.size) / 2;
  context.drawImage(qrImage, qrX, CANVAS_PADDING, options.size, options.size);

  context.fillStyle = options.nameColor;
  context.textAlign = 'center';
  context.textBaseline = 'top';
  context.font = `600 ${fittedText.fontSize}px Arial, sans-serif`;

  const textCenterX = canvas.width / 2;
  const textStartY = CANVAS_PADDING + options.size + LABEL_TOP_SPACING;

  fittedText.lines.forEach((line, index) => {
    context.fillText(line, textCenterX, textStartY + index * lineHeight);
  });

  return canvas.toDataURL('image/png');
}

export async function generateQRCodeZip(
  participants: Participant[],
  options: QRCodeZipOptions,
  exportNames: QRCodeZipExportNames = {}
): Promise<void> {
  const zip = new JSZip();

  for (const participant of participants) {
    const exportName = exportNames[participant.id]?.trim() || participant.name;
    const dataUrl = await createCompositeQrImageDataUrl(participant.qrCode, exportName, options);
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    zip.file(`${participant.qrCode}.png`, base64Data, { base64: true });
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, 'qr-codes.zip');
}
