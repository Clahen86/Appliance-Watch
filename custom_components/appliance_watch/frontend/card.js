// Appliance Watch card: one machine, or all of them, animated - for any dashboard.
import { ACCENT, MACHINE_CSS, TEXTS, clock, display, dur, esc, hm, lang, machineSVG, minutesLeft, money, watchText } from "./machines.js";

const STATUS = (hass) => Object.values(hass.entities || {})
  .filter((e) => e.platform === "appliance_watch" && e.translation_key === "status" && hass.states[e.entity_id])
  .map((e) => e.entity_id);

class ApplianceWatchCard extends HTMLElement {
  setConfig(config) {
    this._config = config || {};
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
  }
  set hass(hass) {
    this._hass = hass;
    const ids = this._ids();
    const states = ids.map((id) => hass.states[id]);
    if (states.every((s, i) => s === this._states?.[i]) && states.length === this._states?.length) return;
    this._states = states;
    // Drawn again only when a machine changes state; otherwise only the text moves (no flicker).
    const shape = ids.map((id) => { const s = hass.states[id]; return s ? [s.state, s.attributes.kind, s.attributes.name].join("|") : ""; }).join(";")
      + JSON.stringify(this._config);
    if (shape !== this._shape) { this._shape = shape; this._render(); } else this._patch();
  }
  connectedCallback() { this._tick = setInterval(() => this._patch(), 30000); }
  disconnectedCallback() { clearInterval(this._tick); }
  _ids() {
    const c = this._config || {};
    if (c.entity) return [c.entity];
    if (Array.isArray(c.entities) && c.entities.length) return c.entities;
    return this._hass ? STATUS(this._hass) : [];
  }
  getCardSize() { return this._ids().length > 1 ? 3 : 2; }
  getGridOptions() { return { columns: 12, min_columns: 6, rows: this._ids().length > 1 ? 4 : 2 }; }
  static getConfigElement() { return document.createElement("appliance-watch-card-editor"); }
  static getStubConfig() { return {}; }

  _machine(id) {
    const s = this._hass.states[id];
    if (!s) return null;
    return { ...s.attributes, state: s.state, entity_id: id };
  }

  _render() {
    if (!this._hass || !this.shadowRoot) return;
    const L = lang(this._hass), w = TEXTS[L];
    const ms = this._ids().map((id) => this._machine(id)).filter(Boolean);
    const single = ms.length === 1 && this._config.layout !== "tiles";
    const body = ms.length ? ms.map((m) => this._one(m, w, L, single)).join("") : `<div class="none">${w.noMachines}</div>`;
    this.shadowRoot.innerHTML = `<style>${MACHINE_CSS}${CSS}</style>
      <ha-card>${this._config.title ? `<div class="title">${esc(this._config.title)}</div>` : ""}
      <div class="${single ? "single" : "tiles"}">${body}</div></ha-card>`;
    this.shadowRoot.querySelectorAll("[data-more]").forEach((el) => el.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      const ev = new Event("hass-more-info", { bubbles: true, composed: true });
      ev.detail = { entityId: el.dataset.more };
      this.dispatchEvent(ev);
    }));
    this.shadowRoot.querySelectorAll("[data-empty]").forEach((el) => el.addEventListener("click", () =>
      this._hass.callService("appliance_watch", "emptied", { entity_id: el.dataset.empty })));
  }

  _patch() {
    if (!this._hass || !this.shadowRoot) return;
    const L = lang(this._hass), w = TEXTS[L];
    for (const id of this._ids()) {
      const m = this._machine(id), el = this.shadowRoot.querySelector(`[data-more="${id}"]`);
      if (!m || !el) return this._render();
      const x = this._text(m, w, L);
      el.querySelector(".main").innerHTML = x.main;
      el.querySelector(".sub").innerHTML = x.sub;
      const bar = el.querySelector(".bar span");
      if (bar) bar.style.width = `${m.progress ?? 8}%`;
      const va = el.querySelector(".ring .va"), rb = el.querySelector(".ring b"), left = minutesLeft(m.finish_time);
      if (va) va.setAttribute("stroke-dashoffset", 169.6 * (1 - (m.progress || 0) / 100));
      if (rb && left != null) rb.textContent = left >= 60 ? hm(left) : left;
      el.querySelectorAll(".aw-display").forEach((d) => (d.textContent = display(m)));
    }
  }

  _text(m, w, L) {
    if (m.watched) return watchText(m, w);
    const active = m.state === "running" || m.state === "finishing";
    const left = minutesLeft(m.finish_time);
    let main, sub = "";
    if (active) {
      main = m.finish_time ? `${w.doneAt} <b>${clock(m.finish_time)}</b>` : w.states.running;
      sub = m.finish_time ? `${left <= 1 ? "…" : hm(left) + " " + w.left}${m.program ? " · " + esc(m.program) : ""}` : w.unknownTime;
    } else if (m.state === "finished") {
      main = `${w.states.finished} <b>${clock(m.finished_at)}</b>`;
      sub = w.waiting;
    } else {
      main = w.states.off;
      sub = m.cheap ? `💡 ${w.cheap} ${clock(m.cheap.start)} · ${w.save} ${money(m.cheap.saving, m.currency)}`
        : m.last ? [m.last.program, dur(m.last.duration, L), money(m.last.cost, m.currency),
          m.last.saved > 0.05 ? `${w.savedOne} ${money(m.last.saved, m.currency)}` : ""].filter(Boolean).map(esc).join(" · ") : "";
    }
    return { main, sub };
  }

  _one(m, w, L, single) {
    const active = m.state === "running" || m.state === "finishing";
    const { main, sub } = this._text(m, w, L);
    const bar = active ? `<div class="bar"><span style="width:${m.progress ?? 8}%"></span></div>` : "";
    const left = minutesLeft(m.finish_time);
    const ring = single && active && m.finish_time ? `<div class="ring"><svg viewBox="0 0 64 64"><circle class="tr" cx="32" cy="32" r="27"/>
      <circle class="va" cx="32" cy="32" r="27" stroke-dasharray="169.6" stroke-dashoffset="${169.6 * (1 - (m.progress || 0) / 100)}"/></svg>
      <b>${left >= 60 ? hm(left) : left}</b></div>` : "";
    return `<div class="m s-${m.state}" style="--a:${m.state === "finished" ? "#22c55e" : ACCENT[m.kind] || ACCENT.other}" data-more="${m.entity_id}">${ring}
      <div class="art">${machineSVG(m.kind, m.state, { display: display(m), uid: m.entity_id.replace(/\W/g, "").slice(-10) })}</div>
      <div class="txt"><div class="name">${esc(m.name || w.kinds[m.kind])}</div>
        <div class="main">${main}</div><div class="sub">${sub}</div>${bar}
        ${m.state === "finished" ? `<button data-empty="${m.entity_id}">✓ ${w.emptied}</button>` : ""}</div>
    </div>`;
  }
}

const CSS = `
  @property --ang { syntax:"<angle>"; initial-value:0deg; inherits:false; }
  ha-card { padding:12px; overflow:hidden; }
  .title { font-size:18px; font-weight:600; margin:2px 4px 10px; letter-spacing:-.01em; }
  .m { cursor:pointer; position:relative; border-radius:22px; border:2px solid transparent; transition:background .4s; isolation:isolate; overflow:hidden; }
  .m::before { content:""; position:absolute; inset:0; z-index:-1; opacity:0; transition:opacity .5s;
    background:radial-gradient(130% 110% at 0% 0%, color-mix(in srgb, var(--a) 26%, transparent), transparent 65%); }
  .m.s-running::before, .m.s-finishing::before, .m.s-finished::before { opacity:1; }
  .m.s-running, .m.s-finishing { background:linear-gradient(var(--card-background-color, var(--ha-card-background, #fff)), var(--card-background-color, var(--ha-card-background, #fff))) padding-box,
    conic-gradient(from var(--ang), var(--a), transparent 30%, transparent 70%, var(--a)) border-box; animation:orbit 3.5s linear infinite; }
  @keyframes orbit { to { --ang:360deg; } }
  .m.s-finished { border-color:#22c55e; animation:glow 2.4s ease-in-out infinite; }
  @keyframes glow { 50% { box-shadow:0 0 0 5px rgba(34,197,94,.14); } }
  .single .m { display:flex; align-items:center; gap:14px; padding:10px 12px; }
  .single .art { width:100px; height:122px; flex:none; filter:drop-shadow(0 10px 12px rgba(0,0,0,.18)); }
  .tiles { display:grid; grid-template-columns:repeat(auto-fit, minmax(118px, 1fr)); gap:10px; }
  .tiles .m { display:flex; flex-direction:column; align-items:center; text-align:center; padding:12px 6px 10px; }
  .tiles .art { width:78px; height:95px; filter:drop-shadow(0 8px 10px rgba(0,0,0,.16)); }
  .txt { min-width:0; flex:1; width:100%; }
  .name { font-weight:700; font-size:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .main { font-size:20px; margin-top:2px; letter-spacing:-.01em; } .main b { font-weight:800; }
  .tiles .main { font-size:15px; }
  .sub { font-size:12px; color:var(--secondary-text-color); margin-top:2px; min-height:15px; }
  .bar { height:7px; border-radius:5px; background:color-mix(in srgb, var(--a) 15%, transparent); margin-top:8px; overflow:hidden; }
  .bar span { display:block; height:100%; border-radius:5px; background:linear-gradient(90deg, color-mix(in srgb, var(--a) 60%, #fff), var(--a)); transition:width 1s; }
  .single .bar { display:none; }
  .ring { position:absolute; right:12px; top:50%; transform:translateY(-50%); width:64px; height:64px; }
  .ring svg { width:100%; height:100%; transform:rotate(-90deg); } .ring circle { fill:none; stroke-width:6; }
  .ring .tr { stroke:color-mix(in srgb, var(--a) 16%, transparent); }
  .ring .va { stroke:var(--a); stroke-linecap:round; transition:stroke-dashoffset 1s; }
  .ring b { position:absolute; inset:0; display:grid; place-items:center; font-size:17px; font-weight:800; }
  .single .m:has(.ring) .txt { padding-right:70px; }
  button { margin-top:8px; font:inherit; font-size:13px; font-weight:600; border:0; border-radius:14px; padding:7px 14px; background:#22c55e; color:#fff; cursor:pointer;
    box-shadow:0 6px 14px -6px rgba(34,197,94,.7); }
  .none { color:var(--secondary-text-color); padding:12px; }
  @media (prefers-reduced-motion: reduce) { .m { animation:none !important; } }
`;

const EDITOR = {
  en: { entity: "Machine (empty = all)", title: "Title", layout: "Layout", auto: "Automatic", tiles: "Tiles" },
  da: { entity: "Maskine (tom = alle)", title: "Titel", layout: "Visning", auto: "Automatisk", tiles: "Fliser" },
  de: { entity: "Gerät (leer = alle)", title: "Titel", layout: "Ansicht", auto: "Automatisch", tiles: "Kacheln" },
  sv: { entity: "Maskin (tom = alla)", title: "Titel", layout: "Visning", auto: "Automatisk", tiles: "Rutor" },
  nb: { entity: "Maskin (tom = alle)", title: "Tittel", layout: "Visning", auto: "Automatisk", tiles: "Fliser" },
  nl: { entity: "Apparaat (leeg = alle)", title: "Titel", layout: "Weergave", auto: "Automatisch", tiles: "Tegels" },
  fr: { entity: "Appareil (vide = tous)", title: "Titre", layout: "Affichage", auto: "Automatique", tiles: "Tuiles" },
};

class ApplianceWatchCardEditor extends HTMLElement {
  setConfig(config) { this._config = config || {}; this._render(); }
  set hass(hass) { this._hass = hass; this._render(); }
  _render() {
    if (!this._hass || !this._config) return;
    const L = lang(this._hass);
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) => (EDITOR[L] || EDITOR.en)[s.name];
      this._form.addEventListener("value-changed", (e) => {
        const config = { ...e.detail.value };
        Object.keys(config).forEach((k) => (config[k] === "" || config[k] == null) && delete config[k]);
        this._config = config;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    const ids = STATUS(this._hass);
    this._form.hass = this._hass;
    this._form.data = this._config;
    this._form.schema = [
      { name: "entity", selector: { entity: { include_entities: ids } } },
      { name: "title", selector: { text: {} } },
      { name: "layout", selector: { select: { mode: "dropdown", options: [
        { value: "auto", label: (EDITOR[L] || EDITOR.en).auto }, { value: "tiles", label: (EDITOR[L] || EDITOR.en).tiles }] } } },
    ];
  }
}

if (!customElements.get("appliance-watch-card")) {
  customElements.define("appliance-watch-card", ApplianceWatchCard);
  customElements.define("appliance-watch-card-editor", ApplianceWatchCardEditor);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "appliance-watch-card", name: "Appliance Watch", preview: true,
    description: "Your dishwasher, washing machine and dryer - animated, with when they're done.",
  });
}
