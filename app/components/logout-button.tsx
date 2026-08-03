import { useState } from "react";
import Swal from "sweetalert2";

const CONNECTOR_LOGOUT_URL = "/api/connector/logout";
const CONNECTOR_LOGIN_URL = "/login";

function clearAllCookies() {
  const cookies = document.cookie.split(";");
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i];
    const eqPos = cookie.indexOf("=");
    const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
    if (!name) {
      continue;
    }
    const expires = "Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = `${name}=;expires=${expires};path=/`;
    document.cookie = `${name}=;expires=${expires};path=/;domain=${window.location.hostname}`;
    document.cookie = `${name}=;expires=${expires};path=/;domain=.${window.location.hostname}`;
  }
}

export function LogoutButton() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: "Log out?",
      text: "Your session will end and you'll be returned to the login page.",
      showCancelButton: true,
      confirmButtonColor: "#b71c1c",
      confirmButtonText: "Log out",
      cancelButtonText: "Cancel",
    });

    if (!isConfirmed) {
      return;
    }

    setIsLoggingOut(true);
    try {
      await fetch(CONNECTOR_LOGOUT_URL, { method: "POST" });
    } catch {
      // token is cleared on the login page if the request still failed
    }
    clearAllCookies();
    window.location.assign(`${CONNECTOR_LOGIN_URL}${window.location.search}`);
  }

  return (
    <s-button onClick={handleLogout} disabled={isLoggingOut}>
      {isLoggingOut ? "Logging out..." : "Logout"}
    </s-button>
  );
}
