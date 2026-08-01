import { clearConnectorToken } from "../lib/auth/connector-session.server";

export const action = async () => {
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": clearConnectorToken() } }
  );
};
