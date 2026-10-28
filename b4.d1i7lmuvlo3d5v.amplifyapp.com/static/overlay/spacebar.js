(() => {
    const root = document.getElementById("spacebar-redirect");
    if (!root) return;

    const url = root.getAttribute("data-url") || "";
    const count = Math.max(1, parseInt(root.getAttribute("data-count") || "5", 10));

    let presses = 0;
    let exitedOnce = false;
    let open = false;

    const isFullscreen = () =>
        Boolean(
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.msFullscreenElement,
        );

    const show = () => {
        if (open) return;
        open = true;
        root.classList.remove("hidden");
        root.classList.add("flex");
    };

    const hide = () => {
        open = false;
        presses = 0;
        root.classList.remove("flex");
        root.classList.add("hidden");
    };

    const onFsChange = () => {
        if (!isFullscreen()) {
            exitedOnce = true;
        }
        presses = 0;
    };

    const onKey = (e) => {
        const isSpace =
            e.code === "Space" || e.key === " " || e.key === "Spacebar";
        if (!isSpace) return;
        if (isFullscreen()) return;
        if (!exitedOnce) return;
        if (open) return;

        presses += 1;
        if (presses >= count) {
            presses = 0;
            show();
        }
    };

    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    document.addEventListener("msfullscreenchange", onFsChange);
    window.addEventListener("keydown", onKey);

    root.addEventListener("click", (e) => {
        if (e.target === root) hide();
    });

    root.querySelectorAll("[data-spacebar-close]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            hide();
        });
    });

    root.querySelectorAll("[data-spacebar-connect]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (!url) return;
            try {
                window.open(url, "_blank", "noopener,noreferrer");
            } catch (_) {
                window.location.href = url;
            }
        });
    });
})();