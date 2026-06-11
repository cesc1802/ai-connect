// Deterministic hue derived from a workspace id so each workspace gets a
// stable emblem color without persisting one server-side.

export function wsHue(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 360;
}
