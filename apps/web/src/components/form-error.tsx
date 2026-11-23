export function FormError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return (
    <p
      role="alert"
      className="rounded-md border border-red-700 bg-red-50 px-3 py-2 text-sm text-red-800"
    >
      {message}
    </p>
  );
}

export function FormNotice({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return (
    <p
      role="status"
      className="rounded-md border border-neutral-400 bg-neutral-50 px-3 py-2 text-sm"
    >
      {message}
    </p>
  );
}
