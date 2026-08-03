import { createHmac } from "node:crypto";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";

type WhatsAppWebhookPayload = {
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        messaging_product?: string;
        metadata?: {
          display_phone_number?: string;
          phone_number_id?: string;
        };
        statuses?: Array<{
          id?: string;
          status?: string;
          recipient_id?: string;
          timestamp?: string;
          errors?: Array<{ code?: number; title?: string; message?: string }>;
        }>;
        messages?: Array<{
          from?: string;
          id?: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
        }>;
      };
    }>;
  }>;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !token || !challenge) {
    return new Response("Forbidden", { status: 403 });
  }

  const knownTokens = new Set<string>();
  if (process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    knownTokens.add(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN);
  }
  const configs = await prisma.whatsAppConfig.findMany();
  for (const config of configs) {
    knownTokens.add(config.webhookVerifyToken);
  }

  if (!knownTokens.has(token)) {
    return new Response("Forbidden", { status: 403 });
  }

  return new Response(challenge, { status: 200 });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const raw = await request.text();

  const signature = request.headers.get("X-Hub-Signature-256");
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (secret && signature) {
    const expected = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
    if (signature !== expected) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  let payload: WhatsAppWebhookPayload;
  try {
    payload = JSON.parse(raw) as WhatsAppWebhookPayload;
  } catch {
    return new Response(null, { status: 200 });
  }

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) continue;

      for (const status of value.statuses ?? []) {
        if (status.status === "failed" && status.errors?.length) {
          for (const error of status.errors) {
            console.error(
              `[whatsapp-webhook] Delivery failed for ${status.recipient_id}: (${error.code}) ${error.title ?? ""} ${error.message ?? ""}`
                .trimEnd()
            );
          }
        } else {
          console.log(`[whatsapp-webhook] Message ${status.status} for ${status.recipient_id}`);
        }
      }

      for (const message of value.messages ?? []) {
        console.log(`[whatsapp-webhook] Inbound ${message.type ?? "unknown"} message from ${message.from ?? "unknown"}`);
      }
    }
  }

  return new Response(null, { status: 200 });
};
