// Appliance Watch: the machines, drawn and animated. Shared by the panel and the dashboard card.
// machineSVG(kind, state, { display, uid }) -> an <svg> string; MACHINE_CSS holds the animations.

export const ACCENT = { dishwasher: "#14b8a6", washer: "#3b82f6", dryer: "#f97316", washer_dryer: "#6366f1", printer: "#ec4899",
  oven: "#ef4444", coffee: "#b45309", dehumidifier: "#0ea5e9", freezer: "#38bdf8", other: "#8b5cf6" };

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


// A washer that also dries: water first, then the warm glow.
function washerDryer(u, display) {
  return washer(u, display, false).replace('<g class="aw-water">',
    `<circle class="aw-heat aw-comboheat" cx="100" cy="150" r="46" fill="url(#glow${u})" opacity="0"/><g class="aw-water">`);
}

function printer(u, display) {
  const layers = Array.from({ length: 9 }, (_, i) => `<line x1="76" y1="${168 - i * 4}" x2="124" y2="${168 - i * 4}" stroke="#fff" stroke-opacity=".18"/>`).join("");
  return `<svg viewBox="0 0 200 244" class="aw-svg">${body(u)}
    <g class="aw-beam"><ellipse cx="100" cy="240" rx="40" ry="6" fill="url(#glow${u})"/></g>
    <g class="aw-body">
      <rect x="18" y="6" width="164" height="226" rx="16" fill="url(#steel${u})" stroke="#b8bec7" stroke-width="1.2"/>
      <rect x="30" y="18" width="140" height="172" rx="10" fill="#0f172a"/>
      <rect x="30" y="18" width="140" height="172" rx="10" fill="url(#glow${u})" opacity=".12"/>
      <rect x="36" y="24" width="4" height="160" rx="2" fill="#475569"/><rect x="160" y="24" width="4" height="160" rx="2" fill="#475569"/>
      <g class="aw-spool" style="transform-origin:148px 42px"><circle cx="148" cy="42" r="14" fill="var(--aw-accent)"/>
        <circle cx="148" cy="42" r="5" fill="#0f172a"/><path d="M148 30 v6 M148 48 v6 M136 42 h6 M154 42 h6" stroke="#0f172a" stroke-width="2"/></g>
      <g class="aw-gantry"><rect x="40" y="94" width="120" height="6" rx="3" fill="#94a3b8"/>
        <g class="aw-head"><path d="M148 56 C148 72 120 70 104 84" stroke="var(--aw-accent)" stroke-width="1.6" fill="none"/>
          <rect x="88" y="84" width="24" height="18" rx="4" fill="#e2e8f0"/><rect x="92" y="88" width="16" height="4" rx="2" fill="var(--aw-accent)"/>
          <path d="M96 102 h8 l-4 7z" fill="#f59e0b"/><circle class="aw-hot" cx="100" cy="111" r="3" fill="#fbbf24"/></g></g>
      <g class="aw-print"><rect x="76" y="132" width="48" height="36" rx="4" fill="var(--aw-accent)"/>${layers}
        <rect x="76" y="132" width="10" height="36" rx="3" fill="#fff" opacity=".18"/></g>
      <rect x="44" y="168" width="112" height="8" rx="2" fill="#475569"/><rect x="44" y="168" width="112" height="2" rx="1" fill="#94a3b8"/>
      <g transform="rotate(20 100 120)"><rect class="aw-shine" x="-60" y="10" width="30" height="220" fill="url(#sh${u})"/></g>
      <rect x="40" y="198" width="70" height="22" rx="5" fill="#0f172a"/>
      <text class="aw-display" x="75" y="214" text-anchor="middle">${display || ""}</text>
      <circle class="aw-led" cx="132" cy="209" r="3.2"/>
      <g class="aw-knob" style="transform-origin:156px 209px"><circle cx="156" cy="209" r="11" fill="url(#chrome${u})" stroke="#aeb5bf"/></g>
    </g></svg>`;
}

function oven(u, display) {
  return `<svg viewBox="0 0 200 244" class="aw-svg">${body(u)}
    <defs><radialGradient id="ov${u}" cx=".5" cy=".6" r=".7"><stop offset="0" stop-color="#ffb347"/><stop offset=".6" stop-color="#ef4444" stop-opacity=".7"/><stop offset="1" stop-color="#1c1917" stop-opacity="0"/></radialGradient></defs>
    <g class="aw-beam"><ellipse cx="100" cy="240" rx="40" ry="6" fill="url(#glow${u})"/></g>
    <g class="aw-body">
      <rect x="14" y="2" width="172" height="230" rx="16" fill="url(#steel${u})" stroke="#b8bec7" stroke-width="1.2"/>
      ${panel(u, display)}
      <rect x="36" y="58" width="128" height="10" rx="5" fill="url(#chrome${u})"/>
      <rect x="34" y="76" width="132" height="120" rx="12" fill="#1c1917"/>
      <rect class="aw-ovenglow" x="34" y="76" width="132" height="120" rx="12" fill="url(#ov${u})" opacity="0"/>
      <path class="aw-coil" d="M44 90 h112 M44 182 q8 -8 16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0" stroke="#7f1d1d" stroke-width="3" fill="none" stroke-linecap="round"/>
      <line x1="42" y1="160" x2="158" y2="160" stroke="#a8a29e" stroke-width="2"/>
      <g class="aw-food"><ellipse cx="100" cy="150" rx="34" ry="12" fill="#c2410c"/><ellipse cx="94" cy="146" rx="22" ry="7" fill="#ea8a3a"/>
        <path d="M128 146 q12 -6 14 4" stroke="#fde68a" stroke-width="4" fill="none" stroke-linecap="round"/></g>
      <g class="aw-heatwaves" stroke="#fdba74" stroke-width="2.5" fill="none" stroke-linecap="round">
        <path d="M76 132 q-6 -10 0 -20 q6 -10 0 -20"/><path d="M100 128 q-6 -10 0 -20 q6 -10 0 -20"/><path d="M124 132 q-6 -10 0 -20 q6 -10 0 -20"/></g>
      <g class="aw-steam">${[0, 1, 2].map((i) => `<circle class="aw-puff" style="--i:${i}" cx="${82 + i * 18}" cy="120" r="9" fill="#fff"/>`).join("")}</g>
      <rect x="34" y="76" width="132" height="120" rx="12" fill="none" stroke="#57534e" stroke-width="3"/>
      <path d="M42 84 l34 0 l-30 54z" fill="#fff" opacity=".06"/>
      <rect x="40" y="204" width="120" height="16" rx="6" fill="#d1d5db" opacity=".55"/>
    </g></svg>`;
}

function coffee(u, display) {
  return `<svg viewBox="0 0 200 244" class="aw-svg">${body(u)}
    <defs><linearGradient id="cf${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#475569"/><stop offset="1" stop-color="#1e293b"/></linearGradient>
      <clipPath id="cup${u}"><path d="M78 166 h44 l-4 34 a6 6 0 0 1 -6 5 h-24 a6 6 0 0 1 -6 -5z"/></clipPath></defs>
    <g class="aw-beam"><ellipse cx="100" cy="240" rx="40" ry="6" fill="url(#glow${u})"/></g>
    <g class="aw-body">
      <rect x="30" y="6" width="140" height="226" rx="18" fill="url(#cf${u})" stroke="#0f172a"/>
      <rect x="40" y="18" width="80" height="24" rx="6" fill="#0f172a"/>
      <text class="aw-display" x="80" y="35" text-anchor="middle">${display || ""}</text>
      <circle class="aw-led" cx="138" cy="30" r="3.2"/>
      <rect x="44" y="56" width="112" height="26" rx="8" fill="url(#chrome${u})"/>
      <rect x="92" y="82" width="16" height="14" rx="3" fill="#94a3b8"/><rect x="95" y="96" width="4" height="8" rx="1" fill="#64748b"/><rect x="101" y="96" width="4" height="8" rx="1" fill="#64748b"/>
      <rect x="40" y="104" width="120" height="112" rx="10" fill="#0f172a" opacity=".55"/>
      <g class="aw-stream"><line x1="97" y1="104" x2="97" y2="196" stroke="#78350f" stroke-width="3" stroke-dasharray="6 6"/>
        <line x1="103" y1="104" x2="103" y2="196" stroke="#78350f" stroke-width="3" stroke-dasharray="6 6"/></g>
      <path d="M78 166 h44 l-4 34 a6 6 0 0 1 -6 5 h-24 a6 6 0 0 1 -6 -5z" fill="#f8fafc" stroke="#cbd5e1"/>
      <g clip-path="url(#cup${u})"><rect class="aw-fill" x="76" y="168" width="48" height="40" fill="#78350f"/><rect class="aw-fill" x="76" y="168" width="48" height="4" fill="#d6a46b" opacity=".8"/></g>
      <path d="M122 174 q12 2 10 12 q-2 8 -12 8" fill="none" stroke="#cbd5e1" stroke-width="4"/>
      <g class="aw-steam">${[0, 1, 2].map((i) => `<circle class="aw-puff" style="--i:${i}" cx="${88 + i * 12}" cy="160" r="6" fill="#fff"/>`).join("")}</g>
      <rect x="44" y="210" width="112" height="10" rx="4" fill="#94a3b8" opacity=".6"/>
    </g></svg>`;
}

function dehumidifier(u, display) {
  const grille = Array.from({ length: 8 }, (_, i) => `<rect x="${46 + i * 14}" y="20" width="8" height="54" rx="4" fill="#cbd5e1"/>`).join("");
  return `<svg viewBox="0 0 200 244" class="aw-svg">${body(u)}
    <defs><clipPath id="tk${u}"><rect x="48" y="154" width="104" height="54" rx="8"/></clipPath>
      <clipPath id="gr${u}"><rect x="40" y="16" width="120" height="62" rx="12"/></clipPath></defs>
    <g class="aw-beam"><ellipse cx="100" cy="240" rx="40" ry="6" fill="url(#glow${u})"/></g>
    <g class="aw-body">
      <rect x="28" y="6" width="144" height="226" rx="26" fill="url(#b${u})" stroke="#cfd5dd" stroke-width="1.2"/>
      <rect x="40" y="16" width="120" height="62" rx="12" fill="#1e293b"/>
      <g clip-path="url(#gr${u})"><g class="aw-fan" style="transform-origin:100px 47px">
        ${[0, 72, 144, 216, 288].map((a) => `<path d="M100 47 q16 -22 4 -34 q-10 10 -4 34z" fill="#64748b" transform="rotate(${a} 100 47)"/>`).join("")}
        <circle cx="100" cy="47" r="6" fill="#94a3b8"/></g></g>
      <g opacity=".85">${grille}</g>
      <rect x="54" y="92" width="92" height="40" rx="10" fill="#0f172a"/>
      <text class="aw-display" x="88" y="117" text-anchor="middle">${display || ""}</text>
      <circle class="aw-led" cx="128" cy="112" r="3.2"/>
      <rect class="aw-tankframe" x="48" y="154" width="104" height="54" rx="8" fill="#e0f2fe" stroke="#bae6fd" stroke-width="2"/>
      <g clip-path="url(#tk${u})"><g class="aw-tank"><rect x="44" y="160" width="112" height="60" fill="#38bdf8" opacity=".75"/>
        <path d="M44 162 q14 -6 28 0 t28 0 t28 0 t28 0 v6 h-112z" fill="#7dd3fc"/></g></g>
      <circle class="aw-drip" cx="100" cy="140" r="3.5" fill="#38bdf8"/>
      <g transform="rotate(20 100 120)"><rect class="aw-shine" x="-60" y="10" width="30" height="220" fill="url(#sh${u})"/></g>
    </g></svg>`;
}

function freezer(u, display) {
  const flake = (x, y, r) => `<g stroke="#bae6fd" stroke-width="2" stroke-linecap="round" opacity=".9">${[0, 60, 120].map((a) => `<line x1="${x}" y1="${y - r}" x2="${x}" y2="${y + r}" transform="rotate(${a} ${x} ${y})"/>`).join("")}</g>`;
  return `<svg viewBox="0 0 200 244" class="aw-svg">${body(u)}
    <defs><linearGradient id="fz${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e0f2fe" stop-opacity=".9"/><stop offset="1" stop-color="#e0f2fe" stop-opacity="0"/></linearGradient></defs>
    <g class="aw-beam"><ellipse cx="100" cy="240" rx="40" ry="6" fill="url(#glow${u})"/></g>
    <g class="aw-body">
      <rect x="34" y="2" width="132" height="230" rx="16" fill="url(#b${u})" stroke="#aab6c5" stroke-width="1.6"/>
      <rect x="34" y="2" width="132" height="78" rx="16" fill="url(#fz${u})" opacity=".7"/>
      <line x1="36" y1="82" x2="164" y2="82" stroke="#9aa7b8" stroke-width="3"/>
      <rect x="44" y="212" width="112" height="12" rx="4" fill="#cfd6e0"/>
      <path d="M52 218 h96" stroke="#aab6c5" stroke-width="2" stroke-dasharray="6 5"/>
      <rect x="146" y="20" width="8" height="46" rx="4" fill="url(#chrome${u})"/><rect x="146" y="98" width="8" height="90" rx="4" fill="url(#chrome${u})"/>
      ${flake(70, 40, 13)}${flake(104, 54, 8)}
      <rect x="56" y="104" width="64" height="30" rx="8" fill="#0f172a"/>
      <text class="aw-display" x="88" y="124" text-anchor="middle">${display || ""}</text>
      <circle class="aw-led" cx="132" cy="119" r="3.2"/>
      <g class="aw-mist">${[0, 1, 2, 3].map((i) => `<circle class="aw-cold" style="--i:${i}" cx="${64 + i * 22}" cy="230" r="9" fill="#e0f2fe"/>`).join("")}</g>
      <rect class="aw-alarm" x="34" y="2" width="132" height="230" rx="16" fill="none" stroke="#ef4444" stroke-width="5" opacity="0"/>
      <g transform="rotate(20 100 120)"><rect class="aw-shine" x="-60" y="10" width="30" height="220" fill="url(#sh${u})"/></g>
    </g></svg>`;
}

export function machineSVG(kind, state, opts = {}) {
  const u = opts.uid || Math.random().toString(36).slice(2, 8);
  const ART = { dishwasher, printer, oven, coffee, dehumidifier, freezer, washer_dryer: washerDryer };
  const draw = ART[kind] ? ART[kind](u, opts.display) : kind === "washer" ? washer(u, opts.display, false)
    : kind === "dryer" ? washer(u, opts.display, true) : other(u, opts.display);
  const check = state === "finished"
    ? `<div class="aw-check"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" fill="#22c55e"/><path d="M15 27 l8 8 l15 -17" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`
    : state === "alert"
      ? `<div class="aw-check aw-warn"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" fill="#ef4444"/><path d="M26 13 v16" stroke="#fff" stroke-width="5" stroke-linecap="round"/><circle cx="26" cy="37" r="3.2" fill="#fff"/></svg></div>`
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

  /* the newer machines */
  .aw-head, .aw-print, .aw-spool, .aw-fan, .aw-tank, .aw-fill, .aw-drip, .aw-cold, .aw-heatwaves path, .aw-stream line { transform-box:view-box; }
  .aw-washer_dryer.aw-running .aw-drum { animation:aw-spin 2.4s cubic-bezier(.45,.05,.55,.95) infinite alternate; }
  .aw-washer_dryer.aw-running .aw-water { animation:aw-wave 2.2s linear infinite, aw-combo-water 16s ease-in-out infinite; }
  .aw-washer_dryer.aw-running .aw-comboheat { animation:aw-combo-heat 16s ease-in-out infinite; }
  .aw-washer_dryer.aw-running .aw-body { animation:aw-shake .32s linear infinite; }
  .aw-washer_dryer.aw-running .aw-display { fill:#a5b4fc; }
  @keyframes aw-combo-water { 0%,45% { opacity:1; } 55%,95% { opacity:0; } 100% { opacity:1; } }
  @keyframes aw-combo-heat { 0%,45% { opacity:0; } 55%,90% { opacity:.65; } 100% { opacity:0; } }
  .aw-print { transform-origin:100px 168px; transform:scaleY(.15); }
  .aw-running .aw-print, .aw-finishing .aw-print { animation:aw-grow 16s linear infinite; }
  .aw-finished .aw-print { transform:scaleY(1); }
  .aw-printer.aw-running .aw-head { animation:aw-slide 1.4s ease-in-out infinite alternate; }
  .aw-printer.aw-running .aw-gantry { animation:aw-lift 16s linear infinite; }
  .aw-printer.aw-running .aw-spool { animation:aw-spin 7s linear infinite; }
  .aw-hot { opacity:0; } .aw-printer.aw-running .aw-hot { opacity:1; animation:aw-blink .7s ease-in-out infinite; }
  .aw-printer.aw-running .aw-display { fill:#f9a8d4; }
  @keyframes aw-grow { from { transform:scaleY(.08); } to { transform:scaleY(1); } }
  @keyframes aw-slide { from { transform:translateX(-30px); } to { transform:translateX(30px); } }
  @keyframes aw-lift { from { transform:translateY(64px); } to { transform:translateY(28px); } }
  .aw-oven.aw-running .aw-ovenglow { animation:aw-glow 2.6s ease-in-out infinite; }
  .aw-oven.aw-running .aw-coil { stroke:#f97316; filter:drop-shadow(0 0 4px #f97316); animation:aw-blink 2.6s ease-in-out infinite; }
  .aw-heatwaves { opacity:0; } .aw-oven.aw-running .aw-heatwaves { opacity:1; }
  .aw-oven.aw-running .aw-heatwaves path { animation:aw-rise 2.2s ease-in infinite; opacity:0; }
  .aw-oven.aw-running .aw-heatwaves path:nth-child(2) { animation-delay:.7s; } .aw-oven.aw-running .aw-heatwaves path:nth-child(3) { animation-delay:1.4s; }
  .aw-oven.aw-running .aw-display { fill:#fca5a5; }
  .aw-oven.aw-finished .aw-puff, .aw-coffee.aw-finished .aw-puff { animation:aw-steam 4.2s ease-out infinite; animation-delay:calc(var(--i) * 1.2s); }
  .aw-stream { opacity:0; } .aw-coffee.aw-running .aw-stream { opacity:1; }
  .aw-coffee.aw-running .aw-stream line { animation:aw-pour .5s linear infinite; }
  .aw-fill { transform-origin:100px 205px; transform:scaleY(0); }
  .aw-coffee.aw-running .aw-fill { animation:aw-cup 20s ease-out infinite; }
  .aw-coffee.aw-finished .aw-fill { transform:scaleY(1); }
  .aw-coffee.aw-running .aw-display { fill:#fcd34d; }
  @keyframes aw-pour { to { stroke-dashoffset:-12; } }
  @keyframes aw-cup { from { transform:scaleY(0); } to { transform:scaleY(1); } }
  .aw-dehumidifier.aw-running .aw-fan { animation:aw-spin 1.2s linear infinite; }
  .aw-tank { transform:translateY(34px); }
  .aw-dehumidifier.aw-running .aw-tank { animation:aw-fillup 30s ease-in-out infinite alternate; }
  .aw-dehumidifier.aw-alert .aw-tank { transform:translateY(-4px); }
  .aw-drip { opacity:0; } .aw-dehumidifier.aw-running .aw-drip { animation:aw-drip 1.8s ease-in infinite; }
  .aw-dehumidifier.aw-alert .aw-tankframe { stroke:#ef4444; animation:aw-blink 1.2s ease-in-out infinite; }
  .aw-dehumidifier.aw-running .aw-display { fill:#7dd3fc; }
  @keyframes aw-fillup { from { transform:translateY(34px); } to { transform:translateY(10px); } }
  @keyframes aw-drip { 0% { transform:translateY(0); opacity:0; } 20% { opacity:1; } 100% { transform:translateY(22px); opacity:0; } }
  .aw-cold { opacity:0; } .aw-freezer.aw-running .aw-cold { animation:aw-mist 4s ease-out infinite; animation-delay:calc(var(--i) * .9s); }
  .aw-freezer.aw-running .aw-display, .aw-freezer.aw-off .aw-display { fill:#7dd3fc; }
  .aw-freezer.aw-alert .aw-alarm { animation:aw-blink 1.1s ease-in-out infinite; opacity:1; }
  @keyframes aw-mist { 0% { transform:translate(0,0) scale(.5); opacity:0; } 30% { opacity:.55; } 100% { transform:translate(8px,14px) scale(2); opacity:0; } }
  .aw-alert .aw-led { fill:#ef4444; animation:aw-blink .9s ease-in-out infinite; }
  .aw-alert .aw-display { fill:#fca5a5; }
  .aw-warn::after { box-shadow:0 0 0 0 rgba(239,68,68,.6); animation:aw-ring-red 1.8s 0s ease-out infinite; }
  @keyframes aw-ring-red { 0% { box-shadow:0 0 0 0 rgba(239,68,68,.55); } 100% { box-shadow:0 0 0 14px rgba(239,68,68,0); } }
  @media (prefers-reduced-motion: reduce) { .aw-machine * { animation:none !important; } }
`;

// Words and helpers both views use.
export const TEXTS = {
  en: {
    savedOne: "saved", watchOk: "All is well", alerts: { stopped: "Hasn't run for hours – check it", nonstop: "Runs without a break – door open?", lost: "No reading – power or plug?", tank: "Stopped – the tank is probably full" }, kinds: { washer_dryer: "Washer-dryer", printer: "3D printer", oven: "Airfryer / oven", coffee: "Coffee machine", dehumidifier: "Dehumidifier", freezer: "Freezer", dishwasher: "Dishwasher", washer: "Washing machine", dryer: "Dryer", other: "Appliance" },
    states: { alert: "Needs attention", off: "Ready", running: "Running", finishing: "Nearly done", finished: "Done" },
    doneAt: "done", left: "left", unknownTime: "Learning the programme…", emptied: "Emptied", waiting: "Waiting to be emptied",
    since: "since", cheap: "Cheapest start", save: "save", now: "Now", program: "Program", noMachines: "No machines yet",
  },
  da: {
    savedOne: "sparede", watchOk: "Alt er i orden", alerts: { stopped: "Har ikke kørt i timevis – tjek den", nonstop: "Kører uden pause – står døren åben?", lost: "Ingen måling – strøm eller stik?", tank: "Stoppet – tanken er nok fuld" }, kinds: { washer_dryer: "Vaske-tørremaskine", printer: "3D-printer", oven: "Airfryer / ovn", coffee: "Kaffemaskine", dehumidifier: "Affugter", freezer: "Fryser", dishwasher: "Opvaskemaskine", washer: "Vaskemaskine", dryer: "Tørretumbler", other: "Maskine" },
    states: { alert: "Kræver opmærksomhed", off: "Klar", running: "Kører", finishing: "Næsten færdig", finished: "Færdig" },
    doneAt: "færdig", left: "tilbage", unknownTime: "Lærer programmet…", emptied: "Tømt", waiting: "Venter på at blive tømt",
    since: "siden", cheap: "Billigst at starte", save: "spar", now: "Nu", program: "Program", noMachines: "Ingen maskiner endnu",
  },
  de: {
    savedOne: "gespart", watchOk: "Alles in Ordnung", alerts: { stopped: "Läuft seit Stunden nicht – bitte prüfen", nonstop: "Läuft ohne Pause – Tür offen?", lost: "Keine Messung – Strom oder Stecker?", tank: "Angehalten – der Tank ist wohl voll" }, kinds: { washer_dryer: "Waschtrockner", printer: "3D-Drucker", oven: "Heißluftfritteuse / Ofen", coffee: "Kaffeemaschine", dehumidifier: "Luftentfeuchter", freezer: "Gefrierschrank", dishwasher: "Geschirrspüler", washer: "Waschmaschine", dryer: "Trockner", other: "Gerät" },
    states: { alert: "Braucht Aufmerksamkeit", off: "Bereit", running: "Läuft", finishing: "Fast fertig", finished: "Fertig" },
    doneAt: "fertig um", left: "übrig", unknownTime: "Lernt das Programm…", emptied: "Ausgeräumt", waiting: "Wartet aufs Ausräumen",
    since: "seit", cheap: "Günstigster Start", save: "spart", now: "Jetzt", program: "Programm", noMachines: "Noch keine Geräte",
  },
  sv: {
    savedOne: "sparade", watchOk: "Allt är bra", alerts: { stopped: "Har inte gått på timmar – kolla den", nonstop: "Går utan paus – står dörren öppen?", lost: "Ingen mätning – ström eller kontakt?", tank: "Stannat – tanken är nog full" }, kinds: { washer_dryer: "Kombimaskin", printer: "3D-skrivare", oven: "Airfryer / ugn", coffee: "Kaffebryggare", dehumidifier: "Avfuktare", freezer: "Frys", dishwasher: "Diskmaskin", washer: "Tvättmaskin", dryer: "Torktumlare", other: "Maskin" },
    states: { alert: "Behöver ses över", off: "Redo", running: "Kör", finishing: "Nästan klar", finished: "Klar" },
    doneAt: "klar", left: "kvar", unknownTime: "Lär sig programmet…", emptied: "Tömd", waiting: "Väntar på att tömmas",
    since: "sedan", cheap: "Billigast att starta", save: "spara", now: "Nu", program: "Program", noMachines: "Inga maskiner än",
  },
  nb: {
    savedOne: "sparte", watchOk: "Alt er i orden", alerts: { stopped: "Har ikke gått på timevis – sjekk den", nonstop: "Går uten pause – står døren åpen?", lost: "Ingen måling – strøm eller kontakt?", tank: "Stoppet – tanken er nok full" }, kinds: { washer_dryer: "Vaske-tørkemaskin", printer: "3D-printer", oven: "Airfryer / stekeovn", coffee: "Kaffemaskin", dehumidifier: "Avfukter", freezer: "Fryser", dishwasher: "Oppvaskmaskin", washer: "Vaskemaskin", dryer: "Tørketrommel", other: "Maskin" },
    states: { alert: "Trenger tilsyn", off: "Klar", running: "Går", finishing: "Nesten ferdig", finished: "Ferdig" },
    doneAt: "ferdig", left: "igjen", unknownTime: "Lærer programmet…", emptied: "Tømt", waiting: "Venter på å bli tømt",
    since: "siden", cheap: "Billigst å starte", save: "spar", now: "Nå", program: "Program", noMachines: "Ingen maskiner ennå",
  },
  nl: {
    savedOne: "bespaard", watchOk: "Alles in orde", alerts: { stopped: "Draait al uren niet – kijk ernaar", nonstop: "Draait zonder pauze – deur open?", lost: "Geen meting – stroom of stekker?", tank: "Gestopt – de tank is waarschijnlijk vol" }, kinds: { washer_dryer: "Was-droogcombinatie", printer: "3D-printer", oven: "Airfryer / oven", coffee: "Koffiezetapparaat", dehumidifier: "Ontvochtiger", freezer: "Vriezer", dishwasher: "Vaatwasser", washer: "Wasmachine", dryer: "Droger", other: "Apparaat" },
    states: { alert: "Vraagt aandacht", off: "Klaar", running: "Bezig", finishing: "Bijna klaar", finished: "Klaar" },
    doneAt: "klaar om", left: "te gaan", unknownTime: "Leert het programma…", emptied: "Uitgeruimd", waiting: "Wacht om uitgeruimd te worden",
    since: "sinds", cheap: "Goedkoopst om te starten", save: "bespaar", now: "Nu", program: "Programma", noMachines: "Nog geen apparaten",
  },
  fr: {
    savedOne: "économisé", watchOk: "Tout va bien", alerts: { stopped: "Ne tourne plus depuis des heures – vérifiez", nonstop: "Tourne sans arrêt – porte ouverte ?", lost: "Plus de mesure – courant ou prise ?", tank: "Arrêté – le réservoir est sans doute plein" }, kinds: { washer_dryer: "Lavante-séchante", printer: "Imprimante 3D", oven: "Air fryer / four", coffee: "Machine à café", dehumidifier: "Déshumidificateur", freezer: "Congélateur", dishwasher: "Lave-vaisselle", washer: "Lave-linge", dryer: "Sèche-linge", other: "Appareil" },
    states: { alert: "Demande attention", off: "Prêt", running: "En marche", finishing: "Presque fini", finished: "Terminé" },
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

// A machine that runs all the time (freezer, dehumidifier): watched for trouble, no programmes.
export function watchText(m, w) {
  if (m.state === "alert") return { main: `<b>${w.states.alert}</b>`, sub: w.alerts[m.alert] || "" };
  return { main: w.watchOk, sub: m.power != null ? `⚡ ${Math.round(m.power)} W` : "" };
}

export function display(m) {
  if (m.watched) return m.state === "alert" ? "!" : m.kind === "freezer" ? "OK" : m.state === "running" ? "ON" : "";
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
