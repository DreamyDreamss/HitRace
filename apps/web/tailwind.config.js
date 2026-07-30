/** @type {import('tailwindcss').Config} */
// Design tokens lifted verbatim from docs/DESIGN_TOKENS.md (from the .dc.html spec).
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#08090B',
        screen: '#0B0C0E',
        deep: '#0E1014',
        surface: '#12141A',
        'surface-2': '#14161B',
        'surface-3': '#1B1E25',
        'surface-4': '#282C34',
        text: '#F2F3F5',
        'text-2': '#C6CBD3',
        'text-3': '#9AA1AC',
        muted: '#5E656F',
        gold: '#D9A227',
        'gold-2': '#E8C56A',
        'gold-3': '#F0C15C',
        'gold-hi': '#FFE9B0',
        blue: '#8FA6C4',
        purple: '#B48CF0',
        red: '#E85A3C',
        slate: '#5E656F',
      },
      fontFamily: {
        sans: ['Pretendard Variable', 'Pretendard', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
      borderColor: {
        hair: 'rgba(255,255,255,.07)',
        'hair-2': 'rgba(255,255,255,.12)',
      },
      borderRadius: {
        card: '14px',
        pill: '999px',
      },
      keyframes: {
        pulse2: { '0%,100%': { opacity: '.35' }, '50%': { opacity: '1' } },
        reveal: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'none' } },
        forgeIn: {
          '0%': { opacity: '0', transform: 'scale(.6) rotate(-6deg)', filter: 'brightness(2.4)' },
          '60%': { opacity: '1', transform: 'scale(1.06) rotate(1deg)', filter: 'brightness(1.5)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(0)', filter: 'brightness(1)' },
        },
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
        pop: { '0%': { opacity: '0', transform: 'scale(.5)' }, '70%': { transform: 'scale(1.12)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        spark: { '0%': { opacity: '.9', transform: 'scale(.2)' }, '100%': { opacity: '0', transform: 'scale(2.2)' } },
      },
      animation: {
        pulse2: 'pulse2 1.6s ease-in-out infinite',
        reveal: 'reveal .5s ease both',
        forgeIn: 'forgeIn .85s cubic-bezier(.2,.8,.2,1) both',
        shake: 'shake .3s ease',
        pop: 'pop .4s cubic-bezier(.2,.8,.2,1) both',
        spark: 'spark .8s ease-out both',
      },
    },
  },
  plugins: [],
};
