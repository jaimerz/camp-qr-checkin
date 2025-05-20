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
    // Use participant.id as QR code data
    return await generateQRCode(participant.id);
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
  
  // Define dimensions
  const margin = 10;
  const qrCodeSize = 50;
  const badgeWidth = 85;
  const badgeHeight = 55;
  const columns = 2;
  const rows = 5;
  
  let currentPage = 1;
  let x = margin;
  let y = margin;
  
  // Draw border for first page
  doc.setDrawColor(200);
  doc.rect(5, 5, pageWidth - 10, pageHeight - 10);
  
  for (let i = 0; i < participants.length; i++) {
    const participant = participants[i];
    
    // Generate QR code data URL
    const qrCodeDataUrl = await generateParticipantQRCode(participant);
    
    // Calculate position
    if (i > 0 && i % (columns * rows) === 0) {
      // Add new page
      doc.addPage();
      currentPage++;
      x = margin;
      y = margin;
      
      // Draw border for new page
      doc.setDrawColor(200);
      doc.rect(5, 5, pageWidth - 10, pageHeight - 10);
    } else if (i > 0 && i % columns === 0) {
      // New row
      x = margin;
      y += badgeHeight;
    }
    
    // Draw badge rectangle
    doc.setDrawColor(100);
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(x, y, badgeWidth, badgeHeight, 3, 3, 'FD');
    
    // Add QR code
    doc.addImage(qrCodeDataUrl, 'PNG', x + 5, y + 5, qrCodeSize, qrCodeSize);
    
    // Add participant name
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(participant.name, x + 5, y + qrCodeSize + 10);
    
    // Add church name
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(participant.church, x + 5, y + qrCodeSize + 15);
    
    // Add participant type (student/leader)
    doc.setFontSize(8);
    doc.text(`Type: ${participant.type}`, x + 5, y + qrCodeSize + 20);
    
    // Move to next column
    x += badgeWidth;
  }
  
  return doc.output('blob');
}