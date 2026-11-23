/**
 * Renders one question in three modes:
 *  - "answer":   interactive, no feedback yet
 *  - "feedback": answer locked, correctness + explanation shown
 *  - "review":   same as feedback, used on results/topic pages (also SSR)
 */
import CodeBlock from './CodeBlock';
import { inline, prose } from '../lib/text';
import { QUESTION_TYPE_LABELS } from '../lib/schema';
import { isCorrect, partialScore, type Answer } from '../lib/scoring';
import type { ClientQuestion } from '../lib/types';
import OrderBoard, { linesInPlace } from './OrderBoard';

interface Props {
  q: ClientQuestion;
  answer?: Answer;
  onAnswer?: (a: Answer) => void;
  /** display order of option indexes (choice types) */
  order?: number[];
  mode: 'answer' | 'feedback' | 'review';
  number?: number;
  total?: number;
  topicLabel?: string;
}

const LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];

function Html({ html, as = 'span', cls }: { html: string; as?: 'span' | 'div'; cls?: string }) {
  const Tag = as;
  return <Tag class={cls} dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function QuestionCard({ q, answer, onAnswer, order, mode, number, total, topicLabel }: Props) {
  const locked = mode !== 'answer';
  const correct = locked ? isCorrect(q, answer) : false;
  const label = QUESTION_TYPE_LABELS[q.type];

  return (
    <article class={`qcard${locked ? (correct ? ' is-right' : ' is-wrong') : ''}`} aria-labelledby={`q-${q.id}`}>
      <header class="qhead">
        <div class="qmeta">
          {number !== undefined && (
            <span class="qnum">
              שאלה {number}
              {total ? ` מתוך ${total}` : ''}
            </span>
          )}
          <span class="badge">
            {label.he} - <span class="en-term">{label.en}</span>
          </span>
          <span class="diff" title={`רמת קושי ${q.difficulty} מתוך 3`} aria-label={`רמת קושי ${q.difficulty} מתוך 3`}>
            {[1, 2, 3].map((d) => (
              <i class={d <= q.difficulty ? 'on' : ''} />
            ))}
          </span>
          {topicLabel && <span class="qtopic muted">{topicLabel}</span>}
        </div>
        <h2 id={`q-${q.id}`} class="qprompt">
          <Html html={inline(q.prompt)} />
        </h2>
      </header>

      {q.type === 'architecture' && (
        <div class="requirement">
          <strong>הדרישה:</strong> <Html html={inline(q.requirement)} />
        </div>
      )}

      {q.codeHtml && q.type !== 'bug' && q.type !== 'order' && <CodeBlock lines={q.codeHtml} numbers={q.codeHtml.length > 4} />}

      <div class="qbody">{renderBody(q, answer, onAnswer, order, locked)}</div>

      {locked && <Feedback q={q} answer={answer} correct={correct} />}
    </article>
  );
}

function renderBody(q: ClientQuestion, answer: Answer | undefined, onAnswer: Props['onAnswer'], order: number[] | undefined, locked: boolean) {
  switch (q.type) {
    case 'single':
    case 'output':
    case 'smell':
    case 'cleaner': {
      const idx = order ?? q.options.map((_, i) => i);
      const chosen = answer?.kind === 'choice' ? answer.index : undefined;
      return (
        <div class={`options${q.optionsHtml ? ' code-options' : ''}`} role="radiogroup" aria-label="תשובות">
          {idx.map((oi, pos) => {
            const isChosen = chosen === oi;
            const state = locked ? (oi === q.answer ? 'right' : isChosen ? 'wrong' : '') : isChosen ? 'chosen' : '';
            return (
              <button
                type="button"
                role="radio"
                aria-checked={isChosen}
                class={`opt ${state}`}
                disabled={locked}
                onClick={() => onAnswer?.({ kind: 'choice', index: oi })}
              >
                <span class="letter" aria-hidden="true">
                  {LETTERS[pos]}
                </span>
                <span class="otext">
                  {q.type === 'output' ? (
                    <pre class="out">{q.options[oi]}</pre>
                  ) : q.optionsHtml?.[oi]?.length ? (
                    <CodeBlock lines={q.optionsHtml[oi]} label={`גרסה ${LETTERS[pos]}`} />
                  ) : (
                    <Html html={inline(q.options[oi])} />
                  )}
                </span>
                {locked && oi === q.answer && <span class="mark" aria-label="התשובה הנכונה">✓</span>}
                {locked && isChosen && oi !== q.answer && <span class="mark" aria-label="התשובה שבחרת">✗</span>}
              </button>
            );
          })}
        </div>
      );
    }
    case 'truefalse': {
      const v = answer?.kind === 'bool' ? answer.value : undefined;
      return (
        <div class="options tf" role="radiogroup" aria-label="נכון או לא נכון">
          {[true, false].map((b) => {
            const state = locked ? (b === q.answer ? 'right' : v === b ? 'wrong' : '') : v === b ? 'chosen' : '';
            return (
              <button type="button" role="radio" aria-checked={v === b} class={`opt ${state}`} disabled={locked} onClick={() => onAnswer?.({ kind: 'bool', value: b })}>
                <span class="otext">{b ? 'נכון' : 'לא נכון'}</span>
              </button>
            );
          })}
        </div>
      );
    }
    case 'bug': {
      const sel = answer?.kind === 'line' ? answer.line : undefined;
      return (
        <div>
          <p class="hint muted">{locked ? '' : 'לחצו על השורה שצריך לתקן.'}</p>
          <CodeBlock
            lines={q.codeHtml ?? []}
            numbers
            onLine={locked ? undefined : (n) => onAnswer?.({ kind: 'line', line: n })}
            selected={sel}
            correctLine={locked ? q.answer : undefined}
            label="קוד: בחרו שורה"
          />
        </div>
      );
    }
    case 'order':
      return <OrderBoard q={q} answer={answer} order={order} locked={locked} onAnswer={onAnswer} />;
    case 'architecture':
    case 'hierarchy': {
      const picks = answer?.kind === 'match' ? answer.picks : {};
      const set = (label: string, target: string) => onAnswer?.({ kind: 'match', picks: { ...picks, [label]: target } });
      return (
        <div class="match">
          <div class="targets" aria-label="יעדים">
            {q.targets.map((t) => (
              <div class="target">
                <code class="tid" dir="auto">
                  {t.id}
                </code>
                {t.desc && <span class="muted"> {t.desc}</span>}
              </div>
            ))}
          </div>
          <ol class="items">
            {q.items.map((it, i) => {
              const picked = picks[it.label];
              const ok = locked ? picked === it.answer : undefined;
              return (
                <li class={`item${locked ? (ok ? ' right' : ' wrong') : ''}`}>
                  <div class={q.itemsHtml ? 'sig' : 'sig plain'} dir={q.itemsHtml ? 'ltr' : 'auto'}>
                    {q.itemsHtml ? <Html html={q.itemsHtml[i]} /> : <Html html={inline(it.label)} />}
                  </div>
                  <div class="chips" role="radiogroup" aria-label={`יעד עבור ${it.label}`}>
                    {q.targets.map((t) => {
                      const isPicked = picked === t.id;
                      const st = locked ? (t.id === it.answer ? 'right' : isPicked ? 'wrong' : '') : isPicked ? 'chosen' : '';
                      return (
                        <button type="button" role="radio" aria-checked={isPicked} class={`chip ${st}`} disabled={locked} onClick={() => set(it.label, t.id)}>
                          <span dir="auto">{t.id}</span>
                        </button>
                      );
                    })}
                  </div>
                  {locked && it.why && (
                    <p class="why">
                      <Html html={inline(it.why)} />
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      );
    }
  }
}

function Feedback({ q, answer, correct }: { q: ClientQuestion; answer?: Answer; correct: boolean }) {
  const partial = q.type === 'architecture' || q.type === 'hierarchy' ? partialScore(q, answer) : null;
  let wrongWhy: string | undefined;
  if ((q.type === 'single' || q.type === 'output' || q.type === 'smell' || q.type === 'cleaner') && answer?.kind === 'choice' && answer.index !== q.answer)
    wrongWhy = q.optionExplanations?.[String(answer.index)];
  return (
    <section class="feedback" aria-live="polite">
      <p class={`verdict ${correct ? 'ok' : 'no'}`}>
        {!answer ? 'לא עניתם על השאלה.' : correct ? 'נכון!' : 'לא נכון.'}
        {partial !== null && answer && !correct && <span class="muted"> שיבצתם נכון {Math.round(partial * 100)}% מהפריטים.</span>}
        {q.type === 'bug' && answer && !correct && <span class="muted"> השורה שצריך לתקן היא {q.answer}.</span>}
        {q.type === 'order' && answer?.kind === 'order' && !correct && (
          <span class="muted">
            {' '}
            {linesInPlace(q, answer.lines)} מתוך {answer.lines.length} השורות במקום הנכון.
          </span>
        )}
      </p>
      {wrongWhy && (
        <div class="wrongwhy">
          <strong>למה התשובה שבחרתם לא נכונה: </strong>
          <Html html={inline(wrongWhy)} />
        </div>
      )}
      <div class="explain">
        <strong>הסבר</strong>
        <Html as="div" html={prose(q.explanation)} />
      </div>
      {q.type === 'order' && !correct && q.codeHtml && (
        <div class="fixed">
          <strong>הסדר הנכון</strong>
          <CodeBlock lines={q.codeHtml} numbers />
        </div>
      )}
      {q.type === 'bug' && q.fixedHtml && (
        <div class="fixed">
          <strong>הקוד המתוקן</strong>
          <CodeBlock lines={q.fixedHtml} numbers correctLine={q.answer} />
        </div>
      )}
    </section>
  );
}
