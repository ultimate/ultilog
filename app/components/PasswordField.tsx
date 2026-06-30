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
    <label className={className} htmlFor={inputId}>
      {label}
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
    </label>
  );
}
