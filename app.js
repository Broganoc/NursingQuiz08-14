(() => {
  const LS_KEY = "flashcards_progress_v2";
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
    btnSubmit: $("btnSubmit"),

    resultBar: $("resultBar"),

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
    if (saved === "light" || saved === "dark") setTheme(saved);
    else setTheme("dark");
  }
  initTheme();

  let progress = loadProgress();

  // Start shuffled every load
  let shuffled = true;
  let deck = ALL.slice();
  let idx = 0;

  // Per-card attempt state
  let submitted = false;

  function normType(t) {
    if (t === "single" || t === "multiple" || t === "tf") return t;
    return "single";
  }

  function computeStats() {
    let seenCards = 0, correct = 0, wrong = 0;
    for (const c of ALL) {
      const p = progress[c.id];
      if (!p) continue;
      if (p.seen > 0) seenCards++;
      correct += (p.correct || 0);
      wrong += (p.wrong || 0);
    }
    el.statSeen.textContent = String(seenCards);
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

  function safeText(s) {
    return String(s ?? "");
  }

  function escapeHtml(str) {
    return safeText(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // Shuffles choices so the correct option isn't always first
  function shuffledCopy(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Options source:
  // - TF: keep stable True/False order (change to shuffledCopy(["True","False"]) if you want random)
  // - Single/Multiple: use card.choices if present else card.answers; then shuffle for display
  function getOptions(card) {
    const type = normType(card.type);

    if (type === "tf") {
      return Array.isArray(card.choices) && card.choices.length
        ? card.choices
        : ["True", "False"];
    }

    const base =
      Array.isArray(card.choices) && card.choices.length
        ? card.choices
        : (card.answers || []);

    return shuffledCopy(base);
  }

  function applyMode() {
    const mode = el.modeSelect.value;

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
      hideResult();
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

  function mark(cardId, isCorrect) {
    const p = progress[cardId] || { seen: 0, correct: 0, wrong: 0, last: 0 };
    p.seen = Math.max(1, p.seen);
    p.last = Date.now();
    if (isCorrect) p.correct += 1;
    else p.wrong += 1;
    progress[cardId] = p;
    saveProgress(progress);
    computeStats();
  }

  function current() {
    return deck[idx];
  }

  function renderChoices(card) {
    el.choices.innerHTML = "";

    const type = normType(card.type);
    const options = getOptions(card);

    const inputType = type === "multiple" ? "checkbox" : "radio";
    const name = `q_${card.id}`;

    options.forEach((opt, i) => {
      const row = document.createElement("label");
      row.className = "choice";
      row.dataset.value = opt;

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
      el.answerText.innerHTML = ans.map((a) => `• ${escapeHtml(a)}`).join("<br/>");
    } else {
      el.answerText.textContent = ans[0] ? safeText(ans[0]) : "—";
    }
  }

  function setInputsDisabled(disabled) {
    el.choices.querySelectorAll("input").forEach((inp) => {
      inp.disabled = disabled;
    });
  }

  function getSelectedValues(card) {
    const name = `q_${card.id}`;
    const inputs = Array.from(el.choices.querySelectorAll(`input[name="${name}"]`));
    return inputs.filter((i) => i.checked).map((i) => i.value);
  }

  function arrayEqAsSet(a, b) {
    const A = new Set(a);
    const B = new Set(b);
    if (A.size !== B.size) return false;
    for (const v of A) if (!B.has(v)) return false;
    return true;
  }

  function clearChoiceHighlights() {
    el.choices.querySelectorAll(".choice").forEach((row) => {
      row.classList.remove("choice--correct", "choice--wrong");
    });
  }

  function showResult(isCorrect, message) {
    el.resultBar.classList.remove("hidden", "result--good", "result--bad");
    el.resultBar.classList.add(isCorrect ? "result--good" : "result--bad");
    el.resultBar.textContent = message;
  }

  function hideResult() {
    el.resultBar.classList.add("hidden");
    el.resultBar.classList.remove("result--good", "result--bad");
    el.resultBar.textContent = "";
  }

  function grade(card) {
    const type = normType(card.type);
    const correctAnswers = Array.isArray(card.answers) ? card.answers : [];
    const selected = getSelectedValues(card);

    if (selected.length === 0) {
      showResult(false, "Select an option before submitting.");
      return null;
    }

    let isCorrect = false;
    if (type === "multiple") {
      isCorrect = arrayEqAsSet(selected, correctAnswers);
    } else {
      isCorrect = selected[0] === correctAnswers[0];
    }

    // Highlight correct options + wrong selections
    const correctSet = new Set(correctAnswers);
    el.choices.querySelectorAll(".choice").forEach((row) => {
      const v = row.dataset.value;
      const input = row.querySelector("input");
      const picked = input.checked;

      if (correctSet.has(v)) row.classList.add("choice--correct");
      if (picked && !correctSet.has(v)) row.classList.add("choice--wrong");
    });

    // Reveal answer automatically on submit
    el.answerBox.classList.remove("hidden");
    el.btnReveal.textContent = "Hide Answer";

    showResult(isCorrect, isCorrect ? "✅ Correct" : "❌ Incorrect");

    mark(card.id, isCorrect);
    submitted = true;
    setInputsDisabled(true);
    el.btnSubmit.textContent = "Next";
    return isCorrect;
  }

  function render() {
    const card = current();
    if (!card) return;

    submitted = false;
    hideResult();
    clearChoiceHighlights();

    setSeen(card.id);

    const type = normType(card.type);
    el.pillType.textContent =
      type === "single"
        ? "Single Answer"
        : type === "multiple"
        ? "Select All That Apply"
        : "True / False";

    el.counter.textContent = `${idx + 1} / ${deck.length}`;

    const p = progress[card.id] || { seen: 0, correct: 0, wrong: 0 };
    el.metaLine.textContent = `Seen ${p.seen || 0} • ✅ ${p.correct || 0} • ❌ ${
      p.wrong || 0
    }`;

    el.question.textContent = safeText(card.question);

    // Reset reveal
    el.answerBox.classList.add("hidden");
    el.btnReveal.textContent = "Reveal Answer";

    renderChoices(card);
    renderAnswer(card);
    setInputsDisabled(false);

    el.btnSubmit.textContent = "Submit";

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

  // Submit (or Next if already submitted)
  el.btnSubmit.addEventListener("click", () => {
    const card = current();
    if (!card) return;

    if (!submitted) {
      grade(card);
    } else {
      next();
    }
  });

  // Nav buttons
  el.btnNext.addEventListener("click", next);
  el.btnPrev.addEventListener("click", prev);

  // Shuffle toggle
  el.btnShuffle.addEventListener("click", () => {
    shuffled = !shuffled;
    deck = shuffled ? shuffleArray(deck) : deck.slice().sort((a, b) => a.id - b.id);
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

    el.card.addEventListener(
      "touchstart",
      (e) => {
        if (!e.touches || e.touches.length !== 1) return;
        tracking = true;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      },
      { passive: true }
    );

    el.card.addEventListener(
      "touchend",
      (e) => {
        if (!tracking) return;
        tracking = false;
        const touch = e.changedTouches && e.changedTouches[0];
        if (!touch) return;

        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;

        if (Math.abs(dy) > Math.abs(dx)) return;

        // only allow swipe nav if not mid-attempt
        if (submitted) return;

        if (dx < -60) next();
        if (dx > 60) prev();
      },
      { passive: true }
    );
  })();

  // Init: start with shuffled deck + button state
  deck = shuffleArray(deck);
  el.btnShuffle.textContent = "🔀✓";

  computeStats();
  applyMode();
})();
