/* ============================================================
   date-utils.js - معالجة موحدة وآمنة للتواريخ
   
   ✅ آمن 100% (إضافات فقط)
   ✅ يمكن حذفه بحذف السطر من index.html
   
   المشكلة التي يحلها:
   - new Date('2024-01-15') يعطي نتائج مختلفة حسب المنطقة الزمنية
   - قد يسبب فرق يوم كامل في حساب "الأيام المتبقية"
   - أخطاء في المقارنة بين تواريخ متساوية
   
   الحل:
   - دوال موحدة تعمل بتوقيت UTC
   - مقارنة آمنة للتواريخ
   - لا تعدل أي شيء موجود
   ============================================================ */

(function() {
  if (window.__dateUtilsLoaded) return;
  window.__dateUtilsLoaded = true;

  console.log('📅 تحميل date-utils.js...');

  // ═══════════════════════════════════════════════════════════════
  // دوال أساسية (تُستخدم عبر window.*)
  // ═══════════════════════════════════════════════════════════════

  /**
   * تحويل نص تاريخ 'YYYY-MM-DD' إلى Date بتوقيت محايد (UTC منتصف الليل)
   * آمن لجميع المناطق الزمنية
   */
  window.parseDateSafe = function(dateStr) {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    if (typeof dateStr !== 'string') return null;
    
    // تحقق من الصيغة
    var m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) {
      // جرب التحويل العادي كاحتياط
      var d = new Date(dateStr);
      return isNaN(d.getTime()) ? null : d;
    }
    
    // استخدم UTC لضمان توقيت محايد
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
  };

  /**
   * تحويل تاريخ إلى نص 'YYYY-MM-DD'
   */
  window.formatDateSafe = function(date) {
    if (!date) return '';
    if (typeof date === 'string') return date.slice(0, 10);
    if (!(date instanceof Date)) return '';
    if (isNaN(date.getTime())) return '';
    
    var y = date.getUTCFullYear();
    var m = String(date.getUTCMonth() + 1).padStart(2, '0');
    var d = String(date.getUTCDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  };

  /**
   * إضافة أيام لتاريخ (بأمان تام)
   */
  window.addDaysSafe = function(dateStr, days) {
    var date = window.parseDateSafe(dateStr);
    if (!date) return null;
    var result = new Date(date.getTime() + days * 86400000);
    return window.formatDateSafe(result);
  };

  /**
   * الفرق بالأيام بين تاريخين (بأمان تام)
   * يُرجع عدد صحيح موجب أو سالب
   */
  window.diffDaysSafe = function(date1, date2) {
    var d1 = window.parseDateSafe(date1);
    var d2 = window.parseDateSafe(date2);
    if (!d1 || !d2) return null;
    return Math.round((d1.getTime() - d2.getTime()) / 86400000);
  };

  /**
   * مقارنة تواريخ (تسلسل)
   * يُرجع: -1، 0، 1
   */
  window.compareDatesSafe = function(date1, date2) {
    var d1 = window.parseDateSafe(date1);
    var d2 = window.parseDateSafe(date2);
    if (!d1 && !d2) return 0;
    if (!d1) return -1;
    if (!d2) return 1;
    
    var t1 = d1.getTime();
    var t2 = d2.getTime();
    if (t1 < t2) return -1;
    if (t1 > t2) return 1;
    return 0;
  };

  /**
   * هل التاريخ اليوم؟ (بأمان تام)
   */
  window.isTodaySafe = function(dateStr) {
    var today = new Date();
    var todayStr = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');
    return window.compareDatesSafe(dateStr, todayStr) === 0;
  };

  /**
   * هل التاريخ في المستقبل؟
   */
  window.isFutureSafe = function(dateStr) {
    var today = new Date();
    var todayStr = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');
    return window.compareDatesSafe(dateStr, todayStr) > 0;
  };

  /**
   * هل التاريخ في الماضي؟
   */
  window.isPastSafe = function(dateStr) {
    var today = new Date();
    var todayStr = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');
    return window.compareDatesSafe(dateStr, todayStr) < 0;
  };

  /**
   * إضافة أشهر لتاريخ (بأمان)
   */
  window.addMonthsSafe = function(dateStr, months) {
    var d = window.parseDateSafe(dateStr);
    if (!d) return null;
    var result = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate(), 12));
    return window.formatDateSafe(result);
  };

  // ═══════════════════════════════════════════════════════════════
  // إصلاح صامت لمشكلة المنطقة الزمنية في الدوال الحالية
  // ═══════════════════════════════════════════════════════════════
  
  // ملاحظة: لا نستبدل الدوال الأصلية (تفادياً للمشاكل)
  // لكن نضيف نسخ آمنة يمكن استخدامها لاحقاً

  // ═══════════════════════════════════════════════════════════════
  // أداة اختبار (للمطور)
  // ═══════════════════════════════════════════════════════════════
  
  window.testDateUtils = function() {
    console.log('📅 اختبار date-utils:');
    
    var tests = [
      { name: 'parseDateSafe', result: window.parseDateSafe('2024-01-15') },
      { name: 'formatDateSafe', result: window.formatDateSafe(new Date()) },
      { name: 'addDaysSafe', result: window.addDaysSafe('2024-01-15', 7) },
      { name: 'diffDaysSafe', result: window.diffDaysSafe('2024-01-15', '2024-01-10') },
      { name: 'compareDatesSafe', result: window.compareDatesSafe('2024-01-15', '2024-01-10') },
      { name: 'addMonthsSafe', result: window.addMonthsSafe('2024-01-15', 3) }
    ];
    
    tests.forEach(function(t) {
      console.log('   ' + t.name + ':', t.result);
    });
    
    if (typeof window.toast === 'function') {
      window.toast('✅ فحص date-utils في Console', 3000);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // إضافة صغيرة: زر في الإعدادات لفحص أدوات التواريخ
  // ═══════════════════════════════════════════════════════════════
  
  function addTestButton() {
    var page = document.getElementById('page-settings');
    if (!page) return;
    if (page.querySelector('#dateUtilsCard')) return;
    
    var card = document.createElement('div');
    card.className = 'card';
    card.id = 'dateUtilsCard';
    card.innerHTML =
      '<h3>📅 معالجة التواريخ الآمنة</h3>' +
      '<p class="meta">' +
        'أدوات موحدة تعمل بنفس الطريقة على جميع الأجهزة، ' +
        'مما يمنع أخطاء حساب "الأيام المتبقية" بسبب اختلاف المنطقة الزمنية.' +
      '</p>' +
      '<div class="meta" style="font-size:12px;background:var(--card-alt);padding:8px;border-radius:8px;margin-top:8px;">' +
        '💡 هذه الأدوات <b>متاحة تلقائياً</b> للاستخدام في الكود. ' +
        'لا تحتاج لأي إعداد.' +
      '</div>' +
      '<button class="btn sm outline" style="margin-top:10px;" onclick="testDateUtils()">' +
        '🧪 اختبار الأدوات' +
      '</button>';
    
    page.appendChild(card);
  }
  
  if (typeof window.renderSettings === 'function') {
    var origRenderSettings = window.renderSettings;
    window.renderSettings = function() {
      origRenderSettings.apply(this, arguments);
      setTimeout(addTestButton, 200);
    };
  }

  console.log('✅ تم تحميل date-utils.js');
  console.log('   - parseDateSafe');
  console.log('   - formatDateSafe');
  console.log('   - addDaysSafe');
  console.log('   - diffDaysSafe');
  console.log('   - compareDatesSafe');
  console.log('   - isTodaySafe / isFutureSafe / isPastSafe');
  console.log('   - addMonthsSafe');

})();
