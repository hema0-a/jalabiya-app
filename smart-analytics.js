/* ============================================================
   smart-analytics.js - التحليل الذكي والمقترحات
   
   ✅ آمن 100% — إضافات فقط، حذفه بسطر واحد
   
   الميزات:
   1. 🎯 المقترح الذكي — اقتراحات عند إنشاء طلب جديد
   2. ⏱️ متوسط الوقت — يتعلم من وقتك الفعلي
   3. 💡 نصيحة اليوم — مخصصة لبياناتك
   4. 📚 درس من أخطائك — تحليل الأخطاء المتكررة
   ============================================================ */

(function() {
  if (window.__smartAnalyticsLoaded) return;
  window.__smartAnalyticsLoaded = true;

  console.log('🎯 تحميل smart-analytics.js...');

  // ═══════════════════════════════════════════════════════════════
  // [19] المقترح الذكي — عند فتح طلب جديد
  // ═══════════════════════════════════════════════════════════════

  function getCustomerHistory(customerId) {
    if (!window.db || !customerId) return null;
    var orders = (window.db.orders || []).filter(function(o) {
      return o.customerId === customerId;
    });
    if (!orders.length) return null;

    // آخر 5 طلبات
    var recent = orders.slice(-5);

    // متوسط عدد القطع
    var totalPieces = 0, totalValue = 0, count = 0;
    recent.forEach(function(o) {
      var pieces = Array.isArray(o.items) ?
        o.items.reduce(function(s, it) { return s + (Number(it.qty) || 1); }, 0) : 1;
      totalPieces += pieces;
      if (window.orderTotal) totalValue += window.orderTotal(o);
      count++;
    });

    // الأنواع المفضلة
    var types = {};
    recent.forEach(function(o) {
      var items = Array.isArray(o.items) && o.items.length ?
        o.items : [{type: o.type}];
      items.forEach(function(it) {
        if (it.type) types[it.type] = (types[it.type] || 0) + 1;
      });
    });
    var favoriteTypes = Object.keys(types).sort(function(a, b) {
      return types[b] - types[a];
    }).slice(0, 3);

    // آخر سعر
    var lastOrder = recent[recent.length - 1];
    var lastPrice = 0;
    if (Array.isArray(lastOrder.items) && lastOrder.items.length) {
      lastPrice = Number(lastOrder.items[0].unitPrice) || 0;
    }

    return {
      orderCount: orders.length,
      avgPieces: count > 0 ? Math.round(totalPieces / count) : 1,
      avgValue: count > 0 ? Math.round(totalValue / count) : 0,
      favoriteTypes: favoriteTypes,
      lastPrice: lastPrice,
      lastOrderDate: lastOrder.dateReceived
    };
  }

  function buildSmartSuggestion(customerId) {
    var history = getCustomerHistory(customerId);
    if (!history || history.orderCount < 2) return null;

    var lines = [];
    
    lines.push('📊 ' + history.orderCount + ' طلب سابق');
    lines.push('متوسط: ' + history.avgPieces + ' قطعة بقيمة ' + 
               history.avgValue.toLocaleString('ar-EG') + ' ج.م');
    
    if (history.favoriteTypes.length > 0) {
      lines.push('يفضل: ' + history.favoriteTypes.join('، '));
    }
    
    if (history.lastPrice > 0) {
      lines.push('آخر سعر: ' + history.lastPrice.toLocaleString('ar-EG') + ' ج.م');
    }

    return lines.join(' • ');
  }

  function injectSmartSuggestion() {
    var custSelect = document.getElementById('f_customer');
    if (!custSelect) return;

    var customerId = custSelect.value;
    if (!customerId) {
      removeSmartSuggestion();
      return;
    }

    // هل هذا طلب جديد فقط؟
    var box = document.getElementById('modalBox');
    var isEditing = false;
    if (box) {
      var saveBtn = box.querySelector('button[onclick^="saveOrder("]');
      if (saveBtn) {
        var match = saveBtn.getAttribute('onclick').match(/'([^']+)'/);
        if (match && match[1] !== 'null') isEditing = true;
      }
    }
    if (isEditing) {
      removeSmartSuggestion();
      return;
    }

    var suggestion = buildSmartSuggestion(customerId);
    if (!suggestion) {
      removeSmartSuggestion();
      return;
    }

    // هل موجود؟
    var existing = document.getElementById('smartSuggestionBox');
    if (existing) {
      existing.innerHTML = suggestion;
      return;
    }

    // أنشئه
    var box2 = document.createElement('div');
    box2.id = 'smartSuggestionBox';
    box2.style.cssText = 
      'background:linear-gradient(135deg, var(--accent-light), var(--primary-light));' +
      'border-inline-start:4px solid var(--accent);' +
      'border-radius:10px;padding:10px 12px;margin-bottom:12px;' +
      'font-size:12.5px;color:var(--text);line-height:1.6;';

    box2.innerHTML = 
      '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">' +
      '<span style="font-size:16px;">🎯</span>' +
      '<b style="font-size:13px;color:var(--heading);">اقتراح ذكي</b>' +
      '</div>' +
      '<div>' + suggestion + '</div>';

    // ضعه بعد select العميل
    var field = custSelect.closest('.field');
    if (field) {
      field.insertAdjacentElement('afterend', box2);
    }
  }

  function removeSmartSuggestion() {
    var existing = document.getElementById('smartSuggestionBox');
    if (existing) existing.remove();
  }

  // راقب تغيير العميل
  document.addEventListener('change', function(e) {
    if (e.target && e.target.id === 'f_customer') {
      setTimeout(injectSmartSuggestion, 50);
    }
  });

  // عند فتح النموذج
  if (typeof window.openOrderModal === 'function' && !window.openOrderModal.__smartWrapped) {
    var origOpenOrder = window.openOrderModal;
    window.openOrderModal = function(id, presetCustomerId) {
      var r = origOpenOrder.apply(this, arguments);
      if (!id) {
        setTimeout(injectSmartSuggestion, 200);
      }
      return r;
    };
    window.openOrderModal.__smartWrapped = true;
  }

  // ═══════════════════════════════════════════════════════════════
  // [20] متوسط الوقت — يتعلم من وقتك الفعلي
  // ═══════════════════════════════════════════════════════════════

  function calcAverageTimes() {
    if (!window.db) return {};
    var orders = window.db.orders || [];
    var stats = {};

    orders.forEach(function(o) {
      // هل هناك وقت فعلي مسجل؟
      var actualDays = null;
      if (o.dateReceived && o.deliveredDate) {
        actualDays = Math.round(
          (new Date(o.deliveredDate) - new Date(o.dateReceived)) / 86400000
        );
      } else if (o.actualMinutes && o.actualMinutes > 0) {
        actualDays = o.actualMinutes / (60 * 8); // 8 ساعات عمل يومياً
      }

      if (actualDays === null || actualDays < 0) return;

      // لكل نوع
      var items = Array.isArray(o.items) && o.items.length ?
        o.items : [{type: o.type}];
      items.forEach(function(it) {
        if (!it.type) return;
        if (!stats[it.type]) stats[it.type] = { total: 0, count: 0 };
        stats[it.type].total += actualDays;
        stats[it.type].count += 1;
      });
    });

    var result = {};
    Object.keys(stats).forEach(function(type) {
      result[type] = {
        avgDays: stats[type].total / stats[type].count,
        sampleSize: stats[type].count
      };
    });

    return result;
  }

  function estimateTimeForOrder(items) {
    var avgTimes = calcAverageTimes();
    if (!items || !items.length) return null;

    var totalDays = 0;
    var matched = 0;
    var usedTypes = [];

    items.forEach(function(it) {
      if (!it.type) return;
      if (avgTimes[it.type]) {
        totalDays += avgTimes[it.type].avgDays * (Number(it.qty) || 1);
        matched += (Number(it.qty) || 1);
        usedTypes.push({
          type: it.type,
          avg: avgTimes[it.type].avgDays,
          sample: avgTimes[it.type].sampleSize
        });
      }
    });

    if (matched === 0) return null;
    return { totalDays: totalDays, types: usedTypes };
  }

  function injectTimeEstimate() {
    var container = document.getElementById('itemsContainer');
    if (!container) return;

    // احذف القديم
    var existing = document.getElementById('timeEstimateBox');
    if (existing) existing.remove();

    // احصل على الأصناف
    var items = [];
    container.querySelectorAll('.item-row').forEach(function(row) {
      var typeSel = row.querySelector('.it-type');
      var customInp = row.querySelector('.it-custom');
      var qtyInp = row.querySelector('.it-qty');
      
      var type = '';
      if (typeSel && typeSel.value === '__custom__') {
        type = customInp ? customInp.value : '';
      } else if (typeSel && typeSel.value) {
        var opt = typeSel.options[typeSel.selectedIndex];
        type = opt ? opt.textContent.split(' — ')[0].trim() : '';
      }
      
      if (type) {
        items.push({ type: type, qty: Number(qtyInp ? qtyInp.value : 1) || 1 });
      }
    });

    if (items.length === 0) return;

    var estimate = estimateTimeForOrder(items);
    if (!estimate) return;

    var days = Math.round(estimate.totalDays * 10) / 10;
    var roundedDays = Math.ceil(estimate.totalDays);
    
    var box = document.createElement('div');
    box.id = 'timeEstimateBox';
    box.style.cssText =
      'background:var(--info-light);border-inline-start:4px solid var(--info);' +
      'border-radius:10px;padding:10px 12px;margin-bottom:12px;font-size:12.5px;';

    var details = estimate.types.map(function(t) {
      return '• ' + t.type + ': ' + (Math.round(t.avg * 10) / 10) + 
             ' يوم (من ' + t.sample + ' طلب)';
    }).join('<br>');

    box.innerHTML = 
      '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">' +
      '<span style="font-size:16px;">⏱️</span>' +
      '<b style="color:var(--info);font-size:13px;">المتوقع من بياناتك</b>' +
      '</div>' +
      '<div style="font-weight:800;font-size:15px;color:var(--info);margin-bottom:6px;">' +
      '≈ ' + roundedDays + ' يوم عمل' +
      '</div>' +
      '<details style="cursor:pointer;">' +
      '<summary style="font-size:11.5px;color:var(--muted);">تفاصيل الحساب</summary>' +
      '<div class="meta" style="margin-top:6px;font-size:11.5px;">' +
      details + '</div>' +
      '</details>';

    // ضعه بعد قسم الأصناف
    var itemsSection = container.previousElementSibling;
    if (itemsSection) {
      container.insertAdjacentElement('afterend', box);
    }
  }

  // راقب التغييرات في الأصناف
  document.addEventListener('input', function(e) {
    if (e.target && (e.target.classList.contains('it-qty') || 
                     e.target.classList.contains('it-price') ||
                     e.target.classList.contains('it-custom'))) {
      clearTimeout(window.__timeEstimateTimer);
      window.__timeEstimateTimer = setTimeout(injectTimeEstimate, 500);
    }
  });

  document.addEventListener('change', function(e) {
    if (e.target && e.target.classList.contains('it-type')) {
      setTimeout(injectTimeEstimate, 100);
    }
  });

  if (typeof window.openOrderModal === 'function' && !window.openOrderModal.__timeWrapped) {
    var origOpenOrderTime = window.openOrderModal;
    window.openOrderModal = function() {
      var r = origOpenOrderTime.apply(this, arguments);
      setTimeout(injectTimeEstimate, 300);
      return r;
    };
    window.openOrderModal.__timeWrapped = true;
  }

  // ═══════════════════════════════════════════════════════════════
  // [39] نصيحة اليوم — مخصصة لبياناتك
  // ═══════════════════════════════════════════════════════════════

  function generateWorkshopTips() {
    if (!window.db) return [];
    var tips = [];
    var orders = window.db.orders || [];
    var customers = window.db.customers || [];

    // نصيحة 1: العميل الأكثر ربحاً
    var customerRevenue = {};
    orders.forEach(function(o) {
      if (!o.customerId) return;
      customerRevenue[o.customerId] = 
        (customerRevenue[o.customerId] || 0) + (Number(o.paid) || 0);
    });
    var topCustomerId = Object.keys(customerRevenue).sort(function(a, b) {
      return customerRevenue[b] - customerRevenue[a];
    })[0];
    if (topCustomerId) {
      var topCustomer = customers.find(function(c) { return c.id === topCustomerId; });
      if (topCustomer) {
        tips.push({
          icon: '👑',
          title: 'عميلك الأكثر ربحاً',
          body: '"' + topCustomer.name + '" دفع لك ' + 
                customerRevenue[topCustomerId].toLocaleString('ar-EG') + 
                ' ج.م. فكر تتواصل معه بعرض خاص.'
        });
      }
    }

    // نصيحة 2: أفضل يوم في الأسبوع
    var dayRevenue = [0, 0, 0, 0, 0, 0, 0];
    (window.db.payments || []).forEach(function(p) {
      var d = new Date(p.date);
      if (!isNaN(d.getTime())) {
        dayRevenue[d.getDay()] += Number(p.amount) || 0;
      }
    });
    var bestDay = dayRevenue.indexOf(Math.max.apply(null, dayRevenue));
    if (dayRevenue[bestDay] > 0) {
      var dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      tips.push({
        icon: '📅',
        title: 'أفضل يوم للتحصيل',
        body: 'يوم ' + dayNames[bestDay] + ' هو الأفضل عندك. حاول تجمع فيه الدفعات.'
      });
    }

    // نصيحة 3: نوع الجلابية الأكثر مبيعاً
    var typeCount = {};
    orders.forEach(function(o) {
      var items = Array.isArray(o.items) && o.items.length ? o.items : [{type: o.type}];
      items.forEach(function(it) {
        if (it.type) typeCount[it.type] = (typeCount[it.type] || 0) + 1;
      });
    });
    var topType = Object.keys(typeCount).sort(function(a, b) {
      return typeCount[b] - typeCount[a];
    })[0];
    if (topType && typeCount[topType] >= 3) {
      tips.push({
        icon: '👗',
        title: 'الأكثر طلباً',
        body: '"' + topType + '" هو الأكثر طلباً عندك (' + 
              typeCount[topType] + ' مرة). احرص على توفر الخامات.'
      });
    }

    // نصيحة 4: العملاء المتأخرون في الدفع
    var debtors = {};
    orders.forEach(function(o) {
      var remaining = window.orderRemaining ? window.orderRemaining(o) : 0;
      if (remaining > 0) {
        debtors[o.customerId] = (debtors[o.customerId] || 0) + remaining;
      }
    });
    var topDebtorId = Object.keys(debtors).sort(function(a, b) {
      return debtors[b] - debtors[a];
    })[0];
    if (topDebtorId && debtors[topDebtorId] > 500) {
      var topDebtor = customers.find(function(c) { return c.id === topDebtorId; });
      if (topDebtor) {
        tips.push({
          icon: '💰',
          title: 'متبقي على عميل',
          body: '"' + topDebtor.name + '" عليه ' + 
                Math.round(debtors[topDebtorId]).toLocaleString('ar-EG') + 
                ' ج.م. تواصل معه بلطف.'
        });
      }
    }

    // نصيحة 5: عدد الطلبات هذا الشهر
    var thisMonth = new Date().toISOString().slice(0, 7);
    var monthOrders = orders.filter(function(o) {
      return o.dateReceived && o.dateReceived.slice(0, 7) === thisMonth;
    }).length;
    if (monthOrders > 0) {
      tips.push({
        icon: '📈',
        title: 'هذا الشهر',
        body: 'استلمت ' + monthOrders + ' طلب حتى الآن هذا الشهر. استمر!'
      });
    }

    return tips;
  }

  function renderWorkshopTipCard() {
    var page = document.getElementById('page-home');
    if (!page) return;

    var existing = document.getElementById('workshopTipCard');
    if (existing) existing.remove();

    var tips = generateWorkshopTips();
    if (tips.length === 0) return;

    // اختر نصيحة اليوم بناءً على التاريخ
    var dayIndex = Math.floor(Date.now() / 86400000) % tips.length;
    var todayTip = tips[dayIndex];

    var card = document.createElement('div');
    card.id = 'workshopTipCard';
    card.className = 'card';
    card.style.cssText = 
      'background:linear-gradient(135deg, var(--primary-light), var(--accent-light));' +
      'border:none;padding:14px;margin-bottom:14px;' +
      'border-inline-start:4px solid var(--primary);';

    card.innerHTML = 
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
      '<span style="font-size:24px;">' + todayTip.icon + '</span>' +
      '<b style="color:var(--heading);font-size:15px;">' + todayTip.title + '</b>' +
      '</div>' +
      '<div style="font-size:13.5px;line-height:1.7;color:var(--text);">' + 
      todayTip.body + '</div>';

    // ضعها في المكان المناسب
    var quickActions = document.getElementById('homeQuickActionsWrap');
    if (quickActions) {
      quickActions.insertAdjacentElement('afterbegin', card);
    }
  }

  // اعرض النصيحة عند فتح الرئيسية
  if (typeof window.renderHome === 'function' && !window.renderHome.__tipWrapped) {
    var origRenderHome = window.renderHome;
    window.renderHome = function() {
      var r = origRenderHome.apply(this, arguments);
      setTimeout(renderWorkshopTipCard, 300);
      return r;
    };
    window.renderHome.__tipWrapped = true;
  }

  // ═══════════════════════════════════════════════════════════════
  // [40] درس من أخطائك — تحليل الأخطاء المتكررة
  // ═══════════════════════════════════════════════════════════════

  function analyzeMistakes() {
    if (!window.db) return [];
    var lessons = [];
    var orders = window.db.orders || [];

    // خطأ 1: تسليمات متأخرة متكررة
    var lateOrders = orders.filter(function(o) {
      return o.status === 'تم التسليم' && 
             o.dateDelivery && o.deliveredDate &&
             o.deliveredDate > o.dateDelivery;
    });
    if (lateOrders.length >= 3) {
      var avgDelay = 0;
      lateOrders.forEach(function(o) {
        avgDelay += Math.round(
          (new Date(o.deliveredDate) - new Date(o.dateDelivery)) / 86400000
        );
      });
      avgDelay = Math.round(avgDelay / lateOrders.length);
      lessons.push({
        icon: '⏰',
        title: 'تأخير متكرر',
        mistake: 'سلّمت ' + lateOrders.length + ' طلب متأخر بمتوسط ' + 
                 avgDelay + ' يوم',
        lesson: 'زد المدة المتوقعة في مواعيد التسليم بـ ' + avgDelay + 
                ' يوم احتياطي حتى تتفادى التأخير.'
      });
    }

    // خطأ 2: طلبات بدون عربون
    var noDeposit = orders.filter(function(o) {
      return o.status !== 'تم التسليم' && !Number(o.paid);
    });
    if (noDeposit.length >= 3) {
      lessons.push({
        icon: '💵',
        title: 'طلبات بدون عربون',
        mistake: noDeposit.length + ' طلب بدون أي دفعة مقدمة',
        lesson: 'اطلب عربون 30% على الأقل. هذا يحميك من إلغاء الطلبات.'
      });
    }

    // خطأ 3: عدم تسجيل الدفعات فوراً
    var paymentsNoOrder = (window.db.payments || []).filter(function(p) {
      return !p.orderId || !orders.find(function(o) { return o.id === p.orderId; });
    });
    if (paymentsNoOrder.length >= 2) {
      lessons.push({
        icon: '📝',
        title: 'دفعات يتيمة',
        mistake: paymentsNoOrder.length + ' دفعة بدون طلب مرتبط',
        lesson: 'احرص على تسجيل الدفعة مباشرة على الطلب المحدد.'
      });
    }

    // خطأ 4: طلبات بدون موعد تسليم
    var noDate = orders.filter(function(o) {
      return o.status !== 'تم التسليم' && !o.dateDelivery;
    });
    if (noDate.length >= 2) {
      lessons.push({
        icon: '📅',
        title: 'طلبات بدون موعد',
        mistake: noDate.length + ' طلب بدون تاريخ تسليم',
        lesson: 'حدد موعد تسليم لكل طلب من البداية. هذا يساعد في التنظيم.'
      });
    }

    return lessons;
  }

  function renderLessonsCard() {
    var page = document.getElementById('page-finance');
    if (!page) return;

    var existing = document.getElementById('lessonsCard');
    if (existing) existing.remove();

    var lessons = analyzeMistakes();
    if (lessons.length === 0) return;

    var card = document.createElement('div');
    card.id = 'lessonsCard';
    card.className = 'card';
    
    var html = 
      '<h3 style="color:var(--danger);">📚 دروس من بياناتك</h3>' +
      '<p class="meta" style="margin-top:-4px;margin-bottom:12px;">' +
        'تحليل تلقائي لأخطاء متكررة — بدون تعديل أي شيء.</p>';

    lessons.forEach(function(l) {
      html += 
        '<div style="background:var(--card-alt);padding:10px 12px;' +
        'border-radius:10px;margin-bottom:8px;' +
        'border-inline-start:3px solid var(--danger);">' +
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">' +
        '<span style="font-size:18px;">' + l.icon + '</span>' +
        '<b style="color:var(--danger);font-size:13.5px;">' + l.title + '</b>' +
        '</div>' +
        '<div style="font-size:12.5px;color:var(--danger);margin-bottom:4px;">' +
        '⚠️ ' + l.mistake + '</div>' +
        '<div style="font-size:13px;color:var(--ok);background:var(--ok-light);' +
        'padding:6px 10px;border-radius:6px;">' +
        '✅ ' + l.lesson + '</div>' +
        '</div>';
    });

    card.innerHTML = html;

    // ضعها بعد analytics
    var analytics = document.getElementById('advancedAnalytics');
    if (analytics) {
      analytics.insertAdjacentElement('afterend', card);
    } else {
      page.appendChild(card);
    }
  }

  if (typeof window.renderFinance === 'function' && !window.renderFinance.__lessonsWrapped) {
    var origRenderFinance = window.renderFinance;
    window.renderFinance = function() {
      var r = origRenderFinance.apply(this, arguments);
      setTimeout(renderLessonsCard, 400);
      return r;
    };
    window.renderFinance.__lessonsWrapped = true;
  }

  // ═══════════════════════════════════════════════════════════════
  // اختبار
  // ═══════════════════════════════════════════════════════════════

  window.testSmartAnalytics = function() {
    console.log('🎯 اختبار Smart Analytics:');
    console.log('  - متوسط الأوقات:', calcAverageTimes());
    console.log('  - نصائح الورشة:', generateWorkshopTips());
    console.log('  - الدروس من الأخطاء:', analyzeMistakes());
    
    if (typeof window.toast === 'function') {
      window.toast('✅ اطلع على النتائج في Console', 3000);
    }
  };

  console.log('✅ تم تحميل smart-analytics.js');
  console.log('   - المقترح الذكي (19)');
  console.log('   - متوسط الوقت (20)');
  console.log('   - نصيحة اليوم (39)');
  console.log('   - دروس من الأخطاء (40)');

})();
