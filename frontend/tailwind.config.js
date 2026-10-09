/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: '#090a0f',
          subtle: '#0d0f15',
        },
        panel: {
          DEFAULT: '#111318',
          elevated: '#171a22',
          highlight: '#1e222d',
        },
        border: {
          subtle: '#1e222b',
          muted: '#2a2f3d',
          active: '#3d4458',
        },
        accent: {
          emerald: '#10b981',
          emeraldDim: 'rgba(16, 185, 129, 0.15)',
          violet: '#8b5cf6',
          violetDim: 'rgba(139, 92, 246, 0.15)',
          indigo: '#6366f1',
          amber: '#f59e0b',
          red: '#ef4444',
        },
      },
      fontFamily: {
        sans: ['Geist', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        workstation: '0 8px 32px 0 rgba(0, 0, 0, 0.45)',
        glow: '0 0 15px -3px rgba(16, 185, 129, 0.2)',
      },
    },
  },
  plugins: [],
}
