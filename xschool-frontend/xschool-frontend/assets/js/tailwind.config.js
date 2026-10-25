/* Configuration Tailwind (doit se charger APRES le CDN Tailwind). */
  tailwind.config = {
    darkMode: 'class',
    theme: { extend: {
      fontFamily: { sans: ['Plus Jakarta Sans','Inter','system-ui','sans-serif'] },
      colors: { brand: { 50:'#f0f5fa',100:'#dbe7f3',300:'#9bb9d8',500:'#3f6fa3',600:'#2f5a8a',700:'#244a73',800:'#1d3c5e',900:'#17304b' } },
      boxShadow: { soft:'0 6px 24px rgba(16,32,56,.07)', glow:'0 12px 30px rgba(29,60,94,.18)' }
    }}
  }
