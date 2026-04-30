const DESKTOP_API_BASE =
  typeof window !== "undefined" && typeof window.financialTracker?.getBackendBaseUrl === "function"
    ? window.financialTracker.getBackendBaseUrl()
    : "";

const API_BASE = DESKTOP_API_BASE || import.meta.env.VITE_API_BASE_URL || "";

function getApiBase() {
  if (API_BASE) {
    return API_BASE;
  }

  throw new Error("API base URL is not configured. Copy .env.example to .env and set VITE_API_BASE_URL.");
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

async function handleResponse(response, meta) {
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
