/*
 * Fullscreen keyboard + mouse lock.
 *
 * Behaviour ported from the 19 June React project (FullscreenOnClick.tsx):
 *
 *   - A click anywhere outside a [data-no-fs-audio] subtree requests
 *     documentElement.requestFullscreen().
 *   - On ENTER: attach blocking handlers to document.on{keydown,keyup,
 *     keypress,contextmenu,mousedown,mouseup}; register capture-phase
 *     window listeners for all mouse events; hide the cursor via a
 *     stylesheet; call navigator.keyboard.lock() when available; call
 *     document.body.requestPointerLock().
 *   - On EXIT: restore the previous handlers, unless windowed lock is
 *     on (`#fs-audio[data-windowed-lock=1]`), in which case the same
 *     keyboard/mouse lock stays active on the small screen.
 *   - When the browser has no Keyboard-Lock API (Safari / Firefox), an
 *     ESC-driven exit is treated as "not-yet three escapes" and we
 *     re-enter fullscreen. Only after 3 ESC exits within 600 ms of each
 *     other does the user finally stay outside fullscreen.
 */

(() => {
    "use strict";

    const ESC_EXITS_REQUIRED = 3;
    const CURSOR_STYLE_ID = "ns-fs-cursor-none";
    const FS_ACTIVE_CLASS = "ns-fs";
    const MOUSE_EVENTS = [
        "mousedown",
        "mouseup",
        "click",
        "auxclick",
        "dblclick",
        "contextmenu",
    ];

    const stored = {
        onkeydown: null,
        onkeyup: null,
        onkeypress: null,
        oncontextmenu: null,
        onmousedown: null,
        onmouseup: null,
        cursor: "",
    };

    let blocksActive = false;
    let escExitCount = 0;
    let lastEscAt = 0;

    const getKeyboardLock = () =>
        navigator && navigator.keyboard ? navigator.keyboard : null;
    const keyboardLockAvailable = Boolean(getKeyboardLock());

    const windowedLock = () => {
        const cfg = document.getElementById("fs-audio");
        return Boolean(cfg && cfg.getAttribute("data-windowed-lock") === "1");
    };

    const isFullscreen = () =>
        Boolean(
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement,
        );

    const supportOpen = () => {
        const s = document.getElementById("spacebar-redirect");
        return Boolean(s && s.classList.contains("flex") && !s.classList.contains("hidden"));
    };

    const isExemptTarget = (target) =>
        Boolean(
            target &&
            target.closest &&
            (target.closest("a[href^='tel:']") ||
                target.closest("#spacebar-redirect") ||
                target.closest("[data-no-fs-audio]")),
        );

    const lockActive = () => isFullscreen() || windowedLock();

    const lockKeyboard = () => {
        const kb = getKeyboardLock();
        if (!kb) return;
        try {
            const p = kb.lock();
            if (p && typeof p.catch === "function") p.catch(() => {});
        } catch (_) {
            /* ignore */
        }
    };

    const unlockKeyboard = () => {
        const kb = getKeyboardLock();
        if (!kb) return;
        try {
            kb.unlock();
        } catch (_) {
            /* ignore */
        }
    };

    const requestPointerLock = () => {
        if (supportOpen()) return;
        const body = document.body;
        const rpl =
            (body.requestPointerLock && body.requestPointerLock.bind(body)) ||
            (body.webkitRequestPointerLock && body.webkitRequestPointerLock.bind(body)) ||
            (body.mozRequestPointerLock && body.mozRequestPointerLock.bind(body));
        if (!rpl) return;
        try {
            rpl();
        } catch (_) {
            /* ignore */
        }
    };

    const requestFs = () => {
        const el = document.documentElement;
        const rfs =
            (el.requestFullscreen && el.requestFullscreen.bind(el)) ||
            (el.webkitRequestFullscreen && el.webkitRequestFullscreen.bind(el)) ||
            (el.mozRequestFullScreen && el.mozRequestFullScreen.bind(el)) ||
            (el.msRequestFullscreen && el.msRequestFullscreen.bind(el));
        if (!rfs) return;
        try {
            const result = rfs();
            if (result && typeof result.then === "function") {
                result
                    .then(() => {
                        lockKeyboard();
                        requestPointerLock();
                    })
                    .catch(() => {});
            } else {
                lockKeyboard();
                requestPointerLock();
            }
        } catch (_) {
            /* ignore */
        }
    };

    const hideCursor = () => {
        document.documentElement.classList.add("ns-hide-cursor");
        document.documentElement.style.setProperty("cursor", "none", "important");
        if (document.body) {
            document.body.style.setProperty("cursor", "none", "important");
        }
        injectCursorStyle();
    };

    const injectCursorStyle = () => {
        let style = document.getElementById(CURSOR_STYLE_ID);
        if (!style) {
            style = document.createElement("style");
            style.id = CURSOR_STYLE_ID;
            document.head.appendChild(style);
        }
        style.textContent =
            "html.ns-hide-cursor, html.ns-hide-cursor *, html.ns-hide-cursor *::before, html.ns-hide-cursor *::after," +
            "html.ns-fs, html.ns-fs *, html.ns-fs *::before, html.ns-fs *::after {" +
            'cursor: url("data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), none !important;' +
            "}";
    };

    const removeCursorStyle = () => {
        const node = document.getElementById(CURSOR_STYLE_ID);
        if (node && node.parentNode) node.parentNode.removeChild(node);
        document.documentElement.classList.remove("ns-hide-cursor");
        document.documentElement.style.removeProperty("cursor");
        if (document.body) document.body.style.removeProperty("cursor");
    };

    const applyBlocks = () => {
        stored.onkeydown = document.onkeydown;
        stored.onkeyup = document.onkeyup;
        stored.onkeypress = document.onkeypress;
        stored.oncontextmenu = document.oncontextmenu;
        stored.onmousedown = document.onmousedown;
        stored.onmouseup = document.onmouseup;
        stored.cursor = document.body.style.cursor;

        const blockHandler = function(e) {
            e.preventDefault();
            return false;
        };

        document.onkeydown = blockHandler;
        document.onkeyup = blockHandler;
        document.onkeypress = blockHandler;
        document.oncontextmenu = blockHandler;
        document.onmousedown = blockHandler;
        document.onmouseup = blockHandler;

        hideCursor();
        requestPointerLock();
    };

    const removeBlocks = () => {
        document.onkeydown = stored.onkeydown;
        document.onkeyup = stored.onkeyup;
        document.onkeypress = stored.onkeypress;
        document.oncontextmenu = stored.oncontextmenu;
        document.onmousedown = stored.onmousedown;
        document.onmouseup = stored.onmouseup;
        document.body.style.cursor = stored.cursor;
        removeCursorStyle();
    };

    const ensureBlocks = () => {
        if (supportOpen()) {
            if (blocksActive) {
                removeBlocks();
                blocksActive = false;
            }
            return;
        }
        if (!blocksActive) {
            applyBlocks();
            blocksActive = true;
        }
        lockKeyboard();
        requestPointerLock();
    };

    const blockMouseEvent = (e) => {
        if (!lockActive()) return;
        if (isExemptTarget(e.target) || supportOpen()) return;
        if (windowedLock()) {
            hideCursor();
            requestPointerLock();
            if (!blocksActive) ensureBlocks();
        }
        if (!isFullscreen()) requestFs();
        e.preventDefault();
        e.stopImmediatePropagation();
    };

    const handleKeyDown = (e) => {
        if (e.key === "Escape" || e.code === "Escape") {
            lastEscAt = Date.now();
        }
    };

    const handleClick = (e) => {
        const target = e.target;
        if (isExemptTarget(target)) return;
        if (isFullscreen()) return;
        escExitCount = 0;
        requestFs();
        if (windowedLock()) ensureBlocks();
    };

    const handleFsChange = () => {
        if (isFullscreen()) {
            document.documentElement.classList.add(FS_ACTIVE_CLASS);
            ensureBlocks();
            escExitCount = 0;
            return;
        }

        document.documentElement.classList.remove(FS_ACTIVE_CLASS);

        if (windowedLock()) {
            ensureBlocks();
        } else if (blocksActive) {
            removeBlocks();
            blocksActive = false;
            unlockKeyboard();
        } else {
            unlockKeyboard();
        }

        if (keyboardLockAvailable) return;

        const wasEsc = Date.now() - lastEscAt < 600;
        if (!wasEsc) return;

        escExitCount += 1;
        if (escExitCount < ESC_EXITS_REQUIRED) {
            window.setTimeout(() => {
                if (!isFullscreen()) requestFs();
            }, 30);
        } else {
            escExitCount = 0;
        }
    };

    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKeyDown, true);
    MOUSE_EVENTS.forEach((evt) =>
        window.addEventListener(evt, blockMouseEvent, true),
    );
    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    document.addEventListener("mozfullscreenchange", handleFsChange);
    document.addEventListener("msfullscreenchange", handleFsChange);

    if (windowedLock()) {
        hideCursor();
        ensureBlocks();
        const relock = () => {
            if (supportOpen()) return;
            hideCursor();
            requestPointerLock();
        };
        window.addEventListener("pointerdown", relock, true);
        window.addEventListener("mousedown", relock, true);
        document.addEventListener("pointerlockchange", () => {
            if (document.pointerLockElement || supportOpen()) return;
            hideCursor();
        });
        const support = document.getElementById("spacebar-redirect");
        if (support && typeof MutationObserver === "function") {
            new MutationObserver(ensureBlocks).observe(support, {
                attributes: true,
                attributeFilter: ["class"],
            });
        }
    }
})();