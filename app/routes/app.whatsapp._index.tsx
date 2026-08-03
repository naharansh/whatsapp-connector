import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getWhatsAppConfig, saveWhatsAppConfig, configFromEnv, normalizeApiVersion } from "../lib/whatsapp/db-config.server";
import { createWhatsAppClient, verifyWabaId, getTemplates } from "../lib/whatsapp/client";
import { friendlyWhatsAppError } from "../lib/whatsapp/errors";
import { normalizePhoneNumber } from "../lib/whatsapp/phone";
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
      apiVersion: normalizeApiVersion((formData.get("apiVersion") as string) || "v25.0"),
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
      return { ok: false, intent: "save", fieldErrors };
    }

    await saveWhatsAppConfig(shop, data);
    return { ok: true, intent: "save" };
  }

  if (intent === "templates") {
    const config = (await getWhatsAppConfig(shop)) ?? configFromEnv();
    if (!config) {
      return { ok: true, intent: "templates", templates: [] };
    }
    try {
      const all = await getTemplates(config);
      const templates = all
        .filter((t) => t.status === "APPROVED")
        .map((t) => ({ name: t.name, language: t.language }));
      return { ok: true, intent: "templates", templates };
    } catch (err) {
      console.error("[whatsapp] Failed to load templates:", err);
      return { ok: true, intent: "templates", templates: [] };
    }
  }

  if (intent === "test") {
    const config = (await getWhatsAppConfig(shop)) ?? configFromEnv();
    if (!config) {
      return { ok: false, intent: "test", error: "No WhatsApp configuration found" };
    }

    const phone = normalizePhoneNumber((formData.get("phone") as string) || "");
    if (!phone) {
      return { ok: false, intent: "test", fieldErrors: { phone: "Enter a valid phone number" } };
    }

    const templateName = (formData.get("templateName") as string) || "hello_world";
    const languageCode = (formData.get("languageCode") as string) || "en_US";

    try {
      const verification = await verifyWabaId(config);
      if (!verification.valid) {
        return { ok: false, intent: "test", error: verification.error };
      }

      const client = createWhatsAppClient(config);
      const result = await client.sendTemplate(phone, templateName, languageCode);
      return { ok: true, intent: "test", messageId: result.messages[0]?.id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return { ok: false, intent: "test", error: friendlyWhatsAppError(msg) };
    }
  }

  return { ok: false, error: "Unknown intent" };
};

type ActionResult = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  messageId?: string;
  intent?: string;
  templates?: Array<{ name: string; language: string }>;
};

function Field({
  label,
  hint,
  error,
  children,
  style,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div style={{ ...fieldStyle, ...style }}>
      <label style={labelStyle}>{label}</label>
      {hint && <div style={hintStyle}>{hint}</div>}
      {children}
      {error && <div style={errorStyle}>{error}</div>}
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div style={cardStyle}>
      <div style={cardHeaderStyle}>
        <h2 style={cardTitleStyle}>{title}</h2>
        {subtitle && <p style={cardSubtitleStyle}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function StatusPill({ config, envConfig }: { config: WhatsAppConfigData | null; envConfig: WhatsAppConfigData | null }) {
  if (config) {
    return (
      <span style={{ ...pillStyle, backgroundColor: "#e6f7e6", color: "#0d6b0d" }}>
        <span style={pillDotStyle} />
        Configured for this shop
      </span>
    );
  }
  if (envConfig) {
    return (
      <span style={{ ...pillStyle, backgroundColor: "#fff3cd", color: "#8a5a00" }}>
        <span style={{ ...pillDotStyle, backgroundColor: "#e6a817" }} />
        Using environment configuration
      </span>
    );
  }
  return (
    <span style={{ ...pillStyle, backgroundColor: "#f0f0f0", color: "#5c5c5c" }}>
      <span style={{ ...pillDotStyle, backgroundColor: "#9aa0a6" }} />
      Not configured
    </span>
  );
}

export default function WhatsAppPage() {
  const { config, envConfig, steps, appUrl } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const templatesFetcher = useFetcher();
  const [pendingIntent, setPendingIntent] = useState<"save" | "test" | null>(null);
  const isLoading = fetcher.state !== "idle";
  const result = fetcher.data as ActionResult | undefined;
  const existing = config ?? envConfig;

  const saving = pendingIntent === "save";
  const testing = pendingIntent === "test";
  const busy = saving || testing;

  const navigate = useNavigate();

  useEffect(() => {
    if (result?.ok && result?.intent === "save" && !result?.messageId && !isLoading) {
      navigate(`/app/whatsapp/templates${window.location.search}`);
    }
  }, [result, isLoading, navigate]);

  useEffect(() => {
    if (pendingIntent && fetcher.state === "idle") {
      setPendingIntent(null);
    }
  }, [pendingIntent, fetcher.state]);

  const [copied, setCopied] = useState(false);
  const [templates, setTemplates] = useState<Array<{ name: string; language: string }>>([]);

  useEffect(() => {
    if (existing) {
      const formData = new FormData();
      formData.set("intent", "templates");
      templatesFetcher.submit(formData, { method: "POST" });
    }
  }, [existing, templatesFetcher]);

  useEffect(() => {
    const templatesResult = templatesFetcher.data as ActionResult | undefined;
    if (templatesResult?.intent === "templates" && templatesResult.templates) {
      setTemplates(templatesResult.templates);
    }
  }, [templatesFetcher.data]);

  const webhookUrl = `${appUrl || ""}/webhooks/whatsapp`;

  const handleSave = () => {
    setPendingIntent("save");
    const form = document.getElementById("whatsapp-config-form") as HTMLFormElement;
    if (form) {
      fetcher.submit(new FormData(form), { method: "POST" });
    }
  };

  const handleTest = () => {
    setPendingIntent("test");
    const form = document.getElementById("whatsapp-test-form") as HTMLFormElement;
    if (form) {
      fetcher.submit(new FormData(form), { method: "POST" });
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const inputStyleWith = (overrides?: CSSProperties): CSSProperties => ({ ...inputStyle, ...overrides });

  return (
    <s-page heading="WhatsApp Settings">
      <div style={pageStyle}>
        <div style={introStyle}>
          <div>
            <h1 style={introTitleStyle}>Connect Meta WhatsApp Business API</h1>
            <p style={introTextStyle}>
              Enter your Meta WhatsApp Business API credentials below. Values are stored per shop.
            </p>
          </div>
          <StatusPill config={config} envConfig={envConfig} />
        </div>

        <Card title="API Credentials" subtitle="Used to send messages and manage your WhatsApp Business Account.">
          <form id="whatsapp-config-form" method="POST">
            <input type="hidden" name="intent" value="save" />

            <Field label="Phone Number ID" error={result?.fieldErrors?.phoneNumberId}>
              <input
                name="phoneNumberId"
                defaultValue=""
                placeholder="From WhatsApp Business Account"
                required
                style={inputStyle}
              />
            </Field>

            <Field label="Access Token" hint="Permanent system user token" error={result?.fieldErrors?.accessToken}>
              <input
                name="accessToken"
                defaultValue=""
                placeholder="Paste your permanent token"
                type="password"
                autoComplete="off"
                required
                style={inputStyle}
              />
            </Field>

            <div style={rowStyle}>
              <Field label="API Version" style={{ flex: 1 }}>
                <input
                  name="apiVersion"
                  defaultValue="v25.0"
                  placeholder="v25.0"
                  style={inputStyleWith()}
                />
              </Field>
              <Field label="Business Account ID (WABA)" error={result?.fieldErrors?.businessAccountId} style={{ flex: 1.6 }}>
                <input
                  name="businessAccountId"
                  defaultValue=""
                  placeholder="WABA ID"
                  required
                  style={inputStyleWith()}
                />
              </Field>
            </div>

            <Field label="Webhook Verify Token" hint="Custom token for webhook verification" error={result?.fieldErrors?.webhookVerifyToken}>
              <input
                name="webhookVerifyToken"
                defaultValue=""
                placeholder="Set the same token in your Meta App Dashboard"
                required
                style={inputStyle}
              />
            </Field>

            <Field label="Webhook Secret" hint="App secret for payload verification (optional)">
              <input
                name="webhookSecret"
                defaultValue=""
                placeholder="App secret for payload verification"
                type="password"
                autoComplete="off"
                style={inputStyle}
              />
            </Field>

            <button type="button" onClick={handleSave} disabled={busy} style={busy ? { ...saveButtonStyle, opacity: 0.7 } : saveButtonStyle}>
              {saving ? "Saving..." : config ? "Update Configuration" : "Save Configuration"}
            </button>

            {result?.ok && result?.intent === "save" && (
              <div style={successMessageStyle}>Configuration saved successfully.</div>
            )}
            {result?.error && result?.intent === "save" && !result.fieldErrors && (
              <div style={errorStyle}>{result.error}</div>
            )}
          </form>
        </Card>

        {existing && (
          <Card title="Test Connection" subtitle="Sends an approved template to verify your connection. Business-initiated templates work outside the 24-hour window.">
            <form id="whatsapp-test-form" method="POST">
              <input type="hidden" name="intent" value="test" />
              <div style={testRowStyle}>
                <div style={{ flex: 1, minWidth: "220px" }}>
                  <label style={labelStyle} htmlFor="whatsapp-test-phone">Phone number</label>
                  <input
                    id="whatsapp-test-phone"
                    name="phone"
                    placeholder="e.g. 15551234567"
                    style={inputStyleWith({ marginTop: "6px" })}
                  />
                  <label style={{ ...labelStyle, marginTop: "12px" }} htmlFor="whatsapp-test-template">Template</label>
                  <select id="whatsapp-test-template" name="templateName" defaultValue="hello_world" style={inputStyleWith({ marginTop: "6px" })}>
                    <option value="hello_world">hello_world (default test template)</option>
                    {templates.map((t) => (
                      <option key={`${t.name}-${t.language}`} value={t.name}>
                        {t.name} ({t.language})
                      </option>
                    ))}
                  </select>
                  <label style={{ ...labelStyle, marginTop: "12px" }} htmlFor="whatsapp-test-language">Language code</label>
                  <input
                    id="whatsapp-test-language"
                    name="languageCode"
                    defaultValue="en_US"
                    placeholder="en_US"
                    style={inputStyleWith({ marginTop: "6px" })}
                  />
                  {result?.intent === "test" && result?.fieldErrors?.phone && (
                    <div style={{ ...errorStyle, marginTop: "6px" }}>{result.fieldErrors.phone}</div>
                  )}
                  {result?.intent === "test" && result?.error && (
                    <div style={{ ...errorStyle, marginTop: "6px" }}>{result.error}</div>
                  )}
                </div>
                <button type="button" onClick={handleTest} disabled={busy} style={busy ? { ...secondaryButtonStyle, opacity: 0.7 } : secondaryButtonStyle}>
                  {testing ? "Sending..." : "Send test"}
                </button>
              </div>
              {result?.intent === "test" && result?.messageId && (
                <div style={successMessageStyle}>Test message sent! ID: {result.messageId}</div>
              )}
              <div style={hintStyle}>
                If no message arrives, the Meta app must be in Live mode (business verification + Live mode); the testing API silently drops deliveries.
              </div>
            </form>
          </Card>
        )}

        <Card title="Webhook URL" subtitle="Configure this URL in your Meta App Dashboard.">
          {appUrl ? (
            <div style={webhookRowStyle}>
              <code style={codeStyle}>{webhookUrl}</code>
              <button type="button" onClick={handleCopy} style={secondaryButtonStyle}>
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          ) : (
            <div style={warningStyle}>Set the SHOPIFY_APP_URL env var to see your webhook URL.</div>
          )}
        </Card>

        <Card title="Setup Checklist" subtitle="Follow these steps to fully connect your WhatsApp Business Account.">
          <div style={stepsStyle}>
            {steps.map((step, index) => {
              const isUrl = /^https?:\/\//.test(step.action);
              return (
                <div key={step.step} style={stepRowStyle}>
                  <div style={stepNumberStyle}>{step.step}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={stepTitleStyle}>{step.title}</div>
                    <div style={stepDescStyle}>{step.description}</div>
                    {isUrl ? (
                      <a href={step.action} target="_blank" rel="noopener noreferrer" style={stepLinkStyle}>
                        Open {step.title.toLowerCase()} →
                      </a>
                    ) : (
                      <div style={stepActionStyle}>{step.action}</div>
                    )}
                    <div style={stepVerifiedStyle}>
                      <span style={{ fontWeight: 600 }}>Verified by:</span> {step.verifiedBy}
                    </div>
                  </div>
                  {index < steps.length - 1 && <div style={stepLineStyle} />}
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </s-page>
  );
}

const pageStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  maxWidth: "960px",
  padding: "8px 4px 24px",
};

const introStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  flexWrap: "wrap",
  padding: "4px 0 8px",
};

const introTitleStyle: CSSProperties = {
  fontSize: "20px",
  fontWeight: 600,
  color: "#202223",
  margin: 0,
};

const introTextStyle: CSSProperties = {
  fontSize: "14px",
  color: "#6d7175",
  margin: "6px 0 0",
};

const pillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "6px 12px",
  borderRadius: "999px",
  fontSize: "13px",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const pillDotStyle: CSSProperties = {
  width: "8px",
  height: "8px",
  borderRadius: "50%",
  backgroundColor: "#0d6b0d",
};

const cardStyle: CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #e0e0e0",
  borderRadius: "12px",
  padding: "20px 20px 24px",
  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
};

const cardHeaderStyle: CSSProperties = {
  marginBottom: "16px",
};

const cardTitleStyle: CSSProperties = {
  fontSize: "17px",
  fontWeight: 600,
  color: "#202223",
  margin: 0,
};

const cardSubtitleStyle: CSSProperties = {
  fontSize: "13px",
  color: "#6d7175",
  margin: "4px 0 0",
};

const fieldStyle: CSSProperties = {
  marginBottom: "16px",
  minWidth: 0,
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: "13px",
  fontWeight: 600,
  color: "#202223",
  marginBottom: "4px",
};

const hintStyle: CSSProperties = {
  fontSize: "12px",
  color: "#6d7175",
  marginBottom: "6px",
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #c4cdd5",
  fontSize: "14px",
  color: "#202223",
  backgroundColor: "#ffffff",
  outline: "none",
};

const errorStyle: CSSProperties = {
  color: "#b71c1c",
  fontSize: "12px",
  marginTop: "4px",
};

const successMessageStyle: CSSProperties = {
  color: "#0d6b0d",
  fontSize: "13px",
  fontWeight: 500,
  marginTop: "12px",
};

const rowStyle: CSSProperties = {
  display: "flex",
  gap: "16px",
  flexWrap: "wrap",
};

const testRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  gap: "12px",
  flexWrap: "wrap",
};

const saveButtonStyle: CSSProperties = {
  width: "100%",
  padding: "11px 16px",
  borderRadius: "8px",
  border: "none",
  background: "#128C7E",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  padding: "10px 16px",
  borderRadius: "8px",
  border: "1px solid #c4cdd5",
  backgroundColor: "#ffffff",
  color: "#202223",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const webhookRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
};

const codeStyle: CSSProperties = {
  flex: 1,
  minWidth: "240px",
  padding: "10px 12px",
  borderRadius: "8px",
  backgroundColor: "#fafbfb",
  border: "1px solid #e0e0e0",
  fontFamily: "monospace",
  fontSize: "13px",
  color: "#202223",
  wordBreak: "break-all",
};

const warningStyle: CSSProperties = {
  padding: "10px 12px",
  borderRadius: "8px",
  backgroundColor: "#fff3cd",
  border: "1px solid #ffc107",
  color: "#663c00",
  fontSize: "13px",
};

const stepsStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
};

const stepRowStyle: CSSProperties = {
  display: "flex",
  gap: "14px",
  position: "relative",
  paddingBottom: "16px",
};

const stepNumberStyle: CSSProperties = {
  width: "28px",
  height: "28px",
  flexShrink: 0,
  borderRadius: "50%",
  backgroundColor: "#128C7E",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  zIndex: 1,
};

const stepTitleStyle: CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  color: "#202223",
  marginTop: "2px",
};

const stepDescStyle: CSSProperties = {
  fontSize: "13px",
  color: "#6d7175",
  marginTop: "3px",
};

const stepActionStyle: CSSProperties = {
  fontSize: "13px",
  color: "#455a64",
  marginTop: "4px",
};

const stepLinkStyle: CSSProperties = {
  display: "inline-block",
  fontSize: "13px",
  fontWeight: 500,
  color: "#128C7E",
  textDecoration: "none",
  marginTop: "4px",
};

const stepVerifiedStyle: CSSProperties = {
  fontSize: "12px",
  color: "#637381",
  marginTop: "6px",
};

const stepLineStyle: CSSProperties = {
  position: "absolute",
  left: "13px",
  top: "28px",
  bottom: "0",
  width: "1px",
  backgroundColor: "#e0e0e0",
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
