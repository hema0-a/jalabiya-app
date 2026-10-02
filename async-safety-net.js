/* ============================================================
   async-safety-net.js - شبكة أمان لعمليات async/await
   [الجزء 2: إصلاح التزامن]
   
   المشكلة:
   بعض الملفات (patches.js وبعض ملفات feature-*) تلتف حول
   saveOrder/saveCustomer بدوال غير async، مما يسبب:
   - ظهور نوافذ قبل حفظ البيانات فعلياً
   - عدم اكتمال خصم المخزون
   - race conditions عند تسجيل دفعات
   
   الحل:
   نلف جميع العمليات الحرجة بدوال async موحدة تنتظر حتى
   اكتمال جميع الطبقات الداخلية، ثم تُفرِّغ البيانات فوراً.
   
   ⚠️ يجب تحميله آخر ملف (بعد كل ملفات feature-*)
   ============================================================ */

(function() {
  if (window.__asyncSafetyNetLoaded) return;
  window.__asyncSafetyNetLoaded = true;

  console.log('🛡️ تحميل async-safety-net.js...');

  // انتظر حتى يكتمل تحميل جميع الملفات
  function initSafetyNet() {
    // قائمة العمليات الحرجة التي تحتاج معالجة async
    const CRITICAL_OPERATIONS = [
      'saveOrder',
      'saveCustomer',
      'savePayment',
      'saveExpense',
      'saveCommitment',
      'saveHouseExpense',
      'markOrderDelivered',
      'changeOrderStatus',
      'deleteOrder',
      'deleteCustomer',
      'deleteExpense',
      'startOrderWork',
      'stopOrderWork'
    ];

    let wrappedCount = 0;

    CRITICAL_OPERATIONS.forEach(function(opName) {
      const original = window[opName];
      if (typeof original !== 'function') return;

      // تحقق أن الدالة لم تُغلَّف من قبل
      if (original.__asyncWrapped) return;

      // الدالة المُغلَّفة الجديدة
      const wrapped = async function() {
        const args = arguments;
        const self = this;

        try {
          // انتظر نتيجة الدالة الأصلية (سواء كانت async أو sync)
          const result = await Promise.resolve(original.apply(self, args));

          // تأكد من حفظ البيانات فوراً
          if (typeof window.flushSaveDB === 'function') {
            window.flushSaveDB();
          }

          return result;
        } catch (error) {
          console.error(`❌ خطأ في ${opName}:`, error);
          if (typeof window.toast === 'function') {
            window.toast(`⚠️ حدث خطأ أثناء تنفيذ العملية`);
          }
          throw error;
        }
      };

      // ضع علامة لمنع إعادة اللف
      wrapped.__asyncWrapped = true;
      wrapped.__original = original;

      window[opName] = wrapped;
      wrappedCount++;
    });

    console.log(`✅ async-safety-net: تم تأمين ${wrappedCount} عملية حرجة`);

    /* ============================================================
       تأمين إضافي: منع حفظ الطلب قبل اكتمال جميع العمليات الفرعية
       ============================================================ */

    // نلتف حول flushSaveDB أيضاً للتأكد من عدم وجود عمليات معلقة
    const origFlush = window.flushSaveDB;
    if (origFlush && !origFlush.__asyncWrapped) {
      let pendingFlush = null;

      window.flushSaveDB = function() {
        // ألغِ أي flush معلق
        if (pendingFlush) clearTimeout(pendingFlush);

        // نفذ flush الأصلي فوراً
        try {
          return origFlush.apply(this, arguments);
        } catch (e) {
          console.error('خطأ في flushSaveDB:', e);
        }
      };

      window.flushSaveDB.__asyncWrapped = true;
    }

    /* ============================================================
       تأمين openModal/closeModal من التضارب
       ============================================================ */

    // منع فتح نافذتين في نفس الوقت
    const origOpenModal = window.openModal;
    if (origOpenModal && !origOpenModal.__asyncWrapped) {
      let lastOpenTime = 0;

      window.openModal = function(html) {
        const now = Date.now();

        // تجاهل الفتح المتكرر خلال 100ms (منع الازدواج)
        if (now - lastOpenTime < 100) {
          console.warn('⚠️ تم تجاهل فتح نافذة مكررة');
          return;
        }
        lastOpenTime = now;

        return origOpenModal.apply(this, arguments);
      };

      window.openModal.__asyncWrapped = true;
    }

    /* ============================================================
       كشف الوعود المعلقة (Promise Leaks)
       ============================================================ */

    // اعتراض unhandled promise rejections
    window.addEventListener('unhandledrejection', function(event) {
      console.error('🚨 Promise rejection غير معالجة:', event.reason);

      // لا تظهر للمستخدم إلا لو كانت حرجة
      const reason = event.reason;
      if (reason && reason.message) {
        if (reason.message.includes('saveOrder') ||
            reason.message.includes('saveCustomer') ||
            reason.message.includes('Firebase')) {
          if (typeof window.toast === 'function') {
            window.toast('⚠️ حدث خطأ في حفظ البيانات — تحقق من الاتصال');
          }
        }
      }
    });

    /* ============================================================
       مزامنة تلقائية قبل إغلاق النافذة
       ============================================================ */

    window.addEventListener('beforeunload', function() {
      // تأكد من حفظ أي عمليات معلقة
      if (typeof window.flushSaveDB === 'function') {
        try {
          window.flushSaveDB();
        } catch (e) { /* تجاهل */ }
      }
    });

    /* ============================================================
       تأمين عمليات متزامنة (Debouncing للعمليات المزدوجة)
       ============================================================ */

    // منع النقر المزدوج على أزرار الحفظ
    document.addEventListener('click', function(e) {
      const btn = e.target.closest('button');
      if (!btn) return;

      const onclick = btn.getAttribute('onclick') || '';
      const isSaveOp = onclick.includes('saveOrder') ||
                       onclick.includes('saveCustomer') ||
                       onclick.includes('savePayment') ||
                       onclick.includes('saveExpense');

      if (isSaveOp) {
        // تعطيل مؤقت لمنع النقر المزدوج
        if (btn.disabled) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        btn.disabled = true;
        setTimeout(function() {
          btn.disabled = false;
        }, 800);
      }
    }, true); // capture phase

  }

  // شغّل بعد اكتمال التحميل
  if (document.readyState === 'complete') {
    setTimeout(initSafetyNet, 100);
  } else {
    window.addEventListener('load', function() {
      setTimeout(initSafetyNet, 100);
    });
  }

  console.log('✅ تم تحميل async-safety-net.js');
})();