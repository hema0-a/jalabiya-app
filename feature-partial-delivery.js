/* ============================================================
   feature-partial-delivery.js
   📦 تسليم جزئي — لو الطلب فيه أكتر من قطعة (مثلاً 3 جلاليب)
   والعميل استلم قطعة أو اتنين بس دلوقتي، تسجّل الجزء ده بدل ما
   تستنى كل القطع تخلص عشان تعلّم الطلب "تم التسليم".
   لما آخر قطعة متبقية تتسلّم، الطلب بيتحوّل تلقائي لـ"تم
   التسليم" (وبيشغّل شاشة التوقيع لو موجودة عندك بالفعل).
   ملف مستقل، بيلف renderOrders الموجود ومش بيلمس أي ملف تاني.
   ============================================================ */
(function(){

  function orderTotalQty(o){
    return Array.isArray(o.items) ? o.items.reduce((a,it)=>a+(Number(it.qty)||1),0) : 1;
  }

  function orderDeliveredQty(o){
    return Array.isArray(o.deliveries) ? o.deliveries.reduce((s,d)=>s+(Number(d.qty)||0),0) : 0;
  }

  function ensureDeliveriesArr(o){
    if(!Array.isArray(o.deliveries)) o.deliveries = [];
  }

  /* ---------- شاشة تسجيل تسليم جزئي ---------- */
  window.openPartialDeliveryModal = function(orderId){
    const o = (db.orders||[]).find(x=>x.id===orderId);
    if(!o) return;
    ensureDeliveriesArr(o);
    const total = orderTotalQty(o);
    const delivered = orderDeliveredQty(o);
    const remaining = total - delivered;
    if(remaining<=0) return;

    const historyHtml = o.deliveries.length ? o.deliveries.map(d=>`
      <div class="meta">📦 ${fmtDate(d.date)} — اتسلّم ${d.qty} قطعة${d.note?` (${escapeHtml(d.note)})`:''}</div>
    `).join('') : '';

    const html = `
      <h3>📦 تسليم جزئي</h3>
      <div class="meta">اتسلّم لحد دلوقتي ${delivered} من ${total} قطعة — باقي ${remaining}</div>
      ${historyHtml ? `<div style="margin-top:6px;">${historyHtml}</div>` : ''}
      <div class="field" style="margin-top:8px;"><label>عدد القطع المُستلَمة دلوقتي</label><input id="pd_qty" type="number" min="1" max="${remaining}" value="1"></div>
      <div class="field"><label>ملاحظة (اختياري)</label><input id="pd_note" type="text" placeholder="مثال: استلم القطعتين البيج والأزرق"></div>
      <button class="btn accent" onclick="confirmPartialDelivery('${o.id}')">✅ تسجيل التسليم</button>
    `;
    openModal(html);
  };

  window.confirmPartialDelivery = function(orderId){
    const o = (db.orders||[]).find(x=>x.id===orderId);
    if(!o) return;
    ensureDeliveriesArr(o);
    const total = orderTotalQty(o);
    const deliveredSoFar = orderDeliveredQty(o);
    const remaining = total - deliveredSoFar;
    const qty = Math.round(Number(document.getElementById('pd_qty').value))||0;
    const note = document.getElementById('pd_note').value.trim();
    if(qty<=0 || qty>remaining){ toast(`أدخل رقم صحيح بين 1 و${remaining}`); return; }

    o.deliveries.push({id:uid(), date:todayStr(), qty, note});
    saveDB();
    closeModal();

    const newRemaining = remaining - qty;
    if(newRemaining<=0){
      toast('✅ اتسلّمت كل القطع — هيتسجّل الطلب كمُنجز بالكامل');
      if(typeof markOrderDelivered==='function') markOrderDelivered(orderId);
    } else {
      toast(`✅ اتسجّل تسليم ${qty} قطعة — باقي ${newRemaining}`);
      if(typeof renderOrders==='function') renderOrders();
    }
  };

  /* ---------- زرار + شارة على كارت الطلب ---------- */
  if(typeof renderOrders === 'function'){
    const origRenderOrders = renderOrders;
    window.renderOrders = function(){
      const r = origRenderOrders.apply(this, arguments);
      document.querySelectorAll('#ordersList .card').forEach(function(card){
        if(card.querySelector('.partial-btn-added')) return;
        const btn = card.querySelector('button[onclick^="openOrderModal("]');
        if(!btn) return;
        const m = btn.getAttribute('onclick').match(/openOrderModal\('([^']+)'\)/);
        if(!m) return;
        const o = db.orders.find(x=>x.id===m[1]);
        if(!o || o.status==='تم التسليم') return;
        const total = orderTotalQty(o);
        if(total<=1) return; // مفيش معنى لتسليم جزئي لقطعة واحدة
        const delivered = orderDeliveredQty(o);
        const remaining = total-delivered;
        if(remaining<=0) return;

        if(delivered>0){
          const badge = document.createElement('div');
          badge.className = 'meta partial-badge-added';
          badge.textContent = `📦 اتسلّم ${delivered} من ${total} — باقي ${remaining}`;
          const firstMeta = card.querySelector('.meta');
          if(firstMeta) firstMeta.insertAdjacentElement('afterend', badge);
        }

        const btnRow = card.querySelector('.btn-row');
        if(!btnRow) return;
        const pdBtn = document.createElement('button');
        pdBtn.className = 'btn sm outline partial-btn-added';
        pdBtn.textContent = '📦 تسليم جزئي';
        pdBtn.onclick = function(){ openPartialDeliveryModal(o.id); };
        btnRow.appendChild(pdBtn);
      });
      return r;
    };
  }
})();
