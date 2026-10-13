import type { CSSProperties } from "react";

export type IconName = "star" | "sun" | "arrow" | "home" | "book" | "pin" | "heart" | "work" | "coins" | "close" | "check";
const paths: Record<Exclude<IconName, "star">, string> = {
  sun: "M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  home: "m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z",
  book: "M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v15",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  heart: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
  work: "M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M3 6h18v14H3V6Zm0 6c6 3 12 3 18 0M12 11v5",
  coins: "M20 5c0 2-4 3-8 3S4 7 4 5s4-3 8-3 8 1 8 3Zm0 0v14c0 2-4 3-8 3s-8-1-8-3V5m0 7c0 2 4 3 8 3s8-1 8-3",
  close: "m6 6 12 12M6 18 18 6",
  check: "m5 12 4 4L19 6",
};
export function Icon({ name, className, style }: { name: IconName; className?: string; style?: CSSProperties }) {
  return <svg className={className} style={style} width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">{name === "star" ? <path d="m12 1 2.1 8.9L23 12l-8.9 2.1L12 23l-2.1-8.9L1 12l8.9-2.1Z" fill="currentColor" /> : <path d={paths[name]} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />}</svg>;
}
