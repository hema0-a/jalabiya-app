/* ============================================================
   feature-workers.js
   مرحلة 4 من التحديث الشامل — إدارة عمال الورشة:
   1) كل عامل له نظام أجر خاص به: ثابت شهري أو بالقطعة (لكل صنف
      في الطلب المسند له)، حسب اختيارك وقت إضافة العامل.
   2) كل طلب ممكن يتسند لعامل مسئول عنه (حقل جديد في نموذج
      الطلب)، وبيظهر اسمه على كارت الطلب.
   3) صفحة جديدة كاملة "👷 العمال" (بتتحقن في الـ DOM وبتتضاف
      لها زرار في القائمة الجانبية) فيها: إضافة/تعديل عامل،
      حساب المستحق لكل عامل (ثابت + قطعة الشغل من طلباته
      المُسندة)، وتسجيل دفعات أجور.
   ملف مستقل، مش بيلمس core.js ولا patches.js — بيحقن الصفحة
   والحقول بنفسه وبيلف الدوال الموجودة.
   ============================================================ */
(function(){

  function ensureWorkersDefaults(){
    if(!Array.isArray(db.workers)) db.workers = [];
    if(!Array.isArray(db.workerPayments)) db.workerPayments = [];
  }

  /* ---------- 1) حساب المستحق لكل عامل ---------- */
  function workerPieceEarnings(workerId){
    return (db.orders||[]).filter(o=>o.assignedWorkerId===workerId)
      .reduce((s,o)=>{
        const itemsQty = Array.isArray(o.items) ? o.items.reduce((a,it)=>a+(Number(it.qty)||1),0) : 1;
        return s + itemsQty;
      }, 0);
  }

  function workerPaidTotal(workerId){
    return (db.workerPayments||[]).filter(p=>p.workerId===workerId).reduce((s,p)=>s+Number(p.amount||0),0);
  }

  function calcWorkerDue(w){
    ensureWorkersDefaults();
    const pieces = workerPieceEarnings(w.id);
    const pieceDue = w.payType==='piece' || w.payType==='both' ? pieces*(Number(w.pieceRate)||0) : 0;
    const monthlyDue = w.payType==='monthly' || w.payType==='both' ? (Number(w.monthlySalary)||0) : 0;
    const totalEarned = pieceDue + monthlyDue;
    const paid = workerPaidTotal(w.id);
    return {pieces, pieceDue, monthlyDue, totalEarned, paid, remaining: totalEarned-paid};
  }

  /* ---------- 2) ربط الطلبات بالعمال ---------- */
  function workersOptionsHtml(selectedId){
    ensureWorkersDefaults();
    const active = db.workers.filter(w=>w.active!==false);
    if(!active.length) return '<option value="">لا يوجد عمال مسجلين</option>';
    return '<option value="">— بدون تحديد —</option>' + active.map(w=>
      `<option value="${w.id}" ${selectedId===w.id?'selected':''}>${escapeHtml(w.name)}</option>`
    ).join('');
  }

  if(typeof openOrderModal === 'function'){
    const origOpenOrderModal = openOrderModal;
    window.openOrderModal = function(id, presetCustomerId){
      const r = origOpenOrderModal.apply(this, arguments);
      setTimeout(function(){
        ensureWorkersDefaults();
        const mcField = document.getElementById('f_materialCost');
        if(mcField && !document.getElementById('f_assignedWorker')){
          const o = id ? (db.orders||[]).find(x=>x.id===id) : null;
          const html = `<div class="field"><label>👷 مسند للعامل</label><select id="f_assignedWorker">${workersOptionsHtml(o?o.assignedWorkerId:'')}</select></div>`;
          mcField.closest('.field').insertAdjacentHTML('afterend', html);
        }
      }, 30);
      return r;
    };
  }

  if(typeof saveOrder === 'function'){
    const origSaveOrder = saveOrder;
    window.saveOrder = function(id){
      const sel = document.getElementById('f_assignedWorker');
      const workerId = sel ? sel.value : '';
      const countBefore = (db.orders||[]).length;
      const r = origSaveOrder.apply(this, arguments);
      let targetOrder = null;
      if(id){
        targetOrder = (db.orders||[]).find(x=>x.id===id);
      } else if((db.orders||[]).length===countBefore+1){
        targetOrder = db.orders[db.orders.length-1];
      }
      if(targetOrder){
        targetOrder.assignedWorkerId = workerId || null;
        saveDB();
      }
      return r;
    };
  }

  if(typeof renderOrders === 'function'){
    const origRenderOrders = renderOrders;
    window.renderOrders = function(){
      const r = origRenderOrders.apply(this, arguments);
      ensureWorkersDefaults();
      document.querySelectorAll('#ordersList .card, #page-orders .card[data-status]').forEach(function(card){
        // مفيش id للطلب في الكارت مباشرة، فبنستنتجه من زرار "تعديل"
        const btn = card.querySelector('button[onclick^="openOrderModal("]');
        if(!btn) return;
        const m = btn.getAttribute('onclick').match(/openOrderModal\('([^']+)'\)/);
        if(!m) return;
        const o = db.orders.find(x=>x.id===m[1]);
        if(!o || !o.assignedWorkerId || card.querySelector('.worker-badge-line')) return;
        const w = db.workers.find(x=>x.id===o.assignedWorkerId);
        if(!w) return;
        const line = document.createElement('div');
        line.className = 'meta worker-badge-line';
        line.textContent = '👷 مسند لـ: ' + w.name;
        const firstMeta = card.querySelector('.meta');
        if(firstMeta) firstMeta.insertAdjacentElement('afterend', line);
      });
      return r;
    };
  }

  /* ---------- 3) صفحة العمال ---------- */
  window.openWorkerModal = function(id){
    ensureWorkersDefaults();
    const w = id ? db.workers.find(x=>x.id===id) : null;
    const html = `
      <h3>${w?'✏️ تعديل عامل':'➕ إضافة عامل جديد'}</h3>
      <div class="field"><label>الاسم</label><input id="f_workerName" type="text" value="${w?escapeHtml(w.name):''}"></div>
      <div class="field"><label>نظام الأجر</label>
        <select id="f_workerPayType" onchange="onWorkerPayTypeChange()">
          <option value="monthly" ${w&&w.payType==='monthly'?'selected':''}>ثابت شهري</option>
          <option value="piece" ${w&&w.payType==='piece'?'selected':''}>بالقطعة</option>
          <option value="both" ${w&&w.payType==='both'?'selected':''}>الاتنين مع بعض</option>
        </select>
      </div>
      <div class="field" id="workerMonthlyField"><label>الأجر الثابت الشهري (ج.م)</label><input id="f_workerMonthly" type="number" min="0" value="${w?w.monthlySalary||0:0}"></div>
      <div class="field" id="workerPieceField"><label>سعر القطعة (ج.م لكل قطعة يشتغلها)</label><input id="f_workerPiece" type="number" min="0" value="${w?w.pieceRate||0:0}"></div>
      <button class="btn" onclick="saveWorker(${w?`'${w.id}'`:'null'})">💾 حفظ</button>
    `;
    openModal(html);
    onWorkerPayTypeChange();
  };

  window.onWorkerPayTypeChange = function(){
    const type = document.getElementById('f_workerPayType').value;
    document.getElementById('workerMonthlyField').style.display = (type==='monthly'||type==='both') ? 'block':'none';
    document.getElementById('workerPieceField').style.display = (type==='piece'||type==='both') ? 'block':'none';
  };

  window.saveWorker = function(id){
    ensureWorkersDefaults();
    const name = document.getElementById('f_workerName').value.trim();
    if(!name){ toast('أدخل اسم العامل'); return; }
    const payType = document.getElementById('f_workerPayType').value;
    const monthlySalary = Number(document.getElementById('f_workerMonthly').value)||0;
    const pieceRate = Number(document.getElementById('f_workerPiece').value)||0;
    if(id){
      const w = db.workers.find(x=>x.id===id);
      Object.assign(w, {name, payType, monthlySalary, pieceRate});
    } else {
      db.workers.push({id:uid(), name, payType, monthlySalary, pieceRate, active:true});
    }
    saveDB();
    closeModal();
    toast('✅ اتحفظ العامل');
    renderWorkersPage();
  };

  window.deactivateWorker = async function(id){
    if(!await appConfirm('إيقاف هذا العامل؟ (مش هيتحذف، بس هيتشال من قايمة الإسناد للطلبات الجديدة)')) return;
    const w = db.workers.find(x=>x.id===id);
    if(w) w.active = false;
    saveDB();
    toast('تم الإيقاف');
    renderWorkersPage();
  };

  window.reactivateWorker = function(id){
    const w = db.workers.find(x=>x.id===id);
    if(w) w.active = true;
    saveDB();
    renderWorkersPage();
  };

  window.recordWorkerPayment = function(workerId){
    const amountStr = document.getElementById('wpAmount_'+workerId);
    const amount = amountStr ? Number(amountStr.value)||0 : 0;
    if(amount<=0){ toast('أدخل مبلغ صحيح'); return; }
    db.workerPayments.push({id:uid(), workerId, amount, date:todayStr()});
    saveDB();
    toast('✅ اتسجلت دفعة الأجر');
    renderWorkersPage();
  };

  window.renderWorkersPage = function(){
    ensureWorkersDefaults();
    const box = document.getElementById('workersList');
    if(!box) return;
    if(!db.workers.length){
      box.innerHTML = '<div class="empty-msg">لا يوجد عمال مسجلين — ضيف أول عامل بالزرار +</div>';
      return;
    }
    const sorted = db.workers.slice().sort((a,b)=>(a.active===false?1:0)-(b.active===false?1:0));
    box.innerHTML = sorted.map(w=>{
      const d = calcWorkerDue(w);
      const payLabel = w.payType==='monthly'?'ثابت شهري':(w.payType==='piece'?'بالقطعة':'ثابت + قطعة');
      return `<div class="card" style="${w.active===false?'opacity:.6;':''}">
        <div class="row"><h3>👷 ${escapeHtml(w.name)}${w.active===false?' <span class="meta">(متوقف)</span>':''}</h3><b style="color:${d.remaining>0?'var(--danger)':'var(--primary)'};">${Math.round(d.remaining).toLocaleString('ar-EG')} ج.م</b></div>
        <div class="meta">💼 ${payLabel}${w.payType!=='monthly'?` — سعر القطعة ${Number(w.pieceRate).toLocaleString('ar-EG')} ج.م × ${d.pieces} قطعة = ${Math.round(d.pieceDue).toLocaleString('ar-EG')} ج.م`:''}${w.payType!=='piece'?` ${w.payType==='both'?'+ ':''}الثابت الشهري ${Number(w.monthlySalary).toLocaleString('ar-EG')} ج.م`:''}</div>
        <div class="meta">📊 إجمالي المستحق: ${Math.round(d.totalEarned).toLocaleString('ar-EG')} ج.م — المدفوع: ${Math.round(d.paid).toLocaleString('ar-EG')} ج.م</div>
        <div class="field-row2" style="margin-top:6px;">
          <div class="field"><label>تسجيل دفعة أجر (ج.م)</label><input id="wpAmount_${w.id}" type="number" min="0"></div>
        </div>
        <div class="btn-row">
          <button class="btn sm outline" onclick="recordWorkerPayment('${w.id}')">💵 تسجيل دفعة</button>
          <button class="btn sm secondary" onclick="openWorkerModal('${w.id}')">✏️ تعديل</button>
          ${w.active===false
            ? `<button class="btn sm outline" onclick="reactivateWorker('${w.id}')">▶️ إعادة تفعيل</button>`
            : `<button class="btn sm danger" onclick="deactivateWorker('${w.id}')">⏸️ إيقاف</button>`}
        </div>
      </div>`;
    }).join('');
  };

  /* ---------- حقن الصفحة + رابط القائمة الجانبية ---------- */
  function injectWorkersPage(){
    if(document.getElementById('page-workers')) return;
    const financePage = document.getElementById('page-finance');
    if(!financePage) return;
    const section = document.createElement('section');
    section.className = 'page';
    section.id = 'page-workers';
    section.innerHTML = `
      <div class="section-title">👷 عمال الورشة</div>
      <button class="btn outline" onclick="openWorkerModal()">➕ إضافة عامل</button>
      <div id="workersList" style="margin-top:8px;"></div>
    `;
    financePage.insertAdjacentElement('afterend', section);

    const sidenav = document.getElementById('sideNav');
    if(sidenav && !sidenav.querySelector('[data-page="workers"]')){
      const btn = document.createElement('button');
      btn.className = 'navbtn';
      btn.setAttribute('data-page','workers');
      btn.setAttribute('onclick',"showPage('workers');closeSideNav()");
      btn.innerHTML = '<span class="ic">👷</span>العمال';
      const financeBtn = sidenav.querySelector('[data-page="finance"]');
      if(financeBtn) financeBtn.insertAdjacentElement('afterend', btn);
      else sidenav.appendChild(btn);
    }

    if(typeof pageTitles==='object') pageTitles.workers = '👷 العمال';
    if(typeof fabPages==='object') fabPages.workers = false;
  }

  if(typeof renderAll === 'function'){
    const origRenderAll = renderAll;
    window.renderAll = function(){
      const r = origRenderAll.apply(this, arguments);
      if(document.getElementById('page-workers')) renderWorkersPage();
      return r;
    };
  }

  document.addEventListener('DOMContentLoaded', function(){
    ensureWorkersDefaults();
    injectWorkersPage();
  });
})();
