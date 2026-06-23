/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Graphite ink + cool technical paper. Deliberately not "cream".
        ink: '#16181D',
        paper: '#F1F3F5',
        surface: '#FFFFFF',
        hairline: '#DDE1E6',
        muted: '#6B7280',
        // Signature industrial-orange accent (shop / safety vibe).
        rail: {
          DEFAULT: '#E8541E',
          dark: '#C8430F',
          tint: '#FCEAE2',
        },
        // Default category tag colors (teams can add their own).
        mechanical: '#3B6EA5',
        electrical: '#E0A800',
        code: '#1F9D79',
        strategy: '#7C5CBF',
        // Status
        progress: '#D9821B',
        solved: '#1F9D79',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(22,24,29,0.04), 0 1px 3px rgba(22,24,29,0.06)',
        lift: '0 8px 24px rgba(22,24,29,0.12)',
      },
    },
  },
  plugins: [],
}
