import { tv, type VariantProps } from "tailwind-variants";

export const card = tv({
  slots: {
    root: "border border-border bg-bg-card transition-all duration-300",
    glow: "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300",
    content: "relative z-10",
  },
  variants: {
    padding: {
      sm: { root: "p-4" },
      md: { root: "p-5" },
      lg: { root: "p-6" },
    },
    radius: {
      md: { root: "rounded-xl", glow: "rounded-xl" },
      lg: { root: "rounded-2xl", glow: "rounded-2xl" },
    },
    interactive: {
      true: {
        root: "group hover:border-accent/50",
        glow: "group-hover:opacity-100",
      },
    },
    elevated: {
      true: {
        root: "hover:bg-surface",
        glow: "bg-gradient-to-br from-accent/5 to-transparent",
      },
    },
  },
  defaultVariants: {
    padding: "lg",
    radius: "lg",
  },
});

export type CardVariants = VariantProps<typeof card>;
