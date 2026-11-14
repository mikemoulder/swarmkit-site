const target = document.getElementById('receipt-table');
const totals = { gpu: '0.036', split: '0.0014' };
let request = 0;

const nearAmount = value => {
  const digits = String(value).padStart(25, '0');
  const fraction = digits.slice(-24).replace(/0+$/, '');
  return digits.slice(0, -24) + (fraction ? '.' + fraction : '');
};

async function show(scenario) {
  const current = ++request;
  document.querySelectorAll('[data-evidence]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.evidence === scenario)));
  try {
    const response = await fetch(`./evidence/${scenario}.json`);
    if (!response.ok) throw new Error('Evidence unavailable');
    const data = await response.json();
    if (current !== request) return;
    const final = data.receipts.filter(r => r.status === 'confirmed').length;
    document.getElementById('payment-count').textContent = `${final} of ${data.plan.payments.length}`;
    document.getElementById('near-total').textContent = totals[scenario];
    document.getElementById('evidence-download').href = `./evidence/${scenario}.json`;
    const table = document.createElement('table');
    const head = table.createTHead().insertRow();
    for (const title of ['Buyer', 'Seller', 'Testnet NEAR', 'Finalized transaction']) { const th = document.createElement('th'); th.scope = 'col'; th.textContent = title; head.append(th); }
    const body = table.createTBody();
    for (const p of data.plan.payments) {
      const row = body.insertRow();
      for (const value of [p.buyerId.split('.')[0], p.sellerId.split('.')[0], nearAmount(p.amount)]) row.insertCell().textContent = value;
      const receipt = data.receipts.find(r => r.paymentId === p.id), cell = row.insertCell();
      if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(receipt?.transactionHash)) {
        const a = document.createElement('a');
        a.href = 'https://testnet.nearblocks.io/txns/' + receipt.transactionHash;
        a.textContent = receipt.transactionHash.slice(0, matchMedia('(max-width: 639px)').matches ? 8 : 16) + '…';
        a.setAttribute('aria-label', `Transaction ${receipt.transactionHash} on NearBlocks`);
        cell.append(a);
      }
    }
    target.replaceChildren(table);
  } catch {
    target.textContent = 'The receipts could not load. Download the JSON record to inspect the run.';
  }
}

document.querySelectorAll('[data-evidence]').forEach(b => b.addEventListener('click', () => show(b.dataset.evidence)));
void show('gpu');
