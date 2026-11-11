import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store, BACKUP_KIND } from '../store.js';
import { BillService } from '../service.js';

test('backup export/import validates envelope and advances revision monotonically', async () => {
  const root = await mkdtemp(join(tmpdir(), 'billremind-backup-'));
  const previous = process.env.DSH_HOME;
  process.env.DSH_HOME = root;
  try {
    const service = new BillService(new Store());
    await service.addCard({ alias: '测试卡', statementDay: 1, repaymentDay: 15, annualFeeMonth: 6, annualFeeDay: 1 });
    const backup = await service.exportBackup();
    assert.equal(backup.kind, BACKUP_KIND);
    assert.equal(backup.version, 1);
    assert.equal(backup.revision, 1);
    assert.equal(backup.state.cards[0].alias, '测试卡');

    backup.state.cards[0].alias = '恢复卡';
    const restored = await service.importBackup(backup);
    assert.equal(restored.revision, 2);
    assert.equal((await service.snapshot()).cards[0].alias, '恢复卡');
    const persisted = JSON.parse(await readFile(join(root, 'billremind', 'state.json'), 'utf8'));
    assert.equal(persisted.revision, 2);
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previous;
  }
});

test('backup rejects prototype pollution and sensitive audit payloads', async () => {
  const store = new Store();
  const valid = { kind: BACKUP_KIND, version: 1, revision: 0, state: { version: 1, revision: 0, defaults: { repayAdvanceDays: 3, annualAdvanceDays: 30 }, cards: [] } };
  const polluted = JSON.parse('{"kind":"dsh-billremind-backup","version":1,"revision":0,"state":{"version":1,"revision":0,"defaults":{"repayAdvanceDays":3,"annualAdvanceDays":30},"cards":[]},"__proto__":{"polluted":true}}');
  await assert.rejects(() => store.importBackup(polluted), (err) => err.code === 'BACKUP_INVALID');
  await assert.rejects(() => store.importBackup({ ...valid, auditPayload: { token: 'secret' } }), (err) => err.code === 'BACKUP_INVALID');
  await assert.rejects(() => store.importBackup({ ...valid, state: { ...valid.state, constructor: {} } }), (err) => err.code === 'BACKUP_INVALID');
  await assert.rejects(() => store.importBackup({ ...valid, kind: 'other' }), (err) => err.code === 'BACKUP_INVALID');
});
