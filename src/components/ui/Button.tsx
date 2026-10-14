import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
  busy?: boolean;
};

/** Explicit submit opt-in prevents accidental form submissions by utility buttons. */
export function Button({ variant = "primary", busy = false, disabled, className, type = "button", ...props }: ButtonProps) {
  return <button {...props} type={type} disabled={disabled || busy} aria-busy={busy || undefined}
    className={["button", variant === "secondary" ? "secondary" : "", className].filter(Boolean).join(" ")} />;
}
