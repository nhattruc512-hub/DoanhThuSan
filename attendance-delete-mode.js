// Manager attendance deletion mode: one action deletes the entire attendance record.
(function(){
  function apply(){
    const card=document.getElementById('managerCard');
    if(!card)return;

    card.querySelectorAll('[data-clear-attendance-location]').forEach(btn=>btn.remove());
    card.querySelectorAll('[data-delete-attendance]').forEach(btn=>{
      btn.textContent='Xóa chấm công';
      btn.title='Xóa toàn bộ giờ chấm công và vị trí GPS';
    });

    card.querySelectorAll('.manager-section-head .muted').forEach(p=>{
      const kicker=p.parentElement?.querySelector('.section-kicker')?.textContent?.trim();
      if(kicker==='LỊCH SỬ CHẤM CÔNG'){
        p.textContent='Xóa chấm công sẽ xóa toàn bộ bản ghi gồm thời gian, vị trí GPS, ca và trạng thái.';
      }
    });

    card.querySelectorAll('.manager-attendance-actions').forEach(box=>{
      box.style.gridTemplateColumns='1fr';
      box.style.minWidth='145px';
    });
  }

  const observer=new MutationObserver(apply);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);else apply();
})();
