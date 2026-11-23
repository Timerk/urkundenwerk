import { checkMusterprotokoll } from "@urkundenwerk/core";
import { describe, expect, it } from "vitest";
import {
  exampleCase,
  exampleContext,
  exampleEntity,
} from "../../../core/src/templates/musterprotokoll-einpersonen/fixtures";
import { FAKE_MODEL, FakeLlmClient, type FakeResponse } from "../fake";
import { LruCache } from "../lru";
import { toExplanationItems } from "./payload";
import { PROMPT_VERSION } from "./prompt";
import {
  type CachedExplanation,
  explainIssues,
  fakeExplanationResponder,
  sentenceCount,
} from "./service";

const templateId = "musterprotokoll-einpersonen";
const model = "claude-haiku-5-5";

// A fictional draft with personal data in every text field, and three issues.
const draft = {
  ...exampleCase,
  founder: { ...exampleEntity, name: "Geheimname Holding GmbH" },
  company: {
    ...exampleCase.company,
    name: "Vertraulich Software GmbH",
    purpose: "Handel mit Waren aller Art",
  },
  shareCapitalCents: 2_000_000,
};
const issues = checkMusterprotokoll(draft, exampleContext);

const answer = (code: string, explanation = `Explains ${code}.`) => ({
  code,
  explanation,
  suggestedFix: `Fix ${code}.`,
});

function explainWith(
  responses: FakeResponse[],
  cache?: LruCache<CachedExplanation>,
) {
  const client = FakeLlmClient.scripted(responses);
  return {
    client,
    run: () => explainIssues(issues, { templateId, client, model, cache }),
  };
}

it("has the issues the tests rely on", () => {
  expect(issues.map((issue) => issue.code)).toEqual([
    "gmbh_capital_minimum",
    "director_founder_natural_person",
    "company_purpose_specific",
  ]);
});

describe("explainIssues", () => {
  it("returns the model's explanations with model and prompt version", async () => {
    const { run } = explainWith([
      {
        kind: "output",
        output: {
          explanations: issues.map((issue) => answer(issue.code)),
        },
      },
    ]);

    const result = await run();

    expect(result).toMatchObject({
      model: FAKE_MODEL,
      promptVersion: PROMPT_VERSION,
      failure: null,
    });
    expect(result.explanations).toEqual(
      issues.map((issue) => ({
        code: issue.code,
        params: issue.params,
        explanation: `Explains ${issue.code}.`,
        suggestedFix: `Fix ${issue.code}.`,
        source: "model",
      })),
    );
  });

  it("sends only rule facts and non-personal params", async () => {
    const { run, client } = explainWith([{ kind: "error", error: "refused" }]);
    await run();

    const sent = client.requests[0]!;
    const text = `${sent.system}\n${sent.user}`;
    for (const personal of [
      "Geheimname",
      "Vertraulich",
      "Mustermann",
      "Erika",
      "Musterstadt",
      "HRB 12345",
      "1990",
      "Handel mit Waren",
    ]) {
      expect(text).not.toContain(personal);
    }
    expect(sent).toMatchObject({ task: "explain", model, effort: "low" });
    expect(sent.user).toContain('"legalReference": "§ 5 Abs. 1 GmbHG"');
    expect(sent.user).toContain('"shareCapitalCents": 2000000');
  });

  it("builds the payload from the registry and ignores other fields", () => {
    const items = toExplanationItems(templateId, [
      {
        code: "gmbh_capital_minimum",
        params: { shareCapitalCents: 100 },
        // Not part of the type, but present on real issues and on hostile input.
        ...({ message: "Erika Mustermann", paths: ["company.name"] } as object),
      },
      { code: "not_a_rule", params: {} },
      {
        code: "company_purpose_specific",
        params: { note: "x" as unknown as number },
      },
    ]);

    expect(items).toEqual([
      {
        code: "gmbh_capital_minimum",
        severity: "error",
        legalReference: "§ 5 Abs. 1 GmbHG",
        summary: expect.any(String),
        params: { shareCapitalCents: 100 },
      },
    ]);
  });

  it("falls back to the rule summary when the output is invalid", async () => {
    const { run } = explainWith([
      { kind: "output", output: { explanations: "not a list" } },
    ]);

    const result = await run();

    expect(result.failure).toBe("invalid_output");
    expect(result.model).toBeNull();
    expect(result.explanations.every((entry) => entry.source === "rule")).toBe(
      true,
    );
    expect(result.explanations[0]).toMatchObject({
      explanation: expect.stringContaining("at least 25,000 euros"),
      suggestedFix: null,
    });
  });

  it("drops entries for codes it did not ask about", async () => {
    const { run } = explainWith([
      {
        kind: "output",
        output: {
          explanations: [
            answer("field_required"),
            answer("gmbh_capital_minimum"),
            answer("gmbh_capital_minimum", "A second answer is ignored."),
          ],
        },
      },
    ]);

    const result = await run();

    expect(result.explanations.map((entry) => entry.code)).toEqual(
      issues.map((issue) => issue.code),
    );
    expect(result.explanations[0]).toMatchObject({
      explanation: "Explains gmbh_capital_minimum.",
      source: "model",
    });
    expect(result.explanations.slice(1).map((entry) => entry.source)).toEqual(
      issues.slice(1).map(() => "rule"),
    );
    expect(result.failure).toBe("rejected_entries");
  });

  it("rejects explanations longer than three sentences", async () => {
    const { run } = explainWith([
      {
        kind: "output",
        output: {
          explanations: [
            answer("gmbh_capital_minimum", "One. Two. Three. Four."),
          ],
        },
      },
    ]);

    const result = await run();

    expect(result.explanations[0]?.source).toBe("rule");
  });

  it.each(["refused", "timeout", "unavailable"] as const)(
    "falls back when the call fails with %s",
    async (error) => {
      const { run } = explainWith([{ kind: "error", error }]);
      const result = await run();
      expect(result.failure).toBe(error);
      expect(result.explanations).toHaveLength(issues.length);
    },
  );

  it("falls back without calling anything when AI is disabled", async () => {
    const result = await explainIssues(issues, {
      templateId,
      client: null,
      model,
    });
    expect(result).toMatchObject({ model: null, failure: "disabled" });
  });

  it("serves repeated issues from the cache", async () => {
    const cache = new LruCache<CachedExplanation>(10);
    const output: FakeResponse = {
      kind: "output",
      output: { explanations: issues.map((issue) => answer(issue.code)) },
    };
    const { run, client } = explainWith([output], cache);

    await run();
    const second = await run();

    expect(client.requests).toHaveLength(1);
    expect(second.explanations.every((entry) => entry.source === "model")).toBe(
      true,
    );
    // The model that answered, not the configured id.
    expect(second.model).toBe(FAKE_MODEL);
  });

  it("works with the scripted responder used in end-to-end tests", async () => {
    const result = await explainIssues(issues, {
      templateId,
      client: new FakeLlmClient(fakeExplanationResponder),
      model,
    });
    expect(result.failure).toBeNull();
    expect(result.explanations[0]?.explanation).toMatch(
      /^Scripted explanation for local testing\. A GmbH needs/,
    );
  });
});

describe("sentenceCount", () => {
  it.each([
    ["One sentence.", 1],
    ["Under § 5 Abs. 1 GmbHG the minimum is 25,000 €. Raise it.", 2],
    ["One. Two! Three? Four.", 4],
    ["No full stop", 1],
  ])("counts %j as %i", (text, count) => {
    expect(sentenceCount(text)).toBe(count);
  });
});
