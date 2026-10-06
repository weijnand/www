(() => {
  const storageKey = "wvw-theme";
  const localThemeParameter = "wvw-theme";
  const isLocalFile = window.location.protocol === "file:";
  const localPageNames = new Set(["index.html", "news.html", "events.html", "visits.html"]);
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  const root = document.documentElement;
  let preferredTheme = null;

  const validTheme = (value) => value === "light" || value === "dark";

  try {
    const savedTheme = localStorage.getItem(storageKey);
    if (validTheme(savedTheme)) preferredTheme = savedTheme;
  } catch {
    // The toggle still works if the browser disallows local storage.
  }

  if (isLocalFile) {
    // Browsers can isolate local storage for each file, so carry the choice
    // explicitly when navigating between the site's local HTML pages.
    const incomingTheme = new URL(window.location.href).searchParams.get(localThemeParameter);
    if (validTheme(incomingTheme) || incomingTheme === "system") {
      preferredTheme = validTheme(incomingTheme) ? incomingTheme : null;
      try {
        if (preferredTheme === null) localStorage.removeItem(storageKey);
        else localStorage.setItem(storageKey, preferredTheme);
      } catch {
        // The URL handoff also works when local files cannot use storage.
      }
    }
  }

  const updateLocalPageLinks = () => {
    if (!isLocalFile) return;

    const currentUrl = new URL(window.location.href);
    const currentDirectory = currentUrl.pathname.slice(0, currentUrl.pathname.lastIndexOf("/") + 1);
    const localPreference = preferredTheme ?? "system";

    document.querySelectorAll("a[href]").forEach((link) => {
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#") || link.hasAttribute("download")) return;

      let target;
      try {
        target = new URL(href, currentUrl);
      } catch {
        return;
      }
      const separator = target.pathname.lastIndexOf("/") + 1;
      if (
        target.protocol !== "file:"
        || target.host !== currentUrl.host
        || target.pathname.slice(0, separator) !== currentDirectory
        || !localPageNames.has(target.pathname.slice(separator))
        || target.pathname === currentUrl.pathname
      ) return;

      target.searchParams.set(localThemeParameter, localPreference);
      link.href = target.href;
    });

    // Keep an incoming handoff current so reloading after a toggle retains it.
    if (currentUrl.searchParams.has(localThemeParameter)) {
      currentUrl.searchParams.set(localThemeParameter, localPreference);
      try {
        history.replaceState(history.state, "", currentUrl.href);
      } catch {
        // Some browsers restrict history changes for local files.
      }
    }
  };

  const applyTheme = () => {
    const theme = preferredTheme ?? (systemTheme.matches ? "dark" : "light");
    root.dataset.theme = theme;

    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = theme === "dark" ? "#18211f" : "#f4f1e9";

    const toggle = document.querySelector("[data-theme-toggle]");
    if (toggle) {
      const label = `Switch to ${theme === "dark" ? "light" : "dark"} mode`;
      toggle.setAttribute("aria-label", label);
      toggle.title = label;
    }

    updateLocalPageLinks();
  };

  // This script runs before the stylesheet to avoid a flash of the wrong theme.
  applyTheme();

  document.addEventListener("DOMContentLoaded", () => {
    const toggle = document.querySelector("[data-theme-toggle]");
    if (!toggle) return;

    applyTheme();
    toggle.hidden = false;
    toggle.addEventListener("click", () => {
      preferredTheme = root.dataset.theme === "dark" ? "light" : "dark";
      applyTheme();
      try {
        localStorage.setItem(storageKey, preferredTheme);
      } catch {
        // Keep the selected theme for this page even without persistence.
      }
    });
  });

  systemTheme.addEventListener("change", () => {
    if (preferredTheme === null) applyTheme();
  });

  window.addEventListener("storage", (event) => {
    if (event.key !== storageKey && event.key !== null) return;
    preferredTheme = validTheme(event.newValue) ? event.newValue : null;
    applyTheme();
  });
})();
