import type { Locale } from "../locale";
import { de } from "./de";
import { en, type Messages } from "./en";

export type { Messages };

export const MESSAGES: Record<Locale, Messages> = { de, en };
