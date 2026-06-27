export type QRCodePDFOptions = {
  pageSize: 'a4' | 'letter';
  qrColor: string;
  showChurch: boolean;
  showType: boolean;
  nameColor: string;
  churchColor: string;
  typeColor: string;
  badgeCornerRadius: number;
  marginX: number;
  marginY: number;
  spacingX: number;
  spacingY: number;
  qrSize: number;
};

export type QRCodeZipOptions = {
  qrColor: string;
  background: 'white' | 'transparent';
  size: number;
  nameColor: string;
  nameSize: number;
};
