import { useEffect, useMemo, useRef, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import Swal from "sweetalert2";
import { useFetcher, useLoaderData, useRevalidator } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getWhatsAppConfig, configFromEnv } from "../lib/whatsapp/db-config.server";
import { getTemplates, getTemplateStructure, verifyWabaId } from "../lib/whatsapp/client";
import { getTriggers, saveTrigger } from "../lib/whatsapp/triggers.server";
import { TRIGGER_EVENTS } from "../lib/whatsapp/trigger-types";
import { LogoutButton } from "../components/logout-button";
import type { WhatsAppTemplate } from "../lib/whatsapp/client";
import type { TriggerData } from "../lib/whatsapp/trigger-types";
import { ORDER_FIELDS, DEFAULT_MAPPING } from "../lib/whatsapp/trigger-types";

type LoaderData = {
  templates: WhatsAppTemplate[];
  triggers: TriggerData[];
  error: string | null;
  configured: boolean;
  wabaName: string | null;
};

export const loader = async ({ request }: LoaderFunctionArgs): Promise<LoaderData> => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const config = (await getWhatsAppConfig(shop)) ?? configFromEnv();

  if (!config) {
    return { templates: [], triggers: [], error: null, configured: false, wabaName: null };
  }

  const wabaCheck = await verifyWabaId(config).catch((e: Error) => {
    return { valid: false, name: undefined, error: e.message };
  });
  if (!wabaCheck.valid) {
    return { templates: [], triggers: [], error: wabaCheck.error ?? "Invalid WABA ID", configured: true, wabaName: null };
  }

  let templates: WhatsAppTemplate[];
  let triggers: TriggerData[];
  try {
    [templates, triggers] = await Promise.all([
      getTemplates(config),
      getTriggers(shop),
    ]);
  } catch (e) {
    return {
      templates: [],
      triggers: [],
      error: e instanceof Error ? e.message : "Failed to load templates",
      configured: true,
      wabaName: wabaCheck.name ?? null,
    };
  }

  for (const t of templates) {
    if (t.status === "APPROVED") {
      try {
        const structure = await getTemplateStructure(config, t.name);
        t.headerFormat = structure.headerFormat;
      } catch {
      }
    }
  }

  return { templates, triggers, error: null, configured: true, wabaName: wabaCheck.name ?? null };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "save-trigger") {
    const triggerEvent = formData.get("triggerEvent") as string;
    const templateName = formData.get("templateName") as string;
    const languageCode = (formData.get("languageCode") as string) || "en";
    const enabled = formData.get("enabled") === "true";
    const variableMapping = formData.get("variableMapping") as string | null;

    const config = (await getWhatsAppConfig(shop)) ?? configFromEnv();
    if (config) {
      const templates = await getTemplates(config).catch(() => []);
      const selected = templates.find((t) => t.name === templateName);
      const nonTextHeaders = ["IMAGE", "VIDEO", "DOCUMENT"] as const;
      if (selected?.headerFormat && (nonTextHeaders as readonly string[]).includes(selected.headerFormat)) {
        return { ok: false, fieldErrors: { templateName: `Template has a ${selected.headerFormat.toLowerCase()} header. Only text headers are supported.` } };
      }
    }

    await saveTrigger(shop, triggerEvent, templateName, languageCode, enabled, variableMapping || null);
    return { ok: true };
  }

  if (intent === "refresh-templates") {
    const config = (await getWhatsAppConfig(shop)) ?? configFromEnv();
    if (!config) {
      return { ok: false, error: "WhatsApp not configured" };
    }
    try {
      const [templates, triggers] = await Promise.all([
        getTemplates(config),
        getTriggers(shop),
      ]);
      return { ok: true, templates, triggers };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Failed to refresh templates" };
    }
  }

  return { ok: false, error: "Unknown intent" };
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    APPROVED: { color: "#0d6b0d", bg: "#e6f7e6" },
    PENDING: { color: "#b45a00", bg: "#fff3cd" },
    REJECTED: { color: "#b71c1c", bg: "#fce4e4" },
    PAUSED: { color: "#5c5c5c", bg: "#f0f0f0" },
    DISABLED: { color: "#5c5c5c", bg: "#f0f0f0" },
  };
  const s = map[status] ?? { color: "#333", bg: "#eee" };
  return (
    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: 600, color: s.color, backgroundColor: s.bg }}>
      {status}
    </span>
  );
}

function TemplateDetailRow({ tpl }: { tpl: WhatsAppTemplate }) {
  const bodyComponents = tpl.components?.filter((c) => c.type === "BODY") ?? [];
  const headerComponents = tpl.components?.filter((c) => c.type === "HEADER") ?? [];
  const footerComponents = tpl.components?.filter((c) => c.type === "FOOTER") ?? [];
  const buttonsComponents = tpl.components?.filter((c) => c.type === "BUTTONS") ?? [];

  return (
    <div style={{ padding: "16px 16px 16px 24px", backgroundColor: "#fafafa", borderBottom: "1px solid #e0e0e0", fontSize: "13px", lineHeight: 1.6 }}>
      {tpl.components && tpl.components.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {headerComponents.map((c, i) => (
            <div key={i}>
              <div style={{ fontWeight: 600, color: "#212b36", marginBottom: 2 }}>Header {c.format ? `(${c.format})` : ""}</div>
              <div style={{ color: "#455a64", whiteSpace: "pre-wrap", fontFamily: "monospace", backgroundColor: "#fff", padding: "8px 12px", borderRadius: "4px", border: "1px solid #e0e0e0" }}>{c.text ?? "(no text)"}</div>
            </div>
          ))}
          {bodyComponents.map((c, i) => (
            <div key={i}>
              <div style={{ fontWeight: 600, color: "#212b36", marginBottom: 2 }}>Body</div>
              <div style={{ color: "#455a64", whiteSpace: "pre-wrap", fontFamily: "monospace", backgroundColor: "#fff", padding: "8px 12px", borderRadius: "4px", border: "1px solid #e0e0e0" }}>{c.text ?? "(no text)"}</div>
              {c.example?.body_text && (
                <div style={{ marginTop: 4, color: "#637381", fontSize: "12px" }}>Example: "{c.example.body_text[0]?.join(", ") ?? ""}"</div>
              )}
            </div>
          ))}
          {footerComponents.map((c, i) => (
            <div key={i}>
              <div style={{ fontWeight: 600, color: "#212b36", marginBottom: 2 }}>Footer</div>
              <div style={{ color: "#637381", whiteSpace: "pre-wrap" }}>{c.text ?? "(no text)"}</div>
            </div>
          ))}
          {buttonsComponents.map((c, i) => (
            <div key={i}>
              <div style={{ fontWeight: 600, color: "#212b36", marginBottom: 4 }}>Buttons</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {(c.buttons ?? []).map((b, j) => (
                  <div key={j} style={{ backgroundColor: "#fff", padding: "6px 12px", borderRadius: "4px", border: "1px solid #e0e0e0", fontSize: "12px", color: "#455a64" }}>
                    <span style={{ fontWeight: 500 }}>{b.type}</span>
                    {b.text ? `: ${b.text}` : ""}
                    {b.url ? ` → ${b.url}` : ""}
                    {b.phone_number ? ` → ${b.phone_number}` : ""}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: "#637381", fontStyle: "italic" }}>No component details available</div>
      )}
    </div>
  );
}

function CategoryChip({ category }: { category: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    MARKETING: { bg: "#f3e8ff", color: "#6b21a8" },
    UTILITY: { bg: "#e0f2fe", color: "#0369a1" },
    AUTHENTICATION: { bg: "#fef3c7", color: "#92400e" },
  };
  const c = map[category] ?? { bg: "#f3f4f6", color: "#374151" };
  return (
    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: 500, backgroundColor: c.bg, color: c.color }}>
      {category}
    </span>
  );
}

function getPlaceholdersFromTemplate(templates: WhatsAppTemplate[], templateName: string): string[] {
  const t = templates.find((t) => t.name === templateName);
  const body = t?.components?.find((c) => c.type === "BODY")?.text ?? "";
  const matches = body.match(/\{\{\d+\}\}/g);
  return matches ? matches.map((m) => m.replace(/[\{\}]/g, "")) : [];
}

function TriggerRow({ event, templates, trigger }: { event: typeof TRIGGER_EVENTS[number]; templates: WhatsAppTemplate[]; trigger: TriggerData | undefined }) {
  const fetcher = useFetcher();
  const approved = templates.filter((t) => t.status === "APPROVED");
  const saving = fetcher.state !== "idle";
  const langRef = useRef<HTMLInputElement>(null);

  const [selectedTemplate, setSelectedTemplate] = useState(trigger?.templateName ?? "");
  const [placeholders, setPlaceholders] = useState<string[]>(() =>
    getPlaceholdersFromTemplate(templates, trigger?.templateName ?? "")
  );
  const [mapping, setMapping] = useState<Record<string, string>>(() => {
    return trigger?.variableMapping ?? {};
  });
  const [active, setActive] = useState(trigger?.enabled ?? false);

  useEffect(() => {
    if (fetcher.data?.ok && !saving) {
      Swal.fire({ icon: "success", title: "Saved", timer: 1500, showConfirmButton: false });
    }
  }, [fetcher.data, saving]);

  useEffect(() => {
    if (trigger?.templateName && langRef.current) {
      const t = approved.find((t) => t.name === trigger.templateName);
      if (t) {
        langRef.current.value = t.language;
      }
    }
  }, []);

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.value;
    if (!name) {
      setSelectedTemplate("");
      setPlaceholders([]);
      setMapping({});
      return;
    }
    const selected = approved.find((t) => t.name === name);
    const nonTextHeaders = ["IMAGE", "VIDEO", "DOCUMENT"] as const;
    if (selected?.headerFormat && (nonTextHeaders as readonly string[]).includes(selected.headerFormat)) {
      Swal.fire({
        icon: "warning",
        title: "Unsupported header",
        text: `Template "${name}" has a ${selected.headerFormat.toLowerCase()} header. Only text headers are supported for sending WhatsApp messages.`,
      });
      setSelectedTemplate("");
      setPlaceholders([]);
      setMapping({});
      e.target.value = "";
      return;
    }
    setSelectedTemplate(name);
    if (selected && langRef.current) {
      langRef.current.value = selected.language;
    }
    const parsed = getPlaceholdersFromTemplate(templates, name);
    setPlaceholders(parsed);
    setMapping((prev) => {
      const next: Record<string, string> = {};
      for (const p of parsed) {
        next[p] = prev[p] ?? DEFAULT_MAPPING[p] ?? "";
      }
      return next;
    });
  };

  const handleMappingChange = (key: string, value: string) => {
    setMapping((prev) => ({ ...prev, [key]: value }));
  };

  const showMapping = active && placeholders.length > 0;

  return (
    <fetcher.Form method="POST" style={{ display: "contents" }}>
      <input type="hidden" name="intent" value="save-trigger" />
      <input type="hidden" name="triggerEvent" value={event.id} />
      <input type="hidden" name="variableMapping" value={JSON.stringify(mapping)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 200px 120px 80px", gap: "8px", padding: "12px 16px", borderBottom: showMapping ? "none" : "1px solid #f0f0f0", alignItems: "center", backgroundColor: "#fff" }}>
        <div>
          <div style={{ fontWeight: 500, fontSize: "14px", color: "#212b36" }}>{event.label}</div>
          <div style={{ fontSize: "12px", color: "#637381" }}>{event.description}</div>
        </div>
        <div>
          <select
            name="templateName"
            value={selectedTemplate}
            onChange={handleTemplateChange}
            style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #c4cdd5", fontSize: "13px", backgroundColor: "#fff" }}
          >
            <option value="">Select template...</option>
            {approved.map((t) => (
              <option key={t.name} value={t.name}>{t.name} ({t.language})</option>
            ))}
          </select>
          {fetcher.data?.fieldErrors?.templateName && (
            <div style={{ color: "#b71c1c", fontSize: "12px", marginTop: "4px" }}>{fetcher.data.fieldErrors.templateName}</div>
          )}
        </div>
        <div>
          <input
            ref={langRef}
            name="languageCode"
            defaultValue={trigger?.languageCode ?? "en"}
            placeholder="en"
            readOnly
            style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #c4cdd5", fontSize: "13px", boxSizing: "border-box", backgroundColor: "#f5f5f5", cursor: "default" }}
          />
        </div>
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", cursor: "pointer" }}>
            <input type="checkbox" name="enabled" value="true" defaultChecked={trigger?.enabled ?? false} onChange={(e) => setActive(e.target.checked)} />
            Active
          </label>
          <button
            type="submit"
            disabled={saving}
            style={{ padding: "4px 10px", borderRadius: "4px", border: "1px solid #c4cdd5", fontSize: "12px", backgroundColor: "#fff", cursor: "pointer", color: "#212b36", opacity: saving ? 0.6 : 1 }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
      {showMapping && (
        <div style={{ padding: "0 16px 12px", borderBottom: "1px solid #f0f0f0", backgroundColor: "#fafafa" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "#637381", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>Variable Mapping</div>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {placeholders.map((key) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "13px", fontWeight: 500, color: "#212b36", fontFamily: "monospace" }}>{"{{"}{key}{"}}"}</span>
                <span style={{ color: "#637381", fontSize: "13px" }}>→</span>
                <select
                  value={mapping[key] ?? ""}
                  onChange={(e) => handleMappingChange(key, e.target.value)}
                  style={{ padding: "4px 6px", borderRadius: "4px", border: "1px solid #c4cdd5", fontSize: "12px", backgroundColor: "#fff", minWidth: "140px" }}
                >
                  <option value="">Select field...</option>
                  {ORDER_FIELDS.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </fetcher.Form>
  );
}

export default function TemplatesPage() {
  const { templates, triggers, error, configured, wabaName } = useLoaderData<typeof loader>();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return templates.filter((t) => {
      if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== "All" && t.status !== statusFilter) return false;
      if (categoryFilter !== "All" && t.category !== categoryFilter) return false;
      return true;
    });
  }, [templates, search, statusFilter, categoryFilter]);

  const triggerMap = useMemo(() => {
    const m = new Map<string, TriggerData>();
    triggers.forEach((t) => m.set(t.triggerEvent, t));
    return m;
  }, [triggers]);

  const refreshFetcher = useFetcher();
  const revalidator = useRevalidator();
  const refreshing = refreshFetcher.state !== "idle";

  useEffect(() => {
    if (refreshFetcher.data?.ok && !refreshing) {
      revalidator.revalidate();
    }
  }, [refreshFetcher.data, refreshing]);

  if (!configured) {
    return (
      <s-page heading="Templates">
        <s-paragraph>WhatsApp is not configured. Go to <s-link href="/app/whatsapp">Settings</s-link> to set it up.</s-paragraph>
      </s-page>
    );
  }

  if (error) {
    return (
      <s-page heading="Templates">
        <s-box padding="base" borderWidth="base" borderRadius="base">
          <s-paragraph>{error}</s-paragraph>
          <s-link href="/app/whatsapp">Check your WhatsApp configuration</s-link>
        </s-box>
      </s-page>
    );
  }

  return (
    <s-page heading="Templates">
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
        <LogoutButton />
      </div>
      <div style={{ padding: "12px 16px", backgroundColor: "#fff4e5", borderRadius: "8px", border: "1px solid #ffc107", marginBottom: "16px", fontSize: "13px", color: "#663c00" }}>
        <strong style={{ display: "block", marginBottom: "4px" }}>Template header limitation</strong>
        WhatsApp templates with media headers (IMAGE, VIDEO, DOCUMENT) cannot be used for sending messages.
        Only templates <strong>without a header</strong> or with a <strong>TEXT header</strong> are supported.
      </div>

      <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <s-text>Search</s-text>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by template name..."
              style={{ display: "block", width: "100%", marginTop: "4px", padding: "7px 10px", borderRadius: "6px", border: "1px solid #c4cdd5", fontSize: "14px", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <s-text>Status</s-text>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ display: "block", marginTop: "4px", padding: "7px 28px 7px 10px", borderRadius: "6px", border: "1px solid #c4cdd5", fontSize: "14px", backgroundColor: "#fff" }}
            >
              {["All", "APPROVED", "PENDING", "REJECTED", "PAUSED", "DISABLED"].map((o) => <option key={o} value={o}>{o === "All" ? "All statuses" : o}</option>)}
            </select>
          </div>
          <div>
            <s-text>Category</s-text>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ display: "block", marginTop: "4px", padding: "7px 28px 7px 10px", borderRadius: "6px", border: "1px solid #c4cdd5", fontSize: "14px", backgroundColor: "#fff" }}
            >
              {["All", "MARKETING", "UTILITY", "AUTHENTICATION"].map((o) => <option key={o} value={o}>{o === "All" ? "All categories" : o}</option>)}
            </select>
          </div>
          <div style={{ alignSelf: "end", display: "flex", gap: "8px" }}>
            <button
              onClick={() => refreshFetcher.submit({ intent: "refresh-templates" }, { method: "POST" })}
              disabled={refreshing}
              style={{ padding: "7px 16px", borderRadius: "6px", border: "1px solid #c4cdd5", fontSize: "14px", fontWeight: 500, backgroundColor: "#fff", cursor: "pointer", color: "#212b36", opacity: refreshing ? 0.6 : 1 }}
            >
              {refreshing ? "Refreshing..." : "Refresh from Meta"}
            </button>
            <a
              href="https://business.facebook.com/wa/manage/message-templates"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "inline-block", padding: "7px 16px", borderRadius: "6px", border: "1px solid #c4cdd5", fontSize: "14px", fontWeight: 500, textDecoration: "none", color: "#212b36", backgroundColor: "#fff", cursor: "pointer" }}
            >
              + New template
            </a>
          </div>
        </div>
      </s-box>

      <div style={{ margin: "12px 0" }}>
        <s-text>{filtered.length} of {templates.length} templates</s-text>
      </div>

      {filtered.length === 0 && (
        <s-box padding="base" borderWidth="base" borderRadius="base">
          <s-paragraph>{templates.length === 0 ? "No templates yet. Create one in WhatsApp Manager to get started." : "No templates match your filters."}</s-paragraph>
        </s-box>
      )}

      {filtered.length > 0 && (
        <div style={{ border: "1px solid #e0e0e0", borderRadius: "8px", overflow: "hidden", marginBottom: "24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 120px 60px 40px", gap: "8px", padding: "10px 16px", backgroundColor: "#fafafa", borderBottom: "1px solid #e0e0e0", fontSize: "12px", fontWeight: 600, color: "#637381", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            <div>Template Name</div>
            <div>Status</div>
            <div>Category</div>
            <div>Language</div>
            <div></div>
          </div>
          {filtered.map((tpl) => {
            const isOpen = expanded.has(tpl.id);
            return (
              <div key={tpl.id}>
                <div
                  onClick={() => {
                    const next = new Set(expanded);
                    if (isOpen) next.delete(tpl.id); else next.add(tpl.id);
                    setExpanded(next);
                  }}
                  style={{ display: "grid", gridTemplateColumns: "1fr 140px 120px 60px 40px", gap: "8px", padding: "12px 16px", borderBottom: isOpen ? "none" : "1px solid #f0f0f0", alignItems: "center", backgroundColor: "#fff", cursor: "pointer" }}
                >
                  <div>
                    <div style={{ fontWeight: 500, fontSize: "14px", color: "#212b36" }}>{tpl.name}</div>
                    {tpl.rejected_reason && tpl.rejected_reason !== "NONE" && <div style={{ fontSize: "12px", color: "#b71c1c", marginTop: "2px" }}>{tpl.rejected_reason}</div>}
                  </div>
                  <div><StatusBadge status={tpl.status} /></div>
                  <div><CategoryChip category={tpl.category} /></div>
                  <div style={{ fontSize: "13px", color: "#637381" }}>{tpl.language}</div>
                  <div style={{ fontSize: "16px", color: "#637381", textAlign: "center" }}>{isOpen ? "▲" : "▼"}</div>
                </div>
                {isOpen && <TemplateDetailRow tpl={tpl} />}
                {isOpen && <div style={{ borderBottom: "1px solid #f0f0f0" }} />}
              </div>
            );
          })}
        </div>
      )}

      <s-section heading="Send to Customer">
        <s-paragraph>When a Shopify order event happens, automatically send the selected WhatsApp template to the customer.</s-paragraph>
        <div style={{ border: "1px solid #e0e0e0", borderRadius: "8px", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 200px 120px 80px", gap: "8px", padding: "10px 16px", backgroundColor: "#fafafa", borderBottom: "1px solid #e0e0e0", fontSize: "12px", fontWeight: 600, color: "#637381", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            <div>Trigger Event</div>
            <div>Template</div>
            <div>Language</div>
            <div>Status</div>
          </div>
          <div style={{ maxHeight: "400px", overflowY: "auto" }}>
            {TRIGGER_EVENTS.map((event) => {
              const t = triggerMap.get(event.id);
              return <TriggerRow key={event.id + '-' + (t?.id ?? 'none')} event={event} templates={templates} trigger={t} />;
            })}
          </div>
        </div>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
