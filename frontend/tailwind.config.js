/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "brand-pink": "#FF2E93",
        "brand-lime": "#C6FF00",
        "brand-purple": "#7B2FFF",
        "brand-yellow": "#FFE600",
        "brand-black": "#000000",
        "brand-dark": "#0a0a0f",
        "brand-surface": "#12121c",
      },
      boxShadow: {
        "hard-sm": "3px 3px 0px #000000",
        "hard": "5px 5px 0px #000000",
        "hard-lg": "8px 8px 0px #000000",
        "hard-xl": "12px 12px 0px #000000",
        "hard-lime": "6px 6px 0px #C6FF00",
        "hard-pink": "6px 6px 0px #FF2E93",
        "hard-yellow": "6px 6px 0px #FFE600",
      },
      fontFamily: {
        heading: ["Bangers", "cursive", "sans-serif"],
        arcade: ['"Rubik Mono One"', "sans-serif"],
        body: ['"Space Grotesk"', "sans-serif"],
        meme: ['"Comic Neue"', "cursive", "sans-serif"],
      },
      borderWidth: {
        "3": "3px",
        "4": "4px",
        "6": "6px",
      },
      keyframes: {
        wiggle: {
          "0%, 100%": { transform: "rotate(-3deg)" },
          "50%": { transform: "rotate(3deg)" },
        },
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
        laser: {
          "0%": { top: "5%" },
          "50%": { top: "92%" },
          "100%": { top: "5%" },
        },
      },
      animation: {
        wiggle: "wiggle 1.2s ease-in-out infinite",
        marquee: "marquee 18s linear infinite",
        laser: "laser 2.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
