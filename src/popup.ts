const buttons = document.querySelectorAll<HTMLButtonElement>(".theme-btn");

// Load current theme
chrome.storage.sync.get({ theme: "default" }, ({ theme }) => {
  buttons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.theme === theme);
  });
});

// Handle theme change
buttons.forEach(btn => {
  btn.addEventListener("click", () => {
    const newTheme = btn.dataset.theme!;
    chrome.storage.sync.set({ theme: newTheme });
    buttons.forEach(b => b.classList.toggle("active", b === btn));
  });
});
