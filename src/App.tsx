import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  Activity, ArrowLeft, ArrowRight, Bell, BookHeart, CalendarDays,
  Check, CheckCircle2, ChevronDown, ChevronRight, Circle, ClipboardCheck,
  Clock3, Command, Compass, Heart, HeartHandshake, Home, Info, Lightbulb,
  ListTodo, Menu, MessageSquareText, Moon, Plus, Search, Settings2, ShieldCheck,
  Sparkles, Sun, Target, TreePine, TrendingUp, TriangleAlert, UserRound,
  UsersRound, X, type LucideIcon
} from "lucide-react";
import { seed, navItems, navigationDescriptions } from "./data";
import type { AppData, Goal, Member } from "./data";
import FamilyWorkspace from "./family/FamilyWorkspace";
import OperationsWorkspace from "./operations/OperationsWorkspace";
import StrategyWorkspace from "./strategy/StrategyWorkspace";
import GovernanceWorkspace from "./governance/GovernanceWorkspace";
import FamilyLifeWorkspace from "./life/FamilyLifeWorkspace";
import IntelligenceWorkspace from "./intelligence/IntelligenceWorkspace";
import GlobalSearch from "./search/GlobalSearch";
import {type SearchEntry,routeFromSearch} from "./search/model";
import { deriveSignals, evidenceCoverage, isDismissed, migrateIntelligence } from "./intelligence/model";
import { normalizeLife } from "./life/model";
import { normalizeGovernance, decisionNeedsInput } from "./governance/model";
import { migrateStrategy, normalizedGoals, recordGoalProgress } from "./strategy/model";
import { clockDisplay, dateKey, dateLabel, eventDate, eventsBetween, eventsOnDate, normalizeOperations, tasksOnDate, taskDoneOn, toggleTaskForDate, shiftDate } from "./operations/model";
import { activeMembers, migrateFamilyData, profileFor } from "./family/model";

const STORE_KEY = "family-os-preview-v1";
const icons: Record<string, LucideIcon> = {
  dashboard: Home, family: UsersRound, plan: ClipboardCheck, goals: Target,
  decisions: HeartHandshake, calendar: CalendarDays, tasks: ListTodo,
  routines: Clock3, experiences: Compass, memory: BookHeart, traditions: Heart, legacy: TreePine, insights: Activity,
  search: Search
};
const todayText = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "full", timeZone: "Africa/Nairobi"
}).format(new Date());
const shortDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", timeZone: "Africa/Nairobi"
}).format(new Date());

function readPreview(): AppData {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORE_KEY) || "null");
    if (parsed && typeof parsed === "object" && "members" in parsed && "tasks" in parsed &&
        Array.isArray(parsed.members) && Array.isArray(parsed.tasks) &&
        "goals" in parsed && Array.isArray(parsed.goals) &&
        "events" in parsed && Array.isArray(parsed.events) &&
        "upcoming" in parsed && Array.isArray(parsed.upcoming)) return { ...(parsed as AppData), family: migrateFamilyData((parsed as Partial<AppData>).family), operations: normalizeOperations((parsed as Partial<AppData>).operations), strategy: migrateStrategy((parsed as Partial<AppData>).strategy), governance: normalizeGovernance((parsed as Partial<AppData>).governance), life: normalizeLife((parsed as Partial<AppData>).life), intelligence: migrateIntelligence((parsed as Partial<AppData>).intelligence), goals: normalizedGoals((parsed as AppData).goals) };
  } catch { /* local storage can be disabled; use preview state */ }
  return seed;
}
function id() { return "local-" + Date.now() + "-" + Math.floor(Math.random() * 9999); }
function Avatar({ member, small = false }: { member: Member; small?: boolean }) {
  return <span className={"avatar " + (small ? "avatar-small" : "")}
    style={{ backgroundColor: member.color }} title={member.name} aria-label={member.name}>
    <span className="avatar-fallback">{member.name.slice(0, 1).toUpperCase()}</span>
  </span>;
}
function MemberStack({ ids, members }: { ids: string[]; members: Member[] }) {
  return <span className="member-stack">{ids.map(m => {
    const member = members.find(member => member.id === m);
    return member ? <Avatar key={m} member={member} small /> : null;
  })}</span>;
}
function IconBox({ icon: Icon, tint }: { icon: LucideIcon; tint: string }) {
  return <span className={"icon-box " + tint}><Icon size={22} strokeWidth={2.4} /></span>;
}
function CardTitle({ children, action, onAction }: { children: React.ReactNode; action?: string; onAction?: () => void }) {
  return <div className="card-title-row"><h2>{children}</h2>{action && <button className="card-action" onClick={onAction}>{action} <ArrowRight size={15} /></button>}</div>;
}
function Input({ label, value, onChange, placeholder, required = false }: {
  label: string; value: string; onChange: (value: string) => void; placeholder: string; required?: boolean
}) {
  return <label className="field"><span>{label}</span><input required={required} value={value}
    onChange={e => onChange(e.target.value)} placeholder={placeholder} /></label>;
}
function MetricCard({ title, value, foot, icon: Icon, tone, onClick }: {
  title: string; value: string | number; foot: string; icon: LucideIcon; tone: string; onClick: () => void
}) {
  return <button className="metric-card" onClick={onClick}>
    <IconBox icon={Icon} tint={tone} />
    <span className="metric-content"><span className="metric-title">{title}</span>
      <strong>{value}</strong><small className={foot === "On track" ? "positive" : ""}>{foot}</small></span>
    <ChevronRight size={17} className="metric-chevron" />
  </button>;
}
function formatGreeting() {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Africa/Nairobi" }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export default function App() {
  const [data, setData] = useState<AppData>(readPreview);
  const [route, setRoute] = useState(() => decodeURIComponent(window.location.hash.slice(2) || "Dashboard"));
  const [dark, setDark] = useState(() => window.localStorage.getItem("family-os-theme") === "dark");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [familyOpen, setFamilyOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTarget, setSearchTarget] = useState<SearchEntry | null>(null);
  const [addKind, setAddKind] = useState<"Task" | "Goal" | "Event" | "Member" | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftExtra, setDraftExtra] = useState("");
  const [details, setDetails] = useState<{ title: string; body: string; kind: string } | null>(null);
  const [toast, setToast] = useState("");
  const [operationsAction, setOperationsAction] = useState<"Task" | "Event" | null>(null);
  const [strategyAction, setStrategyAction] = useState<"Goal" | null>(null);
  const [sampleVisible, setSampleVisible] = useState(true);

  useEffect(() => {
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch { /* storage unavailable */ }
  }, [data]);
  useEffect(() => {
    try { window.localStorage.setItem("family-os-theme", dark ? "dark" : "light"); } catch { /* ignore */ }
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  useEffect(() => {
    function hashChanged() { setRoute(decodeURIComponent(window.location.hash.slice(2) || "Dashboard")); setMenuOpen(false); }
    function keyboard(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); setSearchOpen(s => !s);
      }
      if (e.key === "Escape") { setSearchOpen(false); setAddKind(null); setDetails(null); setNotificationsOpen(false); }
    }
    window.addEventListener("hashchange", hashChanged);
    window.addEventListener("keydown", keyboard);
    return () => { window.removeEventListener("hashchange", hashChanged); window.removeEventListener("keydown", keyboard); };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const handle = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(handle);
  }, [toast]);

  const navigate = (next: string, fromSearch = false) => {
    if (!fromSearch) setSearchTarget(null);
    window.location.hash = "#/" + encodeURIComponent(next);
    setRoute(next); setMenuOpen(false); setSearchOpen(false); setNotificationsOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const chooseSearch = (entry: SearchEntry) => {
    setSearchTarget(entry.kind==="SHARED_RECORD"?entry:null);
    navigate(routeFromSearch(entry),true);
  };
  const openAdd = (kind: "Task" | "Goal" | "Event" | "Member") => {
    if (kind === "Task" || kind === "Event") {
      setAddKind(null);
      setOperationsAction(kind);
      navigate(kind === "Task" ? "Responsibilities" : "Calendar");
      return;
    }
    if (kind === "Goal") {
      setAddKind(null); setStrategyAction("Goal"); navigate("Goals"); return;
    }
    setDraftTitle(""); setDraftExtra(""); setAddKind(kind);
  };
  const submitAdd = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const title = draftTitle.trim();
    if (!title || !addKind) return;
    if (addKind === "Task") {
      setData(prev => ({ ...prev, tasks: [{ id: id(), title, person: draftExtra.trim() || "Alex", due: "Today", done: false }, ...prev.tasks] }));
    } else if (addKind === "Goal") {
      setData(prev => ({ ...prev, goals: [...prev.goals, { id: id(), title, meta: draftExtra.trim() || "New family goal", progress: 0, color: "blue", image: "" }] }));
    } else if (addKind === "Event") {
      setData(prev => ({ ...prev, events: [...prev.events, { id: id(), time: draftExtra.trim() || "6:00 PM", title, note: "Family", attendees: ["alex"], color: "#a9d5fc" }] }));
    } else {
      const next = { id: id(), name: title, role: draftExtra.trim() || "Family member", avatar: 0, color: "#dbeafe" };
      setData(prev => ({ ...prev, members: [...prev.members, next], family: { ...prev.family, profiles: {...prev.family.profiles, [next.id]: profileFor(next.id, next.role)} } }));
    }
    setToast(addKind + " added to this browser's preview");
    setAddKind(null);
  };
  const toggleTask = (taskId: string) => setData(prev => ({
    ...prev, tasks: prev.tasks.map(t => t.id === taskId ? toggleTaskForDate(t, dateKey()) : t)
  }));
  const toggleEvent = (eventId: string) => setData(prev => ({
    ...prev, events: prev.events.map(e => e.id === eventId ? { ...e, done: !e.done } : e)
  }));
  const showDetails = (title: string, body: string, kind: string) => setDetails({ title, body, kind });
  const familyMembers = activeMembers(data.members, data.family);
  const dashboardEvents = eventsOnDate(data.events.filter(e=>Boolean(e.date)&&
    (e.category==="FAMILY"||e.category==="HOME")), dateKey());
  const upcomingLocalEvents = eventsBetween(data.events, shiftDate(dateKey(),1), shiftDate(dateKey(),7))
    .filter(event => Boolean(event.date)&&(event.category==="FAMILY"||event.category==="HOME")).slice(0,5);
  const dashboardTasks = tasksOnDate(data.tasks.filter(t=>Boolean(t.dueDate)&&
    (t.category==="FAMILY"||t.category==="HOME")), dateKey());
  const done = dashboardTasks.filter(t => taskDoneOn(t,dateKey())).length;
  const percent = dashboardTasks.length ? Math.round(done / dashboardTasks.length * 100) : 0;
  const intelligenceSignals = deriveSignals(data,dateKey()).filter(signal=>!isDismissed(signal,data.intelligence));
  const coverage = evidenceCoverage(data);
  const evidenceAttention = intelligenceSignals.filter(signal=>signal.tone==="ATTENTION");
  const phase = navItems.find(item => item.label === route)?.phase || (route === "Personal Mode" ? 8 : 8);

  return <div className="app-shell">
    <a href="#family-main" className="skip-content">Skip to main content</a>
    {menuOpen && <button className="mobile-overlay" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}
    <aside className={"sidebar " + (menuOpen ? "sidebar-open" : "")}>
      <div className="brand"><span className="brand-logo"><span /><span /><span /></span><span>Family OS</span><button className="mobile-sidebar-close" aria-label="Close sidebar" onClick={() => setMenuOpen(false)}><X size={20} /></button></div>
      <nav aria-label="Main navigation" className="side-nav">
        {navItems.map(item => {
          const Icon = icons[item.icon];
          return <button key={item.label} onClick={() => navigate(item.label)}
            className={"nav-item " + (route === item.label ? "active" : "")} aria-current={route===item.label?"page":undefined}>
            <Icon size={19} strokeWidth={1.8} /><span>{item.label}</span></button>;
        })}
      </nav>
      <div className="side-separator" />
      <div className="mode-nav">
        <button className={"nav-item " + (route !== "Personal Mode" ? "mode-active" : "")} onClick={() => navigate("Dashboard")}><UserRound size={19} /><span>Family Mode</span></button>
        <button className={"nav-item " + (route === "Personal Mode" ? "mode-active" : "")} onClick={() => navigate("Personal Mode")}><UserRound size={19} /><span>Personal Mode</span></button>
      </div>
      <div className="sidebar-spacer" />
      <div className="side-separator" />
      <div className="lower-nav">
        <button className="nav-item" onClick={() => setNotificationsOpen(true)}><Bell size={19} /><span>Notifications</span></button>
        <button className="nav-item" onClick={() => navigate("Messages")}><MessageSquareText size={19} /><span>Messages</span></button>
        <button className="nav-item" onClick={() => navigate("Settings")}><Settings2 size={19} /><span>Settings</span></button>
      </div>
      <div className="sidebar-profile">
        {data.members[0]&&<Avatar member={data.members[0]}/>}
        <span><strong>{data.members[0]?.name||data.family.name}</strong><small>Local prototype · Not signed in</small></span>
        <ChevronDown size={14} />
      </div>
    </aside>

    <div className="main-area" id="family-main" tabIndex={-1}>
      <header className="topbar">
        <button className="hamburger" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={22} /></button>
        <button className="top-search" onClick={() => setSearchOpen(true)}><Search size={20} /><span>Search family, events, goals, memories...</span><kbd>⌘ K</kbd></button>
        <div className="topbar-right">
          <div className="family-switch-wrap">
            <button className="family-switch" onClick={() => setFamilyOpen(!familyOpen)} aria-expanded={familyOpen}>
              <MemberStack ids={["alex","jamie"]} members={data.members} /><strong>{data.family.name}</strong><ChevronDown size={16} />
            </button>
            {familyOpen && <div className="popover family-popover"><b>Family workspace</b><p>{data.family.name} · Local preview</p><button onClick={() => {setFamilyOpen(false);showDetails("Family switching","This prototype contains one browser-local family. Multi-family switching requires authenticated isolation, consent and a backend and is not implemented.","Not available");}}>Manage family workspaces <ArrowRight size={14}/></button></div>}
          </div>
          <button className="top-icon" aria-label="Notifications" onClick={() => setNotificationsOpen(s => !s)}><Bell size={20} /></button>
          <button className="top-icon" aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} onClick={() => setDark(s => !s)}>{dark ? <Moon size={20} /> : <Sun size={21} />}</button>
        </div>
      </header>
      {notificationsOpen && <div className="notifications-popover popover" role="region" aria-label="Family observations">
        <div className="popover-heading"><strong>Recorded family observations</strong>
          <button onClick={() => setNotificationsOpen(false)} aria-label="Close observations"><X size={16}/></button></div>
        <p className="popover-muted">Current rule-based signals · Not push notifications or verified alerts</p>
        {intelligenceSignals.slice(0,4).map(signal=><button key={signal.id} className="notification-item"
          onClick={()=>navigate("Insights")}><span className="notice-emoji amber">!</span>
          <span><b>{signal.title}</b><small>{signal.domain} · Review linked source evidence</small></span></button>)}
        {!intelligenceSignals.length&&<p className="popover-muted">No supported observations right now. This does not mean the family has no needs.</p>}
        <button className="popover-button" onClick={()=>navigate("Insights")}>Open Insights <ArrowRight size={15}/></button>
      </div}

      {route === "Dashboard" ? <>
        <main className="dashboard">
          <section className="hero" aria-label="Family greeting">
            <div className="hero-shade" />
            <div className="hero-top">
              <div><p className="hero-date">{todayText}</p><h1>{formatGreeting()}, {data.members[0]?.name || "family"}</h1><p className="hero-subtitle">A calm and connected family builds an extraordinary life.</p></div>
              <div className="hero-weather"><Sun size={30} /><span>Family preview<br /><strong>Our shared space</strong></span></div>
            </div>
            <div className="hero-bottom">
              <div className="hero-members">{familyMembers.slice(0, 6).map(m => <span className="hero-member" key={m.id}><Avatar member={m} /><span><b>{m.name}</b><small>{m.role}</small></span></span>)}
                <button className="add-member" onClick={() => openAdd("Member")}><span><Plus size={21}/></span><small>Add Member</small></button></div>
              <div className="hero-quote"><i>“A family is not an important thing.<br/>It’s everything.”</i><small>— Michael J. Fox</small></div>
            </div>
          </section>
          {sampleVisible && <div className="preview-banner"><Info size={15}/><span>Interactive frontend preview · Fictional family data saved only in this browser. No backend or live health/finance integrations.</span><button onClick={() => setSampleVisible(false)} aria-label="Dismiss preview note"><X size={15}/></button></div>}

          <section className="metrics" aria-label="Family overview">
            <MetricCard title="Today" value={dashboardEvents.length} foot="events" icon={CalendarDays} tone="blue" onClick={() => navigate("Calendar")}/>
            <MetricCard title="Family Goals" value={data.goals.filter(g => g.status !== "ARCHIVED").length} foot="Tracked locally" icon={Target} tone="rose" onClick={() => openAdd("Goal")}/>
            <MetricCard title="Responsibilities" value={dashboardTasks.length} foot={dashboardTasks.length?percent+"% completed":"No dated shared tasks"} icon={CheckCircle2} tone="green" onClick={() => openAdd("Task")}/>
            <MetricCard title="Decisions" value={data.governance.decisions.filter(decisionNeedsInput).length} foot="need local input" icon={UsersRound} tone="purple" onClick={() => navigate("Decisions")}/>
            <MetricCard title="Data Connections" value="0" foot="external OS connected" icon={Heart} tone="blue" onClick={() => navigate("Insights")}/>
            <MetricCard title="Evidence Alerts" value={evidenceAttention.length} foot="dated items to review" icon={TriangleAlert} tone="orange" onClick={() => navigate("Insights")}/>
          </section>

          <section className="content-grid top-content">
            <article className="panel attention">
              <CardTitle>What Matters Now</CardTitle>
              <div className="attention-list">
                {intelligenceSignals.slice(0,5).map(signal=><button key={signal.id}
                  className={"attention-row "+(signal.tone==="ATTENTION"?"attention-amber":signal.tone==="CELEBRATE"?"attention-green":"attention-blue")}
                  onClick={()=>navigate("Insights")}>
                  <span className="attention-symbol">{signal.tone==="ATTENTION"?<TriangleAlert size={18}/>:<Lightbulb size={18}/>}</span>
                  <span className="attention-copy"><strong>{signal.title}</strong>
                    <small>{signal.domain} · {signal.evidence.length} documented source record(s)</small></span>
                  <em>Review evidence</em>
                </button>)}
                {!intelligenceSignals.length&&<button className="attention-row attention-blue" onClick={()=>navigate("Insights")}>
                  <span className="attention-symbol"><Info size={18}/></span>
                  <span className="attention-copy"><strong>No rule-matched family signals</strong>
                    <small>Insufficient evidence is not a family wellbeing or safety verdict.</small></span><em>View data gaps</em>
                </button>}
              </div>
            </article>

            <article className="panel today-panel">
              <CardTitle action="View Calendar" onAction={() => navigate("Calendar")}>Today <span className="title-hint">{shortDate}</span></CardTitle>
              <div className="day-timeline">
                {dashboardEvents.map(event => <div className="timeline-row" key={event.id}>
                  <span className="time-dot" /><time>{event.time}</time><span className="event-color" style={{backgroundColor:event.color}} />
                  <button className="event-text" onClick={() => showDetails(event.title,event.note + " · " + event.time,"Calendar event")}><strong>{event.title}</strong><small>{event.note}</small></button>
                  <MemberStack ids={event.attendees} members={data.members}/>
                  <button className={"timeline-check " + (event.done ? "is-done" : "")} title={event.done ? "Mark not complete" : "Mark complete"} aria-label={"Toggle " + event.title} onClick={() => toggleEvent(event.id)}>{event.done ? <Check size={14} /> : <Circle size={20} />}</button>
                </div>)}
              </div>
              <button className="panel-footer-button" onClick={() => openAdd("Event")}><Plus size={15}/> Add an event</button>
            </article>

            <article className="panel upcoming-panel">
              <CardTitle action="View All" onAction={() => navigate("Calendar")}>Upcoming <span className="title-hint">Next 7 days</span></CardTitle>
              <div className="upcoming-list">
                {upcomingLocalEvents.map(event => <button key={event.id} className="upcoming-row" onClick={() => navigate("Calendar")}>
                  <time>{dateLabel(eventDate(event))}</time><IconBox icon={CalendarDays} tint="blue"/><span>
                    <strong>{event.title}</strong><small>{clockDisplay(event.time)} · Added to family calendar</small>
                  </span></button>)}
                {!upcomingLocalEvents.length&&<div className="dashboard-empty">
                  No upcoming explicitly dated shared events. Open Calendar to plan one.
                </div>}
              </div>
            </article>
          </section>

          <section className="content-grid bottom-content">
            <article className="panel goals-panel">
              <CardTitle action="View All" onAction={() => navigate("Goals")}>Family Goals</CardTitle>
              <div className="goal-list">{data.goals.slice(0, 4).map(goal =>
                <button key={goal.id} className="goal-row" onClick={() => showDetails(goal.title,goal.meta + " · " + goal.progress + "% completed. Adjust progress using the buttons below.","Goal:" + goal.id)}>
                  <span className="goal-photo" style={goal.image ? {backgroundImage:"url(" + goal.image + ")"} : undefined}>{!goal.image && <Target size={21}/>}</span>
                  <span className="goal-info"><strong>{goal.title}</strong><small>{goal.meta} · {goal.progress}% complete</small><span className="progress-track"><span className={"progress-fill " + goal.color} style={{width: goal.progress + "%"}} /></span></span><ChevronRight size={17}/>
                </button>)}</div>
              <button className="panel-footer-button" onClick={() => openAdd("Goal")}><Plus size={15}/> New family goal</button>
            </article>

            <article className="panel responsibilities-panel">
              <CardTitle action="View All" onAction={() => navigate("Responsibilities")}>Responsibilities</CardTitle>
              <div className="responsibility-list">{dashboardTasks.slice(0, 5).map(task =>
                <div key={task.id} className="responsibility-row"><button className={"task-check " + (taskDoneOn(task, dateKey()) ? "checked" : "")} onClick={() => toggleTask(task.id)} aria-label={"Mark " + task.title + (taskDoneOn(task,dateKey()) ? " incomplete" : " complete")}>{taskDoneOn(task,dateKey()) && <Check size={14}/>}</button><span><strong className={taskDoneOn(task,dateKey()) ? "completed-task" : ""}>{task.title}</strong><small>{task.person}</small></span><em className={task.due === "Today" ? "due-today" : ""}>{task.due}</em></div>)}</div>
              <button className="panel-footer-button" onClick={() => openAdd("Task")}><Plus size={15}/> New responsibility</button>
            </article>

            <article className="panel health-panel">
              <CardTitle action="View Coverage" onAction={()=>navigate("Insights")}>Evidence & Connections</CardTitle>
              {coverage.map(item=><div className="health-row" key={item.area}>
                <span className="health-tick neutral"><Info size={16}/></span>
                <span><strong>{item.area}</strong>
                  <small>{item.status==="NOT_CONNECTED"?"Not connected":
                    item.status==="INSUFFICIENT_DATA"?"Insufficient dated data":"Browser records only · Unverified"}</small></span>
              </div>)}
              <p className="sample-disclaimer">No connected Health OS, Finance OS or HumanKernelOS. No wellbeing or financial assessment.</p>
            </article>

            <article className="panel insights-panel">
              <CardTitle action="Explore Evidence" onAction={()=>navigate("Insights")}>Family Insights</CardTitle>
              {intelligenceSignals.slice(0,3).map(signal=><button className="insight-box" key={signal.id}
                onClick={()=>navigate("Insights")}>
                <IconBox icon={signal.tone==="ATTENTION"?TriangleAlert:signal.tone==="CELEBRATE"?Heart:Lightbulb}
                  tint={signal.tone==="ATTENTION"?"rose":signal.tone==="CELEBRATE"?"green":"purple"}/>
                <span><b>{signal.title}</b><small>{signal.domain} · {signal.evidence.length} supporting source record(s)</small></span>
                <ChevronRight size={18}/></button>)}
              {!intelligenceSignals.length&&<p className="dashboard-empty">No rule-matched dated signals.
                Missing data is not evidence of family health or safety.</p>}
              <div className="insight-footnote"><BookHeart size={13}/> Deterministic local insights · No AI predictions or private cross-OS data</div>
            </article>
          </section>
          <footer className="dashboard-footer"><span>Family OS · Frontend prototype · Phases 1–8</span><span>LocalStorage is unencrypted; no accounts or secure private storage</span></footer>
        </main>
      </> : route === "Family" ? <FamilyWorkspace data={data} onChange={setData} onToast={setToast} navigate={navigate} /> :
      (route === "Plan" || route === "Calendar" || route === "Responsibilities" || route === "Routines") ?
      <OperationsWorkspace route={route} data={data} onChange={setData} onToast={setToast} navigate={navigate}
        searchFocus={searchTarget?.route===route?searchTarget:undefined} initialAction={operationsAction} onInitialActionConsumed={() => setOperationsAction(null)} /> :
      route === "Goals" ? <StrategyWorkspace data={data} onChange={setData} onToast={setToast} navigate={navigate}
        searchFocus={searchTarget?.route===route?searchTarget:undefined} initialAction={strategyAction} onInitialActionConsumed={() => setStrategyAction(null)} /> :
      route === "Decisions" ? <GovernanceWorkspace data={data} onChange={setData} onToast={setToast} navigate={navigate} /> :
      (route === "Experiences" || route === "Memory" || route === "Traditions" || route === "Legacy") ?
      <FamilyLifeWorkspace route={route} data={data} onChange={setData} onToast={setToast} navigate={navigate} /> :
      route === "Insights" ? <IntelligenceWorkspace data={data} onChange={setData} onToast={setToast} navigate={navigate} /> :
      route === "Search" ? <GlobalSearch data={data} onSelect={chooseSearch} /> :
      <main className="phase-page">
        <button className="back-link" onClick={() => navigate("Dashboard")}><ArrowLeft size={17}/> Back to dashboard</button>
        <div className="phase-hero"><span className="phase-tag">Planned for Phase {phase}</span><span className="phase-icon"><Compass size={31}/></span><h1>{route}</h1><p>{navigationDescriptions[route] || "A dedicated Family OS workspace is planned for an upcoming development phase."}</p><div className="phase-actions"><button className="primary-button" onClick={() => navigate("Dashboard")}>Return to Family Command Center <ArrowRight size={17}/></button><button className="secondary-button" onClick={() => setSearchOpen(true)}><Search size={17}/> Search preview</button></div></div>
        <div className="phase-note"><ShieldCheck size={23}/><div><strong>Intentional Phase 1 boundary</strong><p>This screen is not represented as finished. The application shell and dashboard are implemented now; this module will become interactive in its designated phase, using the same visual system.</p></div></div>
      </main>}
    </div>

    <div className="quick-actions"><button className="quick-add" aria-label="Quick add" onClick={() => openAdd("Task")}><Plus size={25}/></button><button className="quick-label" onClick={() => openAdd("Task")}>Quick add</button></div>

    {searchOpen && <div className="modal-backdrop se-backdrop" onClick={() => setSearchOpen(false)}>
      <div onClick={e=>e.stopPropagation()}><GlobalSearch mode="modal" data={data}
        onSelect={chooseSearch} onClose={()=>setSearchOpen(false)}/></div>
    </div>}

    {addKind && <div className="modal-backdrop" onClick={() => setAddKind(null)}><section className="action-dialog" role="dialog" aria-modal="true" aria-label={"Add " + addKind} onClick={e => e.stopPropagation()}><div className="dialog-heading"><div><span className="dialog-eyebrow">FAMILY OS · LOCAL PREVIEW</span><h2>Add {addKind === "Task" ? "responsibility" : addKind.toLowerCase()}</h2></div><button className="close-dialog" onClick={() => setAddKind(null)} aria-label="Close dialog"><X size={19}/></button></div>
      <div className="kind-tabs">{(["Task","Goal","Event","Member"] as const).map(kind => <button type="button" className={kind === addKind ? "selected" : ""} key={kind} onClick={() => openAdd(kind)}>{kind}</button>)}</div>
      <form onSubmit={submitAdd}><Input label={addKind === "Member" ? "Name" : "Title"} required value={draftTitle} onChange={setDraftTitle} placeholder={addKind === "Member" ? "Family member's first name" : addKind === "Goal" ? "e.g. Plan our next family trip" : addKind === "Event" ? "e.g. Sunday family lunch" : "e.g. Pick up groceries"}/>
        <Input label={addKind === "Member" ? "Role" : addKind === "Task" ? "Assigned to" : addKind === "Event" ? "Time" : "Description"} value={draftExtra} onChange={setDraftExtra} placeholder={addKind === "Member" ? "e.g. Grandparent" : addKind === "Task" ? "e.g. Alex" : addKind === "Event" ? "e.g. 6:30 PM" : "e.g. Shared family priority"}/>
        <p className="dialog-privacy"><ShieldCheck size={15}/> Saved to this browser only. No data is sent to a server.</p><div className="dialog-actions"><button type="button" className="secondary-button" onClick={() => setAddKind(null)}>Cancel</button><button className="primary-button" type="submit"><Plus size={17}/> Add {addKind}</button></div></form>
      </section></div>}

    {details && <div className="modal-backdrop" onClick={() => setDetails(null)}><section className="action-dialog detail-dialog" role="dialog" aria-modal="true" aria-label={details.title} onClick={e => e.stopPropagation()}><div className="dialog-heading"><div><span className="dialog-eyebrow">{details.kind.startsWith("Goal:") ? "FAMILY GOAL" : details.kind.toUpperCase()}</span><h2>{details.title}</h2></div><button className="close-dialog" onClick={() => setDetails(null)} aria-label="Close"><X size={19}/></button></div><p className="detail-copy">{details.body}</p>{details.kind.startsWith("Goal:") && <div className="goal-adjust"><span>Adjust preview progress</span><div><button className="secondary-button" onClick={() => {const target = details.kind.slice(5); setData(prev => ({...prev,goals:prev.goals.map((g:Goal) => g.id === target ? recordGoalProgress(g,g.progress-10,"Dashboard quick update",new Date().toISOString()) : g)}));}}>− 10%</button><button className="primary-button" onClick={() => {const target = details.kind.slice(5); setData(prev => ({...prev,goals:prev.goals.map((g:Goal) => g.id === target ? recordGoalProgress(g,g.progress+10,"Dashboard quick update",new Date().toISOString()) : g)}));}}>+ 10%</button></div></div>}<button className="secondary-button detail-close" onClick={() => setDetails(null)}>Close</button></section></div>}

    {toast && <div className="toast" role="status"><CheckCircle2 size={18}/>{toast}</div>}
  </div>;
}
