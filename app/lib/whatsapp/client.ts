import type { WhatsAppConfigData } from "./db-config.server";

type WhatsAppTextMessage = {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "text";
  text: { preview_url?: boolean; body: string };
};

type WhatsAppTemplateMessage = {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "template";
  template: {
    name: string;
    language: { code: string };
    components?: Array<{
      type: "header" | "body" | "footer" | "buttons";
      parameters: Array<Record<string, unknown>>;
    }>;
  };
};

type WhatsAppMessage = WhatsAppTextMessage | WhatsAppTemplateMessage;

type WhatsAppApiResponse = {
  messaging_product: "whatsapp";
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
};

type WhatsAppErrorResponse = {
  error: {
    message: string;
    type: string;
    code: number;
    fbtrace_id: string;
  };
};

function sendMessage(config: WhatsAppConfigData, message: WhatsAppMessage): Promise<WhatsAppApiResponse> {
  const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;

  return fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  }).then(async (response) => {
    if (!response.ok) {
      const error: WhatsAppErrorResponse = await response.json();
      throw new Error(`WhatsApp API error (${error.error.code}): ${error.error.message}`);
    }
    return response.json();
  });
}

export type WhatsAppClient = {
  sendText(to: string, body: string, previewUrl?: boolean): Promise<WhatsAppApiResponse>;
  sendTemplate(
    to: string,
    templateName: string,
    languageCode?: string,
    components?: WhatsAppTemplateMessage["template"]["components"]
  ): Promise<WhatsAppApiResponse>;
};

export function createWhatsAppClient(config: WhatsAppConfigData): WhatsAppClient {
  return {
    sendText(to: string, body: string, previewUrl = false) {
      return sendMessage(config, {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: previewUrl, body },
      });
    },

    sendTemplate(
      to: string,
      templateName: string,
      languageCode = "en",
      components?: WhatsAppTemplateMessage["template"]["components"]
    ) {
      return sendMessage(config, {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          ...(components ? { components } : {}),
        },
      });
    },
  };
}

export function verifyWebhook(token: string, mode: string | null, signature: string | null, challenge: string | null): string | null {
  if (mode === "subscribe" && signature === token) {
    return challenge;
  }
  return null;
}

export type WhatsAppTemplate = {
  id: string;
  name: string;
  status: "APPROVED" | "PENDING" | "REJECTED" | "PAUSED" | "DISABLED";
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  language: string;
  components?: Array<{
    type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
    text?: string;
    format?: "TEXT" | "IMAGE" | "DOCUMENT" | "VIDEO";
    example?: { body_text?: string[][] };
    buttons?: Array<{
      type: "PHONE_NUMBER" | "URL" | "QUICK_REPLY" | "COPY_CODE" | "VOICE_OTP";
      text?: string;
      url?: string;
      phone_number?: string;
    }>;
  }>;
  headerFormat?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  quality_score?: {
    score: "GREEN" | "YELLOW" | "RED" | "UNKNOWN";
  };
  rejected_reason?: string;
  created_time: string;
};

export type WhatsAppTemplatesResponse = {
  data: WhatsAppTemplate[];
  paging?: {
    cursors: { before: string; after: string };
    next?: string;
  };
};

export async function verifyWabaId(config: WhatsAppConfigData): Promise<{ valid: boolean; name?: string; error?: string }> {
  const url = `https://graph.facebook.com/${config.apiVersion}/${config.businessAccountId}?fields=name`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${config.accessToken}` },
  });

  if (!response.ok) {
    const error: WhatsAppErrorResponse = await response.json();
    if (error.error.code === 100 || error.error.code === 803) {
      return { valid: false, error: `ID ${config.businessAccountId} is not a valid WhatsApp Business Account. Verify your WABA ID.` };
    }
    return { valid: false, error: `WhatsApp API error (${error.error.code}): ${error.error.message}` };
  }

  const data = await response.json();
  return { valid: true, name: data.name };
}

async function apiGet<T>(config: WhatsAppConfigData, path: string): Promise<T> {
  const url = `https://graph.facebook.com/${config.apiVersion}/${path}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${config.accessToken}` },
  });

  if (!response.ok) {
    const error: WhatsAppErrorResponse = await response.json();
    throw new Error(`WhatsApp API error (${error.error.code}): ${error.error.message}`);
  }

  return response.json();
}

export async function getTemplates(config: WhatsAppConfigData): Promise<WhatsAppTemplate[]> {
  const result = await apiGet<WhatsAppTemplatesResponse>(
    config,
    `${config.businessAccountId}/message_templates?fields=id,name,status,category,language,components%7Btype,format,text%7D,rejected_reason,quality_score,created_time`
  );
  const templates = result.data ?? [];
  for (const t of templates) {
    const header = t.components?.find((c) => c.type?.toUpperCase() === "HEADER");
    const fmt = header?.format?.toUpperCase();
    if (fmt === "TEXT" || fmt === "IMAGE" || fmt === "VIDEO" || fmt === "DOCUMENT") {
      t.headerFormat = fmt;
    }
  }
  return templates;
}

export async function getBodyParametersCount(
  config: WhatsAppConfigData,
  templateName: string
): Promise<number> {
  const result = await apiGet<{
    data: Array<{ components?: Array<{ type: string; text?: string }> }>;
  }>(config, `${config.businessAccountId}/message_templates?name=${encodeURIComponent(templateName)}&fields=components`);

  const template = result.data?.[0];
  if (!template) return 0;

  const bodyComponent = template.components?.find((c) => c.type?.toUpperCase() === "BODY");
  if (!bodyComponent?.text) return 0;

  const matches = bodyComponent.text.match(/\{\{\d+\}\}/g);
  return matches ? matches.length : 0;
}

export type TemplateStructure = {
  headerFormat?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  headerVariableCount: number;
  bodyVariableCount: number;
  totalVariableCount: number;
};

export async function getTemplateStructure(
  config: WhatsAppConfigData,
  templateName: string
): Promise<TemplateStructure> {
  const result = await apiGet<{
    data: Array<{ components?: Array<{ type: string; format?: string; text?: string }> }>;
  }>(config, `${config.businessAccountId}/message_templates?name=${encodeURIComponent(templateName)}&fields=components`);

  const template = result.data?.[0];

  let headerFormat: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | undefined;
  let headerVariableCount = 0;
  let bodyVariableCount = 0;

  if (template?.components) {
    for (const comp of template.components) {
      const type = comp.type?.toUpperCase();
      if (type === "HEADER") {
        const fmt = comp.format?.toUpperCase();
        if (fmt === "IMAGE" || fmt === "VIDEO" || fmt === "DOCUMENT" || fmt === "TEXT") {
          headerFormat = fmt as "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
        }
        if (comp.text) {
          const matches = comp.text.match(/\{\{\d+\}\}/g);
          headerVariableCount = matches ? matches.length : 0;
        }
      } else if (type === "BODY" && comp.text) {
        const matches = comp.text.match(/\{\{\d+\}\}/g);
        bodyVariableCount = matches ? matches.length : 0;
      }
    }
  }

  return {
    headerFormat,
    headerVariableCount,
    bodyVariableCount,
    totalVariableCount: headerVariableCount + bodyVariableCount,
  };
}

export type {
  WhatsAppApiResponse,
  WhatsAppTextMessage,
  WhatsAppTemplateMessage,
  WhatsAppErrorResponse,
};
