import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, stat, utimes } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../store.js';

async function withHome(fn) {
  const root = await mkdtemp(join(tmpdir(), 'billremind-lock-'));
  const previous = process.env.DSH_HOME;
  process.env.DSH_HOME = root;
  try { return await fn(root); } finally {
    if (previous === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previous;
  }
}

test('lock lease heartbeat keeps a long transaction from looking stale', async () => {
  await withHome(async () => {
    const store = new Store();
    await store.acquireLock();
    try {
      const before = (await stat(store.lock)).mtimeMs;
      await new Promise((resolve) => setTimeout(resolve, 5_200));
      const after = (await stat(store.lock)).mtimeMs;
      assert.ok(after > before, `expected lease mtime ${after} > ${before}`);
    } finally {
      await store.releaseLock();
    }
  });
});

test('stale residual lock is safely reclaimed', async () => {
  await withHome(async () => {
    const store = new Store();
    await mkdir(store.lock, { recursive: true });
    await utimes(store.lock, new Date(Date.now() - 60_000), new Date(Date.now() - 60_000));
    await store.acquireLock();
    assert.ok(store.lockToken);
    await store.releaseLock();
    await assert.rejects(() => stat(store.lock), (err) => err.code === 'ENOENT');
  });
});
