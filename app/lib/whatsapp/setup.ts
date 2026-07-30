export const META_DEVELOPER_URL = "https://developers.facebook.com";
export const META_BUSINESS_URL = "https://business.facebook.com";
export const WHATSAPP_MANAGER_URL = "https://business.facebook.com/wa/manage";

export const PERMISSIONS = [
  "whatsapp_business_messaging",
  "whatsapp_business_management",
  "business_management",
] as const;

export function getSystemUserConfig() {
  return {
    createUrl: "https://business.facebook.com/settings/system-users",
    tokenUrl: `https://developers.facebook.com/apps/${process.env.SHOPIFY_API_KEY || "{{APP_ID}}"}/whatsapp-business`,
    scopes: PERMISSIONS,
  };
}

export function getAppConfig() {
  return {
    appId: process.env.SHOPIFY_API_KEY || "",
    appSecret: process.env.SHOPIFY_API_SECRET || "",
    webhookUrl: `${process.env.SHOPIFY_APP_URL || "https://{{APP_URL}}"}/webhooks/whatsapp`,
    verifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "",
  };
}

export function getSetupSteps() {
  const appConfig = getAppConfig();
  return [
    {
      step: 1,
      title: "Meta Business Account",
      description: "Create or use existing Meta Business Account at business.facebook.com",
      action: `${META_BUSINESS_URL}/overview`,
      verifiedBy: "Business ID in Meta Business Settings",
    },
    {
      step: 2,
      title: "WhatsApp Business Account (WABA)",
      description: "Create WABA within your Meta Business Account",
      action: WHATSAPP_MANAGER_URL,
      verifiedBy: "WABA ID (set as WHATSAPP_BUSINESS_ACCOUNT_ID)",
    },
    {
      step: 3,
      title: "Phone Number",
      description: "Add and verify a phone number in WABA (SMS/voice code)",
      action: "Add number in WhatsApp Manager > Phone Numbers",
      verifiedBy: "Phone number shows as 'Connected'",
    },
    {
      step: 4,
      title: "System User & Access Token",
      description: "Create System User in Meta Business Settings, assign WABA permissions, generate token",
      action: "https://business.facebook.com/settings/system-users",
      verifiedBy: "Permanent token set as WHATSAPP_ACCESS_TOKEN",
    },
    {
      step: 5,
      title: "Webhook Setup",
      description: "Configure webhook in Meta App Dashboard: set callback URL and verify token",
      action: `${META_DEVELOPER_URL}/apps/${appConfig.appId}/webhooks/`,
      fields: ["messages", "message_template_status_update", "message_template_quality_update"],
      verifiedBy: "Webhook shows 'Active' with green checkmark",
    },
    {
      step: 6,
      title: "WhatsApp Business Profile",
      description: "Set business name, description, email, website, and profile picture",
      action: "POST to WhatsApp Business Profile API or set in WhatsApp Manager",
      verifiedBy: "Business profile visible to customers",
    },
    {
      step: 7,
      title: "Message Templates",
      description: "Create and submit message templates for approval (required for proactive messaging)",
      action: `${WHATSAPP_MANAGER_URL}/message-templates`,
      verifiedBy: "Templates show 'Approved' status",
    },
  ];
}
