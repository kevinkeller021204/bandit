// src/components/SegmentedToggle.tsx
import React, { Dispatch, SetStateAction, useCallback } from "react";

export type ToggleOption = { label: string; value: string; disabled?: boolean };

type Props<T> = {
    label?: string;
    id?: string;
    value: string;
    onChange: Dispatch<SetStateAction<T>>;
    options: ToggleOption[];          // e.g., [{label:'Bernoulli', value:'bernoulli'}, ...]
    disabled?: boolean;
    className?: string;
    size?: "sm" | "md" | "lg";
    required?: boolean
};

export function SegmentedToggle<T>({
    label,
    id,
    value,
    onChange,
    options,
    disabled = false,
    className = "",
    size = "md",
    required = true
}: Props<T>) {
    const sizes = {
        sm: { h: "h-8", px: "px-3", text: "text-sm", gap: "gap-1", r: "rounded-lg" },
        md: { h: "h-9", px: "px-3.5", text: "text-sm", gap: "gap-1.5", r: "rounded-xl" },
        lg: { h: "h-10", px: "px-4", text: "text-sm", gap: "gap-2", r: "rounded-xl" },
    }[size];

    const selectNext = useCallback(
        (dir: 1 | -1) => {
            const enabled = options.filter(o => !o.disabled);
            const idx = Math.max(0, enabled.findIndex(o => o.value === value));
            const next = enabled[(idx + (dir === 1 ? 1 : enabled.length - 1)) % enabled.length];
            onChange(next.value as T);
        },
        [options, value, onChange]
    );

    return (
        <div className={`flex flex-col gap-1 ${className}`}>
            {label && (
                <span className="label">{label}{" "}
                    {required && <span className="text-red-600" aria-hidden="true">*</span>}
                </span>
            )}

            <div
                id={id}
                role="radiogroup"
                aria-label={label}
                className={`flex ${sizes.gap} items-center rounded-xl border border-zinc-200 bg-white p-1 shadow-sm`}
                onKeyDown={(e) => {
                    if (disabled) return;
                    if (e.key === "ArrowRight") { e.preventDefault(); selectNext(1); }
                    if (e.key === "ArrowLeft") { e.preventDefault(); selectNext(-1); }
                }}
            >
                {options.map((opt, i) => {
                    const isActive = value === opt.value;
                    return (
                        <button
                            key={opt.value}
                            role="radio"
                            aria-checked={isActive}
                            type="button"
                            disabled={disabled || opt.disabled}
                            onClick={() => !opt.disabled && onChange(opt.value as T)}
                            className={[
                                "inline-flex items-center justify-center select-none border transition w-full",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60",
                                "disabled:opacity-40 disabled:cursor-not-allowed",
                                sizes.h, sizes.px, sizes.text, "rounded-xl",
                                // subtle styles
                                isActive
                                    ? [
                                        "bg-white text-zinc-900",       // no dark fill
                                        "border-zinc-500",              // keep border
                                        "shadow-sm ring-1 ring-zinc-600"// gentle elevation + ring
                                    ].join(" ")
                                    : [
                                        "bg-transparent text-zinc-700",
                                        "border-transparent",
                                        "hover:bg-zinc-50"
                                    ].join(" "),
                            ].join(" ")}
                        >
                            {opt.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
