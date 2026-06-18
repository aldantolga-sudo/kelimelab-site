(() => {
  "use strict";

  const search = document.getElementById("wordLibrarySearch");
  const category = document.getElementById("wordLibraryCategory");
  const count = document.getElementById("wordLibraryCount");
  const empty = document.getElementById("wordLibraryEmpty");
  const cards = [...document.querySelectorAll(".word-library-card")];

  if (!search || !category || !count || !empty || cards.length === 0) return;

  function normalize(value) {
    return value.toLocaleLowerCase("tr-TR").trim();
  }

  function filterCards() {
    const query = normalize(search.value);
    const selectedCategory = category.value;
    let visible = 0;

    cards.forEach((card) => {
      const text = normalize(card.textContent || "");
      const matchesText = !query || text.includes(query);
      const matchesCategory =
        !selectedCategory || card.dataset.category === selectedCategory;
      const shouldShow = matchesText && matchesCategory;

      card.hidden = !shouldShow;
      if (shouldShow) visible += 1;
    });

    count.textContent = String(visible);
    empty.hidden = visible !== 0;
  }

  search.addEventListener("input", filterCards);
  category.addEventListener("change", filterCards);
})();