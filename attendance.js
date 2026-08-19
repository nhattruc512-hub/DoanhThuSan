// Shared attendance check-in with geolocation and automatic shift classification.
(function(){
  const ATTENDANCE_TABLE='staff_attendance_records';
  const VI_TIME_ZONE='Asia/Ho_Chi_Minh';
  let attendanceRows=[];
  let loading=false;

  function currentHcmParts(date=new Date()){
    const parts=new Intl.DateTimeFormat('en-GB',{timeZone:VI_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(date);
    const map=Object.fromEntries(parts.map(p=>[p.type,p.value]));
    return {year:+map.year,month:+map.month,day:+map.day,hour:+map.hour,minute:+map.minute,second:+map.second};
  }
  function dateKeyFromParts(p){return `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`}
  function classifyShift(p){
    const mins=p.hour*60+p.minute;
    const shifts=[
      {key:'ca1',name:'Ca 1',start:5*60,end:11*60,startText:'05:00',endText:'11:00'},
      {key:'ca2',name:'Ca 2',start:14*60,end:18*60-1,startText:'14:00',endText:'18:00'},
      {key:'ca3',name:'Ca 3',start:18*60,end:22*60,startText:'18:00',endText:'22:00'}
    ];
    const s=shifts.find(x=>mins>=x.start&&mins<=x.end);
    if(!s)return null;
    const late=mins>s.start+1;
    return {...s,status:late?'late':'on_time',lateMinutes:late?mins-s.start:0};
  }
  function getEmployee(){
    const attendanceName=$('attendanceEmployee')?.value.trim()||'';
    const startName=$('employeeName')?.value.trim()||'';
    const saved=localStorage.getItem(STORAGE.employee)||'';
    return attendanceName||startName||saved;
  }
  function syncEmployeeName(name){
    if(!name)return;
    localStorage.setItem(STORAGE.employee,name);
    if($('attendanceEmployee')&&$('attendanceEmployee').value!==name)$('attendanceEmployee').value=name;
    if($('employeeName')&&$('employeeName').value!==name){$('employeeName').value=name;updateStartButton()}
  }
  function locationText(r){
    return `${Number(r.latitude).toFixed(6)}, ${Number(r.longitude).toFixed(6)}${r.accuracy_m?` · ±${Math.round(r.accuracy_m)}m`:''}`;
  }
  function mapsUrl(r){return `https://www.google.com/maps?q=${encodeURIComponent(r.latitude+','+r.longitude)}`}

  function mountAttendance(){
    const main=document.querySelector('main.container');
    if(!main||$('attendanceCard'))return;
    const section=document.createElement('section');
    section.id='attendanceCard';
    section.className='card attendance-card';
    section.innerHTML=`
      <div class="card-head compact attendance-head">
        <div>
          <p class="section-kicker">CHẤM CÔNG</p>
          <h2>Chấm công vào ca</h2>
          <p class="muted">Tự nhận ca theo giờ hiện tại và lưu ngày giờ + vị trí lên máy chủ.</p>
        </div>
        <div id="attendanceNow" class="attendance-clock"></div>
      </div>
      <div class="attendance-layout">
        <div class="attendance-info">
          <label class="field-label" for="attendanceEmployee">Tên nhân viên</label>
          <input id="attendanceEmployee" class="input" type="text" maxlength="60" placeholder="Nhập tên nhân viên" />
          <div id="attendanceShiftPreview" class="attendance-preview"></div>
        </div>
        <button id="attendancePunchBtn" class="attendance-punch" type="button" aria-label="Chấm công">
          <span class="attendance-punch-icon">✓</span>
          <strong>CHẤM<br>CÔNG</strong>
        </button>
      </div>
      <div id="attendanceMessage" class="hidden"></div>
      <div class="attendance-history-head">
        <b>Chấm công hôm nay</b>
        <button id="attendanceRefreshBtn" class="btn btn-secondary" type="button">Làm mới</button>
      </div>
      <div id="attendanceList" class="attendance-list"></div>
      <div id="attendanceEmpty" class="empty-state hidden" style="padding:15px 8px"><b>Chưa có chấm công hôm nay</b></div>`;
    main.insertBefore(section,main.firstChild);

    const saved=localStorage.getItem(STORAGE.employee)||'';
    $('attendanceEmployee').value=saved;
    $('attendanceEmployee').addEventListener('input',()=>syncEmployeeName($('attendanceEmployee').value.trim()));
    $('attendancePunchBtn').addEventListener('click',punchAttendance);
    $('attendanceRefreshBtn').addEventListener('click',loadAttendance);
    updateClockAndPreview();
    setInterval(updateClockAndPreview,1000);
    loadAttendance();
  }

  function updateClockAndPreview(){
    if(!$('attendanceNow'))return;
    const now=new Date();
    $('attendanceNow').textContent=new Intl.DateTimeFormat('vi-VN',{timeZone:VI_TIME_ZONE,day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(now);
    const p=currentHcmParts(now),s=classifyShift(p),preview=$('attendanceShiftPreview');
    if(!s){preview.className='attendance-preview outside';preview.innerHTML='<b>Ngoài giờ chấm công</b><span>Ca 1: 05:00–11:00 · Ca 2: 14:00–18:00 · Ca 3: 18:00–22:00</span>';return}
    preview.className=`attendance-preview ${s.status==='late'?'late':'ontime'}`;
    preview.innerHTML=`<b>${s.name} · ${s.startText}–${s.endText}</b><span>${s.status==='late'?`⚠ Trễ ${s.lateMinutes} phút`:'✓ Đúng giờ'}</span>`;
  }

  function getPosition(){
    return new Promise((resolve,reject)=>{
      if(!navigator.geolocation)return reject(new Error('Thiết bị không hỗ trợ lấy vị trí'));
      navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:15000,maximumAge:0});
    });
  }

  async function punchAttendance(){
    if(loading)return;
    const employee=getEmployee();
    if(!employee)return toast('Nhập tên nhân viên trước khi chấm công');
    const now=new Date(),p=currentHcmParts(now),shift=classifyShift(p);
    if(!shift)return toast('Hiện đang ngoài giờ chấm công');
    loading=true;$('attendancePunchBtn').disabled=true;$('attendancePunchBtn').classList.add('loading');
    try{
      toast('Đang lấy vị trí chấm công...');
      const pos=await getPosition();
      syncEmployeeName(employee);
      const row={
        employee:employee.slice(0,60),
        punched_at:now.toISOString(),
        date_key:dateKeyFromParts(p),
        shift_key:shift.key,
        shift_name:shift.name,
        scheduled_start:shift.startText+':00',
        scheduled_end:shift.endText+':00',
        status:shift.status,
        late_minutes:shift.lateMinutes,
        latitude:pos.coords.latitude,
        longitude:pos.coords.longitude,
        accuracy_m:pos.coords.accuracy
      };
      const res=await fetch(`${CLOUD_URL}/rest/v1/${ATTENDANCE_TABLE}`,{method:'POST',headers:{...cloudHeaders,Prefer:'return=representation'},body:JSON.stringify(row)});
      if(res.status===409)throw new Error('Bạn đã chấm công ca này hôm nay rồi');
      if(!res.ok)throw new Error('Không lưu được chấm công');
      const saved=(await res.json())?.[0]||row;
      showPunchResult(saved);
      await loadAttendance();
      toast(shift.status==='late'?`Đã chấm công · Trễ ${shift.lateMinutes} phút`:'Đã chấm công đúng giờ');
    }catch(err){
      const geo=err&&typeof err.code==='number';
      if(geo){
        const msg=err.code===1?'Bạn cần cho phép truy cập vị trí để chấm công':err.code===2?'Không xác định được vị trí':'Lấy vị trí quá lâu, hãy thử lại';
        toast(msg);
      }else toast(err.message||'Không chấm công được');
    }finally{loading=false;$('attendancePunchBtn').disabled=false;$('attendancePunchBtn').classList.remove('loading')}
  }

  function showPunchResult(r){
    const box=$('attendanceMessage');
    if(!box)return;
    const late=r.status==='late';
    box.className=`attendance-result ${late?'late':'ok'}`;
    box.innerHTML=`<div><b>${late?`⚠ TRỄ ${r.late_minutes} PHÚT`:'✓ CHẤM CÔNG ĐÚNG GIỜ'}</b><span>${escapeHtml(r.employee)} · ${escapeHtml(r.shift_name)}</span></div><div><b>${vnTime(r.punched_at)}</b><a href="${mapsUrl(r)}" target="_blank" rel="noopener">📍 ${locationText(r)}</a></div>`;
  }

  async function loadAttendance(){
    try{
      const date=localDateKey();
      attendanceRows=await cloudFetch(`${ATTENDANCE_TABLE}?select=*&date_key=eq.${date}&order=punched_at.desc`)||[];
      renderAttendance();
    }catch(err){console.error('Không tải được chấm công:',err)}
  }
  function renderAttendance(){
    if(!$('attendanceList'))return;
    $('attendanceEmpty').classList.toggle('hidden',attendanceRows.length>0);
    $('attendanceList').innerHTML=attendanceRows.map(r=>{
      const late=r.status==='late';
      return `<div class="attendance-row">
        <div class="attendance-person"><b>${escapeHtml(r.employee)}</b><span>${escapeHtml(r.shift_name)} · ${vnTime(r.punched_at)}</span></div>
        <div class="attendance-status ${late?'late':'ok'}">${late?`Trễ ${r.late_minutes}p`:'Đúng giờ'}</div>
        <a class="attendance-location" href="${mapsUrl(r)}" target="_blank" rel="noopener">📍 ${locationText(r)}</a>
      </div>`;
    }).join('');
  }

  const style=document.createElement('style');
  style.textContent=`
    .attendance-card{grid-column:1/-1;border:1.5px solid #7bc9bd;background:linear-gradient(180deg,#f7fffd,#fff)}
    .attendance-head{margin-bottom:10px}.attendance-clock{font-weight:900;color:var(--primary);font-variant-numeric:tabular-nums;white-space:nowrap}
    .attendance-layout{display:grid;grid-template-columns:1fr 150px;gap:16px;align-items:center}.attendance-info .field-label{margin-top:0}
    .attendance-punch{width:138px;height:138px;border-radius:50%;border:8px solid #d9f3ee;background:var(--primary);color:#fff;justify-self:center;display:grid;place-items:center;align-content:center;gap:3px;box-shadow:0 12px 28px rgba(15,118,110,.25);font-weight:900}
    .attendance-punch:hover{background:var(--primary-dark)}.attendance-punch:disabled{opacity:.55}.attendance-punch-icon{font-size:30px;line-height:1}.attendance-punch strong{font-size:16px;line-height:1.05;letter-spacing:.04em}
    .attendance-preview{margin-top:9px;border-radius:12px;padding:9px 11px;display:flex;justify-content:space-between;gap:10px;font-size:13px}.attendance-preview b,.attendance-preview span{display:block}.attendance-preview.ontime{background:#ecfdf5;color:#166534}.attendance-preview.late{background:#fff7ed;color:#b45309}.attendance-preview.outside{background:#f3f4f6;color:#4b5563;display:block}.attendance-preview.outside span{margin-top:3px;font-size:12px}
    .attendance-result{margin-top:12px;border-radius:12px;padding:11px 12px;display:flex;justify-content:space-between;gap:12px;align-items:center}.attendance-result.ok{background:#ecfdf5}.attendance-result.late{background:#fff1f2}.attendance-result div{display:grid;gap:3px}.attendance-result span,.attendance-result a{font-size:12px;color:var(--muted);text-decoration:none}
    .attendance-history-head{display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:12px;border-top:1px solid var(--line)}.attendance-list{display:grid;gap:7px;margin-top:8px}.attendance-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px 10px;border:1px solid var(--line);border-radius:12px;padding:10px 11px}.attendance-person{display:grid;gap:2px}.attendance-person span{font-size:12px;color:var(--muted)}.attendance-status{font-size:12px;font-weight:900;border-radius:999px;padding:5px 8px;align-self:start}.attendance-status.ok{background:#dcfce7;color:#166534}.attendance-status.late{background:#fee2e2;color:#b91c1c}.attendance-location{grid-column:1/-1;font-size:12px;color:var(--primary);text-decoration:none;overflow-wrap:anywhere}
    @media(max-width:560px){.attendance-layout{grid-template-columns:1fr 112px;gap:10px}.attendance-punch{width:106px;height:106px;border-width:6px}.attendance-punch-icon{font-size:24px}.attendance-punch strong{font-size:13px}.attendance-preview{display:grid}.attendance-result{display:grid}.attendance-clock{font-size:12px}}
  `;
  document.head.appendChild(style);

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountAttendance);else mountAttendance();
})();
