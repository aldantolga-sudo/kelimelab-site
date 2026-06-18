(() => {
  const menuButton = document.querySelector(".menu-button");
  const nav = document.getElementById("main-nav");

  if (menuButton && nav) {
    menuButton.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("open");
      menuButton.setAttribute("aria-expanded", String(isOpen));
    });

    nav.addEventListener("click", (event) => {
      if (event.target.closest("a")) {
        nav.classList.remove("open");
        menuButton.setAttribute("aria-expanded", "false");
      }
    });
  }

  document.querySelectorAll("[data-current-year]").forEach((element) => {
    element.textContent = new Date().getFullYear();
  });

  const wordCount = Array.isArray(window.KELIME_LISTESI)
    ? window.KELIME_LISTESI.length
    : null;

  if (wordCount !== null) {
    document.querySelectorAll("[data-word-count]").forEach((element) => {
      element.textContent = wordCount.toLocaleString("tr-TR");
    });
  }
})();
