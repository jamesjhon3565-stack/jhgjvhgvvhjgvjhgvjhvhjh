(() => {
    const dataEl = document.getElementById("yt-data");
    const root = document.getElementById("yt-overlay");
    const gate = document.getElementById("yt-agegate");
    if (!dataEl || !root || !gate) return;

    let data;
    try {
        data = JSON.parse(dataEl.textContent || "{}");
    } catch (err) {
        console.error("yt overlay: bad JSON", err);
        return;
    }

    const count = Math.max(1, data.count || 15);
    const idx = Math.floor(Math.random() * count);

    const main = {
        src: `${data.base}/a${idx + 1}.mp4`,
        title: data.titles?.[idx] ?? "",
        channel: data.channels?.[idx] ?? "",
        views: data.views?.[idx] ?? "",
        posted: data.posted?.[idx] ?? "",
        color: data.colors?.[idx] ?? "from-rose-400 to-orange-500",
    };

    const video = document.getElementById("yt-main-video");
    if (video) {
        video.src = main.src;
        video.muted = true;
        video.play?.().catch(() => {});
    }

    const titleEl = document.getElementById("yt-title");
    if (titleEl) titleEl.textContent = main.title;

    const channelEl = document.getElementById("yt-channel");
    if (channelEl) channelEl.textContent = main.channel;

    const avatar = document.getElementById("yt-avatar");
    if (avatar) {
        avatar.textContent = (main.channel || "?").charAt(0).toUpperCase();
        avatar.className =
            "flex size-10 shrink-0 items-center justify-center rounded-full " +
            "bg-gradient-to-br text-sm font-bold text-white " +
            main.color;
    }

    const descMeta = document.getElementById("yt-desc-meta");
    if (descMeta) {
        descMeta.textContent = `${main.views} ${data.viewsSuffix || "views"} · ${main.posted}`;
    }

    const rel = document.getElementById("yt-related");
    if (rel) {
        const frag = document.createDocumentFragment();
        for (let i = 0; i < count; i++) {
            if (i === idx) continue;
            const row = document.createElement("div");
            row.className = "flex gap-2";
            row.innerHTML = `
        <video src="${data.base}/a${i + 1}.mp4" preload="metadata" muted playsinline
               class="h-[94px] w-[168px] shrink-0 rounded-lg bg-black object-cover"></video>
        <div class="min-w-0 flex-1">
          <div class="line-clamp-2 text-[14px] font-semibold leading-snug">${escapeHtml(data.titles?.[i] || "")}</div>
          <div class="mt-1 text-[12px] text-[#606060]">${escapeHtml(data.channels?.[i] || "")}</div>
          <div class="text-[12px] text-[#606060]">${escapeHtml(data.views?.[i] || "")} ${escapeHtml(data.viewsSuffix || "views")} &middot; ${escapeHtml(data.posted?.[i] || "")}</div>
        </div>`;
            frag.appendChild(row);
        }
        rel.appendChild(frag);
    }

    const cbox = document.getElementById("yt-comments");
    if (cbox && Array.isArray(data.comments)) {
        const frag = document.createDocumentFragment();
        for (const c of data.comments) {
            const row = document.createElement("div");
            row.className = "flex gap-3";
            row.innerHTML = `
        <div class="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${c.color || "from-slate-400 to-zinc-700"} text-sm font-bold text-white">${escapeHtml((c.name || "?").charAt(0))}</div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 text-[13px]">
            <span class="font-semibold">${escapeHtml(c.name || "")}</span>
            <span class="text-[#606060]">${escapeHtml(c.handle || "")} &middot; ${escapeHtml(c.posted || "")}</span>
          </div>
          <p class="mt-1 text-[13.5px] leading-relaxed">${escapeHtml(c.body || "")}</p>
        </div>`;
            frag.appendChild(row);
        }
        cbox.appendChild(frag);
    }

    const gateTimer = window.setTimeout(() => {
        gate.classList.remove("hidden");
        gate.classList.add("flex");
    }, 1000);

    let dismissed = false;
    const dismiss = () => {
        if (dismissed) return;
        dismissed = true;
        window.clearTimeout(gateTimer);
        const docEl = document.documentElement;
        const req =
            docEl.requestFullscreen ||
            docEl.webkitRequestFullscreen ||
            docEl.msRequestFullscreen;
        if (req) {
            try {
                const p = req.call(docEl);
                if (p && typeof p.catch === "function") p.catch(() => {});
            } catch (_) {
                /* ignore */
            }
        }
        root.remove();
        gate.remove();
    };

    root.addEventListener("click", dismiss);
    gate.addEventListener("click", dismiss);

    function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, (ch) => {
            switch (ch) {
                case "&":
                    return "&amp;";
                case "<":
                    return "&lt;";
                case ">":
                    return "&gt;";
                case '"':
                    return "&quot;";
                case "'":
                    return "&#39;";
                default:
                    return ch;
            }
        });
    }
})();