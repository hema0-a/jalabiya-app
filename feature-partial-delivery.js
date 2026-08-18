/* ============================================================
   feature-partial-delivery.js
   📦 تسليم جزئي للعميل — لو الطلب فيه أكتر من قطعة (أو صنف بكمية
   أكتر من واحد)، تقدر تسجّل تسليم جزء منه دلوقتي والباقي بعدين،
   بدل ما تكون الحالة "تم التسليم" أو "قيد العمل" بس من غير درجات
   وسط.

   - كل عملية تسليم جزئي بتتسجل في o.deliveries (تاريخ + الأصناف
     والكميات اللي اتسلمت + ملاحظة اختيارية).
   - لما آخر قطعة متبقية تتسلم، الطلب بيتحول تلقائيًا لـ "تم
     التسليم" بنفس آلية markOrderDelivered العادية (نفس سجل
     النشاط، التراجع، إنهاء وقت الشغل... إلخ).
   - بادج صغيرة على الكارت توضح "كام قطعة اتسلمت من كام" لأي طلب
     لسه في تسليم جزئي.

   ملف مستقل، بيلف renderOrders وبيحقن زرار وبادج في كل كارت طلب،
   مش بيلمس أي ملف تاني. (متاح في عرض القائمة، مش الكانبان حاليًا).
   ============================================================ */
(function(){

  function ensureDeliveries(o){
    if(!Array.isArray(o.deliveries)) o.deliveries = [];
  }

  function totalQty(o){
    return (o.items||[]).reduce((s,it)=>s+Number(it.qty||0), 0);
  }

  function deliveredQtyForType(o, type){
    ensureDeliveries(o);
    return o.deliveries.reduce((s,d)=>{
      const match = (d.items||[]).find(x=>x.type===type);
      return s + (match ? Number(match.qty||0) : 0);
    }, 0);
  }

  function itemsProgress(o){
    return (o.items||[]).map(it=>{
      const delivered = Math.min(it.qty, deliveredQtyForType(o, it.type));
      return {type:it.type, total:it.qty, delivered, remaining:Math.max(0, it.qty-delivered)};
    });
  }

  function totalDeliveredQty(o){
    return itemsProgress(o).reduce((s,p)=>s+p.delivered, 0);
  }

  function isEligibleForPartial(o){
    return totalQty(o) > 1 && o.status!=='تم التسليم';
  }

  function hasPartialProgress(o){
    ensureDeliveries(o);
    return o.deliveries.length>0 && o.status!=='تم التسليم';
  }

  /* ---------- المودال ---------- */

  window.openPartialDeliveryModal = function(orderId){
    const o = db.orders.find(x=>x.id===orderId);
    if(!o) return;
    const c = customerById(o.customerId);
    const progress = itemsProgress(o);

    const rowsHtml = progress.map((p,idx)=>`
      <div class="field">
        <label>${escapeHtml(p.type)} — المتبقي: ${p.remaining} من ${p.total}${p.delivered?` (اتسلّم ${p.delivered} قبل كده)`:''}</label>
        <input type="number" min="0" max="${p.remaining}" value="0" id="pd_qty_${idx}" ${p.remaining===0?'disabled':''}>
      </div>
    `).join('');

    const historyHtml = (o.deliveries||[]).length ? `
      <div class="meta" style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--card-alt);">📜 تسليمات سابقة:</div>
      ${o.deliveries.slice().reverse().map(d=>`
        <div class="meta">• ${fmtDate(d.date)} — ${d.items.map(x=>`${x.qty} ${escapeHtml(x.type)}`).join('، ')}${d.note?` (${escapeHtml(d.note)})`:''}</div>
      `).join('')}
    ` : '';

    const html = `
      <div class="modal-head"><h3>📦 تسليم جزئي — ${c?escapeHtml(c.name):'عميل محذوف'}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
      <div class="meta" style="margin-bottom:8px;">حدد كام قطعة بتتسلّم دلوقتي من كل صنف. الباقي هيفضل الطلب شغال لحد ما يتسلّم بعدين.</div>
      ${rowsHtml}
      <div class="field"><label>ملاحظة (اختياري)</label><input id="pd_note" placeholder="مثال: العميل هياخد الباقي الأسبوع الجاي"></div>
      <button class="btn" onclick="submitPartialDelivery('${orderId}')">✅ تسجيل التسليم</button>
      ${historyHtml}
    `;
    openModal(html);
  };

  window.submitPartialDelivery = function(orderId){
    const o = db.orders.find(x=>x.id===orderId);
    if(!o) return;
    ensureDeliveries(o);
    const progress = itemsProgress(o);
    const deliverNow = [];
    progress.forEach((p, idx)=>{
      const el = document.getElementById('pd_qty_'+idx);
      const qty = Math.max(0, Math.min(p.remaining, Math.floor(Number(el && el.value)||0)));
      if(qty>0) deliverNow.push({type:p.type, qty});
    });
    if(!deliverNow.length){ toast('حدد كمية أكبر من صفر لصنف واحد على الأقل'); return; }

    const noteEl = document.getElementById('pd_note');
    const note = noteEl ? noteEl.value.trim() : '';
    o.deliveries.push({id:uid(), date:todayStr(), items:deliverNow, note});
    o.updatedAt = Date.now();

    const c = customerById(o.customerId);
    logActivity(`📦 تسليم جزئي لطلب ${c?c.name:''} (${deliverNow.map(x=>x.qty+' × '+x.type).join('، ')})`);
    saveDB();
    closeModal();

    // لو كل الأصناف خلصت، اقفل الطلب تلقائي بنفس آلية التسليم الكامل العادية
    const newProgress = itemsProgress(o);
    const allDone = newProgress.every(p=>p.remaining<=0);
    if(allDone){
      markOrderDelivered(orderId);
      toast('✅ اكتمل تسليم الطلب بالكامل');
    } else {
      toast('📦 اتسجل التسليم الجزئي');
      renderOrders();
    }
  };

  /* ---------- تحسين كروت الطلبات: بادج + زرار ---------- */

  function badgeHtml(o){
    const delivered = totalDeliveredQty(o);
    const total = totalQty(o);
    return `<span class="badge" style="background:color-mix(in srgb, var(--accent) 20%, transparent);color:var(--accent);" title="تسليم جزئي">📦 ${delivered}/${total} اتسلّموا</span>`;
  }

  function enhanceOrderCards(){
    const list = document.getElementById('ordersList');
    if(!list) return;
    list.querySelectorAll('.card[data-order-id]').forEach(card=>{
      const id = card.getAttribute('data-order-id');
      const o = db.orders.find(x=>x.id===id);
      if(!o) return;

      const badgeHolder = card.querySelector('.row > div:last-child');
      if(badgeHolder && !badgeHolder.querySelector('.partial-badge') && hasPartialProgress(o)){
        badgeHolder.insertAdjacentHTML('beforeend', `<span class="partial-badge">${badgeHtml(o)}</span>`);
      }

      const row = card.querySelector('.btn-row');
      if(row && !row.querySelector('.partial-delivery-btn') && isEligibleForPartial(o)){
        const btn = document.createElement('button');
        btn.className = 'btn sm outline partial-delivery-btn';
        btn.textContent = '📦 تسليم جزئي';
        btn.setAttribute('onclick', `openPartialDeliveryModal('${o.id}')`);
        row.insertBefore(btn, row.children[1] || null);
      }
    });
  }

  function hookRenderOrders(){
    if(typeof window.renderOrders !== 'function') return;
    const orig = window.renderOrders;
    window.renderOrders = function(){
      const r = orig.apply(this, arguments);
      enhanceOrderCards();
      return r;
    };
  }

  function boot(){
    hookRenderOrders();
    if(document.getElementById('ordersList')) enhanceOrderCards();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
