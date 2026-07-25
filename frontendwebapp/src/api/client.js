export function getApiBase() {
  // Re-evaluate the bridge on every call so we pick it up after Electron
  // has finished exposing it via contextBridge (it is not available at
  // module-load time, which is why a top-level snapshot always returns "").
  const bridgeBase =
    typeof window !== "undefined" &&
    typeof window.financialTracker?.getBackendBaseUrl === "function"
      ? window.financialTracker.getBackendBaseUrl()
      : "";
  const base = bridgeBase || import.meta.env.VITE_API_BASE_URL || "";
  if (!base) {
    throw new Error(
      "API base URL is not configured. Copy .env.example to .env and set VITE_API_BASE_URL."
    );
  }
  return base;
}

async function readJsonSafe(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await response.text();
    return { detail: text || "Non-JSON response" };
  }
  return response.json();
}

function formatDetail(detail) {
  if (typeof detail === "string") {
    return detail;
  }
  try {
    return JSON.stringify(detail, null, 2);
  } catch {
    return String(detail);
  }
}

export async function handleResponse(response, meta) {
  const data = await readJsonSafe(response);

  if (!response.ok) {
    console.error("[api] request failed", {
      ...meta,
      status: response.status,
      statusText: response.statusText,
      response: data,
    });

    if (data?.detail) {
      console.error("[api] error detail", data.detail);
      console.error("[api] error detail (json)", formatDetail(data.detail));
    }

    const message = data?.detail ? formatDetail(data.detail) : "Request failed";
    throw new Error(message);
  }

  return data;
}

export async function postJson(path, payload) {
  const url = `${getApiBase()}${path}`;
  console.log("[api] POST", url, payload);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return handleResponse(response, { method: "POST", url, payload });
}

export async function putJson(path, payload) {
  const url = `${getApiBase()}${path}`;
  console.log("[api] PUT", url, payload);

  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return handleResponse(response, { method: "PUT", url, payload });
}

export async function getJson(path) {
  const url = `${getApiBase()}${path}`;
  console.log("[api] GET", url);

  const response = await fetch(url);
  return handleResponse(response, { method: "GET", url });
}

export async function deleteJson(path) {
  const url = `${getApiBase()}${path}`;
  console.log("[api] DELETE", url);

  const response = await fetch(url, { method: "DELETE" });
  return handleResponse(response, { method: "DELETE", url });
}
