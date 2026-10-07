/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Neutral palette — matches Figma #0f172a → #f8fafc
        ink: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        // Brand — MatchUp blue, from the mobile app's actual design system
        // (apps/mobile/lib/core/theme/app_colors.dart: primary #0B1F8A).
        // Primary sits at 500 to match the existing bg-brand-500 / hover:bg-brand-600
        // conventions already used throughout this codebase.
        brand: {
          50:  '#eef2ff',
          100: '#dbeafe',
          200: '#b9cffb',
          300: '#8fadf6',
          400: '#4f72e0',
          500: '#0b1f8a',   // MatchUp primary blue
          600: '#0a1b73',
          700: '#0f1a52',
          800: '#0b1440',
          900: '#070d2b',
        },
        // Accent — MatchUp orange (#FF6B00), for the same "second, distinguishing
        // color" role `sky`/brand-400 played before (chart series, gradients,
        // sparklines). Used sparingly, same as on mobile.
        accent: {
          50:  '#fff4ec',
          100: '#ffe5d0',
          200: '#ffc79b',
          300: '#ffab66',
          400: '#ff8a33',
          500: '#ff6b00',
          600: '#e05f00',
          700: '#b84c00',
          800: '#8f3b00',
          900: '#662a00',
        },
        // Semantic states — 500 unchanged, 600/700 upgraded to the mobile
        // team's contrast-audited values (statusSuccessText, warningStrong, errorStrong).
        success: {
          100: '#dcfce7',
          500: '#22c55e',
          600: '#04694a',
          700: '#014a34',
        },
        warning: {
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#b45309',
          700: '#7c3d05',
        },
        danger: {
          100: '#fee2e2',
          500: '#ef4444',
          600: '#b91c1c',
          700: '#7f1414',
        },
      },
      spacing: {
        sidebar: '260px',   // Figma: 260px sidebar width
        topbar:  '64px',
      },
      fontFamily: {
        // Figma uses Figtree — load from Google Fonts in index.css
        sans: ['Figtree', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        panel: '0 4px 24px -4px rgb(0 0 0 / 0.08)',
      },
    },
  },
  plugins: [],
};
