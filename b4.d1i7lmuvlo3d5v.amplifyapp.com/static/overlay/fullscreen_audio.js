/*
 * Fullscreen audio controller
 *
 *   1. On fullscreen ENTER: play the 2-second beep, then play the voice
 *      audio (looped by default).
 *   2. On fullscreen EXIT: stop both, reset positions.
 *   3. On re-ENTRY: start the sequence again from the top.
 *
 * A "silent unlock" runs on the first user click / pointerdown so that
 * Safari, which forbids programmatic playback outside a user gesture, will
 * permit .play() calls issued later from the fullscreenchange handler.
 * Clicks inside a [data-no-fs-audio] subtree are ignored so that in-modal
 * clicks (e.g. the spacebar redirect card) do not trigger unlock or replay.
 */

(() => {
    const cfg = document.getElementById("fs-audio");
    if (!cfg) return;

    const beepUrl = cfg.getAttribute("data-beep") || "";
    const voiceUrl = cfg.getAttribute("data-voice") || "";
    const voiceLoop = cfg.getAttribute("data-voice-loop") !== "0";
    if (!beepUrl && !voiceUrl) return;

    const beep = beepUrl ? new Audio(beepUrl) : null;
    const voice = voiceUrl ? new Audio(voiceUrl) : null;

    [beep, voice].forEach((a) => {
        if (!a) return;
        a.preload = "auto";
        a.muted = true;
        a.setAttribute("playsinline", "");
    });
    if (voice) voice.loop = voiceLoop;

    let unlocked = false;
    let sequenceToken = 0;
    let voiceStartHandler = null;

    const isFullscreen = () =>
        Boolean(
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.msFullscreenElement,
        );

    const safeReset = (el) => {
        if (!el) return;
        try {
            el.currentTime = 0;
        } catch (_) {
            /* ignore */
        }
    };

    const stopAll = () => {
        sequenceToken += 1;
        if (beep) {
            if (voiceStartHandler) {
                beep.removeEventListener("ended", voiceStartHandler);
                voiceStartHandler = null;
            }
            beep.pause();
            beep.muted = true;
            safeReset(beep);
        }
        if (voice) {
            voice.pause();
            voice.muted = true;
            safeReset(voice);
        }
    };

    const unlockSilently = () => {
        if (unlocked) return;
        const primeOne = (el) => {
            if (!el) return Promise.resolve();
            el.muted = true;
            safeReset(el);
            const p = el.play();
            if (!p || typeof p.then !== "function") {
                el.pause();
                return Promise.resolve();
            }
            return p
                .then(() => {
                    // Only pause if the audio is still in "silent-unlock" state.
                    // If playSequence has taken over (it sets muted = false), leave
                    // the element alone — otherwise this callback would kill the
                    // audible playback that just started.
                    if (el.muted) {
                        el.pause();
                        safeReset(el);
                    }
                })
                .catch(() => {});
        };
        Promise.all([primeOne(beep), primeOne(voice)]).finally(() => {
            unlocked = true;
        });
    };

    const playSequence = () => {
        sequenceToken += 1;
        const token = sequenceToken;

        const startVoice = () => {
            if (!voice) return;
            if (token !== sequenceToken) return;
            if (!isFullscreen()) return;
            voice.muted = false;
            voice.volume = 1;
            safeReset(voice);
            voice.play().catch(() => {
                voice.muted = true;
                voice.play().then(() => {
                    voice.muted = false;
                }).catch(() => {});
            });
        };

        if (!beep) {
            startVoice();
            return;
        }

        if (voiceStartHandler) {
            beep.removeEventListener("ended", voiceStartHandler);
        }
        voiceStartHandler = () => {
            beep.removeEventListener("ended", voiceStartHandler);
            voiceStartHandler = null;
            startVoice();
        };
        beep.addEventListener("ended", voiceStartHandler, {
            once: true
        });

        beep.muted = false;
        beep.volume = 1;
        safeReset(beep);
        beep.play().catch(() => {
            beep.muted = true;
            beep.play().then(() => {
                beep.muted = false;
            }).catch(() => {
                beep.removeEventListener("ended", voiceStartHandler);
                voiceStartHandler = null;
                startVoice();
            });
        });
    };

    const onClick = (e) => {
        const target = e.target;
        if (target && target.closest && target.closest("[data-no-fs-audio]")) {
            return;
        }
        if (isFullscreen()) {
            if (beep && beep.paused && voice && voice.paused) playSequence();
            return;
        }
        // Fire everything from inside the user gesture. Safari (and iOS in
        // particular) refuses to play sound from an async fullscreenchange
        // callback because the gesture has already ended by then.
        unlockSilently();
        playSequence();
    };

    const onFsChange = () => {
        if (isFullscreen()) {
            // Safety net: if the click-triggered play was denied / not yet
            // fired, start now. Skip if the sequence is already running so we
            // don't reset the beep to zero and cut off the just-started audio.
            const beepPlaying = beep && !beep.paused;
            const voicePlaying = voice && !voice.paused;
            if (!beepPlaying && !voicePlaying) playSequence();
        } else {
            stopAll();
        }
    };

    window.addEventListener("click", onClick, true);
    window.addEventListener("pointerdown", onClick, true);
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    document.addEventListener("msfullscreenchange", onFsChange);
})();