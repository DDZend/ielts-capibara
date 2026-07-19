"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Flame,
  Headphones,
  HelpCircle,
  Languages,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Mic2,
  PenLine,
  Play,
  Send,
  Settings,
  Sparkles,
  Star,
  Target,
  Trophy,
  Video,
  X,
  Zap,
} from "lucide-react";
import type { SavedAssessment, Skill } from "../../lib/assessment";
import type { SavedMock } from "../../lib/mock";
import { isWeekend, weekStart } from "../../lib/study-plan";

type DashboardTask = {
  id: number;
  taskDate: string;
  skill: string;
  title: string;
  minutes: number;
  taskType: string;
  completedAt: string | null;
  createdAt: string;
};

type DashboardStats = {
  points: number;
  streak: number;
  completedDaysThisWeek: number;
  completedTasksToday: number;
  totalMinutesToday: number;
};

const modules: { skill: Skill; icon: typeof Mic2; className: string; tasks: string }[] = [
  { skill: "Speaking", icon: Mic2, className: "speaking", tasks: "3 practice prompts" },
  { skill: "Writing", icon: PenLine, className: "writing", tasks: "12 video lessons" },
  { skill: "Reading", icon: BookOpen, className: "reading", tasks: "14 strategy lessons" },
  { skill: "Listening", icon: Headphones, className: "listening", tasks: "12 audio lessons" },
];

const monthDays = [
  { day: 13, state: "done" }, { day: 14, state: "done" }, { day: 15, state: "done" }, { day: 16, state: "today" }, { day: 17, state: "planned" }, { day: 18, state: "" }, { day: 19, state: "" },
];

export function DashboardClient({ userName, latest, initialTasks, recentTasks, initialStats, mocks }: { userName: string; latest: SavedAssessment | null; initialTasks: DashboardTask[]; recentTasks: DashboardTask[]; initialStats: DashboardStats; mocks: SavedMock[] }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [coinsOpen, setCoinsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const [targetBand, setTargetBand] = useState(latest?.targetBand ?? 7);
  const [targetState, setTargetState] = useState<"idle" | "saving" | "saved">("idle");
  const [tasks, setTasks] = useState(initialTasks);
  const [selectedDay, setSelectedDay] = useState(16);
  const [reserved, setReserved] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<{ role: "capi" | "student"; text: string }[]>([
    { role: "capi", text: `Hi! I’m focusing your plan on ${latest?.prioritySkill.toLowerCase() ?? "finding your starting level"}. What would you like help with?` },
  ]);
  const firstName = userName.split(/[\s@]/)[0] || "Student";
  const score = latest?.overallBand ?? 0;
  const progress = latest ? Math.min(100, Math.round((score / targetBand) * 100)) : 0;
  const bands = useMemo(() => ({ Speaking: latest?.speakingBand ?? null, Writing: latest?.writingBand ?? null, Reading: latest?.readingBand ?? null, Listening: latest?.listeningBand ?? null }), [latest]);
  const completedToday = tasks.filter((task) => task.completedAt).length;
  const hadCompletedToday = initialStats.completedTasksToday > 0;
  const hasCompletedToday = completedToday > 0;
  const liveDays = Math.max(0, initialStats.completedDaysThisWeek + Number(hasCompletedToday && !hadCompletedToday) - Number(!hasCompletedToday && hadCompletedToday));
  const liveStreak = Math.max(0, initialStats.streak + Number(hasCompletedToday && !hadCompletedToday) - Number(!hasCompletedToday && hadCompletedToday));
  const livePoints = Math.max(0, initialStats.points + (completedToday - initialStats.completedTasksToday) * 40);
  const weeklyPercent = Math.min(100, Math.round(liveDays / 5 * 100));
  const activityTasks = [...tasks.filter((task) => task.completedAt), ...recentTasks.filter((task) => !tasks.some((today) => today.id === task.id))].slice(0, 5);
  const latestMock = mocks[0] ?? null;
  const previousMock = mocks[1] ?? null;
  const mockDoneThisWeek = latestMock?.weekStart === weekStart();
  const mockDelta = latestMock && previousMock ? latestMock.overallBand - previousMock.overallBand : null;
  const weekend = isWeekend();

  const updateTarget = async (next: number) => {
    setTargetBand(next);
    setTargetOpen(false);
    if (!latest) return;
    setTargetState("saving");
    const response = await fetch("/api/assessment-results", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: latest.id, targetBand: next }) }).catch(() => null);
    setTargetState(response?.ok ? "saved" : "idle");
    if (response?.ok) window.setTimeout(() => setTargetState("idle"), 1800);
  };

  const askCapi = (question: string) => {
    const clean = question.trim();
    if (!clean) return;
    const lower = clean.toLowerCase();
    const reply = lower.includes("warm-up")
      ? "Try this: speak for one minute about your morning, then repeat it using however, because and for example. Keep the second version calmer and clearer."
      : lower.includes("reach") || lower.includes("band")
        ? `Your clearest next step is consistent ${latest?.prioritySkill.toLowerCase() ?? "four-skill"} practice. Complete today’s short plan, review one mistake, and reassess after four weeks.`
        : lower.includes("lesson")
          ? "Today’s long-turn lesson uses a simple structure: answer directly, add two useful details, then finish with why the topic matters to you."
          : "That’s a good question. Start with one clear answer, add a specific example, and review whether every sentence supports the task.";
    setMessages((current) => [...current, { role: "student", text: clean }, { role: "capi", text: reply }]);
    setChatInput("");
  };

  const toggleTask = async (task: DashboardTask) => {
    const completed = !task.completedAt;
    const nextCompletedAt = completed ? new Date().toISOString() : null;
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, completedAt: nextCompletedAt } : item));
    const response = await fetch("/api/study-plan", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: task.id, completed }) }).catch(() => null);
    if (!response?.ok) setTasks((current) => current.map((item) => item.id === task.id ? task : item));
  };

  return (
    <main className="dashboard-shell">
      <aside className={`dashboard-sidebar ${sidebarOpen ? "open" : ""}`}>
        <button className="sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X /></button>
        <Link className="dashboard-brand" href="/"><img src="/capi-profile.png" alt="" /><span><b>IELTS</b> Mastery<small>YOUR CLEAR PATH TO 7.0</small></span></Link>
        <nav aria-label="Dashboard navigation">
          <a className="nav-item active" href="#dashboard-top" onClick={() => setSidebarOpen(false)}><span><LayoutDashboard /></span>Dashboard</a>
          <Link className="nav-item prominent" href="/assessment"><span><Zap /></span>Take assessment<ChevronRight /></Link>
          <p>LEARN</p>
          {modules.map(({ skill, icon: Icon, className }) => <Link key={skill} href={skill === "Speaking" ? "/speaking" : skill === "Writing" ? "/writing" : skill === "Reading" ? "/reading" : "/listening"} onClick={() => setSidebarOpen(false)} className="nav-item"><span className={className}><Icon /></span>{skill}<ChevronRight /></Link>)}
          <div className="nav-line" />
          <a className="nav-item" href="#progress" onClick={() => setSidebarOpen(false)}><span><BarChart3 /></span>My progress</a>
          <a className="nav-item" href="#live-class" onClick={() => setSidebarOpen(false)}><span><Video /></span>Live classes<span className="nav-badge">2</span></a>
          <a className="nav-item" href="#study-calendar" onClick={() => setSidebarOpen(false)}><span><CalendarDays /></span>Study calendar</a>
          <div className="nav-line" />
          <button className="nav-item" onClick={() => { setTargetOpen(true); setSidebarOpen(false); document.getElementById("dashboard-top")?.scrollIntoView(); }}><span><Settings /></span>Target settings</button>
        </nav>
        <button className="sidebar-help" onClick={() => { setChatOpen(true); setSidebarOpen(false); }}><HelpCircle /><span><b>Need help?</b><small>Ask Capi Coach</small></span><ChevronRight /></button>
      </aside>
      {sidebarOpen && <button className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <button className="mobile-nav-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu /></button>
          <Link className="mobile-dashboard-brand" href="/"><span className="brand-c">C</span><b>IELTS Mastery</b></Link>
          <div className="topbar-actions">
            <div className="topbar-control-wrap coin-control">
              <button className="metric metric-button interactive-control" aria-haspopup="dialog" aria-expanded={coinsOpen} aria-controls="capi-coins-panel" onClick={() => { setCoinsOpen((open) => !open); setProfileOpen(false); }}><Star fill="currentColor" /><span><small>Capi-Coins</small><b>{livePoints.toLocaleString()}</b></span></button>
              {coinsOpen && <div className="topbar-popover coins-popover" id="capi-coins-panel" role="dialog" aria-label="Capi-Coins balance"><span className="popover-icon coins"><Star fill="currentColor" /></span><div><small>Your balance</small><h3>{livePoints.toLocaleString()} Capi-Coins</h3><p>Complete a lesson to earn 40 Capi-Coins and keep your weekly streak moving.</p><Link href="#today-plan" onClick={() => setCoinsOpen(false)}>View today&apos;s plan <ArrowRight /></Link></div></div>}
            </div>
            <span className="metric streak-metric"><Flame fill="currentColor" /><span><small>Streak</small><b>{liveStreak} {liveStreak === 1 ? "day" : "days"}</b></span></span>
            <button className="notification interactive-control" aria-label="View 2 recent notifications" onClick={() => document.querySelector(".recent-card")?.scrollIntoView({ behavior: "smooth", block: "center" })}><Bell /><i>2</i></button>
            <label className="language-control dashboard-language interactive-control" title="Language"><Languages /><select aria-label="Language" defaultValue="eng"><option value="eng">Eng</option><option value="rus">Рус</option><option value="kaz">Қаз</option></select><ChevronDown /></label>
            <div className="topbar-control-wrap profile-control">
              <button className="profile-chip interactive-control" aria-label={`Open profile menu for ${userName}`} aria-haspopup="dialog" aria-expanded={profileOpen} aria-controls="profile-panel" onClick={() => { setProfileOpen((open) => !open); setCoinsOpen(false); }}><i>{firstName.charAt(0).toUpperCase()}</i><span><b>{userName}</b><small>Target band {targetBand.toFixed(1)}</small></span><ChevronDown className="profile-chevron" /></button>
              {profileOpen && <div className="topbar-popover profile-popover" id="profile-panel" role="dialog" aria-label="Profile menu"><div className="profile-popover-head"><i>{firstName.charAt(0).toUpperCase()}</i><span><b>{userName}</b><small>IELTS learner · Target {targetBand.toFixed(1)}</small></span></div><div className="profile-popover-actions"><Link href="/assessment"><BarChart3 /> Update assessment <ChevronRight /></Link><button onClick={() => { setProfileOpen(false); setTargetOpen(true); document.getElementById("dashboard-top")?.scrollIntoView({ behavior: "smooth" }); }}><Target /> Target settings <ChevronRight /></button><a href="/signout-with-chatgpt?return_to=%2F"><LogOut /> Sign out <ChevronRight /></a></div></div>}
            </div>
          </div>
        </header>

        <div className="dashboard-content" id="dashboard-top">
          <section className="welcome-card dashboard-card">
            <div className="welcome-copy"><span className="eyebrow"><Sparkles /> Your personal study space</span><h1>Good to see you, {firstName}.</h1><p>{latest ? <>You&apos;re building toward Band {targetBand.toFixed(1)}. Today&apos;s plan gives extra attention to <b>{latest.prioritySkill.toLowerCase()}</b>.</> : <>Start with the free assessment and Capi will build your personal route to Band {targetBand.toFixed(1)}.</>}</p><div className="welcome-actions"><Link className="button primary" href={latest ? "#today-plan" : "/assessment"}>{latest ? "Continue today’s plan" : "Take the assessment"}<ArrowRight /></Link><button className="button soft" onClick={() => setTargetOpen((open) => !open)}><Target /> Target {targetBand.toFixed(1)}<ChevronDown /></button>{targetState === "saved" && <span className="saved-hint"><Check /> Saved</span>}</div>{targetOpen && <div className="target-picker" aria-label="Choose target band">{[6, 6.5, 7, 7.5, 8, 8.5, 9].map((band) => <button key={band} onClick={() => void updateTarget(band)} className={band === targetBand ? "selected" : ""}>{band.toFixed(1)}</button>)}</div>}</div>
            <img src="/capi-welcome.png" alt="Capi Coach pointing upward and holding a small rocket" />
          </section>

          <div className="dashboard-columns">
            <div className="dashboard-primary">
              <section className="progress-section dashboard-card" id="progress">
                <div className="card-heading"><div><span className="eyebrow">Latest assessment</span><h2>Your overall progress</h2></div><Link href="/assessment">Reassess <ArrowRight /></Link></div>
                {latest ? <div className="progress-summary"><div className="progress-ring" style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}><span><b>{score.toFixed(1)}</b><small>of {targetBand.toFixed(1)}</small></span></div><div><h3>{progress}% of the way to your target</h3><p>Your strongest area is <b>{latest.strengthSkill}</b>. Improving <b>{latest.prioritySkill}</b> will give your overall band the biggest lift.</p><div className="progress-line"><span style={{ width: `${progress}%` }} /></div><small>Assessment saved {new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(latest.createdAt))}</small></div></div> : <div className="empty-progress"><Target /><div><h3>No saved assessment yet</h3><p>Complete the diagnostic to see real module bands and a focused study plan.</p></div><Link className="button primary small" href="/assessment">Start now</Link></div>}
                <div className="skill-grid" id="modules">{modules.map(({ skill, icon: Icon, className, tasks }) => <Link className={`skill-card ${className}`} href={skill === "Speaking" ? "/speaking" : skill === "Writing" ? "/writing" : skill === "Reading" ? "/reading" : "/listening"} aria-label={`Practise ${skill}. ${bands[skill] ? `Current estimate ${bands[skill]?.toFixed(1)}` : "Complete the assessment first"}`} key={skill}><span className="skill-card-icon"><Icon /></span><div><small>{skill}</small><b>{bands[skill]?.toFixed(1) ?? "—"}</b></div><p>{latest ? tasks : "Complete assessment"}</p><ChevronRight className="skill-card-chevron" /></Link>)}</div>
              </section>

              <section id="today-plan" className="today-card dashboard-card">
                <div className="card-heading"><div><span className="eyebrow">{new Intl.DateTimeFormat("en", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</span><h2>Today&apos;s study plan</h2></div><span className="time-total"><Clock3 /> {initialStats.totalMinutesToday} minutes</span></div>
                <div className="plan-list">{tasks.map((task, index) => { const moduleInfo = modules.find((item) => item.skill === task.skill) ?? modules[2]; const Icon = moduleInfo.icon; return <article key={task.id} className={task.completedAt ? "completed" : ""}><time>{String(9 + index * 4).padStart(2, "0")}:00</time><span className={`plan-icon ${moduleInfo.className}`}><Icon /></span><div><b>{task.title}</b><small>{task.completedAt ? "Completed today · +40 Capi-Coins" : `${task.minutes} min · ${task.taskType}`}</small></div><button aria-label={`${task.completedAt ? "Mark incomplete" : "Complete"} ${task.title}`} aria-pressed={Boolean(task.completedAt)} onClick={() => void toggleTask(task)} className={index === 0 || task.completedAt ? "active" : ""}>{task.completedAt ? <Check /> : index === 0 ? <Play fill="currentColor" /> : <ChevronRight />}</button></article>; })}</div>
                <div className="weekly-line"><span><b>This week</b><small>{liveDays} of 5 study days complete</small></span><div><i style={{ width: `${weeklyPercent}%` }} /></div><b>{weeklyPercent}%</b></div>
              </section>

              <section className="recent-card dashboard-card"><div className="card-heading"><h2>Recent activity</h2></div><div className="activity-list">{activityTasks.map((task) => { const moduleInfo = modules.find((item) => item.skill === task.skill) ?? modules[2]; const Icon = moduleInfo.icon; return <article key={task.id}><span className={`activity-icon ${moduleInfo.className}`}><Icon /></span><div><b>{task.title} completed</b><small>{task.minutes} minutes · {task.skill} · +40 Capi-Coins</small></div><time>{task.completedAt ? new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(new Date(task.completedAt)) : "Today"}</time></article>; })}{latest && <article><span className="activity-icon assessment"><BarChart3 /></span><div><b>Assessment result saved</b><small>Overall {latest.overallBand.toFixed(1)} · priority: {latest.prioritySkill}</small></div><time>{new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(new Date(latest.createdAt))}</time></article>}</div></section>

              <section className="weekend-mock-card dashboard-card"><div className="weekend-mock-copy"><span className="eyebrow light"><Trophy /> {weekend ? "This weekend" : "Weekend challenge"}</span><h2>Challenge yourself</h2><p>Take a complete four-skill practice mock every weekend and compare your estimate with the previous week.</p><div className="mock-card-stats">{latestMock ? <><span><small>Latest overall</small><b>{latestMock.overallBand.toFixed(1)}</b></span><span><small>Previous week</small><b>{previousMock?.overallBand.toFixed(1) ?? "—"}</b></span><span><small>Weekly change</small><b className={mockDelta !== null && mockDelta >= 0 ? "positive" : ""}>{mockDelta === null ? "First result" : `${mockDelta >= 0 ? "+" : ""}${mockDelta.toFixed(1)}`}</b></span></> : <><span><small>Skills</small><b>4 modules</b></span><span><small>Time</small><b>20–25 min</b></span><span><small>Goal</small><b>Beat last week</b></span></>}</div><Link className="button white" href="/mock-test">{mockDoneThisWeek ? "Review this week’s result" : weekend ? "Start weekend mock" : "Prepare for the weekend"}<ArrowRight /></Link></div><img src="/capi-challenge.png" alt="Capi Coach with a checklist and trophy" /></section>
            </div>

            <aside className="dashboard-secondary">
              <section className="calendar-card dashboard-card" id="study-calendar"><div className="card-heading"><div><span className="eyebrow">July 2026</span><h2>Your study week</h2></div><CalendarDays aria-hidden="true" /></div><div className="week-labels">{["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div><div className="week-days">{monthDays.map(({ day, state }) => <button key={day} aria-label={`Select July ${day}`} aria-pressed={selectedDay === day} onClick={() => setSelectedDay(day)} className={`${state} ${selectedDay === day ? "selected" : ""}`}>{day}{state === "done" && <Check />}</button>)}</div><div className="calendar-legend"><span><i className="done" /> Studied</span><span><i className="planned" /> Planned</span><span>Selected: {selectedDay} July</span></div></section>

              <section className="challenge-card dashboard-card"><div><span className="eyebrow light"><Zap /> Capi challenge</span><h2>Three focused days</h2><p>Complete one planned lesson on three different days this week.</p><div className="challenge-progress">{[1,2,3].map((day) => <span key={day} className={liveDays >= day ? "done" : ""}>{liveDays >= day ? <Check /> : day}</span>)}</div><small>{Math.min(liveDays, 3)} of 3 days complete</small></div><img src="/capi-challenge.png" alt="Capi Coach wearing a blue headband with a checklist and trophy" /></section>

              <section className="capi-advice-card dashboard-card"><div className="advice-heading"><img src="/capi-advice.png" alt="Capi Coach with a magnifying glass and lightbulb" /><span><small>CAPI COACH</small><b>Today&apos;s advice</b></span></div><p>{latest ? <>Your <b>{latest.strengthSkill.toLowerCase()}</b> score gives you a strong base. For the next few sessions, slow down and check the structure of each <b>{latest.prioritySkill.toLowerCase()}</b> answer before adding detail.</> : <>Take the short assessment first. I&apos;ll use your four module estimates to choose the clearest place to begin.</>}</p><button onClick={() => setChatOpen(true)}>Ask Capi a question <ArrowRight /></button></section>

              <section className="live-class-card dashboard-card" id="live-class"><div className="live-image"><span>LIVE CLASS</span><img src="/capi-headset.png" alt="Capi Coach wearing a coaching headset" /></div><div><span className="eyebrow">Tuesday · 18:30</span><h3>Speaking Part 2: confident long turns</h3><p><Video /> With Anna Müller · 45 min</p><button className="button soft" aria-pressed={reserved} onClick={() => setReserved((value) => !value)}>{reserved ? <><Check /> Place reserved</> : <>Reserve my place <ArrowRight /></>}</button></div></section>
            </aside>
          </div>
        </div>
      </div>

      <button className="floating-capi" onClick={() => setChatOpen(true)} aria-label="Open Capi Coach chat"><img src="/capi-profile.png" alt="" /><span>Ask Capi</span><MessageCircle /></button>
      {chatOpen && <section className="capi-chat" aria-label="Capi Coach chat"><header><img src="/capi-profile.png" alt="" /><span><b>Capi Coach</b><small><i /> Ready to help</small></span><button onClick={() => setChatOpen(false)} aria-label="Close chat"><X /></button></header><div className="chat-body"><div className="chat-messages" aria-live="polite">{messages.map((message, index) => <p key={`${message.role}-${index}`} className={message.role}>{message.text}</p>)}</div><div className="chat-suggestions"><button onClick={() => askCapi("Explain today’s lesson")}>Explain today&apos;s lesson</button><button onClick={() => askCapi(`How do I reach Band ${targetBand.toFixed(1)}?`)}>How do I reach Band {targetBand.toFixed(1)}?</button><button onClick={() => askCapi("Give me a 5-minute warm-up")}>Give me a 5-minute warm-up</button></div></div><form onSubmit={(event) => { event.preventDefault(); askCapi(chatInput); }}><input value={chatInput} onChange={(event) => setChatInput(event.target.value)} aria-label="Message Capi Coach" placeholder="Ask about your study plan…" /><button aria-label="Send message" disabled={!chatInput.trim()}><Send /></button></form></section>}
    </main>
  );
}
