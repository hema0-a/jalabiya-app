/* ============================================================
   feature-expenses-filter-compare.js
   تكملة تحسينات مصاريف البيت:
   1) فلتر فوق القائمة: الكل / آخر 30 يوم / آخر 3 شهور — بيفلتر
      قائمة الأيام المعروضة بس (إجمالي "كل الوقت" في الأعلى
      بيفضل زي ما هو لأنه مؤشر تراكمي مقصود).
   2) كارت مقارنة "هذا الشهر مقابل اللي فات" لكل فئة مصروف،
      عشان تعرف فين بقيت بتصرف أكتر/أقل بسرعة.
   ملف مستقل، بيتحمّل بعد feature-topbar-and-expenses.js ومش
   بيلمس core.js ولا patches.js ولا الملف اللي قبله.

   ملحوظة: فكرة "بحث سريع داخل قائمة ⋮" اللي اتقالت كمثال
   للتوسع المستقبلي مش اتنفذت هنا — كانت إشارة لإمكانية لاحقة
   مش ميزة محددة المعالم (تبحث في إيه بالظبط؟)، فلو حابب حاجة
   بعينها زيها قولّي أعمل إيه بالظبط وهنفذها.
   ============================================================ */
(function(){

  let expensesFilterMode = 'all'; // all | 30d | 3m

  function filterExpensesByMode(all){
    if(expensesFilterMode==='all') return all;
    const today = new Date(todayStr());
    const cutoffDays = expensesFilterMode==='30d' ? 30 : 92;
    const cutoff = new Date(today.getTime() - cutoffDays*86400000);
    const cutoffStr = cutoff.toISOString().slice(0,10);
    return all.filter(e=>e.date>=cutoffStr);
  }

  function groupedFilteredHtml(){
    const all = (db.houseExpenses||[]).slice().sort((a,b)=>b.date.localeCompare(a.date));
    const filtered = filterExpensesByMode(all);
    if(!filtered.length) return `<div class="empty-msg">لا توجد مصاريف في النطاق ده</div>`;
    const groups = {};
    filtered.forEach(e=>{ (groups[e.date] = groups[e.date] || []).push(e); });
    const days = Object.keys(groups).sort((a,b)=>b.localeCompare(a));
    return days.map((d, idx)=>{
      const items = groups[d];
      const dayTotal = items.reduce((s,e)=>s+Number(e.amount||0), 0);
      const rows = items.map(e=>`
        <div class="card" style="margin-top:6px;">
          <div class="row"><h3>${escapeHtml(e.desc)}</h3><b style="color:var(--danger)">${Number(e.amount).toLocaleString('ar-EG')} ج.م</b></div>
          <div class="meta">${houseExpenseCategoryInfo(e.category).label}</div>
          <div class="btn-row"><button class="btn sm danger" onclick="deleteHouseExpense('${e.id}')">🗑️ حذف</button></div>
        </div>
      `).join('');
      return `
        <details class="card" style="padding:10px 12px;" ${idx===0 ? 'open' : ''}>
          <summary style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;">
            <span>📅 ${fmtDate(d)} <span class="meta">(${items.length} ${items.length===1?'مصروف':'مصاريف'})</span></span>
            <b style="color:var(--danger);">${dayTotal.toLocaleString('ar-EG')} ج.م</b>
          </summary>
          ${rows}
        </details>
      `;
    }).join('');
  }

  function renderFilterChips(){
    const anchor = document.getElementById('houseExpensesList');
    if(!anchor || document.getElementById('expensesFilterChips')) return;
    const chips = document.createElement('div');
    chips.id = 'expensesFilterChips';
    chips.className = 'btn-row';
    chips.style.cssText = 'flex-wrap:wrap;margin-bottom:8px;';
    chips.innerHTML = `
      <button class="btn sm outline" data-mode="all">📋 الكل</button>
      <button class="btn sm outline" data-mode="30d">🗓️ آخر 30 يوم</button>
      <button class="btn sm outline" data-mode="3m">📆 آخر 3 شهور</button>
    `;
    anchor.parentNode.insertBefore(chips, anchor);
    chips.querySelectorAll('button').forEach(btn=>{
      btn.addEventListener('click', function(){
        expensesFilterMode = this.dataset.mode;
        updateChipStyles();
        applyFilteredList();
      });
    });
    updateChipStyles();
  }

  function updateChipStyles(){
    const chips = document.getElementById('expensesFilterChips');
    if(!chips) return;
    chips.querySelectorAll('button').forEach(btn=>{
      const active = btn.dataset.mode===expensesFilterMode;
      btn.classList.toggle('accent', active);
      btn.classList.toggle('outline', !active);
    });
  }

  function applyFilteredList(){
    const box = document.getElementById('houseExpensesList');
    if(box) box.innerHTML = groupedFilteredHtml();
  }

  /* ---------- مقارنة شهرية بالفئة ---------- */
  function categoryTotalsForMonth(ym){
    const sums = {};
    (db.houseExpenses||[]).filter(e=>e.date.slice(0,7)===ym).forEach(e=>{
      const key = e.category || 'أخرى';
      sums[key] = (sums[key]||0) + Number(e.amount||0);
    });
    return sums;
  }

  function renderMonthlyCompare(){
    let box = document.getElementById('houseExpenseMonthlyCompare');
    if(!box){
      const anchorCard = document.getElementById('houseExpenseCategoryBreakdown');
      const parentCard = anchorCard ? anchorCard.closest('.card') : null;
      if(!parentCard) return;
      const card = document.createElement('div');
      card.className = 'card';
      card.style.cssText = 'margin-top:8px;';
      card.innerHTML = `<h3>📊 مقارنة الشهر بالشهر اللي فات</h3><div id="houseExpenseMonthlyCompare"></div>`;
      parentCard.insertAdjacentElement('afterend', card);
      box = document.getElementById('houseExpenseMonthlyCompare');
    }
    const thisYM = currentYM();
    const lastYM = addMonthsYM(thisYM, -1);
    const cur = categoryTotalsForMonth(thisYM);
    const prev = categoryTotalsForMonth(lastYM);
    const keys = Array.from(new Set([...Object.keys(cur), ...Object.keys(prev)]));
    if(!keys.length){
      box.innerHTML = `<div class="empty-msg">لا توجد بيانات كافية للمقارنة بعد</div>`;
      return;
    }
    keys.sort((a,b)=>(cur[b]||0)-(cur[a]||0));
    box.innerHTML = keys.map(key=>{
      const c = cur[key]||0, p = prev[key]||0;
      const diff = c - p;
      const info = houseExpenseCategoryInfo(key);
      const diffColor = diff>0 ? 'var(--danger)' : (diff<0 ? 'var(--primary)' : 'var(--muted)');
      const diffTxt = diff===0 ? 'زي الشهر اللي فات' : (diff>0 ? `+${Math.round(diff).toLocaleString('ar-EG')} عن اللي فات` : `${Math.round(diff).toLocaleString('ar-EG')} عن اللي فات`);
      return `
        <div class="row" style="margin-bottom:6px;">
          <span>${info.label}</span>
          <span style="text-align:left;">
            <b>${Math.round(c).toLocaleString('ar-EG')} ج.م</b>
            <span style="color:${diffColor};font-size:12px;display:block;">${diffTxt}</span>
          </span>
        </div>
      `;
    }).join('');
  }

  if(typeof renderHouseExpenses === 'function'){
    const origRenderHouseExpenses = renderHouseExpenses;
    window.renderHouseExpenses = function(){
      const r = origRenderHouseExpenses.apply(this, arguments);
      renderFilterChips();
      applyFilteredList();
      renderMonthlyCompare();
      return r;
    };
  }

  function boot(){
    if(document.getElementById('houseExpensesList') && typeof renderHouseExpenses==='function'){
      renderFilterChips();
      applyFilteredList();
      renderMonthlyCompare();
    }
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
