import { useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import Swal from "sweetalert2";

const SIGNUP_URL =
  import.meta.env.VITE_CONNECTOR_SIGNUP_URL || "https://testerp.yuvmedia.com/api/connector/signup";
const PLATFORM = "shopify";
const PLUGIN_ID = 1;

type SignupFormProps = {
  onSuccess?: () => void;
};

export function SignupForm({ onSuccess }: SignupFormProps) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name || !username || !password) {
      Swal.fire({ icon: "warning", title: "Missing details", text: "Enter your name, platform username and password." });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(SIGNUP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, platform: PLATFORM, username, password, plugin_id: PLUGIN_ID }),
      });

      if (response.ok) {
        await Swal.fire({
          icon: "success",
          title: "Sign up successful",
          text: "Credentials verified.",
        });
        onSuccess?.();
        return;
      }

      let message = `Sign up failed (${response.status}).`;
      try {
        const body = await response.json();
        if (body?.error) {
          message = body.error;
        }
      } catch {
        // response body is not JSON, keep the status message
      }
      Swal.fire({ icon: "error", title: "Sign up failed", text: message });
    } catch {
      Swal.fire({ icon: "error", title: "Connection error", text: "Could not reach the signup server." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={formStyle}>
      <label style={labelStyle} htmlFor="name">
        Name
      </label>
      <input
        id="name"
        name="name"
        type="text"
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        placeholder="Your name"
        autoComplete="name"
        required
        style={inputStyle}
      />

      <label style={labelStyle} htmlFor="username">
        Platform username
      </label>
      <input
        id="username"
        name="username"
        type="text"
        value={username}
        onChange={(e) => setUsername(e.currentTarget.value)}
        placeholder="Shopify username"
        autoComplete="username"
        required
        style={inputStyle}
      />

      <label style={labelStyle} htmlFor="password">
        Password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.currentTarget.value)}
        placeholder="Your password"
        autoComplete="new-password"
        required
        style={inputStyle}
      />

      <button
        type="submit"
        disabled={isSubmitting}
        style={isSubmitting ? { ...buttonStyle, ...buttonDisabledStyle } : buttonStyle}
      >
        {isSubmitting ? "Creating..." : "Sign up"}
      </button>
    </form>
  );
}

const formStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const labelStyle: CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  color: "#202223",
  marginTop: "8px",
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #d0d5dd",
  fontSize: "14px",
  color: "#202223",
  outline: "none",
};

const buttonStyle: CSSProperties = {
  marginTop: "20px",
  padding: "11px 16px",
  borderRadius: "8px",
  border: "none",
  background: "#128C7E",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 600,
  cursor: "pointer",
};

const buttonDisabledStyle: CSSProperties = {
  opacity: 0.7,
  cursor: "not-allowed",
};
