import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nextMonthlyDate, formatDate } from '../dates.js';
import { Store } from '../store.js';
import { BillService } from '../service.js';
import { createBillTool } from '../tools.js';

const home = await mkdtemp(join(tmpdir(), 'billremind-test-'));
process.env.DSH_HOME = home;

try {
  const service = new BillService(new Store());
  const now = new Date('2026-11-10T10:00:00+08:00');

  assert.equal(formatDate(nextMonthlyDate(31, new Date('2026-02-01T10:00:00+08:00'))), '2026-02-28');
  assert.equal(formatDate(nextMonthlyDate(10, new Date('2026-11-09T16:30:00Z'))), '2026-11-10');

  await service.addCard({
    alias: '招行 Visa',
    statementDay: 15,
    repaymentDay: 25,
    annualFeeMonth: 8,
    annualFeeDay: 15,
    billAmount: 1234.56,
  });
  await assert.rejects(
    () => service.addCard({ alias: ' 招行   Visa ', statementDay: 1, repaymentDay: 2, annualFeeMonth: 1, annualFeeDay: 3 }),
    /同名卡片/,
  );

  const overdueBill = service.currentBill({ statementDay: 1, repaymentDay: 5, billAmount: 0 }, now);
  assert.equal(overdueBill.status, 'overdue');

  const snap = await service.snapshot(now);
  assert.equal(snap.cards.length, 1);
  assert.ok(snap.revision >= 1);
  assert.ok(Array.isArray(snap.attention));
  assert.equal(snap.cards[0].bill.amount, 1234.56);
  assert.equal(snap.cards[0].reminderSource.repayment, 'inherit');
  assert.equal(snap.cards[0].effectiveRepayAdvanceDays, 3);
  assert.equal(snap.cards[0].nodes.every((node) => node.status), true);

  await service.addCard({ alias: '显式默认', statementDay: 11, repaymentDay: 21, annualFeeMonth: 9, annualFeeDay: 11, repayAdvanceDays: 3, annualAdvanceDays: 30 });
  const explicitSnapshot = await service.snapshot(now);
  const explicit = explicitSnapshot.cards.find((card) => card.alias === '显式默认');
  assert.equal(explicit.reminderSource.repayment, 'custom');
  assert.equal(explicit.reminderSource.annual, 'custom');

  const concurrentA = new BillService(new Store());
  const concurrentB = new BillService(new Store());
  await Promise.all([
    concurrentA.addCard({ alias: '并发 A', statementDay: 2, repaymentDay: 6, annualFeeMonth: 2, annualFeeDay: 3 }),
    concurrentB.addCard({ alias: '并发 B', statementDay: 3, repaymentDay: 7, annualFeeMonth: 3, annualFeeDay: 4 }),
  ]);
  const concurrentSnapshot = await new BillService(new Store()).snapshot(now);
  assert.equal(concurrentSnapshot.cards.length, 4);
  assert.ok(concurrentSnapshot.cards.some((card) => card.alias === '并发 A'));
  assert.ok(concurrentSnapshot.cards.some((card) => card.alias === '并发 B'));

  await service.addCard({ alias: '逾期卡', statementDay: 1, repaymentDay: 5, annualFeeMonth: 1, annualFeeDay: 3 });
  const attentionSnapshot = await service.snapshot(now);
  const overdueRepaymentItems = attentionSnapshot.attention.filter((item) => item.alias === '逾期卡' && item.type === 'repayment');
  assert.equal(overdueRepaymentItems.length, 1);

  await service.addCard({ alias: 'A|B', statementDay: 1, repaymentDay: 5, annualFeeMonth: 1, annualFeeDay: 3 });
  const tool = createBillTool(service);
  const rendered = await tool.execute({ action: 'list' });
  assert.match(rendered.markdown, /A\\\|B/);

  await service.setAdvance(null, { repayAdvanceDays: 10 });
  const afterDefault = await service.snapshot(now);
  assert.equal(afterDefault.defaults.repayAdvanceDays, 10);
  assert.equal(afterDefault.cards[0].repayAdvanceDays, 10);
  assert.equal(afterDefault.cards[0].effectiveRepayAdvanceDays, 10);
  const explicitAfterDefault = afterDefault.cards.find((card) => card.alias === '显式默认');
  assert.equal(explicitAfterDefault.repayAdvanceDays, 3);
  assert.equal(explicitAfterDefault.effectiveRepayAdvanceDays, 3);

  const corruptFile = join(home, 'billremind', 'state.json');
  await writeFile(corruptFile, JSON.stringify({ version: 1, revision: 99, defaults: { repayAdvanceDays: 7, annualAdvanceDays: 20 }, cards: [{ id: 'legacy', alias: '旧卡', statementDay: 1, repaymentDay: 2, annualFeeMonth: 1, annualFeeDay: 3, repayAdvanceDays: 7, annualAdvanceDays: 20 }] }), 'utf8');
  const legacyStore = new Store();
  const legacyState = await legacyStore.read();
  assert.deepEqual(legacyState.cards[0].reminderModes, { repayment: 'custom', annual: 'custom' });
  await writeFile(corruptFile, '{broken', 'utf8');
  const corruptStore = new Store();
  await assert.rejects(() => corruptStore.read(), (error) => error.code === 'STATE_CORRUPT');

  console.log('billremind tests: ok');
} finally {
  await rm(home, { recursive: true, force: true });
}
