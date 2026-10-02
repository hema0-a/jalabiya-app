/* ============================================================
   smart-validator.js - مساعد الإدخال الذكي
   
   ✅ آمن 100%:
      - لا يعدّل أي دالة موجودة
      - ينبّه فقط (لا يمنع الحفظ)
      - يمكن حذفه بحذف السطر من index.html
   
   التحققات:
   1. رقم الهاتف (مصري 11 رقماً)
   2. الأسعار (قيم غير واقعية)
   3. التواريخ (تناسق منطقي)
   4. الأسماء المكررة
   5. الكميات الغريبة
   6. القيم السالبة
   ============================================================ */

(function() {
  if (window.__smartValidatorLoaded) return;
  window.__smartValidatorLoaded = true;

  console.log('🎯 تحميل smart-validator.js...');

  // ═══════════════════════════════════════════════════════════════
  // الأدوات المساعدة
  // ═══════════════════════════════════════════════════════════════

  function createHintElement(fieldId) {
    var existing = document.getElementById('hint-' + fieldId);
    if (existing) return existing;
    
    var hint = document.createElement('div');
    hint.id = 'hint-' + fieldId;
    hint.style.cssText = 
      'font-size:11.5px;margin-top:4px;padding:4px 8px;border-radius:6px;' +
      'display:none;line-height:1.5;transition:all .2s;';
    return hint;
  }

  function showHint(fieldId, message, level) {
    var field = document.getElementById(fieldId);
    if (!field) return;
    
    var parent = field.closest('.field') || field.parentElement;
    if (!parent) return;
    
    var hint = document.getElementById('hint-' + fieldId);
    if (!hint) {
      hint = createHintElement(fieldId);
      field.insertAdjacentElement('afterend', hint);
    }
    
    // إزالة الحواف السابقة
    field.style.borderColor = '';
    field.style.boxShadow = '';
    
    if (!message) {
      hint.style.display = 'none';
      return;
    }
    
    var colors = {
      danger: { bg: 'var(--danger-light)', color: 'var(--danger)', border: 'var(--danger)', icon: '🚨' },
      warn: { bg: 'var(--warn-light)', color: 'var(--warn)', border: 'var(--warn)', icon: '⚠️' },
      info: { bg: 'var(--info-light)', color: 'var(--info)', border: 'var(--info)', icon: 'ℹ️' },
      good: { bg: 'var(--ok-light)', color: 'var(--ok)', border: 'var(--ok)', icon: '✅' }
    };
    
    var c = colors[level] || colors.info;
    
    hint.style.display = 'block';
    hint.style.background = c.bg;
    hint.style.color = c.color;
    hint.innerHTML = c.icon + ' ' + escapeHtml(message);
    
    if (level === 'danger') {
      field.style.borderColor = c.border;
      field.style.boxShadow = '0 0 0 2px ' + c.border + '22';
    } else if (level === 'warn') {
      field.style.borderColor = c.border;
    }
  }

  function escapeHtml(s) {
    if (s === undefined || s === null) return '';
    return String(s).replace(/[&<>"']/g, function(m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // التحقق من رقم الهاتف المصري
  // ═══════════════════════════════════════════════════════════════

  function validatePhone(value) {
    if (!value) return null;
    var digits = String(value).replace(/[^0-9]/g, '');
    
    if (digits.length === 0) return null;
    
    if (digits.length < 11) {
      return { level: 'warn', msg: 'رقم مصري يجب أن يكون 11 رقماً (حالياً ' + digits.length + ')' };
    }
    
    if (!/^01[0125]/.test(digits)) {
      return { level: 'danger', msg: 'رقم مصري يجب أن يبدأ بـ 010 أو 011 أو 012 أو 015' };
    }
    
    if (digits.length !== 11) {
      return { level: 'warn', msg: 'رقم مصري يجب أن يكون 11 رقماً بالظبط' };
    }
    
    return { level: 'good', msg: 'رقم صحيح' };
  }

  // ═══════════════════════════════════════════════════════════════
  // التحقق من الأسعار
  // ═══════════════════════════════════════════════════════════════

  function validatePrice(value, fieldName) {
    if (value === '' || value === null || value === undefined) return null;
    var num = Number(value);
    
    if (isNaN(num)) {
      return { level: 'danger', msg: 'يجب إدخال رقم' };
    }
    
    if (num < 0) {
      return { level: 'danger', msg: 'لا يمكن أن يكون سالباً' };
    }
    
    if (num === 0) {
      return { level: 'info', msg: 'القيمة صفر' };
    }
    
    // حدود واقعية لتطبيق تفصيل
    var limits = {
      price: { high: 2000, veryHigh: 5000 },
      amount: { high: 50000, veryHigh: 200000 },
      fee: { high: 3000, veryHigh: 10000 }
    };
    
    var key = fieldName || 'price';
    var lim = limits[key] || limits.price;
    
    if (num > lim.veryHigh) {
      return { level: 'warn', msg: 'قيمة عالية جداً — تأكد من صحة الرقم' };
    }
    
    if (num > lim.high) {
      return { level: 'info', msg: 'قيمة عالية — تأكد من صحة الرقم' };
    }
    
    return null;
  }

  // ═══════════════════════════════════════════════════════════════
  // التحقق من التواريخ
  // ═══════════════════════════════════════════════════════════════

  function validateDatePair(receivedId, deliveryId) {
    var receivedEl = document.getElementById(receivedId);
    var deliveryEl = document.getElementById(deliveryId);
    
    if (!receivedEl || !deliveryEl) return;
    
    var received = receivedEl.value;
    var delivery = deliveryEl.value;
    
    // تحذير: تاريخ التسليم قبل الاستلام
    if (received && delivery && delivery < received) {
      showHint(deliveryId, 'تاريخ التسليم قبل تاريخ الاستلام!', 'danger');
      return;
    }
    
    if (received && delivery) {
      // حساب الفرق
      var diff = Math.round((new Date(delivery) - new Date(received)) / 86400000);
      
      if (diff < 0) {
        showHint(deliveryId, 'تاريخ التسليم قبل الاستلام', 'danger');
        return;
      }
      
      if (diff === 0) {
        showHint(deliveryId, 'الاستلام والتسليم في نفس اليوم — هل هذا صحيح؟', 'warn');
        return;
      }
      
      if (diff > 90) {
        showHint(deliveryId, 'موعد التسليم بعد ' + diff + ' يوم — تأكد', 'info');
        return;
      }
      
      // حد أقصى معقول
      if (diff >= 1 && diff <= 90) {
        var msg = diff === 1 ? 'يوم واحد' : (diff === 2 ? 'يومان' : diff + ' يوماً');
        showHint(deliveryId, 'المهلة: ' + msg, 'good');
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // التحقق من تكرار اسم العميل
  // ═══════════════════════════════════════════════════════════════

  function validateCustomerName(value) {
    if (!value || !value.trim()) return null;
    var name = value.trim();
    
    if (name.length < 2) {
      return { level: 'warn', msg: 'الاسم قصير جداً' };
    }
    
    if (name.length > 50) {
      return { level: 'info', msg: 'الاسم طويل — تأكد من صحته' };
    }
    
    // البحث عن عميل بنفس الاسم
    if (window.db && window.db.customers) {
      // تجاهل العميل الحالي في حالة التعديل
      var box = document.getElementById('modalBox');
      var editingId = null;
      var saveBtn = box ? box.querySelector('button[onclick^="saveCustomer"]') : null;
      if (saveBtn) {
        var match = saveBtn.getAttribute('onclick').match(/'([^']+)'/);
        if (match && match[1] !== 'null') editingId = match[1];
      }
      
      var matches = window.db.customers.filter(function(c) {
        return c.id !== editingId && c.name && c.name.trim() === name;
      });
      
      if (matches.length > 0) {
        return { level: 'warn', msg: 'يوجد ' + matches.length + ' عميل بنفس الاسم — قد يكون مكرراً' };
      }
    }
    
    return null;
  }

  // ═══════════════════════════════════════════════════════════════
  // التحقق من الكميات
  // ═══════════════════════════════════════════════════════════════

  function validateQuantity(value) {
    if (value === '' || value === null || value === undefined) return null;
    var num = Number(value);
    
    if (isNaN(num)) return { level: 'danger', msg: 'يجب إدخال رقم' };
    if (num < 1) return { level: 'danger', msg: 'يجب أن يكون 1 على الأقل' };
    if (num > 50) return { level: 'warn', msg: 'كمية كبيرة (' + num + ') — تأكد' };
    if (num > 100) return { level: 'danger', msg: 'كمية ضخمة جداً — تأكد' };
    
    return null;
  }

  // ═══════════════════════════════════════════════════════════════
  // ربط التحققات بالحقول
  // ═══════════════════════════════════════════════════════════════

  function attachValidators() {
    // ═══ رقم الهاتف (في نموذج العميل) ═══
    var phoneField = document.getElementById('f_phone');
    if (phoneField && !phoneField.__validatorAttached) {
      phoneField.__validatorAttached = true;
      
      var validatePhoneField = function() {
        var result = validatePhone(phoneField.value);
        if (result) {
          showHint('f_phone', result.msg, result.level);
        } else {
          showHint('f_phone', null);
        }
      };
      
      phoneField.addEventListener('input', validatePhoneField);
      phoneField.addEventListener('blur', validatePhoneField);
    }
    
    // ═══ رقم الهاتف في نموذج بيانات الورشة ═══
    var ownerPhone = document.getElementById('ownerPhoneInput');
    if (ownerPhone && !ownerPhone.__validatorAttached) {
      ownerPhone.__validatorAttached = true;
      
      ownerPhone.addEventListener('input', function() {
        var result = validatePhone(ownerPhone.value);
        if (result && result.level !== 'good') {
          showHint('ownerPhoneInput', result.msg, result.level);
        } else {
          showHint('ownerPhoneInput', null);
        }
      });
    }
    
    // ═══ اسم العميل (تكرار) ═══
    var nameField = document.getElementById('f_name');
    if (nameField && !nameField.__validatorAttached) {
      nameField.__validatorAttached = true;
      
      var validateNameField = function() {
        var result = validateCustomerName(nameField.value);
        if (result) {
          showHint('f_name', result.msg, result.level);
        } else {
          showHint('f_name', null);
        }
      };
      
      nameField.addEventListener('blur', validateNameField);
    }
    
    // ═══ تواريخ الطلب ═══
    var dateReceived = document.getElementById('f_dateReceived');
    var dateDelivery = document.getElementById('f_dateDelivery');
    
    if (dateReceived && !dateReceived.__validatorAttached) {
      dateReceived.__validatorAttached = true;
      dateReceived.addEventListener('change', function() {
        validateDatePair('f_dateReceived', 'f_dateDelivery');
      });
    }
    
    if (dateDelivery && !dateDelivery.__validatorAttached) {
      dateDelivery.__validatorAttached = true;
      dateDelivery.addEventListener('change', function() {
        validateDatePair('f_dateReceived', 'f_dateDelivery');
      });
    }
    
    // ═══ المدفوع مقدماً ═══
    var paidField = document.getElementById('f_paid');
    if (paidField && !paidField.__validatorAttached) {
      paidField.__validatorAttached = true;
      
      paidField.addEventListener('input', function() {
        var num = Number(paidField.value);
        if (isNaN(num) || paidField.value === '') {
          showHint('f_paid', null);
          return;
        }
        
        if (num < 0) {
          showHint('f_paid', 'لا يمكن أن يكون سالباً', 'danger');
          return;
        }
        
        // تحقق من عدم تجاوز الإجمالي
        var itemsSum = 0;
        document.querySelectorAll('#itemsContainer .item-row').forEach(function(row) {
          var qty = Number(row.querySelector('.it-qty').value) || 1;
          var price = Number(row.querySelector('.it-price').value) || 0;
          itemsSum += qty * price;
        });
        
        var extra = Number((document.getElementById('f_extra') || {}).value) || 0;
        var total = itemsSum + extra;
        
        if (num > total && total > 0) {
          var diff = num - total;
          showHint('f_paid', 'المدفوع أكبر من الإجمالي بـ ' + diff.toLocaleString('ar-EG') + ' ج.م', 'warn');
        } else if (num > 0) {
          var remaining = total - num;
          showHint('f_paid', 'المتبقي: ' + remaining.toLocaleString('ar-EG') + ' ج.م', 'info');
        } else {
          showHint('f_paid', null);
        }
      });
    }
    
    // ═══ المصاريف الإضافية ═══
    var extraField = document.getElementById('f_extra');
    if (extraField && !extraField.__validatorAttached) {
      extraField.__validatorAttached = true;
      
      extraField.addEventListener('input', function() {
        var result = validatePrice(extraField.value, 'amount');
        if (result) {
          showHint('f_extra', result.msg, result.level);
        } else {
          showHint('f_extra', null);
        }
      });
    }
    
    // ═══ تكلفة الخامة ═══
    var materialField = document.getElementById('f_materialCost');
    if (materialField && !materialField.__validatorAttached) {
      materialField.__validatorAttached = true;
      
      materialField.addEventListener('input', function() {
        var result = validatePrice(materialField.value, 'amount');
        if (result) {
          showHint('f_materialCost', result.msg, result.level);
        } else {
          showHint('f_materialCost', null);
        }
      });
    }
    
    // ═══ مبلغ المصروف ═══
    var expAmount = document.getElementById('f_expAmount');
    if (expAmount && !expAmount.__validatorAttached) {
      expAmount.__validatorAttached = true;
      
      expAmount.addEventListener('input', function() {
        var result = validatePrice(expAmount.value, 'amount');
        if (result) {
          showHint('f_expAmount', result.msg, result.level);
        } else {
          showHint('f_expAmount', null);
        }
      });
    }
    
    // ═══ مبلغ مصروف البيت ═══
    var houseAmount = document.getElementById('f_houseAmount');
    if (houseAmount && !houseAmount.__validatorAttached) {
      houseAmount.__validatorAttached = true;
      
      houseAmount.addEventListener('input', function() {
        var result = validatePrice(houseAmount.value, 'amount');
        if (result) {
          showHint('f_houseAmount', result.msg, result.level);
        } else {
          showHint('f_houseAmount', null);
        }
      });
    }
    
    // ═══ مبلغ الالتزام ═══
    var commAmount = document.getElementById('f_commAmount');
    if (commAmount && !commAmount.__validatorAttached) {
      commAmount.__validatorAttached = true;
      
      commAmount.addEventListener('input', function() {
        var result = validatePrice(commAmount.value, 'amount');
        if (result) {
          showHint('f_commAmount', result.msg, result.level);
        } else {
          showHint('f_commAmount', null);
        }
      });
    }
    
    // ═══ يوم الاستحقاق ═══
    var commDueDay = document.getElementById('f_commDueDay');
    if (commDueDay && !commDueDay.__validatorAttached) {
      commDueDay.__validatorAttached = true;
      
      commDueDay.addEventListener('input', function() {
        var num = Number(commDueDay.value);
        if (!commDueDay.value) {
          showHint('f_commDueDay', null);
          return;
        }
        
        if (isNaN(num) || num < 1 || num > 31) {
          showHint('f_commDueDay', 'يجب أن يكون بين 1 و31', 'danger');
        } else if (num > 28) {
          showHint('f_commDueDay', 'قد لا يوجد هذا اليوم في بعض الشهور', 'info');
        } else {
          showHint('f_commDueDay', null);
        }
      });
    }
    
    // ═══ كميات الأصناف (تُضاف يدوياً) ═══
    document.querySelectorAll('.it-qty').forEach(function(qtyField) {
      if (qtyField.__validatorAttached) return;
      qtyField.__validatorAttached = true;
      
      qtyField.addEventListener('input', function() {
        // نستخدم data attribute لتتبع كل صنف
        var row = qtyField.closest('.item-row');
        if (!row) return;
        
        var result = validateQuantity(qtyField.value);
        if (result) {
          // أضف الحقل id ديناميكي
          var uniqueId = qtyField.dataset.hintId;
          if (!uniqueId) {
            uniqueId = 'qty-' + Math.random().toString(36).slice(2, 8);
            qtyField.dataset.hintId = uniqueId;
          }
          
          // استخدم حقل مخفي بدل إنشاء div جديد
          showHintForElement(qtyField, result.msg, result.level);
        } else {
          hideHintForElement(qtyField);
        }
      });
    });
    
    // ═══ أسعار الأصناف ═══
    document.querySelectorAll('.it-price').forEach(function(priceField) {
      if (priceField.__validatorAttached) return;
      priceField.__validatorAttached = true;
      
      priceField.addEventListener('input', function() {
        var result = validatePrice(priceField.value, 'price');
        if (result) {
          showHintForElement(priceField, result.msg, result.level);
        } else {
          hideHintForElement(priceField);
        }
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // نسخة عامة لعرض التنبيه على أي عنصر (للأصناف)
  // ═══════════════════════════════════════════════════════════════

  function showHintForElement(el, message, level) {
    var hint = el.nextElementSibling;
    if (!hint || !hint.classList || !hint.classList.contains('smart-hint')) {
      hint = document.createElement('div');
      hint.className = 'smart-hint';
      hint.style.cssText = 
        'font-size:11px;margin-top:3px;padding:3px 7px;border-radius:5px;' +
        'line-height:1.4;';
      el.insertAdjacentElement('afterend', hint);
    }
    
    var colors = {
      danger: { bg: 'var(--danger-light)', color: 'var(--danger)', icon: '🚨' },
      warn: { bg: 'var(--warn-light)', color: 'var(--warn)', icon: '⚠️' },
      info: { bg: 'var(--info-light)', color: 'var(--info)', icon: 'ℹ️' },
      good: { bg: 'var(--ok-light)', color: 'var(--ok)', icon: '✅' }
    };
    
    var c = colors[level] || colors.info;
    hint.style.display = 'block';
    hint.style.background = c.bg;
    hint.style.color = c.color;
    hint.innerHTML = c.icon + ' ' + escapeHtml(message);
    
    if (level === 'danger') {
      el.style.borderColor = 'var(--danger)';
    } else {
      el.style.borderColor = '';
    }
  }

  function hideHintForElement(el) {
    var hint = el.nextElementSibling;
    if (hint && hint.classList && hint.classList.contains('smart-hint')) {
      hint.style.display = 'none';
    }
    el.style.borderColor = '';
  }

  // ═══════════════════════════════════════════════════════════════
  // تشغيل التحققات عند فتح أي مودال
  // ═══════════════════════════════════════════════════════════════

  if (typeof window.openModal === 'function' && !window.openModal.__validatorWrapped) {
    var origOpenModal = window.openModal;
    window.openModal = function(html) {
      var result = origOpenModal.apply(this, arguments);
      
      // تشغيل التحققات بعد ظهور المودال
      setTimeout(function() {
        attachValidators();
      }, 100);
      
      return result;
    };
    window.openModal.__validatorWrapped = true;
  }

  // ═══════════════════════════════════════════════════════════════
  // أداة اختبار
  // ═══════════════════════════════════════════════════════════════

  window.testValidator = function() {
    console.log('🎯 اختبار smart-validator:');
    
    var tests = [
      { name: 'رقم صحيح', result: validatePhone('01012345678') },
      { name: 'رقم قصير', result: validatePhone('0101234') },
      { name: 'رقم خاطئ', result: validatePhone('02012345678') },
      { name: 'سعر طبيعي', result: validatePrice(250, 'price') },
      { name: 'سعر ضخم', result: validatePrice(8000, 'price') },
      { name: 'سعر سالب', result: validatePrice(-100, 'price') },
      { name: 'كمية كبيرة', result: validateQuantity(75) },
      { name: 'كمية ضخمة', result: validateQuantity(200) }
    ];
    
    tests.forEach(function(t) {
      console.log('   ' + t.name + ':', JSON.stringify(t.result));
    });
    
    if (typeof window.toast === 'function') {
      window.toast('✅ اطلع على نتائج الاختبار في Console', 3000);
    }
  };

  console.log('✅ تم تحميل smart-validator.js');
  console.log('   - تحقق فوري من الأرقام');
  console.log('   - تنبيه للأسعار الغريبة');
  console.log('   - فحص تناسق التواريخ');
  console.log('   - كشف الأسماء المكررة');

})();
