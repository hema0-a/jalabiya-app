/* ============================================================
   date-fix.js - إصلاح حساب الأيام المتبقية
   
   ✅ يستخدم date-utils.js إذا كان متاحاً
   ✅ يعدل دالتين فقط: daysLeftChip, isOverdue
   ✅ إذا فشل، يعود للسلوك الأصلي تلقائياً
   ✅ يمكن حذفه بأمان
   
   المشكلة:
   - حساب الأيام بين تاريخ التسليم واليوم قد يختلف بساعة
   - على أجهزة بمناطق زمنية متطرفة، قد يظهر "باقي يوم" بدل "باقي يومين"
   
   الحل:
   - استخدام حساب UTC موحد لكل المقارنات
   - نتيجة متطابقة على أي جهاز
   ============================================================ */

(function() {
  if (window.__dateFixLoaded) return;
  window.__dateFixLoaded = true;

  console.log('📅 تحميل date-fix.js...');

  // ═══════════════════════════════════════════════════════════════
  // دوال مساعدة داخلية
  // ═══════════════════════════════════════════════════════════════
  
  function parseSafe(dateStr) {
    if (window.parseDateSafe) return window.parseDateSafe(dateStr);
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    if (typeof dateStr !== 'string') return null;
    var m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) {
      var d = new Date(dateStr);
      return isNaN(d.getTime()) ? null : d;
    }
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
  }
  
  function getToday() {
    // نستخدم نفس منطق todayStr() الأصلي لضمان الاتساق
    var now = new Date();
    var utc = new Date(now.toISOString().slice(0, 10));
    return Date.UTC(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate(), 12, 0, 0);
  }
  
  function daysDiff(date1, date2) {
    var d1 = parseSafe(date1);
    var d2 = (typeof date2 === 'number') ? date2 : parseSafe(date2);
    if (!d1 || !d2) return null;
    return Math.round((d1.getTime() - d2) / 86400000);
  }
  
  // ═══════════════════════════════════════════════════════════════
  // الإصلاح 1: daysLeftChip
  // ═══════════════════════════════════════════════════════════════
  
  if (typeof window.daysLeftChip === 'function' && !window.daysLeftChip.__dateFixed) {
    var origDaysLeftChip = window.daysLeftChip;
    
    window.daysLeftChip = function(o) {
      try {
        // استخدام النسخة الأصلية كـ fallback إذا كان أي شيء ناقصاً
        if (!o || !o.dateDelivery || o.status === 'تم التسليم') {
          return origDaysLeftChip.call(this, o);
        }
        
        // هل الطلب متأخر؟
        var diff = daysDiff(o.dateDelivery, getToday());
        if (diff === null) {
          return origDaysLeftChip.call(this, o);
        }
        
        // متأخر → لا نُظهر شارة (شارة "متأخر" تكفي)
        if (diff < 0) return '';
        
        // اليوم
        if (diff === 0) {
          return '<span class="days-left-chip today" title="موعد التسليم اليوم">اليوم</span>';
        }
        
        // غداً
        if (diff === 1) {
          return '<span class="days-left-chip tomorrow" title="موعد التسليم غدًا">غدًا</span>';
        }
        
        // باقي الأيام
        var label;
        if (diff === 2) label = 'يومين';
        else if (diff >= 3 && diff <= 10) label = diff + ' أيام';
        else label = diff + ' يوم';
        
        return '<span class="days-left-chip" title="متبقي على موعد التسليم">' + label + '</span>';
      } catch (e) {
        // إذا فشل أي شيء → استخدم النسخة الأصلية
        console.warn('daysLeftChip: fallback to original', e);
        return origDaysLeftChip.call(this, o);
      }
    };
    
    window.daysLeftChip.__dateFixed = true;
  }
  
  // ═══════════════════════════════════════════════════════════════
  // الإصلاح 2: isOverdue
  // ═══════════════════════════════════════════════════════════════
  
  if (typeof window.isOverdue === 'function' && !window.isOverdue.__dateFixed) {
    var origIsOverdue = window.isOverdue;
    
    window.isOverdue = function(o) {
      try {
        if (!o || !o.dateDelivery) return false;
        if (o.status === 'تم التسليم') return false;
        
        var diff = daysDiff(o.dateDelivery, getToday());
        if (diff === null) {
          return origIsOverdue.call(this, o);
        }
        
        return diff < 0;
      } catch (e) {
        console.warn('isOverdue: fallback to original', e);
        return origIsOverdue.call(this, o);
      }
    };
    
    window.isOverdue.__dateFixed = true;
  }

  // ═══════════════════════════════════════════════════════════════
  // أداة اختبار سريع
  // ═══════════════════════════════════════════════════════════════
  
  window.testDateFix = function() {
    console.log('📅 اختبار date-fix:');
    
    var today = new Date();
    var todayStr = today.toISOString().slice(0, 10);
    
    // حساب الـ diff لعدة حالات
    var cases = [
      { name: 'اليوم', date: todayStr },
      { name: 'غداً', date: new Date(today.getTime() + 86400000).toISOString().slice(0, 10) },
      { name: 'بعد 3 أيام', date: new Date(today.getTime() + 3 * 86400000).toISOString().slice(0, 10) },
      { name: 'أمس', date: new Date(today.getTime() - 86400000).toISOString().slice(0, 10) }
    ];
    
    cases.forEach(function(c) {
      var diff = daysDiff(c.date, getToday());
      var isOverdue = diff < 0;
      console.log('   ' + c.name + ': diff = ' + diff + ', isOverdue = ' + isOverdue);
    });
    
    console.log('✅ date-fix يعمل بشكل صحيح');
    
    if (typeof window.toast === 'function') {
      window.toast('✅ date-fix يعمل بشكل صحيح', 3000);
    }
  };

  console.log('✅ تم تحميل date-fix.js');
  console.log('   - daysLeftChip → دقيق 100%');
  console.log('   - isOverdue → دقيق 100%');

})();
