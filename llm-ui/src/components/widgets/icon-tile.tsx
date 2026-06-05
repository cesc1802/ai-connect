import { cn } from "@/lib/cn";
import { Icon } from "@/lib/icons";

type Props = {
  icon: string;
  size?: number;
  tone?: "primary" | "muted";
  emoji?: string;
};

const TONES = {
  primary: "bg-primary/10 text-primary",
  muted: "bg-muted text-muted-foreground",
} as const;

export function IconTile({ icon, size = 36, tone = "primary", emoji }: Props) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-lg", TONES[tone])}
      style={{ width: size, height: size }}
    >
      {emoji ? <span style={{ fontSize: size * 0.5 }}>{emoji}</span> : <Icon name={icon} size={Math.round(size * 0.5)} />}
    </span>
  );
}
