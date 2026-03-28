"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function ScrollRevealProvider() {
  const pathname = usePathname();

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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

    function registerNode(node: HTMLElement, index: number) {
      if (prefersReduced) {
        node.classList.remove("reveal-init");
        node.classList.add("is-visible");
        return;
      }
      if (!node.classList.contains("reveal-init")) {
        node.classList.add("reveal-init");
      }
      node.style.setProperty("--reveal-delay", `${Math.min(index * 32, 220)}ms`);
      observer.observe(node);
    }

    function scan() {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>(".reveal-on-scroll"));
      nodes.forEach((node, index) => registerNode(node, index));
    }

    scan();

    const mutationObserver = new MutationObserver(() => {
      scan();
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, [pathname]);

  return null;
}
