const requiredVars = [
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_API_VERSION",
  "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
  "WHATSAPP_BUSINESS_ACCOUNT_ID",
] as const;

function getEnv(name: string): string | undefined {
  return process.env[name];
}

function requireEnv(name: string): string {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export type WhatsAppConfig = {
  phoneNumberId: string;
  accessToken: string;
  apiVersion: string;
  webhookVerifyToken: string;
  businessAccountId: string;
  webhookSecret: string | undefined;
  apiBaseUrl: string;
};

export function getWhatsAppConfig(): WhatsAppConfig {
  return {
    phoneNumberId: requireEnv("WHATSAPP_PHONE_NUMBER_ID"),
    accessToken: requireEnv("WHATSAPP_ACCESS_TOKEN"),
    apiVersion: getEnv("WHATSAPP_API_VERSION") || "v22.0",
    webhookVerifyToken: requireEnv("WHATSAPP_WEBHOOK_VERIFY_TOKEN"),
    businessAccountId: requireEnv("WHATSAPP_BUSINESS_ACCOUNT_ID"),
    webhookSecret: getEnv("WHATSAPP_WEBHOOK_SECRET"),
    get apiBaseUrl() {
      return `https://graph.facebook.com/${this.apiVersion}`;
    },
  };
}

export function validateWhatsAppConfig(): string[] {
  const missing = requiredVars.filter((name) => !getEnv(name));
  if (missing.length > 0) {
    console.warn(`WhatsApp config incomplete. Missing: ${missing.join(", ")}`);
  }
  return missing;
}
