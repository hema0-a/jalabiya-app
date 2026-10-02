/* ============================================================
   mobile-boost.js - تحسينات الموبايل (آمنة)
   
   ✅ إضافات فقط (لا تحذف ولا تعدل أي شيء موجود)
   ✅ يمكن حذفه بأمان (احذف السطر من index.html فقط)
   ✅ لا يتفاعل مع أي منطق في التطبيق
   
   التحسينات:
   1. منع السحب للتحديث (Pull-to-Refresh)
   2. منع التكبير المزدوج بالخطأ
   3. دعم الشاشات ذات النوتش (Safe Area)
   4. رد فعل أفضل عند لمس الأزرار
   5. منع تكبير الخط التلقائي في iOS
   ============================================================ */

(function() {
  if (window.__mobileBoostLoaded) return;
  window.__mobileBoostLoaded = true;

  console.log('📱 تحميل mobile-boost.js...');

  // ═══════════════════════════════════════════════════════════════
  // 1. منع السحب للتحديث + منع التكبير المزدوج + دعم النوتش
  // ═══════════════════════════════════════════════════════════════
  
  var style = document.createElement('style');
  style.id = 'mobileBoostStyles';
  style.textContent = `
    /* منع overscroll (منع السحب للتحديث + التمرير المطاطي) */
    html, body {
      overscroll-behavior-y: none;
      overscroll-behavior-x: none;
    }
    
    /* منع تحديد النص العرضي على الأزرار */
    button, .btn, .navbtn, .fab, .settings-tab-btn {
      -webkit-tap-highlight-color: transparent;
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      user-select: none;
    }
    
    /* منع تكبير الخط التلقائي في iOS عند التركيز على حقل */
    @media screen and (max-width: 768px) {
      input, select, textarea {
        font-size: 16px !important;
      }
    }
    
    /* دعم الشاشات ذات النوتش (iPhone X+ وAndroid) */
    @supports (padding: env(safe-area-inset-top)) {
      header.topbar {
        padding-top: max(20px, calc(env(safe-area-inset-top) + 12px)) !important;
      }
      nav.sidenav {
        padding-top: max(14px, calc(env(safe-area-inset-top) + 10px)) !important;
        padding-bottom: max(14px, calc(env(safe-area-inset-bottom) + 10px)) !important;
      }
      .fab {
        bottom: max(22px, calc(env(safe-area-inset-bottom) + 22px)) !important;
      }
      #scrollTopBtn {
        bottom: max(22px, calc(env(safe-area-inset-bottom) + 22px)) !important;
      }
      .toast {
        bottom: max(30px, calc(env(safe-area-inset-bottom) + 30px)) !important;
      }
      .modal-box {
        padding-bottom: max(18px, calc(env(safe-area-inset-bottom) + 18px)) !important;
      }
    }
    
    /* لمسات أنعم (رد فعل فوري) */
    .btn, .navbtn, button {
      transition: transform 0.08s ease-out, background 0.12s, opacity 0.12s;
      -webkit-tap-highlight-color: transparent;
    }
    .btn:active, .navbtn:active {
      transform: scale(0.97);
    }
    
    /* منع الاهتزاز العرضي عند النقر */
    * {
      -webkit-tap-highlight-color: transparent;
    }
    
    /* أزرار أصغر حد 44px (معيار Apple/Google) */
    .btn, button.btn {
      min-height: 44px;
    }
    .btn.sm {
      min-height: 36px;
    }
    
    /* تحسين أداء التمرير */
    .page, .modal-box, nav.sidenav, .kanban-wrap, #customersList, #ordersList {
      -webkit-overflow-scrolling: touch;
    }
    
    /* منع اهتزاز الصفحة عند الفتح (iOS) */
    body {
      -webkit-text-size-adjust: 100%;
      text-size-adjust: 100%;
      -webkit-font-smoothing: antialiased;
    }
  `;
  document.head.appendChild(style);

  // ═══════════════════════════════════════════════════════════════
  // 2. منع التكبير المزدوج (Double-tap Zoom) - أكثر أماناً
  // ═══════════════════════════════════════════════════════════════
  
  var lastTouchEnd = 0;
  document.addEventListener('touchend', function(e) {
    var now = Date.now();
    if (now - lastTouchEnd <= 300) {
      // تجاهل التكبير لو اللمسة على زر أو رابط (لأنها قد تكون ضغطة مزدوجة فعلية)
      if (!e.target.closest('button, a, .btn, input, select, textarea, label')) {
        e.preventDefault();
      }
    }
    lastTouchEnd = now;
  }, { passive: false });

  // ═══════════════════════════════════════════════════════════════
  // 3. منع السحب للتحديث (Pull-to-Refresh) - فقط عندما نكون في الأعلى
  // ═══════════════════════════════════════════════════════════════
  
  var startY = 0;
  var startScrollY = 0;

  document.addEventListener('touchstart', function(e) {
    if (e.touches.length !== 1) return;
    startY = e.touches[0].clientY;
    startScrollY = window.scrollY || document.documentElement.scrollTop || 0;
  }, { passive: true });

  document.addEventListener('touchmove', function(e) {
    if (e.touches.length !== 1) return;
    
    // تجاهل السحب داخل المودال أو القائمة الجانبية
    if (e.target.closest('.modal-box, nav.sidenav, #ordersList .card, .kanban-wrap')) return;
    
    var y = e.touches[0].clientY;
    var dy = y - startY;
    
    // إذا كنا في أعلى الصفحة ونسحب لأسفل بقوة -> امنع
    if (startScrollY <= 0 && dy > 10) {
      e.preventDefault();
    }
  }, { passive: false });

  // ═══════════════════════════════════════════════════════════════
  // 4. تحسين سلوك لوحة المفاتيح (إخفاء العناصر عند الفتح)
  // ═══════════════════════════════════════════════════════════════
  
  if (window.visualViewport) {
    var keyboardThreshold = 150;
    
    window.visualViewport.addEventListener('resize', function() {
      var heightDiff = window.innerHeight - window.visualViewport.height;
      var keyboardOpen = heightDiff > keyboardThreshold;
      
      // إخفاء الزر العائم إذا كانت لوحة المفاتيح مفتوحة
      var fab = document.getElementById('fabAdd');
      if (fab) {
        fab.style.display = keyboardOpen ? 'none' : '';
      }
    });
  }

  console.log('✅ تم تحميل mobile-boost.js');
  console.log('   - منع السحب للتحديث');
  console.log('   - منع التكبير المزدوج');
  console.log('   - دعم الشاشات ذات النوتش');
  console.log('   - رد فعل أنعم للمس');
  console.log('   - سلوك أفضل للوحة المفاتيح');

})();
