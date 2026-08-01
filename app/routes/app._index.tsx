import type { CSSProperties } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import { getConnectorToken } from "../lib/auth/connector-session.server";
import { AuthCard } from "../components/auth-card";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  if (getConnectorToken(request)) {
    const url = new URL(request.url);
    throw redirect(`/app/whatsapp?${url.searchParams.toString()}`);
  }

  return { shop: session.shop };
};

export default function AppIndex() {
  const { shop } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Login">
      <div style={wrapperStyle}>
        <AuthCard shop={shop} />
      </div>
    </s-page>
  );
}

const wrapperStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  padding: "32px 0",
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
