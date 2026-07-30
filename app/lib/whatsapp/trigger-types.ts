export const TRIGGER_EVENTS = [
  { id: "order/created", label: "Order placed", description: "When a new order is created" },
  { id: "order/fulfilled", label: "Order fulfilled", description: "When an order is fulfilled" },
  { id: "order/cancelled", label: "Order cancelled", description: "When an order is cancelled" },
  { id: "order/refunded", label: "Order refunded", description: "When an order is refunded" },
] as const;

export type TriggerEvent = (typeof TRIGGER_EVENTS)[number]["id"];

export type TriggerData = {
  id: string;
  triggerEvent: string;
  templateName: string;
  languageCode: string;
  enabled: boolean;
  variableMapping: Record<string, string> | null;
  lastError: string | null;
  lastErrorAt: string | null;
};

export const ORDER_FIELDS = [
  { id: "order_name", label: "Order Name" },
  { id: "order_number", label: "Order Number" },
  { id: "customer_first_name", label: "Customer First Name" },
  { id: "customer_last_name", label: "Customer Last Name" },
  { id: "customer_phone", label: "Customer Phone" },
  { id: "customer_email", label: "Customer Email" },
  { id: "total_price", label: "Total Price" },
  { id: "currency", label: "Currency" },
  { id: "total_with_currency", label: "Total with Currency (e.g. 699.95 INR)" },
  { id: "billing_phone", label: "Billing Phone" },
  { id: "shipping_phone", label: "Shipping Phone" },
  { id: "financial_status", label: "Financial Status" },
  { id: "fulfillment_status", label: "Fulfillment Status" },
] as const;

export type OrderFieldId = (typeof ORDER_FIELDS)[number]["id"];

export const DEFAULT_MAPPING: Record<string, string> = {
  "1": "order_name",
  "2": "customer_first_name",
  "3": "total_with_currency",
  "4": "customer_phone",
  "5": "order_name",
};
