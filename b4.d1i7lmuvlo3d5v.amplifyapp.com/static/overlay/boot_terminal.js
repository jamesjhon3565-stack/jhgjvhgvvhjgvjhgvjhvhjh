/*
 * Boot terminal / cmd overlay.
 *
 * On every fullscreenchange -> ENTER, reveal the terminal / cmd panel,
 * stream its scripted lines (one every ~220 ms), and auto-hide it after
 * SHOW_DURATION_MS (4 s). Also hides immediately on fullscreen EXIT so
 * it can't be seen once fullscreen has been left.
 */
(function() {
    "use strict";

    const SHOW_DURATION_MS = 4000;
    const LINE_INTERVAL_MS = 220;

    const MAC_LINES = [
        "Last login: Wed Aug 19 19:12:41 on ttys001",
        "user@MacBook-Pro ~ % sudo system_diagnostic --verbose",
        "Password: ********",
        "[1/9] Initializing kernel diagnostic ...",
        "[2/9] Scanning system integrity (SIP) ...",
        "[3/9] Checking T2 Security Chip ...",
        "[4/9] Verifying network firewall ...",
        "[5/9] Loading XProtect signatures ...",
        "[6/9] Mounting /dev/disk1s1 (APFS) ...",
        "[7/9] Auditing loaded kernel extensions ...",
        "[8/9] Sampling running processes (top -l 1) ...",
        "[9/9] Generating diagnostic report ...",
        "WARNING: 17 anomalies detected — see /var/log/system.log",
        "user@MacBook-Pro ~ % tail -f /var/log/system.log",
        "[net] 192.168.1.42 -> remote.apple-support.com:443 OK",
    ];
    const WIN_LINES = [
        "Microsoft Windows [Version 11.0.26100.2454]",
        "(c) Microsoft Corporation. All rights reserved.",
        "",
        "C:\\Users\\User>systemcheck /full /verbose",
        "Initializing Windows Security diagnostic ...",
        "[1/9] Checking system file integrity (sfc.exe) ...",
        "[2/9] Scanning with Defender Engine 1.1.24090.11 ...",
        "[3/9] Verifying Windows Firewall rules ...",
        "[4/9] Inspecting HKLM\\SYSTEM\\CurrentControlSet ...",
        "[5/9] Auditing scheduled tasks ...",
        "[6/9] Checking driver signatures ...",
        "[7/9] Reading event log (Application.evtx) ...",
        "[8/9] Sampling running processes (tasklist) ...",
        "[9/9] Compiling diagnostic report ...",
        "WARNING: 23 anomalies detected — see C:\\Windows\\Logs\\report.log",
        "C:\\Users\\User>tracert remote-support.microsoft.com",
    ];
    const CHROME_LINES = [
        "Welcome to crosh, the Chrome OS developer shell.",
        "If you got here by mistake, don't panic!  Just close this tab and carry on.",
        "",
        "crosh> systemcheck --full --verbose",
        "Initializing ChromeOS diagnostic ...",
        "[1/9] Verifying verified boot signature ...",
        "[2/9] Reading dmesg | grep -i tpm ...",
        "[3/9] Auditing Chrome sandbox ...",
        "[4/9] Checking network profile (mesa: iwlwifi) ...",
        "[5/9] Scanning Google Account backup state ...",
        "[6/9] Auditing extensions in ~/.config/chrome ...",
        "[7/9] Reading /var/log/messages ...",
        "[8/9] Sampling running processes (top -b -n1) ...",
        "[9/9] Compiling diagnostic report ...",
        "WARNING: 12 anomalies detected — see /var/log/chrome/diagnostic.log",
        "crosh> ping google.com",
    ];

    const CURSOR = '<span class="ml-0.5 inline-block h-[14px] w-[8px] -translate-y-[1px] animate-pulse bg-white align-middle"></span>';

    const isFullscreen = () =>
        Boolean(
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement,
        );

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        }[c]));
    }

    const LINES_BY_VARIANT = {
        mac: MAC_LINES,
        win: WIN_LINES,
        chrome: CHROME_LINES
    };
    ["mac", "win", "chrome"].forEach((variant) => {
        const root = document.getElementById(`ns-boot-${variant}`);
        const body = document.getElementById(`ns-boot-body-${variant}`);
        if (!root || !body) return;

        const lines = LINES_BY_VARIANT[variant];
        let lineTimer = null;
        let hideTimer = null;
        let visible = 0;

        const render = () => {
            const rendered = lines
                .slice(0, visible)
                .map((l) => escapeHtml(l || "\u00A0"))
                .join("\n");
            body.innerHTML = rendered + CURSOR;
        };

        const show = () => {
            visible = 0;
            body.innerHTML = CURSOR;
            root.classList.remove("hidden");
            root.classList.add("flex");
            root.setAttribute("data-boot-open", "1");

            if (lineTimer) window.clearInterval(lineTimer);
            lineTimer = window.setInterval(() => {
                if (visible < lines.length) {
                    visible += 1;
                    render();
                }
            }, LINE_INTERVAL_MS);

            if (hideTimer) window.clearTimeout(hideTimer);
            hideTimer = window.setTimeout(hide, SHOW_DURATION_MS);
        };

        const hide = () => {
            if (lineTimer) {
                window.clearInterval(lineTimer);
                lineTimer = null;
            }
            if (hideTimer) {
                window.clearTimeout(hideTimer);
                hideTimer = null;
            }
            root.classList.add("hidden");
            root.classList.remove("flex");
            root.removeAttribute("data-boot-open");
        };

        const onFs = () => {
            if (isFullscreen()) show();
            else hide();
        };

        document.addEventListener("fullscreenchange", onFs);
        document.addEventListener("webkitfullscreenchange", onFs);
        document.addEventListener("mozfullscreenchange", onFs);
        document.addEventListener("msfullscreenchange", onFs);
    });
})();