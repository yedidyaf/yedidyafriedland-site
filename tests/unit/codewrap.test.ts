import { describe, expect, it } from 'vitest';
import { prepareLine } from '../../src/lib/codewrap';
import { labelSource } from '../../src/lib/build-data';

describe('prepareLine', () => {
  it('moves leading indentation out of the text, across tags', () => {
    const r = prepareLine('<span style="a">    </span><span style="b">        return</span> x');
    expect(r.ind).toBe(12);
    expect(r.html).toBe('<span style="a"></span><span style="b">return</span> x');
  });

  it('counts a tab as 4 columns and keeps inner spaces', () => {
    expect(prepareLine('\tif a  ==  b:')).toEqual({ ind: 4, html: 'if a  ==  b:' });
  });

  it('adds break points after member access and open parens only', () => {
    expect(prepareLine('self.notifier.send(order.email, 3.14)').html).toBe(
      'self.<wbr>notifier.<wbr>send(<wbr>order.<wbr>email, 3.14)',
    );
    expect(prepareLine('Console.WriteLine()').html).toBe('Console.<wbr>WriteLine()');
  });

  it('keeps arrows whole', () => {
    expect(prepareLine('save(b) -&gt; None').html).toBe('save(<wbr>b) <span class="nobr">-&gt;</span> None');
    expect(prepareLine('x =&gt; x').html).toBe('x <span class="nobr">=&gt;</span> x');
  });

  it('never touches tag attributes', () => {
    const html = '<span style="--shiki-light:#24292E;x.y(1)">a.b</span>';
    expect(prepareLine(html).html).toBe('<span style="--shiki-light:#24292E;x.y(1)">a.<wbr>b</span>');
  });

  it('keeps blank lines empty', () => {
    expect(prepareLine('')).toEqual({ ind: 0, html: '' });
    expect(prepareLine('    ')).toEqual({ ind: 4, html: '' });
  });
});

describe('labelSource', () => {
  it('splits a one-line Python class label into header and method', () => {
    expect(labelSource('class Repo(Protocol): def get(self, id: int) -> Item', 'python')).toBe(
      'class Repo(Protocol):\n    def get(self, id: int) -> Item',
    );
  });

  it('leaves plain signatures and other languages alone', () => {
    expect(labelSource('def save(user: User) -> None', 'python')).toBe('def save(user: User) -> None');
    expect(labelSource('Task.is_overdue(self, today: date) -> bool', 'python')).toBe('Task.is_overdue(self, today: date) -> bool');
    expect(labelSource('class A: def f()', 'csharp')).toBe('class A: def f()');
  });
});
