/* ============================================================
   feature-investment-plan.js
   صفحة جديدة "🌱 الاستثمار" — أداة تساعدك تطبّق خطة توزيع
   الفائض بنفسك، مش توصية جاهزة: إنت اللي بتحدد "الجيوب"
   (إعادة استثمار في الورشة، ادخار طويل الأجل، ...) ونسبة كل
   واحدة، والتطبيق يوزّع أي فائض تدخله عليهم تلقائيًا ويسجّل
   رصيد تراكمي لكل جيب. فيه كمان ملاحظة تعريفية عامة عن خيارات
   الاستثمار الشائعة — معلومات عامة بس، مش نصيحة مالية شخصية.
   ملف مستقل، مش بيلمس أي ملف تاني.
   ============================================================ */
(function(){

  function ensureInvestmentDefaults(){
    if(!Array.isArray(db.investmentBuckets)) db.investmentBuckets = [];
    if(!Array.isArray(db.investmentLog)) db.investmentLog = [];
  }

  function totalPct(){
    return (db.investmentBuckets||[]).reduce((s,b)=>s+(Number(b.targetPct)||0),0);
  }

  /* ---------- إدارة الجيوب ---------- */
  window.openInvestmentBucketModal = function(id){
    ensureInvestmentDefaults();
    const b = id ? db.investmentBuckets.find(x=>x.id===id) : null;
    const html = `
      <h3>${b?'✏️ تعديل جيب':'➕ إضافة جيب استثمار جديد'}</h3>
      <div class="field"><label>اسم الجيب</label><input id="f_bucketName" type="text" placeholder="مثال: إعادة استثمار في الورشة" value="${b?escapeHtml(b.name):''}"></div>
      <div class="field"><label>نسبة الفائض المخصصة له (%)</label><input id="f_bucketPct" type="number" min="1" max="100" value="${b?b.targetPct:''}"></div>
      <div class="field"><label>هدف مبلغ (اختياري)</label><input id="f_bucketTarget" type="number" min="0" placeholder="مثال: 20000" value="${b&&b.targetAmount?b.targetAmount:''}"></div>
      <button class="btn" onclick="saveInvestmentBucket(${b?`'${b.id}'`:'null'})">💾 حفظ</button>
    `;
    openModal(html);
  };

  window.saveInvestmentBucket = function(id){
    ensureInvestmentDefaults();
    const name = document.getElementById('f_bucketName').value.trim();
    const pct = Number(document.getElementById('f_bucketPct').value)||0;
    const targetAmount = Number(document.getElementById('f_bucketTarget').value)||0;
    if(!name){ toast('أدخل اسم الجيب'); return; }
    if(pct<=0 || pct>100){ toast('أدخل نسبة صحيحة بين 1 و100'); return; }
    const otherTotal = totalPct() - (id ? (db.investmentBuckets.find(x=>x.id===id)?.targetPct||0) : 0);
    if(otherTotal + pct > 100){ toast(`مجموع النسب هيبقى أكتر من 100% (باقي متاح: ${100-otherTotal}%)`); return; }
    if(id){
      const b = db.investmentBuckets.find(x=>x.id===id);
      Object.assign(b, {name, targetPct:pct, targetAmount});
    } else {
      db.investmentBuckets.push({id:uid(), name, targetPct:pct, targetAmount, balance:0});
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
      const share = amount * (Number(b.targetPct)||0) / tPct; // النسب بتتوزع نسبيًا حتى لو مجموعها أقل من 100
      b.balance = (Number(b.balance)||0) + share;
    });
    db.investmentLog.unshift({id:uid(), amount, date:todayStr()});
    if(db.investmentLog.length>50) db.investmentLog = db.investmentLog.slice(0,50);
    saveDB();
    if(amountEl) amountEl.value='';
    toast('✅ اتوزّع الفائض على الجيوب');
    renderInvestmentPage();
  };

  /* ---------- العرض ---------- */
  window.renderInvestmentPage = function(){
    ensureInvestmentDefaults();
    const box = document.getElementById('investmentBucketsList');
    if(!box) return;
    const tPct = totalPct();
    box.innerHTML = `
      <div class="card">
        <div class="field"><label>💵 فائض جديد لتوزيعه (ج.م)</label><input id="investmentSurplusAmount" type="number" min="0"></div>
        <button class="btn sm outline" onclick="distributeInvestmentSurplus()">➗ وزّع على الجيوب</button>
        <div class="meta" style="margin-top:6px;">مجموع النسب الحالي: <b style="color:${tPct>100?'var(--danger)':'var(--text)'};">${tPct}%</b>${tPct<100?` (باقي ${100-tPct}% غير موزّع)`:''}</div>
      </div>
    ` + (db.investmentBuckets.length ? db.investmentBuckets.map(b=>{
      const progress = b.targetAmount>0 ? Math.min(100, Math.round((b.balance/b.targetAmount)*100)) : null;
      return `
        <div class="card" style="margin-top:8px;">
          <div class="row"><h3>🌱 ${escapeHtml(b.name)}</h3><b>${Math.round(b.balance).toLocaleString('ar-EG')} ج.م</b></div>
          <div class="meta">${b.targetPct}% من كل فائض يُوزّع${b.targetAmount>0?` — الهدف ${Math.round(b.targetAmount).toLocaleString('ar-EG')} ج.م`:''}</div>
          ${progress!=null ? `
            <div style="position:relative;height:8px;border-radius:99px;background:var(--card-alt);overflow:hidden;margin-top:6px;">
              <div style="position:absolute;inset-inline-start:0;top:0;bottom:0;width:${progress}%;background:var(--primary);border-radius:99px;"></div>
            </div>` : ''}
          <div class="btn-row" style="margin-top:6px;">
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
