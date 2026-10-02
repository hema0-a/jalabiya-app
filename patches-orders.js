/* ============================================================
   patches-orders.js - إدارة الطلبات والعملاء
   [الجزء 2 من 4 من patches.js القديم]
   
   المحتوى:
   - نظام نقاط الولاء
   - رسائل جاهزية الطلب (واتساب)
   - شارات الأيام المتبقية
   - سحب بطاقات الطلبات
   - عرض قياسات العميل في نموذج الطلب
   - إدخال صوتي للملاحظات
   - كشف حساب العميل (طباعة + مشاركة)
   - متوسط وقت التفصيل لكل نوع
   - كشف تكرار أرقام الهواتف
   - ربط طلبات العائلة
   - تأكيد قبل حفظ عميل/طلب موجود
   - قفل الطلبات المُسلَّمة
   - تبسيط أزرار الكروت للعملاء
   - تراجع متعدد الخطوات (5 مستويات)
   - تصنيف المصروفات
   - تنبيه المناسبات الموسمية
   - تمييز الطلبات عالية القيمة
   ============================================================ */

(function() {
  if (window.__patchesOrdersLoaded) return;
  window.__patchesOrdersLoaded = true;

  console.log('📋 تحميل patches-orders.js...');

  /* ============================================================
     [1] نظام نقاط الولاء (كل 5 طلبات = خصم 10%)
     ============================================================ */
  function customerLoyaltyInfo(c) {
    var delivered = db.orders.filter(function(o) {
      return o.customerId === c.id && o.status === 'تم التسليم';
    }).length;
    var lastRedeemedAt = Number(localStorage.getItem('loyaltyRedeemed_' + c.id)) || 0;
    var progress = delivered - lastRedeemedAt;
    var threshold = 5;
    return { delivered: delivered, progress: progress, threshold: threshold, eligible: progress >= threshold };
  }

  var origRCLoyalty = renderCustomers;
  renderCustomers = function() {
    origRCLoyalty.apply(this, arguments);
    try {
      document.querySelectorAll('#customersList .card').forEach(function(card) {
        if (card.dataset.loyaltyAdded) return;
        var metas = card.querySelectorAll('.meta');
        var phoneEl = null;
        metas.forEach(function(m) {
          if (!phoneEl && m.textContent.trim().indexOf('📞') === 0) phoneEl = m;
        });
        if (!phoneEl) return;
        var digits = phoneEl.textContent.replace(/[^0-9]/g, '');
        var c = db.customers.find(function(x) {
          return (x.phone || '').replace(/[^0-9]/g, '') === digits;
        });
        if (!c) return;
        card.dataset.loyaltyAdded = '1';
        var info = customerLoyaltyInfo(c);
        var chip = document.createElement('div');
        chip.className = 'meta';
        chip.style.marginTop = '4px';
        chip.innerHTML = info.eligible
          ? '<span style="background:var(--accent-light);color:var(--accent-dark);border-radius:8px;padding:3px 9px;font-size:12px;font-weight:800;">🎁 مؤهل لخصم ولاء 10% بالطلب القادم</span>'
          : '🎁 نقاط الولاء: ' + info.progress + '/' + info.threshold + ' طلبات للخصم القادم';
        phoneEl.insertAdjacentElement('afterend', chip);
      });
    } catch (e) { /* تجاهل */ }
  };

  var pendingLoyalty = null;
  var origOOMLoyalty = openOrderModal;
  openOrderModal = function(id, presetCustomerId) {
    var r = origOOMLoyalty.apply(this, arguments);
    if (!id) {
      setTimeout(function() {
        try {
          var custId = presetCustomerId || (document.getElementById('f_customer') ? document.getElementById('f_customer').value : '');
          var c = custId ? customerById(custId) : null;
          if (!c) return;
          var info = customerLoyaltyInfo(c);
          if (info.eligible) {
            var dType = document.getElementById('f_discountType');
            var dVal = document.getElementById('f_discountValue');
            if (dType && dVal && dType.value === 'none') {
              dType.value = 'percent';
              dVal.value = '10';
              onDiscountTypeChange();
              pendingLoyalty = { customerId: c.id, offeredAtDelivered: info.delivered };
              toast('🎁 العميل مؤهل لخصم ولاء، تم تطبيق 10% تلقائيًا');
            }
          }
        } catch (e) { /* تجاهل */ }
      }, 60);
    }
    return r;
  };

  var origSOLoyalty = saveOrder;
  saveOrder = function(id) {
    var beforeCount = db.orders.length;
    var custIdBefore = document.getElementById('f_customer') ? document.getElementById('f_customer').value : null;
    var r = origSOLoyalty.apply(this, arguments);
    try {
      if (!id && pendingLoyalty && pendingLoyalty.customerId === custIdBefore && db.orders.length > beforeCount) {
        localStorage.setItem('loyaltyRedeemed_' + pendingLoyalty.customerId, pendingLoyalty.offeredAtDelivered);
        pendingLoyalty = null;
      }
    } catch (e) { /* تجاهل */ }
    return r;
  };

  /* ============================================================
     [2] رسالة جاهزية الطلب عبر واتساب
     ============================================================ */
  function buildReadyMessage(o, c) {
    var shopName = db.workshopName || 'ورشة تفصيل الجلابيب';
    return 'مرحبًا ' + c.name + '، طلبك (' + orderTypeLabel(o) + ') بقى جاهز للاستلام من ' + shopName + '. تقدر تمر تستلمه في أقرب وقت يناسبك 🙏';
  }

  var origSOReady = saveOrder;
  saveOrder = function(id) {
    var oldStatus = null;
    if (id) {
      var existing = db.orders.find(function(x) { return x.id === id; });
      if (existing) oldStatus = existing.status;
    }
    var r = origSOReady.apply(this, arguments);
    try {
      if (id) {
        var o = db.orders.find(function(x) { return x.id === id; });
        if (o && o.status === 'جاهز للتسليم' && oldStatus !== 'جاهز للتسليم') {
          var c = customerById(o.customerId);
          if (c && c.phone) {
            var digits = c.phone.replace(/[^0-9]/g, '');
            var waNum = digits.replace(/^0/, '2');
            var msg = buildReadyMessage(o, c);
            setTimeout(function() {
              openModal(
                '<div class="modal-head"><h3>📲 إشعار العميل بجاهزية الطلب</h3><button class="modal-close" onclick="closeModal()">✕</button></div>' +
                '<p class="meta">تقدر ترسل رسالة جاهزة للعميل:</p>' +
                '<div class="card" style="padding:10px;font-size:13.5px;white-space:pre-wrap;">' + escapeHtml(msg) + '</div>' +
                '<a class="btn accent" style="display:block;text-align:center;margin-top:10px;text-decoration:none;" target="_blank" href="https://wa.me/' + waNum + '?text=' + encodeURIComponent(msg) + '">💬 إرسال عبر واتساب</a>'
              );
            }, 300);
          }
        }
      }
    } catch (e) { /* تجاهل */ }
    return r;
  };

  /* ============================================================
     [3] شارات الأيام المتبقية على بطاقات الطلبات
     ============================================================ */
  function tagOrderCards(container) {
    if (!container) return;
    container.querySelectorAll('.card').forEach(function(card) {
      if (card.dataset.orderId) return;
      var btn = card.querySelector('[onclick*="openOrderModal("]') || card.querySelector('[onclick*="markOrderDelivered("]');
      if (btn) {
        var m = btn.getAttribute('onclick').match(/(?:openOrderModal|markOrderDelivered)\('([^']+)'/);
        if (m) card.dataset.orderId = m[1];
      }
    });
  }

  function addDaysBadges(container) {
    if (!container) return;
    tagOrderCards(container);
    container.querySelectorAll('.card[data-order-id]').forEach(function(card) {
      if (card.dataset.daysBadgeAdded) return;
      var o = db.orders.find(function(x) { return x.id === card.dataset.orderId; });
      if (!o || !o.dateDelivery || o.status === 'تم التسليم') return;
      var diff = Math.round((new Date(o.dateDelivery) - new Date(todayStr())) / 86400000);
      var label, color;
      if (diff < 0) { label = 'متأخر ' + Math.abs(diff) + ' يوم'; color = 'var(--danger)'; }
      else if (diff === 0) { label = 'التسليم النهاردة'; color = 'var(--warn)'; }
      else { label = 'باقي ' + diff + ' يوم'; color = 'var(--info)'; }
      var metaLine = Array.prototype.find.call(card.querySelectorAll('.meta'), function(m) {
        return m.textContent.indexOf('التسليم') !== -1;
      });
      if (metaLine) {
        card.dataset.daysBadgeAdded = '1';
        var badge = document.createElement('span');
        badge.style.cssText = 'display:inline-block;margin-inline-start:8px;font-size:11.5px;font-weight:800;color:' + color + ';';
        badge.textContent = '⏳ ' + label;
        metaLine.appendChild(badge);
      }
    });
  }

  new MutationObserver(function() {
    addDaysBadges(document.getElementById('ordersList'));
    addDaysBadges(document.getElementById('todayPlan'));
  }).observe(document.getElementById('app'), { childList: true, subtree: true });

  /* ============================================================
     [4] سحب بطاقات الطلبات (Swipe Gestures)
     ============================================================ */
  var swipeStartX = 0, swipeStartY = 0, swipeActiveCard = null, swipeOpenCard = null, swipeDragging = false;

  function closeOpenSwipeCard() {
    if (swipeOpenCard) {
      swipeOpenCard.style.transform = '';
      var reveal = swipeOpenCard.__revealEl;
      if (reveal) reveal.remove();
      swipeOpenCard.__revealEl = null;
    }
    swipeOpenCard = null;
  }

  function resetSwipeCard() {
    if (swipeActiveCard && swipeActiveCard !== swipeOpenCard) {
      swipeActiveCard.style.transform = '';
      swipeActiveCard.style.opacity = '';
    }
    swipeActiveCard = null;
    swipeDragging = false;
  }

  function ensureSwipeCardId(card) {
    if (card.dataset.orderId) return;
    var btn = card.querySelector('[onclick*="openOrderModal("]');
    if (btn) {
      var m = btn.getAttribute('onclick').match(/openOrderModal\('([^']+)'/);
      if (m) card.dataset.orderId = m[1];
    }
  }

  function revealDeliverBtn(card, id) {
    var wrap = card.parentElement;
    if (!wrap) return null;
    if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
    var el = document.createElement('div');
    el.className = 'swipe-reveal-deliver';
    el.style.cssText = 'position:absolute;border-radius:inherit;background:var(--ok,#1F6D57);color:#fff;display:flex;align-items:center;padding-inline-start:18px;font-weight:800;font-size:14px;z-index:0;box-sizing:border-box;';
    el.style.top = card.offsetTop + 'px';
    el.style.left = card.offsetLeft + 'px';
    el.style.width = card.offsetWidth + 'px';
    el.style.height = card.offsetHeight + 'px';
    el.textContent = '✅ اضغط لتسجيل تم التسليم';
    el.addEventListener('click', function() {
      var o = db.orders.find(function(x) { return x.id === id; });
      var custName = o ? ((customerById(o.customerId) || {}).name || '') : '';
      appConfirm('هل تريد تسجيل طلب' + (custName ? (' "' + custName + '"') : '') + ' كـ"تم التسليم"؟',
        { okText: 'تم التسليم', cancelText: 'إلغاء', danger: false }).then(function(ok) {
        closeOpenSwipeCard();
        if (ok) {
          if (navigator.vibrate) navigator.vibrate(30);
          markOrderDelivered(id);
        }
      });
    });
    wrap.insertBefore(el, card);
    card.style.position = 'relative';
    card.style.zIndex = '1';
    if (!card.style.background) card.style.background = 'var(--card)';
    return el;
  }

  document.addEventListener('touchstart', function(e) {
    if (e.target.closest('.swipe-reveal-deliver')) return;
    if (e.target.closest('button, input, select, textarea, label, a')) return;
    var card = e.target.closest('#ordersList .card');
    if (!card) {
      if (swipeOpenCard) closeOpenSwipeCard();
      return;
    }
    if (swipeOpenCard && swipeOpenCard !== card) { closeOpenSwipeCard(); }
    ensureSwipeCardId(card);
    swipeActiveCard = card;
    swipeDragging = false;
    swipeStartX = e.touches[0].clientX;
    swipeStartY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchmove', function(e) {
    if (!swipeActiveCard) return;
    var dx = e.touches[0].clientX - swipeStartX;
    var dy = e.touches[0].clientY - swipeStartY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
      swipeDragging = true;
      var clamped = Math.max(-90, Math.min(90, dx));
      swipeActiveCard.style.transform = 'translateX(' + clamped + 'px)';
      swipeActiveCard.style.opacity = Math.max(0.6, 1 - Math.abs(clamped) / 250);
    }
  }, { passive: true });

  document.addEventListener('touchend', function(e) {
    if (!swipeActiveCard) return;
    if (!swipeDragging) { swipeActiveCard = null; return; }
    var dx = e.changedTouches[0].clientX - swipeStartX;
    var dy = e.changedTouches[0].clientY - swipeStartY;
    var id = swipeActiveCard.dataset.orderId;
    var card = swipeActiveCard;
    var opened = false;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && id) {
      var o = db.orders.find(function(x) { return x.id === id; });
      if (dx > 0 && o && o.status !== 'تم التسليم') {
        card.style.transform = 'translateX(70px)';
        card.__revealEl = revealDeliverBtn(card, id);
        swipeOpenCard = card;
        opened = true;
      } else if (dx < 0) {
        if (navigator.vibrate) navigator.vibrate(20);
        openOrderModal(id);
      }
    }
    if (!opened) {
      card.style.transform = '';
      card.style.opacity = '';
    }
    swipeActiveCard = null;
    swipeDragging = false;
  });

  document.addEventListener('touchcancel', resetSwipeCard);

  /* ============================================================
     [5] عرض قياسات العميل في نموذج الطلب
     ============================================================ */
  function measurementsHtml(c) {
    if (!c) return '';
    var rows = [
      ['📏 الطول', c.length],
      ['📏 الصدر', c.chest],
      ['📏 الخزنة', c.waist],
      ['📏 طول الكم', c.sleeve],
      ['📏 وسع الكم', c.shoulder]
    ].filter(function(r) { return r[1] !== undefined && r[1] !== null && r[1] !== ''; });
    if (rows.length === 0 && !c.notes) return '';
    var rowsHtml = rows.map(function(r) {
      return '<div class="row" style="padding:3px 0;"><span class="meta">' + r[0] + '</span><b>' + escapeHtml(String(r[1])) + ' سم</b></div>';
    }).join('');
    var notesHtml = c.notes ? '<div class="meta" style="margin-top:6px;">📝 ' + escapeHtml(c.notes) + '</div>' : '';
    return '<div class="card" id="customerMeasureBox" style="margin:-6px 0 14px;padding:10px 12px;background:var(--card-alt);">' +
      '<div class="section-title" style="font-size:13px;margin-bottom:4px;">📏 قياسات العميل المحفوظة</div>' +
      rowsHtml + notesHtml +
      '</div>';
  }

  function renderCustomerMeasureBox() {
    try {
      var sel = document.getElementById('f_customer');
      if (!sel) return;
      var old = document.getElementById('customerMeasureBox');
      if (old) old.remove();
      var c = sel.value ? customerById(sel.value) : null;
      var html = measurementsHtml(c);
      if (html) {
        sel.closest('.field').insertAdjacentHTML('afterend', html);
      }
    } catch (e) { /* تجاهل */ }
  }

  var origOOM_measurements = openOrderModal;
  openOrderModal = function(id, presetCustomerId) {
    var r = origOOM_measurements.apply(this, arguments);
    setTimeout(function() {
      renderCustomerMeasureBox();
      var sel = document.getElementById('f_customer');
      if (sel && !sel.dataset.measureBound) {
        sel.dataset.measureBound = '1';
        sel.addEventListener('change', renderCustomerMeasureBox);
      }
    }, 30);
    return r;
  };

  /* ============================================================
     [6] الإدخال الصوتي للملاحظات
     ============================================================ */
  function attachMic(textareaId) {
    var ta = document.getElementById(textareaId);
    if (!ta || ta.dataset.micAdded) return;
    ta.dataset.micAdded = '1';
    var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn sm secondary';
    btn.style.marginTop = '6px';
    btn.textContent = '🎤 إدخال بالصوت';
    if (!Recognition) {
      btn.disabled = true;
      btn.title = 'التعرف على الصوت مش مدعوم في هذا المتصفح';
      btn.style.opacity = '0.5';
    } else {
      btn.onclick = function() {
        try {
          var rec = new Recognition();
          rec.lang = 'ar-EG';
          rec.interimResults = false;
          btn.textContent = '🎙️ ...جارِ الاستماع';
          btn.disabled = true;
          rec.onresult = function(e) {
            var text = e.results[0][0].transcript;
            ta.value = (ta.value ? ta.value.trim() + ' ' : '') + text;
            toast('✅ تم إضافة النص بالصوت');
          };
          rec.onerror = function() { toast('⚠️ تعذر التعرف على الصوت'); };
          rec.onend = function() {
            btn.textContent = '🎤 إدخال بالصوت';
            btn.disabled = false;
          };
          rec.start();
        } catch (e) {
          toast('⚠️ خاصية الصوت مش متاحة');
          btn.disabled = false;
          btn.textContent = '🎤 إدخال بالصوت';
        }
      };
    }
    ta.insertAdjacentElement('afterend', btn);
  }

  var origOCM_mic = openCustomerModal;
  openCustomerModal = function(id) {
    var r = origOCM_mic.apply(this, arguments);
    setTimeout(function() { attachMic('f_notes'); }, 30);
    return r;
  };

  /* ============================================================
     [7] كشف حساب العميل (طباعة + مشاركة)
     ============================================================ */
  function statementRows(orders) {
    return orders.map(function(o) {
      return '- ' + fmtDate(o.dateReceived) + ' | ' + orderTypeLabel(o) +
        ' | الإجمالي: ' + orderTotal(o).toLocaleString('ar-EG') +
        ' | مدفوع: ' + (Number(o.paid) || 0).toLocaleString('ar-EG') +
        ' | متبقي: ' + orderRemaining(o).toLocaleString('ar-EG') + ' ج.م';
    }).join('\n');
  }

  window.printCustomerStatement = function(id) {
    var c = customerById(id);
    if (!c) return;
    var orders = db.orders.filter(function(o) { return o.customerId === id; })
      .sort(function(a, b) { return (a.dateReceived || '').localeCompare(b.dateReceived || ''); });
    var totalPaid = orders.reduce(function(s, o) { return s + (Number(o.paid) || 0); }, 0);
    var totalRemaining = orders.reduce(function(s, o) { return s + orderRemaining(o); }, 0);
    var rowsHtml = orders.length ? orders.map(function(o) {
      return '<tr><td>' + fmtDate(o.dateReceived) + '</td><td>' + escapeHtml(orderTypeLabel(o)) +
        '</td><td>' + orderTotal(o).toLocaleString('ar-EG') + '</td><td>' +
        (Number(o.paid) || 0).toLocaleString('ar-EG') + '</td><td>' +
        orderRemaining(o).toLocaleString('ar-EG') + '</td></tr>';
    }).join('') : '<tr><td colspan="5" style="text-align:center;color:#888;">لا توجد طلبات</td></tr>';
    var html =
      '<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>كشف حساب - ' + escapeHtml(c.name) + '</title>' +
      '<style>' +
      'body{font-family:Tahoma,Arial,sans-serif;padding:24px;color:#222;}' +
      'h1{font-size:19px;border-bottom:2px solid #1F6D57;padding-bottom:8px;}' +
      'table{width:100%;border-collapse:collapse;margin-top:14px;font-size:13px;}' +
      'th,td{padding:8px 6px;border-bottom:1px solid #ddd;text-align:center;}' +
      'th{background:#f5f3ef;}' +
      '.totals{margin-top:16px;display:flex;gap:14px;justify-content:flex-end;font-size:14px;}' +
      '.totals b{color:#1F6D57;}' +
      '</style></head><body>' +
      printBrandHeaderHtml() +
      '<h1>🧾 كشف حساب - ' + escapeHtml(c.name) + '</h1>' +
      '<p style="font-size:13px;color:#666;">📞 ' + escapeHtml(c.phone || '-') + ' — تاريخ الكشف: ' + fmtDate(todayStr()) + '</p>' +
      '<table><tr><th>تاريخ الاستلام</th><th>الصنف</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th></tr>' + rowsHtml + '</table>' +
      '<div class="totals"><div>إجمالي المدفوع: <b>' + totalPaid.toLocaleString('ar-EG') + ' ج.م</b></div><div>إجمالي المتبقي: <b>' + totalRemaining.toLocaleString('ar-EG') + ' ج.م</b></div></div>' +
      '</body></html>';
    openPrintWindow(html, 'كشف_حساب_' + c.name);
  };

  window.shareCustomerStatement = function(id) {
    var c = customerById(id);
    if (!c) return;
    var orders = db.orders.filter(function(o) { return o.customerId === id; })
      .sort(function(a, b) { return (a.dateReceived || '').localeCompare(b.dateReceived || ''); });
    var totalPaid = orders.reduce(function(s, o) { return s + (Number(o.paid) || 0); }, 0);
    var totalRemaining = orders.reduce(function(s, o) { return s + orderRemaining(o); }, 0);
    var msg = '🧾 كشف حساب - ' + c.name + '\n' +
      (db.workshopName || 'ورشة تفصيل الجلابيب') + '\n' +
      'تاريخ: ' + fmtDate(todayStr()) + '\n\n' +
      statementRows(orders) + '\n\n' +
      'إجمالي المدفوع: ' + totalPaid.toLocaleString('ar-EG') + ' ج.م\n' +
      'إجمالي المتبقي: ' + totalRemaining.toLocaleString('ar-EG') + ' ج.م';
    if (navigator.share) {
      navigator.share({ title: 'كشف حساب ' + c.name, text: msg }).catch(function() {});
      return;
    }
    var phone = (c.phone || '').replace(/[^0-9]/g, '');
    if (phone) {
      if (phone.indexOf('0') === 0) phone = '2' + phone;
      openExternalLink('https://wa.me/' + phone + '?text=' + encodeURIComponent(msg));
    } else {
      openExternalLink('https://wa.me/?text=' + encodeURIComponent(msg));
    }
  };

  var origOCH_statement = openCustomerHistory;
  openCustomerHistory = function(id) {
    var r = origOCH_statement.apply(this, arguments);
    setTimeout(function() {
      try {
        var box = document.getElementById('modalBox');
        var gridCards = box.querySelector('.grid-cards');
        if (!gridCards) return;
        var existingRow = document.getElementById('statementBtnRow');
        if (existingRow) existingRow.remove();
        var row = document.createElement('div');
        row.id = 'statementBtnRow';
        row.className = 'btn-row';
        row.style.margin = '10px 0 4px';
        row.innerHTML =
          '<button class="btn sm secondary" onclick="printCustomerStatement(\'' + id + '\')">🖨️ طباعة كشف حساب</button>' +
          '<button class="btn sm accent" onclick="shareCustomerStatement(\'' + id + '\')">📲 مشاركة واتساب</button>';
        gridCards.insertAdjacentElement('afterend', row);
      } catch (e) { /* تجاهل */ }
    }, 30);
    return r;
  };

  /* ============================================================
     [8] متوسط وقت التفصيل الفعلي لكل نوع
     ============================================================ */
  function computeAvgWorkTimes() {
    var stats = {};
    db.orders.forEach(function(o) {
      if (!o.actualMinutes || o.actualMinutes <= 0) return;
      var entries = [];
      if (Array.isArray(o.items) && o.items.length === 1) {
        entries = [{ type: o.items[0].type, qty: o.items[0].qty || 1 }];
      } else if (!Array.isArray(o.items) && o.type) {
        entries = [{ type: o.type, qty: o.qty || 1 }];
      }
      entries.forEach(function(e) {
        var perPiece = o.actualMinutes / Math.max(1, e.qty);
        if (!stats[e.type]) stats[e.type] = { total: 0, count: 0 };
        stats[e.type].total += perPiece;
        stats[e.type].count += 1;
      });
    });
    return Object.keys(stats).map(function(type) {
      return { type: type, avg: Math.round(stats[type].total / stats[type].count), count: stats[type].count };
    }).sort(function(a, b) { return b.count - a.count; });
  }

  var origRF_avgtime = renderFinance;
  renderFinance = function() {
    origRF_avgtime.apply(this, arguments);
    try {
      var rows = computeAvgWorkTimes();
      var box = document.getElementById('avgWorkTimeBox');
      if (!box) {
        box = document.createElement('div');
        box.id = 'avgWorkTimeBox';
        var anchor = document.getElementById('bestDayBox') ||
          document.getElementById('expectedCashflowBox') ||
          document.getElementById('financeStats');
        if (anchor) anchor.insertAdjacentElement('afterend', box);
      }
      var rowsHtml = rows.length ? rows.map(function(r) {
        return '<div class="row" style="padding:5px 0;border-bottom:1px solid var(--border);"><span>' +
          escapeHtml(r.type) + '</span><b>' + formatMinutesLabel(r.avg) +
          ' <span class="meta" style="font-size:11px;">(' + r.count + ' قطعة)</span></b></div>';
      }).join('') : '<div class="empty-msg">لسه مفيش وقت شغل مسجّل كفاية — استخدم زر "بدء/إيقاف التوقيت" على الطلبات</div>';
      box.innerHTML = '<div class="section-title">⏱️ متوسط وقت التفصيل الفعلي لكل نوع</div><div class="card">' + rowsHtml + '</div>';
    } catch (e) { /* تجاهل */ }
  };

  /* ============================================================
     [9] كشف تكرار أرقام الهواتف
     ============================================================ */
  function findDuplicatePhones() {
    var groups = {};
    db.customers.forEach(function(c) {
      var digits = (c.phone || '').replace(/[^0-9]/g, '');
      if (digits.length < 8) return;
      if (!groups[digits]) groups[digits] = [];
      groups[digits].push(c);
    });
    return Object.keys(groups).map(function(k) { return groups[k]; })
      .filter(function(g) { return g.length > 1; });
  }

  var origRC_dupPhone = renderCustomers;
  renderCustomers = function() {
    origRC_dupPhone.apply(this, arguments);
    try {
      var list = document.getElementById('customersList');
      if (!list) return;
      var old = document.getElementById('dupPhoneAlert');
      if (old) old.remove();
      var dups = findDuplicatePhones();
      if (dups.length === 0) return;
      var names = dups.map(function(g) {
        return g.map(function(c) { return c.name; }).join(' / ');
      }).join('، ');
      var box = document.createElement('div');
      box.id = 'dupPhoneAlert';
      box.className = 'alert-banner warn';
      box.style.marginBottom = '10px';
      box.innerHTML = '<span class="ic">⚠️</span><div><b>فيه ' + dups.length +
        ' رقم هاتف مكرر بين أكتر من عميل</b>' + escapeHtml(names) +
        ' — راجعهم علشان مايتلخبطش حساب الولاء وحد المديونية.</div>';
      list.insertAdjacentElement('beforebegin', box);
    } catch (e) { /* تجاهل */ }
  };

  /* ============================================================
     [10] ربط طلبات العائلة
     ============================================================ */
  function familyMembers(familyName) {
    return db.customers.filter(function(c) { return c.family === familyName; });
  }

  function familyOrdersData(familyName) {
    var members = familyMembers(familyName);
    var rows = [];
    members.forEach(function(m) {
      db.orders.filter(function(o) { return o.customerId === m.id; }).forEach(function(o) {
        rows.push({ order: o, customer: m });
      });
    });
    rows.sort(function(a, b) { return (a.order.dateReceived || '').localeCompare(b.order.dateReceived || ''); });
    return { members: members, rows: rows };
  }

  window.viewFamilyGroup = function(familyName) {
    var data = familyOrdersData(familyName);
    var totalPaid = data.rows.reduce(function(s, x) { return s + (Number(x.order.paid) || 0); }, 0);
    var totalRemaining = data.rows.reduce(function(s, x) { return s + orderRemaining(x.order); }, 0);
    var rowsHtml = data.rows.map(function(x) {
      return '<div class="card"><div class="row"><h3>' + escapeHtml(x.customer.name) +
        ' - ' + escapeHtml(orderTypeLabel(x.order)) + '</h3>' +
        '<b>' + orderTotal(x.order).toLocaleString('ar-EG') + ' ج.م</b></div>' +
        '<div class="meta">📅 ' + fmtDate(x.order.dateReceived) + ' — متبقي: ' +
        orderRemaining(x.order).toLocaleString('ar-EG') + ' ج.م</div></div>';
    }).join('') || '<div class="empty-msg">لا توجد طلبات مسجلة لهذه العائلة</div>';

    openModal(
      '<div class="modal-head"><h3>👪 ' + escapeHtml(familyName) + '</h3><button class="modal-close" onclick="closeModal()">✕</button></div>' +
      '<p class="meta">' + data.members.length + ' أفراد — ' + data.rows.length + ' طلب إجمالاً</p>' +
      '<div class="card" style="padding:10px 12px;margin-bottom:12px;background:var(--card-alt);">' +
        '<div class="row"><span class="meta">إجمالي المدفوع</span><b style="color:var(--ok);">' + totalPaid.toLocaleString('ar-EG') + ' ج.م</b></div>' +
        '<div class="row"><span class="meta">إجمالي المتبقي</span><b style="color:var(--danger);">' + totalRemaining.toLocaleString('ar-EG') + ' ج.م</b></div>' +
      '</div>' +
      rowsHtml +
      '<button class="btn sm secondary" style="margin-top:10px;" onclick="printFamilyStatement(\'' + familyName.replace(/'/g, "\\'") + '\')">🖨️ طباعة كشف حساب العائلة</button>'
    );
  };

  window.printFamilyStatement = function(familyName) {
    var data = familyOrdersData(familyName);
    var totalPaid = data.rows.reduce(function(s, x) { return s + (Number(x.order.paid) || 0); }, 0);
    var totalRemaining = data.rows.reduce(function(s, x) { return s + orderRemaining(x.order); }, 0);
    var rowsHtml = data.rows.length ? data.rows.map(function(x) {
      return '<tr><td>' + escapeHtml(x.customer.name) + '</td><td>' + fmtDate(x.order.dateReceived) +
        '</td><td>' + escapeHtml(orderTypeLabel(x.order)) + '</td><td>' +
        orderTotal(x.order).toLocaleString('ar-EG') + '</td><td>' +
        (Number(x.order.paid) || 0).toLocaleString('ar-EG') + '</td><td>' +
        orderRemaining(x.order).toLocaleString('ar-EG') + '</td></tr>';
    }).join('') : '<tr><td colspan="6" style="text-align:center;color:#888;">لا توجد طلبات</td></tr>';
    var html = '<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>كشف حساب عائلة - ' +
      escapeHtml(familyName) + '</title>' +
      '<style>body{font-family:Tahoma,Arial,sans-serif;padding:24px;color:#222;} ' +
      'h1{font-size:19px;border-bottom:2px solid #1F6D57;padding-bottom:8px;} ' +
      'table{width:100%;border-collapse:collapse;margin-top:14px;font-size:13px;} ' +
      'th,td{padding:8px 6px;border-bottom:1px solid #ddd;text-align:center;} ' +
      'th{background:#f5f3ef;} ' +
      '.totals{margin-top:16px;display:flex;gap:14px;justify-content:flex-end;font-size:14px;} .totals b{color:#1F6D57;}</style></head><body>' +
      printBrandHeaderHtml() +
      '<h1>🧾 كشف حساب عائلة - ' + escapeHtml(familyName) + '</h1>' +
      '<p style="font-size:13px;color:#666;">عدد الأفراد: ' + data.members.length + ' — تاريخ الكشف: ' + fmtDate(todayStr()) + '</p>' +
      '<table><tr><th>الاسم</th><th>تاريخ الاستلام</th><th>الصنف</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th></tr>' + rowsHtml + '</table>' +
      '<div class="totals"><div>إجمالي المدفوع: <b>' + totalPaid.toLocaleString('ar-EG') + ' ج.م</b></div>' +
      '<div>إجمالي المتبقي: <b>' + totalRemaining.toLocaleString('ar-EG') + ' ج.م</b></div></div>' +
      '</body></html>';
    openPrintWindow(html, 'كشف_حساب_عائلة_' + familyName);
  };

  var origRC_family = renderCustomers;
  renderCustomers = function() {
    origRC_family.apply(this, arguments);
    try {
      document.querySelectorAll('#customersList .card').forEach(function(card) {
        if (card.dataset.familyBadgeAdded) return;
        var phoneEl = null;
        card.querySelectorAll('.meta').forEach(function(m) {
          if (!phoneEl && m.textContent.trim().indexOf('📞') === 0) phoneEl = m;
        });
        if (!phoneEl) return;
        var digits = phoneEl.textContent.replace(/[^0-9]/g, '');
        var c = db.customers.find(function(x) { return (x.phone || '').replace(/[^0-9]/g, '') === digits; });
        if (!c || !c.family) return;
        var siblingsCount = familyMembers(c.family).length;
        if (siblingsCount < 2) return;
        card.dataset.familyBadgeAdded = '1';
        var chip = document.createElement('div');
        chip.className = 'meta';
        chip.style.cssText = 'margin-top:4px;';
        chip.innerHTML = '<span style="background:var(--info-light);color:var(--info);border-radius:8px;padding:3px 9px;font-size:11.5px;font-weight:700;cursor:pointer;">👪 ' + escapeHtml(c.family) + ' (' + siblingsCount + ' أفراد)</span>';
        chip.querySelector('span').onclick = function() { viewFamilyGroup(c.family); };
        phoneEl.insertAdjacentElement('afterend', chip);
      });
    } catch (e) { /* تجاهل */ }
  };

  /* ============================================================
     [11] تأكيد قبل حفظ تعديل عميل موجود
     ============================================================ */
  var origSaveCustomerConfirm = saveCustomer;
  saveCustomer = async function(id) {
    if (id) {
      var c = customerById(id);
      var ok = await appConfirm(
        'هل تريد حفظ التعديلات على بيانات العميل' + (c ? (' "' + c.name + '"') : '') + '؟',
        { okText: 'حفظ التعديل', cancelText: 'إلغاء', danger: false }
      );
      if (!ok) return;
    }
    window.__skipUnsavedCheckOnce = true;
    var r = await origSaveCustomerConfirm.apply(this, arguments);
    var ov = document.getElementById('modalOverlay');
    if (ov && ov.classList.contains('active')) window.__skipUnsavedCheckOnce = false;
    return r;
  };

  /* ============================================================
     [12] تأكيد قبل حفظ تعديل طلب موجود (مع تنبيه خاص للتسليم)
     ============================================================ */
  var origSaveOrderConfirm = saveOrder;
  saveOrder = async function(id) {
    if (id) {
      var o = db.orders.find(function(x) { return x.id === id; });
      var c = o ? customerById(o.customerId) : null;
      var statusSel = document.getElementById('f_status');
      var newStatus = statusSel ? statusSel.value : null;
      var becomingDelivered = o && o.status !== 'تم التسليم' && newStatus === 'تم التسليم';
      var ok;
      if (becomingDelivered) {
        ok = await appConfirm(
          '⚠️ هذا التغيير هيسجّل' + (c ? (' طلب "' + c.name + '"') : ' هذا الطلب') + ' كـ"تم التسليم" بالكامل. هل أنت متأكد؟',
          { okText: 'نعم، تم التسليم', cancelText: 'إلغاء', danger: false }
        );
      } else {
        ok = await appConfirm(
          'هل تريد حفظ التعديلات على' + (c ? (' طلب "' + c.name + '"') : ' هذا الطلب') + '؟',
          { okText: 'حفظ التعديل', cancelText: 'إلغاء', danger: false }
        );
      }
      if (!ok) return;
    }
    window.__skipUnsavedCheckOnce = true;
    var r = await origSaveOrderConfirm.apply(this, arguments);
    var ov = document.getElementById('modalOverlay');
    if (ov && ov.classList.contains('active')) window.__skipUnsavedCheckOnce = false;
    return r;
  };

  /* ============================================================
     [13] قفل الطلبات المُسلَّمة من التعديل العرضي
     ============================================================ */
  var unlockedOrderId = null;

  var origOpenOrderModalLock = openOrderModal;
  openOrderModal = function(id, presetCustomerId) {
    if (id && id !== unlockedOrderId) {
      var o = db.orders.find(function(x) { return x.id === id; });
      if (o && o.status === 'تم التسليم') {
        var c = customerById(o.customerId);
        openModal(
          '<div class="modal-head"><h3>🔒 طلب مُسلَّم بالفعل</h3><button class="modal-close" onclick="closeModal()">✕</button></div>' +
          '<p class="meta">طلب' + (c ? (' "' + escapeHtml(c.name) + '"') : '') + ' متسجل "تم التسليم" بالفعل. الفورم مقفول تلقائيًا لمنع أي تعديل غير مقصود عليه.</p>' +
          '<button class="btn outline" onclick="window.__unlockOrderForEdit(\'' + id + '\')">✏️ فتح للتعديل رغم كده</button>'
        );
        return;
      }
    }
    return origOpenOrderModalLock.apply(this, arguments);
  };

  window.__unlockOrderForEdit = function(id) {
    unlockedOrderId = id;
    openOrderModal(id);
  };

  var origCloseModalLock = closeModal;
  closeModal = function() {
    unlockedOrderId = null;
    return origCloseModalLock.apply(this, arguments);
  };

  /* ============================================================
     [14] تسليم جزئي (بالتوافق مع feature-partial-delivery.js)
     ============================================================ */
  // ملاحظة: هذا موجود بالفعل في feature-partial-delivery.js
  // نحتفظ به هنا كنسخة احتياطية في حال لم يتم تحميل الملف

  if (typeof window.openPartialDeliveryModal !== 'function') {
    window.openPartialDeliveryModal = function(orderId) {
      var o = db.orders.find(function(x) { return x.id === orderId; });
      if (!o || !Array.isArray(o.items) || o.items.length === 0) {
        toast('التسليم الجزئي متاح فقط للطلبات اللي فيها أكتر من صنف');
        return;
      }
      if (!o.partialDeliveries) o.partialDeliveries = {};
      var delivered = o.partialDeliveries;
      var rows = o.items.map(function(it, idx) {
        var already = delivered[idx] || 0;
        var total = it.qty || 1;
        return '<div class="field">' +
          '<label>' + escapeHtml(orderTypeLabel({ items: [it] })) + ' (الإجمالي: ' + total + ')</label>' +
          '<input type="number" id="pd_item_' + idx + '" min="0" max="' + total + '" value="' + already + '" style="width:100%;">' +
          '</div>';
      }).join('');
      openModal(
        '<div class="modal-head"><h3>📦 تسليم جزئي</h3><button class="modal-close" onclick="closeModal()">✕</button></div>' +
        '<p class="meta">حدّد كام قطعة اتسلمت من كل صنف:</p>' +
        rows +
        '<button class="btn" onclick="savePartialDelivery(\'' + orderId + '\')">💾 حفظ التسليم الجزئي</button>'
      );
    };
  }

  /* ============================================================
     [15] تراجع متعدد الخطوات (5 مستويات)
     ============================================================ */
  var MAX_UNDO = 5;
  window.__undoStack = [];

  window.setUndo = function(label, restoreFn) {
    window.__undoStack.unshift({ label: label, restoreFn: restoreFn });
    if (window.__undoStack.length > MAX_UNDO) window.__undoStack.length = MAX_UNDO;
    if (typeof window.renderUndoBar === 'function') window.renderUndoBar();
  };

  window.performUndo = function(idx) {
    idx = idx || 0;
    var entry = window.__undoStack[idx];
    if (!entry) {
      toast('لا يوجد إجراء حديث للتراجع عنه');
      return;
    }
    window.__undoStack.splice(idx, 1);
    entry.restoreFn();
    if (typeof window.renderUndoBar === 'function') window.renderUndoBar();
    toast('تم التراجع عن: ' + entry.label + ' ↩️');
  };

  window.renderUndoBar = function() {
    var box = document.getElementById('undoBarWrap');
    if (!box) return;
    if (!window.__undoStack.length) { box.innerHTML = ''; return; }
    box.innerHTML = window.__undoStack.map(function(entry, i) {
      return '<button class="btn sm outline" style="width:100%;margin-bottom:8px;" onclick="performUndo(' + i + ')">↩️ تراجع عن: ' + escapeHtml(entry.label) + '</button>';
    }).join('');
  };

  /* ============================================================
     [16] تصنيف المصروفات بفئات
     ============================================================ */
  var DEFAULT_CATS = ['خامات وأقمشة', 'إيجار', 'فواتير', 'صيانة وأدوات', 'مواصلات', 'رواتب وعمالة', 'أخرى'];
  var expenseCatFilter = 'all';

  function expenseCats() {
    return (db.expenseCategories && db.expenseCategories.length) ? db.expenseCategories : DEFAULT_CATS;
  }

  window.openExpenseModal = function() {
    var cats = expenseCats();
    var html =
      '<div class="modal-head"><h3>➕ مصروف جديد</h3><button class="modal-close" onclick="closeModal()">✕</button></div>' +
      '<div class="field"><label>وصف المصروف</label><input id="f_expDesc" placeholder="مثال: خيوط، أزرار، سوست..."></div>' +
      '<div class="field"><label>الفئة</label><select id="f_expCat">' + cats.map(function(c) {
        return '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + '</option>';
      }).join('') + '</select></div>' +
      '<div class="field"><label>المبلغ (ج.م)</label><input id="f_expAmount" type="number" placeholder="0"></div>' +
      '<div class="field"><label>التاريخ</label><input id="f_expDate" type="date" value="' + todayStr() + '"></div>' +
      '<button class="btn" onclick="saveExpense()">💾 حفظ</button>';
    openModal(html);
  };

  window.saveExpense = function() {
    var desc = document.getElementById('f_expDesc').value.trim();
    var catEl = document.getElementById('f_expCat');
    var cat = catEl ? catEl.value : 'أخرى';
    var amount = Number(document.getElementById('f_expAmount').value) || 0;
    var date = document.getElementById('f_expDate').value || todayStr();
    if (!desc) { toast('أدخل وصف المصروف'); return; }
    if (amount <= 0) { toast('أدخل مبلغاً صحيحاً'); return; }
    var record = { id: uid(), desc: desc, amount: amount, date: date, cat: cat };
    db.expenses.push(record);
    logActivity('🧵 مصروف جديد: ' + desc + ' (' + amount.toLocaleString('ar-EG') + ' ج.م)');
    setUndo('إضافة المصروف', function() {
      db.expenses = db.expenses.filter(function(e) { return e.id !== record.id; });
      saveDB();
      renderExpenses();
    });
    saveDB(true);
    closeModal();
    renderExpenses();
    toast('تم إضافة المصروف ✅');
  };

  window.setExpenseCatFilter = function(cat) {
    expenseCatFilter = cat;
    renderExpenses();
  };

  renderExpenses = function() {
    var all = db.expenses;
    var filtered = expenseCatFilter === 'all' ? all : all.filter(function(e) {
      return (e.cat || 'أخرى') === expenseCatFilter;
    });
    var total = filtered.reduce(function(s, e) { return s + Number(e.amount || 0); }, 0);
    var totalEl = document.getElementById('totalExpensesTxt');
    if (totalEl) totalEl.textContent = total.toLocaleString('ar-EG') + ' ج.م';

    var cats = expenseCats();
    var catTotals = {};
    all.forEach(function(e) {
      var c = e.cat || 'أخرى';
      catTotals[c] = (catTotals[c] || 0) + Number(e.amount || 0);
    });

    var chipsHtml = '<span class="rc-chip" style="' + (expenseCatFilter === 'all' ? 'background:var(--accent);color:#fff;' : '') +
      '" onclick="setExpenseCatFilter(\'all\')">الكل</span>' +
      cats.filter(function(c) { return catTotals[c]; }).map(function(c) {
        return '<span class="rc-chip" style="' + (expenseCatFilter === c ? 'background:var(--accent);color:#fff;' : '') +
          '" onclick="setExpenseCatFilter(\'' + c.replace(/'/g, "\\'") + '\')">' + escapeHtml(c) +
          ' (' + catTotals[c].toLocaleString('ar-EG') + ')</span>';
      }).join('');

    var chipsBox = document.getElementById('expenseCatChips');
    if (!chipsBox) {
      chipsBox = document.createElement('div');
      chipsBox.id = 'expenseCatChips';
      chipsBox.style.cssText = 'display:flex;gap:8px;overflow-x:auto;padding-bottom:8px;margin-bottom:10px;';
      var addBtn = document.querySelector('#page-expenses .btn[onclick="openExpenseModal()"]');
      if (addBtn) addBtn.insertAdjacentElement('afterend', chipsBox);
    }
    chipsBox.innerHTML = chipsHtml;

    var list = filtered.slice().sort(function(a, b) { return b.date.localeCompare(a.date); });
    var listEl = document.getElementById('expensesList');
    if (listEl) {
      listEl.innerHTML = list.length ? list.map(function(e) {
        return '<div class="card">' +
          '<div class="row"><h3>' + escapeHtml(e.desc) + '</h3><b style="color:var(--danger)">' + Number(e.amount).toLocaleString('ar-EG') + ' ج.م</b></div>' +
          '<div class="meta">📅 ' + fmtDate(e.date) + ' — <span class="badge">' + escapeHtml(e.cat || 'أخرى') + '</span></div>' +
          '<div class="btn-row"><button class="btn sm danger" onclick="deleteExpense(\'' + e.id + '\')">🗑️ حذف</button></div>' +
          '</div>';
      }).join('') : '<div class="empty-msg">لا توجد مصروفات ' + (expenseCatFilter === 'all' ? 'مسجلة' : 'في هذه الفئة') + '</div>';
    }
  };

  /* ============================================================
     [17] تنبيه المناسبات الموسمية
     ============================================================ */
  setTimeout(function() {
    try {
      var today = todayStr();
      var alertWindow = 21;
      (db.holidays || []).forEach(function(h) {
        if (!h.date) return;
        var diff = Math.round((new Date(h.date) - new Date(today)) / 86400000);
        if (diff >= 0 && diff <= alertWindow) {
          var key = 'seasonalAlertShown_' + h.id;
          var lastDiff = localStorage.getItem(key);
          var shouldShow = !lastDiff || (Number(lastDiff) - diff) >= 7 || diff === 0;
          if (shouldShow) {
            toast('📆 باقي ' + diff + ' يوم على "' + h.name + '" — فكّر تجهز الطاقة الاستيعابية وتبلغ عملائك بمواعيد التسليم بدري');
            localStorage.setItem(key, diff);
          }
        }
      });
    } catch (e) { /* تجاهل */ }
  }, 1300);

  /* ============================================================
     [18] تمييز الطلبات عالية القيمة
     ============================================================ */
  function isHighValueUrgent(o) {
    if (!o || o.status === 'تم التسليم' || !o.dateDelivery) return false;
    var diffDays = Math.round((new Date(o.dateDelivery) - new Date(todayStr())) / 86400000);
    if (diffDays > 2) return false;
    var active = db.orders.filter(function(x) { return x.status !== 'تم التسليم'; });
    if (active.length < 3) return false;
    var avg = active.reduce(function(s, x) { return s + orderTotal(x); }, 0) / active.length;
    return orderTotal(o) >= avg * 1.5;
  }

  function tagHighValueCards(container) {
    if (!container) return;
    container.querySelectorAll('.card').forEach(function(card) {
      var btn = card.querySelector('[onclick*="openOrderModal("]') || card.querySelector('[onclick*="markOrderDelivered("]');
      if (!btn) return;
      var m = btn.getAttribute('onclick').match(/(?:openOrderModal|markOrderDelivered)\('([^']+)'/);
      if (!m) return;
      var o = db.orders.find(function(x) { return x.id === m[1]; });
      var badge = card.querySelector('.high-value-badge');
      if (isHighValueUrgent(o)) {
        card.classList.add('high-value-alert');
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'high-value-badge';
          badge.style.cssText = 'display:inline-block;margin-inline-start:8px;background:var(--accent);color:#fff;border-radius:8px;padding:2px 8px;font-size:11px;font-weight:900;';
          badge.textContent = '💎 قيمة عالية وقربت';
          var row = card.querySelector('.row');
          if (row) row.appendChild(badge);
        }
      } else {
        card.classList.remove('high-value-alert');
        if (badge) badge.remove();
      }
    });
  }

  new MutationObserver(function() {
    tagHighValueCards(document.getElementById('ordersList'));
    tagHighValueCards(document.getElementById('todayPlan'));
  }).observe(document.getElementById('app'), { childList: true, subtree: true });

  /* ============================================================
     [19] خطة اليوم عند فتح التطبيق (مرة واحدة يومياً)
     ============================================================ */
  setTimeout(function() {
    try {
      if (typeof computeTodayQueue !== 'function') return;
      var today = todayStr();
      if (localStorage.getItem('dailyPlanShownDate') === today) return;
      if (isDayOff(new Date())) {
        localStorage.setItem('dailyPlanShownDate', today);
        return;
      }
      var q = computeTodayQueue();
      var queue = q.queue || [];
      var mustFinish = q.mustFinish || [];
      if (queue.length === 0) {
        localStorage.setItem('dailyPlanShownDate', today);
        return;
      }
      var items = queue.slice(0, 5).map(function(o, i) {
        var c = customerById(o.customerId);
        return '<div class="row" style="padding:6px 0;border-bottom:1px solid var(--border);"><span>' +
          (i + 1) + '. ' + (c ? escapeHtml(c.name) : 'عميل محذوف') + ' - ' +
          escapeHtml(orderTypeLabel(o)) + '</span></div>';
      }).join('');
      openModal(
        '<div class="modal-head"><h3>☀️ خطة شغل النهاردة</h3><button class="modal-close" onclick="closeModal()">✕</button></div>' +
        '<p class="meta">عندك ' + queue.length + ' طلب في الدور، منهم ' + mustFinish.length + ' لازم يخلص النهاردة.</p>' +
        items +
        (queue.length > 5 ? '<p class="meta" style="margin-top:6px;">+ ' + (queue.length - 5) + ' طلب تاني</p>' : '') +
        '<button class="btn" style="margin-top:12px;" onclick="closeModal();showPage(\'home\')">📋 فتح خطة اليوم كاملة</button>'
      );
      localStorage.setItem('dailyPlanShownDate', today);
    } catch (e) { /* تجاهل */ }
  }, 900);

  console.log('✅ تم تحميل patches-orders.js بنجاح');
})();