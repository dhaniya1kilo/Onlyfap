/** @type {import('tailwindcss').Config} */
// OnlyFap design tokens. Original palette: ink (near-black violet) surfaces,
// "flame" rose-red accent, "velvet" violet secondary, "mint" for success.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0C0B10', 2: '#15131C', 3: '#211E2B', line: '#322D40' },
        // flame DEFAULT is used for filled buttons (white text passes WCAG AA);
        // flame-soft is used for text/icons on dark surfaces.
        flame: { DEFAULT: '#E11D48', soft: '#FF7093', deep: '#BE123C' },
        velvet: '#8B5CF6',
        mint: '#34D399',
        fg: '#F6F4FA',
        muted: '#ABA5BC',
        danger: '#FF8FA3',
      },
      fontFamily: {
        display: ['Sora', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      keyframes: {
        'heart-pop': {
          '0%': { transform: 'scale(0.2)', opacity: '0' },
          '15%': { transform: 'scale(1.25)', opacity: '1' },
          '30%': { transform: 'scale(0.95)' },
          '45%,80%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(1.1) translateY(-24px)', opacity: '0' },
        },
      },
      animation: { 'heart-pop': 'heart-pop 0.9s ease-out forwards' },
    },
  },
  plugins: [],
};
