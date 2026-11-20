import type { CodeLines } from '../lib/types';

interface Props {
  lines: CodeLines;
  /** show line numbers */
  numbers?: boolean;
  /** make lines clickable (find-the-bug) */
  onLine?: (line: number) => void;
  selected?: number;
  correctLine?: number;
  label?: string;
}

export default function CodeBlock({ lines, numbers = false, onLine, selected, correctLine, label }: Props) {
  const clickable = !!onLine;
  return (
    <pre class={`code${clickable ? ' pick' : ''}`} aria-label={label ?? 'קוד'} dir="ltr" role={clickable ? 'listbox' : undefined}>
      <code>
        {lines.map((html, i) => {
          const n = i + 1;
          const cls = ['ln', selected === n ? 'sel' : '', correctLine === n ? 'right' : '', correctLine && selected === n && selected !== correctLine ? 'wrong' : '']
            .filter(Boolean)
            .join(' ');
          const content = (
            <>
              {(numbers || clickable) && <span class="num">{n}</span>}
              <span class="src" dangerouslySetInnerHTML={{ __html: html || ' ' }} />
            </>
          );
          return clickable ? (
            <div
              key={i}
              class={cls}
              role="option"
              aria-selected={selected === n}
              tabIndex={0}
              onClick={() => onLine!(n)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onLine!(n);
                }
              }}
            >
              {content}
            </div>
          ) : (
            <div key={i} class={cls}>
              {content}
            </div>
          );
        })}
      </code>
    </pre>
  );
}
