import type { ActionFunctionArgs } from "react-router";
import { authenticate, unauthenticated } from "../shopify.server";
import { handleOrderWebhook } from "../lib/whatsapp/order-handler.server";

const ORDER_QUERY = `#graphql
  query GetOrder($id: ID!) {
    order(id: $id) {
      id
      name
      number
      customer {
        firstName
        lastName
        phone
        email
      }
      billingAddress {
        phone
      }
      shippingAddress {
        phone
      }
      totalPrice
      currencyCode
      displayFinancialStatus
      displayFulfillmentStatus
      createdAt
      cancelledAt
      note
    }
  }
`;

function mapGraphQLOrder(order: Record<string, any>): Record<string, any> {
  return {
    id: order.id,
    name: order.name,
    order_number: order.number,
    customer: order.customer
      ? {
          id: order.customer.id,
          first_name: order.customer.firstName,
          last_name: order.customer.lastName,
          phone: order.customer.phone,
          email: order.customer.email,
        }
      : undefined,
    billing_address: order.billingAddress
      ? { phone: order.billingAddress.phone }
      : undefined,
    shipping_address: order.shippingAddress
      ? { phone: order.shippingAddress.phone }
      : undefined,
    total_price: order.totalPrice,
    currency: order.currencyCode,
    financial_status: order.displayFinancialStatus,
    fulfillment_status: order.displayFulfillmentStatus,
    created_at: order.createdAt,
    cancelled_at: order.cancelledAt,
    note: order.note,
  };
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  console.log(`[webhook] Received ${topic} for ${shop}`);

  const refundPayload = payload as Record<string, any>;
  const orderId = refundPayload.order_id;

  try {
    const { admin } = await unauthenticated.admin(shop);
    const response = await admin.graphql(ORDER_QUERY, {
      variables: { id: `gid://shopify/Order/${orderId}` },
    });

    const json = await response.json();
    const order = json.data?.order;

    if (!order) {
      console.log(`[webhook] Order ${orderId} not found for ${shop}`);
      return new Response(null, { status: 200 });
    }

    const orderPayload = mapGraphQLOrder(order);
    const result = await handleOrderWebhook(shop, "order/refunded", orderPayload);
    console.log(`[webhook] Result for ${topic}:`, result);

    if (!result.sent && result.error) {
      const currentNote = order.note || "";
      const newNote = currentNote
        ? `${currentNote}\n[WhatsApp] ${result.error}`
        : `[WhatsApp] ${result.error}`;

      await admin.graphql(
        `#graphql
        mutation orderUpdate($input: OrderInput!) {
          orderUpdate(input: $input) {
            userErrors { field message }
          }
        }`,
        { variables: { input: { id: `gid://shopify/Order/${orderId}`, note: newNote } } }
      );
      console.log(`[webhook] Updated order ${orderId} note with WhatsApp error`);
    }
  } catch (error) {
    console.log(`[webhook] Error fetching order ${orderId} for ${shop}:`, error);
  }

  return new Response(null, { status: 200 });
};
