/** Shapes of the JSON the build emits for the browser (public/data is generated). */
import type { Question } from './schema';

/** Highlighted code: one HTML string per source line. */
export type CodeLines = string[];

export type ClientQuestion = Question & {
  chapter: string;
  topic: string;
  /** highlighted `code` */
  codeHtml?: CodeLines;
  /** highlighted options (cleaner: code options) */
  optionsHtml?: CodeLines[];
  /** highlighted `fixed` (bug) */
  fixedHtml?: CodeLines;
  /** highlighted item labels (architecture / hierarchy) */
  itemsHtml?: string[];
};

export interface ChapterData {
  lang: string;
  chapter: string;
  questions: ClientQuestion[];
}

export interface TopicIndex {
  id: string;
  title_he: string;
  title_en: string;
  questionIds: string[];
}
export interface ChapterIndex {
  id: string;
  title_he: string;
  title_en: string;
  topics: TopicIndex[];
}
export interface LanguageIndex {
  id: string;
  prefix: string;
  title_he: string;
  title_en: string;
  highlight: string;
  simulation: { questions: number; minutes: number; passScore: number; blueprint: Record<string, number> };
  chapters: ChapterIndex[];
}
