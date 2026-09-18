"use client";

import React, {
  Fragment,
  useEffect,
  useEffectEvent,
  useRef,
} from "react";
import type { FragmentInstance } from "react";

interface InViewProps {
  children: React.ReactNode;
  onChange?: (inView: boolean) => void;
  once?: boolean;
  threshold?: number;
  rootMargin?: string;
}

export function InView({
  children,
  onChange,
  once = false,
  threshold = 0.2,
  rootMargin = "0px",
}: InViewProps) {
  const fragmentRef = useRef<FragmentInstance>(null);
  const reached = useRef(false);
  const notify = useEffectEvent((inView: boolean) => {
    onChange?.(inView);
  });

  useEffect(() => {
    const fragment = fragmentRef.current;
    if (!fragment || (once && reached.current)) return;

    const visible = new Set<Element>();
    const observer = new IntersectionObserver(
      (entries, current) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        }
        const inView = visible.size > 0;
        notify(inView);
        if (once && inView) {
          reached.current = true;
          current.disconnect();
        }
      },
      { threshold, rootMargin }
    );

    fragment.observeUsing(observer);
    return () => fragment.unobserveUsing(observer);
  }, [once, threshold, rootMargin]);

  return <Fragment ref={fragmentRef}>{children}</Fragment>;
}
