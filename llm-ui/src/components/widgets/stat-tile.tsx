import { Icon } from "@/lib/icons";

type Props = {
  icon: string;
  label: string;
  value: string;
  sub?: string;
};

export function StatTile({ icon, label, value, sub }: Props) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-md bg-muted p-2">
          <Icon name={icon} className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold leading-tight">{value}</p>
          {sub && <p className="text-2xs text-muted-foreground">{sub}</p>}
        </div>
      </div>
    </div>
  );
}
