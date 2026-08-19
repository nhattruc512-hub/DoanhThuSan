// PIN-protected manager area for deleting completed shifts.
(function(){
  const MANAGER_ENDPOINT='https://dinqlgaveujdeyisgpty.supabase.co/functions/v1/manager-delete-shift';
  let managerPin='';

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
          <h2>Quản lý ca đã tạo</h2>
          <p class="muted">Khu vực dành cho quản lý. Cần PIN để xem và xóa ca.</p>
        </div>
        <button id="managerOpenBtn" class="btn btn-secondary" type="button">MỞ QUẢN LÝ</button>
      </div>
      <div id="managerPanel" class="hidden" style="margin-top:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px">
          <b>Danh sách ca đã kết thúc</b>
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
        <div id="managerShiftList"></div>
        <div id="managerEmpty" class="empty-state hidden" style="padding:18px 8px"><b>Không có ca phù hợp</b></div>
      </div>`;
    if(historyCard)main.insertBefore(section,historyCard);else main.appendChild(section);

    $('managerOpenBtn').addEventListener('click',unlockManager);
    $('managerLockBtn').addEventListener('click',lockManager);
    $('managerDate').addEventListener('change',renderManagerShifts);
    $('managerShift').addEventListener('change',renderManagerShifts);
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
    toast('Đã mở mục Quản Lý');
  }

  function lockManager(){
    managerPin='';
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

  async function deleteManagerShift(id){
    if(!managerPin)return toast('Mục Quản Lý đang khóa');
    const item=readHistory().find(x=>String(x.id)===String(id));
    if(!item)return toast('Không tìm thấy ca');
    if(!confirm(`Xóa ${item.shiftName} của ${item.employee}?\nThao tác này sẽ xóa ca khỏi lịch sử chung.`))return;
    try{
      const res=await fetch(MANAGER_ENDPOINT,{
        method:'POST',
        headers:{'Content-Type':'application/json','x-manager-pin':managerPin},
        body:JSON.stringify({id:String(id)})
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
