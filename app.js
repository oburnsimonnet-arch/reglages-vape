/* Réglages Vape : logique pure + interface */

/* ---------- Fonctions pures (testables sous Node) ---------- */

function electrical(watts, ohm) {
  if (!(watts > 0) || !(ohm > 0)) return { volts: 0, amps: 0 };
  return { volts: Math.sqrt(watts * ohm), amps: Math.sqrt(watts / ohm) };
}

function rangeStatus(watts, coil, mod) {
  if (mod && (watts < mod.minW || watts > mod.maxW)) return "mod";
  if (!coil || coil.minW == null || coil.maxW == null) return "unknown";
  if (watts < coil.minW) return "low";
  if (watts > coil.maxW) return "high";
  return "ok";
}

function sliderBounds(coil, mod) {
  let lo = 5;
  let hi = 40;
  if (coil && coil.minW != null && coil.maxW != null) {
    lo = Math.max(coil.minW - 6, 1);
    hi = coil.maxW + 10;
  }
  if (mod) {
    lo = Math.max(lo, mod.minW);
    hi = Math.min(hi, mod.maxW);
  }
  return { lo, hi };
}

function formatNumber(n, digits) {
  const d = digits == null ? 1 : digits;
  return Number(n).toLocaleString("fr-FR", { maximumFractionDigits: d });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

if (typeof module !== "undefined") {
  module.exports = { electrical, rangeStatus, sliderBounds, formatNumber, escapeHtml };
}

/* ---------- Interface (navigateur uniquement) ---------- */

if (typeof document !== "undefined") {
  (function () {
    const STORE_STATE = "vr_state_v1";
    const STORE_FAVS = "vr_favs_v1";
    const STORE_CUSTOM = "vr_custom_coils_v1";

    let data = null;
    let customCoils = [];
    let state = { modId: null, tankId: null, coilId: null, watts: null };
    let favs = [];

    const $ = (id) => document.getElementById(id);

    function load(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) {
        return fallback;
      }
    }
    function save(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        /* stockage indisponible : l'appli reste utilisable */
      }
    }

    const byId = (list, id) => list.find((x) => x.id === id) || null;
    const currentMod = () => byId(data.mods, state.modId);
    const currentTank = () => byId(data.tanks, state.tankId);
    const currentCoil = () => byId(allCoils(), state.coilId);
    const allCoils = () => data.coils.concat(customCoils);
    const coilsForTank = (tank) => (tank ? allCoils().filter((c) => c.family === tank.family) : []);

    function rangeText(coil) {
      if (!coil || coil.minW == null) return "Plage à confirmer";
      return formatNumber(coil.minW, 1) + " – " + formatNumber(coil.maxW, 1) + " W";
    }

    /* ----- Matériel ----- */
    function renderGear() {
      const modSel = $("mod-select");
      const tankSel = $("tank-select");
      modSel.innerHTML = data.mods
        .map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.brand + " " + m.name)}</option>`)
        .join("");
      tankSel.innerHTML = data.tanks
        .map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.brand + " " + t.name)}</option>`)
        .join("");
      modSel.value = state.modId;
      tankSel.value = state.tankId;
      const mod = currentMod();
      const tank = currentTank();
      $("gear-note").textContent = [mod && mod.note, tank && tank.note].filter(Boolean).join(" ");
    }

    /* ----- Résistances ----- */
    function renderCoils() {
      const list = coilsForTank(currentTank());
      $("coil-list").innerHTML = list
        .map((c) => {
          const active = c.id === state.coilId ? " active" : "";
          return `<button class="chip${active}" data-coil="${escapeHtml(c.id)}" aria-pressed="${c.id === state.coilId}">
            <span class="chip-ohm">${formatNumber(c.ohm, 2)} Ω${c.custom ? ' <small>(perso)</small>' : ""}</span>
            <span class="chip-range">${escapeHtml(rangeText(c))}</span>
          </button>`;
        })
        .join("");
    }

    /* ----- Résultat ----- */
    const STATUS = {
      ok: { cls: "ok", text: "Dans la plage conseillée" },
      low: { cls: "warn", text: "Sous la plage : vape froide, peu de saveur" },
      high: { cls: "bad", text: "Au-dessus de la plage : risque de goût brûlé et d'usure rapide" },
      mod: { cls: "bad", text: "Hors des limites de la box" },
      unknown: { cls: "warn", text: "Plage non confirmée : vérifie l'inscription sur la résistance" }
    };

    function renderResult() {
      const coil = currentCoil();
      const mod = currentMod();
      const box = $("result");
      if (!coil) {
        box.hidden = true;
        return;
      }
      box.hidden = false;
      $("coil-name").textContent = coil.name;
      $("coil-range").textContent = rangeText(coil);
      $("coil-meta").textContent = [coil.style, coil.material].filter(Boolean).join(" · ");
      $("cc-del").hidden = !coil.custom;
      $("coil-note").textContent = coil.note || "";

      const hint = $("start-hint");
      if (coil.minW != null) {
        hint.textContent = "Point de départ : " + formatNumber(coil.minW, 1) + " W, puis monte de 1 W à la fois jusqu'à ton goût.";
      } else {
        hint.textContent = "Commence bas (10 W) et monte de 1 W à la fois, sans dépasser la plage gravée sur la résistance.";
      }

      const b = sliderBounds(coil, mod);
      const slider = $("watt-slider");
      slider.min = b.lo;
      slider.max = b.hi;
      slider.step = 0.5;
      if (state.watts == null || state.coilChanged) {
        state.watts = coil.minW != null ? Math.round(((coil.minW + coil.maxW) / 2) * 2) / 2 : Math.min(Math.max(10, b.lo), b.hi);
        state.coilChanged = false;
      }
      state.watts = Math.min(Math.max(state.watts, b.lo), b.hi);
      slider.value = state.watts;
      renderWatts();
    }

    function renderWatts() {
      const coil = currentCoil();
      const mod = currentMod();
      if (!coil) return;
      const w = Number($("watt-slider").value);
      state.watts = w;
      save(STORE_STATE, state);
      const e = electrical(w, coil.ohm);
      $("watt-value").textContent = formatNumber(w, 1) + " W";
      $("volt-value").textContent = formatNumber(e.volts, 2) + " V";
      $("amp-value").textContent = formatNumber(e.amps, 1) + " A";
      const st = STATUS[rangeStatus(w, coil, mod)];
      const badge = $("status");
      badge.className = "status " + st.cls;
      badge.textContent = st.text;

      // Position du curseur dans la barre de plage
      const bar = $("range-bar");
      const b = sliderBounds(coil, mod);
      const pct = (v) => ((v - b.lo) / (b.hi - b.lo)) * 100;
      if (coil.minW != null) {
        bar.style.setProperty("--from", Math.max(0, pct(coil.minW)) + "%");
        bar.style.setProperty("--to", Math.min(100, pct(coil.maxW)) + "%");
        bar.hidden = false;
      } else {
        bar.hidden = true;
      }
    }

    /* ----- Favoris ----- */
    function renderFavs() {
      const el = $("fav-list");
      if (!favs.length) {
        el.innerHTML = '<p class="empty">Aucun réglage enregistré pour l\'instant. Choisis une résistance puis appuie sur « Enregistrer ce réglage ».</p>';
        return;
      }
      el.innerHTML = favs
        .map((f) => {
          const coil = byId(allCoils(), f.coilId);
          const tank = byId(data.tanks, f.tankId);
          const title = (coil ? coil.name : f.coilId) + " à " + formatNumber(f.watts, 1) + " W";
          const sub = (tank ? tank.brand + " " + tank.name : "") + (f.note ? " · " + f.note : "");
          return `<div class="fav">
            <button class="fav-main" data-load="${escapeHtml(f.id)}">
              <strong>${escapeHtml(title)}</strong>
              <span>${escapeHtml(sub)}</span>
            </button>
            <button class="fav-del" data-del="${escapeHtml(f.id)}" aria-label="Supprimer ce réglage">Supprimer</button>
          </div>`;
        })
        .join("");
    }

    function addFav() {
      const coil = currentCoil();
      if (!coil) return;
      const note = $("fav-note").value.trim().slice(0, 80);
      favs.unshift({
        id: "f" + Date.now().toString(36),
        modId: state.modId,
        tankId: state.tankId,
        coilId: coil.id,
        watts: state.watts,
        note: note
      });
      save(STORE_FAVS, favs);
      $("fav-note").value = "";
      renderFavs();
      const msg = $("saved-msg");
      msg.textContent = "Réglage enregistré dans l'onglet Favoris.";
      setTimeout(() => (msg.textContent = ""), 2500);
    }

    /* ----- Résistance personnalisée ----- */
    const num = (id) => parseFloat(String($(id).value).replace(",", "."));

    function addCustomCoil() {
      const ohm = num("cc-ohm");
      const minW = num("cc-min");
      const maxW = num("cc-max");
      const msg = $("cc-msg");
      if (!(ohm > 0) || !(minW > 0) || !(maxW >= minW)) {
        msg.textContent = "Vérifie les valeurs : résistance > 0 et puissance max ≥ puissance min.";
        return;
      }
      const tank = currentTank();
      const coil = {
        id: "c" + Date.now().toString(36),
        family: tank.family,
        name: "Ma résistance " + formatNumber(ohm, 2) + " Ω",
        ohm: ohm,
        style: "",
        material: "",
        minW: minW,
        maxW: maxW,
        confidence: "user",
        custom: true,
        note: "Plage saisie d'après l'inscription sur la résistance."
      };
      customCoils.push(coil);
      save(STORE_CUSTOM, customCoils);
      state.coilId = coil.id;
      state.coilChanged = true;
      save(STORE_STATE, state);
      ["cc-ohm", "cc-min", "cc-max"].forEach((id) => ($(id).value = ""));
      msg.textContent = "Résistance ajoutée.";
      setTimeout(() => (msg.textContent = ""), 2500);
      renderCoils();
      renderResult();
    }

    function deleteCustomCoil() {
      const coil = currentCoil();
      if (!coil || !coil.custom) return;
      customCoils = customCoils.filter((c) => c.id !== coil.id);
      save(STORE_CUSTOM, customCoils);
      favs = favs.filter((f) => f.coilId !== coil.id);
      save(STORE_FAVS, favs);
      const first = coilsForTank(currentTank())[0];
      state.coilId = first ? first.id : null;
      state.coilChanged = true;
      save(STORE_STATE, state);
      renderCoils();
      renderResult();
      renderFavs();
    }

    /* ----- Calculateur ----- */
    function renderCalc() {
      const r = parseFloat(String($("calc-ohm").value).replace(",", "."));
      const p = parseFloat(String($("calc-watt").value).replace(",", "."));
      const out = $("calc-out");
      if (!(r > 0) || !(p > 0)) {
        out.textContent = "Saisis une résistance et une puissance.";
        return;
      }
      const e = electrical(p, r);
      out.innerHTML =
        "<strong>" + formatNumber(e.volts, 2) + " V</strong> aux bornes · <strong>" + formatNumber(e.amps, 1) + " A</strong> dans la résistance";
    }

    /* ----- Onglets ----- */
    function showTab(name) {
      document.querySelectorAll(".tab").forEach((t) => {
        const on = t.dataset.tab === name;
        t.classList.toggle("active", on);
        t.setAttribute("aria-selected", on);
      });
      document.querySelectorAll(".panel").forEach((p) => (p.hidden = p.id !== "panel-" + name));
    }

    /* ----- Initialisation ----- */
    function bind() {
      $("mod-select").addEventListener("change", (e) => {
        state.modId = e.target.value;
        save(STORE_STATE, state);
        renderGear();
        renderResult();
      });
      $("tank-select").addEventListener("change", (e) => {
        state.tankId = e.target.value;
        const first = coilsForTank(currentTank())[0];
        state.coilId = first ? first.id : null;
        state.coilChanged = true;
        save(STORE_STATE, state);
        renderGear();
        renderCoils();
        renderResult();
      });
      $("coil-list").addEventListener("click", (e) => {
        const btn = e.target.closest("[data-coil]");
        if (!btn) return;
        state.coilId = btn.dataset.coil;
        state.coilChanged = true;
        save(STORE_STATE, state);
        renderCoils();
        renderResult();
      });
      $("watt-slider").addEventListener("input", renderWatts);
      $("save-fav").addEventListener("click", addFav);
      $("cc-add").addEventListener("click", addCustomCoil);
      $("cc-del").addEventListener("click", deleteCustomCoil);
      $("fav-list").addEventListener("click", (e) => {
        const del = e.target.closest("[data-del]");
        const load = e.target.closest("[data-load]");
        if (del) {
          favs = favs.filter((f) => f.id !== del.dataset.del);
          save(STORE_FAVS, favs);
          renderFavs();
        } else if (load) {
          const f = byId(favs, load.dataset.load);
          if (!f) return;
          state.modId = byId(data.mods, f.modId) ? f.modId : state.modId;
          state.tankId = byId(data.tanks, f.tankId) ? f.tankId : state.tankId;
          state.coilId = byId(allCoils(), f.coilId) ? f.coilId : state.coilId;
          state.watts = f.watts;
          state.coilChanged = false;
          save(STORE_STATE, state);
          renderGear();
          renderCoils();
          renderResult();
          showTab("reglages");
        }
      });
      document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => showTab(t.dataset.tab)));
      ["calc-ohm", "calc-watt"].forEach((id) => $(id).addEventListener("input", renderCalc));
    }

    function init() {
      const saved = load(STORE_STATE, {});
      favs = load(STORE_FAVS, []);
      customCoils = load(STORE_CUSTOM, []);
      state.modId = byId(data.mods, saved.modId) ? saved.modId : data.mods[0].id;
      state.tankId = byId(data.tanks, saved.tankId) ? saved.tankId : data.tanks[0].id;
      const coils = coilsForTank(currentTank());
      state.coilId = byId(coils, saved.coilId) ? saved.coilId : coils[0] ? coils[0].id : null;
      state.watts = typeof saved.watts === "number" ? saved.watts : null;
      state.coilChanged = false;
      renderGear();
      renderCoils();
      renderResult();
      renderFavs();
      renderCalc();
      bind();
    }

    fetch("data.json")
      .then((r) => {
        if (!r.ok) throw new Error("data.json " + r.status);
        return r.json();
      })
      .then((d) => {
        data = d;
        init();
      })
      .catch(() => {
        $("load-error").hidden = false;
      });

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
    }
  })();
}
