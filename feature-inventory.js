/* ============================================================
   feature-inventory.js
   مرحلة 3 من التحديث الشامل — إدارة مخزون بسيطة (قيمة مالية
   إجمالية بس، مفيش تتبّع بالصنف/المتر حسب الاختيار)، مربوطة
   بالطلبات: كل طلب فيه "تكلفة الخامة" (حقل موجود بالفعل)
   بيتخصم تلقائي من رصيد المخزون وقت إنشاء الطلب، ولو الطلب
   اتعدّل أو اتحذف الرصيد بيتعدّل معاه بالفرق عشان الرقم يفضل
   دقيق. ملف مستقل، مش بيلمس core.js ولا patches.js.
   ============================================================ */
(function(){

  function ensureInventoryDefaults(){
    if(typeof db.inventoryValue !== 'number') db.inventoryValue = 0;
    if(!Array.isArray(db.inventoryLog)) db.inventoryLog = [];
  }

  function logInventory(type, amount, note){
    ensureInventoryDefaults();
    db.inventoryLog.unshift({id:uid(), type, amount, note:note||'', date:todayStr(), ts:Date.now()});
    if(db.inventoryLog.length>100) db.inventoryLog = db.inventoryLog.slice(0,100);
  }

  /* ---------- خصم/إرجاع تلقائي مربوط بحفظ وحذف الطلبات ---------- */
  if(typeof saveOrder === 'function'){
    const origSaveOrder = saveOrder;
    // [إصلاح] saveOrder بقت async في patch تاني (نافذة "هل تريد حفظ
    // التعديلات؟" اللي بتظهر عند تعديل طلب موجود) — لو مانستناش (await)
    // النتيجة هنا، الكود تحت كان بيقارن قبل/بعد فورًا وهو لسه واقف
    // مستنّي المستخدم يضغط تأكيد، فكان دايمًا بيلاقي "مفيش فرق" ويتجاهل
    // تعديل قيمة المخزون تمامًا (حتى لو المستخدم أكّد الحفظ فعلاً).
    window.saveOrder = async function(id){
      ensureInventoryDefaults();
      if(id){
        const existing = db.orders.find(x=>x.id===id);
        const before = existing ? Number(existing.materialCost)||0 : 0;
        const countBefore = db.orders.length;
        const r = await origSaveOrder.apply(this, arguments);
        // orig ممكن يرجع من غير تنفيذ لو المستخدم لغى نافذة التأكيد أو فيه خطأ تحقق (validation) — التأكد إن التعديل فعلاً حصل
        const after = existing ? Number(existing.materialCost)||0 : 0;
        if(db.orders.length===countBefore && existing && after!==before){
          const diff = after - before;
          db.inventoryValue -= diff;
          if(diff!==0) logInventory('out', diff, `تعديل تكلفة خامة طلب #${existing.invoiceNumber||''}`);
          saveDB();
          if(typeof renderInventoryCard==='function') renderInventoryCard();
        }
        return r;
      } else {
        const countBefore = db.orders.length;
        const r = await origSaveOrder.apply(this, arguments);
        if(db.orders.length===countBefore+1){
          const newOrder = db.orders[db.orders.length-1];
          const mc = Number(newOrder.materialCost)||0;
          if(mc>0){
            db.inventoryValue -= mc;
            logInventory('out', mc, `طلب جديد #${newOrder.invoiceNumber||''}`);
            saveDB();
            if(typeof renderInventoryCard==='function') renderInventoryCard();
          }
        }
        return r;
      }
    };
  }

  if(typeof deleteOrder === 'function'){
    const origDeleteOrder = deleteOrder;
    window.deleteOrder = async function(id){
      const existing = (db.orders||[]).find(x=>x.id===id);
      const mc = existing ? Number(existing.materialCost)||0 : 0;
      const countBefore = (db.orders||[]).length;
      const r = await origDeleteOrder.apply(this, arguments);
      const countAfter = (db.orders||[]).length;
      if(mc>0 && countAfter<countBefore){
        ensureInventoryDefaults();
        db.inventoryValue += mc;
        logInventory('in', mc, `استرجاع بسبب حذف طلب #${existing.invoiceNumber||''}`);
        saveDB();
        if(typeof renderInventoryCard==='function') renderInventoryCard();
      }
      return r;
    };
  }

  /* ---------- إضافة رصيد مخزون يدويًا (شراء خامة جديدة) ---------- */
  window.addInventoryStock = function(){
    ensureInventoryDefaults();
    const amountEl = document.getElementById('inventoryAddAmount');
    const noteEl = document.getElementById('inventoryAddNote');
    const amount = Number(amountEl && amountEl.value)||0;
    if(!(amount>0)){ toast('أدخل مبلغ صحيح'); return; } // [إصلاح] "amount<=0" كانت بتفوّت قيمة NaN (NaN<=0 == false)، فأي إدخال غير رقمي كان ممكن يخرب رصيد المخزون للأبد بقيمة NaN. "amount>0" بالنفي بيرفض NaN صح.
    db.inventoryValue += amount;
    logInventory('in', amount, (noteEl && noteEl.value.trim()) || 'إضافة رصيد مخزون');
    saveDB();
    if(amountEl) amountEl.value='';
    if(noteEl) noteEl.value='';
    toast('✅ اتضاف للمخزون');
    renderInventoryCard();
  };

  window.renderInventoryCard = function(){
    ensureInventoryDefaults();
    const box = document.getElementById('inventoryCard');
    if(!box) return;
    const val = Number(db.inventoryValue)||0;
    const logHtml = db.inventoryLog.slice(0,6).map(l=>{
      const sign = l.type==='in' ? '+' : '−';
      const color = l.type==='in' ? 'var(--primary)' : 'var(--danger)';
      return `<div class="meta">${fmtDate(l.date)} — <b style="color:${color};">${sign}${Math.round(l.amount).toLocaleString('ar-EG')} ج.م</b> — ${escapeHtml(l.note)}</div>`;
    }).join('') || `<div class="meta">لا يوجد سجل حركة بعد</div>`;
    box.innerHTML = `
      <div class="row"><h3>📦 رصيد المخزون (خامات/أقمشة)</h3><b style="font-size:18px;color:${val<0?'var(--danger)':'var(--primary)'};">${Math.round(val).toLocaleString('ar-EG')} ج.م</b></div>
      <div class="meta">${val<0?'⚠️ الرصيد بالسالب — سجّل شراء خامة جديد عشان الرقم يبقى دقيق':'بيتخصم منه تلقائيًا "تكلفة الخامة" من أي طلب جديد'}</div>
      <div class="field-row2" style="margin-top:8px;">
        <div class="field"><label>إضافة رصيد (شراء خامة) ج.م</label><input id="inventoryAddAmount" type="number" min="0"></div>
        <div class="field"><label>ملاحظة (اختياري)</label><input id="inventoryAddNote" type="text" placeholder="مثال: قماش قطن دفعة جديدة"></div>
      </div>
      <button class="btn sm outline" onclick="addInventoryStock()">➕ إضافة للمخزون</button>
      <hr class="sep">
      <div class="meta" style="font-weight:700;margin-bottom:4px;">آخر الحركات:</div>
      ${logHtml}
    `;
  };

  function injectInventoryContainer(){
    if(document.getElementById('inventoryCard')) return;
    const stats = document.getElementById('financeStats');
    if(!stats) return;
    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'inventoryCard';
    stats.insertAdjacentElement('afterend', card);
  }

  if(typeof renderFinance === 'function'){
    const origRenderFinance = renderFinance;
    window.renderFinance = function(){
      const r = origRenderFinance.apply(this, arguments);
      injectInventoryContainer();
      renderInventoryCard();
      return r;
    };
  }

  document.addEventListener('DOMContentLoaded', function(){
    ensureInventoryDefaults();
    injectInventoryContainer();
    renderInventoryCard();
  });
})();
