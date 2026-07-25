import { getApiBase, handleResponse } from "./client.js";

function getFilenameFromDisposition(contentDisposition, fallback) {
  if (!contentDisposition) {
    return fallback;
  }

  const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(contentDisposition);
  if (!match?.[1]) {
    return fallback;
  }

  try {
    return decodeURIComponent(match[1].replace(/"/g, ""));
  } catch {
    return match[1];
  }
}

async function blobFromResponse(response, meta) {
  if (!response.ok) {
    const data = await readJsonSafe(response);
    const message = data?.detail ? formatDetail(data.detail) : "Request failed";
    throw new Error(message);
  }

  const blob = await response.blob();
  const filename = getFilenameFromDisposition(
    response.headers.get("content-disposition"),
    meta.fallbackFilename || "finledge-export.xlsx"
  );

  return { blob, filename };
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error || new Error("Could not read export file."));
    reader.readAsDataURL(blob);
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function saveExportBlob(blob, filename) {
  const bridge =
    typeof window !== "undefined" && window.financialTracker?.saveExportFile
      ? window.financialTracker
      : null;

  if (bridge) {
    const base64 = await blobToBase64(blob);
    const result = await bridge.saveExportFile({ defaultName: filename, base64 });
    if (result?.cancelled) {
      return { cancelled: true };
    }
    if (result?.ok === false) {
      throw new Error("Could not save the export file.");
    }
    return { cancelled: false, path: result?.path || "" };
  }

  downloadBlob(blob, filename);
  return { cancelled: false };
}

export async function getSettingsDataTypes() {
  const url = `${getApiBase()}/settings/data-types`;
  const response = await fetch(url);
  return handleResponse(response, { method: "GET", url });
}

export async function checkSettingsDataHasData(dataType) {
  const url = `${getApiBase()}/settings/has-data/${encodeURIComponent(dataType)}`;
  const response = await fetch(url);
  const data = await handleResponse(response, { method: "GET", url });
  return data?.has_data === true;
}

export async function importSettingsDataFile(dataType, file, mode = "replace") {
  const url = `${getApiBase()}/settings/import/${encodeURIComponent(dataType)}`;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("mode", mode);

  const response = await fetch(url, {
    method: "POST",
    body: formData,
  });

  return handleResponse(response, { method: "POST", url, dataType, filename: file?.name, mode });
}

export async function exportSettingsDataFile(dataType) {
  const url = `${getApiBase()}/settings/export/${encodeURIComponent(dataType)}`;
  const response = await fetch(url);
  const { blob, filename } = await blobFromResponse(response, {
    method: "GET",
    url,
    fallbackFilename: `${dataType}.xlsx`,
  });
  return saveExportBlob(blob, filename);
}

export async function exportAllSettingsDataFiles() {
  const url = `${getApiBase()}/settings/export-all`;
  const response = await fetch(url);
  const { blob, filename } = await blobFromResponse(response, {
    method: "GET",
    url,
    fallbackFilename: "finledge-data-export.zip",
  });
  return saveExportBlob(blob, filename);
}
