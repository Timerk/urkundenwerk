type FormFieldProps = {
  name: string;
  label: string;
  type?: "text" | "email" | "password";
  autoComplete: string;
  defaultValue?: string;
  errors?: string[];
  minLength?: number;
  maxLength?: number;
};

export function FormField({
  name,
  label,
  type = "text",
  autoComplete,
  defaultValue,
  errors,
  minLength,
  maxLength,
}: FormFieldProps) {
  const id = `field-${name}`;
  const errorId = `${id}-error`;
  const hasError = Boolean(errors?.length);

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        required
        minLength={minLength}
        maxLength={maxLength}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : undefined}
        className="block w-full rounded-md border border-neutral-400 px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 aria-invalid:border-red-700"
      />
      {hasError ? (
        <p id={errorId} className="text-sm text-red-700">
          {errors?.join(" ")}
        </p>
      ) : null}
    </div>
  );
}
