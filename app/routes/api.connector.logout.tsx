import type { ActionFunctionArgs } from "react-router";
import { CONNECTOR_TOKEN_COOKIE, expireCookie } from "../lib/auth/connector-session.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const names = new Set<string>([CONNECTOR_TOKEN_COOKIE]);

  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    for (const part of cookieHeader.split(";")) {
      const separator = part.indexOf("=");
      const name = (separator === -1 ? part : part.slice(0, separator)).trim();
      if (name) {
        names.add(name);
      }
    }
  }

  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": [...names].map(expireCookie).join(", ") } }
  );
};
