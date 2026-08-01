import type { CSSProperties } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

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

  return { shop: session.shop };
};

export default function Login() {
  const { shop } = useLoaderData<typeof loader>();

  return (
    <div style={pageStyle}>
      <AuthCard shop={shop} />
    </div>
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
