/* ============================================================
   security-patch.js - تشفير كلمات المرور تلقائياً
   [الجزء 3: الأمان]
   
   المشكلة:
   كلمات المرور مخزنة كنص عادي في localStorage، مما يعني أن
   أي شخص لديه وصول للجهاز يستطيع قراءتها بسهولة من DevTools.
   
   الحل:
   - تشفير تلقائي عبر SHA-256 عند أول تشغيل
   - الحفاظ على كلمات المرور الحالية دون إجبار المستخدم على التغيير
   - كشف تلقائي للكلمات المشفرة vs النص العادي
   - رمز استرداد (Recovery) في حال نسيان كلمة المرور
   
   ⚠️ يجب تحميله بعد core.js و core-fixes.js
   ============================================================ */

(function() {
  if (window.__securityPatchLoaded) return;
  window.__securityPatchLoaded = true;

  console.log('🔐 تحميل security-patch.js...');

  /* ============================================================
     دالة التشفير SHA-256
     ============================================================ */

  async function sha256(text) {
    // استخدام Web Crypto API إذا متاح
    if (window.crypto && window.crypto.subtle) {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(function(b) {
          return b.toString(16).padStart(2, '0');
        }).join('');
        return 'sha256:' + hashHex;
      } catch (e) {
        console.warn('فشل Web Crypto، سيتم استخدام Fallback:', e);
      }
    }
    
    // Fallback: تشفير بسيط للحالات النادرة (WebView قديم)
    return 'fallback:' + fallbackHash(text);
  }

  // تشفير بديل بسيط للحالات التي لا يدعم فيها المتصفح Web Crypto
  function fallbackHash(text) {
    let hash = 0x811c9dc5; // FNV offset basis
    const salt = 'jalaba_v1_salt_' + text.length;
    const combined = salt + text + salt;
    
    for (let i = 0; i < combined.length; i++) {
      hash ^= combined.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0; // FNV prime
      hash = ((hash << 13) | (hash >>> 19)) >>> 0; // rotate
    }
    
    // خلط إضافي
    let h2 = 0xdeadbeef;
    for (let i = combined.length - 1; i >= 0; i--) {
      h2 = ((h2 << 5) - h2 + combined.charCodeAt(i)) >>> 0;
    }
    
    return (hash.toString(16) + h2.toString(16)).padStart(16, '0');
  }

  /* ============================================================
     كشف ما إذا كانت القيمة مشفرة أم لا
     ============================================================ */

  function isHashed(value) {
    if (!value || typeof value !== 'string') return false;
    return value.startsWith('sha256:') || value.startsWith('fallback:');
  }

  function isPlainPin(value) {
    if (!value || typeof value !== 'string') return false;
    // كلمات المرور الأصلية كانت 4 أرقام
    return /^\d{4}$/.test(value);
  }

  /* ============================================================
     التحقق من تطابق كلمة المرور (مع دعم الحالتين)
     ============================================================ */

  async function verifyPin(inputPin, storedValue) {
    if (!inputPin || !storedValue) return false;
    
    // إذا كانت مشفرة: شفّر الإدخال وقارن
    if (isHashed(storedValue)) {
      const inputHash = await sha256(inputPin);
      return inputHash === storedValue;
    }
    
    // إذا كانت نص عادي (للتوافق مع الإصدارات القديمة): قارن مباشرة
    return inputPin === storedValue;
  }

  /* ============================================================
     استبدال checkPin بنسخة مشفرة
     ============================================================ */

  const __originalCheckPin = window.checkPin;
  
  window.checkPin = async function() {
    if (!window.db) return;
    
    // فحص الحظر (من core-fixes.js)
    const lockUntil = parseInt(localStorage.getItem('jalaba_pin_lock_until_v1') || '0', 10);
    const now = Date.now();
    if (lockUntil > now) {
      const remaining = Math.ceil((lockUntil - now) / 1000);
      const errEl = document.getElementById('lockError');
      if (errEl) {
        errEl.textContent = `⚠️ تم الحظر مؤقتاً — انتظر ${remaining} ثانية`;
      }
      window.pin = '';
      if (typeof window.updatePinDots === 'function') window.updatePinDots();
      return;
    }
    
    const inputPin = window.pin;
    
    // التحقق من جميع كلمات المرور بشكل غير متزامن
    const checks = await Promise.all([
      verifyPin(inputPin, window.db.password).then(function(ok) {
        return ok ? 'owner' : null;
      }),
      window.db.managerPassword
        ? verifyPin(inputPin, window.db.managerPassword).then(function(ok) {
            return ok ? 'manager' : null;
          })
        : Promise.resolve(null),
      window.db.receptionPassword
        ? verifyPin(inputPin, window.db.receptionPassword).then(function(ok) {
            return ok ? 'receptionist' : null;
          })
        : Promise.resolve(null)
    ]);
    
    const matchedRole = checks.find(function(r) { return r !== null; });
    
    if (matchedRole) {
      // ✅ نجاح
      try {
        localStorage.setItem('jalaba_pin_attempts_v1', JSON.stringify({
          count: 0, firstAttempt: 0, lastAttempt: Date.now()
        }));
        localStorage.removeItem('jalaba_pin_lock_until_v1');
      } catch (e) { /* تجاهل */ }
      
      window.userRole = matchedRole;
      window.financeUnlocked = false;
      
      const lockScreen = document.getElementById('lockScreen');
      const app = document.getElementById('app');
      if (lockScreen) lockScreen.style.display = 'none';
      if (app) app.style.display = 'block';
      
      window.pin = '';
      if (typeof window.applyRoleUI === 'function') window.applyRoleUI();
      if (typeof window.boot === 'function') window.boot();
      if (typeof window.resetIdleTimer === 'function') window.resetIdleTimer();
      
      window.db.lastLoginAt = Date.now();
      window.saveDB(true);
    } else {
      // ❌ فشل — نستخدم منطق الحظر من core-fixes.js
      if (__originalCheckPin && typeof __originalCheckPin === 'function') {
        // استدعاء النسخة الأصلية لتسجيل الفشل (لكن بدون فحص كلمة المرور)
        // نحن ندير الفشل يدوياً هنا
      }
      
      // منطق الفشل
      let attemptsData = { count: 0, firstAttempt: 0, lastAttempt: 0 };
      try {
        attemptsData = JSON.parse(localStorage.getItem('jalaba_pin_attempts_v1') || '{}');
      } catch (e) { /* تجاهل */ }
      
      attemptsData.count = (attemptsData.count || 0) + 1;
      attemptsData.lastAttempt = Date.now();
      if (!attemptsData.firstAttempt) attemptsData.firstAttempt = Date.now();
      
      let lockSeconds = 0;
      let errorMsg = '';
      
      if (attemptsData.count >= 15) {
        lockSeconds = 300;
        errorMsg = '🚨 تم حظر الدخول 5 دقائق بعد 15 محاولة فاشلة';
      } else if (attemptsData.count >= 10) {
        lockSeconds = 120;
        errorMsg = '⚠️ تم حظر الدخول دقيقتين بعد 10 محاولات فاشلة';
      } else if (attemptsData.count >= 5) {
        lockSeconds = 30;
        errorMsg = '⚠️ تم حظر الدخول 30 ثانية بعد 5 محاولات فاشلة';
      } else {
        const remaining = 5 - attemptsData.count;
        errorMsg = `الرقم السري غير صحيح — تبقت ${remaining} محاولة${remaining === 1 ? '' : 'ات'}`;
      }
      
      try {
        localStorage.setItem('jalaba_pin_attempts_v1', JSON.stringify(attemptsData));
        if (lockSeconds > 0) {
          localStorage.setItem('jalaba_pin_lock_until_v1', String(Date.now() + lockSeconds * 1000));
        }
      } catch (e) { /* تجاهل */ }
      
      const errEl = document.getElementById('lockError');
      if (errEl) errEl.textContent = errorMsg;
      
      document.querySelectorAll('.pin-dot').forEach(function(d) {
        d.classList.add('shake-err');
      });
      const keypad = document.getElementById('keypad');
      if (keypad && keypad.parentElement) {
        keypad.parentElement.classList.add('lock-shake');
      }
      
      setTimeout(function() {
        window.pin = '';
        if (typeof window.updatePinDots === 'function') window.updatePinDots();
        const lockScreen = document.getElementById('lockScreen');
        if (lockScreen) lockScreen.classList.remove('lock-shake');
      }, 420);
    }
  };

  /* ============================================================
     استبدال checkFinancePin (لو موجود)
     ============================================================ */

  if (typeof window.openFinanceGate === 'function') {
    const origOpenFinanceGate = window.openFinanceGate;
    
    window.openFinanceGate = function(targetPage) {
      // الفحص يتم عند إدخال الرقم
      return origOpenFinanceGate.apply(this, arguments);
    };
  }

  // اعتراض إدخال رقم المالية
  document.addEventListener('DOMContentLoaded', function() {
    // مراقبة ظهور حقل رقم المالية
    const observer = new MutationObserver(function() {
      const input = document.getElementById('financeGateInput');
      if (input && !input.__secPatched) {
        input.__secPatched = true;
        const originalTryEnter = window.financeGateTryEnter;
        
        // استبدال حدث الإدخال
        const okBtn = document.getElementById('financeGateOk');
        if (okBtn) {
          const origClick = okBtn.onclick;
          okBtn.onclick = async function() {
            const val = (input.value || '').trim();
            if (window.db && window.db.financePassword) {
              const ok = await verifyPin(val, window.db.financePassword);
              if (ok) {
                window.financeUnlocked = true;
                if (typeof window.updateFinanceLockUI === 'function') {
                  window.updateFinanceLockUI();
                }
                if (typeof window.closeModal === 'function') window.closeModal();
                if (typeof window.showPage === 'function') {
                  window.showPage(window.financeGateTargetPage || 'finance');
                }
              } else {
                const err = document.getElementById('financeGateError');
                if (err) err.textContent = 'الرقم السري غير صحيح، حاول تاني';
                input.value = '';
              }
            } else if (origClick) {
              origClick.call(this);
            }
          };
        }
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
  });

  /* ============================================================
     استبدال دوال تغيير كلمات المرور لتشفيرها عند الحفظ
     ============================================================ */

  // تشفير كلمة مرور المالك
  const origChangePassword = window.changePassword;
  window.changePassword = async function() {
    const oldP = (document.getElementById('oldPass') || {}).value || '';
    const newP = (document.getElementById('newPass') || {}).value || '';
    
    if (!window.db) return;
    
    // التحقق من الرقم الحالي
    const oldValid = await verifyPin(oldP, window.db.password);
    if (!oldValid) {
      if (typeof window.toast === 'function') window.toast('الرقم الحالي غير صحيح');
      return;
    }
    
    if (!/^\d{4}$/.test(newP)) {
      if (typeof window.toast === 'function') window.toast('الرقم الجديد يجب أن يكون 4 أرقام');
      return;
    }
    
    // تشفير وحفظ
    const hashed = await sha256(newP);
    window.db.password = hashed;
    window.saveDB(true);
    
    const oldEl = document.getElementById('oldPass');
    const newEl = document.getElementById('newPass');
    if (oldEl) oldEl.value = '';
    if (newEl) newEl.value = '';
    
    if (typeof window.toast === 'function') {
      window.toast('✅ تم تغيير الرقم السري بنجاح (مشفَّر)');
    }
  };

  // تشفير كلمة مرور المدير (من patches.js)
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
      const managerBtn = document.getElementById('saveManagerPinBtn');
      if (managerBtn && !managerBtn.__secPatched) {
        managerBtn.__secPatched = true;
        const origClick = managerBtn.onclick;
        managerBtn.onclick = async function() {
          const val = (document.getElementById('managerPinInput') || {}).value || '';
          const trimmed = val.trim();
          
          if (trimmed && trimmed.length !== 4) {
            if (typeof window.toast === 'function') {
              window.toast('لازم يكون 4 أرقام بالظبط، أو سيبه فاضي لإلغاء الميزة');
            }
            return;
          }
          
          if (trimmed && window.db) {
            // تحقق من عدم تطابق الرقم مع المالك
            const matchesOwner = await verifyPin(trimmed, window.db.password);
            if (matchesOwner) {
              if (typeof window.toast === 'function') {
                window.toast('لازم يكون مختلف عن رقمك الأساسي');
              }
              return;
            }
          }
          
          if (window.db) {
            window.db.managerPassword = trimmed ? await sha256(trimmed) : null;
            window.saveDB(true);
            
            const inp = document.getElementById('managerPinInput');
            if (inp) inp.value = '';
            
            if (typeof window.toast === 'function') {
              window.toast(trimmed ? '✅ تم حفظ رقم وضع المدير (مشفَّر)' : '✅ تم إلغاء وضع المدير');
            }
          }
        };
      }
      
      // نفس الشيء لرقم الاستقبال
      const receptionBtn = document.getElementById('saveReceptionPinBtn');
      if (receptionBtn && !receptionBtn.__secPatched) {
        receptionBtn.__secPatched = true;
        const origClick = receptionBtn.onclick;
        receptionBtn.onclick = async function() {
          const val = (document.getElementById('receptionPinInput') || {}).value || '';
          const trimmed = val.trim();
          
          if (trimmed && trimmed.length !== 4) {
            if (typeof window.toast === 'function') {
              window.toast('لازم يكون 4 أرقام بالظبط، أو سيبه فاضي لإلغاء الميزة');
            }
            return;
          }
          
          if (trimmed && window.db) {
            const matchesOwner = await verifyPin(trimmed, window.db.password);
            if (matchesOwner) {
              if (typeof window.toast === 'function') {
                window.toast('لازم يكون مختلف عن رقمك الأساسي');
              }
              return;
            }
          }
          
          if (window.db) {
            window.db.receptionPassword = trimmed ? await sha256(trimmed) : null;
            window.saveDB(true);
            
            const inp = document.getElementById('receptionPinInput');
            if (inp) inp.value = '';
            
            if (typeof window.toast === 'function') {
              window.toast(trimmed ? '✅ تم حفظ رقم وضع الاستقبال (مشفَّر)' : '✅ تم إلغاء وضع الاستقبال');
            }
          }
        };
      }
      
      // رقم المالية
      const financeBtn = document.getElementById('saveFinancePinBtn');
      if (financeBtn && !financeBtn.__secPatched) {
        financeBtn.__secPatched = true;
        const origClick = financeBtn.onclick;
        financeBtn.onclick = async function() {
          const val = (document.getElementById('financePinInput') || {}).value || '';
          const trimmed = val.trim();
          
          if (trimmed && trimmed.length !== 4) {
            if (typeof window.toast === 'function') {
              window.toast('لازم يكون 4 أرقام بالظبط، أو سيبه فاضي لإلغاء الميزة');
            }
            return;
          }
          
          if (window.db) {
            window.db.financePassword = trimmed ? await sha256(trimmed) : null;
            window.saveDB(true);
            window.financeUnlocked = false;
            if (typeof window.updateFinanceLockUI === 'function') {
              window.updateFinanceLockUI();
            }
            
            const inp = document.getElementById('financePinInput');
            if (inp) inp.value = '';
            
            if (typeof window.toast === 'function') {
              window.toast(trimmed ? '✅ تم حفظ رقم صفحة المالية (مشفَّر)' : '✅ تم إلغاء قفل صفحة المالية');
            }
          }
        };
      }
      
      // نفس الشيء لحقل financePassword في صفحة المالية
      const saveFinancePassBtn = document.querySelector('[onclick="saveFinancePassword()"]');
      if (saveFinancePassBtn && !saveFinancePassBtn.__secPatched) {
        saveFinancePassBtn.__secPatched = true;
        saveFinancePassBtn.onclick = async function() {
          const isSet = !!window.db.financePassword;
          if (isSet) {
            const oldP = (document.getElementById('financeOldPass') || {}).value || '';
            const oldValid = await verifyPin(oldP, window.db.financePassword);
            if (!oldValid) {
              if (typeof window.toast === 'function') window.toast('الرقم الحالي غير صحيح');
              return;
            }
          }
          
          const newP = (document.getElementById('financeNewPass') || {}).value || '';
          if (!/^\d{4}$/.test(newP)) {
            if (typeof window.toast === 'function') window.toast('الرقم يجب أن يكون 4 أرقام');
            return;
          }
          
          window.db.financePassword = await sha256(newP);
          window.financeUnlocked = false;
          if (typeof window.updateFinanceLockUI === 'function') {
            window.updateFinanceLockUI();
          }
          window.saveDB(true);
          
          if (typeof window.renderFinancePasswordCard === 'function') {
            window.renderFinancePasswordCard();
          }
          
          if (typeof window.toast === 'function') {
            window.toast(isSet ? 'تم تغيير رقم المالية ✅ (مشفَّر)' : 'تم تفعيل حماية صفحة المالية ✅ (مشفَّر)');
          }
        };
      }
    }, 500);
  });

  /* ============================================================
     الترحيل التلقائي: تشفير كلمات المرور عند أول تشغيل
     ============================================================ */

  async function migratePasswordsToHashed() {
    if (!window.db) return;
    
    let migrated = 0;
    
    // ترحيل كلمة مرور المالك
    if (isPlainPin(window.db.password)) {
      window.db.password = await sha256(window.db.password);
      migrated++;
    }
    
    // ترحيل كلمة مرور المدير
    if (window.db.managerPassword && isPlainPin(window.db.managerPassword)) {
      window.db.managerPassword = await sha256(window.db.managerPassword);
      migrated++;
    }
    
    // ترحيل كلمة مرور الاستقبال
    if (window.db.receptionPassword && isPlainPin(window.db.receptionPassword)) {
      window.db.receptionPassword = await sha256(window.db.receptionPassword);
      migrated++;
    }
    
    // ترحيل كلمة مرور المالية
    if (window.db.financePassword && isPlainPin(window.db.financePassword)) {
      window.db.financePassword = await sha256(window.db.financePassword);
      migrated++;
    }
    
    if (migrated > 0) {
      window.saveDB(true);
      console.log(`🔐 تم تشفير ${migrated} كلمة مرور تلقائياً`);
      
      // إشعار المستخدم (مرة واحدة فقط)
      const migratedFlag = localStorage.getItem('jalaba_passwords_migrated_v1');
      if (!migratedFlag) {
        localStorage.setItem('jalaba_passwords_migrated_v1', '1');
        setTimeout(function() {
          if (typeof window.toast === 'function') {
            window.toast('🔐 تم تأمين كلمات المرور تلقائياً', 4000);
          }
        }, 2000);
      }
    }
  }

  // تنفيذ الترحيل بعد تحميل البيانات
  window.addEventListener('load', function() {
    setTimeout(migratePasswordsToHashed, 500);
  });

  /* ============================================================
     أداة استرداد كلمة المرور (في حال نسيانها)
     ============================================================ */

  window.showPasswordRecoveryTool = function() {
    const html = `
      <div class="modal-head">
        <h3>🆘 استرداد كلمة المرور</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="card" style="padding:12px;margin-bottom:12px;background:var(--danger-light);">
        <b style="display:block;margin-bottom:6px;">⚠️ تحذير أمني</b>
        <div class="meta">هذه الأداة تعيد تعيين كلمة المرور إلى القيمة الافتراضية (0000).
        استخدمها فقط إذا نسيت كلمة المرور ولا يوجد شخص آخر يستخدم التطبيق.</div>
      </div>
      <div class="field">
        <label>للتأكيد، اكتب كلمة: RECOVER</label>
        <input id="recoveryConfirmInput" type="text" placeholder="اكتب RECOVER" style="direction:ltr;text-align:center;">
      </div>
      <div class="btn-row">
        <button class="btn outline" onclick="closeModal()">إلغاء</button>
        <button class="btn danger" onclick="executePasswordRecovery()">🆘 تعيين إلى 0000</button>
      </div>
    `;
    if (typeof window.openModal === 'function') {
      window.openModal(html);
    }
  };

  window.executePasswordRecovery = async function() {
    const confirmEl = document.getElementById('recoveryConfirmInput');
    const value = (confirmEl && confirmEl.value || '').trim().toUpperCase();
    
    if (value !== 'RECOVER') {
      if (typeof window.toast === 'function') {
        window.toast('⚠️ اكتب RECOVER للتأكيد');
      }
      return;
    }
    
    if (!window.db) return;
    
    // إعادة تعيين جميع كلمات المرور
    window.db.password = await sha256('0000');
    window.db.managerPassword = null;
    window.db.receptionPassword = null;
    window.db.financePassword = null;
    
    // تسجيل في سجل النشاط
    if (window.db.activityLog) {
      window.db.activityLog.push({
        id: 'recover' + Date.now(),
        text: '🆘 تم استخدام أداة استرداد كلمة المرور',
        ts: Date.now(),
        type: 'security'
      });
    }
    
    window.saveDB(true);
    
    if (typeof window.closeModal === 'function') window.closeModal();
    
    if (typeof window.toast === 'function') {
      window.toast('✅ تم إعادة تعيين كلمة المرور إلى 0000', 5000);
    }
    
    // أعِد تحميل الصفحة للدخول من جديد
    setTimeout(function() {
      location.reload();
    }, 1500);
  };

  /* ============================================================
     تحسين runCustomJS (تحذير أوضح)
     ============================================================ */

  const origRunCustomJS = window.runCustomJS;
  window.runCustomJS = function() {
    if (!window.db || !window.db.customJS || !window.db.customJS.trim()) return;
    
    try {
      // نلف الكود بمتغيرات آمنة
      const safeWrapper = `
        "use strict";
        (function() {
          "use strict";
          try {
            ${window.db.customJS}
          } catch(e) {
            console.warn('⚠️ خطأ في الكود المخصص:', e.message);
            if (typeof toast === 'function') {
              toast('⚠️ خطأ في الكود المخصص: ' + e.message);
            }
          }
        })();
      `;
      
      new Function(safeWrapper)();
    } catch (e) {
      if (typeof window.toast === 'function') {
        window.toast('⚠️ خطأ في الكود المخصص: ' + e.message);
      }
    }
  };

  /* ============================================================
     التحقق من الترحيل
     ============================================================ */

  setTimeout(function() {
    if (!window.db) return;
    
    const status = {
      owner: isHashed(window.db.password) ? '🔐 مشفَّرة' : '⚠️ نص عادي',
      manager: !window.db.managerPassword ? '— معطّلة' :
        (isHashed(window.db.managerPassword) ? '🔐 مشفَّرة' : '⚠️ نص عادي'),
      reception: !window.db.receptionPassword ? '— معطّلة' :
        (isHashed(window.db.receptionPassword) ? '🔐 مشفَّرة' : '⚠️ نص عادي'),
      finance: !window.db.financePassword ? '— معطّلة' :
        (isHashed(window.db.financePassword) ? '🔐 مشفَّرة' : '⚠️ نص عادي')
    };
    
    console.log('🔐 حالة تشفير كلمات المرور:');
    console.log('   المالك: ' + status.owner);
    console.log('   المدير: ' + status.manager);
    console.log('   الاستقبال: ' + status.reception);
    console.log('   المالية: ' + status.finance);
  }, 3000);

  console.log('✅ تم تحميل security-patch.js');
})();