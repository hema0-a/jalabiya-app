/* ============================================================
   feature-financial-overview.js
   صفحة جديدة "📊 نظرة مالية شاملة" تجمع:
   1) 💎 مؤشر صافي الثروة: صندوق الطوارئ + إجمالي جيوب الاستثمار
      + رصيد المخزون − إجمالي الأقساط المتبقية (الديون).
   2) 📐 نسبة كل جيب استثمار من صافي ربح السنة (تقديري: إجمالي
      المقبوضات هذا العام − تكلفة الخامة − مستحقات العمال).
   3) 📈 Sparkline لصافي الثروة عبر الشهور (لقطة شهرية تراكمية).
   ملف مستقل، بيتحمّل آخر واحد بعد feature-investment-plan.js
   و feature-inventory.js و feature-workers.js عشان يقرا من
   بياناتهم. مش بيلمس أي ملف تاني.
   ============================================================ */
(function(){

  function totalRemainingDebt(){
    return (db.commitments||[]).filter(c=>c.active!==false && c.type==='قسط' && c.remainingMonths!=null && c.remainingMonths>0)
      .reduce((s,c)=>s+Number(c.amount)*c.remainingMonths, 0);
  }

  function investmentBucketsTotal(){
    return (db.investmentBuckets||[]).reduce((s,b)=>s+Number(b.balance||0), 0);
  }

  function netWorth(){
    const emergency = Number(db.emergencyFundBalance||0);
    const inv = investmentBucketsTotal();
    const inventory = typeof db.inventoryValue==='number' ? db.inventoryValue : 0;
    const debt = totalRemainingDebt();
    return emergency + inv + inventory - debt;
  }

  function netProfitThisYear(){
    const year = todayStr().slice(0,4);
    const income = (db.payments||[]).filter(p=>p.date && p.date.slice(0,4)===year).reduce((s,p)=>s+Number(p.amount||0),0);
    const materialCosts = (db.orders||[]).filter(o=>o.dateReceived && o.dateReceived.slice(0,4)===year).reduce((s,o)=>s+Number(o.materialCost||0),0);
    const workerPay = (db.workerPayments||[]).filter(p=>p.date && p.date.slice(0,4)===year).reduce((s,p)=>s+Number(p.amount||0),0);
    return Math.max(0, income - materialCosts - workerPay);
  }

  function upsertNetWorthHistory(){
    if(!Array.isArray(db.netWorthHistory)) db.netWorthHistory = [];
    const ym = currentYM();
    const val = netWorth();
    const entry = db.netWorthHistory.find(h=>h.ym===ym);
    if(entry) entry.value = val;
    else db.netWorthHistory.push({ym, value:val});
    if(db.netWorthHistory.length>24) db.netWorthHistory = db.netWorthHistory.slice(-24);
    saveDB();
    return val;
  }

  function sparklineSvg(values, color){
    if(!values || values.length<2) return '';
    const min = Math.min(...values), max = Math.max(...values);
    const range = (max-min) || 1;
    const w = 200, h = 40, step = w/(values.length-1);
    const points = values.map((v,i)=> `${(i*step).toFixed(1)},${(h - ((v-min)/range)*h).toFixed(1)}`).join(' ');
    return `<svg width="${w}" height="${h}" style="display:block;margin-top:6px;"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="2.5"/></svg>`;
  }

  window.renderFinancialOverviewPage = function(){
    const box = document.getElementById('financialOverviewBody');
    if(!box) return;
    const nw = upsertNetWorthHistory();
    const history = (db.netWorthHistory||[]).map(h=>h.value);
    const profitYear = netProfitThisYear();
    const debt = totalRemainingDebt();
    const inventory = typeof db.inventoryValue==='number' ? db.inventoryValue : 0;
    const emergency = Number(db.emergencyFundBalance||0);
    const invTotal = investmentBucketsTotal();

    const bucketsHtml = (db.investmentBuckets||[]).length ? (db.investmentBuckets||[]).map(b=>{
      const pctOfProfit = profitYear>0 ? Math.round((b.balance/profitYear)*100) : null;
      return `
        <div class="row" style="margin-bottom:6px;">
          <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${b.color||'var(--primary)'};margin-inline-end:6px;"></span>${escapeHtml(b.name)}</span>
          <span>${Math.round(b.balance).toLocaleString('ar-EG')} ج.م${pctOfProfit!=null?` <span class="meta">(${pctOfProfit}% من ربح السنة)</span>`:''}</span>
        </div>
      `;
    }).join('') : `<div class="empty-msg">لسه معندكش جيوب استثمار</div>`;

    box.innerHTML = `
      <div class="card">
        <div class="row"><h3>💎 صافي الثروة التقديري</h3><b style="font-size:20px;color:${nw>=0?'var(--primary)':'var(--danger)'};">${Math.round(nw).toLocaleString('ar-EG')} ج.م</b></div>
        ${sparklineSvg(history, nw>=0?'var(--primary)':'var(--danger)')}
        <div class="meta" style="margin-top:6px;">= صندوق الطوارئ (${Math.round(emergency).toLocaleString('ar-EG')}) + جيوب الاستثمار (${Math.round(invTotal).toLocaleString('ar-EG')}) + المخزون (${Math.round(inventory).toLocaleString('ar-EG')}) − الأقساط المتبقية (${Math.round(debt).toLocaleString('ar-EG')})</div>
      </div>
      <div class="card" style="margin-top:8px;">
        <h3>📐 جيوب الاستثمار مقابل ربح السنة</h3>
        <div class="meta" style="margin-bottom:6px;">صافي ربح السنة التقديري: ${Math.round(profitYear).toLocaleString('ar-EG')} ج.م (مقبوضات − تكلفة خامة − مستحقات عمال)</div>
        ${bucketsHtml}
      </div>
    `;
  };

  function injectOverviewPage(){
    if(document.getElementById('page-financial-overview')) return;
    const afterPage = document.getElementById('page-investment') || document.getElementById('page-workers') || document.getElementById('page-finance');
    if(!afterPage) return;
    const section = document.createElement('section');
    section.className = 'page';
    section.id = 'page-financial-overview';
    section.innerHTML = `
      <div class="section-title">📊 نظرة مالية شاملة</div>
      <div id="financialOverviewBody"></div>
    `;
    afterPage.insertAdjacentElement('afterend', section);

    const sidenav = document.getElementById('sideNav');
    if(sidenav && !sidenav.querySelector('[data-page="financial-overview"]')){
      const btn = document.createElement('button');
      btn.className = 'navbtn';
      btn.setAttribute('data-page','financial-overview');
      btn.setAttribute('onclick',"showPage('financial-overview');closeSideNav()");
      btn.innerHTML = '<span class="ic">📊</span>نظرة مالية شاملة';
      const invBtn = sidenav.querySelector('[data-page="investment"]');
      if(invBtn) invBtn.insertAdjacentElement('afterend', btn);
      else sidenav.appendChild(btn);
    }

    if(typeof pageTitles==='object') pageTitles['financial-overview'] = '📊 نظرة مالية شاملة';
    if(typeof fabPages==='object') fabPages['financial-overview'] = false;
  }

  if(typeof renderAll === 'function'){
    const origRenderAll = renderAll;
    window.renderAll = function(){
      const r = origRenderAll.apply(this, arguments);
      if(document.getElementById('page-financial-overview')) renderFinancialOverviewPage();
      return r;
    };
  }

  document.addEventListener('DOMContentLoaded', function(){
    injectOverviewPage();
  });
})();
