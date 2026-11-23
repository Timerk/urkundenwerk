import { Field, TextInput } from "./ui/field";

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
  return (
    <Field
      id={`field-${name}`}
      label={label}
      error={errors?.length ? errors.join(" ") : undefined}
    >
      {(ids) => (
        <TextInput
          ids={ids}
          name={name}
          type={type}
          autoComplete={autoComplete}
          defaultValue={defaultValue}
          required
          minLength={minLength}
          maxLength={maxLength}
        />
      )}
    </Field>
  );
}
