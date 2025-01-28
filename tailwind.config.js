/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // ensures Tailwind scans all your React files
    "./public/index.html"
  ],
  theme: {
    extend: {}
  },
  plugins: []
};
