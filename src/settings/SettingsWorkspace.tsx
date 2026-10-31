import {useState} from "react";
import {CheckCircle2,ChevronRight,Database,Info,LockKeyhole,Moon,RotateCcw,ShieldAlert,ShieldCheck,Sun,X} from "lucide-react";
import type {AppData} from "../data";
import "./settings.css";
type Props={data:AppData;dark:boolean;onTheme:(dark:boolean)=>void;onReset:()=>void;navigate:(route:string)=>void};
export default function SettingsWorkspace({data,dark,onTheme,onReset,navigate}:Props){
  const [confirmOpen,setConfirmOpen]=useState(false);
  const [confirmation,setConfirmation]=useState("");
  const counts=[
    ["Family members",data.members.length],
    ["Shared tasks",data.tasks.length],
    ["Calendar entries",data.events.length],
    ["Goals",data.goals.length],
    ["Decision drafts & records",data.governance.decisions.length],
    ["Memory stories",data.life.memories.length],
    ["Legacy entries",data.life.legacy.length],
    ["Saved insight briefs",data.intelligence.savedBriefs.length]
  ];
  return <main className="ps-workspace">
    <div className="ps-breadcrumb"><button onClick={()=>navigate("Dashboard")}>Dashboard</button><ChevronRight size={14}/> Preview Settings</div>
    <section className="ps-hero"><span><ShieldCheck size={16}/> FAMILY OS · PREVIEW SETTINGS</span>
      <h1>Your local workspace, <em>clearly understood.</em></h1>
      <p>Control your browser's design preferences and fictional demonstration data. Production privacy settings need real accounts and a secure backend.</p></section>
    <div className="ps-alert"><ShieldAlert size={21}/><div><strong>LocalStorage is not private family storage.</strong>
      <p>This public frontend has no sign-in, role verification, consent enforcement, secure sharing, backup or cross-device sync.
        Anyone with access to this browser profile may read or delete the saved content. Do not enter sensitive personal or child information.</p></div></div>
    <div className="ps-grid"><section className="ps-panel"><header><span className="ps-icon blue"><Sun size={22}/></span>
      <div><h2>Appearance</h2><p>Change the display theme stored on this browser.</p></div></header>
      <div className="ps-theme-choices"><button aria-pressed={!dark} className={!dark?"selected":""} onClick={()=>onTheme(false)}>
        <Sun size={20}/><strong>Light theme</strong>{!dark&&<CheckCircle2 size={17}/>}</button>
        <button aria-pressed={dark} className={dark?"selected":""} onClick={()=>onTheme(true)}>
          <Moon size={20}/><strong>Dark theme</strong>{dark&&<CheckCircle2 size={17}/>}</button></div>
      <p className="ps-low">Theme preferences remain in this browser only.</p>
    </section>
    <section className="ps-panel"><header><span className="ps-icon lavender"><Database size={22}/></span>
      <div><h2>Browser data snapshot</h2><p>Local record counts, not verified family outcomes.</p></div></header>
      <div className="ps-counts">{counts.map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      <p className="ps-low">Counts may include fictional seed records. Nothing is synced to a family account.</p>
    </section>
    <section className="ps-panel"><header><span className="ps-icon amber"><LockKeyhole size={22}/></span>
      <div><h2>Unavailable production controls</h2><p>Do not rely on prototype settings for privacy or security.</p></div></header>
      <div className="ps-boundaries">{[
        ["Individual identity", "No real login, child/guardian verification or separate personal space."],
        ["Sharing & consent", "Privacy labels are not enforced; no authenticated consent/revocation."],
        ["Cross-OS data", "HumanKernelOS, Finance OS and Health OS are not connected."],
        ["Notifications & backups", "No server push, history retention, remote backup or disaster recovery."]
      ].map(([title,copy])=><div key={title}><Info size={16}/><span><strong>{title}</strong><small>{copy}</small></span></div>)}</div>
    </section>
    <section className="ps-panel ps-reset"><header><span className="ps-icon rose"><RotateCcw size={22}/></span>
      <div><h2>Restore fictional sample data</h2><p>Discard all locally edited records and return to the original demonstration.</p></div></header>
      <p>This replaces the current browser dataset across Family, Operations, Goals, Decisions, Memories and Intelligence.
        It cannot be undone. It does not delete anything from external services because none are connected.</p>
      <button className="ps-reset-button" onClick={()=>{setConfirmation("");setConfirmOpen(true);}}><RotateCcw size={16}/> Reset browser preview</button>
    </section></div>
    {confirmOpen&&<div className="ps-overlay" onClick={()=>setConfirmOpen(false)}>
      <section className="ps-confirm" role="dialog" aria-modal="true" aria-label="Confirm reset sample data"
        onClick={e=>e.stopPropagation()}>
        <header><h2>Restore fictional Family OS data?</h2><button aria-label="Cancel reset" onClick={()=>setConfirmOpen(false)}><X size={19}/></button></header>
        <div className="ps-alert"><ShieldAlert size={22}/><p>All changes and records saved in this browser by Family OS will be replaced by the original fictional sample data. This action is irreversible.</p></div>
        <label>Type <strong>RESET</strong> to confirm<input autoFocus value={confirmation} onChange={e=>setConfirmation(e.target.value)}
          aria-label="Type RESET to confirm" placeholder="RESET" autoComplete="off"/></label>
        <footer><button className="ps-secondary" onClick={()=>setConfirmOpen(false)}>Cancel</button>
          <button className="ps-danger" disabled={confirmation!=="RESET"} onClick={()=>{
            setConfirmOpen(false);setConfirmation("");onReset();
          }}><RotateCcw size={16}/> Reset sample dataset</button></footer>
      </section>
    </div>}
    <footer className="ps-footer">Family OS · Frontend-only settings <span>Browser-local data · No secure family account</span></footer>
  </main>;
}
