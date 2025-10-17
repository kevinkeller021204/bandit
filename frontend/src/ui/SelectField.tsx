// src/components/SelectField.tsx
import React, { Dispatch, SetStateAction } from "react";

export type Option = { label: string; value: string; disabled?: boolean };

type Props<T> = {
    label?: string;
    id?: string;
    name?: string;
    value: string;
    onChange: Dispatch<SetStateAction<T>>;
    options: Option[];
    placeholder?: string;
    required?: boolean;
    invalid?: boolean;
    errorText?: string;
    disabled?: boolean;
    className?: string;
    fullWidth?: boolean;
};

export function SelectField<T>({
    label,
    id,
    name,
    value,
    onChange,
    options,
    placeholder,
    required = false,
    invalid = false,
    errorText,
    disabled = false,
    className = "",
    fullWidth = false,
}: Props<T>) {
    const base =
        "appearance-none bg-transparent w-10 h-10 px-3 pr-8 text-sm font-medium text-zinc-900 " +
        "outline-none focus:outline-none";

    const shellBase =
        "relative rounded-xl border bg-white shadow-sm transition " +
        "focus-within:ring-2";
    const shellOk = "border-zinc-200 ring-zinc-400/60";
    const shellBad = "border-red-300 ring-red-300";

    return (
        <div className={`inline-flex flex-col gap-1 ${fullWidth ? "w-full" : ""} ${className}`}>
            {label && (
                <label
                    htmlFor={id}
                    className={`text-sm font-medium ${invalid ? "text-red-700" : "text-zinc-700"}`}
                >
                    {label} {required && <span className="text-red-600" aria-hidden="true">*</span>}
                </label>
            )}

            <div className={`${shellBase} ${invalid ? shellBad : shellOk} ${fullWidth ? "w-full" : ""}`}>
                <select
                    id={id}
                    name={name}
                    value={value}
                    onChange={(e) => onChange(e.target.value as T)}
                    disabled={disabled}
                    required={required}
                    aria-invalid={invalid || undefined}
                    className={base}
                >
                    {placeholder && (
                        <option value="" disabled>
                            {placeholder}
                        </option>
                    )}
                    {options.map((opt) => (
                        <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                            {opt.label}
                        </option>
                    ))}
                </select>

                {/* chevron */}
                <svg
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                >
                    <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" />
                </svg>
            </div>

            {invalid && errorText && <p className="text-sm text-red-600">{errorText}</p>}
        </div>
    );
}
