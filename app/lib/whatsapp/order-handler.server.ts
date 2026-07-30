import prisma from "../../db.server";
import { sendTriggerMessage } from "./triggers.server";
import { DEFAULT_MAPPING } from "./trigger-types";

interface OrderPayload {
  id: number;
  name: string;
  order_number: number;
  customer?: {
    id: number;
    first_name?: string;
    last_name?: string;
    phone?: string;
    email?: string;
  };
  billing_address?: {
    phone?: string;
  };
  shipping_address?: {
    phone?: string;
  };
  total_price?: string;
  currency?: string;
  financial_status?: string;
  fulfillment_status?: string;
  created_at?: string;
  cancelled_at?: string | null;
  note?: string | null;
}

function getField(payload: OrderPayload, field: string): string {
  switch (field) {
    case "order_name":
      return payload.name || `#${payload.order_number}`;
    case "order_number":
      return String(payload.order_number);
    case "customer_first_name":
      return payload.customer?.first_name ?? "";
    case "customer_last_name":
      return payload.customer?.last_name ?? "";
    case "customer_phone":
      return payload.customer?.phone ?? "";
    case "customer_email":
      return payload.customer?.email ?? "";
    case "total_price":
      return payload.total_price ?? "";
    case "currency":
      return payload.currency ?? "USD";
    case "total_with_currency":
      return payload.total_price ? `${payload.total_price} ${payload.currency ?? "USD"}` : "0.00 USD";
    case "billing_phone":
      return payload.billing_address?.phone ?? "";
    case "shipping_phone":
      return payload.shipping_address?.phone ?? "";
    case "financial_status":
      return payload.financial_status ?? "";
    case "fulfillment_status":
      return payload.fulfillment_status ?? "";
    default:
      return "";
  }
}

function extractVariables(payload: OrderPayload, mapping: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, field] of Object.entries(mapping)) {
    result[key] = getField(payload, field);
  }
  return result;
}

function getCustomerPhone(payload: OrderPayload | null | undefined): string | null {
  if (!payload) return null;
  return (
    payload.customer?.phone?.replace(/[^0-9+]/g, "") ??
    payload.billing_address?.phone?.replace(/[^0-9+]/g, "") ??
    payload.shipping_address?.phone?.replace(/[^0-9+]/g, "") ??
    null
  );
}

export async function handleOrderWebhook(
  shop: string,
  topic: string,
  payload: unknown
): Promise<{ sent: boolean; error?: string }> {
  const orderPayload = payload as OrderPayload;
  const customerPhone = getCustomerPhone(orderPayload);

  if (!customerPhone) {
    console.log(`[order-handler] No customer phone for order ${orderPayload.name}: skipped`);
    return { sent: false, error: "No customer phone found in order" };
  }

  const trigger = await prisma.whatsAppTrigger.findUnique({
    where: { shop_triggerEvent: { shop, triggerEvent: topic } },
  });

  const savedMapping = trigger?.variableMapping
    ? (JSON.parse(trigger.variableMapping) as Record<string, string>)
    : null;
  const mapping =
    savedMapping && Object.keys(savedMapping).length > 0
      ? savedMapping
      : DEFAULT_MAPPING;

  const variables = extractVariables(orderPayload, mapping);
  console.log(`[order-handler] Sending for order ${orderPayload.name} to phone ${customerPhone}, variables=`, variables);
  return sendTriggerMessage(shop, topic, customerPhone, variables);
}
