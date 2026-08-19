// Customer debt hotfix + shared cloud sync for completed shifts and debts.
const CLOUD_URL='https://dinqlgaveujdeyisgpty.supabase.co';
const CLOUD_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpbnFsZ2F2ZXVqZGV5aXNncHR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMjQxNzAsImV4cCI6MjEwMjcwMDE3MH0.L5aitJLmaGC4yopIzjwkQomwQ0H9dSOfNWqvAgwrzQI';
const cloudHeaders={apikey:CLOUD_KEY,Authorization:`Bearer ${CLOUD_KEY}`,'Content-Type':'application/json'};

const localReadHistory=readHistory;
const localSaveHistory=saveHistory;
const localReadDebts=readDebts;
const localSaveDebts=saveDebts;
let cloudHistory=[];
let cloudDebts=[];
let cloudHistoryReady=false;
let cloudDebtsReady=false;
let deletedShiftIds=new Set();

function historyToRow(x){return {
  id:String(x.id),date_key:x.dateKey,shift_key:x.shiftKey||'',shift_name:x.shiftName||'',scheduled_time:x.scheduledTime||'',employee:x.employee||'Chưa ghi tên NV',
  start_at:x.startAt,end_at:x.endAt,transfer:Number(x.transfer||0),cash:Number(x.cash||0),court_revenue:Number(x.courtRevenue||0),water_revenue:Number(x.waterRevenue||0),
  collected_total:Number(x.collectedTotal||0),revenue_total:Number(x.revenueTotal||0),difference:Number(x.difference||0),note:x.note||'',entries:Array.isArray(x.entries)?x.entries:[],status:x.status||'completed'
}}
function rowToHistory(r){return {
  id:r.id,dateKey:r.date_key,shiftKey:r.shift_key,shiftName:r.shift_name,scheduledTime:r.scheduled_time,employee:r.employee,startAt:r.start_at,endAt:r.end_at,
  transfer:Number(r.transfer||0),cash:Number(r.cash||0),courtRevenue:Number(r.court_revenue||0),waterRevenue:Number(r.water_revenue||0),collectedTotal:Number(r.collected_total||0),
  revenueTotal:Number(r.revenue_total||0),difference:Number(r.difference||0),note:r.note||'',entries:Array.isArray(r.entries)?r.entries:[],status:r.status||'completed'
}}
function debtToRow(d){return {
  id:String(d.id),date_key:d.dateKey,customer:d.customer,reason:d.reason,amount:Number(d.amount||0),employee:d.employee||'',shift_key:d.shiftKey||'',shift_name:d.shiftName||'',created_at:d.createdAt,settled:false
}}
function rowToDebt(r){return {id:r.id,dateKey:r.date_key,customer:r.customer,reason:r.reason,amount:Number(r.amount||0),employee:r.employee||'',shiftKey:r.shift_key||'',shiftName:r.shift_name||'',createdAt:r.created_at}}
async function cloudFetch(path,options={}){
  const res=await fetch(`${CLOUD_URL}/rest/v1/${path}`,{...options,headers:{...cloudHeaders,...(options.headers||{})}});
  if(!res.ok)throw new Error(`Cloud ${res.status}: ${await res.text()}`);
  if(res.status===204)return null;
  const text=await res.text();return text?JSON.parse(text):null;
}
async function upsertHistory(items){
  const allowed=(items||[]).filter(x=>!deletedShiftIds.has(String(x.id)));
  if(!allowed.length)return;
  await cloudFetch('staff_shift_history?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(allowed.map(historyToRow))});
}
async function upsertDebts(items){
  if(!items.length)return;
  await cloudFetch('customer_debts?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(items.map(debtToRow))});
}
async function deleteCloudDebt(id){await cloudFetch(`customer_debts?id=eq.${encodeURIComponent(id)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}})}

readHistory=function(){return (cloudHistoryReady?cloudHistory:localReadHistory()).filter(x=>!deletedShiftIds.has(String(x.id))).slice()};
saveHistory=function(items){
  const clean=(Array.isArray(items)?items:[]).filter(x=>!deletedShiftIds.has(String(x.id)));
  localSaveHistory(clean);cloudHistory=clean.slice();cloudHistoryReady=true;
  upsertHistory(clean).catch(err=>console.error('Không đồng bộ được lịch sử ca:',err));
};
readDebts=function(){return (cloudDebtsReady?cloudDebts:localReadDebts()).slice()};
saveDebts=function(items){
  const clean=Array.isArray(items)?items:[];
  const previous=cloudDebtsReady?cloudDebts.slice():[];
  localSaveDebts(clean);cloudDebts=clean.slice();cloudDebtsReady=true;
  upsertDebts(clean).catch(err=>console.error('Không đồng bộ được khách nợ:',err));
  if(previous.length){
    const ids=new Set(clean.map(x=>x.id));
    previous.filter(x=>!ids.has(x.id)).forEach(x=>deleteCloudDebt(x.id).catch(err=>console.error('Không xóa được khách nợ trên cloud:',err)));
  }
};

addDebt=function(){
  const active=getActive();
  const customer=$('debtCustomer').value.trim();
  const reason=$('debtReason').value.trim();
  const amount=parseMoney($('debtAmount').value);
  if(!customer)return toast('Nhập tên khách');
  if(!reason)return toast('Nhập khách nợ gì');
  if(!amount)return toast('Nhập tổng nợ');
  const typedEmployee=$('employeeName')?.value.trim()||'';
  const savedEmployee=localStorage.getItem(STORAGE.employee)||'';
  const employee=active?.employee||typedEmployee||savedEmployee||'Chưa ghi tên NV';
  if(typedEmployee)localStorage.setItem(STORAGE.employee,typedEmployee);
  const now=new Date();
  const debt={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),createdAt:now.toISOString(),dateKey:localDateKey(now),customer:customer.slice(0,80),reason:reason.slice(0,160),amount,employee,shiftKey:active?.shiftKey||'',shiftName:active?.shiftName||'Ngoài ca'};
  const debts=readDebts();debts.unshift(debt);saveDebts(debts);clearDebtInputs();renderDebts();toast(`Đã thêm khách nợ ${money(amount)}`);
};

async function syncSharedData(){
  try{
    const [historyRows,debtRows,deletedRows]=await Promise.all([
      cloudFetch('staff_shift_history?select=*&order=start_at.desc'),
      cloudFetch('customer_debts?select=*&settled=eq.false&order=created_at.desc'),
      cloudFetch('deleted_staff_shifts?select=id')
    ]);
    deletedShiftIds=new Set((deletedRows||[]).map(x=>String(x.id)));

    const localHistory=localReadHistory().filter(x=>!deletedShiftIds.has(String(x.id)));
    const remoteHistory=(historyRows||[]).map(rowToHistory).filter(x=>!deletedShiftIds.has(String(x.id)));
    const hMap=new Map(remoteHistory.map(x=>[x.id,x]));localHistory.forEach(x=>hMap.set(x.id,x));
    cloudHistory=[...hMap.values()].sort((a,b)=>new Date(b.startAt)-new Date(a.startAt));cloudHistoryReady=true;localSaveHistory(cloudHistory);
    if(localHistory.length)await upsertHistory(localHistory);

    const localDebts=localReadDebts();
    const remoteDebts=(debtRows||[]).map(rowToDebt);
    const dMap=new Map(remoteDebts.map(x=>[x.id,x]));localDebts.forEach(x=>dMap.set(x.id,x));
    cloudDebts=[...dMap.values()].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));cloudDebtsReady=true;localSaveDebts(cloudDebts);
    if(localDebts.length)await upsertDebts(localDebts);

    renderSummary();renderHistory();renderDebts();
    if(typeof renderManagerShifts==='function')renderManagerShifts();
    console.info('Đã đồng bộ dữ liệu dùng chung');
  }catch(err){
    console.error('Không thể tải dữ liệu dùng chung:',err);
    cloudHistoryReady=false;cloudDebtsReady=false;
  }
}

syncSharedData();
setInterval(syncSharedData,30000);

// Load the manager area after shared-data helpers are available.
const managerScript=document.createElement('script');
managerScript.src='./admin.js';
document.body.appendChild(managerScript);
