import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import QRCode from 'qrcode';
import { Participant } from '../types';

type QRCodeZipOptions = {
  qrColor: string;
  background: 'white' | 'transparent';
  size: number; // pixels
};

export async function generateQRCodeZip(
  participants: Participant[],
  options: QRCodeZipOptions
): Promise<void> {
  const zip = new JSZip();

  for (const participant of participants) {
    const qrCode = participant.qrCode;

    const dataUrl = await QRCode.toDataURL(qrCode, {
      width: options.size,
      margin: 1,
      color: {
        dark: options.qrColor,
        light: options.background === 'transparent' ? undefined : '#FFFFFF',
      },
    });

    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    zip.file(`${qrCode}.png`, base64Data, { base64: true });
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, 'qr-codes.zip');
}
