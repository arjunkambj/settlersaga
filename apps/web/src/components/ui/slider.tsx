import { Slider as SliderPrimitive } from "@base-ui/react/slider";

import { cn } from "@/lib/utils";

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: SliderPrimitive.Root.Props) {
  const values = Array.isArray(value)
    ? value
    : Array.isArray(defaultValue)
      ? defaultValue
      : [min, max];

  return (
    <SliderPrimitive.Root
      className={cn("data-horizontal:w-full data-vertical:h-full", className)}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      thumbAlignment="edge"
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none data-disabled:opacity-60 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative grow overflow-hidden rounded-full border-2 border-well-line bg-well-fill inset-shadow-well-deep select-none data-horizontal:h-3 data-horizontal:w-full data-vertical:h-full data-vertical:w-3"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="bg-linear-to-r from-ui-primary to-primary select-none data-horizontal:h-full data-vertical:w-full"
          />
        </SliderPrimitive.Track>
        {Array.from({ length: values.length }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            className="block size-6 shrink-0 rounded-full border-2 border-game-outline bg-foreground shadow-lip-sm transition-[scale,box-shadow] duration-150 select-none focus-visible:ring-3 focus-visible:ring-ui-focus-ring focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-60 hover:shadow-knob motion-safe:active:scale-95"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
