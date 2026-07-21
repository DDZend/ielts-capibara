import Link from "next/link";
/* eslint-disable @next/next/no-img-element */
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  Headphones,
  Languages,
  Menu,
  MessageCircle,
  Mic2,
  PenLine,
  Play,
  Sparkles,
  Target,
  Video,
} from "lucide-react";
import { getChatGPTUser } from "./chatgpt-auth";

const modules = [
  { name: "Speaking", text: "Build confidence for every part of the interview.", icon: Mic2, className: "speaking" },
  { name: "Writing", text: "Plan, write and improve essays with clear feedback.", icon: PenLine, className: "writing" },
  { name: "Reading", text: "Find answers faster with practical reading strategies.", icon: BookOpen, className: "reading" },
  { name: "Listening", text: "Train your ear for accents, detail and real exam pace.", icon: Headphones, className: "listening" },
];

const journey = [
  { title: "Assess", text: "Discover your current level in about 12 minutes." },
  { title: "Plan", text: "Get a focused route to your target band." },
  { title: "Practise", text: "Complete short daily lessons across all four skills." },
  { title: "Improve", text: "Track progress and adjust as your confidence grows." },
];

function Brand() {
  return (
    <Link className="brand-mark" href="#top" aria-label="IELTS Mastery home">
      <span className="brand-c">C</span>
      <span><b>IELTS</b> Mastery</span>
    </Link>
  );
}

export default async function Home() {
  const user = await getChatGPTUser();
  return (
    <main id="top" className="landing">
      <header className="landing-header">
        <div className="landing-nav wrap">
          <Brand />
          <nav className="desktop-nav" aria-label="Main navigation">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#support">Live support</a>
            <a href="#about-capy">Capy Coach</a>
          </nav>
          <div className="nav-actions">
            <label className="language-control compact">
              <Languages size={16} />
              <span className="sr-only">Language</span>
              <select defaultValue="EN" aria-label="Language">
                <option>EN</option><option>RU</option><option>KZ</option>
              </select>
              <ChevronDown size={14} />
            </label>
            <Link className="button secondary small" href="/login">
              {user ? "Choose workspace" : "Sign in"}
            </Link>
            <details className="mobile-menu">
              <summary aria-label="Open menu"><Menu size={22} /></summary>
              <nav><a href="#features">Features</a><a href="#how-it-works">How it works</a><a href="#support">Live support</a><a href="#about-capy">Capy Coach</a></nav>
            </details>
          </div>
        </div>
      </header>

      <section className="hero wrap">
        <div className="hero-copy">
          <span className="eyebrow"><Sparkles size={16} /> Personal IELTS preparation</span>
          <h1>Your clearest path to <span>IELTS 7.0.</span></h1>
          <p>Know where you are, what to do next and how every focused study session moves you closer to your target band.</p>
          <div className="hero-actions">
            <Link className="button primary" href="/assessment">Take the free assessment <ArrowRight size={18} /></Link>
            <a className="text-link" href="#how-it-works"><Play size={16} fill="currentColor" /> See how it works</a>
          </div>
          <div className="trust-row"><span><Check size={15} /> Free, no card needed</span><span><Check size={15} /> About 12 minutes</span><span><Check size={15} /> Personal study plan</span></div>
        </div>
        <div className="hero-visual">
          <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
          <img src="/capi-official.png" alt="Capy Coach giving a thumbs-up beside a plant" />
          <div className="floating-note note-band"><Target size={18} /><span><small>Your target</small><b>Band 7.0</b></span></div>
          <div className="floating-note note-plan"><CalendarDays size={18} /><span><small>Today</small><b>25 min plan</b></span></div>
        </div>
      </section>

      <section id="features" className="section wrap">
        <div className="section-heading centered"><span className="eyebrow">All four skills</span><h2>One clear, connected learning plan</h2><p>Balanced preparation, with extra focus where it matters most for you.</p></div>
        <div className="module-grid">
          {modules.map(({ name, text, icon: Icon, className }) => (
            <article key={name} className={`module-card ${className}`}><span className="module-icon"><Icon size={23} /></span><h3>{name}</h3><p>{text}</p><a href="/assessment">Explore {name.toLowerCase()} <ArrowRight size={15} /></a></article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="section journey-section">
        <div className="wrap"><div className="section-heading centered"><span className="eyebrow">A calmer way to prepare</span><h2>Four steps from uncertainty to progress</h2></div>
          <div className="journey-grid">{journey.map((item, index) => <article key={item.title} className="journey-card"><span>{String(index + 1).padStart(2, "0")}</span><h3>{item.title}</h3><p>{item.text}</p>{index < 3 && <ArrowRight className="journey-arrow" size={20} />}</article>)}</div>
        </div>
      </section>

      <section id="about-capy" className="section wrap split-section advice-section">
        <div className="capi-panel"><img src="/capi-advice.png" alt="Capy Coach with a magnifying glass and lightbulb" /></div>
        <div><span className="eyebrow"><MessageCircle size={16} /> Meet Capy Coach</span><h2>Friendly guidance, right when you need it</h2><p>Capy turns your results into small, useful next steps. No vague advice and no pressure—just a clear focus for today.</p>
          <blockquote>“Your reading accuracy is growing. This week, let’s practise matching headings without rushing the first paragraph.”</blockquote>
          <ul className="check-list"><li><Check size={17} /> Advice shaped by your latest results</li><li><Check size={17} /> Daily practice that fits your schedule</li><li><Check size={17} /> Encouragement without the noise</li></ul>
        </div>
      </section>

      <section id="support" className="section support-section"><div className="wrap split-section reverse">
        <div><span className="eyebrow"><Video size={16} /> Real teacher support</span><h2>You are learning independently, not alone</h2><p>Join focused live sessions with IELTS teachers, ask questions and see how strong answers are built in real time.</p><div className="support-points"><span><CalendarDays size={20} /><b>Weekly live classes</b><small>Speaking, writing and exam strategy</small></span><span><MessageCircle size={20} /><b>Practical feedback</b><small>Clear explanations you can use immediately</small></span></div></div>
        <div className="live-card"><div className="live-card-top"><span className="live-badge">LIVE</span><span>Next class</span></div><h3>Speaking Part 2: confident long turns</h3><p>Tuesday, 18:30 · 45 minutes</p><div className="teacher-row"><span className="teacher-avatar">AM</span><span><b>Anna Müller</b><small>IELTS Speaking Specialist</small></span><button aria-label="Preview live class"><Play size={20} fill="currentColor" /></button></div></div>
      </div></section>

      <section className="final-cta wrap"><div><span className="eyebrow light">Your first step is free</span><h2>See your clearest route to IELTS 7.0.</h2><p>Complete the short assessment and receive your personalised starting plan.</p><Link className="button white" href="/assessment">Start my free assessment <ArrowRight size={18} /></Link></div><img src="/capi-assessment.png" alt="Capy Coach holding a clipboard and pencil" /></section>

      <footer><div className="wrap footer-grid"><div><Brand /><p>Calm, focused IELTS preparation for ambitious learners.</p></div><div><h3>Learn</h3><a href="#features">Four skills</a><a href="#how-it-works">How it works</a><a href="/assessment">Free assessment</a></div><div><h3>Support</h3><a href="#support">Live classes</a><a href="#about-capy">Capy Coach</a><a href="mailto:hello@ieltsmastery.com">Contact</a></div><div><h3>Language</h3><label className="language-control"><Languages size={16} /><select aria-label="Footer language"><option>English</option><option>Русский</option><option>Қазақша</option></select><ChevronDown size={14} /></label></div></div><div className="wrap footer-bottom"><span>© 2026 IELTS Mastery</span><span>IELTS is a registered trademark of its respective owners.</span></div></footer>
    </main>
  );
}
