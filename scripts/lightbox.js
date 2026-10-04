(() => {
  const thumbnails = document.querySelectorAll(".item-thumbnail[data-lightbox]");
  if (!thumbnails.length) return;

  const dialog = document.createElement("dialog");
  if (typeof dialog.showModal !== "function") return;

  dialog.className = "image-lightbox";
  dialog.setAttribute("aria-label", "Image viewer");

  const image = document.createElement("img");
  image.className = "image-lightbox-image";
  image.decoding = "async";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "image-lightbox-close";
  closeButton.setAttribute("aria-label", "Close image");
  closeButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  dialog.append(image, closeButton);
  document.body.append(dialog);

  let opener = null;
  let savedScroll = null;
  let pointerStartedOutside = false;

  const saveProperties = (element, properties) => properties.map((property) => ({
    property,
    value: element.style.getPropertyValue(property),
    priority: element.style.getPropertyPriority(property),
  }));

  const restoreProperties = (element, properties) => {
    properties.forEach(({ property, value, priority }) => {
      if (value) element.style.setProperty(property, value, priority);
      else element.style.removeProperty(property);
    });
  };

  const lockScroll = () => {
    const root = document.documentElement;
    const body = document.body;
    const scrollbarWidth = window.innerWidth - root.clientWidth;
    const paddingRight = parseFloat(getComputedStyle(body).paddingRight) || 0;

    savedScroll = {
      x: window.scrollX,
      y: window.scrollY,
      root: saveProperties(root, ["overflow", "scroll-behavior"]),
      body: saveProperties(body, ["position", "top", "left", "width", "overflow", "padding-right"]),
    };

    root.style.overflow = "hidden";
    root.style.scrollBehavior = "auto";
    body.style.position = "fixed";
    body.style.top = `${-savedScroll.y}px`;
    body.style.left = `${-savedScroll.x}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) body.style.paddingRight = `${paddingRight + scrollbarWidth}px`;
  };

  const restoreScroll = () => {
    if (!savedScroll) return;

    const { x, y, root, body } = savedScroll;
    savedScroll = null;
    restoreProperties(document.body, body);
    // Restore the position without inheriting the page's smooth scrolling.
    window.scrollTo(x, y);
    restoreProperties(document.documentElement, root);
  };

  const openImage = (thumbnail) => {
    if (dialog.open) return false;

    const darkSource = thumbnail.dataset.lightboxDark;
    const source = document.documentElement.dataset.theme === "dark" && darkSource
      ? darkSource
      : thumbnail.href;
    const heading = thumbnail.closest("li")?.querySelector("h2, h3");

    image.alt = heading?.textContent.trim()
      || thumbnail.querySelector("img")?.alt
      || thumbnail.getAttribute("aria-label")
      || "";
    image.src = source;
    opener = thumbnail;
    pointerStartedOutside = false;
    lockScroll();

    try {
      dialog.showModal();
    } catch {
      restoreScroll();
      opener = null;
      return false;
    }

    closeButton.focus({ preventScroll: true });
    return true;
  };

  thumbnails.forEach((thumbnail) => {
    thumbnail.addEventListener("click", (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (openImage(thumbnail)) event.preventDefault();
    });
  });

  closeButton.addEventListener("click", () => dialog.close());

  dialog.addEventListener("pointerdown", (event) => {
    pointerStartedOutside = event.target === dialog;
  });

  dialog.addEventListener("pointercancel", () => {
    pointerStartedOutside = false;
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog && pointerStartedOutside) dialog.close();
    pointerStartedOutside = false;
  });

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    dialog.close();
  });

  dialog.addEventListener("close", () => {
    restoreScroll();
    if (opener?.isConnected) opener.focus({ preventScroll: true });
    opener = null;
    image.removeAttribute("src");
    image.alt = "";
  });
})();
