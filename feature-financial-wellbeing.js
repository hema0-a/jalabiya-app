/* ============================================================
   feature-financial-wellbeing.js
   خمس أفكار من ملف "تجميع أفكار الالتزامات الشخصية":
   1) 🎨 الميزانية الصامتة — لون خلفية خفيف في الصفحة الرئيسية
      يعكس وضعك المالي الحالي (أخضر/أصفر/أحمر) بهدوء من غير
      أرقام، بناءً على نفس منطق خط الأمان البصري.
   2) 🏆 تحدي شهري — هدف تلقائي "قلل مصروف البيت X% عن الشهر
      اللي فات" مع شريط تقدّم وشارة عند التحقيق.
   3) 🕵️ كشف التزام مستتر — لو نفس وصف مصروف البيت اتكرر بمبلغ
      متقارب في آخر 3 شهور، يقترح تحويله لالتزام ثابت.
   4) 📉 استراتيجية سداد الديون — ترتيب الأقساط بطريقة Snowball
      (الأصغر أولًا) أو Avalanche (الأعلى قسط شهري أولًا — بديل
      عملي لعدم وجود نسبة فايدة مسجّلة في التطبيق).
   5) 🔓 عدّاد التحرر من الالتزامات — "باقي كام شهر" على انتهاء
      كل الأقساط محددة المدة.
   ملف مستقل، بيتحمّل آخر واحد، مش بيلمس أي ملف تاني.
   ============================================================ */
(function(){

  /* ========== أدوات مشتركة ========== */
  function daysInMonth(ym){ const [y,m]=ym.split('-').map(Number); return new Date(y,m,0).getDate(); }

  function currentSafetyLevel(){
    let prog; try{ prog = monthlyCommitmentProgress(); }catch(e){ prog=null; }
    if(!prog) return null;
    const ym = todayStr().slice(0,7);
    const dayNum = Number(todayStr().slice(8,10));
    const expectedPct = Math.min(100, Math.round((dayNum/daysInMonth(ym))*100));
    if(prog.pct >= expectedPct) return 'safe';
    if(prog.pct >= expectedPct*0.7) return 'warn';
    return 'danger';
  }

  /* ========== 1) الميزانية الصامتة ========== */
  const moodCss = document.createElement('style');
  moodCss.textContent = `
    body.mood-safe{ background-image: radial-gradient(1400px 700px at 50% -15%, rgba(31,109,87,0.10), transparent 60%) !important; }
    body.mood-warn{ background-image: radial-gradient(1400px 700px at 50% -15%, rgba(184,134,59,0.13), transparent 60%) !important; }
    body.mood-danger{ background-image: radial-gradient(1400px 700px at 50% -15%, rgba(190,60,60,0.13), transparent 60%) !important; }
  `;
  document.head.appendChild(moodCss);

  function applyMood(){
    const level = currentSafetyLevel();
    document.body.classList.remove('mood-safe','mood-warn','mood-danger');
    if(level) document.body.classList.add('mood-'+level);
  }

  /* ========== 2) تحدي شهري ========== */
  function houseExpensesTotalForYM(ym){
    return (db.houseExpenses||[]).filter(e=>e.date.slice(0,7)===ym).reduce((s,e)=>s+Number(e.amount||0),0);
  }

  function challengeState(){
    if(typeof db.challengeTargetPct !== 'number') db.challengeTargetPct = 5;
    const thisYM = currentYM();
    const lastYM = addMonthsYM(thisYM, -1);
    const prevTotal = houseExpensesTotalForYM(lastYM);
    const curTotal = houseExpensesTotalForYM(thisYM);
    const targetAmount = prevTotal * (1 - db.challengeTargetPct/100);
    const dayNum = Number(todayStr().slice(8,10));
    const totalDays = daysInMonth(thisYM);
    const paceLimit = prevTotal ? (prevTotal*(1-db.challengeTargetPct/100)) * (dayNum/totalDays) : null;
    return {prevTotal, curTotal, targetAmount, achieved: prevTotal>0 && curTotal<=targetAmount, onPace: paceLimit==null || curTotal<=paceLimit, dayNum, totalDays};
  }

  function renderChallengeCard(){
    const box = document.getElementById('monthlyChallengeCard');
    if(!box) return;
    const s = challengeState();
    if(!s.prevTotal){
      box.innerHTML = `<div class="empty-msg">هيبدأ التحدي يظهر بعد ما يكون عندك بيانات مصروف بيت لشهر كامل على الأقل</div>`;
      return;
    }
    const pct = Math.min(100, Math.round((s.curTotal/(s.targetAmount||1))*100));
    const color = s.achieved ? 'var(--primary)' : (s.onPace ? 'var(--accent)' : 'var(--danger)');
    box.innerHTML = `
      <div class="field" style="margin-bottom:6px;">
        <label>هدف التقليل هذا الشهر (%)</label>
        <input id="challengePctInput" type="number" min="1" max="50" value="${db.challengeTargetPct}" style="max-width:100px;">
        <button class="btn sm outline" id="saveChallengePctBtn" style="margin-top:6px;">💾 حفظ الهدف</button>
      </div>
      <div class="row"><span>${s.achieved?'🏆 حققت الهدف!':'🎯 الهدف: تحت '+Math.round(s.targetAmount).toLocaleString('ar-EG')+' ج.م'}</span><b style="color:${color};">${Math.round(s.curTotal).toLocaleString('ar-EG')} ج.م</b></div>
      <div style="position:relative;height:10px;border-radius:99px;background:var(--card-alt);overflow:hidden;margin-top:6px;">
        <div style="position:absolute;inset-inline-start:0;top:0;bottom:0;width:${Math.min(100,pct)}%;background:${color};border-radius:99px;"></div>
      </div>
      <div class="meta" style="margin-top:6px;">${s.achieved?'أنت بالفعل وفّرت أكتر من الهدف — استمر كده 👏':(s.onPace?'لسه ماشي كويس على معدل التوفير المطلوب':'الصرف أسرع من المعدل المطلوب — حاول تهدي شوية باقي الشهر')} (مقارنة بالشهر اللي فات: ${Math.round(s.prevTotal).toLocaleString('ar-EG')} ج.م)</div>
    `;
    document.getElementById('saveChallengePctBtn').onclick = function(){
      const v = Number(document.getElementById('challengePctInput').value)||5;
      db.challengeTargetPct = Math.max(1, Math.min(50, v));
      saveDB();
      renderChallengeCard();
      toast('✅ اتحفظ الهدف');
    };
  }

  /* ========== 3) كشف التزام مستتر ========== */
  function normalizeDesc(s){ return (s||'').trim().replace(/\s+/g,' ').toLowerCase(); }

  function detectHiddenCommitments(){
    const all = db.houseExpenses||[];
    const dismissed = db.dismissedHiddenCommitments || [];
    const existingDescs = (db.commitments||[]).map(c=>normalizeDesc(c.desc));
    const groups = {};
    all.forEach(e=>{
      const key = normalizeDesc(e.desc);
      if(!key) return;
      (groups[key]=groups[key]||[]).push(e);
    });
    const suggestions = [];
    Object.keys(groups).forEach(key=>{
      if(dismissed.includes(key) || existingDescs.includes(key)) return;
      const items = groups[key];
      const monthsSet = new Set(items.map(e=>e.date.slice(0,7)));
      if(monthsSet.size < 3) return;
      const amounts = items.map(e=>Number(e.amount)||0);
      const avg = amounts.reduce((a,b)=>a+b,0)/amounts.length;
      const withinRange = amounts.every(a=>Math.abs(a-avg) <= avg*0.2);
      if(!withinRange) return;
      suggestions.push({key, desc: items[items.length-1].desc, avgAmount: avg, months: monthsSet.size});
    });
    return suggestions;
  }

  window.dismissHiddenCommitment = function(key){
    db.dismissedHiddenCommitments = db.dismissedHiddenCommitments || [];
    db.dismissedHiddenCommitments.push(key);
    saveDB();
    renderHiddenCommitmentSuggestions();
  };

  window.convertToFixedCommitment = function(key, desc, amount){
    openCommitmentModal();
    setTimeout(function(){
      const descEl = document.getElementById('f_commDesc');
      const amountEl = document.getElementById('f_commAmount');
      if(descEl) descEl.value = desc;
      if(amountEl) amountEl.value = Math.round(amount);
    }, 40);
    dismissHiddenCommitment(key);
  };

  function renderHiddenCommitmentSuggestions(){
    const box = document.getElementById('hiddenCommitmentSuggestions');
    if(!box) return;
    const suggestions = detectHiddenCommitments();
    if(!suggestions.length){ box.innerHTML=''; return; }
    box.innerHTML = suggestions.map(s=>`
      <div class="alert-banner warn" style="margin-top:8px;">
        <span class="ic">🕵️</span>
        <div>
          <b>"${escapeHtml(s.desc)}" بيتكرر بنفس القيمة تقريبًا من ${s.months} شهور</b>
          يمكن يبقى الأنسب تحوّله لالتزام ثابت (${Math.round(s.avgAmount).toLocaleString('ar-EG')} ج.م/شهر) عشان محدش يفوتك.
          <div class="btn-row" style="margin-top:6px;">
            <button class="btn sm outline" onclick="convertToFixedCommitment('${s.key}','${escapeHtml(s.desc).replace(/'/g,"\\'")}',${s.avgAmount})">➕ تحويل لالتزام ثابت</button>
            <button class="btn sm secondary" onclick="dismissHiddenCommitment('${s.key}')">تجاهل</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  /* ========== 4) استراتيجية سداد الديون + 5) عداد التحرر ========== */
  let debtStrategyMode = 'snowball'; // snowball | avalanche

  function getDebts(){
    return (db.commitments||[]).filter(c=>c.active!==false && c.type==='قسط' && c.remainingMonths!=null && c.remainingMonths>0)
      .map(c=>({c, remainingAmount: Number(c.amount)*c.remainingMonths}));
  }

  function renderDebtStrategy(){
    const box = document.getElementById('debtStrategyCard');
    if(!box) return;
    const debts = getDebts();
    if(!debts.length){
      box.innerHTML = `<div class="empty-msg">مفيش أقساط محددة المدة مسجلة دلوقتي</div>`;
      return;
    }
    const sorted = debts.slice().sort((a,b)=> debtStrategyMode==='snowball'
      ? a.remainingAmount - b.remainingAmount
      : b.c.amount - a.c.amount);
    const rows = sorted.map((d,idx)=>`
      <div class="card" style="margin-top:6px;${idx===0?'border-color:var(--primary);':''}">
        <div class="row"><h3>${idx===0?'🎯 ':''}${escapeHtml(d.c.desc)}</h3><b>${Math.round(d.remainingAmount).toLocaleString('ar-EG')} ج.م متبقي</b></div>
        <div class="meta">${Number(d.c.amount).toLocaleString('ar-EG')} ج.م/شهر — باقي ${d.c.remainingMonths} شهر${idx===0?' — ابدأ بيه الأول':''}</div>
      </div>
    `).join('');
    box.innerHTML = `
      <div class="btn-row" style="margin-bottom:6px;">
        <button class="btn sm ${debtStrategyMode==='snowball'?'accent':'outline'}" id="btnSnowball">❄️ الأصغر أولًا (Snowball)</button>
        <button class="btn sm ${debtStrategyMode==='avalanche'?'accent':'outline'}" id="btnAvalanche">⛰️ الأعلى قسط أولًا (Avalanche)</button>
      </div>
      <div class="meta">ملحوظة: التطبيق مش بيسجّل نسبة فايدة لكل قسط، فـ"الأعلى قسط شهري" هنا بديل عملي لترتيب الأولوية بدل ترتيب الفايدة الفعلي</div>
      ${rows}
    `;
    document.getElementById('btnSnowball').onclick = function(){ debtStrategyMode='snowball'; renderDebtStrategy(); };
    document.getElementById('btnAvalanche').onclick = function(){ debtStrategyMode='avalanche'; renderDebtStrategy(); };
  }

  function renderFreedomCounter(){
    const box = document.getElementById('freedomCounterCard');
    if(!box) return;
    const withDuration = (db.commitments||[]).filter(c=>c.active!==false && c.remainingMonths!=null && c.remainingMonths>0);
    if(!withDuration.length){
      box.innerHTML = `<div class="empty-msg">مفيش التزامات محددة المدة تحسب لها العدّاد</div>`;
      return;
    }
    const maxMonths = Math.max(...withDuration.map(c=>c.remainingMonths));
    const freeDate = new Date();
    freeDate.setMonth(freeDate.getMonth()+maxMonths);
    box.innerHTML = `
      <div class="row"><span>🔓 التحرر الكامل من الالتزامات محددة المدة</span><b style="color:var(--primary);font-size:16px;">${maxMonths} شهر</b></div>
      <div class="meta">يعني تقريبًا حوالي ${freeDate.toLocaleDateString('ar-EG',{month:'long',year:'numeric'})}، لو استمريت بنفس الوتيرة من غير ما تضيف أقساط جديدة</div>
    `;
  }

  /* ========== حقن الحاويات ========== */
  function injectOverviewExtra(){
    const tab = document.getElementById('personalTab-overview');
    if(!tab || document.getElementById('hiddenCommitmentSuggestions')) return;
    const div = document.createElement('div');
    div.id = 'hiddenCommitmentSuggestions';
    tab.appendChild(div);
  }

  function injectReportsExtra(){
    const tab = document.getElementById('personalTab-reports');
    if(!tab || document.getElementById('monthlyChallengeCard')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="section-title">🏆 التحدي الشهري</div>
      <div class="card" id="monthlyChallengeCard"></div>
      <div class="section-title">📉 استراتيجية سداد الديون</div>
      <div class="card" id="debtStrategyCard"></div>
      <div class="section-title">🔓 عدّاد التحرر من الالتزامات</div>
      <div class="card" id="freedomCounterCard"></div>
    `;
    while(wrap.firstChild) tab.appendChild(wrap.firstChild);
  }

  function renderAllWellbeing(){
    applyMood();
    injectOverviewExtra();
    renderHiddenCommitmentSuggestions();
    injectReportsExtra();
    renderChallengeCard();
    renderDebtStrategy();
    renderFreedomCounter();
  }

  if(typeof renderPersonalAlerts === 'function'){
    const orig = renderPersonalAlerts;
    window.renderPersonalAlerts = function(){
      const r = orig.apply(this, arguments);
      renderAllWellbeing();
      return r;
    };
  }
  if(typeof renderHome === 'function'){
    const origHome = renderHome;
    window.renderHome = function(){
      const r = origHome.apply(this, arguments);
      applyMood();
      return r;
    };
  }
  if(typeof showPersonalTab === 'function'){
    const origShowTab = showPersonalTab;
    window.showPersonalTab = function(tab){
      const r = origShowTab.apply(this, arguments);
      if(tab==='reports'){ injectReportsExtra(); renderChallengeCard(); renderDebtStrategy(); renderFreedomCounter(); }
      if(tab==='overview'){ injectOverviewExtra(); renderHiddenCommitmentSuggestions(); }
      return r;
    };
  }

  function boot(){
    applyMood();
    injectOverviewExtra();
    renderHiddenCommitmentSuggestions();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
