/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Charcoal surfaces, warm paper-white line work, one amber glow accent
        ink: {
          950: '#0b0b0d',
          900: '#0e0e10',
          850: '#131316',
          800: '#18181c',
          700: '#232328',
          600: '#2e2e34',
        },
        paper: {
          DEFAULT: '#ece9e2',
          dim: '#b9b6ae',
          mute: '#8a877f',
          faint: '#5c5a55',
        },
        glow: {
          DEFAULT: '#f2c14e',
          soft: '#f6d488',
        },
        danger: '#e5735f',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      maxWidth: {
        page: '1160px',
      },
    },
  },
  plugins: [],
}
