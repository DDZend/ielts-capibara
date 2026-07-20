"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadLessonProgress, saveLessonProgress } from "../../lib/lesson-progress-client";
import type { StudentLessonContent } from "../../lib/creator-content";
import { applyPublishedLessonOrder } from "../../lib/creator-content";
import { PublishedLessonMaterials, PublishedLessonVideo } from "../PublishedLessonContent";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileText,
  GitBranch,
  Layers3,
  Lightbulb,
  ListChecks,
  LockKeyhole,
  Map,
  MessageSquareText,
  Pause,
  PenLine,
  PieChart,
  Play,
  RotateCcw,
  Scale,
  Sparkles,
  Table2,
  Target,
  ThumbsUp,
  Video,
  WandSparkles,
  Workflow,
  Wrench,
} from "lucide-react";

type LessonId = "line-graph" | "bar-chart" | "pie-chart" | "table" | "process" | "maps-plans" | "mixed-visuals" | "opinion" | "discussion" | "advantages" | "problem-solution" | "two-part";
type TrackFilter = "all" | "task1" | "task2";

type WritingLesson = {
  id: LessonId;
  task: 1 | 2;
  number: number;
  title: string;
  shortTitle: string;
  subtitle: string;
  focus: string;
  icon: typeof BarChart3;
  minimumWords: number;
  minutes: number;
  prompt: string;
  promptDetail: string;
  vocabulary: { term: string; question: string; options: string[]; answer: string; explanation: string };
  phrases: Array<{ phrase: string; use: string }>;
  plan: string[];
};

type Feedback = {
  overallBand: number;
  taskAchievement: number;
  coherence: number;
  lexicalResource: number;
  grammar: number;
  summary: string;
  strengths: string[];
  priorities: string[];
  improvedPlan: string[];
  correctedExcerpt: string;
  usefulPhrases: string[];
};

type FeedbackResponse = { feedback?: Feedback; wordCount?: number; disclaimer?: string; error?: string };

const lessons: WritingLesson[] = [
  {
    id: "line-graph", task: 1, number: 1, title: "Line graphs", shortTitle: "Line graph", subtitle: "Describe change over time", focus: "Find the overall direction first, group similar trends and support them with selective figures.", icon: GitBranch, minimumWords: 150, minutes: 20,
    prompt: "The line graph shows the percentage of households with internet access in three countries in 2005, 2015 and 2025. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
    promptDetail: "Country A: 45%, 72%, 91%. Country B: 30%, 61%, 84%. Country C: 20%, 49%, 78%.",
    vocabulary: { term: "a steady rise", question: "Which description best matches a figure that increases by a similar amount in every period?", options: ["A steady rise", "A sharp fluctuation", "A slight decline"], answer: "A steady rise", explanation: "A steady rise describes consistent upward movement over time." },
    phrases: [{ phrase: "rose steadily from… to…", use: "describe a consistent increase" }, { phrase: "followed a similar pattern", use: "group comparable trends" }, { phrase: "remained the highest throughout", use: "highlight rank" }, { phrase: "the gap narrowed", use: "compare changing differences" }],
    plan: ["Paraphrase what the graph measures", "Give the biggest overall trends", "Group Countries A and B", "Contrast Country C with key figures"],
  },
  {
    id: "bar-chart", task: 1, number: 2, title: "Bar charts", shortTitle: "Bar chart", subtitle: "Compare categories clearly", focus: "Organise bars into meaningful groups instead of reporting every number from left to right.", icon: BarChart3, minimumWords: 150, minutes: 20,
    prompt: "The bar chart compares the main forms of transport used by workers in one city in 2000 and 2025. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
    promptDetail: "Car: 55% to 38%. Bus: 24% to 27%. Bicycle: 8% to 19%. Walking: 13% to 16%.",
    vocabulary: { term: "accounted for", question: "What does “cars accounted for 55%” mean?", options: ["Cars represented 55% of the total", "Cars increased by 55%", "Cars cost 55% more"], answer: "Cars represented 55% of the total", explanation: "Accounted for is a precise way to describe a share of the whole." },
    phrases: [{ phrase: "accounted for the largest share", use: "identify the biggest category" }, { phrase: "was roughly twice as high as", use: "make a proportional comparison" }, { phrase: "by contrast,…", use: "introduce a clear difference" }, { phrase: "experienced the greatest change", use: "highlight movement" }],
    plan: ["Paraphrase the chart", "Overview the leading and changing modes", "Compare motorised transport", "Compare active transport"],
  },
  {
    id: "pie-chart", task: 1, number: 3, title: "Pie charts", shortTitle: "Pie chart", subtitle: "Report proportions and shifts", focus: "Select the largest shares, meaningful similarities and the most important changes between pies.", icon: PieChart, minimumWords: 150, minutes: 20,
    prompt: "The pie charts show the sources of electricity generation in a country in 2000 and 2025. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
    promptDetail: "2000 — coal 45%, gas 30%, nuclear 15%, renewables 10%. 2025 — coal 22%, gas 28%, nuclear 18%, renewables 32%.",
    vocabulary: { term: "proportion", question: "Which word is closest in meaning to “proportion” in a pie chart report?", options: ["Share", "Sequence", "Prediction"], answer: "Share", explanation: "Proportion and share both describe how much one category contributes to a whole." },
    phrases: [{ phrase: "made up nearly half of…", use: "describe a large share" }, { phrase: "overtook coal to become…", use: "show a change in rank" }, { phrase: "changed only marginally", use: "describe stability" }, { phrase: "combined, X and Y represented…", use: "group categories" }],
    plan: ["Paraphrase both years", "Overview the move away from coal", "Compare fossil fuels", "Compare nuclear and renewables"],
  },
  {
    id: "table", task: 1, number: 4, title: "Tables", shortTitle: "Table", subtitle: "Find patterns in dense data", focus: "Turn a grid of numbers into a small number of clear comparisons and avoid listing every cell.", icon: Table2, minimumWords: 150, minutes: 20,
    prompt: "The table gives information about average monthly spending by university students in three cities. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
    promptDetail: "Alma: rent $420, food $180, transport $45. Boran: rent $560, food $205, transport $70. Caspian: rent $390, food $220, transport $55.",
    vocabulary: { term: "respectively", question: "When is “respectively” useful?", options: ["Matching two lists in the same order", "Introducing an opinion", "Showing a process stage"], answer: "Matching two lists in the same order", explanation: "Use respectively when values correspond to categories in the order already given." },
    phrases: [{ phrase: "the corresponding figures were…", use: "compare matched data" }, { phrase: "by a considerable margin", use: "stress a large difference" }, { phrase: "ranked first for…", use: "describe position" }, { phrase: "with the exception of…", use: "signal an outlier" }],
    plan: ["Paraphrase the table", "Overview the highest costs and exceptions", "Compare rent and food", "Compare transport and totals"],
  },
  {
    id: "process", task: 1, number: 5, title: "Process diagrams", shortTitle: "Process", subtitle: "Explain stages and sequence", focus: "Group stages into phases, use sequencing language and control the passive voice.", icon: Workflow, minimumWords: 150, minutes: 20,
    prompt: "The diagram shows how used glass bottles are recycled and returned to shops. Summarise the information by selecting and reporting the main features.",
    promptDetail: "Collection → sorting by colour → washing → crushing → melting → forming new bottles → quality inspection → delivery to shops.",
    vocabulary: { term: "is subjected to", question: "Why is passive voice common in process reports?", options: ["The action or stage is more important than the actor", "The writer must give an opinion", "The process always happened in the past"], answer: "The action or stage is more important than the actor", explanation: "Processes often focus on what happens to a material, not who performs the action." },
    phrases: [{ phrase: "the process begins with…", use: "introduce the first stage" }, { phrase: "once this has been completed,…", use: "connect stages" }, { phrase: "is then transferred to…", use: "use controlled passive voice" }, { phrase: "the final stage involves…", use: "close the sequence" }],
    plan: ["Paraphrase the process", "Overview the number and broad phases", "Describe collection to crushing", "Describe melting to redistribution"],
  },
  {
    id: "maps-plans", task: 1, number: 6, title: "Maps and plans", shortTitle: "Maps & plans", subtitle: "Describe spatial change", focus: "Prioritise the biggest developments and use precise language for location, replacement and expansion.", icon: Map, minimumWords: 150, minutes: 20,
    prompt: "The maps show a town centre in 2000 and after redevelopment in 2025. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
    promptDetail: "The car park became a public square; the market was replaced by a library; a riverside cycle path was added; the shopping street became pedestrian-only; the bus station was enlarged.",
    vocabulary: { term: "was converted into", question: "Which meaning is closest to “the car park was converted into a square”?", options: ["It was changed and given a new use", "It was moved without change", "It became smaller temporarily"], answer: "It was changed and given a new use", explanation: "Converted into is useful when one feature is transformed for a different purpose." },
    phrases: [{ phrase: "underwent substantial redevelopment", use: "overview major change" }, { phrase: "was replaced by…", use: "describe substitution" }, { phrase: "to the north of…", use: "locate a feature" }, { phrase: "remained largely unchanged", use: "identify stability" }],
    plan: ["Paraphrase the two maps", "Overview the main transformation", "Describe central changes", "Describe transport and riverside changes"],
  },
  {
    id: "mixed-visuals", task: 1, number: 7, title: "Mixed visuals", shortTitle: "Mixed visuals", subtitle: "Connect two sources", focus: "Give one integrated overview and explain the relationship between different charts or tables.", icon: Layers3, minimumWords: 150, minutes: 20,
    prompt: "The bar chart shows visitor numbers at a museum from 2020 to 2024, while the table gives the percentage of visitors who rated their experience as excellent. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
    promptDetail: "Visitors (thousands): 120, 135, 110, 160, 190. Excellent ratings: 62%, 65%, 58%, 71%, 76%.",
    vocabulary: { term: "corresponded with", question: "What does “the rise in visitors corresponded with higher ratings” suggest?", options: ["The two changes occurred together", "One definitely caused the other", "The figures were identical"], answer: "The two changes occurred together", explanation: "Corresponded with shows an association without claiming definite cause." },
    phrases: [{ phrase: "taken together, the visuals show…", use: "create an integrated overview" }, { phrase: "a similar pattern is evident in…", use: "link data sources" }, { phrase: "despite this temporary fall,…", use: "handle an exception" }, { phrase: "reached a peak of…", use: "identify the maximum" }],
    plan: ["Paraphrase both visuals", "Give one combined overview", "Describe visitor numbers", "Relate ratings to the main changes"],
  },
  {
    id: "opinion", task: 2, number: 8, title: "Opinion essays", shortTitle: "Opinion", subtitle: "Agree or disagree", focus: "Take a clear position, maintain it throughout and support each main reason with a specific explanation or example.", icon: ThumbsUp, minimumWords: 250, minutes: 40,
    prompt: "Some people believe university education should be free for everyone. To what extent do you agree or disagree?",
    promptDetail: "Give reasons for your answer and include any relevant examples from your own knowledge or experience.",
    vocabulary: { term: "to a large extent", question: "What does “I agree to a large extent” communicate?", options: ["Strong agreement with some qualification", "Complete disagreement", "No clear position"], answer: "Strong agreement with some qualification", explanation: "The phrase states a clear degree of agreement while allowing a limited counterpoint." },
    phrases: [{ phrase: "I agree to a large extent that…", use: "state a nuanced position" }, { phrase: "The primary reason is…", use: "introduce a main argument" }, { phrase: "This is particularly evident when…", use: "develop evidence" }, { phrase: "Nevertheless, it is important to recognise…", use: "qualify the position" }],
    plan: ["Introduction and clear position", "First reason with explanation and example", "Second reason with explanation and example", "Qualification and concise conclusion"],
  },
  {
    id: "discussion", task: 2, number: 9, title: "Discussion essays", shortTitle: "Discussion", subtitle: "Discuss both views", focus: "Represent both sides fairly before making your own position unmistakable.", icon: MessageSquareText, minimumWords: 250, minutes: 40,
    prompt: "Some people think children should begin formal education as early as possible, while others believe they should not start until the age of seven. Discuss both views and give your own opinion.",
    promptDetail: "Give reasons for your answer and include any relevant examples from your own knowledge or experience.",
    vocabulary: { term: "proponents", question: "Who are the “proponents” of a view?", options: ["People who support it", "People who study it", "People who reject it"], answer: "People who support it", explanation: "Proponents are people who argue in favour of an idea or policy." },
    phrases: [{ phrase: "Those who support this view argue that…", use: "present one side fairly" }, { phrase: "By contrast, others maintain that…", use: "introduce the other view" }, { phrase: "Both perspectives have merit; however,…", use: "transition to your position" }, { phrase: "In my view,…", use: "make the opinion explicit" }],
    plan: ["Introduce both views and your position", "Explain the early-start view", "Explain the later-start view", "Justify your opinion and conclude"],
  },
  {
    id: "advantages", task: 2, number: 10, title: "Advantages and disadvantages", shortTitle: "Advantages", subtitle: "Evaluate benefits and drawbacks", focus: "Use balanced categories and answer whether one side outweighs the other when the wording asks you to judge.", icon: Scale, minimumWords: 250, minutes: 40,
    prompt: "More employees are working from home rather than travelling to an office every day. Do the advantages of this development outweigh the disadvantages?",
    promptDetail: "Give reasons for your answer and include any relevant examples from your own knowledge or experience.",
    vocabulary: { term: "outweigh", question: "If the advantages outweigh the disadvantages, what does that mean?", options: ["The benefits are more significant", "The two sides are exactly equal", "The drawbacks are easier to describe"], answer: "The benefits are more significant", explanation: "Outweigh requires a judgement about which side has greater importance or impact." },
    phrases: [{ phrase: "A major benefit is…", use: "introduce an advantage" }, { phrase: "The principal drawback, however, is…", use: "signal a disadvantage" }, { phrase: "This benefit is more significant because…", use: "make the required judgement" }, { phrase: "On balance,…", use: "state the overall evaluation" }],
    plan: ["Introduce the development and judgement", "Develop the strongest advantages", "Develop the key disadvantages", "Explain why one side outweighs the other"],
  },
  {
    id: "problem-solution", task: 2, number: 11, title: "Problem and solution essays", shortTitle: "Problem / solution", subtitle: "Explain causes and responses", focus: "Match each solution to a clearly explained problem or cause and show why the response would work.", icon: Wrench, minimumWords: 250, minutes: 40,
    prompt: "Many large cities face increasing traffic congestion. What are the main causes of this problem, and what measures could be taken to solve it?",
    promptDetail: "Give reasons for your answer and include any relevant examples from your own knowledge or experience.",
    vocabulary: { term: "alleviate", question: "What does it mean to “alleviate congestion”?", options: ["Make congestion less severe", "Measure congestion accurately", "Move congestion elsewhere"], answer: "Make congestion less severe", explanation: "Alleviate means to reduce the seriousness or intensity of a problem." },
    phrases: [{ phrase: "One underlying cause is…", use: "identify a root cause" }, { phrase: "This is compounded by…", use: "add another pressure" }, { phrase: "A practical response would be to…", use: "propose a solution" }, { phrase: "This would alleviate the problem by…", use: "explain effectiveness" }],
    plan: ["Introduce the problem and essay route", "Explain two connected causes", "Propose matched practical solutions", "Evaluate impact and conclude"],
  },
  {
    id: "two-part", task: 2, number: 12, title: "Two-part question essays", shortTitle: "Two-part questions", subtitle: "Answer both questions fully", focus: "Divide your planning time fairly and make sure neither direct question becomes an undeveloped afterthought.", icon: ListChecks, minimumWords: 250, minutes: 40,
    prompt: "In many countries, people are choosing to have children later in life. Why is this happening? Is this a positive or negative development?",
    promptDetail: "Give reasons for your answer and include any relevant examples from your own knowledge or experience.",
    vocabulary: { term: "development", question: "In this question, what does “development” mean?", options: ["A social trend or change", "A new building project", "A personal skill"], answer: "A social trend or change", explanation: "Here, development refers to the wider trend of people becoming parents later." },
    phrases: [{ phrase: "This trend can be attributed to…", use: "answer why it happens" }, { phrase: "A further contributing factor is…", use: "develop causes" }, { phrase: "I consider this largely positive because…", use: "answer the evaluation" }, { phrase: "The long-term effect is likely to be…", use: "develop consequences" }],
    plan: ["Introduce both questions and your view", "Answer why the trend occurs", "Evaluate the strongest positive or negative effects", "Balance briefly and conclude clearly"],
  },
];

const countWords = (text: string) => text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export function WritingClient({ userName, creatorLessons }: { userName: string; creatorLessons: StudentLessonContent[] }) {
  const courseLessons = useMemo(() => applyPublishedLessonOrder(lessons, creatorLessons), [creatorLessons]);
  const [filter, setFilter] = useState<TrackFilter>("all");
  const [activeId, setActiveId] = useState<LessonId>("line-graph");
  const [drafts, setDrafts] = useState<Partial<Record<LessonId, string>>>({});
  const [quizChoices, setQuizChoices] = useState<Partial<Record<LessonId, string>>>({});
  const [checkedQuizzes, setCheckedQuizzes] = useState<Partial<Record<LessonId, boolean>>>({});
  const [savedPhrases, setSavedPhrases] = useState<string[]>([]);
  const [timerRunning, setTimerRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [feedbackState, setFeedbackState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const [completed, setCompleted] = useState<LessonId[]>([]);

  const lesson = courseLessons.find((item) => item.id === activeId) ?? courseLessons[0];
  const creatorContent = creatorLessons.find((item) => item.lessonId === lesson.id && item.status === "published");
  const draft = drafts[lesson.id] ?? "";
  const wordCount = useMemo(() => countWords(draft), [draft]);
  const firstName = userName.split(/[\s@]/)[0] || "Student";

  useEffect(() => {
    if (!timerRunning) return;
    const timer = window.setInterval(() => setSeconds((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [timerRunning]);

  useEffect(() => {
    void loadLessonProgress("Writing").then((rows) => setCompleted(rows.map((row) => row.lessonId as LessonId)));
  }, []);

  const selectLesson = (id: LessonId) => {
    setActiveId(id);
    setTimerRunning(false);
    setSeconds(0);
    setFeedback(null);
    setFeedbackState("idle");
    setMessage("");
    window.setTimeout(() => document.getElementById("writing-studio")?.scrollIntoView({ behavior: "smooth", block: "start" }), 20);
  };

  const submitWriting = async () => {
    if (wordCount < 40) {
      setFeedbackState("error");
      setMessage("Write at least 40 words so Capi has enough language to assess.");
      return;
    }
    setFeedbackState("loading");
    setFeedback(null);
    setMessage("");
    const response = await fetch("/api/writing-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId: lesson.id, task: lesson.task, prompt: `${lesson.prompt}\n${lesson.promptDetail}`, essay: draft }),
    }).catch(() => null);
    const payload = response ? await response.json().catch(() => ({})) as FeedbackResponse : {};
    if (!response?.ok || !payload.feedback) {
      setFeedbackState("error");
      setMessage(payload.error ?? "Capi could not assess this draft. Please try again.");
      return;
    }
    setFeedback(payload.feedback);
    setCompleted((current) => current.includes(lesson.id) ? current : [...current, lesson.id]);
    setFeedbackState("idle");
  };

  const checkVocabulary = () => {
    const choice = quizChoices[lesson.id];
    if (!choice) return;
    const correct = choice === lesson.vocabulary.answer;
    setCheckedQuizzes((current) => ({ ...current, [lesson.id]: true }));
    setCompleted((current) => current.includes(lesson.id) ? current : [...current, lesson.id]);
    void saveLessonProgress({ module: "Writing", lessonId: lesson.id, lessonTitle: lesson.title, score: correct ? 100 : 0, correctCount: Number(correct), totalCount: 1 });
  };

  const togglePhrase = (phrase: string) => {
    const key = `${lesson.id}:${phrase}`;
    setSavedPhrases((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  };

  const criteria = feedback ? [
    { label: lesson.task === 1 ? "Task achievement" : "Task response", value: feedback.taskAchievement },
    { label: "Coherence & cohesion", value: feedback.coherence },
    { label: "Lexical resource", value: feedback.lexicalResource },
    { label: "Grammar", value: feedback.grammar },
  ] : [];

  const trackSections = [
    { task: 1 as const, label: "Academic Task 1", title: "Visual reports", description: "Seven ways visual information can be presented", meta: "20 min · 150+ words · one-third of Writing score" },
    { task: 2 as const, label: "Academic Task 2", title: "Essay arguments", description: "Five common ways the essay question can be framed", meta: "40 min · 250+ words · two-thirds of Writing score" },
  ];

  return (
    <main className="writing-shell">
      <header className="writing-header">
        <Link href="/dashboard"><ArrowLeft /> Dashboard</Link>
        <Link className="writing-brand" href="/"><img src="/capi-profile.png" alt="" /><span><b>IELTS</b> Mastery</span></Link>
        <span><PenLine /> 12 guided writing lessons</span>
      </header>

      <section className="writing-hero">
        <div className="writing-hero-copy">
          <span className="writing-kicker"><PenLine /> Academic Writing course</span>
          <h1>See the task clearly. <em>Build the answer calmly.</em></h1>
          <p>Move from visual reports to developed arguments with 12 focused video lessons, practical language tasks and private AI feedback.</p>
          <div className="writing-hero-facts"><span><Clock3 /><b>60 minutes</b><small>complete Writing test</small></span><span><Video /><b>12 videos</b><small>reserved and ready</small></span><span><Target /><b>4 criteria</b><small>practice feedback</small></span></div>
        </div>
        <div className="writing-hero-visual">
          <div className="hero-paper task1-paper"><small>TASK 1</small><BarChart3 /><i /><i /><i /></div>
          <div className="hero-paper task2-paper"><small>TASK 2</small><FileText /><i /><i /><i /><i /></div>
          <img src="/capi-plan.png" alt="Capi Coach planning a writing response" />
          <span><Sparkles /><b>Welcome, {firstName}</b><small>Choose one lesson and practise immediately.</small></span>
        </div>
      </section>

      <div className="writing-page">
        <section className="writing-track-summary" aria-label="Writing task comparison">
          <article className="task1"><span><BarChart3 /></span><div><small>TASK 1 · VISUAL INFORMATION</small><h2>Report what you see</h2><p>Select the main features, give a clear overview and compare data without adding opinions.</p></div><strong>7 lessons</strong></article>
          <article className="task2"><span><MessageSquareText /></span><div><small>TASK 2 · IDEAS AND ARGUMENTS</small><h2>Develop what you think</h2><p>Answer every part of the question, build a position and support it with relevant reasons and examples.</p></div><strong>5 lessons</strong></article>
        </section>

        <section className="writing-library">
          <header><div><span className="writing-section-label">VIDEO LIBRARY</span><h2>Your 12-lesson writing route</h2><p>Every lesson box is ready for your original video. Open a lesson to use its vocabulary, structure, phrases and writing practice.</p></div><div className="writing-filters" aria-label="Filter writing lessons">{(["all", "task1", "task2"] as TrackFilter[]).map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item === "all" ? "All 12" : item === "task1" ? "Task 1 · 7" : "Task 2 · 5"}</button>)}</div></header>

          {trackSections.filter((section) => filter === "all" || filter === `task${section.task}`).map((section) => <section className={`writing-track-section task${section.task}`} key={section.task}>
            <div className="writing-track-heading"><span><small>{section.label}</small><b>{section.title}</b></span><p>{section.description}</p><em>{section.meta}</em></div>
            <div className="writing-lesson-grid">
              {courseLessons.filter((item) => item.task === section.task).map((item) => {
                const Icon = item.icon;
                const active = item.id === lesson.id;
                const teacherVideoReady = Boolean(creatorLessons.find((content) => content.lessonId === item.id)?.videoUrl);
                return <button key={item.id} className={`writing-lesson-card ${active ? "active" : ""} ${completed.includes(item.id) ? "complete" : ""}`} onClick={() => selectLesson(item.id)} aria-label={`Open ${item.title} lesson`}>
                  <span className="writing-video-mini"><small><Video /> VIDEO {String(item.number).padStart(2, "0")}</small><Icon /><i>{teacherVideoReady ? "Ready to watch" : "Coming soon"}</i>{completed.includes(item.id) && <b><Check /> Practised</b>}</span>
                  <span className="writing-card-copy"><small>Task {item.task} · {item.minutes} min</small><b>{item.title}</b><p>{item.subtitle}</p></span><ChevronRight />
                </button>;
              })}
            </div>
          </section>)}
        </section>

        <section className={`writing-studio task${lesson.task}`} id="writing-studio">
          <header className="writing-studio-heading"><span><small>SELECTED LESSON</small><b>Task {lesson.task} · Video {String(lesson.number).padStart(2, "0")}</b></span><h2>{lesson.title}</h2><p>{lesson.focus}</p></header>

          <PublishedLessonVideo content={creatorContent} fallback={<div className="writing-video-large">
            <span className="future-video-label"><Video /> Your original video</span>
            <div><i><Video /></i><small>VIDEO PLACEHOLDER</small><h3>{lesson.shortTitle}: {lesson.subtitle}</h3><p>This lesson box is ready for your explanatory video when filming and editing are complete.</p><b><Clock3 /> Suggested lesson length: 8–12 minutes</b></div>
            <LessonVisual lesson={lesson} />
          </div>} />

          <PublishedLessonMaterials content={creatorContent} />

          <div className="writing-after-video"><span>AFTER THE VIDEO</span><i /><small>Vocabulary · structure · phrases · writing</small></div>

          <article className="writing-task-card writing-vocabulary">
            <header><i>1</i><span><small>Vocabulary check</small><h3>{lesson.vocabulary.term}</h3></span><BookOpen /></header>
            <p>{lesson.vocabulary.question}</p>
            <div>{lesson.vocabulary.options.map((option, index) => {
              const chosen = quizChoices[lesson.id] === option;
              const checked = checkedQuizzes[lesson.id];
              const correct = checked && option === lesson.vocabulary.answer;
              const wrong = checked && chosen && option !== lesson.vocabulary.answer;
              return <button key={option} className={`${chosen ? "chosen" : ""} ${correct ? "correct" : ""} ${wrong ? "wrong" : ""}`} onClick={() => { setQuizChoices((current) => ({ ...current, [lesson.id]: option })); setCheckedQuizzes((current) => ({ ...current, [lesson.id]: false })); }}><i>{correct ? <Check /> : String.fromCharCode(65 + index)}</i>{option}</button>;
            })}</div>
            <footer><button className="button writing-primary" disabled={!quizChoices[lesson.id]} onClick={checkVocabulary}>Check answer</button>{checkedQuizzes[lesson.id] && <p className={quizChoices[lesson.id] === lesson.vocabulary.answer ? "success" : "retry"}>{quizChoices[lesson.id] === lesson.vocabulary.answer ? <Check /> : <RotateCcw />}{quizChoices[lesson.id] === lesson.vocabulary.answer ? lesson.vocabulary.explanation : "Not quite — choose the meaning that best fits academic writing."}</p>}</footer>
          </article>

          <article className="writing-task-card writing-structure">
            <header><i>2</i><span><small>Answer structure</small><h3>Build a clear route before you write</h3></span><ListChecks /></header>
            <div className="writing-plan-steps">{lesson.plan.map((step, index) => <span key={step}><i>{index + 1}</i><b>{step}</b>{index < lesson.plan.length - 1 && <ArrowRight />}</span>)}</div>
          </article>

          <article className="writing-task-card writing-phrases">
            <header><i>3</i><span><small>Phrase builder</small><h3>Save flexible language moves</h3></span><Lightbulb /></header>
            <p>Choose phrases that fit your plan. Adapt them naturally instead of memorising a complete response.</p>
            <div>{lesson.phrases.map(({ phrase, use }) => {
              const selected = savedPhrases.includes(`${lesson.id}:${phrase}`);
              return <button key={phrase} className={selected ? "selected" : ""} onClick={() => togglePhrase(phrase)} aria-pressed={selected}><span><b>{phrase}</b><small>{use}</small></span><i>{selected ? <Check /> : "+"}</i></button>;
            })}</div>
          </article>

          <article className="writing-task-card writing-editor-card">
            <header><i>4</i><span><small>AI writing practice</small><h3>Write and get immediate feedback</h3></span><WandSparkles /></header>
            <div className="writing-prompt"><span><PenLine /></span><div><small>Academic Writing Task {lesson.task}</small><p>{lesson.prompt}</p><em>{lesson.promptDetail}</em></div></div>

            <div className="writing-editor-toolbar"><span><button onClick={() => setTimerRunning((running) => !running)}>{timerRunning ? <Pause /> : <Play fill="currentColor" />}{timerRunning ? "Pause" : seconds ? "Resume" : "Start timer"}</button><button onClick={() => { setTimerRunning(false); setSeconds(0); }}><RotateCcw /> Reset</button></span><strong><Clock3 /> {formatTime(seconds)} <small>of {lesson.minutes}:00</small></strong></div>
            <textarea value={draft} maxLength={20_000} onChange={(event) => { setDrafts((current) => ({ ...current, [lesson.id]: event.target.value })); setFeedback(null); setFeedbackState("idle"); setMessage(""); }} aria-label={`Write your ${lesson.title} response`} placeholder={lesson.task === 1 ? "Write your report here. Begin by paraphrasing the visual, then add a clear overview…" : "Write your essay here. Begin with a focused introduction and a clear position…"} />
            <div className="writing-count-row"><span className={wordCount >= lesson.minimumWords ? "complete" : ""}><b>{wordCount}</b> / {lesson.minimumWords} words</span><small>{wordCount < 40 ? `${40 - wordCount} more words to unlock AI feedback` : wordCount < lesson.minimumWords ? "Enough for feedback — continue toward the official minimum" : "Official minimum reached"}</small></div>

            {feedbackState === "error" && message && <p className="writing-error" role="alert"><CircleAlert />{message}</p>}
            <div className="writing-submit-row"><span><LockKeyhole /><small><b>Private progress</b>Your band estimate and coaching points are saved. Your essay text is not stored.</small></span><button className="button writing-primary" disabled={wordCount < 40 || feedbackState === "loading"} onClick={() => void submitWriting()}>{feedbackState === "loading" ? <><i className="writing-spinner" /> Capi is reading…</> : <>Get AI feedback <ArrowRight /></>}</button></div>

            {feedback && <section className="writing-feedback" aria-live="polite">
              <div className="writing-feedback-hero"><span><Sparkles /> Capi&apos;s practice feedback</span><div><small>Estimated band</small><strong>{feedback.overallBand.toFixed(1)}</strong><em>Practice only</em></div><p>{feedback.summary}</p></div>
              <div className="writing-feedback-criteria">{criteria.map((criterion) => <div key={criterion.label}><span><b>{criterion.label}</b><strong>{criterion.value.toFixed(1)}</strong></span><i><em style={{ width: `${Math.max(8, criterion.value / 9 * 100)}%` }} /></i></div>)}</div>
              <div className="writing-feedback-columns"><div className="strengths"><h4><Check /> What worked</h4>{feedback.strengths.map((item) => <p key={item}>{item}</p>)}</div><div className="priorities"><h4><Target /> Work on next</h4>{feedback.priorities.map((item) => <p key={item}>{item}</p>)}</div></div>
              <div className="writing-feedback-plan"><span><ListChecks /></span><div><small>A stronger answer plan</small>{feedback.improvedPlan.map((step, index) => <p key={step}><i>{index + 1}</i>{step}</p>)}</div></div>
              <div className="writing-feedback-excerpt"><span><WandSparkles /></span><div><small>Corrected example from your draft</small><p>{feedback.correctedExcerpt}</p></div></div>
              <div className="writing-feedback-phrases"><small>Useful phrases for your next draft</small>{feedback.usefulPhrases.map((phrase) => <span key={phrase}>{phrase}</span>)}</div>
              <p className="writing-feedback-disclaimer">Practice estimate only — not an official IELTS score. A shorter draft gives Capi less evidence than a complete timed response.</p>
            </section>}
          </article>
        </section>
      </div>
    </main>
  );
}

function LessonVisual({ lesson }: { lesson: WritingLesson }) {
  const Icon = lesson.icon;
  return <div className="writing-video-art" aria-hidden="true"><span><Icon /></span>{lesson.task === 1 ? <div className="visual-bars"><i /><i /><i /><i /><i /></div> : <div className="visual-lines"><i /><i /><i /><i /><i /></div>}</div>;
}
