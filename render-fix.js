/* ============================================================
   render-fix.js - إصلاح عرض الإعدادات
   
   ✅ آمن 100%
   ✅ يضمن عرض كل البطاقات حتى لو بعض الدوال فشلت
   ============================================================ */

(function() {
  if (window.__renderFixLoaded) return;
  window.__renderFixLoaded = true;
  
  console.log('🔧 تحميل render-fix.js...');
  
  // قائمة دوال العرض في الإعدادات
  var SETTINGS_RENDERERS = [
    { name: 'renderFinancePasswordCard', target: 'financePasswordCardWrap', label: '🔐 كلمة مرور المالية' },
    { name: 'renderCloudSyncCard', target: 'cloudSyncCardWrap', label: '☁️ المزامنة السحابية' },
    { name: 'renderConflictBackupsCard', target: 'conflictBackupsCardWrap', label: '🛟 نسخ التعارض' },
    { name: 'renderPushNotifyCard', target: 'pushNotifyCardWrap', label: '🔔 الإشعارات' }
  ];
  
  // ═══ تشغيل كل دالة على حدة مع try/catch ═══
  function safeRenderAll() {
    var success = 0;
    var failed = [];
    
    SETTINGS_RENDERERS.forEach(function(item) {
      // تحقق من وجود العنصر
      var target = document.getElementById(item.target);
      if (!target) return;
      
      // تحقق إذا كان العنصر مملوء (ليس فارغ)
      if (target.innerHTML.trim().length > 10) {
        success++;
        return;
      }
      
      // حاول تشغيل الدالة
      if (typeof window[item.name] !== 'function') {
        // ✅ املأ برسالة واضحة
        target.innerHTML = 
          '<div style="padding:14px;text-align:center;color:var(--muted);font-size:13px;">' +
          '⚠️ ' + item.label + ' — الدالة ' + item.name + ' غير محمّلة' +
          '</div>';
        failed.push(item.name);
        return;
      }
      
      try {
        window[item.name]();
        success++;
      } catch (e) {
        console.error('❌ فشل', item.name, ':', e);
        target.innerHTML = 
          '<div style="padding:14px;background:var(--warn-light);border-radius:10px;color:var(--warn);font-size:12.5px;">' +
          '<b>⚠️ ' + item.label + '</b><br>' +
          '<span style="font-size:11px;">حدث خطأ: ' + (e.message || 'غير معروف') + '</span>' +
          '</div>';
        failed.push(item.name);
      }
    });
    
    console.log('✅ نجح: ' + success + ' / فشل: ' + failed.length);
    if (failed.length > 0) {
      console.warn('⚠️ الدوال الفاشلة:', failed);
    }
    
    return { success: success, failed: failed };
  }
  
  // ═══ استبدال renderSettings بنسخة آمنة ═══
  if (typeof window.renderSettings === 'function' && !window.renderSettings.__renderFixWrapped) {
    var origRenderSettings = window.renderSettings;
    
    window.renderSettings = function() {
      // ✅ استدعِ النسخة الأصلية بأمان
      try {
        origRenderSettings.apply(this, arguments);
      } catch (e) {
        console.error('❌ فشل renderSettings الأصلي:', e);
      }
      
      // ✅ ثم شغّل كل دالة عرض بأمان (بعد تأخير)
      setTimeout(safeRenderAll, 100);
      setTimeout(safeRenderAll, 500); // محاولة ثانية
    };
    
    window.renderSettings.__renderFixWrapped = true;
  }
  
  // ═══ شغّل عند فتح الصفحة أيضاً ═══
  function watchForSettings() {
    // إذا كانت الإعدادات مفتوحة
    var settingsPage = document.getElementById('page-settings');
    if (settingsPage && settingsPage.classList.contains('active')) {
      setTimeout(safeRenderAll, 200);
    }
  }
  
  // راقب التغييرات في الصفحة
  if (typeof window.showPage === 'function' && !window.showPage.__renderFixWrapped) {
    var origShowPage = window.showPage;
    window.showPage = function(name) {
      var r = origShowPage.apply(this, arguments);
      if (name === 'settings') {
        setTimeout(safeRenderAll, 300);
        setTimeout(safeRenderAll, 800);
      }
      return r;
    };
    window.showPage.__renderFixWrapped = true;
  }
  
  // ═══ شغّل فوراً عند التحميل ═══
  window.addEventListener('load', function() {
    setTimeout(safeRenderAll, 2000);
    setTimeout(safeRenderAll, 4000);
  });
  
  // ═══ دالة يدوية للاختبار ═══
  window.testRenderFix = function() {
    var result = safeRenderAll();
    if (typeof window.toast === 'function') {
      window.toast(
        '✅ نجح: ' + result.success + ' / فشل: ' + result.failed.length,
        4000
      );
    }
    return result;
  };
  
  console.log('✅ render-fix.js جاهز');
  console.log('💡 اكتب testRenderFix() في Console للاختبار');
})();
