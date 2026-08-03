import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, redirect, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";
import { getConnectorToken } from "../lib/auth/connector-session.server";
import { LogoutButton } from "../components/logout-button";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  if (!getConnectorToken(request)) {
    const url = new URL(request.url);
    throw redirect(`/login?${url.searchParams.toString()}`);
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

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
