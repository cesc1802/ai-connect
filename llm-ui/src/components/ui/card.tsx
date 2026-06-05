import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };

export function Card({ className = "", children, ...props }: Props) {
  return (
    <div
      className={cn("bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children }: Props) {
  return <div className={cn("flex flex-col gap-1 px-6", className)}>{children}</div>;
}

export function CardTitle({ className = "", children }: Props) {
  return <div className={cn("leading-none font-semibold", className)}>{children}</div>;
}

export function CardDescription({ className = "", children }: Props) {
  return <div className={cn("text-muted-foreground text-sm", className)}>{children}</div>;
}

export function CardContent({ className = "", children }: Props) {
  return <div className={cn("px-6", className)}>{children}</div>;
}
