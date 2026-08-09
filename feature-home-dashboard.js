/* ============================================================
   feature-home-dashboard.js
   🏠 لوحة تحكم سريعة أعلى الصفحة الرئيسية: 4 مؤشرات في بطاقة واحدة
   بدل ما المستخدم يفتح صفحات متفرقة كل مرة:
   1) 💰 صافي اليوم — إيراد النهاردة مقابل الحد الأدنى المطلوب
   2) 📅 أقرب تسليم — أقرب طلب لسه هيتسلّم
   3) ⚠️ أهم تنبيه — أهم حاجة تستاهل انتباه دلوقتي (متأخر/عجز/التزام)
   4) 💡 نصيحة اليوم — نفس نصيحة اليوم من feature-daily-tips.js
   كل مؤشر قابل للنقر وبيودّي لصفحته. ملف مستقل، بيلف renderHome
   وبيحقن حاويته أعلى صفحة الرئيسية، مش بيلمس أي ملف تاني.
   ============================================================ */
(function(){

  function todayRevenue(){
    const today = todayStr();
    return (db.payments||[]).filter(p=>p.date===today).reduce((s,p)=>s+Number(p.amount||0),0);
  }

  function requiredToday(){
    try{ return calcRequiredDailyCapacity().total; }catch(e){ return null; }
  }

  function nearestDelivery(){
    const upcoming = (db.orders||[]).filter(o=>o.status!=='تم التسليم')
      .sort((a,b)=>(a.dateDelivery||'').localeCompare(b.dateDelivery||''));
    return upcoming[0] || null;
  }

  // بيختار أهم تنبيه واحد بس حسب أولوية: متأخر > عجز يومي كبير > التزام قرب يخلص > مفيش تنبيهات
  function topAlert(){
    const lateCount = (db.orders||[]).filter(typeof isOverdue==='function' ? isOverdue : ()=>false).length;
    if(lateCount>0){
      return {text:`⏰ عندك ${lateCount} طلب متأخر عن التسليم`, action:()=>showPage('orders'), tone:'danger'};
    }
    const req = requiredToday();
    if(req!=null){
      const capacity = Number(db.dailyCapacity)||500;
      const rev = todayRevenue();
      const stillNeeded = req - rev;
      if(stillNeeded > capacity*0.5){
        return {text:`📉 لسه محتاج تحصّل ${Math.ceil(stillNeeded).toLocaleString('ar-EG')} ج.م النهاردة`, action:()=>showPage('personal'), tone:'warn'};
      }
    }
    if(typeof endingSoonCommitments==='function'){
      const ending = endingSoonCommitments();
      if(ending && ending.length){
        return {text:`🔔 ${ending.length} التزام هيخلص خلال شهرين`, action:()=>showPage('personal'), tone:'warn'};
      }
    }
    return {text:'✅ مفيش تنبيهات — كله تمام', action:null, tone:'ok'};
  }

  function dailyTipShort(){
    if(db.dailyTipCache && db.dailyTipCache.date===todayStr() && db.dailyTipCache.text){
      const t = db.dailyTipCache.text;
      return t.length>60 ? t.slice(0,58)+'…' : t;
    }
    return null;
  }

  function toneColor(tone){
    if(tone==='danger') return 'var(--danger)';
    if(tone==='warn') return 'var(--warn)';
    return 'var(--primary)';
  }

  function renderDashboard(){
    const box = document.getElementById('homeDashboardCard');
    if(!box) return;

    const rev = todayRevenue();
    const req = requiredToday();
    const revOk = req==null ? true : rev>=req;
    const nd = nearestDelivery();
    const alert = topAlert();
    const tip = dailyTipShort();

    const revenueCell = `
      <div class="dash-cell" onclick="showPage('personal')" style="cursor:pointer;">
        <div class="dash-lbl">💰 صافي اليوم</div>
        <div class="dash-val" style="color:${revOk?'var(--primary)':'var(--danger)'};">${rev.toLocaleString('ar-EG')} ج.م</div>
        ${req!=null ? `<div class="dash-sub">من ${Math.ceil(req).toLocaleString('ar-EG')} مطلوب</div>` : ''}
      </div>
    `;

    const deliveryCell = nd ? (()=>{
      const c = customerById(nd.customerId);
      return `
        <div class="dash-cell" onclick="showPage('orders')" style="cursor:pointer;">
          <div class="dash-lbl">📅 أقرب تسليم</div>
          <div class="dash-val" style="font-size:14px;">${c?escapeHtml(c.name):'عميل محذوف'}</div>
          <div class="dash-sub">${fmtDate(nd.dateDelivery)}</div>
        </div>
      `;
    })() : `
      <div class="dash-cell">
        <div class="dash-lbl">📅 أقرب تسليم</div>
        <div class="dash-sub">لا يوجد طلبات قيد العمل</div>
      </div>
    `;

    const alertCell = `
      <div class="dash-cell" ${alert.action?'style="cursor:pointer;"':''} ${alert.action?`onclick="window.__dashAlertAction && window.__dashAlertAction()"`:''}>
        <div class="dash-lbl">⚠️ أهم تنبيه</div>
        <div class="dash-val" style="font-size:13px;color:${toneColor(alert.tone)};line-height:1.5;">${escapeHtml(alert.text)}</div>
      </div>
    `;
    window.__dashAlertAction = alert.action || null;

    const tipCell = tip ? `
      <div class="dash-cell" onclick="showPage('financial-overview')" style="cursor:pointer;">
        <div class="dash-lbl">💡 نصيحة اليوم</div>
        <div class="dash-val" style="font-size:12.5px;font-weight:600;line-height:1.5;">${escapeHtml(tip)}</div>
      </div>
    ` : `
      <div class="dash-cell" onclick="showPage('financial-overview')" style="cursor:pointer;">
        <div class="dash-lbl">💡 نصيحة اليوم</div>
        <div class="dash-sub">افتح "نظرة مالية شاملة" لتشوفها</div>
      </div>
    `;

    box.innerHTML = `
      <div class="card" id="homeDashboardInner">
        <div class="dash-grid">
          ${revenueCell}
          ${deliveryCell}
          ${alertCell}
          ${tipCell}
        </div>
      </div>
    `;
  }

  function injectStyles(){
    if(document.getElementById('homeDashboardStyles')) return;
    const style = document.createElement('style');
    style.id = 'homeDashboardStyles';
    style.textContent = `
      .dash-grid{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }
      .dash-cell{ background:var(--card-alt); border-radius:12px; padding:10px 12px; min-height:64px; }
      .dash-lbl{ font-size:11.5px; opacity:.7; margin-bottom:4px; font-weight:700; }
      .dash-val{ font-size:16px; font-weight:800; }
      .dash-sub{ font-size:11.5px; opacity:.65; margin-top:2px; }
    `;
    document.head.appendChild(style);
  }

  function injectContainer(){
    if(document.getElementById('homeDashboardCard')) return;
    const anchor = document.getElementById('homeQuickActionsWrap');
    if(!anchor) return;
    const div = document.createElement('div');
    div.id = 'homeDashboardCard';
    div.style.marginBottom = '12px';
    anchor.insertAdjacentElement('beforebegin', div);
  }

  function hookRenderHome(){
    if(typeof window.renderHome !== 'function') return;
    const orig = window.renderHome;
    window.renderHome = function(){
      const r = orig.apply(this, arguments);
      injectContainer();
      renderDashboard();
      return r;
    };
  }

  function boot(){
    injectStyles();
    injectContainer();
    hookRenderHome();
    if(document.getElementById('page-home')) renderDashboard();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
