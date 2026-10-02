/* ============================================================
   final-polish.js - v2 (نسخة آمنة)
   
   ✅ إضافات CSS بسيطة فقط
   ✅ بدون animations معقدة
   ✅ لا يتعارض مع أي ميزة
   ============================================================ */

(function() {
  if (window.__finalPolishV2Loaded) return;
  window.__finalPolishV2Loaded = true;
  
  console.log('🎨 تحميل final-polish.js v2...');
  
  var style = document.createElement('style');
  style.id = 'finalPolishStyles';
  style.textContent = `
    /* ═══ خط ذهبي أنيق تحت العناوين (بدون animation) ═══ */
    .section-title {
      position: relative;
      padding-bottom: 12px;
      border-bottom: none !important;
    }
    
    .section-title::after {
      content: "";
      position: absolute;
      bottom: 4px;
      right: 0;
      width: 50px;
      height: 2px;
      background: linear-gradient(90deg, transparent, #B8863B, transparent);
      border-radius: 2px;
      opacity: 0.6;
    }
    
    /* ═══ ظلال ناعمة للبطاقات ═══ */
    .card {
      box-shadow: 0 1px 3px rgba(20, 30, 25, 0.04) !important;
    }
    
    /* ═══ تأثير لمسي بسيط ═══ */
    .btn:active {
      transform: scale(0.98);
    }
    
    /* ═══ أيقونات الإحصائيات بلون خفيف ═══ */
    .stat-card .stat-ic {
      opacity: 0.9;
    }
    
    /* ═══ تقليل الحركة إذا فضّل المستخدم ═══ */
    @media (prefers-reduced-motion: reduce) {
      * {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }
    
    /* ═══ دعم النوتش ═══ */
    @supports (padding: env(safe-area-inset-top)) {
      header.topbar {
        padding-top: max(20px, calc(env(safe-area-inset-top) + 10px));
      }
    }
  `;
  
  document.head.appendChild(style);
  
  // ═══ إخفاء التأثيرات القديمة إذا وُجدت ═══
  var oldStyle = document.getElementById('finalPolishStyles');
  if (oldStyle && oldStyle !== style) {
    oldStyle.remove();
  }
  
  // ═══ معالج أخطاء بسيط ═══
  window.addEventListener('error', function(e) {
    console.error('خطأ غير معالج:', e.message);
  });
  
  console.log('✅ final-polish.js v2 جاهز');
})();
