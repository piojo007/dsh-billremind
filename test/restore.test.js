import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../store.js';
import { BillService } from '../service.js';

const home = await mkdtemp(join(tmpdir(), 'billremind-restore-'));
process.env.DSH_HOME = home;
try {
  const service = new BillService(new Store());
  await service.addCard({ alias: '可恢复卡', statementDay: 10, repaymentDay: 20, annualFeeMonth: 5, annualFeeDay: 10, billAmount: 88 });
  const before = await service.snapshot();
  const removed = await service.removeCard(before.cards[0].id, { expectedRevision: before.revision });
  assert.ok(removed.restoreToken);
  const empty = await service.snapshot();
  assert.equal(empty.cards.length, 0);
  const restored = await service.restoreCard(removed.restoreToken, { expectedRevision: empty.revision });
  assert.equal(restored.cards[0].id, before.cards[0].id);
  assert.equal(restored.cards[0].billAmount, 88);
  await assert.rejects(() => service.restoreCard(removed.restoreToken, { expectedRevision: restored.revision }), /不存在或已使用/);
  console.log('restore tests: ok');
} finally {
  await rm(home, { recursive: true, force: true });
}
