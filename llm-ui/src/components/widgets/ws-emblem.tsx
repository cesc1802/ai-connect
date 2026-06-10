import { Icon } from "@/lib/icons";

// Structural prop: anything with a hue renders, so both mock Workspace
// objects and API-backed summaries (hue derived client-side) work.
type Props = {
  ws: { hue: number };
  size?: number;
};

export function WsEmblem({ ws, size = 36 }: Props) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-lg"
      style={{
        width: size,
        height: size,
        background: `oklch(0.92 0.06 ${ws.hue})`,
        color: `oklch(0.45 0.13 ${ws.hue})`,
      }}
    >
      <Icon name="layers" size={Math.round(size * 0.5)} />
    </span>
  );
}
