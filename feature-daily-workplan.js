/* ============================================================
   feature-daily-workplan.js
   المشكلة اللي بيحلها: "مطلوب اليوم" الحالي بيوري بس الطلبات
   المتأخرة أو اللي معادها النهاردة بالظبط — فالطلب بيفضل مش
   ظاهر خالص لحد آخر يوم، وبعدين يظهر فجأة "مطلوب" من غير ما
   يكون قدامك وقت تشتغل عليه بالراحة.

   الحل: "🗓️ خطة الشغل اليومي" — كارت جديد بيوري كل الطلبات
   الجارية (اللي لسه ما اتسلّمتش) مرتبة من الأقرب ميعاد للأبعد،
   من أول يوم استلامها، مقسّمة لمجموعات حسب قرب الميعاد
   (متأخر / النهاردة / بكرة / خلال الأسبوع / وقت مستريح)، عشان
   تقدر تختار تشتغل على أي طلب بدري من غير ما تستنى يوم التسليم.
   ملف مستقل، مش بيلمس أي ملف تاني — بيضيف كارت جديد في الرئيسية.
   ============================================================ */
(function(){

  function daysUntil(dateStr){
    if(!dateStr) return null;
    const today = new Date(todayStr());
    const target = new Date(dateStr);
    return Math.round((target-today)/86400000);
  }

  function orderPiecesCount(o){
    return Array.isArray(o.items) ? o.items.reduce((a,it)=>a+(Number(it.qty)||1),0) : 1;
  }

  function urgencyBucket(days){
    if(days==null) return {key:'nodate', label:'📋 من غير ميعاد تسليم محدد', order:5};
    if(days<0) return {key:'late', label:'🔴 متأخرة فعلاً', order:0};
    if(days===0) return {key:'today', label:'🟠 معادها النهاردة', order:1};
    if(days===1) return {key:'tomorrow', label:'🟡 معادها بكرة', order:2};
    if(days<=7) return {key:'week', label:'🟢 خلال الأسبوع ده — وقتك مريح لسه', order:3};
    return {key:'later', label:'🔵 وقت مستريح جدًا — ابدأ فيها بدري لو فاضي', order:4};
  }

  function buildWorkplan(){
    const active = (db.orders||[]).filter(o=>o.status!=='تم التسليم');
    const buckets = {};
    active.forEach(o=>{
      const days = daysUntil(o.dateDelivery);
      const b = urgencyBucket(days);
      if(!buckets[b.key]) buckets[b.key] = {label:b.label, order:b.order, items:[]};
      buckets[b.key].items.push({o, days});
    });
    Object.values(buckets).forEach(b=>{
      b.items.sort((a,b2)=> (a.days==null?999:a.days) - (b2.days==null?999:b2.days));
    });
    return Object.values(buckets).sort((a,b)=>a.order-b.order);
  }

  function renderDailyWorkplan(){
    const box = document.getElementById('dailyWorkplanBody');
    if(!box) return;
    const groups = buildWorkplan();
    if(!groups.length){
      box.innerHTML = `<div class="empty-msg">مفيش طلبات جارية دلوقتي 🎉</div>`;
      return;
    }
    box.innerHTML = groups.map((g, idx)=>{
      const rows = g.items.map(({o, days})=>{
        const c = typeof customerById==='function' ? customerById(o.customerId) : null;
        const worker = (o.assignedWorkerId && Array.isArray(db.workers)) ? db.workers.find(w=>w.id===o.assignedWorkerId) : null;
        const dayTxt = days==null ? 'من غير ميعاد' : (days<0 ? `متأخر ${Math.abs(days)} يوم` : days===0 ? 'النهاردة' : days===1 ? 'بكرة' : `باقي ${days} يوم`);
        return `
          <div class="card" style="margin-top:6px;" onclick="openOrderModal('${o.id}')">
            <div class="row"><h3>${c?escapeHtml(c.name):'عميل'}</h3><b>${dayTxt}</b></div>
            <div class="meta">${orderPiecesCount(o)} قطعة${worker?` — 👷 ${escapeHtml(worker.name)}`:' — 👷 بدون عامل مسند'} — ${escapeHtml(o.status||'')}</div>
          </div>
        `;
      }).join('');
      return `
        <details class="card" style="padding:10px 12px;margin-top:8px;" ${idx<2 ? 'open' : ''}>
          <summary style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;">
            <span>${g.label}</span>
            <b>${g.items.length} طلب</b>
          </summary>
          ${rows}
        </details>
      `;
    }).join('');
  }

  function injectWorkplanCard(){
    if(document.getElementById('widget-daily-workplan')) return;
    const container = document.getElementById('homeWidgetsContainer');
    if(!container) return;
    const focusWidget = document.getElementById('widget-today-focus');
    const wrap = document.createElement('div');
    wrap.id = 'widget-daily-workplan';
    wrap.className = 'home-widget';
    wrap.innerHTML = `
      <div class="section-title">🗓️ خطة الشغل اليومي</div>
      <div class="meta" style="margin-bottom:6px;">كل الطلبات الجارية، من أول يوم استلامها — عشان تشتغل عليها بدري وماتستناش يوم التسليم</div>
      <div id="dailyWorkplanBody"></div>
    `;
    if(focusWidget) focusWidget.insertAdjacentElement('afterend', wrap);
    else container.insertBefore(wrap, container.firstChild);
  }

  if(typeof renderHome === 'function'){
    const origRenderHome = renderHome;
    window.renderHome = function(){
      const r = origRenderHome.apply(this, arguments);
      injectWorkplanCard();
      renderDailyWorkplan();
      return r;
    };
  }

  document.addEventListener('DOMContentLoaded', function(){
    injectWorkplanCard();
    renderDailyWorkplan();
  });
})();
