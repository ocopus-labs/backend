export interface UpiSettings {
  enabled: boolean;
  vpa: string;
  merchantName: string;
}

export const DEFAULT_UPI_SETTINGS: UpiSettings = {
  enabled: false,
  vpa: '',
  merchantName: '',
};

export interface QrCodeResult {
  dataUrl: string;
  upiString: string;
}
