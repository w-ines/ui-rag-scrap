import { forwardRef, type ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={[
        "inline-flex h-11 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white",
        "transition-colors hover:bg-blue-500 active:bg-blue-600/90",
        "disabled:cursor-not-allowed disabled:bg-foreground/20",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
});


