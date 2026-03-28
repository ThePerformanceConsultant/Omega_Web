"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function ScrollRevealProvider() {
  const pathname = usePathname();

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(".reveal-on-scroll"));
    if (nodes.length === 0) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      nodes.forEach((node) => node.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.14, rootMargin: "0px 0px -8% 0px" },
    );

    nodes.forEach((node, index) => {
      node.style.setProperty("--reveal-delay", `${Math.min(index * 32, 220)}ms`);
      observer.observe(node);
    });

    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
