import type { InputHTMLAttributes } from "react";

export function FormField({
  error,
  hint,
  label,
  id,
  ...inputProps
}: InputHTMLAttributes<HTMLInputElement> & {
  error?: string | undefined;
  hint?: string | undefined;
  label: string;
  id: string;
}) {
  const describedBy = [
    hint === undefined ? null : `${id}-hint`,
    error === undefined ? null : `${id}-error`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <label className="form-field" htmlFor={id}>
      <span>{label}</span>
      <input
        {...inputProps}
        id={id}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={describedBy.length === 0 ? undefined : describedBy}
      />
      {hint === undefined ? null : <small id={`${id}-hint`}>{hint}</small>}
      {error === undefined ? null : (
        <small className="form-field__error" id={`${id}-error`} role="alert">
          {error}
        </small>
      )}
    </label>
  );
}
