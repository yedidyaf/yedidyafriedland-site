/**
 * Build-time content loader (Node only). Reads YAML from /content,
 * validates it against the schema plus semantic rules, and returns
 * a typed tree. Throws ContentError with every problem found.
 */
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {
  LanguageMetaSchema,
  LanguagesIndexSchema,
  TopicFileSchema,
  MIN_QUESTIONS_PER_TOPIC,
  type LanguageMeta,
  type ChapterMeta,
  type TopicMeta,
  type Question,
} from './schema';

export interface LoadedTopic extends TopicMeta {
  questions: Question[];
}
export interface LoadedChapter extends Omit<ChapterMeta, 'topics'> {
  topics: LoadedTopic[];
}
export interface LoadedLanguage extends Omit<LanguageMeta, 'chapters'> {
  chapters: LoadedChapter[];
}

export class ContentError extends Error {
  constructor(public problems: string[]) {
    super(`Content has ${problems.length} problem(s):\n- ` + problems.join('\n- '));
  }
}

export const CONTENT_DIR = path.resolve(process.cwd(), 'content');

function readYaml(file: string): unknown {
  return YAML.parse(fs.readFileSync(file, 'utf8'));
}

function zodProblems(file: string, err: { issues: { path: (string | number)[]; message: string }[] }): string[] {
  return err.issues.map((i) => `${file}: ${i.path.join('.') || '(root)'}: ${i.message}`);
}

const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

/** Semantic checks that zod cannot express. */
export function checkQuestion(q: Question, file: string, expectedPrefix: string): string[] {
  const p: string[] = [];
  const where = `${file}: ${q.id}`;
  if (!q.id.startsWith(expectedPrefix + '.')) p.push(`${where}: id must start with "${expectedPrefix}."`);
  switch (q.type) {
    case 'single':
    case 'output':
    case 'smell':
    case 'cleaner': {
      if (q.answer >= q.options.length) p.push(`${where}: answer ${q.answer} out of range (${q.options.length} options)`);
      const seen = new Set(q.options.map((o) => o.trim()));
      if (seen.size !== q.options.length) p.push(`${where}: duplicate options`);
      for (const k of Object.keys(q.optionExplanations ?? {})) {
        if (Number(k) >= q.options.length) p.push(`${where}: optionExplanations key ${k} out of range`);
        if (Number(k) === q.answer) p.push(`${where}: optionExplanations must explain wrong options only (key ${k} is the answer)`);
      }
      if (q.type === 'cleaner' && q.options.length > 3) p.push(`${where}: cleaner questions take 2-3 code options`);
      break;
    }
    case 'bug': {
      const lines = q.code.replace(/\n$/, '').split('\n').length;
      if (q.answer > lines) p.push(`${where}: bug line ${q.answer} > code lines ${lines}`);
      break;
    }
    case 'architecture':
    case 'hierarchy': {
      const ids = new Set(q.targets.map((t) => t.id));
      if (ids.size !== q.targets.length) p.push(`${where}: duplicate target ids`);
      const labels = new Set(q.items.map((i) => i.label));
      if (labels.size !== q.items.length) p.push(`${where}: duplicate item labels`);
      for (const it of q.items) if (!ids.has(it.answer)) p.push(`${where}: item "${it.label}" answer "${it.answer}" is not a target`);
      break;
    }
  }
  return p;
}

export interface LoadOptions {
  /** enforce MIN_QUESTIONS_PER_TOPIC and that every topic has a file */
  strict?: boolean;
  dir?: string;
  /** only load topic files under these "<lang>/<chapter>" prefixes (env CONTENT_ONLY, comma-separated) */
  only?: string[];
}

export function loadContent(opts: LoadOptions = {}): LoadedLanguage[] {
  const dir = opts.dir ?? CONTENT_DIR;
  const problems: string[] = [];
  const indexFile = path.join(dir, 'languages.yaml');
  const idx = LanguagesIndexSchema.safeParse(readYaml(indexFile));
  if (!idx.success) throw new ContentError(zodProblems('languages.yaml', idx.error));

  const allIds = new Map<string, string>();
  const allPrompts = new Map<string, string>();
  const result: LoadedLanguage[] = [];

  for (const langId of idx.data) {
    const metaFile = path.join(dir, langId, 'language.yaml');
    const rel = path.relative(dir, metaFile);
    if (!fs.existsSync(metaFile)) {
      problems.push(`${rel}: missing`);
      continue;
    }
    const meta = LanguageMetaSchema.safeParse(readYaml(metaFile));
    if (!meta.success) {
      problems.push(...zodProblems(rel, meta.error));
      continue;
    }
    const lang = meta.data;
    if (lang.id !== langId) problems.push(`${rel}: id "${lang.id}" must equal folder "${langId}"`);

    const chapterIds = new Set<string>();
    let blueprintTotal = 0;
    for (const [ch, n] of Object.entries(lang.simulation.blueprint)) {
      blueprintTotal += n;
      if (!lang.chapters.some((c) => c.id === ch)) problems.push(`${rel}: simulation.blueprint chapter "${ch}" does not exist`);
    }
    if (blueprintTotal !== lang.simulation.questions)
      problems.push(`${rel}: simulation.blueprint sums to ${blueprintTotal}, expected ${lang.simulation.questions}`);

    const chapters: LoadedChapter[] = [];
    for (const ch of lang.chapters) {
      if (chapterIds.has(ch.id)) problems.push(`${rel}: duplicate chapter ${ch.id}`);
      chapterIds.add(ch.id);
      const topicIds = new Set<string>();
      const topics: LoadedTopic[] = [];
      for (const t of ch.topics) {
        if (topicIds.has(t.id)) problems.push(`${rel}: duplicate topic ${ch.id}/${t.id}`);
        topicIds.add(t.id);
        const tFile = path.join(dir, langId, ch.id, `${t.id}.yaml`);
        const tRel = path.relative(dir, tFile);
        let questions: Question[] = [];
        const only = opts.only ?? (process.env.CONTENT_ONLY ? process.env.CONTENT_ONLY.split(',') : null);
        const included = !only || only.some((o) => `${langId}/${ch.id}/${t.id}`.startsWith(o));
        if (!included) {
          topics.push({ ...t, questions });
          continue;
        }
        if (fs.existsSync(tFile)) {
          const parsed = TopicFileSchema.safeParse(readYaml(tFile) ?? []);
          if (!parsed.success) problems.push(...zodProblems(tRel, parsed.error));
          else questions = parsed.data;
        } else if (opts.strict) {
          problems.push(`${tRel}: missing topic file`);
        }
        const prefix = `${lang.prefix}.${ch.id}.${t.id}`;
        for (const q of questions) {
          problems.push(...checkQuestion(q, tRel, prefix));
          const prev = allIds.get(q.id);
          if (prev) problems.push(`${tRel}: duplicate id ${q.id} (also in ${prev})`);
          allIds.set(q.id, tRel);
          const key = normalize(q.prompt + '\n' + ('code' in q && q.code ? q.code : ''));
          const dup = allPrompts.get(key);
          if (dup) problems.push(`${tRel}: ${q.id} duplicates ${dup} (same prompt and code)`);
          allPrompts.set(key, q.id);
        }
        if (opts.strict && questions.length < MIN_QUESTIONS_PER_TOPIC)
          problems.push(`${tRel}: ${questions.length} questions, minimum is ${MIN_QUESTIONS_PER_TOPIC}`);
        topics.push({ ...t, questions });
      }
      // Files present on disk but not declared in language.yaml
      const chDir = path.join(dir, langId, ch.id);
      if (fs.existsSync(chDir)) {
        for (const f of fs.readdirSync(chDir)) {
          if (f.endsWith('.yaml') && !topicIds.has(f.replace(/\.yaml$/, '')))
            problems.push(`${path.relative(dir, path.join(chDir, f))}: topic not declared in language.yaml`);
        }
      }
      chapters.push({ ...ch, topics });
    }
    result.push({ ...lang, chapters });
  }

  if (problems.length) throw new ContentError(problems);
  return result;
}

/** Cached loader for Astro pages (content does not change during a build). */
let cache: LoadedLanguage[] | null = null;
export function getContent(): LoadedLanguage[] {
  if (!cache) cache = loadContent({ strict: process.env.CONTENT_STRICT === '1' });
  return cache;
}

export function allQuestions(lang: LoadedLanguage): { chapter: LoadedChapter; topic: LoadedTopic; q: Question }[] {
  return lang.chapters.flatMap((chapter) =>
    chapter.topics.flatMap((topic) => topic.questions.map((q) => ({ chapter, topic, q }))),
  );
}
