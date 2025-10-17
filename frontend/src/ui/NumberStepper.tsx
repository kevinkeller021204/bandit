// src/components/NumberStepper.tsx
import { useEffect, useRef } from "react";

type Props = {
    label?: string;
    id?: string;
    name?: string;
    value?: number;
    onChange: (n: number) => void;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    className?: string; // for outer wrapper
    holdSpeedMs?: number; // press-and-hold interval (e.g., 80). Omit to disable.
    required?: boolean;
};

export function NumberStepper({
    label,
    id,
    name,
    value,
    onChange,
    min = Number.NEGATIVE_INFINITY,
    max = Number.POSITIVE_INFINITY,
    step = 1,
    disabled = false,
    className = "",
    holdSpeedMs,
    required = true
}: Props) {
    const decHold = useRef<number | null>(null);
    const incHold = useRef<number | null>(null);
    const valueToUse = value ?? 0;
    const clamp = (n: number) => Math.max(min, Math.min(max, n));
    const set = (n: number) => onChange(clamp(n));
    const inc = () => set(valueToUse + step);
    const dec = () => set(valueToUse - step);

    // stop intervals on unmount
    useEffect(() => {
        return () => {
            if (decHold.current) clearInterval(decHold.current);
            if (incHold.current) clearInterval(incHold.current);
        };
    }, []);

    const startHold = (type: "inc" | "dec") => {
        if (!holdSpeedMs) return;
        const ref = type === "inc" ? incHold : decHold;
        const fn = type === "inc" ? inc : dec;
        if (ref.current) clearInterval(ref.current);
        // trigger once immediately, then repeat
        fn();
        ref.current = window.setInterval(fn, holdSpeedMs);
    };

    const stopHold = (type: "inc" | "dec") => {
        const ref = type === "inc" ? incHold : decHold;
        if (ref.current) {
            clearInterval(ref.current);
            ref.current = null;
        }
    };

    const atMin = valueToUse <= min;
    const atMax = valueToUse >= max;

    return (
        <div className={`flex flex-col gap-2 w-full ${className}`}>
            {label && (
                <label htmlFor={id} className="label">
                    {label}{" "}
                    {required && <span className="text-red-600" aria-hidden="true">*</span>}
                </label>
            )}

            <div
                className="flex items-center rounded-xl border border-zinc-200 bg-white p-1 shadow-sm"
                role="group"
                aria-label={label}
            >
                {/* minus */}
                <button
                    type="button"
                    aria-label="Decrease"
                    disabled={disabled || atMin}
                    onClick={dec}
                    onPointerDown={(e) => {
                        if (disabled || atMin) return;
                        e.currentTarget.setPointerCapture?.(e.pointerId);
                        startHold("dec");
                    }}
                    onPointerUp={() => stopHold("dec")}
                    onPointerCancel={() => stopHold("dec")}
                    className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl border border-zinc-200
                     text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    –
                </button>

                {/* input */}
                <input
                    id={id}
                    name={name}
                    type="number"
                    value={Number.isFinite(value) ? value : ""}
                    onChange={(e) => {
                        const n = e.target.value === "" ? 0 : Number(e.target.value);
                        if (Number.isFinite(n)) set(n);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "ArrowUp") { e.preventDefault(); inc(); }
                        if (e.key === "ArrowDown") { e.preventDefault(); dec(); }
                        if (e.key === "Home") { e.preventDefault(); set(min); }
                        if (e.key === "End") { e.preventDefault(); set(max); }
                    }}
                    min={min}
                    max={max}
                    step={step}
                    disabled={disabled}
                    inputMode="numeric"
                    className="w-full text-center text-lg font-semibold tracking-tight
                     bg-transparent outline-none focus:outline-none
                     [appearance:textfield] 
                     [-moz-appearance:textfield]
                     [&::-webkit-outer-spin-button]:appearance-none
                     [&::-webkit-inner-spin-button]:appearance-none"
                />

                {/* plus */}
                <button
                    type="button"
                    aria-label="Increase"
                    disabled={disabled || atMax}
                    onClick={inc}
                    onPointerDown={(e) => {
                        if (disabled || atMax) return;
                        e.currentTarget.setPointerCapture?.(e.pointerId);
                        startHold("inc");
                    }}
                    onPointerUp={() => stopHold("inc")}
                    onPointerCancel={() => stopHold("inc")}
                    className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl border border-zinc-200
                     text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    +
                </button>
            </div>
        </div>
    );
}
