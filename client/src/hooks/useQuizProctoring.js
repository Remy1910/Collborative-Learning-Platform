import { useState, useEffect, useCallback, useRef } from "react";
import { quizAPI } from "../utils/api";

const MAX_VIOLATIONS = 3;
const DEBOUNCE_MS = 400; // coalesce near-simultaneous events (e.g. Escape-exit-fullscreen + blur firing together)

export function useQuizProctoring({ responseId, active, onTerminated }) {
    const [violations, setViolations] = useState(0);
    const [warning, setWarning] = useState(null); // { reason, count } or null
    const lastViolationTime = useRef(0);

    const logToServer = useCallback(async (reason) => {
        if (!responseId) return;
        try {
            const data = await quizAPI.logViolation(responseId, { reason });
            setViolations(data.violationCount);
            setWarning({ reason, count: data.violationCount });
            if (data.terminated && onTerminated) {
                onTerminated();
            }
        } catch (err) {
            console.error("Failed to log violation:", err);
            // Still show a local warning even if the network call failed —
            // better to over-warn the student than silently miss it.
            setWarning({ reason, count: violations + 1 });
        }
    }, [responseId, onTerminated, violations]);

    const registerViolation = useCallback((reason) => {
        const now = Date.now();
        if (now - lastViolationTime.current < DEBOUNCE_MS) return;
        lastViolationTime.current = now;
        logToServer(reason);
    }, [logToServer]);

    const requestFullscreen = useCallback(async () => {
        try {
            const el = document.documentElement;
            if (el.requestFullscreen) await el.requestFullscreen();
            else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
            else if (el.msRequestFullscreen) await el.msRequestFullscreen();
        } catch (err) {
            console.error("Failed to enter fullscreen:", err);
        }
    }, []);

    const exitFullscreen = useCallback(async () => {
        try {
            if (document.fullscreenElement && document.exitFullscreen) {
                await document.exitFullscreen();
            }
        } catch {
            // already out of fullscreen — ignore
        }
    }, []);

    useEffect(() => {
        if (!active) return;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                registerViolation("Tab switched or window minimized");
            }
        };

        const handleFullscreenChange = () => {
            if (!document.fullscreenElement) {
                registerViolation("Exited fullscreen mode");
            }
        };

        const handleBlur = () => {
            if (!document.hidden) {
                registerViolation("Quiz window lost focus");
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        window.addEventListener("blur", handleBlur);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
            window.removeEventListener("blur", handleBlur);
        };
    }, [active, registerViolation]);

    return {
        violations,
        maxViolations: MAX_VIOLATIONS,
        warning,
        clearWarning: () => setWarning(null),
        requestFullscreen,
        exitFullscreen,
    };
}