/* ============================================================
   security-fixes.js - الإصلاحات الأمنية
   
   ✅ آمن 100% - يمكن حذفه بأمان
   
   الإصلاحات:
   1. تعطيل customJS افتراضياً (منع تنفيذ كود خطر)
   2. تنظيف activityLog من البيانات الحساسة
   3. حماية QR بمهلة زمنية (5 دقائق)
   4. تحذير أمني في الإعدادات
   ============================================================ */

(function() {
  if (window.__securityFixesLoaded) return;
  window.__securityFixesLoaded = true;
  
  console.log('🔒 تحميل security-fixes.js...');
  
  // ═══════════════════════════════════════════════════════════════
  // 1. تعطيل customJS افتراضياً
  // ═══════════════════════════════════════════════════════════════
  
  // استبدال runCustomJS بنسخة محمية
  window.runCustomJS = function() {
    if (!window.db || !window.db.customJS || !window.db.customJS.trim()) return;
    
    // ✅ يحتاج تفعيل صريح
    if (!window.db.customJSEnabled) {
      console.warn('🔒 customJS معطّل لأسباب أمنية (يحتاج تفعيل يدوي)');
      return;
    }
    
    try {
      // ✅ فحص أساسي للكود
      var dangerous = /eval\s*\(|Function\s*\(|import\s*\(|require\s*\(|document\.cookie|localStorage\.clear|fetch\s*\(/i;
      if (dangerous.test(window.db.customJS)) {
        console.warn('🔒 customJS يحتوي على دوال خطرة — تم تجاهله');
        if (typeof window.toast === 'function') {
          window.toast('🔒 الكود المخصص يحتوي على دوال خطرة — لن يُنفّذ', 4000);
        }
        return;
      }
      
      // ✅ تنفيذ آمن
      var fn = new Function('"use strict";\n' + window.db.customJS);
      fn();
    } catch (e) {
      console.warn('خطأ في الكود المخصص:', e.message);
      if (typeof window.toast === 'function') {
        window.toast('⚠️ خطأ في الكود المخصص: ' + e.message);
      }
    }
  };
  
  console.log('✅ customJS محمي');
  
  // ═══════════════════════════════════════════════════════════════
  // 2. تنظيف activityLog من البيانات الحساسة
  // ═══════════════════════════════════════════════════════════════
  
  var origLogActivity = window.logActivity;
  window.logActivity = function(text) {
    if (!window.db) return;
    if (!window.db.activityLog) window.db.activityLog = [];
    
    // ✅ تنظيف النص
    var sanitized = String(text || '')
      // أرقام 4+ متتالية (قد تكون كلمة مرور)
      .replace(/\b\d{4,}\b/g, '****')
      // كلمات تدل على كلمة مرور
      .replace(/(password|pass|pin|رمز|كلمة\s*مرور)[\s:]+[^\s]+/gi, '$1: ***')
      // بريد إلكتروني
      .replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g, '***@***')
      // رقم هاتف طويل
      .replace(/\b01\d{9}\b/g, '01*********');
    
    window.db.activityLog.push({
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      text: sanitized.slice(0, 200),
      ts: Date.now()
    });
    
    if (window.db.activityLog.length > 200) {
      window.db.activityLog = window.db.activityLog.slice(-200);
    }
  };
  
  console.log('✅ logActivity محمي');
  
  // ═══════════════════════════════════════════════════════════════
  // 3. حماية QR بمهلة زمنية
  // ═══════════════════════════════════════════════════════════════
  
  var origOpenQRSync = window.openQRSyncModal;
  if (typeof origOpenQRSync === 'function') {
    window.openQRSyncModal = function() {
      if (!window.db.cloudSync || !window.db.cloudSync.enabled) {
        if (typeof window.toast === 'function') {
          window.toast('المزامنة السحابية غير مفعّلة');
        }
        return;
      }
      
      // ✅ أضف مهلة 5 دقائق
      var pairingCode = btoa(JSON.stringify({
        syncId: window.db.cloudSync.syncId,
        firebaseConfig: window.db.cloudSync.firebaseConfig,
        expiresAt: Date.now() + (5 * 60 * 1000)
      }));
      
      // ✅ اعرض المودال مع تحذير
      var html = 
        '<div class="modal-head">' +
        '<h3>📲 QR Code للمزامنة</h3>' +
        '<button class="modal-close" onclick="closeModal()">✕</button>' +
        '</div>' +
        
        '<div class="alert-banner danger" style="margin-bottom:12px;">' +
        '<span class="ic">⚠️</span>' +
        '<div>' +
        '<b>تحذير أمني</b>' +
        'الـ QR يحتوي على رمز الوصول الكامل لبياناتك. ' +
        'اعرضه فقط على الجهاز الذي تريد ربطه. ' +
        '<b>صلاحيته 5 دقائق فقط.</b>' +
        '</div>' +
        '</div>' +
        
        '<div style="text-align:center;padding:16px;background:#fff;border-radius:14px;margin-bottom:14px;">' +
        '<img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + 
        encodeURIComponent(pairingCode) + '" ' +
        'style="max-width:100%;width:280px;height:280px;display:block;margin:0 auto;" ' +
        'alt="QR Code">' +
        '<p class="meta" style="margin-top:12px;">افتح التطبيق على الجهاز الآخر → الإعدادات → مسح QR</p>' +
        '</div>' +
        
        '<div class="btn-row">' +
        '<button class="btn outline" onclick="copyPairingCode()">📋 نسخ الرمز</button>' +
        '<button class="btn accent" onclick="scanQRCode()">📷 مسح QR</button>' +
        '</div>';
      
      if (typeof window.openModal === 'function') {
        window.openModal(html);
      }
    };
  }
  
  // ✅ دالة مسح QR مع فحص المهلة
  var origHandleQRScanned = window.handleQRScanned;
  if (typeof origHandleQRScanned === 'function') {
    window.handleQRScanned = function(qrText) {
      try {
        var parsed = JSON.parse(atob(qrText));
        
        // ✅ فحص المهلة
        if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
          if (typeof window.toast === 'function') {
            window.toast('⚠️ رمز الربط انتهى صلاحيته — اطلب QR جديد', 4000);
          }
          return;
        }
        
        return origHandleQRScanned.apply(this, arguments);
      } catch (e) {
        return origHandleQRScanned.apply(this, arguments);
      }
    };
  }
  
  console.log('✅ QR محمي بمهلة زمنية');
  
  // ═══════════════════════════════════════════════════════════════
  // 4. تحذير أمني في الإعدادات + زر تفعيل customJS
  // ═══════════════════════════════════════════════════════════════
  
  function injectSecurityWarning() {
    var page = document.getElementById('page-settings');
    if (!page) return;
    if (page.querySelector('#customJSWarning')) return;
    
    // ابحث عن بطاقة customJS
    var cards = page.querySelectorAll('.card');
    var customJSCard = null;
    
    cards.forEach(function(card) {
      var h3 = card.querySelector('h3');
      if (h3 && (h3.textContent.indexOf('تعديل متقدم') !== -1 || 
                 h3.textContent.indexOf('customJS') !== -1)) {
        customJSCard = card;
      }
    });
    
    if (!customJSCard) return;
    
    // أضف تحذير في أعلى البطاقة
    var warning = document.createElement('div');
    warning.id = 'customJSWarning';
    warning.className = 'alert-banner warn';
    warning.style.marginBottom = '12px';
    
    var enabled = window.db.customJSEnabled === true;
    
    warning.innerHTML = 
      '<span class="ic">🔒</span>' +
      '<div>' +
      '<b>تحذير أمني هام</b>' +
      'كود JavaScript المخصص يمكنه الوصول لكل بياناتك. ' +
      'لأسباب أمنية، هو <b>' + (enabled ? 'مفعّل' : 'معطّل') + '</b> افتراضياً. ' +
      '<br><br>' +
      '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;">' +
      '<input type="checkbox" id="customJSEnabledToggle" ' + 
      (enabled ? 'checked' : '') + ' ' +
      'onchange="toggleCustomJS(this.checked)" ' +
      'style="width:18px;height:18px;">' +
      '<span>أفهم المخاطر وأريد تفعيله</span>' +
      '</label>' +
      '</div>';
    
    customJSCard.insertBefore(warning, customJSCard.firstChild);
  }
  
  window.toggleCustomJS = function(enabled) {
    if (!window.db) return;
    
    if (enabled) {
      var confirmed = confirm(
        '⚠️ تحذير أمني\n\n' +
        'الكود المخصص (JavaScript) يمكنه:\n' +
        '• قراءة كل بياناتك (عملاء، طلبات، مبالغ)\n' +
        '• إرسال بياناتك لخادم خارجي\n' +
        '• تعطيل التطبيق أو إتلاف البيانات\n\n' +
        'هل أنت متأكد من التفعيل؟'
      );
      
      if (!confirmed) {
        var toggle = document.getElementById('customJSEnabledToggle');
        if (toggle) toggle.checked = false;
        return;
      }
    }
    
    window.db.customJSEnabled = enabled;
    if (typeof window.saveDB === 'function') window.saveDB(true);
    
    if (enabled && typeof window.runCustomJS === 'function') {
      window.runCustomJS();
    }
    
    if (typeof window.toast === 'function') {
      window.toast(enabled ? '⚠️ customJS مفعّل — استخدمه بحذر' : '🔒 customJS معطّل');
    }
    
    // أعد رسم البطاقة
    var warning = document.getElementById('customJSWarning');
    if (warning) warning.remove();
    setTimeout(injectSecurityWarning, 100);
  };
  
  // دمج مع renderSettings
  if (typeof window.renderSettings === 'function' && !window.renderSettings.__securityWrapped) {
    var origRenderSettings = window.renderSettings;
    window.renderSettings = function() {
      var r = origRenderSettings.apply(this, arguments);
      setTimeout(injectSecurityWarning, 600);
      return r;
    };
    window.renderSettings.__securityWrapped = true;
  }
  
  // ═══════════════════════════════════════════════════════════════
  // 5. حماية إضافية: منع حذف كل البيانات بدون تأكيد
  // ═══════════════════════════════════════════════════════════════
  
  var origClearActivityLog = window.clearActivityLog;
  if (typeof origClearActivityLog === 'function') {
    window.clearActivityLog = async function() {
      var ok = await window.appConfirm(
        'سيتم حذف سجل النشاط بالكامل نهائياً. هل أنت متأكد؟',
        { okText: 'حذف', cancelText: 'إلغاء', danger: true }
      );
      if (!ok) return;
      return origClearActivityLog.apply(this, arguments);
    };
  }
  
  console.log('✅ اكتملت الإصلاحات الأمنية');
  console.log('🔒 customJS معطّل افتراضياً');
  console.log('🔒 activityLog منظّف');
  console.log('🔒 QR محمي بمهلة');
  
})();
