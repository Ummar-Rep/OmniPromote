export const EMIRATES = [
  "Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah",
] as const;

export const EVENT_CATEGORIES = [
  "conference", "exhibition", "sports", "concert", "festival", "community", "corporate", "education", "other",
] as const;

export const COMPANY_TYPES = [
  "hospital", "university", "school", "bank", "real_estate", "retail", "tech", "hospitality",
  "government", "event_company", "community", "other",
] as const;

export const PRICE_TYPES = ["fixed", "open_offer", "in_kind"] as const;

export const HIDDEN_TOKEN = "[contact hidden]";

export const AD_SPACE_TYPES = [
  "billboard", "digital_screen", "mall_screen", "transit", "airport", "street_furniture", "venue_screen", "other",
] as const;

// Map centre for each emirate, used as the default view and starting pin.
export const EMIRATE_CENTERS: Record<string, [number, number]> = {
  "Abu Dhabi": [24.4539, 54.3773],
  Dubai: [25.2048, 55.2708],
  Sharjah: [25.3463, 55.4209],
  Ajman: [25.4052, 55.5136],
  "Umm Al Quwain": [25.5647, 55.5552],
  "Ras Al Khaimah": [25.8007, 55.9762],
  Fujairah: [25.1288, 56.3265],
};
export const UAE_CENTER: [number, number] = [24.9, 55.2];
