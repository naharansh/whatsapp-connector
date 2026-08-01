import type { ActionFunctionArgs } from "react-router";
import { setConnectorToken } from "../lib/auth/connector-session.server";

const CONNECTOR_LOGIN_URL =
  process.env.VITE_CONNECTOR_LOGIN_URL || "https://testerp.yuvmedia.com/api/connector/login";

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 500;
const RETRYABLE_STATUSES = new Set([502, 503, 504]);

type FetchResult =
  | { ok: true; response: Response }
  | { ok: false; status: number | null; message: string };

async function fetchConnectorLogin(username: string, password: string): Promise<FetchResult> {
  let lastStatus: number | null = null;
  let lastMessage = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const startedAt = Date.now();

    try {
      const response = await fetch(CONNECTOR_LOGIN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        signal: controller.signal,
      });

      if (response.ok || !RETRYABLE_STATUSES.has(response.status)) {
        return { ok: true, response };
      }

      lastStatus = response.status;
      lastMessage = `Connector returned HTTP ${response.status}`;
      console.error(
        `[connector-login] attempt ${attempt}/${MAX_ATTEMPTS} returned ${response.status} after ${Date.now() - startedAt}ms`
      );
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      lastStatus = null;
      lastMessage = aborted
        ? `Connector did not respond within ${REQUEST_TIMEOUT_MS / 1000}s`
        : error instanceof Error
          ? error.message
          : "Unknown network error";
      console.error(
        `[connector-login] attempt ${attempt}/${MAX_ATTEMPTS} failed (${aborted ? "timeout" : "network"}): ${lastMessage}`
      );
    } finally {
      clearTimeout(timeout);
    }

    if (attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS));
    }
  }

  return { ok: false, status: lastStatus, message: lastMessage };
}

export const action = async ({ request }: ActionFunctionArgs) => {
  let username = "";
  let password = "";

  try {
    const body = await request.json();
    username = typeof body?.username === "string" ? body.username : "";
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return Response.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  if (!username || !password) {
    return Response.json({ ok: false, error: "Username and password are required." }, { status: 400 });
  }

  const result = await fetchConnectorLogin(username, password);

  if (!result.ok) {
    const status = result.status ?? 502;
    return Response.json({ ok: false, error: `${result.message}. Please try again.` }, { status });
  }

  const response = result.response;

  if (!response.ok) {
    let message = `Login failed (${response.status}).`;
    try {
      const body = await response.json();
      if (body?.error) {
        message = body.error;
      }
    } catch {
      // response body is not JSON, keep the status message
    }
    return Response.json({ ok: false, error: message }, { status: response.status });
  }

  let token = "";
  try {
    const body = await response.json();
    token = typeof body?.access_token === "string" ? body.access_token : "";
  } catch {
    return Response.json(
      { ok: false, error: "Login server returned an invalid response." },
      { status: 502 }
    );
  }

  if (!token) {
    return Response.json({ ok: false, error: "Login server did not return a token." }, { status: 502 });
  }

  return Response.json({ ok: true }, { headers: { "Set-Cookie": setConnectorToken(token) } });
};
