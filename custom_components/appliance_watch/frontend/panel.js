// Appliance Watch panel: every machine as itself, live; history, programmes, settings.
import { ACCENT, MACHINE_CSS, TEXTS, clock, display, dur, esc, hm, lang, machineSVG, minutesLeft, money, num } from "./machines.js";

// Programme names to pick from, per machine - only the ones that fit it.
const SUGGEST = {
  da: {
    dishwasher: ["Øko 50°", "Auto 45-65°", "Intensiv 70°", "Hurtig 45°", "Skyl", "Glas 40°", "Maskinpleje"],
    washer: ["Bomuld 40°", "Bomuld 60°", "Øko 40-60", "Kulørt 30°", "Hurtigvask 30°", "Syntetisk 40°", "Uld", "Sengetøj 60°", "Skyl og centrifugering"],
    dryer: ["Skabstørt", "Ekstra tørt", "Strygetørt", "Syntetisk", "Uld", "Opfriskning", "Tidsprogram"],
    other: [],
  },
  en: {
    dishwasher: ["Eco 50°", "Auto 45-65°", "Intensive 70°", "Quick 45°", "Pre-rinse", "Glass 40°", "Machine care"],
    washer: ["Cotton 40°", "Cotton 60°", "Eco 40-60", "Colours 30°", "Quick 30°", "Synthetics 40°", "Wool", "Bedding 60°", "Rinse and spin"],
    dryer: ["Cupboard dry", "Extra dry", "Iron dry", "Synthetics", "Wool", "Refresh", "Timed"],
    other: [],
  },
};

const T = {
  en: {
    title: "Appliances", settings: "Settings", back: "Back", menu: "Menu", saved: "Saved ✓", add: "Add machine",
    found: "Found in your home", addIt: "Add", running: "running", done: "done", ready: "All ready", month: "This month",
    cycles: "cycles", sinceStart: "so far", last: "Last", soon: "any minute", min: "min", now: "now",
    learnHistory: "Learn from the last 10 days", learned_n: "Found {n} cycles in the history",
    k: {
      title: "Speakers", hint: "Says it out loud, so you don't need the phone. Music pauses and comes back.", which: "Speak on",
      none: "No speakers that can announce", say: "What it says - tap to switch on or off",
      kinds: { done: ["Done", "The dishwasher is done. It cost 2.10."], soon: ["Nearly done", "…is done in 10 minutes."],
        remind: ["Not emptied", "…has been waiting an hour."], dryer: ["Move to the dryer", "Move the laundry to the dryer."],
        emptied: ["Emptied", "Thank you! …is ready again."], started: ["Started", "…is done at about 22:15."] },
      quiet: "Quiet at night", quietHint: "What finishes in the night is said in the morning instead.", from: "From", to: "To",
      home: "Only when someone is home", homeHint: "Nobody talks to an empty house.", voice: "Voice", defaultVoice: "Standard",
      test: "Try it", playing: "Playing…", noSpeaker: "Pick a speaker first", own: "Speaker for this machine", asDefault: "As chosen under ⚙️",
    },
    isDone: "is done", isRunning: "is running", allReady: "All machines are ready", readySub: "Start one - it's watched from the first minute.",
    more: "More", close: "Close",
    which: "Which programme was it?", whichNow: "Which programme is running?", own: "Your own name…",
    newProgram: "New programme, e.g. Pre-rinse", addProgram: "Add", noPrograms: "No programmes yet.", whichHint: "Tell it once - next time it knows by itself.", other: "Other…", name: "Name",
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
    learnHistory: "Lær fra de sidste 10 dage", learned_n: "Fandt {n} vaske i historikken",
    k: {
      title: "Højttalere", hint: "Den siger det højt, så du ikke behøver telefonen. Musikken holder pause og kommer igen.", which: "Tal i",
      none: "Ingen højttalere der kan annoncere", say: "Det den siger - tryk for at slå til og fra",
      kinds: { done: ["Færdig", "Opvaskeren er færdig. Det kostede 2,10 kr."], soon: ["Snart færdig", "…er færdig om 10 minutter."],
        remind: ["Ikke tømt", "…har ventet i en time."], dryer: ["Flyt til tørretumbler", "Flyt tøjet over i tørretumbleren."],
        emptied: ["Tømt", "Tak! …er klar igen."], started: ["Startet", "…er færdig cirka 22:15."] },
      quiet: "Stille om natten", quietHint: "Det der bliver færdigt om natten, siges om morgenen i stedet.", from: "Fra", to: "Til",
      home: "Kun når nogen er hjemme", homeHint: "Ingen grund til at tale til et tomt hus.", voice: "Stemme", defaultVoice: "Standard",
      test: "Prøv", playing: "Afspiller…", noSpeaker: "Vælg en højttaler først", own: "Højttaler til denne maskine", asDefault: "Som valgt under ⚙️",
    },
    isDone: "er færdig", isRunning: "kører", allReady: "Alle maskiner er klar", readySub: "Start en - den bliver fulgt fra første minut.",
    more: "Mere", close: "Luk",
    which: "Hvilket program var det?", whichNow: "Hvilket program kører den?", own: "Eget navn…",
    newProgram: "Nyt program, fx Skyl", addProgram: "Tilføj", noPrograms: "Ingen programmer endnu.", whichHint: "Sig det én gang - næste gang ved den det selv.", other: "Andet…", name: "Navn",
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
    this._unsub?.();
    this._unsub = null;
    clearInterval(this._timer);
    const r = await this._ws({ type: "appliance_watch/machines" });
    Object.assign(this, { _machines: r.machines, _admin: r.admin, _found: r.found, _hasPrice: r.has_price, _hasAi: r.has_ai });
    this._render();
    this._unsub = await this._hass.connection.subscribeMessage((m) => this._live(m.machines), { type: "appliance_watch/subscribe" });
    this._timer = setInterval(() => this._view === "list" && this._patchList(), 30000);
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
    const shape = this._shape();
    this._machines = machines;
    // Only draw the page again when something changes shape; otherwise just the numbers (no flicker, the
    // animations keep running).
    if (this._view === "list") return shape === this._shape() ? this._patchList() : this._render();
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

  _shape() {
    return this._machines.map((m) => [m.entry_id, m.name, m.kind, m.state, (m.findings || []).length, !!m.cheap,
      m.progress != null].join("|")).join(";");
  }

  _patchList() {
    const r = this.shadowRoot;
    for (const m of this._machines) {
      const card = r.querySelector(`[data-open="${m.entry_id}"]`);
      if (!card) return this._render();
      const s = this._status(m);
      card.querySelector(".main").innerHTML = s.main;
      card.querySelector(".sub").textContent = s.sub;
      card.querySelector(".chips").innerHTML = this._chips(m);
      const bar = card.querySelector(".progress:not(.indet) span");
      if (bar) bar.style.width = `${m.progress || 0}%`;
      card.querySelectorAll(".aw-display").forEach((el) => (el.textContent = display(m)));
    }
  }

  // ---------- drawing ----------

  _render() {
    const r = this.shadowRoot;
    // Keep what the user has open or is typing when the page is drawn again.
    const open = new Set([...r.querySelectorAll("details[open][data-key]")].map((d) => d.dataset.key));
    const typed = Object.fromEntries([...r.querySelectorAll("input[data-keep]")].filter((i) => i.value).map((i) => [i.dataset.keep, i.value]));
    const focus = r.activeElement?.dataset?.keep;
    const y = window.scrollY;
    const v = this._view === "settings" ? this._settingsView() : this._view === "machine" ? this._machineView() : this._listView();
    r.innerHTML = `${this._css()}<style>${MACHINE_CSS}</style>${v}<div id="sheetbox"></div><div class="toast"></div>`;
    this._sheetOpen = null;
    r.querySelectorAll("details[data-key]").forEach((d) => open.has(d.dataset.key) && (d.open = true));
    r.querySelectorAll("input[data-keep]").forEach((i) => i.dataset.keep in typed && (i.value = typed[i.dataset.keep]));
    if (focus) r.querySelector(`input[data-keep="${focus}"]`)?.focus();
    if (this._view === this._lastView) window.scrollTo(0, y);
    this._lastView = this._view;
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
    const pills = [running ? `<span class="pill">● ${running} ${t.running}</span>` : "", done ? `<span class="pill">✓ ${done} ${t.done}</span>` : ""].join("");
    const found = (this._found || []).map((f) => `<div class="found"><span class="fk">${machineSVG(f.kind, "off", { uid: "f" + f.entity_id.replace(/\W/g, "") })}</span>
      <div><b>${esc(f.name)}</b><div class="muted">${esc(f.entity_id)}</div></div><button class="primary" data-act="addflow">${t.addIt}</button></div>`).join("");
    const h = this._headline();
    return `${this._bar(t.title)}<main>
      <div class="hero" style="--a:${h.color}"><i class="blob b1"></i><i class="blob b2"></i>
        <div class="htxt"><div class="hk">${h.kicker}</div><h2>${h.title}</h2><div class="hs">${h.sub}</div>
          <div class="pills">${pills}</div></div>
        ${this._admin ? `<button class="glass" data-act="addflow">+ ${t.add}</button>` : ""}</div>
      ${ms.length ? `<div class="grid">${ms.map((m) => this._card(m)).join("")}</div>` : `<div class="empty">${machineSVG("washer", "off", { uid: "e" })}<p>${this.w.noMachines}</p></div>`}
      ${found ? `<section><h3>🔎 ${t.found}</h3>${found}</section>` : ""}
    </main>`;
  }

  _headline() {
    const t = this.t, w = this.w, ms = this._machines;
    const d = new Date().toLocaleDateString(this.L === "da" ? "da-DK" : undefined, { weekday: "long", day: "numeric", month: "long" });
    const today = d.charAt(0).toUpperCase() + d.slice(1);
    const fin = ms.find((m) => m.state === "finished");
    if (fin) return { kicker: today, title: `${esc(fin.name)} ${t.isDone}`, sub: w.waiting, color: "#22c55e" };
    const run = ms.filter((m) => m.state === "running" || m.state === "finishing")
      .sort((a, b) => (a.finish_time ? new Date(a.finish_time) : 9e15) - (b.finish_time ? new Date(b.finish_time) : 9e15))[0];
    if (run) {
      const left = minutesLeft(run.finish_time);
      return { kicker: today, title: run.finish_time ? `${esc(run.name)} ${w.doneAt} ${clock(run.finish_time)}` : `${esc(run.name)} ${t.isRunning}`,
        sub: run.finish_time ? `${hm(left)} ${w.left}${run.program ? " · " + esc(run.program) : ""}` : w.unknownTime, color: ACCENT[run.kind] };
    }
    return { kicker: today, title: t.allReady, sub: ms.length ? t.readySub : "", color: "#6366f1" };
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

  _chips(m) {
    const t = this.t, w = this.w;
    const active = m.state === "running" || m.state === "finishing";
    return [
      active ? `<span class="chip prog">${esc(m.program || w.unknownTime)}</span>` : "",
      active && m.live_cost != null ? `<span class="chip">${money(m.live_cost, m.currency)} ${t.sinceStart}</span>` : "",
      active && m.power != null ? `<span class="chip">⚡ ${Math.round(m.power)} ${t.watts}</span>` : "",
      m.state === "off" && m.cheap ? `<span class="chip cheap">💡 ${w.cheap} ${clock(m.cheap.start)} · ${w.save} ${money(m.cheap.saving, m.currency)}</span>` : "",
      ...(m.findings || []).slice(-1).map((f) => `<span class="chip warn">⚠️ ${esc(f.text)}</span>`),
    ].join("");
  }

  _card(m) {
    const w = this.w, s = this._status(m);
    const active = m.state === "running" || m.state === "finishing";
    const bar = active && m.progress != null ? `<div class="progress"><span style="width:${m.progress}%"></span></div>` : active ? `<div class="progress indet"><span></span></div>` : "";
    const chips = this._chips(m);
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
    const head = `<div class="detail-head s-${m.state}" style="--a:${m.state === "finished" ? "#22c55e" : ACCENT[m.kind]}"><i class="blob b1"></i><i class="blob b2"></i>
      <div class="duo"><div class="big">${machineSVG(m.kind, m.state, { display: display(m), uid: "d" + m.entry_id.slice(-6) })}</div>
        ${active ? this._ring(m) : ""}</div>
      <div class="info"><div class="state">${w.states[m.state]}</div><div class="main xl" id="main">${s.main}</div>
        <div class="sub" id="sub">${esc(s.sub)}</div>
        <div class="chips">${active ? `<span class="chip prog">${esc(m.program || w.unknownTime)}</span>` : ""}
          ${active && m.live_cost != null ? `<span class="chip" id="cost">${money(m.live_cost, m.currency)} ${t.sinceStart}</span>` : ""}
          ${active ? `<span class="chip" id="watt">⚡ ${Math.round(m.power || 0)} ${t.watts}</span>` : ""}</div>
        <div class="actions">${m.state === "finished" ? `<button class="primary" data-act="emptied" data-id="${m.entry_id}">✓ ${w.emptied}</button>` : ""}
          ${active ? `<button class="ghost" data-act="finish" data-id="${m.entry_id}">${t.finishNow}</button>` : ""}</div>
      </div></div>`;
    if (!f) return `${this._bar(esc(m.name), true)}<main>${head}<div class="empty">…</div></main>`;
    const live = active && f.live_curve?.length > 2 ? `<section class="card"><h3>${t.live}</h3>${this._chart(f.live_curve.map((x) => x * 60), m.kind, 90)}</section>` : "";
    const ask = this._ask(f, m);
    const findings = (f.findings || []).length ? `<section class="card warnbox"><h3>⚠️ ${t.findings}</h3>${f.findings.map((x, i) =>
      `<div class="row"><span>${esc(x.text)}</span>${x.cycle && this._hasAi ? `<button class="ghost sm" data-act="explain" data-cycle="${x.cycle}">${t.aiExplain}</button>` : ""}
       <button class="ghost sm" data-act="dismiss" data-i="${i}">${t.dismiss}</button></div><div class="explain" data-for="${x.cycle}"></div>`).join("")}</section>` : "";
    const month = f.month?.count ? `<div class="stats"><div><b>${f.month.count}</b><span>${t.cycles}</span></div><div><b>${num(f.month.kwh, this.L, 1)}</b><span>kWh</span></div>
      ${f.month.cost != null ? `<div><b>${money(f.month.cost, m.currency)}</b><span>${t.month.toLowerCase()}</span></div>` : ""}</div>` : "";
    return `${this._bar(esc(m.name), true)}<main>${head}${month}${live}${ask}${findings}
      ${this._programs(f, m)}${this._history(f, m)}${this._admin ? this._machineSettings(m) : ""}</main>`;
  }

  _ask(f, m) {
    const t = this.t, active = m.state === "running" || m.state === "finishing";
    // While it runs: which programme is running (it knows the rest sooner). After: which one it was.
    const c = active ? (f.live_id && (m.program_id == null || m.score < 1) ? { id: f.live_id, program_id: m.program_id } : null)
      : f.history?.[0] && f.history[0].by !== "user" ? f.history[0] : null;
    if (!c) return "";
    const named = f.programs.filter((p) => p.named);
    const have = new Set(named.map((p) => p.name.toLowerCase()));
    const ideas = (SUGGEST[this.L][m.kind] || []).filter((n) => !have.has(n.toLowerCase()));
    const when = active ? "" : ` (${new Date(c.start).toLocaleString(this.L === "da" ? "da-DK" : undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })}, ${dur(c.duration, this.L)})`;
    return `<section class="card ask"><h3>🏷️ ${active ? t.whichNow : t.which}</h3><div class="muted">${t.whichHint}${when}</div>
      <div class="chips pick">${named.map((p) => `<button class="chip btn ${p.id === c.program_id ? "on" : ""}" data-act="label" data-cycle="${c.id}" data-program="${p.id}">${esc(p.name)}</button>`).join("")}
        ${ideas.map((n) => `<button class="chip btn idea" data-act="labelname" data-cycle="${c.id}" data-name="${esc(n)}">${esc(n)}</button>`).join("")}</div>
      <div class="inline"><input id="newname" data-keep="newname" placeholder="${t.own}"><button class="primary" data-act="labelnew" data-cycle="${c.id}">${t.ok}</button>
      ${this._hasAi && c.program_id && !active ? `<button class="ghost" data-act="ainame" data-program="${c.program_id}">${t.ai}</button>` : ""}</div>
    </section>`;
  }

  _programs(f, m) {
    const t = this.t;
    const add = `<div class="inline"><input id="addprog" data-keep="addprog" placeholder="${t.newProgram}"><button class="ghost" data-act="addprog">+ ${t.addProgram}</button></div>`;
    return `<section class="card"><h3>${t.programs}</h3>${f.programs.map((p) => {
      const st = p.stats;
      const usual = st ? `${t.usual} ${dur(st.duration, this.L)} · ${num(st.wh / 1000, this.L)} kWh${st.cost != null ? " · " + money(st.cost, m.currency) : ""}` : "";
      return `<div class="prog-row"><div class="pname"><b>${esc(p.name)}</b>${p.named ? "" : ` <span class="auto">auto</span>`}
        <div class="muted">${usual}${usual ? " · " : ""}${t.learned} ${st ? st.count : 0}/${p.count}</div></div>
        <button class="dots" data-act="sheet" data-kind="prog" data-id="${p.id}" aria-label="${t.more}">⋯</button></div>`;
    }).join("") || `<div class="muted">${t.noPrograms}</div>`}${add}</section>`;
  }

  _history(f, m) {
    const t = this.t;
    const rows = (f.history || []).map((c) => {
      const when = new Date(c.start).toLocaleString(this.L === "da" ? "da-DK" : undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      const flags = [c.resumed ? `<span class="tag">⏸ ${t.resumed}</span>` : "", c.clean === false ? `<span class="tag grey">${t.unclear}: ${t.reasons[c.reason] || c.reason}</span>` : ""].join("");
      return `<div class="hist"><div class="spark">${this._chart(c.curve, m.kind, 28, true)}</div>
        <div class="hmain"><b>${esc(c.program || "–")}</b> <span class="muted">${when}</span><div class="muted">${dur(c.duration, this.L)} · ${num(c.kwh, this.L)} kWh${c.cost != null ? " · " + money(c.cost, m.currency) : ""} ${flags}</div></div>
        <button class="dots" data-act="sheet" data-kind="hist" data-id="${c.id}" aria-label="${t.more}">⋯</button></div><div class="explain" data-for="${c.id}"></div>`;
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
      <label>🔊 ${t.k.own}<select data-ms="speaker"><option value="">${t.k.asDefault}</option>${states.filter((s) => s.entity_id.startsWith("media_player.") && (s.attributes.supported_features & 512))
        .map((s) => `<option value="${s.entity_id}" ${s.entity_id === d.speaker ? "selected" : ""}>${esc(s.attributes.friendly_name || s.entity_id)}</option>`).join("")}</select></label>
      <button class="wide soft" data-act="learn">🧠 ${t.learnHistory}</button>
    </section>`;
  }

  _ring(m) {
    const r = 52, c = 2 * Math.PI * r, p = m.progress ?? 0, left = minutesLeft(m.finish_time);
    return `<div class="ring"><svg viewBox="0 0 120 120"><circle class="track" cx="60" cy="60" r="${r}"/>
      <circle class="val" id="ringval" cx="60" cy="60" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p / 100)}"/></svg>
      <div class="rt"><b id="left">${left == null ? "…" : left >= 60 ? hm(left) : left}</b><span>${left == null || left >= 60 ? "" : "min"}</span></div></div>`;
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
    const ring = r.getElementById("ringval");
    if (ring) ring.setAttribute("stroke-dashoffset", 2 * Math.PI * 52 * (1 - (m.progress || 0) / 100));
    const left = minutesLeft(m.finish_time);
    set("left", left == null ? "…" : left >= 60 ? hm(left) : String(left));
    r.querySelectorAll(".aw-display").forEach((el) => (el.textContent = display(m)));
  }

  // ---------- the sheet that slides up (menus that are always fully visible) ----------

  _openSheet(kind, id) {
    const t = this.t, f = this._full[this._open], m = this._machines.find((x) => x.entry_id === this._open);
    if (!f || !m) return;
    let title = "", body = "";
    if (kind === "prog") {
      const p = f.programs.find((x) => x.id === id);
      if (!p) return;
      title = esc(p.name);
      const others = f.programs.filter((o) => o.id !== id);
      body = `<div class="lbl">${t.rename}</div><div class="inline"><input id="sheetname" value="${esc(p.named ? p.name : "")}" placeholder="${t.name}">
          <button class="primary" data-act="rename" data-program="${id}">${t.ok}</button></div>
        ${this._hasAi ? `<button class="wide soft" data-act="ainame" data-program="${id}">${t.ai}</button>` : ""}
        ${others.length ? `<div class="lbl">${t.merge}</div><div class="chips">${others.map((o) => `<button class="chip btn" data-act="merge" data-program="${id}" data-into="${o.id}">${esc(o.name)}</button>`).join("")}</div>` : ""}
        <button class="wide danger" data-act="forget" data-program="${id}">🗑 ${t.forget}</button>`;
    } else {
      const c = f.history.find((x) => x.id === id);
      if (!c) return;
      title = `${esc(c.program || "–")} · ${new Date(c.start).toLocaleString(this.L === "da" ? "da-DK" : undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })}`;
      const named = f.programs.filter((p) => p.named), have = new Set(named.map((p) => p.name.toLowerCase()));
      const ideas = (SUGGEST[this.L][m.kind] || []).filter((n) => !have.has(n.toLowerCase()));
      body = `<div class="lbl">${t.changeProgram}</div><div class="chips">
          ${named.map((p) => `<button class="chip btn ${p.id === c.program_id ? "on" : ""}" data-act="label" data-cycle="${id}" data-program="${p.id}">${esc(p.name)}</button>`).join("")}
          ${ideas.map((n) => `<button class="chip btn idea" data-act="labelname" data-cycle="${id}" data-name="${esc(n)}">${esc(n)}</button>`).join("")}</div>
        ${this._hasAi ? `<button class="wide soft" data-act="explain" data-cycle="${id}">${t.aiExplain}</button><div class="explain" data-for="${id}"></div>` : ""}
        <button class="wide danger" data-act="delcycle" data-cycle="${id}">🗑 ${t.del}</button>`;
    }
    const box = this.shadowRoot.getElementById("sheetbox");
    box.innerHTML = `<div class="sheet-bg" data-act="closesheet"></div><div class="sheet" role="dialog"><div class="grab"></div>
      <div class="sheet-head"><h3>${title}</h3><button class="x" data-act="closesheet" aria-label="${t.close}">✕</button></div>${body}</div>`;
    this._sheetOpen = { kind, id };
    this._wire(box);
  }

  _closeSheet() {
    const box = this.shadowRoot.getElementById("sheetbox");
    const sheet = box?.querySelector(".sheet");
    if (!sheet) return;
    sheet.classList.add("out");
    box.querySelector(".sheet-bg").classList.add("out");
    this._sheetOpen = null;
    setTimeout(() => (box.innerHTML = ""), 220);
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
      ${this._speakSection(s, v, toggle)}
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

  _speakSection(s, v, toggle) {
    const t = this.t, k = t.k, say = v.say || {};
    const tiles = [["done", "✅"], ["soon", "⏳"], ["remind", "🔔"], ["dryer", "🌀"], ["emptied", "🙏"], ["started", "▶️"]];
    return `<section class="card speak"><h3>🔊 ${k.title}</h3><div class="muted">${k.hint}</div>
      <div class="lbl">${k.which}</div>
      <div class="chips pick">${(s.speakers || []).map((p) => `<button class="chip btn ${v.speakers.includes(p.entity_id) ? "on" : ""}" data-act="speaker" data-id="${p.entity_id}">📢 ${esc(p.name)}</button>`).join("") || `<span class="muted">${k.none}</span>`}</div>
      <div class="lbl">${k.say}</div>
      <div class="saygrid">${tiles.map(([key, icon]) => `<button class="say ${say[key] ? "on" : ""}" data-act="say" data-key="${key}">
        <span class="si">${icon}</span><span class="st">${k.kinds[key][0]}</span><span class="sx">“${k.kinds[key][1]}”</span><span class="sw"><span></span></span></button>`).join("")}</div>
      ${toggle("quiet", k.quiet, k.quietHint)}
      ${v.quiet ? `<div class="times"><label>${k.from}<input type="time" data-time="quiet_from" value="${esc(v.quiet_from || "22:00")}"></label>
        <span class="arrow">→</span><label>${k.to}<input type="time" data-time="quiet_to" value="${esc(v.quiet_to || "07:00")}"></label></div>` : ""}
      ${toggle("say_only_home", k.home, k.homeHint)}
      ${(s.voices || []).length > 1 ? `<div class="lbl">${k.voice}</div><select data-set="tts"><option value="">${k.defaultVoice}</option>${s.voices.map((x) => `<option value="${x.entity_id}" ${x.entity_id === v.tts ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>` : ""}
      <button class="wide soft" data-act="speaktest">▶ ${k.test}</button>
    </section>`;
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

  _wire(r = this.shadowRoot) {
    r.querySelectorAll("[data-open]").forEach((el) => el.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      this._open = el.dataset.open;
      this._view = "machine";
      this._render();
      this._loadFull(this._open);
    }));
    r.querySelectorAll("[data-act]").forEach((el) => el.addEventListener("click", (e) => { e.stopPropagation(); this._act(el.dataset.act, el); }));
    r.querySelectorAll("[data-set]").forEach((el) => el.addEventListener("change", () => this._save({ [el.dataset.set]: el.value || null })));
    r.querySelectorAll("[data-time]").forEach((el) => el.addEventListener("change", () => el.value && this._save({ [el.dataset.time]: el.value })));
    r.querySelectorAll("[data-merge]").forEach((el) => el.addEventListener("change", () => el.value && this._cmd("merge_program", { program: el.dataset.merge, into: el.value })));
    r.querySelectorAll("[data-relabel]").forEach((el) => el.addEventListener("change", () => el.value && this._cmd("label", { cycle_id: el.dataset.relabel, program: el.value })));
    r.querySelectorAll("[data-ms]").forEach((el) => el.addEventListener("change", () => this._cmd("machine_settings", { [el.dataset.ms]: el.value || null }, true)));
    r.querySelector("#newname")?.addEventListener("keydown", (e) => e.key === "Enter" && r.querySelector('[data-act="labelnew"]').click());
    r.querySelector("#addprog")?.addEventListener("keydown", (e) => e.key === "Enter" && r.querySelector('[data-act="addprog"]').click());
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
      case "speaker": {
        const id = el.dataset.id, list = new Set(this._settings.settings.speakers || []);
        list.has(id) ? list.delete(id) : list.add(id);
        el.classList.toggle("on");
        return this._save({ speakers: [...list] });
      }
      case "say": {
        const say = { ...(this._settings.settings.say || {}) };
        say[el.dataset.key] = !say[el.dataset.key];
        el.classList.toggle("on", say[el.dataset.key]);
        return this._save({ say });
      }
      case "speaktest": {
        el.disabled = true;
        const res = await this._ws({ type: "appliance_watch/speak_test" }).catch(() => ({ said: false }));
        el.disabled = false;
        return this._toast(res.said ? `🔊 ${this.t.k.playing}` : this.t.k.noSpeaker, !res.said);
      }
      case "learn": {
        el.disabled = true;
        el.textContent = "🧠 …";
        const res = await this._ws({ type: "appliance_watch/learn_history", entry_id: this._open });
        this._full[this._open] = res;
        this._render();
        return this._toast(this.t.learned_n.replace("{n}", res.learned));
      }
      case "sheet": return this._openSheet(el.dataset.kind, el.dataset.id);
      case "closesheet": return this._closeSheet();
      case "merge": return this._cmd("merge_program", { program: el.dataset.program, into: el.dataset.into });
      case "labelname": return this._cmd("label", { cycle_id: el.dataset.cycle, name: el.dataset.name });
      case "addprog": {
        const name = r.getElementById("addprog").value.trim();
        if (name) r.getElementById("addprog").value = "";
        return name && this._cmd("add_program", { name });
      }
      case "labelnew": {
        const name = r.getElementById("newname").value.trim();
        return name && this._cmd("label", { cycle_id: el.dataset.cycle, name });
      }
      case "rename": {
        const name = (r.getElementById("sheetname") || r.querySelector(`[data-rename="${el.dataset.program}"]`)).value.trim();
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
        const box = r.getElementById("sheetname") || r.getElementById("newname");
        if (res.name && box) { box.value = res.name; box.focus(); }
        return;
      }
      case "explain": {
        const box = r.querySelector(`#sheetbox .explain[data-for="${el.dataset.cycle}"]`) || r.querySelector(`.explain[data-for="${el.dataset.cycle}"]`);
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
        await this._save({ [key]: val });
        if (key === "quiet") this._render();
        return;
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
      .chip.btn.idea { border-style:dashed; color:var(--secondary-text-color); }
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

      /* ---------- speakers ---------- */
      .saygrid { display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:10px; }
      button.say { position:relative; text-align:left; font:inherit; color:inherit; cursor:pointer; border-radius:18px; padding:14px 14px 40px;
        border:2px solid var(--divider-color); background:var(--card-background-color); display:flex; flex-direction:column; gap:4px; transition:.2s; }
      button.say .si { font-size:24px; } button.say .st { font-weight:700; font-size:15px; }
      button.say .sx { font-size:12px; color:var(--secondary-text-color); line-height:1.35; }
      button.say .sw { position:absolute; left:14px; bottom:12px; width:36px; height:20px; border-radius:10px; background:var(--disabled-color, #bbb); transition:.2s; }
      button.say .sw span { position:absolute; top:2px; left:2px; width:16px; height:16px; border-radius:50%; background:#fff; transition:.2s; }
      button.say.on { border-color:var(--primary-color); background:color-mix(in srgb, var(--primary-color) 9%, var(--card-background-color));
        box-shadow:0 8px 20px -12px var(--primary-color); }
      button.say.on .sw { background:var(--primary-color); } button.say.on .sw span { left:18px; }
      .times { display:flex; align-items:flex-end; gap:12px; margin-top:10px; }
      .times label { flex:1; margin:0; } .times input { font-size:22px; font-weight:700; text-align:center; padding:12px; }
      .times .arrow { font-size:22px; color:var(--secondary-text-color); padding-bottom:14px; }
      .speak { background:linear-gradient(var(--card-background-color), var(--card-background-color)) padding-box,
        linear-gradient(135deg, #6366f1, #ec4899) border-box; border:2px solid transparent; }

      /* ---------- the WOW layer ---------- */
      @property --ang { syntax:"<angle>"; initial-value:0deg; inherits:false; }
      .hero { position:relative; overflow:hidden; border-radius:28px; padding:26px 22px; margin:4px 0 20px; color:#fff; isolation:isolate;
        background:linear-gradient(135deg, color-mix(in srgb, var(--a) 92%, #000) 0%, color-mix(in srgb, var(--a) 70%, #7c3aed) 100%);
        box-shadow:0 18px 40px -18px color-mix(in srgb, var(--a) 70%, transparent); align-items:flex-end; }
      .blob { position:absolute; border-radius:50%; filter:blur(30px); opacity:.55; z-index:-1; pointer-events:none; }
      .blob.b1 { width:220px; height:220px; background:#fff; top:-90px; right:-40px; opacity:.22; animation:float 9s ease-in-out infinite; }
      .blob.b2 { width:180px; height:180px; background:color-mix(in srgb, var(--a) 60%, #22d3ee); bottom:-80px; left:-30px; animation:float 11s ease-in-out infinite reverse; }
      @keyframes float { 0%,100% { transform:translate(0,0) scale(1); } 50% { transform:translate(-24px,18px) scale(1.15); } }
      .htxt { flex:1; min-width:0; }
      .hk { font-size:13px; opacity:.85; letter-spacing:.02em; }
      .hero h2 { font-size:28px; font-weight:800; line-height:1.15; margin:4px 0 6px; display:block; letter-spacing:-.01em; }
      .hs { font-size:15px; opacity:.92; }
      .hero .pills { display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; }
      .hero .pill { background:rgba(255,255,255,.2); color:#fff; backdrop-filter:blur(6px); font-size:13px; }
      button.glass { font:inherit; font-weight:600; font-size:14px; color:#fff; background:rgba(255,255,255,.18); border:1px solid rgba(255,255,255,.4);
        border-radius:16px; padding:10px 14px; cursor:pointer; backdrop-filter:blur(8px); white-space:nowrap; align-self:flex-start; }
      .grid .card { border:2px solid transparent; border-radius:26px; padding:14px 16px 14px 10px; }
      .grid .card.m-running, .grid .card.m-finishing {
        background:linear-gradient(var(--card-background-color), var(--card-background-color)) padding-box,
          conic-gradient(from var(--ang), var(--a), color-mix(in srgb, var(--a) 10%, transparent) 25%, transparent 50%, color-mix(in srgb, var(--a) 10%, transparent) 75%, var(--a)) border-box;
        animation:in .3s ease both, orbit 3.5s linear infinite; box-shadow:0 12px 32px -14px color-mix(in srgb, var(--a) 65%, transparent); }
      @keyframes orbit { to { --ang:360deg; } }
      .grid .card.m-finished { border-color:#22c55e; animation:in .3s ease both, glowg 2.4s ease-in-out infinite; }
      @keyframes glowg { 0%,100% { box-shadow:0 0 0 0 rgba(34,197,94,.0), 0 10px 30px -14px rgba(34,197,94,.6); } 50% { box-shadow:0 0 0 6px rgba(34,197,94,.12), 0 10px 30px -14px rgba(34,197,94,.6); } }
      .art { width:120px; height:146px; }
      .name { font-size:18px; letter-spacing:-.01em; }
      .main { font-size:22px; letter-spacing:-.01em; }
      .state { padding:3px 9px; border-radius:10px; background:color-mix(in srgb, var(--a) 14%, transparent); }
      .m-finished .state { background:rgba(34,197,94,.15); } .m-off .state { background:var(--secondary-background-color); }
      .progress { height:10px; border-radius:8px; }
      .detail-head { position:relative; overflow:hidden; isolation:isolate; flex-direction:column; text-align:center; gap:6px; border-radius:30px; padding:22px 18px;
        color:#fff; background:linear-gradient(160deg, color-mix(in srgb, var(--a) 88%, #000), color-mix(in srgb, var(--a) 62%, #312e81));
        box-shadow:0 22px 50px -22px color-mix(in srgb, var(--a) 75%, transparent); }
      .detail-head .muted, .detail-head .sub { color:rgba(255,255,255,.88); }
      .detail-head .state { background:rgba(255,255,255,.2); color:#fff; display:inline-block; }
      .detail-head .chip { background:rgba(255,255,255,.18); color:#fff; }
      .detail-head .chip.prog { background:rgba(255,255,255,.28); }
      .duo { display:flex; align-items:center; justify-content:center; gap:22px; }
      .detail-head .big { width:150px; height:183px; filter:drop-shadow(0 18px 24px rgba(0,0,0,.35)); }
      .ring { position:relative; width:138px; height:138px; flex:none; }
      .ring svg { width:100%; height:100%; transform:rotate(-90deg); }
      .ring circle { fill:none; stroke-width:10; }
      .ring .track { stroke:rgba(255,255,255,.18); }
      .ring .val { stroke:#fff; stroke-linecap:round; transition:stroke-dashoffset 1s ease; filter:drop-shadow(0 0 6px rgba(255,255,255,.6)); }
      .rt { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
      .rt b { font-size:38px; font-weight:800; line-height:1; letter-spacing:-.02em; } .rt span { font-size:13px; opacity:.85; margin-top:2px; }
      .detail-head .main.xl { font-size:30px; font-weight:400; margin-top:4px; } .detail-head .chips, .detail-head .actions { justify-content:center; }
      .detail-head button.primary { background:#fff; color:color-mix(in srgb, var(--a) 80%, #000); border-color:#fff; font-weight:700; }
      .detail-head button.ghost { background:rgba(255,255,255,.14); color:#fff; border-color:rgba(255,255,255,.5); }
      section.card { border-radius:24px; padding:18px; overflow:visible; }
      section.card h3 { font-size:17px; letter-spacing:-.01em; }
      .stats div { border-radius:20px; background:linear-gradient(160deg, var(--card-background-color), color-mix(in srgb, var(--primary-color) 6%, var(--card-background-color))); }
      .stats b { font-size:24px; letter-spacing:-.02em; }
      .ask { border:0; background:linear-gradient(var(--card-background-color), var(--card-background-color)) padding-box,
        linear-gradient(135deg, var(--primary-color), #a855f7) border-box; border:2px solid transparent; }
      button.ghost { background:color-mix(in srgb, var(--primary-color) 10%, transparent); }
      .chip.btn { font-weight:500; } .chip.btn:active, button:active { transform:scale(.96); }
      .dots { width:40px; height:40px; flex:none; border-radius:14px; border:0; cursor:pointer; font-size:22px; line-height:1;
        background:var(--secondary-background-color); color:var(--primary-text-color); }
      #sheetbox { position:relative; z-index:20; }
      .sheet-bg { position:fixed; inset:0; background:rgba(0,0,0,.45); backdrop-filter:blur(3px); animation:fade .2s ease both; z-index:20; }
      .sheet { position:fixed; left:0; right:0; bottom:0; margin:0 auto; max-width:560px; z-index:21; box-sizing:border-box;
        background:var(--card-background-color); border-radius:28px 28px 0 0; padding:10px 18px calc(22px + env(safe-area-inset-bottom));
        box-shadow:0 -12px 40px rgba(0,0,0,.3); animation:up .26s cubic-bezier(.2,.9,.3,1.1) both; max-height:82vh; overflow:auto; }
      .sheet.out { animation:down .2s ease forwards; } .sheet-bg.out { animation:fade .2s ease reverse forwards; }
      @keyframes up { from { transform:translateY(100%); } } @keyframes down { to { transform:translateY(100%); } } @keyframes fade { from { opacity:0; } }
      .grab { width:42px; height:5px; border-radius:3px; background:var(--divider-color); margin:2px auto 10px; }
      .sheet-head { display:flex; align-items:center; gap:10px; } .sheet-head h3 { flex:1; margin:0; font-size:19px; }
      .x { width:36px; height:36px; border-radius:50%; border:0; background:var(--secondary-background-color); color:var(--primary-text-color); font-size:16px; cursor:pointer; }
      button.wide { display:block; width:100%; margin-top:14px; font:inherit; font-size:16px; font-weight:600; padding:14px; border-radius:16px; border:0; cursor:pointer; }
      button.wide.soft { background:color-mix(in srgb, var(--primary-color) 14%, transparent); color:var(--primary-color); }
      button.wide.danger { background:rgba(229,72,77,.12); color:#e5484d; }
      .sheet .chips .chip.btn { font-size:15px; padding:9px 15px; }
      @media (max-width:600px) { .hero h2 { font-size:24px; } .art { width:104px; height:127px; } .duo { gap:14px; }
        .detail-head .big { width:128px; height:156px; } .ring { width:120px; height:120px; } .rt b { font-size:32px; } }
      @media (max-width:600px) {
        main { padding:12px; } .grid { grid-template-columns:1fr; } .art { width:96px; height:117px; }
        .detail-head { flex-direction:column; text-align:center; gap:10px; } .detail-head .big { width:150px; height:183px; }
        .detail-head .chips, .detail-head .actions { justify-content:center; } .explain { padding-left:0; }
      }
    </style>`;
  }
}

customElements.define("appliance-watch-panel", ApplianceWatchPanel);
