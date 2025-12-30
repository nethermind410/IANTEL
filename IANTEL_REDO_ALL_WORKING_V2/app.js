
(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const state = {
    enabled: { crypto:true, markets:true, built:true, reading:true, garden:true, ears:true },
    clicks: true,
    stationIndex: 0,
    stations: [
      { name: "Radio Swiss Jazz", url: "https://stream.srg-ssr.ch/m/rsj/mp3_128" },
      { name: "SomaFM — Secret Agent (Bond vibes)", url: "https://ice1.somafm.com/secretagent-128-mp3" },
      { name: "SomaFM — Illinois Street Lounge", url: "https://ice1.somafm.com/illstreet-128-mp3" },
      { name: "SomaFM — Groove Salad", url: "https://ice1.somafm.com/groovesalad-128-mp3" }
    ]
  };

  const clickAudio = new Audio();
  clickAudio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="; // silent placeholder
  function softClick(){
    if(!state.clicks) return;
    try { clickAudio.currentTime = 0; clickAudio.play().catch(()=>{}); } catch(e){}
  }

  // Settings
  const settingsPanel = $("#settingsPanel");
  $("#btnSettings").addEventListener("click", () => { softClick(); settingsPanel.classList.toggle("hidden"); });
  $("#btnCloseSettings").addEventListener("click", () => { softClick(); settingsPanel.classList.add("hidden"); });
  $("#selText").addEventListener("change", (e) => {
    document.body.classList.remove("text-large","text-xl");
    if(e.target.value === "large") document.body.classList.add("text-large");
    if(e.target.value === "xl") document.body.classList.add("text-xl");
    localStorage.setItem("iantel_text", e.target.value);
  });
  $("#chkClicks").addEventListener("change", (e) => {
    state.clicks = !!e.target.checked;
    localStorage.setItem("iantel_clicks", state.clicks ? "1":"0");
  });
  $("#btnMagnify").addEventListener("click", () => {
    softClick();
    document.body.classList.toggle("magnify");
    localStorage.setItem("iantel_magnify", document.body.classList.contains("magnify") ? "1":"0");
  });

  // Load prefs
  const savedText = localStorage.getItem("iantel_text") || "large";
  $("#selText").value = savedText;
  $("#selText").dispatchEvent(new Event("change"));
  state.clicks = (localStorage.getItem("iantel_clicks") ?? "1") === "1";
  $("#chkClicks").checked = state.clicks;
  if((localStorage.getItem("iantel_magnify") ?? "0") === "1") document.body.classList.add("magnify");

  // Topics toggles
  $$(".topic").forEach(btn => {
    btn.addEventListener("click", () => {
      softClick();
      const k = btn.dataset.section;
      state.enabled[k] = !state.enabled[k];
      btn.classList.toggle("active", state.enabled[k]);
      btn.classList.toggle("off", !state.enabled[k]);
    });
  });

  // Radio
  const radio = $("#radio");
  const stationName = $("#stationName");
  const stationStatus = $("#stationStatus");
  const btnPlay = $("#btnPlay");
  const btnStation = $("#btnStation");

  function setStation(i){
    state.stationIndex = (i + state.stations.length) % state.stations.length;
    const st = state.stations[state.stationIndex];
    stationName.textContent = st.name;
    radio.src = st.url;
    stationStatus.textContent = "ready when you are.";
    localStorage.setItem("iantel_station", String(state.stationIndex));
  }

  btnStation.addEventListener("click", () => {
    softClick();
    setStation(state.stationIndex + 1);
    // don't autoplay; user clicks play
  });

  btnPlay.addEventListener("click", async () => {
    softClick();
    try{
      if(radio.paused){
        await radio.play();
        btnPlay.textContent = "⏸ pause";
        stationStatus.textContent = "playing softly in the background.";
      }else{
        radio.pause();
        btnPlay.textContent = "▶ play";
        stationStatus.textContent = "paused.";
      }
    }catch(e){
      stationStatus.textContent = "blocked — click play again.";
    }
  });

  setStation(Number(localStorage.getItem("iantel_station") || "0"));

  // Data loading
  const toast = $("#status");
  function showToast(msg){
    toast.textContent = msg;
    toast.classList.remove("hidden");
    setTimeout(()=>toast.classList.add("hidden"), 2200);
  }

  function fmtMoney(n){
    if(n === null || n === undefined || Number.isNaN(n)) return "—";
    const abs = Math.abs(n);
    if(abs >= 1e12) return "$" + (n/1e12).toFixed(2) + "T";
    if(abs >= 1e9) return "$" + (n/1e9).toFixed(2) + "B";
    if(abs >= 1e6) return "$" + (n/1e6).toFixed(2) + "M";
    return "$" + Number(n).toLocaleString();
  }

  function renderSnapshot(snapshot){
    const tbody = $("#snapTable tbody");
    tbody.innerHTML = "";
    if(!snapshot || !snapshot.items || !snapshot.items.length){
      $("#snapMeta").textContent = "snapshot unavailable (last cached will show after next update).";
      return;
    }
    $("#snapMeta").textContent = `updated ${snapshot.updated_local || "—"}`;
    snapshot.items.forEach(row => {
      const tr = document.createElement("tr");
      const ch = Number(row.change24h || 0);
      tr.innerHTML = `
        <td>${row.symbol}</td>
        <td class="num">${row.priceUsd ? ("$" + Number(row.priceUsd).toLocaleString(undefined,{maximumFractionDigits: row.priceUsd>10?0:2})) : "—"}</td>
        <td class="num ${ch>=0 ? "up":"down"}">${(ch>=0?"+":"")}${ch.toFixed(2)}%</td>
        <td class="num">${fmtMoney(Number(row.mcapUsd))}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function sectionLabel(key){
    return ({
      crypto:{name:"crypto", tag:"NEWS + EXPLAINERS"},
      markets:{name:"markets", tag:"MACRO + POLICY"},
      built:{name:"built environment", tag:"DESIGN + CONSTRUCTION + INFRA"},
      reading:{name:"reading intel", tag:"ONE PER GENRE"},
      garden:{name:"garden & land", tag:"LEARNING + ARTICLES"},
      ears:{name:"for your ears only", tag:"MUSIC CULTURE + RELEASES"}
    })[key];
  }

  function renderSections(sections){
    const grid = $("#briefGrid");
    grid.innerHTML = "";
    const order = ["crypto","markets","built","reading","garden","ears"];
    for(const key of order){
      if(!state.enabled[key]) continue;
      const info = sectionLabel(key);
      const items = (sections && sections[key]) ? sections[key] : [];
      const el = document.createElement("div");
      el.className = "section";
      el.id = "sec-"+key;
      el.innerHTML = `
        <div class="section-title">
          <div>
            <div class="section-tag">${info.tag}</div>
            <div class="section-name">${info.name}</div>
          </div>
          <div class="small">${items.length ? items.length+" items" : "no items"}</div>
        </div>
        <div class="items"></div>
      `;
      const itemsEl = el.querySelector(".items");
      if(!items.length){
        const empty = document.createElement("div");
        empty.className = "small";
        empty.textContent = "No items loaded yet. Once the daily update runs, this fills automatically. (Local preview: run npm install, then npm run build in this folder.)";
        itemsEl.appendChild(empty);
      } else {
        items.forEach(it => {
          const card = document.createElement("div");
          card.className = "item";
          const safeTitle = (it.title || "Untitled").replace(/</g,"&lt;");
          const safeDesc = (it.description || "").replace(/</g,"&lt;");
          card.innerHTML = `
            <div><a href="${it.url}" target="_blank" rel="noopener noreferrer">${safeTitle}</a></div>
            ${safeDesc ? `<div class="desc">${safeDesc}</div>` : ""}
            <div class="source">${it.source || ""}${it.published ? " · " + it.published : ""}</div>
          `;
          itemsEl.appendChild(card);
        });
      }
      grid.appendChild(el);
    }
  }

  async function loadBriefing(){
    const res = await fetch("data/briefing.json", { cache: "no-store" });
    if(!res.ok) throw new Error("briefing.json missing");
    return await res.json();
  }

  function rotateMessage(list, storageKey){
    if(!Array.isArray(list) || !list.length) return "";
    const last = localStorage.getItem(storageKey) || "";
    let pick = list[Math.floor(Math.random()*list.length)];
    if(list.length > 1 && pick === last){
      pick = list[(list.indexOf(pick)+1) % list.length];
    }
    localStorage.setItem(storageKey, pick);
    return pick;
  }

  const quotes = [
    "curiosity first. certainty later.",
    "small signals beat loud opinions.",
    "read one good thing slowly.",
    "information arrives before the opinions do."
  ];

  // Button: generate (client-side render only)
  $("#btnGenerate").addEventListener("click", async () => {
    softClick();
    showToast("gathering intel…");
    try{
      const b = await loadBriefing();
      $("#meta").textContent = "updated " + (b?.meta?.generated_at ? b.meta.generated_at.replace("T"," ").replace("Z"," UTC") : "—");
      $("#quote").textContent = quotes[Math.floor(Math.random()*quotes.length)];

      // messages
      const familyRot = rotateMessage(b.messages?.family || [], "iantel_family_last");
      const sonRot = rotateMessage(b.messages?.son || [], "iantel_son_last");
      $("#familyMsg").textContent = familyRot || b.message_family || "Love your family ♥";
      // Optional son msg for future expansion; kept in json

      // snapshot
      renderSnapshot(b.snapshot);

      // sections
      renderSections(b.sections);

      showToast("briefing updated");
      // scroll to top of right
      document.querySelector(".right").scrollIntoView({behavior:"smooth", block:"start"});
    }catch(e){
      console.error(e);
      showToast("couldn’t load briefing.json yet (run daily update).");
    }
  });

  // Initial: do NOT auto-generate. Just load message placeholder from file if possible.
  (async () => {
    try{
      const b = await loadBriefing();
      $("#meta").textContent = "updated " + (b?.meta?.generated_at ? b.meta.generated_at.replace("T"," ").replace("Z"," UTC") : "—");
      const familyRot = rotateMessage(b.messages?.family || [], "iantel_family_last");
      $("#familyMsg").textContent = familyRot || b.message_family || "Love your family ♥";
      renderSnapshot(b.snapshot);
      renderSections(b.sections);
    }catch(e){
      $("#familyMsg").textContent = "For your eyes only: keep it calm, keep it sharp. Love your family ♥";
      $("#snapMeta").textContent = "snapshot will appear after the first update.";
      renderSections(null);
    }
  })();
})();
