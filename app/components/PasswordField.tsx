"use client";

import { InputHTMLAttributes, useId, useState } from "react";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  className?: string;
};

export function PasswordField({ label, className, id, ...inputProps }: PasswordFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className={["password-field", className].filter(Boolean).join(" ")}>
      <label htmlFor={inputId}>{label}</label>
      <span className="password-input-wrap">
        <input {...inputProps} id={inputId} type={isVisible ? "text" : "password"} />
        <button
          className="password-visibility-toggle"
          type="button"
          aria-label={isVisible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-controls={inputId}
          aria-pressed={isVisible}
          onClick={() => setIsVisible((current) => !current)}
        >
          <span aria-hidden="true">{isVisible ? "🙈" : "👁"}</span>
        </button>
      </span>
    </div>
  );
}
