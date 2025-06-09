export type QRCodePDFOptions = {
  pageSize: 'a4' | 'letter';
  qrColor: string;
  showName: boolean;
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
