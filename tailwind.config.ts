/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', 'class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './features/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
          hover: '#1C31CC', // Darker blue for hover
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
          hover: '#0B1121', // Darker navy for hover
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        blue: {
          DEFAULT: '#233DFF', // Primary brand color
          hover: '#1C31CC', // Darker for hover
        },
        navy: {
          DEFAULT: '#0F172A', // Secondary brand color
          hover: '#0B1121', // Darker for hover
        },
        gray: {
          light: '#E2E8F0', // Tertiary brand color
          lighter: '#F9FAFB', // Senary brand color
          hover: '#CBD5E1', // Darker for hover
        },
        tertiary: {
          DEFAULT: '#233DFF', // Blue
          hover: '#1C31CC', // Darker for hover
        },
        quaternary: {
          DEFAULT: '#0F172A', // Navy
          hover: '#0B1121', // Darker for hover
        },
        quinary: {
          DEFAULT: '#E2E8F0', // Light gray
          hover: '#CBD5E1', // Darker for hover
        },
        senary: {
          DEFAULT: '#F9FAFB', // Lighter gray
          hover: '#E5E7EB', // Darker for hover
        },
        // black: '#000000',
        // white: '#FFFFFF',
        // lightGray: '#9ba3af',
        // darkerGray: '#86868B',
        // hoverGreen: '#06d16b',
        // green: '#00BF63',
        // hoverRed: '#FF3131',
        // red: '#F22121',
        // purple: '#665eff',
        // pink: '#ff4f78',
        // orange: '#ff9057',
        // blacks: {
        // 	'400': '#2D2D2D',
        // 	'500': '#1B1A1A',
        // 	'600': '#151414',
        // 	'700': '#0D0D0D'
        // },
        // blue: {
        // 	'600': '#3531FF'
        // },
        chart: {
          '1': 'var(--chart-1)',
          '2': 'var(--chart-2)',
          '3': 'var(--chart-3)',
          '4': 'var(--chart-4)',
          '5': 'var(--chart-5)',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        heading: ['DM Sans', 'sans-serif'],
        code: ['IBM Plex Mono', 'monospace'],
      },
      fontSize: {
        base: '12px',
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: 0,
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: 0,
          },
        },
        breathing: {
          '0%, 100%': { transform: 'scale(0.95)' },
          '50%': { transform: 'scale(1.05)' },
        },
        'dash-breathing': {
          '0%': { strokeDasharray: '30 330' },
          '50%': { strokeDasharray: '180 180' },
          '100%': { strokeDasharray: '30 330' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'spin-breath': 'spin 1.5s linear infinite, breathing 2s ease-in-out infinite',
        'dash-breathing': 'dash-breathing 2s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
