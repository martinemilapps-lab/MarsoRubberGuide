import { ProductClassification } from "./types";

export const PRODUCT_CATEGORIES: ProductClassification[] = [
  "Reclaimed and Crumb Rubber",
  "Rubber Tile Flooring",
  "Rubber Mat Flooring",
  "Industrial Rubber Flooring",
  "Rubber Automotive Spare Parts",
  "Rubber Car Mats",
  "Constructive Rubber Industries",
  "Reverse Engineering"
];

export const CATEGORY_DETAILS: Record<
  ProductClassification,
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
