import { useMemo, useState, type FormEvent } from "react";
import {
  Activity, ArrowRight, Baby, Check, CheckCircle2,
  ChevronRight, Crown, Edit3, Heart, Home, Info, MapPin,
  Plus, Search, ShieldCheck, Sparkles, Trash2, UserPlus, UsersRound, X
} from "lucide-react";
import type { AppData, Member } from "../data";
import {
  activeMembers, canArchiveMember, freshId, HOUSEHOLD_LABELS,
  profileFor, RELATIONSHIP_LABELS, ROLE_LABELS, setPrimaryHousehold, validateRelationship
} from "./model";
import type {
  FamilyData, FamilyProfile, FamilyRole, FamilyRelationship, Household, HouseholdType, RelationshipType
} from "./model";
import "./family.css";

type Tab = "Overview" | "Members" | "Family Tree" | "Households" | "Relationships" | "Roles & Access";
type Props = {
  data: AppData;
  onChange: (update: (previous: AppData) => AppData) => void;
  onToast: (message: string) => void;
  navigate: (route: string) => void;
};
const tabs: Tab[] = ["Overview", "Members", "Family Tree", "Households", "Relationships", "Roles & Access"];
const roleChoices = Object.keys(ROLE_LABELS) as FamilyRole[];
const relationChoices = Object.keys(RELATIONSHIP_LABELS) as RelationshipType[];
const householdChoices = Object.keys(HOUSEHOLD_LABELS) as HouseholdType[];
const roleDescriptions: Record<FamilyRole, string> = {
  OWNER: "Coordinates the family workspace and its shared settings.",
  CO_PARENT: "Supports the family, parenting and shared decisions.",
  ADULT: "Participates in family plans, shared moments and responsibilities.",
  TEEN: "An age-appropriate view of household goals and responsibilities.",
  CHILD: "A friendly, age-appropriate view of shared family activities.",
  CAREGIVER: "Coordinates specific household or care responsibilities.",
  EXTENDED: "Shares selected events, experiences and family updates."
};
const roleAccess: { capability: string; roles: FamilyRole[] }[] = [
  { capability: "View shared family spaces", roles: roleChoices },
  { capability: "Coordinate household", roles: ["OWNER", "CO_PARENT", "ADULT", "CAREGIVER"] },
  { capability: "Manage shared family profiles", roles: ["OWNER", "CO_PARENT"] },
  { capability: "Manage family governance", roles: ["OWNER"] },
  { capability: "View age-appropriate shared events", roles: roleChoices },
  { capability: "Review shared goals and decisions", roles: ["OWNER", "CO_PARENT", "ADULT", "TEEN"] }
];

function Avatar({ member, size = "default" }: { member: Member; size?: "small" | "default" | "large" }) {
  const [broken, setBroken] = useState(false);
  return <span className={"family-avatar family-avatar-" + size} style={{ background: member.color }} title={member.name}>
    {!broken && member.avatar > 0 && <img src={"https://i.pravatar.cc/120?img=" + member.avatar} loading="lazy" alt="" onError={() => setBroken(true)} />}
    <span>{member.name.charAt(0).toUpperCase()}</span>
  </span>;
}
function AvatarStack({ ids, members, max = 5 }: { ids: string[]; members: Member[]; max?: number }) {
  return <span className="family-avatar-stack">{ids.slice(0, max).map(id => {
    const member = members.find(m => m.id === id);
    return member && <Avatar key={id} member={member} size="small" />;
  })}{ids.length > max && <span className="family-avatar-more">+{ids.length - max}</span>}</span>;
}
function PanelHeading({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return <div className="family-panel-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{right}</div>;
}
function ProfileCard({ member, profile, household, onOpen }: {
  member: Member; profile: FamilyProfile; household: string | undefined; onOpen: () => void
}) {
  return <button className="family-profile-card" onClick={onOpen}>
    <div className="family-profile-top"><Avatar member={member} size="large"/><span className={"family-role-chip role-" + profile.role.toLowerCase()}>{ROLE_LABELS[profile.role]}</span></div>
    <h3>{member.name}</h3><p>{profile.relationshipLabel || "Family member"}</p>
    <div className="family-profile-tags">{profile.interests.slice(0, 2).map(tag => <span key={tag}>{tag}</span>)}
      {profile.status === "ARCHIVED" && <span className="family-archived-chip">Archived</span>}
    </div>
    <div className="family-profile-bottom"><span><Home size={14}/>{household || "No household assigned"}</span><ChevronRight size={17}/></div>
  </button>;
}
type MemberForm = {
  name: string; role: FamilyRole; relation: string; about: string;
  interests: string; birthday: string; visibility: FamilyProfile["visibility"]
};
const defaultMemberForm: MemberForm = {
  name: "", role: "ADULT", relation: "", about: "", interests: "", birthday: "", visibility: "FAMILY"
};
type HouseholdForm = { name: string; type: HouseholdType; location: string; description: string; memberIds: string[] };
const defaultHouseholdForm: HouseholdForm = { name: "", type: "SECONDARY_HOME", location: "", description: "", memberIds: [] };
type RelationshipForm = { fromId: string; toId: string; type: RelationshipType; note: string };
const emptyRelationship: RelationshipForm = { fromId: "", toId: "", type: "PARENT_OF", note: "" };

export default function FamilyWorkspace({ data, onChange, onToast, navigate }: Props) {
  const [tab, setTab] = useState<Tab>("Overview");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<FamilyRole | "ALL">("ALL");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [editingMemberId, setEditingMemberId] = useState<string | "NEW" | null>(null);
  const [memberForm, setMemberForm] = useState<MemberForm>(defaultMemberForm);
  const [editingHouseholdId, setEditingHouseholdId] = useState<string | "NEW" | null>(null);
  const [householdForm, setHouseholdForm] = useState<HouseholdForm>(defaultHouseholdForm);
  const [relationshipModal, setRelationshipModal] = useState(false);
  const [relationshipForm, setRelationshipForm] = useState<RelationshipForm>(emptyRelationship);
  const [formError, setFormError] = useState("");
  const [familyEdit, setFamilyEdit] = useState(false);
  const [familyName, setFamilyName] = useState(data.family.name);
  const [familyMotto, setFamilyMotto] = useState(data.family.motto);

  const family = data.family;
  const visibleMembers = useMemo(() => activeMembers(data.members, family), [data.members, family]);
  const existingHouseholds = family.households.filter(h => h.status === "ACTIVE");
  const activeRelations = family.relationships.filter(r => r.status === "ACTIVE");
  const profile = (member: Member) => family.profiles[member.id] || profileFor(member.id, member.role);
  const memberById = (id: string) => data.members.find(m => m.id === id);
  const householdName = (memberId: string) => existingHouseholds.find(h => h.memberIds.includes(memberId))?.name;
  const filteredMembers = data.members.filter(m => {
    const p = profile(m);
    return (showArchived || p.status === "ACTIVE") && (roleFilter === "ALL" || p.role === roleFilter) &&
      (m.name + " " + p.relationshipLabel + " " + p.interests.join(" ")).toLowerCase().includes(query.toLowerCase());
  });
  const counts = { guardians: visibleMembers.filter(m => ["OWNER", "CO_PARENT", "CAREGIVER"].includes(profile(m).role)).length,
    kids: visibleMembers.filter(m => ["CHILD", "TEEN"].includes(profile(m).role)).length
  };
  const selectedMember = selectedMemberId && memberById(selectedMemberId);
  const selectedProfile = selectedMember ? profile(selectedMember) : null;

  function updateFamily(fn: (prev: FamilyData) => FamilyData) {
    onChange(prev => ({ ...prev, family: fn(prev.family) }));
  }
  function openMemberEditor(member?: Member) {
    setFormError("");
    if (!member) {
      setMemberForm(defaultMemberForm);
      setEditingMemberId("NEW");
    } else {
      const p = profile(member);
      setMemberForm({
        name: member.name, role: p.role, relation: p.relationshipLabel,
        about: p.about, interests: p.interests.join(", "), birthday: p.birthday, visibility: p.visibility
      });
      setEditingMemberId(member.id);
    }
  }
  function saveMember(e: FormEvent) {
    e.preventDefault(); setFormError("");
    const name = memberForm.name.trim();
    if (!name || name.length > 70) { setFormError("Enter a name of 1–70 characters."); return; }
    if (memberForm.birthday && !/^\d{2}-\d{2}$/.test(memberForm.birthday)) {
      setFormError("Use MM-DD for the optional birthday reminder."); return;
    }
    if (editingMemberId !== "NEW") {
      if (!editingMemberId) return;
      const current = memberById(editingMemberId);
      if (!current) return;
      const original = profile(current);
      if (original.role === "OWNER" && memberForm.role !== "OWNER" &&
          !visibleMembers.some(m => m.id !== current.id && profile(m).role === "OWNER")) {
        setFormError("Assign another active family owner before changing the last owner's role."); return;
      }
    }
    const memberId = editingMemberId === "NEW" ? freshId("member-") : editingMemberId;
    if (!memberId) return;
    const newProfile: FamilyProfile = {
      memberId, role: memberForm.role, status: editingMemberId === "NEW" ? "ACTIVE" : (family.profiles[memberId]?.status || "ACTIVE"),
      relationshipLabel: memberForm.relation.trim() || ROLE_LABELS[memberForm.role],
      about: memberForm.about.trim(),
      interests: memberForm.interests.split(",").map(s => s.trim()).filter(Boolean).slice(0, 8),
      birthday: memberForm.birthday, visibility: memberForm.visibility
    };
    onChange(prev => ({
      ...prev,
      members: editingMemberId === "NEW"
        ? [...prev.members, { id: memberId, name, role: ROLE_LABELS[memberForm.role], avatar: 0, color: "#dceaff" }]
        : prev.members.map(m => m.id === memberId ? { ...m, name, role: ROLE_LABELS[memberForm.role] } : m),
      family: { ...prev.family, profiles: { ...prev.family.profiles, [memberId]: newProfile } }
    }));
    setEditingMemberId(null);
    setSelectedMemberId(memberId);
    onToast(editingMemberId === "NEW" ? "Family member added" : "Member profile updated");
  }
  function changeMemberStatus(memberId: string, archived: boolean) {
    const m = memberById(memberId);
    if (!m) return;
    if (archived && !canArchiveMember(data.members, family, memberId)) {
      onToast("The final active family owner cannot be archived"); return;
    }
    updateFamily(prev => ({
      ...prev,
      profiles: { ...prev.profiles,
        [memberId]: { ...(prev.profiles[memberId] || profileFor(memberId, m.role)), status: archived ? "ARCHIVED" : "ACTIVE" }
      },
      households: archived ? prev.households.map(h => ({ ...h, memberIds: h.memberIds.filter(id => id !== memberId) })) : prev.households,
      relationships: archived ? prev.relationships.map(r => r.fromId === memberId || r.toId === memberId ? { ...r, status: "ENDED" } : r) : prev.relationships
    }));
    setSelectedMemberId(null);
    onToast(archived ? "Member archived. Their history is preserved." : "Member restored");
  }
  function openHouseholdEditor(h?: Household) {
    setFormError("");
    setHouseholdForm(h ? {
      name: h.name, type: h.type, location: h.location,
      description: h.description, memberIds: [...h.memberIds]
    } : defaultHouseholdForm);
    setEditingHouseholdId(h ? h.id : "NEW");
  }
  function saveHousehold(e: FormEvent) {
    e.preventDefault(); setFormError("");
    if (!householdForm.name.trim()) { setFormError("Enter a household name."); return; }
    if (householdForm.name.length > 90) { setFormError("Household name must be under 90 characters."); return; }
    if (editingHouseholdId === "NEW") {
      const h: Household = {
        id: freshId("house-"), name: householdForm.name.trim(), type: householdForm.type,
        location: householdForm.location.trim(), description: householdForm.description.trim(),
        memberIds: householdForm.memberIds, isPrimary: existingHouseholds.length === 0, status: "ACTIVE"
      };
      updateFamily(prev => ({ ...prev, households: [...prev.households, h] }));
      onToast("Household created");
    } else if (editingHouseholdId) {
      const target = editingHouseholdId;
      updateFamily(prev => ({
        ...prev, households: prev.households.map(h => h.id === target
          ? { ...h, name: householdForm.name.trim(), type: householdForm.type,
            location: householdForm.location.trim(), description: householdForm.description.trim(),
            memberIds: householdForm.memberIds } : h)
      }));
      onToast("Household updated");
    }
    setEditingHouseholdId(null);
  }
  function archiveHousehold(id: string) {
    if (existingHouseholds.length < 2) { onToast("Keep at least one active household."); return; }
    updateFamily(prev => {
      const next = prev.households.map(h => h.id === id ? { ...h, status: "ARCHIVED" as const, isPrimary: false } : h);
      if (!next.some(h => h.status === "ACTIVE" && h.isPrimary)) {
        const first = next.find(h => h.status === "ACTIVE");
        return { ...prev, households: first ? setPrimaryHousehold(next, first.id) : next };
      }
      return { ...prev, households: next };
    });
    setEditingHouseholdId(null);
    onToast("Household archived, history preserved");
  }
  function saveRelationship(e: FormEvent) {
    e.preventDefault(); setFormError("");
    const error = validateRelationship(family.relationships, visibleMembers, relationshipForm.fromId,
      relationshipForm.toId, relationshipForm.type);
    if (error) { setFormError(error); return; }
    const rel: FamilyRelationship = {
      ...relationshipForm, note: relationshipForm.note.trim(), id: freshId("rel-"), status: "ACTIVE"
    };
    updateFamily(prev => ({ ...prev, relationships: [...prev.relationships, rel] }));
    setRelationshipModal(false);
    onToast("Relationship added to family tree");
  }
  function endRelationship(id: string) {
    updateFamily(prev => ({ ...prev, relationships: prev.relationships.map(r => r.id === id
      ? { ...r, status: "ENDED" } : r) }));
    onToast("Relationship ended. History preserved.");
  }
  function linkMember(from: string, to: string) {
    setFormError("");
    setRelationshipForm({ ...emptyRelationship, fromId: from, toId: to });
    setRelationshipModal(true);
  }

  const membersOnRoot = useMemo(() => {
    const childIds = new Set(activeRelations.filter(r => ["PARENT_OF", "GUARDIAN_OF"].includes(r.type)).map(r => r.toId));
    return visibleMembers.filter(m => !childIds.has(m.id));
  }, [activeRelations, visibleMembers]);
  const parentLinks = activeRelations.filter(r => r.type === "PARENT_OF");
  const childIds = Array.from(new Set(parentLinks.map(r => r.toId)));
  const familyTreeChildren = childIds.map(id => memberById(id)).filter((m): m is Member =>
    !!m && profile(m).status === "ACTIVE");
  const treeRoot = membersOnRoot.filter(m => parentLinks.some(r => r.fromId === m.id));
  const isolated = membersOnRoot.filter(m => !treeRoot.some(r => r.id === m.id));

  function showTab(next: Tab) { setTab(next); setQuery(""); }

  return <main className="family-workspace">
    <div className="family-breadcrumb"><button onClick={() => navigate("Dashboard")}>Dashboard</button><ChevronRight size={14}/><span>Family</span></div>
    <div className="family-header-card">
      <div className="family-header-art"><div className="family-orbit family-orbit-one"/><div className="family-orbit family-orbit-two"/><Heart size={26} /></div>
      <div className="family-header-copy">
        <span className="family-kicker"><Sparkles size={14}/> YOUR FAMILY SPACE</span>
        <h1>{family.name}</h1><p>{family.motto}</p>
        <div className="family-header-people"><AvatarStack ids={visibleMembers.map(m => m.id)} members={data.members}/>
          <span><strong>{visibleMembers.length} people</strong> connected in your family</span></div>
      </div>
      <div className="family-header-actions"><button className="family-btn family-btn-glass" onClick={() => {setFamilyName(family.name);setFamilyMotto(family.motto);setFamilyEdit(true);}}><Edit3 size={15}/> Edit family</button><button className="family-btn family-btn-white" onClick={() => openMemberEditor()}><UserPlus size={17}/> Add member</button></div>
    </div>

    <div className="family-overview-stats">
      <div><span className="family-stat-icon lavender"><UsersRound size={19}/></span><strong>{visibleMembers.length}</strong><small>Family members</small></div>
      <div><span className="family-stat-icon mint"><ShieldCheck size={19}/></span><strong>{counts.guardians}</strong><small>Coordinators / carers</small></div>
      <div><span className="family-stat-icon apricot"><Baby size={19}/></span><strong>{counts.kids}</strong><small>Children & teens</small></div>
      <div><span className="family-stat-icon sky"><Home size={19}/></span><strong>{existingHouseholds.length}</strong><small>Household{existingHouseholds.length === 1 ? "" : "s"}</small></div>
      <div><span className="family-stat-icon rose"><Heart size={19}/></span><strong>{activeRelations.length}</strong><small>Family connections</small></div>
    </div>

    <nav className="family-tabbar" aria-label="Family sections">{tabs.map(t => <button key={t}
      onClick={() => showTab(t)} className={t === tab ? "selected" : ""} aria-current={t === tab ? "page" : undefined}>{t}</button>)}</nav>

    {tab === "Overview" && <div className="family-overview-layout">
      <section className="family-panel family-overview-people">
        <PanelHeading title="Our Family" subtitle="The people who make this family home."
          right={<button className="family-text-action" onClick={() => showTab("Members")}>View all <ArrowRight size={16}/></button>}/>
        <div className="family-featured-members">
          {visibleMembers.slice(0, 5).map(m => <button className="family-featured-person" key={m.id}
            onClick={() => setSelectedMemberId(m.id)}><Avatar member={m} size="large"/><strong>{m.name}</strong>
            <small>{ROLE_LABELS[profile(m).role]}</small></button>)}
          <button className="family-featured-person family-invite-spot" onClick={() => openMemberEditor()}><span className="family-invite-circle"><Plus size={22}/></span><strong>Add member</strong><small>Grow your family circle</small></button>
        </div>
      </section>
      <section className="family-panel family-overview-household">
        <PanelHeading title="Household Snapshot" subtitle="Where everyone belongs."
          right={<button className="family-text-action" onClick={() => showTab("Households")}>Manage <ArrowRight size={16}/></button>}/>
        {existingHouseholds.slice(0, 2).map(h => <button className="household-mini-row" onClick={() => openHouseholdEditor(h)} key={h.id}>
          <span className="family-house-mini-icon"><Home size={20}/></span><span><strong>{h.name}</strong><small><MapPin size={12}/>{h.location || "Location not set"} · {h.memberIds.length} members</small></span><ChevronRight size={16}/></button>)}
      </section>
      <section className="family-panel family-overview-tree">
        <PanelHeading title="Family Connections" subtitle="A simple look at how we're linked."
          right={<button className="family-text-action" onClick={() => showTab("Family Tree")}>Explore tree <ArrowRight size={16}/></button>}/>
        <div className="family-mini-tree"><div className="family-tree-parent-row">{treeRoot.slice(0, 2).map(m =>
          <button key={m.id} onClick={() => setSelectedMemberId(m.id)}><Avatar member={m}/><span>{m.name}</span></button>)}
          {!treeRoot.length && <span>No parent links recorded yet.</span>}</div>
          {!!familyTreeChildren.length && <><div className="family-tree-line"/><div className="family-tree-child-row">{familyTreeChildren.slice(0, 5).map(m =>
            <button key={m.id} onClick={() => setSelectedMemberId(m.id)}><Avatar member={m} size="small"/><span>{m.name}</span></button>)}</div></>}
        </div>
      </section>
      <section className="family-panel family-overview-activity">
        <PanelHeading title="Family Essentials" subtitle="A clearer picture of daily family life."/>
        <button className="family-overview-link" onClick={() => navigate("Responsibilities")}><span className="family-stat-icon lavender"><CheckCircle2 size={19}/></span><span><strong>Shared responsibilities</strong><small>{data.tasks.length} tasks in the family preview</small></span><ChevronRight size={17}/></button>
        <button className="family-overview-link" onClick={() => navigate("Goals")}><span className="family-stat-icon mint"><Activity size={19}/></span><span><strong>Our family goals</strong><small>{data.goals.length} goals moving forward together</small></span><ChevronRight size={17}/></button>
        <button className="family-overview-link" onClick={() => showTab("Roles & Access")}><span className="family-stat-icon sky"><ShieldCheck size={19}/></span><span><strong>Roles & visibility</strong><small>Review how the preview is organised</small></span><ChevronRight size={17}/></button>
      </section>
    </div>}

    {tab === "Members" && <section className="family-panel family-full-panel">
      <PanelHeading title="Family Members" subtitle="People, profiles, roles and relationships in one place."
        right={<button className="family-btn family-btn-primary" onClick={() => openMemberEditor()}><Plus size={17}/> Add Member</button>}/>
      <div className="family-list-toolbar"><label className="family-inline-search"><Search size={17}/><input aria-label="Search family members"
        placeholder="Search members, interests..." value={query} onChange={e => setQuery(e.target.value)}/></label>
        <label className="family-filter-label">Role <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as FamilyRole | "ALL")}>
          <option value="ALL">All roles</option>{roleChoices.map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></label>
        <label className="family-checkbox"><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)}/> Show archived</label></div>
      <div className="family-member-grid">{filteredMembers.map(m => <ProfileCard key={m.id} member={m} profile={profile(m)}
        household={householdName(m.id)} onOpen={() => setSelectedMemberId(m.id)}/>)}</div>
      {!filteredMembers.length && <div className="family-empty"><UsersRound size={28}/><h3>No matching members</h3><p>Try a different role or search.</p></div>}
    </section>}

    {tab === "Family Tree" && <section className="family-panel family-full-panel">
      <PanelHeading title="Our Family Tree" subtitle="Family connections as recorded — without assuming someone has guardian authority."
        right={<button className="family-btn family-btn-primary" onClick={() => {setRelationshipForm(emptyRelationship);setFormError("");setRelationshipModal(true);}}><Plus size={17}/> Add connection</button>}/>
      <div className="tree-canvas">
        <div className="tree-caption"><span className="tree-dot"/> Connected family people</div>
        {!!treeRoot.length && <div className="tree-generation"><span className="tree-generation-label">PARENTS & FAMILY ANCHORS</span>
          <div className="tree-nodes">{treeRoot.map(m => <button className="tree-person" key={m.id} onClick={() => setSelectedMemberId(m.id)}><Avatar member={m} size="large"/><strong>{m.name}</strong><small>{profile(m).relationshipLabel}</small></button>)}</div>
        </div>}
        {!!familyTreeChildren.length && <div className="tree-downline"><span/></div>}
        {!!familyTreeChildren.length && <div className="tree-generation"><span className="tree-generation-label">CHILDREN & DESCENDANTS</span><div className="tree-nodes">
          {familyTreeChildren.map(m => <button className="tree-person" key={m.id} onClick={() => setSelectedMemberId(m.id)}><Avatar member={m} size="large"/><strong>{m.name}</strong><small>{profile(m).relationshipLabel}</small></button>)}</div></div>}
        {!!isolated.length && <div className="tree-generation tree-unlinked"><span className="tree-generation-label">OTHER FAMILY MEMBERS</span><div className="tree-nodes">
          {isolated.map(m => <button className="tree-person" key={m.id} onClick={() => setSelectedMemberId(m.id)}><Avatar member={m} size="large"/><strong>{m.name}</strong><small>{ROLE_LABELS[profile(m).role]}</small></button>)}</div></div>}
      </div>
      <div className="family-tree-caption"><Info size={17}/><span>Tree groups use recorded parent-of connections. Partner and other relations appear in Relationships; links are not proof of legal guardianship.</span></div>
      <div className="family-link-list">
        {activeRelations.slice(0, 6).map(rel => <div key={rel.id}><Heart size={15}/><strong>{memberById(rel.fromId)?.name || "Member"}</strong><span>{RELATIONSHIP_LABELS[rel.type].toLowerCase()}</span><strong>{memberById(rel.toId)?.name || "Member"}</strong></div>)}
      </div>
      <button className="family-text-action" onClick={() => showTab("Relationships")}>See all recorded connections <ArrowRight size={16}/></button>
    </section>}

    {tab === "Households" && <section className="family-panel family-full-panel">
      <PanelHeading title="Households" subtitle="One family can span several homes, residences and shared households."
        right={<button className="family-btn family-btn-primary" onClick={() => openHouseholdEditor()}><Plus size={17}/> New Household</button>}/>
      <div className="family-household-grid">{existingHouseholds.map(h => <div className="family-household-card" key={h.id}>
        <div className="family-household-card-head"><span className="household-icon-lg"><Home size={29}/></span><div>{h.isPrimary && <span className="family-primary-chip"><Check size={12}/> Primary</span>}<h3>{h.name}</h3><p>{HOUSEHOLD_LABELS[h.type]}</p></div></div>
        <p className="family-household-description">{h.description || "A shared space for the people who belong here."}</p>
        <p className="family-household-location"><MapPin size={15}/>{h.location || "Location not set"}</p>
        <div className="family-household-members"><AvatarStack ids={h.memberIds} members={data.members}/><span>{h.memberIds.length} member{h.memberIds.length === 1 ? "" : "s"}</span></div>
        <div className="family-household-actions"><button className="family-btn family-btn-outline" onClick={() => openHouseholdEditor(h)}><Edit3 size={15}/> Manage</button>{!h.isPrimary && <button className="family-btn family-btn-light" onClick={() => {updateFamily(prev => ({...prev,households:setPrimaryHousehold(prev.households,h.id)}));onToast("Primary household updated");}}>Set primary</button>}</div></div>)}
        <button className="family-new-household" onClick={() => openHouseholdEditor()}><span><Plus size={25}/></span><strong>Add another household</strong><small>For extended family, shared homes or multiple residences.</small></button></div>
    </section>}

    {tab === "Relationships" && <section className="family-panel family-full-panel">
      <PanelHeading title="Family Relationships" subtitle="Maintain an explicit, historical record of connections."
        right={<button className="family-btn family-btn-primary" onClick={() => {setRelationshipForm(emptyRelationship);setFormError("");setRelationshipModal(true);}}><Plus size={17}/> Add relationship</button>}/>
      <div className="family-relationship-summary"><Heart size={20}/> <strong>{activeRelations.length} active relationships</strong><span>Cross-family links and legal verification are not available in this frontend preview.</span></div>
      <div className="relationship-list">{activeRelations.map(rel => {
        const from = memberById(rel.fromId); const to = memberById(rel.toId);
        return <div className="relationship-row" key={rel.id}>
          <span className="relationship-person">{from && <Avatar member={from} size="small"/>}<strong>{from?.name || "Unknown"}</strong></span>
          <span className="relationship-type-label">{RELATIONSHIP_LABELS[rel.type]}</span>
          <span className="relationship-person">{to && <Avatar member={to} size="small"/>}<strong>{to?.name || "Unknown"}</strong></span>
          <button className="relationship-end-button" title="End this relationship" onClick={() => endRelationship(rel.id)}><X size={16}/><span>End</span></button>
        </div>;
      })}</div>
      {!activeRelations.length && <div className="family-empty"><Heart size={30}/><h3>No connections recorded yet</h3><p>Add a relationship to begin your family tree.</p></div>}
      <p className="family-helper-text"><Info size={15}/> Ended relationships are retained in local historical preview data and are omitted from the active graph.</p>
    </section>}

    {tab === "Roles & Access" && <section className="family-panel family-full-panel">
      <PanelHeading title="Roles & Access" subtitle="Organise family responsibilities and preview a future permission model."/>
      <div className="family-security-note"><ShieldCheck size={23}/><div><strong>Frontend preview — role labels are not security controls</strong><p>No authentication, real permissions or guardian verification exist in this version. Do not enter real private records or use this for access control.</p></div></div>
      <div className="family-roles-grid">{roleChoices.map(role => {
        const people = visibleMembers.filter(m => profile(m).role === role);
        return <div key={role} className="family-role-card"><div className="family-role-card-top"><span className="family-stat-icon lavender">{role === "OWNER" ? <Crown size={18}/> : <UsersRound size={18}/>}</span><span className="family-role-count">{people.length} member{people.length !== 1 ? "s" : ""}</span></div><h3>{ROLE_LABELS[role]}</h3><p>{roleDescriptions[role]}</p><AvatarStack ids={people.map(m => m.id)} members={data.members} max={6}/></div>;
      })}</div>
      <h3 className="family-section-title">Illustrative capabilities</h3>
      <div className="family-permission-table-wrap"><table className="family-permission-table"><thead><tr><th>Capability</th>{roleChoices.slice(0, 5).map(role => <th key={role}>{ROLE_LABELS[role]}</th>)}</tr></thead><tbody>
        {roleAccess.map(row => <tr key={row.capability}><td>{row.capability}</td>{roleChoices.slice(0, 5).map(role => <td key={role}>{row.roles.includes(role) ? <CheckCircle2 className="permission-yes" size={18}/> : <span className="permission-no">—</span>}</td>)}</tr>)}
      </tbody></table></div><p className="family-helper-text"><Info size={15}/> To change a member's preview role, open their profile in Members and choose Edit. Actual policy enforcement is deferred to the backend/security phase.</p>
    </section>}

    {selectedMember && selectedProfile && <div className="family-detail-backdrop" onClick={() => setSelectedMemberId(null)}>
      <aside className="family-profile-drawer" role="dialog" aria-modal="true" aria-label={selectedMember.name + " profile"} onClick={e => e.stopPropagation()}>
        <div className="family-drawer-header"><span>FAMILY MEMBER PROFILE</span><button onClick={() => setSelectedMemberId(null)} aria-label="Close profile"><X size={20}/></button></div>
        <div className="family-drawer-cover"/><div className="family-drawer-identity"><Avatar member={selectedMember} size="large"/><h2>{selectedMember.name}</h2><p>{selectedProfile.relationshipLabel || ROLE_LABELS[selectedProfile.role]}</p><span className={"family-role-chip role-" + selectedProfile.role.toLowerCase()}>{ROLE_LABELS[selectedProfile.role]}</span></div>
        <div className="family-drawer-body">
          <div><span className="family-drawer-eyebrow">ABOUT</span><p>{selectedProfile.about || "No profile introduction yet."}</p></div>
          <div><span className="family-drawer-eyebrow">HOUSEHOLDS</span><div className="family-drawer-tags">
            {existingHouseholds.filter(h => h.memberIds.includes(selectedMember.id)).map(h => <span key={h.id}><Home size={13}/>{h.name}</span>)}
            {!existingHouseholds.some(h => h.memberIds.includes(selectedMember.id)) && <span>Not assigned to a household</span>}
          </div></div>
          <div><span className="family-drawer-eyebrow">INTERESTS</span><div className="family-drawer-tags">{selectedProfile.interests.length
            ? selectedProfile.interests.map(tag => <span key={tag}>{tag}</span>) : <span>None added</span>}</div></div>
          <div><span className="family-drawer-eyebrow">PROFILE VISIBILITY</span><p className="family-visibility"><ShieldCheck size={15}/>{selectedProfile.visibility} · illustrative only</p></div>
          <div><span className="family-drawer-eyebrow">CONNECTED TO</span><div className="family-drawer-tags">{activeRelations.filter(rel => rel.fromId === selectedMember.id || rel.toId === selectedMember.id).slice(0, 9).map(rel => {
            const other = memberById(rel.fromId === selectedMember.id ? rel.toId : rel.fromId);
            return other && <button key={rel.id} onClick={() => setSelectedMemberId(other.id)}>{other.name}<ArrowRight size={12}/></button>;
          })}</div></div>
        </div>
        <div className="family-drawer-actions"><button className="family-btn family-btn-primary" onClick={() => {setSelectedMemberId(null);openMemberEditor(selectedMember);}}><Edit3 size={15}/> Edit profile</button>
          <button className="family-btn family-btn-outline" onClick={() => {setSelectedMemberId(null);showTab("Relationships");linkMember(selectedMember.id, "");}}>Add connection</button>
          <button className="family-btn family-btn-outline" onClick={() => changeMemberStatus(selectedMember.id, selectedProfile.status === "ACTIVE")}>
            {selectedProfile.status === "ACTIVE" ? "Archive" : "Restore"}
          </button></div>
      </aside>
    </div>}

    {editingMemberId && <div className="family-modal-backdrop" onClick={() => setEditingMemberId(null)}>
      <section className="family-form-modal" role="dialog" aria-modal="true" aria-label="Member editor" onClick={e => e.stopPropagation()}>
        <div className="family-modal-heading"><div><span>FAMILY MEMBERSHIP</span><h2>{editingMemberId === "NEW" ? "Add family member" : "Edit member profile"}</h2></div><button onClick={() => setEditingMemberId(null)} aria-label="Close"><X size={19}/></button></div>
        <form onSubmit={saveMember}><div className="family-form-grid">
          <label>First name / display name<input autoFocus required maxLength={70} placeholder="Enter name" value={memberForm.name} onChange={e => setMemberForm(p => ({...p,name:e.target.value}))}/></label>
          <label>Preview family role<select value={memberForm.role} onChange={e => setMemberForm(p => ({...p,role:e.target.value as FamilyRole}))}>{roleChoices.map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></label>
          <label>Family relationship label<input maxLength={80} placeholder="e.g. Aunt, parent, cousin" value={memberForm.relation} onChange={e => setMemberForm(p => ({...p,relation:e.target.value}))}/></label>
          <label>Birthday reminder (MM-DD)<input placeholder="Optional: 05-12" maxLength={5} value={memberForm.birthday} onChange={e => setMemberForm(p => ({...p,birthday:e.target.value}))}/></label>
          <label className="family-span-two">About<textarea maxLength={280} rows={3} placeholder="A short family-friendly introduction" value={memberForm.about} onChange={e => setMemberForm(p => ({...p,about:e.target.value}))}/></label>
          <label className="family-span-two">Interests (comma separated)<input placeholder="e.g. Art, cycling, books" value={memberForm.interests} onChange={e => setMemberForm(p => ({...p,interests:e.target.value}))}/></label>
          <label className="family-span-two">Preview visibility<select value={memberForm.visibility} onChange={e => setMemberForm(p => ({...p,visibility:e.target.value as FamilyProfile["visibility"]}))}><option value="FAMILY">Family visible</option><option value="SELECTED">Selected members (label only)</option><option value="PRIVATE">Private (label only)</option></select></label>
        </div>{formError && <p className="family-form-error" role="alert">{formError}</p>}
        <p className="family-form-disclaimer"><Info size={16}/> Profile data is browser-local and unencrypted. Visibility labels are illustrative, not enforced.</p>
        <div className="family-form-actions"><button type="button" className="family-btn family-btn-outline" onClick={() => setEditingMemberId(null)}>Cancel</button><button type="submit" className="family-btn family-btn-primary"><Check size={16}/> Save member</button></div>
        </form>
      </section>
    </div>}

    {editingHouseholdId && <div className="family-modal-backdrop" onClick={() => setEditingHouseholdId(null)}>
      <section className="family-form-modal" role="dialog" aria-modal="true" aria-label="Household editor" onClick={e => e.stopPropagation()}>
        <div className="family-modal-heading"><div><span>HOUSEHOLD SETTINGS</span><h2>{editingHouseholdId === "NEW" ? "Create household" : "Manage household"}</h2></div><button onClick={() => setEditingHouseholdId(null)} aria-label="Close"><X size={19}/></button></div>
        <form onSubmit={saveHousehold}>
          <div className="family-form-grid"><label>Household name<input autoFocus required maxLength={90} value={householdForm.name} onChange={e => setHouseholdForm(p => ({...p,name:e.target.value}))} placeholder="e.g. Main family home"/></label>
            <label>Household type<select value={householdForm.type} onChange={e => setHouseholdForm(p => ({...p,type:e.target.value as HouseholdType}))}>{householdChoices.map(type => <option key={type} value={type}>{HOUSEHOLD_LABELS[type]}</option>)}</select></label>
            <label className="family-span-two">City or general location<input maxLength={120} value={householdForm.location} onChange={e => setHouseholdForm(p => ({...p,location:e.target.value}))} placeholder="e.g. Nairobi — no street address needed"/></label>
            <label className="family-span-two">Description<textarea rows={2} maxLength={220} value={householdForm.description} onChange={e => setHouseholdForm(p => ({...p,description:e.target.value}))}/></label>
          </div>
          <span className="family-form-label">Household members</span><div className="family-household-picker">{visibleMembers.map(m =>
            <label key={m.id}><input type="checkbox" checked={householdForm.memberIds.includes(m.id)}
              onChange={e => setHouseholdForm(p => ({...p,memberIds: e.target.checked
                ? Array.from(new Set([...p.memberIds,m.id])) : p.memberIds.filter(id => id !== m.id)}))}/>
              <Avatar member={m} size="small"/><span>{m.name}</span></label>)}</div>
          {formError && <p className="family-form-error" role="alert">{formError}</p>}
          <div className="family-form-actions">{editingHouseholdId !== "NEW" && <button type="button" className="family-btn family-btn-danger" onClick={() => archiveHousehold(editingHouseholdId!)}><Trash2 size={14}/> Archive</button>}<button type="button" className="family-btn family-btn-outline" onClick={() => setEditingHouseholdId(null)}>Cancel</button><button type="submit" className="family-btn family-btn-primary"><Check size={16}/> Save household</button></div>
        </form>
      </section>
    </div>}

    {relationshipModal && <div className="family-modal-backdrop" onClick={() => setRelationshipModal(false)}>
      <section className="family-form-modal" role="dialog" aria-modal="true" aria-label="Add relationship" onClick={e => e.stopPropagation()}>
        <div className="family-modal-heading"><div><span>FAMILY CONNECTION</span><h2>Add a relationship</h2></div><button onClick={() => setRelationshipModal(false)} aria-label="Close"><X size={19}/></button></div>
        <form onSubmit={saveRelationship}><div className="family-form-grid">
          <label>From member<select required value={relationshipForm.fromId} onChange={e => setRelationshipForm(p => ({...p,fromId:e.target.value}))}><option value="">Select member</option>{visibleMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
          <label>Relationship type<select value={relationshipForm.type} onChange={e => setRelationshipForm(p => ({...p,type:e.target.value as RelationshipType}))}>{relationChoices.map(type => <option key={type} value={type}>{RELATIONSHIP_LABELS[type]}</option>)}</select></label>
          <label className="family-span-two">To member<select required value={relationshipForm.toId} onChange={e => setRelationshipForm(p => ({...p,toId:e.target.value}))}><option value="">Select member</option>{visibleMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
          <label className="family-span-two">Context (optional)<textarea rows={2} maxLength={200} value={relationshipForm.note} onChange={e => setRelationshipForm(p => ({...p,note:e.target.value}))} placeholder="Additional family context"/></label>
        </div>{formError && <p className="family-form-error" role="alert">{formError}</p>}<p className="family-form-disclaimer"><Info size={16}/> For directional links such as “Parent of”, select the parent first. Relationship labels do not grant legal or system authority.</p>
        <div className="family-form-actions"><button type="button" className="family-btn family-btn-outline" onClick={() => setRelationshipModal(false)}>Cancel</button><button type="submit" className="family-btn family-btn-primary"><Plus size={16}/> Add connection</button></div></form>
      </section>
    </div>}

    {familyEdit && <div className="family-modal-backdrop" onClick={() => setFamilyEdit(false)}>
      <section className="family-form-modal" role="dialog" aria-modal="true" aria-label="Edit family" onClick={e => e.stopPropagation()}>
        <div className="family-modal-heading"><div><span>YOUR FAMILY</span><h2>Family identity</h2></div><button onClick={() => setFamilyEdit(false)} aria-label="Close"><X size={19}/></button></div>
        <form onSubmit={e => {e.preventDefault(); if (!familyName.trim()) return; updateFamily(prev => ({...prev,name:familyName.trim(),motto:familyMotto.trim()}));setFamilyEdit(false);onToast("Family identity updated");}}>
          <div className="family-form-grid"><label className="family-span-two">Family name<input required maxLength={80} value={familyName} onChange={e => setFamilyName(e.target.value)}/></label><label className="family-span-two">Family motto<input maxLength={150} value={familyMotto} onChange={e => setFamilyMotto(e.target.value)}/></label></div>
          <div className="family-form-actions"><button type="button" className="family-btn family-btn-outline" onClick={() => setFamilyEdit(false)}>Cancel</button><button type="submit" className="family-btn family-btn-primary"><Check size={16}/> Save changes</button></div>
        </form>
      </section>
    </div>}

    <footer className="family-footer"><span>Family OS · Phase 2 — Family & Household</span><span>Frontend preview · Browser-local data only</span></footer>
  </main>;
}
