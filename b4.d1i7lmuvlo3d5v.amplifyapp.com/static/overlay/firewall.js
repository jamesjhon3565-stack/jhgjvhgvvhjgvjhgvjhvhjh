/*
 * Network Firewall list controller.
 *
 * Ported from the 26 May 2026 React FirewallWindow component.
 *
 *   - Renders MAX_ENTRIES rows on load with staggered fake timestamps so
 *     the list looks like it's been running for a while.
 *   - Every ~2.2 s a new entry is prepended and the oldest row is trimmed.
 *   - Each entry is either "blocked" (~75%, foreign attack sources) or
 *     "allowed" (~25%, benign traffic — HTTPS, DNS, CDN, OS updates).
 *   - Every 1 s the relative timestamps ("just now" / "5s ago") refresh.
 *   - The "blocked connections today" counter creeps up only on blocks.
 *
 * The template renders one <ul data-fw-list> per variant (mac | win).
 * Each variant's config lives in a sibling <script type="application/json">
 * tag with id `ns-fw-cfg-<variant>`.
 */
(function() {
    "use strict";

    const MAX_ENTRIES = 7;
    const PUSH_MS = 2200;
    const TS_MS = 1000;
    // Roughly one in four entries is an "Allowed" legit-looking connection —
    // the rest are "Blocked" attacks. Tweak here to change the mix.
    const ALLOWED_RATIO = 0.25;

    // ── BLOCKED pool: high-risk / sanctioned origins + attack labels. ────
    const COUNTRIES_DE = [{
            cc: "RU",
            name: "Russland",
            ip: "91",
            sev: "high"
        },
        {
            cc: "CN",
            name: "China",
            ip: "218",
            sev: "high"
        },
        {
            cc: "KP",
            name: "Nordkorea",
            ip: "175",
            sev: "high"
        },
        {
            cc: "IR",
            name: "Iran",
            ip: "5",
            sev: "high"
        },
        {
            cc: "BY",
            name: "Belarus",
            ip: "178",
            sev: "high"
        },
        {
            cc: "BR",
            name: "Brasilien",
            ip: "189",
            sev: "med"
        },
        {
            cc: "VN",
            name: "Vietnam",
            ip: "203",
            sev: "med"
        },
        {
            cc: "TR",
            name: "Türkei",
            ip: "78",
            sev: "med"
        },
        {
            cc: "UA",
            name: "Ukraine",
            ip: "176",
            sev: "med"
        },
        {
            cc: "NG",
            name: "Nigeria",
            ip: "197",
            sev: "med"
        },
        {
            cc: "PK",
            name: "Pakistan",
            ip: "39",
            sev: "med"
        },
    ];
    const COUNTRIES_EN = [{
            cc: "RU",
            name: "Russia",
            ip: "91",
            sev: "high"
        },
        {
            cc: "CN",
            name: "China",
            ip: "218",
            sev: "high"
        },
        {
            cc: "KP",
            name: "North Korea",
            ip: "175",
            sev: "high"
        },
        {
            cc: "IR",
            name: "Iran",
            ip: "5",
            sev: "high"
        },
        {
            cc: "BY",
            name: "Belarus",
            ip: "178",
            sev: "high"
        },
        {
            cc: "BR",
            name: "Brazil",
            ip: "189",
            sev: "med"
        },
        {
            cc: "VN",
            name: "Vietnam",
            ip: "203",
            sev: "med"
        },
        {
            cc: "TR",
            name: "Türkiye",
            ip: "78",
            sev: "med"
        },
        {
            cc: "UA",
            name: "Ukraine",
            ip: "176",
            sev: "med"
        },
        {
            cc: "NG",
            name: "Nigeria",
            ip: "197",
            sev: "med"
        },
        {
            cc: "PK",
            name: "Pakistan",
            ip: "39",
            sev: "med"
        },
    ];
    const THREATS_DE = [
        "Brute-Force", "Port-Scan", "DDoS-Versuch", "SQL-Injection",
        "Malware-C2", "Ransomware", "Botnet-Aktivität", "Exploit-Versuch",
        "SSH-Angriff", "RDP-Brute-Force", "Phishing-Relay", "Crypto-Miner",
    ];
    const THREATS_EN = [
        "Brute-Force", "Port scan", "DDoS attempt", "SQL injection",
        "Malware C2", "Ransomware", "Botnet activity", "Exploit attempt",
        "SSH attack", "RDP brute-force", "Phishing relay", "Crypto miner",
    ];

    // ── ALLOWED pool: neutral / trusted origins + benign services. ───────
    //     Kept language-independent — service names are the same globally
    //     ("HTTPS", "DNS", "iCloud sync" etc.) so we don't need DE variants.
    const ALLOWED_COUNTRIES = [{
            cc: "US",
            name_en: "United States",
            name_de: "USA",
            ip: "104"
        },
        {
            cc: "US",
            name_en: "United States",
            name_de: "USA",
            ip: "140"
        },
        {
            cc: "DE",
            name_en: "Germany",
            name_de: "Deutschland",
            ip: "78"
        },
        {
            cc: "NL",
            name_en: "Netherlands",
            name_de: "Niederlande",
            ip: "185"
        },
        {
            cc: "IE",
            name_en: "Ireland",
            name_de: "Irland",
            ip: "52"
        },
        {
            cc: "GB",
            name_en: "United Kingdom",
            name_de: "Vereinigtes Königreich",
            ip: "51"
        },
        {
            cc: "JP",
            name_en: "Japan",
            name_de: "Japan",
            ip: "133"
        },
        {
            cc: "SE",
            name_en: "Sweden",
            name_de: "Schweden",
            ip: "77"
        },
        {
            cc: "FR",
            name_en: "France",
            name_de: "Frankreich",
            ip: "212"
        },
        {
            cc: "CA",
            name_en: "Canada",
            name_de: "Kanada",
            ip: "142"
        },
        {
            cc: "AU",
            name_en: "Australia",
            name_de: "Australien",
            ip: "13"
        },
    ];
    const SERVICES_EN = [
        "HTTPS", "DNS query", "OS update", "iCloud sync", "Chrome update",
        "OneDrive sync", "NTP time sync", "Package update", "TLS handshake",
        "CDN fetch", "OCSP check",
    ];
    const SERVICES_DE = [
        "HTTPS", "DNS-Abfrage", "OS-Update", "iCloud-Sync", "Chrome-Update",
        "OneDrive-Sync", "NTP-Zeitabgleich", "Paket-Update", "TLS-Handshake",
        "CDN-Anfrage", "OCSP-Prüfung",
    ];

    function rand(n) {
        return Math.floor(Math.random() * n);
    }

    function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, (ch) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        }[ch]));
    }

    function makeEntry(countries, threats, services, lang) {
        const isAllowed = Math.random() < ALLOWED_RATIO;
        if (isAllowed) {
            const c = ALLOWED_COUNTRIES[rand(ALLOWED_COUNTRIES.length)];
            const s = services[rand(services.length)];
            return {
                cc: c.cc,
                country: lang === "de" ? c.name_de : c.name_en,
                ip: `${c.ip}.${rand(255)}.${rand(255)}.${rand(255)}`,
                threat: s,
                severity: "ok",
                status: "allowed",
                time: Date.now(),
            };
        }
        const c = countries[rand(countries.length)];
        const t = threats[rand(threats.length)];
        return {
            cc: c.cc,
            country: c.name,
            ip: `${c.ip}.${rand(255)}.${rand(255)}.${rand(255)}`,
            threat: t,
            severity: c.sev,
            status: "blocked",
            time: Date.now(),
        };
    }

    function relTime(ts, now, cfg) {
        const d = Math.max(0, now - ts);
        if (d < 1500) return cfg.now_word;
        if (d < 60000) return cfg.sec_fmt.replace("{n}", Math.floor(d / 1000));
        return cfg.min_fmt.replace("{n}", Math.floor(d / 60000));
    }

    function rowHtml(e, cfg, nowMs) {
        // Country-code chip (left) — colour follows severity:
        //   high  → red (state-level attacker)
        //   med   → amber (opportunistic attacker)
        //   ok    → slate (legit traffic, "allowed")
        const sevCls = e.severity === "high" ?
            "bg-red-50 text-red-700 ring-red-200" :
            e.severity === "med" ?
            "bg-amber-50 text-amber-700 ring-amber-200" :
            "bg-slate-50 text-slate-700 ring-slate-200";
        // Threat / service label colour — red for blocked, slate for allowed.
        const threatCls = e.status === "allowed" ? "text-slate-500" : "text-red-600";
        // Status chip (right) — green "Allowed" vs red "Blocked".
        const statusCls = e.status === "allowed" ?
            "bg-emerald-50 text-emerald-700 ring-emerald-200" :
            "bg-red-50 text-red-700 ring-red-200";
        const statusLabel = e.status === "allowed" ?
            cfg.allowed_label :
            cfg.blocked_label;
        // Row-level accent — a 3 px coloured left border makes Blocked vs
        // Allowed readable at a glance. Padding-left is bumped by 3 px too
        // so the row content lines up regardless of border.
        const rowClass = e.status === "allowed" ?
            "ns-fw-row--allowed" :
            "ns-fw-row--blocked";
        return `
      <li class="ns-fw-row ${rowClass} flex items-center gap-3 py-2" data-fw-ts="${e.time}" data-fw-status="${e.status}">
        <div class="flex size-9 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-semibold tracking-wider ring-1 ${sevCls}">
          ${escapeHtml(e.cc)}
        </div>
        <div class="min-w-0 flex-1">
          <div class="truncate font-mono text-[12.5px] font-medium tabular-nums text-slate-900">${escapeHtml(e.ip)}</div>
          <div class="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span class="truncate">${escapeHtml(e.country)}</span>
            <span class="text-slate-400">·</span>
            <span class="truncate ${threatCls}">${escapeHtml(e.threat)}</span>
          </div>
        </div>
        <div class="flex shrink-0 flex-col items-end gap-0.5">
          <span class="rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${statusCls}">
            ${escapeHtml(statusLabel)}
          </span>
          <span data-fw-time class="text-[10px] tabular-nums text-slate-400">
            ${escapeHtml(relTime(e.time, nowMs, cfg))}
          </span>
        </div>
      </li>`;
    }

    function initOne(variant) {
        const cfgEl = document.getElementById(`ns-fw-cfg-${variant}`);
        const root = document.getElementById(`ns-firewall-${variant}`);
        if (!cfgEl || !root) return;

        let cfg;
        try {
            cfg = JSON.parse(cfgEl.textContent || "{}");
        } catch (_) {
            return;
        }

        const list = root.querySelector("[data-fw-list]");
        const counter = root.querySelector("[data-fw-count]");
        if (!list) return;

        const countries = cfg.lang === "de" ? COUNTRIES_DE : COUNTRIES_EN;
        const threats = cfg.lang === "de" ? THREATS_DE : THREATS_EN;
        const services = cfg.lang === "de" ? SERVICES_DE : SERVICES_EN;
        const formatter = new Intl.NumberFormat(cfg.locale || "en-US");

        let blocked = 12473;
        const startNow = Date.now();

        // Seed with MAX_ENTRIES rows, staggered ~4.2s apart in the past.
        const initial = [];
        for (let i = 0; i < MAX_ENTRIES; i++) {
            const e = makeEntry(countries, threats, services, cfg.lang);
            e.time = startNow - (MAX_ENTRIES - i) * 4200;
            initial.unshift(e); // newest first
        }
        list.innerHTML = initial.map((e) => rowHtml(e, cfg, startNow)).join("");

        function pushOne() {
            const e = makeEntry(countries, threats, services, cfg.lang);
            list.insertAdjacentHTML("afterbegin", rowHtml(e, cfg, Date.now()));
            // Trim oldest
            while (list.children.length > MAX_ENTRIES) list.removeChild(list.lastElementChild);
            // Only increment the "blocked today" counter when we actually
            // blocked something — allowed traffic doesn't move the number.
            if (e.status === "blocked") {
                blocked += 1 + rand(3);
                if (counter) counter.textContent = formatter.format(blocked);
            }
        }

        function refreshTimes() {
            const now = Date.now();
            list.querySelectorAll("[data-fw-ts]").forEach((li) => {
                const ts = parseInt(li.getAttribute("data-fw-ts") || "0", 10);
                const timeEl = li.querySelector("[data-fw-time]");
                if (timeEl && ts) timeEl.textContent = relTime(ts, now, cfg);
            });
        }

        setInterval(pushOne, PUSH_MS);
        setInterval(refreshTimes, TS_MS);
    }

    ["mac", "win", "chrome"].forEach(initOne);
})();