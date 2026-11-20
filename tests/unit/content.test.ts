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

describe('negative numbers', () => {
  it('isolates a minus sign in RTL prose', () => {
    expect(inline('מחזיר -1 כש')).toBe('מחזיר <bdi dir="ltr">-1</bdi> כש');
  });
});

describe('multi-line choice options', () => {
  it('are highlighted as code so line breaks survive', async () => {
    const { clientQuestion } = await import('../../src/lib/build-data');
    const q = { id: 'cs.a.b.001', type: 'single', difficulty: 1, prompt: 'p', explanation: 'e', answer: 1, options: ['if (a) {\n    B();\n}\n', 'if (a)\n{\n    B();\n}\n', 'שום דבר'] } as never;
    const cq = await clientQuestion(q, 'a', 'b', 'csharp');
    expect(cq.optionsHtml?.[0]).toHaveLength(3);
    expect(cq.optionsHtml?.[1]).toHaveLength(4);
    expect(cq.optionsHtml?.[2]).toEqual([]);
  });
});
