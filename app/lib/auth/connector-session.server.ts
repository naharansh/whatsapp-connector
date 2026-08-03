export const CONNECTOR_TOKEN_COOKIE = "connector_token";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type CookieOptions = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "None" | "Lax" | "Strict";
  maxAge: number;
};

export function getConnectorToken(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) {
    return null;
  }

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) {
      continue;
    }
    if (part.slice(0, separator).trim() === CONNECTOR_TOKEN_COOKIE) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }

  return null;
}

export function setConnectorToken(token: string): string {
  return serializeCookie(CONNECTOR_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export function clearConnectorToken(): string {
  return serializeCookie(CONNECTOR_TOKEN_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    maxAge: 0,
  });
}

export function expireCookie(name: string): string {
  const parts = [`${name}=`];
  parts.push(`Max-Age=0`);
  parts.push(`Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
  parts.push(`Path=/`);
  parts.push(`HttpOnly`);
  parts.push(`Secure`);
  parts.push(`SameSite=None`);
  return parts.join("; ");
}

function serializeCookie(name: string, value: string, options: CookieOptions): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Max-Age=${options.maxAge}`);
  if (options.httpOnly) {
    parts.push("HttpOnly");
  }
  if (options.secure) {
    parts.push("Secure");
  }
  parts.push("Path=/");
  parts.push(`SameSite=${options.sameSite}`);
  return parts.join("; ");
}
