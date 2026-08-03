import prisma from "../../db.server";
import { getWhatsAppConfig, configFromEnv } from "./db-config.server";
import { createWhatsAppClient, getTemplateStructure } from "./client";
import { friendlyWhatsAppError } from "./errors";
import type { TriggerData } from "./trigger-types";

export async function getTriggers(shop: string): Promise<TriggerData[]> {
  const rows = await prisma.whatsAppTrigger.findMany({
    where: { shop },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    triggerEvent: r.triggerEvent,
    templateName: r.templateName,
    languageCode: r.languageCode,
    enabled: r.enabled,
    variableMapping: r.variableMapping ? JSON.parse(r.variableMapping) : null,
    lastError: r.lastError,
    lastErrorAt: r.lastErrorAt?.toISOString() ?? null,
  }));
}

export async function saveTrigger(
  shop: string,
  triggerEvent: string,
  templateName: string,
  languageCode: string,
  enabled: boolean,
  variableMapping?: string | null
): Promise<TriggerData> {
  const updateData: Record<string, unknown> = { templateName, languageCode, enabled };
  if (variableMapping !== undefined) {
    updateData.variableMapping = variableMapping;
  }
  const row = await prisma.whatsAppTrigger.upsert({
    where: { shop_triggerEvent: { shop, triggerEvent } },
    create: { shop, triggerEvent, templateName, languageCode, enabled, variableMapping: variableMapping ?? null },
    update: updateData,
  });
  return {
    id: row.id,
    triggerEvent: row.triggerEvent,
    templateName: row.templateName,
    languageCode: row.languageCode,
    enabled: row.enabled,
    variableMapping: row.variableMapping ? JSON.parse(row.variableMapping) : null,
    lastError: row.lastError,
    lastErrorAt: row.lastErrorAt?.toISOString() ?? null,
  };
}

async function setTriggerError(shop: string, triggerEvent: string, error: string | null) {
  try {
    await prisma.whatsAppTrigger.update({
      where: { shop_triggerEvent: { shop, triggerEvent } },
      data: { lastError: error, lastErrorAt: error ? new Date() : null },
    });
  } catch (err) {
    console.error("[setTriggerError] Failed to persist trigger error:", err);
  }
}

export async function sendTriggerMessage(
  shop: string,
  triggerEvent: string,
  customerPhone: string,
  variables: Record<string, string>
): Promise<{ sent: boolean; error?: string }> {
  const trigger = await prisma.whatsAppTrigger.findUnique({
    where: { shop_triggerEvent: { shop, triggerEvent } },
  });

  if (!trigger || !trigger.enabled) {
    return { sent: false, error: "Trigger not found or disabled" };
  }

  const config = (await getWhatsAppConfig(shop)) ?? configFromEnv();
  if (!config) {
    return { sent: false, error: "WhatsApp not configured" };
  }

  try {
    const client = createWhatsAppClient(config);

    const structure = await getTemplateStructure(config, trigger.templateName);
    const nonTextHeaders: readonly string[] = ["IMAGE", "VIDEO", "DOCUMENT"];
    if (structure.headerFormat && nonTextHeaders.includes(structure.headerFormat)) {
      const err = `Template has a ${structure.headerFormat.toLowerCase()} header. Only text headers are supported.`;
      await setTriggerError(shop, triggerEvent, err);
      return { sent: false, error: err };
    }

    const variableEntries = Object.entries(variables).sort(
      (a, b) => Number(a[0]) - Number(b[0])
    ).map(([key, val]) => [key, val || "-"] as [string, string]);

    const components: Array<{
      type: "header" | "body";
      parameters: Array<{ type: "text"; text: string }>;
    }> = [];

    if (structure.headerVariableCount > 0) {
      const headerParams = variableEntries.slice(0, structure.headerVariableCount);
      components.push({
        type: "header",
        parameters: headerParams.map(([, val]) => ({ type: "text" as const, text: val })),
      });
    }

    if (structure.bodyVariableCount > 0) {
      const bodyParams = variableEntries.slice(
        structure.headerVariableCount,
        structure.headerVariableCount + structure.bodyVariableCount
      );
      components.push({
        type: "body",
        parameters: bodyParams.map(([, val]) => ({ type: "text" as const, text: val })),
      });
    }

    console.log(`[sendTriggerMessage] Sending to ${customerPhone}: template="${trigger.templateName}", components=${JSON.stringify(components)}`);

    await client.sendTemplate(
      customerPhone,
      trigger.templateName,
      trigger.languageCode,
      components.length > 0 ? components : undefined
    );
    await setTriggerError(shop, triggerEvent, null);
    console.log(`[sendTriggerMessage] Sent successfully to ${customerPhone}`);
    return { sent: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[sendTriggerMessage] Failed: ${msg}`);

    const friendly = friendlyWhatsAppError(msg);
    await setTriggerError(shop, triggerEvent, friendly);
    return { sent: false, error: friendly };
  }
}
