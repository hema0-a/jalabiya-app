/* ============================================================
   ملف رقعة جديد منفصل (مش هيتضاف داخل core.js ولا patches.js ولا
   feature-capacity-reminders.js) — بيتحمّل هو آخر واحد، وكل ميزة
   جوه IIFE مستقلة عن التانية، بنفس أسلوب feature-capacity-reminders.js:

   1) ودجت "📌 مطلوب اليوم" على الرئيسية: بتجمع في مكان واحد الطلبات
      المتأخرة/المستحقة النهاردة + العملاء المديونين + الطلبات الجاهزة
      اللي لسه محتاجة إشعار واتساب — بدل ما تدور في أكتر من قسم.
   2) تحديد أكتر من طلب "قيد العمل" من شاشة الطلبات (قائمة) وتحويلهم
      كلهم لـ "جاهز للتسليم" بضغطة واحدة.
   3) طباعة كل تذاكر التقطيع لطلبات النهاردة (اللي استلمتها النهاردة)
      في نافذة طباعة واحدة بدل ما تفتح كل طلب لوحده.
   4) رسالة واتساب جماعية لكل عميل طلبه "جاهز للتسليم" ولسه ما اتبعتلوش
      إشعار النهاردة، بالتتابع (زي فكرة تذكيرات التأخير بالظبط).
   5) بطاقة "🩺 فحص وتشخيص تلقائي" في الإعدادات: فحص سلامة بيانات
      الورشة (طلبات يتيمة، أرقام سالبة، تكرار بيانات...) + فحص إن
      أهم دوال البرنامج شغالة فعلاً (يكشف لو ملف رقعة فشل يتحمّل).
      (ملحوظة صدق: الفحص ده منطق ثابت شغال محليًا في الجهاز فورًا،
      مش استدعاء ذكاء اصطناعي حي من جوه التطبيق نفسه — الفحص
      الحقيقي بالذكاء الاصطناعي لكل كود البرنامج تم عمل مرة يدويًا
      وقت كتابة هذا الملف، مش حاجة تتكرر أوتوماتيك جوه تطبيق العميل).
   ============================================================ */
(function(){
  if(window.__todayFocusLoaded) return;
  window.__todayFocusLoaded = true;

  /* ============================================================
     1) ودجت "📌 مطلوب اليوم"
     ============================================================ */
  function readyToNotifyList(){
    var today = todayStr();
    return db.orders.filter(function(o){
      return o.status==='جاهز للتسليم' && o.readyNotifiedAt!==today;
    });
  }

  function computeTodayFocusData(){
    var today = todayStr();
    var late = db.orders.filter(isOverdue);
    var dueToday = db.orders.filter(function(o){
      return o.status!=='تم التسليم' && o.dateDelivery===today;
    });
    var debtMap = {};
    db.orders.forEach(function(o){
      var rem = orderRemaining(o);
      if(rem<=0) return;
      if(!debtMap[o.customerId]) debtMap[o.customerId] = {remaining:0, orders:0};
      debtMap[o.customerId].remaining += rem;
      debtMap[o.customerId].orders += 1;
    });
    var debts = Object.keys(debtMap).map(function(cid){
      return {c:customerById(cid), remaining:debtMap[cid].remaining, orders:debtMap[cid].orders};
    }).filter(function(r){ return r.c; }).sort(function(a,b){ return b.remaining-a.remaining; });

    var readyToNotify = readyToNotifyList().filter(function(o){
      var c = customerById(o.customerId);
      return c && c.phone;
    });

    return {late:late, dueToday:dueToday, debts:debts, readyToNotify:readyToNotify};
  }

  function ensureTodayFocusWidget(){
    if(document.getElementById('widget-today-focus')) return;
    var container = document.getElementById('homeWidgetsContainer');
    if(!container) return;
    var wrap = document.createElement('div');
    wrap.id = 'widget-today-focus';
    wrap.className = 'home-widget';
    wrap.innerHTML = '<div class="section-title">📌 مطلوب اليوم</div><div id="todayFocusBox"></div>';
    container.insertBefore(wrap, container.firstChild); // فوق كل الودجتات التانية، أول حاجة تتشاف
  }

  window.renderTodayFocusWidget = function(){
    ensureTodayFocusWidget();
    var box = document.getElementById('todayFocusBox');
    if(!box) return;
    var d = computeTodayFocusData();

    if(!d.late.length && !d.dueToday.length && !d.debts.length && !d.readyToNotify.length){
      box.innerHTML = '<div class="empty-msg">مفيش حاجة محتاجة قرار عاجل النهاردة 🎉</div>';
      return;
    }

    var html = '';

    if(d.late.length){
      html += '<div class="alert-banner danger" style="margin-bottom:8px;"><span class="ic">⏰</span><div><b>'+d.late.length+' طلب متأخر فعلاً</b>يستاهل تتابعه الأول قبل أي حاجة تانية.</div></div>';
    }
    if(d.dueToday.length){
      html += '<div class="meta" style="margin-bottom:10px;">📅 <b>'+d.dueToday.length+'</b> طلب معاده تسليمه النهاردة بالظبط.</div>';
    }

    if(d.debts.length){
      var debtTotal = d.debts.reduce(function(s,r){ return s+r.remaining; }, 0);
      html += '<div class="meta" style="margin-bottom:6px;">🪙 <b>'+d.debts.length+'</b> عميل عليهم مديونية بإجمالي <b>'+Math.round(debtTotal).toLocaleString('ar-EG')+'</b> ج.م</div>';
      html += d.debts.slice(0,5).map(function(r){
        return '<div class="row" style="padding:5px 0;">'
          + '<span>'+escapeHtml(r.c.name)+' <span class="meta">('+r.orders+' طلب)</span></span>'
          + '<span style="display:flex;gap:6px;align-items:center;">'
          +   '<b style="color:var(--danger);">'+Math.round(r.remaining).toLocaleString('ar-EG')+' ج.م</b>'
          +   (r.c.phone ? '<button class="btn sm outline" style="padding:4px 8px;" onclick="sendDebtReminder(\''+r.c.id+'\')">💬</button>' : '')
          + '</span></div>';
      }).join('');
      if(d.debts.length>5){
        html += '<div class="meta">و'+(d.debts.length-5)+' عميل تاني... التفاصيل الكاملة من شاشة "المالية"</div>';
      }
    }

    if(d.readyToNotify.length){
      html += '<div class="meta" style="margin:10px 0 6px;">📲 <b>'+d.readyToNotify.length+'</b> طلب جاهز للتسليم لسه ما اتبعتش إشعار بيه النهاردة.</div>'
        + '<button class="btn sm accent" onclick="sendAllReadyPickupReminders()">📲 إرسال إشعار الجاهزية للكل</button>';
    }

    box.innerHTML = html;
  };

  var origRenderHomeTodayFocus = renderHome;
  renderHome = function(){
    origRenderHomeTodayFocus.apply(this, arguments);
    renderTodayFocusWidget();
  };

  /* ============================================================
     4) إشعار جاهزية واتساب (فردي + جماعي)
     ============================================================ */
  window.sendReadyPickupReminder = function(orderId){
    var o = db.orders.find(function(x){ return x.id===orderId; });
    if(!o) return;
    var c = customerById(o.customerId);
    if(!c || !c.phone){ toast('لا يوجد رقم هاتف مسجل لهذا العميل'); return; }
    var phone = c.phone.replace(/[^0-9]/g,'');
    if(phone.indexOf('0')===0) phone = '2'+phone;
    var msg = (db.workshopName||'ورشة تفصيل الجلابيب')+' 🧵\n'
      + 'حضرتك، طلبك ('+orderTypeLabel(o)+') بقى جاهز للاستلام ✅\n'
      + 'في انتظار حضرتك في أقرب وقت يناسبك 🙏';
    openWhatsAppChat(phone, msg);
    o.readyNotifiedAt = todayStr();
    saveDB();
    logActivity('📲 إرسال إشعار جاهزية لـ '+c.name);
    renderTodayFocusWidget();
  };

  window.sendAllReadyPickupReminders = function(){
    var candidates = readyToNotifyList().filter(function(o){
      var c = customerById(o.customerId);
      return c && c.phone;
    });
    if(!candidates.length){ toast('مفيش طلبات جاهزة محتاجة إشعار دلوقتي'); return; }
    appConfirm('هيتفتح '+candidates.length+' رسالة واتساب واحدة ورا التانية لعملاء طلباتهم جاهزة، تحب تكمل؟', {okText:'إرسال', danger:false}).then(function(ok){
      if(!ok) return;
      var i = 0;
      function next(){
        if(i>=candidates.length) return;
        window.sendReadyPickupReminder(candidates[i].id);
        i++;
        setTimeout(next, 700);
      }
      next();
    });
  };

  /* ============================================================
     2) تحديد جماعي لطلبات "قيد العمل" وتحويلها لـ "جاهز للتسليم"
     (شغالة على عرض القائمة بس، مش الكانبان)
     ============================================================ */
  var bulkSelectedIds = {}; // {orderId: true}

  function bulkSelectedCount(){
    return Object.keys(bulkSelectedIds).length;
  }

  function extractOrderIdFromCard(card){
    var btn = card.querySelector('button[onclick^="openOrderModal("]');
    if(!btn) return null;
    var m = /openOrderModal\('([^']+)'\)/.exec(btn.getAttribute('onclick')||'');
    return m ? m[1] : null;
  }

  function onBulkCheckboxChange(id, checked){
    if(checked) bulkSelectedIds[id] = true;
    else delete bulkSelectedIds[id];
    renderBulkStatusBar();
  }

  function ensureBulkStatusBar(){
    var existing = document.getElementById('bulkStatusBar');
    if(existing) return existing;
    var list = document.getElementById('ordersList');
    if(!list || !list.parentNode) return null;
    var bar = document.createElement('div');
    bar.id = 'bulkStatusBar';
    bar.className = 'alert-banner warn';
    bar.style.display = 'none';
    bar.style.marginBottom = '10px';
    list.parentNode.insertBefore(bar, list);
    return bar;
  }

  function renderBulkStatusBar(){
    var bar = ensureBulkStatusBar();
    if(!bar) return;
    var n = bulkSelectedCount();
    if(n===0){
      bar.style.display = 'none';
      bar.innerHTML = '';
      return;
    }
    bar.style.display = '';
    bar.innerHTML = '<span class="ic">✅</span><div>محدد حاليًا <b>'+n+'</b> طلب. '
      + '<button class="btn sm accent" style="margin-top:6px;" onclick="applyBulkReadyStatus()">✔️ تحويل الكل لـ "جاهز للتسليم"</button> '
      + '<button class="btn sm outline" style="margin-top:6px;" onclick="clearBulkSelection()">✕ إلغاء التحديد</button></div>';
  }

  window.clearBulkSelection = function(){
    bulkSelectedIds = {};
    renderOrders();
  };

  window.applyBulkReadyStatus = function(){
    var ids = Object.keys(bulkSelectedIds);
    if(!ids.length) return;
    appConfirm('هيتم تحويل '+ids.length+' طلب من "قيد العمل" لحالة "جاهز للتسليم" دفعة واحدة، تحب تكمل؟', {okText:'تحويل', danger:false}).then(function(ok){
      if(!ok) return;
      var snapshots = [];
      ids.forEach(function(id){
        var o = db.orders.find(function(x){ return x.id===id; });
        if(!o || o.status!=='قيد العمل') return;
        snapshots.push({id:id, status:o.status, updatedAt:o.updatedAt});
        o.status = 'جاهز للتسليم';
        o.updatedAt = Date.now();
      });
      if(!snapshots.length){
        toast('التحديد بقى مش صالح للتحويل (ممكن حالة الطلبات دي اتغيرت)');
        bulkSelectedIds = {};
        renderOrders();
        return;
      }
      logActivity('✅ تحويل '+snapshots.length+' طلب دفعة واحدة لحالة "جاهز للتسليم"');
      setUndo('تحويل '+snapshots.length+' طلب لـ جاهز للتسليم', function(){
        snapshots.forEach(function(s){
          var o = db.orders.find(function(x){ return x.id===s.id; });
          if(o){ o.status = s.status; o.updatedAt = s.updatedAt; }
        });
        saveDB();
        renderOrders();
        renderHome();
      });
      bulkSelectedIds = {};
      saveDB();
      renderOrders();
      renderHome();
      toast('✅ تم تحويل '+snapshots.length+' طلب لحالة "جاهز للتسليم"');
    });
  };

  function augmentOrdersListWithBulkSelect(){
    var list = document.getElementById('ordersList');
    if(!list) return;
    var validIds = {};
    var cards = list.querySelectorAll('.card[data-status]');
    cards.forEach(function(card){
      if(card.getAttribute('data-status')!=='قيد العمل') return;
      var id = extractOrderIdFromCard(card);
      if(!id) return;
      validIds[id] = true;
      if(card.querySelector('.bulkChk')) {
        var existingChk = card.querySelector('.bulkChk');
        existingChk.checked = !!bulkSelectedIds[id];
        return;
      }
      var label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:6px;cursor:pointer;';
      var chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.className = 'bulkChk';
      chk.style.cssText = 'width:18px;height:18px;';
      chk.checked = !!bulkSelectedIds[id];
      chk.addEventListener('change', function(){ onBulkCheckboxChange(id, chk.checked); });
      var span = document.createElement('span');
      span.className = 'meta';
      span.textContent = 'تحديد للتحويل الجماعي';
      label.appendChild(chk);
      label.appendChild(span);
      card.insertBefore(label, card.firstChild);
    });
    // تنظيف أي تحديد لطلب بقى مش "قيد العمل" أو اتشال من القائمة
    Object.keys(bulkSelectedIds).forEach(function(id){
      if(!validIds[id]) delete bulkSelectedIds[id];
    });
    renderBulkStatusBar();
  }

  var origRenderOrdersBulk = renderOrders;
  renderOrders = function(){
    origRenderOrdersBulk.apply(this, arguments);
    augmentOrdersListWithBulkSelect();
  };

  /* ============================================================
     3) طباعة كل تذاكر تقطيع طلبات النهاردة دفعة واحدة
     ============================================================ */
  window.printTodayCuttingTickets = function(){
    var today = todayStr();
    var todays = db.orders.filter(function(o){ return o.dateReceived===today; });
    if(!todays.length){ toast('لا يوجد طلبات استلمتها النهاردة عشان تطبع تذاكرها'); return; }

    var labels = todays.map(function(o, idx){
      var c = customerById(o.customerId);
      var shortId = o.id.slice(-5).toUpperCase();
      var pageBreak = idx < todays.length-1 ? 'page-break-after:always;' : '';
      return '<div class="label" style="'+pageBreak+'">'
        + '<div style="font-size:10.5px;color:#888;margin-bottom:2px;">'+escapeHtml(db.workshopName||'ورشة تفصيل الجلابيب')+'</div>'
        + '<h1>🧵 '+escapeHtml(c?c.name:'عميل')+'</h1>'
        + '<div class="row"><span>النوع</span><b>'+escapeHtml(orderTypeLabel(o))+'</b></div>'
        + '<div class="row"><span>الاستلام</span><b>'+fmtDate(o.dateReceived)+'</b></div>'
        + '<div class="row"><span>التسليم</span><b>'+fmtDate(o.dateDelivery)+'</b></div>'
        + '<div class="code">#'+shortId+'</div>'
        + '</div>';
    }).join('');

    var html = '<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>تذاكر تقطيع اليوم</title>'
      + '<style>'
      + '@page{ size:80mm 50mm; margin:4mm; }'
      + 'body{font-family:Tahoma,Arial,sans-serif;color:#111;margin:0;padding:0;}'
      + '.label{border:2px dashed #1F6D57;border-radius:10px;padding:10px 12px;margin:6px;}'
      + '.label h1{font-size:16px;margin:0 0 6px;color:#1F6D57;}'
      + '.label .row{display:flex;justify-content:space-between;font-size:12.5px;margin:3px 0;}'
      + '.label .row b{font-weight:700;}'
      + '.label .code{margin-top:6px;text-align:center;font-size:18px;font-weight:900;letter-spacing:2px;border-top:1px dashed #ccc;padding-top:6px;}'
      + '</style></head><body>'+labels+'</body></html>';

    openPrintWindow(html, 'تذاكر_تقطيع_'+today);
    toast('🖨️ جاري تجهيز '+todays.length+' تذكرة تقطيع للطباعة دفعة واحدة');
  };

  // بنضيف الزرار جوه شريط فلاتر الطلبات، بنفس أسلوب زرار "قياسات متقاربة" الموجود
  var origRenderOrdersPrintBtn = renderOrders;
  renderOrders = function(){
    origRenderOrdersPrintBtn.apply(this, arguments);
    var filters = document.getElementById('orderStatusFilters');
    if(!filters || filters.querySelector('#printTodayTicketsBtn')) return;
    var btn = document.createElement('button');
    btn.id = 'printTodayTicketsBtn';
    btn.type = 'button';
    btn.className = 'btn sm outline';
    btn.textContent = '🖨️ تذاكر تقطيع اليوم دفعة واحدة';
    btn.addEventListener('click', function(){ printTodayCuttingTickets(); });
    filters.appendChild(btn);
  };

  /* ============================================================
     5) بطاقة الفحص والتشخيص التلقائي (في الإعدادات)
     ============================================================ */
  function checkCoreFunctionsHealth(){
    var required = ['renderHome','renderOrders','renderCustomers','saveDB','openModal','customerById','orderTotal'];
    return required.filter(function(name){
      try{ return typeof eval(name)!=='function'; }
      catch(e){ return true; }
    });
  }

  function runDataIntegrityCheck(){
    var issues = []; // {msg, actionHtml}

    // طلبات يتيمة (عميلها محذوف)
    var orphanOrders = db.orders.filter(function(o){ return !customerById(o.customerId); });
    if(orphanOrders.length){
      issues.push({
        title: '🧩 '+orphanOrders.length+' طلب مرتبط بعميل محذوف',
        detail: 'الطلبات دي بقت "يتيمة" وممكن تسبب أرقام غلط في التقارير. تقدر تراجعها وتحذفها لو مش محتاجها.',
        rows: orphanOrders.slice(0,8).map(function(o){
          return '<div class="row" style="padding:4px 0;"><span>طلب #'+o.id.slice(-5).toUpperCase()+' — '+escapeHtml(orderTypeLabel(o)||'')+'</span>'
            + '<button class="btn sm danger" style="padding:4px 8px;" onclick="deleteOrder(\''+o.id+'\')">🗑️ حذف</button></div>';
        }).join('')
      });
    }

    // دفعات مرتبطة بطلب محذوف
    var orphanPayments = (db.payments||[]).filter(function(p){ return !db.orders.some(function(o){ return o.id===p.orderId; }); });
    if(orphanPayments.length){
      issues.push({
        title: '💳 '+orphanPayments.length+' دفعة مسجلة على طلب مش موجود',
        detail: 'ممكن يكون الطلب اتحذف قبل كده من غير ما دفعاته تتحذف معاه، وده ممكن يزوّد أرقام "إجمالي المحصّل" في المالية بشكل غير دقيق.',
        rows: ''
      });
    }

    // أرقام سالبة في الطلبات
    var negativeOrders = db.orders.filter(function(o){
      return (Number(o.extra)||0)<0 || (Number(o.materialCost)||0)<0 || (Number(o.paid)||0)<0;
    });
    if(negativeOrders.length){
      issues.push({
        title: '➖ '+negativeOrders.length+' طلب فيه قيمة رقمية سالبة (مصاريف/خامة/مدفوع)',
        detail: 'قيمة سالبة هنا غالبًا خطأ إدخال وبتأثر على حساب الأرباح.',
        rows: '<button class="btn sm accent" onclick="fixNegativeOrderValues()">🔧 تصفير القيم السالبة دي</button>'
      });
    }

    // طلب مدفوع أكتر من إجماليه
    var overpaidOrders = db.orders.filter(function(o){ return (Number(o.paid)||0) > orderTotal(o)+0.01; });
    if(overpaidOrders.length){
      issues.push({
        title: '💰 '+overpaidOrders.length+' طلب المدفوع فيه أكبر من إجماليه',
        detail: 'يستاهل مراجعة يدوية — يمكن خصم اتضاف بعد التحصيل، أو غلطة كتابة.',
        rows: overpaidOrders.slice(0,6).map(function(o){
          var c = customerById(o.customerId);
          return '<div class="row" style="padding:4px 0;"><span>'+escapeHtml(c?c.name:'عميل محذوف')+'</span>'
            + '<button class="btn sm outline" style="padding:4px 8px;" onclick="closeModal();openOrderModal(\''+o.id+'\')">✏️ فتح ومراجعة</button></div>';
        }).join('')
      });
    }

    // أرقام هواتف عملاء مكررة
    var phoneMap = {};
    db.customers.forEach(function(c){
      var p = (c.phone||'').replace(/[^0-9]/g,'');
      if(!p) return;
      if(!phoneMap[p]) phoneMap[p] = [];
      phoneMap[p].push(c);
    });
    var dupPhoneGroups = Object.keys(phoneMap).map(function(p){ return phoneMap[p]; }).filter(function(g){ return g.length>1; });
    if(dupPhoneGroups.length){
      issues.push({
        title: '📞 '+dupPhoneGroups.length+' رقم هاتف مسجل لأكتر من عميل',
        detail: 'ممكن يكون نفس العميل اتسجل مرتين بالغلط.',
        rows: dupPhoneGroups.slice(0,6).map(function(g){
          return '<div class="meta" style="padding:4px 0;">'+g.map(function(c){ return escapeHtml(c.name); }).join(' / ')+'</div>';
        }).join('')
      });
    }

    return issues;
  }

  window.fixNegativeOrderValues = function(){
    var fixed = 0;
    db.orders.forEach(function(o){
      ['extra','materialCost','paid'].forEach(function(f){
        if((Number(o[f])||0) < 0){ o[f] = 0; fixed++; }
      });
    });
    if(!fixed){ toast('مفيش قيم سالبة لتصفيرها'); return; }
    saveDB();
    logActivity('🔧 تصفير '+fixed+' قيمة سالبة في بيانات الطلبات (فحص تلقائي)');
    toast('✅ تم تصفير '+fixed+' قيمة سالبة');
    renderSystemHealthCard();
  };

  window.runSystemHealthCheck = function(){
    renderSystemHealthCard();
    toast('تم تحديث نتيجة الفحص');
  };

  function ensureSystemHealthCard(){
    var anchorInput = document.getElementById('workshopNameInput');
    if(!anchorInput) return null;
    var card = document.getElementById('systemHealthCard');
    if(card) return card;
    card = document.createElement('div');
    card.id = 'systemHealthCard';
    card.className = 'card';
    card.innerHTML = '<h3 style="margin-top:0;">🩺 فحص وتشخيص تلقائي</h3>'
      + '<p class="meta" style="margin-top:-6px;">فحص محلي فوري لسلامة بيانات الورشة (طلبات يتيمة، أرقام غلط، تكرار بيانات...) ولتشغيل أهم دوال البرنامج، عشان تكتشف أي مشكلة بدري قبل ما تأثر على أرقامك.</p>'
      + '<div id="systemHealthBox"></div>'
      + '<button class="btn sm outline" style="margin-top:10px;" onclick="runSystemHealthCheck()">🔄 إعادة الفحص</button>';
    var anchorCard = anchorInput.closest('.card') || anchorInput.closest('section') || anchorInput.parentElement;
    if(anchorCard && anchorCard.parentNode){
      anchorCard.parentNode.insertBefore(card, anchorCard.nextSibling);
    } else {
      anchorInput.parentElement.appendChild(card);
    }
    return card;
  }

  window.renderSystemHealthCard = function(){
    ensureSystemHealthCard();
    var box = document.getElementById('systemHealthBox');
    if(!box) return;

    var missingFns = checkCoreFunctionsHealth();
    var issues = runDataIntegrityCheck();

    var html = '';
    if(missingFns.length){
      html += '<div class="alert-banner danger" style="margin-bottom:10px;"><span class="ic">⚠️</span><div><b>تحذير: '+missingFns.length+' دالة أساسية مش شغالة</b>'
        + '('+missingFns.join('، ')+') — يمكن ملف من ملفات البرنامج فشل يتحمّل. جرّب تعمل تحديث/إغلاق وفتح للتطبيق.</div></div>';
    } else {
      html += '<div class="meta" style="color:var(--ok);margin-bottom:10px;">✅ كل دوال البرنامج الأساسية شغالة طبيعي.</div>';
    }

    if(!issues.length){
      html += '<div class="empty-msg">لا توجد مشاكل بيانات مكتشفة حاليًا 🎉</div>';
    } else {
      html += issues.map(function(iss){
        return '<div class="card" style="padding:10px 12px;margin-bottom:8px;border-right-color:var(--warn);">'
          + '<b>'+iss.title+'</b>'
          + '<div class="meta" style="margin:4px 0 6px;">'+iss.detail+'</div>'
          + (iss.rows||'')
          + '</div>';
      }).join('');
    }

    box.innerHTML = html;
  };

  var origSettingsRenderForHealth = null;
  if(typeof renderSettings==='function'){
    origSettingsRenderForHealth = renderSettings;
    renderSettings = function(){
      origSettingsRenderForHealth.apply(this, arguments);
      renderSystemHealthCard();
    };
  } else {
    // لو دالة renderSettings مش موجودة بالاسم ده، بنستخدم renderInvoicePreviewCard
    // كمرساة لأننا شفنا إنها بتتنفذ عند فتح صفحة الإعدادات
    var origInvoicePreviewForHealth = renderInvoicePreviewCard;
    renderInvoicePreviewCard = function(){
      origInvoicePreviewForHealth.apply(this, arguments);
      renderSystemHealthCard();
    };
  }
})();
