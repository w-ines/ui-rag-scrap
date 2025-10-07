import { forwardRef, type InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { className, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={[
        "h-11 w-full rounded-md border border-foreground/15 bg-background/80 px-3 text-sm outline-none",
        "placeholder:text-foreground/40",
        "focus:border-foreground/25 focus:ring-2 focus:ring-blue-500/30",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
});


