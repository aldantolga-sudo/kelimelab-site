(() => {
  const tool = document.body.dataset.tool;
  if (!tool) return;

  const WORDS = Array.isArray(window.KELIME_LISTESI)
    ? window.KELIME_LISTESI
    : [];

  const form = document.getElementById("toolForm");
  const primaryInput = document.getElementById("primaryInput");
  const clearButton = document.getElementById("clearButton");
  const status = document.getElementById("status");
  const resultMeta = document.getElementById("resultMeta");
  const results = document.getElementById("results");
  const minInput = document.getElementById("minLength");
  const maxInput = document.getElementById("maxLength");
  const containsMode = document.getElementById("containsMode");

  const TURKISH_LETTERS = /[^abcçdefgğhıijklmnoöprsştuüvyz]/g;
  const TURKISH_WITH_WILDCARDS = /[^abcçdefgğhıijklmnoöprsştuüvyz?*]/g;
  const TURKISH_WITH_PATTERN = /[^abcçdefgğhıijklmnoöprsştuüvyz?_]/g;
  const MAX_VISIBLE_RESULTS = 500;

  function normalize(value) {
    return value.toLocaleLowerCase("tr-TR").replace(TURKISH_LETTERS, "");
  }

  function normalizeJoker(value) {
    return value
      .toLocaleLowerCase("tr-TR")
      .replace(/\s+/g, "")
      .replace(TURKISH_WITH_WILDCARDS, "");
  }

  function normalizePattern(value) {
    return value
      .toLocaleLowerCase("tr-TR")
      .replace(/\s+/g, "")
      .replace(TURKISH_WITH_PATTERN, "");
  }

  function countLetters(value) {
    const counts = new Map();
    for (const character of value) {
      counts.set(character, (counts.get(character) || 0) + 1);
    }
    return counts;
  }

  function canBuildWord(word, availableCounts) {
    const used = new Map();
    for (const character of word) {
      const next = (used.get(character) || 0) + 1;
      if (next > (availableCounts.get(character) || 0)) {
        return false;
      }
      used.set(character, next);
    }
    return true;
  }

  function canBuildWithJokers(word, letters, jokerCount) {
    const available = countLetters(letters);
    const used = new Map();
    let deficits = 0;

    for (const character of word) {
      const next = (used.get(character) || 0) + 1;
      const availableForCharacter = available.get(character) || 0;

      if (next > availableForCharacter) {
        deficits += 1;
        if (deficits > jokerCount) return false;
      }
      used.set(character, next);
    }
    return true;
  }

  function containsAllLetters(word, query) {
    const wordCounts = countLetters(word);
    const queryCounts = countLetters(query);

    for (const [character, required] of queryCounts.entries()) {
      if ((wordCounts.get(character) || 0) < required) {
        return false;
      }
    }
    return true;
  }

  function getLengthRange() {
    if (!minInput || !maxInput) {
      return { min: 3, max: 15 };
    }

    const min = Number.parseInt(minInput.value, 10);
    const max = Number.parseInt(maxInput.value, 10);

    if (!Number.isInteger(min) || !Number.isInteger(max)) {
      throw new Error("Kelime uzunluğu için sayı girmelisin.");
    }

    if (min < 3 || max > 15 || min > max) {
      throw new Error("Uzunluk 3–15 arasında olmalı ve en az değer en fazla değeri geçmemeli.");
    }

    return { min, max };
  }

  function sortWords(items, preferLong = true) {
    return [...items].sort((first, second) => {
      const lengthOrder = preferLong
        ? second.length - first.length
        : first.length - second.length;

      return lengthOrder || first.localeCompare(second, "tr-TR");
    });
  }

  function search() {
    if (WORDS.length === 0) {
      throw new Error("Kelime verisi yüklenemedi.");
    }

    const range = getLengthRange();
    const rawValue = primaryInput.value;

    if (tool === "word") {
      const letters = normalize(rawValue);
      if (letters.length < 3) {
        throw new Error("En az 3 harf yazmalısın.");
      }

      const counts = countLetters(letters);
      return sortWords(
        WORDS.filter((word) =>
          word.length >= range.min &&
          word.length <= Math.min(range.max, letters.length) &&
          canBuildWord(word, counts)
        )
      );
    }

    if (tool === "anagram") {
      const letters = normalize(rawValue);
      if (letters.length < 3) {
        throw new Error("En az 3 harf yazmalısın.");
      }

      const counts = countLetters(letters);
      return sortWords(
        WORDS.filter((word) =>
          word.length === letters.length &&
          canBuildWord(word, counts)
        ),
        false
      );
    }

    if (tool === "joker") {
      const input = normalizeJoker(rawValue);
      const jokerCount = [...input].filter((character) => character === "?" || character === "*").length;
      const letters = input.replace(/[?*]/g, "");

      if (input.length < 3) {
        throw new Error("Harfler ve jokerlerle birlikte en az 3 karakter girmelisin.");
      }

      if (jokerCount === 0) {
        throw new Error("En az bir joker için ? veya * karakteri kullanmalısın.");
      }

      return sortWords(
        WORDS.filter((word) =>
          word.length >= range.min &&
          word.length <= Math.min(range.max, input.length) &&
          canBuildWithJokers(word, letters, jokerCount)
        )
      );
    }

    if (tool === "pattern") {
      const pattern = normalizePattern(rawValue);
      if (pattern.length < 3) {
        throw new Error("En az 3 karakterlik bir kalıp yazmalısın.");
      }

      if (!/[?_]/.test(pattern)) {
        throw new Error("Bilinmeyen konumlar için _ veya ? kullanmalısın.");
      }

      const escapedPattern = [...pattern]
        .map((character) => character === "?" || character === "_" ? "." : character)
        .join("");

      const expression = new RegExp(`^${escapedPattern}$`, "u");
      return sortWords(
        WORDS.filter((word) => word.length === pattern.length && expression.test(word)),
        false
      );
    }

    if (tool === "starts") {
      const prefix = normalize(rawValue);
      if (prefix.length < 1) {
        throw new Error("Başlangıç harfi veya hecesi yazmalısın.");
      }

      return sortWords(
        WORDS.filter((word) =>
          word.length >= range.min &&
          word.length <= range.max &&
          word.startsWith(prefix)
        ),
        false
      );
    }

    if (tool === "ends") {
      const suffix = normalize(rawValue);
      if (suffix.length < 1) {
        throw new Error("Bitiş harfi veya eki yazmalısın.");
      }

      return sortWords(
        WORDS.filter((word) =>
          word.length >= range.min &&
          word.length <= range.max &&
          word.endsWith(suffix)
        ),
        false
      );
    }

    if (tool === "contains") {
      const query = normalize(rawValue);
      if (query.length < 1) {
        throw new Error("Aranacak harf veya ifadeyi yazmalısın.");
      }

      const mode = containsMode ? containsMode.value : "sequence";

      return sortWords(
        WORDS.filter((word) => {
          if (word.length < range.min || word.length > range.max) {
            return false;
          }

          return mode === "all"
            ? containsAllLetters(word, query)
            : word.includes(query);
        }),
        false
      );
    }

    throw new Error("Araç türü tanınamadı.");
  }

  function getResultLabel(count) {
    if (tool === "anagram") return `${count.toLocaleString("tr-TR")} anagram`;
    if (tool === "pattern") return `${count.toLocaleString("tr-TR")} kalıp eşleşmesi`;
    return `${count.toLocaleString("tr-TR")} kelime`;
  }

  function render(items) {
    results.innerHTML = "";
    resultMeta.hidden = true;
    status.classList.remove("error", "success");

    if (items.length === 0) {
      status.textContent = "Bu ölçütlere uyan sonuç bulunamadı.";
      return;
    }

    status.textContent = `${getResultLabel(items.length)} bulundu.`;
    status.classList.add("success");

    const visible = items.slice(0, MAX_VISIBLE_RESULTS);

    if (items.length > visible.length) {
      resultMeta.hidden = false;
      resultMeta.textContent =
        `Sonuç sayısı yüksek olduğu için ilk ${MAX_VISIBLE_RESULTS.toLocaleString("tr-TR")} kelime gösteriliyor. ` +
        "Uzunluk aralığını daraltarak daha hedefli sonuç alabilirsin.";
    }

    const fragment = document.createDocumentFragment();

    for (const word of visible) {
      const item = document.createElement("li");
      const wordText = document.createElement("span");
      const lengthText = document.createElement("small");

      wordText.textContent = word.toLocaleUpperCase("tr-TR");
      lengthText.textContent = `${word.length} harf`;

      item.append(wordText, lengthText);
      fragment.appendChild(item);
    }

    results.appendChild(fragment);
  }

  function showError(message) {
    results.innerHTML = "";
    resultMeta.hidden = true;
    status.textContent = message;
    status.classList.remove("success");
    status.classList.add("error");
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    try {
      render(search());
    } catch (error) {
      showError(error instanceof Error ? error.message : "Arama sırasında bir hata oluştu.");
    }
  });

  clearButton.addEventListener("click", () => {
    primaryInput.value = "";
    results.innerHTML = "";
    status.textContent = "";
    status.classList.remove("error", "success");
    resultMeta.hidden = true;

    if (minInput) minInput.value = "3";
    if (maxInput) maxInput.value = "15";
    if (containsMode) containsMode.value = "sequence";

    primaryInput.focus();
  });
})();
