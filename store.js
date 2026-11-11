// 本地持久化：JSON 文件 + 原子写入 + 进程内串行队列 + mtime 复读。
// 数据落在 $DSH_HOME（或 DSH_PROFILE_DIR）下的 billremind/state.json，重启后自动恢复。

import { mkdir, readFile, rename, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function dshHome(env = process.env) {
  return env.DSH_HOME || env.DSH_PROFILE_DIR || join(homedir(), '.dsh');
}

function buildSeed() {
  return {
    version: 1,
    revision: 0,
    defaults: { repayAdvanceDays: 3, annualAdvanceDays: 30 },
    cards: [],
    trash: [],
  };
}

const BACKUP_KIND = 'dsh-billremind-backup';
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const SENSITIVE_AUDIT_KEYS = new Set(['audit', 'auditPayload', 'audit_payload', 'token', 'secret', 'password', 'authorization']);

function inspectObject(value, path = 'root') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) throw Object.assign(new Error(`备份包含禁止字段：${path}.${key}`), { code: 'BACKUP_INVALID', status: 400 });
    if (SENSITIVE_AUDIT_KEYS.has(key)) throw Object.assign(new Error(`备份包含敏感审计字段：${path}.${key}`), { code: 'BACKUP_INVALID', status: 400 });
    inspectObject(child, `${path}.${key}`);
  }
}

export function validateBackupEnvelope(envelope) {
  inspectObject(envelope);
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)
    || envelope.kind !== BACKUP_KIND || envelope.version !== 1
    || !Number.isSafeInteger(envelope.revision) || envelope.revision < 0
    || !envelope.state || typeof envelope.state !== 'object' || Array.isArray(envelope.state)) {
    throw Object.assign(new Error('备份 envelope 无效'), { code: 'BACKUP_INVALID', status: 400 });
  }
  const raw = envelope.state;
  const ids = new Set();
  const aliases = new Set();
  const duplicateCard = Array.isArray(raw.cards) && raw.cards.some((card) => {
    if (!validCardShape(card)) return true;
    const aliasKey = card.alias.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
    if (ids.has(card.id) || aliases.has(aliasKey)) return true;
    ids.add(card.id);
    aliases.add(aliasKey);
    return false;
  });
  if (raw.version !== 1 || !Array.isArray(raw.cards) || !raw.defaults || typeof raw.defaults !== 'object'
    || raw.revision !== envelope.revision
    || !validInt(raw.defaults.repayAdvanceDays, 0, 60)
    || !validInt(raw.defaults.annualAdvanceDays, 0, 365)
    || duplicateCard) {
    throw Object.assign(new Error('备份 state 结构无效'), { code: 'BACKUP_INVALID', status: 400 });
  }
  const state = migrateState(raw);
  return state;
}

export { BACKUP_KIND };

/** 本期账单金额：统一保留两位小数的非负数；非法值一律丢弃（不臆造金额）。 */
function normalizeAmount(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100) / 100;
}

function validInt(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

const REMINDER_MODES = new Set(['inherit', 'custom']);

function validReminderMode(value) {
  return REMINDER_MODES.has(value);
}

function reminderModesFor(card) {
  const modes = card?.reminderModes;
  if (modes && validReminderMode(modes.repayment) && validReminderMode(modes.annual)) {
    return { repayment: modes.repayment, annual: modes.annual };
  }
  const source = card?.source || card?.reminderSource;
  if (typeof source === 'string' && validReminderMode(source)) {
    return { repayment: source, annual: source };
  }
  if (source && validReminderMode(source.repayment) && validReminderMode(source.annual)) {
    return { repayment: source.repayment, annual: source.annual };
  }
  // 旧卡的提醒字段来源不明，保守视为 custom，避免全局设置改变历史语义。
  return { repayment: 'custom', annual: 'custom' };
}

function validCardShape(card) {
  return card
    && typeof card === 'object'
    && typeof card.id === 'string'
    && typeof card.alias === 'string'
    && card.alias.trim()
    && validInt(card.statementDay, 1, 31)
    && validInt(card.repaymentDay, 1, 31)
    && validInt(card.annualFeeMonth, 1, 12)
    && validInt(card.annualFeeDay, 1, 31)
    && validInt(card.repayAdvanceDays, 0, 60)
    && validInt(card.annualAdvanceDays, 0, 365);
}

function migrateState(state) {
  if (!state || typeof state !== 'object') return buildSeed();
  const cards = Array.isArray(state.cards)
    ? state.cards.filter(validCardShape)
    : [];
  const out = {
    version: 1,
    revision: Number.isInteger(state.revision) && state.revision >= 0 ? state.revision : 0,
    defaults: {
      repayAdvanceDays: validInt(state.defaults?.repayAdvanceDays, 0, 60) ? state.defaults.repayAdvanceDays : 3,
      annualAdvanceDays: validInt(state.defaults?.annualAdvanceDays, 0, 365) ? state.defaults.annualAdvanceDays : 30,
    },
    // 老数据没有 billAmount 字段：保持缺失状态，UI 显示「未录入」。
    cards: cards.map((c) => {
      const card = { ...c, reminderModes: reminderModesFor(c) };
      delete card.source;
      delete card.reminderSource;
      const amount = normalizeAmount(card.billAmount);
      if (amount === null) delete card.billAmount;
      else card.billAmount = amount;
      return card;
    }),
    trash: Array.isArray(state.trash) ? state.trash.filter((entry) =>
      entry && typeof entry === 'object'
      && typeof entry.token === 'string' && entry.token.length >= 16
      && typeof entry.deletedAt === 'string' && typeof entry.expiresAt === 'string'
      && validCardShape(entry.card),
    ).map((entry) => ({
      token: entry.token,
      deletedAt: entry.deletedAt,
      expiresAt: entry.expiresAt,
      card: { ...entry.card },
    })) : [],
  };
  return out;
}

export class Store {
  constructor() {
    this.root = join(dshHome(), 'billremind');
    this.file = join(this.root, 'state.json');
    this.lock = join(this.root, 'state.lock');
    this.queue = Promise.resolve();
    this.cache = null;
    this.mtimeMs = -1;
    this.lockToken = null;
    this.lockHeartbeat = null;
  }

  /** 串行执行任务，避免并发写互相覆盖。 */
  run(task) {
    const next = this.queue.then(task);
    this.queue = next.catch(() => {});
    return next;
  }

  /** 若磁盘文件比缓存新则重新读取。 */
  async refresh() {
    let info;
    try {
      info = await stat(this.file);
    } catch (err) {
      if (err?.code === 'ENOENT') {
        if (this.cache === null) this.cache = buildSeed();
        return;
      }
      const failure = new Error(`账单数据文件无法读取：${err.message}`);
      failure.code = 'STATE_READ_FAILED';
      throw failure;
    }
    if (info.mtimeMs === this.mtimeMs && this.cache !== null) return;
    try {
      const raw = await readFile(this.file, 'utf8');
      const parsed = JSON.parse(raw);
      this.cache = migrateState(parsed);
      this.mtimeMs = info.mtimeMs;
    } catch (err) {
      const failure = new Error('账单数据文件损坏或无法解析，未自动覆盖原文件');
      failure.code = 'STATE_CORRUPT';
      failure.cause = err;
      throw failure;
    }
  }

  async read() {
    await this.refresh();
    return this.cache;
  }

  async exportBackup() {
    const state = await this.read();
    return {
      kind: BACKUP_KIND,
      version: 1,
      revision: state.revision,
      createdAt: new Date().toISOString(),
      state: JSON.parse(JSON.stringify(state)),
    };
  }

  async importBackup(envelope) {
    return this.run(async () => {
      const incoming = validateBackupEnvelope(envelope);
      await this.acquireLock();
      try {
        this.mtimeMs = -1;
        await this.refresh();
        const current = this.cache ?? buildSeed();
        const next = JSON.parse(JSON.stringify(incoming));
        next.version = 1;
        next.revision = Math.max(current.revision, incoming.revision) + 1;
        await this.persist(next);
        this.cache = next;
        return next;
      } finally {
        await this.releaseLock();
      }
    });
  }

  async persist(state) {
    await mkdir(this.root, { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(state, null, 2), 'utf8');
    await rename(tmp, this.file);
    try {
      const info = await stat(this.file);
      this.mtimeMs = info.mtimeMs;
    } catch { /* ignore */ }
  }

  async acquireLock() {
    await mkdir(this.root, { recursive: true });
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const token = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
      try {
        await mkdir(this.lock);
        try {
          await writeFile(join(this.lock, 'owner'), token, 'utf8');
          this.lockToken = token;
          // 长事务续租：仅持有者更新锁目录 mtime，避免 30 秒后被误判为残留锁。
          this.lockHeartbeat = setInterval(() => {
            utimes(this.lock, new Date(), new Date()).catch(() => {});
          }, 5_000);
          this.lockHeartbeat.unref?.();
          return;
        } catch (err) {
          // owner 文件初始化失败时，只清理本次刚创建的锁。
          await rm(this.lock, { recursive: true, force: true }).catch(() => {});
          throw err;
        }
      } catch (err) {
        if (err?.code !== 'EEXIST') throw err;
        try {
          const info = await stat(this.lock);
          if (Date.now() - info.mtimeMs > 30_000) await rm(this.lock, { recursive: true, force: true });
        } catch { /* 锁在检查期间被释放，下一轮重试 */ }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
    const failure = new Error('账单数据正在被其他进程修改，请稍后重试');
    failure.code = 'STATE_LOCK_TIMEOUT';
    failure.status = 409;
    throw failure;
  }

  async releaseLock() {
    const token = this.lockToken;
    this.lockToken = null;
    if (this.lockHeartbeat) {
      clearInterval(this.lockHeartbeat);
      this.lockHeartbeat = null;
    }
    if (!token) return;
    try {
      const owner = await readFile(join(this.lock, 'owner'), 'utf8');
      if (owner === token) await rm(this.lock, { recursive: true, force: true });
    } catch { /* 锁已被接管或进程退出，无需删除其他持有者的锁 */ }
  }

  /**
   * 原子变更：跨进程加锁 → 复读最新状态 → 应用 mutate → 原子写回。
   * @param {string} label 变更说明（日志/排查用）
   * @param {(state: object) => object} mutate
   */
  async mutate(label, mutate, expectedRevision, options = {}) {
    return this.run(async () => {
      await this.acquireLock();
      try {
        // 锁建立后必须重新读取，避免拿到加锁前的旧缓存。
        this.mtimeMs = -1;
        await this.refresh();
        const current = this.cache ?? buildSeed();
        if (expectedRevision !== undefined && expectedRevision !== current.revision) {
          if (options.force !== true) {
            const failure = new Error('账单数据已被其他入口修改，请刷新后重试；如确认覆盖，请同时提交 force=true 和 force_confirm=true');
            failure.code = 'VERSION_CONFLICT';
            failure.status = 409;
            failure.expectedRevision = expectedRevision;
            failure.currentRevision = current.revision;
            failure.forceRequired = true;
            throw failure;
          }
          if (options.forceConfirm !== true) {
            const failure = new Error('覆盖旧版本必须显式确认 force_confirm=true');
            failure.code = 'FORCE_CONFIRM_REQUIRED';
            failure.status = 400;
            failure.expectedRevision = expectedRevision;
            failure.currentRevision = current.revision;
            throw failure;
          }
        }
        const next = mutate(current) ?? current;
        next.version = 1;
        next.revision = (Number.isInteger(current.revision) ? current.revision : 0) + 1;
        await this.persist(next);
        this.cache = next;
        return next;
      } finally {
        await this.releaseLock();
      }
    });
  }
}
