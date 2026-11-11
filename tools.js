// agent 工具：把 Host 服务能力以单一工具暴露，相关操作共用 action 参数。
// 工具不写业务逻辑，只做参数校验并调用 BillService。

const text = (value) => [{ type: 'text', text: value }];

function check(args, schema) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    throw new Error('参数必须是对象');
  }
  for (const key of schema.required || []) {
    if (args[key] === undefined) throw new Error(`缺少必填参数：${key}`);
  }
  for (const [key, value] of Object.entries(args)) {
    const spec = schema.properties?.[key];
    if (!spec) throw new Error(`未知参数：${key}`);
    if (spec.type === 'integer' && !Number.isInteger(value)) {
      throw new Error(`参数 ${key} 必须是整数`);
    }
    // 金额允许数字或「1,234.56」这类字符串；null 表示清空。具体格式由 service 层再校验一次。
    if (spec.type === 'number' && value !== null) {
      const num = typeof value === 'string' ? Number(value.replace(/,/g, '')) : value;
      if (typeof num !== 'number' || !Number.isFinite(num)) {
        throw new Error(`参数 ${key} 必须是数字`);
      }
    }
    if (spec.type === 'string' && typeof value !== 'string') {
      throw new Error(`参数 ${key} 必须是字符串`);
    }
    if (spec.type === 'boolean' && typeof value !== 'boolean') {
      throw new Error(`参数 ${key} 必须是布尔值`);
    }
    if (spec.enum && !spec.enum.includes(value)) {
      throw new Error(`参数 ${key} 必须是：${spec.enum.join(' | ')}`);
    }
  }
}

function fmtDate(iso) {
  return iso; // 已经是 YYYY-MM-DD
}

function daysLabel(days, status) {
  if (status === 'overdue' || days < 0) return `**已逾期 ${Math.abs(days)} 天**`;
  if (status === 'today' || days === 0) return '**今天**';
  return `**还有 ${days} 天**`;
}

function mdCell(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/[\r\n]+/g, ' ')
    .replace(/`/g, '\\`');
}

/** 金额展示：千分位 + 两位小数；未录入返回 null（由调用方给出占位文案）。 */
function moneyLabel(amount) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return null;
  const [int, dec] = amount.toFixed(2).split('.');
  return `¥${int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${dec}`;
}

function typeEmoji(type) {
  return type === 'statement' ? '🧾' : type === 'repayment' ? '💳' : '📌';
}

/** 生成近期到期提醒的 Markdown 行。 */
function renderUpcoming(upcoming, windowDays) {
  if (!upcoming.length) {
    return `未来 ${windowDays} 天内没有到期的账单日、还款日或年费扣取日。`;
  }
  const lines = upcoming.map((n) => {
    const due = n.remind ? ' ⚠️ 需要提醒' : '';
    return `- ${typeEmoji(n.type)} ${mdCell(n.alias)} · ${mdCell(n.typeLabel)} · ${fmtDate(n.date)} · ${daysLabel(n.days, n.status)}${due}`;
  });
  return ['### 近期到期提醒', ...lines].join('\n');
}

/** 生成全部卡片列表的 Markdown 表格。 */
function renderCards(cards) {
  if (!cards.length) {
    return '### 全部卡片列表\n\n暂无卡片。';
  }
  const head = '| 卡片 | 尾号 | 账单日 | 还款日 | 年费扣取日 | 本期账单 | 提前提醒（还款/年费） |';
  const sep = '| --- | --- | --- | --- | --- | --- | --- |';
  const rows = cards.map((c) => {
    const st = c.nodes.find((n) => n.type === 'statement');
    const rp = c.nodes.find((n) => n.type === 'repayment');
    const an = c.nodes.find((n) => n.type === 'annual');
    const last4 = c.last4 ? `**** ${c.last4}` : '-';
    // 本期账单列显示金额（用户录入），未录入时明确写「未录入」，不臆造数字。
    const money = moneyLabel(c.bill.amount);
    const bill = money === null
      ? `未录入（${c.bill.statementDate} 出账 → ${c.bill.repaymentDate} 还款）`
      : `${money}（${c.bill.repaymentDate} 还款，${daysLabel(c.bill.days, c.bill.status)}）`;
    return `| ${mdCell(c.alias)} | ${mdCell(last4)} | 每月 ${c.statementDay} 日（${st ? daysLabel(st.days, st.status) : '-'}） | 每月 ${c.repaymentDay} 日（${rp ? daysLabel(rp.days, rp.status) : '-'}） | 每年 ${c.annualFeeMonth} 月 ${c.annualFeeDay} 日（${an ? daysLabel(an.days, an.status) : '-'}） | ${mdCell(bill)} | ${c.repayAdvanceDays} 天 / ${c.annualAdvanceDays} 天 |`;
  });
  return ['### 全部卡片列表', head, sep, ...rows].join('\n');
}

function renderSnapshot(snap) {
  return [renderUpcoming(snap.upcoming, snap.windowDays), '', renderCards(snap.cards)].join('\n');
}

export function createBillTool(service) {
  const parameters = {
    type: 'object',
    additionalProperties: false,
    required: ['action'],
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'add', 'update', 'remove', 'restore', 'set_reminder', 'clear'],
        description: '操作类型：list 查看全部卡片与近期提醒；add 新增卡片（需要 alias、statement_day、repayment_day、annual_fee_month、annual_fee_day）；update 修改卡片；remove 删除卡片；set_reminder 设置提前提醒天数；clear 清空全部数据（需 confirm=true）。',
      },
      id: { type: 'string', description: '卡片 id 或卡片别名，update/remove/set_reminder 时用于定位卡片' },
       restore_token: { type: 'string', description: 'remove 返回的一次性恢复令牌，restore 时使用' },
      alias: { type: 'string', description: '卡片别名，例如「招行 Visa」' },
      last4: { type: 'string', description: '卡号尾号后 4 位（4 位数字，可选）' },
      statement_day: { type: 'integer', description: '账单日：每月几号（1-31）' },
      repayment_day: { type: 'integer', description: '还款日：每月几号（1-31）' },
      annual_fee_month: { type: 'integer', description: '年费扣取月份（1-12）' },
      annual_fee_day: { type: 'integer', description: '年费扣取日（1-31）' },
      bill_amount: { type: 'number', description: '本期账单金额（元，非负、最多两位小数）。用户未提供就不要传，绝不猜测或编造金额；传 null 表示清空为未录入。' },
      repay_advance_days: { type: 'integer', description: '还款日提前提醒天数（0-60，默认 3）' },
      annual_advance_days: { type: 'integer', description: '年费提前提醒天数（0-365，默认 30）' },
      global: { type: 'boolean', description: 'set_reminder 时为 true 表示修改全局默认提前提醒天数（默认 30 天）' },
      confirm: { type: 'boolean', description: 'clear 清空操作必须显式传入 true' },
      expected_revision: { type: 'integer', description: '可选的状态版本号；仅在版本仍匹配时执行变更，冲突时返回 VERSION_CONFLICT' },
      force: { type: 'boolean', description: '仅在确认覆盖冲突版本时传 true；必须同时传 force_confirm=true' },
      force_confirm: { type: 'boolean', description: '明确确认覆盖其他入口的新版本，必须为 true' },
    },
  };

  return {
    name: 'billremind',
    description: '管理信用卡账单提醒：添加/修改/删除卡片（别名、可选尾号后4位、账单日、还款日、年费扣取日、本期账单金额），查看本期账单、近期到期提醒与全部卡片列表，设置提前提醒天数，或清空全部数据。添加卡片时若用户未给全信息，先向用户询问卡片别名、每月账单日与还款日、每年年费扣取日，不要编造数据。本期账单金额只能由用户提供，不得编造或估算；用户没给就保持未录入。',
    parameters,
    timeoutMs: 30_000,
    output: {
      schema: { type: 'object', properties: { ok: { type: 'boolean' }, markdown: { type: 'string' } }, required: ['ok', 'markdown'] },
      render: (args, value) => text(value.markdown),
    },
    async execute(args) {
      check(args, parameters);
      const snap = await (async () => {
        switch (args.action) {
          case 'list':
            return service.snapshot();
          case 'add': {
            await service.addCard({
              alias: args.alias,
              last4: args.last4,
              statementDay: args.statement_day,
              repaymentDay: args.repayment_day,
              annualFeeMonth: args.annual_fee_month,
              annualFeeDay: args.annual_fee_day,
              repayAdvanceDays: args.repay_advance_days,
              annualAdvanceDays: args.annual_advance_days,
              billAmount: args.bill_amount,
               expectedRevision: args.expected_revision,
               force: args.force,
               force_confirm: args.force_confirm,
            });
            return service.snapshot();
          }
          case 'update': {
            if (!args.id) throw new Error('缺少必填参数：id（卡片 id 或别名）');
            await service.updateCard(args.id, {
              alias: args.alias,
              last4: args.last4,
              statementDay: args.statement_day,
              repaymentDay: args.repayment_day,
              annualFeeMonth: args.annual_fee_month,
              annualFeeDay: args.annual_fee_day,
              repayAdvanceDays: args.repay_advance_days,
              annualAdvanceDays: args.annual_advance_days,
              billAmount: args.bill_amount,
               expectedRevision: args.expected_revision,
               force: args.force,
               force_confirm: args.force_confirm,
            });
            return service.snapshot();
          }
          case 'remove': {
            if (!args.id) throw new Error('缺少必填参数：id（卡片 id 或别名）');
            await service.removeCard(args.id, { expectedRevision: args.expected_revision, force: args.force, force_confirm: args.force_confirm });
            return service.snapshot();
          }
          case 'restore': {
             if (!args.restore_token) throw new Error('缺少必填参数：restore_token');
             await service.restoreCard(args.restore_token, { expectedRevision: args.expected_revision });
             return service.snapshot();
           }
           case 'set_reminder': {
            const ref = args.global ? null : (args.id || null);
            if (args.global !== true && !args.id) {
              throw new Error('请指定卡片（id）或传入 global=true 修改全局默认');
            }
            await service.setAdvance(ref, { expectedRevision: args.expected_revision,
               force: args.force,
               force_confirm: args.force_confirm,
              repayAdvanceDays: args.repay_advance_days,
              annualAdvanceDays: args.annual_advance_days,
            });
            return service.snapshot();
          }
          case 'clear': {
            if (args.confirm !== true) throw new Error('清空全部数据是危险操作，必须显式传入 confirm=true');
            await service.clearAll({ confirm: true, expectedRevision: args.expected_revision, force: args.force, force_confirm: args.force_confirm });
            return service.snapshot();
          }
          default:
            throw new Error(`未知操作：${args.action}`);
        }
      })();

      let markdown = renderSnapshot(snap);
      if (args.action !== 'list') {
        const done = {
          add: '已添加卡片',
          update: '已更新卡片',
          remove: '已删除卡片',
          set_reminder: '已更新提醒天数',
          clear: '已清空全部数据',
        }[args.action];
        markdown = `${done}。\n\n${markdown}`;
      }
      return { ok: true, markdown };
    },
  };
}
