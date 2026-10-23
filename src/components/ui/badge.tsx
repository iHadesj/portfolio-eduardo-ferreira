import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "rounded-sm text-label inline-flex items-center gap-1.5 border px-2.5 py-0.5 font-mono uppercase",
  {
    variants: {
      variant: {
        default: "border-ash text-smoke",
        signal: "border-signal/40 text-signal",
        flare: "border-flare/40 text-flare",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.ComponentProps<"span">, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { badgeVariants };
