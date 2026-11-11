// BillRemind Client 端：左侧栏入口 + 主面板（近期到期提醒 / 全部卡片列表）。
// 数据经同源 fetch 走 Host 的 /billremind 路由；样式只用 --dsw-* 主题令牌。

window.__ModuleLoader__.load({
  id: 'dsh-billremind',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useEffect, useSyncExternalStore, useState, useRef } = React;

    const isZh = () => String(navigator.language || '').toLowerCase().startsWith('zh');
    const L = () => (isZh() ? {
      title: '账单提醒',
      subtitle: '账单日 · 还款日 · 年费扣取日',
      upcoming: '需要处理',
       emptyAttention: '当前没有已逾期、今天或已进入提醒窗口的事项。',
      allCards: '全部卡片列表',
      empty: '暂无卡片。在对话中说「添加卡片」即可开始。',
      emptyUpcoming: `未来 30 天内没有需要关注的到期节点。`,
      hint: '点击卡片右侧的「编辑」即可直接修改；也可以在对话中说「添加卡片」「删除卡片」等指令。',
      tableAlias: '卡片',
      tableLast4: '尾号',
      tableStatement: '账单日',
      tableRepayment: '还款日',
      tableAnnual: '年费扣取日',
      tableUpcoming: '本期账单',
      tableActions: '操作',
      billNotSet: '未录入',
      editBtn: '编辑',
      deleteBtn: '删除',
      confirmDelete: (alias) => `确定删除卡片「${alias}」吗？删除后可在短时间内撤销。`,
       confirmDiscardTitle: '放弃未保存修改？',
       confirmDiscardBody: '当前修改尚未保存，确定关闭吗？',
       confirmYes: '确定',
       confirmNo: '取消',
       undoDelete: (alias) => `已删除「${alias}」`,
       undo: '撤销',
       deleted: '已删除',
       undoFailed: '撤销失败，卡片可能已被其他入口修改。',
      fmtMonthly: (d) => `每月 ${d} 日`,
      fmtAnnual: (m, d) => `每年 ${m} 月 ${d} 日`,
      daysUnit: '天',
      today: '今天',
       inDays: '还有',
       overdue: '已逾期',
      statement: '账单日',
      repayment: '还款日',
      annual: '年费',
      loadFailed: '加载失败',
      retry: '重试',
      addBtn: '添加卡片',
       settingsBtn: '提醒设置',
       backupBtn: '备份管理',
       backupTitle: '备份管理',
       exportBackup: '导出备份',
       importBackup: '导入备份',
       backupPaste: '将备份 JSON 粘贴到这里，或选择文件',
       chooseFile: '选择文件',
       backupConfirm: '确认导入此备份？当前数据将被替换。',
       backupInvalid: '备份 JSON 无效或格式不受支持',
       backupImported: '备份导入成功',
       backupExportFailed: '备份导出失败',
       backupImportFailed: '备份导入失败',
       settingsTitle: '全局提醒设置',
       settingsNote: '只影响后续新增卡片；已有卡片的自定义值不会被覆盖。',
       globalRepay: '还款日提前提醒天数',
       globalAnnual: '年费提前提醒天数',
       editCardTitle: '编辑卡片',
       addCardTitle: '添加卡片',
      editAlias: '卡片别名',
      editLast4: '尾号后4位',
      editStmt: '账单日（每月几号）',
      editRepay: '还款日（每月几号）',
      editAnnualMonth: '年费扣取月份',
      editAnnualDay: '年费扣取日',
      editRepayAdvance: '还款日提前提醒天数',
       reminderInherited: '继承全局默认（当前值与默认一致；服务端未提供来源标识）',
       reminderCustom: '卡片自定义',
       editAnnualAdvance: '年费提前提醒天数',
       editAmount: '本期账单金额（元）',
      editAmountPlaceholder: '例如 1234.56，留空表示未录入',
      editSave: '保存',
       saving: '保存中…',
       confirmDiscard: '有未保存的修改，确定放弃吗？',
       conflictTitle: '数据已被其他入口修改',
       conflictDetail: '当前表单基于旧版本，重新加载会丢弃当前输入；覆盖会以当前表单强制保存。',
       reloadLatest: '重新加载最新数据',
       forceSave: '确认覆盖保存',
       confirmForce: '数据已被其他入口修改，确定覆盖对方修改吗？',
      editCancel: '取消',
    } : {
      title: 'Bill Remind',
      subtitle: 'Statement · Repayment · Annual fee',
      upcoming: 'Needs attention',
       emptyAttention: 'No overdue or active reminder items.',
      allCards: 'All cards',
      empty: 'No cards yet. Say "add a card" in the chat to begin.',
      emptyUpcoming: 'Nothing due within the next 30 days.',
      hint: 'Click “Edit” on a card to change it here, or manage cards from the chat: add / edit / remove, set advance-reminder days, or clear data.',
      tableAlias: 'Card',
      tableLast4: 'Last 4',
      tableStatement: 'Statement',
      tableRepayment: 'Repayment',
      tableAnnual: 'Annual fee',
      tableUpcoming: 'Current bill',
      tableActions: 'Actions',
      billNotSet: 'not set',
      editBtn: 'Edit',
      deleteBtn: 'Delete',
      confirmDelete: (alias) => `Delete card "${alias}"? You can undo this briefly.`,
       confirmDiscardTitle: 'Discard unsaved changes?',
       confirmDiscardBody: 'Your changes have not been saved. Close anyway?',
       confirmYes: 'Confirm',
       confirmNo: 'Cancel',
       undoDelete: (alias) => `Deleted "${alias}"`,
       undo: 'Undo',
       deleted: 'Deleted',
       undoFailed: 'Undo failed; the card may have changed elsewhere.',
      fmtMonthly: (d) => `day ${d} monthly`,
      fmtAnnual: (m, d) => `${m}/${d} yearly`,
      daysUnit: 'd',
      today: 'today',
       inDays: 'in',
       overdue: 'overdue',
      statement: 'Statement',
      repayment: 'Repayment',
      annual: 'Annual fee',
      loadFailed: 'Load failed',
      retry: 'Retry',
      addBtn: 'Add card',
       settingsBtn: 'Reminder settings',
       backupBtn: 'Backup',
       backupTitle: 'Backup management',
       exportBackup: 'Export backup',
       importBackup: 'Import backup',
       backupPaste: 'Paste backup JSON here, or choose a file',
       chooseFile: 'Choose file',
       backupConfirm: 'Import this backup? Current data will be replaced.',
       backupInvalid: 'Invalid or unsupported backup JSON',
       backupImported: 'Backup imported',
       backupExportFailed: 'Backup export failed',
       backupImportFailed: 'Backup import failed',
       settingsTitle: 'Global reminder settings',
       settingsNote: 'Applies to new cards only; existing card overrides are preserved.',
       globalRepay: 'Repayment advance days',
       globalAnnual: 'Annual-fee advance days',
       editCardTitle: 'Edit Card',
       addCardTitle: 'Add Card',
      editAlias: 'Alias',
      editLast4: 'Last 4 digits',
      editStmt: 'Statement day (1-31)',
      editRepay: 'Repayment day (1-31)',
      editAnnualMonth: 'Annual fee month',
      editAnnualDay: 'Annual fee day',
      editRepayAdvance: 'Repayment advance days',
       reminderInherited: 'Uses global default (value matches; source is not marked by server)',
       reminderCustom: 'Card override',
       editAnnualAdvance: 'Annual-fee advance days',
       editAmount: 'Current bill amount',
      editAmountPlaceholder: 'e.g. 1234.56, leave empty to clear',
      editSave: 'Save',
       saving: 'Saving…',
       confirmDiscard: 'Discard unsaved changes?',
       conflictTitle: 'Data changed elsewhere',
       conflictDetail: 'This form uses an old version. Reload discards your input; overwrite force-saves this form.',
       reloadLatest: 'Reload latest',
       forceSave: 'Confirm overwrite',
       confirmForce: 'Data changed elsewhere. Overwrite the other change?',
      editCancel: 'Cancel',
    });

    const TYPE_KEY = { statement: 'statement', repayment: 'repayment', annual: 'annual' };

    // ---------- 数据层：外部 store + 同源 fetch ----------

    let state = null;
    let error = null;
    const listeners = new Set();
    const emit = () => { for (const fn of listeners) fn(); };
    const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
    const getSnapshot = () => state;
    const getError = () => error;

    let requestSerial = 0;

    async function api(path, body) {
      const res = await fetch(`/billremind/${path}`, body === undefined
        ? undefined
        : {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        const failure = new Error(data.error || `HTTP ${res.status}`);
        failure.status = res.status;
        failure.code = data.code;
        failure.expectedRevision = data.expectedRevision;
        failure.currentRevision = data.currentRevision;
        throw failure;
      }
      return data;
    }

    async function reload() {
      const serial = ++requestSerial;
      try {
        const data = await api('state');
        if (serial !== requestSerial) return;
        state = data.state;
        error = null;
      } catch (err) {
        if (serial !== requestSerial) return;
        if (err.code === 'VERSION_CONFLICT' || err.status === 409) {
             setConflict(true);
             error = null;
           } else {
             error = err.message;
           }
      }
      emit();
    }

    // ---------- 图标 ----------

    function Icon(props) {
      const size = props?.size ?? 20;
      return h('svg', {
        width: size, height: size, viewBox: '0 0 64 64', 'aria-hidden': true,
        style: { display: 'block' },
      },
      h('rect', { x: 5, y: 14, width: 54, height: 38, rx: 7, fill: 'none', stroke: 'currentColor', strokeWidth: 4 }),
      h('rect', { x: 5, y: 23, width: 54, height: 9, fill: 'currentColor' }),
      h('rect', { x: 13, y: 41, width: 18, height: 5, rx: 2.5, fill: 'currentColor' }));
    }

    // ---------- 桌面端确认弹窗 ----------

     function ConfirmDialog({ title, body, onConfirm, onCancel }) {
       const firstButton = useRef(null);
       useEffect(() => { firstButton.current?.focus(); }, []);
       return h('div', {
         className: 'br-dialog-overlay br-confirm-overlay',
         role: 'presentation',
         onKeyDown: (e) => { if (e.key === 'Escape') onCancel?.(); },
       }, h('div', {
         className: 'br-dialog br-confirm-dialog',
         role: 'dialog',
         'aria-modal': 'true',
         'aria-labelledby': 'br-confirm-title',
         'aria-describedby': 'br-confirm-body',
       },
       h('h3', { id: 'br-confirm-title' }, title),
       h('p', { id: 'br-confirm-body', className: 'br-confirm-body' }, body),
       h('div', { className: 'br-dialog-actions' },
         h('button', { type: 'button', className: 'br-dialog-btn', onClick: onCancel }, L().confirmNo),
         h('button', { ref: firstButton, type: 'button', className: 'br-dialog-btn br-dialog-btn-primary', onClick: onConfirm }, L().confirmYes))));
     }

     // ---------- 弹窗编辑组件 ----------

    function reminderOrigin(card, defaults, field) {
      if (card?.[field] === undefined || defaults?.[field] === undefined) return 'unknown';
      return card[field] === defaults[field] ? 'inherited' : 'custom';
    }

    function EditDialog({ card, defaults, onSave, onCancel, isNew = false, conflict = false, onReloadLatest, onForceSave }) {
      const [alias, setAlias] = useState(card.alias || '');
      const [last4, setLast4] = useState(card.last4 !== undefined ? String(card.last4) : '');
      const [stmtDay, setStmtDay] = useState(card.statementDay !== undefined ? String(card.statementDay) : '');
      const [repayDay, setRepayDay] = useState(card.repaymentDay !== undefined ? String(card.repaymentDay) : '');
      const [annualMonth, setAnnualMonth] = useState(card.annualFeeMonth !== undefined ? String(card.annualFeeMonth) : '');
      const [annualDay, setAnnualDay] = useState(card.annualFeeDay !== undefined ? String(card.annualFeeDay) : '');
      const [repayAdvance, setRepayAdvance] = useState(card.repayAdvanceDays !== undefined ? String(card.repayAdvanceDays) : '');
      const [annualAdvance, setAnnualAdvance] = useState(card.annualAdvanceDays !== undefined ? String(card.annualAdvanceDays) : '');
      const [amount, setAmount] = useState(
        typeof card.billAmount === 'number' ? card.billAmount.toFixed(2) : '',
      );
      const [fieldError, setFieldError] = useState('');
      const [saving, setSaving] = useState(false);
       const [confirmDiscard, setConfirmDiscard] = useState(false);
      const firstInput = useRef(null);
      const initialValues = useRef(JSON.stringify({ alias: card.alias || '', last4: card.last4 || '', stmtDay: card.statementDay ?? '', repayDay: card.repaymentDay ?? '', annualMonth: card.annualFeeMonth ?? '', annualDay: card.annualFeeDay ?? '', repayAdvance: card.repayAdvanceDays ?? '', annualAdvance: card.annualAdvanceDays ?? '', amount: typeof card.billAmount === 'number' ? card.billAmount.toFixed(2) : '' }));
      const isDirty = () => initialValues.current !== JSON.stringify({ alias, last4, stmtDay, repayDay, annualMonth, annualDay, repayAdvance, annualAdvance, amount });
      useEffect(() => { firstInput.current?.focus(); }, []);

      const handleSave = async () => {
        setFieldError('');
        const newAlias = alias.trim() || undefined;
        const newLast4 = last4.trim();
        const newStmt = stmtDay ? Number(stmtDay.trim()) : undefined;
        const newRepay = repayDay ? Number(repayDay.trim()) : undefined;
        const newAnnMonth = annualMonth ? Number(annualMonth.trim()) : undefined;
        const newAnnDay = annualDay ? Number(annualDay.trim()) : undefined;
        const newRepayAdvance = repayAdvance ? Number(repayAdvance.trim()) : undefined;
        const newAnnualAdvance = annualAdvance ? Number(annualAdvance.trim()) : undefined;
        const newAmount = amount.trim();

        if (newLast4 && !/^\d{4}$/.test(newLast4)) {
          setFieldError(isZh() ? '尾号后 4 位必须是 4 位数字，例如 1234' : 'Last 4 digits must be exactly 4 digits, e.g. 1234');
          return;
        }
        if (newStmt !== undefined && (newStmt < 1 || newStmt > 31)) {
          setFieldError(isZh() ? '账单日必须在 1-31 之间' : 'Statement day must be between 1 and 31');
          return;
        }
        if (newRepay !== undefined && (newRepay < 1 || newRepay > 31)) {
          setFieldError(isZh() ? '还款日必须在 1-31 之间' : 'Repayment day must be between 1 and 31');
          return;
        }
        if (newAnnMonth !== undefined && (newAnnMonth < 1 || newAnnMonth > 12)) {
          setFieldError(isZh() ? '年费月份必须在 1-12 之间' : 'Annual fee month must be between 1 and 12');
          return;
        }
        if (newAnnDay !== undefined && (newAnnDay < 1 || newAnnDay > 31)) {
          setFieldError(isZh() ? '年费日必须在 1-31 之间' : 'Annual fee day must be between 1 and 31');
          return;
        }
        if (newRepayAdvance !== undefined && (newRepayAdvance < 0 || newRepayAdvance > 60 || !Number.isInteger(newRepayAdvance))) {
          setFieldError(isZh() ? '还款日提前提醒天数必须是 0-60 的整数' : 'Repayment advance days must be an integer from 0 to 60');
          return;
        }
        if (newAnnualAdvance !== undefined && (newAnnualAdvance < 0 || newAnnualAdvance > 365 || !Number.isInteger(newAnnualAdvance))) {
          setFieldError(isZh() ? '年费提前提醒天数必须是 0-365 的整数' : 'Annual-fee advance days must be an integer from 0 to 365');
          return;
        }
        if (newAmount && !/^\d+(\.\d{1,2})?$/.test(newAmount)) {
          setFieldError(isZh() ? '本期账单金额必须是最多两位小数的非负数字，例如 1234.56' : 'Amount must be a non-negative number with at most 2 decimals, e.g. 1234.56');
          return;
        }

        setSaving(true);
        await onSave?.({
          alias: newAlias,
          // null 表示「清空尾号」：服务端会删除该字段；undefined 会被当作「不修改」而保留旧值。
          last4: newLast4 || null,
          statement_day: newStmt,
          repayment_day: newRepay,
          annual_fee_month: newAnnMonth,
          annual_fee_day: newAnnDay,
           repay_advance_days: newRepayAdvance,
           annual_advance_days: newAnnualAdvance,
          // 同理：留空 = null 清空金额，服务端删除 billAmount 字段。
          bill_amount: newAmount || null,
         });
         setSaving(false);
         return;
      };

      const handleCancel = () => {
        if (isDirty()) { setConfirmDiscard(true); return; }
        onCancel?.();
      };

      return h(React.Fragment, {}, h('div', {
        className: 'br-dialog-overlay',
        role: 'presentation',
        onKeyDown: (e) => { if (e.key === 'Escape') handleCancel(); },
      },
        h('div', {
          className: 'br-dialog',
          role: 'dialog',
          'aria-modal': 'true',
          'aria-labelledby': 'br-dialog-title',
        },
          h('h3', { id: 'br-dialog-title' }, isNew ? L().addCardTitle : L().editCardTitle),
          fieldError && h('div', { className: 'br-field-error', role: 'alert' }, fieldError),
          conflict && h('div', { className: 'br-field-error', role: 'alert' },
            h('strong', {}, L().conflictTitle),
            h('div', {}, L().conflictDetail),
            h('div', { className: 'br-dialog-actions' },
              h('button', { type: 'button', className: 'br-dialog-btn', onClick: onReloadLatest }, L().reloadLatest),
              h('button', { type: 'button', className: 'br-dialog-btn br-dialog-btn-primary', onClick: onForceSave }, L().forceSave))),
          h('div', { style: { marginBottom: 12 } },
            h('label', { style: { display: 'block', marginBottom: 4 } }, L().editAlias),
            h('input', {
              ref: firstInput,
              value: alias,
              onChange: (e) => setAlias(e.target.value),
            })),
          h('div', { style: { marginBottom: 12 } },
            h('label', { style: { display: 'block', marginBottom: 4 } }, L().editLast4),
            h('input', {
              value: last4,
              maxLength: 4,
              inputMode: 'numeric',
              onChange: (e) => setLast4(e.target.value),
            })),
          h('div', { style: { marginBottom: 12 } },
            h('label', { style: { display: 'block', marginBottom: 4 } }, L().editStmt),
            h('input', {
              value: stmtDay,
              inputMode: 'numeric',
              onChange: (e) => setStmtDay(e.target.value),
            })),
          h('div', { style: { marginBottom: 12 } },
            h('label', { style: { display: 'block', marginBottom: 4 } }, L().editRepay),
            h('input', {
              value: repayDay,
              inputMode: 'numeric',
              onChange: (e) => setRepayDay(e.target.value),
            })),
          h('div', { style: { marginBottom: 12 } },
            h('label', { style: { display: 'block', marginBottom: 4 } }, L().editAnnualMonth),
            h('input', {
              value: annualMonth,
              inputMode: 'numeric',
              onChange: (e) => setAnnualMonth(e.target.value),
            })),
          h('div', { style: { marginBottom: 12 } },
            h('label', { style: { display: 'block', marginBottom: 4 } }, L().editAnnualDay),
            h('input', {
              value: annualDay,
              inputMode: 'numeric',
              onChange: (e) => setAnnualDay(e.target.value),
            })),
          h('div', { style: { marginBottom: 12 } },
            h('label', { style: { display: 'block', marginBottom: 4 } }, L().editRepayAdvance,
               h('span', { className: `br-reminder-origin br-reminder-${reminderOrigin(card, defaults, 'repayAdvanceDays')}` },
                 reminderOrigin(card, defaults, 'repayAdvanceDays') === 'custom' ? L().reminderCustom : L().reminderInherited)),
            h('input', { value: repayAdvance, inputMode: 'numeric', onChange: (e) => setRepayAdvance(e.target.value) })),
          h('div', { style: { marginBottom: 12 } },
            h('label', { style: { display: 'block', marginBottom: 4 } }, L().editAnnualAdvance,
               h('span', { className: `br-reminder-origin br-reminder-${reminderOrigin(card, defaults, 'annualAdvanceDays')}` },
                 reminderOrigin(card, defaults, 'annualAdvanceDays') === 'custom' ? L().reminderCustom : L().reminderInherited)),
            h('input', { value: annualAdvance, inputMode: 'numeric', onChange: (e) => setAnnualAdvance(e.target.value) })),
          h('div', { style: { marginBottom: 12 } },
            h('label', { style: { display: 'block', marginBottom: 4 } }, L().editAmount),
            h('input', {
              value: amount,
              inputMode: 'decimal',
              placeholder: L().editAmountPlaceholder,
              onChange: (e) => setAmount(e.target.value),
            })),
          h('div', { className: 'br-dialog-actions' },
            h('button', { type: 'button', className: 'br-dialog-btn', onClick: handleCancel, disabled: saving }, L().editCancel),
            h('button', { type: 'button', className: 'br-dialog-btn br-dialog-btn-primary', onClick: handleSave, disabled: saving }, saving ? L().saving : L().editSave))),
         confirmDiscard && h(ConfirmDialog, {
           title: L().confirmDiscardTitle,
           body: L().confirmDiscardBody,
           onCancel: () => setConfirmDiscard(false),
           onConfirm: () => { setConfirmDiscard(false); onCancel?.(); },
         })));
    }

    function BackupDialog({ onClose, onImported }) {
       const t = L();
       const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [phase, setPhase] = useState('idle'); const [message, setMessage] = useState(''); const fileRef = useRef(null);
       const exportBackup = async () => { if (busy) return; setBusy(true); setPhase('exporting'); setMessage(''); try { const res = await fetch('/billremind/backup'); const data = await res.json().catch(() => ({})); if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`); const payload = data.backup || data; const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `billremind-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); } catch (err) { setMessage(`${t.backupExportFailed}: ${err.message}`); } finally { setBusy(false); setPhase('idle'); } };
       const importBackup = async () => { if (busy) return; setMessage(''); let parsed; try { parsed = JSON.parse(text); } catch { setMessage(t.backupInvalid); return; } if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) { setMessage(t.backupInvalid); return; } if (!window.confirm(t.backupConfirm)) return; setBusy(true); setPhase('importing'); try { const result = await api('backup', parsed.backup ? parsed : { backup: parsed }); setMessage(t.backupImported); onImported?.(result); setTimeout(() => onClose?.(), 700); } catch (err) { setMessage(`${t.backupImportFailed}: ${err.message}`); } finally { setBusy(false); setPhase('idle'); } };
       const readFile = (event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setText(String(reader.result || '')); reader.onerror = () => setMessage(t.backupInvalid); reader.readAsText(file); };
       return h('div', { className: 'br-dialog-overlay', role: 'presentation', onKeyDown: (e) => { if (e.key === 'Escape' && !busy) onClose?.(); } }, h('div', { className: 'br-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'br-backup-title' }, h('h3', { id: 'br-backup-title' }, t.backupTitle), message && h('div', { className: 'br-field-error', role: 'alert', 'aria-live': 'assertive' }, message), phase !== 'idle' && h('div', { className: 'br-settings-note', role: 'status', 'aria-live': 'polite' }, phase === 'exporting' ? t.exportBackup : t.importBackup), h('div', { className: 'br-dialog-actions' }, h('button', { type: 'button', className: 'br-dialog-btn br-dialog-btn-primary', onClick: exportBackup, disabled: busy }, t.exportBackup), h('button', { type: 'button', className: 'br-dialog-btn', onClick: () => fileRef.current?.click(), disabled: busy }, t.chooseFile)), h('input', { ref: fileRef, type: 'file', accept: 'application/json,.json', onChange: readFile, style: { display: 'none' } }), h('textarea', { id: 'br-backup-json', 'aria-label': t.backupPaste, value: text, disabled: busy, placeholder: t.backupPaste, onChange: (e) => setText(e.target.value), style: { width: '100%', minHeight: 180, marginTop: 12, boxSizing: 'border-box', fontFamily: 'monospace' } }), h('div', { className: 'br-dialog-actions' }, h('button', { type: 'button', className: 'br-dialog-btn', onClick: onClose, disabled: busy }, t.editCancel), h('button', { type: 'button', className: 'br-dialog-btn br-dialog-btn-primary', onClick: importBackup, disabled: busy || !text.trim() }, t.importBackup))));
     }

     function SettingsDialog({ defaults, onSave, onCancel }) {
      const [repay, setRepay] = useState(String(defaults?.repayAdvanceDays ?? 3));
      const [annual, setAnnual] = useState(String(defaults?.annualAdvanceDays ?? 30));
      const [errorText, setErrorText] = useState('');
      const [savingSettings, setSavingSettings] = useState(false);
       const [confirmDiscard, setConfirmDiscard] = useState(false);
      const initial = useRef(JSON.stringify({ repay, annual }));
      const dirty = () => initial.current !== JSON.stringify({ repay, annual });
      const close = () => {
        if (dirty()) { setConfirmDiscard(true); return; }
        onCancel?.();
      };
      const save = async () => {
        const repayDays = Number(repay);
        const annualDays = Number(annual);
        if (!Number.isInteger(repayDays) || repayDays < 0 || repayDays > 60) {
          setErrorText(isZh() ? '还款日提前提醒天数必须是 0-60 的整数' : 'Repayment advance days must be an integer from 0 to 60');
          return;
        }
        if (!Number.isInteger(annualDays) || annualDays < 0 || annualDays > 365) {
          setErrorText(isZh() ? '年费提前提醒天数必须是 0-365 的整数' : 'Annual-fee advance days must be an integer from 0 to 365');
          return;
        }
        setErrorText('');
        setSavingSettings(true);
        try {
          await onSave?.({ repayAdvanceDays: repayDays, annualAdvanceDays: annualDays });
        } finally {
          setSavingSettings(false);
        }
      };
      return h(React.Fragment, {}, h('div', { className: 'br-dialog-overlay', role: 'presentation', onKeyDown: (e) => { if (e.key === 'Escape') close(); } },
        h('div', { className: 'br-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'br-settings-title' },
          h('h3', { id: 'br-settings-title' }, L().settingsTitle),
          h('p', { className: 'br-settings-note' }, L().settingsNote),
          errorText && h('div', { className: 'br-field-error', role: 'alert' }, errorText),
          h('label', { className: 'br-setting-field' }, L().globalRepay,
            h('input', { value: repay, inputMode: 'numeric', disabled: savingSettings, onChange: (e) => setRepay(e.target.value) })),
          h('label', { className: 'br-setting-field' }, L().globalAnnual,
            h('input', { value: annual, inputMode: 'numeric', disabled: savingSettings, onChange: (e) => setAnnual(e.target.value) })),
          h('div', { className: 'br-dialog-actions' },
            h('button', { type: 'button', className: 'br-dialog-btn', onClick: close, disabled: savingSettings }, L().editCancel),
            h('button', { type: 'button', className: 'br-dialog-btn br-dialog-btn-primary', onClick: save, disabled: savingSettings }, savingSettings ? L().saving : L().editSave))),
         confirmDiscard && h(ConfirmDialog, {
           title: L().confirmDiscardTitle,
           body: L().confirmDiscardBody,
           onCancel: () => setConfirmDiscard(false),
           onConfirm: () => { setConfirmDiscard(false); onCancel?.(); },
         })));
    }

    // ---------- 视图 ----------

    const css = `
      .br-panel { height: 100%; overflow-y: auto; padding: 16px; box-sizing: border-box;
        color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-base); font-size: 13px; }
      .br-panel h2 { margin: 0; font-size: 17px; font-weight: 600; }
      .br-panel .br-sub { margin: 2px 0 0; color: var(--dsw-alias-label-secondary); font-size: 12px; }
       .br-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
       .br-header-actions { display: flex; gap: 6px; }
       .br-setting-field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
       .br-settings-note { color: var(--dsw-alias-label-secondary); font-size: 12px; margin: -8px 0 14px; }
       .br-btn-primary { color: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); font-weight: 600; }
      .br-section { margin-top: 18px; }
      .br-section-title { margin: 0 0 8px; font-size: 13px; font-weight: 600;
        color: var(--dsw-alias-label-primary); }
      .br-list { display: flex; flex-direction: column; gap: 6px; }
      .br-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px;
        border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px;
        background: var(--dsw-alias-bg-layer-1); }
      .br-item .br-alias { font-weight: 600; }
      .br-item .br-type { color: var(--dsw-alias-label-secondary); }
      .br-item .br-date { margin-left: auto; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
      .br-days { min-width: 52px; text-align: center; padding: 2px 8px; border-radius: 999px;
        font-weight: 600; font-size: 12px; font-variant-numeric: tabular-nums;
        background: var(--dsw-alias-state-idle-primary); color: var(--dsw-alias-bg-base); }
      .br-days.br-soon { background: var(--dsw-alias-state-warn-primary); }
      .br-days.br-now { background: var(--dsw-alias-state-error-primary); }
       .br-days.br-overdue { background: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-bg-base); }
      .br-table-wrap { width: 100%; overflow-x: auto; }
      .br-table { width: 100%; border-collapse: collapse; margin-top: 2px; }
      .br-table th { text-align: left; padding: 6px 8px; font-weight: 600; font-size: 12px;
        color: var(--dsw-alias-label-secondary); border-bottom: 1px solid var(--dsw-alias-border-l2);
        white-space: nowrap; }
      .br-table td { padding: 7px 8px; border-bottom: 1px solid var(--dsw-alias-border-l1);
        font-variant-numeric: tabular-nums; white-space: nowrap; }
      .br-table tr:last-child td { border-bottom: none; }
      .br-table tbody tr.br-row:hover { background: var(--dsw-alias-bg-layer-2); }
      .br-cell-alias { font-weight: 600; }
      .br-cell-bill { font-weight: 700; }
      .br-bill-empty { font-weight: 400; color: var(--dsw-alias-label-secondary); }
      .br-cell-actions { text-align: right; }
      .br-btn { padding: 3px 10px; border-radius: 6px; cursor: pointer; font-size: 12px;
        border: 1px solid var(--dsw-alias-border-l2); background: transparent;
        color: var(--dsw-alias-label-primary); }
      .br-btn:hover { background: var(--dsw-alias-bg-layer-2); }
      .br-btn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
      .br-btn-edit { color: var(--dsw-alias-brand-primary);
        border-color: var(--dsw-alias-brand-primary); }
      .br-btn-del { margin-left: 6px; color: var(--dsw-alias-state-error-primary);
        border-color: var(--dsw-alias-state-error-primary); }
      .br-empty { padding: 14px; border: 1px dashed var(--dsw-alias-border-l2); border-radius: 8px;
        color: var(--dsw-alias-label-secondary); text-align: center; }
      .br-hint { margin-top: 18px; padding: 10px 12px; border-radius: 8px; font-size: 12px;
        color: var(--dsw-alias-label-secondary);
        background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1); }
      .br-error { padding: 12px; border-radius: 8px; color: var(--dsw-alias-state-error-primary);
        background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1); }
      .br-retry { margin-left: 8px; padding: 2px 10px; border-radius: 6px; cursor: pointer;
        border: 1px solid var(--dsw-alias-border-l2); background: transparent;
        color: var(--dsw-alias-brand-primary); font-size: 12px; }
      .br-dialog-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex;
        align-items: center; justify-content: center; z-index: 1000;
      }
      .br-dialog {
        background: var(--dsw-alias-bg-base); border: 1px solid var(--dsw-alias-border-l1);
        border-radius: 8px; padding: 20px; width: 90%; max-width: 420px; max-height: 90vh;
        overflow-y: auto; color: var(--dsw-alias-label-primary); box-sizing: border-box;
      }
      .br-dialog h3 { margin: 0 0 16px; font-size: 16px; font-weight: 600; }
       .br-field-error { margin: -6px 0 12px; padding: 8px; border-radius: 6px; color: var(--dsw-alias-state-error-primary); background: var(--dsw-alias-bg-layer-2); }
      .br-dialog label { display: block; margin-bottom: 4px; font-size: 12px;
       }
       .br-reminder-origin { margin-left: 8px; font-size: 11px; font-weight: 400; }
       .br-reminder-inherited { color: var(--dsw-alias-label-secondary); }
       .br-reminder-custom { color: var(--dsw-alias-brand-primary); }
       .br-dialog label { color: var(--dsw-alias-label-secondary); }
      .br-dialog input { width: 100%; padding: 7px 8px; border: 1px solid var(--dsw-alias-border-l1);
        border-radius: 6px; box-sizing: border-box; background: var(--dsw-alias-bg-layer-1);
        color: var(--dsw-alias-label-primary); font-size: 13px; }
      .br-dialog input:focus { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -1px; }
      .br-dialog-actions { display: flex; gap: 8px; margin-top: 16px; }
      .br-dialog-btn { flex: 1; padding: 7px 12px; border-radius: 6px; cursor: pointer;
        font-size: 13px; border: 1px solid var(--dsw-alias-border-l2); background: transparent;
        color: var(--dsw-alias-label-primary); }
      .br-dialog-btn:hover { background: var(--dsw-alias-bg-layer-2); }
      .br-dialog-btn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
      .br-dialog-btn-primary { border-color: var(--dsw-alias-brand-primary);
        color: var(--dsw-alias-brand-primary); font-weight: 600; }
    `;

    function daysClass(days, status) {
      if (status === 'overdue' || days < 0) return 'br-days br-overdue';
      if (status === 'today' || days === 0) return 'br-days br-now';
      if (status === 'remind' || days <= 3) return 'br-days br-soon';
      return 'br-days';
    }

    function daysText(days, t, status) {
      if (status === 'overdue' || days < 0) return `${t.overdue} ${Math.abs(days)} ${t.daysUnit}`;
      return days === 0 ? t.today : `${t.inDays} ${days} ${t.daysUnit}`;
    }

    /** 金额展示：千分位 + 两位小数；未录入返回 null，由调用方决定占位文案。 */
    function amountText(amount) {
      if (typeof amount !== 'number' || !Number.isFinite(amount)) return null;
      const fixed = amount.toFixed(2);
      const [int, dec] = fixed.split('.');
      return `¥${int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${dec}`;
    }

    function UpcomingSection({ snap, t }) {
      const items = snap.attention || snap.upcoming.filter((item) => item.remind);
      if (!items.length) {
        return h('div', { className: 'br-section' },
          h('h3', { className: 'br-section-title' }, t.upcoming),
          h('div', { className: 'br-empty' }, t.emptyAttention));
      }
      return h('div', { className: 'br-section' },
        h('h3', { className: 'br-section-title' }, t.upcoming),
        h('div', { className: 'br-list' }, items.map((n, i) => h('div', { key: `${n.cardId}-${n.type}-${i}`, className: 'br-item' },
          h('span', { className: 'br-alias' }, n.alias),
          h('span', { className: 'br-type' }, t[TYPE_KEY[n.type]] || n.type),
          h('span', { className: 'br-date' }, n.date),
          h('span', { className: daysClass(n.days, n.status) }, daysText(n.days, t, n.status))))));
    }

    function CardsSection({ snap, t, openEdit, onRemove }) {
      if (!snap.cards.length) {
        return h('div', { className: 'br-section' },
          h('h3', { className: 'br-section-title' }, t.allCards),
          h('div', { className: 'br-empty' }, t.empty));
      }
      const daysLabel = (d, status) => daysText(d, t, status);
      const rows = snap.cards.map((c) => {
        const st = c.nodes.find((n) => n.type === 'statement');
        const rp = c.nodes.find((n) => n.type === 'repayment');
        const an = c.nodes.find((n) => n.type === 'annual');
        const last4 = c.last4 ? `**** ${c.last4}` : '-';
        const cell = (dateText, node) => `${dateText}（${node ? daysLabel(node.days, node.status) : '-'}）`;
        // 本期账单列显示金额（元），而不是倒计时；未录入时给出明确占位。
        const billAmount = amountText(c.bill.amount);
        const billTitle = `${c.bill.statementDate} → ${c.bill.repaymentDate} · ${daysLabel(c.bill.days, c.bill.status)}`;
        return h('tr', { key: c.id, className: 'br-row' },
          h('td', { className: 'br-cell-alias' }, c.alias),
          h('td', {}, last4),
          h('td', {}, cell(t.fmtMonthly(c.statementDay), st)),
          h('td', {}, cell(t.fmtMonthly(c.repaymentDay), rp)),
          h('td', {}, cell(t.fmtAnnual(c.annualFeeMonth, c.annualFeeDay), an)),
          h('td', { className: 'br-cell-bill', title: billTitle },
            billAmount === null
              ? h('span', { className: 'br-bill-empty' }, t.billNotSet)
              : billAmount),
          h('td', { className: 'br-cell-actions' },
            h('button', {
              type: 'button',
              className: 'br-btn br-btn-edit',
              title: t.editBtn,
              onClick: () => openEdit(c),
            }, t.editBtn),
            onRemove
              ? h('button', {
                type: 'button',
                className: 'br-btn br-btn-del',
                title: t.deleteBtn,
                onClick: () => onRemove(c),
              }, t.deleteBtn)
              : null));
      });
      return h('div', { className: 'br-section' },
        h('h3', { className: 'br-section-title' }, t.allCards),
        h('div', { className: 'br-table-wrap' },
          h('table', { className: 'br-table' },
            h('thead', {},
              h('tr', {},
                h('th', {}, t.tableAlias),
                h('th', {}, t.tableLast4),
                h('th', {}, t.tableStatement),
                h('th', {}, t.tableRepayment),
                h('th', {}, t.tableAnnual),
                h('th', {}, t.tableUpcoming),
                h('th', {}, t.tableActions))),
            h('tbody', {}, rows))));
    }

    function Panel() {
      const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
      const loadError = useSyncExternalStore(subscribe, getError, getError);
      const t = L();
      const [editing, setEditing] = useState(null);
      const [conflict, setConflict] = useState(false);
       const [pendingPatch, setPendingPatch] = useState(null);
       const [settingsOpen, setSettingsOpen] = useState(false);
       const [backupOpen, setBackupOpen] = useState(false);
       const [deleteTarget, setDeleteTarget] = useState(null);
       const [undoItem, setUndoItem] = useState(null);
      const openEdit = (card) => setEditing({ ...card, _revision: snap?.revision });
      const openAdd = () => setEditing({
        id: null,
        alias: '',
        last4: null,
        statementDay: '',
        repaymentDay: '',
        annualFeeMonth: '',
        annualFeeDay: '',
        billAmount: null,
         _revision: snap?.revision,
      });
      const closeEdit = async () => {
        setEditing(null);
      };
      const handleSettingsSave = async (values) => {
        try {
          await api('ops', { op: 'setAdvance', global: true, repayAdvanceDays: values.repayAdvanceDays, annualAdvanceDays: values.annualAdvanceDays, expectedRevision: snap?.revision });
        } catch (err) {
          if (err.code === 'VERSION_CONFLICT' || err.status === 409) {
             setConflict(true);
             error = null;
           } else {
             error = err.message;
           }
          emit();
          return;
        }
        setSettingsOpen(false);
        await reload();
      };
      const handleRemove = (card) => setDeleteTarget(card);
       const confirmRemove = async () => {
         const card = deleteTarget;
         if (!card) return;
        setDeleteTarget(null);
        try {
          const result = await api('ops', { op: 'remove', id: card.id, expectedRevision: snap?.revision });
           if (result.restoreToken) setUndoItem({ restoreToken: result.restoreToken, expiresAt: result.expiresAt });
        } catch (err) {
          if (err.code === 'VERSION_CONFLICT' || err.status === 409) {
             setConflict(true);
             error = null;
           } else {
             error = err.message;
           }
          emit();
          return;
        }
        if (editing && editing.id === card.id) setEditing(null);
        reload();
      };
      // 删除成功后使用服务端一次性 restore token 撤销。
         
         const undoRemove = async () => {
         if (!undoItem?.restoreToken) return;
         try {
           await api('ops', { op: 'restore', restoreToken: undoItem.restoreToken, expectedRevision: snap?.revision });
           setUndoItem(null);
           await reload();
         } catch (err) {
           error = err.message || t.undoFailed;
           emit();
         }
       };
       const handleSave = async (patch, force = false) => {
         setPendingPatch(patch);
        if (!editing) return;
        const isNew = !editing.id;
        try {
          await api('ops', {
            op: isNew ? 'add' : 'update',
            ...(isNew ? {} : { id: editing.id }),
            alias: patch.alias,
            last4: patch.last4,
            statementDay: patch.statement_day,
            repaymentDay: patch.repayment_day,
            annualFeeMonth: patch.annual_fee_month,
            annualFeeDay: patch.annual_fee_day,
            repayAdvanceDays: patch.repay_advance_days,
            annualAdvanceDays: patch.annual_advance_days,
            billAmount: patch.bill_amount,
             ...(isNew ? {} : force ? { expectedRevision: editing._revision, force: true, force_confirm: true } : { expectedRevision: editing._revision }),
          });
        } catch (err) {
          if (err.code === 'VERSION_CONFLICT' || err.status === 409) {
             setConflict(true);
             error = null;
           } else {
             error = err.message;
           }
          emit();
          return;
        }
        setConflict(false);
         setPendingPatch(null);
         closeEdit();
        reload();
      };
      useEffect(() => {
        reload();
       const forceSave = async () => {
         if (!pendingPatch || !window.confirm(t.confirmForce)) return;
         await handleSave(pendingPatch, true);
       };
       const timer = setInterval(reload, 30_000);
        const onVisible = () => { if (document.visibilityState === 'visible') reload(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
      }, []);
      return h('div', { className: 'br-panel' },
        h('style', {}, css),
        h('div', { className: 'br-header' },
          h('div', {}, h('h2', {}, t.title), h('p', { className: 'br-sub' }, t.subtitle)),
          h('div', { className: 'br-header-actions' },
             h('button', { type: 'button', className: 'br-btn br-btn-primary', onClick: () => setBackupOpen(true) }, t.backupBtn),
              h('button', { type: 'button', className: 'br-btn br-btn-primary', onClick: () => setSettingsOpen(true) }, t.settingsBtn),
             h('button', { type: 'button', className: 'br-btn br-btn-primary', onClick: openAdd }, t.addBtn))),
        loadError
          ? h('div', { className: 'br-error', style: { marginTop: 16 } },
            `${t.loadFailed}：${loadError}`,
            h('button', { className: 'br-retry', onClick: reload }, t.retry))
          : snap
            ? [h(UpcomingSection, { key: 'up', snap, t }), h(CardsSection, { key: 'cards', snap, t, openEdit, onRemove: handleRemove })]
            : h('div', { className: 'br-empty', style: { marginTop: 16 } }, '…'),
        h('div', { className: 'br-hint' }, t.hint),
         undoItem && h('div', { className: 'br-error', role: 'status' },
           `${undoItem.alias || ''} ${t.deleted || ''}`,
           h('button', { type: 'button', className: 'br-btn br-btn-primary', onClick: undoRemove }, t.undo)),
         deleteTarget && h(ConfirmDialog, { title: t.deleteBtn, body: t.confirmDelete(deleteTarget.alias), onCancel: () => setDeleteTarget(null), onConfirm: confirmRemove }),
        editing && h(EditDialog,
          { card: editing, defaults: snap?.defaults, isNew: !editing.id, conflict, onSave: (patch) => handleSave(patch), onForceSave: forceSave, onReloadLatest: async () => { setConflict(false); setPendingPatch(null); setEditing(null); await reload(); }, onCancel: closeEdit },
          null),
         backupOpen && h(BackupDialog, { onClose: () => setBackupOpen(false), onImported: () => reload() }),
         settingsOpen && snap && h(SettingsDialog, {
           defaults: snap.defaults,
           onSave: handleSettingsSave,
           onCancel: () => setSettingsOpen(false),
         }));
    }

    // ---------- 槽位注册 ----------

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'billremind' }, Panel));
        ctx.effect(() => {
          let disposer = null;
          const register = () => {
            disposer?.();
            disposer = ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
              name: 'sidebar.panellist',
              id: 'billremind',
              order: 7,
              label: () => (isZh() ? '账单提醒' : 'Bill Remind'),
            }, Icon));
          };
          register();
          return () => { disposer?.(); };
        }, 'dsh-billremind: sidebar entry');
      },
    };
  },
});