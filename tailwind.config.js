import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url)).replace(/\\/g, '/');

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    `${__dirname}/index.html`,
    `${__dirname}/*.{js,ts,jsx,tsx}`,
    `${__dirname}/modules/**/*.{js,ts,jsx,tsx}`,
    `${__dirname}/components/**/*.{js,ts,jsx,tsx}`,
    `${__dirname}/hooks/**/*.{js,ts,jsx,tsx}`,
    `${__dirname}/utils/**/*.{js,ts,jsx,tsx}`,
  ],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
}
