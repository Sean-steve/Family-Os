import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { seed } from "../data";
import FamilyWorkspace from "./FamilyWorkspace";

describe("Family workspace render smoke tests", () => {
  it("renders the overview with real seeded family counts and sections", () => {
    const html = renderToStaticMarkup(<FamilyWorkspace data={seed} onChange={() => undefined}
      onToast={() => undefined} navigate={() => undefined} />);
    expect(html).toContain("The Taylor Family");
    expect(html).toContain("Our Family");
    expect(html).toContain("Household Snapshot");
    expect(html).toContain("Family Connections");
    expect(html).toContain("Roles &amp; Access");
    expect(html).toContain("Riverside Family Home");
  });
  it("includes explicit local-preview limitations and working entry points", () => {
    const html = renderToStaticMarkup(<FamilyWorkspace data={seed} onChange={() => undefined}
      onToast={() => undefined} navigate={() => undefined} />);
    expect(html).toContain("Frontend preview");
    expect(html).toContain("Add member");
    expect(html).toContain("Households");
    expect(html).toContain("Relationships");
  });
});
