// Official Al Ula SC Crest Logo and Brand Colors
export const ALULA_BRAND_COLORS = {
  sand: '#ede9e6',
  navy: '#002142',
  blue: '#0f5981',
  sky: '#5ea4c5',
  espresso: '#30221c',
  olive: '#8a7549',
  tan: '#a79078',
};

export const OFFICIAL_ALULA_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 570" width="100%" height="100%">
  <!-- Outer Frame (Desert Sand / Tan #a79078) -->
  <path d="M 250 8 C 150 8 40 40 40 240 C 40 400 250 562 250 562 C 250 562 460 400 460 240 C 460 40 350 8 250 8 Z" fill="#a79078" />

  <!-- Inner Dark Border (#30221c) -->
  <path d="M 250 18 C 156 18 50 48 50 240 C 50 392 250 548 250 548 C 250 548 450 392 450 240 C 450 48 344 18 250 18 Z" fill="#30221c" />

  <!-- Shield Half Left: Al Ula Royal Blue #0f5981 -->
  <path d="M 250 26 C 162 26 60 54 60 240 C 60 384 250 535 250 535 L 250 26 Z" fill="#0f5981" />

  <!-- Shield Half Right: Dark Espresso Brown #30221c -->
  <path d="M 250 26 L 250 535 C 250 535 440 384 440 240 C 440 54 338 26 250 26 Z" fill="#30221c" />

  <!-- Inner Blue Border Arc (Royal Blue #0f5981 around right rim) -->
  <path d="M 250 26 C 338 26 440 54 440 240 C 440 384 250 535 250 535 C 250 535 440 384 440 240 C 440 54 338 26 250 26 Z" fill="none" stroke="#0f5981" stroke-width="6" />

  <!-- Typography: "ALULA SC" arched at top in Tan #a79078 -->
  <path id="text-path-alula" d="M 115 125 C 190 95 310 95 385 125" fill="none" />
  <text fill="#a79078" font-family="'Outfit', 'Inter', 'Segoe UI', sans-serif" font-weight="900" font-size="44" letter-spacing="4">
    <textPath href="#text-path-alula" startOffset="50%" text-anchor="middle">ALULA SC</textPath>
  </text>

  <!-- Arabic Calligraphy: "نادي العلا الرياضي" -->
  <path id="text-path-arabic" d="M 110 168 C 185 142 315 142 390 168" fill="none" />
  <text fill="#a79078" font-family="'Outfit', 'Amiri', 'Segoe UI', sans-serif" font-weight="700" font-size="30">
    <textPath href="#text-path-arabic" startOffset="50%" text-anchor="middle">نادي العلا الرياضي</textPath>
  </text>

  <!-- Central Arabian Leopard Emblem (Geometric Gold / Tan #a79078 & #8a7549) -->
  <g transform="translate(132, 190) scale(0.95)">
    <!-- Ears -->
    <polygon points="20,100 65,10 110,80 70,120" fill="#8a7549" />
    <polygon points="30,95 65,22 100,80" fill="#a79078" />

    <polygon points="230,100 185,10 140,80 180,120" fill="#8a7549" />
    <polygon points="220,95 185,22 150,80" fill="#a79078" />

    <!-- Forehead shield / Central head structure -->
    <polygon points="65,95 185,95 210,180 40,180" fill="#a79078" />
    <polygon points="125,95 185,95 210,180 125,180" fill="#8a7549" opacity="0.4" />

    <!-- Left Cheek / Jaw -->
    <polygon points="40,180 30,250 85,300 105,250 65,180" fill="#8a7549" />
    <polygon points="52,180 42,240 85,285 70,180" fill="#a79078" />

    <!-- Right Cheek / Jaw -->
    <polygon points="210,180 220,250 165,300 145,250 185,180" fill="#8a7549" />
    <polygon points="198,180 208,240 165,285 180,180" fill="#30221c" opacity="0.3" />

    <!-- Nose / Muzzle structure -->
    <polygon points="85,250 165,250 180,310 125,350 70,310" fill="#a79078" />
    <polygon points="125,250 165,250 180,310 125,350" fill="#8a7549" />

    <!-- Dark Nose Tip -->
    <polygon points="100,250 150,250 125,285" fill="#30221c" />

    <!-- Mouth / Chin shadow -->
    <polygon points="70,310 125,350 125,310" fill="#8a7549" />
    <polygon points="180,310 125,350 125,310" fill="#30221c" />

    <!-- Forehead Ancient North Arabian / Lihyanite Symbols (W X X pattern in Al Ula Blue) -->
    <!-- W Symbol -->
    <path d="M 100 115 L 112 140 L 125 122 L 138 140 L 150 115" fill="none" stroke="#0f5981" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Upper X Symbol -->
    <path d="M 105 148 L 145 175 M 145 148 L 105 175" fill="none" stroke="#0f5981" stroke-width="7" stroke-linecap="round" />
    <!-- Lower X Symbol with bar -->
    <path d="M 105 180 L 145 207 M 145 180 L 105 207" fill="none" stroke="#0f5981" stroke-width="7" stroke-linecap="round" />
    <line x1="95" y1="193.5" x2="155" y2="193.5" stroke="#0f5981" stroke-width="6" stroke-linecap="round" />
  </g>
</svg>`;

export const OFFICIAL_ALULA_LOGO_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(OFFICIAL_ALULA_LOGO_SVG)}`;
