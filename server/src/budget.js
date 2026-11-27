export const TEMPLATES = {
  wedding: {
    venue: 20, 'aso-ebi': 23, food: 18, photography: 12,
    makeup: 9, decoration: 10, miscellaneous: 8,
  },
  birthday: { venue: 25, food: 35, decoration: 15, photography: 10, dj: 10, miscellaneous: 5 },
  graduation: { venue: 20, food: 30, photography: 20, 'aso-ebi': 15, miscellaneous: 15 },
  party: { venue: 30, food: 35, dj: 15, decoration: 10, miscellaneous: 10 },
};

export const SMALL_BUDGET_THRESHOLD = 200_000;

function collapseForSmallBudget(template) {
  const t = { ...template };
  if (t.makeup !== undefined) {
    t.miscellaneous = (t.miscellaneous || 0) + t.makeup;
    delete t.makeup;
  }
  if (t.decoration !== undefined) {
    t.miscellaneous = (t.miscellaneous || 0) + t.decoration;
    delete t.decoration;
  }
  return t;
}

export function allocateBudget(type, total) {
  const base = TEMPLATES[type];
  if (!base) throw new Error(`Unknown event type: ${type}`);
  if (!Number.isFinite(total) || total <= 0) throw new Error('Budget must be a positive number');

  const template = total < SMALL_BUDGET_THRESHOLD ? collapseForSmallBudget(base) : base;
  const entries = Object.entries(template);

  let allocated = entries.map(([category, pct]) => ({
    category,
    percent: pct,
    amount: Math.floor((total * pct) / 100),
  }));

  const remainder = total - allocated.reduce((s, c) => s + c.amount, 0);
  if (remainder !== 0) allocated[allocated.length - 1].amount += remainder;

  return allocated;
}

export function suggestRebalance(categories) {
  const over = categories.filter((c) => c.spent_amount > c.allocated_amount);
  const misc = categories.find((c) => c.category === 'miscellaneous');
  if (!over.length || !misc) return [];

  let available = Math.max(0, misc.allocated_amount - misc.spent_amount);
  const tips = [];
  for (const c of over) {
    const deficit = c.spent_amount - c.allocated_amount;
    const take = Math.min(deficit, available);
    if (take > 0) {
      tips.push({
        message: `You're ₦${deficit.toLocaleString()} over on ${c.category} — reduce miscellaneous by ₦${take.toLocaleString()} to stay on track.`,
        from: 'miscellaneous',
        to: c.category,
        amount: take,
      });
      available -= take;
    }
  }
  return tips;
}
