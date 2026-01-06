import { tv, type VariantProps } from "tailwind-variants";

export const key = tv({
  slots: {
    root: [
      "inline-flex items-center justify-center",
      "bg-gradient-to-b from-key-bg to-[#151520]",
      "rounded-lg border border-key-border",
      "font-mono font-semibold text-text",
      "transition-all duration-150",
    ],
    shine:
      "pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-b from-white/5 to-transparent",
    wrapper: "flex flex-col items-center gap-2 select-none",
    description: "text-center text-sm text-text-muted",
  },
  variants: {
    size: {
      xs: { root: "h-6 min-w-[24px] rounded px-1.5 text-xs", shine: "rounded" },
      sm: { root: "h-[40px] min-w-[40px] px-3 text-sm" },
      md: { root: "h-[56px] min-w-[56px] px-3 text-base" },
      lg: { root: "h-[72px] min-w-[72px] px-3 text-lg" },
    },
    interactive: {
      true: {
        root: "cursor-pointer hover:border-accent hover:text-accent-bright",
      },
      false: { root: "cursor-default" },
    },
    animate: {
      true: { root: "animate-key-press" },
    },
    wide: {
      true: { root: "px-6" },
    },
  },
  defaultVariants: {
    size: "md",
    interactive: false,
  },
});

export type KeyVariants = VariantProps<typeof key>;
