// Always-available shared revenue entry. If a shift is active, entry is attached to it; otherwise it is stored as Outside shift.
(function(){
  const URL='https://dinqlgaveujdeyisgpty.supabase.co';
  const KEY='sb_publishable_xFCEf-YDU-F8PJfuoxHD-Q_NlFAWl9N';
  const H={apikey:KEY,'Content-Type':'application/json'};
  const ACTIVE_API=`${URL}/functions/v1/staff-active-shift`;
  let busy=false;
  const q=id=>document.getElementById(id);
  const pm=v=>Number(String(v||'').replace(/\D/g,''))||0;
  const fmt=el=>{const n=pm(el.value);el.value=n?new Intl.NumberFormat('vi-VN').format(n):''};
  const notify=m=>typeof toast==='function'?toast(m):alert(m);

  function employee(){return q('attendanceEmployee')?.value.trim()||q('employeeName')?.value.trim()||localStorage.getItem('r971_staff_employee_v1')||'Chưa ghi tên NV'}
  async function rest(path,opts={}){const r=await fetch(`${URL}/rest/v1/${path}`,{...opts,headers:{...H,...(opts.headers||{})}});const t=await r.text();if(!r.ok)throw new Error(t||`Lỗi ${r.status}`);return t?JSON.parse(t):null}
  async function currentActive(){const rows=await rest('staff_active_shift?select=id,date_key,employee,shift_key,shift_name,totals,updated_at&singleton_id=eq.1');return rows?.[0]||null}

  function mount(){
    if(q('quickRevenueCard'))return;
    const main=document.querySelector('main.container'),before=q('activeShiftCard')||q('startShiftCard');if(!main||!before)return;
    const activeCard=q('activeShiftCard');
    if(activeCard){
      const oldKicker=[...activeCard.querySelectorAll('.section-kicker')].find(x=>x.textContent.trim()==='GHI NHẬN THÊM DOANH THU');
      if(oldKicker?.parentElement)oldKicker.parentElement.style.display='none';
    }
    const s=document.createElement('section');s.id='quickRevenueCard';s.className='card';s.innerHTML=`
      <div class="card-head compact"><div><p class="section-kicker">GHI NHẬN THÊM DOANH THU</p><h2>Nhập doanh thu</h2><p class="muted">Ai mở link cũng có thể nhập. Không cần bắt đầu ca.</p></div><span id="quickRevenueStatus" class="status-dot">Đang kiểm tra</span></div>
      <div class="money-grid" style="margin-top:10px">
        <label><span>🏦 Chuyển khoản</span><input id="qTransfer" class="input" inputmode="numeric" placeholder="Nhập thêm"></label>
        <label><span>💵 Tiền mặt</span><input id="qCash" class="input" inputmode="numeric" placeholder="Nhập thêm"></label>
        <label><span>🏸 Doanh thu sân</span><input id="qCourt" class="input" inputmode="numeric" placeholder="Nhập thêm"></label>
        <label><span>🥤 Doanh thu nước</span><input id="qWater" class="input" inputmode="numeric" placeholder="Nhập thêm"></label>
      </div>
      <button id="quickRevenueBtn" class="btn btn-primary btn-block" type="button">+ CỘNG DOANH THU</button>`;
    main.insertBefore(s,before);
    ['qTransfer','qCash','qCourt','qWater'].forEach(id=>q(id).addEventListener('input',()=>fmt(q(id))));
    q('quickRevenueBtn').addEventListener('click',submit);
    if(q('summaryDate'))q('summaryDate').addEventListener('change',refreshSummary);
    const oldRender=window.renderSummary||renderSummary;
    renderSummary=function(){oldRender();refreshSummary()};
    updateAll();
    setInterval(updateAll,2000);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')updateAll()});
    window.addEventListener('focus',updateAll);
  }

  async function updateAll(){await Promise.allSettled([updateStatus(),refreshSummary()])}

  async function updateStatus(){
    if(!q('quickRevenueStatus'))return;
    try{const a=await currentActive();q('quickRevenueStatus').textContent=a?`${a.shift_name} · ${a.employee}`:'Ngoài ca'}catch{q('quickRevenueStatus').textContent='Sẵn sàng'}
  }

  async function submit(){
    if(busy)return;
    const entry={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),transfer:pm(q('qTransfer').value),cash:pm(q('qCash').value),courtRevenue:pm(q('qCourt').value),waterRevenue:pm(q('qWater').value),employee:employee()};
    if(!(entry.transfer||entry.cash||entry.courtRevenue||entry.waterRevenue))return notify('Hãy nhập ít nhất một khoản tiền');
    busy=true;q('quickRevenueBtn').disabled=true;
    try{
      const r=await fetch(ACTIVE_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'public_add_entry',entry})});
      const data=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(data.error||`Lỗi ${r.status}`);
      if(data.active){
        notify(`Đã cộng vào ${data.active.shift_name} của ${data.active.employee}`);
      }else{
        const now=new Date();
        await rest('staff_revenue_entries',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({date_key:localDateKey(now),employee:entry.employee,transfer:entry.transfer,cash:entry.cash,court_revenue:entry.courtRevenue,water_revenue:entry.waterRevenue,shift_name:'Ngoài ca',source:'manual'})});
        notify('Đã lưu doanh thu ngoài ca');
      }
      ['qTransfer','qCash','qCourt','qWater'].forEach(id=>q(id).value='');
      await updateAll();
      if(typeof window.fetchSharedActive==='function')window.fetchSharedActive();
    }catch(e){console.error(e);notify('Không lưu được doanh thu: '+(e.message||'Lỗi'))}
    finally{busy=false;q('quickRevenueBtn').disabled=false}
  }

  async function refreshSummary(){
    if(!q('summaryDate'))return;
    const date=q('summaryDate').value||localDateKey();
    try{
      const list=recordsFor(date);
      const base=list.reduce((a,x)=>({transfer:a.transfer+Number(x.transfer||0),cash:a.cash+Number(x.cash||0),court:a.court+Number(x.courtRevenue||0),water:a.water+Number(x.waterRevenue||0)}),{transfer:0,cash:0,court:0,water:0});

      const [extra,active]=await Promise.all([
        rest(`staff_revenue_entries?select=transfer,cash,court_revenue,water_revenue&date_key=eq.${encodeURIComponent(date)}`),
        currentActive()
      ]);
      (extra||[]).forEach(x=>{base.transfer+=Number(x.transfer||0);base.cash+=Number(x.cash||0);base.court+=Number(x.court_revenue||0);base.water+=Number(x.water_revenue||0)});

      if(active&&active.date_key===date){
        const t=active.totals||{};
        base.transfer+=Number(t.transfer||0);
        base.cash+=Number(t.cash||0);
        base.court+=Number(t.courtRevenue||0);
        base.water+=Number(t.waterRevenue||0);
      }

      q('sumTransfer').textContent=money(base.transfer);
      q('sumCash').textContent=money(base.cash);
      q('sumCourt').textContent=money(base.court);
      q('sumWater').textContent=money(base.water);
      q('sumRevenue').textContent=money(base.court+base.water);
    }catch(e){console.error('Không tải được tổng hợp doanh thu chung',e)}
  }

  window.refreshQuickRevenueSummary=refreshSummary;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();