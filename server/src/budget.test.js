import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateBudget, suggestRebalance } from './budget.js';

test('wedding ₦350,000 matches the spec table', () => {
  const r = allocateBudget('wedding', 350_000);
  const by = Object.fromEntries(r.map((c) => [c.category, c.amount]));
  assert.equal(by.venue, 70_000);
  assert.equal(by['aso-ebi'], 80_500);
  assert.equal(by.food, 63_000);
  assert.equal(by.photography, 42_000);
  assert.equal(by.makeup, 31_500);
  assert.equal(by.decoration, 35_000);
  assert.equal(by.miscellaneous, 28_000);
});

test('allocation always sums exactly to the total', () => {
  for (const type of ['wedding', 'birthday', 'graduation', 'party']) {
    for (const total of [99_999, 150_001, 350_000, 1_234_567]) {
      const sum = allocateBudget(type, total).reduce((s, c) => s + c.amount, 0);
      assert.equal(sum, total, `${type} ${total}`);
    }
  }
});

test('small budgets collapse makeup and decoration into miscellaneous', () => {
  const r = allocateBudget('wedding', 150_000);
  const cats = r.map((c) => c.category);
  assert.ok(!cats.includes('makeup'));
  assert.ok(!cats.includes('decoration'));
  assert.equal(r.find((c) => c.category === 'miscellaneous').percent, 27);
});

test('rejects bad input', () => {
  assert.throws(() => allocateBudget('funeral', 100_000));
  assert.throws(() => allocateBudget('wedding', -5));
});

test('rebalance suggests trimming miscellaneous', () => {
  const tips = suggestRebalance([
    { category: 'decoration', allocated_amount: 35_000, spent_amount: 50_000 },
    { category: 'miscellaneous', allocated_amount: 28_000, spent_amount: 0 },
  ]);
  assert.equal(tips.length, 1);
  assert.equal(tips[0].amount, 15_000);
});
