/**
 * Content schema: the single source of truth for question files and
 * language/chapter/topic metadata. Used by the build, the validator and tests.
 */
import { z } from 'zod';

const bilingual = {
  title_he: z.string().min(1),
  title_en: z.string().min(1),
};

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug: lowercase letters, digits and dashes');

export const TopicMetaSchema = z.object({
  id: slug,
  ...bilingual,
  /** One or two Hebrew sentences: what this topic tests. Shown on the topic page (SEO). */
  summary_he: z.string().min(20),
}).strict();

export const ChapterMetaSchema = z.object({
  id: slug,
  ...bilingual,
  description_he: z.string().min(20),
  topics: z.array(TopicMetaSchema).min(1),
}).strict();

export const SimulationSchema = z.object({
  questions: z.number().int().positive(),
  minutes: z.number().int().positive(),
  passScore: z.number().int().min(1).max(100),
  /** chapter id -> number of questions drawn from that chapter */
  blueprint: z.record(slug, z.number().int().nonnegative()),
}).strict();

export const LanguageMetaSchema = z.object({
  id: slug,
  prefix: z.string().regex(/^[a-z]{2,4}$/),
  ...bilingual,
  /** Shiki language id used for code highlighting */
  highlight: z.string(),
  version: z.string(),
  description_he: z.string().min(20),
  simulation: SimulationSchema,
  chapters: z.array(ChapterMetaSchema).min(1),
}).strict();

export const LanguagesIndexSchema = z.array(slug).min(1);

const difficulty = z.union([z.literal(1), z.literal(2), z.literal(3)]);

const base = {
  id: z.string().regex(/^[a-z]{2,4}\.[a-z0-9-]+\.[a-z0-9-]+\.\d{3}$/, 'id: <prefix>.<chapter>.<topic>.<NNN>'),
  difficulty,
  tags: z.array(z.string()).optional(),
  /** Hebrew question text. Inline `code` with backticks is allowed. */
  prompt: z.string().min(5),
  /** Hebrew explanation shown after answering. Required for every question. */
  explanation: z.string().min(20),
};

/** Explanations for specific wrong options, keyed by option index. */
const optionExplanations = z.record(z.string().regex(/^\d+$/), z.string().min(5)).optional();

const choiceBase = {
  ...base,
  code: z.string().optional(),
  options: z.array(z.string().min(1)).min(2).max(6),
  answer: z.number().int().nonnegative(),
  optionExplanations,
};

export const SingleSchema = z.object({ type: z.literal('single'), ...choiceBase }).strict();
export const OutputSchema = z.object({ type: z.literal('output'), ...choiceBase, code: z.string().min(1) }).strict();
export const SmellSchema = z.object({ type: z.literal('smell'), ...choiceBase, code: z.string().min(1) }).strict();
/** options are code snippets; learner picks the cleanest */
export const CleanerSchema = z.object({ type: z.literal('cleaner'), ...choiceBase }).strict();

export const TrueFalseSchema = z.object({
  type: z.literal('truefalse'),
  ...base,
  code: z.string().optional(),
  answer: z.boolean(),
}).strict();

export const BugSchema = z.object({
  type: z.literal('bug'),
  ...base,
  code: z.string().min(1),
  /** 1-based line number of the buggy line */
  answer: z.number().int().positive(),
  /** optional corrected version shown after answering */
  fixed: z.string().optional(),
}).strict();

const matchTarget = z.object({
  id: z.string().min(1),
  desc: z.string().optional(),
}).strict();

const matchItem = z.object({
  label: z.string().min(1),
  answer: z.string().min(1),
  /** why this item belongs to its target (Hebrew) */
  why: z.string().optional(),
}).strict();

const matchBase = {
  ...base,
  code: z.string().optional(),
  targets: z.array(matchTarget).min(2).max(8),
  items: z.array(matchItem).min(2).max(10),
};

/** Requirement + full signatures + file names: place each signature in its file. */
export const ArchitectureSchema = z.object({
  type: z.literal('architecture'),
  ...matchBase,
  requirement: z.string().min(10),
}).strict();

/** Class relationships: for each class/pair pick parent / relation kind. */
export const HierarchySchema = z.object({ type: z.literal('hierarchy'), ...matchBase }).strict();

/**
 * Parsons problem: `code` is the correct program; the learner gets its lines shuffled
 * (indentation kept) and puts them back in order so the program prints `output`.
 */
export const OrderSchema = z.object({
  type: z.literal('order'),
  ...base,
  code: z.string().min(1),
  /** exact output of the correct program, shown as the goal; verified in CI */
  output: z.string().min(1),
  /**
   * Parts of `code` whose order among themselves does not matter. Each group lists adjacent
   * units, and a unit is a 1-based line number or an inclusive line range [from, to].
   * [[1, 2]]: the first two lines are independent assignments.
   * [[[2, 3], [4, 6]]]: the block of lines 2-3 and the block of lines 4-6 may swap
   * (e.g. two methods of a class).
   */
  anyOrder: z.array(z.array(z.union([z.number().int().positive(), z.tuple([z.number().int().positive(), z.number().int().positive()])])).min(2)).optional(),
}).strict();

export const QuestionSchema = z.discriminatedUnion('type', [
  SingleSchema,
  OutputSchema,
  SmellSchema,
  CleanerSchema,
  TrueFalseSchema,
  BugSchema,
  ArchitectureSchema,
  HierarchySchema,
  OrderSchema,
]);

export const TopicFileSchema = z.array(QuestionSchema);

export type TopicMeta = z.infer<typeof TopicMetaSchema>;
export type ChapterMeta = z.infer<typeof ChapterMetaSchema>;
export type LanguageMeta = z.infer<typeof LanguageMetaSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type QuestionType = Question['type'];
export type ChoiceQuestion = Extract<Question, { type: 'single' | 'output' | 'smell' | 'cleaner' }>;
export type MatchQuestion = Extract<Question, { type: 'architecture' | 'hierarchy' }>;

export const QUESTION_TYPE_LABELS: Record<QuestionType, { he: string; en: string }> = {
  single: { he: 'בחירה מרובה', en: 'Multiple Choice' },
  output: { he: 'מה הפלט', en: 'Predict the Output' },
  bug: { he: 'מצא את הבאג', en: 'Find the Bug' },
  truefalse: { he: 'נכון / לא נכון', en: 'True / False' },
  architecture: { he: 'בניית ארכיטקטורה', en: 'Architecture Assembly' },
  hierarchy: { he: 'יחסי מחלקות', en: 'Class Relationships' },
  cleaner: { he: 'איזה קוד נקי יותר', en: 'Cleaner Code' },
  smell: { he: 'זיהוי ריח קוד', en: 'Code Smell' },
  order: { he: 'סידור שורות קוד', en: 'Code Ordering' },
};

/** Limits for `order` questions: enough lines to think, few enough for a phone screen. */
export const ORDER_MIN_LINES = 4;
export const ORDER_MAX_LINES = 18;

export type OrderUnit = number | [number, number];

/** Lines of an `order` question's code, as the learner sees them (trailing newline dropped). */
export function orderLines(code: string): string[] {
  return code.replace(/\r\n?/g, '\n').replace(/\n+$/, '').split('\n');
}

export const MIN_QUESTIONS_PER_TOPIC = 15;
