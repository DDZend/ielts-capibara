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
  BookOpen,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Headphones,
  Lightbulb,
  ListChecks,
  LockKeyhole,
  Map,
  Mic2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Target,
  Users,
  Video,
  Volume2,
} from "lucide-react";

type PartId = "part1" | "part2" | "part3" | "part4";
type FilterId = "all" | PartId;
type LessonId =
  | "form-completion"
  | "spelling-numbers"
  | "conversation-multiple-choice"
  | "map-labelling"
  | "matching-features"
  | "short-answer"
  | "matching-speakers"
  | "attitude-multiple-choice"
  | "sentence-completion"
  | "lecture-notes"
  | "table-flowchart"
  | "summary-completion";

type Accent = "gb" | "us" | "au" | "nz";
type Question = {
  prompt: string;
  type: "choice" | "text";
  options?: string[];
  answer: string;
  accepted?: string[];
  explanation: string;
};
type Lesson = {
  id: LessonId;
  part: PartId;
  number: number;
  title: string;
  shortTitle: string;
  subtitle: string;
  icon: typeof Headphones;
  context: string;
  speakers: string;
  accents: string;
  targetDuration: string;
  strategy: string[];
  trap: string;
  videoFocus: string;
  segments: Array<{ speaker: string; accent: Accent; text: string }>;
  questions: Question[];
  source?: { name: string; url: string };
};

const parts: Array<{ id: PartId; title: string; label: string; description: string; format: string }> = [
  { id: "part1", title: "Everyday conversation", label: "Part 1", description: "Two speakers exchange practical details in a familiar social situation.", format: "2 speakers" },
  { id: "part2", title: "Everyday monologue", label: "Part 2", description: "One speaker gives information, directions or a public announcement.", format: "1 speaker" },
  { id: "part3", title: "Academic discussion", label: "Part 3", description: "Students and a tutor compare ideas, plans and opinions.", format: "2-4 speakers" },
  { id: "part4", title: "Academic lecture", label: "Part 4", description: "One speaker develops an academic topic using clear signposting.", format: "1 speaker" },
];

const lessons: Lesson[] = [
  {
    id: "form-completion", part: "part1", number: 1, title: "Form completion", shortTitle: "Complete a form", subtitle: "Catch names, times, prices and practical details", icon: FileText,
    context: "A phone call about a photography course", speakers: "2 speakers", accents: "British + North American", targetDuration: "2.5-3 min",
    strategy: ["Preview each field and predict the answer type.", "Listen for corrections before writing the final detail.", "Check spelling, plurals and the word limit."],
    trap: "Writing the first number you hear. A speaker may correct or replace it a moment later.",
    videoFocus: "Show students how form labels predict whether the answer will be a name, date, number or noun.",
    segments: [
      { speaker: "Maya", accent: "gb", text: "Northbridge Arts Centre, Maya speaking. How can I help?" },
      { speaker: "Daniel", accent: "us", text: "I'd like to join the beginners' photography course on Saturdays. Could you tell me when it starts?" },
      { speaker: "Maya", accent: "gb", text: "Certainly. The first class begins at nine thirty, not nine as the old leaflet says. It runs for four Saturdays and costs forty-eight pounds, including the workbook." },
      { speaker: "Daniel", accent: "us", text: "Great. Do I need my own camera?" },
      { speaker: "Maya", accent: "gb", text: "You can borrow one here, but please bring a memory card so you can take your photographs home." },
    ],
    questions: [
      { prompt: "Course starting time:", type: "text", answer: "9:30", accepted: ["9:30", "9.30", "nine thirty"], explanation: "Maya corrects the old leaflet and gives 9:30 as the current time." },
      { prompt: "Course fee: £", type: "text", answer: "48", accepted: ["48", "forty eight", "forty-eight"], explanation: "The £48 fee includes the workbook." },
      { prompt: "Students should bring a:", type: "text", answer: "memory card", explanation: "Cameras are available, but students need their own memory card." },
    ],
  },
  {
    id: "spelling-numbers", part: "part1", number: 2, title: "Spelling, numbers and corrections", shortTitle: "Names & numbers", subtitle: "Hold accuracy while details change", icon: Mic2,
    context: "Changing a train reservation", speakers: "2 speakers", accents: "British + Australian", targetDuration: "2.5-3 min",
    strategy: ["Write digits while listening, then format them later.", "Expect surnames to be spelled or clarified.", "Circle the corrected detail, not the abandoned one."],
    trap: "Keeping an earlier time or platform after the speaker says actually, sorry or rather.",
    videoFocus: "Demonstrate how self-correction language signals that the next detail replaces the previous one.",
    segments: [
      { speaker: "Clerk", accent: "gb", text: "Your original train left at eleven fifty, but the replacement service departs at eleven fifteen." },
      { speaker: "Passenger", accent: "au", text: "Eleven fifteen, understood. The booking is under Sam Reed." },
      { speaker: "Clerk", accent: "gb", text: "Is that R E E D?" },
      { speaker: "Passenger", accent: "au", text: "No, it's R E I D. And does it still leave from platform four?" },
      { speaker: "Clerk", accent: "gb", text: "It was platform four, but it has just changed to platform six. Your seat remains eighteen in coach B." },
    ],
    questions: [
      { prompt: "New departure time:", type: "text", answer: "11:15", accepted: ["11:15", "11.15", "eleven fifteen"], explanation: "11:50 is the original time; the replacement train leaves at 11:15." },
      { prompt: "Passenger's surname:", type: "text", answer: "REID", explanation: "The passenger rejects R-E-E-D and spells R-E-I-D." },
      { prompt: "New platform:", type: "text", answer: "6", accepted: ["6", "six"], explanation: "Platform four is a distractor; the final platform is six." },
    ],
  },
  {
    id: "conversation-multiple-choice", part: "part1", number: 3, title: "Multiple choice in conversations", shortTitle: "Final decisions", subtitle: "Follow the choice that survives the discussion", icon: ListChecks,
    context: "Choosing an evening class", speakers: "2 speakers", accents: "North American + British", targetDuration: "3 min",
    strategy: ["Underline how the options differ before listening.", "Mark each option as mentioned, rejected or chosen.", "Wait for the speaker's final decision."],
    trap: "Selecting an option simply because it receives the longest discussion.",
    videoFocus: "Explain why all options may be mentioned and how the final choice is often paraphrased.",
    segments: [
      { speaker: "Leah", accent: "us", text: "I planned to take Spanish, but the evening group is full. The daytime class clashes with work." },
      { speaker: "Owen", accent: "gb", text: "What about digital photography? You said you liked the weekend course." },
      { speaker: "Leah", accent: "us", text: "I do, but I'd have to buy equipment. Pottery is on Thursday at six fifteen and all the materials are included, so I'll take that instead." },
      { speaker: "Owen", accent: "gb", text: "Good choice. Does it begin on the seventh of September?" },
      { speaker: "Leah", accent: "us", text: "The website said the seventh, but my confirmation says the fourteenth." },
    ],
    questions: [
      { prompt: "Which class does Leah finally choose?", type: "choice", options: ["Spanish", "Digital photography", "Pottery"], answer: "Pottery", explanation: "Spanish is full and photography requires equipment; she chooses pottery." },
      { prompt: "Why does she reject digital photography?", type: "choice", options: ["It is too early", "She would need equipment", "The teacher changed"], answer: "She would need equipment", explanation: "Equipment cost is the reason given in the conversation." },
      { prompt: "When does the course begin?", type: "choice", options: ["7 September", "14 September", "Thursday 6:15"], answer: "14 September", explanation: "The website date is corrected by the confirmation message." },
    ],
  },
  {
    id: "map-labelling", part: "part2", number: 4, title: "Map and plan labelling", shortTitle: "Follow a map", subtitle: "Turn directions into movement", icon: Map,
    context: "An orientation talk at a local museum", speakers: "1 speaker", accents: "British", targetDuration: "3-4 min",
    strategy: ["Find the starting point and face the correct direction.", "Move your finger with every direction phrase.", "Use landmarks to recover if you lose the route."],
    trap: "Jumping ahead on the map after hearing a location name instead of following the route from the start.",
    videoFocus: "Teach orientation language: opposite, beyond, immediately left, at the far end and beside.",
    segments: [
      { speaker: "Guide", accent: "gb", text: "You are now at the south entrance. The ticket desk is directly ahead, in the centre of the hall." },
      { speaker: "Guide", accent: "gb", text: "If you need refreshments, the cafe is immediately to your left, beside the cloakroom." },
      { speaker: "Guide", accent: "gb", text: "For Gallery B, walk past the central stairs and take the first doorway on your right." },
      { speaker: "Guide", accent: "gb", text: "Today's family workshop is in the education room at the far northern end, opposite the sculpture court." },
    ],
    questions: [
      { prompt: "Where is the cafe?", type: "choice", options: ["Left of the entrance", "Behind Gallery B", "North of the sculpture court"], answer: "Left of the entrance", explanation: "The guide says it is immediately left of the south entrance." },
      { prompt: "Which landmark comes before Gallery B?", type: "choice", options: ["The cloakroom", "The central stairs", "The education room"], answer: "The central stairs", explanation: "Visitors walk past the central stairs before turning right." },
      { prompt: "What is opposite the education room?", type: "choice", options: ["The sculpture court", "The ticket desk", "The cafe"], answer: "The sculpture court", explanation: "The education room and sculpture court face each other." },
    ],
  },
  {
    id: "matching-features", part: "part2", number: 5, title: "Matching places and features", shortTitle: "Match facilities", subtitle: "Separate similar locations by their unique detail", icon: Target,
    context: "A community-centre announcement", speakers: "1 speaker", accents: "New Zealand", targetDuration: "3-4 min",
    strategy: ["Convert the option list into a quick keyword map.", "Listen for synonyms rather than exact option wording.", "Cross out each feature only when the instructions require it."],
    trap: "Matching a place to the first activity mentioned nearby, even when that activity belongs elsewhere.",
    videoFocus: "Show how speakers group several locations and then distinguish each one with a single feature.",
    segments: [
      { speaker: "Coordinator", accent: "nz", text: "Three buildings are open for Community Saturday. The sports hall hosts yoga in the morning, followed by indoor climbing." },
      { speaker: "Coordinator", accent: "nz", text: "The library will not run its usual book sale. Instead, volunteers are offering career advice at a desk near the entrance." },
      { speaker: "Coordinator", accent: "nz", text: "Families should visit the public garden, where children can join a free workshop on planting herbs." },
      { speaker: "Coordinator", accent: "nz", text: "Refreshments are available at all three locations, so you need not return to the main square." },
    ],
    questions: [
      { prompt: "Sports hall", type: "choice", options: ["Career advice", "Yoga and climbing", "Children's gardening"], answer: "Yoga and climbing", explanation: "Both physical activities take place in the sports hall." },
      { prompt: "Library", type: "choice", options: ["Career advice", "Yoga and climbing", "Children's gardening"], answer: "Career advice", explanation: "The usual sale is cancelled and replaced with career advice." },
      { prompt: "Public garden", type: "choice", options: ["Career advice", "Yoga and climbing", "Children's gardening"], answer: "Children's gardening", explanation: "The herb-planting workshop is for children." },
    ],
  },
  {
    id: "short-answer", part: "part2", number: 6, title: "Short-answer questions", shortTitle: "Short answers", subtitle: "Capture the smallest complete answer", icon: BookOpen,
    context: "Instructions for a guided nature walk", speakers: "1 speaker", accents: "Australian", targetDuration: "3-4 min",
    strategy: ["Circle the question word and the word limit.", "Predict whether you need a place, object or number.", "Write the shortest complete phrase from the recording."],
    trap: "Adding unnecessary words that break the limit or introduce a spelling error.",
    videoFocus: "Demonstrate how to reduce a full sentence to a precise one- or two-word answer.",
    segments: [
      { speaker: "Ranger", accent: "au", text: "Tomorrow's nature walk begins outside the visitor centre, not at the car park as previously advertised." },
      { speaker: "Ranger", accent: "au", text: "Walking boots are recommended, and everyone must bring a waterproof jacket because the weather changes quickly." },
      { speaker: "Ranger", accent: "au", text: "The route follows the forest trail and ends beside the lake, where the bus will collect us." },
      { speaker: "Ranger", accent: "au", text: "The complete walk takes about two and a half hours, including a short break at the viewpoint." },
    ],
    questions: [
      { prompt: "Where does the walk begin? No more than two words.", type: "text", answer: "visitor centre", accepted: ["visitor centre", "visitor center"], explanation: "The car park is corrected; the meeting point is the visitor centre." },
      { prompt: "What must each person bring? No more than two words.", type: "text", answer: "waterproof jacket", explanation: "Boots are only recommended, but the jacket is compulsory." },
      { prompt: "Where does the route finish? One word.", type: "text", answer: "lake", accepted: ["lake", "the lake"], explanation: "The walk ends beside the lake." },
    ],
  },
  {
    id: "matching-speakers", part: "part3", number: 7, title: "Matching speakers to opinions", shortTitle: "Who thinks what?", subtitle: "Track voices, positions and changes of mind", icon: Users,
    context: "Students planning a research project", speakers: "3 speakers", accents: "British + Australian + North American", targetDuration: "4-5 min",
    strategy: ["Give every speaker a short label in your notes.", "Record opinions, not every supporting detail.", "Update a label when a speaker changes position."],
    trap: "Assigning an idea to the person who repeats it rather than the person who originally supports it.",
    videoFocus: "Model a three-column note system for speakers, proposals and final positions.",
    segments: [
      { speaker: "Lena", accent: "gb", text: "I think an online survey would give us the largest number of responses." },
      { speaker: "Josh", accent: "au", text: "Perhaps, but interviews would explain why people behave as they do. I'd rather collect fewer, deeper answers." },
      { speaker: "Tutor", accent: "us", text: "Both methods could work, but test your questions first. A small pilot may reveal wording that participants misunderstand." },
      { speaker: "Lena", accent: "gb", text: "In that case, let's pilot the survey and add five interviews if the answers need more explanation." },
    ],
    questions: [
      { prompt: "Who initially supports a large online sample?", type: "choice", options: ["Lena", "Josh", "The tutor"], answer: "Lena", explanation: "Lena values the larger number of survey responses." },
      { prompt: "Who prefers detailed individual responses?", type: "choice", options: ["Lena", "Josh", "The tutor"], answer: "Josh", explanation: "Josh argues that interviews reveal reasons." },
      { prompt: "Who recommends testing the questions first?", type: "choice", options: ["Lena", "Josh", "The tutor"], answer: "The tutor", explanation: "The pilot is the tutor's recommendation." },
    ],
  },
  {
    id: "attitude-multiple-choice", part: "part3", number: 8, title: "Attitude and agreement", shortTitle: "Attitude & agreement", subtitle: "Hear confidence, doubt and polite disagreement", icon: ListChecks,
    context: "Choosing a group-presentation topic", speakers: "2 speakers", accents: "North American + British", targetDuration: "4 min",
    strategy: ["Listen beyond the factual words to evaluative language.", "Notice soft disagreement such as I'm not sure that would work.", "Confirm the final shared decision."],
    trap: "Treating a polite response such as that's interesting as genuine agreement.",
    videoFocus: "Contrast neutral information with language showing enthusiasm, hesitation and compromise.",
    segments: [
      { speaker: "Mina", accent: "us", text: "We could present on recycling, although the topic feels rather broad." },
      { speaker: "Alex", accent: "gb", text: "I agree. Local transport would give us more specific data, and the council has published a new survey." },
      { speaker: "Mina", accent: "us", text: "That sounds more manageable. I wasn't keen on giving another slide presentation, though." },
      { speaker: "Alex", accent: "gb", text: "Nor was I. What if we create an infographic and explain it together?" },
      { speaker: "Mina", accent: "us", text: "Perfect. It will make the comparisons much clearer." },
    ],
    questions: [
      { prompt: "How does Mina feel about the recycling topic?", type: "choice", options: ["It is too broad", "It lacks published data", "It is very original"], answer: "It is too broad", explanation: "Her phrase 'rather broad' signals concern about scope." },
      { prompt: "Why does Alex prefer local transport?", type: "choice", options: ["It requires no research", "Specific data are available", "The tutor selected it"], answer: "Specific data are available", explanation: "He refers to the council's new survey." },
      { prompt: "What presentation format do they choose?", type: "choice", options: ["Slides", "A formal debate", "An infographic"], answer: "An infographic", explanation: "Both reject another slide presentation and agree on an infographic." },
    ],
  },
  {
    id: "sentence-completion", part: "part3", number: 9, title: "Sentence completion", shortTitle: "Complete sentences", subtitle: "Match paraphrased prompts to exact details", icon: FileText,
    context: "A tutor reviewing an assignment plan", speakers: "2 speakers", accents: "British + New Zealand", targetDuration: "4 min",
    strategy: ["Predict the grammar required by each gap.", "Use nearby words to locate the matching idea.", "Copy only the words needed to complete the sentence."],
    trap: "Hearing the right idea but writing a form that does not fit the sentence grammatically.",
    videoFocus: "Teach students to predict nouns, verbs and numbers before the recording begins.",
    segments: [
      { speaker: "Tutor", accent: "gb", text: "Your topic is clear, but I need the revised proposal by Friday, not next Monday." },
      { speaker: "Noah", accent: "nz", text: "I'll send it on Friday. How much reading should I include at this stage?" },
      { speaker: "Tutor", accent: "gb", text: "Review six journal articles and compare their methods. You don't need to evaluate the results yet." },
      { speaker: "Noah", accent: "nz", text: "And should I email the interview questions to the group?" },
      { speaker: "Tutor", accent: "gb", text: "Put them in the shared folder so everyone can comment on the same version." },
    ],
    questions: [
      { prompt: "The revised proposal must be submitted by ______.", type: "text", answer: "Friday", explanation: "Monday is corrected; Friday is the final deadline." },
      { prompt: "Noah should review ______ journal articles.", type: "text", answer: "six", accepted: ["six", "6"], explanation: "The tutor specifies six articles." },
      { prompt: "The interview questions should be placed in the ______.", type: "text", answer: "shared folder", explanation: "The tutor prefers one shared version rather than email copies." },
    ],
  },
  {
    id: "lecture-notes", part: "part4", number: 10, title: "Academic note completion", shortTitle: "Lecture notes", subtitle: "Use signposts to organise a monologue", icon: BookOpen,
    context: "A short lecture about sleep timing", speakers: "1 speaker", accents: "North American", targetDuration: "4-5 min",
    strategy: ["Read note headings as a map of the lecture.", "Listen for signposts introducing causes and examples.", "Keep answers parallel in grammar and length."],
    trap: "Trying to write full sentences and missing the next answer while still taking notes.",
    videoFocus: "Demonstrate a compact note-taking system using arrows, abbreviations and section headings.",
    source: { name: "NIH / NHLBI sleep-wake cycle", url: "https://www.nhlbi.nih.gov/health/sleep/sleep-wake-cycle" },
    segments: [
      { speaker: "Lecturer", accent: "us", text: "Today we'll consider circadian rhythms, the internal patterns that repeat approximately every twenty-four hours." },
      { speaker: "Lecturer", accent: "us", text: "The strongest environmental signal is light. Morning light helps align the body's clock with the external day, while darkness supports the transition toward sleep." },
      { speaker: "Lecturer", accent: "us", text: "Age also affects timing. Teenagers commonly become sleepy later than younger children, whereas many older adults prefer earlier sleep and waking times." },
      { speaker: "Lecturer", accent: "us", text: "Behaviour matters too. Caffeine late in the day may delay sleep even when the surrounding room is dark." },
    ],
    questions: [
      { prompt: "Circadian patterns repeat about every ______.", type: "text", answer: "24 hours", accepted: ["24 hours", "twenty four hours", "twenty-four hours"], explanation: "The lecture defines the cycle as approximately 24 hours." },
      { prompt: "The strongest environmental signal is ______.", type: "text", answer: "light", explanation: "Morning light is the main external synchronising signal described." },
      { prompt: "Teenagers often become sleepy ______ than younger children.", type: "text", answer: "later", explanation: "The comparison in the lecture is 'later than'." },
    ],
  },
  {
    id: "table-flowchart", part: "part4", number: 11, title: "Table and flow-chart completion", shortTitle: "Tables & flow charts", subtitle: "Track categories and stages without losing sequence", icon: Target,
    context: "A mini-lecture about ocean circulation", speakers: "1 speaker", accents: "Australian", targetDuration: "4-5 min",
    strategy: ["Read rows, columns and arrows before listening.", "Predict whether each gap is a cause, stage or result.", "Follow sequence language and parallel categories."],
    trap: "Completing a gap with a correct topic word that belongs to a different row or stage.",
    videoFocus: "Show students how visual structure reduces the amount of language they need to hold in memory.",
    source: { name: "NOAA Ocean Currents Tutorial", url: "https://oceanservice.noaa.gov/education/tutorial_currents/welcome.html" },
    segments: [
      { speaker: "Lecturer", accent: "au", text: "Ocean water moves for several reasons. Near the surface, wind transfers energy to the water and helps drive broad surface currents." },
      { speaker: "Lecturer", accent: "au", text: "Deep circulation depends more strongly on density. Temperature affects density, and so does salinity, the amount of dissolved salt in the water." },
      { speaker: "Lecturer", accent: "au", text: "Colder or saltier water may sink, while less dense water rises elsewhere. Together these movements connect distant ocean regions." },
      { speaker: "Lecturer", accent: "au", text: "The circulation redistributes heat as well as nutrients and organisms, influencing both climate and marine ecosystems." },
    ],
    questions: [
      { prompt: "Surface currents: mainly driven by ______.", type: "text", answer: "wind", explanation: "Wind is identified as the main surface driver." },
      { prompt: "Water density depends on temperature and ______.", type: "text", answer: "salinity", explanation: "Salinity is defined as dissolved salt in the water." },
      { prompt: "Circulation redistributes nutrients and ______.", type: "text", answer: "heat", explanation: "Heat is the other major item redistributed by currents." },
    ],
  },
  {
    id: "summary-completion", part: "part4", number: 12, title: "Summary completion", shortTitle: "Complete a summary", subtitle: "Recognise compressed ideas and academic paraphrase", icon: FileText,
    context: "A short astronomy lecture", speakers: "1 speaker", accents: "British", targetDuration: "4-5 min",
    strategy: ["Read the summary for its overall logic.", "Predict the word class and likely meaning of each gap.", "Listen for paraphrases around the exact answer word."],
    trap: "Waiting to hear the summary wording exactly; the recording usually expresses the same idea differently.",
    videoFocus: "Model how to connect a compressed written summary to a longer spoken explanation.",
    source: { name: "NASA Webb Science Overview", url: "https://science.nasa.gov/mission/webb/science-overview/" },
    segments: [
      { speaker: "Lecturer", accent: "gb", text: "The James Webb Space Telescope observes primarily in infrared light, allowing it to detect objects that are faint or extremely distant." },
      { speaker: "Lecturer", accent: "gb", text: "Infrared observations can also look through clouds of dust that hide developing stars from visible-light telescopes." },
      { speaker: "Lecturer", accent: "gb", text: "For selected exoplanets, Webb separates incoming light into a spectrum. Patterns in that spectrum may reveal gases in a planet's atmosphere." },
      { speaker: "Lecturer", accent: "gb", text: "These capabilities let researchers investigate early galaxies, star formation and distant planetary systems with the same observatory." },
    ],
    questions: [
      { prompt: "Webb mainly detects ______ light.", type: "text", answer: "infrared", explanation: "Infrared is the primary range described in the opening sentence." },
      { prompt: "This light can pass through clouds of ______.", type: "text", answer: "dust", explanation: "Dust obscures developing stars in visible light." },
      { prompt: "A spectrum may identify atmospheric ______.", type: "text", answer: "gases", accepted: ["gases", "gas"], explanation: "Patterns in a spectrum can reveal gases in an exoplanet atmosphere." },
    ],
  },
];

const normalise = (value: string) => value.trim().toLowerCase().replace(/[£$,]/g, "").replace(/[.]+$/, "").replace(/\s+/g, " ");

export function ListeningClient({ userName, creatorLessons }: { userName: string; creatorLessons: StudentLessonContent[] }) {
  const courseLessons = useMemo(() => applyPublishedLessonOrder(lessons, creatorLessons), [creatorLessons]);
  const [filter, setFilter] = useState<FilterId>("all");
  const [activeId, setActiveId] = useState<LessonId>("form-completion");
  const [mode, setMode] = useState<"exam" | "study">("exam");
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [activeSegment, setActiveSegment] = useState(-1);
  const [played, setPlayed] = useState<Partial<Record<LessonId, boolean>>>({});
  const [answers, setAnswers] = useState<Partial<Record<LessonId, Record<number, string>>>>({});
  const [submitted, setSubmitted] = useState<Partial<Record<LessonId, boolean>>>({});
  const [transcriptOpen, setTranscriptOpen] = useState<Partial<Record<LessonId, boolean>>>({});
  const [completed, setCompleted] = useState<LessonId[]>([]);

  const lesson = courseLessons.find((item) => item.id === activeId) ?? courseLessons[0];
  const activeIndex = courseLessons.findIndex((item) => item.id === lesson.id);
  const creatorContent = creatorLessons.find((item) => item.lessonId === lesson.id && item.status === "published");
  const lessonAnswers = answers[lesson.id] ?? {};
  const hasSubmitted = Boolean(submitted[lesson.id]);
  const firstName = userName.split(/[\s@]/)[0] || "Student";
  const visibleParts = useMemo(() => parts.filter((part) => filter === "all" || part.id === filter), [filter]);
  const score = lesson.questions.reduce((total, question, index) => {
    const accepted = question.accepted ?? [question.answer];
    return total + Number(accepted.some((answer) => normalise(answer) === normalise(lessonAnswers[index] ?? "")));
  }, 0);
  const allAnswered = lesson.questions.every((_, index) => Boolean((lessonAnswers[index] ?? "").trim()));

  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  useEffect(() => {
    void loadLessonProgress("Listening").then((rows) => setCompleted(rows.map((row) => row.lessonId as LessonId)));
  }, []);

  const stopAudio = () => {
    window.speechSynthesis?.cancel();
    setPlaying(false);
    setActiveSegment(-1);
  };

  const selectLesson = (id: LessonId) => {
    stopAudio();
    setActiveId(id);
    setMode("exam");
    setSpeed(1);
    window.setTimeout(() => document.getElementById("listening-studio")?.scrollIntoView({ behavior: "smooth", block: "start" }), 20);
  };

  const pickVoice = (accent: Accent, speakerIndex: number) => {
    const voices = window.speechSynthesis.getVoices();
    const language = { gb: "en-gb", us: "en-us", au: "en-au", nz: "en-nz" }[accent];
    const exact = voices.filter((voice) => voice.lang.toLowerCase().startsWith(language));
    const english = voices.filter((voice) => voice.lang.toLowerCase().startsWith("en"));
    const pool = exact.length ? exact : english;
    return pool.length ? pool[speakerIndex % pool.length] : undefined;
  };

  const playAudio = () => {
    if (!("speechSynthesis" in window) || (mode === "exam" && played[lesson.id])) return;
    stopAudio();
    setPlaying(true);
    setPlayed((current) => ({ ...current, [lesson.id]: true }));
    const speakers = [...new Set(lesson.segments.map((segment) => segment.speaker))];
    lesson.segments.forEach((segment, index) => {
      const utterance = new SpeechSynthesisUtterance(segment.text);
      utterance.voice = pickVoice(segment.accent, speakers.indexOf(segment.speaker)) ?? null;
      utterance.rate = mode === "study" ? speed : 1;
      utterance.pitch = speakers.indexOf(segment.speaker) % 2 ? 1.04 : 0.96;
      utterance.onstart = () => setActiveSegment(index);
      if (index === lesson.segments.length - 1) utterance.onend = () => { setPlaying(false); setActiveSegment(-1); };
      window.speechSynthesis.speak(utterance);
    });
  };

  const submit = () => {
    if (!allAnswered) return;
    setSubmitted((current) => ({ ...current, [lesson.id]: true }));
    setCompleted((current) => current.includes(lesson.id) ? current : [...current, lesson.id]);
    void saveLessonProgress({ module: "Listening", lessonId: lesson.id, lessonTitle: lesson.title, score: score / lesson.questions.length * 100, correctCount: score, totalCount: lesson.questions.length });
  };

  const retry = () => {
    setSubmitted((current) => ({ ...current, [lesson.id]: false }));
    setAnswers((current) => ({ ...current, [lesson.id]: {} }));
    setTranscriptOpen((current) => ({ ...current, [lesson.id]: false }));
    setMode("study");
  };

  const goNext = () => selectLesson(courseLessons[(activeIndex + 1) % courseLessons.length].id);

  return (
    <main className={`listening-shell ${lesson.part}`}>
      <header className="listening-header">
        <Link href="/dashboard"><ArrowLeft /> Dashboard</Link>
        <Link className="listening-brand" href="/"><img src="/capi-profile.png" alt="" /><span><b>IELTS</b> Mastery</span></Link>
        <span><LockKeyhole /> Private to {firstName}</span>
      </header>

      <section className="listening-hero">
        <div className="listening-hero-copy">
          <span className="listening-kicker"><Sparkles /> IELTS Listening</span>
          <h1>Listen once.<em>Catch what matters.</em></h1>
          <p>Master all four listening situations through focused strategy videos, exam-mode audio and evidence-based review.</p>
          <div className="listening-hero-facts">
            <span><Video /><b>12 lessons</b><small>three for every part</small></span>
            <span><Headphones /><b>4 situations</b><small>social to academic</small></span>
            <span><ListChecks /><b>36 questions</b><small>instant answer review</small></span>
          </div>
        </div>
        <div className="listening-hero-visual">
          <span className="sound-ring ring-one" /><span className="sound-ring ring-two" /><span className="sound-ring ring-three" />
          <img src="/capi-headset.png" alt="Capi Coach wearing a listening headset" />
          <div className="listening-now-card"><Headphones /><span><small>YOUR PROGRESS</small><b>{completed.length} of 12 practised</b></span></div>
        </div>
      </section>

      <div className="listening-page">
        <section className="listening-part-summary" aria-label="Listening test parts">
          {parts.map((part) => <article className={part.id} key={part.id}><span>{part.id === "part3" ? <Users /> : part.id === "part4" ? <BookOpen /> : <Headphones />}</span><div><small>{part.label}</small><h2>{part.title}</h2><p>{part.description}</p></div><strong>{part.format}</strong></article>)}
        </section>

        <section className="listening-library">
          <header><div><span className="listening-section-label">YOUR LISTENING LIBRARY</span><h2>Twelve focused video lessons</h2><p>Each lesson has a reserved space for your explanatory video, a production-ready recording brief and an interactive audio task.</p></div><div className="listening-filters" aria-label="Filter lessons">{(["all", "part1", "part2", "part3", "part4"] as FilterId[]).map((id) => <button key={id} className={filter === id ? "active" : ""} onClick={() => setFilter(id)}>{id === "all" ? "All 12" : parts.find((part) => part.id === id)?.label}</button>)}</div></header>
          {visibleParts.map((part) => { const partLessons = courseLessons.filter((item) => item.part === part.id); return <section className={`listening-part-section ${part.id}`} key={part.id}>
            <div className="listening-part-heading"><span><small>{part.label}</small><b>{part.title}</b></span><p>{part.description}</p><em>3 lessons</em></div>
            <div className="listening-lesson-grid">{partLessons.map((item) => { const Icon = item.icon; const teacherVideoReady = Boolean(creatorLessons.find((content) => content.lessonId === item.id)?.videoUrl); return <button key={item.id} onClick={() => selectLesson(item.id)} className={`listening-lesson-card ${activeId === item.id ? "active" : ""} ${completed.includes(item.id) ? "complete" : ""}`}><span className="listening-video-mini"><small><Video /> LESSON {String(item.number).padStart(2, "0")}</small><Icon /><i>{teacherVideoReady ? "Ready to watch" : "Video coming soon"}</i>{completed.includes(item.id) && <b><Check /> Practised</b>}</span><span className="listening-card-copy"><small>{part.label}</small><b>{item.shortTitle}</b><p>{item.subtitle}</p></span><ChevronRight /></button>; })}</div>
          </section>; })}
        </section>

        <section className={`listening-studio ${lesson.part}`} id="listening-studio">
          <header className="listening-studio-heading"><span><small>LESSON {String(lesson.number).padStart(2, "0")}</small><b>{parts.find((part) => part.id === lesson.part)?.label}</b></span><h2>{lesson.title}</h2><p>{lesson.subtitle}. Watch the strategy lesson, then practise in exam mode before opening the evidence.</p></header>

          <PublishedLessonVideo content={creatorContent} fallback={<div className="listening-video-large">
            <span className="listening-future-label"><Video /> Reserved for your original video</span>
            <div><i><Video /></i><small>EXPLANATORY VIDEO</small><h3>{lesson.title}: hear the signal</h3><p>{lesson.videoFocus}</p><b><Clock3 /> Suggested video: 6-9 minutes</b></div>
            <div className="listening-video-art"><Headphones /><span>{[1,2,3,4,5,6,7,8,9,10,11].map((bar) => <i key={bar} />)}</span></div>
          </div>} />

          <PublishedLessonMaterials content={creatorContent} />

          <div className="listening-after-video"><span>AFTER THE VIDEO</span><i /><small>Predict, listen once, answer, then replay the evidence.</small></div>

          <section className="listening-strategy-card">
            <header><span><Lightbulb /></span><div><small>CAPI&apos;S STRATEGY</small><h3>A three-step listening route</h3></div></header>
            <div className="listening-strategy-steps">{lesson.strategy.map((step, index) => <span key={step}><i>{index + 1}</i><b>{step}</b>{index < 2 && <ArrowRight />}</span>)}</div>
            <footer><CircleAlert /><span><small>TRAP TO AVOID</small>{lesson.trap}</span></footer>
          </section>

          <section className="listening-practice-card">
            <header><span><Headphones /></span><div><small>GUIDED AUDIO PRACTICE</small><h3>{lesson.context}</h3></div>{lesson.source && <a href={lesson.source.url} target="_blank" rel="noreferrer">Facts adapted from {lesson.source.name} <ExternalLink /></a>}</header>
            {!creatorContent?.audioUrl && <><div className="listening-production-note"><Mic2 /><div><small>ORIGINAL RECORDING SLOT</small><b>{lesson.speakers} · {lesson.accents} · target {lesson.targetDuration}</b><p>The playable narration below is a temporary device-voice demo. Replace it with your human-recorded WAV or MP3 without changing the lesson.</p></div></div>

            <div className={`listening-player ${playing ? "playing" : ""}`}>
              <div className="listening-mode-switch"><button className={mode === "exam" ? "active" : ""} onClick={() => { stopAudio(); setMode("exam"); }}><Target /> Exam mode</button><button className={mode === "study" ? "active" : ""} onClick={() => { stopAudio(); setMode("study"); }}><BookOpen /> Study mode</button></div>
              <div className="listening-player-main">
                <button className="listening-play" onClick={playing ? stopAudio : playAudio} disabled={!playing && mode === "exam" && Boolean(played[lesson.id])} aria-label={playing ? "Stop audio" : "Play audio"}>{playing ? <Pause /> : <Play fill="currentColor" />}</button>
                <div><small>{mode === "exam" ? "ONE PLAY ONLY" : "REPLAY ENABLED"}</small><b>{playing ? `Listening: ${lesson.segments[Math.max(0, activeSegment)]?.speaker}` : mode === "exam" && played[lesson.id] ? "Exam play completed" : "Ready to listen"}</b><span>{lesson.context}</span></div>
                <div className="listening-wave" aria-hidden="true">{[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20].map((bar) => <i key={bar} />)}</div>
              </div>
              <footer><span><Volume2 /> {mode === "exam" ? "Pausing and replay are disabled after starting." : "Replay and speed controls are available."}</span>{mode === "study" && <div>{[0.85,1,1.15].map((rate) => <button key={rate} onClick={() => setSpeed(rate)} className={speed === rate ? "active" : ""}>{rate}x</button>)}</div>}</footer>
            </div></>}

            <div className="listening-questions">
              <header><span><ListChecks /> QUESTIONS 1-3</span><p>Answer every question before checking.</p></header>
              {lesson.questions.map((question, index) => {
                const value = lessonAnswers[index] ?? "";
                const accepted = question.accepted ?? [question.answer];
                const correct = accepted.some((answer) => normalise(answer) === normalise(value));
                return <article key={question.prompt} className={hasSubmitted ? correct ? "correct" : "wrong" : ""}><span>{index + 1}</span><div><b>{question.prompt}</b>{question.type === "choice" ? <div className="listening-options">{question.options?.map((option) => <button key={option} disabled={hasSubmitted} className={value === option ? "chosen" : ""} onClick={() => setAnswers((current) => ({ ...current, [lesson.id]: { ...(current[lesson.id] ?? {}), [index]: option } }))}><i>{value === option ? <Check /> : null}</i>{option}</button>)}</div> : <input disabled={hasSubmitted} value={value} onChange={(event) => setAnswers((current) => ({ ...current, [lesson.id]: { ...(current[lesson.id] ?? {}), [index]: event.target.value } }))} placeholder="Type your answer" aria-label={`Answer question ${index + 1}`} />}{hasSubmitted && <p><b>{correct ? "Correct." : `Answer: ${question.answer}.`}</b> {question.explanation}</p>}</div></article>;
              })}
              <footer>{!hasSubmitted ? <button className="button listening-primary" disabled={!allAnswered} onClick={submit}>Check my answers <ArrowRight /></button> : <><span className={`listening-score ${score === 3 ? "perfect" : ""}`}><b>{score}/3</b><small>{score === 3 ? "Excellent evidence tracking" : "Review the evidence, then retry"}</small></span><button className="button listening-soft" onClick={retry}><RotateCcw /> Retry in study mode</button></>}</footer>
            </div>

            {hasSubmitted && <div className="listening-transcript"><button onClick={() => setTranscriptOpen((current) => ({ ...current, [lesson.id]: !current[lesson.id] }))}>{transcriptOpen[lesson.id] ? <EyeOff /> : <Eye />}{transcriptOpen[lesson.id] ? "Hide transcript" : "Reveal transcript and replay evidence"}</button>{transcriptOpen[lesson.id] && <div><span><CircleAlert /> Use the transcript only after your first attempt. Notice corrections, signposts and paraphrases.</span>{lesson.segments.map((segment, index) => <p key={`${segment.speaker}-${index}`}><b>{segment.speaker}</b>{segment.text}</p>)}</div>}</div>}
          </section>

          <footer className="listening-next"><span><small>NEXT LESSON</small><b>{courseLessons[(activeIndex + 1) % courseLessons.length].title}</b></span><button className="button listening-primary" onClick={goNext}>Continue <ArrowRight /></button></footer>
        </section>

        <section className="listening-course-note"><img src="/capi-profile.png" alt="" /><div><small>RECORDING ROADMAP</small><h2>Your human audio can replace every demo cleanly</h2><p>Keep a WAV master, export an MP3 for the lesson, and preserve the answer order and transcript wording. Use real speakers for the final course rather than asking one person to imitate several accents.</p></div><a href="https://ielts.org/organisations/ielts-for-organisations/test-types/ielts-academic-test/academic-test-format-in-detail" target="_blank" rel="noreferrer">Official format <ExternalLink /></a></section>
      </div>
    </main>
  );
}
