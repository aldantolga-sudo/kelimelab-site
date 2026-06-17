const WORDS = [
  "AK", "AL", "AN", "AR", "AT", "AY",
  "ADA", "AĞA", "ANA", "ARA", "ATA", "AYI", "BAL", "BEL", "BİL", "BİR",
  "DAL", "DAR", "DİL", "ELMA", "EV", "GEL", "GÖL", "GÜL", "HAL", "KAL",
  "KAR", "KEL", "KİL", "KOL", "KUL", "LİME", "MAL", "MASA", "MİL",
  "OLA", "OL", "SAL", "SEL", "TEL", "YEL", "YOL",
  "ALEM", "ELİM", "EMLAK", "KALEM", "KELAM", "KELİM", "KELİME",
  "LİMAN", "MEKAN", "MELEK", "MİLAS", "SELAM", "YEMEK"
];

const lettersInput = document.getElementById("letters");
const findButton = document.getElementById("findButton");
const clearButton = document.getElementById("clearButton");
const statusBox = document.getElementById("status");
const resultsList = document.getElementById("results");
const year = document.getElementById("year");

year.textContent = new Date().getFullYear();

function normalizeTurkish(value) {
  return value
    .toLocaleUpperCase("tr-TR")
    .replace(/[^ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ]/g, "");
}

function canBuildWord(word, letters) {
  const available = [...letters];

  for (const character of word) {
    const index = available.indexOf(character);
    if (index === -1) {
      return false;
    }
    available.splice(index, 1);
  }

  return true;
}

function findWords() {
  const letters = normalizeTurkish(lettersInput.value);
  resultsList.innerHTML = "";

  if (letters.length < 2) {
    statusBox.textContent = "En az 2 harf yazmalısın.";
    return;
  }

  const matches = WORDS
    .filter((word) => word.length >= 2 && canBuildWord(word, letters))
    .sort((a, b) => b.length - a.length || a.localeCompare(b, "tr"));

  if (matches.length === 0) {
    statusBox.textContent = "Bu örnek listede uygun kelime bulunamadı.";
    return;
  }

  statusBox.textContent = `${matches.length} kelime bulundu.`;

  for (const word of matches) {
    const item = document.createElement("li");
    item.textContent = word;
    resultsList.appendChild(item);
  }
}

function clearTool() {
  lettersInput.value = "";
  statusBox.textContent = "";
  resultsList.innerHTML = "";
  lettersInput.focus();
}

findButton.addEventListener("click", findWords);
clearButton.addEventListener("click", clearTool);

lettersInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    findWords();
  }
});
