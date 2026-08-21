import type { Category } from "./types";

export const SITE = {
  name: "PINAKI Farms",
  tagline: "Ghar Ka Swaad, Shuddhata Ke Saath",
  address: "PINAKI Farms, [Village/City], [State] - [Pincode]",
  fssai: "12345678901234",
  email: "hello@pinakifarms.in",
};

export const CATEGORIES: {
  id: Category;
  label: string;
  hindi: string;
  blurb: string;
}[] = [
  {
    id: "achar",
    label: "Achar",
    hindi: "अचार",
    blurb: "Sun-cured mango, stuffed chili, and mixed farm pickles.",
  },
  {
    id: "ghee",
    label: "A2 Desi Ghee",
    hindi: "घी",
    blurb: "Bilona-churned A2 cow ghee, grainy and aromatic.",
  },
  {
    id: "oil",
    label: "Cold Pressed Oils",
    hindi: "तेल",
    blurb: "Wooden kolhu mustard, sesame, and coconut oil.",
  },
];

export const CATEGORY_LABEL: Record<string, string> = {
  achar: "Achar",
  ghee: "A2 Ghee",
  oil: "Cold Pressed Oil",
  other: "Farm produce",
};
