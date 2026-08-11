/* ============================================================
   feature-craft-visuals-2.js
   🎨 دفعة تصاميم مبهرة جديدة، مرتبطة بجوهر حرفة الخياطة/التفصيل:
   1) ✂️ حركة "قص الخيط" عند تسجيل طلب كـ"تم التسليم"
   2) 🧵 شارة "عميل مخلص" (تصميم يشبه التطريز) بدل شارة VIP
      للعملاء اللي عدّوا حد معين من الطلبات
   3) 🪡 نقشة تطريز خفيفة جدًا (شفافية ~5%) خلف شاشة القفل
   4) ✍️ عنوان الترحيب في الصفحة الرئيسية بخط عربي يشبه التوقيع
      اليدوي (خط "Aref Ruqaa" — خط الرقعة، أساس الخط اليدوي العربي)
   5) 🧵 شارة "جاهز للتسليم" بشكل بكرة خيط ملفوفة بدل النقطة العادية
   6) 👔 أزرار التبديل (checkbox) في الإعدادات بشكل "زرار قميص"
      بدل الشكل الافتراضي للمتصفح

   ملف مستقل تمامًا: بيحقن الـ CSS والخطوط بنفسه، وبيلف (wrap) دوال
   موجودة (markOrderDelivered, saveOrder, renderCustomers) من غير
   ما يلمس core.js أو patches.js أو أي ملف تاني. لازم يتحمّل آخر
   واحد (بعد كل ملفات feature-*) عشان يلف النسخة النهائية من الدوال.
   ============================================================ */
(function(){
  if(window.__craftVisuals2Loaded) return;
  window.__craftVisuals2Loaded = true;

  function prefersReducedMotion(){
    return typeof window.matchMedia==='function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ============================================================
     0) حقن الخط اليدوي + كل الـ CSS الخاص بالدفعة دي في مكان واحد
     ============================================================ */
  function injectFont(){
    if(document.getElementById('craftHandwritingFont')) return;
    const link = document.createElement('link');
    link.id = 'craftHandwritingFont';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@400;700&display=swap';
    document.head.appendChild(link);
  }

  function injectStyles(){
    if(document.getElementById('craftVisuals2Styles')) return;
    const style = document.createElement('style');
    style.id = 'craftVisuals2Styles';
    style.textContent = `
      /* ---------- 1) حركة قص الخيط ---------- */
      .thread-cut-overlay{
        position:fixed; left:0; right:0; top:20%;
        display:flex; align-items:center; justify-content:center;
        z-index:10000; pointer-events:none;
      }
      .thread-cut-line{
        position:relative; width:min(74vw, 340px); height:0;
      }
      .thread-cut-line .tc-half{
        position:absolute; top:0; width:50%; height:0;
        border-top:3px dashed var(--accent, #B8863B);
        opacity:.95;
      }
      .thread-cut-line .tc-left{ right:50%; transform-origin:right center; animation:tcLeftSnap .6s .3s ease-out forwards; }
      .thread-cut-line .tc-right{ left:50%; transform-origin:left center; animation:tcRightSnap .6s .3s ease-out forwards; }
      @keyframes tcLeftSnap{ to{ transform:translateX(-16px) rotate(-7deg); opacity:0; } }
      @keyframes tcRightSnap{ to{ transform:translateX(16px) rotate(7deg); opacity:0; } }
      .thread-cut-scissor{
        position:absolute; left:50%; top:0; font-size:22px; line-height:1;
        transform:translate(-50%,-50%) scale(.5) rotate(-15deg); opacity:0;
        animation:tcScissor 1s ease-out forwards;
        filter:drop-shadow(0 2px 3px rgba(0,0,0,.25));
      }
      @keyframes tcScissor{
        0%{ opacity:0; transform:translate(-50%,-50%) scale(.5) rotate(-15deg); }
        28%{ opacity:1; transform:translate(-50%,-50%) scale(1.08) rotate(8deg); }
        50%{ transform:translate(-50%,-50%) scale(1) rotate(-4deg); }
        78%{ opacity:1; }
        100%{ opacity:0; transform:translate(-50%,-50%) scale(.85) rotate(0deg) translateY(8px); }
      }

      /* ---------- 2) شارة عميل مخلص (تطريز) ---------- */
      .badge.loyal{
        background:transparent !important; color:var(--accent-dark) !important;
        border:1.5px dashed var(--accent);
      }
      html[data-theme="dark"] .badge.loyal{ color:var(--accent) !important; }

      /* ---------- 3) نقشة تطريز خفيفة خلف شاشة القفل ---------- */
      #lockScreen{
        background:
          radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1.4px) 0 0/22px 22px,
          radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1.4px) 11px 11px/22px 22px,
          repeating-linear-gradient(-45deg, rgba(255,255,255,0.035) 0 2px, transparent 2px 26px),
          linear-gradient(165deg,var(--primary-dark) 0%,#0D2A21 55%,var(--primary-dark) 100%) !important;
      }

      /* ---------- 4) عنوان الترحيب بخط يدوي ---------- */
      #homeGreetingHero .ghe-text{
        font-family:"Aref Ruqaa","El Messiri",var(--font-display);
        font-size:20px; font-weight:700; line-height:1.3;
      }

      /* ---------- 5) شارة "جاهز للتسليم" شكل بكرة خيط ---------- */
      .badge.ready::before{
        width:12px; height:12px; border-radius:50%;
        background:repeating-conic-gradient(currentColor 0deg 16deg, transparent 16deg 32deg);
        opacity:.9;
      }

      /* ---------- 6) أزرار تبديل شكل "زرار قميص" ----------
         بتستثني مربعات الاختيار المتعددة (تحديد جماعي/فلتر)
         عشان تفضل شكل checkbox عادي واضح للاختيار المتعدد */
      input[type="checkbox"]:not(.bulkChk):not(#clusterOnlyWip){
        appearance:none; -webkit-appearance:none;
        width:42px !important; height:24px !important;
        border-radius:14px; background:var(--border); border:1px solid var(--border);
        position:relative; cursor:pointer; flex-shrink:0;
        transition:background .2s, border-color .2s;
        vertical-align:middle;
      }
      input[type="checkbox"]:not(.bulkChk):not(#clusterOnlyWip)::before{
        content:""; position:absolute; top:2px; right:2px; width:18px; height:18px;
        border-radius:50%; background:#fff;
        box-shadow:0 1px 3px rgba(0,0,0,.25);
        transition:transform .2s;
      }
      input[type="checkbox"]:not(.bulkChk):not(#clusterOnlyWip):checked{
        background:var(--accent); border-color:var(--accent);
      }
      input[type="checkbox"]:not(.bulkChk):not(#clusterOnlyWip):checked::before{
        transform:translateX(-18px);
      }
      html.high-contrast input[type="checkbox"]:not(.bulkChk):not(#clusterOnlyWip){
        appearance:auto !important; -webkit-appearance:checkbox !important;
        width:20px !important; height:20px !important; background:none !important; border:none !important;
      }
      html.high-contrast input[type="checkbox"]:not(.bulkChk):not(#clusterOnlyWip)::before{ display:none; }
    `;
    document.head.appendChild(style);
  }

  /* ============================================================
     1) حركة قص الخيط عند تسجيل طلب كـ"تم التسليم"
     بنلف markOrderDelivered (مسار الدور/الكانبان) و saveOrder
     (مسار حفظ نموذج تعديل الطلب) بس — changeOrderStatus بترجع أصلاً
     لـ markOrderDelivered لما الحالة الجديدة "تم التسليم"، فلفّها
     منفصل هيكرر الحركة مرتين لنفس الحدث.
     ============================================================ */
  function isOrderDelivered(id){
    const o = (db.orders||[]).find(x=>x.id===id);
    return !!(o && o.status==='تم التسليم');
  }

  function playThreadCut(){
    if(prefersReducedMotion()) return;
    const existing = document.querySelector('.thread-cut-overlay');
    if(existing) existing.remove();
    const div = document.createElement('div');
    div.className = 'thread-cut-overlay';
    div.innerHTML = `
      <div class="thread-cut-line">
        <span class="tc-half tc-left"></span>
        <span class="tc-half tc-right"></span>
        <span class="thread-cut-scissor">✂️</span>
      </div>
    `;
    document.body.appendChild(div);
    setTimeout(()=>{ div.remove(); }, 1400);
  }

  function hookDeliveryAnimations(){
    if(typeof window.markOrderDelivered==='function'){
      const origMark = window.markOrderDelivered;
      window.markOrderDelivered = function(orderId){
        const before = isOrderDelivered(orderId);
        const r = origMark.apply(this, arguments);
        if(!before && isOrderDelivered(orderId)) playThreadCut();
        return r;
      };
    }
    if(typeof window.saveOrder==='function'){
      const origSave = window.saveOrder;
      window.saveOrder = async function(id){
        const before = id ? isOrderDelivered(id) : false;
        const r = await origSave.apply(this, arguments);
        if(id && !before && isOrderDelivered(id)) playThreadCut();
        return r;
      };
    }
  }

  /* ============================================================
     2) شارة "عميل مخلص" بدل شارة VIP للعملاء اللي طلباتهم أكتر
     من حد معين (أعلى من حد VIP بـ 7 طلبات). بندوّر على العميل
     المطابق بالاسم في البطاقة المعروضة، وبنبدّل شكل شارة VIP
     الموجودة بدل ما نضيف شارة تانية (تفادي أي مشكلة في المساحة).
     ============================================================ */
  function loyalThreshold(){
    return (Number(db.vipThreshold)||3) + 7;
  }

  function applyLoyalBadges(){
    const container = document.getElementById('customersList');
    if(!container) return;
    container.querySelectorAll('.card').forEach(card=>{
      const nameRow = card.querySelector('.name-row');
      if(!nameRow) return;
      const vipBadge = nameRow.querySelector('.badge');
      if(!vipBadge) return;
      const clone = nameRow.cloneNode(true);
      const av = clone.querySelector('.avatar'); if(av) av.remove();
      const bd = clone.querySelector('.badge'); if(bd) bd.remove();
      const name = clone.textContent.trim();
      if(!name) return;
      const match = (db.customers||[]).find(c=>c.name===name);
      if(!match) return;
      const count = (db.orders||[]).filter(o=>o.customerId===match.id).length;
      if(count >= loyalThreshold()){
        vipBadge.className = 'badge loyal';
        vipBadge.innerHTML = '🧵 عميل مخلص';
      }
    });
  }

  function hookLoyalBadges(){
    if(typeof window.renderCustomers!=='function') return;
    const orig = window.renderCustomers;
    window.renderCustomers = function(){
      const r = orig.apply(this, arguments);
      applyLoyalBadges();
      return r;
    };
  }

  function boot(){
    injectFont();
    injectStyles();
    hookDeliveryAnimations();
    hookLoyalBadges();
    if(document.getElementById('customersList')) applyLoyalBadges();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
