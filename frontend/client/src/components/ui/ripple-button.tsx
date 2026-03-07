import * as React from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Ripple = {
  id: number;
  x: number;
  y: number;
};

export function RippleButton({
  className,
  children,
  onClick,
  ...props
}: ButtonProps) {
  const [ripples, setRipples] = React.useState<Ripple[]>([]);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const ripple = {
      id: Date.now(),
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };

    setRipples((current) => [...current, ripple]);
    onClick?.(event);
    window.setTimeout(() => {
      setRipples((current) => current.filter((item) => item.id !== ripple.id));
    }, 700);
  };

  return (
    <Button
      className={cn("ripple-button", className)}
      onClick={handleClick}
      {...props}
    >
      {children}
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="ripple"
          style={{ left: ripple.x, top: ripple.y }}
        />
      ))}
    </Button>
  );
}
