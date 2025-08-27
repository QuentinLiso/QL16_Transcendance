// src/ui/Button.ts
import { domElem } from "./DomElement";

export function Button(
  label: string,
  options: {
    onClick?: (e: MouseEvent) => void;
    variant?: "primary" | "ghost" | "danger";
    type?: "button" | "submit";
  } = {}
) {
  const base = "px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition";
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-500",
    ghost: "bg-transparent text-indigo-600 hover:bg-indigo-50",
    danger: "bg-rose-600 text-white hover:bg-rose-500",
  };

  const btn = domElem("button", { class: `${base} ${variants[options.variant ?? "primary"]}`, text: label, attributes: { type: options.type ?? "button" } });
  if (options.onClick) {
    btn.addEventListener("click", options.onClick);
  }
  return btn;
}
