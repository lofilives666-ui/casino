let csrfTokenPromise: Promise<string> | null = null;

export async function getCsrfToken() {
  if (!csrfTokenPromise) {
    csrfTokenPromise = fetch("/api/auth/csrf", { method: "GET" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to fetch CSRF token.");
        const data = (await response.json()) as { token?: string };
        if (!data.token) throw new Error("Invalid CSRF token response.");
        return data.token;
      })
      .catch((error) => {
        csrfTokenPromise = null;
        throw error;
      });
  }
  return csrfTokenPromise;
}

export function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

