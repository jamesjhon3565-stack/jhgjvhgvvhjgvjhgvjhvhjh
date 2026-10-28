/*
 * Antivirus scanner controller.
 *
 * Cycles the "currently scanning" file-path label, ticks the
 * files-scanned counter every 200-400 ms, and occasionally bumps the
 * threats-found counter. The visual progress bar is a pure CSS loop.
 *
 * Two independent instances live on the page (one per variant) so that
 * the mac + win templates can both be rendered during dev without
 * fighting for the same DOM IDs.
 */
(function() {
    "use strict";

    const MAC_PATHS = [
        "/System/Library/Frameworks/AppKit.framework/Resources/Info.plist",
        "/System/Library/Extensions/AppleUSBEthernet.kext",
        "/usr/local/bin/brew",
        "/usr/lib/dyld",
        "/Applications/Safari.app/Contents/MacOS/Safari",
        "/Applications/Utilities/Terminal.app",
        "/Library/LaunchDaemons/com.apple.softwareupdated.plist",
        "/private/var/log/system.log",
        "~/Library/Caches/com.apple.Safari/Cache.db",
        "~/Library/Application Support/Mail/V10/MailData",
        "~/Downloads/installer.pkg",
        "~/Documents/backup.dmg",
        "/System/Library/CoreServices/Finder.app",
        "/usr/sbin/networksetup",
        "~/Library/Preferences/com.apple.dock.plist",
    ];
    const WIN_PATHS = [
        "C:\\Windows\\System32\\drivers\\ntfs.sys",
        "C:\\Windows\\System32\\svchost.exe",
        "C:\\Windows\\SysWOW64\\kernel32.dll",
        "C:\\Program Files\\Windows Defender\\MsMpEng.exe",
        "C:\\Users\\User\\AppData\\Roaming\\Microsoft\\Windows\\Recent",
        "C:\\Users\\User\\AppData\\Local\\Temp\\install_setup.exe",
        "C:\\Users\\User\\Downloads\\update.exe",
        "C:\\ProgramData\\Microsoft\\Windows\\WER\\ReportQueue",
        "C:\\Windows\\WinSxS\\amd64_microsoft-windows-security",
        "C:\\Windows\\System32\\config\\SOFTWARE",
        "C:\\Users\\User\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Cookies",
        "C:\\Windows\\System32\\wbem\\wmic.exe",
        "C:\\Program Files (x86)\\Common Files\\Adobe\\ARM",
        "C:\\Windows\\Prefetch\\SVCHOST.EXE-2F7F1A5B.pf",
    ];

    function rand(n) {
        return Math.floor(Math.random() * n);
    }

    function initOne(variant) {
        const root = document.getElementById(`ns-av-${variant}`);
        const cfgEl = document.getElementById(`ns-av-cfg-${variant}`);
        if (!root || !cfgEl) return;

        let cfg = {};
        try {
            cfg = JSON.parse(cfgEl.textContent || "{}");
        } catch (_) { /* keep defaults */ }

        const pathEl = root.querySelector("[data-av-path]");
        const filesEl = root.querySelector("[data-av-files]");
        const threatsEl = root.querySelector("[data-av-threats]");
        const paths = variant === "mac" ? MAC_PATHS : WIN_PATHS;
        const fmt = new Intl.NumberFormat(cfg.locale || "en-US");

        let files = 0;
        let threats = 0;

        function tick() {
            if (pathEl) pathEl.textContent = paths[rand(paths.length)];

            files += 3 + rand(8);
            if (filesEl) filesEl.textContent = fmt.format(files);

            // ~15 % chance of finding a threat per tick, capped so the number
            // stays believable.
            if (Math.random() < 0.15 && threats < 42) {
                threats += 1;
                if (threatsEl) threatsEl.textContent = fmt.format(threats);
            }
        }

        tick();
        // Throttled well below the repaint budget. The old 260-440ms cadence
        // rewrote the scanning path fast enough to force a full re-blur of the
        // scanner window on every tick, which strobed the page on weaker GPUs.
        setInterval(tick, 1600 + rand(900));
    }

    ["mac", "win", "chrome"].forEach(initOne);
})();