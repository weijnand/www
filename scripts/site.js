(() => {
  const SLOW_PRONUNCIATION_RATE = 0.7;
  const sectionHeadings = document.querySelectorAll(".split-panel > .section-heading h2");

  if (sectionHeadings.length) {
    const textMetrics = document.createElement("canvas").getContext("2d");

    const alignSectionHeadings = () => {
      if (!textMetrics) return;

      sectionHeadings.forEach((heading) => {
        const style = getComputedStyle(heading);
        textMetrics.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const firstLetter = heading.textContent.trim().charAt(0);
        const offset = textMetrics.measureText(firstLetter).actualBoundingBoxLeft;
        heading.style.setProperty("--heading-optical-offset", `${Number.isFinite(offset) ? offset : 0}px`);
      });
    };

    alignSectionHeadings();
    document.fonts?.ready.then(alignSectionHeadings);
    window.addEventListener("resize", alignSectionHeadings);
  }

  const portrait = document.querySelector("[data-random-portrait]");

  if (portrait) {
    const portraits = portrait.dataset.portraits
      .split("|")
      .map((source) => source.trim())
      .filter(Boolean);

    if (portraits.length > 0) {
      portrait.src = portraits[Math.floor(Math.random() * portraits.length)];
    }
  }

  const pronunciationItems = [...document.querySelectorAll("[data-pronunciation-part]")]
    .map((part) => {
      const toggle = part.querySelector("[data-pronunciation-toggle]");
      const playButton = part.querySelector("[data-pronunciation-play]");
      const audio = playButton
        ? document.getElementById(playButton.dataset.pronunciationPlay)
        : null;

      return { part, toggle, playButton, audio };
    })
    .filter(({ toggle, playButton, audio }) => toggle && playButton && audio);

  const resetAudio = ({ playButton, audio }) => {
    audio.pause();
    audio.currentTime = 0;
    playButton.classList.remove("is-playing");
  };

  const stopAudio = () => pronunciationItems.forEach(resetAudio);
  const hoverCapability = window.matchMedia("(any-hover: hover)");

  pronunciationItems.forEach((item) => {
    const { part, toggle, playButton, audio } = item;
    const name = part.dataset.pronunciationName;
    let nextPlaybackRate = 1;
    let revealedByHover = false;

    const playPronunciation = () => {
      stopAudio();
      const playbackRate = nextPlaybackRate;

      audio.playbackRate = playbackRate;
      playButton.classList.add("is-playing");
      audio
        .play()
        .then(() => {
          nextPlaybackRate = playbackRate === 1 ? SLOW_PRONUNCIATION_RATE : 1;
        })
        .catch(() => playButton.classList.remove("is-playing"));
    };

    const setExpanded = (isExpanded, { stopPlayback = true } = {}) => {
      part.classList.toggle("is-expanded", isExpanded);
      toggle.setAttribute("aria-expanded", String(isExpanded));
      const action = isExpanded
        ? revealedByHover ? "Play the pronunciation of" : "Show the spelling of"
        : "Show the pronunciation of";
      toggle.setAttribute(
        "aria-label",
        `${action} ${name}`,
      );
      playButton.hidden = !isExpanded;

      if (!isExpanded) {
        part.style.removeProperty("min-width");
        if (stopPlayback) {
          resetAudio(item);
          audio.playbackRate = 1;
          nextPlaybackRate = 1;
        }
      }
    };

    part.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "mouse" || !hoverCapability.matches) return;

      // Keep the hover area stable if the IPA is narrower than the spelling.
      part.style.minWidth = `${part.getBoundingClientRect().width}px`;
      revealedByHover = true;
      setExpanded(true);
    });

    part.addEventListener("pointerleave", (event) => {
      if (event.pointerType !== "mouse" || !revealedByHover) return;

      revealedByHover = false;
      // A keyboard user may have tabbed onto the speaker while it was visible.
      setExpanded(Boolean(part.querySelector(":focus-visible")), { stopPlayback: false });
    });

    toggle.addEventListener("click", (event) => {
      if (revealedByHover && event.pointerType !== "touch") {
        playPronunciation();
        return;
      }

      // Without mouse hover, taps and keyboard activation still toggle the IPA.
      revealedByHover = false;
      setExpanded(toggle.getAttribute("aria-expanded") !== "true");
    });

    playButton.addEventListener("click", playPronunciation);

    audio.addEventListener("ended", () => playButton.classList.remove("is-playing"));
  });

  const publicationList = document.querySelector("#publication-list");
  const publicationToggle = document.querySelector("[data-publication-toggle]");
  const publicationToggleIndicator = publicationToggle?.querySelector("[data-toggle-indicator]");

  if (
    publicationList &&
    publicationToggle &&
    publicationToggleIndicator &&
    publicationList.children.length > 5
  ) {
    publicationList.classList.add("is-collapsed");
    publicationToggle.hidden = false;

    publicationToggle.addEventListener("click", () => {
      const isExpanded = publicationToggle.getAttribute("aria-expanded") === "true";

      publicationList.classList.toggle("is-collapsed", isExpanded);
      publicationToggle.setAttribute(
        "aria-label",
        isExpanded ? "Expand publication list" : "Collapse publication list",
      );
      publicationToggle.setAttribute("aria-expanded", String(!isExpanded));
    });
  }

  const talkList = document.querySelector("#talk-list");
  const talkToggle = document.querySelector("[data-talk-toggle]");
  const talkToggleIndicator = talkToggle?.querySelector("[data-toggle-indicator]");

  if (
    talkList &&
    talkToggle &&
    talkToggleIndicator &&
    talkList.children.length > 5
  ) {
    talkList.classList.add("is-collapsed");
    talkToggle.hidden = false;

    talkToggle.addEventListener("click", () => {
      const isExpanded = talkToggle.getAttribute("aria-expanded") === "true";

      talkList.classList.toggle("is-collapsed", isExpanded);
      talkToggle.setAttribute(
        "aria-label",
        isExpanded ? "Expand talk list" : "Collapse talk list",
      );
      talkToggle.setAttribute("aria-expanded", String(!isExpanded));
    });
  }

  const lastModified = new Date(document.lastModified);

  if (!Number.isNaN(lastModified.getTime())) {
    const dateTime = [
      lastModified.getFullYear(),
      String(lastModified.getMonth() + 1).padStart(2, "0"),
      String(lastModified.getDate()).padStart(2, "0"),
    ].join("-");
    const displayDate = new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(lastModified);

    document.querySelectorAll("[data-last-updated]").forEach((element) => {
      element.dateTime = dateTime;
      element.textContent = displayDate;
    });
  }
})();
