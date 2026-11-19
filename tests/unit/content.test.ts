import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/lib/content';
import { inline, bilingual } from '../../src/lib/text';

describe('content', () => {
  it('loads and validates all content', () => {
    const langs = loadContent();
    expect(langs.map((l) => l.id)).toEqual(['python', 'csharp']);
    for (const l of langs) {
      const blueprint = Object.values(l.simulation.blueprint).reduce((a, b) => a + b, 0);
      expect(blueprint).toBe(l.simulation.questions);
    }
  });
});

describe('text', () => {
  it('escapes HTML and formats inline code', () => {
    expect(inline('<b> `a<b` **x**')).toBe('&lt;b&gt; <code class="ic" dir="ltr">a&lt;b</code> <strong>x</strong>');
  });
  it('keeps C# readable in RTL', () => {
    expect(bilingual('סי שארפ', 'C#')).toBe('סי שארפ - C#‎');
  });
});
