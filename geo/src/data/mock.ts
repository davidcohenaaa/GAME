export type SourceId = "aio" | "chatgpt" | "gemini" | "claude";

export const SOURCES: { id: SourceId; name: string }[] = [
  { id: "aio", name: "Google AI Overview" },
  { id: "chatgpt", name: "ChatGPT" },
  { id: "gemini", name: "Gemini" },
  { id: "claude", name: "Claude" },
];

export const MY_BRAND = "פספורטכארד";

export const DOMAINS = [
  { id: "all", name: "כל התחומים" },
  { id: "travel", name: "ביטוח נסיעות" },
  { id: "pricing", name: "מחירים" },
  { id: "service", name: "שירות" },
  { id: "health", name: "בריאות" },
];

export type Question = {
  id: string;
  text: string;
  mentioned: boolean;
  position: number | null;
  hasLink: boolean;
};

export type Topic = {
  id: string;
  name: string;
  domainId: string;
  appearanceRate: number;
  avgPosition: number;
  questions: Question[];
};

export const TOPICS: Topic[] = [
  {
    id: "t1",
    name: "ביטוח נסיעות לחו״ל",
    domainId: "travel",
    appearanceRate: 68,
    avgPosition: 2.4,
    questions: [
      { id: "q1", text: "מה ביטוח הנסיעות הטוב ביותר לחו״ל?", mentioned: true, position: 2, hasLink: true },
      { id: "q2", text: "האם כדאי ביטוח נסיעות עם כרטיס אשראי?", mentioned: true, position: 4, hasLink: false },
      { id: "q3", text: "ביטוח נסיעות לארה״ב – מה חשוב לבדוק?", mentioned: false, position: null, hasLink: false },
      { id: "q4", text: "ביטוח נסיעות למשפחה עם ילדים", mentioned: true, position: 1, hasLink: true },
    ],
  },
  {
    id: "t2",
    name: "מחירי ביטוח נסיעות",
    domainId: "pricing",
    appearanceRate: 54,
    avgPosition: 3.1,
    questions: [
      { id: "q5", text: "כמה עולה ביטוח נסיעות לשבועיים באירופה?", mentioned: true, position: 3, hasLink: true },
      { id: "q6", text: "מה משפיע על מחיר ביטוח נסיעות?", mentioned: true, position: 3, hasLink: false },
      { id: "q7", text: "ביטוח נסיעות זול – איך משווים?", mentioned: false, position: null, hasLink: false },
    ],
  },
  {
    id: "t3",
    name: "שירות ותביעות",
    domainId: "service",
    appearanceRate: 41,
    avgPosition: 4.2,
    questions: [
      { id: "q8", text: "איך מגישים תביעה בביטוח נסיעות?", mentioned: true, position: 4, hasLink: true },
      { id: "q9", text: "כמה זמן לוקח לקבל החזר מביטוח נסיעות?", mentioned: false, position: null, hasLink: false },
    ],
  },
  {
    id: "t4",
    name: "בריאות ומצב רפואי קיים",
    domainId: "health",
    appearanceRate: 37,
    avgPosition: 4.8,
    questions: [
      { id: "q10", text: "ביטוח נסיעות עם מצב רפואי קיים – מה מכוסה?", mentioned: true, position: 5, hasLink: false },
      { id: "q11", text: "האם ביטוח נסיעות מכסה הריון?", mentioned: true, position: 4, hasLink: true },
      { id: "q12", text: "כיסוי ספורט אתגרי בביטוח נסיעות", mentioned: false, position: null, hasLink: false },
    ],
  },
];

export const KPIS = {
  topics: TOPICS.length,
  questions: TOPICS.reduce((s, t) => s + t.questions.length, 0),
  avgMentions: 62,
  avgPosition: 3.2,
};

export const POSITION_TREND = [
  { month: "ינואר", position: 5.1 },
  { month: "פברואר", position: 4.7 },
  { month: "מרץ", position: 4.4 },
  { month: "אפריל", position: 3.9 },
  { month: "מאי", position: 3.6 },
  { month: "יוני", position: 3.4 },
  { month: "יולי", position: 3.2 },
];

export const DOMAIN_BREAKDOWN = [
  { domain: "ביטוח נסיעות", rate: 68 },
  { domain: "מחירים", rate: 54 },
  { domain: "שירות", rate: 41 },
  { domain: "בריאות", rate: 37 },
];

export type BrandRow = {
  brand: string;
  isMine: boolean;
  avgPosition: number;
  mentionRate: number;
  linkRate: number;
  url: string;
};

export const RANKING: Record<string, BrandRow[]> = {
  all: [
    { brand: "הראל ביטוח", isMine: false, avgPosition: 1.6, mentionRate: 81, linkRate: 64, url: "https://harel-group.co.il/travel" },
    { brand: "איי.אי.ג׳י", isMine: false, avgPosition: 2.3, mentionRate: 74, linkRate: 55, url: "https://aig.co.il/travel" },
    { brand: MY_BRAND, isMine: true, avgPosition: 3.2, mentionRate: 62, linkRate: 43, url: "https://mysite.co.il/travel-insurance" },
    { brand: "כלל ביטוח", isMine: false, avgPosition: 3.9, mentionRate: 51, linkRate: 38, url: "https://clal.co.il/travel" },
    { brand: "דיווי ביטוח", isMine: false, avgPosition: 4.6, mentionRate: 44, linkRate: 29, url: "https://davidshield.co.il" },
  ],
  travel: [
    { brand: "הראל ביטוח", isMine: false, avgPosition: 1.4, mentionRate: 86, linkRate: 70, url: "https://harel-group.co.il/travel" },
    { brand: MY_BRAND, isMine: true, avgPosition: 2.4, mentionRate: 68, linkRate: 52, url: "https://mysite.co.il/travel-insurance" },
    { brand: "איי.אי.ג׳י", isMine: false, avgPosition: 2.8, mentionRate: 66, linkRate: 48, url: "https://aig.co.il/travel" },
    { brand: "כלל ביטוח", isMine: false, avgPosition: 4.1, mentionRate: 47, linkRate: 31, url: "https://clal.co.il/travel" },
  ],
  pricing: [
    { brand: "איי.אי.ג׳י", isMine: false, avgPosition: 2.0, mentionRate: 72, linkRate: 51, url: "https://aig.co.il/prices" },
    { brand: "הראל ביטוח", isMine: false, avgPosition: 2.6, mentionRate: 69, linkRate: 49, url: "https://harel-group.co.il/prices" },
    { brand: MY_BRAND, isMine: true, avgPosition: 3.1, mentionRate: 54, linkRate: 40, url: "https://mysite.co.il/prices" },
    { brand: "דיווי ביטוח", isMine: false, avgPosition: 4.4, mentionRate: 38, linkRate: 22, url: "https://davidshield.co.il/prices" },
  ],
  service: [
    { brand: "הראל ביטוח", isMine: false, avgPosition: 2.1, mentionRate: 70, linkRate: 55, url: "https://harel-group.co.il/claims" },
    { brand: "כלל ביטוח", isMine: false, avgPosition: 3.3, mentionRate: 58, linkRate: 41, url: "https://clal.co.il/claims" },
    { brand: MY_BRAND, isMine: true, avgPosition: 4.2, mentionRate: 41, linkRate: 27, url: "https://mysite.co.il/claims" },
  ],
  health: [
    { brand: "הראל ביטוח", isMine: false, avgPosition: 1.9, mentionRate: 75, linkRate: 60, url: "https://harel-group.co.il/health" },
    { brand: "איי.אי.ג׳י", isMine: false, avgPosition: 3.0, mentionRate: 61, linkRate: 44, url: "https://aig.co.il/health" },
    { brand: MY_BRAND, isMine: true, avgPosition: 4.8, mentionRate: 37, linkRate: 21, url: "https://mysite.co.il/health-coverage" },
  ],
};

export const COMPARE_CRITERIA = [
  { label: "כיסוי הנושא", mine: 62, rival: 88, note: "לעמוד של המתחרה יש כיסוי רחב יותר של תת-נושאים (ילדים, מבוגרים, ספורט)." },
  { label: "שאלות נפוצות", mine: 40, rival: 92, note: "למתחרה יש מקטע FAQ עם 14 שאלות בשפה טבעית; לעמוד שלך אין FAQ." },
  { label: "מבנה כותרות", mine: 55, rival: 84, note: "היררכיית H2/H3 ברורה אצל המתחרה, אצלך רוב התוכן בפסקאות רצות." },
  { label: "עומק תוכן", mine: 58, rival: 80, note: "1,150 מילים מול 2,600 מילים אצל המתחרה." },
  { label: "עדכניות", mine: 45, rival: 90, note: "העמוד של המתחרה עודכן לפני 12 יום, שלך לפני 9 חודשים." },
  { label: "קישורים ומקורות", mine: 50, rival: 78, note: "המתחרה מפנה למקורות רגולטוריים ולמדריכים פנימיים." },
  { label: "התאמה לשאילתה", mine: 61, rival: 87, note: "הכותרת של המתחרה תואמת מילה במילה לניסוח השאלה הנפוצה." },
];

export const ACTIONS = [
  "הוסף מקטע שאלות ותשובות עם 10-14 שאלות בניסוח טבעי כפי שגולשים שואלים.",
  "פצל את התוכן לכותרות H2/H3 לפי תת-נושאים: משפחה, מבוגרים, מצב רפואי קיים, ספורט.",
  "הוסף טבלת השוואת כיסויים עם מספרים מדויקים – מודלי AI מצטטים נתונים מובנים.",
  "עדכן את תאריך העדכון ורענן דוגמאות מחיר לשנה הנוכחית.",
  "הוסף קישורים פנימיים מהעמוד למדריכים ולעמודי התביעות שלך.",
  "התאם את כותרת העמוד לניסוח השאלה: ״מה ביטוח הנסיעות הטוב ביותר לחו״ל?״",
];

export type AnswerResult = {
  id: string;
  question: string;
  topic: string;
  summary: Record<"all" | SourceId, string>;
  mentioned: boolean;
  position: number;
  hasLink: boolean;
  ranking: { brand: string; isMine: boolean; hasLink: boolean; sources: SourceId[] }[];
};

export const ANSWERS: AnswerResult[] = [
  {
    id: "q1",
    question: "מה ביטוח הנסיעות הטוב ביותר לחו״ל?",
    topic: "ביטוח נסיעות לחו״ל",
    mentioned: true,
    position: 2,
    hasLink: true,
    summary: {
      all: "התשובה המשוקללת מ-4 מקורות מציגה את הראל כמובילה, ואחריה פספורטכארד בזכות מודל התשלום ללא השתתפות עצמית וכרטיס רפואי. מוזכרים גם איי.אי.ג׳י וכלל, בעיקר בהקשר של מחיר וכיסוי בסיסי. שלושה מתוך ארבעה מקורות מקשרים לעמוד המוצר של הראל, ושניים מקשרים לעמוד שלך.",
      aio: "Google AI Overview מציג רשימת ספקים לפי היקף כיסוי: הראל, פספורטכארד, איי.אי.ג׳י. מקשר לעמודי המוצר של שלושתם.",
      chatgpt: "ChatGPT ממליץ להשוות לפי סוג הנסיעה, ומזכיר את פספורטכארד ראשונה בזכות הכרטיס הרפואי, ואת הראל אחריה.",
      gemini: "Gemini מדגיש את הראל ואת איי.אי.ג׳י כמובילות ומזכיר את פספורטכארד במקום השלישי, ללא קישור.",
      claude: "Claude נותן סקירה מאוזנת של ארבעה ספקים ומדגיש שהבחירה תלויה במצב רפואי קיים ובמשך הנסיעה.",
    },
    ranking: [
      { brand: "הראל ביטוח", isMine: false, hasLink: true, sources: ["aio", "gemini", "claude"] },
      { brand: MY_BRAND, isMine: true, hasLink: true, sources: ["aio", "chatgpt"] },
      { brand: "איי.אי.ג׳י", isMine: false, hasLink: true, sources: ["aio", "gemini", "claude"] },
      { brand: "כלל ביטוח", isMine: false, hasLink: false, sources: ["claude"] },
    ],
  },
  {
    id: "q5",
    question: "כמה עולה ביטוח נסיעות לשבועיים באירופה?",
    topic: "מחירי ביטוח נסיעות",
    mentioned: true,
    position: 3,
    hasLink: true,
    summary: {
      all: "רוב המקורות נותנים טווח מחירים של 90-260 ש״ח לשבועיים באירופה למבוגר צעיר, ומצטטים בעיקר את איי.אי.ג׳י והראל כדוגמאות מחיר. פספורטכארד מוזכרת במקום השלישי בהקשר של מודל תשלום שונה.",
      aio: "Google AI Overview מציג טבלת טווחי מחיר עם דוגמאות מאיי.אי.ג׳י ומהראל.",
      chatgpt: "ChatGPT מסביר את מרכיבי המחיר ומזכיר את פספורטכארד כחלופה ללא השתתפות עצמית.",
      gemini: "Gemini מציין טווח של 100-240 ש״ח ומקשר לשני משווי מחירים.",
      claude: "Claude מפרט גורמי מחיר: גיל, מצב רפואי, ספורט אתגרי ומשך הנסיעה.",
    },
    ranking: [
      { brand: "איי.אי.ג׳י", isMine: false, hasLink: true, sources: ["aio", "gemini"] },
      { brand: "הראל ביטוח", isMine: false, hasLink: true, sources: ["aio", "claude"] },
      { brand: MY_BRAND, isMine: true, hasLink: true, sources: ["chatgpt"] },
      { brand: "דיווי ביטוח", isMine: false, hasLink: false, sources: ["claude"] },
    ],
  },
  {
    id: "q10",
    question: "ביטוח נסיעות עם מצב רפואי קיים – מה מכוסה?",
    topic: "בריאות ומצב רפואי קיים",
    mentioned: true,
    position: 5,
    hasLink: false,
    summary: {
      all: "המקורות מסבירים שמצב רפואי קיים דורש הצהרת בריאות והרחבה בתשלום. הראל ואיי.אי.ג׳י מוזכרות כמובילות בתחום. פספורטכארד מוזכרת בסוף הרשימה וללא קישור לאתר.",
      aio: "Google AI Overview מסביר את תהליך הצהרת הבריאות ומקשר להראל ולכלל.",
      chatgpt: "ChatGPT מפרט אילו מצבים בדרך כלל מוחרגים ומזכיר שלושה ספקים.",
      gemini: "Gemini מדגיש הרחבות בתשלום ומקשר להראל בלבד.",
      claude: "Claude ממליץ לפנות לחיתום אישי ומזכיר את פספורטכארד כאופציה.",
    },
    ranking: [
      { brand: "הראל ביטוח", isMine: false, hasLink: true, sources: ["aio", "gemini", "claude"] },
      { brand: "איי.אי.ג׳י", isMine: false, hasLink: true, sources: ["aio", "chatgpt"] },
      { brand: "כלל ביטוח", isMine: false, hasLink: true, sources: ["aio"] },
      { brand: "דיווי ביטוח", isMine: false, hasLink: false, sources: ["chatgpt"] },
      { brand: MY_BRAND, isMine: true, hasLink: false, sources: ["claude"] },
    ],
  },
];
