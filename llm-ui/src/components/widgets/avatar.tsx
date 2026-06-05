import { cn } from "@/lib/cn";
import { avatarStyle, avatarStyleSolid, initials, type User } from "@/lib/mock-data";

type Props = {
  user: User;
  size?: number;
  solid?: boolean;
  ring?: boolean;
};

export function Avatar({ user, size = 36, solid = false, ring = false }: Props) {
  const style = solid ? avatarStyleSolid(user.hue) : avatarStyle(user.hue);
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none", ring && "ring-2 ring-background")}
      style={{ width: size, height: size, fontSize: size * 0.38, ...style }}
      title={user.name}
    >
      {initials(user.name)}
    </span>
  );
}
