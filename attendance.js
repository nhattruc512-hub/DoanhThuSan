// Independent shared attendance module with geolocation and date history.
(function(){
  const CLOUD_URL='https://dinqlgaveujdeyisgpty.supabase.co';
  const CLOUD_KEY='sb_publishable_xFCEf-YDU-F8PJfuoxHD-Q_NlFAWl9N';
  const ATTENDANCE_TABLE='staff_attendance_records';
  const VI_TIME_ZONE='Asia/Ho_Chi_Minh';
  const headers={apikey:CLOUD_KEY,'Content-Type':'application/json'};
  let rows=[];let loading=false;

  const el=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const notify=msg=>{if(typeof toast==='function')toast(msg);else alert(msg)};
  function hcm(date=new Date()){
    const p=new Intl.DateTimeFormat('en-GB',{timeZone:VI_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(date);
    const m=Object.fromEntries(p.map(x=>[x.type,x.value]));return {year:+m.year,month:+m.month,day:+m.day,hour:+m.hour,minute:+m.minute,second:+m.second};
  }
  const dateKey=p=>`${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`;
  const todayKey=()=>dateKey(hcm());
  function shiftFor(p){
    const mins=p.hour*60+p.minute;
    const list=[
      {key:'ca1',name:'Ca 1',start:300,end:660,startText:'05:00',endText:'11:00'},
      {key:'ca2',name:'Ca 2',start:840,end:1079,startText:'14:00',endText:'18:00'},
      {key:'ca3',name:'Ca 3',start:1080,end:1320,startText:'18:00',endText:'22:00'}
    ];
    const s=list.find(x=>mins>=x.start&&mins<=x.end);if(!s)return null;
    const late=mins>s.start+1;return {...s,status:late?'late':'on_time',lateMinutes:late?mins-s.start:0};
  }
  const hasLoc=r=>r&&r.latitude!=null&&r.longitude!=null;
  const locText=r=>hasLoc(r)?`${Number(r.latitude).toFixed(6)}, ${Number(r.longitude).toFixed(6)}${r.accuracy_m?` · ±${Math.round(r.accuracy_m)}m`:''}`:'Vị trí đã được quản lý xóa';
  const mapUrl=r=>`https://www.google.com/maps?q=${encodeURIComponent(r.latitude+','+r.longitude)}`;
  const timeText=iso=>new Intl.DateTimeFormat('vi-VN',{timeZone:VI_TIME_ZONE,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(iso));
  async function cloud(path,opts={}){const r=await fetch(`${CLOUD_URL}/rest/v1/${path}`,{...opts,headers:{...headers,...(opts.headers||{})}});const t=await r.text();if(!r.ok)throw new Error(t||`Lỗi ${r.status}`);return t?JSON.parse(t):null}

  function mount(){
    const main=document.querySelector('main.container');if(!main||el('attendanceCard'))return;
    const s=document.createElement('section');s.id='attendanceCard';s.className='card attendance-card';
    s.innerHTML=`<div class="card-head compact attendance-head"><div><p class="section-kicker">CHẤM CÔNG</p><h2>Chấm công vào ca</h2><p class="muted">Lưu giờ và vị trí lên máy chủ chung.</p></div><div id="attendanceNow" class="attendance-clock"></div></div>
      <div class="attendance-layout"><div class="attendance-info"><label class="field-label">Tên nhân viên</label><input id="attendanceEmployee" class="input" maxlength="60" placeholder="Nhập tên nhân viên"><div id="attendanceShiftPreview" class="attendance-preview"></div></div><button id="attendancePunchBtn" class="attendance-punch" type="button"><span class="attendance-punch-icon">✓</span><strong>CHẤM<br>CÔNG</strong></button></div>
      <div id="attendanceMessage" class="hidden"></div>
      <div class="attendance-history-head"><div><b>Lịch sử chấm công</b><div id="attendanceLoadStatus" class="muted" style="font-size:12px"></div></div><div style="display:flex;gap:7px;align-items:center"><input id="attendanceDate" class="date-input" type="date"><button id="attendanceRefreshBtn" class="btn btn-secondary" type="button">Làm mới</button></div></div>
      <div id="attendanceList" class="attendance-list"></div><div id="attendanceEmpty" class="empty-state hidden" style="padding:15px 8px"><b>Không có chấm công ngày này</b></div>`;
    main.insertBefore(s,main.firstChild);
    const saved=localStorage.getItem('r971_staff_employee_v1')||'';el('attendanceEmployee').value=saved;el('attendanceDate').value=todayKey();
    el('attendanceEmployee').addEventListener('input',()=>{const n=el('attendanceEmployee').value.trim();if(n)localStorage.setItem('r971_staff_employee_v1',n);if(el('employeeName')&&n)el('employeeName').value=n});
    el('attendancePunchBtn').addEventListener('click',punch);el('attendanceRefreshBtn').addEventListener('click',load);el('attendanceDate').addEventListener('change',load);
    updatePreview();setInterval(updatePreview,1000);load();
  }
  function updatePreview(){
    if(!el('attendanceNow'))return;const now=new Date();el('attendanceNow').textContent=new Intl.DateTimeFormat('vi-VN',{timeZone:VI_TIME_ZONE,day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(now);
    const s=shiftFor(hcm(now)),p=el('attendanceShiftPreview');if(!s){p.className='attendance-preview outside';p.innerHTML='<b>Ngoài giờ chấm công</b><span>Ca 1: 05:00–11:00 · Ca 2: 14:00–18:00 · Ca 3: 18:00–22:00</span>';return}
    p.className=`attendance-preview ${s.status==='late'?'late':'ontime'}`;p.innerHTML=`<b>${s.name} · ${s.startText}–${s.endText}</b><span>${s.status==='late'?`⚠ Trễ ${s.lateMinutes} phút`:'✓ Đúng giờ'}</span>`;
  }
  function position(){return new Promise((ok,no)=>{if(!navigator.geolocation)return no(new Error('Thiết bị không hỗ trợ vị trí'));navigator.geolocation.getCurrentPosition(ok,no,{enableHighAccuracy:true,timeout:15000,maximumAge:0})})}
  async function punch(){
    if(loading)return;const employee=el('attendanceEmployee').value.trim()||localStorage.getItem('r971_staff_employee_v1')||'';if(!employee)return notify('Nhập tên nhân viên trước khi chấm công');
    const now=new Date(),parts=hcm(now),s=shiftFor(parts);if(!s)return notify('Hiện đang ngoài giờ chấm công');loading=true;el('attendancePunchBtn').disabled=true;
    try{notify('Đang lấy vị trí chấm công...');const pos=await position();const row={employee:employee.slice(0,60),punched_at:now.toISOString(),date_key:dateKey(parts),shift_key:s.key,shift_name:s.name,scheduled_start:s.startText+':00',scheduled_end:s.endText+':00',status:s.status,late_minutes:s.lateMinutes,latitude:pos.coords.latitude,longitude:pos.coords.longitude,accuracy_m:pos.coords.accuracy};
      const r=await fetch(`${CLOUD_URL}/rest/v1/${ATTENDANCE_TABLE}`,{method:'POST',headers:{...headers,Prefer:'return=representation'},body:JSON.stringify(row)});const txt=await r.text();if(r.status===409)throw new Error('Bạn đã chấm công ca này hôm nay rồi');if(!r.ok)throw new Error(`Máy chủ ${r.status}: ${txt||'Không lưu được chấm công'}`);localStorage.setItem('r971_staff_employee_v1',employee);el('attendanceDate').value=row.date_key;showResult((txt?JSON.parse(txt):[row])[0]||row);await load();notify(s.status==='late'?`Đã chấm công · Trễ ${s.lateMinutes} phút`:'Đã chấm công đúng giờ');
    }catch(err){if(typeof err.code==='number')notify(err.code===1?'Bạn cần cho phép truy cập vị trí để chấm công':err.code===2?'Không xác định được vị trí':'Lấy vị trí quá lâu, hãy thử lại');else notify('Chấm công lỗi: '+(err.message||'Không xác định'))}finally{loading=false;el('attendancePunchBtn').disabled=false}
  }
  function showResult(r){const b=el('attendanceMessage');if(!b)return;const late=r.status==='late';b.className=`attendance-result ${late?'late':'ok'}`;const loc=hasLoc(r)?`<a href="${mapUrl(r)}" target="_blank" rel="noopener">📍 ${locText(r)}</a>`:`<span>📍 ${locText(r)}</span>`;b.innerHTML=`<div><b>${late?`⚠ TRỄ ${r.late_minutes} PHÚT`:'✓ CHẤM CÔNG ĐÚNG GIỜ'}</b><span>${esc(r.employee)} · ${esc(r.shift_name)}</span></div><div><b>${timeText(r.punched_at)}</b>${loc}</div>`}
  async function load(){
    if(!el('attendanceList'))return;const d=el('attendanceDate').value||todayKey();el('attendanceLoadStatus').textContent='Đang tải...';
    try{rows=await cloud(`${ATTENDANCE_TABLE}?select=*&date_key=eq.${encodeURIComponent(d)}&order=punched_at.desc`)||[];render();el('attendanceLoadStatus').textContent=`${rows.length} lượt chấm công`}
    catch(err){console.error(err);el('attendanceLoadStatus').textContent='Lỗi tải dữ liệu';notify('Không tải được lịch sử chấm công')}
  }
  function render(){el('attendanceEmpty').classList.toggle('hidden',rows.length>0);el('attendanceList').innerHTML=rows.map(r=>{const late=r.status==='late';const loc=hasLoc(r)?`<a class="attendance-location" href="${mapUrl(r)}" target="_blank" rel="noopener">📍 ${locText(r)}</a>`:`<div class="attendance-location muted">📍 ${locText(r)}</div>`;return `<div class="attendance-row"><div class="attendance-person"><b>${esc(r.employee)}</b><span>${esc(r.shift_name)} · ${timeText(r.punched_at)}</span></div><div class="attendance-status ${late?'late':'ok'}">${late?`Trễ ${r.late_minutes}p`:'Đúng giờ'}</div>${loc}</div>`}).join('')}
  window.reloadAttendance=load;
  const style=document.createElement('style');style.textContent=`.attendance-card{grid-column:1/-1;border:1.5px solid #7bc9bd;background:linear-gradient(180deg,#f7fffd,#fff)}.attendance-head{margin-bottom:10px}.attendance-clock{font-weight:900;color:var(--primary);font-variant-numeric:tabular-nums;white-space:nowrap}.attendance-layout{display:grid;grid-template-columns:1fr 150px;gap:16px;align-items:center}.attendance-info .field-label{margin-top:0}.attendance-punch{width:138px;height:138px;border-radius:50%;border:8px solid #d9f3ee;background:var(--primary);color:#fff;justify-self:center;display:grid;place-items:center;align-content:center;gap:3px;box-shadow:0 12px 28px rgba(15,118,110,.25);font-weight:900}.attendance-punch:disabled{opacity:.55}.attendance-punch-icon{font-size:30px;line-height:1}.attendance-punch strong{font-size:16px;line-height:1.05}.attendance-preview{margin-top:9px;border-radius:12px;padding:9px 11px;display:flex;justify-content:space-between;gap:10px;font-size:13px}.attendance-preview.ontime{background:#ecfdf5;color:#166534}.attendance-preview.late{background:#fff7ed;color:#b45309}.attendance-preview.outside{background:#f3f4f6;color:#4b5563;display:block}.attendance-preview.outside span{display:block;margin-top:3px;font-size:12px}.attendance-result{margin-top:12px;border-radius:12px;padding:11px 12px;display:flex;justify-content:space-between;gap:12px}.attendance-result.ok{background:#ecfdf5}.attendance-result.late{background:#fff1f2}.attendance-result div{display:grid;gap:3px}.attendance-result span,.attendance-result a{font-size:12px;color:var(--muted);text-decoration:none}.attendance-history-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:14px;padding-top:12px;border-top:1px solid var(--line)}.attendance-list{display:grid;gap:7px;margin-top:8px}.attendance-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px 10px;border:1px solid var(--line);border-radius:12px;padding:10px 11px}.attendance-person{display:grid;gap:2px}.attendance-person span{font-size:12px;color:var(--muted)}.attendance-status{font-size:12px;font-weight:900;border-radius:999px;padding:5px 8px;align-self:start}.attendance-status.ok{background:#dcfce7;color:#166534}.attendance-status.late{background:#fee2e2;color:#b91c1c}.attendance-location{grid-column:1/-1;font-size:12px;color:var(--primary);text-decoration:none;overflow-wrap:anywhere}@media(max-width:560px){.attendance-layout{grid-template-columns:1fr 112px;gap:10px}.attendance-punch{width:106px;height:106px;border-width:6px}.attendance-history-head{align-items:flex-start;flex-direction:column}.attendance-history-head>div:last-child{width:100%}.attendance-history-head .date-input{flex:1}.attendance-result{display:grid}.attendance-clock{font-size:12px}}`;document.head.appendChild(style);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();