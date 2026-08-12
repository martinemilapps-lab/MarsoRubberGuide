import { ProductClassification } from "./types";

export const DEFAULT_PRODUCT_CATEGORIES: string[] = [
  "Reclaimed and Crumb Rubber",
  "Rubber Tile Flooring",
  "Rubber Mat Flooring",
  "Industrial Rubber Flooring",
  "Rubber Automotive Spare Parts",
  "Rubber Car Mats",
  "Constructive Rubber Industries",
  "Reverse Engineering"
];

export const PRODUCT_CATEGORIES: string[] = [...DEFAULT_PRODUCT_CATEGORIES];

export const CATEGORY_DETAILS: Record<
  string,
  { iconName: string; description: string; color: string; bg: string }
> = {
  "Reclaimed and Crumb Rubber": {
    iconName: "Layers",
    description: "Eco-friendly reclaimed rubber sheets, granules, and powders recycled from scrap tires.",
    color: "text-emerald-600 border-emerald-200",
    bg: "bg-emerald-50"
  },
  "Rubber Tile Flooring": {
    iconName: "Grid",
    description: "Shock-absorbing, soundproof gym and sports arena tiles, tartan track substrates, and safety tiles.",
    color: "text-blue-600 border-blue-200",
    bg: "bg-blue-50"
  },
  "Rubber Mat Flooring": {
    iconName: "Square",
    description: "Anti-bacterial floor coverings customized for agricultural horse stables and cow milking stations.",
    color: "text-amber-600 border-amber-200",
    bg: "bg-amber-50"
  },
  "Industrial Rubber Flooring": {
    iconName: "ShieldAlert",
    description: "Safety electrical-insulating mats, fire-retardant floorings, and vibration-dampener floor sheets.",
    color: "text-indigo-600 border-indigo-200",
    bg: "bg-indigo-50"
  },
  "Rubber Automotive Spare Parts": {
    iconName: "Wrench",
    description: "High-grade mechanical seals, fuel-resistant gaskets, engine damper mounts, and hull fenders.",
    color: "text-rose-600 border-rose-200",
    bg: "bg-rose-50"
  },
  "Rubber Car Mats": {
    iconName: "Compass",
    description: "All-weather anti-skid tailored car footwells and customizable composite floor liners.",
    color: "text-purple-600 border-purple-200",
    bg: "bg-purple-50"
  },
  "Constructive Rubber Industries": {
    iconName: "Home",
    description: "Heavy construction bridge joints, structural bearing pads, expansion seals, and EPDM facade profiles.",
    color: "text-sky-600 border-sky-200",
    bg: "bg-sky-50"
  },
  "Reverse Engineering": {
    iconName: "RotateCcw",
    description: "Complete replication capabilities of any custom rubber part or sealing profile from drawing or sample.",
    color: "text-red-600 border-red-300",
    bg: "bg-red-50"
  }
};

export function getCategoryDetails(cat: string) {
  if (CATEGORY_DETAILS[cat]) {
    return CATEGORY_DETAILS[cat];
  }
  return {
    iconName: "Layers",
    description: "Custom technical rubber product classification.",
    color: "text-red-600 border-red-200",
    bg: "bg-red-50"
  };
}

export function categoryToSlug(category: string | "All"): string {
  if (category === "All") return "";
  return category
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function slugToCategory(path: string, categoriesList: string[] = PRODUCT_CATEGORIES): string | "All" {
  if (!path) return "All";
  const cleanPath = decodeURIComponent(path).split("?")[0].replace(/^\/+|\/+$/g, "");
  if (!cleanPath || cleanPath.toLowerCase() === "all" || cleanPath.toLowerCase() === "catalog") {
    return "All";
  }

  const list = categoriesList && categoriesList.length > 0 ? categoriesList : PRODUCT_CATEGORIES;
  const exact = list.find(c => c.toLowerCase() === cleanPath.toLowerCase());
  if (exact) return exact;

  const normalize = (str: string) =>
    str
      .toLowerCase()
      .replace(/^\d+[\.\-_s]*/, "")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]/g, "");

  const targetNormalized = normalize(cleanPath);

  const matched = list.find(c => normalize(c) === targetNormalized);
  return matched || "All";
}
