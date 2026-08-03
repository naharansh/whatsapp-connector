import type { CSSProperties } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";
import { clearConnectorToken, getConnectorToken } from "../lib/auth/connector-session.server";
import { AuthCard } from "../components/auth-card";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  let session;
  try {
    ({ session } = await authenticate.admin(request));
  } catch (error) {
    if (error instanceof Response) {
      const headers = new Headers(error.headers);
      headers.append("Set-Cookie", clearConnectorToken());
      return new Response(error.body, { status: error.status, headers });
    }
    throw error;
  }

  if (getConnectorToken(request)) {
    const url = new URL(request.url);
    throw redirect(`/app/whatsapp?${url.searchParams.toString()}`);
  }

  // eslint-disable-next-line no-undef
  return { shop: session.shop, apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function Login() {
  const { shop, apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <div style={pageStyle}>
        <AuthCard shop={shop} />
      </div>
    </AppProvider>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f3f6f8",
  padding: "16px",
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
