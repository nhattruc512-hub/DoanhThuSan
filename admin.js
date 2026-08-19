// PIN-protected manager area for deleting completed shifts and clearing attendance locations.
(function(){
  const MANAGER_ENDPOINT='https://dinqlgaveujdeyisgpty.supabase.co/functions/v1/manager-delete-shift';
  let managerPin='';
  let managerAttendance=[];

  function mountManager(){
    const main=document.querySelector('main.container');
    if(!main||document.getElementById('managerCard'))return;
    const historyCard=document.querySelector('.history-card');
    const section=document.createElement('section');
    section.id='managerCard';
    section.className='card';
    section.innerHTML=`
      <div class="card-head compact">
        <div>
          <p class="section-kicker">QUẢN LÝ</p>
          <h2>Quản lý dữ liệu</h2>
          <p class="muted">Cần PIN để xóa ca và xóa vị trí trong lịch sử chấm công.</p>
        </div>
        <button id="managerOpenBtn" class="btn btn-secondary" type="button">MỞ QUẢN LÝ</button>
      </div>
      <div id="managerPanel" class="hidden" style="margin-top:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px">
          <b>Khu vực quản lý</b>
          <button id="managerLockBtn" class="btn btn-secondary" type="button">Khóa</button>
        </div>

        <div class="filters" style="margin-bottom:12px">
          <input id="managerDate" class="input" type="date" />
          <select id="managerShift" class="input">
            <option value="all">Tất cả ca</option>
            <option value="ca1">Ca 1</option>
            <option value="ca2">Ca 2</option>
            <option value="ca3">Ca 3</option>
          </select>
        </div>

        <div style="margin-top:8px">
          <p class="section-kicker">CA ĐÃ KẾT THÚC</p>
          <div id="managerShiftList"></div>
          <div id="managerEmpty" class="empty-state hidden" style="padding:18px 8px"><b>Không có ca phù hợp</b></div>
        </div>

        <div style="margin-top:18px;padding-top:16px;border-top:1px solid var(--line)">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px">
            <div><p class="section-kicker">LỊCH SỬ CHẤM CÔNG</p><p class="muted">Có thể xóa riêng dữ liệu vị trí GPS, vẫn giữ giờ chấm công và trạng thái.</p></div>
            <button id="managerAttendanceRefresh" class="btn btn-secondary" type="button">Làm mới</button>
          </div>
          <div id="managerAttendanceList"></div>
          <div id="managerAttendanceEmpty" class="empty-state hidden" style="padding:18px 8px"><b>Không có chấm công trong ngày này</b></div>
        </div>
      </div>`;
    if(historyCard)main.insertBefore(section,historyCard);else main.appendChild(section);

    $('managerOpenBtn').addEventListener('click',unlockManager);
    $('managerLockBtn').addEventListener('click',lockManager);
    $('managerDate').addEventListener('change',()=>{renderManagerShifts();loadManagerAttendance()});
    $('managerShift').addEventListener('change',()=>{renderManagerShifts();renderManagerAttendance()});
    $('managerAttendanceRefresh').addEventListener('click',loadManagerAttendance);
  }

  function unlockManager(){
    const pin=prompt('Nhập PIN Quản Lý');
    if(pin===null)return;
    if(pin!=='270523')return toast('PIN Quản Lý không đúng');
    managerPin=pin;
    $('managerPanel').classList.remove('hidden');
    $('managerOpenBtn').classList.add('hidden');
    $('managerDate').value=localDateKey();
    renderManagerShifts();
    loadManagerAttendance();
    toast('Đã mở mục Quản Lý');
  }

  function lockManager(){
    managerPin='';
    managerAttendance=[];
    $('managerPanel').classList.add('hidden');
    $('managerOpenBtn').classList.remove('hidden');
    toast('Đã khóa mục Quản Lý');
  }

  function renderManagerShifts(){
    if(!managerPin)return;
    const date=$('managerDate').value||localDateKey();
    const shift=$('managerShift').value||'all';
    const list=readHistory().filter(x=>x.dateKey===date&&(shift==='all'||x.shiftKey===shift));
    $('managerEmpty').classList.toggle('hidden',list.length>0);
    $('managerShiftList').innerHTML=list.map(x=>`
      <div class="card" style="padding:13px;margin:9px 0;background:#fff">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
          <div style="min-width:0">
            <div style="font-weight:900">${escapeHtml(x.shiftName)} · ${escapeHtml(x.employee)}</div>
            <div class="muted" style="margin-top:4px">${vnDateShort(x.startAt)} · ${vnTime(x.startAt)} → ${vnTime(x.endAt)}</div>
            <div class="muted" style="margin-top:4px">Doanh thu ${money(x.revenueTotal)} · Thu ${money(x.collectedTotal)}</div>
          </div>
          <button class="btn btn-danger" type="button" style="padding:8px 10px;flex:0 0 auto" data-delete-shift="${escapeHtml(x.id)}">Xóa ca</button>
        </div>
      </div>`).join('');
    document.querySelectorAll('[data-delete-shift]').forEach(btn=>btn.addEventListener('click',()=>deleteManagerShift(btn.dataset.deleteShift)));
  }

  async function loadManagerAttendance(){
    if(!managerPin)return;
    try{
      const date=$('managerDate').value||localDateKey();
      managerAttendance=await cloudFetch(`staff_attendance_records?select=*&date_key=eq.${encodeURIComponent(date)}&order=punched_at.desc`)||[];
      renderManagerAttendance();
    }catch(err){console.error(err);toast('Không tải được lịch sử chấm công')}
  }

  function renderManagerAttendance(){
    if(!managerPin||!$('managerAttendanceList'))return;
    const shift=$('managerShift').value||'all';
    const list=managerAttendance.filter(x=>shift==='all'||x.shift_key===shift);
    $('managerAttendanceEmpty').classList.toggle('hidden',list.length>0);
    $('managerAttendanceList').innerHTML=list.map(r=>{
      const hasLocation=r.latitude!=null&&r.longitude!=null;
      const status=r.status==='late'?`Trễ ${Number(r.late_minutes||0)} phút`:'Đúng giờ';
      const location=hasLocation?`${Number(r.latitude).toFixed(6)}, ${Number(r.longitude).toFixed(6)}${r.accuracy_m?` · ±${Math.round(r.accuracy_m)}m`:''}`:'Đã xóa vị trí';
      return `<div class="card" style="padding:13px;margin:9px 0;background:#fff">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
          <div style="min-width:0">
            <div style="font-weight:900">${escapeHtml(r.employee)} · ${escapeHtml(r.shift_name)}</div>
            <div class="muted" style="margin-top:4px">${vnDateShort(r.punched_at)} · ${vnTime(r.punched_at)} · ${escapeHtml(status)}</div>
            <div class="muted" style="margin-top:4px">📍 ${escapeHtml(location)}</div>
          </div>
          <button class="btn ${hasLocation?'btn-danger':'btn-secondary'}" type="button" style="padding:8px 10px;flex:0 0 auto" ${hasLocation?'':'disabled'} data-clear-attendance-location="${escapeHtml(r.id)}">${hasLocation?'Xóa vị trí':'Đã xóa'}</button>
        </div>
      </div>`;
    }).join('');
    document.querySelectorAll('[data-clear-attendance-location]').forEach(btn=>{
      if(!btn.disabled)btn.addEventListener('click',()=>clearAttendanceLocation(btn.dataset.clearAttendanceLocation));
    });
  }

  async function clearAttendanceLocation(id){
    if(!managerPin)return toast('Mục Quản Lý đang khóa');
    const item=managerAttendance.find(x=>String(x.id)===String(id));
    if(!item)return toast('Không tìm thấy chấm công');
    if(!confirm(`Xóa vị trí chấm công của ${item.employee}?\nNgày giờ, ca và trạng thái chấm công vẫn được giữ lại.`))return;
    try{
      const res=await fetch(MANAGER_ENDPOINT,{
        method:'POST',
        headers:{'Content-Type':'application/json','x-manager-pin':managerPin},
        body:JSON.stringify({action:'clear_attendance_location',id:String(id)})
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok){if(res.status===401)lockManager();throw new Error(data.error||`Lỗi ${res.status}`)}
      const row=managerAttendance.find(x=>String(x.id)===String(id));
      if(row){row.latitude=null;row.longitude=null;row.accuracy_m=null}
      renderManagerAttendance();
      if(typeof window.reloadAttendance==='function')window.reloadAttendance();
      toast('Đã xóa vị trí chấm công');
    }catch(err){console.error(err);toast('Không xóa được vị trí: '+err.message)}
  }

  async function deleteManagerShift(id){
    if(!managerPin)return toast('Mục Quản Lý đang khóa');
    const item=readHistory().find(x=>String(x.id)===String(id));
    if(!item)return toast('Không tìm thấy ca');
    if(!confirm(`Xóa ${item.shiftName} của ${item.employee}?\nThao tác này sẽ xóa ca khỏi lịch sử chung.`))return;
    try{
      const res=await fetch(MANAGER_ENDPOINT,{
        method:'POST',
        headers:{'Content-Type':'application/json','x-manager-pin':managerPin},
        body:JSON.stringify({id:String(id),action:'delete_shift'})
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok){
        if(res.status===401)lockManager();
        throw new Error(data.error||`Lỗi ${res.status}`);
      }
      const updated=localReadHistory().filter(x=>String(x.id)!==String(id));
      localSaveHistory(updated);
      cloudHistory=cloudHistory.filter(x=>String(x.id)!==String(id));
      cloudHistoryReady=true;
      renderSummary();renderHistory();renderManagerShifts();
      toast('Đã xóa ca khỏi lịch sử chung');
    }catch(err){
      console.error(err);
      toast('Không xóa được ca: '+err.message);
    }
  }

  window.renderManagerShifts=renderManagerShifts;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountManager);else mountManager();
})();
