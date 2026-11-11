import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../store.js';
import { BillService } from '../service.js';

const home = await mkdtemp(join(tmpdir(), 'billremind-force-'));
process.env.DSH_HOME = home;

try {
  const a = new BillService(new Store());
  const b = new BillService(new Store());
  await a.addCard({ alias: 'Force卡', statementDay: 10, repaymentDay: 20, annualFeeMonth: 5, annualFeeDay: 10 });
  const initial = await a.snapshot();
  const id = initial.cards[0].id;
  await a.updateCard(id, { billAmount: 100, expectedRevision: initial.revision });

  await assert.rejects(
    () => b.updateCard(id, { billAmount: 200, expectedRevision: initial.revision }),
    (error) => error.code === 'VERSION_CONFLICT' && error.status === 409 && error.forceRequired === true
      && error.expectedRevision === initial.revision && error.currentRevision === 2,
  );
  await assert.rejects(
    () => b.updateCard(id, { billAmount: 200, expectedRevision: initial.revision, force: true }),
    (error) => error.code === 'FORCE_CONFIRM_REQUIRED' && error.status === 400 && error.currentRevision === 2,
  );
  const forced = await b.updateCard(id, {
    billAmount: 200,
    expectedRevision: initial.revision,
    force: true,
    force_confirm: true,
  });
  assert.equal(forced.cards[0].billAmount, 200);
  assert.equal(forced.revision, 3);

  // Legacy requests without a revision remain compatible.
  const legacy = await b.updateCard(id, { billAmount: 300 });
  assert.equal(legacy.cards[0].billAmount, 300);
  console.log('force tests: ok');
} finally {
  await rm(home, { recursive: true, force: true });
}
