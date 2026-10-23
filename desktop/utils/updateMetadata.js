"use strict";

function getUpdateVersion(info) {
  return String(info?.version || info?.releaseName || "").trim();
}

function getReleaseUrl(info, releasesUrl) {
  const version = getUpdateVersion(info);
  // Policy versions can use the desktop-v, v, or bare version format.
  const bareVersion = version.replace(/^desktop-v/i, "").replace(/^v/i, "");
  return bareVersion ? `${releasesUrl}/tag/desktop-v${bareVersion}` : releasesUrl;
}

function stripHtml(text) {
  return String(text || "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .trim();
}

function normalizeReleaseNotes(notes) {
  if (!notes) return [];
  if (Array.isArray(notes)) {
    return notes
      .map((item) => stripHtml(typeof item === "string" ? item : item?.note || item?.text || item?.message || ""))
      .filter(Boolean)
      .slice(0, 8);
  }
  return stripHtml(notes)
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

function parseVersionParts(version) {
  return String(version || "")
    .replace(/^desktop-v/i, "")
    .replace(/^v/i, "")
    .split(/[.-]/)
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10) || 0);
}

function compareVersions(a, b) {
  const left = parseVersionParts(a);
  const right = parseVersionParts(b);
  for (let index = 0; index < 3; index += 1) {
    if ((left[index] || 0) > (right[index] || 0)) return 1;
    if ((left[index] || 0) < (right[index] || 0)) return -1;
  }
  return 0;
}

module.exports = {
  compareVersions,
  getReleaseUrl,
  getUpdateVersion,
  normalizeReleaseNotes,
};
