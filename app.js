(() => {
  const LS_KEY = "flashcards_progress_v1";
  const LS_THEME = "flashcards_theme_v1";

  const $ = (id) => document.getElementById(id);

  const el = {
    metaLine: $("metaLine"),
    pillType: $("pillType"),
    counter: $("counter"),
    question: $("question"),
    choices: $("choices"),
    btnReveal: $("btnReveal"),
    answerBox: $("answerBox"),
    answerText: $("answerText"),
    btnPrev: $("btnPrev"),
    btnNext: $("btnNext"),
    btnMarkCorrect: $("btnMarkCorrect"),
    btnMarkWrong: $("btnMarkWrong"),
    btnShuffle: $("btnShuffle"),
    btnReset: $("btnReset"),
    modeSelect: $("modeSelect"),
    statSeen: $("statSeen"),
    statCorrect: $("statCorrect"),
    statWrong: $("statWrong"),
    btnJumpRandom: $("btnJumpRandom"),
    btnToggleTheme: $("btnToggleTheme"),
    card: $("card"),
  };

  const ALL = Array.isArray(window.FLASHCARDS) ? window.FLASHCARDS.slice() : [];
  if (!ALL.length) {
    el.question.textContent = "No flashcards found. Check flashcards.js";
    return;
  }

  // Progress store: { [id]: { seen: n, correct: n, wrong: n, last: timestamp } }
  function loadProgress() {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY)) || {};
    } catch {
      return {};
    }
  }
  function saveProgress(p) {
    localStorage.setItem(LS_KEY, JSON.stringify(p));
  }

  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(LS_THEME, theme);
  }
  function initTheme() {
    const saved = localStorage.getItem(LS_THEME);
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
    } else {
      setTheme("dark");
    }
  }

  initTheme();

  let progress = loadProgress();
  let shuffled = false;
  let mode = "all";

  // Working deck (after filtering/shuffle)
  let deck = ALL.slice();
  let idx = 0;

  function normType(t) {
    if (t === "single" || t === "multiple" || t === "tf") return t;
    return "single";
  }

  function computeStats() {
    let seen = 0, correct = 0, wrong = 0;
    for (const c of ALL) {
      const p = progress[c.id];
      if (!p) continue;
      if (p.seen > 0) seen++;
      correct += (p.correct || 0);
      wrong += (p.wrong || 0);
    }
    el.statSeen.textContent = String(seen);
    el.statCorrect.textContent = String(correct);
    el.statWrong.textContent = String(wrong);
  }

  function shuffleArray(a) {
    const arr = a.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function applyMode() {
    mode = el.modeSelect.value;

    const missedOnly = (c) => (progress[c.id]?.wrong || 0) > 0;
    const unseenOnly = (c) => !(progress[c.id]?.seen > 0);

    deck = ALL.filter((c) => {
      const t = normType(c.type);

      if (mode === "single") return t === "single";
      if (mode === "multiple") return t === "multiple";
      if (mode === "tf") return t === "tf";
      if (mode === "missed") return missedOnly(c);
      if (mode === "unseen") return unseenOnly(c);
      return true;
    });

    if (shuffled) deck = shuffleArray(deck);
    idx = Math.min(idx, Math.max(0, deck.length - 1));
    if (deck.length === 0) {
      el.question.textContent = "No cards match this filter.";
      el.choices.innerHTML = "";
      el.counter.textContent = "0 / 0";
      el.pillType.textContent = "—";
      el.answerBox.classList.add("hidden");
      return;
    }
    render();
  }

  function setSeen(cardId) {
    const p = progress[cardId] || { seen: 0, correct: 0, wrong: 0, last: 0 };
    p.seen += 1;
    p.last = Date.now();
    progress[cardId] = p;
    saveProgress(progress);
    computeStats();
  }

  function mark(cardId, which) {
    const p = progress[cardId] || { seen: 0, correct: 0, wrong: 0, last: 0 };
    p.seen = Math.max(1, p.seen);
    p.last = Date.now();
    if (which === "correct") p.correct += 1;
    if (which === "wrong") p.wrong += 1;
    progress[cardId] = p;
    saveProgress(progress);
    computeStats();
  }

  function current() {
    return deck[idx];
  }

  function safeText(s) {
    return String(s ?? "");
  }

  function renderChoices(card) {
    el.choices.innerHTML = "";

    const type = normType(card.type);

    // Determine options shown to user
    let options = [];
    if (type === "multiple") {
      // For multiple, you currently only have correct answers.
      // UI still works: it will show correct answers as options (no distractors).
      // If you later add `choices`, it will use them.
      options = Array.isArray(card.choices) && card.choices.length
        ? card.choices
        : (card.answers || []);
    } else if (type === "tf") {
      options = Array.isArray(card.choices) && card.choices.length
        ? card.choices
        : ["True", "False"];
    } else {
      // single
      options = Array.isArray(card.choices) && card.choices.length
        ? card.choices
        : (card.answers || []);
    }

    const inputType = (type === "multiple") ? "checkbox" : "radio";
    const name = `q_${card.id}`;

    options.forEach((opt, i) => {
      const row = document.createElement("label");
      row.className = "choice";

      const input = document.createElement("input");
      input.type = inputType;
      input.name = name;
      input.value = opt;
      input.setAttribute("aria-label", `Option ${i + 1}`);

      const text = document.createElement("div");
      text.className = "choice__text";
      text.textContent = safeText(opt);

      row.appendChild(input);
      row.appendChild(text);
      el.choices.appendChild(row);
    });
  }

  function renderAnswer(card) {
    const type = normType(card.type);
    const ans = Array.isArray(card.answers) ? card.answers : [];
    if (type === "multiple") {
      el.answerText.innerHTML = ans.map(a => `• ${escapeHtml(a)}`).join("<br/>");
    } else {
      el.answerText.textContent = ans[0] ? safeText(ans[0]) : "—";
    }
  }

  function escapeHtml(str) {
    return safeText(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function render() {
    const card = current();
    if (!card) return;

    setSeen(card.id);

    const type = normType(card.type);
    el.pillType.textContent =
      type === "single" ? "Single Answer" :
      type === "multiple" ? "Select All That Apply" :
      "True / False";

    el.counter.textContent = `${idx + 1} / ${deck.length}`;

    // Small meta line (seen count)
    const p = progress[card.id] || { seen: 0, correct: 0, wrong: 0 };
    el.metaLine.textContent = `Seen ${p.seen || 0} • ✅ ${p.correct || 0} • ❌ ${p.wrong || 0}`;

    el.question.textContent = safeText(card.question);

    // Reset reveal + render UI
    el.answerBox.classList.add("hidden");
    el.btnReveal.textContent = "Reveal Answer";

    renderChoices(card);
    renderAnswer(card);

    // Enable/disable nav
    el.btnPrev.disabled = idx === 0;
    el.btnNext.disabled = idx === deck.length - 1;
  }

  function next() {
    if (idx < deck.length - 1) {
      idx += 1;
      render();
    }
  }
  function prev() {
    if (idx > 0) {
      idx -= 1;
      render();
    }
  }

  // Reveal toggle
  el.btnReveal.addEventListener("click", () => {
    const hidden = el.answerBox.classList.contains("hidden");
    if (hidden) {
      el.answerBox.classList.remove("hidden");
      el.btnReveal.textContent = "Hide Answer";
    } else {
      el.answerBox.classList.add("hidden");
      el.btnReveal.textContent = "Reveal Answer";
    }
  });

  // Marking
  el.btnMarkCorrect.addEventListener("click", () => {
    const card = current();
    if (!card) return;
    mark(card.id, "correct");
    next();
  });

  el.btnMarkWrong.addEventListener("click", () => {
    const card = current();
    if (!card) return;
    mark(card.id, "wrong");
    next();
  });

  // Nav buttons
  el.btnNext.addEventListener("click", next);
  el.btnPrev.addEventListener("click", prev);

  // Shuffle
  el.btnShuffle.addEventListener("click", () => {
    shuffled = !shuffled;
    if (shuffled) deck = shuffleArray(deck);
    else applyMode(); // rebuild deck in original order for the current mode
    idx = 0;
    render();
    el.btnShuffle.textContent = shuffled ? "🔀✓" : "🔀";
  });

  // Reset progress
  el.btnReset.addEventListener("click", () => {
    if (!confirm("Reset progress on this device?")) return;
    progress = {};
    saveProgress(progress);
    computeStats();
    render();
  });

  // Mode filter
  el.modeSelect.addEventListener("change", applyMode);

  // Random jump
  el.btnJumpRandom.addEventListener("click", () => {
    if (!deck.length) return;
    idx = Math.floor(Math.random() * deck.length);
    render();
  });

  // Theme toggle
  el.btnToggleTheme.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") || "dark";
    setTheme(cur === "dark" ? "light" : "dark");
  });

  // Swipe support
  (function enableSwipe() {
    let startX = 0;
    let startY = 0;
    let tracking = false;

    el.card.addEventListener("touchstart", (e) => {
      if (!e.touches || e.touches.length !== 1) return;
      tracking = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });

    el.card.addEventListener("touchend", (e) => {
      if (!tracking) return;
      tracking = false;
      const touch = e.changedTouches && e.changedTouches[0];
      if (!touch) return;

      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      // Ignore mostly-vertical swipes
      if (Math.abs(dy) > Math.abs(dx)) return;

      // Threshold
      if (dx < -60) next();
      if (dx > 60) prev();
    }, { passive: true });
  })();

  // Init
  computeStats();
  applyMode(); // also renders
})();
