// THROWAWAY SPIKE (2026-10-18): proves a rule-based parser handles English + Taglish routing phrases.
// Not production code. Building prefixes are PLACEHOLDERS. Run: node docs/spikes/ask-parser-spike.mjs
// Spike: rule-based "where am I / where to" parser. No model, no network, ~3 KB.
const BUILDINGS = { // prefixes are PLACEHOLDERS until official codes are confirmed
  andrew: { prefix: ['B','AG','A'], names: ['andrew','br. andrew','agh','andrew gonzalez'] },
  gokongwei: { prefix: ['G','GK'], names: ['gokongwei','gk','goks'] },
  velasco: { prefix: ['V'], names: ['velasco'] },
  henrysy: { prefix: ['H','HS'], names: ['henry sy','henry','library','hsh'] },
  miguel: { prefix: ['M','C'], names: ['miguel','st. miguel'] },
};
// ground:1 is also a PLACEHOLDER: OSM counts the ground floor as level 0 and DLSU's naming is unconfirmed (D4)
const ORD = { first:1,second:2,third:3,fourth:4,fifth:5,sixth:6,seventh:7,eighth:8,ninth:9,tenth:10, ground:1, una:1, ikalawa:2, ikatlo:3 };
const AMEN = { cr:'cr', restroom:'cr', comfort:'cr', banyo:'cr', toilet:'cr', elevator:'elevator', elev:'elevator', lift:'elevator', stairs:'stairs', hagdan:'stairs', canteen:'canteen', 'water':'water' };
const ENTR = { main:'main', front:'main', side:'side', back:'back', rear:'back', likod:'back', harap:'main', gilid:'side' };
// Cue words split the sentence into a FROM part and a TO part (English + Filipino/Taglish)
const FROM_CUES = /\b(i am|i'm|im|am|nasa|andito|nandito|from|galing|starting|near|at)\b/;
const TO_CUES = /\b(to|go to|going to|papunta(?:ng)?|pupunta|punta|where is|saan ang|saan yung|how do i get to|find|hanapin)\b/;

function entity(text) {
  const t = text.toLowerCase(); const e = {};
  const code = text.toUpperCase().match(/\b([A-Z]{1,3})\s?-?(\d{3,4})\b/);
  if (code) { e.room = code[1] + code[2];
    for (const [id,b] of Object.entries(BUILDINGS)) if (b.prefix.includes(code[1])) e.building = id; }
  for (const [id,b] of Object.entries(BUILDINGS)) if (b.names.some(n => t.includes(n))) e.building ??= id;
  const fl = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s*(?:f|fl|floor|flr)\b/) || t.match(/\bfloor\s*(\d{1,2})\b/);
  if (fl) e.floor = +fl[1]; else for (const [w,n] of Object.entries(ORD)) if (new RegExp(`\\b${w}\\b`).test(t)) e.floor = n;
  for (const [w,a] of Object.entries(AMEN)) if (new RegExp(`\\b${w}\\b`).test(t)) e.amenity = a;
  for (const [w,x] of Object.entries(ENTR)) if (new RegExp(`\\b${w}\\b`).test(t) && /entrance|exit|gate|pasukan|labasan|door/.test(t)) e.entrance = x;
  return Object.keys(e).length ? e : null;
}
export function parse(q) {
  const t = q.toLowerCase();
  const toM = t.match(TO_CUES);
  let fromTxt = t, toTxt = '';
  if (toM) { fromTxt = t.slice(0, toM.index); toTxt = t.slice(toM.index + toM[0].length); }
  // "papunta G304, nasa B305 ako" → order can be reversed
  if (toM && FROM_CUES.test(toTxt) && !FROM_CUES.test(fromTxt)) { const m = toTxt.match(FROM_CUES); fromTxt = toTxt.slice(m.index); toTxt = toTxt.slice(0, m.index); }
  const from = FROM_CUES.test(fromTxt) ? entity(fromTxt) : null;
  const to = toM ? entity(toTxt) : (from ? null : entity(t)); // a bare code = destination
  return { from, to, needsHelp: !to && !from };
}
const tests = [
  'I am near B305 and I want to go to G304',
  'nasa AG1104 ako, papuntang G304',
  'papunta G304, nasa B305 ako',
  'from the back entrance of gokongwei to velasco 3rd floor',
  "I'm at Andrew 5th floor, where is the nearest CR",
  'saan yung elevator sa henry sy',
  'G304',
  'how do i get to the library',
  'hello',
];
// Known failures found in review (DECISIONS.md D9). Kept here so the Phase 3 parser is tested against them.
const knownFailures = [
  'pano pumunta sa G304 galing B305',
  'G304 to B305',
  'B305 papuntang G304',
  'nasa 3rd floor ako ng velasco, saan CR',
  'where is the CR at Andrew 5th floor',
];
for (const s of tests) console.log(s.padEnd(58), JSON.stringify(parse(s)));
console.log('\n--- known failures (expected to be wrong) ---');
for (const s of knownFailures) console.log(s.padEnd(58), JSON.stringify(parse(s)));
