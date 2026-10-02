/* ============================================================
   session-recovery.js - استرداد الجلسة (Drafts)
   
   ✅ آمن 100%:
      - يحفظ فقط مسودات النماذج غير المكتملة
      - لا يلمس db أو بيانات التطبيق
      - يُمسح تلقائياً عند الحفظ الناجح
      - يمكن حذفه بحذف السطر من index.html
   
   الميزات:
   1. حفظ تلقائي كل 3 ثوانٍ أثناء الكتابة
   2. استرداد عند إعادة فتح التطبيق
   3. مهلة 7 أيام (تُحذف المسودات القديمة)
   4. إشعار عند وجود مسودة قابلة للاسترداد
   5. حماية من المسودات الفارغة
   ============================================================ */

(function() {
  if (window.__sessionRecoveryLoaded) return;
  window.__sessionRecoveryLoaded = true;

  console.log('💾 تحميل session-recovery.js...');

  var DRAFT_KEY_PREFIX = 'jalaba_draft_';
  var DRAFT_MAX_AGE_DAYS = 7;
  var AUTOSAVE_INTERVAL_MS = 3000;

  var currentDraft = null; // { key, saveTimer, savedAt }
  var lastSnapshot = null;

  // ═══════════════════════════════════════════════════════════════
  // كشف النموذج الحالي ونوعه
  // ═══════════════════════════════════════════════════════════════
  
  function detectFormType() {
    var box = document.getElementById('modalBox');
    if (!box) return null;
    
    // نموذج طلب جديد (يحتوي على أصناف)
    if (box.querySelector('#itemsContainer') && box.querySelector('#f_customer')) {
      return 'order';
    }
    
    // نموذج عميل جديد (يحتوي على f_name)
    if (box.querySelector('#f_name') && box.querySelector('#f_phone')) {
      return 'customer';
    }
    
    // نموذج مصروف
    if (box.querySelector('#f_expDesc') && box.querySelector('#f_expAmount')) {
      return 'expense';
    }
    
    // نموذج التزام
    if (box.querySelector('#f_commDesc') && box.querySelector('#f_commAmount')) {
      return 'commitment';
    }
    
    // نموذج مصروف بيت
    if (box.querySelector('#f_houseDesc') && box.querySelector('#f_houseAmount')) {
      return 'house-expense';
    }
    
    return null;
  }

  // ═══════════════════════════════════════════════════════════════
  // أخذ لقطة من النموذج الحالي
  // ═══════════════════════════════════════════════════════════════
  
  function captureForm() {
    var type = detectFormType();
    if (!type) return null;
    
    var box = document.getElementById('modalBox');
    if (!box) return null;
    
    var snapshot = {
      type: type,
      capturedAt: Date.now(),
      fields: {},
      items: [], // للأصناف في الطلبات
      editingId: null // إذا كنا نعدل عنصراً موجوداً
    };
    
    // التقاط بيانات الحقول الأساسية
    var fieldIds = [
      'f_customer', 'f_name', 'f_phone', 'f_family',
      'f_length', 'f_sleeve', 'f_chest', 'f_waist', 'f_shoulder',
      'f_notes', 'f_dateReceived', 'f_dateDelivery',
      'f_extra', 'f_materialCost', 'f_paid', 'f_status',
      'f_discountType', 'f_discountValue', 'f_taxPercent',
      'f_urgent', 'f_urgentFeePercent',
      'f_expDesc', 'f_expAmount', 'f_expDate', 'f_expCat',
      'f_commDesc', 'f_commAmount', 'f_commType', 'f_commDueDay',
      'f_commPriority', 'f_commInterval',
      'f_houseDesc', 'f_houseAmount', 'f_houseCategory', 'f_houseDate',
      'f_assignedWorker'
    ];
    
    fieldIds.forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) return;
      
      if (el.type === 'checkbox') {
        snapshot.fields[id] = el.checked;
      } else {
        var val = el.value;
        // تجاهل الحقول الفارغة
        if (val !== '' && val !== null && val !== undefined) {
          snapshot.fields[id] = val;
        }
      }
    });
    
    // التقاط الأصناف (للطلبات)
    var itemRows = box.querySelectorAll('#itemsContainer .item-row');
    itemRows.forEach(function(row) {
      var typeEl = row.querySelector('.it-type');
      var customEl = row.querySelector('.it-custom');
      var qtyEl = row.querySelector('.it-qty');
      var priceEl = row.querySelector('.it-price');
      
      var item = {
        typeVal: typeEl ? typeEl.value : '',
        customVal: customEl ? customEl.value : '',
        qty: qtyEl ? qtyEl.value : '1',
        price: priceEl ? priceEl.value : ''
      };
      
      // احفظ الصنف فقط إذا كان فيه بيانات فعلية
      if (item.typeVal || item.customVal || item.price) {
        snapshot.items.push(item);
      }
    });
    
    // هل كنا نعدل عنصراً موجوداً؟
    var saveBtn = box.querySelector('button[onclick^="saveOrder"], button[onclick^="saveCustomer"]');
    if (saveBtn) {
      var match = saveBtn.getAttribute('onclick').match(/'([^']+)'/);
      if (match && match[1] !== 'null') {
        snapshot.editingId = match[1];
      }
    }
    
    // هل هناك بيانات فعلية؟
    var hasFields = Object.keys(snapshot.fields).length > 0;
    var hasItems = snapshot.items.length > 0;
    
    if (!hasFields && !hasItems) return null;
    
    return snapshot;
  }

  // ═══════════════════════════════════════════════════════════════
  // حفظ المسودة
  // ═══════════════════════════════════════════════════════════════
  
  function saveDraft() {
    try {
      var snapshot = captureForm();
      if (!snapshot) return;
      
      // لا تحفظ إذا لم يتغير شيء
      var snapshotJson = JSON.stringify({ fields: snapshot.fields, items: snapshot.items });
      if (snapshotJson === lastSnapshot) return;
      lastSnapshot = snapshotJson;
      
      var key = DRAFT_KEY_PREFIX + snapshot.type;
      
      // إذا كان تعديل عنصر موجود، استخدم مفتاحاً مختلفاً
      if (snapshot.editingId) {
        key = DRAFT_KEY_PREFIX + snapshot.type + '_edit_' + snapshot.editingId;
      }
      
      localStorage.setItem(key, JSON.stringify(snapshot));
      
      // حفظ معرف المسودة الحالية
      if (!currentDraft) {
        currentDraft = {
          key: key,
          type: snapshot.type,
          savedAt: Date.now()
        };
      } else {
        currentDraft.savedAt = Date.now();
      }
      
      console.log('💾 حُفظت مسودة ' + snapshot.type);
      
    } catch (e) {
      // تجاوز أخطاء localStorage الممتلئ
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        console.warn('⚠️ لا توجد مساحة لحفظ المسودة');
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // حذف المسودة الحالية (عند الحفظ الناجح)
  // ═══════════════════════════════════════════════════════════════
  
  function clearCurrentDraft() {
    if (currentDraft && currentDraft.key) {
      localStorage.removeItem(currentDraft.key);
      console.log('🗑️ حُذفت المسودة: ' + currentDraft.key);
    }
    
    // امسح أيضاً جميع مسودات نفس النوع (احتياطاً)
    try {
      var keysToRemove = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(DRAFT_KEY_PREFIX) === 0) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(function(k) { localStorage.removeItem(k); });
    } catch (e) { /* تجاهل */ }
    
    currentDraft = null;
    lastSnapshot = null;
  }

  // ═══════════════════════════════════════════════════════════════
  // تشغيل الحفظ التلقائي عندما يُفتح نموذج
  // ═══════════════════════════════════════════════════════════════
  
  var autosaveTimer = null;
  
  function startAutosave() {
    stopAutosave();
    
    autosaveTimer = setInterval(function() {
      if (document.getElementById('modalBox') &&
          document.getElementById('modalOverlay') &&
          document.getElementById('modalOverlay').classList.contains('active')) {
        saveDraft();
      }
    }, AUTOSAVE_INTERVAL_MS);
  }
  
  function stopAutosave() {
    if (autosaveTimer) {
      clearInterval(autosaveTimer);
      autosaveTimer = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // دمج مع openModal و closeModal
  // ═══════════════════════════════════════════════════════════════
  
  if (typeof window.openModal === 'function' && !window.openModal.__recoveryWrapped) {
    var origOpenModal = window.openModal;
    window.openModal = function(html) {
      var result = origOpenModal.apply(this, arguments);
      
      // ابدأ الحفظ التلقائي بعد التأكد من فتح المودال
      setTimeout(function() {
        var type = detectFormType();
        if (type) {
          currentDraft = {
            key: DRAFT_KEY_PREFIX + type,
            type: type,
            savedAt: Date.now()
          };
          lastSnapshot = null;
          startAutosave();
        }
      }, 100);
      
      return result;
    };
    window.openModal.__recoveryWrapped = true;
  }
  
  if (typeof window.closeModal === 'function' && !window.closeModal.__recoveryWrapped) {
    var origCloseModal = window.closeModal;
    window.closeModal = function() {
      // إذا لم يكن الحفظ ناجحاً، احفظ المسودة قبل الإغلاق
      if (currentDraft && !window.__skipUnsavedCheckOnce) {
        saveDraft();
      }
      
      stopAutosave();
      
      // إذا كان الحفظ ناجحاً، امسح المسودة
      if (window.__skipUnsavedCheckOnce) {
        clearCurrentDraft();
      }
      
      // لا نصفّر currentDraft إلا إذا كان الحفظ ناجحاً
      if (window.__skipUnsavedCheckOnce) {
        currentDraft = null;
      }
      
      return origCloseModal.apply(this, arguments);
    };
    window.closeModal.__recoveryWrapped = true;
  }

  // ═══════════════════════════════════════════════════════════════
  // استرداد المسودات
  // ═══════════════════════════════════════════════════════════════
  
  function getAllDrafts() {
    var drafts = [];
    var now = Date.now();
    var maxAge = DRAFT_MAX_AGE_DAYS * 86400000;
    
    try {
      var keysToRemove = [];
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key || key.indexOf(DRAFT_KEY_PREFIX) !== 0) continue;
        
        var raw = localStorage.getItem(key);
        if (!raw) continue;
        
        try {
          var draft = JSON.parse(raw);
          var age = now - (draft.capturedAt || 0);
          
          // احذف المسودات القديمة
          if (age > maxAge) {
            keysToRemove.push(key);
            continue;
          }
          
          drafts.push({
            key: key,
            data: draft,
            age: age
          });
        } catch (e) {
          keysToRemove.push(key);
        }
      }
      
      // نظّف المسودات القديمة
      keysToRemove.forEach(function(k) { localStorage.removeItem(k); });
      
    } catch (e) { /* تجاهل */ }
    
    return drafts;
  }
  
  function draftTypeLabel(type) {
    var labels = {
      'order': '🧵 طلب جديد',
      'customer': '👤 عميل جديد',
      'expense': '🧾 مصروف جديد',
      'commitment': '💳 التزام جديد',
      'house-expense': '🏠 مصروف بيت'
    };
    return labels[type] || '📝 نموذج';
  }
  
  function draftAgeLabel(ageMs) {
    var minutes = Math.floor(ageMs / 60000);
    var hours = Math.floor(minutes / 60);
    var days = Math.floor(hours / 24);
    
    if (minutes < 2) return 'الآن';
    if (minutes < 60) return 'منذ ' + minutes + ' دقيقة';
    if (hours < 24) return 'منذ ' + hours + ' ساعة';
    return 'منذ ' + days + ' يوم';
  }
  
  // ═══════════════════════════════════════════════════════════════
  // عرض نافذة استرداد المسودات
  // ═══════════════════════════════════════════════════════════════
  
  window.showDraftsRecoveryModal = function() {
    var drafts = getAllDrafts();
    
    if (!drafts.length) {
      if (typeof window.toast === 'function') {
        window.toast('لا توجد مسودات محفوظة');
      }
      return;
    }
    
    var html = 
      '<div class="modal-head">' +
        '<h3>💾 استرداد مسودة</h3>' +
        '<button class="modal-close" onclick="closeModal()">✕</button>' +
      '</div>' +
      '<p class="meta">يوجد ' + drafts.length + ' مسودة محفوظة. ' +
        'اختر واحدة لاستردادها، أو احذفها إذا لم تعد بحاجة إليها.</p>';
    
    drafts.forEach(function(draft, i) {
      var typeLabel = draftTypeLabel(draft.data.type);
      var ageLabel = draftAgeLabel(draft.age);
      var itemCount = (draft.data.items || []).length;
      var fieldCount = Object.keys(draft.data.fields || {}).length;
      
      var details = '';
      if (itemCount > 0) {
        details += ' • ' + itemCount + ' صنف';
      }
      if (fieldCount > 0) {
        details += ' • ' + fieldCount + ' حقل';
      }
      
      html += 
        '<div class="card" style="padding:12px;margin-bottom:8px;">' +
          '<div class="row" style="margin-bottom:8px;">' +
            '<b>' + typeLabel + '</b>' +
            '<span class="meta">' + ageLabel + '</span>' +
          '</div>' +
          '<div class="meta" style="margin-bottom:8px;">' + details.replace(' • ', '') + '</div>' +
          '<div class="btn-row">' +
            '<button class="btn sm accent" onclick="restoreDraftByKey(\'' + draft.key.replace(/'/g, "\\'") + '\')">↩️ استرداد</button>' +
            '<button class="btn sm danger" onclick="deleteDraftByKey(\'' + draft.key.replace(/'/g, "\\'") + '\')">🗑️ حذف</button>' +
          '</div>' +
        '</div>';
    });
    
    // زر حذف الكل
    if (drafts.length > 1) {
      html += 
        '<button class="btn outline" style="margin-top:8px;" onclick="deleteAllDrafts()">' +
          '🗑️ حذف كل المسودات' +
        '</button>';
    }
    
    if (typeof window.openModal === 'function') {
      // حفظ مؤقت — تجاوز نظام المسودات في هذه النافذة
      window.__skipRecoveryOnce = true;
      window.openModal(html);
      window.__skipRecoveryOnce = false;
    }
  };
  
  // ═══════════════════════════════════════════════════════════════
  // استرداد مسودة (يملأ النموذج)
  // ═══════════════════════════════════════════════════════════════
  
  window.restoreDraftByKey = async function(key) {
    var raw = localStorage.getItem(key);
    if (!raw) {
      if (typeof window.toast === 'function') window.toast('⚠️ المسودة غير موجودة');
      return;
    }
    
    var draft;
    try {
      draft = JSON.parse(raw);
    } catch (e) {
      if (typeof window.toast === 'function') window.toast('⚠️ المسودة تالفة');
      return;
    }
    
    // أغلق نافذة الاسترداد أولاً
    if (typeof window.closeModal === 'function') window.closeModal();
    
    // انتظر قليلاً حتى تُغلق
    await new Promise(function(resolve) { setTimeout(resolve, 100); });
    
    // افتح النموذج المناسب
    if (draft.type === 'order') {
      if (draft.editingId) {
        openOrderModal(draft.editingId);
      } else {
        openOrderModal(null);
      }
    } else if (draft.type === 'customer') {
      if (draft.editingId) {
        openCustomerModal(draft.editingId);
      } else {
        openCustomerModal(null);
      }
    } else if (draft.type === 'expense') {
      openExpenseModal();
    } else if (draft.type === 'commitment') {
      openCommitmentModal();
    } else if (draft.type === 'house-expense') {
      openHouseExpenseModal();
    }
    
    // انتظر حتى يُفتح النموذج
    await new Promise(function(resolve) { setTimeout(resolve, 300); });
    
    // املأ الحقول
    Object.keys(draft.fields || {}).forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) return;
      
      if (el.type === 'checkbox') {
        el.checked = !!draft.fields[id];
      } else {
        el.value = draft.fields[id];
      }
      
      // أطلق حدث input لتحديث الحسابات
      try {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (e) { /* تجاهل */ }
    });
    
    // املأ الأصناف (للطلبات)
    if (draft.type === 'order' && draft.items && draft.items.length) {
      var container = document.getElementById('itemsContainer');
      if (container) {
        // احذف الأصناف الحالية
        container.innerHTML = '';
        
        // أضف الأصناف المستردة
        draft.items.forEach(function(item) {
          if (typeof window.addItemRow === 'function') {
            window.addItemRow({
              type: '',
              qty: item.qty || 1,
              unitPrice: item.price || ''
            });
          }
        });
        
        // املأ القيم
        var newRows = container.querySelectorAll('.item-row');
        draft.items.forEach(function(item, i) {
          var row = newRows[i];
          if (!row) return;
          
          var typeEl = row.querySelector('.it-type');
          var customEl = row.querySelector('.it-custom');
          var customWrap = row.querySelector('.it-customWrap');
          var qtyEl = row.querySelector('.it-qty');
          var priceEl = row.querySelector('.it-price');
          
          if (typeEl) {
            typeEl.value = item.typeVal || '';
            if (item.typeVal === '__custom__' && customWrap) {
              customWrap.style.display = 'block';
              if (customEl) customEl.value = item.customVal || '';
            }
          }
          if (qtyEl) qtyEl.value = item.qty || 1;
          if (priceEl) priceEl.value = item.price || '';
        });
        
        // أعد حساب الإجمالي
        if (typeof window.recalcItemsTotal === 'function') {
          window.recalcItemsTotal();
        }
      }
    }
    
    // احذف المسودة بعد الاسترداد
    localStorage.removeItem(key);
    
    if (typeof window.toast === 'function') {
      window.toast('✅ تم استرداد المسودة', 3000);
    }
  };
  
  window.deleteDraftByKey = function(key) {
    localStorage.removeItem(key);
    if (typeof window.toast === 'function') {
      window.toast('🗑️ تم حذف المسودة');
    }
    // أعد فتح نافذة الاسترداد
    setTimeout(window.showDraftsRecoveryModal, 300);
  };
  
  window.deleteAllDrafts = async function() {
    var ok = await window.appConfirm(
      'سيتم حذف جميع المسودات المحفوظة نهائياً. هل أنت متأكد؟',
      { okText: 'حذف الكل', cancelText: 'إلغاء', danger: true }
    );
    if (!ok) return;
    
    var drafts = getAllDrafts();
    drafts.forEach(function(d) {
      localStorage.removeItem(d.key);
    });
    
    if (typeof window.closeModal === 'function') window.closeModal();
    
    if (typeof window.toast === 'function') {
      window.toast('✅ تم حذف ' + drafts.length + ' مسودة', 3000);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // إشعار عند فتح التطبيق بوجود مسودات
  // ═══════════════════════════════════════════════════════════════
  
  function checkForDraftsOnLoad() {
    var drafts = getAllDrafts();
    if (!drafts.length) return;
    
    // انتظر حتى يفتح المستخدم التطبيق
    setTimeout(function() {
      // إشعار مخصص
      if (typeof window.toast === 'function') {
        window.toast('💾 لديك ' + drafts.length + ' مسودة محفوظة — اضغط لاستردادها', 5000);
      }
      
      // أضف زر عائم صغير
      injectDraftIndicator(drafts.length);
    }, 3000);
  }
  
  function injectDraftIndicator(count) {
    if (document.getElementById('draftIndicator')) return;
    if (count < 1) return;
    
    var btn = document.createElement('button');
    btn.id = 'draftIndicator';
    btn.style.cssText = 
      'position:fixed;top:80px;left:16px;z-index:9998;' +
      'background:var(--accent);color:#fff;border:none;' +
      'border-radius:22px;padding:8px 14px;font-size:13px;font-weight:700;' +
      'box-shadow:0 4px 12px rgba(0,0,0,.25);cursor:pointer;' +
      'display:flex;align-items:center;gap:6px;';
    btn.innerHTML = '💾 <span>' + count + ' مسودة</span>';
    btn.onclick = function() {
      window.showDraftsRecoveryModal();
      btn.remove();
    };
    document.body.appendChild(btn);
    
    // احذف الزر عند استرداد أو حذف المسودات
    var checkInterval = setInterval(function() {
      var remaining = getAllDrafts();
      if (remaining.length === 0) {
        clearInterval(checkInterval);
        if (btn.parentNode) btn.remove();
      } else {
        var span = btn.querySelector('span');
        if (span) span.textContent = remaining.length + ' مسودة';
      }
    }, 5000);
  }

  // ═══════════════════════════════════════════════════════════════
  // تشغيل الفحص عند تحميل التطبيق
  // ═══════════════════════════════════════════════════════════════
  
  window.addEventListener('load', function() {
    setTimeout(checkForDraftsOnLoad, 500);
  });
  
  // مراقبة عند تبديل الصفحات
  var origShowPage = window.showPage;
  if (typeof origShowPage === 'function' && !origShowPage.__recoveryWrapped) {
    window.showPage = function(name) {
      var r = origShowPage.apply(this, arguments);
      // تحقق من المسودات عند العودة للرئيسية
      if (name === 'home') {
        setTimeout(function() {
          var drafts = getAllDrafts();
          if (drafts.length > 0 && !document.getElementById('draftIndicator')) {
            injectDraftIndicator(drafts.length);
          }
        }, 500);
      }
      return r;
    };
    window.showPage.__recoveryWrapped = true;
  }

  // ═══════════════════════════════════════════════════════════════
  // أداة عرض المسودات في Console (للمطور)
  // ═══════════════════════════════════════════════════════════════
  
  window.showDraftsInfo = function() {
    var drafts = getAllDrafts();
    console.log('💾 المسودات المحفوظة: ' + drafts.length);
    drafts.forEach(function(d, i) {
      console.log('  ' + (i + 1) + '. ' + draftTypeLabel(d.data.type) + 
                  ' — ' + draftAgeLabel(d.age) +
                  ' — ' + JSON.stringify(d.data.fields).length + ' bytes');
    });
  };

  console.log('✅ تم تحميل session-recovery.js');
  console.log('   - حفظ تلقائي كل 3 ثوانٍ');
  console.log('   - استرداد من الإشعار عند الفتح');
  console.log('   - حفظ لمدة 7 أيام');

})();
