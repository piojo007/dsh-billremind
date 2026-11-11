// 业务服务：卡片增删改查、提醒天数设置、到期节点计算。UI 与 agent 工具都调用这里的同一批方法。

import { DEFAULT_TIME_ZONE, nextMonthlyDate, nextAnnualDate, daysUntil, formatDate, clampDay, startOfToday, pad2 } from './dates.js';

export const BILLING_TIME_ZONE = DEFAULT_TIME_ZONE;

export const UPCOMING_WINDOW_DAYS = 30;
export const RESTORE_WINDOW_MS = 5 * 60 * 1000;

const TYPE_LABEL = {
  statement: '账单日',
  repayment: '还款日',
  annual: '年费扣取日',
};

export class BillService {
  constructor(store) {
    this.store = store;
  }

  // ---------- 校验 ----------

  fail(status, message) {
    const err = new Error(message);
    err.status = status;
    throw err;
  }

  checkAlias(alias) {
    if (typeof alias !== 'string' || !alias.trim()) {
      this.fail(400, '缺少卡片别名（alias），例如：招行 Visa');
    }
    const value = alias.trim();
    if (value.length > 40) this.fail(400, '卡片别名过长（最多 40 字）');
    if ([...value].some((char) => /[\u0000-\u001f\u007f]/.test(char))) {
      this.fail(400, '卡片别名不能包含换行或控制字符');
    }
    return value;
  }

  aliasKey(alias) {
    return String(alias).normalize('NFKC').trim().replace(/\s+/g, '').toLocaleLowerCase('zh-CN');
  }

  ensureUniqueAlias(state, alias, excludeId = null) {
    const key = this.aliasKey(alias);
    if (state.cards.some((card) => card.id !== excludeId && this.aliasKey(card.alias) === key)) {
      this.fail(400, `已存在同名卡片「${alias}」`);
    }
  }

  checkInt(value, name, min, max) {
    if (!Number.isInteger(value)) {
      this.fail(400, `${name} 必须是 ${min}-${max} 的整数`);
    }
    if (value < min || value > max) {
      this.fail(400, `${name} 必须在 ${min}-${max} 之间`);
    }
    return value;
  }

  expectedRevision(input = {}) {
    if (input.expectedRevision === undefined) return undefined;
    return this.checkInt(input.expectedRevision, 'expectedRevision', 0, Number.MAX_SAFE_INTEGER);
  }

  mutationOptions(input = {}) {
    return { force: input.force === true, forceConfirm: input.force_confirm === true || input.forceConfirm === true };
  }

  /** 本期账单金额：非负、最多两位小数；接受数字或「1,234.56」这类字符串。 */
  checkAmount(value, name = '本期账单金额') {
    let num = value;
    if (typeof num === 'string') {
      const text = num.trim().replace(/,/g, '');
      if (!/^\d+(\.\d{1,2})?$/.test(text)) {
        this.fail(400, `${name} 必须是最多两位小数的非负数字，例如 1234.56`);
      }
      num = Number(text);
    }
    if (typeof num !== 'number' || !Number.isFinite(num) || num < 0) {
      this.fail(400, `${name} 必须是最多两位小数的非负数字，例如 1234.56`);
    }
    if (num > 100_000_000) this.fail(400, `${name} 超出合理范围（上限 1 亿）`);
    return Math.round(num * 100) / 100;
  }

  normalizeCardInput(input = {}) {
    const card = {};
    if (input.alias !== undefined) card.alias = this.checkAlias(input.alias);
    if (input.last4 !== undefined && input.last4 !== null && input.last4 !== '') {
      const v = String(input.last4).trim();
      if (!/^\d{4}$/.test(v)) this.fail(400, '尾号后 4 位必须是 4 位数字，例如 1234');
      card.last4 = v;
    }
    if (input.statementDay !== undefined) card.statementDay = this.checkInt(input.statementDay, '账单日（每月几号）', 1, 31);
    if (input.repaymentDay !== undefined) card.repaymentDay = this.checkInt(input.repaymentDay, '还款日（每月几号）', 1, 31);
    if (input.annualFeeMonth !== undefined) card.annualFeeMonth = this.checkInt(input.annualFeeMonth, '年费扣取月份', 1, 12);
    if (input.annualFeeDay !== undefined) card.annualFeeDay = this.checkInt(input.annualFeeDay, '年费扣取日', 1, 31);
    if (input.repayAdvanceDays !== undefined) card.repayAdvanceDays = this.checkInt(input.repayAdvanceDays, '还款日提前提醒天数', 0, 60);
    if (input.annualAdvanceDays !== undefined) card.annualAdvanceDays = this.checkInt(input.annualAdvanceDays, '年费提前提醒天数', 0, 365);
    // 本期账单金额：null / '' 表示「清空」，undefined 表示「不修改」。
    if (input.billAmount !== undefined && input.billAmount !== null && input.billAmount !== '') {
      card.billAmount = this.checkAmount(input.billAmount);
    }
    return card;
  }

  reminderModes(card) {
    const modes = card?.reminderModes;
    if (modes?.repayment === 'inherit' || modes?.repayment === 'custom') {
      if (modes?.annual === 'inherit' || modes?.annual === 'custom') return { repayment: modes.repayment, annual: modes.annual };
    }
    return { repayment: 'custom', annual: 'custom' };
  }

  effectiveReminders(card, defaults) {
    const modes = this.reminderModes(card);
    return {
      modes,
      repayAdvanceDays: modes.repayment === 'inherit' ? defaults.repayAdvanceDays : card.repayAdvanceDays,
      annualAdvanceDays: modes.annual === 'inherit' ? defaults.annualAdvanceDays : card.annualAdvanceDays,
    };
  }

  requireFields(card, fields) {
    const missing = fields.filter((f) => card[f] === undefined);
    if (missing.length) {
      const names = {
        alias: '卡片别名',
        statementDay: '账单日（每月几号）',
        repaymentDay: '还款日（每月几号）',
        annualFeeMonth: '年费扣取月份',
        annualFeeDay: '年费扣取日',
      };
      this.fail(400, `缺少必填信息：${missing.map((f) => names[f]).join('、')}`);
    }
  }

  // ---------- 查询 ----------

  /** 本期账单：最近一次已出的账单日，及其对应的还款日。 */
  currentBill(card, now = new Date()) {
    const today = startOfToday(now, BILLING_TIME_ZONE);
    // 最近一次账单日（含今天）
    let y = today.getUTCFullYear();
    let m = today.getUTCMonth() + 1;
    if (new Date(Date.UTC(y, m - 1, clampDay(y, m, card.statementDay))).getTime() > today.getTime()) {
      m -= 1;
      if (m < 1) { m = 12; y -= 1; }
    }
    const statementDate = new Date(Date.UTC(y, m - 1, clampDay(y, m, card.statementDay)));
    // 还款日在账单日之后：还款日 > 账单日 → 同月，否则顺延一个月
    let ry = statementDate.getUTCFullYear();
    let rm = statementDate.getUTCMonth() + 1;
    if (card.repaymentDay <= statementDate.getUTCDate()) {
      rm += 1;
      if (rm > 12) { rm = 1; ry += 1; }
    }
    const repaymentDate = new Date(Date.UTC(ry, rm - 1, clampDay(ry, rm, card.repaymentDay)));
    // amount 是用户手动录入的「本期账单金额」；未录入时为 null（不臆造数字）。
    const amount = typeof card.billAmount === 'number' && Number.isFinite(card.billAmount) ? card.billAmount : null;
    const days = daysUntil(repaymentDate, now);
    return {
      statementDate: formatDate(statementDate),
      repaymentDate: formatDate(repaymentDate),
      days,
      status: days < 0 ? 'overdue' : days === 0 ? 'today' : 'upcoming',
      amount,
    };
  }

  /** 计算一张卡的三类到期节点。 */
  cardNodes(card, now = new Date()) {
    const nodes = [];
    const add = (type, date) => {
      const days = daysUntil(date, now);
      nodes.push({
        cardId: card.id,
        alias: card.alias,
        type,
        typeLabel: TYPE_LABEL[type],
        date: formatDate(date),
        days,
      });
    };
    add('statement', nextMonthlyDate(card.statementDay, now));
    add('repayment', nextMonthlyDate(card.repaymentDay, now));
    add('annual', nextAnnualDate(card.annualFeeMonth, card.annualFeeDay, now));
    for (const n of nodes) {
      const advance = n.type === 'statement'
        ? 0
        : n.type === 'repayment'
          ? card.repayAdvanceDays
          : card.annualAdvanceDays;
      n.reminderDays = advance;
      n.status = n.days < 0
        ? 'overdue'
        : n.days === 0
          ? 'today'
          : n.days <= advance
            ? 'remind'
            : 'upcoming';
      n.remind = n.status === 'overdue' || n.status === 'today' || n.status === 'remind';
    }
    nodes.sort((a, b) => a.days - b.days);
    return nodes;
  }

  async exportBackup() {
    return this.store.exportBackup();
  }

  async importBackup(envelope) {
    return this.store.importBackup(envelope);
  }

  async snapshot(now = new Date()) {
    const state = await this.store.read();
    const defaults = { ...state.defaults };
    const cards = state.cards.map((card) => {
      const effective = this.effectiveReminders(card, defaults);
      const resolved = { ...card, ...effective };
      const nodes = this.cardNodes(resolved, now);
      return {
        ...card,
        last4: card.last4 || null,
        repayAdvanceDays: effective.repayAdvanceDays,
        annualAdvanceDays: effective.annualAdvanceDays,
        reminderSource: {
          repayment: effective.modes.repayment,
          annual: effective.modes.annual,
          repayAdvanceDays: effective.modes.repayment,
          annualAdvanceDays: effective.modes.annual,
        },
        effective: {
          repayAdvanceDays: effective.repayAdvanceDays,
          annualAdvanceDays: effective.annualAdvanceDays,
        },
        effectiveRepayAdvanceDays: effective.repayAdvanceDays,
        effectiveAnnualAdvanceDays: effective.annualAdvanceDays,
        bill: this.currentBill(resolved, now),
        nodes,
      };
    });
    const upcoming = cards
      .flatMap((c) => c.nodes)
      .filter((n) => n.days <= UPCOMING_WINDOW_DAYS)
      .sort((a, b) => a.days - b.days || a.alias.localeCompare(b.alias, 'zh'));
    const currentBillAttention = cards
      .filter((card) => card.bill.days <= card.repayAdvanceDays)
      .map((card) => ({
        cardId: card.id,
        alias: card.alias,
        type: 'repayment',
        typeLabel: TYPE_LABEL.repayment,
        date: card.bill.repaymentDate,
        days: card.bill.days,
        status: card.bill.status === 'overdue'
          ? 'overdue'
          : card.bill.days === 0
            ? 'today'
            : 'remind',
        reminderDays: card.repayAdvanceDays,
        remind: true,
        source: 'currentBill',
      }));
    const currentBillCardIds = new Set(currentBillAttention.map((item) => item.cardId));
    const attention = [
      ...upcoming.filter((node) => node.remind && !(node.type === 'repayment' && currentBillCardIds.has(node.cardId))),
      ...currentBillAttention,
    ]
      .sort((a, b) => a.days - b.days || a.alias.localeCompare(b.alias, 'zh'));
    return {
      revision: state.revision ?? 0,
      defaults,
      cards,
      upcoming,
      attention,
      windowDays: UPCOMING_WINDOW_DAYS,
      generatedAt: new Date(now).toISOString(),
    };
  }

  // ---------- 变更 ----------

  findCard(state, ref) {
    if (typeof ref === 'string' && ref) {
      const byId = state.cards.find((c) => c.id === ref);
      if (byId) return byId;
      const byAlias = state.cards.find((c) => c.alias === ref);
      if (byAlias) return byAlias;
      this.fail(404, `未找到卡片「${ref}」`);
    }
    this.fail(400, '请指定卡片 id 或别名');
  }

  newId() {
    return `card_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  newRestoreToken() {
    return `restore_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
  }

  async addCard(input) {
    const card = this.normalizeCardInput(input);
    this.requireFields(card, ['alias', 'statementDay', 'repaymentDay', 'annualFeeMonth', 'annualFeeDay']);
    return this.store.mutate('addCard', (state) => {
      this.ensureUniqueAlias(state, card.alias);
      const full = {
        id: this.newId(),
        ...card,
        repayAdvanceDays: card.repayAdvanceDays ?? state.defaults.repayAdvanceDays,
        annualAdvanceDays: card.annualAdvanceDays ?? state.defaults.annualAdvanceDays,
        reminderModes: {
          repayment: card.repayAdvanceDays === undefined ? 'inherit' : 'custom',
          annual: card.annualAdvanceDays === undefined ? 'inherit' : 'custom',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (!full.last4) delete full.last4;
      state.cards.push(full);
      return state;
    }, this.expectedRevision(input), this.mutationOptions(input));
  }

  async updateCard(ref, patch) {
    const changes = this.normalizeCardInput(patch);
    // 清空语义（null / ''）不会产生 changes，需要单独判断，否则「只清空」会被当成空操作。
    const clearLast4 = patch.last4 === '' || patch.last4 === null;
    const clearAmount = patch.billAmount === '' || patch.billAmount === null;
    if (!Object.keys(changes).length && !clearLast4 && !clearAmount) {
      this.fail(400, '没有需要修改的字段');
    }
    return this.store.mutate('updateCard', (state) => {
      const card = this.findCard(state, ref);
      if (changes.alias) this.ensureUniqueAlias(state, changes.alias, card.id);
      Object.assign(card, changes, { updatedAt: new Date().toISOString() });
       const modes = this.reminderModes(card);
       if (Object.prototype.hasOwnProperty.call(changes, 'repayAdvanceDays')) modes.repayment = 'custom';
       if (Object.prototype.hasOwnProperty.call(changes, 'annualAdvanceDays')) modes.annual = 'custom';
       card.reminderModes = modes;
      if (clearLast4) delete card.last4;
      if (card.last4 === undefined || card.last4 === null || card.last4 === '') delete card.last4;
      // 金额清空：删除字段，UI 回到「未录入」。
      if (clearAmount) delete card.billAmount;
      return state;
    }, this.expectedRevision(patch), this.mutationOptions(patch));
  }

  async removeCard(ref, options = {}) {
    const token = this.newRestoreToken();
    const deletedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + RESTORE_WINDOW_MS).toISOString();
    const result = await this.store.mutate('removeCard', (state) => {
      const card = this.findCard(state, ref);
      state.cards = state.cards.filter((c) => c.id !== card.id);
      state.trash = Array.isArray(state.trash) ? state.trash : [];
      state.trash.push({ token, deletedAt, expiresAt, card: JSON.parse(JSON.stringify(card)) });
      return state;
    }, this.expectedRevision(options), this.mutationOptions(options));
    Object.defineProperties(result, {
      restoreToken: { value: token, enumerable: false },
      expiresAt: { value: expiresAt, enumerable: false },
    });
    return result;
  }

  async restoreCard(token, options = {}) {
    if (typeof token !== 'string' || token.length < 16) this.fail(400, 'restore token 无效');
    return this.store.mutate('restoreCard', (state) => {
      const trash = Array.isArray(state.trash) ? state.trash : [];
      const entry = trash.find((item) => item.token === token);
      if (!entry) this.fail(404, 'restore token 不存在或已使用');
      if (Date.parse(entry.expiresAt) <= Date.now()) this.fail(410, 'restore token 已过期');
      this.ensureUniqueAlias(state, entry.card.alias);
      if (state.cards.some((card) => card.id === entry.card.id)) this.fail(409, '原卡片 id 已被占用');
      state.cards.push({ ...entry.card, updatedAt: new Date().toISOString() });
      state.trash = trash.filter((item) => item.token !== token);
      return state;
    }, this.expectedRevision(options), this.mutationOptions(options));
  }

  /**
   * 设置提前提醒天数。
   * @param {string|null} ref 卡片 id/别名；为 null 时修改全局默认
   */
  async setAdvance(ref, patch) {
    const changes = {};
    if (patch.repayAdvanceDays !== undefined) changes.repayAdvanceDays = this.checkInt(patch.repayAdvanceDays, '还款日提前提醒天数', 0, 60);
    if (patch.annualAdvanceDays !== undefined) changes.annualAdvanceDays = this.checkInt(patch.annualAdvanceDays, '年费提前提醒天数', 0, 365);
    if (!Object.keys(changes).length) this.fail(400, '请提供 repayAdvanceDays 或 annualAdvanceDays');
    return this.store.mutate('setAdvance', (state) => {
      if (ref) {
        const card = this.findCard(state, ref);
        Object.assign(card, changes);
        const modes = this.reminderModes(card);
        if (Object.prototype.hasOwnProperty.call(changes, 'repayAdvanceDays')) modes.repayment = 'custom';
        if (Object.prototype.hasOwnProperty.call(changes, 'annualAdvanceDays')) modes.annual = 'custom';
        card.reminderModes = modes;
      } else {
        // 全局设置只修改默认值；已有卡片的显式配置不被静默覆盖。
        Object.assign(state.defaults, changes);
      }
      return state;
    }, this.expectedRevision(patch), this.mutationOptions(patch));
  }

  async clearAll(options = {}) {
    if (options.confirm !== true) this.fail(400, '清空全部数据是危险操作，必须显式传入 confirm=true');
    return this.store.mutate('clearAll', () => ({
      version: 1,
      defaults: { repayAdvanceDays: 3, annualAdvanceDays: 30 },
      cards: [],
      trash: [],
    }), this.expectedRevision(options), this.mutationOptions(options));
  }
}

export { TYPE_LABEL };
export function monthDayLabel(month, day) {
  return `每月 ${pad2(day)} 日`;
}
export function annualLabel(month, day) {
  return `每年 ${month} 月 ${day} 日`;
}
