// Quick check against the numbers in the design mockup: node src/lib/split.test.mjs
import { splitByOrder, splitEqually } from './split.js';
const M = ['B', 'R', 'P', 'T', 'Y'].map((id) => ({ id }));
const items = [
  { name: '4 pc Chickenjoy Family Box', amount: 180, sharedBy: ['B', 'R', 'P', 'T'] },
  { name: 'Burger Steak w/ Drink', amount: 160, sharedBy: ['Y'] },
  { name: 'Regular Fries w/ Coke Float', amount: 150, sharedBy: ['T'] },
  { name: 'Iced Mocha Float', amount: 120, sharedBy: ['R'] },
  { name: '10 pc Chicken Nuggets Solo', amount: 0, sharedBy: ['B', 'R', 'P', 'T', 'Y'] },
];
const r = splitByOrder(items, M, 40, 0);
const got = r.shares.map((s) => s.total.toFixed(2)).join(' ');
const want = '47.95 175.82 47.95 207.79 170.49';
console.log(got === want ? 'by order OK' : `by order FAIL: ${got}`, r.receipt, r.balanced);
console.log(splitEqually(650, M).map((s) => s.total).join(' '), '|', splitEqually(100, M.slice(0, 3)).map((s) => s.total).join(' '));
