import {useEffect,useState,type FormEvent} from "react";
import type {User} from "oidc-client-ts";
import {
  ArrowRight,Building2,CheckCircle2,ChevronRight,ClipboardCopy,DoorOpen,
  Home,Info,KeyRound,LockKeyhole,Plus,RefreshCw,ShieldAlert,ShieldCheck,Trash2,UsersRound,X
} from "lucide-react";
import {
  endLiveSession,liveCallbackError,liveRequest,liveSettings,liveUser,startLiveLogin
} from "./auth";
import "./live.css";
type Family={id:string;name:string;role:string;createdAt:string};
type Household={id:string;familyId:string;name:string;kind:string;createdAt:string;updatedAt:string;archivedAt:string|null};
type Member={userId:string;role:string;state:string;joinedAt:string};
type Me={id:string;authority:string;familyCount:number};
type Listing<T>={data:{items:T[];count?:number;hasMore:boolean}};
type FamilyResult={data:Family};
type HouseholdResult={data:Household};
type MeResult={data:Me};
type Role="ADULT"|"GUEST";
type Tab="Families"|"Households"|"Members & Invitations";
const kinds=["PRIMARY_HOME","SECONDARY_HOME","SHARED_HOME","OTHER"] as const;
const isManager=(role:string)=>role==="OWNER"||role==="CO_PARENT";
const readable=(kind:string)=>kind.split("_").map(w=>w.toLowerCase()).join(" ");
type Props={navigate:(route:string)=>void};

export default function LiveRegistry({navigate}:Props){
  const [user,setUser]=useState<User|null>(null);
  const [me,setMe]=useState<Me|null>(null);
  const [families,setFamilies]=useState<Family[]>([]);
  const [selectedId,setSelectedId]=useState("");
  const [households,setHouseholds]=useState<Household[]>([]);
  const [members,setMembers]=useState<Member[]>([]);
  const [tab,setTab]=useState<Tab>("Families");
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");
  const [error,setError]=useState(liveCallbackError());
  const [familyName,setFamilyName]=useState("");
  const [houseName,setHouseName]=useState("");
  const [houseKind,setHouseKind]=useState<(typeof kinds)[number]>("OTHER");
  const [editing,setEditing]=useState<{id:string;name:string;kind:(typeof kinds)[number]}|null>(null);
  const [inviteTarget,setInviteTarget]=useState("");
  const [inviteRole,setInviteRole]=useState<Role>("ADULT");
  const [issued,setIssued]=useState<{id:string;code:string;expiresAt:string}|null>(null);
  const [acceptId,setAcceptId]=useState("");
  const [acceptCode,setAcceptCode]=useState("");
  const selected=families.find(f=>f.id===selectedId)||null;
  const failure=(e:unknown)=>{setError(e instanceof Error?e.message:"Request failed.");setMessage("");};
  async function refreshFamilies(u:User){
    const [principal,owned]=await Promise.all([
      liveRequest<MeResult>(u,"/api/v1/me"),liveRequest<Listing<Family>>(u,"/api/v1/families")
    ]);
    setMe(principal.data);setFamilies(owned.data.items);
    setSelectedId(current=>owned.data.items.some(f=>f.id===current)?current:owned.data.items[0]?.id||"");
  }
  useEffect(()=>{
    let active=true;
    void (async()=>{
      try{
        const u=await liveUser();
        if(!active)return;
        setUser(u);
        if(u)await refreshFamilies(u);
      }catch(e){if(active)failure(e);}
      finally{if(active)setLoading(false);}
    })();
    return ()=>{active=false;};
  },[]);
  useEffect(()=>{
    if(!user||!selectedId){setHouseholds([]);setMembers([]);return;}
    const family=families.find(f=>f.id===selectedId);
    if(!family)return;
    let active=true;
    void (async()=>{
      try{
        const homes=isManager(family.role)||family.role==="ADULT"?
          await liveRequest<Listing<Household>>(user,"/api/v1/families/"+selectedId+"/households"):null;
        const roster=family.role==="OWNER"?
          await liveRequest<Listing<Member>>(user,"/api/v1/families/"+selectedId+"/memberships"):null;
        if(active){setHouseholds(homes?.data.items||[]);setMembers(roster?.data.items||[]);}
      }catch(e){if(active)failure(e);}
    })();
    return ()=>{active=false;};
  },[selectedId,user,families]);
  async function run(action:()=>Promise<void>){
    setBusy(true);setError("");setMessage("");setIssued(null);
    try{await action();}catch(e){failure(e);}finally{setBusy(false);}
  }
  const updateDetails=async(u:User,which=selectedId)=>{
    if(!which)return;
    const family=families.find(f=>f.id===which);
    if(!family)return;
    const [homes,roster]=await Promise.all([
      family.role==="GUEST"?Promise.resolve(null):liveRequest<Listing<Household>>(u,
        "/api/v1/families/"+which+"/households"),
      family.role==="OWNER"?liveRequest<Listing<Member>>(u,
        "/api/v1/families/"+which+"/memberships"):Promise.resolve(null)
    ]);
    setHouseholds(homes?.data.items||[]);setMembers(roster?.data.items||[]);
  };
  const createFamily=(e:FormEvent)=>{e.preventDefault();if(!user)return;void run(async()=>{
    const family=await liveRequest<FamilyResult>(user,"/api/v1/families","POST",{name:familyName.trim()});
    setFamilyName("");await refreshFamilies(user);setSelectedId(family.data.id);
    setMessage("Family created in PostgreSQL, with your verified OWNER membership.");
  });};
  const createHousehold=(e:FormEvent)=>{e.preventDefault();if(!user||!selected)return;void run(async()=>{
    await liveRequest<HouseholdResult>(user,"/api/v1/families/"+selected.id+"/households",
      "POST",{name:houseName.trim(),kind:houseKind});
    setHouseName("");setHouseKind("OTHER");await updateDetails(user);
    setMessage("Household stored in the authoritative family registry.");
  });};
  const saveHousehold=(e:FormEvent)=>{e.preventDefault();if(!user||!selected||!editing)return;void run(async()=>{
    await liveRequest(user,"/api/v1/families/"+selected.id+"/households/"+editing.id,
      "PATCH",{name:editing.name.trim(),kind:editing.kind});
    setEditing(null);await updateDetails(user);setMessage("Household updated.");
  });};
  const archiveHousehold=(id:string)=>{if(!user||!selected||!window.confirm("Archive this household? This hides it from the active registry."))return;
    void run(async()=>{
      await liveRequest(user,"/api/v1/families/"+selected.id+"/households/"+id,"DELETE");
      await updateDetails(user);setMessage("Household archived.");
    });};
  const createInvite=(e:FormEvent)=>{e.preventDefault();if(!user||!selected)return;void run(async()=>{
    const invitation=await liveRequest<{data:{id:string;code:string;expiresAt:string}}>(user,
      "/api/v1/families/"+selected.id+"/invitations","POST",
      {targetUserId:inviteTarget.trim(),role:inviteRole});
    setIssued(invitation.data);setInviteTarget("");
    setMessage("A one-time invite was issued to this verified identity. Its secret is displayed once and never saved locally.");
  });};
  const join=(e:FormEvent)=>{e.preventDefault();if(!user)return;void run(async()=>{
    const answer=await liveRequest<{data:{familyId:string;role:string}}>(user,
      "/api/v1/invitations/"+acceptId.trim()+"/accept","POST",{code:acceptCode.trim()});
    setAcceptCode("");setAcceptId("");await refreshFamilies(user);
    setSelectedId(answer.data.familyId);
    setMessage("Invitation accepted. Your family membership is now authoritative.");
  });};
  const modifyRole=(id:string,role:Role)=>{if(!user||!selected)return;void run(async()=>{
    await liveRequest(user,"/api/v1/families/"+selected.id+"/memberships/"+id,"PATCH",{role});
    await updateDetails(user);setMessage("Role updated and audited.");
  });};
  const removeMember=(id:string)=>{if(!user||!selected||!window.confirm("Revoke this adult/guest membership? Their family access will end."))return;
    void run(async()=>{
      await liveRequest(user,"/api/v1/families/"+selected.id+"/memberships/"+id,"DELETE");
      await updateDetails(user);setMessage("Membership revoked. Future access requires a new invitation.");
    });};
  const logout=()=>{void run(async()=>{
    await endLiveSession();setUser(null);setMe(null);setFamilies([]);setSelectedId("");setHouseholds([]);
    setMembers([]);setMessage("Signed out locally. The browser no longer holds an access token.");
  });};

  return <main className="lr-workspace">
    <div className="lr-crumb"><button onClick={()=>navigate("Dashboard")}>Dashboard</button><ChevronRight size={14}/>
      <button onClick={()=>navigate("Family")}>Family preview</button><ChevronRight size={14}/>Authenticated Registry</div>
    <section className="lr-hero"><div><span><ShieldCheck size={17}/> PHASE B1 · SERVER-AUTHORITATIVE WORKSPACE</span>
      <h1>The family registry, <em>with real boundaries.</em></h1>
      <p>Verified identities, PostgreSQL-backed family memberships and governed adult household operations.
        This is separate from the fictional Family OS preview.</p>
      <div className="lr-hero-foot"><span><LockKeyhole size={15}/> OIDC sign-in</span><span><Building2 size={15}/> PostgreSQL families</span>
        <span><UsersRound size={15}/> Server-checked roles</span></div></div>
      <div className="lr-hero-mark"><ShieldCheck size={52}/></div></section>
    <section className="lr-banner"><ShieldAlert size={20}/><div><strong>Protected family data must stay within verified permissions.</strong>
      <p>Phase B1 handles only family names, household labels, opaque identity IDs and adult/guest roles.
        No child enrollment, personal profiles, private memories, guardian consent or cross-OS data is exposed.
        Demo family members are not automatically imported.</p></div></section>
    {error&&<div className="lr-alert lr-error" role="alert">{error}<button onClick={()=>setError("")} aria-label="Dismiss error"><X size={16}/></button></div>}
    {message&&<div className="lr-alert lr-good" role="status"><CheckCircle2 size={17}/>{message}</div>}
    {!liveSettings?<section className="lr-panel lr-setup"><LockKeyhole size={30}/><h2>Production identity connection is not configured</h2>
      <p>The app deliberately refuses to invent users, access tokens or family authorization. The current Pages preview will not make live API requests.</p>
      <div className="lr-setup-note"><strong>Required build configuration</strong>
        <code>VITE_FAMILY_API_URL</code><code>VITE_FAMILY_OIDC_AUTHORITY</code><code>VITE_FAMILY_OIDC_CLIENT_ID</code>
        <p>Register this site's exact HTTPS callback URL with your OIDC provider. Use authorization-code PKCE and a public SPA client (no client secret).</p></div>
      <button className="lr-btn subtle" onClick={()=>navigate("Family")}><ArrowRight size={15}/> Open fictional Family preview</button>
    </section>:
    loading?<section className="lr-panel"><p>Checking authenticated session...</p></section>:
    !user?<section className="lr-panel lr-setup"><KeyRound size={32}/><h2>Sign in through your configured identity provider</h2>
      <p>Identity is verified by your issuer. Access tokens are kept in memory and never copied into Family OS localStorage.</p>
      <button className="lr-btn primary" disabled={busy} onClick={()=>void run(startLiveLogin)}>
        <LockKeyhole size={16}/> Sign in with OIDC</button>
      <p className="lr-muted">Requires an actual trusted issuer, public SPA client, registered callback URL and accessible API. No standalone password form is provided.</p>
    </section>:<>
      <div className="lr-topline"><div className="lr-identity"><span><ShieldCheck size={16}/> VERIFIED OIDC SESSION</span>
        <strong>{me?.id||"Loading actor identity..."}</strong>
        <small>Share this opaque ID privately with a family owner to receive a bound invitation.</small></div>
        <div className="lr-top-actions"><button className="lr-btn subtle" disabled={busy} onClick={()=>void run(async()=>{
          await refreshFamilies(user);setMessage("Authoritative family list refreshed.");
        })}><RefreshCw size={15}/> Refresh</button>
        <button className="lr-btn subtle" onClick={logout}><DoorOpen size={16}/> Sign out locally</button></div></div>
      <nav className="lr-tabs" aria-label="Authenticated registry sections">{(["Families","Households","Members & Invitations"] as Tab[]).map(t=>
        <button key={t} className={tab===t?"selected":""} aria-current={tab===t?"page":undefined}
          onClick={()=>setTab(t)}>{t}</button>)}</nav>
      <div className="lr-layout"><div className="lr-main">
        <div className="lr-panel lr-context"><label htmlFor="lr-family-select">Current verified family</label>
          <select id="lr-family-select" value={selectedId} onChange={e=>setSelectedId(e.target.value)}>
            <option value="">Choose family</option>{families.map(f=><option value={f.id} key={f.id}>{f.name} · {f.role}</option>)}</select>
          <span>{selected?selected.role+" membership · active":"No family selected"}</span></div>
        {tab==="Families"&&<>
          <section className="lr-panel"><h2><Home size={19}/> Your verified families</h2>
            {families.length?families.map(f=><button className="lr-family-card" key={f.id} onClick={()=>{
              setSelectedId(f.id);setTab("Households");
            }}><span className="lr-card-symbol"><Home size={20}/></span><span><strong>{f.name}</strong>
              <small>{f.role} · {f.id}</small></span><ChevronRight size={18}/></button>):
              <p className="lr-muted">No server-authoritative families yet. Create one or accept an adult invitation.</p>}
          </section>
          <section className="lr-panel"><h2><Plus size={19}/> Start a family registry</h2>
            <p className="lr-muted">Creating a new family records your verified subject as its first OWNER. No fictional history is copied.</p>
            <form className="lr-form" onSubmit={createFamily}><label>Family name
              <input aria-label="New family name" value={familyName} minLength={2} maxLength={120} required
                onChange={e=>setFamilyName(e.target.value)} placeholder="Family name"/></label>
              <button className="lr-btn primary" disabled={busy}><Plus size={15}/> Create verified family</button></form>
          </section>
        </>}
        {tab==="Households"&&selected&&<>
          <section className="lr-panel"><h2><Building2 size={19}/> Family households</h2>
            {selected.role==="GUEST"?<p className="lr-muted">Guests cannot view household information.</p>:
            households.length?households.map(h=><article className="lr-household" key={h.id}>
              <span className="lr-card-symbol"><Home size={19}/></span>
              <div><strong>{h.name}</strong><small>{readable(h.kind)} · {h.id}</small></div>
              {isManager(selected.role)&&<div className="lr-row-actions">
                <button aria-label={"Edit "+h.name} onClick={()=>setEditing({id:h.id,name:h.name,kind:h.kind as typeof kinds[number]})}>
                  Edit</button><button aria-label={"Archive "+h.name} onClick={()=>archiveHousehold(h.id)}><Trash2 size={17}/></button>
              </div>}</article>):<p className="lr-muted">No active household labels recorded in this family's server registry.</p>}
          </section>
          {isManager(selected.role)&&<section className="lr-panel"><h2><Plus size={19}/> Add non-sensitive household</h2>
            <p className="lr-muted">Names/types only. Never enter home addresses, member birth dates or child location data here.</p>
            <form className="lr-form" onSubmit={createHousehold}><label>Household label
              <input aria-label="Household label" value={houseName} required minLength={2} maxLength={120}
                onChange={e=>setHouseName(e.target.value)} placeholder="Example: Main household"/></label>
              <label>Household type<select value={houseKind} onChange={e=>setHouseKind(e.target.value as typeof kinds[number])}>
                {kinds.map(k=><option key={k} value={k}>{readable(k)}</option>)}</select></label>
              <button className="lr-btn primary" disabled={busy}><Plus size={15}/> Create household</button></form>
          </section>}
        </>}
        {tab==="Households"&&!selected&&<section className="lr-panel"><p>Select a family to view its household registry.</p></section>}
        {tab==="Members & Invitations"&&<>
          {selected?.role==="OWNER"&&<section className="lr-panel"><h2><UsersRound size={19}/> Verified adult memberships</h2>
            <p className="lr-muted">Only opaque verified actor IDs and roles are shown; no private family profiles or child identities.</p>
            {members.map(m=><div className="lr-member" key={m.userId}><span className="lr-card-symbol"><UsersRound size={18}/></span>
              <div><strong>{m.userId===me?.id?"You (verified)":"Verified family actor"}</strong>
                <small>{m.userId} · {m.role}</small></div>
              {["ADULT","GUEST"].includes(m.role)&&<div className="lr-row-actions">
                <select aria-label={"Role for "+m.userId} disabled={busy} value={m.role}
                  onChange={e=>modifyRole(m.userId,e.target.value as Role)}>
                  <option value="ADULT">Adult</option><option value="GUEST">Guest</option></select>
                <button aria-label={"Revoke "+m.userId} disabled={busy} onClick={()=>removeMember(m.userId)}>
                  <Trash2 size={17}/></button></div>}</div>)}
          </section>}
          {selected?.role==="OWNER"&&<section className="lr-panel"><h2><KeyRound size={19}/> Invite a verified adult or guest</h2>
            <p className="lr-muted">Recipient must first sign in and share their opaque actor ID. The code is bound to that identity, expires after 48 hours and cannot enroll children.</p>
            <form className="lr-form" onSubmit={createInvite}><label>Recipient verified actor ID
              <input aria-label="Recipient actor ID" required value={inviteTarget} onChange={e=>setInviteTarget(e.target.value)}
                placeholder="UUID from their authenticated registry"/></label>
              <label>Limited membership role<select aria-label="Invitation role" value={inviteRole}
                onChange={e=>setInviteRole(e.target.value as Role)}>
                <option value="ADULT">Adult</option><option value="GUEST">Guest</option></select></label>
              <button className="lr-btn primary" disabled={busy}><Plus size={15}/> Issue one-time invitation</button></form>
          </section>}
          {issued&&<section className="lr-panel lr-secret"><h2><KeyRound size={19}/> One-time invitation details</h2>
            <p>Share both values privately with the intended verified user. The secret is not retained in browser storage and will disappear when you leave this screen.</p>
            <label>Invitation ID<output>{issued.id}</output></label>
            <label>One-time code<output>{issued.code}</output></label>
            <small>Expires: {issued.expiresAt}</small><button className="lr-btn subtle" onClick={()=>{
              void navigator.clipboard.writeText(issued.id+"\n"+issued.code).then(()=>setMessage("Invitation details copied. Clear your clipboard after sharing.")).catch(()=>failure("Clipboard unavailable."));
            }}><ClipboardCopy size={15}/> Copy invitation details</button>
            <button className="lr-btn subtle" onClick={()=>setIssued(null)}><X size={14}/> Hide secret</button></section>}
          <section className="lr-panel"><h2><KeyRound size={19}/> Accept an invitation to your verified identity</h2>
            <p className="lr-muted">Use the ID and one-time code received from a family owner. Your signed-in OIDC subject must match the intended recipient.</p>
            <form className="lr-form" onSubmit={join}><label>Invitation ID<input required aria-label="Invitation ID"
              value={acceptId} onChange={e=>setAcceptId(e.target.value)} placeholder="UUID"/></label>
              <label>One-time code<input type="password" required autoComplete="off" aria-label="Invitation one-time code"
                value={acceptCode} onChange={e=>setAcceptCode(e.target.value)} minLength={64} maxLength={64}
                placeholder="64-character secret"/></label>
              <button className="lr-btn primary" disabled={busy}><CheckCircle2 size={16}/> Accept verified invitation</button></form>
          </section>
          {selected&&selected.role!=="OWNER"&&<p className="lr-muted">Only a verified OWNER can list or manage memberships and issue invitations.</p>}
        </>}
      </div>
      <aside className="lr-side"><section className="lr-panel"><h2><ShieldCheck size={18}/> Backend authority</h2>
        <div className="lr-boundary"><CheckCircle2 size={16}/><span>Signed OIDC access token (PKCE) verified at API</span></div>
        <div className="lr-boundary"><CheckCircle2 size={16}/><span>PostgreSQL RLS and permission checks for each operation</span></div>
        <div className="lr-boundary"><CheckCircle2 size={16}/><span>Audit and transactional outbox on mutations</span></div>
        <div className="lr-boundary"><Info size={16}/><span>Membership roles are not legal parental custody or individual-data consent</span></div>
        <div className="lr-boundary"><ShieldAlert size={16}/><span>Children, personal data and cross-OS integrations are intentionally unavailable</span></div>
      </section>
      <section className="lr-panel"><h2>Frontend boundaries</h2><p className="lr-muted">The original Family page remains a fictional local preview. No demo records are automatically synchronized or promoted into your authenticated family.</p>
        <button className="lr-btn subtle" onClick={()=>navigate("Family")}><ArrowRight size={15}/> View demo Family design</button></section></aside></div>
    </>}
    {editing&&<div className="lr-overlay" onClick={()=>setEditing(null)}><section className="lr-dialog"
      role="dialog" aria-modal="true" aria-label="Edit household" onClick={e=>e.stopPropagation()}>
      <div className="lr-dialog-head"><h2>Update household</h2><button onClick={()=>setEditing(null)}
        aria-label="Close household editor"><X size={19}/></button></div>
      <form className="lr-form" onSubmit={saveHousehold}><label>Household label<input required
        aria-label="Edit household label" value={editing.name} minLength={2} maxLength={120}
        onChange={e=>setEditing({...editing,name:e.target.value})}/></label>
        <label>Household type<select value={editing.kind} onChange={e=>setEditing({...editing,
          kind:e.target.value as typeof kinds[number]})}>{kinds.map(k=><option key={k} value={k}>{readable(k)}</option>)}</select></label>
        <div className="lr-dialog-actions"><button type="button" className="lr-btn subtle" onClick={()=>setEditing(null)}>Cancel</button>
          <button className="lr-btn primary" disabled={busy}>Save verified household</button></div></form></section></div>}
  </main>;
}
