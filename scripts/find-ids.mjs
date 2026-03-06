import { readFileSync } from 'fs';
const content = readFileSync('src/lib/ingredient-data.ts', 'utf8');
const match = content.match(/export const USDA_INGREDIENTS.*?= (\[.*?\]);/s);
if (!match) { console.log('no match'); process.exit(1); }
const data = JSON.parse(match[1]);
const searches = [
  'egg, whole', 'oats', 'milk, whole', 'yogurt, greek', 'blueberr',
  'banana', 'chicken, breast', 'rice, white', 'broccoli', 'salmon',
  'sweet potato', 'avocado', 'bread, whole', 'peanut butter', 'spinach, raw',
  'almonds', 'olive oil'
];
for (const s of searches) {
  const found = data.filter(d => d.name.toLowerCase().includes(s));
  if (found.length > 0) {
    console.log(`${s} => ${found.map(f => `${f.fdcId}="${f.name}"`).join(' | ')}`);
  } else {
    console.log(`${s} => NOT FOUND`);
  }
}
