/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0f0b1a",
        card: "#1c1530",
        accent: "#8b5cf6",
        secondary: "#38bdf8",
      },
    },
  },
  plugins: [],
};
