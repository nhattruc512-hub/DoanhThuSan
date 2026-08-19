// PIN-protected manager area for deleting data and reviewing the server-side activity audit log.
(function(){
  const MANAGER_ENDPOINT='https://dinqlgaveujdeyisgpty.supabase.co/functions/v1/manager-delete-shift';
  let managerPin='';
  let managerAttendance=[];
  let managerAudit=[];
  let auditTimer=null;

  function mountManager(){
    const main=document.querySelector('main.container');
    if(!main||document.getElementById('managerCard'))return;
    const historyCard=document.querySelector('.history-card');
    const section=document.createElement('section');
    section.id='managerCard';section.className='card manager-card';
    section.innerHTML=`
      <div class="card-head compact">
        <div><p class="section-kicker">QUẢN LÝ</p><h2>Quản lý dữ liệu</h2><p class="muted">Cần PIN để xem nhật ký, xóa ca và quản lý lịch sử chấm công.</p></div>
        <button id="managerOpenBtn" class="btn btn-secondary" type="button">MỞ QUẢN LÝ</button>
      </div>
      <div id="managerPanel" class="hidden" style="margin-top:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px"><b>Khu vực quản lý</b><button id="managerLockBtn" class="btn btn-secondary" type="button">Khóa</button></div>
        <div class="filters" style="margin-bottom:12px">
          <input id="managerDate" class="input" type="date" />
          <select id="managerShift" class="input"><option value="all">Tất cả ca</option><option value="ca1">Ca 1</option><option value="ca2">Ca 2</option><option value="ca3">Ca 3</option></select>
        </div>

        <div class="manager-section manager-audit-section">
          <div class="manager-section-head"><div><p class="section-kicker">NHẬT KÝ HOẠT ĐỘNG</p><p class="muted">Ghi tự động trên máy chủ: doanh thu, ca, khách nợ, chấm công và thao tác quản lý.</p></div><button id="managerAuditRefresh" class="btn btn-secondary" type="button">Làm mới</button></div>
          <div id="managerAuditList"></div>
          <div id="managerAuditEmpty" class="empty-state hidden" style="padding:14px 8px"><b>Chưa có thao tác trong ngày này</b><p>Nhật ký bắt đầu ghi từ khi tính năng này được bật.</p></div>
        </div>

        <div class="manager-section">
          <p class="section-kicker">CA ĐÃ KẾT THÚC</p><div id="managerShiftList"></div><div id="managerEmpty" class="empty-state hidden" style="padding:14px 8px"><b>Không có ca phù hợp</b></div>
        </div>

        <div class="manager-section">
          <div class="manager-section-head"><div><p class="section-kicker">LỊCH SỬ CHẤM CÔNG</p><p class="muted">Có thể xóa riêng GPS hoặc xóa toàn bộ chấm công.</p></div><button id="managerAttendanceRefresh" class="btn btn-secondary" type="button">Làm mới</button></div>
          <div id="managerAttendanceList"></div><div id="managerAttendanceEmpty" class="empty-state hidden" style="padding:14px 8px"><b>Không có chấm công trong ngày này</b></div>
        </div>
      </div>`;
    if(historyCard)main.insertBefore(section,historyCard);else main.appendChild(section);

    $('managerOpenBtn').addEventListener('click',unlockManager);
    $('managerLockBtn').addEventListener('click',lockManager);
    $('managerDate').addEventListener('change',()=>{renderManagerShifts();loadManagerAttendance();loadManagerAudit()});
    $('managerShift').addEventListener('change',()=>{renderManagerShifts();renderManagerAttendance();renderManagerAudit()});
    $('managerAttendanceRefresh').addEventListener('click',loadManagerAttendance);
    $('managerAuditRefresh').addEventListener('click',loadManagerAudit);
  }

  function unlockManager(){
    const pin=prompt('Nhập PIN Quản Lý');if(pin===null)return;
    if(pin!=='270523')return toast('PIN Quản Lý không đúng');
    managerPin=pin;$('managerPanel').classList.remove('hidden');$('managerOpenBtn').classList.add('hidden');$('managerDate').value=localDateKey();
    renderManagerShifts();loadManagerAttendance();loadManagerAudit();
    clearInterval(auditTimer);auditTimer=setInterval(()=>{if(managerPin&&document.visibilityState==='visible')loadManagerAudit(true)},3000);
    toast('Đã mở mục Quản Lý');
  }
  function lockManager(){
    managerPin='';managerAttendance=[];managerAudit=[];clearInterval(auditTimer);auditTimer=null;
    $('managerPanel').classList.add('hidden');$('managerOpenBtn').classList.remove('hidden');toast('Đã khóa mục Quản Lý');
  }

  function renderManagerShifts(){
    if(!managerPin)return;const date=$('managerDate').value||localDateKey(),shift=$('managerShift').value||'all';
    const list=readHistory().filter(x=>x.dateKey===date&&(shift==='all'||x.shiftKey===shift));
    $('managerEmpty').classList.toggle('hidden',list.length>0);
    $('managerShiftList').innerHTML=list.map(x=>`<div class="manager-data-row"><div class="manager-data-main"><b>${escapeHtml(x.shiftName)} · ${escapeHtml(x.employee)}</b><span>${vnDateShort(x.startAt)} · ${vnTime(x.startAt)} → ${vnTime(x.endAt)}</span><span>Doanh thu ${money(x.revenueTotal)} · Thu ${money(x.collectedTotal)}</span></div><button class="btn btn-danger manager-action" type="button" data-delete-shift="${escapeHtml(x.id)}">Xóa ca</button></div>`).join('');
    document.querySelectorAll('[data-delete-shift]').forEach(btn=>btn.addEventListener('click',()=>deleteManagerShift(btn.dataset.deleteShift)));
  }

  async function loadManagerAttendance(){
    if(!managerPin)return;try{const date=$('managerDate').value||localDateKey();managerAttendance=await cloudFetch(`staff_attendance_records?select=*&date_key=eq.${encodeURIComponent(date)}&order=punched_at.desc`)||[];renderManagerAttendance()}catch(err){console.error(err);toast('Không tải được lịch sử chấm công')}
  }
  function renderManagerAttendance(){
    if(!managerPin||!$('managerAttendanceList'))return;const shift=$('managerShift').value||'all';const list=managerAttendance.filter(x=>shift==='all'||x.shift_key===shift);
    $('managerAttendanceEmpty').classList.toggle('hidden',list.length>0);
    $('managerAttendanceList').innerHTML=list.map(r=>{const hasLocation=r.latitude!=null&&r.longitude!=null;const status=r.status==='late'?`Trễ ${Number(r.late_minutes||0)} phút`:'Đúng giờ';const location=hasLocation?`${Number(r.latitude).toFixed(6)}, ${Number(r.longitude).toFixed(6)}${r.accuracy_m?` · ±${Math.round(r.accuracy_m)}m`:''}`:'Vị trí đã được xóa';return `<div class="manager-data-row attendance-manager-row"><div class="manager-data-main"><b>${escapeHtml(r.employee)} · ${escapeHtml(r.shift_name)}</b><span>${vnDateShort(r.punched_at)} · ${vnTime(r.punched_at)} · ${escapeHtml(status)}</span><span>📍 ${escapeHtml(location)}</span></div><div class="manager-attendance-actions"><button class="btn btn-secondary manager-action" type="button" ${hasLocation?'':'disabled'} data-clear-attendance-location="${escapeHtml(r.id)}">${hasLocation?'Xóa vị trí':'Đã xóa GPS'}</button><button class="btn btn-danger manager-action" type="button" data-delete-attendance="${escapeHtml(r.id)}">Xóa chấm công</button></div></div>`}).join('');
    document.querySelectorAll('[data-clear-attendance-location]').forEach(btn=>{if(!btn.disabled)btn.addEventListener('click',()=>clearAttendanceLocation(btn.dataset.clearAttendanceLocation))});
    document.querySelectorAll('[data-delete-attendance]').forEach(btn=>btn.addEventListener('click',()=>deleteAttendance(btn.dataset.deleteAttendance)));
  }

  function auditMoneyDetails(d={}){
    const parts=[];
    const fields=[['transfer','CK'],['cash','TM'],['court_revenue','Sân'],['water_revenue','Nước'],['amount','Nợ'],['revenue_total','Tổng DT'],['difference','Chênh lệch']];
    fields.forEach(([k,label])=>{const n=Number(d[k]||0);if(n)parts.push(`${label} ${money(n)}`)});
    if(d.customer)parts.push(`Khách: ${escapeHtml(d.customer)}`);if(d.reason)parts.push(`Nợ: ${escapeHtml(d.reason)}`);
    if(d.status)parts.push(d.status==='late'?`Trễ ${Number(d.late_minutes||0)} phút`:String(d.status));
    return parts.join(' · ');
  }
  async function loadManagerAudit(silent=false){
    if(!managerPin)return;try{
      const date=$('managerDate').value||localDateKey();
      const res=await fetch(MANAGER_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','x-manager-pin':managerPin},body:JSON.stringify({action:'list_audit',date,limit:500})});
      const data=await res.json().catch(()=>({}));if(!res.ok){if(res.status===401)lockManager();throw new Error(data.error||`Lỗi ${res.status}`)}
      managerAudit=data.rows||[];renderManagerAudit();
    }catch(err){console.error(err);if(!silent)toast('Không tải được nhật ký hoạt động')}
  }
  function renderManagerAudit(){
    if(!managerPin||!$('managerAuditList'))return;const shift=$('managerShift').value||'all';
    const shiftName=shift==='ca1'?'Ca 1':shift==='ca2'?'Ca 2':shift==='ca3'?'Ca 3':'';
    const list=managerAudit.filter(x=>shift==='all'||x.shift_name===shiftName||!x.shift_name);
    $('managerAuditEmpty').classList.toggle('hidden',list.length>0);
    $('managerAuditList').innerHTML=list.map(r=>{const detail=auditMoneyDetails(r.details||{});return `<div class="audit-row"><div class="audit-time">${vnTime(r.created_at)}</div><div class="audit-main"><div><b>${escapeHtml(r.action_type||'Thao tác')}</b>${r.employee?` <span class="audit-employee">· ${escapeHtml(r.employee)}</span>`:''}</div><span>${escapeHtml(r.description||'')}</span>${detail?`<small>${detail}</small>`:''}</div></div>`}).join('');
  }

  async function managerAction(action,id){
    const res=await fetch(MANAGER_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','x-manager-pin':managerPin},body:JSON.stringify({action,id:String(id)})});const data=await res.json().catch(()=>({}));if(!res.ok){if(res.status===401)lockManager();throw new Error(data.error||`Lỗi ${res.status}`)}return data;
  }
  async function clearAttendanceLocation(id){
    if(!managerPin)return toast('Mục Quản Lý đang khóa');const item=managerAttendance.find(x=>String(x.id)===String(id));if(!item)return toast('Không tìm thấy chấm công');if(!confirm(`Xóa vị trí GPS của ${item.employee}?\nNgày giờ, ca và trạng thái vẫn được giữ lại.`))return;
    try{await managerAction('clear_attendance_location',id);const row=managerAttendance.find(x=>String(x.id)===String(id));if(row){row.latitude=null;row.longitude=null;row.accuracy_m=null}renderManagerAttendance();if(typeof window.reloadAttendance==='function')window.reloadAttendance();loadManagerAudit(true);toast('Đã xóa vị trí GPS')}catch(err){console.error(err);toast('Không xóa được vị trí: '+err.message)}
  }
  async function deleteAttendance(id){
    if(!managerPin)return toast('Mục Quản Lý đang khóa');const item=managerAttendance.find(x=>String(x.id)===String(id));if(!item)return toast('Không tìm thấy chấm công');if(!confirm(`Xóa chấm công của ${item.employee} - ${item.shift_name}?\nBản ghi này sẽ bị xóa khỏi lịch sử chung.`))return;
    try{await managerAction('delete_attendance',id);managerAttendance=managerAttendance.filter(x=>String(x.id)!==String(id));renderManagerAttendance();if(typeof window.reloadAttendance==='function')window.reloadAttendance();loadManagerAudit(true);toast('Đã xóa chấm công')}catch(err){console.error(err);toast('Không xóa được chấm công: '+err.message)}
  }
  async function deleteManagerShift(id){
    if(!managerPin)return toast('Mục Quản Lý đang khóa');const item=readHistory().find(x=>String(x.id)===String(id));if(!item)return toast('Không tìm thấy ca');if(!confirm(`Xóa ${item.shiftName} của ${item.employee}?\nThao tác này sẽ xóa ca khỏi lịch sử chung.`))return;
    try{await managerAction('delete_shift',id);const updated=localReadHistory().filter(x=>String(x.id)!==String(id));localSaveHistory(updated);cloudHistory=cloudHistory.filter(x=>String(x.id)!==String(id));cloudHistoryReady=true;renderSummary();renderHistory();renderManagerShifts();loadManagerAudit(true);toast('Đã xóa ca khỏi lịch sử chung')}catch(err){console.error(err);toast('Không xóa được ca: '+err.message)}
  }

  const style=document.createElement('style');style.textContent=`
    .manager-card{grid-column:1/-1}.manager-section{margin-top:18px;padding-top:16px;border-top:1px solid var(--line)}.manager-audit-section{margin-top:4px;padding-top:4px;border-top:0}.manager-section-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px}.manager-data-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;border:1px solid var(--line);border-radius:12px;padding:11px;margin:8px 0;background:#fff;align-items:center}.manager-data-main{display:grid;gap:3px;min-width:0}.manager-data-main span{font-size:12px;color:var(--muted);overflow-wrap:anywhere}.manager-action{padding:8px 10px;white-space:nowrap}.manager-attendance-actions{display:grid;gap:6px;min-width:128px}.manager-attendance-actions .btn-danger{font-weight:900}.audit-row{display:grid;grid-template-columns:72px minmax(0,1fr);gap:10px;padding:10px 2px;border-bottom:1px solid var(--line)}.audit-time{font-weight:900;color:var(--primary);font-variant-numeric:tabular-nums}.audit-main{display:grid;gap:3px;min-width:0}.audit-main span,.audit-main small{color:var(--muted);overflow-wrap:anywhere}.audit-main small{font-size:12px}.audit-employee{font-weight:700}
    @media(max-width:560px){.manager-data-row{grid-template-columns:1fr}.manager-attendance-actions{grid-template-columns:1fr 1fr;min-width:0}.manager-action{width:100%}.manager-section-head{align-items:flex-start}.audit-row{grid-template-columns:58px minmax(0,1fr)}}`;
  document.head.appendChild(style);
  window.renderManagerShifts=renderManagerShifts;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountManager);else mountManager();
})();
