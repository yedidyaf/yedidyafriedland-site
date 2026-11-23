/** A self-contained practice question for topic pages (not recorded in progress). */
import { useState } from 'preact/hooks';
import QuestionCard from './QuestionCard';
import { isComplete, type Answer } from '../lib/scoring';
import type { ClientQuestion } from '../lib/types';
import { rng, scrambleLines, seedFromId, shuffle } from '../lib/exam';

/** Stable per-question option (or line) order, identical on the server and in the browser. */
function orderFor(q: ClientQuestion): number[] | undefined {
  if (q.type === 'order') return scrambleLines(q.code, q.anyOrder, rng(seedFromId(q.id)));
  if (!('options' in q)) return undefined;
  return shuffle(q.options.map((_, i) => i), rng(seedFromId(q.id)));
}

export default function SampleQuestion({ q, number }: { q: ClientQuestion; number: number }) {
  const [answer, setAnswer] = useState<Answer | undefined>();
  const [done, setDone] = useState(false);
  const order = orderFor(q);
  const autoCheck = q.type !== 'architecture' && q.type !== 'hierarchy' && q.type !== 'order';
  const onAnswer = (a: Answer) => {
    setAnswer(a);
    if (autoCheck) setDone(true);
  };
  return (
    <div class="sample-q">
      <QuestionCard q={q} answer={answer} onAnswer={onAnswer} order={order} mode={done ? 'feedback' : 'answer'} number={number} />
      {!done && (
        <div class="row-actions" style="margin-top:10px">
          {!autoCheck && (
            <button class="btn sm" disabled={!isComplete(q, answer)} onClick={() => setDone(true)}>
              בדיקה
            </button>
          )}
          <button class="btn sm ghost" onClick={() => setDone(true)}>
            הצגת התשובה
          </button>
        </div>
      )}
      {done && (
        <button
          class="btn sm ghost"
          style="margin-top:10px"
          onClick={() => {
            setAnswer(undefined);
            setDone(false);
          }}
        >
          לנסות שוב
        </button>
      )}
    </div>
  );
}
