import { cn } from "@/lib/utils";

interface CardProps extends React.ComponentProps<"div"> {
  /** Adds the signal border + glow hover affordance (for clickable cards). */
  interactive?: boolean;
}

export function Card({ className, interactive = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "border-ash bg-basalt ease-out-expo rounded-lg border transition duration-200",
        interactive && "hover:border-signal/40 hover:glow-signal",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("p-6", className)} {...props} />;
}

export function CardBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-6 pb-6", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-3 px-6 pb-6", className)}
      {...props}
    />
  );
}
