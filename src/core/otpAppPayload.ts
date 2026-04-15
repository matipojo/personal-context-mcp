import { OTP_SETUP_APP_RESOURCE_URI } from './mcpAppUris.js';

export const OTP_SETUP_APP_ID = 'personal-mcp/otp-setup' as const;

export type OtpSetupAppPayload = {
  app: typeof OTP_SETUP_APP_ID;
  v: 1;
  /** Short text for the model and duplicated in structured content for the app. */
  summary: string;
  secret: string;
  backupCodes: string[];
  qrPngBase64: string;
  issuer: string;
  label: string;
  digits: number;
  period: number;
  /** Same URI as tool metadata; lets clients correlate without importing server paths. */
  resourceUri: typeof OTP_SETUP_APP_RESOURCE_URI;
};
