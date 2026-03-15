/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        soft: "0 18px 45px rgba(15, 23, 42, 0.12)",
      },
    },
  },
  corePlugins: {
    // Avoid breaking existing handcrafted CSS across the app.
    preflight: false,
  },
  plugins: [],
};

