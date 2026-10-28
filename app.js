const DATA = (window.CATALOG || []).slice().sort((a, b) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
);
const PAGE_SIZE = 18;
const STORE_KEY = "ffxiv-profiles-v1";
const LEGACY_KEY = "ffxiv-collected";

const EXPANSIONS = [
  ["A Realm Reborn", "#d9d3c7"],
  ["Heavensward", "#8ec0e0"],
  ["Stormblood", "#e08a82"],
  ["Shadowbringers", "#c2a6e4"],
  ["Endwalker", "#8fd0cb"],
  ["Dawntrail", "#e6b85c"],
];

const EXP_COLOR = Object.fromEntries(EXPANSIONS);

const LEVEL_BANDS = [
  { id: "1-15", label: "Level 1–15", min: 1, max: 15 },
  { id: "16-30", label: "Level 16–30", min: 16, max: 30 },
  { id: "31-50", label: "Level 31–50", min: 31, max: 50 },
  { id: "51-60", label: "Level 51–60", min: 51, max: 60 },
  { id: "61-70", label: "Level 61–70", min: 61, max: 70 },
  { id: "71-80", label: "Level 71–80", min: 71, max: 80 },
  { id: "81-90", label: "Level 81–90", min: 81, max: 90 },
  { id: "91-100", label: "Level 91–100", min: 91, max: 100 },
  { id: "none", label: "Level not listed", min: 0, max: 0 },
];

const KINDS = [
  ["all", "All"],
  ["Minion", "Minions"],
  ["Mount", "Mounts"],
  ["Emote", "Emotes"],
  ["Card", "Cards"],
];

const STATUSES = [
  ["all", "All"],
  ["remaining", "Still looking"],
  ["collected", "Collected"],
];

const store = loadStore();
const state = {
  kind: "all",
  expansion: "all",
  level: "all",
  zone: "all",
  status: "all",
  query: "",
  page: 0,
  selected: "",
  collected: new Set(activeProfile().collected),
};

const els = {
  gauges: document.getElementById("gauges"),
  search: document.getElementById("search"),
  kind: document.getElementById("kind-chips"),
  exp: document.getElementById("exp-chips"),
  level: document.getElementById("level"),
  zone: document.getElementById("zone"),
  status: document.getElementById("status-chips"),
  reset: document.getElementById("reset"),
  detail: document.getElementById("detail"),
  rows: document.getElementById("rows"),
  range: document.getElementById("range"),
  prev: document.getElementById("prev"),
  next: document.getElementById("next"),
  pageLabel: document.getElementById("page-label"),
  profile: document.getElementById("profile"),
  profileName: document.getElementById("profile-name"),
  addProfile: document.getElementById("add-profile"),
  removeProfile: document.getElementById("remove-profile"),
  copyLink: document.getElementById("copy-link"),
  progressLink: document.getElementById("progress-link"),
  saveNote: document.getElementById("save-note"),
};

function newId() {
  return crypto.randomUUID();
}

function legacyCollected() {
  try {
    const raw = JSON.parse(localStorage.getItem(LEGACY_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function loadStore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (saved && saved.profiles && saved.profiles[saved.active]) return saved;
  } catch {
    /* start fresh below */
  }
  const id = newId();
  return {
    active: id,
    profiles: {
      [id]: { name: "Collector", collected: legacyCollected() },
    },
  };
}

function activeProfile() {
  return store.profiles[store.active];
}

function saveStore() {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
  localStorage.removeItem(LEGACY_KEY);
}

function saveCollected() {
  activeProfile().collected = [...state.collected];
  saveStore();
  els.saveNote.textContent = "Saved in this browser.";
}

function encodeProgress(collected) {
  const bytes = new Uint8Array(Math.ceil(DATA.length / 8));
  DATA.forEach((item, index) => {
    if (collected.has(item.id)) bytes[index >> 3] |= 1 << (index & 7);
  });
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeProgress(code) {
  try {
    const normalized = String(code).replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    if (binary.length !== Math.ceil(DATA.length / 8)) return null;
    const ids = [];
    for (let index = 0; index < DATA.length; index += 1) {
      if (binary.charCodeAt(index >> 3) & (1 << (index & 7))) ids.push(DATA[index].id);
    }
    return ids;
  } catch {
    return null;
  }
}

function progressUrl() {
  const url = new URL(location.href);
  url.hash = `p=${encodeProgress(state.collected)}`;
  return url.toString();
}

function progressFromLink() {
  const code = new URLSearchParams(location.hash.replace(/^#/, "")).get("p");
  if (!code) return;
  history.replaceState(null, "", `${location.pathname}${location.search}`);
  const ids = decodeProgress(code);
  if (!ids) {
    els.saveNote.textContent = "This progress link does not match the current catalog.";
    return;
  }
  const same = ids.length === state.collected.size && ids.every((id) => state.collected.has(id));
  if (same) return;
  const label = `${ids.length} collected ${ids.length === 1 ? "entry" : "entries"}`;
  const replace = state.collected.size === 0 || confirm(
    `Load ${label} from this link into ${activeProfile().name}?`
  );
  if (!replace) return;
  state.collected = new Set(ids);
  saveCollected();
  els.saveNote.textContent = `Loaded ${label} from the progress link.`;
}

function renderProfiles() {
  const profile = activeProfile();
  const names = Object.entries(store.profiles);
  els.profile.innerHTML = names.map(([id, item]) =>
    `<option value="${esc(id)}"${id === store.active ? " selected" : ""}>${esc(item.name || "Collector")}</option>`
  ).join("");
  if (document.activeElement !== els.profileName) {
    els.profileName.value = profile.name || "";
  }
  els.removeProfile.hidden = names.length < 2;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

function bandOf(level) {
  if (level == null) return "none";
  const band = LEVEL_BANDS.find((item) => item.id !== "none" && level >= item.min && level <= item.max);
  return band ? band.id : "none";
}

function lineSummary(item) {
  if (!item.questStart || !item.questCount) return "—";
  if (item.questCount === 1) return item.questStart;
  return `${item.questStart} · ${item.questCount} quests`;
}

function questCopy(item) {
  if (!item.questStart || !item.questCount) return "";
  const end = item.questEnd && item.questEnd !== item.questStart
    ? `, ending with ${item.questEnd}`
    : "";
  const length = item.questCount === 1
    ? "The line is a single quest."
    : `${item.questCount} quests to finish the line${end}.`;
  const where = item.unlockQuest && item.unlockAt && item.questCount > 1
    ? ` This unlock is quest ${item.unlockAt} of ${item.questCount}, ${item.unlockQuest}.`
    : "";
  return `Starts with ${item.questStart}. ${length}${where}`;
}

function filtered() {
  const needle = state.query.trim().toLowerCase();
  return DATA.filter((item) => {
    if (state.kind !== "all" && item.kind !== state.kind) return false;
    if (state.expansion !== "all" && item.expansion !== state.expansion) return false;
    if (state.level !== "all" && bandOf(item.level) !== state.level) return false;
    if (state.zone !== "all" && !(item.zones || []).includes(state.zone)) return false;
    const owned = state.collected.has(item.id);
    if (state.status === "collected" && !owned) return false;
    if (state.status === "remaining" && owned) return false;
    if (!needle) return true;
    const rules = (item.challenges || [])
      .map((challenge) => `${challenge.npc} ${challenge.rules} ${challenge.location}`)
      .join(" ");
    const hay = [
      item.name,
      item.location,
      item.how,
      item.source,
      item.command || "",
      item.questStart || "",
      item.unlockQuest || "",
      rules,
    ].join(" ").toLowerCase();
    return hay.includes(needle);
  });
}

function chips(container, options, current, onPick) {
  container.innerHTML = options.map(([value, label, count]) => `
    <button type="button" class="chip" data-value="${esc(value)}" aria-pressed="${value === current}">
      ${esc(label)}${count != null ? `<small>${count}</small>` : ""}
    </button>
  `).join("");
  container.querySelectorAll(".chip").forEach((button) => {
    button.addEventListener("click", () => onPick(button.dataset.value));
  });
}

function fillSelect(select, options, current) {
  select.innerHTML = options.map(([value, label]) =>
    `<option value="${esc(value)}"${value === current ? " selected" : ""}>${esc(label)}</option>`
  ).join("");
}

function zoneOk(zone) {
  if (!zone || zone.length > 40) return false;
  if (/\b(and|boxes|during|reward|of the)\b/i.test(zone)) return false;
  return zone.split(/\s+/).length <= 6;
}

function zones() {
  const names = new Set();
  DATA.forEach((item) => (item.zones || []).forEach((zone) => {
    if (zoneOk(zone)) names.add(zone);
  }));
  return [["all", "All locations"], ...[...names].sort((a, b) => a.localeCompare(b)).map((name) => [name, name])];
}

function kindCounts() {
  const counts = { all: DATA.length };
  DATA.forEach((item) => { counts[item.kind] = (counts[item.kind] || 0) + 1; });
  return counts;
}

function renderFilters() {
  const counts = kindCounts();
  chips(els.kind, KINDS.map(([value, label]) => [value, label, counts[value] || 0]), state.kind, (value) => {
    state.kind = value;
    state.page = 0;
    render();
  });
  chips(
    els.exp,
    [["all", "All"], ...EXPANSIONS.map(([name]) => [name, name])],
    state.expansion,
    (value) => {
      state.expansion = value;
      state.page = 0;
      render();
    },
  );
  fillSelect(
    els.level,
    [["all", "All levels"], ...LEVEL_BANDS.map((band) => [band.id, band.label])],
    state.level,
  );
  fillSelect(els.zone, zones(), state.zone);
  chips(els.status, STATUSES, state.status, (value) => {
    state.status = value;
    state.page = 0;
    render();
  });
}

function renderGauges(matches) {
  const owned = DATA.filter((item) => state.collected.has(item.id)).length;
  const lines = DATA.filter((item) => item.questStart).length;
  const ratio = DATA.length ? Math.round((owned / DATA.length) * 100) : 0;
  const cards = [
    [DATA.length, "Catalog entries"],
    [owned, "Marked collected"],
    [lines, "Quest-line unlocks"],
    [matches, "Matching filters"],
  ];
  els.gauges.innerHTML = cards.map(([value, label], index) => `
    <div class="gauge">
      <b>${value}</b>
      <span>${esc(label)}</span>
      ${index === 1 ? `<div class="meter" aria-hidden="true"><i style="width:${ratio}%"></i></div>` : ""}
    </div>
  `).join("");
}

function ruleTags(rules) {
  return String(rules || "")
    .split(",")
    .map((rule) => rule.trim())
    .filter(Boolean)
    .map((rule) => `<span class="rule">${esc(rule)}</span>`)
    .join("");
}

function expTag(name) {
  const color = EXP_COLOR[name] || "#8a8070";
  return `<span class="tag exp" style="background:${color}">${esc(name === "Unknown" ? "Expansion unknown" : name)}</span>`;
}

function renderDetail(item) {
  if (!item) {
    els.detail.innerHTML = `<h3>No match</h3><p class="prose">Nothing in the catalog fits these filters.</p>`;
    return;
  }
  const owned = state.collected.has(item.id);
  const tags = [
    `<span class="tag">${esc(item.kind)}</span>`,
    expTag(item.expansion),
    item.level != null ? `<span class="tag">Level ${item.level}</span>` : "",
    `<span class="tag">${esc(item.source)}</span>`,
    item.patch ? `<span class="tag">Patch ${esc(item.patch)}</span>` : "",
  ].join("");
  const challenges = item.challenges || [];
  const quest = challenges.length ? "" : questCopy(item);
  const challengeHtml = challenges.map((challenge) => {
    const line = challenge.questStart && challenge.questCount
      ? `<p class="muted">Unlock quest line starts with ${esc(challenge.questStart)}. ${challenge.questCount} ${challenge.questCount === 1 ? "quest" : "quests"} to finish the line.${challenge.unlockQuest ? ` The duel unlocks on ${esc(challenge.unlockQuest)}${challenge.unlockAt ? ` (quest ${challenge.unlockAt} of ${challenge.questCount})` : ""}.` : ""}</p>`
      : "";
    return `
      <div class="block">
        <h4>${esc(challenge.npc)}${challenge.location ? ` · ${esc(challenge.location)}` : ""}</h4>
        <div class="rules">${ruleTags(challenge.rules) || `<span class="muted">No special rules listed.</span>`}</div>
        ${line}
      </div>
    `;
  }).join("");

  els.detail.innerHTML = `
    <h3>${esc(item.name)}</h3>
    <div class="kicker">${tags}</div>
    <label class="own">
      <input type="checkbox" data-own="${esc(item.id)}" ${owned ? "checked" : ""}>
      Collected
    </label>
    ${item.location ? `<p class="prose"><strong>Location.</strong> ${esc(item.location)}</p>` : ""}
    ${item.command ? `<p class="prose"><strong>Command.</strong> ${esc(item.command)}</p>` : ""}
    ${item.how ? `<p class="prose">${esc(item.how)}</p>` : ""}
    ${quest ? `<div class="block"><h4>Quest line</h4><p class="prose">${esc(quest)}</p></div>` : ""}
    ${challengeHtml ? `<div class="block"><h4>Triple Triad challenge</h4>${challengeHtml}</div>` : ""}
    <a class="wiki" href="${esc(item.url)}" target="_blank" rel="noreferrer">Open on the Console Games Wiki</a>
  `;
}

function renderRows(items) {
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  state.page = Math.min(state.page, pageCount - 1);
  const start = state.page * PAGE_SIZE;
  const visible = items.slice(start, start + PAGE_SIZE);

  if (!visible.length) {
    els.rows.innerHTML = `<p class="empty">No entries match these filters.</p>`;
  } else {
    els.rows.innerHTML = visible.map((item) => {
      const color = EXP_COLOR[item.expansion] || "#8a8070";
      return `
        <div class="row${item.id === state.selected ? " selected" : ""}" data-id="${esc(item.id)}" role="button" tabindex="0">
          <input class="check" type="checkbox" aria-label="Collected ${esc(item.name)}" data-own="${esc(item.id)}" ${state.collected.has(item.id) ? "checked" : ""}>
          <span class="name">${esc(item.name)}</span>
          <span class="exp"><i class="gem" style="background:${color}"></i>${esc(item.expansion === "Unknown" ? "—" : item.expansion)}</span>
          <span class="lv">${item.level == null ? "—" : item.level}</span>
          <span class="loc muted${item.location ? "" : " is-empty"}" title="${esc(item.location || "")}">${esc(item.location || "—")}</span>
          <span class="line muted${item.questStart ? "" : " is-empty"}" title="${esc(lineSummary(item))}">${esc(lineSummary(item))}</span>
        </div>
      `;
    }).join("");
  }

  const end = Math.min(start + PAGE_SIZE, items.length);
  els.range.textContent = items.length
    ? `${start + 1}–${end} of ${items.length}`
    : "No entries match these filters.";
  els.pageLabel.textContent = `Page ${state.page + 1} of ${pageCount}`;
  els.prev.disabled = state.page === 0;
  els.next.disabled = state.page >= pageCount - 1;
  els.prev.parentElement.hidden = items.length <= PAGE_SIZE;
}

function render() {
  const items = filtered();
  if (!items.some((item) => item.id === state.selected)) {
    state.selected = items[0] ? items[0].id : "";
  }
  renderProfiles();
  if (!els.progressLink.hidden) {
    const nextLink = progressUrl();
    if (els.progressLink.value !== nextLink) els.progressLink.value = nextLink;
  }
  renderFilters();
  renderGauges(items.length);
  renderDetail(items.find((item) => item.id === state.selected) || null);
  renderRows(items);
}

function toggleOwned(id, checked) {
  if (checked) state.collected.add(id);
  else state.collected.delete(id);
  saveCollected();
  state.selected = id;
  render();
}

els.search.addEventListener("input", () => {
  state.query = els.search.value;
  state.page = 0;
  render();
});

els.level.addEventListener("change", () => {
  state.level = els.level.value;
  state.page = 0;
  render();
});

els.zone.addEventListener("change", () => {
  state.zone = els.zone.value;
  state.page = 0;
  render();
});

els.reset.addEventListener("click", () => {
  state.kind = "all";
  state.expansion = "all";
  state.level = "all";
  state.zone = "all";
  state.status = "all";
  state.query = "";
  state.page = 0;
  els.search.value = "";
  render();
});

els.prev.addEventListener("click", () => {
  state.page = Math.max(0, state.page - 1);
  render();
});

els.next.addEventListener("click", () => {
  state.page += 1;
  render();
});

els.rows.addEventListener("click", (event) => {
  const own = event.target.closest("[data-own]");
  if (own) {
    event.stopPropagation();
    toggleOwned(own.dataset.own, own.checked);
    return;
  }
  const row = event.target.closest(".row");
  if (!row) return;
  state.selected = row.dataset.id;
  render();
});

els.rows.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const row = event.target.closest(".row");
  if (!row || event.target.matches("input")) return;
  event.preventDefault();
  state.selected = row.dataset.id;
  render();
});

els.detail.addEventListener("change", (event) => {
  const own = event.target.closest("[data-own]");
  if (!own) return;
  toggleOwned(own.dataset.own, own.checked);
});

els.profile.addEventListener("change", () => {
  store.active = els.profile.value;
  state.collected = new Set(activeProfile().collected);
  state.page = 0;
  saveStore();
  els.progressLink.hidden = true;
  els.saveNote.textContent = "Saved in this browser.";
  render();
  els.profileName.value = activeProfile().name || "";
});

els.profileName.addEventListener("input", () => {
  activeProfile().name = els.profileName.value.slice(0, 32);
  saveStore();
  const option = els.profile.selectedOptions[0];
  if (option) option.textContent = activeProfile().name || "Collector";
});

els.profileName.addEventListener("change", () => {
  activeProfile().name = els.profileName.value.trim() || "Collector";
  els.profileName.value = activeProfile().name;
  saveStore();
  renderProfiles();
});

els.addProfile.addEventListener("click", () => {
  const id = newId();
  const count = Object.keys(store.profiles).length + 1;
  store.profiles[id] = { name: `Collector ${count}`, collected: [] };
  store.active = id;
  state.collected = new Set();
  state.page = 0;
  saveStore();
  els.progressLink.hidden = true;
  render();
  els.profileName.focus();
  els.profileName.select();
});

els.removeProfile.addEventListener("click", () => {
  if (Object.keys(store.profiles).length < 2) return;
  const name = activeProfile().name || "Collector";
  if (!confirm(`Remove ${name} and the checks saved for them in this browser?`)) return;
  delete store.profiles[store.active];
  store.active = Object.keys(store.profiles)[0];
  state.collected = new Set(activeProfile().collected);
  state.page = 0;
  saveStore();
  els.progressLink.hidden = true;
  render();
});

els.copyLink.addEventListener("click", async () => {
  const url = progressUrl();
  els.progressLink.hidden = false;
  els.progressLink.value = url;
  els.progressLink.focus();
  els.progressLink.select();
  els.saveNote.textContent = "Select the link and copy it.";
  try {
    const copied = navigator.clipboard.writeText(url);
    const timed = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("timeout")), 700);
    });
    await Promise.race([copied, timed]);
    els.saveNote.textContent = "Progress link copied.";
  } catch {
    els.saveNote.textContent = "Select the link and copy it.";
  }
});

window.addEventListener("hashchange", () => {
  progressFromLink();
  render();
});

progressFromLink();
render();
