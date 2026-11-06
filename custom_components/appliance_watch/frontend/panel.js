// Appliance Watch panel: every machine as itself, live; history, programmes, settings.
import { ACCENT, MACHINE_CSS, TEXTS, clock, display, dur, esc, hm, lang, machineSVG, minutesLeft, money, num } from "./machines.js";

const T = {
  en: {
    title: "Appliances", settings: "Settings", back: "Back", menu: "Menu", saved: "Saved ✓", add: "Add machine",
    found: "Found in your home", addIt: "Add", running: "running", done: "done", ready: "All ready", month: "This month",
    cycles: "cycles", sinceStart: "so far", last: "Last", soon: "any minute", min: "min", now: "now",
    which: "Which programme was it?", whichHint: "Tell it once - next time it knows by itself.", other: "Other…", name: "Name",
    ok: "OK", ai: "✨ Suggest", aiExplain: "✨ Explain", programs: "Programmes", history: "History", noHistory: "No cycles yet - start the machine.",
    usual: "usually", rename: "Rename", merge: "Merge into…", forget: "Forget", del: "Delete", changeProgram: "Change programme",
    learned: "learned from", unclear: "Not learned from", reasons: { power_lost: "power reading lost", timeout: "ran too long", forced: "ended by hand", switch: "switched off" },
    resumed: "paused - learned", findings: "Worth knowing", dismiss: "OK", live: "Live", watts: "W", finishNow: "It's done",
    machine: "This machine", kind: "Machine", door: "Door sensor", energy: "Energy meter", switch: "Switch", none: "None",
    s: {
      phones: "Notifications", phonesHint: "Who gets a message when a machine is done.", onlyHome: "Only those at home",
      onlyHomeHint: "Phones away from home get nothing - unless nobody is home.", start: "Also when it starts",
      remind: "Remind if not emptied", off: "Off", price: "Electricity price", priceHint: "For the price of each cycle and the cheapest time to start.",
      cheap: "Show a cheaper start when it saves at least", ai: "AI helper", aiHint: "Names programmes and explains odd cycles. It never measures anything.",
      dry: "Done when the drying is over", dryHint: "Off: done as soon as the work is over (it may still dry quietly).",
    },
  },
  da: {
    title: "Maskiner", settings: "Indstillinger", back: "Tilbage", menu: "Menu", saved: "Gemt ✓", add: "Tilføj maskine",
    found: "Fundet i dit hjem", addIt: "Tilføj", running: "kører", done: "færdig", ready: "Alle er klar", month: "Denne måned",
    cycles: "vaske", sinceStart: "indtil nu", last: "Sidst", soon: "om lidt", min: "min", now: "nu",
    which: "Hvilket program var det?", whichHint: "Sig det én gang - næste gang ved den det selv.", other: "Andet…", name: "Navn",
    ok: "OK", ai: "✨ Foreslå", aiExplain: "✨ Forklar", programs: "Programmer", history: "Historik", noHistory: "Ingen vaske endnu - start maskinen.",
    usual: "normalt", rename: "Omdøb", merge: "Slå sammen med…", forget: "Glem", del: "Slet", changeProgram: "Skift program",
    learned: "lært af", unclear: "Ikke lært af", reasons: { power_lost: "mistede strømmålingen", timeout: "kørte for længe", forced: "afsluttet i hånden", switch: "slukket" },
    resumed: "holdt pause - lært", findings: "Godt at vide", dismiss: "OK", live: "Live", watts: "W", finishNow: "Den er færdig",
    machine: "Denne maskine", kind: "Maskine", door: "Dørsensor", energy: "Energimåler", switch: "Kontakt", none: "Ingen",
    s: {
      phones: "Besked", phonesHint: "Hvem der får besked, når en maskine er færdig.", onlyHome: "Kun dem der er hjemme",
      onlyHomeHint: "Telefoner ude af huset får intet - medmindre ingen er hjemme.", start: "Også når den starter",
      remind: "Påmind hvis ikke tømt", off: "Fra", price: "Elpris", priceHint: "Til prisen for hver vask og det billigste tidspunkt at starte.",
      cheap: "Vis billigere start, når den sparer mindst", ai: "AI-hjælper", aiHint: "Navngiver programmer og forklarer mærkelige vaske. Den måler aldrig noget.",
      dry: "Færdig når tørringen er slut", dryHint: "Fra: færdig så snart arbejdet er slut (den kan stadig tørre stille).",
    },
  },
};

class ApplianceWatchPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._view = "list";
    this._machines = [];
    this._full = {};
    this._busy = false;
  }
  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) this._connect();
  }
  set narrow(v) { this._narrow = v; }
  get L() { return lang(this._hass); }
  get t() { return T[this.L]; }
  get w() { return TEXTS[this.L]; }

  async _connect() {
    const r = await this._ws({ type: "appliance_watch/machines" });
    Object.assign(this, { _machines: r.machines, _admin: r.admin, _found: r.found, _hasPrice: r.has_price, _hasAi: r.has_ai });
    this._render();
    this._unsub = await this._hass.connection.subscribeMessage((m) => this._live(m.machines), { type: "appliance_watch/subscribe" });
    this._timer = setInterval(() => this._view === "list" && this._render(), 30000);
  }
  disconnectedCallback() {
    this._unsub?.();
    this._unsub = null;
    clearInterval(this._timer);
    this._hass && (this._reconnect = true);
  }
  connectedCallback() {
    if (this._reconnect && this._hass) { this._reconnect = false; this._connect(); }
  }
  _ws(msg) { return this._hass.callWS(msg); }

  _live(machines) {
    const before = Object.fromEntries(this._machines.map((m) => [m.entry_id, m.state + (m.last?.id || "")]));
    this._machines = machines;
    if (this._view === "list") return this._render();
    if (this._view === "machine") {
      const m = machines.find((x) => x.entry_id === this._open);
      if (!m) return;
      if (before[m.entry_id] !== m.state + (m.last?.id || "")) return this._loadFull(m.entry_id);
      if (!this.shadowRoot.activeElement) this._updateLive(m);
    }
  }
  async _loadFull(id) {
    this._full[id] = await this._ws({ type: "appliance_watch/machine", entry_id: id });
    if (this._view === "machine" && this._open === id && !this.shadowRoot.activeElement?.matches?.("input")) this._render();
  }

  // ---------- drawing ----------

  _render() {
    const v = this._view === "settings" ? this._settingsView() : this._view === "machine" ? this._machineView() : this._listView();
    this.shadowRoot.innerHTML = `${this._css()}<style>${MACHINE_CSS}</style>${v}<div class="toast"></div>`;
    this._wire();
  }

  _bar(title, back) {
    const t = this.t;
    return `<div class="bar">
      ${back ? `<button class="icon" data-act="back" title="${t.back}">←</button>` : this._narrow ? `<button class="icon" data-act="menu" title="${t.menu}">☰</button>` : ""}
      <h1>${title}</h1>
      ${!back && this._admin ? `<button class="icon" data-act="settings" title="${t.settings}">⚙️</button>` : ""}
    </div>`;
  }

  _listView() {
    const t = this.t, ms = this._machines;
    const running = ms.filter((m) => m.state === "running" || m.state === "finishing").length;
    const done = ms.filter((m) => m.state === "finished").length;
    const pills = [running ? `<span class="pill run">● ${running} ${t.running}</span>` : "", done ? `<span class="pill ok">✓ ${done} ${t.done}</span>` : ""].join("");
    const found = (this._found || []).map((f) => `<div class="found"><span class="fk">${machineSVG(f.kind, "off", { uid: "f" + f.entity_id.replace(/\W/g, "") })}</span>
      <div><b>${esc(f.name)}</b><div class="muted">${esc(f.entity_id)}</div></div><button class="primary" data-act="addflow">${t.addIt}</button></div>`).join("");
    return `${this._bar(t.title)}<main>
      <div class="hero"><div><h2>${running || done ? pills : t.ready}</h2></div>
        ${this._admin ? `<button class="ghost" data-act="addflow">+ ${t.add}</button>` : ""}</div>
      ${ms.length ? `<div class="grid">${ms.map((m) => this._card(m)).join("")}</div>` : `<div class="empty">${machineSVG("washer", "off", { uid: "e" })}<p>${this.w.noMachines}</p></div>`}
      ${found ? `<section><h3>🔎 ${t.found}</h3>${found}</section>` : ""}
    </main>`;
  }

  _status(m) {
    const t = this.t, w = this.w;
    if (m.state === "running" || m.state === "finishing") {
      const left = minutesLeft(m.finish_time);
      const main = m.finish_time ? `${w.doneAt} <b>${clock(m.finish_time)}</b>` : w.unknownTime;
      const sub = m.finish_time ? (left <= 1 ? t.soon : `${hm(left)} ${w.left}`) : "";
      return { main, sub };
    }
    if (m.state === "finished") return { main: `${w.states.finished} <b>${clock(m.finished_at)}</b>`, sub: w.waiting };
    const last = m.last ? `${t.last}: ${[m.last.program, dur(m.last.duration, this.L), money(m.last.cost, m.currency)].filter(Boolean).join(" · ")}` : "";
    return { main: w.states.off, sub: last };
  }

  _card(m) {
    const t = this.t, w = this.w, s = this._status(m);
    const active = m.state === "running" || m.state === "finishing";
    const bar = active && m.progress != null ? `<div class="progress"><span style="width:${m.progress}%"></span></div>` : active ? `<div class="progress indet"><span></span></div>` : "";
    const chips = [
      active ? `<span class="chip prog">${esc(m.program || w.unknownTime)}</span>` : "",
      active && m.live_cost != null ? `<span class="chip">${money(m.live_cost, m.currency)} ${t.sinceStart}</span>` : "",
      active && m.power != null ? `<span class="chip">⚡ ${Math.round(m.power)} ${t.watts}</span>` : "",
      m.state === "off" && m.cheap ? `<span class="chip cheap">💡 ${w.cheap} ${clock(m.cheap.start)} · ${w.save} ${money(m.cheap.saving, m.currency)}</span>` : "",
      ...(m.findings || []).slice(-1).map((f) => `<span class="chip warn">⚠️ ${esc(f.text)}</span>`),
    ].join("");
    return `<div class="card m-${m.state}" style="--a:${ACCENT[m.kind] || ACCENT.other}" data-open="${m.entry_id}">
      <div class="art">${machineSVG(m.kind, m.state, { display: display(m), uid: m.entry_id.slice(-6) })}</div>
      <div class="info">
        <div class="top"><div class="name">${esc(m.name)}</div><span class="state">${w.states[m.state]}</span></div>
        <div class="main">${s.main}</div><div class="sub muted">${esc(s.sub)}</div>
        ${bar}<div class="chips">${chips}</div>
        ${m.state === "finished" ? `<button class="primary done" data-act="emptied" data-id="${m.entry_id}">✓ ${w.emptied}</button>` : ""}
      </div>
    </div>`;
  }

  _machineView() {
    const t = this.t, w = this.w;
    const m = this._machines.find((x) => x.entry_id === this._open);
    if (!m) { this._view = "list"; return this._listView(); }
    const f = this._full[m.entry_id];
    const s = this._status(m);
    const active = m.state === "running" || m.state === "finishing";
    const head = `<div class="detail-head" style="--a:${ACCENT[m.kind]}">
      <div class="big">${machineSVG(m.kind, m.state, { display: display(m), uid: "d" + m.entry_id.slice(-6) })}</div>
      <div class="info"><div class="state">${w.states[m.state]}</div><div class="main xl" id="main">${s.main}</div>
        <div class="sub muted" id="sub">${esc(s.sub)}</div>
        ${active ? `<div class="progress" id="prog"><span style="width:${m.progress || 0}%"></span></div>` : ""}
        <div class="chips">${active ? `<span class="chip prog">${esc(m.program || w.unknownTime)}</span>` : ""}
          ${active && m.live_cost != null ? `<span class="chip" id="cost">${money(m.live_cost, m.currency)} ${t.sinceStart}</span>` : ""}
          ${active ? `<span class="chip" id="watt">⚡ ${Math.round(m.power || 0)} ${t.watts}</span>` : ""}</div>
        <div class="actions">${m.state === "finished" ? `<button class="primary" data-act="emptied" data-id="${m.entry_id}">✓ ${w.emptied}</button>` : ""}
          ${active ? `<button class="ghost" data-act="finish" data-id="${m.entry_id}">${t.finishNow}</button>` : ""}</div>
      </div></div>`;
    if (!f) return `${this._bar(esc(m.name), true)}<main>${head}<div class="empty">…</div></main>`;
    const live = active && f.live_curve?.length > 2 ? `<section class="card"><h3>${t.live}</h3>${this._chart(f.live_curve.map((x) => x * 60), m.kind, 90)}</section>` : "";
    const ask = this._ask(f);
    const findings = (f.findings || []).length ? `<section class="card warnbox"><h3>⚠️ ${t.findings}</h3>${f.findings.map((x, i) =>
      `<div class="row"><span>${esc(x.text)}</span>${x.cycle && this._hasAi ? `<button class="ghost sm" data-act="explain" data-cycle="${x.cycle}">${t.aiExplain}</button>` : ""}
       <button class="ghost sm" data-act="dismiss" data-i="${i}">${t.dismiss}</button></div><div class="explain" data-for="${x.cycle}"></div>`).join("")}</section>` : "";
    const month = f.month?.count ? `<div class="stats"><div><b>${f.month.count}</b><span>${t.cycles}</span></div><div><b>${num(f.month.kwh, this.L, 1)}</b><span>kWh</span></div>
      ${f.month.cost != null ? `<div><b>${money(f.month.cost, m.currency)}</b><span>${t.month.toLowerCase()}</span></div>` : ""}</div>` : "";
    return `${this._bar(esc(m.name), true)}<main>${head}${month}${live}${ask}${findings}
      ${this._programs(f, m)}${this._history(f, m)}${this._admin ? this._machineSettings(m) : ""}</main>`;
  }

  _ask(f) {
    const t = this.t, last = f.history?.[0];
    if (!last || last.by === "user" || f.state === "running") return "";
    const named = f.programs.filter((p) => p.named);
    return `<section class="card ask"><h3>🏷️ ${t.which}</h3><div class="muted">${t.whichHint} (${new Date(last.start).toLocaleString(this.L === "da" ? "da-DK" : undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })}, ${Math.round(last.duration / 60)} ${t.min})</div>
      <div class="chips pick">${named.map((p) => `<button class="chip btn ${p.id === last.program_id ? "on" : ""}" data-act="label" data-cycle="${last.id}" data-program="${p.id}">${esc(p.name)}</button>`).join("")}</div>
      <div class="inline"><input id="newname" placeholder="${this.L === "da" ? "fx Øko 50°" : "e.g. Eco 50°"}" list="names"><button class="primary" data-act="labelnew" data-cycle="${last.id}">${t.ok}</button>
      ${this._hasAi && last.program_id ? `<button class="ghost" data-act="ainame" data-program="${last.program_id}">${t.ai}</button>` : ""}</div>
      <datalist id="names">${(this.L === "da" ? ["Øko 50°", "Auto 45-65°", "Intensiv 70°", "Hurtig 45°", "Bomuld 40°", "Bomuld 60°", "Kulørt 30°", "Hurtigvask 30°", "Uld", "Skabstørt", "Strygetørt"] : ["Eco 50°", "Auto", "Intensive 70°", "Quick 45°", "Cotton 40°", "Cotton 60°", "Colours 30°", "Quick 30°", "Wool", "Cupboard dry", "Iron dry"]).map((n) => `<option value="${n}">`).join("")}</datalist>
    </section>`;
  }

  _programs(f, m) {
    const t = this.t;
    if (!f.programs?.length) return "";
    return `<section class="card"><h3>${t.programs}</h3>${f.programs.map((p) => {
      const st = p.stats;
      const usual = st ? `${t.usual} ${dur(st.duration, this.L)} · ${num(st.wh / 1000, this.L)} kWh${st.cost != null ? " · " + money(st.cost, m.currency) : ""}` : "";
      return `<div class="prog-row"><div class="pname"><b>${esc(p.name)}</b>${p.named ? "" : ` <span class="auto">auto</span>`}
        <div class="muted">${usual}${usual ? " · " : ""}${t.learned} ${st ? st.count : 0}/${p.count}</div></div>
        <details class="menu"><summary>⋯</summary><div class="pop">
          <div class="inline"><input data-rename="${p.id}" value="${esc(p.named ? p.name : "")}" placeholder="${t.rename}"><button class="primary sm" data-act="rename" data-program="${p.id}">${t.ok}</button></div>
          ${this._hasAi ? `<button class="ghost sm" data-act="ainame" data-program="${p.id}">${t.ai}</button>` : ""}
          ${f.programs.length > 1 ? `<select data-merge="${p.id}"><option value="">${t.merge}</option>${f.programs.filter((o) => o.id !== p.id).map((o) => `<option value="${o.id}">${esc(o.name)}</option>`).join("")}</select>` : ""}
          <button class="ghost sm danger" data-act="forget" data-program="${p.id}">${t.forget}</button></div></details></div>`;
    }).join("")}</section>`;
  }

  _history(f, m) {
    const t = this.t;
    const rows = (f.history || []).map((c) => {
      const when = new Date(c.start).toLocaleString(this.L === "da" ? "da-DK" : undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      const flags = [c.resumed ? `<span class="tag">⏸ ${t.resumed}</span>` : "", c.clean === false ? `<span class="tag grey">${t.unclear}: ${t.reasons[c.reason] || c.reason}</span>` : ""].join("");
      return `<div class="hist"><div class="spark">${this._chart(c.curve, m.kind, 28, true)}</div>
        <div class="hmain"><b>${esc(c.program || "–")}</b> <span class="muted">${when}</span><div class="muted">${dur(c.duration, this.L)} · ${num(c.kwh, this.L)} kWh${c.cost != null ? " · " + money(c.cost, m.currency) : ""} ${flags}</div></div>
        <details class="menu"><summary>⋯</summary><div class="pop">
          <select data-relabel="${c.id}"><option value="">${t.changeProgram}</option>${f.programs.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select>
          ${this._hasAi ? `<button class="ghost sm" data-act="explain" data-cycle="${c.id}">${t.aiExplain}</button>` : ""}
          <button class="ghost sm danger" data-act="delcycle" data-cycle="${c.id}">${t.del}</button></div></details></div><div class="explain" data-for="${c.id}"></div>`;
    }).join("");
    return `<section class="card"><h3>${t.history}</h3>${rows || `<div class="muted">${t.noHistory}</div>`}</section>`;
  }

  _machineSettings(m) {
    const t = this.t, w = this.w;
    const states = Object.values(this._hass.states);
    const opts = (filter, cur) => `<option value="">${t.none}</option>` + states.filter(filter)
      .map((s) => `<option value="${s.entity_id}" ${s.entity_id === cur ? "selected" : ""}>${esc(s.attributes.friendly_name || s.entity_id)}</option>`).join("");
    const d = m.devices || {};
    return `<section class="card"><h3>⚙️ ${t.machine}</h3>
      <label>${t.name}<input data-ms="name" value="${esc(m.name)}"></label>
      <div class="lbl">${t.kind}</div><div class="seg">${["dishwasher", "washer", "dryer", "other"].map((k) =>
        `<button class="${m.kind === k ? "on" : ""}" data-act="mskind" data-kind="${k}">${w.kinds[k]}</button>`).join("")}</div>
      <label>${t.door}<select data-ms="door_sensor">${opts((s) => s.entity_id.startsWith("binary_sensor.") && ["door", "opening", "window"].includes(s.attributes.device_class), d.door_sensor)}</select></label>
      <label>${t.energy}<select data-ms="energy_sensor">${opts((s) => s.entity_id.startsWith("sensor.") && s.attributes.device_class === "energy", d.energy_sensor)}</select></label>
      <label>${t.switch}<select data-ms="switch">${opts((s) => s.entity_id.startsWith("switch."), d.switch)}</select></label>
    </section>`;
  }

  _chart(values, kind, height, small = false) {
    if (!values || values.length < 2) return "";
    const max = Math.max(...values, 1), n = values.length, wdt = 300;
    const pts = values.map((v, i) => `${(i / (n - 1)) * wdt},${height - (v / max) * (height - 4) - 2}`).join(" ");
    const c = ACCENT[kind] || ACCENT.other;
    return `<svg class="chart${small ? " small" : ""}" viewBox="0 0 ${wdt} ${height}" preserveAspectRatio="none">
      <polygon points="0,${height} ${pts} ${wdt},${height}" fill="${c}" opacity=".18"/><polyline points="${pts}" fill="none" stroke="${c}" stroke-width="${small ? 1.5 : 2}" vector-effect="non-scaling-stroke"/></svg>`;
  }

  _updateLive(m) {
    const r = this.shadowRoot, s = this._status(m);
    const set = (id, html) => { const el = r.getElementById(id); if (el) el.innerHTML = html; };
    set("main", s.main);
    set("sub", esc(s.sub));
    if (m.live_cost != null) set("cost", `${money(m.live_cost, m.currency)} ${this.t.sinceStart}`);
    set("watt", `⚡ ${Math.round(m.power || 0)} ${this.t.watts}`);
    const p = r.querySelector("#prog span");
    if (p) p.style.width = `${m.progress || 0}%`;
    r.querySelectorAll(".aw-display").forEach((el) => (el.textContent = display(m)));
  }

  // ---------- settings ----------

  _settingsView() {
    const t = this.t, s = this._settings;
    if (!s) return `${this._bar(t.settings, true)}<main><div class="empty">…</div></main>`;
    const v = s.settings;
    const phone = (svc) => {
      const name = svc === "notify.persistent_notification" ? "🏠 Home Assistant"
        : svc.replace("notify.mobile_app_", "📱 ").replace("notify.", "").replace(/_/g, " ");
      return `<button class="chip btn ${v.notify.includes(svc) ? "on" : ""}" data-act="phone" data-svc="${svc}">${esc(name)}</button>`;
    };
    const toggle = (key, label, hint) => `<div class="tog"><div><div>${label}</div>${hint ? `<div class="muted">${hint}</div>` : ""}</div>
      <button class="switch ${v[key] ? "on" : ""}" data-act="toggle" data-key="${key}" aria-pressed="${!!v[key]}"><span></span></button></div>`;
    const seg = (key, items) => `<div class="seg">${items.map(([val, label]) => `<button class="${v[key] == val ? "on" : ""}" data-act="set" data-key="${key}" data-val="${val}">${label}</button>`).join("")}</div>`;
    return `${this._bar(t.settings, true)}<main class="settings">
      <section class="card"><h3>🔔 ${t.s.phones}</h3><div class="muted">${t.s.phonesHint}</div>
        <div class="chips pick">${s.notify_services.map(phone).join("")}</div>
        ${toggle("only_home", t.s.onlyHome, t.s.onlyHomeHint)}${toggle("notify_start", t.s.start)}
        <div class="lbl">${t.s.remind}</div>${seg("remind_minutes", [[0, t.s.off], [30, "30 min"], [60, dur(3600, this.L)], [120, dur(7200, this.L)]])}
      </section>
      <section class="card"><h3>⚡ ${t.s.price}</h3><div class="muted">${t.s.priceHint}</div>
        <select data-set="price_sensor"><option value="">${t.s.off}</option>${s.price_sensors.map((p) => `<option value="${p.entity_id}" ${p.entity_id === v.price_sensor ? "selected" : ""}>${p.forecast ? "📈 " : ""}${esc(p.name)}</option>`).join("")}</select>
        <div class="lbl">${t.s.cheap}</div>${seg("cheap_saving", [[0.5, money(0.5, "kr")], [1, money(1, "kr")], [2, money(2, "kr")], [5, money(5, "kr")]])}
      </section>
      <section class="card"><h3>✨ ${t.s.ai}</h3><div class="muted">${t.s.aiHint}</div>
        <select data-set="ai_task"><option value="">${t.s.off}</option>${s.ai_tasks.map((a) => `<option value="${a}" ${a === v.ai_task ? "selected" : ""}>${esc(this._hass.states[a]?.attributes.friendly_name || a)}</option>`).join("")}</select>
      </section>
      <section class="card tight">${toggle("finish_after_drying", t.s.dry, t.s.dryHint)}</section>
    </main>`;
  }

  async _save(changes) {
    Object.assign(this._settings.settings, changes);
    await this._ws({ type: "appliance_watch/save_settings", ...changes });
    if ("price_sensor" in changes || "ai_task" in changes) {
      this._hasPrice = !!this._settings.settings.price_sensor;
      this._hasAi = !!this._settings.settings.ai_task;
    }
    this._toast(this.t.saved);
  }

  // ---------- events ----------

  _wire() {
    const r = this.shadowRoot;
    r.querySelectorAll("[data-open]").forEach((el) => el.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      this._open = el.dataset.open;
      this._view = "machine";
      this._render();
      this._loadFull(this._open);
    }));
    r.querySelectorAll("[data-act]").forEach((el) => el.addEventListener("click", (e) => { e.stopPropagation(); this._act(el.dataset.act, el); }));
    r.querySelectorAll("[data-set]").forEach((el) => el.addEventListener("change", () => this._save({ [el.dataset.set]: el.value || null })));
    r.querySelectorAll("[data-merge]").forEach((el) => el.addEventListener("change", () => el.value && this._cmd("merge_program", { program: el.dataset.merge, into: el.value })));
    r.querySelectorAll("[data-relabel]").forEach((el) => el.addEventListener("change", () => el.value && this._cmd("label", { cycle_id: el.dataset.relabel, program: el.value })));
    r.querySelectorAll("[data-ms]").forEach((el) => el.addEventListener("change", () => this._cmd("machine_settings", { [el.dataset.ms]: el.value || null }, true)));
    const input = r.getElementById("newname");
    input?.addEventListener("keydown", (e) => e.key === "Enter" && r.querySelector('[data-act="labelnew"]').click());
  }

  async _cmd(type, data, reload = false) {
    try {
      const res = await this._ws({ type: `appliance_watch/${type}`, entry_id: this._open, ...data });
      if (res && res.entry_id) this._full[this._open] = res;
      if (reload) setTimeout(() => this._connect(), 1500);
      this._render();
      this._toast(this.t.saved);
    } catch (err) {
      this._toast(err.message || String(err), true);
    }
  }

  async _act(act, el) {
    const r = this.shadowRoot;
    switch (act) {
      case "menu": return this.dispatchEvent(new Event("hass-toggle-menu", { bubbles: true, composed: true }));
      case "back": this._view = "list"; return this._render();
      case "settings":
        this._view = "settings";
        this._render();
        this._settings = await this._ws({ type: "appliance_watch/settings" });
        return this._render();
      case "addflow":
        history.pushState(null, "", "/_my_redirect/config_flow_start?domain=appliance_watch");
        return window.dispatchEvent(new CustomEvent("location-changed"));
      case "emptied":
        await this._ws({ type: "appliance_watch/emptied", entry_id: el.dataset.id });
        return this._toast(`✓ ${this.w.emptied}`);
      case "finish": return this._cmd("finish", {});
      case "dismiss": return this._cmd("dismiss", { index: Number(el.dataset.i) });
      case "label": return this._cmd("label", { cycle_id: el.dataset.cycle, program: el.dataset.program });
      case "labelnew": {
        const name = r.getElementById("newname").value.trim();
        return name && this._cmd("label", { cycle_id: el.dataset.cycle, name });
      }
      case "rename": {
        const name = r.querySelector(`[data-rename="${el.dataset.program}"]`).value.trim();
        return name && this._cmd("rename_program", { program: el.dataset.program, name });
      }
      case "forget": return this._cmd("forget_program", { program: el.dataset.program });
      case "delcycle": return this._cmd("delete_cycle", { cycle_id: el.dataset.cycle });
      case "mskind": return this._cmd("machine_settings", { kind: el.dataset.kind }, true);
      case "ainame": {
        el.disabled = true;
        el.textContent = "✨ …";
        const res = await this._ws({ type: "appliance_watch/ai_name", entry_id: this._open, program: el.dataset.program });
        el.disabled = false;
        el.textContent = this.t.ai;
        const box = r.getElementById("newname") || r.querySelector(`[data-rename="${el.dataset.program}"]`);
        if (res.name && box) { box.value = res.name; box.focus(); }
        return;
      }
      case "explain": {
        const box = r.querySelector(`.explain[data-for="${el.dataset.cycle}"]`);
        if (box) box.textContent = "✨ …";
        const res = await this._ws({ type: "appliance_watch/ai_explain", entry_id: this._open, cycle_id: el.dataset.cycle });
        if (box) box.textContent = res.text || "–";
        return;
      }
      case "phone": {
        const svc = el.dataset.svc, list = new Set(this._settings.settings.notify);
        list.has(svc) ? list.delete(svc) : list.add(svc);
        el.classList.toggle("on");
        return this._save({ notify: [...list] });
      }
      case "toggle": {
        const key = el.dataset.key, val = !this._settings.settings[key];
        el.classList.toggle("on", val);
        return this._save({ [key]: val });
      }
      case "set": {
        el.parentElement.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === el));
        return this._save({ [el.dataset.key]: Number(el.dataset.val) });
      }
    }
  }

  _toast(text, bad = false) {
    const el = this.shadowRoot.querySelector(".toast");
    if (!el) return;
    el.textContent = text;
    el.className = `toast show${bad ? " bad" : ""}`;
    clearTimeout(this._tt);
    this._tt = setTimeout(() => (el.className = "toast"), 1800);
  }

  _css() {
    return `<style>
      :host { display:block; min-height:100vh; background:var(--primary-background-color); color:var(--primary-text-color);
        font-family:var(--paper-font-body1_-_font-family, system-ui, sans-serif); }
      .bar { display:flex; align-items:center; gap:8px; height:56px; padding:0 12px; background:var(--app-header-background-color, var(--primary-color));
        color:var(--app-header-text-color, #fff); position:sticky; top:0; z-index:3; }
      .bar h1 { font-size:20px; font-weight:500; margin:0; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .icon { background:none; border:0; color:inherit; font-size:21px; cursor:pointer; padding:4px 8px; }
      main { max-width:1000px; margin:0 auto; padding:16px; box-sizing:border-box; }
      .hero { display:flex; align-items:center; justify-content:space-between; gap:12px; margin:4px 0 16px; }
      .hero h2 { margin:0; font-size:22px; display:flex; gap:8px; flex-wrap:wrap; }
      .pill { font-size:15px; padding:4px 12px; border-radius:14px; font-weight:600; }
      .pill.run { background:color-mix(in srgb, #3b82f6 18%, transparent); color:#3b82f6; }
      .pill.ok { background:color-mix(in srgb, #22c55e 18%, transparent); color:#16a34a; }
      .muted { color:var(--secondary-text-color); font-size:13px; }
      .grid { display:grid; gap:16px; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); }
      .card { background:var(--card-background-color); border-radius:20px; padding:16px; box-shadow:var(--ha-card-box-shadow, 0 2px 8px rgba(0,0,0,.08));
        position:relative; overflow:hidden; }
      section.card { margin-top:16px; } section.card h3 { margin:0 0 10px; font-size:16px; }
      .grid .card { display:flex; gap:14px; align-items:center; cursor:pointer; transition:transform .15s, box-shadow .15s; animation:in .3s ease both; }
      .grid .card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,.12); }
      .grid .card::before { content:""; position:absolute; inset:0; background:radial-gradient(120% 90% at 0% 0%, color-mix(in srgb, var(--a) 22%, transparent), transparent 60%); opacity:.0; transition:opacity .4s; pointer-events:none; }
      .card.m-running::before, .card.m-finishing::before { opacity:1; }
      .card.m-finished::before { opacity:1; background:radial-gradient(120% 90% at 0% 0%, rgba(34,197,94,.22), transparent 60%); }
      @keyframes in { from { opacity:0; transform:translateY(6px); } }
      .art { width:112px; height:137px; flex:none; position:relative; }
      .info { flex:1; min-width:0; position:relative; }
      .top { display:flex; align-items:center; gap:8px; }
      .name { font-weight:700; font-size:17px; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .state { font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; color:var(--a); }
      .m-finished .state { color:#16a34a; } .m-off .state { color:var(--secondary-text-color); }
      .main { font-size:20px; margin-top:4px; } .main b { font-weight:800; } .main.xl { font-size:28px; }
      .sub { margin-top:2px; min-height:16px; }
      .progress { height:8px; border-radius:6px; background:color-mix(in srgb, var(--a) 15%, transparent); margin:10px 0 4px; overflow:hidden; }
      .progress span { display:block; height:100%; border-radius:6px; background:linear-gradient(90deg, color-mix(in srgb, var(--a) 70%, #fff), var(--a));
        transition:width 1s ease; position:relative; overflow:hidden; }
      .progress span::after { content:""; position:absolute; inset:0; background:linear-gradient(90deg, transparent, rgba(255,255,255,.5), transparent); animation:shine 2s infinite; }
      .progress.indet span { width:30%; animation:indet 1.6s ease-in-out infinite; }
      @keyframes shine { from { transform:translateX(-100%); } to { transform:translateX(100%); } }
      @keyframes indet { 0% { margin-left:-30%; } 100% { margin-left:100%; } }
      .chips { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
      .chip { font-size:12px; padding:3px 9px; border-radius:10px; background:var(--secondary-background-color); border:0; color:inherit; font-family:inherit; }
      .chip.prog { background:color-mix(in srgb, var(--a) 16%, transparent); font-weight:600; }
      .chip.cheap { background:color-mix(in srgb, #eab308 20%, transparent); }
      .chip.warn { background:color-mix(in srgb, #f59e0b 22%, transparent); }
      .chip.btn { cursor:pointer; font-size:14px; padding:7px 14px; border-radius:16px; border:1px solid var(--divider-color); background:transparent; }
      .chip.btn.on { background:var(--primary-color); color:var(--text-primary-color, #fff); border-color:var(--primary-color); }
      button.primary, button.ghost { font:inherit; font-size:14px; border-radius:18px; padding:8px 16px; cursor:pointer; border:1px solid var(--primary-color); }
      button.primary { background:var(--primary-color); color:var(--text-primary-color, #fff); }
      button.ghost { background:transparent; color:var(--primary-color); }
      button.sm { padding:5px 12px; font-size:13px; } button.danger { color:#e5484d; border-color:#e5484d; }
      button.done { margin-top:10px; background:#22c55e; border-color:#22c55e; animation:pulse 2s infinite; }
      @keyframes pulse { 0%,100% { box-shadow:0 0 0 0 rgba(34,197,94,.5); } 50% { box-shadow:0 0 0 8px rgba(34,197,94,0); } }
      .detail-head { display:flex; gap:24px; align-items:center; background:var(--card-background-color); border-radius:24px; padding:20px;
        box-shadow:var(--ha-card-box-shadow, 0 2px 8px rgba(0,0,0,.08));
        background-image:radial-gradient(100% 120% at 0% 0%, color-mix(in srgb, var(--a) 20%, transparent), transparent 60%); }
      .detail-head .big { width:190px; height:232px; flex:none; }
      .detail-head .state { font-size:13px; }
      .actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; }
      .stats { display:flex; gap:12px; margin-top:16px; }
      .stats div { flex:1; background:var(--card-background-color); border-radius:16px; padding:12px; text-align:center; box-shadow:var(--ha-card-box-shadow, 0 2px 8px rgba(0,0,0,.08)); }
      .stats b { display:block; font-size:22px; } .stats span { font-size:12px; color:var(--secondary-text-color); }
      .chart { width:100%; height:90px; display:block; } .chart.small { height:28px; }
      .ask { border:2px solid color-mix(in srgb, var(--primary-color) 40%, transparent); }
      .pick { margin:10px 0; }
      .inline { display:flex; gap:8px; align-items:center; margin-top:8px; flex-wrap:wrap; }
      input, select { font:inherit; font-size:15px; padding:9px 12px; border-radius:12px; border:1px solid var(--divider-color); background:var(--card-background-color);
        color:var(--primary-text-color); box-sizing:border-box; }
      .inline input { flex:1; min-width:140px; }
      label { display:flex; flex-direction:column; gap:4px; font-size:13px; color:var(--secondary-text-color); margin-top:10px; }
      label input, label select, section > select { width:100%; color:var(--primary-text-color); margin-top:6px; }
      .lbl { font-size:13px; color:var(--secondary-text-color); margin:14px 0 6px; }
      .seg { display:inline-flex; flex-wrap:wrap; background:var(--secondary-background-color); border-radius:14px; padding:3px; gap:2px; }
      .seg button { font:inherit; font-size:13px; border:0; background:transparent; color:inherit; padding:7px 12px; border-radius:11px; cursor:pointer; }
      .seg button.on { background:var(--card-background-color); box-shadow:0 1px 3px rgba(0,0,0,.15); font-weight:600; }
      .tog { display:flex; align-items:center; gap:12px; justify-content:space-between; margin-top:14px; }
      .switch { width:46px; height:28px; border-radius:14px; border:0; background:var(--disabled-color, #bbb); position:relative; cursor:pointer; flex:none; transition:.2s; }
      .switch span { position:absolute; top:3px; left:3px; width:22px; height:22px; border-radius:50%; background:#fff; transition:.2s; box-shadow:0 1px 3px rgba(0,0,0,.3); }
      .switch.on { background:var(--primary-color); } .switch.on span { left:21px; }
      .tight .tog { margin-top:0; }
      .prog-row, .hist { display:flex; align-items:center; gap:10px; padding:10px 0; border-top:1px solid var(--divider-color); }
      .prog-row:first-of-type, .hist:first-of-type { border-top:0; }
      .pname { flex:1; min-width:0; } .auto { font-size:11px; padding:1px 6px; border-radius:6px; background:var(--secondary-background-color); color:var(--secondary-text-color); }
      .spark { width:64px; flex:none; } .hmain { flex:1; min-width:0; }
      .tag { font-size:11px; padding:1px 6px; border-radius:6px; background:color-mix(in srgb, #3b82f6 15%, transparent); margin-left:4px; }
      .tag.grey { background:var(--secondary-background-color); }
      details.menu { position:relative; } details.menu summary { list-style:none; cursor:pointer; font-size:20px; padding:2px 8px; border-radius:10px; color:var(--secondary-text-color); }
      details.menu summary::-webkit-details-marker { display:none; }
      .pop { position:absolute; right:0; top:32px; z-index:4; background:var(--card-background-color); border-radius:14px; padding:10px; min-width:220px;
        box-shadow:0 8px 28px rgba(0,0,0,.2); display:grid; gap:8px; }
      .explain { font-size:14px; line-height:1.45; padding:0 0 0 74px; color:var(--primary-text-color); }
      .explain:empty { display:none; }
      .warnbox .row { display:flex; align-items:center; gap:8px; padding:6px 0; } .warnbox .row span { flex:1; }
      .found { display:flex; align-items:center; gap:12px; padding:10px; border-radius:14px; background:var(--card-background-color); margin-top:8px; }
      .found .fk { width:44px; height:54px; } .found > div { flex:1; }
      section > h3 { font-size:15px; margin:24px 0 4px; }
      .empty { text-align:center; padding:40px 16px; color:var(--secondary-text-color); } .empty .aw-machine { width:120px; height:146px; margin:0 auto; }
      .toast { position:fixed; left:50%; bottom:24px; transform:translate(-50%, 80px); background:#323232; color:#fff; padding:10px 18px;
        border-radius:12px; font-size:14px; opacity:0; transition:.25s; z-index:9; max-width:90vw; }
      .toast.show { transform:translate(-50%, 0); opacity:1; } .toast.bad { background:#e5484d; }
      @media (max-width:600px) {
        main { padding:12px; } .grid { grid-template-columns:1fr; } .art { width:96px; height:117px; }
        .detail-head { flex-direction:column; text-align:center; gap:10px; } .detail-head .big { width:150px; height:183px; }
        .detail-head .chips, .detail-head .actions { justify-content:center; } .explain { padding-left:0; }
      }
    </style>`;
  }
}

customElements.define("appliance-watch-panel", ApplianceWatchPanel);
