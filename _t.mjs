import { Store } from './store.js';
import { BillService } from './service.js';

const now = new Date('2026-11-10T10:00:00+08:00');
const store = new Store();
const svc = new BillService(store);

await svc.addCard({ alias: '招行 Visa', last4: '8888', statementDay: 15, repaymentDay: 25, annualFeeMonth: 8, annualFeeDay: 15, repayAdvanceDays: 7, billAmount: '1,234.56' });
await svc.addCard({ alias: '建设银行', last4: '6789', statementDay: 5, repaymentDay: 18, annualFeeMonth: 10, annualFeeDay: 10 });

let snap = await svc.snapshot(now);
for (const c of snap.cards) console.log(c.alias, '| billAmount =', c.billAmount, '| bill.amount =', c.bill.amount, '| days =', c.bill.days);

await svc.updateCard('建设银行', { billAmount: 0 });
snap = await svc.snapshot(now);
console.log('after set 0:', snap.cards[1].billAmount, snap.cards[1].bill.amount);

await svc.updateCard('建设银行', { billAmount: null });
snap = await svc.snapshot(now);
console.log('after clear:', snap.cards[1].billAmount, snap.cards[1].bill.amount);

for (const bad of [-1, 'abc', '1.234', '1e5']) {
  try { await svc.updateCard('招行 Visa', { billAmount: bad }); console.log('BAD accepted:', bad); }
  catch (e) { console.log('rejected', JSON.stringify(bad), '->', e.message); }
}

const svc2 = new BillService(new Store());
const snap2 = await svc2.snapshot(now);
console.log('reload amounts:', snap2.cards.map((c) => c.bill.amount));

const { createBillTool } = await import('./tools.js');
const tool = createBillTool(svc2);
const res = await tool.execute({ action: 'list' });
console.log('---- markdown ----');
console.log(res.markdown);
const upd = await tool.execute({ action: 'update', id: '建设银行', bill_amount: 5200.5 });
console.log('---- after update via tool ----');
console.log(upd.markdown);
