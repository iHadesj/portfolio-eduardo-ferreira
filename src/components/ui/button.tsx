import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * size is declared before variant so the `link` variant's overrides win the
 * tailwind-merge tie-break (and `!` keeps them robust regardless).
 */
const buttonVariants = cva(
  "rounded-sm font-body ease-out-expo inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap transition duration-200 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-5 text-[0.9375rem]",
        lg: "h-12 px-6 text-base",
      },
      variant: {
        primary:
          "bg-signal-gradient text-abyss glow-signal hover:-translate-y-0.5",
        ghost:
          "border-ash text-smoke hover:border-signal hover:text-bone border",
        link: "text-signal link-underline !h-auto !rounded-none !px-0 hover:bg-[length:100%_1px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  type,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      type={asChild ? undefined : (type ?? "button")}
      {...props}
    />
  );
}

export { buttonVariants };
