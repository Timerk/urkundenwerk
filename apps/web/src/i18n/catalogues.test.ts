import { describe, expect, it } from "vitest";
import { FIELD_PATHS } from "../lib/builder/fields";
import { LOCALES } from "./locale";
import { MESSAGES } from "./messages";

type Tree = { readonly [key: string]: string | Tree };

/** Every message as `[dotted.key, text]`. */
function leaves(tree: Tree, prefix = ""): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string"
      ? [[`${prefix}${key}`, value] as [string, string]]
      : leaves(value, `${prefix}${key}.`),
  );
}

/** The argument names of an ICU message, e.g. `count` and `field`. */
function argumentsOf(message: string): string[] {
  const names = new Set<string>();
  for (const [, name] of message.matchAll(/\{\s*([a-zA-Z]+)\s*[,}]/g)) {
    names.add(name!);
  }
  // Rich-text tags such as <code>…</code> are arguments too.
  for (const [, tag] of message.matchAll(/<([a-zA-Z]+)>/g)) names.add(tag!);
  return [...names].sort();
}

const de = new Map(leaves(MESSAGES.de as Tree));
const en = new Map(leaves(MESSAGES.en as Tree));

describe("message catalogues", () => {
  it("have identical keys in German and English", () => {
    expect([...de.keys()].sort()).toEqual([...en.keys()].sort());
  });

  it.each(LOCALES)("have no empty messages in %s", (locale) => {
    const empty = leaves(MESSAGES[locale] as Tree)
      .filter(([, text]) => text.trim() === "")
      .map(([key]) => key);
    expect(empty).toEqual([]);
  });

  it("use the same ICU arguments in both languages", () => {
    const mismatched = [...en].filter(
      ([key, text]) =>
        JSON.stringify(argumentsOf(text)) !==
        JSON.stringify(argumentsOf(de.get(key) ?? "")),
    );
    expect(mismatched.map(([key]) => key)).toEqual([]);
  });

  it("name every field of the builder in both languages", () => {
    for (const path of FIELD_PATHS) {
      for (const part of ["label", "blank"]) {
        expect(en.get(`fields.${path}.${part}`), path).toBeTruthy();
        expect(de.get(`fields.${path}.${part}`), path).toBeTruthy();
      }
    }
  });

  it("show the disclaimer in both languages", () => {
    expect(de.get("common.demoNotice")).toBe(
      "Demonstrationsprojekt. Keine Rechtsberatung. Nur fiktive Daten.",
    );
    expect(en.get("common.demoNotice")).toBe(
      "Demonstration project. Not legal advice. Uses fictional data only.",
    );
  });
});
