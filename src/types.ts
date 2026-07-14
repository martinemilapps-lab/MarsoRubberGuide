export interface ProductSpecs {
  code: string;
  sizeDims: string;
  weight: string;
  features: string;
  physicalSpecs: string;
  material: string;
  color: string;
  application: string;
}

export interface Product {
  id: string;
  name: string;
  nameAr?: string;
  category: ProductClassification;
  photo: string;
  extraPhotos?: string[];
  specs: ProductSpecs;
  datasheetFile?: string;
  datasheetName?: string;
}

export type ProductClassification =
  | "Reclaimed and Crumb Rubber"
  | "Rubber Tile Flooring"
  | "Rubber Mat Flooring"
  | "Industrial Rubber Flooring"
  | "Rubber Automotive Spare Parts"
  | "Rubber Car Mats"
  | "Constructive Rubber Industries"
  | "Reverse Engineering";

export interface ChatMessage {
  id: string;
  role: "user" | "model";
  content: string;
  timestamp: Date;
}
