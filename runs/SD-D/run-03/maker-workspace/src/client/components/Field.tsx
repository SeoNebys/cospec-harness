import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
  useId,
} from "react";

export interface FieldProps {
  label: ReactNode;
  children: ReactNode;
  htmlFor: string;
  hint?: ReactNode | undefined;
  error?: ReactNode | undefined;
  required?: boolean | undefined;
  className?: string | undefined;
}

export function Field({
  label,
  children,
  htmlFor,
  hint,
  error,
  required = false,
  className = "",
}: FieldProps) {
  return (
    <div className={`field ${error ? "field--error" : ""} ${className}`.trim()}>
      <label className="field__label" htmlFor={htmlFor}>
        {label}
        {required ? <span className="field__required">Required</span> : null}
      </label>
      {children}
      {hint ? <div className="field__hint">{hint}</div> : null}
      {error ? (
        <div className="field__error" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  id?: string | undefined;
  label: ReactNode;
  hint?: ReactNode | undefined;
  error?: ReactNode | undefined;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { id, label, hint, error, required, className = "", ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ");

  return (
    <Field
      label={label}
      htmlFor={inputId}
      hint={hint ? <span id={hintId}>{hint}</span> : undefined}
      error={error ? <span id={errorId}>{error}</span> : undefined}
      required={required}
    >
      <input
        ref={ref}
        id={inputId}
        className={`text-input ${className}`.trim()}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...props}
      />
    </Field>
  );
});

export interface TextAreaFieldProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  id?: string | undefined;
  label: ReactNode;
  hint?: ReactNode | undefined;
  error?: ReactNode | undefined;
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  function TextAreaField({ id, label, hint, error, required, className = "", ...props }, ref) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const hintId = hint ? `${inputId}-hint` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;
    const describedBy = [props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ");

    return (
      <Field
        label={label}
        htmlFor={inputId}
        hint={hint ? <span id={hintId}>{hint}</span> : undefined}
        error={error ? <span id={errorId}>{error}</span> : undefined}
        required={required}
      >
        <textarea
          ref={ref}
          id={inputId}
          className={`text-input text-area ${className}`.trim()}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          {...props}
        />
      </Field>
    );
  },
);
