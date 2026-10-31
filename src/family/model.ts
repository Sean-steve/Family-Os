/**
 * Family OS Phase 2 — frontend-only family structure model.
 * This data is local preview state, NOT an authoritative identity or security system.
 */
export type FamilyRole = "OWNER" | "CO_PARENT" | "ADULT" | "TEEN" | "CHILD" | "CAREGIVER" | "EXTENDED";
export type MemberStatus = "ACTIVE" | "ARCHIVED";
export type HouseholdType = "PRIMARY_HOME" | "SECONDARY_HOME" | "SHARED_HOME" | "OTHER";
export type RelationshipType = "PARTNER" | "PARENT_OF" | "SIBLING" | "GUARDIAN_OF" | "GRANDPARENT_OF" | "EXTENDED";
export type Visibility = "FAMILY" | "SELECTED" | "PRIVATE";

export type FamilyProfile = {
  memberId: string;
  role: FamilyRole;
  status: MemberStatus;
  relationshipLabel: string;
  about: string;
  interests: string[];
  birthday: string;
  visibility: Visibility;
};

export type Household = {
  id: string;
  name: string;
  type: HouseholdType;
  location: string;
  description: string;
  memberIds: string[];
  isPrimary: boolean;
  status: "ACTIVE" | "ARCHIVED";
};

export type FamilyRelationship = {
  id: string;
  fromId: string;
  toId: string;
  type: RelationshipType;
  status: "ACTIVE" | "ENDED";
  note: string;
};

export type FamilyData = {
  name: string;
  motto: string;
  profiles: Record<string, FamilyProfile>;
  households: Household[];
  relationships: FamilyRelationship[];
};

export type MemberRef = { id: string; name: string };
export const ROLE_LABELS: Record<FamilyRole, string> = {
  OWNER: "Family owner", CO_PARENT: "Co-parent", ADULT: "Adult member",
  TEEN: "Teen member", CHILD: "Child member", CAREGIVER: "Caregiver",
  EXTENDED: "Extended family"
};
export const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  PARTNER: "Partner / Spouse", PARENT_OF: "Parent of", SIBLING: "Sibling of",
  GUARDIAN_OF: "Guardian of", GRANDPARENT_OF: "Grandparent of", EXTENDED: "Extended family"
};
export const HOUSEHOLD_LABELS: Record<HouseholdType, string> = {
  PRIMARY_HOME: "Primary home", SECONDARY_HOME: "Secondary home",
  SHARED_HOME: "Shared household", OTHER: "Other household"
};

export const seedFamily: FamilyData = {
  name: "The Taylor Family",
  motto: "Together is our favourite place to be.",
  profiles: {
    alex: {
      memberId: "alex", role: "OWNER", status: "ACTIVE",
      relationshipLabel: "Parent & family coordinator",
      about: "Keeping the family connected, organised and moving towards shared goals.",
      interests: ["Weekend adventures", "Technology", "Fitness"],
      birthday: "", visibility: "FAMILY"
    },
    jamie: {
      memberId: "jamie", role: "CO_PARENT", status: "ACTIVE",
      relationshipLabel: "Parent & family planner", about: "Making everyday moments count.",
      interests: ["Family travel", "Cooking", "Books"],
      birthday: "", visibility: "FAMILY"
    },
    sam: {
      memberId: "sam", role: "TEEN", status: "ACTIVE",
      relationshipLabel: "Child", about: "Loves football and making music.",
      interests: ["Football", "Music", "Gaming"],
      birthday: "", visibility: "FAMILY"
    },
    ella: {
      memberId: "ella", role: "CHILD", status: "ACTIVE",
      relationshipLabel: "Child", about: "Curious explorer and lifelong learner.",
      interests: ["Science", "Drawing", "Nature"],
      birthday: "", visibility: "FAMILY"
    },
    noah: {
      memberId: "noah", role: "CHILD", status: "ACTIVE",
      relationshipLabel: "Child", about: "Always ready for an outdoor adventure.",
      interests: ["Cycling", "Soccer", "Animals"],
      birthday: "", visibility: "FAMILY"
    }
  },
  households: [{
    id: "household-home", name: "Riverside Family Home",
    type: "PRIMARY_HOME", location: "Perth, Australia",
    description: "Our everyday home, shared routines and family adventures.",
    memberIds: ["alex", "jamie", "sam", "ella", "noah"],
    isPrimary: true, status: "ACTIVE"
  }],
  relationships: [
    { id: "rel-partners", fromId: "alex", toId: "jamie", type: "PARTNER", status: "ACTIVE", note: "" },
    { id: "rel-a-sam", fromId: "alex", toId: "sam", type: "PARENT_OF", status: "ACTIVE", note: "" },
    { id: "rel-a-ella", fromId: "alex", toId: "ella", type: "PARENT_OF", status: "ACTIVE", note: "" },
    { id: "rel-a-noah", fromId: "alex", toId: "noah", type: "PARENT_OF", status: "ACTIVE", note: "" },
    { id: "rel-j-sam", fromId: "jamie", toId: "sam", type: "PARENT_OF", status: "ACTIVE", note: "" },
    { id: "rel-j-ella", fromId: "jamie", toId: "ella", type: "PARENT_OF", status: "ACTIVE", note: "" },
    { id: "rel-j-noah", fromId: "jamie", toId: "noah", type: "PARENT_OF", status: "ACTIVE", note: "" }
  ]
};

export function freshId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return prefix + crypto.randomUUID();
  return prefix + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
}
export function defaultRoleForLabel(label: string): FamilyRole {
  const value = label.toLowerCase();
  if (value.includes("owner")) return "OWNER";
  if (value.includes("co-parent") || value.includes("parent")) return "CO_PARENT";
  if (value.includes("teen")) return "TEEN";
  if (value.includes("child")) return "CHILD";
  if (value.includes("caregiver")) return "CAREGIVER";
  if (value.includes("grand") || value.includes("extended")) return "EXTENDED";
  return "ADULT";
}
export function profileFor(id: string, oldLabel = "Family member"): FamilyProfile {
  return {
    memberId: id, role: defaultRoleForLabel(oldLabel), status: "ACTIVE",
    relationshipLabel: oldLabel, about: "", interests: [], birthday: "", visibility: "FAMILY"
  };
}
/** Preserves existing Phase-1 local data when Phase 2 is introduced. */
export function migrateFamilyData(raw: unknown): FamilyData {
  if (!raw || typeof raw !== "object") return structuredClone(seedFamily);
  const input = raw as Partial<FamilyData>;
  return {
    name: typeof input.name === "string" && input.name.trim() ? input.name : seedFamily.name,
    motto: typeof input.motto === "string" ? input.motto : seedFamily.motto,
    profiles: input.profiles && typeof input.profiles === "object" && !Array.isArray(input.profiles)
      ? input.profiles : structuredClone(seedFamily.profiles),
    households: Array.isArray(input.households) ? input.households : structuredClone(seedFamily.households),
    relationships: Array.isArray(input.relationships) ? input.relationships : structuredClone(seedFamily.relationships)
  };
}
export function activeMembers<T extends MemberRef>(members: T[], family: FamilyData): T[] {
  return members.filter(member => (family.profiles[member.id]?.status || "ACTIVE") === "ACTIVE");
}
export function canArchiveMember(members: MemberRef[], family: FamilyData, memberId: string): boolean {
  const profile = family.profiles[memberId];
  if (!profile || profile.status !== "ACTIVE") return false;
  if (profile.role !== "OWNER") return true;
  return activeMembers(members, family)
    .some(member => member.id !== memberId && family.profiles[member.id]?.role === "OWNER");
}
export function isAncestor(relations: FamilyRelationship[], ancestorId: string, descendantId: string): boolean {
  const next = relations.filter(rel => rel.status === "ACTIVE" && (rel.type === "PARENT_OF" || rel.type === "GUARDIAN_OF"));
  const visited = new Set<string>();
  const toVisit = [ancestorId];
  while (toVisit.length) {
    const id = toVisit.pop()!;
    if (id === descendantId) return true;
    if (visited.has(id)) continue;
    visited.add(id);
    toVisit.push(...next.filter(rel => rel.fromId === id).map(rel => rel.toId));
  }
  return false;
}
export function validateRelationship(
  relationships: FamilyRelationship[], members: MemberRef[],
  fromId: string, toId: string, type: RelationshipType
): string | null {
  if (!fromId || !toId) return "Choose both family members.";
  if (fromId === toId) return "A family member cannot have a relationship with themselves.";
  if (!members.some(m => m.id === fromId) || !members.some(m => m.id === toId)) return "Choose existing family members.";
  const symmetric = type === "PARTNER" || type === "SIBLING" || type === "EXTENDED";
  if (relationships.some(r => r.status === "ACTIVE" && r.type === type &&
    ((r.fromId === fromId && r.toId === toId) || (symmetric && r.fromId === toId && r.toId === fromId))))
    return "This active relationship already exists.";
  if ((type === "PARENT_OF" || type === "GUARDIAN_OF") && isAncestor(relationships, toId, fromId))
    return "This relationship would create a circular parent/guardian structure.";
  return null;
}
export function assignHousehold(households: Household[], householdId: string, memberId: string, assigned: boolean): Household[] {
  return households.map(h => h.id !== householdId ? h : {
    ...h, memberIds: assigned
      ? Array.from(new Set([...h.memberIds, memberId]))
      : h.memberIds.filter(id => id !== memberId)
  });
}
export function setPrimaryHousehold(households: Household[], id: string): Household[] {
  return households.map(h => ({ ...h, isPrimary: h.status === "ACTIVE" && h.id === id }));
}

/** Builds depth-aware family tree rows from recorded parent links.
 * Other relationships remain in their own graph/list: partner status is not lineage.
 */
export function buildFamilyTreeLayers(members: MemberRef[], relationships: FamilyRelationship[]) {
  const allowed = new Set(members.map(m => m.id));
  const edges = relationships.filter(r => r.status === "ACTIVE" && r.type === "PARENT_OF" &&
    allowed.has(r.fromId) && allowed.has(r.toId));
  const referencedChildren = new Set(edges.map(r => r.toId));
  const roots = members.filter(m => edges.some(e => e.fromId === m.id) && !referencedChildren.has(m.id));
  const seen = new Set<string>();
  const layers: string[][] = [];
  let frontier = roots.map(m => m.id);
  for (let depth = 0; frontier.length && depth < members.length; depth++) {
    const current = [...new Set(frontier)].filter(id => !seen.has(id));
    if (!current.length) break;
    layers.push(current);
    current.forEach(id => seen.add(id));
    frontier = edges.filter(e => current.includes(e.fromId)).map(e => e.toId);
  }
  return { layers, unlinked: members.filter(m => !seen.has(m.id)).map(m => m.id) };
}
