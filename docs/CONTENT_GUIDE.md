# מדריך כתיבת שאלות - Content Authoring Guide

This guide is binding for anyone (human or AI) who writes questions for the site.
The site teaches programming **only through tests**, like practice exams for a
driving-theory test. Every question must teach: the explanation after answering is
where the learning happens. The site carries Yedidya Friedland's name as a
programming teacher, so quality bar is "a demanding senior developer and a good
teacher would both sign this".

## Where questions live

```
content/languages.yaml                 list of active languages (do not edit)
content/<lang>/language.yaml           chapters, topics, simulation blueprint (do not edit)
content/<lang>/<chapter>/<topic>.yaml  the questions of one topic: a YAML list
```

The topic file name must match a topic declared in `language.yaml`.
`src/lib/schema.ts` is the exact schema; this guide explains how to use it well.

## Volume and mix per topic file

- **16 questions per topic** (minimum 15, maximum 20).
- Ids: `<prefix>.<chapter>.<topic>.<NNN>`, numbered 001, 002, ... in file order.
  Prefix is `py` for Python, `cs` for C#. Never reuse or renumber an existing id.
- Difficulty mix per topic: about 5 × `1` (easy), 7 × `2` (medium), 4 × `3` (hard).
- Type mix per topic (guideline, adapt to the topic):
  - regular language topics: ≥ 5 `output`, ≥ 2 `bug`, ≥ 3 `single`, 1-3 `truefalse`;
    use `smell`/`cleaner` when a natural clean-code angle exists.
  - OOP topics: as above, plus ≥ 2 `hierarchy` in inheritance / composition /
    interfaces / abstract-classes / polymorphism topics.
  - clean-code topics: mostly `smell`, `cleaner`, `single` with code, plus `bug`.
  - software-design topics: `single` with code, `cleaner`, `hierarchy`, ≥ 3 `architecture`;
    the `architecture-assembly` topic is ≥ 10 `architecture` questions.
- Cover the topic's `summary_he` fully: every concept it names gets at least one question.
- Stay inside the topic. Do not test things that belong to a later chapter.

## Language and tone

- All prompts, options (when they are prose), explanations and `why` texts are in **Hebrew**.
- Code, identifiers, keywords and program output are in English, inside backticks
  in prose: `` `len` ``, `` `None` ``.
- Address the learner in plural imperative (gender-neutral): "בחרו", "שבצו", "מצאו".
- Bilingual terms: the first time an explanation uses a technical term, add the
  English term: "ירושה (Inheritance)", "טווח הכרה (Scope)". Choice options that name
  concepts are written "עברית - English", e.g. `"מספר קסם - Magic Number"`.
- Short, precise sentences. No filler ("שאלה מעניינת!"), no emoji.
- Correct Hebrew spelling (כתיב מלא), correct technical Hebrew.

## The fields

Common to all types:

| field | rules |
| --- | --- |
| `id` | see above |
| `type` | one of `single`, `output`, `bug`, `truefalse`, `smell`, `cleaner`, `architecture`, `hierarchy`, `order` |
| `difficulty` | 1, 2 or 3 |
| `tags` | optional list of short English tags; special tags below |
| `prompt` | the question in Hebrew. For `output` always exactly `מה יודפס?` unless the code needs context |
| `explanation` | 1-4 sentences: why the answer is right AND what misconception the wrong answers represent |

`optionExplanations` (choice types): a map from a **wrong** option index (as a quoted
string, `"1"`) to a one-sentence Hebrew explanation of why that option is wrong.
Add it for every distractor that a learner would plausibly pick. Never for the answer.

### `single` - Multiple Choice

`options` (2-6, normally 4), `answer` (0-based index), optional `code`.
Distractors must be plausible and come from real misconceptions. Similar length
and style to the answer. Never "all of the above" / "none of the above".
Exactly one option is correct under every reasonable reading.

### `output` - Predict the Output

`code` (required), `options` (the possible outputs, exactly as printed), `answer`.
- The code is **run automatically in CI** and the marked option must equal the real
  output (trailing spaces and trailing blank lines are ignored; multi-line output
  is a YAML string with `\n` or a `|` block). Exactly one option may equal it.
- If the program raises/throws, the correct option is the printed lines followed by
  the exception class name on its own last line, e.g. `"1\n2\nZeroDivisionError"`
  or just `"TypeError"`.
- Deterministic only: no randomness, time, input, file or network access, no
  `id()`/hash/memory addresses, no printing sets of strings, no threading races.
- 3-15 lines of code. Every line must matter to the answer.
- Distractors are the outputs of the most common wrong mental models.
- C#: write a modern `Program.cs` - top-level statements, then any type declarations
  after them (see the C# section). Implicit usings are on.
- A program that is supposed to **fail to compile** (C#) or have a SyntaxError
  (Python): tag `compile-error`; the correct option says so in Hebrew
  (`"שגיאת קומפילציה"`). The verifier checks that it really fails.

### `bug` - Find the Bug

`code` (required), `answer` = 1-based line number of the single buggy line,
optional `fixed` (the corrected full code, shown after answering; strongly recommended).
- Exactly one line is wrong; fixing that line alone fixes the program.
- The prompt states what the code is **supposed** to do, and always ends with
  `איזו שורה צריך לתקן?` (never "where is the bug"). `answer` is the line to change,
  which is not always the line where the program crashes or throws: e.g. a `catch`
  of the wrong exception type is fixed on the `catch` line, not on the `int.Parse` line.
- The bug should be a realistic logic bug (off-by-one, wrong operator, wrong
  variable, mutable default, missing `return`, wrong comparison...). The code must
  still parse/compile unless tagged `compile-error`.
- Count lines from the first line of `code` (no leading blank line).

### `order` - Code Ordering (Parsons problem)

The learner gets the lines of a short program shuffled (each line keeps its indentation)
and moves them back into the order that prints the goal output. Tag `algorithm`; use it
for real algorithms (swap, digits, max, counting, sorting, search, recursion...).

```yaml
- id: py.control-flow.for-loops.017
  type: order
  difficulty: 1
  tags: [algorithm]
  prompt: סדרו את השורות כך שהתוכנית תחשב 5 עצרת (1·2·3·4·5).
  code: |            # the CORRECT program, 4-18 lines, no blank lines
    n = 5
    result = 1
    for i in range(1, n + 1):
        result *= i
    print(result)
  output: "120"      # exact output, shown to the learner as the goal; verified in CI
  anyOrder: [[1, 2]] # optional: parts whose order does not matter
  explanation: ...
```

- The prompt starts with `סדרו את השורות כך ש...` and says what the program computes.
- `output` must be what the code prints (checked like `output` questions).
- **Exactly one arrangement may be correct**, apart from what `anyOrder` declares.
  The verifiers try every move of one line or of a block of up to 4 lines and every swap
  of two lines; if any of them prints the same output, the build fails. Fix it by
  declaring the freedom in `anyOrder` or by changing the code (combine independent
  assignments into one line, choose input values that exercise every branch, make
  every call change the state, print a value that depends on the order).
- `anyOrder` is a list of groups. A group lists adjacent units, in line order; a unit is a
  1-based line number or an inclusive range `[from, to]`. `[[1, 2]]`: the first two lines
  may swap. `[[[2, 3], [4, 6]]]`: two methods may swap. A group may sit inside one unit
  of another group (methods that swap inside a class that swaps with another class).
  At most 720 accepted orders in total.
- Lines are compared by text, so identical lines (two `}` at the same depth) are interchangeable.
- C#: indentation does not change the meaning, but learners place lines by their look, so
  the verifier ignores arrangements that are visibly mis-indented, open a bare or empty
  block, or leave unreachable code after `break`/`return`. Use Allman braces and
  4-space indentation. Local functions can sit anywhere among top-level statements, so
  use them only with a single statement before them (declare that with `anyOrder`),
  otherwise put the method in a class after the statements.
- Keep every line meaningful. No comments, no blank lines.

### `truefalse` - True / False

`prompt` is a statement, `answer` is `true` or `false`. Optional `code`.
The statement must be unambiguously true or false, not "usually". Aim for a
balance of true and false answers in each file.

### `smell` - Code Smell

`code` (required), `options` = names of smells / problems, `answer`.
Options written "עברית - English": "מספר קסם - Magic Number",
"מתודה ארוכה - Long Method", "קינון עמוק - Deep Nesting", "מחלקת אל - God Class",
"שכפול קוד - Duplicated Code", "רשימת פרמטרים ארוכה - Long Parameter List",
"שם לא ברור - Unclear Name", "אובססיית טיפוסים פרימיטיביים - Primitive Obsession",
"קנאת תכונות - Feature Envy", "הערה מיותרת - Redundant Comment",
"קוד מת - Dead Code", "תופעת לוואי נסתרת - Hidden Side Effect", "דגל בוליאני - Flag Argument".
The code should have one dominant smell. The explanation says how to fix it.

### `cleaner` - Cleaner Code

`options` = 2-3 **code snippets** doing the same thing, `answer` = the cleanest.
All options must be correct code with identical behaviour; only readability /
design differs. Each option must parse/compile on its own (or tag `pseudo`).
`optionExplanations` for each wrong option: which principle it breaks.

### `architecture` - Architecture Assembly

The learner gets a requirement, full signatures and file names, and places each
signature in the file it belongs to. This is a flagship question type; make it real.

```yaml
- id: py.software-design.architecture-assembly.003
  type: architecture
  difficulty: 3
  prompt: שבצו כל חתימה בקובץ שאליו היא שייכת.
  requirement: "<Hebrew requirement, 1-3 sentences, realistic domain>"
  targets:            # 3-6 files (or classes / layers), each with a short Hebrew desc
    - id: models.py
      desc: מחלקות הנתונים
    - id: repository.py
      desc: גישה למסד הנתונים
  items:              # 4-8 FULL signatures with type hints / types
    - label: "def find_user(user_id: int) -> User | None"
      answer: repository.py
      why: "<Hebrew: why it belongs there>"
  explanation: "<the principle: responsibility of each layer and dependency direction>"
```
- Signatures are complete: name, parameters with types, return type
  (Python type hints; C# full method signature `public Order PlaceOrder(int customerId, IReadOnlyList<CartItem> items)`,
  class declarations `public class Order`).
- Every item has exactly one defensible correct file. Every item has `why`.
- Vary domains: e-commerce, library, clinic appointments, school grades, parking,
  chat, bank, food delivery, task manager, weather alerts, inventory...
- Vary architectures: layered (UI / service / repository / models), MVC,
  ports-and-adapters, module per feature, events/notifications, validation and
  utils modules, tests file (`test_*.py` / `*Tests.cs`).
- C# targets are files like `Models/Order.cs`, `Services/OrderService.cs`,
  `Data/OrderRepository.cs`, `Controllers/OrdersController.cs`, `Interfaces/IOrderRepository.cs`.

### `hierarchy` - Class Relationships

Same `targets`/`items` shape. Two common forms:
1. relation kind: targets `is-a` (desc "ירושה - Inheritance"), `has-a` (desc
   "הרכבה - Composition"), sometimes `implements` (desc "מימוש ממשק - Implements")
   or `uses` (desc "שימוש - Dependency"); items are pairs written `"Car ו-Engine"`.
2. parent class: `code` shows a set of classes; targets are possible parents
   (including an option like `"object (אין מחלקת בסיס מפורשת)"`); items are class names.
Every item needs exactly one correct target; add `why` where it teaches something.

## Code rules

- Python 3.12. C# 12 / .NET 8.
- 4-space indentation, idiomatic style (PEP 8 / Microsoft conventions) - except
  when the *point* of the question is bad style.
- Every code snippet is checked automatically: Python code must parse; C# code
  must compile (in addition, `output` snippets are executed). A deliberately
  incomplete fragment that cannot compile must be tagged `pseudo`; avoid that.
- **C# snippet forms** the verifier accepts:
  1. top-level statements, optionally followed by type declarations (preferred);
  2. a full program with `static void Main`;
  3. only type declarations (for non-output questions).
  A method on its own with an access modifier (`public int Add(...)`) at top level
  does NOT compile; wrap it in a class.
  Implicit usings: `System`, `System.Linq`, `System.Collections.Generic`,
  `System.IO`, `System.Threading.Tasks`, `System.Net.Http`. Add other `using`s at the top.
  Culture is invariant (decimal point is `.`). `Nullable` is disabled.
- Keep code short: ≤ 15 lines for most questions, ≤ 30 for architecture/design.

## YAML rules

- Code goes in literal blocks: `code: |`.
- Quote any scalar containing `:`, `#`, `"`, `'`, `` ` `` at start, `[`, `{`, `*`, `&`, `!`, `|`, `>`, `%`, `@`.
  When in doubt, double-quote and escape inner `"` as `\"`.
- Multi-line options: use `- |` blocks.
- `optionExplanations` keys are quoted strings: `"1":`.
- One blank line between questions.

## Self-review checklist (do this for every question before finishing)

1. Is the marked answer correct? Run it in your head line by line, then run the
   verifier. For C# you cannot run locally: trace it twice, carefully.
2. Is every distractor definitely wrong? Could a strict reviewer argue for another option?
3. Does the explanation teach the concept and name the misconception?
4. Is the Hebrew correct, short and clear? Are English terms added on first use?
5. Is it inside the topic and not a duplicate of another question in the file?
6. Is the difficulty label honest?

## Commands

```
CONTENT_ONLY=python/strings npm run validate        # schema + semantic checks for one chapter
CONTENT_ONLY=python/strings npm run verify:python   # runs the Python snippets of one chapter
npm run validate -- --strict                         # everything, incl. 15-question minimum
npm run verify:csharp                                # needs the .NET 8 SDK (runs in CI)
npm run stats                                        # counts per topic and type
```
