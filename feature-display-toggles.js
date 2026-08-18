/* ============================================================
   feature-display-toggles.js
   🔘 استرجاع 3 أزرار كانت موجودة وضاعت من الهيدر: "👁️ وضع عرض
   للعميل"، "◐ تباين عالٍ"، "🔲 كثافة العرض". الـ CSS بتاعهم لسه
   موجود كامل في index.html (.high-contrast, .compact-view,
   .display-mode) — بس الأزرار والدوال اللي بتفعّلهم كانوا ناقصين.

   ملحوظة مهمة: فيه كود جاهز من قبل في patches.js بيجمع 5 أزرار
   (وضع ليلي + عرض للعميل + تباين + كثافة + قفل) في قائمة "⋮"
   واحدة — بس كان "نايم" لأنه مش لاقي الأزرار التلاتة دي. بمجرد ما
   نضيفهم بنفس الـ id المتوقع (displayModeBtn, contrastToggleBtn,
   densityToggleBtn)، القائمة المنسدلة هتشتغل لوحدها تلقائيًا من
   غير ما نلمس patches.js خالص.

   ملف مستقل، بيحقن 3 أزرار + CSS بسيط، مش بيلمس أي ملف تاني.
   ============================================================ */
(function(){

  function ensureDefaults(){
    if(db.displayMode===undefined) db.displayMode = false;
    if(db.highContrast===undefined) db.highContrast = false;
    if(db.compactView===undefined) db.compactView = false;
  }

  function applyDisplayMode(){
    const on = !!(db && db.displayMode);
    document.documentElement.classList.toggle('display-mode', on);
    const btn = document.getElementById('displayModeBtn');
    if(btn) btn.classList.toggle('active-display-mode', on);
  }
  window.toggleDisplayMode = function(){
    db.displayMode = !db.displayMode;
    saveDB();
    applyDisplayMode();
  };

  function applyHighContrast(){
    const on = !!(db && db.highContrast);
    document.documentElement.classList.toggle('high-contrast', on);
    const btn = document.getElementById('contrastToggleBtn');
    if(btn) btn.classList.toggle('icon-btn-active', on);
  }
  window.toggleHighContrast = function(){
    db.highContrast = !db.highContrast;
    saveDB();
    applyHighContrast();
  };

  function applyCompactView(){
    const on = !!(db && db.compactView);
    document.documentElement.classList.toggle('compact-view', on);
    const btn = document.getElementById('densityToggleBtn');
    if(btn) btn.classList.toggle('icon-btn-active', on);
  }
  window.toggleCompactView = function(){
    db.compactView = !db.compactView;
    saveDB();
    applyCompactView();
  };

  function injectStyles(){
    if(document.getElementById('displayTogglesStyles')) return;
    const style = document.createElement('style');
    style.id = 'displayTogglesStyles';
    style.textContent = `
      .icon-btn-active{ background:rgba(255,255,255,0.4) !important; }
    `;
    document.head.appendChild(style);
  }

  function injectButtons(){
    const holder = document.querySelector('header.topbar > div:last-child');
    if(!holder || document.getElementById('displayModeBtn')) return;
    const lockBtn = holder.querySelector('.small-link');

    const displayBtn = document.createElement('button');
    displayBtn.className = 'theme-toggle-btn';
    displayBtn.id = 'displayModeBtn';
    displayBtn.setAttribute('aria-label', 'وضع عرض للعميل');
    displayBtn.setAttribute('onclick', 'toggleDisplayMode()');
    displayBtn.textContent = '👁️';

    const contrastBtn = document.createElement('button');
    contrastBtn.className = 'theme-toggle-btn';
    contrastBtn.id = 'contrastToggleBtn';
    contrastBtn.setAttribute('aria-label', 'تباين عالٍ');
    contrastBtn.setAttribute('onclick', 'toggleHighContrast()');
    contrastBtn.textContent = '◐';

    const densityBtn = document.createElement('button');
    densityBtn.className = 'theme-toggle-btn';
    densityBtn.id = 'densityToggleBtn';
    densityBtn.setAttribute('aria-label', 'كثافة العرض');
    densityBtn.setAttribute('onclick', 'toggleCompactView()');
    densityBtn.textContent = '🔲';

    // الترتيب: وضع ليلي (موجود) - عرض للعميل - تباين - كثافة - قفل (موجود)
    if(lockBtn){
      holder.insertBefore(displayBtn, lockBtn);
      holder.insertBefore(contrastBtn, lockBtn);
      holder.insertBefore(densityBtn, lockBtn);
    } else {
      holder.appendChild(displayBtn);
      holder.appendChild(contrastBtn);
      holder.appendChild(densityBtn);
    }
  }

  function boot(){
    ensureDefaults();
    injectStyles();
    injectButtons();
    applyDisplayMode();
    applyHighContrast();
    applyCompactView();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
