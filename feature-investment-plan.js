/* ============================================================
   feature-investment-plan.js  (نسخة v2)
   نفس الصفحة الأساسية + 5 تطويرات:
   1) 🧮 اقتراح تلقائي لمبلغ الفائض (دخل الشهر − الالتزامات −
      مصروف البيت) بدل ما تكتبه يدوي كل مرة.
   2) ➖ سحب من جيب: تسجيل تنفيذ فعلي (فتحت شهادة، اشتريت ذهب...)
      بتاريخ وسبب، بدل رصيد نظري بس متراكم.
   3) 📈 سجل نمو شهري لكل جيب + Sparkline بسيط جنب كل جيب.
   4) 🔗 ربط أي جيب بالمخزون: أي سحب منه يترحّل تلقائي لرصيد
      المخزون (feature-inventory.js) بدل ما تدخله مرتين.
   5) ⏰ تنبيه لو فائض الشهر اللي فات ما اتوزّعش (أو اتوزّع جزء
      بسيط منه) — بيظهر في أعلى صفحة الاستثمار.
   + لون ثابت مميز لكل جيب يفضل معاه في كل مكان.
   ============================================================ */
(function(){

  const BUCKET_COLORS = ['#B8863B','#1F6D57','#5A7EBB','#B65A6C','#8A6FBF','#4C9A8E','#C48A3A'];

  function ensureInvestmentDefaults(){
    if(!Array.isArray(db.investmentBuckets)) db.investmentBuckets = [];
    if(!Array.isArray(db.investmentLog)) db.investmentLog = [];
    if(!Array.isArray(db.investmentWithdrawals)) db.investmentWithdrawals = [];
    db.investmentBuckets.forEach((b,idx)=>{
      if(!b.color) b.color = BUCKET_COLORS[idx % BUCKET_COLORS.length];
      if(!Array.isArray(b.history)) b.history = [];
      if(typeof b.linkInventory !== 'boolean') b.linkInventory = false;
    });
  }

  function totalPct(){ return (db.investmentBuckets||[]).reduce((s,b)=>s+(Number(b.targetPct)||0),0); }

  function upsertBucketHistory(b){
    const ym = currentYM();
    const entry = b.history.find(h=>h.ym===ym);
    if(entry) entry.balance = b.balance;
    else b.history.push({ym, balance:b.balance});
    if(b.history.length>24) b.history = b.history.slice(-24);
  }

  /* ---------- 1) اقتراح الفائض تلقائي ---------- */
  function houseExpensesTotalForYM(ym){
    return (db.houseExpenses||[]).filter(e=>e.date.slice(0,7)===ym).reduce((s,e)=>s+Number(e.amount||0),0);
  }
  function monthRevenueLocal(ym){
    return (db.payments||[]).filter(p=>p.date && p.date.slice(0,7)===ym).reduce((s,p)=>s+(Number(p.amount)||0),0);
  }
  function requiredMonthlyLocal(){
    try{ const prog = monthlyCommitmentProgress(); return prog ? prog.requiredMonthly : 0; }catch(e){ return 0; }
  }
  function suggestedSurplusFor(ym){
    const income = monthRevenueLocal(ym);
    const required = requiredMonthlyLocal();
    const houseExp = houseExpensesTotalForYM(ym);
    return Math.max(0, income - required - houseExp);
  }

  window.applySuggestedSurplus = function(){
    const amount = Math.round(suggestedSurplusFor(currentYM()));
    const el = document.getElementById('investmentSurplusAmount');
    if(el) el.value = amount>0 ? amount : '';
    toast(amount>0 ? `✅ الاقتراح: ${amount.toLocaleString('ar-EG')} ج.م` : 'لسه مفيش فائض واضح الشهر ده');
  };

  /* ---------- إدارة الجيوب ---------- */
  window.openInvestmentBucketModal = function(id){
    ensureInvestmentDefaults();
    const b = id ? db.investmentBuckets.find(x=>x.id===id) : null;
    const html = `
      <h3>${b?'✏️ تعديل جيب':'➕ إضافة جيب استثمار جديد'}</h3>
      <div class="field"><label>اسم الجيب</label><input id="f_bucketName" type="text" placeholder="مثال: إعادة استثمار في الورشة" value="${b?escapeHtml(b.name):''}"></div>
      <div class="field"><label>نسبة الفائض المخصصة له (%)</label><input id="f_bucketPct" type="number" min="1" max="100" value="${b?b.targetPct:''}"></div>
      <div class="field"><label>هدف مبلغ (اختياري)</label><input id="f_bucketTarget" type="number" min="0" placeholder="مثال: 20000" value="${b&&b.targetAmount?b.targetAmount:''}"></div>
      <div class="field"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
        <input type="checkbox" id="f_bucketLinkInv" style="width:18px;height:18px;" ${b&&b.linkInventory?'checked':''}> 🔗 اربط الجيب ده بالمخزون (أي سحب منه يترحّل تلقائي لرصيد المخزون)
      </label></div>
      <button class="btn" onclick="saveInvestmentBucket(${b?`'${b.id}'`:'null'})">💾 حفظ</button>
    `;
    openModal(html);
  };

  window.saveInvestmentBucket = function(id){
    ensureInvestmentDefaults();
    const name = document.getElementById('f_bucketName').value.trim();
    const pct = Number(document.getElementById('f_bucketPct').value)||0;
    const targetAmount = Number(document.getElementById('f_bucketTarget').value)||0;
    const linkInventory = document.getElementById('f_bucketLinkInv').checked;
    if(!name){ toast('أدخل اسم الجيب'); return; }
    if(pct<=0 || pct>100){ toast('أدخل نسبة صحيحة بين 1 و100'); return; }
    const otherTotal = totalPct() - (id ? (db.investmentBuckets.find(x=>x.id===id)?.targetPct||0) : 0);
    if(otherTotal + pct > 100){ toast(`مجموع النسب هيبقى أكتر من 100% (باقي متاح: ${100-otherTotal}%)`); return; }
    if(id){
      const b = db.investmentBuckets.find(x=>x.id===id);
      Object.assign(b, {name, targetPct:pct, targetAmount, linkInventory});
    } else {
      db.investmentBuckets.push({id:uid(), name, targetPct:pct, targetAmount, balance:0, linkInventory, color: BUCKET_COLORS[db.investmentBuckets.length % BUCKET_COLORS.length], history:[]});
    }
    saveDB();
    closeModal();
    toast('✅ اتحفظ الجيب');
    renderInvestmentPage();
  };

  window.deleteInvestmentBucket = async function(id){
    if(!await appConfirm('حذف الجيب ده؟ الرصيد المتجمع فيه هيتحذف من السجل (مش بيرجع فلوس حقيقية، ده بس تنظيم داخلي)')) return;
    db.investmentBuckets = db.investmentBuckets.filter(x=>x.id!==id);
    saveDB();
    renderInvestmentPage();
  };

  /* ---------- توزيع فائض جديد ---------- */
  window.distributeInvestmentSurplus = function(){
    ensureInvestmentDefaults();
    const amountEl = document.getElementById('investmentSurplusAmount');
    const amount = Number(amountEl && amountEl.value)||0;
    if(amount<=0){ toast('أدخل مبلغ صحيح'); return; }
    if(!db.investmentBuckets.length){ toast('أضف جيب استثمار واحد على الأقل الأول'); return; }
    const tPct = totalPct();
    if(tPct<=0){ toast('حدد نسب الجيوب الأول'); return; }
    db.investmentBuckets.forEach(b=>{
      const share = amount * (Number(b.targetPct)||0) / tPct;
      b.balance = (Number(b.balance)||0) + share;
      upsertBucketHistory(b);
    });
    db.investmentLog.unshift({id:uid(), amount, date:todayStr()});
    if(db.investmentLog.length>50) db.investmentLog = db.investmentLog.slice(0,50);
    saveDB();
    if(amountEl) amountEl.value='';
    toast('✅ اتوزّع الفائض على الجيوب');
    renderInvestmentPage();
  };

  /* ---------- 2) سحب من جيب ---------- */
  window.openWithdrawModal = function(bucketId){
    const b = db.investmentBuckets.find(x=>x.id===bucketId);
    if(!b) return;
    const html = `
      <h3>➖ سحب من "${escapeHtml(b.name)}"</h3>
      <div class="meta">الرصيد الحالي: ${Math.round(b.balance).toLocaleString('ar-EG')} ج.م</div>
      <div class="field"><label>المبلغ</label><input id="f_withdrawAmount" type="number" min="0" max="${Math.round(b.balance)}"></div>
      <div class="field"><label>السبب (مثال: فتحت شهادة ادخار، اشتريت ذهب...)</label><input id="f_withdrawNote" type="text"></div>
      ${b.linkInventory ? `<div class="meta">🔗 هذا الجيب مربوط بالمخزون — المبلغ هيترحّل تلقائي لرصيد المخزون</div>` : ''}
      <button class="btn" onclick="confirmWithdraw('${b.id}')">✅ تأكيد السحب</button>
    `;
    openModal(html);
  };

  window.confirmWithdraw = function(bucketId){
    const b = db.investmentBuckets.find(x=>x.id===bucketId);
    if(!b) return;
    const amount = Number(document.getElementById('f_withdrawAmount').value)||0;
    const note = document.getElementById('f_withdrawNote').value.trim();
    if(amount<=0 || amount>b.balance){ toast('أدخل مبلغ صحيح لا يتعدى الرصيد'); return; }
    b.balance -= amount;
    upsertBucketHistory(b);
    db.investmentWithdrawals.unshift({id:uid(), bucketId, amount, note, date:todayStr()});
    if(db.investmentWithdrawals.length>80) db.investmentWithdrawals = db.investmentWithdrawals.slice(0,80);
    if(b.linkInventory){
      if(typeof db.inventoryValue !== 'number') db.inventoryValue = 0;
      if(!Array.isArray(db.inventoryLog)) db.inventoryLog = [];
      db.inventoryValue += amount;
      db.inventoryLog.unshift({id:uid(), type:'in', amount, note:`ترحيل من جيب استثمار: ${b.name}`, date:todayStr(), ts:Date.now()});
    }
    saveDB();
    closeModal();
    toast('✅ اتسجل السحب');
    renderInvestmentPage();
    if(typeof renderInventoryCard==='function') renderInventoryCard();
  };

  /* ---------- 3) Sparkline بسيط ---------- */
  function sparklineSvg(history, color){
    if(!history || history.length<2) return '';
    const vals = history.map(h=>h.balance);
    const min = Math.min(...vals), max = Math.max(...vals);
    const range = (max-min) || 1;
    const w = 120, h = 30, step = w/(vals.length-1);
    const points = vals.map((v,i)=> `${(i*step).toFixed(1)},${(h - ((v-min)/range)*h).toFixed(1)}`).join(' ');
    return `<svg width="${w}" height="${h}" style="display:block;margin-top:4px;"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="2"/></svg>`;
  }

  /* ---------- 5) تنبيه فائض غير موزّع ---------- */
  function unallocatedLastMonthBanner(){
    const lastYM = addMonthsYM(currentYM(), -1);
    const suggested = suggestedSurplusFor(lastYM);
    if(suggested<=0) return '';
    const distributed = (db.investmentLog||[]).filter(l=>l.date.slice(0,7)===lastYM).reduce((s,l)=>s+Number(l.amount||0),0);
    if(distributed >= suggested*0.8) return '';
    const remaining = Math.round(suggested - distributed);
    return `
      <div class="alert-banner warn" style="margin-bottom:8px;">
        <span class="ic">⏰</span>
        <div>عندك حوالي <b>${remaining.toLocaleString('ar-EG')} ج.م</b> فائض من الشهر اللي فات لسه ما اتوزّعش على الجيوب. حب توزّعه دلوقتي؟</div>
      </div>
    `;
  }

  /* ---------- العرض ---------- */
  window.renderInvestmentPage = function(){
    ensureInvestmentDefaults();
    const box = document.getElementById('investmentBucketsList');
    if(!box) return;
    const tPct = totalPct();
    box.innerHTML = unallocatedLastMonthBanner() + `
      <div class="card">
        <div class="field"><label>💵 فائض جديد لتوزيعه (ج.م)</label><input id="investmentSurplusAmount" type="number" min="0"></div>
        <div class="btn-row">
          <button class="btn sm outline" onclick="distributeInvestmentSurplus()">➗ وزّع على الجيوب</button>
          <button class="btn sm secondary" onclick="applySuggestedSurplus()">🧮 اقترح المبلغ تلقائي</button>
        </div>
        <div class="meta" style="margin-top:6px;">مجموع النسب الحالي: <b style="color:${tPct>100?'var(--danger)':'var(--text)'};">${tPct}%</b>${tPct<100?` (باقي ${100-tPct}% غير موزّع)`:''}</div>
      </div>
    ` + (db.investmentBuckets.length ? db.investmentBuckets.map(b=>{
      const progress = b.targetAmount>0 ? Math.min(100, Math.round((b.balance/b.targetAmount)*100)) : null;
      return `
        <div class="card" style="margin-top:8px;border-inline-start:4px solid ${b.color};">
          <div class="row"><h3>🌱 ${escapeHtml(b.name)}</h3><b>${Math.round(b.balance).toLocaleString('ar-EG')} ج.م</b></div>
          <div class="meta">${b.targetPct}% من كل فائض يُوزّع${b.targetAmount>0?` — الهدف ${Math.round(b.targetAmount).toLocaleString('ar-EG')} ج.م`:''}${b.linkInventory?' — 🔗 مربوط بالمخزون':''}</div>
          ${progress!=null ? `
            <div style="position:relative;height:8px;border-radius:99px;background:var(--card-alt);overflow:hidden;margin-top:6px;">
              <div style="position:absolute;inset-inline-start:0;top:0;bottom:0;width:${progress}%;background:${b.color};border-radius:99px;"></div>
            </div>` : ''}
          ${sparklineSvg(b.history, b.color)}
          <div class="btn-row" style="margin-top:6px;">
            <button class="btn sm outline" onclick="openWithdrawModal('${b.id}')">➖ سحب</button>
            <button class="btn sm secondary" onclick="openInvestmentBucketModal('${b.id}')">✏️ تعديل</button>
            <button class="btn sm danger" onclick="deleteInvestmentBucket('${b.id}')">🗑️ حذف</button>
          </div>
        </div>
      `;
    }).join('') : `<div class="empty-msg">لسه معندكش جيوب استثمار — ضيف أول واحد بالزرار +</div>`);
  };

  /* ---------- حقن الصفحة + رابط القائمة الجانبية ---------- */
  function injectInvestmentPage(){
    if(document.getElementById('page-investment')) return;
    const afterPage = document.getElementById('page-workers') || document.getElementById('page-finance');
    if(!afterPage) return;
    const section = document.createElement('section');
    section.className = 'page';
    section.id = 'page-investment';
    section.innerHTML = `
      <div class="section-title">🌱 تخطيط الاستثمار</div>
      <div class="alert-banner" style="margin-bottom:8px;">
        <span class="ic">ℹ️</span>
        <div>أداة تنظيم داخلي بس — بتوزّع الأرقام اللي إنت بتدخلها حسب نسب إنت حددتها، ومش بتحرّك فلوس حقيقية ولا بتدي نصيحة استثمار. القرار وتنفيذه (فتح شهادة، شراء ذهب...) برّه التطبيق تمامًا.</div>
      </div>
      <button class="btn outline" onclick="openInvestmentBucketModal()">➕ إضافة جيب استثمار</button>
      <div id="investmentBucketsList" style="margin-top:8px;"></div>
    `;
    afterPage.insertAdjacentElement('afterend', section);

    const sidenav = document.getElementById('sideNav');
    if(sidenav && !sidenav.querySelector('[data-page="investment"]')){
      const btn = document.createElement('button');
      btn.className = 'navbtn';
      btn.setAttribute('data-page','investment');
      btn.setAttribute('onclick',"showPage('investment');closeSideNav()");
      btn.innerHTML = '<span class="ic">🌱</span>الاستثمار';
      const workersBtn = sidenav.querySelector('[data-page="workers"]');
      if(workersBtn) workersBtn.insertAdjacentElement('afterend', btn);
      else sidenav.appendChild(btn);
    }

    if(typeof pageTitles==='object') pageTitles.investment = '🌱 الاستثمار';
    if(typeof fabPages==='object') fabPages.investment = false;
  }

  if(typeof renderAll === 'function'){
    const origRenderAll = renderAll;
    window.renderAll = function(){
      const r = origRenderAll.apply(this, arguments);
      if(document.getElementById('page-investment')) renderInvestmentPage();
      return r;
    };
  }

  document.addEventListener('DOMContentLoaded', function(){
    ensureInvestmentDefaults();
    injectInvestmentPage();
  });
})();
