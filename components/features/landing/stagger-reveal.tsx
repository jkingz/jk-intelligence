"use client";

import React, { useState } from "react";
import { useReducedMotion } from "motion/react";
import { InView } from "@/components/ui/in-view";
import { cn } from "@/lib/utils";

interface StaggerRevealProps {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
  start?: string;
  end?: string;
}

export function StaggerReveal({
  children,
  className,
  stagger = 60,
  delay = 0,
  start = "opacity-0 translate-y-6",
  end = "opacity-100 translate-y-0",
}: StaggerRevealProps) {
  const shouldReduceMotion = useReducedMotion();
  const [revealed, setRevealed] = useState(false);
  const isRevealed = revealed || shouldReduceMotion === true;

  const items = React.Children.toArray(children);

  return (
    <InView once onChange={setRevealed}>
      <div className={cn(className)}>
        {items.map((child, index) => (
          <div
            key={index}
            style={{ transitionDelay: isRevealed ? `${delay + index * stagger}ms` : undefined }}
            className={cn(
              "transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
              isRevealed ? end : start,
            )}
          >
            {child}
          </div>
        ))}
      </div>
    </InView>
  );
}