(() => {
  "use strict";

  const page = document.body.dataset.puzzlePage;
  if (!page) return;

  const DATA = window.KELIMELAB_PUZZLE_DATA || {};
  const WORDS = Array.isArray(window.KELIME_LISTESI) ? window.KELIME_LISTESI : [];
  const WORD_SET = new Set(WORDS);
  const MAX_WORD_ATTEMPTS = 6;
  const MAX_ANAGRAM_ATTEMPTS = 5;
  const STORAGE_PREFIX = "kelimelab-v2";

  const KEYBOARD_ROWS = [
    ["E","R","T","Y","U","I","O","P","Ğ","Ü"],
    ["A","S","D","F","G","H","J","K","L","Ş","İ"],
    ["ENTER","Z","C","V","B","N","M","Ö","Ç","BACKSPACE"]
  ];

  function trLower(value) {
    return value.toLocaleLowerCase("tr-TR").replace(/[^abcçdefgğhıijklmnoöprsştuüvyz]/g, "");
  }

  function trUpper(value) {
    return value.toLocaleUpperCase("tr-TR");
  }

  function getIstanbulDateKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);

    const values = {};
    for (const part of parts) {
      if (part.type !== "literal") values[part.type] = part.value;
    }
    return `${values.year}-${values.month}-${values.day}`;
  }

  function parseDateKey(key) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
    if (!match) return null;

    const parsed = new Date(Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      12
    ));

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function dateKeyFromDate(date) {
    return date.toISOString().slice(0, 10);
  }

  function shiftDateKey(key, days) {
    const parsed = parseDateKey(key);
    if (!parsed) return key;
    parsed.setUTCDate(parsed.getUTCDate() + days);
    return dateKeyFromDate(parsed);
  }

  function dateIndex(key) {
    const parsed = parseDateKey(key);
    if (!parsed) return 0;
    return Math.floor(parsed.getTime() / 86400000);
  }

  function formatDateKey(key, long = true) {
    const parsed = parseDateKey(key);
    if (!parsed) return key;
    return new Intl.DateTimeFormat("tr-TR", {
      timeZone: "UTC",
      day: "numeric",
      month: long ? "long" : "short",
      year: "numeric"
    }).format(parsed);
  }

  function getSelectedDateKey() {
    const today = getIstanbulDateKey();
    const requested = new URLSearchParams(location.search).get("date");

    if (!requested || !parseDateKey(requested) || requested > today) {
      return today;
    }
    return requested;
  }

  function isToday(key) {
    return key === getIstanbulDateKey();
  }

  function safeLoad(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function safeSave(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Depolama kapalıysa oyun çalışmaya devam eder.
    }
  }

  function getEntry(dateKey, offset = 0) {
    const list = DATA.wordEntries || [];
    if (list.length === 0) return null;
    const index = Math.abs(dateIndex(dateKey) + offset) % list.length;
    return list[index];
  }

  function getCirclePuzzle(dateKey) {
    const list = DATA.circlePuzzles || [];
    if (list.length === 0) return null;
    const index = Math.abs(dateIndex(dateKey) + 17) % list.length;
    return list[index];
  }

  function countLetters(value) {
    const counts = new Map();
    for (const character of value) {
      counts.set(character, (counts.get(character) || 0) + 1);
    }
    return counts;
  }

  function sameLetters(first, second) {
    if (first.length !== second.length) return false;
    const a = countLetters(first);
    const b = countLetters(second);
    if (a.size !== b.size) return false;

    for (const [character, count] of a.entries()) {
      if (b.get(character) !== count) return false;
    }
    return true;
  }

  function seededShuffle(items, seed) {
    const result = [...items];
    let value = Math.abs(seed) + 1;

    function random() {
      value = (value * 1664525 + 1013904223) % 4294967296;
      return value / 4294967296;
    }

    for (let index = result.length - 1; index > 0; index -= 1) {
      const target = Math.floor(random() * (index + 1));
      [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
  }

  function setCommonDateUI(dateKey) {
    document.querySelectorAll("[data-puzzle-date]").forEach((element) => {
      element.textContent = formatDateKey(dateKey);
    });

    document.querySelectorAll("[data-archive-badge]").forEach((element) => {
      element.hidden = isToday(dateKey);
    });
  }

  function startCountdown() {
    const elements = document.querySelectorAll("[data-countdown]");
    if (elements.length === 0) return;

    function update() {
      const now = new Date();
      const istanbulParts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Istanbul",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        hourCycle: "h23"
      }).formatToParts(now);

      const values = {};
      for (const part of istanbulParts) {
        if (part.type !== "literal") values[part.type] = Number(part.value);
      }

      const elapsed =
        values.hour * 3600 +
        values.minute * 60 +
        values.second;

      let remaining = 86400 - elapsed;
      if (remaining < 0) remaining = 0;

      const hours = String(Math.floor(remaining / 3600)).padStart(2, "0");
      const minutes = String(Math.floor((remaining % 3600) / 60)).padStart(2, "0");
      const seconds = String(remaining % 60).padStart(2, "0");
      const text = `${hours}:${minutes}:${seconds}`;

      elements.forEach((element) => {
        element.textContent = text;
      });
    }

    update();
    setInterval(update, 1000);
  }

  function updateDailyStats(type, dateKey, won) {
    if (!isToday(dateKey)) return;

    const key = `${STORAGE_PREFIX}-${type}-stats`;
    const stats = safeLoad(key, {
      played: 0,
      won: 0,
      currentStreak: 0,
      maxStreak: 0,
      lastPlayedDate: null,
      lastWinDate: null
    });

    if (stats.lastPlayedDate === dateKey) return;

    stats.played += 1;
    stats.lastPlayedDate = dateKey;

    if (won) {
      stats.won += 1;
      const yesterday = shiftDateKey(dateKey, -1);

      if (stats.lastWinDate === yesterday) {
        stats.currentStreak += 1;
      } else if (stats.lastWinDate !== dateKey) {
        stats.currentStreak = 1;
      }

      stats.lastWinDate = dateKey;
      stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
    } else {
      stats.currentStreak = 0;
    }

    safeSave(key, stats);
  }

  function renderStats(type, prefix) {
    const stats = safeLoad(`${STORAGE_PREFIX}-${type}-stats`, {
      played: 0,
      won: 0,
      currentStreak: 0,
      maxStreak: 0
    });

    const played = document.getElementById(`${prefix}Played`);
    const winRate = document.getElementById(`${prefix}WinRate`);
    const streak = document.getElementById(`${prefix}Streak`);
    const maxStreak = document.getElementById(`${prefix}MaxStreak`);

    if (played) played.textContent = stats.played;
    if (winRate) {
      winRate.textContent = stats.played
        ? `${Math.round((stats.won / stats.played) * 100)}%`
        : "0%";
    }
    if (streak) streak.textContent = stats.currentStreak;
    if (maxStreak) maxStreak.textContent = stats.maxStreak;
  }

  async function shareText(title, text, messageElement) {
    try {
      if (navigator.share) {
        await navigator.share({ title, text });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        if (messageElement) {
          messageElement.textContent = "Sonuç panoya kopyalandı.";
        }
      }
    } catch (error) {
      if (error && error.name !== "AbortError" && messageElement) {
        messageElement.textContent = "Paylaşım açılamadı.";
      }
    }
  }

  function showWordInfo(prefix, entry) {
    const card = document.getElementById(`${prefix}InfoCard`);
    if (!card || !entry) return;

    document.getElementById(`${prefix}InfoTitle`).textContent = trUpper(entry.word);
    document.getElementById(`${prefix}InfoCategory`).textContent = entry.category;
    document.getElementById(`${prefix}InfoMeaning`).textContent = entry.meaning;
    document.getElementById(`${prefix}InfoExample`).textContent = entry.example;
    document.getElementById(`${prefix}InfoNote`).textContent = entry.note;
    card.hidden = false;
  }

  function evaluateGuess(guess, answer) {
    const result = Array(answer.length).fill("absent");
    const remaining = answer.split("");

    for (let index = 0; index < answer.length; index += 1) {
      if (guess[index] === answer[index]) {
        result[index] = "correct";
        remaining[index] = null;
      }
    }

    for (let index = 0; index < answer.length; index += 1) {
      if (result[index] === "correct") continue;
      const found = remaining.indexOf(guess[index]);
      if (found !== -1) {
        result[index] = "present";
        remaining[found] = null;
      }
    }

    return result;
  }

  function initWordGame(dateKey) {
    const entry = getEntry(dateKey, 0);
    if (!entry) return;

    const answer = entry.word;
    const stateKey = `${STORAGE_PREFIX}-word-${dateKey}`;
    const state = safeLoad(stateKey, {
      guesses: [],
      current: "",
      status: "playing"
    });

    const grid = document.getElementById("wordGrid");
    const keyboard = document.getElementById("wordKeyboard");
    const message = document.getElementById("wordMessage");
    const shareButton = document.getElementById("wordShareButton");
    const helpButton = document.getElementById("wordHelpButton");
    const helpDialog = document.getElementById("wordHelpDialog");
    const keyboardStates = {};

    function save() {
      safeSave(stateKey, state);
    }

    function buildGrid() {
      grid.innerHTML = "";
      for (let row = 0; row < MAX_WORD_ATTEMPTS; row += 1) {
        const rowElement = document.createElement("div");
        rowElement.className = "word-row";
        rowElement.dataset.row = row;

        for (let column = 0; column < answer.length; column += 1) {
          const tile = document.createElement("div");
          tile.className = "word-tile";
          tile.dataset.column = column;
          tile.setAttribute("aria-label", `Satır ${row + 1}, sütun ${column + 1}`);
          rowElement.appendChild(tile);
        }

        grid.appendChild(rowElement);
      }
    }

    function buildKeyboard() {
      keyboard.innerHTML = "";
      for (const row of KEYBOARD_ROWS) {
        const rowElement = document.createElement("div");
        rowElement.className = "keyboard-row";

        for (const key of row) {
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.key = key;
          button.className = "keyboard-key";

          if (key === "ENTER") {
            button.textContent = "GİR";
            button.classList.add("wide");
          } else if (key === "BACKSPACE") {
            button.textContent = "⌫";
            button.classList.add("wide");
            button.setAttribute("aria-label", "Sil");
          } else {
            button.textContent = key;
          }

          button.addEventListener("click", () => handleKey(key));
          rowElement.appendChild(button);
        }

        keyboard.appendChild(rowElement);
      }
    }

    function render() {
      for (let row = 0; row < MAX_WORD_ATTEMPTS; row += 1) {
        const rowElement = grid.children[row];
        const completedGuess = state.guesses[row];

        for (let column = 0; column < answer.length; column += 1) {
          const tile = rowElement.children[column];
          tile.className = "word-tile";
          tile.textContent = "";

          if (completedGuess) {
            tile.textContent = trUpper(completedGuess.word[column]);
            tile.classList.add(completedGuess.result[column]);
            const previous = keyboardStates[completedGuess.word[column]];
            const next = completedGuess.result[column];
            const priority = { absent: 1, present: 2, correct: 3 };
            if (!previous || priority[next] > priority[previous]) {
              keyboardStates[completedGuess.word[column]] = next;
            }
          } else if (row === state.guesses.length && state.status === "playing") {
            const character = state.current[column];
            if (character) {
              tile.textContent = trUpper(character);
              tile.classList.add("filled");
            }
          }
        }
      }

      keyboard.querySelectorAll("[data-key]").forEach((button) => {
        button.classList.remove("correct", "present", "absent");
        const key = trLower(button.dataset.key);
        if (keyboardStates[key]) {
          button.classList.add(keyboardStates[key]);
        }
      });

      if (state.status === "won") {
        message.textContent = `Tebrikler! ${trUpper(answer)} kelimesini ${state.guesses.length} tahminde buldun.`;
        message.className = "game-message success";
        shareButton.hidden = false;
        showWordInfo("word", entry);
      } else if (state.status === "lost") {
        message.textContent = `Bugünün kelimesi ${trUpper(answer)} idi.`;
        message.className = "game-message error";
        shareButton.hidden = false;
        showWordInfo("word", entry);
      } else {
        message.className = "game-message";
      }

      save();
    }

    function shakeCurrentRow() {
      const row = grid.children[state.guesses.length];
      if (!row) return;
      row.classList.remove("shake");
      void row.offsetWidth;
      row.classList.add("shake");
    }

    function submitGuess() {
      if (state.status !== "playing") return;

      if (state.current.length !== answer.length) {
        message.textContent = "Beş harf yazmalısın.";
        shakeCurrentRow();
        return;
      }

      if (!WORD_SET.has(state.current)) {
        message.textContent = "Bu kelime geliştirme sözlüğünde bulunmuyor.";
        shakeCurrentRow();
        return;
      }

      const result = evaluateGuess(state.current, answer);
      const won = state.current === answer;
      state.guesses.push({ word: state.current, result });
      state.current = "";

      if (won) {
        state.status = "won";
        updateDailyStats("word", dateKey, true);
        renderStats("word", "word");
      } else if (state.guesses.length >= MAX_WORD_ATTEMPTS) {
        state.status = "lost";
        updateDailyStats("word", dateKey, false);
        renderStats("word", "word");
      } else {
        message.textContent = `${MAX_WORD_ATTEMPTS - state.guesses.length} tahmin hakkın kaldı.`;
        message.className = "game-message";
      }

      render();
    }

    function handleKey(rawKey) {
      if (state.status !== "playing") return;

      if (rawKey === "ENTER") {
        submitGuess();
        return;
      }

      if (rawKey === "BACKSPACE") {
        state.current = state.current.slice(0, -1);
        render();
        return;
      }

      const character = trLower(rawKey);
      if (character.length === 1 && state.current.length < answer.length) {
        state.current += character;
        render();
      }
    }

    document.addEventListener("keydown", (event) => {
      if (helpDialog && helpDialog.open) return;

      if (event.key === "Enter") {
        event.preventDefault();
        handleKey("ENTER");
      } else if (event.key === "Backspace") {
        event.preventDefault();
        handleKey("BACKSPACE");
      } else {
        const character = trLower(event.key);
        if (character.length === 1) handleKey(character);
      }
    });

    shareButton.addEventListener("click", () => {
      const rows = state.guesses.map((guess) =>
        guess.result.map((value) =>
          value === "correct" ? "🟩" :
          value === "present" ? "🟨" : "⬛"
        ).join("")
      ).join("\n");

      const score = state.status === "won"
        ? `${state.guesses.length}/${MAX_WORD_ATTEMPTS}`
        : `X/${MAX_WORD_ATTEMPTS}`;

      const text =
        `KelimeLab Günün Kelimesi — ${formatDateKey(dateKey, false)}\n` +
        `${score}\n${rows}\n${location.origin}/gunun-kelimesi.html`;

      shareText("KelimeLab Günün Kelimesi", text, message);
    });

    helpButton.addEventListener("click", () => {
      if (helpDialog && typeof helpDialog.showModal === "function") {
        helpDialog.showModal();
      }
    });

    if (helpDialog) {
      helpDialog.querySelector("[data-close-dialog]").addEventListener("click", () => {
        helpDialog.close();
      });
    }

    buildGrid();
    buildKeyboard();
    renderStats("word", "word");
    render();

    if (state.status !== "playing") {
      showWordInfo("word", entry);
    }
  }

  function initAnagram(dateKey) {
    const entry = getEntry(dateKey, 23);
    if (!entry) return;

    const target = entry.word;
    const stateKey = `${STORAGE_PREFIX}-anagram-${dateKey}`;
    const state = safeLoad(stateKey, {
      guesses: [],
      hints: 0,
      status: "playing",
      shuffleCount: 0,
      completionModalShown: false
    });

    const tiles = document.getElementById("anagramTiles");
    const category = document.getElementById("anagramCategory");
    const hintText = document.getElementById("anagramHintText");
    const form = document.getElementById("anagramForm");
    const input = document.getElementById("anagramInput");
    const message = document.getElementById("anagramMessage");
    const attempts = document.getElementById("anagramAttempts");
    const hintButton = document.getElementById("anagramHintButton");
    const shuffleButton = document.getElementById("anagramShuffleButton");
    const shareButton = document.getElementById("anagramShareButton");
    const completionCard = document.getElementById("anagramCompletionCard");
    const completionDialog = document.getElementById("anagramCompletionDialog");
    const completionClose = document.getElementById("anagramCompletionClose");
    const completionDismiss = document.getElementById("anagramCompletionDismiss");
    const modalShareButton = document.getElementById("anagramModalShareButton");
    const completionIcon = document.getElementById("anagramCompletionIcon");
    const completionEyebrow = document.getElementById("anagramCompletionEyebrow");
    const completionTitle = document.getElementById("anagramCompletionTitle");
    const completionText = document.getElementById("anagramCompletionText");
    const completionAttempts = document.getElementById("anagramCompletionAttempts");
    const completionHints = document.getElementById("anagramCompletionHints");

    function save() {
      safeSave(stateKey, state);
    }

    function shuffledLetters() {
      let result = seededShuffle(
        target.split(""),
        dateIndex(dateKey) + state.shuffleCount * 97 + 11
      );

      if (result.join("") === target) {
        result = [...result.slice(1), result[0]];
      }
      return result;
    }

    function renderTiles() {
      tiles.innerHTML = "";
      for (const character of shuffledLetters()) {
        const tile = document.createElement("span");
        tile.textContent = trUpper(character);
        tiles.appendChild(tile);
      }
    }

    function renderHints() {
      category.textContent = entry.category;

      if (state.hints === 0) {
        hintText.textContent = "İlk ipucu: Kelimenin kategorisi yukarıda.";
      } else if (state.hints === 1) {
        hintText.textContent = `Kelime ${trUpper(target[0])} harfiyle başlıyor.`;
      } else {
        hintText.textContent = entry.meaning;
      }

      hintButton.disabled = state.hints >= 2 || state.status !== "playing";
      hintButton.textContent = state.hints >= 2 ? "Bütün ipuçları açık" : "İpucu al";
    }

    function renderAttempts() {
      attempts.innerHTML = "";
      for (let index = 0; index < MAX_ANAGRAM_ATTEMPTS; index += 1) {
        const dot = document.createElement("span");
        if (index < state.guesses.length) dot.classList.add("used");
        attempts.appendChild(dot);
      }
    }

    function getShareText() {
      const score = state.status === "won"
        ? `${state.guesses.length}/${MAX_ANAGRAM_ATTEMPTS}`
        : `X/${MAX_ANAGRAM_ATTEMPTS}`;
      const hintMarks = "💡".repeat(state.hints);

      return (
        `KelimeLab Günlük Anagram — ${formatDateKey(dateKey, false)}\n` +
        `${score} ${hintMarks}\n` +
        `${location.origin}/gunluk-anagram.html`
      );
    }

    function shareAnagramResult() {
      shareText(
        "KelimeLab Günlük Anagram",
        getShareText(),
        message
      );
    }

    function openCompletionDialog() {
      if (!completionDialog || completionDialog.open) return;

      const won = state.status === "won";

      completionIcon.textContent = won ? "✓" : "!";
      completionIcon.classList.toggle("lost", !won);
      completionEyebrow.textContent = won
        ? "BUGÜNKÜ BULMACA TAMAMLANDI"
        : "BUGÜNKÜ BULMACA SONA ERDİ";
      completionTitle.textContent = won ? "Tebrikler!" : "Bugünkü cevap";
      completionText.textContent = won
        ? `${trUpper(target)} kelimesini ${state.guesses.length} denemede buldun.`
        : `Doğru cevap ${trUpper(target)} idi. Yarın yeni bir anagram seni bekliyor.`;
      completionAttempts.textContent = won
        ? `${state.guesses.length}/${MAX_ANAGRAM_ATTEMPTS}`
        : `X/${MAX_ANAGRAM_ATTEMPTS}`;
      completionHints.textContent = String(state.hints);

      if (typeof completionDialog.showModal === "function") {
        completionDialog.showModal();
      } else {
        completionDialog.setAttribute("open", "");
      }

      state.completionModalShown = true;
      save();
    }

    function closeCompletionDialog() {
      if (!completionDialog) return;

      if (typeof completionDialog.close === "function" && completionDialog.open) {
        completionDialog.close();
      } else {
        completionDialog.removeAttribute("open");
      }
    }

    function lockCompletedUI() {
      shareButton.hidden = false;
      if (completionCard) completionCard.hidden = false;
      input.disabled = true;
      form.querySelector("button[type=submit]").disabled = true;
      hintButton.disabled = true;
      showWordInfo("anagram", entry);

      const other = WORDS
        .filter((word) => word !== target && sameLetters(word, target))
        .sort((a, b) => a.localeCompare(b, "tr-TR"));

      if (other.length > 0) {
        const area = document.getElementById("otherAnagrams");
        area.hidden = false;
        area.innerHTML =
          `<strong>Aynı harflerle başka kelimeler:</strong> ` +
          other.map((word) => `<span>${trUpper(word)}</span>`).join("");
      }
    }

    function finish(won) {
      state.status = won ? "won" : "lost";
      updateDailyStats("anagram", dateKey, won);
      renderStats("anagram", "anagram");
      lockCompletedUI();
      openCompletionDialog();
    }

    function render() {
      renderTiles();
      renderHints();
      renderAttempts();
      renderStats("anagram", "anagram");

      if (state.status === "won") {
        message.textContent =
          `Tebrikler! Hedef kelime ${trUpper(target)}. ` +
          "Bugünün anagramı tamamlandı.";
        message.className = "game-message success";
        lockCompletedUI();
        if (!state.completionModalShown) openCompletionDialog();
      } else if (state.status === "lost") {
        message.textContent = `Bugünün cevabı ${trUpper(target)} idi.`;
        message.className = "game-message error";
        lockCompletedUI();
        if (!state.completionModalShown) openCompletionDialog();
      }

      save();
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (state.status !== "playing") return;

      const guess = trLower(input.value);
      input.value = "";

      if (guess.length !== target.length) {
        message.textContent = `${target.length} harfli bir kelime yazmalısın.`;
        message.className = "game-message error";
        return;
      }

      if (!sameLetters(guess, target)) {
        message.textContent = "Tahmin, ekrandaki harflerin tamamını doğru sayıda kullanmalı.";
        message.className = "game-message error";
        return;
      }

      if (!WORD_SET.has(guess)) {
        message.textContent = "Bu tahmin geliştirme sözlüğünde bulunmuyor.";
        message.className = "game-message error";
        return;
      }

      state.guesses.push(guess);

      if (guess === target) {
        state.status = "won";
        updateDailyStats("anagram", dateKey, true);
        message.textContent =
          `Tebrikler! ${trUpper(target)} kelimesini buldun. ` +
          "Bugünün tek hedef anagramını tamamladın.";
        message.className = "game-message success";
        finish(true);
      } else if (state.guesses.length >= MAX_ANAGRAM_ATTEMPTS) {
        state.status = "lost";
        updateDailyStats("anagram", dateKey, false);
        message.textContent = `Denemelerin bitti. Cevap ${trUpper(target)} idi.`;
        message.className = "game-message error";
        finish(false);
      } else {
        message.textContent =
          `Geçerli bir anagram, fakat ipucundaki hedef değil. ` +
          `${MAX_ANAGRAM_ATTEMPTS - state.guesses.length} hakkın kaldı.`;
        message.className = "game-message";
      }

      renderAttempts();
      save();
    });

    hintButton.addEventListener("click", () => {
      if (state.status !== "playing" || state.hints >= 2) return;
      state.hints += 1;
      renderHints();
      save();
    });

    shuffleButton.addEventListener("click", () => {
      state.shuffleCount += 1;
      renderTiles();
      save();
    });

    shareButton.addEventListener("click", shareAnagramResult);
    if (modalShareButton) {
      modalShareButton.addEventListener("click", shareAnagramResult);
    }

    if (completionClose) {
      completionClose.addEventListener("click", closeCompletionDialog);
    }

    if (completionDismiss) {
      completionDismiss.addEventListener("click", closeCompletionDialog);
    }

    if (completionDialog) {
      completionDialog.addEventListener("click", (event) => {
        if (event.target === completionDialog) {
          closeCompletionDialog();
        }
      });
    }

    render();
  }

  function initCircle(dateKey) {
    const puzzle = getCirclePuzzle(dateKey);
    if (!puzzle) return;

    const allowed = [...puzzle.letters];
    const allowedSet = new Set(allowed);
    const center = puzzle.center;
    const answers = WORDS
      .filter((word) =>
        word.length >= 4 &&
        word.includes(center) &&
        [...word].every((character) => allowedSet.has(character))
      )
      .sort((a, b) => b.length - a.length || a.localeCompare(b, "tr-TR"));
    const answerSet = new Set(answers);

    const stateKey = `${STORAGE_PREFIX}-circle-${dateKey}`;
    const state = safeLoad(stateKey, {
      current: "",
      found: [],
      revealed: false,
      shuffleCount: 0
    });

    const scoreElement = document.getElementById("circleScore");
    const foundCountElement = document.getElementById("circleFoundCount");
    const rankElement = document.getElementById("circleRank");
    const themeElement = document.getElementById("circleTheme");
    const currentElement = document.getElementById("circleCurrentWord");
    const wheel = document.getElementById("letterWheel");
    const deleteButton = document.getElementById("circleDeleteButton");
    const shuffleButton = document.getElementById("circleShuffleButton");
    const submitButton = document.getElementById("circleSubmitButton");
    const revealButton = document.getElementById("circleRevealButton");
    const shareButton = document.getElementById("circleShareButton");
    const message = document.getElementById("circleMessage");
    const foundWords = document.getElementById("circleFoundWords");
    const foundSummary = document.getElementById("circleFoundSummary");
    const progressFill = document.getElementById("circleProgressFill");
    const progressText = document.getElementById("circleProgressText");
    const answersCard = document.getElementById("circleAnswersCard");

    function save() {
      safeSave(stateKey, state);
    }

    function scoreWord(word) {
      let score = word.length === 4 ? 1 :
        word.length === 5 ? 2 :
        word.length === 6 ? 3 : 5;

      if (new Set(word).size === allowedSet.size) {
        score += 7;
      }
      return score;
    }

    function totalScore() {
      return state.found.reduce((total, word) => total + scoreWord(word), 0);
    }

    function maxScore() {
      return answers.reduce((total, word) => total + scoreWord(word), 0);
    }

    function rankForScore(score) {
      const maximum = Math.max(1, maxScore());
      const ratio = score / maximum;

      if (ratio >= 0.8) return "Kelime Ustası";
      if (ratio >= 0.55) return "Muhteşem";
      if (ratio >= 0.3) return "Çok İyi";
      if (ratio >= 0.12) return "İyi";
      return "Başlangıç";
    }

    function outerLetters() {
      const outer = allowed.filter((letter) => letter !== center);
      return seededShuffle(outer, dateIndex(dateKey) + state.shuffleCount * 71);
    }

    function renderWheel() {
      wheel.innerHTML = "";
      const positions = ["top", "upper-right", "lower-right", "bottom", "lower-left", "upper-left"];
      const outer = outerLetters();

      outer.forEach((letter, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `wheel-letter ${positions[index]}`;
        button.textContent = trUpper(letter);
        button.addEventListener("click", () => addLetter(letter));
        wheel.appendChild(button);
      });

      const centerButton = document.createElement("button");
      centerButton.type = "button";
      centerButton.className = "wheel-letter center";
      centerButton.textContent = trUpper(center);
      centerButton.addEventListener("click", () => addLetter(center));
      wheel.appendChild(centerButton);
    }

    function addLetter(letter) {
      if (state.current.length >= 15) return;
      state.current += letter;
      renderCurrent();
      save();
    }

    function renderCurrent() {
      currentElement.textContent = state.current
        ? trUpper(state.current)
        : "Harfleri seç";
    }

    function renderFound() {
      foundWords.innerHTML = "";

      const sorted = [...state.found].sort(
        (a, b) => b.length - a.length || a.localeCompare(b, "tr-TR")
      );

      if (sorted.length === 0) {
        foundSummary.textContent = "Henüz kelime yok";
      } else {
        foundSummary.textContent = `${sorted.length} / ${answers.length} kelime`;
      }

      for (const word of sorted) {
        const chip = document.createElement("span");
        chip.textContent = trUpper(word);
        if (new Set(word).size === allowedSet.size) {
          chip.classList.add("pangram");
          chip.title = "Bütün harfleri kullanan kelime";
        }
        foundWords.appendChild(chip);
      }
    }

    function renderScore() {
      const score = totalScore();
      const ratio = answers.length ? state.found.length / answers.length : 0;

      scoreElement.textContent = score;
      foundCountElement.textContent = `${state.found.length}/${answers.length}`;
      rankElement.textContent = rankForScore(score);
      progressFill.style.width = `${Math.min(100, ratio * 100)}%`;

      if (state.found.length === 0) {
        progressText.textContent = "İlk kelimeni bul.";
      } else if (ratio >= 1) {
        progressText.textContent = "Bütün kelimeleri buldun!";
      } else {
        progressText.textContent =
          `${Math.round(ratio * 100)}% tamamlandı — ${rankForScore(score)}`;
      }
    }

    function showAnswers() {
      answersCard.hidden = false;
      const intro = document.getElementById("circleAnswerIntro");
      const container = document.getElementById("circleAllAnswers");

      intro.textContent =
        `Merkez harf ${trUpper(center)}. Bu sette geliştirme sözlüğünde ` +
        `${answers.length} uygun kelime bulunuyor.`;

      container.innerHTML = "";
      const groups = new Map();

      for (const word of answers) {
        const length = word.length;
        if (!groups.has(length)) groups.set(length, []);
        groups.get(length).push(word);
      }

      [...groups.entries()]
        .sort((a, b) => a[0] - b[0])
        .forEach(([length, group]) => {
          const section = document.createElement("section");
          const heading = document.createElement("h3");
          const list = document.createElement("div");

          heading.textContent = `${length} harfli kelimeler (${group.length})`;
          list.className = "answer-chip-list";

          group.forEach((word) => {
            const chip = document.createElement("span");
            chip.textContent = trUpper(word);
            if (state.found.includes(word)) chip.classList.add("found");
            list.appendChild(chip);
          });

          section.append(heading, list);
          container.appendChild(section);
        });
    }

    function submitCurrent() {
      const word = state.current;
      state.current = "";
      renderCurrent();

      if (word.length < 4) {
        message.textContent = "Kelime en az 4 harfli olmalı.";
        message.className = "game-message error";
        return;
      }

      if (!word.includes(center)) {
        message.textContent = `Merkezdeki ${trUpper(center)} harfini kullanmalısın.`;
        message.className = "game-message error";
        return;
      }

      if (!answerSet.has(word)) {
        message.textContent = "Bu kelime bugünkü cevap listesinde bulunmuyor.";
        message.className = "game-message error";
        return;
      }

      if (state.found.includes(word)) {
        message.textContent = "Bu kelimeyi daha önce buldun.";
        message.className = "game-message";
        return;
      }

      state.found.push(word);
      const gained = scoreWord(word);
      const pangram = new Set(word).size === allowedSet.size;

      message.textContent =
        `${trUpper(word)} eklendi: +${gained} puan` +
        (pangram ? " — bütün harfleri kullandın!" : "");
      message.className = "game-message success";

      renderFound();
      renderScore();
      save();
    }

    deleteButton.addEventListener("click", () => {
      state.current = state.current.slice(0, -1);
      renderCurrent();
      save();
    });

    shuffleButton.addEventListener("click", () => {
      state.shuffleCount += 1;
      renderWheel();
      save();
    });

    submitButton.addEventListener("click", submitCurrent);

    revealButton.addEventListener("click", () => {
      state.revealed = true;
      showAnswers();
      revealButton.disabled = true;
      revealButton.textContent = "Cevaplar gösteriliyor";
      save();
    });

    shareButton.addEventListener("click", () => {
      const text =
        `KelimeLab Harf Çemberi — ${formatDateKey(dateKey, false)}\n` +
        `${state.found.length}/${answers.length} kelime • ${totalScore()} puan • ${rankForScore(totalScore())}\n` +
        `${location.origin}/harf-cemberi.html`;

      shareText("KelimeLab Harf Çemberi", text, message);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submitCurrent();
      } else if (event.key === "Backspace") {
        event.preventDefault();
        state.current = state.current.slice(0, -1);
        renderCurrent();
        save();
      } else {
        const character = trLower(event.key);
        if (character.length === 1 && allowedSet.has(character)) {
          addLetter(character);
        }
      }
    });

    themeElement.textContent =
      `${puzzle.theme} • Merkez harf: ${trUpper(center)}`;

    renderWheel();
    renderCurrent();
    renderFound();
    renderScore();

    if (state.revealed) {
      showAnswers();
      revealButton.disabled = true;
      revealButton.textContent = "Cevaplar gösteriliyor";
    }
  }

  function initHub() {
    const dateKey = getIstanbulDateKey();

    document.querySelectorAll("[data-daily-date]").forEach((element) => {
      element.textContent = `${formatDateKey(dateKey)} bulmacaları`;
    });

    const statusMap = {
      word: safeLoad(`${STORAGE_PREFIX}-word-${dateKey}`, null),
      anagram: safeLoad(`${STORAGE_PREFIX}-anagram-${dateKey}`, null),
      circle: safeLoad(`${STORAGE_PREFIX}-circle-${dateKey}`, null)
    };

    Object.entries(statusMap).forEach(([type, state]) => {
      const element = document.querySelector(`[data-hub-status="${type}"]`);
      if (!element || !state) return;

      if (type === "circle") {
        const count = Array.isArray(state.found) ? state.found.length : 0;
        element.textContent = count > 0
          ? `${count} kelime buldun — devam et`
          : "Bugünkü bulmaca hazır";
      } else if (state.status === "won") {
        element.textContent = "Bugün tamamlandı ✓";
        element.classList.add("completed");
      } else if (state.status === "lost") {
        element.textContent = "Bugün oynandı";
      } else if (Array.isArray(state.guesses) && state.guesses.length > 0) {
        element.textContent = "Kaldığın yerden devam et";
      }
    });
  }

  function initArchive() {
    const container = document.getElementById("archiveList");
    if (!container) return;

    const today = getIstanbulDateKey();

    for (let offset = 0; offset < 30; offset += 1) {
      const dateKey = shiftDateKey(today, -offset);
      const item = document.createElement("article");
      item.className = "archive-day";

      const heading = document.createElement("div");
      heading.className = "archive-day-heading";
      heading.innerHTML =
        `<strong>${offset === 0 ? "Bugün" : formatDateKey(dateKey)}</strong>` +
        `<span>${dateKey}</span>`;

      const links = document.createElement("div");
      links.className = "archive-game-links";

      const games = [
        ["Günün Kelimesi", "gunun-kelimesi.html"],
        ["Günlük Anagram", "gunluk-anagram.html"],
        ["Harf Çemberi", "harf-cemberi.html"]
      ];

      for (const [label, href] of games) {
        const link = document.createElement("a");
        link.href = `${href}?date=${dateKey}`;
        link.textContent = label;
        links.appendChild(link);
      }

      item.append(heading, links);
      container.appendChild(item);
    }
  }

  const selectedDate = getSelectedDateKey();
  setCommonDateUI(selectedDate);
  startCountdown();

  if (page === "hub") initHub();
  if (page === "word") initWordGame(selectedDate);
  if (page === "anagram") initAnagram(selectedDate);
  if (page === "circle") initCircle(selectedDate);
  if (page === "archive") initArchive();
})();
