import { useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useNavigate, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";
import { clearConnectorToken } from "../lib/auth/connector-session.server";

const CONNECTOR_LOGOUT_URL = "/api/connector/logout";
const CONNECTOR_LOGIN_URL = "/login";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await authenticate.admin(request);
  } catch (error) {
    if (error instanceof Response) {
      const headers = new Headers(error.headers);
      headers.append("Set-Cookie", clearConnectorToken());
      return new Response(error.body, { status: error.status, headers });
    }
    throw error;
  }

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Home</s-link>
        <s-link href="/app/additional">Additional page</s-link>
        <s-link href="/app/whatsapp">WhatsApp Config</s-link>
        <s-link href="/app/whatsapp/templates">Templates</s-link>
        <LogoutButton />
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

function LogoutButton() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const navigate = useNavigate();

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }
    setIsLoggingOut(true);
    try {
      await fetch(CONNECTOR_LOGOUT_URL, { method: "POST" });
    } catch {
      // token is cleared on the login page if the request still failed
    }
    navigate(`${CONNECTOR_LOGIN_URL}${window.location.search}`);
  }

  return (
    <s-button onClick={handleLogout} disabled={isLoggingOut}>
      {isLoggingOut ? "Logging out..." : "Logout"}
    </s-button>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
