import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { Participant } from '../types';
import { QRCodePDFOptions } from './types'; // You’ll define this next

export async function generateQRCodeImage(text: string, options: { qrColor: string }): Promise<string> {
  return await QRCode.toDataURL(text, {
    width: 300,
    margin: 2,
    color: {
      dark: options.qrColor,
      light: '#FFFFFF',
    },
  });
}

export async function generateQRCodePDF(
  participants: Participant[],
  options: QRCodePDFOptions
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: options.pageSize || 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const {
    marginX,
    marginY,
    spacingX,
    spacingY,
    badgeCornerRadius,
    qrSize,
    showName,
    showChurch,
    showType,
    nameColor,
    churchColor,
    typeColor,
    qrColor,
  } = options;

  // Badge size calculated to fit maximum full badges per page
  const badgeWidth = 60; // Fixed size, could also be passed
  const badgeHeight = 60;

  const columns = Math.floor((pageWidth - 2 * marginX + spacingX) / (badgeWidth + spacingX));
  const rows = Math.floor((pageHeight - 2 * marginY + spacingY) / (badgeHeight + spacingY));

  let col = 0;
  let row = 0;

  // Sort participants
  participants.sort((a, b) => a.church.localeCompare(b.church));

  for (let i = 0; i < participants.length; i++) {
    const p = participants[i];
    const qrDataUrl = await generateQRCodeImage(p.qrCode, { qrColor });

    if (i > 0 && i % (columns * rows) === 0) {
      doc.addPage();
      col = 0;
      row = 0;
    }

    const x = marginX + col * (badgeWidth + spacingX);
    const y = marginY + row * (badgeHeight + spacingY);
    const centerX = x + badgeWidth / 2;

    // Draw badge background
    doc.setDrawColor(180);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, badgeWidth, badgeHeight, badgeCornerRadius, badgeCornerRadius, 'FD');

    let cursorY = y + 8;

    // QR Code
    doc.addImage(qrDataUrl, 'PNG', centerX - qrSize / 2, cursorY, qrSize, qrSize);
    cursorY += qrSize + 6;

    // Name
    if (showName) {
      doc.setFontSize(qrSize * 0.4);
      doc.setTextColor(...hexToRgb(nameColor));
      doc.setFont(undefined, 'bold');
      doc.text(p.name, centerX, cursorY, { align: 'center' });
      cursorY += 7;
    }

    // Church
    if (showChurch) {
      doc.setFontSize(qrSize * 0.3);
      doc.setTextColor(...hexToRgb(churchColor));
      doc.setFont(undefined, 'normal');
      doc.text(p.church, centerX, cursorY, { align: 'center' });
      cursorY += 6;
    }

    // Type
    if (showType) {
      doc.setFontSize(qrSize * 0.33);
      doc.setTextColor(...hexToRgb(typeColor));
      doc.setFont(undefined, 'bold');
      doc.text(capitalize(p.type), centerX, cursorY, { align: 'center' });
    }

    col++;
    if (col === columns) {
      col = 0;
      row++;
    }
  }

  return doc.output('blob');
}

// Helper
function hexToRgb(hex: string): [number, number, number] {
  const bigint = parseInt(hex.replace(/^#/, ''), 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
