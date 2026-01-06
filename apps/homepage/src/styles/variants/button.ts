import { tv, type VariantProps } from "tailwind-variants";

export const button = tv({
  base: [
    "inline-flex items-center justify-center gap-2",
    "rounded-xl font-semibold",
    "transition-all duration-200",
  ],
  variants: {
    variant: {
      primary:
        "glow-accent bg-accent text-white hover:scale-105 hover:bg-accent-bright",
      secondary:
        "border border-border bg-surface text-text hover:border-accent/50 hover:bg-bg-card",
      ghost: "text-text-muted hover:text-text",
    },
    size: {
      sm: "px-4 py-2 text-sm",
      md: "px-6 py-3 text-base",
      lg: "px-8 py-4 text-lg",
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "md",
  },
});

export type ButtonVariants = VariantProps<typeof button>;
