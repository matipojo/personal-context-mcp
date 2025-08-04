import { ServerContext } from './Context.js';

export const validateOTPSession = (context: ServerContext): void => {
  if (context.otpManager.isEnabled()) {
    if (!context.currentOTPSession || Date.now() > context.currentOTPSession.expires) {
      throw new Error('🔒 OTP verification required. Please use verify_otp tool first to access your data.');
    }
  }
};

export const validateHasListedInfo = (hasListed: boolean): void => {
  if (!hasListed) {
    throw new Error('You must list once all the categories with the list_available_personal_info tool before using this tool');
  }
};

// Safe parsing function that throws descriptive errors
export const safeParse = <T>(schema: any, args: unknown, toolName: string): T => {
  try {
    return schema.parse(args);
  } catch (error) {
    throw new Error(`Invalid arguments for ${toolName}: ${error instanceof Error ? error.message : String(error)}`);
  }
}; 