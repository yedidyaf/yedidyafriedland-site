/**
 * Prepares a highlighted line for wrapping on narrow screens: the leading indentation
 * is removed from the text and returned as a column count (rendered as padding, so a
 * wrapped line never breaks inside its indentation), and soft break points (<wbr>) are
 * added after "." and "(" so long calls wrap at a sensible place, not mid-identifier.
 * Arrows are kept whole.
 */
export function prepareLine(html: string): { ind: number; html: string } {
  let ind = 0;
  let leading = true;
  const out = html.replace(/(<[^>]*>)|([^<]+)/g, (_m, tag: string | undefined, text: string | undefined) => {
    if (tag) return tag;
    let t = text!;
    if (leading) {
      const lead = /^[ \t]*/.exec(t)![0];
      ind += lead.replace(/\t/g, '    ').length;
      t = t.slice(lead.length);
      if (t) leading = false;
    }
    return t
      .replace(/\.(?=[A-Za-z_])/g, '.<wbr>')
      .replace(/\((?!\))/g, '(<wbr>')
      // arrows ("->", "=>") must never be split at the hyphen/equals sign
      .replace(/([-=])&gt;/g, '<span class="nobr">$1&gt;</span>');
  });
  return { ind, html: out };
}
