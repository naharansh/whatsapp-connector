import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { handleOrderWebhook } from "../lib/whatsapp/order-handler.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  console.log(`[webhook] Received ${topic} for ${shop}`);
  const result = await handleOrderWebhook(shop, "order/cancelled", payload);
  console.log(`[webhook] Result for ${topic}:`, result);
  return new Response(null, { status: 200 });
};
