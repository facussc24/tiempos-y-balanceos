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
    extend: {
      colors: {
        industrial: {
          50:  '#f7f8f9',
          100: '#ebedf0',
          200: '#d1d5db',
          300: '#9ca3af',
          400: '#6b7280',
          500: '#374151',
          600: '#1f2937',
          700: '#111827',
          800: '#0a0f1a',
        },
        status: {
          ok:       '#15803d',
          'ok-bg':  '#f0fdf4',
          warn:     '#b45309',
          'warn-bg':'#fffbeb',
          crit:     '#b91c1c',
          'crit-bg':'#fef2f2',
        },
        accent:  '#1d4ed8',
        'accent-light': '#dbeafe',
      },
      zIndex: {
        'sidebar': '30',
        'header': '40',
        'dropdown': '50',
        'modal-backdrop': '60',
        'modal': '70',
        'toast': '80',
        'tooltip': '90',
        'overlay': '100',
      },
      transitionDuration: {
        'instant': '100ms',
        'fast': '150ms',
        'normal': '250ms',
        'slow': '400ms',
      },
      transitionTimingFunction: {
        'ease-out-custom': 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        'ease-spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        'page-enter': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'card-enter': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'sidebar-item-enter': {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'toast-enter': {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'toast-exit': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(16px)' },
        },
      },
      animation: {
        'page-enter': 'page-enter 250ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        'card-enter': 'card-enter 250ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        'sidebar-item-enter': 'sidebar-item-enter 200ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        'toast-enter': 'toast-enter 200ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        'toast-exit': 'toast-exit 150ms ease-in forwards',
      },
    },
  },
  plugins: [],
}
