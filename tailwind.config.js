/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./hugo_stats.json",
  ],
  safelist: [
    'lg:static',
    'lg:transform-none',
    'lg:flex-row',
    'lg:h-auto',
    'lg:w-auto',
    'lg:bg-transparent',
    'lg:shadow-none',
    'lg:gap-10',
    'lg:max-w-[998px]',
  ],
  theme: {
    extend: {
      colors: {
        'dark-black': '#201B20',
        'orange': '#FF4405',
        'yellow': '#FFC107',
        'yellowdark': '#FEC007',
        'grey': '#CDCDCD',
        'lightGray': '#9C9898',
        'blue': '#5865F2',
        'skyblue': '#01befe',
        'pink': '#FF69B4',
        'red': '#FF4504',
      },
      fontSize: {
        'custom-xs': '10px',
        'custom-base': '15px',
        'custom-2xl': '28.8px',
        'custom-3xl': '32px',
        'custom-4xl': '40px',
        'custom-6xl': '64px',
        'custom-7xl': '200px',
      },
      lineHeight: {
        '50': '50%',
        '72': '72%',
        '74': '74%',
        '80': '80%',
        '100': '100%',
        '110': '110%',
        '119': '119%',
        '120': '120%',
        '125': '125%',
        '150': '150%',
        '180': '180%',
        '187': '187%',
        '200': '200%',
      },
      backgroundImage: {
        'hero': "url('/img/webp/herobg.webp')",
      },
      screens: {
        'custom-md': '992px',
      },
    },
  },
}
