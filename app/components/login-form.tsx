import { useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import Swal from "sweetalert2";

const LOGIN_URL = "/api/connector/login";

export function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!username || !password) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(LOGIN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        window.location.assign(`/app/whatsapp${window.location.search}`);
        return;
      }

      let message = "";
      try {
        const body = await response.json();
        if (body?.error) {
          message = body.error;
        }
      } catch {
        // response body is not JSON, keep the status message
      }

      if (!message) {
        message = `Login failed (${response.status}).`;
        if (response.status === 502 || response.status === 503 || response.status === 504) {
          message = `Login server is temporarily unavailable (${response.status}). Please try again.`;
        }
      }
      Swal.fire({
        icon: "error",
        title: "Login failed",
        text: message,
      });
    } catch {
      Swal.fire({
        icon: "error",
        title: "Connection error",
        text: "Could not reach the login server.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={formStyle}>
      <label style={labelStyle} htmlFor="username">
        Username
      </label>
      <input
        id="username"
        name="username"
        type="text"
        value={username}
        onChange={(e) => setUsername(e.currentTarget.value)}
        placeholder="you@example.com"
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
        autoComplete="current-password"
        required
        style={inputStyle}
      />

      <button
        type="submit"
        disabled={isSubmitting}
        style={isSubmitting ? { ...buttonStyle, ...buttonDisabledStyle } : buttonStyle}
      >
        {isSubmitting ? "Checking..." : "Log in"}
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
