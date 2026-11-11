import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../store.js';
import { BillService } from '../service.js';

const home = await mkdtemp(join(tmpdir(), 'billremind-conflict-'));
process.env.DSH_HOME = home;

const cardInput = {
  alias: '冲突测试卡',
  statementDay: 10,
  repaymentDay: 20,
  annualFeeMonth: 5,
  annualFeeDay: 10,
};

try {
  const first = new BillService(new Store());
  const second = new BillService(new Store());
  await first.addCard(cardInput);

  const initial = await first.snapshot();
  assert.equal(initial.revision, 1);
  const id = initial.cards[0].id;

  const updated = await first.updateCard(id, { billAmount: 100, expectedRevision: initial.revision });
  assert.equal(updated.revision, 2);

  await assert.rejects(
    () => second.updateCard(id, { billAmount: 200, expectedRevision: initial.revision }),
    (error) => error.code === 'VERSION_CONFLICT'
      && error.status === 409
      && error.currentRevision === 2,
  );

  const afterConflict = await second.snapshot();
  assert.equal(afterConflict.cards[0].billAmount, 100);
  assert.equal(afterConflict.revision, 2);

  // Omitting expectedRevision preserves legacy behavior.
  const legacy = await second.updateCard(id, { billAmount: 300 });
  assert.equal(legacy.revision, 3);
  assert.equal(legacy.cards[0].billAmount, 300);

  await assert.rejects(
    () => first.updateCard(id, { billAmount: 400, expectedRevision: -1 }),
    (error) => error.status === 400 && /expectedRevision/.test(error.message),
  );

  console.log('conflict tests: ok');
} finally {
  await rm(home, { recursive: true, force: true });
}
