import { getWhatsAppConfig } from "./config";

export const META_GRAPH_BASE = "https://graph.facebook.com";

export function getGraphApiUrl(): string {
  const config = getWhatsAppConfig();
  return `${META_GRAPH_BASE}/${config.apiVersion}`;
}

export function getWabaSetup() {
  const config = getWhatsAppConfig();
  const baseUrl = `${getGraphApiUrl()}/${config.businessAccountId}`;

  return {
    businessAccountId: config.businessAccountId,
    baseUrl,
    endpoints: {
      phoneNumbers: () => `${getGraphApiUrl()}/${config.phoneNumberId}`,
      phoneNumbersList: () => `${getGraphApiUrl()}/${config.businessAccountId}/phone_numbers`,
      messageTemplates: () => `${getGraphApiUrl()}/${config.businessAccountId}/message_templates`,
      businessProfile: () => `${getGraphApiUrl()}/${config.phoneNumberId}/whatsapp_business_profile`,
      subscribedApps: () => `${getGraphApiUrl()}/${config.businessAccountId}/subscribed_apps`,
      migratePhone: () => `${getGraphApiUrl()}/${config.phoneNumberId}/register`,
      twoStepVerification: () => `${getGraphApiUrl()}/${config.phoneNumberId}/two_step_verification`,
      analytics: () => `${getGraphApiUrl()}/${config.businessAccountId}/analytics`,
    },
  };
}

export const WEBHOOK_FIELDS = [
  "messages",
  "message_template_status_update",
  "message_template_quality_update",
  "account_review_update",
  "account_update",
] as const;

export function getWebhookConfig() {
  const config = getWhatsAppConfig();
  const appUrl = process.env.SHOPIFY_APP_URL || "https://{{APP_URL}}";
  return {
    baseUrl: `${getGraphApiUrl()}/${config.phoneNumberId}`,
    subscriptions: [...WEBHOOK_FIELDS].map((field) => ({
      field,
      webhookUrl: `${appUrl}/webhooks/whatsapp`,
    })),
  };
}

export const BUSINESS_PROFILE_FIELDS = [
  "about",
  "address",
  "description",
  "email",
  "profile_picture_url",
  "websites",
  "vertical",
] as const;
