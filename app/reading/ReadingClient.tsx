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
  GitBranch,
  Lightbulb,
  ListChecks,
  LockKeyhole,
  MapPin,
  Search,
  Sparkles,
  Table2,
  Target,
  Timer,
  Video,
  Workflow,
} from "lucide-react";

type FamilyId = "verify" | "match" | "complete";
type FilterId = "all" | FamilyId;
type LessonId =
  | "multiple-choice"
  | "true-false-ng"
  | "yes-no-ng"
  | "matching-information"
  | "matching-headings"
  | "matching-features"
  | "matching-endings"
  | "sentence-completion"
  | "summary-completion"
  | "note-completion"
  | "table-completion"
  | "flow-chart-completion"
  | "diagram-labelling"
  | "short-answer";

type ReadingLesson = {
  id: LessonId;
  family: FamilyId;
  number: number;
  title: string;
  shortTitle: string;
  subtitle: string;
  icon: typeof BookOpen;
  strategy: string[];
  trap: string;
  timing: string;
  sourceName: string;
  sourceTitle: string;
  sourceUrl: string;
  passageTitle: string;
  passage: Array<{ label: string; text: string }>;
  questionLabel: string;
  question: string;
  options: string[];
  answer: string;
  evidence: string;
  explanation: string;
};

const families: Array<{ id: FamilyId; title: string; label: string; description: string; range: string }> = [
  { id: "verify", title: "Verify meaning", label: "Strategy family 1", description: "Separate what the text says from what an option merely suggests.", range: "Tasks 1-4" },
  { id: "match", title: "Match structure", label: "Strategy family 2", description: "Follow paragraph purpose, people, categories and logical connections.", range: "Tasks 5-7" },
  { id: "complete", title: "Complete precisely", label: "Strategy family 3", description: "Predict the missing information and obey every word limit exactly.", range: "Tasks 8-14" },
];

const lessons: ReadingLesson[] = [
  {
    id: "multiple-choice", family: "verify", number: 1, title: "Multiple choice", shortTitle: "Multiple choice", subtitle: "Compare every option with evidence", icon: ListChecks,
    strategy: ["Read the question stem before the options.", "Predict the idea, then scan for its location.", "Reject options that are only partly supported."],
    trap: "Choosing an option because it repeats a word from the passage. IELTS tests meaning, not word matching.",
    timing: "About 75 seconds per question; move on and return if two options remain.",
    sourceName: "NASA", sourceTitle: "James Webb Space Telescope: Science Overview", sourceUrl: "https://science.nasa.gov/mission/webb/science-overview/",
    passageTitle: "A telescope built for hidden light",
    passage: [
      { label: "A", text: "The James Webb Space Telescope observes mainly infrared light. Its large mirror and cold instruments allow it to detect faint objects whose light has travelled across space for billions of years." },
      { label: "B", text: "Webb studies several stages of cosmic history, from the first luminous objects to the formation of stars and planetary systems. Infrared observations can also look through clouds of dust that block visible light." },
      { label: "C", text: "For some exoplanets, Webb separates incoming light into a spectrum. Patterns in that spectrum can reveal which gases are present in an atmosphere, helping researchers investigate distant worlds without travelling to them." },
    ],
    questionLabel: "Choose one answer",
    question: "Which capability allows Webb to investigate an exoplanet's atmosphere?",
    options: ["Analysing a spectrum of infrared light", "Collecting rock samples from its surface", "Measuring changes in ocean currents"],
    answer: "Analysing a spectrum of infrared light",
    evidence: "Paragraph C: patterns in a spectrum can reveal which gases are present in an atmosphere.",
    explanation: "The correct option paraphrases the process in paragraph C. The other two capabilities are not described.",
  },
  {
    id: "true-false-ng", family: "verify", number: 2, title: "True / False / Not Given", shortTitle: "True / False / NG", subtitle: "Test facts, not assumptions", icon: Search,
    strategy: ["Underline the exact claim in the statement.", "Find the matching part of the passage.", "Choose False only for a clear contradiction; otherwise use Not Given."],
    trap: "Using your own knowledge. Even a scientifically sensible statement is Not Given when the text does not address it.",
    timing: "Locate the evidence in order; these questions normally follow the passage sequence.",
    sourceName: "NOAA", sourceTitle: "Corals Tutorial", sourceUrl: "https://oceanservice.noaa.gov/education/tutorial_corals/welcome.html",
    passageTitle: "More than a colourful reef",
    passage: [
      { label: "A", text: "Coral reefs are built by colonies of small animals called polyps. Over long periods, their calcium carbonate skeletons create complex structures that provide shelter and feeding areas." },
      { label: "B", text: "Reefs support thousands of marine species, not only fish. Human communities also depend on healthy reefs for food, coastal protection, tourism and employment." },
      { label: "C", text: "Warming water can cause corals to lose the algae that provide much of their energy, a response known as bleaching. Pollution, disease and physical damage add further pressure." },
    ],
    questionLabel: "True, False or Not Given?",
    question: "Only fish depend on coral reefs for food and shelter.",
    options: ["True", "False", "Not Given"], answer: "False",
    evidence: "Paragraph B: reefs support thousands of marine species, not only fish.",
    explanation: "The word 'only' is directly contradicted by the passage, so the answer is False.",
  },
  {
    id: "yes-no-ng", family: "verify", number: 3, title: "Yes / No / Not Given", shortTitle: "Yes / No / NG", subtitle: "Track the writer's claims", icon: FileText,
    strategy: ["Identify the opinion or recommendation in the statement.", "Find the writer's position, not just the topic.", "Distinguish disagreement from missing information."],
    trap: "Treating a factual detail as the writer's view. Look for judgement, recommendation or evaluation.",
    timing: "Mark opinion words such as should, best, harmful and effective before scanning.",
    sourceName: "US EPA", sourceTitle: "Reduce Heat Islands", sourceUrl: "https://www.epa.gov/green-infrastructure/reduce-heat-islands",
    passageTitle: "Cooling a city with living infrastructure",
    passage: [
      { label: "A", text: "Roads, roofs and other urban surfaces absorb solar energy and release it as heat. As a result, built-up areas can be warmer than nearby places with more vegetation." },
      { label: "B", text: "Trees provide shade, while plants cool the air as water evaporates from their leaves. Green roofs and rain gardens can therefore contribute to a broader heat-reduction plan." },
      { label: "C", text: "Cities do not need to wait for entirely new districts. Vegetation and other green infrastructure can be considered during routine street improvements, roof replacement and neighbourhood redevelopment." },
    ],
    questionLabel: "Yes, No or Not Given?",
    question: "The writer believes green infrastructure should be used only in newly built districts.",
    options: ["Yes", "No", "Not Given"], answer: "No",
    evidence: "Paragraph C says cities can add it during routine improvements and redevelopment, not only in new districts.",
    explanation: "The statement contradicts the writer's position, so the answer is No.",
  },
  {
    id: "matching-information", family: "verify", number: 4, title: "Matching information", shortTitle: "Match information", subtitle: "Locate one specific detail", icon: MapPin,
    strategy: ["Name the information type: example, reason, date or description.", "Scan for unique nouns and their synonyms.", "Read the whole candidate paragraph before matching."],
    trap: "Stopping at the first shared keyword. One paragraph can contain the topic without containing the requested detail.",
    timing: "Use paragraph letters as a search map and cross out locations you have checked.",
    sourceName: "National Park Service", sourceTitle: "Wolves in Yellowstone", sourceUrl: "https://www.nps.gov/yell/learn/nature/wolf.htm",
    passageTitle: "Following Yellowstone's wolves",
    passage: [
      { label: "A", text: "Wolves were restored to Yellowstone in 1995 and 1996 after being absent for decades. Their return created a rare opportunity to study how a large predator functions in a protected ecosystem." },
      { label: "B", text: "A wolf pack is a social group that travels, hunts and raises young together. Pack size and territory can change as animals are born, disperse or die." },
      { label: "C", text: "Researchers observe wolves from the ground and air. Radio and GPS collars help teams identify individuals, follow movements and combine location data with direct observations of behaviour." },
    ],
    questionLabel: "Choose the paragraph",
    question: "Which paragraph describes technology used to monitor individual animals?",
    options: ["Paragraph A", "Paragraph B", "Paragraph C"], answer: "Paragraph C",
    evidence: "Paragraph C mentions radio and GPS collars used to identify and follow wolves.",
    explanation: "The requested information is a monitoring method, which appears only in paragraph C.",
  },
  {
    id: "matching-headings", family: "match", number: 5, title: "Matching headings", shortTitle: "Match headings", subtitle: "Match the main purpose, not a detail", icon: BookOpen,
    strategy: ["Read the first and last sentence, then skim the middle.", "Write a three-to-five-word summary of the paragraph.", "Match that summary to a heading through meaning and synonyms."],
    trap: "Selecting a heading because one memorable detail appears in the paragraph. A heading must cover the whole paragraph.",
    timing: "Spend no more than 90 seconds on a difficult match; use remaining headings later.",
    sourceName: "USGS", sourceTitle: "Ice, Snow, and Glaciers and the Water Cycle", sourceUrl: "https://www.usgs.gov/water-science-school/science/ice-snow-and-glaciers-and-water-cycle",
    passageTitle: "The work performed by frozen water",
    passage: [
      { label: "A", text: "Glaciers and ice caps store most of Earth's freshwater. Although the water is temporarily locked away, changes in this frozen reserve affect rivers and sea level." },
      { label: "B", text: "Bright snow and ice reflect a large share of sunlight. Seasonal snow cover also influences exchanges of heat and moisture between the ground and atmosphere, so frozen surfaces are connected to weather and climate." },
      { label: "C", text: "Many glaciers are becoming smaller. Scientists use field measurements and satellite observations to track changes in their area, thickness and movement over time." },
    ],
    questionLabel: "Choose the best heading for paragraph B",
    question: "Which heading captures the main idea of paragraph B?",
    options: ["A major store of freshwater", "Frozen surfaces and atmospheric patterns", "Modern methods for measuring glacier loss"],
    answer: "Frozen surfaces and atmospheric patterns",
    evidence: "Paragraph B connects reflected sunlight, heat and moisture exchange, weather and climate.",
    explanation: "The correct heading covers the paragraph's overall purpose. The other headings describe paragraphs A and C.",
  },
  {
    id: "matching-features", family: "match", number: 6, title: "Matching features", shortTitle: "Match features", subtitle: "Connect details to categories", icon: Target,
    strategy: ["Turn each feature into a distinct category.", "Mark every reference to that category in the passage.", "Check whether an option may be used more than once."],
    trap: "Matching by proximity. The nearest label is not necessarily the category responsible for the detail.",
    timing: "Create a quick letter-to-category key before answering.",
    sourceName: "NASA", sourceTitle: "Perseverance Science Objectives", sourceUrl: "https://science.nasa.gov/mission/mars-2020-perseverance/science-objectives/",
    passageTitle: "Four connected goals on Mars",
    passage: [
      { label: "A", text: "Perseverance examines rocks and landscapes to reconstruct the geology of its landing area. It also searches for signs that ancient environments could once have supported microbial life." },
      { label: "B", text: "A separate objective is astrobiology: looking for possible evidence of past life. The rover selects especially valuable rock and soil material and seals it in sample tubes." },
      { label: "C", text: "Those stored samples could be collected by a future campaign and brought to Earth for detailed study. The mission also tests technologies that may support later human exploration." },
    ],
    questionLabel: "Match the feature",
    question: "Which objective is associated with storing material for possible return to Earth?",
    options: ["Geology", "Sample caching", "Human exploration technology"], answer: "Sample caching",
    evidence: "Paragraphs B and C describe selecting, sealing and storing rock and soil samples for a possible future return.",
    explanation: "Sample caching is the category that directly includes storing selected material.",
  },
  {
    id: "matching-endings", family: "match", number: 7, title: "Matching sentence endings", shortTitle: "Sentence endings", subtitle: "Complete grammar and logic together", icon: GitBranch,
    strategy: ["Read the sentence beginning and predict its grammar.", "Find the relevant meaning in the passage.", "Test each ending for both sense and grammatical fit."],
    trap: "Choosing a grammatically smooth ending that the passage does not support.",
    timing: "Use grammar to remove impossible endings before searching for evidence.",
    sourceName: "USDA National Agricultural Library", sourceTitle: "Insects and Pollinators", sourceUrl: "https://www.nal.usda.gov/animal-health-and-welfare/insects-and-pollinators",
    passageTitle: "Small movements with a large effect",
    passage: [
      { label: "A", text: "Pollination occurs when pollen reaches the part of a flower where fertilisation can take place. Wind and water can move pollen, but many plants rely on animals." },
      { label: "B", text: "Bees, butterflies, moths, beetles, birds and bats may carry pollen as they visit flowers for food. This movement helps flowering plants produce seeds and fruit." },
      { label: "C", text: "Because many wild plants and crops depend on pollinators, suitable habitat matters. A range of flowering plants can provide food across different seasons." },
    ],
    questionLabel: "Choose the sentence ending",
    question: "Pollinators support the reproduction of flowering plants by...",
    options: ["moving pollen between flower structures", "preventing all insects from eating crops", "making every plant flower in the same season"],
    answer: "moving pollen between flower structures",
    evidence: "Paragraphs A and B explain that animals carry pollen and help plants produce seeds and fruit.",
    explanation: "The ending is supported by the passage and creates a grammatically complete sentence.",
  },
  {
    id: "sentence-completion", family: "complete", number: 8, title: "Sentence completion", shortTitle: "Complete sentences", subtitle: "Predict the missing word form", icon: FileText,
    strategy: ["Read the instruction and mark the word limit.", "Predict whether the gap needs a noun, verb or adjective.", "Copy the exact answer from the passage and check grammar."],
    trap: "Changing a word from the passage or exceeding the word limit, even when the meaning is correct.",
    timing: "Do the grammar prediction in five seconds before scanning.",
    sourceName: "NIH / NHLBI", sourceTitle: "How Sleep Works: Your Sleep/Wake Cycle", sourceUrl: "https://www.nhlbi.nih.gov/health/sleep/sleep-wake-cycle",
    passageTitle: "The clocks that guide sleep",
    passage: [
      { label: "A", text: "The body contains internal clocks that repeat on a cycle of roughly 24 hours. These circadian rhythms help determine when people feel awake and when they become sleepy." },
      { label: "B", text: "Light and darkness are powerful signals for this system. Light reaching the eyes helps synchronise the body's circadian clocks with the outside day." },
      { label: "C", text: "Age can change the timing of sleep. Teenagers often become sleepy later than younger children, while older adults may prefer earlier sleep and waking times." },
    ],
    questionLabel: "Complete with no more than two words",
    question: "Light and darkness help synchronise the body's ______.",
    options: ["circadian clocks", "younger children", "outside light"], answer: "circadian clocks",
    evidence: "Paragraph B uses the exact phrase 'synchronise the body's circadian clocks'.",
    explanation: "The two-word noun phrase fits the grammar and remains within the stated limit.",
  },
  {
    id: "summary-completion", family: "complete", number: 9, title: "Summary completion", shortTitle: "Complete a summary", subtitle: "Follow a compressed version of the text", icon: ListChecks,
    strategy: ["Read the whole summary to understand its sequence.", "Predict the idea and word form for each gap.", "Find the matching section and watch for paraphrases around the answer."],
    trap: "Searching for the exact words used in the summary. Surrounding ideas are usually paraphrased.",
    timing: "Complete easy gaps first; they reveal where the summary sits in the passage.",
    sourceName: "USGS", sourceTitle: "Earthquake Early Warning Overview", sourceUrl: "https://www.usgs.gov/programs/earthquake-hazards/science/earthquake-early-warning-overview",
    passageTitle: "Warning after an earthquake begins",
    passage: [
      { label: "A", text: "Earthquake early warning is not earthquake prediction. A warning system detects an earthquake that has already started and rapidly estimates its location and size." },
      { label: "B", text: "Sensors first detect the fast P-waves produced by the event. Electronic messages can travel faster than the later seismic waves that usually cause stronger shaking." },
      { label: "C", text: "The available warning may be only seconds, and places close to the epicentre may receive little or none. Even short notice can allow people and automated systems to take protective action." },
    ],
    questionLabel: "Complete the summary",
    question: "Unlike prediction, an early-warning system detects an earthquake after it has ______.",
    options: ["started", "been prevented", "reached every city"], answer: "started",
    evidence: "Paragraph A: the system detects an earthquake that has already started.",
    explanation: "The summary paraphrases the contrast between prediction and detection; 'started' completes it exactly.",
  },
  {
    id: "note-completion", family: "complete", number: 10, title: "Note completion", shortTitle: "Complete notes", subtitle: "Use headings to narrow the search", icon: BookOpen,
    strategy: ["Use the note heading to identify the passage section.", "Read labels and punctuation around the gap.", "Copy only the essential word or phrase requested."],
    trap: "Ignoring parallel structure. Items in the same note list usually share the same grammatical form.",
    timing: "Scan for the note category first, then read closely around each gap.",
    sourceName: "NOAA", sourceTitle: "Ocean Currents Tutorial", sourceUrl: "https://oceanservice.noaa.gov/education/tutorial_currents/welcome.html",
    passageTitle: "Why ocean water keeps moving",
    passage: [
      { label: "A", text: "Ocean currents are continuous movements of seawater. Tides create some currents, while wind drives much of the movement near the surface." },
      { label: "B", text: "Large-scale circulation also develops because seawater differs in density. Temperature and salinity both influence density, causing water masses to sink or rise." },
      { label: "C", text: "These currents redistribute heat, nutrients and organisms. They therefore connect distant parts of the ocean and influence weather and marine ecosystems." },
    ],
    questionLabel: "Complete the note with one word",
    question: "Deep circulation: driven by differences in temperature and ______.",
    options: ["salinity", "organisms", "weather"], answer: "salinity",
    evidence: "Paragraph B says temperature and salinity both influence seawater density.",
    explanation: "The gap is parallel with 'temperature', so it needs the noun 'salinity'.",
  },
  {
    id: "table-completion", family: "complete", number: 11, title: "Table completion", shortTitle: "Complete a table", subtitle: "Read rows and columns as coordinates", icon: Table2,
    strategy: ["Read the row and column headings together.", "Predict the information type: date, place, feature or number.", "Locate the corresponding comparison in the text."],
    trap: "Reading only across a row. The column heading may completely change what the gap is asking for.",
    timing: "Turn each cell into a short question before scanning the passage.",
    sourceName: "National Park Service", sourceTitle: "Archeology and Preserving America's Past", sourceUrl: "https://www.nps.gov/articles/000/archeology-and-preserving-americas-past.htm",
    passageTitle: "Early steps in protecting archaeological places",
    passage: [
      { label: "A", text: "During the late nineteenth century, growing public interest in ancient places led to calls for federal protection. Casa Grande in Arizona became the first archaeological reserve created by the United States in 1892." },
      { label: "B", text: "In 1906, the Antiquities Act gave presidents authority to protect significant natural, cultural and scientific features as national monuments." },
      { label: "C", text: "Mesa Verde National Park was also established in 1906 to preserve major Ancestral Pueblo sites. These actions helped shape a wider national system of cultural-resource protection." },
    ],
    questionLabel: "Complete the table with a year",
    question: "Casa Grande | first US archaeological reserve | ______",
    options: ["1892", "1906", "1916"], answer: "1892",
    evidence: "Paragraph A states that Casa Grande became the first US archaeological reserve in 1892.",
    explanation: "The row asks for the date connected specifically to Casa Grande, not the later legislation or park.",
  },
  {
    id: "flow-chart-completion", family: "complete", number: 12, title: "Flow-chart completion", shortTitle: "Complete a flow chart", subtitle: "Follow cause, stage and result", icon: Workflow,
    strategy: ["Identify the starting point and direction of the process.", "Predict what kind of stage is missing.", "Track sequence signals and copy the exact answer."],
    trap: "Jumping to a familiar process word before checking which stage comes immediately before and after the gap.",
    timing: "Trace the arrows aloud in a short sentence; the missing logic often becomes obvious.",
    sourceName: "US Department of Energy", sourceTitle: "Energy Storage", sourceUrl: "https://www.energy.gov/energy-storage",
    passageTitle: "Holding electricity until it is needed",
    passage: [
      { label: "A", text: "Electricity supply and demand do not always occur at the same moment. Solar panels may produce strongly around midday, while demand can peak later." },
      { label: "B", text: "Energy-storage systems can take in surplus electricity when generation is high. The stored energy can then be released when demand rises or renewable generation falls." },
      { label: "C", text: "Storage can support a more flexible electric grid. Different technologies operate at different scales, from batteries serving buildings to systems designed for the wider network." },
    ],
    questionLabel: "Complete the flow chart",
    question: "High renewable generation -> surplus electricity -> ______ -> electricity released when needed",
    options: ["energy-storage systems", "higher demand", "solar panels"], answer: "energy-storage systems",
    evidence: "Paragraph B says storage systems take in surplus electricity and release the stored energy later.",
    explanation: "The missing stage must receive surplus electricity before it can be released, so storage systems fit the process.",
  },
  {
    id: "diagram-labelling", family: "complete", number: 13, title: "Diagram label completion", shortTitle: "Label a diagram", subtitle: "Connect spatial language to a visual", icon: MapPin,
    strategy: ["Study the diagram title, labels and arrow direction.", "Predict the object or process named by the gap.", "Follow spatial words such as above, beneath, from and toward."],
    trap: "Reading the passage without first understanding what the arrow is pointing to.",
    timing: "Orient the diagram before scanning; ten seconds here prevents repeated rereading.",
    sourceName: "NOAA", sourceTitle: "Global Positioning Tutorial", sourceUrl: "https://oceanservice.noaa.gov/education/tutorial_geodesy/welcome.html",
    passageTitle: "Measuring a moving planet",
    passage: [
      { label: "A", text: "Geodesy is the science of measuring Earth's size and shape and the precise position of points on its surface. These measurements also show how positions change over time." },
      { label: "B", text: "The Global Positioning System uses signals from satellites. A receiver compares the arrival times of signals from several satellites to calculate its position." },
      { label: "C", text: "Accurate coordinates support navigation, mapping and communication. Repeated measurements can also help scientists observe movement of the ground." },
    ],
    questionLabel: "Label the diagram with no more than three words",
    question: "[ satellites ] -- signals --> [ ______ receiver ] -- calculation --> [ coordinates ]",
    options: ["Global Positioning System", "moving planet", "communication map"], answer: "Global Positioning System",
    evidence: "Paragraph B names the Global Positioning System as the satellite-based system used by a receiver.",
    explanation: "The label identifies the system supplying satellite signals and stays within the three-word limit.",
  },
  {
    id: "short-answer", family: "complete", number: 14, title: "Short-answer questions", shortTitle: "Short answer", subtitle: "Answer exactly what was asked", icon: Search,
    strategy: ["Circle the question word: what, where, when, who or how many.", "Predict the required information type.", "Copy the shortest complete answer within the word limit."],
    trap: "Adding explanation the question did not request. Extra words can break the limit or introduce an error.",
    timing: "Questions normally follow passage order, so continue scanning from the previous answer.",
    sourceName: "NASA", sourceTitle: "Exoplanet Exploration", sourceUrl: "https://science.nasa.gov/exoplanets/",
    passageTitle: "Worlds beyond our Sun",
    passage: [
      { label: "A", text: "Planets that orbit stars beyond our solar system are called exoplanets. Thousands have been confirmed, and researchers expect many more to be discovered." },
      { label: "B", text: "Some exoplanets are found when they pass in front of their star and cause a small drop in its brightness. Others are detected through the gravitational effect they have on a star." },
      { label: "C", text: "These worlds vary widely in size, temperature and orbit. Studying that diversity helps scientists test ideas about how planetary systems form and change." },
    ],
    questionLabel: "Answer with one word",
    question: "What are planets outside our solar system called?",
    options: ["Exoplanets", "Satellites", "Spectra"], answer: "Exoplanets",
    evidence: "Paragraph A defines planets orbiting stars beyond our solar system as exoplanets.",
    explanation: "The one-word answer responds directly and obeys the stated limit.",
  },
];

export function ReadingClient({ userName, creatorLessons }: { userName: string; creatorLessons: StudentLessonContent[] }) {
  const courseLessons = useMemo(() => applyPublishedLessonOrder(lessons, creatorLessons), [creatorLessons]);
  const [filter, setFilter] = useState<FilterId>("all");
  const [activeId, setActiveId] = useState<LessonId>("multiple-choice");
  const [choices, setChoices] = useState<Partial<Record<LessonId, string>>>({});
  const [checked, setChecked] = useState<Partial<Record<LessonId, boolean>>>({});
  const [evidenceOpen, setEvidenceOpen] = useState<Partial<Record<LessonId, boolean>>>({});
  const [completed, setCompleted] = useState<LessonId[]>([]);

  const lesson = courseLessons.find((item) => item.id === activeId) ?? courseLessons[0];
  const activeIndex = courseLessons.findIndex((item) => item.id === lesson.id);
  const creatorContent = creatorLessons.find((item) => item.lessonId === lesson.id && item.status === "published");
  const selected = choices[lesson.id];
  const isChecked = Boolean(checked[lesson.id]);
  const isCorrect = isChecked && selected === lesson.answer;
  const firstName = userName.split(/[\s@]/)[0] || "Student";
  const LessonIcon = lesson.icon;
  const visibleFamilies = useMemo(() => families.filter((family) => filter === "all" || family.id === filter), [filter]);

  useEffect(() => {
    void loadLessonProgress("Reading").then((rows) => setCompleted(rows.map((row) => row.lessonId as LessonId)));
  }, []);

  const selectLesson = (id: LessonId) => {
    setActiveId(id);
    window.setTimeout(() => document.getElementById("reading-studio")?.scrollIntoView({ behavior: "smooth", block: "start" }), 20);
  };

  const checkAnswer = () => {
    if (!selected) return;
    setChecked((current) => ({ ...current, [lesson.id]: true }));
    const correct = selected === lesson.answer;
    setCompleted((current) => current.includes(lesson.id) ? current : [...current, lesson.id]);
    void saveLessonProgress({ module: "Reading", lessonId: lesson.id, lessonTitle: lesson.title, score: correct ? 100 : 0, correctCount: Number(correct), totalCount: 1 });
  };

  const goNext = () => selectLesson(courseLessons[(activeIndex + 1) % courseLessons.length].id);

  return (
    <main className={`reading-shell ${lesson.family}`}>
      <header className="reading-header">
        <Link href="/dashboard"><ArrowLeft /> Dashboard</Link>
        <Link className="reading-brand" href="/"><img src="/capi-profile.png" alt="" /><span><b>IELTS</b> Mastery</span></Link>
        <span><LockKeyhole /> Private to {firstName}</span>
      </header>

      <section className="reading-hero">
        <div className="reading-hero-copy">
          <span className="reading-kicker"><Sparkles /> IELTS Academic Reading</span>
          <h1>Read for evidence.<em>Answer with precision.</em></h1>
          <p>Master all 14 official task types through one clear strategy at a time, then practise on original adaptations grounded in trustworthy, real-world sources.</p>
          <div className="reading-hero-facts">
            <span><Video /><b>14 lessons</b><small>one video space per task</small></span>
            <span><Clock3 /><b>60 minutes</b><small>three passages in the test</small></span>
            <span><BookOpen /><b>Authentic topics</b><small>every source is linked</small></span>
          </div>
        </div>
        <div className="reading-hero-visual">
          <div className="reading-hero-card card-one"><Search /><span><small>STEP 1</small><b>Find the claim</b></span></div>
          <div className="reading-hero-card card-two"><Target /><span><small>STEP 2</small><b>Verify evidence</b></span></div>
          <img src="/capi-official.png" alt="Capi Coach helping with a reading lesson" />
          <span><Check /><b>{completed.length} of 14 practised</b><small>Saved to your learning journey</small></span>
        </div>
      </section>

      <div className="reading-page">
        <section className="reading-family-summary" aria-label="Reading strategy families">
          {families.map((family) => <article className={family.id} key={family.id}><span>{family.id === "verify" ? <Search /> : family.id === "match" ? <GitBranch /> : <FileText />}</span><div><small>{family.label}</small><h2>{family.title}</h2><p>{family.description}</p></div><strong>{family.range}</strong></article>)}
        </section>

        <section className="reading-library">
          <header>
            <div><span className="reading-section-label">YOUR VIDEO LIBRARY</span><h2>One lesson for every task type</h2><p>The fourteen task types below follow the official IELTS Academic Reading format. Your own explanatory videos can replace each reserved space whenever they are ready.</p></div>
            <div className="reading-filters" aria-label="Filter lessons">
              {(["all", "verify", "match", "complete"] as FilterId[]).map((id) => <button key={id} className={filter === id ? "active" : ""} onClick={() => setFilter(id)}>{id === "all" ? "All 14" : families.find((family) => family.id === id)?.title}</button>)}
            </div>
          </header>

          {visibleFamilies.map((family) => {
            const familyLessons = courseLessons.filter((item) => item.family === family.id);
            return <section className={`reading-family-section ${family.id}`} key={family.id}>
              <div className="reading-family-heading"><span><small>{family.label}</small><b>{family.title}</b></span><p>{family.description}</p><em>{familyLessons.length} {familyLessons.length === 1 ? "lesson" : "lessons"}</em></div>
              <div className="reading-lesson-grid">
                {familyLessons.map((item) => { const Icon = item.icon; const teacherVideoReady = Boolean(creatorLessons.find((content) => content.lessonId === item.id)?.videoUrl); return <button key={item.id} onClick={() => selectLesson(item.id)} className={`reading-lesson-card ${activeId === item.id ? "active" : ""} ${completed.includes(item.id) ? "complete" : ""}`}>
                  <span className="reading-video-mini"><small><Video /> LESSON {String(item.number).padStart(2, "0")}</small><Icon /><i>{teacherVideoReady ? "Ready to watch" : "Video coming soon"}</i>{completed.includes(item.id) && <b><Check /> Practised</b>}</span>
                  <span className="reading-card-copy"><small>{family.title}</small><b>{item.shortTitle}</b><p>{item.subtitle}</p></span><ChevronRight />
                </button>; })}
              </div>
            </section>;
          })}
        </section>

        <section className={`reading-studio ${lesson.family}`} id="reading-studio">
          <header className="reading-studio-heading"><span><small>LESSON {String(lesson.number).padStart(2, "0")}</small><b>{families.find((family) => family.id === lesson.family)?.title}</b></span><h2>{lesson.title}</h2><p>{lesson.subtitle}. Learn the method, then apply it to a short source-based practice text.</p></header>

          <PublishedLessonVideo content={creatorContent} fallback={<div className="reading-video-large">
            <span className="reading-future-label"><Video /> Reserved for your original video</span>
            <div><i><Video /></i><small>EXPLANATORY VIDEO</small><h3>{lesson.title}: the evidence method</h3><p>Your future lesson can demonstrate the three steps below and work through an IELTS-style example.</p><b><Clock3 /> Suggested length: 6-10 minutes</b></div>
            <div className="reading-video-art"><LessonIcon /><span><i /><i /><i /><i /></span></div>
          </div>} />

          <PublishedLessonMaterials content={creatorContent} />

          <div className="reading-after-video"><span>AFTER THE VIDEO</span><i /><small>Learn the method, read the source-based text, then check your evidence.</small></div>

          <section className="reading-strategy-card">
            <header><span><Lightbulb /></span><div><small>CAPI&apos;S STRATEGY</small><h3>A three-step route to the answer</h3></div></header>
            <div className="reading-strategy-steps">{lesson.strategy.map((step, index) => <span key={step}><i>{index + 1}</i><b>{step}</b>{index < 2 && <ArrowRight />}</span>)}</div>
            <footer><p><CircleAlert /><span><small>TRAP TO AVOID</small>{lesson.trap}</span></p><p><Timer /><span><small>TIMING TIP</small>{lesson.timing}</span></p></footer>
          </section>

          <section className="reading-practice-card">
            <header><span><BookOpen /></span><div><small>SOURCE-BASED PRACTICE</small><h3>{lesson.passageTitle}</h3></div><a href={lesson.sourceUrl} target="_blank" rel="noreferrer">Adapted from {lesson.sourceName} <ExternalLink /></a></header>
            <div className="reading-source-note"><CircleAlert /><span><b>Original adaptation, authentic source</b>This practice passage was written by Capi from facts in <a href={lesson.sourceUrl} target="_blank" rel="noreferrer">{lesson.sourceTitle}</a>. It is not an official IELTS passage and does not reproduce the source verbatim.</span></div>
            <article className="reading-text">{lesson.passage.map((paragraph) => <p key={paragraph.label}><b>{paragraph.label}</b><span>{paragraph.text}</span></p>)}</article>

            <div className="reading-question">
              <span className="reading-question-label"><ListChecks /> {lesson.questionLabel}</span>
              <h4>{lesson.question}</h4>
              <div>{lesson.options.map((option, index) => {
                const chosen = selected === option;
                const optionCorrect = isChecked && option === lesson.answer;
                const optionWrong = isChecked && chosen && option !== lesson.answer;
                return <button key={option} disabled={isChecked} onClick={() => setChoices((current) => ({ ...current, [lesson.id]: option }))} className={`${chosen ? "chosen" : ""} ${optionCorrect ? "correct" : ""} ${optionWrong ? "wrong" : ""}`}><i>{optionCorrect ? <Check /> : String.fromCharCode(65 + index)}</i><span>{option}</span></button>;
              })}</div>
              <footer>
                <button className="button reading-primary" disabled={!selected || isChecked} onClick={checkAnswer}>Check answer <ArrowRight /></button>
                {isChecked && <p className={isCorrect ? "success" : "retry"}>{isCorrect ? <Check /> : <CircleAlert />}<span><b>{isCorrect ? "Correct - evidence first." : `The answer is ${lesson.answer}.`}</b>{lesson.explanation}</span></p>}
              </footer>
              {isChecked && <div className="reading-evidence"><button onClick={() => setEvidenceOpen((current) => ({ ...current, [lesson.id]: !current[lesson.id] }))}>{evidenceOpen[lesson.id] ? <EyeOff /> : <Eye />}{evidenceOpen[lesson.id] ? "Hide evidence" : "Show the evidence"}</button>{evidenceOpen[lesson.id] && <p><b>Evidence:</b> {lesson.evidence}</p>}</div>}
            </div>
          </section>

          <footer className="reading-next"><span><small>NEXT LESSON</small><b>{courseLessons[(activeIndex + 1) % courseLessons.length].title}</b></span><button className="button reading-primary" onClick={goNext}>Continue <ArrowRight /></button></footer>
        </section>

        <section className="reading-official-note"><img src="/capi-profile.png" alt="" /><div><small>COURSE NOTE</small><h2>Built around the official IELTS task format</h2><p>IELTS describes Academic Reading as three sections using texts selected from books, journals, magazines and newspapers. Use these shorter lessons to master the strategy, then build stamina with full-length timed practice.</p></div><a href="https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-reading" target="_blank" rel="noreferrer">View the official format <ExternalLink /></a></section>
      </div>
    </main>
  );
}
