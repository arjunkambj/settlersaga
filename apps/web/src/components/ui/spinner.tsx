import refreshIcon from "@iconify-icons/solar/refresh-bold";
import { Icon } from "@iconify/react/offline";

import { cn } from "@/lib/utils";

// Decorative: the control or status text next to it says what is loading.
function Spinner({ className, ...props }: Omit<React.ComponentProps<typeof Icon>, "icon">) {
  return (
    <Icon
      icon={refreshIcon}
      data-slot="spinner"
      className={cn("size-4 motion-safe:animate-spin", className)}
      {...props}
    />
  );
}

export { Spinner };
