/** Prints question counts per topic and per type. Usage: npm run stats */
import { loadContent } from '../src/lib/content';
import { MIN_QUESTIONS_PER_TOPIC } from '../src/lib/schema';

for (const l of loadContent()) {
  console.log(`\n${l.title_en}`);
  const types: Record<string, number> = {};
  for (const c of l.chapters) {
    for (const t of c.topics) {
      for (const q of t.questions) types[q.type] = (types[q.type] ?? 0) + 1;
      const flag = t.questions.length < MIN_QUESTIONS_PER_TOPIC ? '  <-- below minimum' : '';
      console.log(`  ${c.id}/${t.id}: ${t.questions.length}${flag}`);
    }
  }
  console.log('  by type:', types);
}
