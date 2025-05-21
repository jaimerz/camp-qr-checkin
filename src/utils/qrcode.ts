import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { Participant } from '../types';

// Generate QR code as a data URL
export async function generateQRCode(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
}

// Generate QR code for a participant
export async function generateParticipantQRCode(participant: Participant): Promise<string> {
  try {
    // Use participant.qrCode instead of participant.id
    return await generateQRCode(participant.qrCode);
  } catch (error) {
    console.error('Error generating participant QR code:', error);
    throw error;
  }
}

// Generate PDF with QR codes for all participants
export async function generateQRCodePDF(participants: Participant[]): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Layout config
  const badgeWidth = 65;
  const badgeHeight = 70;
  const qrSize = 35;
  const columns = 3;
  const rows = 4;
  const marginX = 10;
  const marginY = 10;
  const spacingX = (pageWidth - marginX * 2 - badgeWidth * columns) / (columns - 1);
  const spacingY = 5;

  let col = 0;
  let row = 0;

  for (let i = 0; i < participants.length; i++) {
    const p = participants[i];
    const qrDataUrl = await generateParticipantQRCode(p);

    if (i > 0 && i % (columns * rows) === 0) {
      doc.addPage();
      col = 0;
      row = 0;
    }

    const x = marginX + col * (badgeWidth + spacingX);
    const y = marginY + row * (badgeHeight + spacingY);
    const centerX = x + badgeWidth / 2;

    // Badge background
    doc.setDrawColor(180);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, badgeWidth, badgeHeight, 3, 3, 'FD');

    let cursorY = y + 8;

    // QR Code (centered)
    doc.addImage(qrDataUrl, 'PNG', centerX - qrSize / 2, cursorY, qrSize, qrSize);
    cursorY += qrSize + 6;

    // Participant name
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'bold');
    doc.text(p.name, centerX, cursorY, { align: 'center' });
    cursorY += 8;

    // Church
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(p.church, centerX, cursorY, { align: 'center' });
    cursorY += 8;

    // Type
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 51, 102); // navy blue
    doc.text(p.type.charAt(0).toUpperCase() + p.type.slice(1), centerX, cursorY, { align: 'center' });

    col++;
    if (col === columns) {
      col = 0;
      row++;
    }
  }

  return doc.output('blob');
}
