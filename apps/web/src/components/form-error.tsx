import { Notice } from "./ui/notice";

export function FormError({ message }: { message?: string }) {
  return message ? <Notice tone="error">{message}</Notice> : null;
}

export function FormNotice({ message }: { message?: string }) {
  return message ? <Notice>{message}</Notice> : null;
}
