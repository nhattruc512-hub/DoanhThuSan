const SHIFTS={
  ca1:{key:'ca1',name:'Ca 1',time:'05:00 - 11:00'},
  ca2:{key:'ca2',name:'Ca 2',time:'14:00 - 18:00'},
  ca3:{key:'ca3',name:'Ca 3',time:'18:00 - 22:00'}
};
const STORAGE={active:'r971_staff_active_shift_v1',history:'r971_staff_shift_history_v1',employee:'r971_staff_employee_v1'};
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
function getActive(){try{return JSON.parse(localStorage.getItem(STORAGE.active)||'null')}catch{return null}}
function setActive(value){value?localStorage.setItem(STORAGE.active,JSON.stringify(value)):localStorage.removeItem(STORAGE.active)}
function parseMoney(value){return Number(String(value||'').replace(/\D/g,''))||0}
function formatMoneyInput(el){const n=parseMoney(el.value);el.value=n?new Intl.NumberFormat('vi-VN').format(n):''}
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
  const record={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),shiftKey:shift.key,shiftName:shift.name,scheduledTime:shift.time,employee,startAt:now.toISOString(),dateKey:localDateKey(now)};
  localStorage.setItem(STORAGE.employee,employee);
  setActive(record);
  selectedShift=null;
  render();
  toast(`Đã bắt đầu ${shift.name}`);
}
function renderActive(){
  const active=getActive();
  $('activeShiftCard').classList.toggle('hidden',!active);
  $('startShiftCard').classList.toggle('hidden',!!active);
  if(!active){clearInterval(elapsedTimer);elapsedTimer=null;return}
  const shift=SHIFTS[active.shiftKey]||{name:active.shiftName,time:active.scheduledTime};
  $('activeShiftName').textContent=shift.name;
  $('activeShiftMeta').textContent=`${active.employee} · ${shift.time} · bắt đầu thực tế ${vnTime(active.startAt)}`;
  updateElapsed(active.startAt);
  clearInterval(elapsedTimer);elapsedTimer=setInterval(()=>updateElapsed(active.startAt),1000);
}
function updateElapsed(startAt){
  const ms=Math.max(0,Date.now()-new Date(startAt).getTime());
  const total=Math.floor(ms/1000),h=Math.floor(total/3600),m=Math.floor((total%3600)/60),s=total%60;
  $('elapsedTime').textContent=[h,m,s].map(x=>String(x).padStart(2,'0')).join(':');
}
function openEndDialog(){
  const active=getActive();if(!active)return;
  $('endDialogTitle').textContent=`Kết thúc ${active.shiftName} · ${active.employee}`;
  ['transferAmount','cashAmount','courtRevenue','waterRevenue','shiftNote'].forEach(id=>$(id).value='');
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
  const transfer=parseMoney($('transferAmount').value),cash=parseMoney($('cashAmount').value),court=parseMoney($('courtRevenue').value),water=parseMoney($('waterRevenue').value);
  const collected=transfer+cash,revenue=court+water,difference=collected-revenue;
  if(!confirm(`Xác nhận kết thúc ${active.shiftName}?\nTổng doanh thu: ${money(revenue)}\nChênh lệch: ${money(difference)}`))return;
  const completed={...active,endAt:new Date().toISOString(),transfer,cash,courtRevenue:court,waterRevenue:water,collectedTotal:collected,revenueTotal:revenue,difference,note:$('shiftNote').value.trim(),status:'completed'};
  const history=readHistory();history.unshift(completed);saveHistory(history);setActive(null);closeEndDialog();render();toast(`Đã kết thúc ${active.shiftName}`);
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
    return `<article class="history-item">
      <div class="history-top"><div><div class="history-title">${escapeHtml(x.shiftName)} · ${escapeHtml(x.employee)}</div><div class="history-meta">${vnDateShort(x.startAt)} · ${vnTime(x.startAt)} → ${vnTime(x.endAt)} · ${escapeHtml(x.scheduledTime)}</div></div><div class="history-money">${money(x.revenueTotal)}</div></div>
      <div class="history-detail">
        <div>Chuyển khoản<b>${money(x.transfer)}</b></div><div>Tiền mặt<b>${money(x.cash)}</b></div><div>Doanh thu sân<b>${money(x.courtRevenue)}</b></div><div>Doanh thu nước<b>${money(x.waterRevenue)}</b></div>
        <div class="difference ${diffClass}">${diffText}<b>${money(x.difference)}</b></div>
        ${x.note?`<div class="note">Ghi chú: <b>${escapeHtml(x.note)}</b></div>`:''}
      </div>
    </article>`
  }).join('');
}
function exportCsv(){
  const date=$('historyDate').value||localDateKey(),shift=$('historyShift').value||'all',list=recordsFor(date,shift);if(!list.length)return toast('Không có dữ liệu để xuất');
  const rows=[['Ngày','Ca','Khung giờ','Nhân viên','Bắt đầu','Kết thúc','Chuyển khoản','Tiền mặt','Doanh thu sân','Doanh thu nước','Tổng tiền thu','Tổng doanh thu','Chênh lệch','Ghi chú'],...list.map(x=>[prettyDateKey(x.dateKey),x.shiftName,x.scheduledTime,x.employee,vnTime(x.startAt),vnTime(x.endAt),x.transfer,x.cash,x.courtRevenue,x.waterRevenue,x.collectedTotal,x.revenueTotal,x.difference,x.note||''])];
  const csv='\ufeff'+rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`971-doanh-thu-${date}-${shift}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function render(){renderActive();renderSummary();renderHistory();updateStartButton()}

function setup(){
  const today=localDateKey();$('todayLabel').textContent=vnDate();$('summaryDate').value=today;$('historyDate').value=today;$('employeeName').value=localStorage.getItem(STORAGE.employee)||'';
  document.querySelectorAll('.shift-option').forEach(btn=>btn.addEventListener('click',()=>selectShift(btn.dataset.shift)));
  $('employeeName').addEventListener('input',updateStartButton);$('startShiftBtn').addEventListener('click',beginShift);$('openEndShiftBtn').addEventListener('click',openEndDialog);$('closeDialogBtn').addEventListener('click',closeEndDialog);$('endShiftForm').addEventListener('submit',finishShift);
  document.querySelectorAll('.money-input').forEach(el=>{el.addEventListener('input',()=>{formatMoneyInput(el);updateReconcile()});el.addEventListener('focus',()=>el.select())});
  $('summaryDate').addEventListener('change',renderSummary);$('historyDate').addEventListener('change',renderHistory);$('historyShift').addEventListener('change',renderHistory);$('exportBtn').addEventListener('click',exportCsv);
  $('endShiftDialog').addEventListener('click',e=>{if(e.target===$('endShiftDialog'))closeEndDialog()});
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('installBtn').classList.remove('hidden')});
  $('installBtn').addEventListener('click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('installBtn').classList.add('hidden')});
  window.addEventListener('appinstalled',()=>{$('installBtn').classList.add('hidden');toast('Đã cài ứng dụng')});
  if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
  render();
}
document.addEventListener('DOMContentLoaded',setup);
