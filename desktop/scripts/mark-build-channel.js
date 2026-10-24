"use strict";

const fs = require("fs");
const path = require("path");

module.exports = async function markBuildChannel(context) {
  const isTestBuild = String(process.env.FINLEDGE_MODE || "").trim().toLowerCase() === "testing";
  const appxApplicationId = String(
    process.env.FINLEDGE_APPX_APPLICATION_ID || context.packager?.config?.appx?.applicationId || ""
  ).trim();
  const marker = isTestBuild
    ? {
        kind: "testing",
        appxBuildNumber: String(process.env.BUILD_NUMBER || "").trim(),
        appxApplicationId,
      }
    : String(process.env.FINLEDGE_DISTRIBUTION_CHANNEL || "").trim().toLowerCase() === "microsoft-store"
      ? { distributionChannel: "microsoft-store", appxApplicationId }
      : null;
  if (!marker) return;

  const resourcesDir = path.join(context.appOutDir, "resources");
  fs.mkdirSync(resourcesDir, { recursive: true });
  fs.writeFileSync(
    path.join(resourcesDir, "finledge-build-channel.json"),
    `${JSON.stringify(marker, null, 2)}\n`,
    "utf8"
  );
};
