const lettersInput = document.getElementById("letters");
const findButton = document.getElementById("findButton");
const clearButton = document.getElementById("clearButton");
const statusBox = document.getElementById("status");
const filtersBox = document.getElementById("filters");
const resultsList = document.getElementById("results");
const dictionaryCount = document.getElementById("dictionaryCount");
const filterButtons = [...document.querySelectorAll(".filter-button")];
const year = document.getElementById("year");

const WORDS = Array.isArray(window.KELIME_LISTESI)
  ? window.KELIME_LISTESI
  : [];

let currentMatches = [];
let activeFilter = "all";

year.textContent = new Date().getFullYear();
dictionaryCount.textContent = `${WORDS.length.toLocaleString("tr-TR")} kelime`;

function normalizeTurkish(value) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/[^abcçdefgğhıijklmnoöprsştuüvyz]/g, "");
}

function countLetters(text) {
  const counts = new Map();

  for (const character of text) {
    counts.set(character, (counts.get(character) || 0) + 1);
  }

  return counts;
}

function canBuildWord(word, availableCounts) {
  const usedCounts = new Map();

  for (const character of word) {
    const used = (usedCounts.get(character) || 0) + 1;

    if (used > (availableCounts.get(character) || 0)) {
      return false;
    }

    usedCounts.set(character, used);
  }

  return true;
}

function matchesActiveFilter(word) {
  if (activeFilter === "3") {
    return word.length === 3;
  }

  if (activeFilter === "4") {
    return word.length === 4;
  }

  if (activeFilter === "5plus") {
    return word.length >= 5;
  }

  return true;
}

function renderResults() {
  resultsList.innerHTML = "";

  const filteredMatches = currentMatches.filter(matchesActiveFilter);
  const visibleMatches = filteredMatches.slice(0, 500);

  if (currentMatches.length === 0) {
    statusBox.textContent = "Bu harflerle uygun kelime bulunamadı.";
    filtersBox.classList.remove("visible");
    return;
  }

  filtersBox.classList.add("visible");

  if (activeFilter === "all") {
    statusBox.textContent = `${currentMatches.length.toLocaleString("tr-TR")} kelime bulundu.`;
  } else {
    statusBox.textContent =
      `Toplam ${currentMatches.length.toLocaleString("tr-TR")} kelime bulundu; ` +
      `${filteredMatches.length.toLocaleString("tr-TR")} tanesi bu filtreye uyuyor.`;
  }

  if (filteredMatches.length > visibleMatches.length) {
    statusBox.textContent += " İlk 500 sonuç gösteriliyor.";
  }

  for (const word of visibleMatches) {
    const item = document.createElement("li");

    const wordText = document.createElement("span");
    wordText.textContent = word.toLocaleUpperCase("tr-TR");

    const lengthText = document.createElement("span");
    lengthText.className = "word-length";
    lengthText.textContent = `${word.length} harf`;

    item.append(wordText, lengthText);
    resultsList.appendChild(item);
  }
}

function findWords() {
  const letters = normalizeTurkish(lettersInput.value);
  resultsList.innerHTML = "";

  if (WORDS.length === 0) {
    statusBox.textContent = "Kelime verisi yüklenemedi. kelimeler.js dosyasını kontrol et.";
    filtersBox.classList.remove("visible");
    return;
  }

  if (letters.length < 2) {
    statusBox.textContent = "En az 2 harf yazmalısın.";
    filtersBox.classList.remove("visible");
    return;
  }

  const availableCounts = countLetters(letters);

  currentMatches = WORDS
    .filter((word) => word.length <= letters.length)
    .filter((word) => canBuildWord(word, availableCounts))
    .sort((first, second) =>
      second.length - first.length ||
      first.localeCompare(second, "tr-TR")
    );

  activeFilter = "all";
  updateActiveFilterButton();
  renderResults();
}

function updateActiveFilterButton() {
  for (const button of filterButtons) {
    button.classList.toggle(
      "active",
      button.dataset.filter === activeFilter
    );
  }
}

function clearTool() {
  lettersInput.value = "";
  currentMatches = [];
  activeFilter = "all";
  statusBox.textContent = "";
  resultsList.innerHTML = "";
  filtersBox.classList.remove("visible");
  updateActiveFilterButton();
  lettersInput.focus();
}

findButton.addEventListener("click", findWords);
clearButton.addEventListener("click", clearTool);

lettersInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    findWords();
  }
});

for (const button of filterButtons) {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    updateActiveFilterButton();
    renderResults();
  });
}
