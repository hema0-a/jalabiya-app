/* ============================================================
   feature-topbar-and-expenses.js
   1) الشريط العلوي: تجميع 🌙 وضع الليل و🔒 قفل جوّه زرار قائمة
      منسدلة واحدة (⋮) بدل ما يكونوا ظاهرين منفصلين، عشان
      الشريط يبقى أنضف. (شارة الاتصال/الأوفلاين اتسابت برّه
      القائمة لأنها حالة مش إجراء — التفاصيل في رد الشات).
   2) مصاريف البيت: تجميع كل يوم في قائمة منسدلة (details/summary)
      لوحده — حتى لو فيه مصروف واحد بس في اليوم ده — بدل القائمة
      المسطحة، مع إجمالي كل يوم ظاهر جنب تاريخه.
   ملف مستقل، مش بيلمس core.js ولا patches.js.
   ============================================================ */
(function(){

  /* ---------- 1) قائمة الشريط العلوي المنسدلة ---------- */
  function labelize(btn){
    if(!btn || btn.querySelector('.topbar-menu-label')) return;
    const label = btn.getAttribute('aria-label');
    if(!label) return;
    const span = document.createElement('span');
    span.className = 'topbar-menu-label';
    span.style.cssText = 'margin-inline-start:8px;font-size:13px;';
    span.textContent = label;
    btn.appendChild(span);
  }

  function buildTopbarMenu(){
    const holder = document.querySelector('header.topbar > div:last-child');
    if(!holder) return;
    const lockBtn = holder.querySelector('.small-link');
    // كل الأزرار اللي بفئة theme-toggle-btn (الوضع الليلي، تباين عالٍ، وضع عرض للعميل، كثافة العرض)
    const toggleBtns = Array.from(holder.querySelectorAll('.theme-toggle-btn'));
    if(!toggleBtns.length && !lockBtn) return false; // الأزرار لسه ما اتحقنتش من patches.js، هنعيد المحاولة لاحقًا

    holder.style.position = 'relative';

    let menuBtn = document.getElementById('topbarMenuBtn');
    let panel = document.getElementById('topbarMenuPanel');
    if(!menuBtn){
      menuBtn = document.createElement('button');
      menuBtn.id = 'topbarMenuBtn';
      // [إصلاح] كان بياخد class="menu-btn" بالظبط زي زرار ☰ فتح القائمة
      // الجانبية الأساسي (index.html). أي كود بيدوّر بـ
      // document.querySelector('.menu-btn') كان بيلاقي الاتنين، ولو
      // ترتيبهم في الـ DOM اتغيّر (زي لو الملف ده اتحمّل قبل ما القائمة
      // الجانبية تتحقن، أو أي تعديل مستقبلي) كان ممكن ياخد الزرار الغلط
      // ويخلي "القائمة المنسدلة" تبان إنها مش شغالة. دلوقتي كل زرار
      // بكلاسه المستقل، وفيه كلاس مشترك تاني للتنسيق البصري بس.
      menuBtn.className = 'topbar-dots-btn';
      menuBtn.setAttribute('aria-label', 'قائمة الإعدادات السريعة');
      menuBtn.textContent = '⋮';
      menuBtn.style.cssText = 'color:#fff;font-size:22px;';
      holder.insertBefore(menuBtn, holder.firstChild);
      menuBtn.addEventListener('click', function(e){
        e.stopPropagation();
        panel.style.display = panel.style.display==='flex' ? 'none' : 'flex';
      });
      document.addEventListener('click', function(e){
        if(panel.style.display==='flex' && !panel.contains(e.target) && e.target!==menuBtn){
          panel.style.display = 'none';
        }
      });
    }
    if(!panel){
      panel = document.createElement('div');
      panel.id = 'topbarMenuPanel';
      panel.style.cssText = 'position:absolute;top:44px;left:0;background:var(--card);color:var(--text);border-radius:14px;box-shadow:var(--shadow-lift-2, 0 10px 24px rgba(0,0,0,.25));padding:6px;display:none;flex-direction:column;gap:2px;z-index:600;min-width:190px;';
      holder.appendChild(panel);
    }

    toggleBtns.forEach(btn=>{
      btn.classList.add('topbar-menu-item');
      btn.style.setProperty('display','flex','important');
      btn.style.setProperty('visibility','visible','important');
      btn.style.setProperty('opacity','1','important');
      btn.style.setProperty('position','static','important');
      labelize(btn);
      panel.appendChild(btn);
    });
    if(lockBtn){
      lockBtn.classList.add('topbar-menu-item');
      lockBtn.style.setProperty('display','flex','important');
      lockBtn.style.setProperty('visibility','visible','important');
      lockBtn.style.setProperty('opacity','1','important');
      lockBtn.style.setProperty('position','static','important');
      panel.appendChild(lockBtn);
    }
  }

  const topbarMenuCss = document.createElement('style');
  topbarMenuCss.textContent = `
    .topbar-dots-btn{
      background:rgba(255,255,255,0.15);border:none;color:#fff;width:36px;height:36px;
      border-radius:10px;font-size:22px;display:flex;align-items:center;justify-content:center;flex-shrink:0;
      cursor:pointer;
    }
    #topbarMenuPanel{
      background:var(--card) !important;
    }
    .topbar-menu-item, .topbar-menu-item *{
      color:var(--text) !important;
      -webkit-text-fill-color:var(--text) !important;
    }
    .topbar-menu-item{
      display:flex !important; align-items:center; justify-content:flex-start !important;
      width:100%; background:transparent !important;
      border-radius:10px !important; padding:10px 12px !important; font-size:14px !important;
      box-shadow:none !important; margin:0 !important;
    }
    .topbar-menu-item:hover{ background:var(--card-alt) !important; }
    .topbar-menu-item .lock-text{ display:inline !important; }
  `;
  document.head.appendChild(topbarMenuCss);

  /* ---------- 2) تجميع مصاريف البيت باليوم ---------- */
  function groupedHouseExpensesHtml(){
    const all = (db.houseExpenses||[]).slice().sort((a,b)=>b.date.localeCompare(a.date));
    if(!all.length) return `<div class="empty-msg">لا توجد مصاريف بيت مسجلة بعد</div>`;
    const groups = {};
    all.forEach(e=>{ (groups[e.date] = groups[e.date] || []).push(e); });
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

  if(typeof renderHouseExpenses === 'function'){
    const origRenderHouseExpenses = renderHouseExpenses;
    window.renderHouseExpenses = function(){
      const r = origRenderHouseExpenses.apply(this, arguments);
      const box = document.getElementById('houseExpensesList');
      if(box) box.innerHTML = groupedHouseExpensesHtml();
      return r;
    };
  }

  // [إصلاح] الكود القديم كان بيحاول يبني القائمة مرة واحدة بس عند
  // DOMContentLoaded، ولو الأزرار (theme-toggle-btn) لسه ما كانتش
  // اتحقنت من patches.js في اللحظة دي لأي سبب (تحميل بطيء، ترتيب
  // ملفات مختلف، إلخ)، الدالة كانت بترجع وتسيب "⋮" مش متبني خالص
  // للأبد — رغم إن التعليق بيقول "هنعيد المحاولة لاحقًا" من غير ما
  // فيه أي إعادة محاولة فعلية. دلوقتي بنعيد المحاولة كل 300ms لحد
  // ما تنجح (أو لحد 10 ثواني كحد أقصى كحماية من التكرار للأبد).
  function buildTopbarMenuWithRetry(){
    const ok = buildTopbarMenu();
    if(ok===false){
      let attempts = 0;
      const timer = setInterval(function(){
        attempts++;
        if(buildTopbarMenu()!==false || attempts>=33){ // ~10 ثواني
          clearInterval(timer);
        }
      }, 300);
    }
  }

  function boot(){
    buildTopbarMenuWithRetry();
    if(document.getElementById('houseExpensesList') && typeof renderHouseExpenses==='function') renderHouseExpenses();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
