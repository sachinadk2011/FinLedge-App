import transferDirectionRules from "../../../backend/services/transfer_direction_rules.json";

const normalizeAlias = (value) => String(value || "")
  .trim()
  .toLowerCase()
  .replace(/[→]|->/g, " to ")
  .replace(/[_-]+/g, " ")
  .split(/\s+/)
  .filter(Boolean)
  .join(" ");

const directions = transferDirectionRules.directions;
const aliasToDirection = new Map(
  directions.flatMap((direction) => [direction.value, ...direction.aliases]
    .map((alias) => [normalizeAlias(alias), direction.value]))
);
const directionRules = new Map(directions.map((direction) => [direction.value, direction]));

export const TRANSFER_DIRECTION_OPTIONS = directions.map(({ value, label }) => ({ value, label }));

export function normalizeTransferDirection(value) {
  return aliasToDirection.get(normalizeAlias(value)) || "";
}

function getDirectionRule(direction) {
  const canonical = normalizeTransferDirection(direction);
  if (!canonical) throw new Error("Choose Bank to Cash or Cash to Bank.");
  return directionRules.get(canonical);
}

export function originFlow(direction) {
  return getDirectionRule(direction).origin_flow;
}

export function destinationFlow(direction) {
  return getDirectionRule(direction).destination_flow;
}

export function transferFlowLabel(direction, flow) {
  const rule = getDirectionRule(direction);
  if (flow === rule.origin_flow) return rule.origin_label;
  if (flow === rule.destination_flow) return rule.destination_label;
  throw new Error("Flow must be either bank or cash.");
}

export function transferActionLabel(direction) {
  return getDirectionRule(direction).action_label;
}
