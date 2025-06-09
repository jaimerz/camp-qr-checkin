import React, { useState } from 'react';
import { defaultQRCodePDFOptions } from '../../utils/pdfConfig';
import { QRCodePDFOptions } from '../../utils/types';
import { generateQRCodePDF } from '../../utils/qrcode';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { saveAs } from 'file-saver';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  participants: Participant[];
};

const DownloadQrModal: React.FC<Props> = ({ isOpen, onClose, participants }) => {
  const [options, setOptions] = useState<QRCodePDFOptions>(defaultQRCodePDFOptions);

  const handleDownload = async () => {
    try {
      const blob = await generateQRCodePDF(participants, options);
      saveAs(blob, 'qr-badges.pdf');
    } catch (err) {
      console.error('Error generating PDF:', err);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Download QR Codes">
      <div className="space-y-4 mt-4">
        {/* PAGE SETTINGS */}
        <div className="grid grid-cols-2 gap-4">
          <label>
            Page Size:
            <select
              value={options.pageSize}
              onChange={(e) => setOptions({ ...options, pageSize: e.target.value as 'a4' | 'letter' })}
              className="w-full border p-1 rounded mt-1"
            >
              <option value="a4">A4</option>
              <option value="letter">Letter</option>
            </select>
          </label>

          <label>
            QR Code Color:
            <input
              type="color"
              value={options.qrColor}
              onChange={(e) => setOptions({ ...options, qrColor: e.target.value })}
              className="w-full border p-1 rounded mt-1"
            />
          </label>
        </div>

        {/* DISPLAY OPTIONS */}
        <div className="space-y-4">
          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={options.showChurch}
                onChange={(e) => setOptions({ ...options, showChurch: e.target.checked })}
              />
              <span>Show Church</span>
            </label>
            {options.showChurch && (
              <input
                type="color"
                value={options.churchColor}
                onChange={(e) => setOptions({ ...options, churchColor: e.target.value })}
                className="mt-1 border rounded"
              />
            )}
          </div>

          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={options.showType}
                onChange={(e) => setOptions({ ...options, showType: e.target.checked })}
              />
              <span>Show Participant Type</span>
            </label>
            {options.showType && (
              <input
                type="color"
                value={options.typeColor}
                onChange={(e) => setOptions({ ...options, typeColor: e.target.value })}
                className="mt-1 border rounded"
              />
            )}
          </div>
        </div>

        {/* OTHER STYLES */}
        <div className="grid grid-cols-2 gap-4">
          <label>
            Corner Radius (mm):
            <input
              type="number"
              value={options.badgeCornerRadius}
              onChange={(e) => setOptions({ ...options, badgeCornerRadius: parseFloat(e.target.value) })}
              className="w-full border p-1 rounded mt-1"
            />
          </label>

          <label>
            QR Code Size (mm):
            <input
              type="number"
              value={options.qrSize}
              onChange={(e) => setOptions({ ...options, qrSize: parseFloat(e.target.value) })}
              className="w-full border p-1 rounded mt-1"
            />
          </label>
        </div>

        <div className="flex justify-end space-x-2 mt-4">
          <Button
            variant="outline"
            onClick={() => setOptions(defaultQRCodePDFOptions)}
          >
            Reset to Defaults
          </Button>
        </div>

        <div className="flex justify-end space-x-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleDownload}>Download PDF</Button>
        </div>
      </div>
    </Modal>
  );
};

export default DownloadQrModal;
