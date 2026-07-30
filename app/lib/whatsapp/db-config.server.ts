import prisma from "../../db.server";

export type WhatsAppConfigData = {
  phoneNumberId: string;
  accessToken: string;
  apiVersion: string;
  businessAccountId: string;
  webhookVerifyToken: string;
  webhookSecret?: string;
};

export async function getWhatsAppConfig(shop: string) {
  const config = await prisma.whatsAppConfig.findUnique({ where: { shop } });
  if (!config) return null;
  return {
    phoneNumberId: config.phoneNumberId,
    accessToken: config.accessToken,
    apiVersion: config.apiVersion,
    businessAccountId: config.businessAccountId,
    webhookVerifyToken: config.webhookVerifyToken,
    webhookSecret: config.webhookSecret ?? undefined,
    get apiBaseUrl() {
      return `https://graph.facebook.com/${config.apiVersion}`;
    },
  };
}

export async function saveWhatsAppConfig(shop: string, data: WhatsAppConfigData) {
  return prisma.whatsAppConfig.upsert({
    where: { shop },
    create: { shop, ...data },
    update: data,
  });
}

export async function deleteWhatsAppConfig(shop: string) {
  return prisma.whatsAppConfig.delete({ where: { shop } }).catch(() => null);
}

export function configFromEnv(): WhatsAppConfigData | null {
  const required = [
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_BUSINESS_ACCOUNT_ID",
    "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
  ] as const;

  for (const key of required) {
    if (!process.env[key]) return null;
  }

  return {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
    apiVersion: process.env.WHATSAPP_API_VERSION || "v22.0",
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID!,
    webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN!,
    webhookSecret: process.env.WHATSAPP_WEBHOOK_SECRET,
  };
}
