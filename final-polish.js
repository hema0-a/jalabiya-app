/* ============================================================
   final-polish.js - اللمسات النهائية
   
   ✅ آمن 100% - يمكن حذفه بأمان
   
   المحتوى:
   1. لمسات بصرية أنيقة (خط ذهبي، ظلال، ألوان)
   2. تحسينات لمسية للموبايل
   3. معالج أخطاء عام (منع الشاشة البيضاء)
   4. تحسينات الأيقونات والرسوم
   ============================================================ */

(function() {
  if (window.__finalPolishLoaded) return;
  window.__finalPolishLoaded = true;
  
  console.log('🎨 تحميل final-polish.js...');
  
  // ═══════════════════════════════════════════════════════════════
  // 1. اللمسات البصرية الأنيقة
  // ═══════════════════════════════════════════════════════════════
  
  var style = document.createElement('style');
  style.id = 'finalPolishStyles';
  style.textContent = `
    /* ═══ خط ذهبي رفيع تحت العناوين الرئيسية ═══ */
    .section-title {
      position: relative;
      padding-bottom: 14px !important;
    }
    
    .section-title::after {
      content: "" !important;
      position: absolute !important;
      bottom: 6px !important;
      right: 0 !important;
      left: auto !important;
      width: 60px !important;
      height: 1.5px !important;
      background: linear-gradient(
        90deg,
        transparent 0%,
        var(--accent, #B8863B) 30%,
        var(--accent, #B8863B) 70%,
        transparent 100%
      ) !important;
      border-radius: 2px !important;
      opacity: 0.7 !important;
      animation: goldLineGlow 3s ease-in-out infinite !important;
    }
    
    @keyframes goldLineGlow {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 0.9; }
    }
    
    /* ═══ ظل ناعم جداً للبطاقات ═══ */
    .card {
      box-shadow:
        0 1px 2px rgba(20, 30, 25, 0.03),
        0 4px 12px rgba(20, 30, 25, 0.05) !important;
      transition: box-shadow 0.3s ease, transform 0.2s ease !important;
    }
    
    @media (hover: hover) {
      .card:hover {
        box-shadow:
          0 2px 4px rgba(20, 30, 25, 0.04),
          0 8px 20px rgba(20, 30, 25, 0.08) !important;
        transform: translateY(-1px);
      }
    }
    
    /* ═══ لمسات فاخرة على أرقام الإحصائيات ═══ */
    .stat-card .num {
      background: linear-gradient(
        135deg,
        var(--heading, #123C2F) 0%,
        var(--primary, #1F6D57) 100%
      );
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-weight: 900 !important;
      letter-spacing: -0.5px !important;
    }
    
    /* ═══ نقرات لمسية أنعم ═══ */
    .btn, .navbtn, .rc-chip, .meas-chip {
      -webkit-tap-highlight-color: transparent !important;
      -webkit-touch-callout: none !important;
      -webkit-user-select: none !important;
      user-select: none !important;
    }
    
    /* ═══ تحسين الأزرار عند اللمس ═══ */
    .btn:active {
      transform: scale(0.97) !important;
      transition: transform 0.08s ease !important;
    }
    
    .navbtn:active {
      background: var(--primary-light) !important;
    }
    
    /* ═══ أيقونة الشعار مع وهج خفيف ═══ */
    .brand-emblem {
      position: relative;
      overflow: hidden;
    }
    
    .brand-emblem::after {
      content: "";
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: linear-gradient(
        45deg,
        transparent 30%,
        rgba(255, 255, 255, 0.15) 50%,
        transparent 70%
      );
      animation: brandShine 6s ease-in-out infinite;
      pointer-events: none;
    }
    
    @keyframes brandShine {
      0% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
      50% { transform: translateX(100%) translateY(100%) rotate(45deg); }
      100% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
    }
    
    /* ═══ الفواصل بتصميم أنيق ═══ */
    hr.sep {
      border: none !important;
      height: 20px !important;
      background: none !important;
      position: relative;
      margin: 20px 0 !important;
    }
    
    hr.sep::before {
      content: "";
      position: absolute;
      top: 50%;
      left: 10%;
      right: 10%;
      height: 1px;
      background: linear-gradient(
        90deg,
        transparent 0%,
        var(--stitch, #C9B48C) 20%,
        var(--stitch, #C9B48C) 80%,
        transparent 100%
      );
      opacity: 0.5;
    }
    
    hr.sep::after {
      content: "◆";
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: var(--accent, #B8863B);
      font-size: 8px;
      background: var(--card, #fff);
      padding: 0 8px;
      opacity: 0.7;
    }
    
    /* ═══ شارات أنيقة ═══ */
    .badge {
      font-weight: 800 !important;
      letter-spacing: 0.2px !important;
    }
    
    /* ═══ أزرار أساسية مع توهج خفيف ═══ */
    .btn.accent {
      box-shadow:
        0 2px 8px rgba(184, 134, 59, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
    }
    
    .btn.accent:active {
      box-shadow:
        0 1px 4px rgba(184, 134, 59, 0.3),
        inset 0 2px 4px rgba(0, 0, 0, 0.1) !important;
    }
    
    /* ═══ الوضع الليلي - تعديلات ═══ */
    html[data-theme="dark"] .section-title::after {
      background: linear-gradient(
        90deg,
        transparent 0%,
        #D9A93D 30%,
        #D9A93D 70%,
        transparent 100%
      );
    }
    
    html[data-theme="dark"] .stat-card .num {
      background: linear-gradient(
        135deg,
        #8FD8BE 0%,
        #6FCDAA 100%
      );
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    
    html[data-theme="dark"] hr.sep::after {
      background: var(--card, #232622);
    }
    
    /* ═══ تحسين الطباعة ═══ */
    body {
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    
    /* ═══ نقاط PIN أنيقة ═══ */
    .pin-dot {
      transition: all 0.2s ease !important;
    }
    
    .pin-dot.filled {
      box-shadow: 0 0 12px rgba(184, 134, 59, 0.4) !important;
    }
    
    /* ═══ حقول الإدخال ═══ */
    .field input:focus,
    .field select:focus,
    .field textarea:focus {
      box-shadow:
        0 0 0 3px rgba(31, 109, 87, 0.1),
        0 0 0 1px var(--primary) !important;
      transition: box-shadow 0.2s ease !important;
    }
    
    /* ═══ تحسين الأيقونات في القائمة الجانبية ═══ */
    nav.sidenav .navbtn .ic {
      transition: transform 0.2s ease !important;
    }
    
    nav.sidenav .navbtn:active .ic {
      transform: scale(1.1) !important;
    }
    
    /* ═══ تحسين شاشة القفل ═══ */
    #lockScreen h1 {
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
      letter-spacing: 0.5px !important;
    }
    
    /* ═══ الطباعة - تحسينات ═══ */
    @media print {
      .card {
        box-shadow: none !important;
        border: 1px solid #ddd !important;
      }
    }
    
    /* ═══ دعم الشاشات ذات النوتش ═══ */
    @supports (padding: env(safe-area-inset-top)) {
      #app {
        padding-top: env(safe-area-inset-top, 0);
        padding-bottom: calc(90px + env(safe-area-inset-bottom, 0));
      }
      
      #lockScreen {
        padding: max(20px, env(safe-area-inset-top)) 20px max(20px, env(safe-area-inset-bottom));
      }
    }
    
    /* ═══ تحسينات الوضع المظلم للأيقونات ═══ */
    html[data-theme="dark"] .stat-card .stat-ic {
      background: rgba(31, 109, 87, 0.2);
    }
    
    /* ═══ تحسين بطاقات الالتزامات ═══ */
    #commitmentsList .card {
      border-inline-start-width: 4px;
    }
    
    /* ═══ تحسين الطلبات المستعجلة ═══ */
    .card.urgent-order {
      animation: urgentGlow 2.5s ease-in-out infinite !important;
    }
    
    @keyframes urgentGlow {
      0%, 100% {
        box-shadow:
          0 0 0 2px var(--danger, #A23B2C),
          0 1px 2px rgba(20, 30, 25, 0.03),
          0 4px 12px rgba(20, 30, 25, 0.05);
      }
      50% {
        box-shadow:
          0 0 0 3px var(--danger, #A23B2C),
          0 2px 6px rgba(162, 59, 44, 0.15),
          0 6px 16px rgba(162, 59, 44, 0.1);
      }
    }
    
    /* ═══ تحسين إضافي: تقليل الحركة لمن يفضّل ═══ */
    @media (prefers-reduced-motion: reduce) {
      .section-title::after,
      .brand-emblem::after,
      .card.urgent-order {
        animation: none !important;
      }
      
      .btn:active {
        transform: none !important;
      }
    }
  `;
  
  document.head.appendChild(style);
  console.log('✅ اللمسات البصرية مطبقة');
  
  // ═══════════════════════════════════════════════════════════════
  // 2. معالج أخطاء عام
  // ═══════════════════════════════════════════════════════════════
  
  var errorCount = 0;
  var MAX_ERRORS = 10;
  
  window.addEventListener('error', function(e) {
    errorCount++;
    
    console.error('🚨 خطأ غير معالج:', e.message);
    
    // ✅ لا تظهر رسالة خطأ أكثر من 10 مرات (لتفادي الإزعاج)
    if (errorCount > MAX_ERRORS) return;
    
    // ✅ أظهر رسالة لطيفة للمستخدم
    if (typeof window.toast === 'function') {
      window.toast('⚠️ حدث خطأ بسيط — التطبيق مستمر في العمل', 3000);
    }
  });
  
  window.addEventListener('unhandledrejection', function(e) {
    console.error('🚨 Promise مرفوض:', e.reason);
    
    // ✅ لا تظهر Promise rejections للمستخدم (قد تكون من fetch عادي)
  });
  
  console.log('✅ معالج الأخطاء جاهز');
  
  // ═══════════════════════════════════════════════════════════════
  // 3. تحسينات لمسية للموبايل
  // ═══════════════════════════════════════════════════════════════
  
  // ✅ إضافة تأثير لمسي عند اللمس (haptic feedback عند التوفر)
  function vibrate(pattern) {
    if (navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (e) {}
    }
  }
  
  // ✅ تأثير لمسي على الأزرار الأساسية
  document.addEventListener('touchstart', function(e) {
    var btn = e.target.closest('.btn.accent, .btn.primary, .fab');
    if (btn) vibrate(10);
  }, { passive: true });
  
  // ✅ تأثير لمسي عند حفظ ناجح
  var origSaveDB = window.saveDB;
  var lastVibrate = 0;
  if (typeof origSaveDB === 'function') {
    window.saveDB = function(emergency) {
      if (emergency && Date.now() - lastVibrate > 1000) {
        vibrate(15);
        lastVibrate = Date.now();
      }
      return origSaveDB.apply(this, arguments);
    };
  }
  
  console.log('✅ تحسينات لمسية جاهزة');
  
  // ═══════════════════════════════════════════════════════════════
  // 4. تحسين أرقام الإحصائيات
  // ═══════════════════════════════════════════════════════════════
  
  // ✅ إضافة كلاس للبطاقات (للظل الناعم)
  function enhanceStatCards() {
    var cards = document.querySelectorAll('.stat-card');
    cards.forEach(function(card) {
      if (card.dataset.polished) return;
      card.dataset.polished = '1';
    });
  }
  
  // ✅ طبّق التحسينات عند الرسم
  if (typeof window.renderHome === 'function' && !window.renderHome.__polishWrapped) {
    var origRenderHome = window.renderHome;
    window.renderHome = function() {
      var r = origRenderHome.apply(this, arguments);
      setTimeout(enhanceStatCards, 100);
      return r;
    };
    window.renderHome.__polishWrapped = true;
  }
  
  // ═══════════════════════════════════════════════════════════════
  // 5. تحسين شاشة القفل
  // ═══════════════════════════════════════════════════════════════
  
  // ✅ إضافة وهج عند ضغط أرقام PIN
  document.addEventListener('DOMContentLoaded', function() {
    var keypad = document.getElementById('keypad');
    if (keypad && !keypad.dataset.polished) {
      keypad.dataset.polished = '1';
      
      keypad.addEventListener('touchstart', function(e) {
        var btn = e.target.closest('button');
        if (btn) {
          btn.style.transform = 'scale(0.92)';
          btn.style.background = 'var(--accent)';
        }
      }, { passive: true });
      
      ['touchend', 'touchcancel'].forEach(function(ev) {
        keypad.addEventListener(ev, function(e) {
          var btn = e.target.closest('button');
          if (btn) {
            btn.style.transform = '';
            btn.style.background = '';
          }
        }, { passive: true });
      });
    }
  });
  
  // ═══════════════════════════════════════════════════════════════
  // 6. تحسين تحديث الصفحة
  // ═══════════════════════════════════════════════════════════════
  
  // ✅ احفظ البيانات قبل الإغلاق
  window.addEventListener('beforeunload', function() {
    if (typeof window.flushSaveDB === 'function') {
      window.flushSaveDB();
    }
  });
  
  // ═══════════════════════════════════════════════════════════════
  // 7. اختبار
  // ═══════════════════════════════════════════════════════════════
  
  window.testPolish = function() {
    console.log('🎨 اختبار اللمسات النهائية:');
    console.log('  - الستايل مطبّق:', !!document.getElementById('finalPolishStyles'));
    console.log('  - معالج الأخطاء:', errorCount, 'أخطاء');
    console.log('  - الاهتزاز مدعوم:', !!navigator.vibrate);
    console.log('  - Safe area مدعوم:', CSS.supports('padding', 'env(safe-area-inset-top)'));
    
    if (typeof window.toast === 'function') {
      window.toast('✅ اطلع على Console', 3000);
    }
  };
  
  console.log('✅ اكتملت اللمسات النهائية');
  console.log('🎨 خط ذهبي على العناوين');
  console.log('🎨 أرقام متدرجة اللون');
  console.log('🎨 ظلال ناعمة');
  console.log('🎨 معالج أخطاء جاهز');
  console.log('🎨 Safe area للشاشات ذات النوتش');
  
})();
