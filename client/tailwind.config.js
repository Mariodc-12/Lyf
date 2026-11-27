export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1B2250',
        'ink-soft': '#2B3475',
        paper: '#F6F7FB',
        line: '#E3E5EE',
        gold: '#F2B134',
        'gold-tint': '#FDF1D3',
        'gold-deep': '#7A5200',
        hibiscus: '#D93A64',
        'hibiscus-tint': '#FCE4EB',
        'hibiscus-deep': '#9A1F42',
        leaf: '#1E9E6A',
        'leaf-tint': '#DDF3E8',
        'leaf-deep': '#0F6B45',
      },
      fontFamily: {
        sans: ['"Figtree Variable"', 'system-ui', 'sans-serif'],
        display: ['"Fraunces Variable"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
