/* ============================================================
   critical-fixes.js - الإصلاحات الحرجة
   
   ✅ آمن 100% - يمكن حذفه بأمان
   
   الإصلاحات:
   1. checkPin: تأخير تصاعدي + قفل تدريجي (أمان أعلى)
   2. orderTotal: حماية من NaN (منع الأخطاء الحسابية)
   3. orderRemaining: حماية من NaN
   4. addWorkDaysFromNow: حد أقصى (منع الحلقة اللانهائية)
   ============================================================ */

(function() {
  if (window.__criticalFixesLoaded) return;
  window.__criticalFixesLoaded = true;
  
  console.log('🛡️ تحميل critical-fixes.js...');
  
  // ═══════════════════════════════════════════════════════════════
  // 1. checkPin - تأخير تصاعدي
  // ═══════════════════════════════════════════════════════════════
  
  var __pinAttempts = 0;
  var __pinLockUntil = 0;
  var __pinLastAttempt = 0;
  var __pinNextDelay = 0;
  
  window.checkPin = function() {
    var now = Date.now();
    var errorEl = document.getElementById('lockError');
    var currentPin = window.pin || '';
    
    // فحص القفل
    if (__pinLockUntil > now) {
      var remaining = Math.ceil((__pinLockUntil - now) / 1000);
      if (errorEl) errorEl.textContent = '⚠️ تم الحظر — انتظر ' + remaining + ' ثانية';
      window.pin = '';
      if (typeof window.updatePinDots === 'function') window.updatePinDots();
      return;
    }
    
    // فحص التأخير التصاعدي
    var sinceLast = now - __pinLastAttempt;
    if (sinceLast < __pinNextDelay) {
      var wait = Math.ceil((__pinNextDelay - sinceLast) / 1000);
      if (errorEl) errorEl.textContent = '⏳ انتظر ' + wait + ' ثانية';
      window.pin = '';
      if (typeof window.updatePinDots === 'function') window.updatePinDots();
      return;
    }
    
    __pinLastAttempt = now;
    
    // التحقق من الرقم
    var realPass = (window.db && window.db.password) ? window.db.password : '0000';
    var managerPass = window.db && window.db.managerPassword;
    var receptionPass = window.db && window.db.receptionPassword;
    
    var matchedRole = null;
    if (currentPin === realPass) matchedRole = 'owner';
    else if (managerPass && currentPin === managerPass) matchedRole = 'manager';
    else if (receptionPass && currentPin === receptionPass) matchedRole = 'receptionist';
    
    if (matchedRole) {
      // ✅ نجاح
      __pinAttempts = 0;
      __pinNextDelay = 0;
      __pinLockUntil = 0;
      
      window.userRole = matchedRole;
      window.financeUnlocked = false;
      
      var lockScreen = document.getElementById('lockScreen');
      var app = document.getElementById('app');
      if (lockScreen) lockScreen.style.display = 'none';
      if (app) app.style.display = 'block';
      
      window.pin = '';
      if (typeof window.applyRoleUI === 'function') window.applyRoleUI();
      if (typeof window.boot === 'function') window.boot();
      if (typeof window.resetIdleTimer === 'function') window.resetIdleTimer();
      
      if (window.db) {
        window.db.lastLoginAt = Date.now();
        if (typeof window.saveDB === 'function') window.saveDB(true);
      }
      return;
    }
    
    // ❌ فشل
    __pinAttempts++;
    
    // التأخير التصاعدي: 0.5s → 1s → 2s → 3s → 5s
    var delays = [500, 1000, 2000, 3000, 5000];
    __pinNextDelay = delays[Math.min(__pinAttempts - 1, delays.length - 1)];
    
    var lockDuration = 0;
    var message = '';
    
    if (__pinAttempts >= 15) {
      lockDuration = 300;
      message = '🚨 تم حظر الدخول 5 دقائق بعد 15 محاولة';
    } else if (__pinAttempts >= 10) {
      lockDuration = 120;
      message = '⚠️ تم حظر الدخول دقيقتين بعد 10 محاولات';
    } else if (__pinAttempts >= 5) {
      lockDuration = 30;
      message = '⚠️ تم حظر الدخول 30 ثانية بعد 5 محاولات';
    } else {
      var remainingAttempts = 5 - __pinAttempts;
      message = 'الرقم السري غير صحيح — تبقت ' + remainingAttempts + 
                ' محاولة' + (remainingAttempts === 1 ? '' : 'ات');
    }
    
    if (lockDuration > 0) {
      __pinLockUntil = now + (lockDuration * 1000);
    }
    
    if (errorEl) errorEl.textContent = message;
    
    // تأثير اهتزاز
    var dots = document.querySelectorAll('.pin-dot');
    dots.forEach(function(d) { d.classList.add('shake-err'); });
    
    var keypad = document.getElementById('keypad');
    if (keypad && keypad.parentElement) {
      keypad.parentElement.classList.add('lock-shake');
    }
    
    // حفظ في سجل النشاط
    if (window.db) {
      if (!window.db.activityLog) window.db.activityLog = [];
      window.db.activityLog.push({
        id: 'pin-fail-' + Date.now(),
        text: '🚫 محاولة دخول فاشلة (' + __pinAttempts + ')',
        ts: now,
        type: 'security'
      });
      if (window.db.activityLog.length > 200) {
        window.db.activityLog = window.db.activityLog.slice(-200);
      }
      if (typeof window.saveDB === 'function') window.saveDB(true);
    }
    
    setTimeout(function() {
      window.pin = '';
      if (typeof window.updatePinDots === 'function') window.updatePinDots();
      var lockScreen = document.getElementById('lockScreen');
      if (lockScreen) lockScreen.classList.remove('lock-shake');
    }, 420);
  };
  
  console.log('✅ checkPin محسّن');
  
  // ═══════════════════════════════════════════════════════════════
  // 2. حماية دوال الطلب من NaN
  // ═══════════════════════════════════════════════════════════════
  
  function safeNumber(value) {
    var n = Number(value);
    return isFinite(n) ? n : 0;
  }
  
  window.orderItemsSum = function(order) {
    if (!order || typeof order !== 'object') return 0;
    
    if (Array.isArray(order.items) && order.items.length) {
      return order.items.reduce(function(sum, item) {
        if (!item) return sum;
        var qty = Math.max(0, safeNumber(item.qty) || 1);
        var price = Math.max(0, safeNumber(item.unitPrice));
        return sum + (qty * price);
      }, 0);
    }
    
    return Math.max(0, safeNumber(order.fee));
  };
  
  window.orderUrgentFeeAmount = function(order) {
    if (!order || !order.urgent) return 0;
    var pct = Math.max(0, Math.min(100, safeNumber(order.urgentFeePercent)));
    return window.orderItemsSum(order) * pct / 100;
  };
  
  window.orderSubtotal = function(order) {
    if (!order) return 0;
    return window.orderItemsSum(order) + 
           Math.max(0, safeNumber(order.extra)) + 
           window.orderUrgentFeeAmount(order);
  };
  
  window.orderDiscountAmount = function(order) {
    if (!order) return 0;
    var subtotal = window.orderSubtotal(order);
    if (!order.discountType || order.discountType === 'none') return 0;
    
    if (order.discountType === 'percent') {
      var pct = Math.max(0, Math.min(100, safeNumber(order.discountValue)));
      return subtotal * pct / 100;
    }
    
    if (order.discountType === 'amount') {
      var amt = Math.max(0, safeNumber(order.discountValue));
      return Math.min(subtotal, amt);
    }
    
    return 0;
  };
  
  window.orderTaxAmount = function(order) {
    if (!order) return 0;
    var afterDiscount = window.orderSubtotal(order) - window.orderDiscountAmount(order);
    var pct = Math.max(0, Math.min(100, safeNumber(order.taxPercent)));
    return afterDiscount * pct / 100;
  };
  
  window.orderTotal = function(order) {
    if (!order) return 0;
    var total = window.orderSubtotal(order) - 
                window.orderDiscountAmount(order) + 
                window.orderTaxAmount(order);
    return isFinite(total) && total > 0 ? total : 0;
  };
  
  window.orderRemaining = function(order) {
    if (!order) return 0;
    var total = window.orderTotal(order);
    var paid = Math.max(0, safeNumber(order.paid));
    return Math.max(0, total - paid);
  };
  
  console.log('✅ دوال الطلب محصّنة ضد NaN');
  
  // ═══════════════════════════════════════════════════════════════
  // 3. addWorkDaysFromNow - حد أقصى
  // ═══════════════════════════════════════════════════════════════
  
  window.addWorkDaysFromNow = function(workDays) {
    workDays = Number(workDays);
    
    if (!isFinite(workDays) || workDays < 0) {
      console.warn('addWorkDaysFromNow: قيمة غير صالحة:', workDays);
      return new Date();
    }
    
    var MAX_ITERATIONS = 3650;
    var d = new Date();
    var count = 0;
    var iterations = 0;
    
    while (count < workDays && iterations < MAX_ITERATIONS) {
      d = new Date(d.getTime() + 86400000);
      if (typeof window.isDayOff === 'function' && !window.isDayOff(d)) {
        count++;
      } else if (typeof window.isDayOff !== 'function') {
        count++;
      }
      iterations++;
    }
    
    if (iterations >= MAX_ITERATIONS) {
      console.error('addWorkDaysFromNow: تجاوز الحد الأقصى');
    }
    
    return d;
  };
  
  console.log('✅ addWorkDaysFromNow محصّن');
  console.log('🎉 اكتملت الإصلاحات الحرجة بنجاح');
})();
