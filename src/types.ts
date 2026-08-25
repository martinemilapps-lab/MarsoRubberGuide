export interface ProductSpecs {
  code: string;
  sizeDims: string;
  weight: string;
  features: string;
  physicalSpecs: string;
  material: string;
  color: string;
  application: string;
  price?: string;
  priceCurrency?: "EGP" | "USD";
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
  datasheetKnowledge?: string;
  hasDatasheet?: boolean;
  price?: string;
  priceCurrency?: "EGP" | "USD";
}

export type ProductClassification = string;

export interface ChatMessage {
  id: string;
  role: "user" | "model";
  content: string;
  timestamp: Date;
}
