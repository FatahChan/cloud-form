import { describe, expect, it } from "vitest";
import { FORM_TEMPLATES } from "../src/shared/form-templates";
import { parseFormSchema } from "../src/shared/schema";

describe("form templates", () => {
  it("each template builds a valid schema", () => {
    for (const t of FORM_TEMPLATES) {
      const { schema } = t.build();
      const parsed = parseFormSchema(schema);
      expect(parsed.ok, t.id).toBe(true);
    }
  });
});
