(() => {
  "use strict";

  const BANK = Array.isArray(window.KELIMELAB_EXPERT_WORDS)
    ? window.KELIMELAB_EXPERT_WORDS
    : [];

  const QUESTION_COUNT = Math.min(10, BANK.length);
  const STORAGE_PREFIX = "kelimelab-v28-expert-quiz";
  if (BANK.length < 10) return;

  const el = {
    date: document.getElementById("quizDate"),
    played: document.getElementById("quizPlayed"),
    best: document.getElementById("quizBest"),
    streak: document.getElementById("quizStreak"),
    maxStreak: document.getElementById("quizMaxStreak"),
    number: document.getElementById("quizQuestionNumber"),
    liveScore: document.getElementById("quizLiveScore"),
    progress: document.getElementById("quizProgressFill"),
    qType: document.getElementById("quizQuestionType"),
    prompt: document.getElementById("quizPrompt"),
    meaning: document.getElementById("quizMeaning"),
    letterCount: document.getElementById("quizLetterCount"),
    pattern: document.getElementById("quizPattern"),
    form: document.getElementById("quizAnswerForm"),
    input: document.getElementById("quizAnswerInput"),
    hint: document.getElementById("quizHintButton"),
    skip: document.getElementById("quizSkipButton"),
    feedback: document.getElementById("quizFeedback"),
    feedbackLabel: document.getElementById("quizFeedbackLabel"),
    feedbackWord: document.getElementById("quizFeedbackWord"),
    feedbackExample: document.getElementById("quizFeedbackExample"),
    feedbackNote: document.getElementById("quizFeedbackNote"),
    next: document.getElementById("quizNextButton"),
    countdown: document.getElementById("quizCountdown"),
    dialog: document.getElementById("quizResultDialog"),
    close: document.getElementById("quizResultClose"),
    dismiss: document.getElementById("quizResultDismiss"),
    resultIcon: document.getElementById("quizResultIcon"),
    finalScore: document.getElementById("quizFinalScore"),
    resultMessage: document.getElementById("quizResultMessage"),
    share: document.getElementById("quizShareButton")
  };

  function trLower(value) {
    return value
      .toLocaleLowerCase("tr-TR")
      .normalize("NFC")
      .replace(/[^abcçdefgğhıijklmnoöprsştuüvyz]/g, "");
  }

  function getDateKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);
    const v = {};
    parts.forEach((p) => { if (p.type !== "literal") v[p.type] = p.value; });
    return `${v.year}-${v.month}-${v.day}`;
  }

  function parseDateKey(key) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  }

  function shiftDateKey(key, days) {
    const d = parseDateKey(key);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function dateIndex(key) {
    return Math.floor(parseDateKey(key).getTime() / 86400000);
  }

  function formatDate(key) {
    return new Intl.DateTimeFormat("tr-TR", {
      timeZone: "UTC",
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(parseDateKey(key));
  }

  function seededShuffle(items, seed) {
    const result = [...items];
    let value = Math.abs(seed) + 1;
    function random() {
      value = (value * 1664525 + 1013904223) % 4294967296;
      return value / 4294967296;
    }
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function safeLoad(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function safeSave(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  const dateKey = getDateKey();
  const seed = dateIndex(dateKey) + 2808;
  const questions = seededShuffle(BANK, seed).slice(0, QUESTION_COUNT);
  const stateKey = `${STORAGE_PREFIX}-${dateKey}`;
  const statsKey = `${STORAGE_PREFIX}-stats`;

  const state = safeLoad(stateKey, {
    answers: [],
    review: null,
    hints: {},
    completed: false,
    modalShown: false
  });

  function score() {
    return state.answers.reduce((total, item) => total + item.points, 0);
  }

  function maxScore() {
    return QUESTION_COUNT * 2;
  }

  function questionType(index) {
    return ["definition", "example", "distinction"][(seed + index * 11) % 3];
  }

  function blankExample(example, word) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return example.replace(new RegExp(escaped, "giu"), "_____");
  }

  function revealedPattern(word, hintCount) {
    const chars = [...word];
    const revealed = new Set();
    if (hintCount >= 1) revealed.add(0);
    if (hintCount >= 2) revealed.add(chars.length - 1);
    if (hintCount >= 3) revealed.add(Math.floor(chars.length / 2));
    return chars.map((c, i) => revealed.has(i) ? c.toLocaleUpperCase("tr-TR") : "_").join(" ");
  }

  function save() { safeSave(stateKey, state); }

  function renderStats() {
    const stats = safeLoad(statsKey, {
      played: 0, best: 0, currentStreak: 0, maxStreak: 0
    });
    el.played.textContent = String(stats.played);
    el.best.textContent = `${stats.best}/${maxScore()}`;
    el.streak.textContent = String(stats.currentStreak);
    el.maxStreak.textContent = String(stats.maxStreak);
  }

  function updateStatsOnce() {
    const stats = safeLoad(statsKey, {
      played: 0, best: 0, currentStreak: 0, maxStreak: 0, lastCompletedDate: null
    });
    if (stats.lastCompletedDate === dateKey) return;
    stats.played += 1;
    stats.best = Math.max(stats.best, score());
    stats.currentStreak =
      stats.lastCompletedDate === shiftDateKey(dateKey, -1)
        ? stats.currentStreak + 1
        : 1;
    stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
    stats.lastCompletedDate = dateKey;
    safeSave(statsKey, stats);
  }

  function renderQuestion() {
    const index = state.answers.length;
    const q = questions[index];
    const type = questionType(index);
    const hintCount = state.hints[index] || 0;

    el.feedback.hidden = true;
    el.form.hidden = false;
    el.hint.hidden = false;
    el.skip.hidden = false;
    el.input.disabled = false;
    el.input.value = "";

    el.number.textContent = `Soru ${index + 1}/${QUESTION_COUNT}`;
    el.liveScore.textContent = `Puan ${score()}/${maxScore()}`;
    el.progress.style.width = `${(index / QUESTION_COUNT) * 100}%`;
    el.letterCount.textContent = `${[...q.word].length} harf`;
    el.pattern.textContent = revealedPattern(q.word, hintCount);

    if (type === "definition") {
      el.qType.textContent = "TANIMDAN KELİME";
      el.prompt.textContent = "Bu tanıma uyan ileri düzey kelimeyi yaz.";
      el.meaning.textContent = q.meaning;
    } else if (type === "example") {
      el.qType.textContent = "CÜMLEDE KULLANIM";
      el.prompt.textContent = "Boşluğa gelmesi gereken kelimeyi yaz.";
      el.meaning.textContent = blankExample(q.example, q.word);
    } else {
      el.qType.textContent = "İNCE ANLAM AYRIMI";
      el.prompt.textContent = "Açıklamaya en doğru karşılık gelen kelimeyi yaz.";
      el.meaning.textContent = `${q.meaning} İpucu: ${q.note}`;
    }

    el.hint.disabled = hintCount >= 3;
    el.hint.textContent = hintCount >= 3
      ? "Bütün harf ipuçları kullanıldı"
      : "Harf ipucu al (puan düşer)";

    setTimeout(() => el.input.focus(), 0);
  }

  function submitAnswer(event) {
    event.preventDefault();
    if (state.review || state.completed) return;

    const index = state.answers.length;
    const q = questions[index];
    const answer = trLower(el.input.value);

    if (!answer) {
      el.input.classList.add("input-error");
      setTimeout(() => el.input.classList.remove("input-error"), 350);
      return;
    }

    const correct = answer === trLower(q.word);
    const hintCount = state.hints[index] || 0;
    const points = correct ? Math.max(1, 2 - hintCount) : 0;

    state.answers.push({
      selected: answer,
      target: q.word,
      correct,
      points,
      hintCount
    });
    state.review = { index, selected: answer, correct, points };
    save();
    renderReview();
  }

  function renderReview() {
    const r = state.review;
    const q = questions[r.index];

    el.form.hidden = true;
    el.hint.hidden = true;
    el.skip.hidden = true;
    el.feedback.hidden = false;
    el.feedback.classList.toggle("wrong", !r.correct);

    el.feedbackLabel.textContent = r.correct
      ? `DOĞRU • +${r.points} PUAN`
      : "DOĞRU CEVAP";
    el.feedbackWord.textContent = q.word.toLocaleUpperCase("tr-TR");
    el.feedbackExample.textContent = q.example;
    el.feedbackNote.textContent = r.correct
      ? q.note
      : `Senin cevabın: ${r.selected.toLocaleUpperCase("tr-TR") || "BOŞ"}. ${q.meaning}`;

    el.number.textContent = `Soru ${r.index + 1}/${QUESTION_COUNT}`;
    el.liveScore.textContent = `Puan ${score()}/${maxScore()}`;
    el.progress.style.width = `${((r.index + 1) / QUESTION_COUNT) * 100}%`;
    el.next.textContent = state.answers.length >= QUESTION_COUNT ? "Sonucu gör" : "Sonraki soru";
  }

  function takeHint() {
    if (state.review || state.completed) return;
    const index = state.answers.length;
    state.hints[index] = Math.min(3, (state.hints[index] || 0) + 1);
    save();
    renderQuestion();
  }

  function skipQuestion() {
    if (state.review || state.completed) return;
    const index = state.answers.length;
    const q = questions[index];
    state.answers.push({
      selected: "",
      target: q.word,
      correct: false,
      points: 0,
      hintCount: state.hints[index] || 0
    });
    state.review = { index, selected: "", correct: false, points: 0 };
    save();
    renderReview();
  }

  function nextQuestion() {
    if (!state.review) return;
    state.review = null;
    if (state.answers.length >= QUESTION_COUNT) {
      state.completed = true;
      updateStatsOnce();
      renderStats();
      save();
      showResult();
    } else {
      save();
      renderQuestion();
    }
  }

  function showResult() {
    state.completed = true;
    el.form.hidden = true;
    el.hint.hidden = true;
    el.skip.hidden = true;
    el.feedback.hidden = true;
    el.number.textContent = "Test tamamlandı";
    el.liveScore.textContent = `Puan ${score()}/${maxScore()}`;
    el.progress.style.width = "100%";

    const s = score();
    el.finalScore.textContent = `${s}/${maxScore()}`;
    el.resultIcon.textContent = s >= 15 ? "✓" : "↻";
    el.resultIcon.classList.toggle("lost", s < 10);

    if (s === maxScore()) {
      el.resultMessage.textContent = "İpucusuz kusursuz sonuç. Bu gerçekten uzman seviyesi.";
    } else if (s >= 16) {
      el.resultMessage.textContent = "Çok güçlü sonuç. İleri kelimelerde hâkimiyetin yüksek.";
    } else if (s >= 12) {
      el.resultMessage.textContent = "İyi sonuç. Birkaç kelimeyi arşivden tekrar et.";
    } else {
      el.resultMessage.textContent = "Bu test kolay değil. Yanlış kelimeleri örnekleriyle tekrar et.";
    }

    if (typeof el.dialog.showModal === "function" && !el.dialog.open) {
      el.dialog.showModal();
    } else {
      el.dialog.setAttribute("open", "");
    }
    state.modalShown = true;
    save();
  }

  function closeDialog() {
    if (typeof el.dialog.close === "function" && el.dialog.open) {
      el.dialog.close();
    } else {
      el.dialog.removeAttribute("open");
    }
  }

  async function shareResult() {
    const text =
      `KelimeLab Uzman Seviye Kelime Testi — ${formatDate(dateKey)}\n` +
      `${score()}/${maxScore()} puan\n` +
      `${location.origin}/kelime-testi.html`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "KelimeLab Uzman Seviye Kelime Testi", text });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        el.resultMessage.textContent = "Sonuç panoya kopyalandı.";
      }
    } catch (error) {
      if (error && error.name !== "AbortError") {
        el.resultMessage.textContent = "Paylaşım açılamadı.";
      }
    }
  }

  function startCountdown() {
    function update() {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Istanbul",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false, hourCycle: "h23"
      }).formatToParts(new Date());
      const v = {};
      parts.forEach((p) => { if (p.type !== "literal") v[p.type] = Number(p.value); });
      let remaining = 86400 - (v.hour * 3600 + v.minute * 60 + v.second);
      if (remaining < 0) remaining = 0;
      const h = String(Math.floor(remaining / 3600)).padStart(2, "0");
      const m = String(Math.floor((remaining % 3600) / 60)).padStart(2, "0");
      const s = String(remaining % 60).padStart(2, "0");
      el.countdown.textContent = `${h}:${m}:${s}`;
    }
    update();
    setInterval(update, 1000);
  }

  el.date.textContent = `${formatDate(dateKey)} uzman testi`;
  el.form.addEventListener("submit", submitAnswer);
  el.hint.addEventListener("click", takeHint);
  el.skip.addEventListener("click", skipQuestion);
  el.next.addEventListener("click", nextQuestion);
  el.close.addEventListener("click", closeDialog);
  el.dismiss.addEventListener("click", closeDialog);
  el.share.addEventListener("click", shareResult);
  el.dialog.addEventListener("click", (event) => {
    if (event.target === el.dialog) closeDialog();
  });

  renderStats();
  startCountdown();

  if (state.completed || state.answers.length >= QUESTION_COUNT) {
    state.completed = true;
    updateStatsOnce();
    renderStats();
    showResult();
  } else if (state.review) {
    renderReview();
  } else {
    renderQuestion();
  }
})();