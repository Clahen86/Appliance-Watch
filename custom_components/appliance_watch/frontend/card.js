// Appliance Watch card: one machine, or all of them, animated - for any dashboard.
import { ACCENT, MACHINE_CSS, TEXTS, clock, display, dur, esc, hm, lang, machineSVG, minutesLeft, money } from "./machines.js";

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
      el.querySelectorAll(".aw-display").forEach((d) => (d.textContent = display(m)));
    }
  }

  _text(m, w, L) {
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
        : m.last ? [m.last.program, dur(m.last.duration, L), money(m.last.cost, m.currency)].filter(Boolean).map(esc).join(" · ") : "";
    }
    return { main, sub };
  }

  _one(m, w, L, single) {
    const active = m.state === "running" || m.state === "finishing";
    const { main, sub } = this._text(m, w, L);
    const bar = active ? `<div class="bar"><span style="width:${m.progress ?? 8}%"></span></div>` : "";
    return `<div class="m s-${m.state}" style="--a:${ACCENT[m.kind] || ACCENT.other}" data-more="${m.entity_id}">
      <div class="art">${machineSVG(m.kind, m.state, { display: display(m), uid: m.entity_id.replace(/\W/g, "").slice(-10) })}</div>
      <div class="txt"><div class="name">${esc(m.name || w.kinds[m.kind])}</div>
        <div class="main">${main}</div><div class="sub">${sub}</div>${bar}
        ${m.state === "finished" ? `<button data-empty="${m.entity_id}">✓ ${w.emptied}</button>` : ""}</div>
    </div>`;
  }
}

const CSS = `
  ha-card { padding:14px; overflow:hidden; }
  .title { font-size:18px; font-weight:500; margin:0 2px 10px; }
  .single .m { display:flex; align-items:center; gap:16px; }
  .single .art { width:96px; height:117px; flex:none; }
  .tiles { display:grid; grid-template-columns:repeat(auto-fit, minmax(120px, 1fr)); gap:12px; }
  .tiles .m { display:flex; flex-direction:column; align-items:center; text-align:center; padding:10px 6px; border-radius:16px; }
  .tiles .art { width:76px; height:93px; }
  .m { cursor:pointer; position:relative; border-radius:16px; transition:background .4s; }
  .m.s-running, .m.s-finishing { background:radial-gradient(120% 100% at 0% 0%, color-mix(in srgb, var(--a) 16%, transparent), transparent 70%); }
  .m.s-finished { background:radial-gradient(120% 100% at 0% 0%, rgba(34,197,94,.16), transparent 70%); }
  .txt { min-width:0; flex:1; width:100%; }
  .name { font-weight:700; font-size:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .main { font-size:18px; margin-top:2px; } .main b { font-weight:800; }
  .tiles .main { font-size:15px; }
  .sub { font-size:12px; color:var(--secondary-text-color); margin-top:2px; min-height:15px; }
  .bar { height:6px; border-radius:4px; background:color-mix(in srgb, var(--a) 15%, transparent); margin-top:8px; overflow:hidden; }
  .bar span { display:block; height:100%; border-radius:4px; background:var(--a); transition:width 1s; }
  button { margin-top:8px; font:inherit; font-size:13px; border:0; border-radius:14px; padding:6px 12px; background:#22c55e; color:#fff; cursor:pointer; }
  .none { color:var(--secondary-text-color); padding:12px; }
`;

class ApplianceWatchCardEditor extends HTMLElement {
  setConfig(config) { this._config = config || {}; this._render(); }
  set hass(hass) { this._hass = hass; this._render(); }
  _render() {
    if (!this._hass || !this._config) return;
    const L = lang(this._hass);
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) => ({
        entity: L === "da" ? "Maskine (tom = alle)" : "Machine (empty = all)",
        title: L === "da" ? "Titel" : "Title",
        layout: L === "da" ? "Visning" : "Layout",
      })[s.name];
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
        { value: "auto", label: L === "da" ? "Automatisk" : "Automatic" }, { value: "tiles", label: L === "da" ? "Fliser" : "Tiles" }] } } },
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
