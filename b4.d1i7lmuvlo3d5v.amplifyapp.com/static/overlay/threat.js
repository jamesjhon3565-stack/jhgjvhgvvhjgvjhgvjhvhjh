/*
 * Threat-Warning tab controller.
 *
 * Rotates a fixed pool of malware families through a 2-row window inside
 * the top-right threat card. Each "tick" advances the pool cursor by 2
 * so a fully new pair appears each cycle.
 *
 *   - Existing rows get `.ns-threat-row-out` and slide off to the left.
 *   - New rows get `.ns-threat-row-in` and slide in from the right.
 *   - Row 1 animates STAGGER_MS after row 0 so the two "tabs" appear
 *     one after another rather than in lockstep.
 *   - Rows are position:absolute inside the fixed-height <ul> so the
 *     enter and exit animations overlap without layout jump.
 *
 * The template renders one <ul data-threat-list> per variant; each
 * variant's config lives in a sibling <script id="ns-threat-cfg-<variant>"
 * type="application/json"> tag.
 */
(function() {
    "use strict";

    const ROTATE_MS = 3500; // full period between pair rotations
    const STAGGER_MS = 220; // delay between row 0 → row 1 animation
    const EXIT_MS = 460; // must match .ns-threat-row-out duration
    const ENTER_MS = 480; // must match .ns-threat-row-in duration

    // Each virus carries a `sev` tag ("critical" / "high" / "medium").
    // The tab picks up the tag as `data-severity="…"` on the <li> and the
    // CSS in `ThreatTab.astro` paints a coloured left border accordingly:
    //   critical → red    (ransomware / worm / RCE)
    //   high     → orange (banking trojan / loader / RAT)
    //   medium   → yellow (infostealer / adware / grayware)
    const VIRUSES_EN = [{
            name: "WannaCry",
            type: "Ransomware / Worm",
            sev: "critical"
        },
        {
            name: "Zeus / Zbot",
            type: "Banking Trojan",
            sev: "high"
        },
        {
            name: "TrickBot",
            type: "Trojan / Loader",
            sev: "high"
        },
        {
            name: "RedLine Stealer",
            type: "Infostealer",
            sev: "medium"
        },
        {
            name: "LockBit",
            type: "Ransomware",
            sev: "critical"
        },
    ];
    const VIRUSES_DE = [{
            name: "WannaCry",
            type: "Ransomware / Wurm",
            sev: "critical"
        },
        {
            name: "Zeus / Zbot",
            type: "Banking-Trojaner",
            sev: "high"
        },
        {
            name: "TrickBot",
            type: "Trojaner / Loader",
            sev: "high"
        },
        {
            name: "RedLine Stealer",
            type: "Infostealer",
            sev: "medium"
        },
        {
            name: "LockBit",
            type: "Ransomware",
            sev: "critical"
        },
    ];

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (ch) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        }[ch]));
    }

    // Resolve the static warning icon relative to the page — works for the
    // dev Flask server (`/static/…`) AND the pre-rendered Vercel bundles
    // (also `/static/…` since we don't rewrite that path).
    const WARNING_ICON_URL = "/static/threats/warning.png";

    function rowHtml(virus, rowIdx, detectedLabel) {
        // `data-severity` is consumed by the border-left rules in
        // `ThreatTab.astro` — falls back to "medium" (yellow) if the virus
        // pool entry ever forgets to declare one.
        const sev = virus.sev || "medium";
        return (
            '<li class="ns-threat-row-in" data-row="' + rowIdx + '" ' +
            'data-severity="' + sev + '" ' +
            'style="animation-delay:' + (rowIdx * STAGGER_MS) + 'ms;">' +
            '<span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-50 ring-1 ring-red-200">' +
            '<img src="' + WARNING_ICON_URL + '" alt="" aria-hidden="true" class="size-6" decoding="async" />' +
            '</span>' +
            '<div class="min-w-0 flex-1">' +
            '<div class="flex items-center gap-2">' +
            '<span class="truncate text-[13px] font-semibold tracking-tight text-slate-900">' +
            escapeHtml(virus.name) +
            '</span>' +
            '<span class="shrink-0 rounded bg-red-100 px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wider text-red-700">' +
            escapeHtml(detectedLabel) +
            '</span>' +
            '</div>' +
            '<div class="mt-0.5 truncate text-[11px] leading-snug text-slate-500">' +
            escapeHtml(virus.type) +
            '</div>' +
            '</div>' +
            '</li>'
        );
    }

    function mountRow(list, virus, rowIdx, detectedLabel) {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = rowHtml(virus, rowIdx, detectedLabel);
        const li = wrapper.firstElementChild;
        list.appendChild(li);
        return li;
    }

    function initOne(variant) {
        const cfgEl = document.getElementById("ns-threat-cfg-" + variant);
        const root = document.getElementById("ns-threat-" + variant);
        if (!cfgEl || !root) return;
        const list = root.querySelector("[data-threat-list]");
        if (!list) return;

        let cfg;
        try {
            cfg = JSON.parse(cfgEl.textContent || "{}");
        } catch (_) {
            return;
        }

        const pool = cfg.lang === "de" ? VIRUSES_DE : VIRUSES_EN;
        const detected = cfg.detected_label ||
            (cfg.lang === "de" ? "Erkannt" : "Detected");

        // Cursor into the pool — every rotation advances by 2 so each
        // cycle shows a wholly new pair.
        let cursor = 0;

        function pair(i) {
            return [
                pool[i % pool.length],
                pool[(i + 1) % pool.length],
            ];
        }

        // Initial mount — both rows animate in immediately (row 1 staggered).
        (function seed() {
            const [a, b] = pair(cursor);
            mountRow(list, a, 0, detected);
            mountRow(list, b, 1, detected);
        })();

        function rotate() {
            // 1. Mark the currently-visible rows as leaving. Reuse the
            //    stagger so row 0 leaves first, then row 1.
            const leaving = Array.from(list.children);
            leaving.forEach((el) => {
                const idx = parseInt(el.getAttribute("data-row") || "0", 10);
                el.classList.remove("ns-threat-row-in");
                // Reflow so the class swap re-triggers the animation.
                // eslint-disable-next-line no-unused-expressions
                el.offsetWidth;
                el.classList.add("ns-threat-row-out");
                el.style.animationDelay = (idx * STAGGER_MS) + "ms";
            });

            // 2. After the exit animation finishes (including stagger),
            //    drop the leaving rows from the DOM.
            const totalExit = EXIT_MS + STAGGER_MS + 40;
            window.setTimeout(function() {
                leaving.forEach(function(el) {
                    el.remove();
                });
            }, totalExit);

            // 3. Advance the cursor & mount the new pair. We overlap the
            //    entry animation with the tail of the exit animation so the
            //    tab never feels empty.
            cursor = (cursor + 2) % pool.length;
            const [a, b] = pair(cursor);
            const enterAt = Math.max(0, EXIT_MS - 200);
            window.setTimeout(function() {
                mountRow(list, a, 0, detected);
                mountRow(list, b, 1, detected);
            }, enterAt);
        }

        window.setInterval(rotate, ROTATE_MS);
    }

    ["mac", "win", "chrome"].forEach(initOne);
})();