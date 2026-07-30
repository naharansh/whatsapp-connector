import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getWhatsAppConfig, saveWhatsAppConfig, configFromEnv } from "../lib/whatsapp/db-config.server";
import { createWhatsAppClient } from "../lib/whatsapp/client";
import { getSetupSteps } from "../lib/whatsapp/setup";
import type { WhatsAppConfigData } from "../lib/whatsapp/db-config.server";

type LoaderData = {
  config: WhatsAppConfigData | null;
  envConfig: WhatsAppConfigData | null;
  steps: ReturnType<typeof getSetupSteps>;
  appUrl: string;
};

export const loader = async ({ request }: LoaderFunctionArgs): Promise<LoaderData> => {
  const { session } = await authenticate.admin(request);
  const config = await getWhatsAppConfig(session.shop);
  const envConfig = configFromEnv();
  const steps = getSetupSteps();

  return {
    config,
    envConfig,
    steps,
    appUrl: process.env.SHOPIFY_APP_URL || "",
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "save") {
    const data: WhatsAppConfigData = {
      phoneNumberId: formData.get("phoneNumberId") as string,
      accessToken: formData.get("accessToken") as string,
      apiVersion: (formData.get("apiVersion") as string) || "v22.0",
      businessAccountId: formData.get("businessAccountId") as string,
      webhookVerifyToken: formData.get("webhookVerifyToken") as string,
      webhookSecret: (formData.get("webhookSecret") as string) || undefined,
    };

    const fieldErrors: Record<string, string> = {};
    if (!data.phoneNumberId) fieldErrors.phoneNumberId = "Phone Number ID is required";
    if (!data.accessToken) fieldErrors.accessToken = "Access Token is required";
    if (!data.businessAccountId) fieldErrors.businessAccountId = "Business Account ID is required";
    if (!data.webhookVerifyToken) fieldErrors.webhookVerifyToken = "Webhook Verify Token is required";

    if (Object.keys(fieldErrors).length > 0) {
      return { ok: false, fieldErrors };
    }

    await saveWhatsAppConfig(shop, data);
    return { ok: true };
  }

  if (intent === "test") {
    const config = (await getWhatsAppConfig(shop)) ?? configFromEnv();
    if (!config) {
      return { ok: false, error: "No WhatsApp configuration found" };
    }

    const phone = formData.get("phone") as string;
    if (!phone) {
      return { ok: false, fieldErrors: { phone: "Phone number is required" } };
    }

    try {
      const client = createWhatsAppClient(config);
      const result = await client.sendText(phone, "WhatsApp is connected \u2705");
      return { ok: true, messageId: result.messages[0]?.id };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }

  return { ok: false, error: "Unknown intent" };
};

export default function WhatsAppPage() {
  const { config, envConfig, steps, appUrl } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const isLoading = fetcher.state !== "idle";
  const result = fetcher.data as { ok: boolean; error?: string; fieldErrors?: Record<string, string>; messageId?: string } | undefined;
  const existing = config ?? envConfig;

  const handleSave = () => {
    const form = document.getElementById("whatsapp-config-form") as HTMLFormElement;
    if (form) {
      fetcher.submit(new FormData(form), { method: "POST" });
    }
  };

  const handleTest = () => {
    const form = document.getElementById("whatsapp-test-form") as HTMLFormElement;
    if (form) {
      fetcher.submit(new FormData(form), { method: "POST" });
    }
  };

  return (
    <s-page heading="WhatsApp Settings">
      <s-section heading="WhatsApp Cloud API Configuration">
        <s-paragraph>
          Enter your Meta WhatsApp Business API credentials below. Values are stored per shop.
        </s-paragraph>

        <form id="whatsapp-config-form" method="POST">
          <input type="hidden" name="intent" value="save" />

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="base">
              <s-section heading="Phone Number ID">
                <input
                  name="phoneNumberId"
                  defaultValue={existing?.phoneNumberId ?? ""}
                  placeholder="From WhatsApp Business Account"
                  required
                  style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #ccc" }}
                />
                {result?.fieldErrors?.phoneNumberId && (
                  <div style={{ color: "#b71c1c", fontSize: "12px", marginTop: "4px" }}>{result.fieldErrors.phoneNumberId}</div>
                )}
              </s-section>

              <s-section heading="Access Token">
                <input
                  name="accessToken"
                  defaultValue={existing?.accessToken ?? ""}
                  placeholder="Permanent system user token"
                  type="password"
                  required
                  style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #ccc" }}
                />
                {result?.fieldErrors?.accessToken && (
                  <div style={{ color: "#b71c1c", fontSize: "12px", marginTop: "4px" }}>{result.fieldErrors.accessToken}</div>
                )}
              </s-section>

              <s-section heading="API Version">
                <input
                  name="apiVersion"
                  defaultValue={existing?.apiVersion ?? "v22.0"}
                  placeholder="v22.0"
                  style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #ccc" }}
                />
              </s-section>

              <s-section heading="Business Account ID (WABA)">
                <input
                  name="businessAccountId"
                  defaultValue={existing?.businessAccountId ?? ""}
                  placeholder="WABA ID"
                  required
                  style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #ccc" }}
                />
                {result?.fieldErrors?.businessAccountId && (
                  <div style={{ color: "#b71c1c", fontSize: "12px", marginTop: "4px" }}>{result.fieldErrors.businessAccountId}</div>
                )}
              </s-section>

              <s-section heading="Webhook Verify Token">
                <input
                  name="webhookVerifyToken"
                  defaultValue={existing?.webhookVerifyToken ?? ""}
                  placeholder="Custom token for webhook verification"
                  required
                  style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #ccc" }}
                />
                {result?.fieldErrors?.webhookVerifyToken && (
                  <div style={{ color: "#b71c1c", fontSize: "12px", marginTop: "4px" }}>{result.fieldErrors.webhookVerifyToken}</div>
                )}
              </s-section>

              <s-section heading="Webhook Secret (optional)">
                <input
                  name="webhookSecret"
                  defaultValue={existing?.webhookSecret ?? ""}
                  placeholder="App secret for payload verification"
                  type="password"
                  style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #ccc" }}
                />
              </s-section>
            </s-stack>
          </s-box>

          <s-button onClick={handleSave} loading={isLoading} disabled={isLoading}>
            {config ? "Update Configuration" : "Save Configuration"}
          </s-button>
        </form>

        {result?.ok && !result.messageId && (
          <s-paragraph>Configuration saved!</s-paragraph>
        )}
        {result?.error && (
          <s-paragraph>{result.error}</s-paragraph>
        )}
      </s-section>

      {existing && (
        <s-section heading="Test Connection">
          <form id="whatsapp-test-form" method="POST">
            <input type="hidden" name="intent" value="test" />
            <s-paragraph>Send a test message to verify your connection.</s-paragraph>
            <s-stack direction="inline" gap="base">
              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <input
                  name="phone"
                  placeholder="Phone (e.g. 15551234567)"
                  style={{ padding: "8px", borderRadius: "8px", border: "1px solid #ccc" }}
                />
                {result?.fieldErrors?.phone && (
                  <div style={{ color: "#b71c1c", fontSize: "12px", marginTop: "4px" }}>{result.fieldErrors.phone}</div>
                )}
                {result?.error && (
                  <div style={{ color: "#b71c1c", fontSize: "12px", marginTop: "4px" }}>{result.error}</div>
                )}
              </div>
              <s-button onClick={handleTest} loading={isLoading} disabled={isLoading}>
                Send test
              </s-button>
            </s-stack>
          </form>
          {result?.messageId && (
            <s-paragraph>Test message sent! ID: {result.messageId}</s-paragraph>
          )}
        </s-section>
      )}

      <s-section heading="Webhook URL">
        <s-paragraph>Configure this URL in your Meta App Dashboard:</s-paragraph>
        <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
          <s-text>{appUrl || "Set SHOPIFY_APP_URL env var"}/webhooks/whatsapp</s-text>
        </s-box>
      </s-section>

      <s-section heading="Setup Checklist">
        {steps.map((step) => (
          <s-box key={step.step} padding="base" borderWidth="base" borderRadius="base">
            <s-text>Step {step.step}: {step.title}</s-text>
            <s-paragraph>{step.description}</s-paragraph>
            <s-paragraph>{step.verifiedBy}</s-paragraph>
          </s-box>
        ))}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
