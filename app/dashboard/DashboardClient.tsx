"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
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
  CreditCard,
  ExternalLink,
  Flame,
  Gift,
  Headphones,
  HelpCircle,
  Languages,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  MessageCircle,
  Mic2,
  PenLine,
  Play,
  Send,
  ShieldCheck,
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
import { TUTOR_STARTERS, type TutorLanguage, type TutorMessageView, type TutorUsage } from "../../lib/capi-tutor";

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
  earnedPoints: number;
  sponsoredPasses: number;
  streak: number;
  completedDaysThisWeek: number;
  completedTasksToday: number;
  totalMinutesToday: number;
};

type ModuleProgress = { skill: Skill; completed: number; total: number; averageScore: number | null };
type AssessmentHistoryItem = { id: number; skill: "Speaking" | "Writing"; lessonId: string; overallBand: number; summary: string; createdAt: string };
type WeeklyReport = {
  weekStart: string;
  lessonsCompleted: number;
  exerciseAverage: number | null;
  latestAiSkill?: "Speaking" | "Writing";
  latestAiBand: number | null;
  aiChange: number | null;
  latestMockBand: number | null;
  mockChange: number | null;
  focusSkill: Skill;
};

type DashboardClientProps = {
  userName: string;
  isCreator: boolean;
  latest: SavedAssessment | null;
  initialTasks: DashboardTask[];
  recentTasks: DashboardTask[];
  initialStats: DashboardStats;
  mocks: SavedMock[];
  adaptivePriority: Skill;
  moduleProgress: ModuleProgress[];
  assessmentHistory: AssessmentHistoryItem[];
  weeklyReport: WeeklyReport;
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

const capiHelperGiftCost = 500;
const discountTiers = [
  { percent: 5, coins: 500 },
  { percent: 10, coins: 1000 },
  { percent: 15, coins: 1500 },
] as const;

export function DashboardClient({ userName, isCreator, latest, initialTasks, recentTasks, initialStats, mocks, adaptivePriority, moduleProgress, assessmentHistory, weeklyReport }: DashboardClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [coinsOpen, setCoinsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [language, setLanguage] = useState<"eng" | "rus" | "kaz">("eng");
  const [targetOpen, setTargetOpen] = useState(false);
  const [targetBand, setTargetBand] = useState(latest?.targetBand ?? 7);
  const [targetState, setTargetState] = useState<"idle" | "saving" | "saved">("idle");
  const [tasks, setTasks] = useState(initialTasks);
  const [selectedDay, setSelectedDay] = useState(16);
  const [reserved, setReserved] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [giftState, setGiftState] = useState<"idle" | "confirming" | "sending" | "sent" | "error">("idle");
  const [giftError, setGiftError] = useState("");
  const [giftLink, setGiftLink] = useState("");
  const [giftCopied, setGiftCopied] = useState(false);
  const [sessionGifts, setSessionGifts] = useState(0);
  const [reportShared, setReportShared] = useState(false);
  const [tutorLanguage, setTutorLanguage] = useState<TutorLanguage>("en");
  const [tutorMessages, setTutorMessages] = useState<TutorMessageView[]>([]);
  const [tutorUsage, setTutorUsage] = useState<TutorUsage | null>(null);
  const [tutorLoaded, setTutorLoaded] = useState(false);
  const [tutorState, setTutorState] = useState<"idle" | "loading" | "sending">("idle");
  const [tutorError, setTutorError] = useState("");
  const tutorOptimisticId = useRef(0);
  const firstName = userName.split(/[\s@]/)[0] || "Student";
  const score = latest?.overallBand ?? 0;
  const progress = latest ? Math.min(100, Math.round((score / targetBand) * 100)) : 0;
  const bands = useMemo(() => ({ Speaking: latest?.speakingBand ?? null, Writing: latest?.writingBand ?? null, Reading: latest?.readingBand ?? null, Listening: latest?.listeningBand ?? null }), [latest]);
  const completedToday = tasks.filter((task) => task.completedAt).length;
  const hadCompletedToday = initialStats.completedTasksToday > 0;
  const hasCompletedToday = completedToday > 0;
  const liveDays = Math.max(0, initialStats.completedDaysThisWeek + Number(hasCompletedToday && !hadCompletedToday) - Number(!hasCompletedToday && hadCompletedToday));
  const liveStreak = Math.max(0, initialStats.streak + Number(hasCompletedToday && !hadCompletedToday) - Number(!hasCompletedToday && hadCompletedToday));
  const taskCoinChange = (completedToday - initialStats.completedTasksToday) * 40;
  const liveEarnedPoints = Math.max(0, initialStats.earnedPoints + taskCoinChange);
  const livePoints = Math.max(0, initialStats.points + taskCoinChange - sessionGifts * capiHelperGiftCost);
  const canSponsorLearner = livePoints >= capiHelperGiftCost;
  const sponsoredPasses = initialStats.sponsoredPasses + sessionGifts;
  const unlockedDiscount = [...discountTiers].reverse().find((tier) => liveEarnedPoints >= tier.coins)?.percent ?? 0;
  const nextDiscount = discountTiers.find((tier) => liveEarnedPoints < tier.coins);
  const discountProgress = nextDiscount ? Math.min(100, Math.round(liveEarnedPoints / nextDiscount.coins * 100)) : 100;
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

  const openTutor = () => {
    setChatOpen(true);
    if (tutorLoaded || tutorState === "loading") return;
    setTutorState("loading");
    setTutorError("");
    void fetch("/api/capi-tutor").then(async (response) => {
      const data = await response.json() as { messages?: TutorMessageView[]; usage?: TutorUsage; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Capi Coach could not load your conversation.");
      setTutorMessages(data.messages ?? []);
      setTutorUsage(data.usage ?? null);
      setTutorLoaded(true);
    }).catch((caught) => {
      setTutorError(caught instanceof Error ? caught.message : "Capi Coach could not load.");
    }).finally(() => setTutorState("idle"));
  };

  const askCapi = async (question: string) => {
    const clean = question.trim();
    if (!clean || tutorState === "sending") return;
    const optimisticId = --tutorOptimisticId.current;
    const optimistic: TutorMessageView = { id: optimisticId, role: "student", content: clean, language: tutorLanguage, intent: "pending", citations: [], practice: null, confidence: null, escalationRequired: false, createdAt: new Date().toISOString() };
    setTutorMessages((current) => [...current, optimistic]);
    setChatInput("");
    setTutorError("");
    setTutorState("sending");
    try {
      const response = await fetch("/api/capi-tutor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: clean, language: tutorLanguage }) });
      const data = await response.json() as { studentMessage?: TutorMessageView; assistantMessage?: TutorMessageView; usage?: TutorUsage; error?: string };
      if (!response.ok || !data.studentMessage || !data.assistantMessage) throw new Error(data.error ?? "Capi could not answer that question.");
      setTutorMessages((current) => [...current.filter((message) => message.id !== optimisticId), data.studentMessage!, data.assistantMessage!]);
      if (data.usage) setTutorUsage(data.usage);
    } catch (caught) {
      setTutorMessages((current) => current.filter((message) => message.id !== optimisticId));
      setChatInput(clean);
      setTutorError(caught instanceof Error ? caught.message : "Capi could not answer that question.");
    } finally {
      setTutorState("idle");
    }
  };

  const toggleTask = async (task: DashboardTask) => {
    const completed = !task.completedAt;
    const nextCompletedAt = completed ? new Date().toISOString() : null;
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, completedAt: nextCompletedAt } : item));
    const response = await fetch("/api/study-plan", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: task.id, completed }) }).catch(() => null);
    if (!response?.ok) setTasks((current) => current.map((item) => item.id === task.id ? task : item));
  };

  const sponsorLearner = async () => {
    setGiftState("sending");
    setGiftError("");
    const response = await fetch("/api/capi-helper", { method: "POST" }).catch(() => null);
    const payload = response ? await response.json().catch(() => null) as { error?: string; claimUrl?: string } | null : null;
    if (!response?.ok) {
      setGiftError(payload?.error ?? "The gift could not be completed. Please try again.");
      setGiftState("error");
      return;
    }
    setGiftLink(payload?.claimUrl ?? "");
    setSessionGifts((current) => current + 1);
    setGiftState("sent");
  };

  const copyGiftLink = async () => {
    if (!giftLink) return;
    await navigator.clipboard.writeText(`${window.location.origin}${giftLink}`).catch(() => undefined);
    setGiftCopied(true);
    window.setTimeout(() => setGiftCopied(false), 1800);
  };

  const shareWeeklyReport = async () => {
    const reportText = `My IELTS Mastery weekly report: ${weeklyReport.lessonsCompleted} lessons completed${weeklyReport.exerciseAverage !== null ? `, ${weeklyReport.exerciseAverage}% exercise average` : ""}${weeklyReport.latestAiBand !== null ? `, latest ${weeklyReport.latestAiSkill} estimate ${weeklyReport.latestAiBand.toFixed(1)}` : ""}. Next focus: ${weeklyReport.focusSkill}.`;
    if (navigator.share) await navigator.share({ title: "My IELTS Mastery weekly report", text: reportText }).catch(() => undefined);
    else await navigator.clipboard?.writeText(reportText).catch(() => undefined);
    setReportShared(true);
    window.setTimeout(() => setReportShared(false), 1800);
  };

  const tutorCopy = {
    en: { ready: "Personal tutor online", greeting: `Hi ${firstName}! I know your target, recent results and today’s plan. What shall we work on?`, placeholder: "Ask about a mistake, lesson or practice…", sent: "Sent to your teacher", sources: "Recommended lessons", practice: "Quick practice", criteria: "Success checklist" },
    ru: { ready: "Личный тьютор онлайн", greeting: `Привет, ${firstName}! Я знаю твою цель, последние результаты и план на сегодня. Над чем поработаем?`, placeholder: "Спросите об ошибке, уроке или практике…", sent: "Отправлено преподавателю", sources: "Рекомендуемые уроки", practice: "Короткая практика", criteria: "Критерии успеха" },
    kk: { ready: "Жеке тьютор онлайн", greeting: `Сәлем, ${firstName}! Мақсатыңды, соңғы нәтижелеріңді және бүгінгі жоспарыңды білемін. Немен жұмыс істейміз?`, placeholder: "Қате, сабақ немесе жаттығу туралы сұраңыз…", sent: "Мұғалімге жіберілді", sources: "Ұсынылған сабақтар", practice: "Қысқа жаттығу", criteria: "Сәттілік критерийлері" },
  }[tutorLanguage];

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
          <Link className="nav-item" href="/classes" onClick={() => setSidebarOpen(false)}><span><Video /></span>Classes & homework<ChevronRight /></Link>
          <a className="nav-item" href="#study-calendar" onClick={() => setSidebarOpen(false)}><span><CalendarDays /></span>Study calendar</a>
          <Link className="nav-item" href="/billing" onClick={() => setSidebarOpen(false)}><span><CreditCard /></span>Membership & billing<ChevronRight /></Link>
          {isCreator && <Link className="nav-item creator-nav-item" href="/teacher" onClick={() => setSidebarOpen(false)}><span><Sparkles /></span>Teacher workspace<ChevronRight /></Link>}
          <div className="nav-line" />
          <button className="nav-item" onClick={() => { setTargetOpen(true); setSidebarOpen(false); document.getElementById("dashboard-top")?.scrollIntoView(); }}><span><Settings /></span>Target settings</button>
        </nav>
        <button className="sidebar-help" onClick={() => { openTutor(); setSidebarOpen(false); }}><HelpCircle /><span><b>Need help?</b><small>Ask Capi Coach</small></span><ChevronRight /></button>
      </aside>
      {sidebarOpen && <button className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <button className="mobile-nav-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu /></button>
          <Link className="mobile-dashboard-brand" href="/"><span className="brand-c">C</span><b>IELTS Mastery</b></Link>
          <div className="topbar-actions">
            <div className="topbar-control-wrap coin-control">
              <button className="metric metric-button interactive-control" aria-haspopup="dialog" aria-expanded={coinsOpen} aria-controls="capi-coins-panel" onClick={() => { setCoinsOpen((open) => !open); setProfileOpen(false); }}><Star fill="currentColor" /><span><small>Capi-Coins</small><b>{livePoints.toLocaleString()}</b></span></button>
              {coinsOpen && (
                <div className="topbar-popover coins-popover" id="capi-coins-panel" role="dialog" aria-label="Capi-Coins rewards centre">
                  <div className="coins-popover-head">
                    <span className="popover-icon coins"><Star fill="currentColor" /></span>
                    <div><small>Your balance</small><h3>{livePoints.toLocaleString()} Capi-Coins</h3></div>
                    <button type="button" aria-label="Close Capi-Coins rewards" onClick={() => setCoinsOpen(false)}><X /></button>
                  </div>

                  <section className="capi-helper-reward">
                    <div className="capi-helper-intro">
                      <img src="/capi-advice.png" alt="Capi helping a new IELTS learner" />
                      <div>
                        <span><Gift /> Capi Helper</span>
                        <h4>Give a new student one free day</h4>
                        <p>Donate Capi-Coins to place a 24-hour IELTS Mastery pass in the new-learner pool.</p>
                      </div>
                    </div>
                    <div className="capi-helper-exchange" aria-label="500 Capi-Coins gives one learner 24 hours of access">
                      <span><Star fill="currentColor" /><b>500</b><small>Capi-Coins</small></span>
                      <ArrowRight />
                      <span><Clock3 /><b>24 hours</b><small>Free access</small></span>
                    </div>

                    {giftState === "confirming" ? (
                      <div className="capi-helper-confirm">
                        <p><b>Confirm your gift?</b> Your available balance will become {(livePoints - capiHelperGiftCost).toLocaleString()} Capi-Coins.</p>
                        <div><button type="button" className="gift-cancel" onClick={() => setGiftState("idle")}>Not now</button><button type="button" onClick={() => void sponsorLearner()}>Give 500 coins <Gift /></button></div>
                      </div>
                    ) : giftState === "sent" ? (
                      <div className="capi-helper-success"><Check /><span><b>Study day sponsored!</b><small>Send this private link to one new learner.</small></span><button type="button" onClick={() => void copyGiftLink()}>{giftCopied ? "Copied" : "Copy link"}</button></div>
                    ) : (
                      <div className="capi-helper-action">
                        <button type="button" disabled={!canSponsorLearner || giftState === "sending"} onClick={() => setGiftState("confirming")}>
                          {giftState === "sending" ? "Sending your gift…" : canSponsorLearner ? <>Sponsor a learner <Gift /></> : <><Lock /> {(capiHelperGiftCost - livePoints).toLocaleString()} more coins needed</>}
                        </button>
                        {giftState === "error" && <p role="alert">{giftError}</p>}
                      </div>
                    )}
                    <small className="capi-helper-impact"><Sparkles /> You&apos;ve sponsored {sponsoredPasses} {sponsoredPasses === 1 ? "study day" : "study days"} so far.</small>
                  </section>

                  <section className="coins-discounts">
                    <div className="coins-discounts-head">
                      <div><small>Learning discounts</small><h4>Save up to 15%</h4></div>
                      <span>{unlockedDiscount ? `${unlockedDiscount}% unlocked` : "Keep earning"}</span>
                    </div>
                    <div className="discount-tier-grid">
                      {discountTiers.map((tier) => {
                        const unlocked = liveEarnedPoints >= tier.coins;
                        return (
                          <article className={unlocked ? "unlocked" : ""} key={tier.percent}>
                            <i>{unlocked ? <Check /> : <Lock />}</i>
                            <b>{tier.percent}%</b>
                            <small>{tier.coins.toLocaleString()} coins</small>
                          </article>
                        );
                      })}
                    </div>
                    <div className="discount-progress" aria-label={nextDiscount ? `${discountProgress}% progress toward the ${nextDiscount.percent}% discount` : "All discounts unlocked"}>
                      <span><i style={{ width: `${discountProgress}%` }} /></span>
                      <small>{nextDiscount ? `${(nextDiscount.coins - liveEarnedPoints).toLocaleString()} more earned coins for ${nextDiscount.percent}% off` : "You unlocked the maximum 15% discount"}</small>
                    </div>
                    <p>Discounts use lifetime-earned coins, so helping another student never removes your progress.</p>
                  </section>

                  <div className="coins-popover-foot">
                    <span><Gift /> Earn 40 coins for every completed lesson.</span>
                    <Link href="/billing" onClick={() => setCoinsOpen(false)}>Membership & discounts <ArrowRight /></Link>
                  </div>
                </div>
              )}
            </div>
            <span className="metric streak-metric"><Flame fill="currentColor" /><span><small>Streak</small><b>{liveStreak} {liveStreak === 1 ? "day" : "days"}</b></span></span>
            <button className="notification interactive-control" aria-label="View your weekly progress report" onClick={() => document.querySelector(".weekly-report-card")?.scrollIntoView({ behavior: "smooth", block: "center" })}><Bell /><i>3</i></button>
            <label className="language-control dashboard-language interactive-control" title="Language"><Languages /><span>{language === "eng" ? "Eng" : language === "rus" ? "Рус" : "Қаз"}</span><select aria-label="Language" value={language} onChange={(event) => setLanguage(event.target.value as "eng" | "rus" | "kaz")}><option value="eng">Eng</option><option value="rus">Рус</option><option value="kaz">Қаз</option></select><ChevronDown /></label>
            <div className="topbar-control-wrap profile-control">
              <button className="profile-chip interactive-control" aria-label={`Open profile menu for ${userName}`} aria-haspopup="dialog" aria-expanded={profileOpen} aria-controls="profile-panel" onClick={() => { setProfileOpen((open) => !open); setCoinsOpen(false); }}><i>{firstName.charAt(0).toUpperCase()}</i><span><b>{userName}</b><small>Target band {targetBand.toFixed(1)}</small></span><ChevronDown className="profile-chevron" /></button>
              {profileOpen && <div className="topbar-popover profile-popover" id="profile-panel" role="dialog" aria-label="Profile menu"><div className="profile-popover-head"><i>{firstName.charAt(0).toUpperCase()}</i><span><b>{userName}</b><small>IELTS learner · Target {targetBand.toFixed(1)}</small></span></div><div className="profile-popover-actions"><Link href="/assessment"><BarChart3 /> Update assessment <ChevronRight /></Link><Link href="/classes"><CalendarDays /> Classes & homework <ChevronRight /></Link><Link href="/billing"><CreditCard /> Membership & billing <ChevronRight /></Link><button onClick={() => { setProfileOpen(false); setTargetOpen(true); document.getElementById("dashboard-top")?.scrollIntoView({ behavior: "smooth" }); }}><Target /> Target settings <ChevronRight /></button><a href="/signout-with-chatgpt?return_to=%2F"><LogOut /> Sign out <ChevronRight /></a></div></div>}
            </div>
          </div>
        </header>

        <div className="dashboard-content" id="dashboard-top">
          <section className={`welcome-card dashboard-card ${targetOpen ? "target-open" : ""}`}>
            <div className="welcome-copy"><span className="eyebrow"><Sparkles /> Your personal study space</span><h1>Good to see you, {firstName}.</h1><p>{latest ? <>You&apos;re building toward Band {targetBand.toFixed(1)}. Your saved results have adjusted today&apos;s plan toward <b>{adaptivePriority.toLowerCase()}</b>.</> : <>Start with the free assessment and Capi will build your personal route to Band {targetBand.toFixed(1)}.</>}</p><div className="welcome-actions"><Link className="button primary" href={latest ? "#today-plan" : "/assessment"}>{latest ? "Continue today’s plan" : "Take the assessment"}<ArrowRight /></Link><button className="button soft" onClick={() => setTargetOpen((open) => !open)}><Target /> Target {targetBand.toFixed(1)}<ChevronDown /></button>{targetState === "saved" && <span className="saved-hint"><Check /> Saved</span>}</div>{targetOpen && <div className="target-picker" aria-label="Choose target band">{[6, 6.5, 7, 7.5, 8, 8.5, 9].map((band) => <button key={band} onClick={() => void updateTarget(band)} className={band === targetBand ? "selected" : ""}>{band.toFixed(1)}</button>)}</div>}</div>
            <img src="/capi-welcome.png" alt="Capi Coach pointing upward and holding a small rocket" />
          </section>

          <div className="dashboard-columns">
            <div className="dashboard-primary">
              <section className="progress-section dashboard-card" id="progress">
                <div className="card-heading"><div><span className="eyebrow">Latest assessment</span><h2>Your overall progress</h2></div><Link href="/assessment">Reassess <ArrowRight /></Link></div>
                {latest ? <div className="progress-summary"><div className="progress-ring" style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}><span><b>{score.toFixed(1)}</b><small>of {targetBand.toFixed(1)}</small></span></div><div><h3>{progress}% of the way to your target</h3><p>Your strongest area is <b>{latest.strengthSkill}</b>. Improving <b>{latest.prioritySkill}</b> will give your overall band the biggest lift.</p><div className="progress-line"><span style={{ width: `${progress}%` }} /></div><small>Assessment saved {new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(latest.createdAt))}</small></div></div> : <div className="empty-progress"><Target /><div><h3>No saved assessment yet</h3><p>Complete the diagnostic to see real module bands and a focused study plan.</p></div><Link className="button primary small" href="/assessment">Start now</Link></div>}
                <div className="skill-grid" id="modules">{modules.map(({ skill, icon: Icon, className, tasks }) => <Link className={`skill-card ${className}`} href={skill === "Speaking" ? "/speaking" : skill === "Writing" ? "/writing" : skill === "Reading" ? "/reading" : "/listening"} aria-label={`Practise ${skill}. ${bands[skill] ? `Current estimate ${bands[skill]?.toFixed(1)}` : "Complete the assessment first"}`} key={skill}><span className="skill-card-icon"><Icon /></span><div><small>{skill}</small><b>{bands[skill]?.toFixed(1) ?? "—"}</b></div><p>{latest ? tasks : "Complete assessment"}</p><ChevronRight className="skill-card-chevron" /></Link>)}</div>
              </section>

              <section className="learning-journey-card dashboard-card" id="learning-journey">
                <div className="card-heading"><div><span className="eyebrow">Connected learning journey</span><h2>Progress across all four modules</h2></div><span className="adaptive-focus"><Sparkles /> Plan focus: {adaptivePriority}</span></div>
                <div className="module-progress-grid">
                  {moduleProgress.map((item) => {
                    const moduleInfo = modules.find((module) => module.skill === item.skill) ?? modules[0];
                    const Icon = moduleInfo.icon;
                    const percentage = Math.min(100, Math.round(item.completed / item.total * 100));
                    return <Link href={item.skill === "Speaking" ? "/speaking" : item.skill === "Writing" ? "/writing" : item.skill === "Reading" ? "/reading" : "/listening"} className={`module-progress-item ${moduleInfo.className}`} key={item.skill}><span><Icon /></span><div><small>{item.skill}</small><b>{item.completed} of {item.total} lessons</b><i><em style={{ width: `${percentage}%` }} /></i></div><strong>{item.averageScore !== null ? `${item.averageScore}%` : "Start"}</strong></Link>;
                  })}
                </div>
                <div className="ai-history-panel">
                  <div><span className="eyebrow">AI band history</span><h3>{assessmentHistory.length ? "Your Speaking and Writing estimates" : "Your first saved estimate will appear here"}</h3>{assessmentHistory[0] ? <p><b>{assessmentHistory[0].skill} {assessmentHistory[0].overallBand.toFixed(1)}:</b> {assessmentHistory[0].summary}</p> : <p>Submit a Speaking recording or Writing response to begin your improvement chart.</p>}</div>
                  <div className="ai-history-chart" aria-label={`${assessmentHistory.length} saved AI assessments`}>
                    {assessmentHistory.length ? assessmentHistory.slice(0, 6).reverse().map((item) => <span key={item.id}><i><em style={{ height: `${Math.max(12, item.overallBand / 9 * 100)}%` }} /></i><b>{item.overallBand.toFixed(1)}</b><small>{item.skill.slice(0, 1)}</small></span>) : <span className="empty"><i /><b>—</b><small>Waiting</small></span>}
                  </div>
                </div>
              </section>

              <section id="today-plan" className="today-card dashboard-card">
                <div className="card-heading"><div><span className="eyebrow">{new Intl.DateTimeFormat("en", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</span><h2>Today&apos;s study plan</h2></div><span className="time-total"><Clock3 /> {initialStats.totalMinutesToday} minutes</span></div>
                <div className="plan-list">{tasks.map((task, index) => { const moduleInfo = modules.find((item) => item.skill === task.skill) ?? modules[2]; const Icon = moduleInfo.icon; return <article key={task.id} className={task.completedAt ? "completed" : ""}><time>{String(9 + index * 4).padStart(2, "0")}:00</time><span className={`plan-icon ${moduleInfo.className}`}><Icon /></span><div><b>{task.title}</b><small>{task.completedAt ? "Completed today · +40 Capi-Coins" : `${task.minutes} min · ${task.taskType}`}</small></div><button aria-label={`${task.completedAt ? "Mark incomplete" : "Complete"} ${task.title}`} aria-pressed={Boolean(task.completedAt)} onClick={() => void toggleTask(task)} className={index === 0 || task.completedAt ? "active" : ""}>{task.completedAt ? <Check /> : index === 0 ? <Play fill="currentColor" /> : <ChevronRight />}</button></article>; })}</div>
                <div className="weekly-line"><span><b>This week</b><small>{liveDays} of 5 study days complete</small></span><div><i style={{ width: `${weeklyPercent}%` }} /></div><b>{weeklyPercent}%</b></div>
              </section>

              <section className="weekly-report-card dashboard-card">
                <div className="weekly-report-head"><div><span className="eyebrow"><CalendarDays /> Weekly progress report</span><h2>Your learning week at a glance</h2><p>Delivered inside your dashboard every Monday and updated as you practise.</p></div><span><Check /> Report ready</span></div>
                <div className="weekly-report-metrics">
                  <article><small>Lessons completed</small><b>{weeklyReport.lessonsCompleted}</b><span>This week</span></article>
                  <article><small>Exercise average</small><b>{weeklyReport.exerciseAverage !== null ? `${weeklyReport.exerciseAverage}%` : "—"}</b><span>{weeklyReport.exerciseAverage !== null ? "Across saved tasks" : "Complete one exercise"}</span></article>
                  <article><small>Latest AI estimate</small><b>{weeklyReport.latestAiBand !== null ? weeklyReport.latestAiBand.toFixed(1) : "—"}</b><span>{weeklyReport.latestAiSkill ?? "Speaking or Writing"}{weeklyReport.aiChange !== null ? ` · ${weeklyReport.aiChange >= 0 ? "+" : ""}${weeklyReport.aiChange.toFixed(1)}` : ""}</span></article>
                  <article><small>Weekend mock</small><b>{weeklyReport.latestMockBand !== null ? weeklyReport.latestMockBand.toFixed(1) : "—"}</b><span>{weeklyReport.mockChange !== null ? `${weeklyReport.mockChange >= 0 ? "+" : ""}${weeklyReport.mockChange.toFixed(1)} vs previous` : "Complete your first mock"}</span></article>
                </div>
                <div className="weekly-report-insight"><span><Target /></span><div><small>Next-week adjustment</small><b>Capi is prioritising {weeklyReport.focusSkill}</b><p>Your plan uses recent exercise accuracy, saved AI bands and mock-test results to choose the module that needs the most attention.</p></div><button className="button soft" onClick={() => void shareWeeklyReport()}>{reportShared ? <><Check /> Report ready to share</> : <>Share report <ArrowRight /></>}</button></div>
              </section>

              <section className="recent-card dashboard-card"><div className="card-heading"><h2>Recent activity</h2></div><div className="activity-list">{activityTasks.map((task) => { const moduleInfo = modules.find((item) => item.skill === task.skill) ?? modules[2]; const Icon = moduleInfo.icon; return <article key={task.id}><span className={`activity-icon ${moduleInfo.className}`}><Icon /></span><div><b>{task.title} completed</b><small>{task.minutes} minutes · {task.skill} · +40 Capi-Coins</small></div><time>{task.completedAt ? new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(new Date(task.completedAt)) : "Today"}</time></article>; })}{latest && <article><span className="activity-icon assessment"><BarChart3 /></span><div><b>Assessment result saved</b><small>Overall {latest.overallBand.toFixed(1)} · priority: {latest.prioritySkill}</small></div><time>{new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(new Date(latest.createdAt))}</time></article>}</div></section>

              <section className="weekend-mock-card dashboard-card"><div className="weekend-mock-copy"><span className="eyebrow light"><Trophy /> {weekend ? "This weekend" : "Weekend challenge"}</span><h2>Challenge yourself</h2><p>Take a complete four-skill practice mock every weekend and compare your estimate with the previous week.</p><div className="mock-card-stats">{latestMock ? <><span><small>Latest overall</small><b>{latestMock.overallBand.toFixed(1)}</b></span><span><small>Previous week</small><b>{previousMock?.overallBand.toFixed(1) ?? "—"}</b></span><span><small>Weekly change</small><b className={mockDelta !== null && mockDelta >= 0 ? "positive" : ""}>{mockDelta === null ? "First result" : `${mockDelta >= 0 ? "+" : ""}${mockDelta.toFixed(1)}`}</b></span></> : <><span><small>Skills</small><b>4 modules</b></span><span><small>Time</small><b>20–25 min</b></span><span><small>Goal</small><b>Beat last week</b></span></>}</div><Link className="button white" href="/mock-test">{mockDoneThisWeek ? "Review this week’s result" : weekend ? "Start weekend mock" : "Prepare for the weekend"}<ArrowRight /></Link></div><img src="/capi-challenge.png" alt="Capi Coach with a checklist and trophy" /></section>
            </div>

            <aside className="dashboard-secondary">
              <section className="calendar-card dashboard-card" id="study-calendar"><div className="card-heading"><div><span className="eyebrow">July 2026</span><h2>Your study week</h2></div><CalendarDays aria-hidden="true" /></div><div className="week-labels">{["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div><div className="week-days">{monthDays.map(({ day, state }) => <button key={day} aria-label={`Select July ${day}`} aria-pressed={selectedDay === day} onClick={() => setSelectedDay(day)} className={`${state} ${selectedDay === day ? "selected" : ""}`}>{day}{state === "done" && <Check />}</button>)}</div><div className="calendar-legend"><span><i className="done" /> Studied</span><span><i className="planned" /> Planned</span><span>Selected: {selectedDay} July</span></div></section>

              <section className="challenge-card dashboard-card"><div><span className="eyebrow light"><Zap /> Capi challenge</span><h2>Three focused days</h2><p>Complete one planned lesson on three different days this week.</p><div className="challenge-progress">{[1,2,3].map((day) => <span key={day} className={liveDays >= day ? "done" : ""}>{liveDays >= day ? <Check /> : day}</span>)}</div><small>{Math.min(liveDays, 3)} of 3 days complete</small></div><img src="/capi-challenge.png" alt="Capi Coach wearing a blue headband with a checklist and trophy" /></section>

              <section className="capi-advice-card dashboard-card"><div className="advice-heading"><img src="/capi-advice.png" alt="Capi Coach with a magnifying glass and lightbulb" /><span><small>CAPI COACH</small><b>Today&apos;s advice</b></span></div><p>{latest ? <>Your <b>{latest.strengthSkill.toLowerCase()}</b> score gives you a strong base. Your recent saved work now points to <b>{adaptivePriority.toLowerCase()}</b> as the clearest place for the next improvement.</> : <>Take the short assessment first. I&apos;ll use your four module estimates to choose the clearest place to begin.</>}</p><button onClick={openTutor}>Ask Capi a question <ArrowRight /></button></section>

              <section className="live-class-card dashboard-card" id="live-class"><div className="live-image"><span>LIVE CLASS</span><img src="/capi-headset.png" alt="Capi Coach wearing a coaching headset" /></div><div><span className="eyebrow">Tuesday · 18:30</span><h3>Speaking Part 2: confident long turns</h3><p><Video /> With Anna Müller · 45 min</p><button className="button soft" aria-pressed={reserved} onClick={() => setReserved((value) => !value)}>{reserved ? <><Check /> Place reserved</> : <>Reserve my place <ArrowRight /></>}</button></div></section>
            </aside>
          </div>
        </div>
      </div>

      <button className="floating-capi" onClick={openTutor} aria-label="Open Capi Coach chat"><img src="/capi-profile.png" alt="" /><span>Ask Capi</span><MessageCircle /></button>
      {chatOpen && <section className="capi-chat" aria-label="Capi Coach personalised tutor">
        <header><img src="/capi-profile.png" alt="" /><span><b>Capi Coach</b><small><i /> {tutorCopy.ready}</small></span>{tutorUsage && <em>{tutorUsage.used}/{tutorUsage.limit}<small>{tutorUsage.planLabel}</small></em>}<button onClick={() => setChatOpen(false)} aria-label="Close chat"><X /></button></header>
        <div className="tutor-toolbar" aria-label="Tutor language"><Languages />{([['en', 'Eng'], ['ru', 'Рус'], ['kk', 'Қаз']] as Array<[TutorLanguage, string]>).map(([value, label]) => <button type="button" className={tutorLanguage === value ? "active" : ""} aria-pressed={tutorLanguage === value} onClick={() => setTutorLanguage(value)} key={value}>{label}</button>)}<span><ShieldCheck /> Course-safe</span></div>
        <div className="chat-body">
          <div className="chat-messages" aria-live="polite">
            {!tutorMessages.length && tutorState !== "loading" && <article className="chat-message capi"><p>{tutorCopy.greeting}</p></article>}
            {tutorState === "loading" && <div className="tutor-loading"><span /><span /><span /> Loading your learning record</div>}
            {tutorMessages.map((message) => <article key={message.id} className={`chat-message ${message.role}`}>
              {message.role === "teacher" && <small className="tutor-role">Teacher follow-up</small>}
              <p>{message.content}</p>
              {message.practice && <section className="tutor-practice"><small>{tutorCopy.practice} · {message.practice.durationMinutes} min</small><b>{message.practice.title}</b><p>{message.practice.instructions}</p><blockquote>{message.practice.prompt}</blockquote>{message.practice.successCriteria.length > 0 && <details><summary>{tutorCopy.criteria}</summary><ul>{message.practice.successCriteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul></details>}</section>}
              {message.citations.length > 0 && <div className="tutor-citations"><small>{tutorCopy.sources}</small>{message.citations.map((citation) => <Link key={`${citation.module}-${citation.lessonId}`} href={citation.href}><span>{citation.module}</span>{citation.title}<ExternalLink /></Link>)}</div>}
              {message.escalationRequired && <span className="tutor-escalation"><ShieldCheck /> {tutorCopy.sent}</span>}
            </article>)}
            {tutorState === "sending" && <article className="chat-message capi tutor-thinking"><span /><span /><span /> Capi is checking your course and progress…</article>}
          </div>
          {tutorError && <p className="tutor-error">{tutorError}</p>}
          <div className="chat-suggestions">{TUTOR_STARTERS[tutorLanguage].map((starter) => <button type="button" onClick={() => { if (starter.endsWith(": ")) setChatInput(starter); else void askCapi(starter); }} key={starter}>{starter}</button>)}</div>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); void askCapi(chatInput); }}><input maxLength={2000} value={chatInput} onChange={(event) => setChatInput(event.target.value)} aria-label="Message Capi Coach" placeholder={tutorCopy.placeholder} disabled={tutorState === "sending" || tutorUsage?.remaining === 0} /><button aria-label="Send message" disabled={!chatInput.trim() || tutorState === "sending" || tutorUsage?.remaining === 0}><Send /></button></form>
      </section>}
    </main>
  );
}
