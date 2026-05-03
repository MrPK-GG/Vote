/**
 * AKR Academy Voting System — Theme Definitions
 * Loaded as /themes.js on all pages.
 */
(function () {
  var THEMES = [
    {
      id: 'royal-navy',
      name: 'Royal Navy',
      description: 'Classic deep navy & gold — the original look',
      preview: ['#0A1A4E', '#F5A623', '#1B4FD8'],
      vars: {
        '--gold': '#F5A623', '--gold-light': '#FFD166', '--gold-dark': '#C77B00',
        '--navy': '#0A1A4E', '--navy-light': '#1A2F7A',
        '--blue': '#1B4FD8', '--blue-light': '#3B6FF0',
        '--bg': '#060F30',
        '--surface': 'rgba(255,255,255,0.04)', '--surface2': 'rgba(255,255,255,0.08)',
        '--border': 'rgba(245,166,35,0.18)', '--border-h': 'rgba(245,166,35,0.4)',
        '--text-muted': 'rgba(255,255,255,0.45)', '--text-dim': 'rgba(255,255,255,0.25)',
      },
      bodyGradient: 'linear-gradient(160deg, #050D2E 0%, #0A1A4E 40%, #0D1B5E 100%)',
    },
    {
      id: 'crimson-dynasty',
      name: 'Crimson Dynasty',
      description: 'Fierce deep red & gold — power and passion',
      preview: ['#2D0808', '#F5A623', '#E74C3C'],
      vars: {
        '--gold': '#F5A623', '--gold-light': '#FFD166', '--gold-dark': '#C77B00',
        '--navy': '#2D0808', '--navy-light': '#4A0E0E',
        '--blue': '#C0392B', '--blue-light': '#E74C3C',
        '--bg': '#150303',
        '--surface': 'rgba(255,255,255,0.04)', '--surface2': 'rgba(255,255,255,0.08)',
        '--border': 'rgba(245,166,35,0.18)', '--border-h': 'rgba(245,166,35,0.4)',
        '--text-muted': 'rgba(255,255,255,0.45)', '--text-dim': 'rgba(255,255,255,0.25)',
      },
      bodyGradient: 'linear-gradient(160deg, #0D0101 0%, #2D0808 40%, #3D0A0A 100%)',
    },
    {
      id: 'emerald-republic',
      name: 'Emerald Republic',
      description: 'Deep forest green & gold — nature and prosperity',
      preview: ['#042010', '#2ECC71', '#F5A623'],
      vars: {
        '--gold': '#2ECC71', '--gold-light': '#58D68D', '--gold-dark': '#1A8A4A',
        '--navy': '#042010', '--navy-light': '#083D1C',
        '--blue': '#148A41', '--blue-light': '#1DBE58',
        '--bg': '#02100A',
        '--surface': 'rgba(255,255,255,0.04)', '--surface2': 'rgba(255,255,255,0.08)',
        '--border': 'rgba(46,204,113,0.2)', '--border-h': 'rgba(46,204,113,0.45)',
        '--text-muted': 'rgba(255,255,255,0.45)', '--text-dim': 'rgba(255,255,255,0.25)',
      },
      bodyGradient: 'linear-gradient(160deg, #010D05 0%, #042010 40%, #062615 100%)',
    },
    {
      id: 'royal-amethyst',
      name: 'Royal Amethyst',
      description: 'Deep violet & silver — elegance and mystique',
      preview: ['#150A2E', '#A855F7', '#7C3AED'],
      vars: {
        '--gold': '#A855F7', '--gold-light': '#C084FC', '--gold-dark': '#7C3AED',
        '--navy': '#150A2E', '--navy-light': '#2D1558',
        '--blue': '#7C3AED', '--blue-light': '#9333EA',
        '--bg': '#0A0518',
        '--surface': 'rgba(255,255,255,0.04)', '--surface2': 'rgba(255,255,255,0.08)',
        '--border': 'rgba(168,85,247,0.2)', '--border-h': 'rgba(168,85,247,0.45)',
        '--text-muted': 'rgba(255,255,255,0.45)', '--text-dim': 'rgba(255,255,255,0.25)',
      },
      bodyGradient: 'linear-gradient(160deg, #060213 0%, #150A2E 40%, #1E0F42 100%)',
    },
    {
      id: 'midnight-steel',
      name: 'Midnight Steel',
      description: 'Dark charcoal & electric cyan — tech and precision',
      preview: ['#0D1117', '#00D4FF', '#1F6FEB'],
      vars: {
        '--gold': '#00D4FF', '--gold-light': '#67E8F9', '--gold-dark': '#0099BB',
        '--navy': '#0D1117', '--navy-light': '#161B22',
        '--blue': '#1F6FEB', '--blue-light': '#388BFD',
        '--bg': '#090D13',
        '--surface': 'rgba(255,255,255,0.04)', '--surface2': 'rgba(255,255,255,0.08)',
        '--border': 'rgba(0,212,255,0.2)', '--border-h': 'rgba(0,212,255,0.45)',
        '--text-muted': 'rgba(255,255,255,0.45)', '--text-dim': 'rgba(255,255,255,0.25)',
      },
      bodyGradient: 'linear-gradient(160deg, #060A0F 0%, #0D1117 40%, #111A24 100%)',
    },
    {
      id: 'ocean-senate',
      name: 'Ocean Senate',
      description: 'Deep ocean teal & gold — calm authority',
      preview: ['#051825', '#00B4D8', '#F5A623'],
      vars: {
        '--gold': '#00B4D8', '--gold-light': '#48CAE4', '--gold-dark': '#0077B6',
        '--navy': '#051825', '--navy-light': '#0A2D45',
        '--blue': '#0077B6', '--blue-light': '#0096C7',
        '--bg': '#030E18',
        '--surface': 'rgba(255,255,255,0.04)', '--surface2': 'rgba(255,255,255,0.08)',
        '--border': 'rgba(0,180,216,0.2)', '--border-h': 'rgba(0,180,216,0.45)',
        '--text-muted': 'rgba(255,255,255,0.45)', '--text-dim': 'rgba(255,255,255,0.25)',
      },
      bodyGradient: 'linear-gradient(160deg, #020B12 0%, #051825 40%, #072333 100%)',
    },
    {
      id: 'obsidian-elite',
      name: 'Obsidian Elite',
      description: 'Pure black & bright gold — maximum contrast',
      preview: ['#0A0A0A', '#FFD700', '#555555'],
      vars: {
        '--gold': '#FFD700', '--gold-light': '#FFE766', '--gold-dark': '#CC9E00',
        '--navy': '#0A0A0A', '--navy-light': '#1A1A1A',
        '--blue': '#333333', '--blue-light': '#555555',
        '--bg': '#050505',
        '--surface': 'rgba(255,255,255,0.05)', '--surface2': 'rgba(255,255,255,0.1)',
        '--border': 'rgba(255,215,0,0.2)', '--border-h': 'rgba(255,215,0,0.45)',
        '--text-muted': 'rgba(255,255,255,0.45)', '--text-dim': 'rgba(255,255,255,0.25)',
      },
      bodyGradient: 'linear-gradient(160deg, #020202 0%, #0A0A0A 40%, #0F0F0F 100%)',
    },
    {
      id: 'rose-parliament',
      name: 'Rose Parliament',
      description: 'Dark rose & pink gold — warmth and authority',
      preview: ['#1A0510', '#F472B6', '#BE185D'],
      vars: {
        '--gold': '#F472B6', '--gold-light': '#F9A8D4', '--gold-dark': '#BE185D',
        '--navy': '#1A0510', '--navy-light': '#3D0A25',
        '--blue': '#BE185D', '--blue-light': '#DB2777',
        '--bg': '#0F030A',
        '--surface': 'rgba(255,255,255,0.04)', '--surface2': 'rgba(255,255,255,0.08)',
        '--border': 'rgba(244,114,182,0.2)', '--border-h': 'rgba(244,114,182,0.45)',
        '--text-muted': 'rgba(255,255,255,0.45)', '--text-dim': 'rgba(255,255,255,0.25)',
      },
      bodyGradient: 'linear-gradient(160deg, #0A0207 0%, #1A0510 40%, #220718 100%)',
    },
    {
      id: 'solar-republic',
      name: 'Solar Republic',
      description: 'Dark amber & bright orange — energy and warmth',
      preview: ['#1A0E00', '#FF8C00', '#CC5500'],
      vars: {
        '--gold': '#FF8C00', '--gold-light': '#FFB347', '--gold-dark': '#CC7000',
        '--navy': '#1A0E00', '--navy-light': '#2E1A00',
        '--blue': '#CC5500', '--blue-light': '#E0660A',
        '--bg': '#100900',
        '--surface': 'rgba(255,255,255,0.04)', '--surface2': 'rgba(255,255,255,0.08)',
        '--border': 'rgba(255,140,0,0.2)', '--border-h': 'rgba(255,140,0,0.45)',
        '--text-muted': 'rgba(255,255,255,0.45)', '--text-dim': 'rgba(255,255,255,0.25)',
      },
      bodyGradient: 'linear-gradient(160deg, #080500 0%, #1A0E00 40%, #221200 100%)',
    },
  ];

  window.AKR_THEMES = THEMES;

  window.applyTheme = function (themeIdOrObj) {
    var theme = (typeof themeIdOrObj === 'string')
      ? THEMES.filter(function (t) { return t.id === themeIdOrObj; })[0]
      : themeIdOrObj;
    if (!theme) return;

    var cssVars = Object.keys(theme.vars).map(function (k) {
      return k + ': ' + theme.vars[k] + ';';
    }).join(' ');

    var styleEl = document.getElementById('akr-theme-vars');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'akr-theme-vars';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = ':root { ' + cssVars + ' }';
    document.body.style.background = theme.bodyGradient;

    try { sessionStorage.setItem('akr-theme-id', theme.id); } catch (e) {}
  };

  window.loadAndApplyTheme = function () {
    // Instant apply from cache to avoid flash
    try {
      var cached = sessionStorage.getItem('akr-theme-id');
      if (cached) window.applyTheme(cached);
    } catch (e) {}

    // Then fetch authoritative value from server
    fetch('/api/theme').then(function (r) { return r.json(); }).then(function (d) {
      if (d && d.success && d.themeId) window.applyTheme(d.themeId);
    }).catch(function () {});
  };
}());
