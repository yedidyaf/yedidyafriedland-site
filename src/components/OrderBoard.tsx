/**
 * "Order the lines" (Parsons problem): the learner moves shuffled code lines into the
 * order that prints the goal output. Lines keep their indentation. Works with:
 *  - the arrow buttons on each line (keyboard and touch),
 *  - tap a line, then tap the place it should go (touch),
 *  - drag and drop (mouse).
 */
import { useState } from 'preact/hooks';
import { prepareLine } from '../lib/codewrap';
import { orderMarks, type Answer } from '../lib/scoring';
import { orderLines } from '../lib/schema';
import { rng, scrambleLines, seedFromId } from '../lib/exam';
import type { ClientQuestion } from '../lib/types';

type OrderQuestion = Extract<ClientQuestion, { type: 'order' }>;

/** How many positions hold a right line. */
export function linesInPlace(q: OrderQuestion, arranged: number[]): number {
  return orderMarks(q.code, arranged, q.anyOrder).filter(Boolean).length;
}

function move<T>(arr: T[], from: number, to: number): T[] {
  const a = arr.slice();
  const [x] = a.splice(from, 1);
  a.splice(to, 0, x);
  return a;
}

interface Props {
  q: OrderQuestion;
  answer?: Answer;
  order?: number[];
  locked: boolean;
  onAnswer?: (a: Answer) => void;
}

export default function OrderBoard({ q, answer, order, locked, onAnswer }: Props) {
  const n = orderLines(q.code).length;
  const start = order && order.length === n ? order : scrambleLines(q.code, q.anyOrder, rng(seedFromId(q.id)));
  const arranged = answer?.kind === 'order' && answer.lines.length === n ? answer.lines : start;
  const [picked, setPicked] = useState<number | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const html = q.codeHtml ?? orderLines(q.code);
  const marks = locked && answer?.kind === 'order' ? orderMarks(q.code, arranged, q.anyOrder) : null;

  const set = (next: number[]) => onAnswer?.({ kind: 'order', lines: next });
  const shift = (pos: number, by: number) => {
    const to = pos + by;
    if (to < 0 || to >= n) return;
    setPicked(null);
    set(move(arranged, pos, to));
  };
  const tap = (pos: number) => {
    if (locked) return;
    if (picked === null) return setPicked(pos);
    if (picked !== pos) set(move(arranged, picked, pos));
    setPicked(null);
  };

  return (
    <div class="order">
      <div class="goal">
        <strong>הפלט הרצוי:</strong>
        <pre class="out" dir="ltr">{q.output.replace(/\n+$/, '')}</pre>
      </div>
      {!locked && (
        <p class="hint muted">
          {picked === null ? 'הזיזו שורות בחצים, או לחצו על שורה ואז על המקום שאליו היא צריכה לעבור.' : 'עכשיו לחצו על המקום שאליו השורה צריכה לעבור.'}
        </p>
      )}
      {(!locked || answer?.kind === 'order') && (
      <ol class="order-list code" dir="ltr" aria-label="שורות הקוד לסידור">
        {arranged.map((li, pos) => {
          const line = prepareLine(html[li] ?? '');
          const cls = ['oline', picked === pos ? 'sel' : '', dragFrom === pos ? 'dragging' : '', marks ? (marks[pos] ? 'right' : 'wrong') : '']
            .filter(Boolean)
            .join(' ');
          return (
            <li
              key={li}
              class={cls}
              draggable={!locked}
              onDragStart={(e) => {
                setDragFrom(pos);
                e.dataTransfer?.setData('text/plain', String(pos));
              }}
              onDragEnd={() => setDragFrom(null)}
              onDragOver={(e) => !locked && e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragFrom !== null && dragFrom !== pos) set(move(arranged, dragFrom, pos));
                setDragFrom(null);
                setPicked(null);
              }}
            >
              <span class="num">{pos + 1}</span>
              <span
                class="src"
                style={`--ind:${line.ind}`}
                role={locked ? undefined : 'button'}
                tabIndex={locked ? undefined : 0}
                aria-pressed={locked ? undefined : picked === pos}
                aria-label={locked ? undefined : `שורה ${pos + 1}: ${orderLines(q.code)[li].trim()}`}
                onClick={() => tap(pos)}
                onKeyDown={(e) => {
                  if (e.key === ' ') {
                    e.preventDefault();
                    tap(pos);
                  }
                }}
                dangerouslySetInnerHTML={{ __html: line.html || ' ' }}
              />
              {!locked && (
                <span class="moves">
                  <button type="button" class="mv" aria-label={`הזזת שורה ${pos + 1} למעלה`} disabled={pos === 0} onClick={() => shift(pos, -1)}>
                    ▲
                  </button>
                  <button type="button" class="mv" aria-label={`הזזת שורה ${pos + 1} למטה`} disabled={pos === n - 1} onClick={() => shift(pos, 1)}>
                    ▼
                  </button>
                </span>
              )}
              {marks && (
                <span class="mark" aria-label={marks[pos] ? 'במקום הנכון' : 'לא במקום הנכון'}>
                  {marks[pos] ? '✓' : '✗'}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      )}
    </div>
  );
}
