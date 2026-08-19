// Customer debt hotfix: allow recording debt with or without an active shift.
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

  if(typedEmployee) localStorage.setItem(STORAGE.employee,typedEmployee);

  const now=new Date();
  const debt={
    id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),
    createdAt:now.toISOString(),
    dateKey:localDateKey(now),
    customer:customer.slice(0,80),
    reason:reason.slice(0,160),
    amount,
    employee,
    shiftKey:active?.shiftKey||'',
    shiftName:active?.shiftName||'Ngoài ca'
  };

  const debts=readDebts();
  debts.unshift(debt);
  saveDebts(debts);
  clearDebtInputs();
  renderDebts();
  toast(`Đã thêm khách nợ ${money(amount)}`);
};
