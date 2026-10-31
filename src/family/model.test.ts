import { describe, expect, it } from "vitest";
import {
  activeMembers, assignHousehold, buildFamilyTreeLayers, canArchiveMember, migrateFamilyData,
  profileFor, seedFamily, setPrimaryHousehold, validateRelationship
} from "./model";
import type { FamilyRelationship, MemberRef } from "./model";
const members: MemberRef[] = [
  { id: "alex", name: "Alex" }, { id: "jamie", name: "Jamie" },
  { id: "sam", name: "Sam" }, { id: "ella", name: "Ella" }, { id: "noah", name: "Noah" }
];
describe("Phase 2 family model", () => {
  it("uses independent snapshots for state migration", () => {
    const first = migrateFamilyData(null);
    first.households[0].name = "Changed";
    const second = migrateFamilyData(null);
    expect(second.households[0].name).toBe("Riverside Family Home");
    expect(migrateFamilyData({ name: "My family", motto: "Together" }).name).toBe("My family");
  });
  it("preserves family members and relationships in a migrated legacy preview", () => {
    const model = migrateFamilyData(undefined);
    expect(model.profiles.alex.role).toBe("OWNER");
    expect(model.relationships.filter(r => r.status === "ACTIVE")).toHaveLength(7);
    expect(activeMembers(members, model)).toHaveLength(5);
  });
  it("never allows archiving the final owner", () => {
    expect(canArchiveMember(members, seedFamily, "alex")).toBe(false);
    const family = migrateFamilyData(seedFamily);
    family.profiles.jamie = { ...family.profiles.jamie, role: "OWNER" };
    expect(canArchiveMember(members, family, "alex")).toBe(true);
  });
  it("rejects self, missing and duplicate relationships", () => {
    expect(validateRelationship(seedFamily.relationships, members, "alex", "alex", "PARENT_OF")).toMatch(/themselves/);
    expect(validateRelationship(seedFamily.relationships, members, "missing", "alex", "PARENT_OF")).toMatch(/existing/);
    expect(validateRelationship(seedFamily.relationships, members, "alex", "sam", "PARENT_OF")).toMatch(/already exists/);
    expect(validateRelationship(seedFamily.relationships, members, "jamie", "alex", "PARTNER")).toMatch(/already exists/);
  });
  it("prevents direct and transitive parent cycles", () => {
    const relationships: FamilyRelationship[] = [
      { id: "one", fromId: "alex", toId: "sam", type: "PARENT_OF", status: "ACTIVE", note: "" },
      { id: "two", fromId: "sam", toId: "ella", type: "PARENT_OF", status: "ACTIVE", note: "" }
    ];
    expect(validateRelationship(relationships, members, "ella", "alex", "PARENT_OF")).toMatch(/circular/);
    expect(validateRelationship(relationships, members, "ella", "jamie", "PARENT_OF")).toBeNull();
  });
  it("allows re-linking after a recorded relationship ends", () => {
    const old: FamilyRelationship[] = [{ id: "old", fromId: "alex", toId: "sam", type: "PARENT_OF", status: "ENDED", note: "" }];
    expect(validateRelationship(old, members, "alex", "sam", "PARENT_OF")).toBeNull();
  });
  it("supports shared and multiple household membership with no duplicates", () => {
    const homes = assignHousehold(seedFamily.households, "household-home", "alex", true);
    expect(homes[0].memberIds.filter(id => id === "alex")).toHaveLength(1);
    const next = assignHousehold(homes, "household-home", "alex", false);
    expect(next[0].memberIds).not.toContain("alex");
    expect(seedFamily.households[0].memberIds).toContain("alex");
  });
  it("keeps only one primary home when changed", () => {
    const homes = [{ ...seedFamily.households[0] }, { ...seedFamily.households[0], id: "other", isPrimary: false }];
    const next = setPrimaryHousehold(homes, "other");
    expect(next.filter(h => h.isPrimary)).toHaveLength(1);
    expect(next.find(h => h.isPrimary)?.id).toBe("other");
  });
  it("renders multi-generation ancestry at the correct depth", () => {
    const edges: FamilyRelationship[] = [
      { id:"1", fromId:"alex", toId:"sam", type:"PARENT_OF", status:"ACTIVE", note:"" },
      { id:"2", fromId:"sam", toId:"ella", type:"PARENT_OF", status:"ACTIVE", note:"" }
    ];
    const tree = buildFamilyTreeLayers(members, edges);
    expect(tree.layers).toEqual([["alex"], ["sam"], ["ella"]]);
    expect(tree.unlinked).toEqual(["jamie", "noah"]);
  });
  it("creates a safe editable profile for a Phase 1 added member", () => {
    const next = profileFor("new", "Caregiver");
    expect(next.role).toBe("CAREGIVER");
    expect(next.visibility).toBe("FAMILY");
    expect(next.status).toBe("ACTIVE");
  });
});
