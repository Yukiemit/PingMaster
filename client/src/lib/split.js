// Bill-splitting math. All work happens in centavos so shares always add up exactly.
const toC = (n) => Math.round((Number(n) || 0) * 100);
export const fromC = (c) => c / 100;

// Split `totalC` centavos across weights; leftover centavos go to the largest remainders.
export function allocate(totalC, weights) {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (!sum) return weights.map(() => 0);
  const raw = weights.map((w) => (totalC * w) / sum);
  const out = raw.map((r) => Math.trunc(r));
  let left = totalC - out.reduce((s, v) => s + v, 0);
  const order = raw.map((r, i) => [Math.abs(r - Math.trunc(r)), i]).sort((a, b) => b[0] - a[0]);
  const step = Math.sign(left);
  for (let k = 0; left !== 0 && k < order.length * 2; k++) {
    out[order[k % order.length][1]] += step;
    left -= step;
  }
  return out;
}

export function splitEqually(total, members) {
  const shares = allocate(toC(total), members.map(() => 1));
  return members.map((m, i) => ({ id: m.id, total: fromC(shares[i]), lines: [{ label: 'Equal share', amount: fromC(shares[i]) }] }));
}

/**
 * items: [{ id, name, amount, sharedBy: [memberId] }]
 * extra charges and discount are spread in proportion to each person's items.
 */
export function splitByOrder(items, members, extra = 0, discount = 0) {
  const itemC = Object.fromEntries(members.map((m) => [m.id, 0]));
  const lines = Object.fromEntries(members.map((m) => [m.id, []]));
  let subtotalC = 0;
  let unassigned = 0;

  for (const it of items) {
    const amt = toC(it.amount);
    subtotalC += amt;
    const who = it.sharedBy.filter((id) => id in itemC);
    if (!who.length) { if (amt > 0) unassigned += 1; continue; }
    const parts = allocate(amt, who.map(() => 1));
    who.forEach((id, i) => {
      itemC[id] += parts[i];
      lines[id].push({ label: it.name || 'Untitled item', amount: fromC(parts[i]), shared: who.length > 1 });
    });
  }

  const adjC = toC(extra) - toC(discount);
  const adj = allocate(adjC, members.map((m) => itemC[m.id]));
  const result = members.map((m, i) => {
    const l = [...lines[m.id]];
    if (adjC !== 0 && itemC[m.id] > 0) l.push({ label: 'Charges - discounts', amount: fromC(adj[i]), muted: true });
    return { id: m.id, total: fromC(itemC[m.id] + adj[i]), lines: l };
  });

  const receiptC = subtotalC + adjC;
  const assignedC = result.reduce((s, r) => s + toC(r.total), 0);
  return { shares: result, subtotal: fromC(subtotalC), receipt: fromC(receiptC), unassigned, balanced: assignedC === receiptC };
}
