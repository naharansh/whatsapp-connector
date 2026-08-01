import { useState } from "react";
import type { CSSProperties } from "react";
import { LoginForm } from "./login-form";
import { SignupForm } from "./signup-form";

type AuthCardProps = {
  shop: string;
};

export function AuthCard({ shop }: AuthCardProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <div style={logoStyle}>WA</div>
        <h1 style={titleStyle}>WhatsApp Connector</h1>
        <p style={subtitleStyle}>Manage messaging for {shop}</p>
      </div>

      <div style={tabsStyle}>
        <button
          type="button"
          onClick={() => setMode("login")}
          style={mode === "login" ? tabActiveStyle : tabStyle}
        >
          Log in
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          style={mode === "signup" ? tabActiveStyle : tabStyle}
        >
          Sign up
        </button>
      </div>

      {mode === "login" ? <LoginForm /> : <SignupForm onSuccess={() => setMode("login")} />}
    </div>
  );
}

const cardStyle: CSSProperties = {
  width: "100%",
  maxWidth: "400px",
  background: "#ffffff",
  borderRadius: "12px",
  boxShadow: "0 4px 24px rgba(0, 0, 0, 0.08)",
  padding: "32px",
};

const headerStyle: CSSProperties = {
  textAlign: "center",
  marginBottom: "24px",
};

const logoStyle: CSSProperties = {
  width: "56px",
  height: "56px",
  margin: "0 auto 12px",
  borderRadius: "50%",
  background: "#128C7E",
  color: "#ffffff",
  fontSize: "20px",
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const titleStyle: CSSProperties = {
  fontSize: "22px",
  fontWeight: 700,
  margin: 0,
  color: "#202223",
};

const subtitleStyle: CSSProperties = {
  fontSize: "14px",
  color: "#6d7175",
  margin: "8px 0 0",
};

const tabsStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: "24px",
  marginBottom: "20px",
};

const tabStyle: CSSProperties = {
  background: "none",
  border: "none",
  padding: "8px 0",
  fontSize: "14px",
  fontWeight: 500,
  color: "#6d7175",
  cursor: "pointer",
};

const tabActiveStyle: CSSProperties = {
  background: "none",
  border: "none",
  padding: "8px 0",
  fontSize: "14px",
  fontWeight: 600,
  color: "#128C7E",
  cursor: "pointer",
};
