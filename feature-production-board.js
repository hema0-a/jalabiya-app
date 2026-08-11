/* ============================================================
   feature-production-board.js
   المرحلة الأخيرة من التحديث الشامل — لوحة إنتاج واحدة في
   الصفحة الرئيسية بتجمع في نظرة واحدة:
     • الشغل الجاري موزّع على كل عامل (كام قطعة عنده دلوقتي)
     • الطلبات اللي لسه من غير عامل مسئول (تنبيه لتوزيعها)
     • حالة رصيد المخزون
     • عدد الطلبات المتأخرة والجاهزة للتسليم
   ملف مستقل، بيحقن الويدجت بتاعه في الصفحة الرئيسية ومش بيلمس
   core.js ولا patches.js ولا أي ملف تاني من ملفات الميزات —
   بيقرأ بس من db.orders / db.workers / db.inventoryValue اللي
   feature-workers.js و feature-inventory.js أنشأوها.
   ============================================================ */
(function(){

  function activeOrders(){
    return (db.orders||[]).filter(o=>o.status!=='تم التسليم');
  }

  function orderPiecesCount(o){
    return Array.isArray(o.items) ? o.items.reduce((a,it)=>a+(Number(it.qty)||1),0) : 1;
  }

  function buildBoardData(){
    const orders = activeOrders();
    const workers = (db.workers||[]).filter(w=>w.active!==false);
    const byWorker = workers.map(w=>{
      const wOrders = orders.filter(o=>o.assignedWorkerId===w.id);
      const pieces = wOrders.reduce((s,o)=>s+orderPiecesCount(o),0);
      return {worker:w, count:wOrders.length, pieces};
    });
    const unassigned = orders.filter(o=>!o.assignedWorkerId);
    const overdue = orders.filter(o=> typeof isOverdue==='function' && isOverdue(o));
    const readyToDeliver = orders.filter(o=>o.status==='جاهز للتسليم');
    const inventoryValue = typeof db.inventoryValue==='number' ? db.inventoryValue : null;
    return {byWorker, unassigned, overdue, readyToDeliver, inventoryValue, totalActive:orders.length};
  }

  function renderProductionBoard(){
    const box = document.getElementById('productionBoardBody');
    if(!box) return;
    const d = buildBoardData();
    if(!d.totalActive){
      box.innerHTML = '<div class="empty-msg">مفيش طلبات قيد الشغل دلوقتي 🎉</div>';
      return;
    }

    const workerRows = d.byWorker.length ? d.byWorker.map(x=>{
      return `<div class="row" style="padding:6px 0;border-bottom:1px dashed var(--stitch);">
        <span>👷 ${escapeHtml(x.worker.name)}</span>
        <b>${x.count} طلب — ${x.pieces} قطعة</b>
      </div>`;
    }).join('') : '<div class="meta">لا يوجد عمال نشطين مسجلين — أضفهم من صفحة "العمال"</div>';

    const unassignedHtml = d.unassigned.length ? `
      <div class="alert-banner warn" style="margin-top:8px;">
        <span class="ic">⚠️</span>
        <div><b>${d.unassigned.length} طلب من غير عامل مسئول</b>وزّعهم من صفحة "الطلبات" عشان يدخلوا في حساب المستحقات
          <div class="btn-row" style="margin-top:6px;"><button class="btn sm outline" onclick="showPage('orders')">📋 روح للطلبات</button></div>
        </div>
      </div>` : '';

    const inventoryLine = d.inventoryValue!=null ? `
      <div class="meta" style="margin-top:8px;">📦 رصيد المخزون الحالي: <b style="color:${d.inventoryValue<0?'var(--danger)':'var(--primary)'};">${Math.round(d.inventoryValue).toLocaleString('ar-EG')} ج.م</b>${d.inventoryValue<0?' ⚠️ سالب':''}</div>
    ` : '';

    box.innerHTML = `
      <div class="grid-cards" style="margin-bottom:8px;">
        <div class="stat-card"><div class="stat-ic">🧵</div><div><div class="num">${d.totalActive}</div><div class="lbl">قيد الشغل</div></div></div>
        <div class="stat-card ${d.overdue.length?'danger':''}"><div class="stat-ic">⏰</div><div><div class="num">${d.overdue.length}</div><div class="lbl">متأخرة</div></div></div>
        <div class="stat-card"><div class="stat-ic">✅</div><div><div class="num">${d.readyToDeliver.length}</div><div class="lbl">جاهزة للتسليم</div></div></div>
      </div>
      <div class="meta" style="font-weight:700;margin-bottom:2px;">توزيع الشغل على العمال:</div>
      ${workerRows}
      ${unassignedHtml}
      ${inventoryLine}
    `;
  }

  function injectBoard(){
    if(document.getElementById('widget-production')) return;
    const container = document.getElementById('homeWidgetsContainer');
    const alertsWidget = document.getElementById('widget-alerts');
    if(!container) return;
    const widget = document.createElement('div');
    widget.id = 'widget-production';
    widget.className = 'home-widget';
    widget.innerHTML = `
      <div class="section-title">🏭 لوحة الإنتاج</div>
      <div class="card" id="productionBoardBody"></div>
    `;
    if(alertsWidget) alertsWidget.insertAdjacentElement('afterend', widget);
    else container.insertBefore(widget, container.firstChild);
  }

  if(typeof renderHome === 'function'){
    const origRenderHome = renderHome;
    window.renderHome = function(){
      const r = origRenderHome.apply(this, arguments);
      injectBoard();
      renderProductionBoard();
      return r;
    };
  }

  document.addEventListener('DOMContentLoaded', function(){
    injectBoard();
    renderProductionBoard();
  });
})();
