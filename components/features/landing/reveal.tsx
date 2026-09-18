"use client";

import React, { useState } from "react";
import { useReducedMotion } from "motion/react";
import { InView } from "@/components/ui/in-view";
import { cn } from "@/lib/utils";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const shouldReduceMotion = useReducedMotion();
  const [revealed, setRevealed] = useState(false);
  const isRevealed = revealed || shouldReduceMotion === true;

  return (
    <InView once onChange={setRevealed}>
      <div
        style={delay ? { transitionDelay: `${delay}ms` } : undefined}
        className={cn(
          "transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          isRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
          className
        )}
      >
        {children}
      </div>
    </InView>
  );
}