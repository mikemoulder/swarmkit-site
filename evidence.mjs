const target=document.getElementById('receipt-table');
let request=0;
const nearAmount=value=>{const digits=String(value).padStart(25,'0');const fraction=digits.slice(-24).replace(/0+$/,'');return digits.slice(0,-24)+(fraction?'.'+fraction:'');};
async function show(scenario){
 const current=++request;
 try{
  const response=await fetch(`./evidence/${scenario}.json`);if(!response.ok)throw new Error('Evidence unavailable');
  const data=await response.json();if(current!==request)return;
  document.getElementById('payment-count').textContent=`${data.receipts.filter(r=>r.status==='confirmed').length}/${data.plan.payments.length}`;
  document.getElementById('near-total').textContent=scenario==='gpu'?'0.036':'0.0014';
  document.getElementById('evidence-download').href=`./evidence/${scenario}.json`;
  document.querySelectorAll('[data-evidence]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.evidence===scenario)));
  const table=document.createElement('table'),head=table.createTHead().insertRow();
  for(const title of ['Buyer','Seller','Amount · testnet NEAR','Finalized transaction']){const th=document.createElement('th');th.textContent=title;head.append(th);}
  const body=table.createTBody();
  for(const p of data.plan.payments){const row=body.insertRow();for(const value of [p.buyerId.split('.')[0],p.sellerId.split('.')[0],nearAmount(p.amount)])row.insertCell().textContent=value;
   const receipt=data.receipts.find(r=>r.paymentId===p.id),cell=row.insertCell();
   if(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(receipt?.transactionHash)){const a=document.createElement('a');a.href='https://testnet.nearblocks.io/txns/'+receipt.transactionHash;a.textContent=receipt.transactionHash.slice(0,20)+'… ↗';cell.append(a);}
  }target.replaceChildren(table);
 }catch{target.textContent='Could not load receipts. Download the full record to inspect the run.';}
}
document.querySelectorAll('[data-evidence]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.evidence)));
void show('gpu');
