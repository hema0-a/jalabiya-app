/* ============================================================
   feature-whatif-simulator.js
   بطاقة "🔮 محاكي ماذا لو" — تُضاف داخل صفحة "📊 نظرة مالية شاملة"
   (خيار الدمج، مش صفحة/زر مستقل). ملف مستقل مش بيلمس أي ملف
   تاني، بيحقن حاويته بعد #dailyTipCard (أو بعد #financialOverviewBody
   لو feature-daily-tips.js مش موجود) ويلف renderFinancialOverviewPage.

   السيناريوهات (بتقرا بيانات حقيقية من db بس متعملش أي تعديل
   عليها — كله حسابات مؤقتة في الذاكرة بس):
   1) زيادة/نقصان الدخل اليومي من الورشة
   2) إضافة التزام شهري جديد (قسط، اشتراك...)
   3) تقليل مصروف البيت بنسبة معينة
   4) أخذ تمويل/قرض (مبلغ + عدد شهور) وتأثيره على الاحتياج اليومي
   ============================================================ */
(function(){

  const SCENARIOS = {
    income: {label:'💰 تغيّر الدخل اليومي من الورشة', inputs:[
      {id:'sc_incomeDelta', label:'التغيّر في الدخل اليومي (ج.م) — بالسالب لو نقصان', type:'number', placeholder:'مثال: 100 أو -50'}
    ]},
    newCommit: {label:'➕ إضافة التزام شهري جديد', inputs:[
      {id:'sc_commitAmount', label:'قيمة الالتزام شهريًا (ج.م)', type:'number', placeholder:'مثال: 300'}
    ]},
    houseCut: {label:'🏠 تقليل مصروف البيت', inputs:[
      {id:'sc_houseCutPct', label:'نسبة التقليل (%)', type:'number', placeholder:'مثال: 20'}
    ]},
    loan: {label:'🏦 أخذ تمويل / قرض جديد', inputs:[
      {id:'sc_loanAmount', label:'مبلغ التمويل (ج.م)', type:'number', placeholder:'مثال: 6000'},
      {id:'sc_loanMonths', label:'عدد شهور السداد', type:'number', placeholder:'مثال: 12'}
    ]}
  };

  function currentReq(){
    try{ return calcRequiredDailyCapacity(); }catch(e){ return null; }
  }

  function fmt(n){ return Math.round(n).toLocaleString('ar-EG'); }

  function computeScenario(key){
    const r = currentReq();
    if(!r) return null;
    const currentCapacity = Number(db.dailyCapacity)||0;
    let newTotal = r.total;
    let note = '';

    if(key==='income'){
      const delta = Number(document.getElementById('sc_incomeDelta')?.value)||0;
      const newCapacity = currentCapacity + delta;
      const diffBefore = r.total - currentCapacity;
      const diffAfter = r.total - newCapacity;
      return {
        beforeLabel:'دخلك اليومي الحالي', beforeVal:currentCapacity,
        afterLabel:'دخلك اليومي بعد التغيير', afterVal:newCapacity,
        extraLine:`احتياجك اليومي الثابت (${fmt(r.total)} ج.م) هيفضل زي ما هو. ${diffAfter<=0?'هتغطي احتياجك بالكامل ويفضل معاك فائض.':`هيفضل عليك نقص قدره ${fmt(Math.abs(diffAfter))} ج.م يوميًا.`}`,
        good: diffAfter<=0
      };
    }

    if(key==='newCommit'){
      const amount = Number(document.getElementById('sc_commitAmount')?.value)||0;
      const newMonthlyCommitments = r.monthlyCommitments + amount;
      const newCommitmentsPerDay = (newMonthlyCommitments + r.loanMonthly) / r.wdays;
      newTotal = newCommitmentsPerDay + r.housePerDay;
      return {
        beforeLabel:'احتياجك اليومي الحالي', beforeVal:r.total,
        afterLabel:'احتياجك اليومي بعد الالتزام الجديد', afterVal:newTotal,
        extraLine:`ده هيزوّد احتياجك اليومي بحوالي ${fmt(newTotal-r.total)} ج.م. دخلك الحالي (${fmt(currentCapacity)} ج.م) ${newTotal>currentCapacity?'مش هيكفي — هيبقى عليك عجز يومي.':'لسه كافي.'}`,
        good: newTotal<=currentCapacity
      };
    }

    if(key==='houseCut'){
      const pct = Math.min(100, Math.max(0, Number(document.getElementById('sc_houseCutPct')?.value)||0));
      const newHouseTotal = r.houseTotal * (1-pct/100);
      const newHousePerDay = newHouseTotal/30;
      newTotal = r.commitmentsPerDay + newHousePerDay;
      const monthlySavings = r.houseTotal - newHouseTotal;
      return {
        beforeLabel:'احتياجك اليومي الحالي', beforeVal:r.total,
        afterLabel:'احتياجك اليومي بعد التقليل', afterVal:newTotal,
        extraLine:`ده هيوفرلك حوالي ${fmt(monthlySavings)} ج.م في الشهر (${fmt(monthlySavings*12)} ج.م في السنة).`,
        good: true
      };
    }

    if(key==='loan'){
      const amount = Number(document.getElementById('sc_loanAmount')?.value)||0;
      const months = Math.max(1, Number(document.getElementById('sc_loanMonths')?.value)||1);
      const monthly = amount/months;
      const newMonthlyCommitments = r.monthlyCommitments + monthly;
      const newCommitmentsPerDay = (newMonthlyCommitments + r.loanMonthly) / r.wdays;
      newTotal = newCommitmentsPerDay + r.housePerDay;
      return {
        beforeLabel:'احتياجك اليومي الحالي', beforeVal:r.total,
        afterLabel:'احتياجك اليومي بعد القسط', afterVal:newTotal,
        extraLine:`القسط الشهري هيكون حوالي ${fmt(monthly)} ج.م. دخلك الحالي (${fmt(currentCapacity)} ج.م) ${newTotal>currentCapacity?'مش هيكفي مع القسط ده — فكّر تاني قبل ما تاخده.':'لسه كافي حتى مع القسط ده.'}`,
        good: newTotal<=currentCapacity
      };
    }
    return null;
  }

  function renderInputs(key){
    const s = SCENARIOS[key];
    if(!s) return '';
    return s.inputs.map(i=>`
      <div class="field"><label>${i.label}</label><input id="${i.id}" type="${i.type}" placeholder="${i.placeholder||''}"></div>
    `).join('');
  }

  window.onWhatifScenarioChange = function(){
    const key = document.getElementById('whatifScenarioSelect')?.value;
    const box = document.getElementById('whatifInputsBox');
    const result = document.getElementById('whatifResultBox');
    if(box) box.innerHTML = renderInputs(key);
    if(result) result.innerHTML = '';
  };

  window.runWhatifSimulation = function(){
    const key = document.getElementById('whatifScenarioSelect')?.value;
    const result = document.getElementById('whatifResultBox');
    if(!result) return;
    const r = computeScenario(key);
    if(!r){
      result.innerHTML = `<div class="empty-msg">محتاج تسجّل بيانات ماليتك (التزامات / مصروف بيت / دخل يومي) الأول عشان المحاكي يقدر يحسب.</div>`;
      return;
    }
    const maxVal = Math.max(r.beforeVal, r.afterVal, 1);
    const beforePct = Math.max(2, Math.round((Math.max(0,r.beforeVal)/maxVal)*100));
    const afterPct = Math.max(2, Math.round((Math.max(0,r.afterVal)/maxVal)*100));
    result.innerHTML = `
      <div class="card" style="margin-top:8px;${r.good?'':'border-right:4px solid var(--danger);'}">
        <div class="meta">${r.beforeLabel}</div>
        <div style="position:relative;height:14px;border-radius:99px;background:var(--card-alt);overflow:hidden;margin:4px 0 8px;">
          <div style="position:absolute;inset-inline-start:0;top:0;bottom:0;width:${beforePct}%;background:var(--text);opacity:.35;border-radius:99px;"></div>
        </div>
        <div class="row"><span class="meta">قبل</span><b>${fmt(r.beforeVal)} ج.م</b></div>
        <div class="meta" style="margin-top:8px;">${r.afterLabel}</div>
        <div style="position:relative;height:14px;border-radius:99px;background:var(--card-alt);overflow:hidden;margin:4px 0 8px;">
          <div style="position:absolute;inset-inline-start:0;top:0;bottom:0;width:${afterPct}%;background:${r.good?'var(--primary)':'var(--danger)'};border-radius:99px;"></div>
        </div>
        <div class="row"><span class="meta">بعد</span><b style="color:${r.good?'var(--primary)':'var(--danger)'};">${fmt(r.afterVal)} ج.م</b></div>
        <div class="meta" style="margin-top:8px;line-height:1.8;">${r.extraLine}</div>
      </div>
    `;
  };

  function renderWhatifCard(){
    const box = document.getElementById('whatifSimulatorCard');
    if(!box) return;
    const currentKey = document.getElementById('whatifScenarioSelect')?.value || 'income';
    const optionsHtml = Object.keys(SCENARIOS).map(k=>`<option value="${k}" ${k===currentKey?'selected':''}>${SCENARIOS[k].label}</option>`).join('');
    box.innerHTML = `
      <div class="card">
        <div class="row"><h3>🔮 محاكي "ماذا لو"</h3></div>
        <div class="meta" style="margin-bottom:6px;">جرّب سيناريو مالي قبل ما تقرر فعليًا — الأرقام هنا تقديرية بس ومبنية على بياناتك الحالية.</div>
        <div class="field"><label>اختر السيناريو</label>
          <select id="whatifScenarioSelect" onchange="onWhatifScenarioChange()">${optionsHtml}</select>
        </div>
        <div id="whatifInputsBox">${renderInputs(currentKey)}</div>
        <button class="btn sm outline" onclick="runWhatifSimulation()">🧮 احسب التأثير</button>
        <div id="whatifResultBox"></div>
      </div>
    `;
  }

  function injectContainer(){
    if(document.getElementById('whatifSimulatorCard')) return;
    const afterTip = document.getElementById('dailyTipCard');
    const anchor = afterTip || document.getElementById('financialOverviewBody');
    if(!anchor) return;
    const div = document.createElement('div');
    div.id = 'whatifSimulatorCard';
    div.style.marginTop = '8px';
    anchor.insertAdjacentElement('afterend', div);
  }

  function hookRender(){
    if(typeof window.renderFinancialOverviewPage === 'function'){
      const orig = window.renderFinancialOverviewPage;
      window.renderFinancialOverviewPage = function(){
        const r = orig.apply(this, arguments);
        // متعملش إعادة رسم كاملة لو المستخدم شغّال في الأدخالات دلوقتي، بس أول مرة لازم تتحقن
        if(!document.getElementById('whatifSimulatorCard')) injectContainer();
        if(!document.getElementById('whatifScenarioSelect')) renderWhatifCard();
        return r;
      };
    }
  }

  function boot(){
    injectContainer();
    renderWhatifCard();
    hookRender();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
