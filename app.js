const SHIFTS={
  ca1:{key:'ca1',name:'Ca 1',time:'05:00 - 11:00'},
  ca2:{key:'ca2',name:'Ca 2',time:'14:00 - 18:00'},
  ca3:{key:'ca3',name:'Ca 3',time:'18:00 - 22:00'}
};
const STORAGE={
  active:'r971_staff_active_shift_v1',
  history:'r971_staff_shift_history_v1',
  employee:'r971_staff_employee_v1',
  debts:'r971_staff_customer_debts_v1'
};
const $=id=>document.getElementById(id);
const currency=new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0});
let selectedShift=null,elapsedTimer=null,deferredPrompt=null;

function localDateKey(date=new Date()){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
function vnDate(date=new Date()){
  return new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'}).format(date);
}
function vnDateShort(iso){
  return new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(iso));
}
function vnTime(iso){
  return new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(iso));
}
function money(n){return currency.format(Number(n)||0)}
function readHistory(){try{return JSON.parse(localStorage.getItem(STORAGE.history)||'[]')}catch{return []}}
function saveHistory(items){localStorage.setItem(STORAGE.history,JSON.stringify(items))}
function readDebts(){try{return JSON.parse(localStorage.getItem(STORAGE.debts)||'[]')}catch{return []}}
function saveDebts(items){localStorage.setItem(STORAGE.debts,JSON.stringify(items))}
function getActive(){
  try{
    const active=JSON.parse(localStorage.getItem(STORAGE.active)||'null');
    return active?normalizeActive(active):null;
  }catch{return null}
}
function normalizeActive(active){
  if(!active.totals){
    const d=active.draft||{};
    active.totals={
      transfer:Number(d.transfer||0),
      cash:Number(d.cash||0),
      courtRevenue:Number(d.courtRevenue||0),
      waterRevenue:Number(d.waterRevenue||0)
    };
  }
  if(!Array.isArray(active.entries))active.entries=[];
  delete active.draft;
  return active;
}
function setActive(value){value?localStorage.setItem(STORAGE.active,JSON.stringify(value)):localStorage.removeItem(STORAGE.active)}
function parseMoney(value){return Number(String(value||'').replace(/\D/g,''))||0}
function formatMoneyInput(el){const n=parseMoney(el.value);el.value=n?new Intl.NumberFormat('vi-VN').format(n):''}
function setMoneyInput(id,value){const el=$(id);if(el)el.value=Number(value||0)?new Intl.NumberFormat('vi-VN').format(Number(value||0)):''}
function clearEntryInputs(){['entryTransfer','entryCash','entryCourt','entryWater'].forEach(id=>{if($(id))$(id).value=''})}
function clearDebtInputs(){['debtCustomer','debtReason','debtAmount'].forEach(id=>{if($(id))$(id).value=''})}
function toast(message){const t=$('toast');t.textContent=message;t.classList.add('show');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),2600)}
function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

function selectShift(key){
  selectedShift=key;
  document.querySelectorAll('.shift-option').forEach(btn=>btn.classList.toggle('selected',btn.dataset.shift===key));
  updateStartButton();
}
function updateStartButton(){
  const name=$('employeeName').value.trim();
  $('startShiftBtn').disabled=!selectedShift||!name||!!getActive();
}
function beginShift(){
  const employee=$('employeeName').value.trim();
  if(!selectedShift||!employee)return toast('Nhập tên nhân viên và chọn ca');
  if(getActive())return toast('Đang có một ca chưa kết thúc');
  const shift=SHIFTS[selectedShift];
  const now=new Date();
  const record={
    id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),
    shiftKey:shift.key,
    shiftName:shift.name,
    scheduledTime:shift.time,
    employee,
    startAt:now.toISOString(),
    dateKey:localDateKey(now),
    totals:{transfer:0,cash:0,courtRevenue:0,waterRevenue:0},
    entries:[]
  };
  localStorage.setItem(STORAGE.employee,employee);
  setActive(record);
  selectedShift=null;
  clearEntryInputs();
  render();
  toast(`Đã bắt đầu ${shift.name}`);
}
function renderActive(){
  const active=getActive();
  $('activeShiftCard').classList.toggle('hidden',!active);
  $('startShiftCard').classList.toggle('hidden',!!active);
  if(!active){clearInterval(elapsedTimer);elapsedTimer=null;return}
  setActive(active);
  const shift=SHIFTS[active.shiftKey]||{name:active.shiftName,time:active.scheduledTime};
  $('activeShiftName').textContent=shift.name;
  $('activeShiftMeta').textContent=`${active.employee} · ${shift.time} · bắt đầu thực tế ${vnTime(active.startAt)}`;
  renderActiveTotals(active);
  renderEntryList(active);
  updateElapsed(active.startAt);
  clearInterval(elapsedTimer);elapsedTimer=setInterval(()=>updateElapsed(active.startAt),1000);
}
function updateElapsed(startAt){
  const ms=Math.max(0,Date.now()-new Date(startAt).getTime());
  const total=Math.floor(ms/1000),h=Math.floor(total/3600),m=Math.floor((total%3600)/60),s=total%60;
  $('elapsedTime').textContent=[h,m,s].map(x=>String(x).padStart(2,'0')).join(':');
}
function renderActiveTotals(active=getActive()){
  if(!active)return;
  const t=active.totals||{};
  const transfer=Number(t.transfer||0),cash=Number(t.cash||0),court=Number(t.courtRevenue||0),water=Number(t.waterRevenue||0);
  const collected=transfer+cash,revenue=court+water,difference=collected-revenue;
  $('liveTransferTotal').textContent=money(transfer);
  $('liveCashTotal').textContent=money(cash);
  $('liveCourtTotal').textContent=money(court);
  $('liveWaterTotal').textContent=money(water);
  $('liveCollectedTotal').textContent=money(collected);
  $('liveRevenueTotal').textContent=money(revenue);
  $('liveDifferenceTotal').textContent=money(difference);
  $('liveDifferenceTotal').className=difference<0?'negative':difference>0?'positive':'';
}
function addEntry(){
  const active=getActive();if(!active)return toast('Chưa bắt đầu ca');
  const entry={
    id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),
    at:new Date().toISOString(),
    transfer:parseMoney($('entryTransfer').value),
    cash:parseMoney($('entryCash').value),
    courtRevenue:parseMoney($('entryCourt').value),
    waterRevenue:parseMoney($('entryWater').value)
  };
  if(!(entry.transfer||entry.cash||entry.courtRevenue||entry.waterRevenue))return toast('Hãy nhập ít nhất một khoản tiền');
  active.totals.transfer+=entry.transfer;
  active.totals.cash+=entry.cash;
  active.totals.courtRevenue+=entry.courtRevenue;
  active.totals.waterRevenue+=entry.waterRevenue;
  active.entries.unshift(entry);
  setActive(active);
  clearEntryInputs();
  renderActiveTotals(active);
  renderEntryList(active);
  toast('Đã cộng vào ca');
}
function deleteEntry(id){
  const active=getActive();if(!active)return;
  const entry=active.entries.find(x=>x.id===id);if(!entry)return;
  if(!confirm('Xóa khoản đã nhập này?'))return;
  active.totals.transfer=Math.max(0,active.totals.transfer-Number(entry.transfer||0));
  active.totals.cash=Math.max(0,active.totals.cash-Number(entry.cash||0));
  active.totals.courtRevenue=Math.max(0,active.totals.courtRevenue-Number(entry.courtRevenue||0));
  active.totals.waterRevenue=Math.max(0,active.totals.waterRevenue-Number(entry.waterRevenue||0));
  active.entries=active.entries.filter(x=>x.id!==id);
  setActive(active);
  renderActiveTotals(active);
  renderEntryList(active);
  toast('Đã xóa khoản nhập');
}
function renderEntryList(active=getActive()){
  if(!active)return;
  const list=active.entries||[];
  $('emptyEntryList').classList.toggle('hidden',list.length>0);
  $('entryList').innerHTML=list.map(e=>{
    const parts=[];
    if(e.transfer)parts.push(`CK ${money(e.transfer)}`);
    if(e.cash)parts.push(`TM ${money(e.cash)}`);
    if(e.courtRevenue)parts.push(`Sân ${money(e.courtRevenue)}`);
    if(e.waterRevenue)parts.push(`Nước ${money(e.waterRevenue)}`);
    return `<div class="card" style="padding:12px;margin:8px 0;background:#fff">
      <div class="top" style="display:flex;justify-content:space-between;gap:10px;align-items:center">
        <div><b>${vnTime(e.at)}</b><div class="muted" style="margin-top:4px">${parts.join(' · ')}</div></div>
        <button type="button" class="btn btn-secondary" style="padding:8px 10px" onclick="deleteEntry('${e.id}')">Xóa</button>
      </div>
    </div>`;
  }).join('');
}

function addDebt(){
  const active=getActive();
  if(!active)return toast('Hãy bắt đầu ca trước khi ghi khách nợ');
  const customer=$('debtCustomer').value.trim();
  const reason=$('debtReason').value.trim();
  const amount=parseMoney($('debtAmount').value);
  if(!customer)return toast('Nhập tên khách');
  if(!reason)return toast('Nhập khách nợ gì');
  if(!amount)return toast('Nhập tổng nợ');
  const debt={
    id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),
    createdAt:new Date().toISOString(),
    dateKey:localDateKey(),
    customer:customer.slice(0,80),
    reason:reason.slice(0,160),
    amount,
    employee:active.employee,
    shiftKey:active.shiftKey,
    shiftName:active.shiftName
  };
  const debts=readDebts();
  debts.unshift(debt);
  saveDebts(debts);
  clearDebtInputs();
  renderDebts();
  toast('Đã thêm khách nợ');
}
function deleteDebt(id){
  const debts=readDebts();
  const debt=debts.find(x=>x.id===id);if(!debt)return;
  if(!confirm(`Xóa khoản nợ của ${debt.customer}?`))return;
  saveDebts(debts.filter(x=>x.id!==id));
  renderDebts();
  toast('Đã xóa khoản nợ');
}
function renderDebts(){
  const debts=readDebts();
  const total=debts.reduce((sum,x)=>sum+Number(x.amount||0),0);
  $('debtGrandTotal').textContent=money(total);
  $('emptyDebtList').classList.toggle('hidden',debts.length>0);
  $('debtList').innerHTML=debts.map(d=>`<div class="card" style="padding:13px;margin:9px 0;background:#fffaf0;border-color:#fed7aa">
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
      <div style="min-width:0">
        <div style="font-size:17px;font-weight:900">${escapeHtml(d.customer)}</div>
        <div class="muted" style="margin-top:4px">Nợ: <b>${escapeHtml(d.reason)}</b></div>
        <div class="muted" style="margin-top:4px">${vnDateShort(d.createdAt)} · ${vnTime(d.createdAt)} · ${escapeHtml(d.employee||'')} · ${escapeHtml(d.shiftName||'')}</div>
      </div>
      <div style="text-align:right;flex:0 0 auto">
        <div style="font-size:18px;font-weight:900;color:#b45309">${money(d.amount)}</div>
        <button type="button" class="btn btn-secondary" style="padding:7px 10px;margin-top:8px" onclick="deleteDebt('${d.id}')">Xóa</button>
      </div>
    </div>
  </div>`).join('');
}

function openEndDialog(){
  const active=getActive();if(!active)return;
  const t=active.totals||{};
  $('endDialogTitle').textContent=`Kết thúc ${active.shiftName} · ${active.employee}`;
  setMoneyInput('transferAmount',t.transfer);
  setMoneyInput('cashAmount',t.cash);
  setMoneyInput('courtRevenue',t.courtRevenue);
  setMoneyInput('waterRevenue',t.waterRevenue);
  $('shiftNote').value='';
  updateReconcile();
  $('endShiftDialog').showModal();
}
function closeEndDialog(){$('endShiftDialog').close()}
function updateReconcile(){
  const transfer=parseMoney($('transferAmount').value),cash=parseMoney($('cashAmount').value),court=parseMoney($('courtRevenue').value),water=parseMoney($('waterRevenue').value);
  const collected=transfer+cash,revenue=court+water,difference=collected-revenue;
  $('collectedTotal').textContent=money(collected);$('revenueTotal').textContent=money(revenue);$('differenceTotal').textContent=money(difference);
  $('differenceTotal').className=difference<0?'negative':difference>0?'positive':'';
}
function finishShift(e){
  e.preventDefault();
  const active=getActive();if(!active)return closeEndDialog();
  const t=active.totals||{};
  const transfer=Number(t.transfer||0),cash=Number(t.cash||0),court=Number(t.courtRevenue||0),water=Number(t.waterRevenue||0);
  const collected=transfer+cash,revenue=court+water,difference=collected-revenue;
  if(!confirm(`Xác nhận kết thúc ${active.shiftName}?\nTổng doanh thu: ${money(revenue)}\nChênh lệch: ${money(difference)}`))return;
  const completed={...active,endAt:new Date().toISOString(),transfer,cash,courtRevenue:court,waterRevenue:water,collectedTotal:collected,revenueTotal:revenue,difference,note:$('shiftNote').value.trim(),status:'completed'};
  delete completed.totals;
  const history=readHistory();history.unshift(completed);saveHistory(history);setActive(null);closeEndDialog();clearEntryInputs();render();toast(`Đã kết thúc ${active.shiftName}`);
}

function recordsFor(dateKey,shiftKey='all'){
  return readHistory().filter(x=>x.dateKey===dateKey&&(shiftKey==='all'||x.shiftKey===shiftKey));
}
function renderSummary(){
  const date=$('summaryDate').value||localDateKey();
  const list=recordsFor(date);
  const sums=list.reduce((a,x)=>({transfer:a.transfer+Number(x.transfer||0),cash:a.cash+Number(x.cash||0),court:a.court+Number(x.courtRevenue||0),water:a.water+Number(x.waterRevenue||0),revenue:a.revenue+Number(x.revenueTotal||0)}),{transfer:0,cash:0,court:0,water:0,revenue:0});
  $('summaryDateTitle').textContent=date===localDateKey()?'Hôm nay':prettyDateKey(date);
  $('sumTransfer').textContent=money(sums.transfer);$('sumCash').textContent=money(sums.cash);$('sumCourt').textContent=money(sums.court);$('sumWater').textContent=money(sums.water);$('sumRevenue').textContent=money(sums.revenue);
}
function prettyDateKey(key){const [y,m,d]=key.split('-');return `${d}/${m}/${y}`}
function renderHistory(){
  const date=$('historyDate').value||localDateKey(),shift=$('historyShift').value||'all',list=recordsFor(date,shift);
  $('emptyHistory').classList.toggle('hidden',list.length>0);
  $('historyList').innerHTML=list.map(x=>{
    const diffClass=x.difference<0?'negative':x.difference>0?'positive':'';
    const diffText=x.difference===0?'Khớp tiền':x.difference>0?'Thừa':'Thiếu';
    const entryCount=Array.isArray(x.entries)?x.entries.length:0;
    return `<article class="history-item">
      <div class="history-top"><div><div class="history-title">${escapeHtml(x.shiftName)} · ${escapeHtml(x.employee)}</div><div class="history-meta">${vnDateShort(x.startAt)} · ${vnTime(x.startAt)} → ${vnTime(x.endAt)} · ${escapeHtml(x.scheduledTime)}</div></div><div class="history-money">${money(x.revenueTotal)}</div></div>
      <div class="history-detail">
        <div>Chuyển khoản<b>${money(x.transfer)}</b></div><div>Tiền mặt<b>${money(x.cash)}</b></div><div>Doanh thu sân<b>${money(x.courtRevenue)}</b></div><div>Doanh thu nước<b>${money(x.waterRevenue)}</b></div>
        <div class="difference ${diffClass}">${diffText}<b>${money(x.difference)}</b></div>
        ${entryCount?`<div class="note">Đã ghi nhận <b>${entryCount} lần</b> trong ca</div>`:''}
        ${x.note?`<div class="note">Ghi chú: <b>${escapeHtml(x.note)}</b></div>`:''}
      </div>
    </article>`
  }).join('');
}
function exportCsv(){
  const date=$('historyDate').value||localDateKey(),shift=$('historyShift').value||'all',list=recordsFor(date,shift);if(!list.length)return toast('Không có dữ liệu để xuất');
  const rows=[['Ngày','Ca','Khung giờ','Nhân viên','Bắt đầu','Kết thúc','Chuyển khoản','Tiền mặt','Doanh thu sân','Doanh thu nước','Tổng tiền thu','Tổng doanh thu','Chênh lệch','Số lần ghi nhận','Ghi chú'],...list.map(x=>[prettyDateKey(x.dateKey),x.shiftName,x.scheduledTime,x.employee,vnTime(x.startAt),vnTime(x.endAt),x.transfer,x.cash,x.courtRevenue,x.waterRevenue,x.collectedTotal,x.revenueTotal,x.difference,Array.isArray(x.entries)?x.entries.length:0,x.note||''])];
  const csv='\ufeff'+rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`971-doanh-thu-${date}-${shift}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function render(){renderActive();renderSummary();renderDebts();renderHistory();updateStartButton()}

function setup(){
  const today=localDateKey();$('todayLabel').textContent=vnDate();$('summaryDate').value=today;$('historyDate').value=today;$('employeeName').value=localStorage.getItem(STORAGE.employee)||'';
  document.querySelectorAll('.shift-option').forEach(btn=>btn.addEventListener('click',()=>selectShift(btn.dataset.shift)));
  $('employeeName').addEventListener('input',updateStartButton);
  $('startShiftBtn').addEventListener('click',beginShift);
  $('addEntryBtn').addEventListener('click',addEntry);
  $('addDebtBtn').addEventListener('click',addDebt);
  $('openEndShiftBtn').addEventListener('click',openEndDialog);
  $('closeDialogBtn').addEventListener('click',closeEndDialog);
  $('endShiftForm').addEventListener('submit',finishShift);
  document.querySelectorAll('.entry-money-input').forEach(el=>{el.addEventListener('input',()=>formatMoneyInput(el));el.addEventListener('focus',()=>el.select());el.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addEntry()}})});
  $('debtAmount').addEventListener('input',()=>formatMoneyInput($('debtAmount')));
  $('debtAmount').addEventListener('focus',()=>$('debtAmount').select());
  $('debtAmount').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addDebt()}});
  $('summaryDate').addEventListener('change',renderSummary);$('historyDate').addEventListener('change',renderHistory);$('historyShift').addEventListener('change',renderHistory);$('exportBtn').addEventListener('click',exportCsv);
  $('endShiftDialog').addEventListener('click',e=>{if(e.target===$('endShiftDialog'))closeEndDialog()});
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('installBtn').classList.remove('hidden')});
  $('installBtn').addEventListener('click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('installBtn').classList.add('hidden')});
  window.addEventListener('appinstalled',()=>{$('installBtn').classList.add('hidden');toast('Đã cài ứng dụng')});
  if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
  render();
}
document.addEventListener('DOMContentLoaded',setup);
