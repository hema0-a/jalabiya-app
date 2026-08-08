/* ============================================================
   feature-referrals.js
   نظام "🔗 تتبع مين رشّح مين" — النسخة الكاملة:
   1) حقل اختياري في نموذج العميل: "مين رشّحه؟" (اسم عميل موجود
      أو مصدر حر زي "سوشيال ميديا"). بيتربط تلقائيًا بعميل موجود
      لو الاسم مطابق، وإلا بيتسجل كنص مصدر حر.
   2) في صفحة/سجل كل عميل: يظهر مين رشّحه، وقائمة العملاء اللي
      هو رشّحهم + إجمالي قيمة إنفاقهم (Attribution).
   3) لوحة "🏆 أفضل المُرشِّحين" أعلى صفحة العملاء، مرتبة حسب
      عدد الإحالات أو القيمة المالية.
   4) نظام مكافآت: تسجيل مكافأة لعميل رشّح غيره (نوع + تاريخ +
      ملاحظة)، مع تنبيه لو رشّح 3+ ولسه ما اتكافأش.
   ملف مستقل، بيلف (wrap) openCustomerModal / saveCustomer /
   openCustomerHistory / renderCustomers الموجودين في core.js
   بدون ما يعدّل فيهم مباشرة.
   ============================================================ */
(function(){

  function ensureDefaults(){
    if(!Array.isArray(db.referralRewards)) db.referralRewards = [];
    db.customers.forEach(c=>{
      if(c.referredById===undefined) c.referredById = null;
      if(c.referralSourceText===undefined) c.referralSourceText = '';
    });
  }

  function referredCustomers(customerId){
    return db.customers.filter(c=>c.referredById===customerId);
  }

  function customerTotalSpent(customerId){
    return db.orders.filter(o=>o.customerId===customerId).reduce((s,o)=>s+(Number(o.paid)||0),0);
  }

  function referralStats(customerId){
    const list = referredCustomers(customerId);
    const totalValue = list.reduce((s,c)=>s+customerTotalSpent(c.id), 0);
    return {count:list.length, list, totalValue};
  }

  function rewardsFor(customerId){
    return (db.referralRewards||[]).filter(r=>r.customerId===customerId).sort((a,b)=>b.date.localeCompare(a.date));
  }

  /* ---------- 1) حقل "مين رشّحه؟" في نموذج العميل ---------- */

  function injectReferralField(existingCustomer){
    const wrapAfter = document.getElementById('f_family');
    const fieldWrap = wrapAfter ? wrapAfter.closest('.field') : null;
    if(!fieldWrap || document.getElementById('f_referredBy')) return;

    const others = db.customers.filter(c=>!existingCustomer || c.id!==existingCustomer.id);
    let currentVal = '';
    if(existingCustomer){
      if(existingCustomer.referredById){
        const ref = customerById(existingCustomer.referredById);
        currentVal = ref ? ref.name : '';
      } else if(existingCustomer.referralSourceText){
        currentVal = existingCustomer.referralSourceText;
      }
    }

    const html = `
      <div class="field" id="referralFieldWrap">
        <label>🔗 مين رشّحه؟ (اسم عميل موجود، أو مصدر زي: سوشيال ميديا — اختياري)</label>
        <input id="f_referredBy" list="referralDatalist" value="${currentVal ? escapeHtml(currentVal) : ''}" placeholder="مثال: محمد أحمد أو سوشيال ميديا">
        <datalist id="referralDatalist">${others.map(c=>`<option value="${escapeHtml(c.name)}">`).join('')}</datalist>
      </div>
    `;
    fieldWrap.insertAdjacentHTML('afterend', html);
  }

  function hookCustomerModal(){
    if(typeof window.openCustomerModal !== 'function') return;
    const orig = window.openCustomerModal;
    window.openCustomerModal = function(id){
      const r = orig.apply(this, arguments);
      setTimeout(()=>{
        ensureDefaults();
        injectReferralField(id ? customerById(id) : null);
      }, 30);
      return r;
    };
  }

  function resolveReferralInput(rawValue, selfId){
    const text = (rawValue||'').trim();
    if(!text) return {referredById:null, referralSourceText:''};
    const match = db.customers.find(c=>c.id!==selfId && c.name.trim().toLowerCase()===text.toLowerCase());
    if(match) return {referredById:match.id, referralSourceText:''};
    return {referredById:null, referralSourceText:text};
  }

  function hookSaveCustomer(){
    if(typeof window.saveCustomer !== 'function') return;
    const orig = window.saveCustomer;
    window.saveCustomer = async function(id){
      const el = document.getElementById('f_referredBy');
      const rawValue = el ? el.value : null;
      const beforeIds = new Set(db.customers.map(c=>c.id));
      const r = await orig.apply(this, arguments);
      if(rawValue===null) return r; // الحقل مش موجود لأي سبب — سيبها زي ما هي
      let targetId = id;
      if(!targetId){
        const added = db.customers.find(c=>!beforeIds.has(c.id));
        if(added) targetId = added.id;
      }
      if(targetId){
        const c = customerById(targetId);
        if(c){
          const resolved = resolveReferralInput(rawValue, targetId);
          // لو المستخدم مرشحش حد (referredById===null بعد الحل) ولا كتب مصدر، يبقى منع الدوائر: عميل مايرشحش نفسه
          if(resolved.referredById===targetId){ resolved.referredById=null; }
          c.referredById = resolved.referredById;
          c.referralSourceText = resolved.referralSourceText;
          saveDB();
        }
      }
      return r;
    };
  }

  /* ---------- 2) قسم الإحالات داخل سجل العميل ---------- */

  window.openGiveRewardModal = function(customerId){
    const c = customerById(customerId);
    if(!c) return;
    const html = `
      <div class="modal-head"><h3>🎁 منح مكافأة إحالة لـ ${escapeHtml(c.name)}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
      <div class="field"><label>نوع المكافأة</label>
        <select id="f_rewardType">
          <option value="خصم">خصم على الطلب القادم</option>
          <option value="هدية">هدية</option>
          <option value="تفصيلة مجانية">تفصيلة مجانية</option>
          <option value="أخرى">أخرى</option>
        </select>
      </div>
      <div class="field"><label>ملاحظة (اختياري)</label><input id="f_rewardNote" placeholder="مثال: خصم 10% على الطلب الجاي"></div>
      <button class="btn" onclick="saveReferralReward('${customerId}')">💾 حفظ المكافأة</button>
    `;
    openModal(html);
  };

  window.saveReferralReward = function(customerId){
    ensureDefaults();
    const type = document.getElementById('f_rewardType').value;
    const note = document.getElementById('f_rewardNote').value.trim();
    db.referralRewards.unshift({id:uid(), customerId, type, note, date:todayStr()});
    saveDB();
    closeModal();
    toast('✅ اتسجلت المكافأة');
    if(typeof window.openCustomerHistory==='function') window.openCustomerHistory(customerId);
  };

  window.deleteReferralReward = function(rewardId, customerId){
    db.referralRewards = (db.referralRewards||[]).filter(r=>r.id!==rewardId);
    saveDB();
    if(typeof window.openCustomerHistory==='function') window.openCustomerHistory(customerId);
  };

  function referralSectionHtml(customerId){
    ensureDefaults();
    const c = customerById(customerId);
    if(!c) return '';
    const stats = referralStats(customerId);
    const rewards = rewardsFor(customerId);

    let referredByLine = '';
    if(c.referredById){
      const ref = customerById(c.referredById);
      if(ref) referredByLine = `<div class="meta">🔗 رشّحه: <b>${escapeHtml(ref.name)}</b></div>`;
    } else if(c.referralSourceText){
      referredByLine = `<div class="meta">🔗 مصدر المعرفة: <b>${escapeHtml(c.referralSourceText)}</b></div>`;
    }

    const referredListHtml = stats.count ? stats.list.map(rc=>`
      <div class="row" style="margin-bottom:4px;">
        <span>${escapeHtml(rc.name)}</span>
        <span class="meta">${customerTotalSpent(rc.id).toLocaleString('ar-EG')} ج.م</span>
      </div>
    `).join('') : `<div class="empty-msg">لسه ما رشّحش حد</div>`;

    const rewardsHtml = rewards.length ? rewards.map(r=>`
      <div class="row" style="margin-bottom:4px;">
        <span class="meta">${fmtDate(r.date)} — ${escapeHtml(r.type)}${r.note?` (${escapeHtml(r.note)})`:''}</span>
        <button class="btn sm outline" style="padding:2px 8px;" onclick="deleteReferralReward('${r.id}','${customerId}')">حذف</button>
      </div>
    `).join('') : '';

    const unrewardedAlert = (stats.count>=3 && rewards.length===0) ? `
      <div class="alert-banner warn" style="margin:8px 0;">
        <span class="ic">🎁</span>
        <div>${escapeHtml(c.name)} رشّح ${stats.count} عملاء ولسه ما أخدش أي مكافأة.</div>
      </div>
    ` : '';

    return `
      <div class="section-title" style="margin-top:14px;">🔗 الإحالات</div>
      ${unrewardedAlert}
      <div class="card">
        ${referredByLine || '<div class="meta">🔗 المصدر: غير معروف</div>'}
        <div class="row" style="margin-top:6px;"><h3>👥 عملاء رشّحهم ${escapeHtml(c.name)}</h3><b>${stats.count}</b></div>
        <div class="meta" style="margin-bottom:6px;">إجمالي قيمة إنفاقهم: <b>${stats.totalValue.toLocaleString('ar-EG')} ج.م</b></div>
        ${referredListHtml}
        <div class="btn-row" style="margin-top:8px;">
          <button class="btn sm secondary" onclick="openGiveRewardModal('${customerId}')">🎁 امنح مكافأة</button>
        </div>
        ${rewardsHtml ? `<div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--card-alt);">${rewardsHtml}</div>` : ''}
      </div>
    `;
  }

  function hookCustomerHistory(){
    if(typeof window.openCustomerHistory !== 'function') return;
    const orig = window.openCustomerHistory;
    window.openCustomerHistory = function(id){
      const r = orig.apply(this, arguments);
      const box = document.getElementById('modalBox');
      if(box) box.insertAdjacentHTML('beforeend', referralSectionHtml(id));
      return r;
    };
  }

  /* ---------- 3) لوحة أفضل المُرشِّحين ---------- */

  let leaderboardSortMode = 'count'; // count | value

  window.toggleReferralLeaderboardSort = function(){
    leaderboardSortMode = leaderboardSortMode==='count' ? 'value' : 'count';
    renderReferralLeaderboard();
  };

  function renderReferralLeaderboard(){
    const box = document.getElementById('referralLeaderboardCard');
    if(!box) return;
    ensureDefaults();
    let rows = db.customers.map(c=>{
      const stats = referralStats(c.id);
      return {c, ...stats};
    }).filter(r=>r.count>0);

    if(!rows.length){
      box.innerHTML = '';
      return;
    }

    rows.sort((a,b)=> leaderboardSortMode==='count' ? (b.count-a.count) : (b.totalValue-a.totalValue));
    rows = rows.slice(0,5);

    box.innerHTML = `
      <div class="card" style="margin-bottom:12px;">
        <div class="row"><h3>🏆 أفضل المُرشِّحين</h3>
          <button class="btn sm outline" style="padding:3px 10px;" onclick="toggleReferralLeaderboardSort()">↻ ${leaderboardSortMode==='count'?'ترتيب بالقيمة':'ترتيب بالعدد'}</button>
        </div>
        ${rows.map((r,i)=>`
          <div class="row" style="margin-bottom:4px;">
            <span>${i+1}. ${escapeHtml(r.c.name)}</span>
            <span class="meta">${leaderboardSortMode==='count' ? `${r.count} إحالة` : `${r.totalValue.toLocaleString('ar-EG')} ج.م`}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  function injectLeaderboardContainer(){
    if(document.getElementById('referralLeaderboardCard')) return;
    const list = document.getElementById('customersList');
    if(!list) return;
    const div = document.createElement('div');
    div.id = 'referralLeaderboardCard';
    list.insertAdjacentElement('beforebegin', div);
  }

  function hookRenderCustomers(){
    if(typeof window.renderCustomers !== 'function') return;
    const orig = window.renderCustomers;
    window.renderCustomers = function(){
      const r = orig.apply(this, arguments);
      injectLeaderboardContainer();
      renderReferralLeaderboard();
      return r;
    };
  }

  function boot(){
    ensureDefaults();
    hookCustomerModal();
    hookSaveCustomer();
    hookCustomerHistory();
    hookRenderCustomers();
    injectLeaderboardContainer();
    renderReferralLeaderboard();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
