/* ============================================================
   feature-fabric-calculator.js
   🧮 حاسبة استهلاك القماش — بمعادلتك الحقيقية:
     طول القماش = (طول العميل + زيادة) × مضاعف − خصم
   مثال: طول 150 + زيادة 10 = 160، ×2 = 320، −30 = 290 سم قماش.
   "الزيادة" و"المضاعف" و"الخصم" بتتحدد لكل نوع قطعة على حدة
   (تسجّلها إنت مرة واحدة كـ"قالب")، والحساب بعد كده تلقائي.
   ملف مستقل، بيضيف زرار جنب "حاسبة تسعير سريعة" الموجودة، ومش
   بيلمس أي ملف تاني.
   ============================================================ */
(function(){

  function ensureFabricDefaults(){
    if(!Array.isArray(db.fabricTemplates)) db.fabricTemplates = [];
  }

  /* ---------- إدارة القوالب ---------- */
  window.openFabricTemplateModal = function(id){
    ensureFabricDefaults();
    const t = id ? db.fabricTemplates.find(x=>x.id===id) : null;
    const html = `
      <h3>${t?'✏️ تعديل نوع':'➕ إضافة نوع قطعة جديد'}</h3>
      <div class="field"><label>اسم النوع</label><input id="f_fabName" type="text" placeholder="مثال: جلابية رجالي عادي" value="${t?escapeHtml(t.name):''}"></div>
      <div class="field"><label>الزيادة على الطول (سم)</label><input id="f_fabAdd" type="number" step="0.5" value="${t?t.addCm:10}"></div>
      <div class="field"><label>المضاعف</label><input id="f_fabMult" type="number" step="0.5" value="${t?t.multiplier:2}"></div>
      <div class="field"><label>الخصم النهائي (سم)</label><input id="f_fabSub" type="number" step="0.5" value="${t?t.subtractCm:30}"></div>
      <div class="meta">المعادلة: (طول العميل + الزيادة) × المضاعف − الخصم = طول القماش بالسم</div>
      <button class="btn" onclick="saveFabricTemplate(${t?`'${t.id}'`:'null'})">💾 حفظ</button>
    `;
    openModal(html);
  };

  window.saveFabricTemplate = function(id){
    ensureFabricDefaults();
    const name = document.getElementById('f_fabName').value.trim();
    const addCm = Number(document.getElementById('f_fabAdd').value)||0;
    const multiplier = Number(document.getElementById('f_fabMult').value)||1;
    const subtractCm = Number(document.getElementById('f_fabSub').value)||0;
    if(!name){ toast('أدخل اسم النوع'); return; }
    const data = {name, addCm, multiplier, subtractCm};
    if(id){
      Object.assign(db.fabricTemplates.find(x=>x.id===id), data);
    } else {
      db.fabricTemplates.push({id:uid(), ...data});
    }
    saveDB();
    toast('✅ اتحفظ النوع');
    openFabricCalculatorModal();
  };

  window.deleteFabricTemplate = async function(id){
    if(!await appConfirm('حذف النوع ده من الحاسبة؟')) return;
    db.fabricTemplates = db.fabricTemplates.filter(x=>x.id!==id);
    saveDB();
    openFabricCalculatorModal();
  };

  /* ---------- الحاسبة نفسها ---------- */
  window.openFabricCalculatorModal = function(){
    ensureFabricDefaults();
    const optionsHtml = db.fabricTemplates.length
      ? db.fabricTemplates.map(t=>`<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')
      : '';
    const html = `
      <h3>🧮 حاسبة استهلاك القماش</h3>
      ${db.fabricTemplates.length ? `
        <div class="field"><label>نوع القطعة</label><select id="fc_type" onchange="calcFabric()">${optionsHtml}</select></div>
        <div class="field"><label>طول العميل (سم)</label><input id="fc_height" type="number" min="0" oninput="calcFabric()"></div>
        <div class="field"><label>عدد القطع</label><input id="fc_qty" type="number" min="1" value="1" oninput="calcFabric()"></div>
        <div id="fc_result" style="margin-top:8px;"></div>
        <hr class="sep">
      ` : `<div class="empty-msg">لسه معندكش أنواع قطع مسجلة في الحاسبة — ضيف أول نوع تحت</div>`}
      <div class="btn-row" style="margin-top:8px;">
        <button class="btn sm outline" onclick="openFabricTemplateModal()">➕ إضافة نوع جديد</button>
        ${db.fabricTemplates.length ? `<button class="btn sm secondary" onclick="manageFabricTemplatesModal()">⚙️ إدارة الأنواع</button>` : ''}
      </div>
    `;
    openModal(html);
    if(db.fabricTemplates.length) calcFabric();
  };

  window.calcFabric = function(){
    ensureFabricDefaults();
    const sel = document.getElementById('fc_type');
    const box = document.getElementById('fc_result');
    if(!sel || !box) return;
    const t = db.fabricTemplates.find(x=>x.id===sel.value);
    if(!t){ box.innerHTML=''; return; }
    const height = Number(document.getElementById('fc_height').value)||0;
    const qty = Math.max(1, Number(document.getElementById('fc_qty').value)||1);
    if(height<=0){ box.innerHTML = '<div class="empty-msg">أدخل طول العميل</div>'; return; }

    const perPieceCm = (height + t.addCm) * t.multiplier - t.subtractCm;
    const perPieceM = perPieceCm/100;
    const totalCm = perPieceCm*qty;
    const totalM = perPieceM*qty;

    box.innerHTML = `
      <div class="card" style="background:var(--card-alt);">
        <div class="meta">(${height} + ${t.addCm}) × ${t.multiplier} − ${t.subtractCm} = ${perPieceCm.toFixed(0)} سم للقطعة الواحدة</div>
        <div class="row" style="margin-top:6px;"><span class="meta">لكل قطعة</span><b>${perPieceCm.toFixed(0)} سم (${perPieceM.toFixed(2)} م)</b></div>
        <div class="row" style="border-top:1px dashed var(--stitch);margin-top:6px;padding-top:6px;">
          <span style="font-weight:700;">إجمالي ${qty} قطعة</span>
          <b style="color:var(--heading);font-size:16px;">${totalCm.toFixed(0)} سم (${totalM.toFixed(2)} متر)</b>
        </div>
      </div>
    `;
  };

  window.manageFabricTemplatesModal = function(){
    ensureFabricDefaults();
    const rows = db.fabricTemplates.map(t=>`
      <div class="card" style="margin-top:6px;">
        <div class="row"><h3>${escapeHtml(t.name)}</h3></div>
        <div class="meta">(الطول + ${t.addCm}) × ${t.multiplier} − ${t.subtractCm}</div>
        <div class="btn-row">
          <button class="btn sm secondary" onclick="openFabricTemplateModal('${t.id}')">✏️ تعديل</button>
          <button class="btn sm danger" onclick="deleteFabricTemplate('${t.id}')">🗑️ حذف</button>
        </div>
      </div>
    `).join('');
    openModal(`<h3>⚙️ إدارة أنواع القماش</h3>${rows}<button class="btn sm outline" style="margin-top:8px;" onclick="openFabricCalculatorModal()">⬅️ رجوع للحاسبة</button>`);
  };

  /* ---------- حقن الزرار جنب حاسبة التسعير ---------- */
  function injectFabricButton(){
    if(document.getElementById('fabricCalcBtn')) return;
    const priceBtn = document.querySelector('button[onclick="openPricingCalculatorModal()"]');
    if(!priceBtn) return;
    const btn = document.createElement('button');
    btn.id = 'fabricCalcBtn';
    btn.className = 'btn outline';
    btn.textContent = '🧵 حاسبة استهلاك القماش';
    btn.onclick = function(){ openFabricCalculatorModal(); };
    priceBtn.insertAdjacentElement('afterend', btn);
  }

  if(typeof renderHome === 'function'){
    const origRenderHome = renderHome;
    window.renderHome = function(){
      const r = origRenderHome.apply(this, arguments);
      injectFabricButton();
      return r;
    };
  }

  document.addEventListener('DOMContentLoaded', function(){
    ensureFabricDefaults();
    injectFabricButton();
  });
})();
