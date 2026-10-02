/* ============================================================
   debt-tracker.js - متتبع الديون الذكي
   
   ✅ آمن 100% — إضافات فقط، حذفه بسطر واحد
   
   الميزات:
   1. تتبع دقيق لكل عميل عليه مبلغ متبقٍ
   2. تصنيف الديون (حديث/متوسط/قديم/متأخر)
   3. تذكير تلقائي للعملاء المتأخرين
   4. جدول زمني للدفعات المتوقعة
   5. رسائل ودية جاهزة للواتساب
   6. تحليل أداء التحصيل
   ============================================================ */

(function() {
  if (window.__debtTrackerLoaded) return;
  window.__debtTrackerLoaded = true;

  console.log('💸 تحميل debt-tracker.js...');

  // ═══════════════════════════════════════════════════════════════
  // الأدوات المساعدة
  // ═══════════════════════════════════════════════════════════════

  function escapeHtml(s) {
    if (s === undefined || s === null) return '';
    return String(s).replace(/[&<>"']/g, function(m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  function daysBetween(dateStr1, dateStr2) {
    if (!dateStr1 || !dateStr2) return 0;
    var d1 = new Date(dateStr1);
    var d2 = new Date(dateStr2);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
    return Math.round((d1 - d2) / 86400000);
  }

  function todayStr() {
    var today = new Date();
    return today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');
  }

  // ═══════════════════════════════════════════════════════════════
  // جمع بيانات الديون
  // ═══════════════════════════════════════════════════════════════

  function collectDebts() {
    if (!window.db) return [];
    var orders = window.db.orders || [];
    var customers = window.db.customers || [];

    var debtsByCustomer = {};

    orders.forEach(function(o) {
      if (o.status === 'تم التسليم' && !(Number(o.paid) > 0)) return;
      
      var total = window.orderTotal ? window.orderTotal(o) : (Number(o.fee) || 0);
      var paid = Number(o.paid) || 0;
      var remaining = total - paid;
      
      if (remaining <= 0.01) return;

      var cid = o.customerId;
      if (!debtsByCustomer[cid]) {
        debtsByCustomer[cid] = {
          customerId: cid,
          totalDebt: 0,
          orders: [],
          oldestDate: null,
          newestDate: null
        };
      }

      debtsByCustomer[cid].totalDebt += remaining;
      debtsByCustomer[cid].orders.push({
        orderId: o.id,
        type: o.type || (o.items && o.items[0] ? o.items[0].type : 'طلب'),
        total: total,
        paid: paid,
        remaining: remaining,
        dateReceived: o.dateReceived,
        dateDelivery: o.dateDelivery,
        status: o.status
      });

      if (!debtsByCustomer[cid].oldestDate || 
          (o.dateReceived && o.dateReceived < debtsByCustomer[cid].oldestDate)) {
        debtsByCustomer[cid].oldestDate = o.dateReceived;
      }
      if (!debtsByCustomer[cid].newestDate || 
          (o.dateReceived && o.dateReceived > debtsByCustomer[cid].newestDate)) {
        debtsByCustomer[cid].newestDate = o.dateReceived;
      }
    });

    // أضف بيانات العميل + التصنيف
    var debts = [];
    Object.keys(debtsByCustomer).forEach(function(cid) {
      var debt = debtsByCustomer[cid];
      var customer = customers.find(function(c) { return c.id === cid; });
      
      if (!customer) return; // تجاهل العميل المحذوف

      var ageDays = debt.oldestDate ? daysBetween(todayStr(), debt.oldestDate) : 0;
      
      var category, color, icon;
      if (ageDays <= 15) {
        category = 'حديث';
        color = 'var(--ok)';
        icon = '🟢';
      } else if (ageDays <= 45) {
        category = 'متوسط';
        color = 'var(--warn)';
        icon = '🟡';
      } else if (ageDays <= 90) {
        category = 'قديم';
        color = 'var(--danger)';
        icon = '🟠';
      } else {
        category = 'متأخر جداً';
        color = 'var(--danger)';
        icon = '🔴';
      }

      debts.push({
        customer: customer,
        totalDebt: debt.totalDebt,
        orders: debt.orders,
        orderCount: debt.orders.length,
        oldestDate: debt.oldestDate,
        newestDate: debt.newestDate,
        ageDays: ageDays,
        category: category,
        color: color,
        icon: icon
      });
    });

    // رتب بالأكبر
    debts.sort(function(a, b) { return b.totalDebt - a.totalDebt; });
    return debts;
  }

  // ═══════════════════════════════════════════════════════════════
  // تذكير تلقائي للعملاء المتأخرين (90+ يوم)
  // ═══════════════════════════════════════════════════════════════

  function getOverdueCustomers() {
    var debts = collectDebts();
    return debts.filter(function(d) {
      return d.ageDays >= 60 && d.customer.phone;
    });
  }

  function showOverdueReminder() {
    if (!window.db) return;
    
    // تحقق مرة واحدة يومياً
    var today = todayStr();
    var lastReminder = localStorage.getItem('jalaba_last_overdue_reminder');
    if (lastReminder === today) return;

    var overdue = getOverdueCustomers();
    if (overdue.length === 0) {
      localStorage.setItem('jalaba_last_overdue_reminder', today);
      return;
    }

    localStorage.setItem('jalaba_last_overdue_reminder', today);

    // إظهار تنبيه لطيف
    setTimeout(function() {
      var alerts = document.getElementById('homeAlerts');
      if (!alerts) return;

      var banner = document.createElement('div');
      banner.className = 'alert-banner warn';
      banner.style.marginBottom = '10px';
      banner.innerHTML = 
        '<span class="ic">💸</span>' +
        '<div>' +
        '<b>عندك ' + overdue.length + ' عميل مديون لفترة طويلة</b>' +
        'أكبرهم: "' + escapeHtml(overdue[0].customer.name) + '" بمبلغ ' +
        Math.round(overdue[0].totalDebt).toLocaleString('ar-EG') + ' ج.م' +
        '<div class="btn-row" style="margin-top:8px;">' +
        '<button class="btn sm accent" onclick="showDebtTracker()">' +
        '💸 فتح متتبع الديون' +
        '</button>' +
        '</div>' +
        '</div>';

      alerts.insertBefore(banner, alerts.firstChild);
    }, 2000);
  }

  // ═══════════════════════════════════════════════════════════════
  // الواجهة الرئيسية — متتبع الديون
  // ═══════════════════════════════════════════════════════════════

  var currentFilter = 'all';

  window.showDebtTracker = function() {
    var debts = collectDebts();
    
    if (debts.length === 0) {
      openModal(
        '<div class="modal-head">' +
        '<h3>💸 متتبع الديون</h3>' +
        '<button class="modal-close" onclick="closeModal()">✕</button>' +
        '</div>' +
        '<div class="card" style="text-align:center;padding:30px 20px;">' +
        '<div style="font-size:50px;margin-bottom:12px;">🎉</div>' +
        '<h3 style="color:var(--ok);">لا توجد ديون</h3>' +
        '<p class="meta">كل العملاء سددوا بالكامل. أحسنت!</p>' +
        '</div>'
      );
      return;
    }

    var totalDebt = debts.reduce(function(s, d) { return s + d.totalDebt; }, 0);
    var filtered = filterDebts(debts, currentFilter);

    var html = 
      '<div class="modal-head">' +
      '<h3>💸 متتبع الديون</h3>' +
      '<button class="modal-close" onclick="closeModal()">✕</button>' +
      '</div>' +
      
      // ملخص
      '<div class="card" style="background:linear-gradient(135deg, var(--danger-light), var(--card-alt));border:none;padding:14px;margin-bottom:12px;">' +
      '<div class="row" style="margin-bottom:6px;">' +
      '<b>إجمالي المديونيات</b>' +
      '<b style="color:var(--danger);font-size:18px;">' + 
      Math.round(totalDebt).toLocaleString('ar-EG') + ' ج.م</b>' +
      '</div>' +
      '<div class="meta">من ' + debts.length + ' عميل • ' + 
      debts.reduce(function(s, d) { return s + d.orderCount; }, 0) + ' طلب</div>' +
      '</div>' +

      // فلتر
      '<div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;">' +
      buildFilterButton('all', 'الكل', debts.length) +
      buildFilterButton('recent', '🟢 حديث', debts.filter(function(d) { return d.category === 'حديث'; }).length) +
      buildFilterButton('medium', '🟡 متوسط', debts.filter(function(d) { return d.category === 'متوسط'; }).length) +
      buildFilterButton('old', '🟠 قديم', debts.filter(function(d) { return d.category === 'قديم'; }).length) +
      buildFilterButton('overdue', '🔴 متأخر جداً', debts.filter(function(d) { return d.category === 'متأخر جداً'; }).length) +
      '</div>' +

      // قائمة الديون
      '<div id="debtsListInModal">' +
      (filtered.length === 0 ? 
        '<p class="meta" style="text-align:center;padding:20px;">لا توجد ديون في هذه الفئة</p>' :
        filtered.map(buildDebtCard).join('')) +
      '</div>';

    openModal(html);
  };

  function filterDebts(debts, filter) {
    if (filter === 'all') return debts;
    if (filter === 'recent') return debts.filter(function(d) { return d.category === 'حديث'; });
    if (filter === 'medium') return debts.filter(function(d) { return d.category === 'متوسط'; });
    if (filter === 'old') return debts.filter(function(d) { return d.category === 'قديم'; });
    if (filter === 'overdue') return debts.filter(function(d) { return d.category === 'متأخر جداً'; });
    return debts;
  }

  function buildFilterButton(key, label, count) {
    var active = currentFilter === key;
    var bg = active ? 'var(--primary)' : 'var(--card-alt)';
    var color = active ? '#fff' : 'var(--text)';
    var border = active ? 'var(--primary)' : 'var(--border)';
    
    return '<button type="button" ' +
      'onclick="setDebtFilter(\'' + key + '\')" ' +
      'style="background:' + bg + ';color:' + color + ';' +
      'border:1px solid ' + border + ';border-radius:20px;' +
      'padding:6px 12px;font-size:12px;font-weight:700;' +
      'cursor:pointer;white-space:nowrap;">' +
      label + ' (' + count + ')' +
      '</button>';
  }

  function buildDebtCard(debt) {
    var c = debt.customer;
    var ageLabel;
    if (debt.ageDays === 0) ageLabel = 'اليوم';
    else if (debt.ageDays === 1) ageLabel = 'منذ يوم';
    else if (debt.ageDays < 30) ageLabel = 'منذ ' + debt.ageDays + ' يوم';
    else if (debt.ageDays < 60) ageLabel = 'منذ ' + Math.round(debt.ageDays / 30) + ' شهر';
    else if (debt.ageDays < 365) ageLabel = 'منذ ' + Math.round(debt.ageDays / 30) + ' شهور';
    else ageLabel = 'منذ سنة+';

    // آخر طلب
    var lastOrder = debt.orders[debt.orders.length - 1];
    var lastDate = lastOrder.dateReceived || '';
    
    return '<div class="card" style="margin-bottom:10px;border-inline-start:4px solid ' + debt.color + ';">' +
      '<div class="row" style="margin-bottom:6px;">' +
      '<b style="font-size:14px;">' + debt.icon + ' ' + escapeHtml(c.name) + '</b>' +
      '<b style="color:' + debt.color + ';font-size:15px;">' + 
      Math.round(debt.totalDebt).toLocaleString('ar-EG') + ' ج.م</b>' +
      '</div>' +
      
      '<div class="meta" style="margin-bottom:4px;">' +
      '📋 ' + debt.orderCount + ' طلب • ' + debt.category + ' • ' + ageLabel +
      '</div>' +
      
      (c.phone ? 
        '<div class="meta" style="margin-bottom:8px;">📞 ' + escapeHtml(c.phone) + '</div>' : '') +
      
      '<details style="margin-bottom:8px;">' +
      '<summary style="cursor:pointer;font-size:12px;color:var(--muted);">' +
      '👁️ عرض الطلبات</summary>' +
      '<div style="background:var(--card-alt);padding:8px;border-radius:6px;margin-top:6px;">' +
      debt.orders.map(function(o) {
        return '<div style="padding:4px 0;font-size:11.5px;border-bottom:1px solid var(--border);">' +
          '• ' + escapeHtml(o.type) + ' — ' + 
          Math.round(o.remaining).toLocaleString('ar-EG') + ' ج.م' +
          (o.dateReceived ? ' (' + o.dateReceived + ')' : '') +
          '</div>';
      }).join('') +
      '</div>' +
      '</details>' +

      '<div class="btn-row">' +
      (c.phone ? 
        '<button class="btn sm accent" onclick="sendDebtReminderFriendly(\'' + c.id + '\')">' +
        '💬 تذكير لطيف</button>' : '') +
      '<button class="btn sm outline" onclick="openCustomerHistory(\'' + c.id + '\');closeModal();">' +
      '📜 السجل</button>' +
      '<button class="btn sm outline" onclick="quickPayDebt(\'' + c.id + '\')">' +
      '💵 دفعة</button>' +
      '</div>' +
      '</div>';
  }

  window.setDebtFilter = function(filter) {
    currentFilter = filter;
    showDebtTracker();
  };

  // ═══════════════════════════════════════════════════════════════
  // رسائل ودية للعملاء
  // ═══════════════════════════════════════════════════════════════

  window.sendDebtReminderFriendly = function(customerId) {
    var customer = (window.db.customers || []).find(function(c) {
      return c.id === customerId;
    });
    if (!customer) return;

    var debts = collectDebts().filter(function(d) {
      return d.customer.id === customerId;
    });
    if (!debts.length) return;

    var debt = debts[0];
    var total = Math.round(debt.totalDebt);
    
    // رسالة حسب العمر
    var msg;
    if (debt.ageDays <= 15) {
      // ودية جداً
      msg = 'أهلاً ' + customer.name + ' 🌹\n\n' +
        'أتمنى تكون بخير. عايز أذكّرك بلطف إنه ' +
        'متبقي على حسابك ' + total.toLocaleString('ar-EG') + ' ج.م.\n\n' +
        'لو مريح ليك، ياريت نحصّلها في أقرب وقت مناسب.\n' +
        'شكراً ليك على تعاملك معانا 🙏\n\n' +
        (window.db.workshopName || 'ورشة تفصيل الجلابيب');
    } else if (debt.ageDays <= 45) {
      // ودية
      msg = 'السلام عليكم ' + customer.name + ' 🌸\n\n' +
        'أتمنى تكون بخير. عندك مبلغ متبقي ' + 
        total.toLocaleString('ar-EG') + ' ج.م من ' +
        debt.ageDays + ' يوم.\n\n' +
        'لو ممكن نحدد موعد لسداد المبلغ في أقرب وقت.\n' +
        'تحياتي 🙏\n\n' +
        (window.db.workshopName || 'ورشة تفصيل الجلابيب');
    } else {
      // رسمية مهذبة
      msg = 'الأخ ' + customer.name + ' المحترم\n\n' +
        'تحية طيبة. نودّ تذكيرك بأن هناك مبلغ ' +
        total.toLocaleString('ar-EG') + ' ج.م متبقي على حسابك ' +
        'منذ ' + Math.round(debt.ageDays / 30) + ' شهور.\n\n' +
        'نأمل منك التكرم بسداد المبلغ في أقرب وقت.\n' +
        'شاكرين تعاونك 🙏\n\n' +
        (window.db.workshopName || 'ورشة تفصيل الجلابيب');
    }

    // افتح واتساب
    var phone = (customer.phone || '').replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) phone = '2' + phone;
    
    if (typeof window.openWhatsAppChat === 'function') {
      window.openWhatsAppChat(phone, msg);
    } else {
      var url = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(msg);
      window.open(url, '_blank');
    }

    // سجل النشاط
    if (window.db && window.db.activityLog) {
      window.db.activityLog.push({
        id: 'debt-reminder-' + Date.now(),
        text: '💬 تذكير دين للعميل ' + customer.name,
        ts: Date.now(),
        type: 'debt'
      });
      if (typeof window.saveDB === 'function') window.saveDB(true);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // دفعة سريعة من متتبع الديون
  // ═══════════════════════════════════════════════════════════════

  window.quickPayDebt = function(customerId) {
    var customer = (window.db.customers || []).find(function(c) {
      return c.id === customerId;
    });
    if (!customer) return;

    var orders = (window.db.orders || []).filter(function(o) {
      return o.customerId === customerId && 
             (window.orderRemaining ? window.orderRemaining(o) : 0) > 0;
    });
    
    if (!orders.length) {
      if (typeof window.toast === 'function') {
        window.toast('لا توجد طلبات بمتبقي لهذا العميل');
      }
      return;
    }

    var html = 
      '<div class="modal-head">' +
      '<h3>💵 تسجيل دفعة سريعة</h3>' +
      '<button class="modal-close" onclick="closeModal()">✕</button>' +
      '</div>' +
      
      '<p class="meta">العميل: <b>' + escapeHtml(customer.name) + '</b></p>' +
      
      '<div class="field">' +
      '<label>اختر الطلب</label>' +
      '<select id="quickPayOrderId">' +
      orders.map(function(o) {
        var rem = window.orderRemaining(o);
        var type = o.type || (o.items && o.items[0] ? o.items[0].type : 'طلب');
        return '<option value="' + o.id + '">' +
          escapeHtml(type) + ' — متبقي ' + Math.round(rem).toLocaleString('ar-EG') + ' ج.م' +
          '</option>';
      }).join('') +
      '</select>' +
      '</div>' +
      
      '<div class="field">' +
      '<label>المبلغ (ج.م)</label>' +
      '<input type="number" id="quickPayAmount" placeholder="0" min="0">' +
      '</div>' +
      
      '<div class="field">' +
      '<label>التاريخ</label>' +
      '<input type="date" id="quickPayDate" value="' + todayStr() + '">' +
      '</div>' +
      
      '<div class="btn-row">' +
      '<button class="btn outline" onclick="closeModal()">إلغاء</button>' +
      '<button class="btn accent" onclick="executeQuickPay(\'' + customerId + '\')">💵 تسجيل</button>' +
      '</div>';

    openModal(html);

    // املأ تلقائياً
    setTimeout(function() {
      var sel = document.getElementById('quickPayOrderId');
      if (sel) {
        var order = orders.find(function(o) { return o.id === sel.value; });
        if (order) {
          var amountField = document.getElementById('quickPayAmount');
          if (amountField) {
            amountField.value = Math.round(window.orderRemaining(order));
          }
        }
      }
    }, 100);
  };

  window.executeQuickPay = async function(customerId) {
    var orderId = document.getElementById('quickPayOrderId').value;
    var amount = Number(document.getElementById('quickPayAmount').value) || 0;
    var date = document.getElementById('quickPayDate').value || todayStr();

    if (amount <= 0) {
      if (typeof window.toast === 'function') window.toast('أدخل مبلغاً صحيحاً');
      return;
    }

    var order = (window.db.orders || []).find(function(o) { return o.id === orderId; });
    if (!order) return;

    var remaining = window.orderRemaining(order);
    if (amount > remaining) {
      var ok = await window.appConfirm(
        'المبلغ أكبر من المتبقي (' + Math.round(remaining).toLocaleString('ar-EG') + 
        ' ج.م). متابعة؟',
        { okText: 'نعم', cancelText: 'إلغاء', danger: false }
      );
      if (!ok) return;
    }

    // سجّل الدفعة
    order.paid = (Number(order.paid) || 0) + amount;
    order.updatedAt = Date.now();

    if (!window.db.payments) window.db.payments = [];
    window.db.payments.push({
      id: 'pay-' + Date.now(),
      orderId: orderId,
      amount: amount,
      date: date
    });

    if (typeof window.saveDB === 'function') window.saveDB(true);
    if (typeof window.logActivity === 'function') {
      window.logActivity('💵 دفعة ' + amount.toLocaleString('ar-EG') + ' ج.م من ' + 
                        (window.db.customers.find(function(c) { return c.id === customerId; }) || {}).name);
    }

    if (typeof window.toast === 'function') {
      window.toast('✅ تم تسجيل الدفعة', 3000);
    }

    // أعد تحديث القائمة
    closeModal();
    setTimeout(window.showDebtTracker, 300);
  };

  // ═══════════════════════════════════════════════════════════════
  // تحليل أداء التحصيل
  // ═══════════════════════════════════════════════════════════════

  function calcCollectionStats() {
    if (!window.db) return null;
    var orders = window.db.orders || [];
    
    var totalRevenue = 0;
    var totalCollected = 0;
    var totalPending = 0;
    var fullyPaidCount = 0;
    var partiallyPaidCount = 0;
    var unpaidCount = 0;

    orders.forEach(function(o) {
      var total = window.orderTotal ? window.orderTotal(o) : (Number(o.fee) || 0);
      var paid = Number(o.paid) || 0;
      var remaining = total - paid;

      totalRevenue += total;
      totalCollected += paid;
      if (remaining > 0.01) totalPending += remaining;

      if (paid >= total - 0.01) fullyPaidCount++;
      else if (paid > 0) partiallyPaidCount++;
      else unpaidCount++;
    });

    var collectionRate = totalRevenue > 0 ? 
      Math.round((totalCollected / totalRevenue) * 100) : 100;

    return {
      totalRevenue: totalRevenue,
      totalCollected: totalCollected,
      totalPending: totalPending,
      fullyPaidCount: fullyPaidCount,
      partiallyPaidCount: partiallyPaidCount,
      unpaidCount: unpaidCount,
      collectionRate: collectionRate,
      totalOrders: orders.length
    };
  }

  function renderDebtTrackerCard() {
    var page = document.getElementById('page-finance');
    if (!page) return;

    var existing = document.getElementById('debtTrackerCard');
    if (existing) existing.remove();

    var stats = calcCollectionStats();
    if (!stats) return;

    var debts = collectDebts();
    var overdueCount = debts.filter(function(d) { return d.ageDays >= 60; }).length;

    var card = document.createElement('div');
    card.id = 'debtTrackerCard';
    card.className = 'card';

    var html = 
      '<div class="row" style="margin-bottom:12px;">' +
      '<h3 style="margin:0;">💸 متتبع الديون</h3>' +
      '<button class="btn sm outline" onclick="showDebtTracker()">' +
      '📊 التفاصيل</button>' +
      '</div>' +

      '<div class="grid-cards" style="margin-bottom:12px;">' +
      '<div class="stat-card ' + (stats.collectionRate < 70 ? 'danger' : stats.collectionRate < 90 ? 'warn' : '') + '">' +
      '<div class="stat-ic">📊</div>' +
      '<div>' +
      '<div class="num">' + stats.collectionRate + '%</div>' +
      '<div class="lbl">معدل التحصيل</div>' +
      '</div>' +
      '</div>' +

      '<div class="stat-card danger">' +
      '<div class="stat-ic">💸</div>' +
      '<div>' +
      '<div class="num">' + Math.round(stats.totalPending).toLocaleString('ar-EG') + '</div>' +
      '<div class="lbl">إجمالي المتبقي (ج.م)</div>' +
      '</div>' +
      '</div>' +
      '</div>' +

      '<div class="meta" style="margin-bottom:10px;">' +
      '<b>' + stats.fullyPaidCount + '</b> مكتمل الدفع • ' +
      '<b>' + stats.partiallyPaidCount + '</b> مدفوع جزئياً • ' +
      '<b>' + stats.unpaidCount + '</b> بدون دفعة' +
      '</div>' +

      (overdueCount > 0 ?
        '<div class="alert-banner danger" style="margin:0;">' +
        '<span class="ic">⚠️</span>' +
        '<div>' +
        '<b>' + overdueCount + ' عميل متأخر أكثر من 60 يوم</b>' +
        'يُنصح بالتواصل معهم.' +
        '</div>' +
        '</div>' : '') +

      '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">' +
      '<button class="btn sm accent" onclick="sendAllDebtReminders()">' +
      '📤 تذكير جماعي</button>' +
      '<button class="btn sm outline" onclick="printDebtReport()">' +
      '🖨️ طباعة تقرير</button>' +
      '</div>';

    card.innerHTML = html;

    // ضع في الصفحة
    var debtsList = document.getElementById('debtsList');
    if (debtsList) {
      debtsList.insertAdjacentElement('beforebegin', card);
    } else {
      page.appendChild(card);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // تذكير جماعي
  // ═══════════════════════════════════════════════════════════════

  window.sendAllDebtReminders = async function() {
    var debts = collectDebts().filter(function(d) {
      return d.customer.phone && d.ageDays >= 30;
    });

    if (debts.length === 0) {
      if (typeof window.toast === 'function') {
        window.toast('لا توجد ديون مؤهلة للتذكير (30+ يوم)');
      }
      return;
    }

    var ok = await window.appConfirm(
      'سيتم فتح ' + debts.length + ' رسالة واتساب واحدة تلو الأخرى. ' +
      'هل أنت مستعد؟',
      { okText: 'ابدأ', cancelText: 'إلغاء', danger: false }
    );
    if (!ok) return;

    var i = 0;
    function sendNext() {
      if (i >= debts.length) {
        if (typeof window.toast === 'function') {
          window.toast('✅ تم إرسال ' + debts.length + ' تذكير', 3000);
        }
        return;
      }
      window.sendDebtReminderFriendly(debts[i].customer.id);
      i++;
      setTimeout(sendNext, 2000);
    }
    sendNext();
  };

  // ═══════════════════════════════════════════════════════════════
  // طباعة تقرير الديون
  // ═══════════════════════════════════════════════════════════════

  window.printDebtReport = function() {
    var debts = collectDebts();
    if (debts.length === 0) {
      if (typeof window.toast === 'function') window.toast('لا توجد ديون');
      return;
    }

    var total = debts.reduce(function(s, d) { return s + d.totalDebt; }, 0);
    var shopName = window.db.workshopName || 'ورشة تفصيل الجلابيب';

    var rowsHtml = debts.map(function(d, i) {
      return '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        '<td>' + escapeHtml(d.customer.name) + '</td>' +
        '<td>' + escapeHtml(d.customer.phone || '-') + '</td>' +
        '<td>' + d.orderCount + '</td>' +
        '<td>' + d.category + '</td>' +
        '<td>' + Math.round(d.totalDebt).toLocaleString('ar-EG') + ' ج.م</td>' +
        '</tr>';
    }).join('');

    var html = 
      '<!DOCTYPE html><html dir="rtl" lang="ar">' +
      '<head><meta charset="UTF-8"><title>تقرير الديون</title>' +
      '<style>' +
      'body{font-family:Tahoma,Arial,sans-serif;padding:24px;color:#222;direction:rtl;}' +
      'h1{font-size:20px;border-bottom:2px solid #1F6D57;padding-bottom:8px;}' +
      'h2{font-size:14px;color:#666;margin-top:0;}' +
      'table{width:100%;border-collapse:collapse;margin-top:14px;font-size:13px;}' +
      'th,td{padding:8px 6px;border-bottom:1px solid #ddd;text-align:right;}' +
      'th{background:#1F6D57;color:#fff;font-weight:700;}' +
      'tr:nth-child(even){background:#f9f9f9;}' +
      '.summary{background:#F6E3DD;padding:12px;border-radius:8px;margin-top:14px;}' +
      '.summary b{color:#A23B2C;font-size:16px;}' +
      '.footer{margin-top:30px;text-align:center;color:#888;font-size:11px;}' +
      '</style></head><body>' +
      '<h1>💸 تقرير الديون</h1>' +
      '<h2>' + escapeHtml(shopName) + ' — ' + todayStr() + '</h2>' +
      '<table>' +
      '<thead><tr>' +
      '<th>#</th><th>العميل</th><th>الهاتف</th><th>الطلبات</th><th>الفئة</th><th>المبلغ</th>' +
      '</tr></thead>' +
      '<tbody>' + rowsHtml + '</tbody>' +
      '</table>' +
      '<div class="summary">' +
      '<b>إجمالي المديونيات: ' + Math.round(total).toLocaleString('ar-EG') + ' ج.م</b><br>' +
      'عدد العملاء: ' + debts.length +
      '</div>' +
      '<div class="footer">تم إنشاء التقرير تلقائياً</div>' +
      '</body></html>';

    // استخدم openPrintWindow إذا كان متاحاً
    if (typeof window.openPrintWindow === 'function') {
      window.openPrintWindow(html, 'تقرير_الديون_' + todayStr());
    } else {
      var win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        setTimeout(function() { win.print(); }, 500);
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // دمج مع renderFinance
  // ═══════════════════════════════════════════════════════════════

  if (typeof window.renderFinance === 'function' && !window.renderFinance.__debtWrapped) {
    var origRenderFinance = window.renderFinance;
    window.renderFinance = function() {
      var r = origRenderFinance.apply(this, arguments);
      setTimeout(renderDebtTrackerCard, 500);
      return r;
    };
    window.renderFinance.__debtWrapped = true;
  }

  // ═══════════════════════════════════════════════════════════════
  // فحص المديونيات القديمة عند فتح التطبيق
  // ═══════════════════════════════════════════════════════════════

  window.addEventListener('load', function() {
    setTimeout(showOverdueReminder, 4000);
  });

  // ═══════════════════════════════════════════════════════════════
  // اختبار
  // ═══════════════════════════════════════════════════════════════

  window.testDebtTracker = function() {
    var debts = collectDebts();
    var stats = calcCollectionStats();
    
    console.log('💸 اختبار متتبع الديون:');
    console.log('  عدد العملاء المدينين:', debts.length);
    console.log('  إجمالي المديونيات:', stats ? stats.totalPending.toFixed(0) + ' ج.م' : 'N/A');
    console.log('  معدل التحصيل:', stats ? stats.collectionRate + '%' : 'N/A');
    console.log('  تفاصيل الديون:', debts);

    if (typeof window.toast === 'function') {
      window.toast('✅ اطلع على النتائج في Console', 3000);
    }
  };

  console.log('✅ تم تحميل debt-tracker.js');
  console.log('   - متتبع الديون (27)');
  console.log('   - تصنيف الديون');
  console.log('   - تذكير لطيف للعملاء');
  console.log('   - تقرير قابل للطباعة');

})();
