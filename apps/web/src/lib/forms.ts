import { type FormEvent, startTransition } from "react";

/**
 * Submits a form to an action from `useActionState` without React's
 * automatic form reset. React resets a form after its `action` runs, which
 * empties fields after a failed submission and leaves controlled radios and
 * selects out of step with what they show. The submit button's name and
 * value are kept, so `intent` buttons still work.
 */
export function submitKeepingValues(action: (form: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const form = new FormData(event.currentTarget, submitter);
    startTransition(() => action(form));
  };
}
