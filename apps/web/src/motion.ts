import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useLayoutEffect, type RefObject } from "react";

gsap.registerPlugin(ScrollTrigger);
export const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const EASE = "power4.out"; // ~ cubic-bezier(.22,1,.36,1)

let lenis: Lenis | null = null;
export function initScroll() {
  if (reduced() || lenis) return;
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis?.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
export function scrollToTop() { if (lenis) lenis.scrollTo(0, { immediate: true }); else window.scrollTo(0, 0); }

/** Declarative page motion driven by data attributes inside `root`:
 *  [data-lines] → children .ln>span slide up · [data-reveal] → slide up + fade · [data-parallax="n"] → scrubbed y shift
 *  [data-slide-x="n"] → scrubbed horizontal slide · [data-stagger] → direct children reveal in sequence */
export function useMotion(root: RefObject<HTMLElement>, deps: unknown[] = []) {
  useLayoutEffect(() => {
    if (reduced() || !root.current) return;
    const ctx = gsap.context(() => {
      root.current!.querySelectorAll<HTMLElement>("[data-lines]").forEach((el) => {
        gsap.from(el.querySelectorAll(".ln>span"), { yPercent: 115, duration: 0.9, ease: EASE, stagger: 0.08, delay: el.dataset.delay ? Number(el.dataset.delay) : 0, scrollTrigger: { trigger: el, start: "top 90%", once: true } });
      });
      root.current!.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
        gsap.from(el, { y: 70, opacity: 0, duration: 0.7, ease: EASE, scrollTrigger: { trigger: el, start: "top 90%", once: true } });
      });
      root.current!.querySelectorAll<HTMLElement>("[data-stagger]").forEach((el) => {
        gsap.from(el.children, { y: 60, opacity: 0, duration: 0.7, ease: EASE, stagger: 0.1, scrollTrigger: { trigger: el, start: "top 88%", once: true } });
      });
      root.current!.querySelectorAll<HTMLElement>("[data-parallax]").forEach((el) => {
        const n = Number(el.dataset.parallax || 40);
        gsap.fromTo(el, { y: n }, { y: -n, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 0.6 } });
      });
      root.current!.querySelectorAll<HTMLElement>("[data-slide-x]").forEach((el) => {
        const n = Number(el.dataset.slideX || 200);
        gsap.fromTo(el, { x: n }, { x: -n * 0.2, ease: "none", scrollTrigger: { trigger: el, start: "top 95%", end: "top 25%", scrub: 0.6 } });
      });
      root.current!.querySelectorAll<HTMLElement>("[data-marquee]").forEach((el) => {
        gsap.fromTo(el, { xPercent: 8 }, { xPercent: -38, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 0.5 } });
      });
    }, root);
    const t = setTimeout(() => ScrollTrigger.refresh(), 400);
    return () => { clearTimeout(t); ctx.revert(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { const f = () => ScrollTrigger.refresh(); addEventListener("load", f); return () => removeEventListener("load", f); }, []);
}
