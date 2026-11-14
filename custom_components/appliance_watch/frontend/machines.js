// Appliance Watch: the machines, drawn and animated. Shared by the panel and the dashboard card.
// machineSVG(kind, state, { display, uid }) -> an <svg> string; MACHINE_CSS holds the animations.

export const ACCENT = { dishwasher: "#14b8a6", washer: "#3b82f6", dryer: "#f97316", other: "#8b5cf6" };

const body = (u, h = 232) => `
  <defs>
    <linearGradient id="b${u}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#eef1f5"/><stop offset="1" stop-color="#d9dee6"/>
    </linearGradient>
    <linearGradient id="p${u}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f7f8fa"/><stop offset="1" stop-color="#e3e7ed"/>
    </linearGradient>
    <linearGradient id="chrome${u}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fdfdfd"/><stop offset=".35" stop-color="#b9c0ca"/><stop offset=".6" stop-color="#eceff3"/><stop offset="1" stop-color="#8f98a4"/>
    </linearGradient>
    <linearGradient id="steel${u}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#c9ced6"/><stop offset=".2" stop-color="#eef0f3"/><stop offset=".5" stop-color="#d6dae0"/>
      <stop offset=".8" stop-color="#f3f4f6"/><stop offset="1" stop-color="#bfc5cd"/>
    </linearGradient>
    <radialGradient id="glow${u}"><stop offset="0" stop-color="var(--aw-accent)" stop-opacity=".9"/><stop offset="1" stop-color="var(--aw-accent)" stop-opacity="0"/></radialGradient>
    <filter id="soft${u}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2"/></filter>
    <linearGradient id="sh${u}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/>
      <stop offset=".5" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  </defs>
  <ellipse class="aw-shadow" cx="100" cy="${h + 4}" rx="78" ry="7" fill="#000" opacity=".18" filter="url(#soft${u})"/>`;

const panel = (u, display) => `
  <rect x="22" y="8" width="156" height="40" rx="12" fill="url(#p${u})"/>
  <rect x="32" y="17" width="58" height="22" rx="5" fill="#0f172a"/>
  <text class="aw-display" x="61" y="33" text-anchor="middle">${display || ""}</text>
  <circle class="aw-led" cx="104" cy="28" r="3.2"/>
  <g class="aw-knob" style="transform-origin:150px 28px"><circle cx="150" cy="28" r="13" fill="url(#chrome${u})" stroke="#aeb5bf" stroke-width="1"/>
    <rect x="149" y="17" width="2" height="7" rx="1" fill="#5b6470"/></g>
  <circle cx="117" cy="28" r="2.4" fill="#c3c9d1"/><circle cx="126" cy="28" r="2.4" fill="#c3c9d1"/>`;

function washer(u, display, dryer) {
  const glass = dryer
    ? `<radialGradient id="g${u}" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#3a2a22"/><stop offset="1" stop-color="#120c0a"/></radialGradient>`
    : `<radialGradient id="g${u}" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#3b5578"/><stop offset="1" stop-color="#101a2c"/></radialGradient>`;
  const clothes = dryer
    ? `<path d="M76 128 q14 -14 30 -4 q10 8 -4 16 q-16 8 -26 -12z" fill="#f4a261"/>
       <path d="M108 150 q18 -6 22 8 q2 14 -16 12 q-14 -2 -6 -20z" fill="#e9c46a"/>
       <path d="M82 158 q8 -10 20 -2 q8 8 -6 14 q-12 2 -14 -12z" fill="#e76f51"/>`
    : `<path d="M74 130 q16 -16 32 -4 q10 8 -4 16 q-18 8 -28 -12z" fill="#ef476f"/>
       <path d="M108 148 q18 -6 22 8 q2 14 -16 12 q-14 -2 -6 -20z" fill="#ffd166"/>
       <path d="M80 158 q8 -10 20 -2 q8 8 -6 14 q-12 2 -14 -12z" fill="#06d6a0"/>`;
  return `<svg viewBox="0 0 200 244" class="aw-svg">
    ${body(u)}<defs>${glass}<clipPath id="c${u}"><circle cx="100" cy="146" r="47"/></clipPath></defs>
    <g class="aw-body">
      <rect x="14" y="2" width="172" height="230" rx="18" fill="url(#b${u})" stroke="#cfd5dd" stroke-width="1.2"/>
      ${panel(u, display)}
      <line x1="22" y1="56" x2="178" y2="56" stroke="#d3d8df" stroke-width="1.2"/>
      <circle cx="100" cy="146" r="66" fill="#e4e8ee" stroke="#cfd5dd"/>
      <circle cx="100" cy="146" r="60" fill="url(#chrome${u})"/>
      <circle cx="100" cy="146" r="50" fill="#9aa3ae"/>
      <circle cx="100" cy="146" r="47" fill="url(#g${u})"/>
      <g clip-path="url(#c${u})">
        ${dryer ? `<circle class="aw-heat" cx="100" cy="150" r="46" fill="url(#glow${u})" opacity="0"/>` : ""}
        <g class="aw-drum" style="transform-origin:100px 146px">
          ${Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return `<circle cx="${100 + Math.cos(a) * 38}" cy="${146 + Math.sin(a) * 38}" r="1.6" fill="#ffffff" opacity=".22"/>`;
          }).join("")}
          <g class="aw-clothes">${clothes}</g>
        </g>
        ${dryer ? "" : `<g class="aw-water"><path d="M30 170 q15 -8 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 v40 h-180z" fill="#4cc9f0" opacity=".45"/>
          <path d="M30 176 q15 -6 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 v40 h-180z" fill="#4895ef" opacity=".35"/></g>
          <g class="aw-bubbles"><circle cx="84" cy="176" r="2.5" fill="#fff" opacity=".6"/><circle cx="104" cy="182" r="1.8" fill="#fff" opacity=".6"/>
          <circle cx="118" cy="178" r="2.2" fill="#fff" opacity=".6"/></g>`}
        <g transform="rotate(20 100 140)"><rect class="aw-shine" x="-60" y="20" width="34" height="260" fill="url(#sh${u})"/></g>
      </g>
      <path d="M68 116 a44 44 0 0 1 44 -16" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none" opacity=".35"/>
      <rect x="158" y="136" width="8" height="22" rx="4" fill="#b3bbc5"/>
      ${dryer ? `<rect x="40" y="216" width="120" height="6" rx="3" fill="#cfd5dd"/>` : `<rect x="140" y="214" width="34" height="10" rx="3" fill="#dde2e8" stroke="#cfd5dd"/>`}
    </g>
    ${dryer ? `<g class="aw-waves" stroke="var(--aw-accent)" stroke-width="3" fill="none" stroke-linecap="round" opacity="0">
      <path d="M70 -6 q6 -8 0 -16 t0 -16"/><path d="M100 -6 q6 -8 0 -16 t0 -16"/><path d="M130 -6 q6 -8 0 -16 t0 -16"/></g>` : ""}
  </svg>`;
}

function dishwasher(u, display) {
  const plates = Array.from({ length: 7 }, (_, i) =>
    `<ellipse cx="${56 + i * 15}" cy="118" rx="4.5" ry="22" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>`).join("");
  const cups = Array.from({ length: 4 }, (_, i) =>
    `<path d="M${58 + i * 24} 74 h14 l-2 14 h-10z" fill="#e2e8f0" stroke="#cbd5e1"/>`).join("");
  return `<svg viewBox="0 0 200 244" class="aw-svg">
    ${body(u)}<defs>
      <linearGradient id="w${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f3b4d"/><stop offset="1" stop-color="#0b1720"/></linearGradient>
      <clipPath id="c${u}"><rect x="38" y="62" width="124" height="128" rx="10"/></clipPath>
    </defs>
    <g class="aw-beam"><ellipse cx="100" cy="240" rx="40" ry="6" fill="url(#glow${u})"/></g>
    <g class="aw-body">
      <rect x="14" y="2" width="172" height="230" rx="16" fill="url(#steel${u})" stroke="#b8bec7" stroke-width="1.2"/>
      ${panel(u, display)}
      <rect x="40" y="52" width="120" height="6" rx="3" fill="#9aa3ae"/>
      <rect x="38" y="62" width="124" height="128" rx="10" fill="url(#w${u})"/>
      <g clip-path="url(#c${u})">
        <g opacity=".9">${cups}<line x1="44" y1="90" x2="156" y2="90" stroke="#94a3b8" stroke-width="2"/>${plates}
          <line x1="44" y1="142" x2="156" y2="142" stroke="#94a3b8" stroke-width="2"/></g>
        <g class="aw-spray">
          ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<circle class="aw-drop" style="--i:${i}" cx="${50 + i * 14}" cy="176" r="2" fill="#7dd3fc"/>`).join("")}
        </g>
        <g class="aw-arm" style="transform-origin:100px 172px"><rect x="70" y="169" width="60" height="6" rx="3" fill="#cbd5e1"/>
          <circle cx="100" cy="172" r="5" fill="#94a3b8"/></g>
<g transform="rotate(20 100 140)"><rect class="aw-shine" x="-60" y="20" width="34" height="260" fill="url(#sh${u})"/></g>
        <g class="aw-steam">${[0, 1, 2].map((i) => `<circle class="aw-puff" style="--i:${i}" cx="${80 + i * 20}" cy="150" r="10" fill="#fff"/>`).join("")}</g>
      </g>
      <path d="M44 70 l30 0 l-26 50z" fill="#fff" opacity=".07"/>
      <rect x="38" y="200" width="124" height="20" rx="6" fill="#d1d5db" opacity=".55"/>
    </g>
  </svg>`;
}

function other(u, display) {
  return `<svg viewBox="0 0 200 244" class="aw-svg">${body(u)}
    <g class="aw-body"><rect x="30" y="40" width="140" height="190" rx="22" fill="url(#b${u})" stroke="#cfd5dd"/>
    <g transform="translate(-0 40)">${panel(u, display)}</g>
    <g class="aw-drum" style="transform-origin:100px 160px"><circle cx="100" cy="160" r="34" fill="none" stroke="var(--aw-accent)" stroke-width="6" stroke-dasharray="40 14"/></g></g></svg>`;
}

export function machineSVG(kind, state, opts = {}) {
  const u = opts.uid || Math.random().toString(36).slice(2, 8);
  const draw = kind === "dishwasher" ? dishwasher(u, opts.display) : kind === "washer" ? washer(u, opts.display, false)
    : kind === "dryer" ? washer(u, opts.display, true) : other(u, opts.display);
  const check = state === "finished"
    ? `<div class="aw-check"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" fill="#22c55e"/><path d="M15 27 l8 8 l15 -17" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`
    : "";
  return `<div class="aw-machine aw-${kind} aw-${state}" style="--aw-accent:${ACCENT[kind] || ACCENT.other}">${draw}${check}</div>`;
}

export const MACHINE_CSS = `
  .aw-machine { position:relative; width:100%; height:100%; }
  .aw-svg { width:100%; height:100%; overflow:visible; display:block; }
  .aw-display { font:700 13px ui-monospace, "SF Mono", Menlo, monospace; fill:#334155; letter-spacing:.5px; }
  .aw-running .aw-display, .aw-finishing .aw-display { fill:#5eead4; }
  .aw-washer.aw-running .aw-display { fill:#93c5fd; } .aw-dryer.aw-running .aw-display { fill:#fdba74; }
  .aw-finished .aw-display { fill:#86efac; }
  .aw-led { fill:#cbd5e1; }
  .aw-running .aw-led, .aw-finishing .aw-led { fill:var(--aw-accent); animation:aw-blink 1.6s ease-in-out infinite; }
  .aw-finished .aw-led { fill:#22c55e; }
  .aw-drum, .aw-arm, .aw-knob, .aw-body, .aw-water, .aw-puff, .aw-drop, .aw-clothes, .aw-waves path { transform-box:view-box; }
  .aw-running .aw-drum { animation:aw-spin 2.4s linear infinite; }
  .aw-washer.aw-running .aw-drum { animation:aw-spin 2.4s cubic-bezier(.45,.05,.55,.95) infinite alternate; }
  .aw-finishing .aw-drum { animation:aw-spin 9s linear infinite; }
  .aw-dryer.aw-running .aw-clothes { animation:aw-tumble 2.4s ease-in-out infinite; transform-origin:100px 146px; }
  .aw-water { opacity:0; transition:opacity .6s; }
  .aw-washer.aw-running .aw-water { opacity:1; animation:aw-wave 2.2s linear infinite; }
  .aw-bubbles { opacity:0; }
  .aw-washer.aw-running .aw-bubbles circle { opacity:0; animation:aw-bubble 2.6s ease-in infinite; transform-box:view-box; }
  .aw-washer.aw-running .aw-bubbles circle:nth-child(2) { animation-delay:.9s; }
  .aw-washer.aw-running .aw-bubbles circle:nth-child(3) { animation-delay:1.7s; }
  .aw-washer.aw-running .aw-bubbles { opacity:1; }
  .aw-washer.aw-running .aw-body { animation:aw-shake .32s linear infinite; }
  .aw-dryer.aw-running .aw-heat { animation:aw-glow 3s ease-in-out infinite; }
  .aw-dryer.aw-running .aw-waves { opacity:1; }
  .aw-dryer.aw-running .aw-waves path { animation:aw-rise 2.4s ease-in infinite; opacity:0; }
  .aw-dryer.aw-running .aw-waves path:nth-child(2) { animation-delay:.8s; } .aw-dryer.aw-running .aw-waves path:nth-child(3) { animation-delay:1.6s; }
  .aw-running .aw-knob { animation:aw-knob 6s ease-in-out infinite; }
  .aw-arm { transform-origin:100px 172px; }
  .aw-running .aw-arm { animation:aw-spin 1.1s linear infinite; }
  .aw-drop { opacity:0; }
  .aw-running .aw-drop { animation:aw-spray 1.1s ease-out infinite; animation-delay:calc(var(--i) * -0.14s); }
  .aw-beam { opacity:0; }
  .aw-running .aw-beam, .aw-finishing .aw-beam { opacity:1; animation:aw-blink 3s ease-in-out infinite; }
  .aw-puff { opacity:0; }
  .aw-finishing .aw-puff, .aw-dishwasher.aw-finished .aw-puff { animation:aw-steam 3.6s ease-out infinite; animation-delay:calc(var(--i) * 1.1s); }
  .aw-dishwasher.aw-finished .aw-puff { animation-duration:5s; }
  .aw-off .aw-svg { filter:saturate(.85); }
  .aw-shine { opacity:0; transform-box:view-box; }
  .aw-off .aw-shine, .aw-finished .aw-shine { animation:aw-sweep 7s ease-in-out infinite; }
  @keyframes aw-sweep { 0%,55% { opacity:0; transform:translateX(0); } 62% { opacity:1; } 88% { opacity:1; } 100% { opacity:0; transform:translateX(260px); } }
  .aw-check { position:absolute; right:-4%; top:-4%; width:28%; animation:aw-pop .5s cubic-bezier(.2,1.6,.4,1) both; filter:drop-shadow(0 3px 6px rgba(0,0,0,.25)); }
  .aw-check svg { width:100%; display:block; }
  .aw-check path { stroke-dasharray:40; stroke-dashoffset:40; animation:aw-draw .5s .3s ease forwards; }
  .aw-check::after { content:""; position:absolute; inset:0; border-radius:50%; box-shadow:0 0 0 0 rgba(34,197,94,.6); animation:aw-ring 2.2s 1s ease-out infinite; }
  @keyframes aw-spin { to { transform:rotate(360deg); } }
  @keyframes aw-tumble { 0% { transform:rotate(0); } 50% { transform:rotate(200deg) translateY(4px); } 100% { transform:rotate(360deg); } }
  @keyframes aw-wave { from { transform:translateX(0); } to { transform:translateX(-60px); } }
  @keyframes aw-shake { 0%,100% { transform:translate(0,0); } 25% { transform:translate(.5px,-.4px); } 75% { transform:translate(-.5px,.3px); } }
  @keyframes aw-blink { 0%,100% { opacity:1; } 50% { opacity:.35; } }
  @keyframes aw-knob { 0%,100% { transform:rotate(0); } 50% { transform:rotate(20deg); } }
  @keyframes aw-spray { 0% { transform:translateY(0) scale(.6); opacity:0; } 20% { opacity:1; } 100% { transform:translateY(-90px) scale(1.1); opacity:0; } }
  @keyframes aw-steam { 0% { transform:translateY(0) scale(.4); opacity:0; } 25% { opacity:.35; } 100% { transform:translateY(-110px) scale(2.2); opacity:0; } }
  @keyframes aw-glow { 0%,100% { opacity:.25; } 50% { opacity:.7; } }
  @keyframes aw-rise { 0% { transform:translateY(10px); opacity:0; } 40% { opacity:.8; } 100% { transform:translateY(-14px); opacity:0; } }
  @keyframes aw-bubble { 0% { transform:translateY(0); opacity:0; } 30% { opacity:.8; } 100% { transform:translateY(-40px); opacity:0; } }
  @keyframes aw-pop { from { transform:scale(0); } to { transform:scale(1); } }
  @keyframes aw-draw { to { stroke-dashoffset:0; } }
  @keyframes aw-ring { 0% { box-shadow:0 0 0 0 rgba(34,197,94,.55); } 100% { box-shadow:0 0 0 14px rgba(34,197,94,0); } }
  @media (prefers-reduced-motion: reduce) { .aw-machine * { animation:none !important; } }
`;

// Words and helpers both views use.
export const TEXTS = {
  en: {
    kinds: { dishwasher: "Dishwasher", washer: "Washing machine", dryer: "Dryer", other: "Appliance" },
    states: { off: "Ready", running: "Running", finishing: "Nearly done", finished: "Done" },
    doneAt: "done", left: "left", unknownTime: "Learning the programme…", emptied: "Emptied", waiting: "Waiting to be emptied",
    since: "since", cheap: "Cheapest start", save: "save", now: "Now", program: "Program", noMachines: "No machines yet",
  },
  da: {
    kinds: { dishwasher: "Opvaskemaskine", washer: "Vaskemaskine", dryer: "Tørretumbler", other: "Maskine" },
    states: { off: "Klar", running: "Kører", finishing: "Næsten færdig", finished: "Færdig" },
    doneAt: "færdig", left: "tilbage", unknownTime: "Lærer programmet…", emptied: "Tømt", waiting: "Venter på at blive tømt",
    since: "siden", cheap: "Billigst at starte", save: "spar", now: "Nu", program: "Program", noMachines: "Ingen maskiner endnu",
  },
  de: {
    kinds: { dishwasher: "Geschirrspüler", washer: "Waschmaschine", dryer: "Trockner", other: "Gerät" },
    states: { off: "Bereit", running: "Läuft", finishing: "Fast fertig", finished: "Fertig" },
    doneAt: "fertig um", left: "übrig", unknownTime: "Lernt das Programm…", emptied: "Ausgeräumt", waiting: "Wartet aufs Ausräumen",
    since: "seit", cheap: "Günstigster Start", save: "spart", now: "Jetzt", program: "Programm", noMachines: "Noch keine Geräte",
  },
  sv: {
    kinds: { dishwasher: "Diskmaskin", washer: "Tvättmaskin", dryer: "Torktumlare", other: "Maskin" },
    states: { off: "Redo", running: "Kör", finishing: "Nästan klar", finished: "Klar" },
    doneAt: "klar", left: "kvar", unknownTime: "Lär sig programmet…", emptied: "Tömd", waiting: "Väntar på att tömmas",
    since: "sedan", cheap: "Billigast att starta", save: "spara", now: "Nu", program: "Program", noMachines: "Inga maskiner än",
  },
  nb: {
    kinds: { dishwasher: "Oppvaskmaskin", washer: "Vaskemaskin", dryer: "Tørketrommel", other: "Maskin" },
    states: { off: "Klar", running: "Går", finishing: "Nesten ferdig", finished: "Ferdig" },
    doneAt: "ferdig", left: "igjen", unknownTime: "Lærer programmet…", emptied: "Tømt", waiting: "Venter på å bli tømt",
    since: "siden", cheap: "Billigst å starte", save: "spar", now: "Nå", program: "Program", noMachines: "Ingen maskiner ennå",
  },
  nl: {
    kinds: { dishwasher: "Vaatwasser", washer: "Wasmachine", dryer: "Droger", other: "Apparaat" },
    states: { off: "Klaar", running: "Bezig", finishing: "Bijna klaar", finished: "Klaar" },
    doneAt: "klaar om", left: "te gaan", unknownTime: "Leert het programma…", emptied: "Uitgeruimd", waiting: "Wacht om uitgeruimd te worden",
    since: "sinds", cheap: "Goedkoopst om te starten", save: "bespaar", now: "Nu", program: "Programma", noMachines: "Nog geen apparaten",
  },
  fr: {
    kinds: { dishwasher: "Lave-vaisselle", washer: "Lave-linge", dryer: "Sèche-linge", other: "Appareil" },
    states: { off: "Prêt", running: "En marche", finishing: "Presque fini", finished: "Terminé" },
    doneAt: "terminé à", left: "restant", unknownTime: "Apprend le programme…", emptied: "Vidé", waiting: "Attend d'être vidé",
    since: "depuis", cheap: "Départ le moins cher", save: "économie", now: "Maintenant", program: "Programme", noMachines: "Pas encore d'appareils",
  },
};

// Locale for dates; undefined = the browser's own (as before for English).
export const LOCALES = { en: undefined, da: "da-DK", de: "de-DE", sv: "sv-SE", nb: "nb-NO", nl: "nl-NL", fr: "fr-FR" };

export function lang(hass) {
  let code = String(hass?.locale?.language || hass?.language || "en").toLowerCase().split(/[-_]/)[0];
  if (code === "no" || code === "nn") code = "nb";
  return code in TEXTS ? code : "en";
}

export function clock(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function minutesLeft(iso) {
  return iso ? Math.max(0, Math.round((new Date(iso) - Date.now()) / 60000)) : null;
}

export function hm(minutes) {
  if (minutes == null) return "";
  return minutes >= 60 ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}` : `0:${String(minutes).padStart(2, "0")}`;
}

export function dur(seconds, L = "en") {
  if (seconds == null) return "";
  const m = Math.round(seconds / 60);
  const h = { da: "t", nb: "t", de: "Std.", nl: "u" }[L] || "h";
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} ${h}${m % 60 ? ` ${m % 60} min` : ""}`;
}

export function display(m) {
  if (m.state === "finished") return "End";
  if (m.state === "off") return "";
  const left = minutesLeft(m.finish_time);
  return left == null ? "- -:- -" : hm(left);
}

export function money(value, currency) {
  if (value == null) return "";
  const n = Number(value).toFixed(2);
  return ["kr", "kr.", "DKK", "SEK", "NOK"].includes(currency) ? `${n.replace(".", ",")} kr` : `${n} ${currency || ""}`.trim();
}

export function num(value, L = "en", digits = 2) {
  const n = Number(value ?? 0).toFixed(digits);
  return L === "en" ? n : n.replace(".", ","); // every other language here uses a decimal comma
}

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
