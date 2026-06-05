import { Avatar } from "./avatar";
import { userById } from "@/lib/mock-data";

type Props = {
  uids: string[];
  max?: number;
  size?: number;
};

export function AvatarStack({ uids, max = 5, size = 28 }: Props) {
  const shown = uids.slice(0, max);
  const extra = uids.length - shown.length;
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {shown.map((uid) => {
          const u = userById(uid);
          return u ? <Avatar key={uid} user={u} size={size} ring /> : null;
        })}
      </div>
      {extra > 0 && (
        <span
          className="ml-1.5 inline-flex items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground ring-2 ring-background"
          style={{ width: size, height: size }}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
