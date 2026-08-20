// Shared live shift state: exactly one active shift, publicly visible on every device.
(function(){
  const ACTIVE_API='https://dinqlgaveujdeyisgpty.supabase.co/functions/v1/staff-active-shift';
  const OWNER_KEY='r971_shared_shift_owner_v1';
  let sharedActive=null,syncTimer=null,requestBusy=false;

  function ownerCreds(){try{return JSON.parse(localStorage.getItem(OWNER_KEY)||'null')}catch{return null}}
  function saveOwner(id,token){localStorage.setItem(OWNER_KEY,JSON.stringify({id,token}))}
  function clearOwner(){localStorage.removeItem(OWNER_KEY)}
  function isOwner(active=sharedActive){const c=ownerCreds();return !!(active&&c&&String(c.id)===String(active.id)&&c.token)}
  function toActive(row){if(!row)return null;return {id:row.id,dateKey:row.date_key,shiftKey:row.shift_key,shiftName:row.shift_name,scheduledTime:row.scheduled_time,employee:row.employee,startAt:row.start_at,totals:row.totals||{transfer:0,cash:0,courtRevenue:0,waterRevenue:0},entries:Array.isArray(row.entries)?row.entries:[]}}
  async function api(body){const res=await fetch(ACTIVE_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await res.json().catch(()=>({}));if(!res.ok){const e=new Error(data.error||`Lỗi ${res.status}`);e.status=res.status;e.data=data;throw e}return data}

  async function fetchSharedActive(){
    try{
      const rows=await cloudFetch('staff_active_shift?select=id,date_key,shift_key,shift_name,scheduled_time,employee,start_at,totals,entries,updated_at&singleton_id=eq.1');
      const next=toActive(rows?.[0]||null);const changed=JSON.stringify(next)!==JSON.stringify(sharedActive);sharedActive=next;
      if(!sharedActive&&ownerCreds())clearOwner();
      if(changed||document.visibilityState==='visible')renderSharedState();
    }catch(err){console.error('Không tải được ca đang hoạt động:',err)}
  }

  getActive=function(){return sharedActive};
  setActive=function(value){sharedActive=value||null;renderSharedState()};

  function ensureObserverNotice(){
    const card=$('activeShiftCard');if(!card)return null;let box=$('sharedShiftNotice');
    if(!box){box=document.createElement('div');box.id='sharedShiftNotice';box.style.cssText='margin:0 0 12px;padding:11px 12px;border-radius:12px;background:#eef8f6;font-size:13px;font-weight:800';const elapsed=card.querySelector('.elapsed-box');card.insertBefore(box,elapsed||card.firstChild)}
    return box;
  }
  function ensurePublicLabel(){
    const card=$('activeShiftCard');if(!card)return;let x=$('sharedPublicLabel');if(x)return;
    x=document.createElement('div');x.id='sharedPublicLabel';x.style.cssText='margin:10px 0 0;padding:8px 10px;border-radius:10px;background:#ecfeff;color:#155e75;font-size:12px;font-weight:800';x.textContent='👁 Công khai toàn hệ thống · mọi thiết bị đều thấy diễn biến ca này';const elapsed=card.querySelector('.elapsed-box');if(elapsed)elapsed.after(x)
  }
  function setEntryControls(owner){
    ['entryTransfer','entryCash','entryCourt','entryWater'].forEach(id=>{const el=$(id);if(el)el.disabled=!owner});
    const add=$('addEntryBtn');if(add){add.disabled=!owner;add.classList.toggle('hidden',!owner)}
    const end=$('openEndShiftBtn');if(end){end.disabled=!owner;end.classList.toggle('hidden',!owner)}
  }

  // Public activity list: everyone can see who entered what and when. Only shift owner can delete an entry.
  renderEntryList=function(active=getActive()){
    if(!active||!$('entryList'))return;const list=active.entries||[];$('emptyEntryList').classList.toggle('hidden',list.length>0);const owner=isOwner(active);
    $('entryList').innerHTML=list.map(e=>{const parts=[];if(e.transfer)parts.push(`CK ${money(e.transfer)}`);if(e.cash)parts.push(`TM ${money(e.cash)}`);if(e.courtRevenue)parts.push(`Sân ${money(e.courtRevenue)}`);if(e.waterRevenue)parts.push(`Nước ${money(e.waterRevenue)}`);const who=escapeHtml(e.employee||active.employee||'Nhân viên');return `<div class="card" style="padding:11px;margin:7px 0;background:#fff"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><div><b>${vnTime(e.at)} · ${who}</b><div class="muted" style="margin-top:4px">${parts.join(' · ')}</div></div>${owner?`<button type="button" class="btn btn-secondary" style="padding:7px 9px" onclick="deleteEntry('${e.id}')">Xóa</button>`:''}</div></div>`}).join('');
  };

  function renderSharedState(){
    const active=sharedActive,card=$('activeShiftCard'),start=$('startShiftCard');if(!card||!start)return;
    card.classList.toggle('hidden',!active);start.classList.toggle('hidden',!!active);
    document.querySelectorAll('.shift-option').forEach(b=>b.disabled=!!active);
    if(!active){if(elapsedTimer){clearInterval(elapsedTimer);elapsedTimer=null}updateStartButton();return}
    const owner=isOwner(active);$('activeShiftName').textContent=active.shiftName||SHIFTS[active.shiftKey]?.name||'Ca đang hoạt động';$('activeShiftMeta').textContent=`${active.employee} · ${active.scheduledTime||''} · bắt đầu ${vnTime(active.startAt)}`;
    const notice=ensureObserverNotice();if(notice){notice.textContent=owner?`✓ ${active.employee} đang làm ${active.shiftName}. Ca này đang hiển thị công khai trên tất cả máy.`:`🔒 ${active.employee} đang làm ${active.shiftName}. Bạn không thể chọn hoặc bắt đầu ca khác cho đến khi ca này kết thúc.`;notice.style.background=owner?'#ecfdf5':'#fff7ed';notice.style.color=owner?'#166534':'#9a3412'}
    ensurePublicLabel();setEntryControls(owner);renderActiveTotals(active);renderEntryList(active);updateElapsed(active.startAt);if(elapsedTimer)clearInterval(elapsedTimer);elapsedTimer=setInterval(()=>updateElapsed(active.startAt),1000);updateStartButton();
    if(typeof window.refreshQuickRevenueSummary==='function')window.refreshQuickRevenueSummary();
  }
  renderActive=renderSharedState;

  async function startSharedShift(){
    if(requestBusy)return;await fetchSharedActive();if(sharedActive)return toast(`${sharedActive.employee} đang làm ${sharedActive.shiftName}. Không thể mở thêm ca.`);
    const employee=$('employeeName').value.trim();if(!selectedShift||!employee)return toast('Nhập tên nhân viên và chọn ca');requestBusy=true;$('startShiftBtn').disabled=true;
    try{const shift=SHIFTS[selectedShift];const result=await api({action:'start',employee,shiftKey:shift.key,shiftName:shift.name,scheduledTime:shift.time,dateKey:localDateKey()});sharedActive=toActive(result.active);saveOwner(sharedActive.id,result.token);localStorage.setItem(STORAGE.employee,employee);localStorage.removeItem(STORAGE.active);selectedShift=null;document.querySelectorAll('.shift-option').forEach(b=>b.classList.remove('selected'));clearEntryInputs();renderSharedState();toast(`Đã bắt đầu ${sharedActive.shiftName} · tất cả máy đã bị khóa chọn ca`)}
    catch(err){if(err.status===409&&err.data?.active){sharedActive=toActive(err.data.active);renderSharedState();toast(`Không thể mở ca: ${sharedActive.employee} đang làm ${sharedActive.shiftName}`)}else toast(err.message||'Không bắt đầu được ca')}
    finally{requestBusy=false;updateStartButton()}
  }

  async function addSharedEntry(){
    const active=sharedActive;if(!active)return toast('Chưa có ca hoạt động');if(!isOwner(active))return toast(`${active.employee} đang quản lý ca này`);if(requestBusy)return;
    const entry={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),at:new Date().toISOString(),employee:active.employee,transfer:parseMoney($('entryTransfer').value),cash:parseMoney($('entryCash').value),courtRevenue:parseMoney($('entryCourt').value),waterRevenue:parseMoney($('entryWater').value)};if(!(entry.transfer||entry.cash||entry.courtRevenue||entry.waterRevenue))return toast('Hãy nhập ít nhất một khoản tiền');
    const totals={...active.totals};totals.transfer=Number(totals.transfer||0)+entry.transfer;totals.cash=Number(totals.cash||0)+entry.cash;totals.courtRevenue=Number(totals.courtRevenue||0)+entry.courtRevenue;totals.waterRevenue=Number(totals.waterRevenue||0)+entry.waterRevenue;const entries=[entry,...(active.entries||[])];requestBusy=true;
    try{const c=ownerCreds();const result=await api({action:'update',id:active.id,token:c.token,totals,entries});sharedActive=toActive(result.active);clearEntryInputs();renderSharedState();toast('Đã cộng · các máy khác sẽ thấy ngay')}
    catch(err){toast(err.message||'Không cập nhật được ca');await fetchSharedActive()}finally{requestBusy=false}
  }

  async function deleteSharedEntry(id){
    const active=sharedActive;if(!active||!isOwner(active))return toast('Bạn không có quyền sửa ca này');const entry=(active.entries||[]).find(x=>String(x.id)===String(id));if(!entry)return;if(!confirm('Xóa khoản đã nhập này?'))return;
    const totals={...active.totals};totals.transfer=Math.max(0,Number(totals.transfer||0)-Number(entry.transfer||0));totals.cash=Math.max(0,Number(totals.cash||0)-Number(entry.cash||0));totals.courtRevenue=Math.max(0,Number(totals.courtRevenue||0)-Number(entry.courtRevenue||0));totals.waterRevenue=Math.max(0,Number(totals.waterRevenue||0)-Number(entry.waterRevenue||0));const entries=(active.entries||[]).filter(x=>String(x.id)!==String(id));
    try{const c=ownerCreds();const result=await api({action:'update',id:active.id,token:c.token,totals,entries});sharedActive=toActive(result.active);renderSharedState();toast('Đã xóa khoản nhập')}
    catch(err){toast(err.message||'Không xóa được khoản nhập');await fetchSharedActive()}
  }
  window.deleteEntry=deleteSharedEntry;

  function openSharedEndDialog(){const active=sharedActive;if(!active)return;if(!isOwner(active))return toast(`Chỉ thiết bị bắt đầu ca của ${active.employee} mới được kết thúc`);const t=active.totals||{};$('endDialogTitle').textContent=`Kết thúc ${active.shiftName} · ${active.employee}`;setMoneyInput('transferAmount',t.transfer);setMoneyInput('cashAmount',t.cash);setMoneyInput('courtRevenue',t.courtRevenue);setMoneyInput('waterRevenue',t.waterRevenue);$('shiftNote').value='';updateReconcile();$('endShiftDialog').showModal()}
  async function finishSharedShift(e){
    e?.preventDefault();const active=sharedActive;if(!active)return closeEndDialog();if(!isOwner(active))return toast('Bạn không có quyền kết thúc ca này');const t=active.totals||{},revenue=Number(t.courtRevenue||0)+Number(t.waterRevenue||0),collected=Number(t.transfer||0)+Number(t.cash||0);if(!confirm(`Xác nhận kết thúc ${active.shiftName}?\nTổng doanh thu: ${money(revenue)}\nChênh lệch: ${money(collected-revenue)}`))return;if(requestBusy)return;requestBusy=true;
    try{const c=ownerCreds();await api({action:'finish',id:active.id,token:c.token,note:$('shiftNote').value.trim()});clearOwner();sharedActive=null;localStorage.removeItem(STORAGE.active);closeEndDialog();clearEntryInputs();await syncSharedData();renderSharedState();toast(`Đã kết thúc ${active.shiftName} · tất cả máy có thể chọn ca mới`)}
    catch(err){toast(err.message||'Không kết thúc được ca');await fetchSharedActive()}finally{requestBusy=false}
  }

  function intercept(){document.addEventListener('click',e=>{const target=e.target.closest?.('button');if(!target)return;if(target.id==='startShiftBtn'){e.preventDefault();e.stopImmediatePropagation();startSharedShift()}else if(target.id==='addEntryBtn'){e.preventDefault();e.stopImmediatePropagation();addSharedEntry()}else if(target.id==='openEndShiftBtn'){e.preventDefault();e.stopImmediatePropagation();openSharedEndDialog()}else if(target.matches('[onclick^="deleteEntry"]')){e.preventDefault();e.stopImmediatePropagation();const m=target.getAttribute('onclick')?.match(/deleteEntry\('([^']+)'\)/);if(m)deleteSharedEntry(m[1])}},true);document.addEventListener('submit',e=>{if(e.target?.id==='endShiftForm'){e.preventDefault();e.stopImmediatePropagation();finishSharedShift(e)}},true)}

  async function migrateRecentLocalShift(){let old=null;try{old=JSON.parse(localStorage.getItem(STORAGE.active)||'null')}catch{}await fetchSharedActive();if(sharedActive||!old)return;const age=Date.now()-new Date(old.startAt||0).getTime();if(old.dateKey!==localDateKey()||age<0||age>18*3600*1000){localStorage.removeItem(STORAGE.active);return}try{const result=await api({action:'start',employee:old.employee,shiftKey:old.shiftKey,shiftName:old.shiftName,scheduledTime:old.scheduledTime,dateKey:old.dateKey});sharedActive=toActive(result.active);saveOwner(sharedActive.id,result.token);const totals=old.totals||old.draft||{transfer:0,cash:0,courtRevenue:0,waterRevenue:0},entries=old.entries||[];if(Object.values(totals).some(Number)||entries.length){const c=ownerCreds();const updated=await api({action:'update',id:sharedActive.id,token:c.token,totals,entries});sharedActive=toActive(updated.active)}localStorage.removeItem(STORAGE.active);renderSharedState()}catch(err){if(err.status===409){sharedActive=toActive(err.data?.active);localStorage.removeItem(STORAGE.active);renderSharedState()}}}

  intercept();const boot=()=>{migrateRecentLocalShift();clearInterval(syncTimer);syncTimer=setInterval(fetchSharedActive,1000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')fetchSharedActive()});window.addEventListener('focus',fetchSharedActive)};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();