export const BRAND_COLORS = {
  HOT_PINK: "#FF2E93",
  ACID_LIME: "#C6FF00",
  ELECTRIC_PURPLE: "#7B2FFF",
  BANANA_YELLOW: "#FFE600",
  BLACK: "#000000",
  DARK_BG: "#0a0a0f",
  CARD_SURFACE: "#13131e",
} as const;

export const ROTATING_LOADING_MESSAGES = [
  "CONSULTING THE CAT COUNCIL...",
  "MEASURING YOUR CHAOS...",
  "SNIFFING YOUR VIBES...",
  "CALCULATING PURR-CENTAGE...",
] as const;

export const EXPRESSION_BLURBS: Record<string, string> = {
  Happy: "Certified good-vibes gremlin. Your nine lives are currently booked and busy.",
  Surprised: "Your brain just encountered a side quest it absolutely did not prepare for.",
  Neutral: "Emotionally buffering... but somehow still photogenic.",
  "Eyes Closed": "Bro has temporarily left the simulation.",
};

export function getExpressionBlurb(expression: string | null | undefined): string {
  if (!expression) return "Pure unadulterated feline chaos energy.";
  const key = Object.keys(EXPRESSION_BLURBS).find(
    (k) => k.toLowerCase() === expression.toLowerCase().trim()
  );
  return key ? EXPRESSION_BLURBS[key] : "Mysterious vibes detected from the cat council.";
}
