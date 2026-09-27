import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-2xl border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-hidden select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive/50 aria-invalid:ring-3 aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-border bg-transparent hover:bg-input/30 hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted/50 hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/80 focus-visible:border-destructive/40 focus-visible:ring-destructive/30",
        // Game buttons: pills, or circles for the icon ones. Their faces, lines, press, focus
        // and disabled states live in `.game-button*` (app/styles/menu.css); pair them with the
        // `game-*` sizes. Gold is the primary, `game` the royal secondary, `game-secondary` the
        // quiet one beside a primary (Go back, Cancel).
        game: "game-button",
        "game-secondary": "game-button-secondary",
        "game-gold": "game-button-gold",
        "game-danger": "game-button-danger",
        "game-ghost": "game-button-ghost",
        "game-icon": "game-button-icon [&_svg:not([class*='size-'])]:size-5",
        "game-icon-danger": "game-button-icon-danger [&_svg:not([class*='size-'])]:size-5",
      },
      size: {
        default:
          "h-8 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        sm: "h-7 gap-1 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        lg: "h-9 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-8",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7",
        // Pill heights 36, 44 and 52px.
        "game-sm": "h-9 gap-1.5 px-4 text-sm",
        "game-md": "h-11 gap-2 px-5 text-base",
        "game-lg": "h-13 gap-2.5 px-7 text-lg",
      },
    },
    compoundVariants: [
      { variant: ["game-icon", "game-icon-danger"], size: "game-sm", class: "size-9 px-0" },
      { variant: ["game-icon", "game-icon-danger"], size: "game-md", class: "size-10 px-0" },
      {
        variant: ["game-icon", "game-icon-danger"],
        size: "game-lg",
        class: "size-12 px-0 [&_svg:not([class*='size-'])]:size-6",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
