
/* ============================================================
   [تم الإصلاح] الكود كله دلوقتي ملفوف جوه IIFE واحدة
   عشان الـ return في أول سطر يبقى شغال وميكسرش تحليل السكربت بالكامل
   ============================================================ */
(function(){

/* 0) حارس تنفيذ لمرة واحدة فقط لكل جلسة فتح للتطبيق */
if(window.__workshopPatchesLoaded) { return; }
window.__workshopPatchesLoaded = true;

/* علم مشترك: بيتحط true قبل ما نكمل حفظ ناجح (بعد تأكيد المستخدم)،
   عشان نافذة "عندك تعديلات لم تُحفظ" متظهرش وهي بتتقفل بسبب الحفظ نفسه. */
var __skipUnsavedCheckOnce = false;

/* 0-ب) [إصلاح مهم] appConfirm الأصلية بتكتب فوق محتوى المودال الحالي
   (modalBox.innerHTML) عشان تعرض رسالة التأكيد. ده معناه إن أي appConfirm
   بيتفتح والمستخدم لسه فاتح فورم (تعديل عميل/طلب) بيمسح كل حقول الفورم
   من الـ DOM فعليًا. لو المستخدم ضغط "تأكيد"، الكود اللي بعد appConfirm
   بيحاول يقرأ نفس الحقول (زي f_name) فيلاقيها اتمسحت ويفشل الحفظ بصمت —
   وده كان موجود بالفعل في الكود الأصلي (تأكيد رقم الهاتف المكرر) وكمان
   كان هيبوّظ نوافذ التأكيد الجديدة اللي بنضيفها هنا على التعديل.
   الحل: نافذة تأكيد مستقلة تتظهر فوق المودال الحالي من غير ما تمسح
   محتواه، فالفورم يفضل سليم لحد ما فعليًا نكمل الحفظ. */
(function(){
  window.appConfirm = function(message, opts){
    opts = opts || {};
    var okText = opts.okText || 'تأكيد';
    var cancelText = opts.cancelText || 'إلغاء';
    var danger = opts.danger !== false;
    return new Promise(function(resolve){
      var ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:20px;';
      var box = document.createElement('div');
      box.style.cssText = 'background:var(--card,#fff);color:inherit;border-radius:14px;max-width:380px;width:100%;padding:16px 16px 14px;box-shadow:0 10px 30px rgba(0,0,0,.35);';
      box.innerHTML =
        '<div style="font-weight:800;font-size:15px;margin-bottom:10px;">⚠️ تأكيد</div>'+
        '<div style="font-size:14.5px;line-height:1.7;margin-bottom:16px;">'+escapeHtml(message)+'</div>'+
        '<div style="display:flex;gap:8px;">'+
          '<button type="button" data-a="cancel" class="btn outline" style="flex:1;">'+escapeHtml(cancelText)+'</button>'+
          '<button type="button" data-a="ok" class="btn '+(danger?'danger':'')+'" style="flex:1;">'+escapeHtml(okText)+'</button>'+
        '</div>';
      ov.appendChild(box);
      document.body.appendChild(ov);
      function cleanup(result){ ov.remove(); resolve(result); }
      box.querySelector('[data-a="ok"]').onclick = function(){ cleanup(true); };
      box.querySelector('[data-a="cancel"]').onclick = function(){ cleanup(false); };
      ov.addEventListener('click', function(e){ if(e.target===ov) cleanup(false); });
    });
  };
})();
(function(){
  function enhancePhones(){
    document.querySelectorAll('.meta').forEach(function(el){
      if(el.dataset.rcPhone) return;
      var txt = el.textContent||'';
      if(txt.trim().indexOf('📞')===0){
        var digits = txt.replace(/[^0-9]/g,'');
        if(digits.length>=9){
          el.dataset.rcPhone='1';
          var waNum = digits.replace(/^0/,'2'); // افتراض رقم مصري — غيّرها لو بلدك مختلف
          var span=document.createElement('span');
          span.style.cssText='display:inline-flex;gap:6px;margin-inline-start:10px;';
          span.innerHTML =
            '<a href="tel:'+digits+'" style="text-decoration:none;background:var(--ok-light);color:var(--ok);border-radius:8px;padding:2px 9px;font-size:12px;font-weight:700;">📞</a>'+
            '<a href="https://wa.me/'+waNum+'" target="_blank" style="text-decoration:none;background:var(--ok-light);color:var(--ok);border-radius:8px;padding:2px 9px;font-size:12px;font-weight:700;">💬</a>';
          el.appendChild(span);
        }
      }
    });
  }
  new MutationObserver(enhancePhones).observe(document.getElementById('app'), {childList:true, subtree:true});
  enhancePhones();
})();

/* 2) ضغطة مطوّلة على شعار التطبيق تفتح البحث الشامل فورًا */
(function(){
  var brand = document.querySelector('.topbar-brand');
  if(!brand) return;
  var pressTimer;
  brand.addEventListener('touchstart', function(){
    pressTimer = setTimeout(function(){
      showPage('home');
      setTimeout(function(){ var i=document.getElementById('globalSearch'); if(i) i.focus(); }, 150);
      if(navigator.vibrate) navigator.vibrate(30);
    }, 550);
  });
  ['touchend','touchmove','touchcancel'].forEach(function(ev){
    brand.addEventListener(ev, function(){ clearTimeout(pressTimer); });
  });
})();

/* 3) شريط آخر 3 عملاء تم فتحهم أعلى صفحة العملاء */
(function(){
  function getRecent(){ try{ return JSON.parse(localStorage.getItem('recentCustomers')||'[]'); }catch(e){ return []; } }
  function pushRecent(id){
    var list = getRecent().filter(function(x){ return x!==id; });
    list.unshift(id);
    localStorage.setItem('recentCustomers', JSON.stringify(list.slice(0,3)));
  }
  var origHistory = openCustomerHistory;
  openCustomerHistory = function(id){ pushRecent(id); return origHistory.apply(this, arguments); };
  var origCustModal = openCustomerModal;
  openCustomerModal = function(id){ if(id) pushRecent(id); return origCustModal.apply(this, arguments); };

  var origRenderCustomers = renderCustomers;
  renderCustomers = function(){
    origRenderCustomers.apply(this, arguments);
    try{
      var pageBox = document.getElementById('page-customers');
      var searchBox = pageBox.querySelector('.search-box');
      var strip = document.getElementById('recentCustomersStrip');
      var list = getRecent().map(function(id){ return customerById(id); }).filter(Boolean);
      if(list.length===0){ if(strip) strip.remove(); return; }
      if(!strip){ strip=document.createElement('div'); strip.id='recentCustomersStrip'; searchBox.insertAdjacentElement('afterend', strip); }
      strip.innerHTML = list.map(function(c){
        return '<span class="rc-chip" onclick="openCustomerHistory(\''+c.id+'\')">🕘 '+escapeHtml(c.name)+'</span>';
      }).join('');
    }catch(e){}
  };
})();

/* 4) عداد الطلبات المتأخرة على زر "الطلبات" بالقائمة الجانبية */
(function(){
  function updateOrdersBadge(){
    try{
      var btn = document.querySelector('.navbtn[data-page="orders"]');
      if(!btn) return;
      var count = db.orders.filter(isOverdue).length;
      var badge = btn.querySelector('.overdue-badge');
      if(count>0){
        if(!badge){ badge=document.createElement('span'); badge.className='overdue-badge';
          badge.style.cssText='background:var(--danger);color:#fff;border-radius:10px;padding:1px 7px;font-size:11px;font-weight:900;margin-inline-start:auto;';
          btn.appendChild(badge); }
        badge.textContent=count;
      } else if(badge){ badge.remove(); }
    }catch(e){}
  }
  var origOpenSideNav = openSideNav;
  openSideNav = function(){ updateOrdersBadge(); return origOpenSideNav.apply(this, arguments); };
  var origCloseModal = closeModal;
  closeModal = function(){ var r = origCloseModal.apply(this, arguments); updateOrdersBadge(); return r; };
  setTimeout(updateOrdersBadge, 800);
})();

/* 5) حفظ آخر نوع وسعر تفصيل استُخدم لكل عميل، وتعبئته تلقائيًا في طلب جديد لنفس العميل */
(function(){
  var origSaveOrder = saveOrder;
  saveOrder = function(id){
    try{
      var custSel = document.getElementById('f_customer');
      var firstRow = document.querySelector('#itemsContainer .item-row');
      if(custSel && firstRow){
        var typeSel = firstRow.querySelector('.it-type');
        var priceInp = firstRow.querySelector('.it-price');
        if(custSel.value && typeSel && typeSel.value && typeSel.value!=='__custom__' && priceInp && priceInp.value){
          localStorage.setItem('lastOrder_'+custSel.value, JSON.stringify({typeId:typeSel.value, price:priceInp.value}));
        }
      }
    }catch(e){}
    return origSaveOrder.apply(this, arguments);
  };

  var origOpenOrderModal = openOrderModal;
  openOrderModal = function(id, presetCustomerId){
    var result = origOpenOrderModal.apply(this, arguments);
    if(!id){
      setTimeout(function(){
        try{
          var custId = presetCustomerId || (document.getElementById('f_customer')?document.getElementById('f_customer').value:'');
          if(!custId) return;
          var saved = localStorage.getItem('lastOrder_'+custId);
          if(!saved) return;
          var data = JSON.parse(saved);
          var firstRow = document.querySelector('#itemsContainer .item-row');
          if(!firstRow) return;
          var typeSel = firstRow.querySelector('.it-type');
          var priceInp = firstRow.querySelector('.it-price');
          var hasOption = Array.prototype.some.call(typeSel.options, function(o){ return o.value===data.typeId; });
          if(typeSel && hasOption){
            typeSel.value = data.typeId;
            priceInp.value = data.price;
            recalcItemsTotal();
            toast('📌 تم تعبئة آخر نوع وسعر لهذا العميل');
          }
        }catch(e){}
      }, 50);
    }
    return result;
  };
})();

/* 6) نظام نقاط ولاء بسيط: كل 5 طلبات تم تسليمها = خصم 10% تلقائي على الطلب التالي */
(function(){
  function customerLoyaltyInfo(c){
    var delivered = db.orders.filter(function(o){ return o.customerId===c.id && o.status==='تم التسليم'; }).length;
    var lastRedeemedAt = Number(localStorage.getItem('loyaltyRedeemed_'+c.id))||0;
    var progress = delivered - lastRedeemedAt;
    var threshold = 5;
    return {delivered:delivered, progress:progress, threshold:threshold, eligible: progress>=threshold};
  }

  var origRC = renderCustomers;
  renderCustomers = function(){
    origRC.apply(this, arguments);
    try{
      document.querySelectorAll('#customersList .card').forEach(function(card){
        if(card.dataset.loyaltyAdded) return;
        var metas = card.querySelectorAll('.meta');
        var phoneEl = null;
        metas.forEach(function(m){ if(!phoneEl && m.textContent.trim().indexOf('📞')===0) phoneEl = m; });
        if(!phoneEl) return;
        var digits = phoneEl.textContent.replace(/[^0-9]/g,'');
        var c = db.customers.find(function(x){ return (x.phone||'').replace(/[^0-9]/g,'')===digits; });
        if(!c) return;
        card.dataset.loyaltyAdded='1';
        var info = customerLoyaltyInfo(c);
        var chip = document.createElement('div');
        chip.className='meta'; chip.style.marginTop='4px';
        chip.innerHTML = info.eligible
          ? '<span style="background:var(--accent-light);color:var(--accent-dark);border-radius:8px;padding:3px 9px;font-size:12px;font-weight:800;">🎁 مؤهل لخصم ولاء 10% بالطلب القادم</span>'
          : '🎁 نقاط الولاء: '+info.progress+'/'+info.threshold+' طلبات للخصم القادم';
        phoneEl.insertAdjacentElement('afterend', chip);
      });
    }catch(e){}
  };

  var pendingLoyalty = null;
  var origOOM = openOrderModal;
  openOrderModal = function(id, presetCustomerId){
    var r = origOOM.apply(this, arguments);
    if(!id){
      setTimeout(function(){
        try{
          var custId = presetCustomerId || (document.getElementById('f_customer')?document.getElementById('f_customer').value:'');
          var c = custId ? customerById(custId) : null;
          if(!c) return;
          var info = customerLoyaltyInfo(c);
          if(info.eligible){
            var dType = document.getElementById('f_discountType');
            var dVal = document.getElementById('f_discountValue');
            if(dType && dVal && dType.value==='none'){
              dType.value='percent'; dVal.value='10';
              onDiscountTypeChange();
              pendingLoyalty = {customerId:c.id, offeredAtDelivered:info.delivered};
              toast('🎁 العميل مؤهل لخصم ولاء، تم تطبيق 10% تلقائيًا');
            }
          }
        }catch(e){}
      }, 60);
    }
    return r;
  };

  var origSOLoyalty = saveOrder;
  saveOrder = function(id){
    var beforeCount = db.orders.length;
    var custIdBefore = document.getElementById('f_customer') ? document.getElementById('f_customer').value : null;
    var r = origSOLoyalty.apply(this, arguments);
    try{
      if(!id && pendingLoyalty && pendingLoyalty.customerId===custIdBefore && db.orders.length>beforeCount){
        localStorage.setItem('loyaltyRedeemed_'+pendingLoyalty.customerId, pendingLoyalty.offeredAtDelivered);
        pendingLoyalty = null;
      }
    }catch(e){}
    return r;
  };
})();

/* 7) رسالة جاهزة لإشعار العميل عبر واتساب لما الطلب يبقى "جاهز للتسليم" */
(function(){
  function buildReadyMessage(o, c){
    var shopName = db.workshopName || 'ورشة تفصيل الجلابيب';
    return 'مرحبًا '+c.name+'، طلبك ('+orderTypeLabel(o)+') بقى جاهز للاستلام من '+shopName+'. تقدر تمر تستلمه في أقرب وقت يناسبك 🙏';
  }
  var origSOReady = saveOrder;
  saveOrder = function(id){
    var oldStatus = null;
    if(id){ var existing = db.orders.find(function(x){ return x.id===id; }); if(existing) oldStatus = existing.status; }
    var r = origSOReady.apply(this, arguments);
    try{
      if(id){
        var o = db.orders.find(function(x){ return x.id===id; });
        if(o && o.status==='جاهز للتسليم' && oldStatus!=='جاهز للتسليم'){
          var c = customerById(o.customerId);
          if(c && c.phone){
            var digits = c.phone.replace(/[^0-9]/g,'');
            var waNum = digits.replace(/^0/,'2'); // افتراض رقم مصري
            var msg = buildReadyMessage(o, c);
            setTimeout(function(){
              openModal(
                '<div class="modal-head"><h3>📲 إشعار العميل بجاهزية الطلب</h3><button class="modal-close" onclick="closeModal()">✕</button></div>'
                + '<p class="meta">تقدر ترسل رسالة جاهزة للعميل:</p>'
                + '<div class="card" style="padding:10px;font-size:13.5px;white-space:pre-wrap;">'+escapeHtml(msg)+'</div>'
                + '<a class="btn accent" style="display:block;text-align:center;margin-top:10px;text-decoration:none;" target="_blank" href="https://wa.me/'+waNum+'?text='+encodeURIComponent(msg)+'">💬 إرسال عبر واتساب</a>'
              );
            }, 300);
          }
        }
      }
    }catch(e){}
    return r;
  };
})();

/* 8) مستحقات مالية متوقعة خلال أسبوع في صفحة المالية — مربوطة بالتزاماتك
   (أقساط + قروض) المستحقة في نفس الأسبوع، عشان الرقم "المتوقع تحصيله"
   ميدّيش إحساس مضلل بالراحة من غير ما تعرف قد إيه منه لازم يروح لالتزاماتك */
(function(){
  // إجمالي الأقساط + أقساط القروض المستحقة عليك خلال N يوم جايين (متأخر
  // محسوب برضه، زي منطق getCommitmentDueAlerts بالظبط بس بنافذة أوسع من 3 أيام)
  function dueWithinDays(days){
    var today = todayStr();
    var commitmentsTotal = 0, commitmentsCount = 0;
    try{
      var nowYM = currentYM();
      (db.commitments||[]).filter(function(c){ return c.active!==false && c.dueDay; }).forEach(function(c){
        if(c.lastPaidMonth===nowYM) return;
        if(!isCommitmentCycleMonth(c, nowYM)) return; // مش شهر استحقاق للالتزام ده
        var due = commitmentDueDateStr(c);
        var diff = Math.round((new Date(due)-new Date(today))/86400000);
        if(diff<=days){ commitmentsTotal += Number(c.amount||0); commitmentsCount++; }
      });
    }catch(e){}
    var loanTotal = 0, loanCount = 0;
    try{
      var nowYM2 = currentYM();
      var parts = today.split('-').map(Number);
      var lastDay = new Date(Date.UTC(parts[0], parts[1], 0)).getUTCDate();
      (db.personalLoans||[]).filter(function(l){ return l.active!==false && l.dueDay; }).forEach(function(l){
        if(l.lastPaidMonth===nowYM2) return;
        var day = Math.min(Number(l.dueDay), lastDay);
        var due = nowYM2+'-'+String(day).padStart(2,'0');
        var diff = Math.round((new Date(due)-new Date(today))/86400000);
        if(diff<=days){ loanTotal += Number(l.monthlyPayment||0); loanCount++; }
      });
    }catch(e){}
    return {total:commitmentsTotal+loanTotal, count:commitmentsCount+loanCount};
  }

  var origRF = renderFinance;
  renderFinance = function(){
    origRF.apply(this, arguments);
    try{
      var today = todayStr();
      var in7 = new Date(); in7.setDate(in7.getDate()+7);
      var in7Str = in7.toISOString().slice(0,10);
      var upcoming = db.orders.filter(function(o){
        return o.status!=='تم التسليم' && o.dateDelivery && o.dateDelivery>=today && o.dateDelivery<=in7Str;
      });
      var expectedTotal = upcoming.reduce(function(s,o){ return s+orderRemaining(o); }, 0);
      var noDeposit = upcoming.filter(function(o){ return (Number(o.paid)||0)===0; });
      var noDepositAmount = noDeposit.reduce(function(s,o){ return s+orderRemaining(o); }, 0);
      var owed = dueWithinDays(7);
      var net = expectedTotal - owed.total;
      var box = document.getElementById('expectedCashflowBox');
      if(!box){
        box = document.createElement('div');
        box.id='expectedCashflowBox';
        document.getElementById('financeStats').insertAdjacentElement('afterend', box);
      }
      var riskLine = noDeposit.length>0
        ? '<div class="meta" style="margin-top:6px;color:var(--warn,#b8860b);">⚠️ منها '+noDeposit.length+' طلب من غير أي عربون بإجمالي '+Math.round(noDepositAmount).toLocaleString('ar-EG')+' ج.م — تحصيله وقت التسليم مش مضمون زي الطلبات اللي أخدت عربون.</div>'
        : '';
      var owedLine = owed.count>0
        ? '<div class="row" style="margin-top:8px;"><span class="meta">مستحق عليك في نفس الفترة (أقساط/قروض)</span>'
          + '<b style="color:var(--danger);">'+Math.round(owed.total).toLocaleString('ar-EG')+' ج.م</b></div>'
          + '<div class="meta">من '+owed.count+' قسط/التزام مستحق خلال 7 أيام</div>'
          + '<div class="row" style="margin-top:8px;border-top:1px solid var(--border);padding-top:8px;"><span class="meta">'+(net>=0?'الصافي المتوقع بعد التزاماتك':'العجز المتوقع لو اتحصّل المتوقع بس')+'</span>'
          + '<b style="color:'+(net>=0?'var(--ok)':'var(--danger)')+';">'+Math.round(net).toLocaleString('ar-EG')+' ج.م</b></div>'
        : '<div class="meta" style="margin-top:6px;">مفيش أقساط أو قروض مستحقة عليك في نفس الفترة.</div>';
      box.innerHTML =
        '<div class="section-title">📥 مستحقات متوقعة (الأسبوع القادم)</div>'
        + '<div class="card"><div class="row"><h3>إجمالي المتوقع تحصيله</h3>'
        + '<b style="color:var(--ok);font-size:17px;">'+expectedTotal.toLocaleString('ar-EG')+' ج.م</b></div>'
        + '<div class="meta">من '+upcoming.length+' طلب مجدول للتسليم خلال 7 أيام</div>'
        + riskLine
        + owedLine
        + '</div>';
    }catch(e){}
  };
})();

/* 9) خطة اليوم — تظهر تلقائيًا عند فتح التطبيق (مرة باليوم) */
setTimeout(function(){
  try{
    if(typeof computeTodayQueue!=='function') return;
    var today = todayStr();
    if(localStorage.getItem('dailyPlanShownDate')===today) return;
    if(isDayOff(new Date())){ localStorage.setItem('dailyPlanShownDate', today); return; }
    var q = computeTodayQueue();
    var queue = q.queue||[], mustFinish = q.mustFinish||[];
    if(queue.length===0){ localStorage.setItem('dailyPlanShownDate', today); return; }
    var items = queue.slice(0,5).map(function(o,i){
      var c = customerById(o.customerId);
      return '<div class="row" style="padding:6px 0;border-bottom:1px solid var(--border);"><span>'+(i+1)+'. '+(c?escapeHtml(c.name):'عميل محذوف')+' - '+escapeHtml(orderTypeLabel(o))+'</span></div>';
    }).join('');
    openModal(
      '<div class="modal-head"><h3>☀️ خطة شغل النهاردة</h3><button class="modal-close" onclick="closeModal()">✕</button></div>'
      + '<p class="meta">عندك '+queue.length+' طلب في الدور، منهم '+mustFinish.length+' لازم يخلص النهاردة.</p>'
      + items
      + (queue.length>5 ? '<p class="meta" style="margin-top:6px;">+ '+(queue.length-5)+' طلب تاني</p>' : '')
      + '<button class="btn" style="margin-top:12px;" onclick="closeModal();showPage(\'home\')">📋 فتح خطة اليوم كاملة</button>'
    );
    localStorage.setItem('dailyPlanShownDate', today);
  }catch(e){}
}, 900);

/* 10) عداد الأيام المتبقية على كل بطاقة طلب في صفحة الطلبات وخطة اليوم */
(function(){
  function tagOrderCards(container){
    if(!container) return;
    container.querySelectorAll('.card').forEach(function(card){
      if(card.dataset.orderId) return;
      var btn = card.querySelector('[onclick*="openOrderModal("]') || card.querySelector('[onclick*="markOrderDelivered("]');
      if(btn){
        var m = btn.getAttribute('onclick').match(/(?:openOrderModal|markOrderDelivered)\('([^']+)'/);
        if(m) card.dataset.orderId = m[1];
      }
    });
  }
  function addDaysBadges(container){
    if(!container) return;
    tagOrderCards(container);
    container.querySelectorAll('.card[data-order-id]').forEach(function(card){
      if(card.dataset.daysBadgeAdded) return;
      var o = db.orders.find(function(x){ return x.id===card.dataset.orderId; });
      if(!o || !o.dateDelivery || o.status==='تم التسليم') return;
      var diff = Math.round((new Date(o.dateDelivery) - new Date(todayStr()))/86400000);
      var label, color;
      if(diff<0){ label='متأخر '+Math.abs(diff)+' يوم'; color='var(--danger)'; }
      else if(diff===0){ label='التسليم النهاردة'; color='var(--warn)'; }
      else { label='باقي '+diff+' يوم'; color='var(--info)'; }
      var metaLine = Array.prototype.find.call(card.querySelectorAll('.meta'), function(m){ return m.textContent.indexOf('التسليم')!==-1; });
      if(metaLine){
        card.dataset.daysBadgeAdded='1';
        var badge=document.createElement('span');
        badge.style.cssText='display:inline-block;margin-inline-start:8px;font-size:11.5px;font-weight:800;color:'+color+';';
        badge.textContent='⏳ '+label;
        metaLine.appendChild(badge);
      }
    });
  }
  new MutationObserver(function(){
    addDaysBadges(document.getElementById('ordersList'));
    addDaysBadges(document.getElementById('todayPlan'));
  }).observe(document.getElementById('app'), {childList:true, subtree:true});
})();

/* 11) وضع التباين العالي — زر جنب زر الوضع الليلي */
(function(){
  if(document.getElementById('contrastToggleBtn')) return; // امنع التكرار لو الكود اشتغل أكتر من مرة
  var themeBtn = document.getElementById('themeToggleBtn');
  if(!themeBtn) return;
  var btn = document.createElement('button');
  btn.className='theme-toggle-btn'; btn.id='contrastToggleBtn';
  btn.setAttribute('aria-label','تباين عالٍ'); btn.textContent='◐';
  btn.onclick = function(){
    document.documentElement.classList.toggle('high-contrast');
    localStorage.setItem('highContrast', document.documentElement.classList.contains('high-contrast') ? '1':'0');
  };
  themeBtn.insertAdjacentElement('afterend', btn);
  if(localStorage.getItem('highContrast')==='1') document.documentElement.classList.add('high-contrast');
})();

/* 12) سحب بطاقة الطلب: يمين = يكشف زر "تم التسليم"، يسار = فتح التعديل
   [تم الإصلاح] كان السحب بينفّذ "تم التسليم" فورًا بمجرد رفع الإصبع،
   وده كان بيتفعّل غلط أثناء تمرير عادي (سكرول) لو الإصبع اتحرك بزاوية
   بسيطة. دلوقتي السحب لليمين بيكشف زر واضح تحت الكارت، والتنفيذ الفعلي
   بيحصل بس لو المستخدم ضغط الزر عمدًا (مع نافذة تأكيد كمان). */
(function(){
  var startX=0, startY=0, activeCard=null, openCard=null, dragging=false;

  function closeOpenCard(){
    if(openCard){
      openCard.style.transform='';
      var reveal = openCard.__revealEl;
      if(reveal) reveal.remove();
      openCard.__revealEl = null;
    }
    openCard = null;
  }

  function resetCard(){
    if(activeCard && activeCard!==openCard){
      activeCard.style.transform='';
      activeCard.style.opacity='';
    }
    activeCard=null;
    dragging=false;
  }

  function ensureCardId(card){
    if(card.dataset.orderId) return;
    var btn = card.querySelector('[onclick*="openOrderModal("]');
    if(btn){
      var m = btn.getAttribute('onclick').match(/openOrderModal\('([^']+)'/);
      if(m) card.dataset.orderId = m[1];
    }
  }

  // زر التسليم اللي بيتكشف تحت الكارت وقت السحب لليمين
  function revealDeliverButton(card, id){
    var wrap = card.parentElement;
    if(!wrap) return null;
    if(getComputedStyle(wrap).position==='static') wrap.style.position='relative';
    var el = document.createElement('div');
    el.className='swipe-reveal-deliver';
    el.style.cssText = 'position:absolute;border-radius:inherit;background:var(--ok,#1F6D57);color:#fff;display:flex;align-items:center;padding-inline-start:18px;font-weight:800;font-size:14px;z-index:0;box-sizing:border-box;';
    el.style.top = card.offsetTop+'px';
    el.style.left = card.offsetLeft+'px';
    el.style.width = card.offsetWidth+'px';
    el.style.height = card.offsetHeight+'px';
    el.textContent = '✅ اضغط لتسجيل تم التسليم';
    el.addEventListener('click', function(){
      var o = db.orders.find(function(x){ return x.id===id; });
      var custName = o ? ((customerById(o.customerId)||{}).name||'') : '';
      appConfirm('هل تريد تسجيل طلب' + (custName?(' "'+custName+'"'):'') + ' كـ"تم التسليم"؟', {okText:'تم التسليم', cancelText:'إلغاء', danger:false}).then(function(ok){
        closeOpenCard();
        if(ok){
          if(navigator.vibrate) navigator.vibrate(30);
          markOrderDelivered(id);
        }
      });
    });
    wrap.insertBefore(el, card);
    card.style.position='relative'; card.style.zIndex='1';
    if(!card.style.background) card.style.background = 'var(--card)';
    return el;
  }

  document.addEventListener('touchstart', function(e){
    if(e.target.closest('.swipe-reveal-deliver')) return; // سيب الزر المكشوف يستقبل الضغطة من غير ما نقفله تحته
    var card = e.target.closest('#ordersList .card');
    if(!card){
      // لمسة برّه أي كارت مفتوح تقفله
      if(openCard) closeOpenCard();
      return;
    }
    if(openCard && openCard!==card){ closeOpenCard(); }
    ensureCardId(card);
    activeCard = card;
    dragging=false;
    startX = e.touches[0].clientX; startY = e.touches[0].clientY;
  }, {passive:true});

  document.addEventListener('touchmove', function(e){
    if(!activeCard) return;
    var dx = e.touches[0].clientX-startX, dy = e.touches[0].clientY-startY;
    if(Math.abs(dx)>Math.abs(dy) && Math.abs(dx)>8){
      dragging = true;
      var clamped = Math.max(-90, Math.min(90, dx));
      activeCard.style.transform='translateX('+clamped+'px)';
      activeCard.style.opacity = Math.max(0.6, 1-Math.abs(clamped)/250);
    }
  }, {passive:true});

  document.addEventListener('touchend', function(e){
    if(!activeCard){ return; }
    if(!dragging){ activeCard=null; return; }
    var dx = e.changedTouches[0].clientX-startX;
    var dy = e.changedTouches[0].clientY-startY;
    var id = activeCard.dataset.orderId;
    var card = activeCard;
    var opened = false;
    if(Math.abs(dx)>60 && Math.abs(dx)>Math.abs(dy)*1.5 && id){
      var o = db.orders.find(function(x){ return x.id===id; });
      if(dx>0 && o && o.status!=='تم التسليم'){
        // اكشف الزر واستقر الكارت في وضع مفتوح، من غير أي تنفيذ فوري
        card.style.transform='translateX(70px)';
        card.__revealEl = revealDeliverButton(card, id);
        openCard = card;
        opened = true;
      } else if(dx<0){
        if(navigator.vibrate) navigator.vibrate(20);
        openOrderModal(id);
      }
    }
    if(!opened){ card.style.transform=''; card.style.opacity=''; }
    activeCard = null;
    dragging = false;
  });

  document.addEventListener('touchcancel', function(){
    resetCard();
  });
})();

/* 13) أفضل أيام الأسبوع من ناحية التحصيل في صفحة المالية */
(function(){
  var origRFDays = renderFinance;
  renderFinance = function(){
    origRFDays.apply(this, arguments);
    try{
      var dayNames = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
      var totals = [0,0,0,0,0,0,0];
      db.payments.forEach(function(p){
        var d = new Date(p.date);
        if(isNaN(d.getTime())) return;
        totals[d.getDay()] += Number(p.amount)||0;
      });
      var maxIdx = 0;
      for(var i=1;i<7;i++) if(totals[i]>totals[maxIdx]) maxIdx=i;
      var hasData = totals.some(function(t){ return t>0; });
      var rows = dayNames.map(function(name,i){
        var pct = totals[maxIdx]>0 ? Math.round(totals[i]/totals[maxIdx]*100) : 0;
        return '<div class="row" style="padding:4px 0;">'
          +'<span>'+name+'</span>'
          +'<div style="flex:1;margin:0 10px;background:var(--border);border-radius:6px;height:8px;overflow:hidden;">'
          +'<div style="width:'+pct+'%;height:100%;background:'+(i===maxIdx?'var(--accent)':'var(--primary)')+';"></div></div>'
          +'<b style="font-size:12px;">'+totals[i].toLocaleString('ar-EG')+'</b>'
          +'</div>';
      }).join('');
      var box = document.getElementById('bestDayBox');
      if(!box){
        box = document.createElement('div');
        box.id='bestDayBox';
        var anchor = document.getElementById('advancedAnalytics');
        anchor.parentElement.insertBefore(box, anchor.nextSibling);
      }
      box.innerHTML = '<div class="section-title">📆 أفضل أيام الأسبوع (حسب التحصيل)</div>'
        + '<div class="card">' + (hasData
            ? rows + '<p class="meta" style="margin-top:8px;">🏆 يوم '+dayNames[maxIdx]+' هو الأعلى تحصيلاً — فكّر تزود الطاقة أو تركّز المتابعة حواليه</p>'
            : '<div class="empty-msg">لسه مفيش بيانات كفاية</div>') + '</div>';
    }catch(e){}
  };
})();

/* 14) تنبيه المناسبات الموسمية القادمة */
setTimeout(function(){
  try{
    var today = todayStr();
    var alertWindow = 21; // يبدأ التنبيه قبل المناسبة بكام يوم
    (db.holidays||[]).forEach(function(h){
      if(!h.date) return;
      var diff = Math.round((new Date(h.date) - new Date(today))/86400000);
      if(diff>=0 && diff<=alertWindow){
        var key = 'seasonalAlertShown_'+h.id;
        var lastDiff = localStorage.getItem(key);
        var shouldShow = !lastDiff || (Number(lastDiff)-diff)>=7 || diff===0;
        if(shouldShow){
          toast('📆 باقي '+diff+' يوم على "'+h.name+'" — فكّر تجهز الطاقة الاستيعابية وتبلغ عملائك بمواعيد التسليم بدري');
          localStorage.setItem(key, diff);
        }
      }
    });
  }catch(e){}
}, 1300);

/* 15) عرض قياسات العميل المحفوظة كمرجع سريع عند فتح طلب جديد */
(function(){
  function measurementsHtml(c){
    if(!c) return '';
    var rows = [
      ['📏 الطول', c.length],
      ['📏 الصدر', c.chest],
      ['📏 الخزنة', c.waist],
      ['📏 طول الكم', c.sleeve],
      ['📏 وسع الكم', c.shoulder]
    ].filter(function(r){ return r[1]!==undefined && r[1]!==null && r[1]!==''; });
    if(rows.length===0 && !c.notes) return '';
    var rowsHtml = rows.map(function(r){
      return '<div class="row" style="padding:3px 0;"><span class="meta">'+r[0]+'</span><b>'+escapeHtml(String(r[1]))+' سم</b></div>';
    }).join('');
    var notesHtml = c.notes ? '<div class="meta" style="margin-top:6px;">📝 '+escapeHtml(c.notes)+'</div>' : '';
    return '<div class="card" id="customerMeasureBox" style="margin:-6px 0 14px;padding:10px 12px;background:var(--card-alt);">'
      + '<div class="section-title" style="font-size:13px;margin-bottom:4px;">📏 قياسات العميل المحفوظة</div>'
      + rowsHtml + notesHtml
      + '</div>';
  }

  function renderBox(){
    try{
      var sel = document.getElementById('f_customer');
      if(!sel) return;
      var old = document.getElementById('customerMeasureBox');
      if(old) old.remove();
      var c = sel.value ? customerById(sel.value) : null;
      var html = measurementsHtml(c);
      if(html){
        sel.closest('.field').insertAdjacentHTML('afterend', html);
      }
    }catch(e){}
  }

  var origOpenOrderModal = openOrderModal;
  openOrderModal = function(id, presetCustomerId){
    var r = origOpenOrderModal.apply(this, arguments);
    setTimeout(function(){
      renderBox();
      var sel = document.getElementById('f_customer');
      if(sel && !sel.dataset.measureBound){
        sel.dataset.measureBound='1';
        sel.addEventListener('change', renderBox);
      }
    }, 30);
    return r;
  };
})();

/* 16) وضع "يوم الجرد" — تقرير شامل يجمع المتأخرات والمستحقات في شاشة واحدة */
(function(){
  function buildAuditReport(){
    var today = todayStr();
    var active = db.orders.filter(function(o){ return o.status!=='تم التسليم'; });
    var overdue = active.filter(isOverdue);
    var dueToday = active.filter(function(o){ return o.dateDelivery===today; });
    var totalOutstanding = active.reduce(function(s,o){ return s+orderRemaining(o); }, 0);
    var debtors = (typeof debtorCustomers==='function') ? debtorCustomers() : [];

    var overdueRows = overdue.slice(0,10).map(function(o){
      var c = customerById(o.customerId);
      return '<div class="row" style="padding:5px 0;border-bottom:1px solid var(--border);"><span>'+(c?escapeHtml(c.name):'عميل محذوف')+' - '+escapeHtml(orderTypeLabel(o))+'</span></div>';
    }).join('') || '<div class="empty-msg">لا يوجد طلبات متأخرة 🎉</div>';

    var debtorRows = debtors.slice(0,10).map(function(d){
      return '<div class="row" style="padding:5px 0;border-bottom:1px solid var(--border);"><span>'+escapeHtml(d.customer.name)+'</span><b style="color:var(--danger);">'+d.amount.toLocaleString('ar-EG')+' ج.م</b></div>';
    }).join('') || '<div class="empty-msg">لا يوجد عملاء متجاوزين حد المديونية</div>';

    return '<div class="modal-head"><h3>🗓️ يوم الجرد</h3><button class="modal-close" onclick="closeModal()">✕</button></div>'
      + '<div class="card" style="padding:10px 12px;margin-bottom:10px;background:var(--card-alt);">'
        + '<div class="row"><span class="meta">طلبات متأخرة</span><b style="color:var(--danger);">'+overdue.length+'</b></div>'
        + '<div class="row"><span class="meta">طلبات مستحقة اليوم</span><b style="color:var(--warn);">'+dueToday.length+'</b></div>'
        + '<div class="row"><span class="meta">إجمالي المستحقات (كل الطلبات الجارية)</span><b>'+totalOutstanding.toLocaleString('ar-EG')+' ج.م</b></div>'
      + '</div>'
      + '<div class="section-title">⏰ الطلبات المتأخرة</div>'
      + '<div style="margin-bottom:14px;">'+overdueRows+(overdue.length>10?'<p class="meta" style="margin-top:6px;">+ '+(overdue.length-10)+' طلب تاني</p>':'')+'</div>'
      + '<div class="section-title">🧾 عملاء متجاوزين حد المديونية</div>'
      + '<div>'+debtorRows+(debtors.length>10?'<p class="meta" style="margin-top:6px;">+ '+(debtors.length-10)+' عميل تاني</p>':'')+'</div>';
  }

  window.openAuditDayMode = function(){
    try{ openModal(buildAuditReport()); }catch(e){ toast('تعذر فتح يوم الجرد'); }
  };

  var nav = document.getElementById('sideNav');
  if(nav && !document.getElementById('navAuditDay')){
    var btn = document.createElement('button');
    btn.className='navbtn'; btn.id='navAuditDay';
    btn.innerHTML = '<span class="ic">🗓️</span>يوم الجرد';
    btn.onclick = function(){ closeSideNav(); openAuditDayMode(); };
    var settingsBtn = nav.querySelector('.navbtn[data-page="settings"]');
    if(settingsBtn) settingsBtn.insertAdjacentElement('beforebegin', btn);
    else nav.appendChild(btn);
  }
})();

/* 17) اختصار صوتي بسيط لملء حقل الملاحظات بالصوت (لو المتصفح بيدعم التعرف على الصوت) */
(function(){
  function attachMic(textareaId){
    var ta = document.getElementById(textareaId);
    if(!ta || ta.dataset.micAdded) return;
    ta.dataset.micAdded='1';
    var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    var btn = document.createElement('button');
    btn.type='button'; btn.className='btn sm secondary'; btn.style.marginTop='6px';
    btn.textContent='🎤 إدخال بالصوت';
    if(!Recognition){
      btn.disabled = true;
      btn.title = 'التعرف على الصوت مش مدعوم في هذا المتصفح';
      btn.style.opacity='0.5';
    } else {
      btn.onclick = function(){
        try{
          var rec = new Recognition();
          rec.lang = 'ar-EG';
          rec.interimResults = false;
          btn.textContent = '🎙️ ...جارِ الاستماع';
          btn.disabled = true;
          rec.onresult = function(e){
            var text = e.results[0][0].transcript;
            ta.value = (ta.value ? ta.value.trim()+' ' : '') + text;
            toast('✅ تم إضافة النص بالصوت');
          };
          rec.onerror = function(){ toast('⚠️ تعذر التعرف على الصوت'); };
          rec.onend = function(){ btn.textContent='🎤 إدخال بالصوت'; btn.disabled=false; };
          rec.start();
        }catch(e){ toast('⚠️ خاصية الصوت مش متاحة'); btn.disabled=false; btn.textContent='🎤 إدخال بالصوت'; }
      };
    }
    ta.insertAdjacentElement('afterend', btn);
  }

  var origOpenCustomerModal = openCustomerModal;
  openCustomerModal = function(id){
    var r = origOpenCustomerModal.apply(this, arguments);
    setTimeout(function(){ attachMic('f_notes'); }, 30);
    return r;
  };
})();

/* 18) هدف شهري للإيرادات مع شريط تقدم في صفحة المالية — مربوط باحتياجك
   الشخصي الشهري (المحسوب تلقائيًا من صفحة الالتزامات) عشان متحطش هدف
   إيرادات أقل من اللي محتاجه فعليًا من غير ما تاخد بالك */
(function(){
  function monthRevenue(){
    var prefix = todayStr().slice(0,7);
    return db.payments.filter(function(p){ return p.date && p.date.slice(0,7)===prefix; })
      .reduce(function(s,p){ return s+(Number(p.amount)||0); }, 0);
  }

  // نفس الرقم اللي بيظهر في "📊 كسبت X من Y المطلوبين الشهر ده" بصفحة
  // الالتزامات الشخصية — بنجيبه هنا عشان نقارنه بالهدف اللي صاحب الورشة حدده بنفسه
  function requiredPersonalMonthly(){
    try{
      var prog = monthlyCommitmentProgress();
      return prog ? prog.requiredMonthly : 0;
    }catch(e){ return 0; }
  }

  window.saveMonthlyGoal = function(){
    var val = Number(document.getElementById('f_monthlyGoal').value)||0;
    db.monthlyRevenueGoal = val;
    saveDB();
    closeModal();
    toast('✅ تم حفظ الهدف الشهري');
    renderFinance();
  };

  window.useRequiredAsGoal = function(){
    var required = requiredPersonalMonthly();
    var input = document.getElementById('f_monthlyGoal');
    if(required>0 && input) input.value = Math.ceil(required);
  };

  window.editMonthlyGoalModal = function(){
    var required = requiredPersonalMonthly();
    openModal(
      '<div class="modal-head"><h3>🎯 تحديد الهدف الشهري</h3><button class="modal-close" onclick="closeModal()">✕</button></div>'
      + '<div class="field"><label>الهدف الشهري (ج.م)</label><input id="f_monthlyGoal" type="number" value="'+(db.monthlyRevenueGoal||0)+'"></div>'
      + (required>0
          ? '<div class="meta" style="margin-bottom:10px;">💡 احتياجك الشخصي الشهري (من التزاماتك المسجلة) هو <b>'+Math.round(required).toLocaleString('ar-EG')+' ج.م</b>. <span style="text-decoration:underline;cursor:pointer;" onclick="useRequiredAsGoal()">استخدمه كهدف</span></div>'
          : '')
      + '<button class="btn" onclick="saveMonthlyGoal()">💾 حفظ</button>'
    );
  };

  var origRFGoal = renderFinance;
  renderFinance = function(){
    origRFGoal.apply(this, arguments);
    try{
      var goal = Number(db.monthlyRevenueGoal)||0;
      var revenue = monthRevenue();
      var pct = goal>0 ? Math.min(100, Math.round(revenue/goal*100)) : 0;
      var required = requiredPersonalMonthly();
      var box = document.getElementById('monthlyGoalBox');
      if(!box){
        box = document.createElement('div');
        box.id='monthlyGoalBox';
        var anchor = document.getElementById('expectedCashflowBox') || document.getElementById('financeStats');
        anchor.insertAdjacentElement('afterend', box);
      }
      var warnLine = (goal>0 && required>0 && goal<required)
        ? '<div class="alert-banner warn" style="margin-top:10px;"><span class="ic">⚠️</span><div><b>الهدف اللي حددته أقل من احتياجك الشخصي الشهري</b>احتياجك الفعلي (من التزاماتك) '+Math.round(required).toLocaleString('ar-EG')+' ج.م — يعني حتى لو حققت الهدف بالكامل هتفضل ناقص '+Math.round(required-goal).toLocaleString('ar-EG')+' ج.م لتغطية التزاماتك.</div></div>'
        : '';
      box.innerHTML = '<div class="section-title">🎯 الهدف الشهري للإيرادات</div>'
        + '<div class="card" style="padding:10px 12px;">'
        + (goal>0
          ? '<div class="row"><span class="meta">المحصّل هذا الشهر</span><b>'+revenue.toLocaleString('ar-EG')+' / '+goal.toLocaleString('ar-EG')+' ج.م</b></div>'
            + '<div style="background:var(--border);border-radius:6px;height:10px;overflow:hidden;margin-top:8px;">'
            + '<div style="width:'+pct+'%;height:100%;background:var(--accent);"></div></div>'
            + '<div class="meta" style="margin-top:6px;">'+pct+'% من الهدف</div>'
          : '<div class="empty-msg">لسه معملتش هدف شهري'+(required>0?' — احتياجك الشخصي الشهري (من التزاماتك) '+Math.round(required).toLocaleString('ar-EG')+' ج.م':'')+'</div>')
        + '<button class="btn sm secondary" style="margin-top:10px;" onclick="editMonthlyGoalModal()">'+(goal>0?'✏️ تعديل الهدف':'🎯 تحديد الهدف')+'</button>'
        + '</div>'
        + warnLine;
    }catch(e){}
  };
})();

/* 19) قراءة خطة اليوم بصوت عالٍ (Text-to-Speech) */
(function(){
  var speaking = false;

  function updateBtn(btn){
    btn.textContent = speaking ? '⏹️ إيقاف القراءة' : '🔊 اقرأ خطة اليوم بصوت عالٍ';
  }

  function buildPlanSpeech(){
    var q = computeTodayQueue();
    var queue = q.queue||[], mustFinish = q.mustFinish||[];
    if(queue.length===0) return 'مفيش طلبات مستعجلة النهاردة';
    var parts = ['عندك '+queue.length+' طلب في الدور، منهم '+mustFinish.length+' لازم يخلص النهاردة.'];
    queue.slice(0,8).forEach(function(o,i){
      var c = customerById(o.customerId);
      parts.push('رقم '+(i+1)+': '+(c?c.name:'عميل محذوف')+'، '+orderTypeLabel(o));
    });
    if(queue.length>8) parts.push('وباقي '+(queue.length-8)+' طلب تاني في الدور');
    return parts.join('. ');
  }

  function speakPlan(btn){
    if(!('speechSynthesis' in window)){ toast('⚠️ المتصفح ده مش بيدعم القراءة الصوتية'); return; }
    if(speaking){
      window.speechSynthesis.cancel();
      speaking = false; updateBtn(btn);
      return;
    }
    try{
      var text = buildPlanSpeech();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'ar-SA'; u.rate = 0.95;
      u.onend = function(){ speaking=false; updateBtn(btn); };
      u.onerror = function(){ speaking=false; updateBtn(btn); };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      speaking = true; updateBtn(btn);
    }catch(e){ toast('⚠️ تعذرت القراءة الصوتية'); }
  }

  var origRTP = renderTodayPlan;
  renderTodayPlan = function(){
    origRTP.apply(this, arguments);
    try{
      var box = document.getElementById('todayPlan');
      if(!box || isDayOff(new Date())) return;
      speaking = false;
      var btn = document.createElement('button');
      btn.id='speakPlanBtn'; btn.className='btn sm secondary';
      btn.style.cssText='margin-bottom:10px;display:block;width:100%;';
      updateBtn(btn);
      btn.onclick = function(){ speakPlan(btn); };
      box.insertAdjacentElement('afterbegin', btn);
    }catch(e){}
  };
})();

/* 20) كشف حساب لعميل معين (طباعة + مشاركة واتساب) */
(function(){
  function statementRows(orders){
    return orders.map(function(o){
      return '- '+fmtDate(o.dateReceived)+' | '+orderTypeLabel(o)+' | الإجمالي: '+orderTotal(o).toLocaleString('ar-EG')+' | مدفوع: '+(Number(o.paid)||0).toLocaleString('ar-EG')+' | متبقي: '+orderRemaining(o).toLocaleString('ar-EG')+' ج.م';
    }).join('\n');
  }

  window.printCustomerStatement = function(id){
    var c = customerById(id);
    if(!c) return;
    var orders = db.orders.filter(function(o){ return o.customerId===id; }).sort(function(a,b){ return (a.dateReceived||'').localeCompare(b.dateReceived||''); });
    var totalPaid = orders.reduce(function(s,o){ return s+(Number(o.paid)||0); }, 0);
    var totalRemaining = orders.reduce(function(s,o){ return s+orderRemaining(o); }, 0);
    var rowsHtml = orders.length ? orders.map(function(o){
      return '<tr><td>'+fmtDate(o.dateReceived)+'</td><td>'+escapeHtml(orderTypeLabel(o))+'</td><td>'+orderTotal(o).toLocaleString('ar-EG')+'</td><td>'+(Number(o.paid)||0).toLocaleString('ar-EG')+'</td><td>'+orderRemaining(o).toLocaleString('ar-EG')+'</td></tr>';
    }).join('') : '<tr><td colspan="5" style="text-align:center;color:#888;">لا توجد طلبات</td></tr>';
    var html =
      '<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>كشف حساب - '+escapeHtml(c.name)+'</title>'
      + '<style>'
      + 'body{font-family:Tahoma,Arial,sans-serif;padding:24px;color:#222;}'
      + 'h1{font-size:19px;border-bottom:2px solid #1F6D57;padding-bottom:8px;}'
      + 'table{width:100%;border-collapse:collapse;margin-top:14px;font-size:13px;}'
      + 'th,td{padding:8px 6px;border-bottom:1px solid #ddd;text-align:center;}'
      + 'th{background:#f5f3ef;}'
      + '.totals{margin-top:16px;display:flex;gap:14px;justify-content:flex-end;font-size:14px;}'
      + '.totals b{color:#1F6D57;}'
      + '</style></head><body>'
      + printBrandHeaderHtml()
      + '<h1>🧾 كشف حساب - '+escapeHtml(c.name)+'</h1>'
      + '<p style="font-size:13px;color:#666;">📞 '+escapeHtml(c.phone||'-')+' — تاريخ الكشف: '+fmtDate(todayStr())+'</p>'
      + '<table><tr><th>تاريخ الاستلام</th><th>الصنف</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th></tr>'+rowsHtml+'</table>'
      + '<div class="totals"><div>إجمالي المدفوع: <b>'+totalPaid.toLocaleString('ar-EG')+' ج.م</b></div><div>إجمالي المتبقي: <b>'+totalRemaining.toLocaleString('ar-EG')+' ج.م</b></div></div>'
      + '</body></html>';
    openPrintWindow(html, 'كشف_حساب_'+c.name);
  };

  window.shareCustomerStatement = function(id){
    var c = customerById(id);
    if(!c) return;
    var orders = db.orders.filter(function(o){ return o.customerId===id; }).sort(function(a,b){ return (a.dateReceived||'').localeCompare(b.dateReceived||''); });
    var totalPaid = orders.reduce(function(s,o){ return s+(Number(o.paid)||0); }, 0);
    var totalRemaining = orders.reduce(function(s,o){ return s+orderRemaining(o); }, 0);
    var msg = '🧾 كشف حساب - '+c.name+'\n'+(db.workshopName||'ورشة تفصيل الجلابيب')+'\nتاريخ: '+fmtDate(todayStr())+'\n\n'+statementRows(orders)+'\n\nإجمالي المدفوع: '+totalPaid.toLocaleString('ar-EG')+' ج.م\nإجمالي المتبقي: '+totalRemaining.toLocaleString('ar-EG')+' ج.م';
    if(navigator.share){ navigator.share({title:'كشف حساب '+c.name, text:msg}).catch(function(){}); return; }
    var phone = (c.phone||'').replace(/[^0-9]/g,'');
    if(phone){ if(phone.indexOf('0')===0) phone='2'+phone; openExternalLink('https://wa.me/'+phone+'?text='+encodeURIComponent(msg)); }
    else openExternalLink('https://wa.me/?text='+encodeURIComponent(msg));
  };

  var origOCH = openCustomerHistory;
  openCustomerHistory = function(id){
    var r = origOCH.apply(this, arguments);
    setTimeout(function(){
      try{
        var box = document.getElementById('modalBox');
        var gridCards = box.querySelector('.grid-cards');
        if(!gridCards) return;
        var existingRow = document.getElementById('statementBtnRow');
        if(existingRow) existingRow.remove();
        var row = document.createElement('div');
        row.id='statementBtnRow'; row.className='btn-row'; row.style.margin='10px 0 4px';
        row.innerHTML =
          '<button class="btn sm secondary" onclick="printCustomerStatement(\''+id+'\')">🖨️ طباعة كشف حساب</button>'
          + '<button class="btn sm accent" onclick="shareCustomerStatement(\''+id+'\')">📲 مشاركة واتساب</button>';
        gridCards.insertAdjacentElement('afterend', row);
      }catch(e){}
    }, 30);
    return r;
  };
})();

/* 21) متوسط وقت التفصيل الفعلي لكل نوع (يعتمد على أزرار بدء/إيقاف التوقيت المسجّلة على الطلبات) */
(function(){
  function computeAvgWorkTimes(){
    var stats = {};
    db.orders.forEach(function(o){
      if(!o.actualMinutes || o.actualMinutes<=0) return;
      var entries = [];
      if(Array.isArray(o.items) && o.items.length===1){
        entries = [{type:o.items[0].type, qty:o.items[0].qty||1}];
      } else if(!Array.isArray(o.items) && o.type){
        entries = [{type:o.type, qty:o.qty||1}];
      }
      entries.forEach(function(e){
        var perPiece = o.actualMinutes/Math.max(1, e.qty);
        if(!stats[e.type]) stats[e.type] = {total:0, count:0};
        stats[e.type].total += perPiece;
        stats[e.type].count += 1;
      });
    });
    return Object.keys(stats).map(function(type){
      return {type:type, avg:Math.round(stats[type].total/stats[type].count), count:stats[type].count};
    }).sort(function(a,b){ return b.count-a.count; });
  }

  var origRF = renderFinance;
  renderFinance = function(){
    origRF.apply(this, arguments);
    try{
      var rows = computeAvgWorkTimes();
      var box = document.getElementById('avgWorkTimeBox');
      if(!box){
        box = document.createElement('div');
        box.id='avgWorkTimeBox';
        var anchor = document.getElementById('bestDayBox') || document.getElementById('expectedCashflowBox') || document.getElementById('financeStats');
        anchor.insertAdjacentElement('afterend', box);
      }
      var rowsHtml = rows.length ? rows.map(function(r){
        return '<div class="row" style="padding:5px 0;border-bottom:1px solid var(--border);"><span>'+escapeHtml(r.type)+'</span><b>'+formatMinutesLabel(r.avg)+' <span class="meta" style="font-size:11px;">('+r.count+' قطعة)</span></b></div>';
      }).join('') : '<div class="empty-msg">لسه مفيش وقت شغل مسجّل كفاية — استخدم زر "بدء/إيقاف التوقيت" على الطلبات عشان تتجمع بيانات كافية</div>';
      box.innerHTML = '<div class="section-title">⏱️ متوسط وقت التفصيل الفعلي لكل نوع</div><div class="card">'+rowsHtml+'</div>';
    }catch(e){}
  };
})();

/* 22) كشف تكرار أرقام الهواتف بين أكتر من عميل */
(function(){
  function findDuplicatePhones(){
    var groups = {};
    db.customers.forEach(function(c){
      var digits = (c.phone||'').replace(/[^0-9]/g,'');
      if(digits.length<8) return;
      if(!groups[digits]) groups[digits]=[];
      groups[digits].push(c);
    });
    return Object.keys(groups).map(function(k){ return groups[k]; }).filter(function(g){ return g.length>1; });
  }

  var origRC = renderCustomers;
  renderCustomers = function(){
    origRC.apply(this, arguments);
    try{
      var list = document.getElementById('customersList');
      var old = document.getElementById('dupPhoneAlert');
      if(old) old.remove();
      var dups = findDuplicatePhones();
      if(dups.length===0) return;
      var names = dups.map(function(g){ return g.map(function(c){ return c.name; }).join(' / '); }).join('، ');
      var box = document.createElement('div');
      box.id='dupPhoneAlert';
      box.className='alert-banner warn';
      box.style.marginBottom='10px';
      box.innerHTML = '<span class="ic">⚠️</span><div><b>فيه '+dups.length+' رقم هاتف مكرر بين أكتر من عميل</b>'+escapeHtml(names)+' — راجعهم علشان مايتلخبطش حساب الولاء وحد المديونية.</div>';
      list.insertAdjacentElement('beforebegin', box);
    }catch(e){}
  };
})();

/* 24) تصنيف المصروفات بفئات */
(function(){
  var DEFAULT_CATS = ['خامات وأقمشة','إيجار','فواتير','صيانة وأدوات','مواصلات','رواتب وعمالة','أخرى'];
  function expenseCats(){
    return (db.expenseCategories && db.expenseCategories.length) ? db.expenseCategories : DEFAULT_CATS;
  }
  var expenseCatFilter = 'all';

  openExpenseModal = function(){
    var cats = expenseCats();
    var html =
      '<div class="modal-head"><h3>➕ مصروف جديد</h3><button class="modal-close" onclick="closeModal()">✕</button></div>'
      + '<div class="field"><label>وصف المصروف</label><input id="f_expDesc" placeholder="مثال: خيوط، أزرار، سوست..."></div>'
      + '<div class="field"><label>الفئة</label><select id="f_expCat">'+cats.map(function(c){ return '<option value="'+escapeHtml(c)+'">'+escapeHtml(c)+'</option>'; }).join('')+'</select></div>'
      + '<div class="field"><label>المبلغ (ج.م)</label><input id="f_expAmount" type="number" placeholder="0"></div>'
      + '<div class="field"><label>التاريخ</label><input id="f_expDate" type="date" value="'+todayStr()+'"></div>'
      + '<button class="btn" onclick="saveExpense()">💾 حفظ</button>';
    openModal(html);
  };

  saveExpense = function(){
    var desc = document.getElementById('f_expDesc').value.trim();
    var catEl = document.getElementById('f_expCat');
    var cat = catEl ? catEl.value : 'أخرى';
    var amount = Number(document.getElementById('f_expAmount').value)||0;
    var date = document.getElementById('f_expDate').value || todayStr();
    if(!desc){ toast('أدخل وصف المصروف'); return; }
    if(amount<=0){ toast('أدخل مبلغاً صحيحاً'); return; }
    var record = {id:uid(), desc:desc, amount:amount, date:date, cat:cat};
    db.expenses.push(record);
    logActivity('🧵 مصروف جديد: '+desc+' ('+amount.toLocaleString('ar-EG')+' ج.م)');
    setUndo('إضافة المصروف', function(){
      db.expenses = db.expenses.filter(function(e){ return e.id!==record.id; });
      saveDB();
      renderExpenses();
    });
    saveDB();
    closeModal();
    renderExpenses();
    toast('تم إضافة المصروف ✅');
  };

  window.setExpenseCatFilter = function(cat){
    expenseCatFilter = cat;
    renderExpenses();
  };

  renderExpenses = function(){
    var all = db.expenses;
    var filtered = expenseCatFilter==='all' ? all : all.filter(function(e){ return (e.cat||'أخرى')===expenseCatFilter; });
    var total = filtered.reduce(function(s,e){ return s+Number(e.amount||0); }, 0);
    document.getElementById('totalExpensesTxt').textContent = total.toLocaleString('ar-EG')+' ج.م';

    var cats = expenseCats();
    var catTotals = {};
    all.forEach(function(e){ var c=e.cat||'أخرى'; catTotals[c]=(catTotals[c]||0)+Number(e.amount||0); });

    var chipsHtml = '<span class="rc-chip" style="'+(expenseCatFilter==='all'?'background:var(--accent);color:#fff;':'')+'" onclick="setExpenseCatFilter(\'all\')">الكل</span>'
      + cats.filter(function(c){ return catTotals[c]; }).map(function(c){
          return '<span class="rc-chip" style="'+(expenseCatFilter===c?'background:var(--accent);color:#fff;':'')+'" onclick="setExpenseCatFilter(\''+c.replace(/'/g,"\\'")+'\')">'+escapeHtml(c)+' ('+catTotals[c].toLocaleString('ar-EG')+')</span>';
        }).join('');

    var chipsBox = document.getElementById('expenseCatChips');
    if(!chipsBox){
      chipsBox = document.createElement('div');
      chipsBox.id='expenseCatChips';
      chipsBox.style.cssText='display:flex;gap:8px;overflow-x:auto;padding-bottom:8px;margin-bottom:10px;';
      var addBtn = document.querySelector('#page-expenses .btn[onclick="openExpenseModal()"]');
      if(addBtn) addBtn.insertAdjacentElement('afterend', chipsBox);
    }
    chipsBox.innerHTML = chipsHtml;

    var list = filtered.slice().sort(function(a,b){ return b.date.localeCompare(a.date); });
    document.getElementById('expensesList').innerHTML = list.length ? list.map(function(e){
      return '<div class="card">'
        + '<div class="row"><h3>'+escapeHtml(e.desc)+'</h3><b style="color:var(--danger)">'+Number(e.amount).toLocaleString('ar-EG')+' ج.م</b></div>'
        + '<div class="meta">📅 '+fmtDate(e.date)+' — <span class="badge">'+escapeHtml(e.cat||'أخرى')+'</span></div>'
        + '<div class="btn-row"><button class="btn sm danger" onclick="deleteExpense(\''+e.id+'\')">🗑️ حذف</button></div>'
        + '</div>';
    }).join('') : '<div class="empty-msg">لا توجد مصروفات '+(expenseCatFilter==='all'?'مسجلة':'في هذه الفئة')+'</div>';
  };
})();

/* 25) مؤشر واضح لحالة الاتصال بالإنترنت (أوفلاين/أونلاين) + تنبيه للتغييرات المعلّقة اللي هتتزامن لاحقًا */
(function(){
  function badgeState(){
    if(!navigator.onLine) return {show:true, text:'📴 أوفلاين — شغّال عادي وهيتزامن لما يرجع النت', color:'#E0796A'};
    if(db && db.cloudSync && db.cloudSync.enabled && cloudPendingChanges){
      return {show:true, text:'⏳ في انتظار المزامنة', color:'#D9A93D'};
    }
    return {show:false};
  }
  function updateOfflineBadge(){
    var state = badgeState();
    var badge = document.getElementById('offlineBadge');
    if(state.show){
      if(!badge){
        badge = document.createElement('span');
        badge.id = 'offlineBadge';
        badge.style.cssText = 'background:rgba(255,255,255,0.18);color:#fff;border-radius:20px;padding:6px 12px;font-size:12px;font-weight:800;margin-inline-end:6px;display:inline-flex;align-items:center;gap:5px;flex-shrink:0;';
        var holder = document.querySelector('header.topbar > div:last-child');
        if(holder) holder.insertAdjacentElement('afterbegin', badge);
      }
      badge.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:'+state.color+';display:inline-block;"></span>'+state.text;
    } else if(badge){
      badge.remove();
    }
  }
  window.refreshConnectivityBadge = updateOfflineBadge;

  window.addEventListener('offline', function(){
    updateOfflineBadge();
    toast('📴 محدش نت دلوقتي — التغييرات هتتحفظ عندك على الجهاز وتتزامن تلقائي أول ما الاتصال يرجع');
  });

  window.addEventListener('online', function(){
    updateOfflineBadge();
    var syncing = (db && db.cloudSync && db.cloudSync.enabled);
    if(syncing) scheduleCloudPush(); // نحاول نبعت أي تغييرات معلّقة فورًا
    toast(syncing ? '✅ رجع النت — جاري مزامنة أي تغييرات' : '✅ رجع النت');
  });

  var origBoot = boot;
  boot = function(){
    origBoot.apply(this, arguments);
    updateOfflineBadge();
  };
})();

const origCloudStatusChanged = cloudStatusChanged;
cloudStatusChanged = function(){
  origCloudStatusChanged();
  if(typeof window.refreshConnectivityBadge==='function') window.refreshConnectivityBadge();
};


/* 26) صلاحيات بمستويات (مالك / مدير / استقبال) + رقم سري منفصل لصفحة المالية — حقول الإعدادات */
(function(){
  try{
    var cards = document.querySelectorAll('#page-settings .card');
    var anchorCard = null;
    cards.forEach(function(c){
      var h3 = c.querySelector('h3');
      if(h3 && h3.textContent.indexOf('تغيير الرقم السري')!==-1) anchorCard = c;
    });
    if(!anchorCard) return;

    var lastInserted = anchorCard;

    // --- بطاقة رقم المدير (صلاحيات كاملة ما عدا الإعدادات) ---
    if(!document.getElementById('managerPinCard')){
      var mCard = document.createElement('div');
      mCard.className='card'; mCard.id='managerPinCard';
      mCard.innerHTML =
        '<h3>🗂️ رقم سري لوضع المدير (اختياري)</h3>'
        + '<p class="meta">رقم سري تالت مختلف عن رقمك الأساسي وعن رقم الاستقبال — لو حد دخل بيه هيقدر يشتغل بكل الصفحات (الطلبات، العملاء، المواعيد، المصروفات، المالية) ما عدا صفحة الإعدادات. سيبه فاضي لإلغاء الميزة.</p>'
        + '<div class="field"><label>رقم سري المدير (4 أرقام)</label><input type="tel" maxlength="4" id="managerPinInput" inputmode="numeric" autocomplete="off" class="pin-input" oninput="this.value=this.value.replace(/\\D/g,\'\').slice(0,4)"></div>'
        + '<button class="btn" id="saveManagerPinBtn">💾 حفظ</button>';
      lastInserted.insertAdjacentElement('afterend', mCard);
      lastInserted = mCard;
      document.getElementById('saveManagerPinBtn').onclick = function(){
        var val = (document.getElementById('managerPinInput').value||'').trim();
        if(val && val.length!==4){ toast('لازم يكون 4 أرقام بالظبط، أو سيبه فاضي لإلغاء الميزة'); return; }
        if(val && val===db.password){ toast('لازم يكون مختلف عن رقمك الأساسي'); return; }
        if(val && db.receptionPassword && val===db.receptionPassword){ toast('لازم يكون مختلف عن رقم الاستقبال'); return; }
        db.managerPassword = val || null;
        saveDB();
        document.getElementById('managerPinInput').value='';
        toast(val ? '✅ تم حفظ رقم وضع المدير' : '✅ تم إلغاء وضع المدير');
      };
    } else {
      lastInserted = document.getElementById('managerPinCard');
    }

    // --- بطاقة رقم الاستقبال (صلاحيات محدودة) ---
    if(!document.getElementById('receptionPinCard')){
      var card = document.createElement('div');
      card.className='card'; card.id='receptionPinCard';
      card.innerHTML =
        '<h3>🧑‍💼 رقم سري لوضع الاستقبال (اختياري)</h3>'
        + '<p class="meta">رقم سري تاني مختلف عن رقمك الأساسي وعن رقم المدير — لو حد دخل بيه هيفتح نسخة محدودة، بدون صفحات المالية/المصروفات/الإعدادات وبدون إمكانية حذف. سيبه فاضي لإلغاء الميزة.</p>'
        + '<div class="field"><label>رقم سري الاستقبال (4 أرقام)</label><input type="tel" maxlength="4" id="receptionPinInput" inputmode="numeric" autocomplete="off" class="pin-input" oninput="this.value=this.value.replace(/\\D/g,\'\').slice(0,4)"></div>'
        + '<button class="btn" id="saveReceptionPinBtn">💾 حفظ</button>';
      lastInserted.insertAdjacentElement('afterend', card);
      lastInserted = card;
      document.getElementById('saveReceptionPinBtn').onclick = function(){
        var val = (document.getElementById('receptionPinInput').value||'').trim();
        if(val && val.length!==4){ toast('لازم يكون 4 أرقام بالظبط، أو سيبه فاضي لإلغاء الميزة'); return; }
        if(val && val===db.password){ toast('لازم يكون مختلف عن رقمك الأساسي'); return; }
        if(val && db.managerPassword && val===db.managerPassword){ toast('لازم يكون مختلف عن رقم المدير'); return; }
        db.receptionPassword = val || null;
        saveDB();
        document.getElementById('receptionPinInput').value='';
        toast(val ? '✅ تم حفظ رقم وضع الاستقبال' : '✅ تم إلغاء وضع الاستقبال');
      };
    } else {
      lastInserted = document.getElementById('receptionPinCard');
    }

    // --- بطاقة رقم صفحة المالية (منفصل تمامًا عن رقم قفل التطبيق، بيتطلب مع أي مستوى) ---
    if(!document.getElementById('financePinCard')){
      var fCard = document.createElement('div');
      fCard.className='card'; fCard.id='financePinCard';
      fCard.innerHTML =
        '<h3>💰 رقم سري منفصل لصفحة المالية (اختياري)</h3>'
        + '<p class="meta">رقم سري إضافي مختلف عن رقم قفل التطبيق العام — لازم يتكتب عشان تفتح صفحة "المالية" فقط (مش باقي الصفحات). كده تقدر تدّي حد يشتغل بالتطبيق عادي (طلبات، عملاء، مواعيد...) من غير ما يشوف أرباحك، حتى لو بيستخدم رقمك الأساسي. سيبه فاضي لإلغاء الميزة.</p>'
        + '<div class="field"><label>رقم سري المالية (4 أرقام)</label><input type="tel" maxlength="4" id="financePinInput" inputmode="numeric" autocomplete="off" class="pin-input" oninput="this.value=this.value.replace(/\\D/g,\'\').slice(0,4)"></div>'
        + '<button class="btn" id="saveFinancePinBtn">💾 حفظ</button>';
      lastInserted.insertAdjacentElement('afterend', fCard);
      document.getElementById('saveFinancePinBtn').onclick = function(){
        var val = (document.getElementById('financePinInput').value||'').trim();
        if(val && val.length!==4){ toast('لازم يكون 4 أرقام بالظبط، أو سيبه فاضي لإلغاء الميزة'); return; }
        db.financePassword = val || null;
        saveDB();
        window.financeUnlocked = false;
        if(typeof updateFinanceLockUI==='function') updateFinanceLockUI();
        document.getElementById('financePinInput').value='';
        toast(val ? '✅ تم حفظ رقم صفحة المالية' : '✅ تم إلغاء قفل صفحة المالية');
      };
    }
  }catch(e){}
})();

/* 27) تمييز الطلبات عالية القيمة والقريبة من موعد التسليم */
(function(){
  function isHighValueUrgent(o){
    if(!o || o.status==='تم التسليم' || !o.dateDelivery) return false;
    var diffDays = Math.round((new Date(o.dateDelivery) - new Date(todayStr()))/86400000);
    if(diffDays>2) return false;
    var active = db.orders.filter(function(x){ return x.status!=='تم التسليم'; });
    if(active.length<3) return false;
    var avg = active.reduce(function(s,x){ return s+orderTotal(x); }, 0)/active.length;
    return orderTotal(o) >= avg*1.5;
  }

  function tagHighValueCards(container){
    if(!container) return;
    container.querySelectorAll('.card').forEach(function(card){
      var btn = card.querySelector('[onclick*="openOrderModal("]') || card.querySelector('[onclick*="markOrderDelivered("]');
      if(!btn) return;
      var m = btn.getAttribute('onclick').match(/(?:openOrderModal|markOrderDelivered)\('([^']+)'/);
      if(!m) return;
      var o = db.orders.find(function(x){ return x.id===m[1]; });
      var badge = card.querySelector('.high-value-badge');
      if(isHighValueUrgent(o)){
        card.classList.add('high-value-alert');
        if(!badge){
          badge = document.createElement('span');
          badge.className='high-value-badge';
          badge.style.cssText='display:inline-block;margin-inline-start:8px;background:var(--accent);color:#fff;border-radius:8px;padding:2px 8px;font-size:11px;font-weight:900;';
          badge.textContent='💎 قيمة عالية وقربت';
          var row = card.querySelector('.row');
          if(row) row.appendChild(badge);
        }
      } else {
        card.classList.remove('high-value-alert');
        if(badge) badge.remove();
      }
    });
  }

  new MutationObserver(function(){
    tagHighValueCards(document.getElementById('ordersList'));
    tagHighValueCards(document.getElementById('todayPlan'));
  }).observe(document.getElementById('app'), {childList:true, subtree:true});
})();

/* تنبيه موسم الذروة القادم — مقارنة بنفس الفترة من السنة اللي فاتت + مناسبات موسمية */
(function(){
  function ordersInRange(startStr, endStr){
    return db.orders.filter(function(o){
      return o.dateReceived && o.dateReceived>=startStr && o.dateReceived<=endStr;
    });
  }

  function checkPeakSeason(){
    try{
      var today = new Date(todayStr());
      var alerts = [];

      var thisMonthStart = todayStr().slice(0,8)+'01';
      var thisMonthOrders = ordersInRange(thisMonthStart, todayStr());

      var lastYear = new Date(today); lastYear.setFullYear(lastYear.getFullYear()-1);
      var lyMonthPrefix = lastYear.toISOString().slice(0,7);
      var lyMonthOrders = db.orders.filter(function(o){
        return o.dateReceived && o.dateReceived.slice(0,7)===lyMonthPrefix;
      });

      if(lyMonthOrders.length>=5 && thisMonthOrders.length>0){
        var dayOfMonth = today.getDate();
        var lyOrdersUpToSameDay = lyMonthOrders.filter(function(o){
          return Number(o.dateReceived.slice(8,10))<=dayOfMonth;
        });
        if(lyOrdersUpToSameDay.length>0){
          var pctChange = Math.round((thisMonthOrders.length-lyOrdersUpToSameDay.length)/lyOrdersUpToSameDay.length*100);
          if(pctChange>=20){
            alerts.push('📈 الطلبات الشهر ده زادت '+pctChange+'% عن نفس الفترة السنة اللي فاتت — استعد بخامات وتنظيم مواعيد إضافي');
          }
        }
      }

      (db.holidays||[]).forEach(function(h){
        if(!h.date) return;
        var diff = Math.round((new Date(h.date) - today)/86400000);
        if(diff<0 || diff>28) return;

        var key = 'peakSeasonAlertShown_'+h.id+'_'+today.getFullYear();
        if(localStorage.getItem(key)) return;

        var hDate = new Date(h.date);
        var beforeStart = new Date(hDate); beforeStart.setDate(beforeStart.getDate()-21);
        var beforeStartStr = beforeStart.toISOString().slice(0,10);
        var beforeEndStr = h.date;

        var lyHolidayDate = new Date(hDate); lyHolidayDate.setFullYear(lyHolidayDate.getFullYear()-1);
        var lyBeforeStart = new Date(lyHolidayDate); lyBeforeStart.setDate(lyBeforeStart.getDate()-21);
        var lyOrdersBeforeHoliday = ordersInRange(lyBeforeStart.toISOString().slice(0,10), lyHolidayDate.toISOString().slice(0,10));

        var avgOrdersPerWeek = db.orders.length / 10;
        if(lyOrdersBeforeHoliday.length > avgOrdersPerWeek*2){
          alerts.push('🎉 باقي '+diff+' يوم على "'+h.name+'" — السنة اللي فاتت زادت الطلبات قبلها بشكل ملحوظ، جهّز خامات ونظّم مواعيد التسليم بدري');
          localStorage.setItem(key, '1');
        }
      });

      if(alerts.length>0){
        setTimeout(function(){
          openModal(
            '<div class="modal-head"><h3>📊 تنبيه موسم الذروة</h3><button class="modal-close" onclick="closeModal()">✕</button></div>'
            + alerts.map(function(a){ return '<div class="card" style="margin-bottom:8px;padding:10px 12px;">'+a+'</div>'; }).join('')
          );
        }, 1500);
      }
    }catch(e){}
  }

  var todayKey = 'peakSeasonCheckedDate';
  if(localStorage.getItem(todayKey)!==todayStr()){
    localStorage.setItem(todayKey, todayStr());
    setTimeout(checkPeakSeason, 1600);
  }
})();

/* وضع "عرض للعميل" — تمويه مؤقت لأرقام وأسعار العملاء التانيين */
(function(){
  var active = false;

  function toggleDisplayMode(){
    active = !active;
    document.documentElement.classList.toggle('display-mode', active);
    var btn = document.getElementById('displayModeBtn');
    if(btn) btn.classList.toggle('active-display-mode', active);
    toast(active ? '🙈 وضع العرض مفعّل — الأرقام والأسعار متخفية مؤقتًا' : '✅ تم إلغاء وضع العرض');
    maskSensitiveElements();
  }

  function maskSensitiveElements(){
    document.querySelectorAll('.meta').forEach(function(el){
      if(el.dataset.rcPhone || el.textContent.trim().indexOf('📞')===0){
        if(active){
          if(!el.dataset.origText) el.dataset.origText = el.innerHTML;
          var phoneLinks = el.querySelector('a[href^="tel:"], a[href^="https://wa.me"]');
          el.innerHTML = '📞 •••••••••'+(phoneLinks ? '' : '');
        } else if(el.dataset.origText){
          el.innerHTML = el.dataset.origText;
          delete el.dataset.origText;
        }
      }
    });
  }

  new MutationObserver(function(){
    if(active) maskSensitiveElements();
  }).observe(document.getElementById('app'), {childList:true, subtree:true});

  var themeBtn = document.getElementById('themeToggleBtn');
  if(themeBtn && !document.getElementById('displayModeBtn')){
    var btn = document.createElement('button');
    btn.className='theme-toggle-btn'; btn.id='displayModeBtn';
    btn.setAttribute('aria-label','وضع عرض للعميل'); btn.textContent='👁️';
    btn.onclick = toggleDisplayMode;
    themeBtn.insertAdjacentElement('afterend', btn);
  }
})();

/* تسليم جزئي للطلب — لما الطلب فيه أكتر من صنف/قطعة */
(function(){
  function getDeliveredQty(order){
    return order.partialDeliveries || {};
  }

  function isFullyDelivered(order){
    if(!Array.isArray(order.items)) return false;
    var delivered = getDeliveredQty(order);
    return order.items.every(function(it, idx){
      return (delivered[idx]||0) >= (it.qty||1);
    });
  }

  window.openPartialDeliveryModal = function(orderId){
    var o = db.orders.find(function(x){ return x.id===orderId; });
    if(!o || !Array.isArray(o.items) || o.items.length===0){
      toast('التسليم الجزئي متاح فقط للطلبات اللي فيها أكتر من صنف');
      return;
    }
    var delivered = getDeliveredQty(o);
    var rows = o.items.map(function(it, idx){
      var already = delivered[idx]||0;
      var total = it.qty||1;
      return '<div class="field">'
        + '<label>'+escapeHtml(orderTypeLabel({items:[it]}))+' (الإجمالي: '+total+')</label>'
        + '<input type="number" id="pd_item_'+idx+'" min="0" max="'+total+'" value="'+already+'" style="width:100%;">'
        + '</div>';
    }).join('');
    openModal(
      '<div class="modal-head"><h3>📦 تسليم جزئي</h3><button class="modal-close" onclick="closeModal()">✕</button></div>'
      + '<p class="meta">حدّد كام قطعة اتسلمت من كل صنف:</p>'
      + rows
      + '<button class="btn" onclick="savePartialDelivery(\''+orderId+'\')">💾 حفظ التسليم الجزئي</button>'
    );
  };

  window.savePartialDelivery = function(orderId){
    var o = db.orders.find(function(x){ return x.id===orderId; });
    if(!o) return;
    if(!o.partialDeliveries) o.partialDeliveries = {};
    var anyInvalid = false;
    o.items.forEach(function(it, idx){
      var input = document.getElementById('pd_item_'+idx);
      var val = Number(input.value)||0;
      var max = it.qty||1;
      if(val<0 || val>max){ anyInvalid = true; return; }
      o.partialDeliveries[idx] = val;
    });
    if(anyInvalid){ toast('⚠️ فيه قيمة أكبر من الكمية المطلوبة'); return; }

    logActivity('📦 تسليم جزئي لطلب '+(customerById(o.customerId)?customerById(o.customerId).name:''));
    saveDB();
    closeModal();

    if(isFullyDelivered(o)){
      toast('✅ كل القطع اتسلمت — هل تحب تعلّم الطلب "تم التسليم" بالكامل؟');
      setTimeout(function(){
        openModal(
          '<div class="modal-head"><h3>✅ اكتمل التسليم</h3><button class="modal-close" onclick="closeModal()">✕</button></div>'
          + '<p class="meta">كل قطع الطلب اتسلمت، تحب تقفل الطلب كـ"تم التسليم"؟</p>'
          + '<button class="btn" onclick="closeModal();markOrderDelivered(\''+orderId+'\')">نعم، قفّل الطلب</button>'
        );
      }, 400);
    } else {
      toast('✅ تم حفظ التسليم الجزئي');
      renderOrders();
    }
  };

  var origOpenOrderModal = openOrderModal;
  openOrderModal = function(id, presetCustomerId){
    var r = origOpenOrderModal.apply(this, arguments);
    if(id){
      setTimeout(function(){
        try{
          var o = db.orders.find(function(x){ return x.id===id; });
          if(!o || !Array.isArray(o.items) || o.items.length<2 || o.status==='تم التسليم') return;
          var box = document.getElementById('modalBox');
          var btnRow = box.querySelector('.btn-row');
          if(btnRow && !document.getElementById('partialDeliveryBtn')){
            var btn = document.createElement('button');
            btn.id='partialDeliveryBtn'; btn.className='btn sm secondary';
            btn.textContent='📦 تسليم جزئي';
            btn.onclick = function(){ openPartialDeliveryModal(id); };
            btnRow.insertAdjacentElement('afterbegin', btn);
          }
        }catch(e){}
      }, 40);
    }
    return r;
  };

  function tagPartialBadges(container){
    if(!container) return;
    container.querySelectorAll('.card').forEach(function(card){
      var btn = card.querySelector('[onclick*="openOrderModal("]');
      if(!btn) return;
      var m = btn.getAttribute('onclick').match(/openOrderModal\('([^']+)'/);
      if(!m) return;
      var o = db.orders.find(function(x){ return x.id===m[1]; });
      if(!o || !Array.isArray(o.items) || o.items.length<2) return;
      var delivered = getDeliveredQty(o);
      var totalQty = o.items.reduce(function(s,it){ return s+(it.qty||1); }, 0);
      var deliveredQty = o.items.reduce(function(s,it,idx){ return s+Math.min(delivered[idx]||0, it.qty||1); }, 0);
      var existingBadge = card.querySelector('.partial-delivery-badge');
      if(deliveredQty>0 && deliveredQty<totalQty && o.status!=='تم التسليم'){
        if(!existingBadge){
          var row = card.querySelector('.row');
          if(row){
            var badge = document.createElement('span');
            badge.className='partial-delivery-badge';
            badge.style.cssText='display:inline-block;margin-inline-start:8px;background:var(--info);color:#fff;border-radius:8px;padding:2px 8px;font-size:11px;font-weight:800;';
            badge.textContent='📦 اتسلم '+deliveredQty+'/'+totalQty;
            row.appendChild(badge);
          }
        } else {
          existingBadge.textContent='📦 اتسلم '+deliveredQty+'/'+totalQty;
        }
      } else if(existingBadge){
        existingBadge.remove();
      }
    });
  }

  new MutationObserver(function(){
    tagPartialBadges(document.getElementById('ordersList'));
    tagPartialBadges(document.getElementById('todayPlan'));
  }).observe(document.getElementById('app'), {childList:true, subtree:true});
})();

/* ربط طلبات العائلة الواحدة — يستخدم حقل "family" الموجود بالفعل في بيانات العميل */
(function(){
  function familyMembers(familyName){
    return db.customers.filter(function(c){ return c.family===familyName; });
  }

  function familyOrdersData(familyName){
    var members = familyMembers(familyName);
    var rows = [];
    members.forEach(function(m){
      db.orders.filter(function(o){ return o.customerId===m.id; }).forEach(function(o){
        rows.push({order:o, customer:m});
      });
    });
    rows.sort(function(a,b){ return (a.order.dateReceived||'').localeCompare(b.order.dateReceived||''); });
    return {members:members, rows:rows};
  }

  window.viewFamilyGroup = function(familyName){
    var data = familyOrdersData(familyName);
    var totalPaid = data.rows.reduce(function(s,x){ return s+(Number(x.order.paid)||0); }, 0);
    var totalRemaining = data.rows.reduce(function(s,x){ return s+orderRemaining(x.order); }, 0);
    var rowsHtml = data.rows.map(function(x){
      return '<div class="card"><div class="row"><h3>'+escapeHtml(x.customer.name)+' - '+escapeHtml(orderTypeLabel(x.order))+'</h3>'
        + '<b>'+orderTotal(x.order).toLocaleString('ar-EG')+' ج.م</b></div>'
        + '<div class="meta">📅 '+fmtDate(x.order.dateReceived)+' — متبقي: '+orderRemaining(x.order).toLocaleString('ar-EG')+' ج.م</div></div>';
    }).join('') || '<div class="empty-msg">لا توجد طلبات مسجلة لهذه العائلة</div>';

    openModal(
      '<div class="modal-head"><h3>👪 '+escapeHtml(familyName)+'</h3><button class="modal-close" onclick="closeModal()">✕</button></div>'
      + '<p class="meta">'+data.members.length+' أفراد — '+data.rows.length+' طلب إجمالاً</p>'
      + '<div class="card" style="padding:10px 12px;margin-bottom:12px;background:var(--card-alt);">'
        + '<div class="row"><span class="meta">إجمالي المدفوع</span><b style="color:var(--ok);">'+totalPaid.toLocaleString('ar-EG')+' ج.م</b></div>'
        + '<div class="row"><span class="meta">إجمالي المتبقي</span><b style="color:var(--danger);">'+totalRemaining.toLocaleString('ar-EG')+' ج.م</b></div>'
      + '</div>'
      + rowsHtml
      + '<button class="btn sm secondary" style="margin-top:10px;" onclick="printFamilyStatement(\''+familyName.replace(/'/g,"\\'")+'\')">🖨️ طباعة كشف حساب العائلة</button>'
    );
  };

  window.printFamilyStatement = function(familyName){
    var data = familyOrdersData(familyName);
    var totalPaid = data.rows.reduce(function(s,x){ return s+(Number(x.order.paid)||0); }, 0);
    var totalRemaining = data.rows.reduce(function(s,x){ return s+orderRemaining(x.order); }, 0);
    var rowsHtml = data.rows.length ? data.rows.map(function(x){
      return '<tr><td>'+escapeHtml(x.customer.name)+'</td><td>'+fmtDate(x.order.dateReceived)+'</td><td>'+escapeHtml(orderTypeLabel(x.order))+'</td>'
        + '<td>'+orderTotal(x.order).toLocaleString('ar-EG')+'</td><td>'+(Number(x.order.paid)||0).toLocaleString('ar-EG')+'</td>'
        + '<td>'+orderRemaining(x.order).toLocaleString('ar-EG')+'</td></tr>';
    }).join('') : '<tr><td colspan="6" style="text-align:center;color:#888;">لا توجد طلبات</td></tr>';

    var html = '<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>كشف حساب عائلة - '+escapeHtml(familyName)+'</title>'
      + '<style>body{font-family:Tahoma,Arial,sans-serif;padding:24px;color:#222;} h1{font-size:19px;border-bottom:2px solid #1F6D57;padding-bottom:8px;}'
      + ' table{width:100%;border-collapse:collapse;margin-top:14px;font-size:13px;} th,td{padding:8px 6px;border-bottom:1px solid #ddd;text-align:center;}'
      + ' th{background:#f5f3ef;} .totals{margin-top:16px;display:flex;gap:14px;justify-content:flex-end;font-size:14px;} .totals b{color:#1F6D57;}</style></head><body>'
      + printBrandHeaderHtml()
      + '<h1>🧾 كشف حساب عائلة - '+escapeHtml(familyName)+'</h1>'
      + '<p style="font-size:13px;color:#666;">عدد الأفراد: '+data.members.length+' — تاريخ الكشف: '+fmtDate(todayStr())+'</p>'
      + '<table><tr><th>الاسم</th><th>تاريخ الاستلام</th><th>الصنف</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th></tr>'+rowsHtml+'</table>'
      + '<div class="totals"><div>إجمالي المدفوع: <b>'+totalPaid.toLocaleString('ar-EG')+' ج.م</b></div>'
      + '<div>إجمالي المتبقي: <b>'+totalRemaining.toLocaleString('ar-EG')+' ج.م</b></div></div>'
      + '</body></html>';
    openPrintWindow(html, 'كشف_حساب_عائلة_'+familyName);
  };

  var origRC = renderCustomers;
  renderCustomers = function(){
    origRC.apply(this, arguments);
    try{
      document.querySelectorAll('#customersList .card').forEach(function(card){
        if(card.dataset.familyBadgeAdded) return;
        var phoneEl = null;
        card.querySelectorAll('.meta').forEach(function(m){
          if(!phoneEl && m.textContent.trim().indexOf('📞')===0) phoneEl = m;
        });
        if(!phoneEl) return;
        var digits = phoneEl.textContent.replace(/[^0-9]/g,'');
        var c = db.customers.find(function(x){ return (x.phone||'').replace(/[^0-9]/g,'')===digits; });
        if(!c || !c.family) return;
        var siblingsCount = familyMembers(c.family).length;
        if(siblingsCount<2) return;
        card.dataset.familyBadgeAdded='1';
        var chip = document.createElement('div');
        chip.className='meta'; chip.style.cssText='margin-top:4px;';
        chip.innerHTML = '<span style="background:var(--info-light);color:var(--info);border-radius:8px;padding:3px 9px;font-size:11.5px;font-weight:700;cursor:pointer;">👪 '+escapeHtml(c.family)+' ('+siblingsCount+' أفراد)</span>';
        chip.querySelector('span').onclick = function(){ viewFamilyGroup(c.family); };
        phoneEl.insertAdjacentElement('afterend', chip);
      });
    }catch(e){}
  };
})();

/* ===== معرض الأعمال (نسخة أساسية) ===== */
(function(){
  function getGallery(){ try{ return JSON.parse(localStorage.getItem('workGallery')||'[]'); }catch(e){ return []; } }
  function saveGallery(list){
    try{ localStorage.setItem('workGallery', JSON.stringify(list)); return true; }
    catch(e){ toast('⚠️ مساحة التخزين ممتلئة — احذف صور قديمة عشان تضيف جديدة'); return false; }
  }
  function resizeImage(file, cb){
    var reader = new FileReader();
    reader.onload = function(e){
      var img = new Image();
      img.onload = function(){
        var maxW = 900;
        var scale = Math.min(1, maxW/img.width);
        var canvas = document.createElement('canvas');
        canvas.width = img.width*scale; canvas.height = img.height*scale;
        canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
        cb(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  window.openGalleryModal = function(){
    var list = getGallery();
    var grid = list.length===0
      ? '<div class="g-empty">لسه مفيش صور — ابدأ تضيف أفضل قطعك 👇</div>'
      : list.map(function(item){
          return '<div class="g-item" onclick="viewGalleryItem(\''+item.id+'\')"><img src="'+item.img+'" loading="lazy"></div>';
        }).join('');
    openModal(
      '<div class="modal-head"><h3>🖼️ معرض الأعمال</h3><button class="modal-close" onclick="closeModal()">✕</button></div>'
      + '<button class="gallery-add-btn" onclick="triggerGalleryUpload()">➕ إضافة صورة جديدة</button>'
      + '<div id="galleryGrid">'+grid+'</div>'
    );
  };

  window.viewGalleryItem = function(id){
    var item = getGallery().find(function(x){ return x.id===id; });
    if(!item) return;
    openModal(
      '<div class="modal-head"><h3>🖼️ تفاصيل الصورة</h3><button class="modal-close" onclick="closeModal()">✕</button></div>'
      + '<img src="'+item.img+'" style="width:100%;border-radius:10px;margin-bottom:10px;">'
      + (item.caption ? '<p class="meta">'+escapeHtml(item.caption)+'</p>' : '')
      + '<p class="meta">'+fmtDate(item.date)+'</p>'
      + '<button class="btn outline" style="width:100%;margin-top:10px;color:var(--danger);border-color:var(--danger);" onclick="deleteGalleryItem(\''+id+'\')">🗑️ حذف الصورة</button>'
    );
  };

  window.deleteGalleryItem = function(id){
    saveGallery(getGallery().filter(function(x){ return x.id!==id; }));
    toast('🗑️ اتحذفت الصورة');
    openGalleryModal();
  };

  // زر الوصول للمعرض في القائمة الجانبية
  var settingsBtn = document.querySelector('.navbtn[data-page="settings"]');
  if(settingsBtn){
    var galleryBtn = document.createElement('button');
    galleryBtn.className='navbtn';
    galleryBtn.innerHTML = '<span class="ic">🖼️</span>معرض الأعمال';
    galleryBtn.onclick = function(){ closeSideNav(); openGalleryModal(); };
    settingsBtn.insertAdjacentElement('beforebegin', galleryBtn);
  }

  // يُستبدلان لاحقًا بالنسخة المطوّرة (ربط بعميل/طلب) بالأسفل — موجودان هنا فقط لأخذ نفس الشكل الأساسي عند عدم توفر db
  window.triggerGalleryUpload = window.triggerGalleryUpload || function(){
    var input = document.createElement('input');
    input.type='file'; input.accept='image/*';
    input.onchange = function(){
      if(!input.files || !input.files[0]) return;
      resizeImage(input.files[0], function(dataUrl){
        window._pendingGalleryImage = dataUrl;
        openModal(
          '<div class="modal-head"><h3>✏️ وصف الصورة</h3><button class="modal-close" onclick="closeModal()">✕</button></div>'
          + '<img src="'+dataUrl+'" style="width:100%;border-radius:10px;margin-bottom:10px;">'
          + '<label>وصف مختصر (اختياري)</label>'
          + '<input id="galleryCaptionInput" placeholder="مثال: جلباب مناسبات - قماش كتان">'
          + '<button class="btn accent" style="width:100%;margin-top:12px;" onclick="saveGalleryItem()">💾 حفظ في المعرض</button>'
        );
      });
    };
    input.click();
  };

  window.saveGalleryItem = window.saveGalleryItem || function(){
    var dataUrl = window._pendingGalleryImage;
    if(!dataUrl) return;
    var caption = (document.getElementById('galleryCaptionInput')||{}).value || '';
    var list = getGallery();
    list.unshift({id:'g'+Date.now(), img:dataUrl, caption:caption, date:todayStr()});
    if(saveGallery(list)){
      toast('✅ اتضافت الصورة للمعرض');
      window._pendingGalleryImage = null;
      openGalleryModal();
    }
  };
})();

/* ===== معرض الأعمال (نسخة مطوّرة): ربط اختياري بعميل/طلب، شارة روابط، قسم "صور الطلب" داخل فورم الطلب ===== */
(function(){
  function getGallery(){ try{ return JSON.parse(localStorage.getItem('workGallery')||'[]'); }catch(e){ return []; } }
  function saveGallery(list){ try{ localStorage.setItem('workGallery', JSON.stringify(list)); return true; }catch(e){ toast('⚠️ مساحة التخزين ممتلئة'); return false; } }

  /* استبدال دالة الرفع عشان تقبل ربط اختياري بعميل/طلب من البداية */
  window.triggerGalleryUpload = function(presetCustomerId, presetOrderId){
    var input = document.createElement('input');
    input.type='file'; input.accept='image/*';
    input.onchange = function(){
      if(!input.files || !input.files[0]) return;
      var reader = new FileReader();
      reader.onload = function(e){
        var img = new Image();
        img.onload = function(){
          var maxW=900, scale=Math.min(1, maxW/img.width);
          var canvas=document.createElement('canvas');
          canvas.width=img.width*scale; canvas.height=img.height*scale;
          canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
          window._pendingGalleryImage = canvas.toDataURL('image/jpeg',0.72);
          openGalleryCaptionStep(presetCustomerId, presetOrderId);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(input.files[0]);
    };
    input.click();
  };

  window.openGalleryCaptionStep = function(presetCustomerId, presetOrderId){
    var custOptions = '<option value="">بدون ربط بعميل</option>' + db.customers.map(function(c){
      return '<option value="'+c.id+'" '+(c.id===presetCustomerId?'selected':'')+'>'+escapeHtml(c.name)+'</option>';
    }).join('');
    openModal(
      '<div class="modal-head"><h3>✏️ وصف الصورة</h3><button class="modal-close" onclick="closeModal()">✕</button></div>'
      + '<img src="'+window._pendingGalleryImage+'" style="width:100%;border-radius:10px;margin-bottom:10px;">'
      + '<label>وصف مختصر (اختياري)</label>'
      + '<input id="galleryCaptionInput" placeholder="مثال: جلباب مناسبات - قماش كتان">'
      + '<label style="margin-top:8px;">ربط بعميل (اختياري)</label>'
      + '<select id="galleryCustomerSelect" onchange="onGalleryCustomerChange()">'+custOptions+'</select>'
      + '<div id="galleryOrderSelectWrap"></div>'
      + '<button class="btn accent" style="width:100%;margin-top:12px;" onclick="saveGalleryItem()">💾 حفظ في المعرض</button>'
    );
    if(presetCustomerId){ onGalleryCustomerChange(presetOrderId); }
  };

  window.onGalleryCustomerChange = function(presetOrderId){
    var custId = document.getElementById('galleryCustomerSelect').value;
    var wrap = document.getElementById('galleryOrderSelectWrap');
    if(!custId){ wrap.innerHTML=''; return; }
    var orders = db.orders.filter(function(o){ return o.customerId===custId; });
    if(orders.length===0){ wrap.innerHTML='<p class="meta">مفيش طلبات مسجلة لهذا العميل</p>'; return; }
    var opts = '<option value="">بدون ربط بطلب معين</option>' + orders.map(function(o){
      return '<option value="'+o.id+'" '+(o.id===presetOrderId?'selected':'')+'>'+escapeHtml(orderTypeLabel(o))+' - '+fmtDate(o.dateDelivery)+'</option>';
    }).join('');
    wrap.innerHTML = '<label style="margin-top:8px;">ربط بطلب معين (اختياري)</label><select id="galleryOrderSelect">'+opts+'</select>';
  };

  /* استبدال دالة الحفظ عشان تخزن الربط */
  window.saveGalleryItem = function(){
    var dataUrl = window._pendingGalleryImage;
    if(!dataUrl) return;
    var caption = (document.getElementById('galleryCaptionInput')||{}).value || '';
    var custId = (document.getElementById('galleryCustomerSelect')||{}).value || '';
    var orderId = (document.getElementById('galleryOrderSelect')||{}).value || '';
    var list = getGallery();
    list.unshift({id:'g'+Date.now(), img:dataUrl, caption:caption, date:todayStr(), customerId:custId||null, orderId:orderId||null});
    if(saveGallery(list)){
      toast('✅ اتضافت الصورة للمعرض');
      window._pendingGalleryImage = null;
      if(orderId){ closeModal(); openOrderModal(orderId); }
      else{ openGalleryModal(); }
    }
  };

  /* شارة 🔗 على الصور المرتبطة داخل شبكة المعرض */
  var origOpenGalleryModal = openGalleryModal;
  openGalleryModal = function(){
    origOpenGalleryModal();
    setTimeout(function(){
      getGallery().forEach(function(item){
        if(!item.orderId && !item.customerId) return;
        var el = document.querySelector('.g-item[onclick*="'+item.id+'"]');
        if(el && !el.querySelector('.g-link-badge')){
          var b=document.createElement('span'); b.className='g-link-badge';
          b.style.cssText='position:absolute;top:4px;left:4px;background:rgba(0,0,0,0.55);color:#fff;border-radius:6px;padding:1px 5px;font-size:10px;';
          b.textContent='🔗';
          el.appendChild(b);
        }
      });
    }, 30);
  };

  /* قسم "صور الطلب" داخل فورم تعديل الطلب */
  var origOOMGallery = openOrderModal;
  openOrderModal = function(id, presetCustomerId){
    var r = origOOMGallery.apply(this, arguments);
    if(id){
      setTimeout(function(){
        try{
          var o = db.orders.find(function(x){ return x.id===id; });
          if(!o) return;
          var imgs = getGallery().filter(function(g){ return g.orderId===id; });
          var thumbs = imgs.map(function(g){
            return '<div style="width:56px;height:56px;border-radius:8px;overflow:hidden;flex-shrink:0;" onclick="viewGalleryItem(\''+g.id+'\')"><img src="'+g.img+'" style="width:100%;height:100%;object-fit:cover;"></div>';
          }).join('');
          var section = document.createElement('div');
          section.style.cssText='margin:14px 0;';
          section.innerHTML =
            '<label>📷 صور الطلب</label>'
            + '<div style="display:flex;gap:8px;overflow-x:auto;margin:6px 0;">'+thumbs+'</div>'
            + '<div style="display:flex;gap:8px;">'
            + '<button type="button" class="btn sm outline" onclick="triggerGalleryUpload(\''+o.customerId+'\',\''+id+'\')">➕ صورة جديدة</button>'
            + '<button type="button" class="btn sm outline" onclick="openGalleryPickerForOrder(\''+id+'\',\''+o.customerId+'\')">🖼️ من المعرض</button>'
            + '</div>';
          var saveBtn = document.querySelector('.modal-box button[onclick^="saveOrder("]');
          if(saveBtn) saveBtn.insertAdjacentElement('beforebegin', section);
        }catch(e){}
      }, 60);
    }
    return r;
  };

  window.openGalleryPickerForOrder = function(orderId, customerId){
    var list = getGallery();
    var grid = list.length===0 ? '<div class="g-empty">المعرض فاضي</div>' : list.map(function(item){
      return '<div class="g-item" onclick="linkGalleryItemToOrder(\''+item.id+'\',\''+orderId+'\',\''+customerId+'\')"><img src="'+item.img+'" loading="lazy"></div>';
    }).join('');
    openModal(
      '<div class="modal-head"><h3>🖼️ اختر صورة لربطها بالطلب</h3><button class="modal-close" onclick="closeModal()">✕</button></div>'
      + '<div id="galleryGrid">'+grid+'</div>'
    );
  };

  window.linkGalleryItemToOrder = function(itemId, orderId, customerId){
    var list = getGallery();
    var item = list.find(function(x){ return x.id===itemId; });
    if(item){ item.orderId=orderId; item.customerId=customerId; saveGallery(list); toast('🔗 اترابطت الصورة بالطلب'); }
    closeModal();
    openOrderModal(orderId);
  };
})();

/* 1) زر كثافة العرض (مريح/مضغوط) جنب باقي أيقونات الشريط العلوي */
(function(){
  var anchor = document.getElementById('contrastToggleBtn') || document.getElementById('themeToggleBtn');
  if(!anchor) return;
  var btn = document.createElement('button');
  btn.className='theme-toggle-btn'; btn.id='densityToggleBtn';
  btn.setAttribute('aria-label','كثافة العرض');
  function updateIcon(){ btn.textContent = document.documentElement.classList.contains('compact-view') ? '▤' : '☰'; }
  btn.onclick = function(){
    document.documentElement.classList.toggle('compact-view');
    localStorage.setItem('compactView', document.documentElement.classList.contains('compact-view')?'1':'0');
    updateIcon();
  };
  anchor.insertAdjacentElement('afterend', btn);
  if(localStorage.getItem('compactView')==='1') document.documentElement.classList.add('compact-view');
  updateIcon();
})();

/* 2) تحويل بطاقات صفحة الإعدادات لأكورديون قابل للطي */
(function(){
  function accordionizeCard(card){
    if(card.dataset.accordionized) return;
    var heading = card.firstElementChild;
    if(!heading || heading.tagName!=='H3') return;
    var rest = Array.prototype.slice.call(card.children, 1);
    if(rest.length===0) return;
    card.dataset.accordionized='1';
    var body = document.createElement('div');
    body.className='acc-body';
    body.style.display='none';
    rest.forEach(function(el){ body.appendChild(el); });
    card.appendChild(body);
    var chevron = document.createElement('span');
    chevron.textContent='▾';
    chevron.style.cssText='margin-inline-start:auto;transition:transform .2s;font-size:13px;color:var(--muted);';
    heading.style.cssText='display:flex;align-items:center;cursor:pointer;margin:0;';
    heading.appendChild(chevron);
    heading.addEventListener('click', function(){
      var open = body.style.display!=='none';
      body.style.display = open ? 'none' : 'block';
      chevron.style.transform = open ? '' : 'rotate(180deg)';
    });
  }
  function processSettingsCards(){
    document.querySelectorAll('#page-settings > .card').forEach(accordionizeCard);
  }
  processSettingsCards();
  new MutationObserver(processSettingsCards).observe(document.getElementById('page-settings'), {childList:true});
})();

/* 1) ظل يظهر على الهيدر عند التمرير + زر الرجوع لأعلى الصفحة */
(function(){
  window.addEventListener('scroll', function(){
    var header = document.querySelector('header.topbar');
    if(header) header.classList.toggle('scrolled', window.scrollY>10);
  }, {passive:true});

  var btn = document.createElement('button');
  btn.id='scrollTopBtn'; btn.textContent='⬆️';
  btn.onclick = function(){ window.scrollTo({top:0, behavior:'smooth'}); };
  document.getElementById('app').appendChild(btn);
  window.addEventListener('scroll', function(){
    btn.classList.toggle('show', window.scrollY>400);
  }, {passive:true});
})();

/* 2) فلاتر سريعة + فرز + تجميع بالحالة + فواصل تاريخ + دليل ألوان لصفحة الطلبات */
(function(){
  var extraFilter='none', sortMode='default', groupByStatus=false;

  function ensureControls(){
    if(document.getElementById('ordersExtraControls')) return;
    var list = document.getElementById('ordersList');
    if(!list) return;
    var wrap = document.createElement('div');
    wrap.id='ordersExtraControls'; wrap.style.cssText='margin-bottom:10px;';
    wrap.innerHTML =
      '<div class="btn-row" style="flex-wrap:wrap;margin-bottom:8px;" id="ordersChipsRow">'
      + '<button class="btn sm outline" data-chip="urgent">🔥 مستعجل</button>'
      + '<button class="btn sm outline" data-chip="soon">⏳ قريب الموعد</button>'
      + '<button class="btn sm outline" data-chip="nodeposit">💰 بدون عربون</button>'
      + '<button class="btn sm outline" data-chip="group">🗂️ تجميع بالحالة</button>'
      + '<button class="btn sm outline" id="legendToggleBtn">🎨 دليل الألوان</button>'
      + '</div>'
      + '<div class="field" style="margin-bottom:8px;"><label>ترتيب حسب</label>'
      + '<select id="ordersSortSelect">'
      + '<option value="default">📥 الأحدث إضافة</option>'
      + '<option value="nearest">⏳ الأقرب تسليمًا</option>'
      + '<option value="highest">💰 الأعلى قيمة</option>'
      + '</select></div>'
      + '<div id="legendBox" style="display:none;padding:10px;background:var(--card-alt);border-radius:10px;font-size:12px;margin-bottom:8px;">'
      + '🟢 قيد العمل &nbsp; 🟡 جاهز للتسليم &nbsp; ⚪ تم التسليم &nbsp; 🔴 متأخر / مستعجل'
      + '</div>';
    list.insertAdjacentElement('beforebegin', wrap);

    wrap.querySelectorAll('[data-chip]').forEach(function(b){
      b.addEventListener('click', function(){
        var chip=b.dataset.chip;
        if(chip==='group'){ groupByStatus=!groupByStatus; b.classList.toggle('accent',groupByStatus); }
        else{
          extraFilter=(extraFilter===chip)?'none':chip;
          wrap.querySelectorAll('[data-chip]').forEach(function(x){ if(x.dataset.chip!=='group') x.classList.remove('accent'); });
          if(extraFilter!=='none') b.classList.add('accent');
        }
        applyEnhancements();
      });
    });
    document.getElementById('ordersSortSelect').addEventListener('change', function(){ sortMode=this.value; applyEnhancements(); });
    document.getElementById('legendToggleBtn').addEventListener('click', function(){
      var box=document.getElementById('legendBox');
      box.style.display = box.style.display==='none' ? 'block':'none';
    });
  }

  function applyEnhancements(){
    var container=document.getElementById('ordersList');
    if(!container) return;
    container.querySelectorAll('.order-group-title').forEach(function(el){ el.remove(); });
    var cards=Array.prototype.slice.call(container.querySelectorAll('.card'));
    cards.forEach(function(card){
      if(!card.dataset.orderId){
        var btn=card.querySelector('[onclick^="openOrderModal("]');
        if(btn){ var m=btn.getAttribute('onclick').match(/openOrderModal\('([^']+)'/); if(m) card.dataset.orderId=m[1]; }
      }
    });
    var today=todayStr();
    var in3=new Date(); in3.setDate(in3.getDate()+3);
    var in3Str=in3.toISOString().slice(0,10);

    cards.forEach(function(card){
      var o=db.orders.find(function(x){ return x.id===card.dataset.orderId; });
      var show=true;
      if(o){
        if(extraFilter==='urgent') show=!!o.urgent;
        else if(extraFilter==='soon') show=o.status!=='تم التسليم' && o.dateDelivery && o.dateDelivery<=in3Str;
        else if(extraFilter==='nodeposit') show=o.status!=='تم التسليم' && !Number(o.paid);
      }
      card.style.display=show?'':'none';
    });

    var visible=cards.filter(function(c){ return c.style.display!=='none'; });
    if(sortMode!=='default'){
      visible.sort(function(a,b){
        var oa=db.orders.find(function(x){ return x.id===a.dataset.orderId; });
        var ob=db.orders.find(function(x){ return x.id===b.dataset.orderId; });
        if(!oa||!ob) return 0;
        if(sortMode==='nearest') return (oa.dateDelivery||'9999').localeCompare(ob.dateDelivery||'9999');
        if(sortMode==='highest') return orderTotal(ob)-orderTotal(oa);
        return 0;
      });
      visible.forEach(function(card){ container.appendChild(card); });
    }

    if(groupByStatus){
      var order=['قيد العمل','جاهز للتسليم','تم التسليم'];
      var groups={};
      visible.forEach(function(card){
        var o=db.orders.find(function(x){ return x.id===card.dataset.orderId; });
        var st=o?o.status:'أخرى';
        (groups[st]=groups[st]||[]).push(card);
      });
      order.forEach(function(st){
        if(!groups[st]||!groups[st].length) return;
        var title=document.createElement('div');
        title.className='section-title order-group-title';
        title.textContent=st+' ('+groups[st].length+')';
        container.appendChild(title);
        groups[st].forEach(function(card){ container.appendChild(card); });
      });
    } else if(sortMode==='nearest'){
      var lastDate=null;
      visible.forEach(function(card){
        var o=db.orders.find(function(x){ return x.id===card.dataset.orderId; });
        var d=o?(o.dateDelivery||'بدون تاريخ'):null;
        if(d && d!==lastDate){
          var sep=document.createElement('div');
          sep.className='order-group-title';
          sep.style.cssText='font-size:11.5px;color:var(--muted);margin:10px 2px 4px;font-weight:700;';
          sep.textContent='📅 '+(d==='بدون تاريخ'?d:fmtDate(d));
          container.insertBefore(sep, card);
          lastDate=d;
        }
      });
    }
  }

  // [مدموج] كانت الدالة دي متلفوفة مرتين (هنا + عند دعم الكانبان تحت).
  // دلوقتي الاتنين في مكان واحد عشان محدش يعدّل حتة من غير ما يشوف التانية.
  var origRO=renderOrders;
  renderOrders=function(){
    origRO.apply(this, arguments);
    ensureControls();
    setTimeout(applyEnhancements, 20);
    if(window.ordersView==='kanban' && typeof window.renderOrdersKanban==='function') window.renderOrdersKanban();
  };
})();

/* 3) تجميع العملاء أبجديًا + شريط حروف جانبي للقفز السريع */
(function(){
  function firstLetter(name){ return (name&&name.trim().charAt(0))||'#'; }

  function applyAlphaGroup(){
    var container=document.getElementById('customersList');
    if(!container) return;
    container.querySelectorAll('.cust-group-title').forEach(function(el){ el.remove(); });
    var cards=Array.prototype.slice.call(container.querySelectorAll('.card'));
    if(cards.length<6){ var s=document.getElementById('alphaStrip'); if(s) s.style.display='none'; return; }
    var items=cards.map(function(card){
      var phoneEl=Array.prototype.find.call(card.querySelectorAll('.meta'), function(m){ return m.textContent.trim().indexOf('📞')===0; });
      var digits=phoneEl?phoneEl.textContent.replace(/[^0-9]/g,''):'';
      var c=db.customers.find(function(x){ return (x.phone||'').replace(/[^0-9]/g,'')===digits; });
      return {card:card, name:c?c.name:''};
    }).filter(function(it){ return it.name; });
    items.sort(function(a,b){ return a.name.localeCompare(b.name,'ar'); });
    var lastLetter=null, letters=[];
    items.forEach(function(it){
      var letter=firstLetter(it.name);
      if(letter!==lastLetter){
        var title=document.createElement('div');
        title.className='section-title cust-group-title';
        title.id='cust-letter-'+letter.charCodeAt(0);
        title.textContent=letter;
        container.appendChild(title);
        lastLetter=letter; letters.push(letter);
      }
      container.appendChild(it.card);
    });
    buildLetterStrip(letters);
  }

  function buildLetterStrip(letters){
    var strip=document.getElementById('alphaStrip');
    if(!strip){
      strip=document.createElement('div'); strip.id='alphaStrip';
      strip.style.cssText='position:fixed;top:50%;left:4px;transform:translateY(-50%);display:flex;flex-direction:column;gap:2px;z-index:55;background:var(--card);border-radius:10px;padding:4px 3px;box-shadow:var(--shadow);';
      document.getElementById('app').appendChild(strip);
    }
    strip.innerHTML='';
    strip.style.display = letters.length>3 ? 'flex' : 'none';
    letters.forEach(function(letter){
      var b=document.createElement('button');
      b.textContent=letter;
      b.style.cssText='background:none;border:none;font-size:10.5px;color:var(--primary);font-weight:800;padding:1px 3px;';
      b.onclick=function(){
        var el=document.getElementById('cust-letter-'+letter.charCodeAt(0));
        if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
      };
      strip.appendChild(b);
    });
  }

  var origRC3=renderCustomers;
  renderCustomers=function(){
    origRC3.apply(this, arguments);
    setTimeout(applyAlphaGroup, 40);
  };

  var origShowPage3=showPage;
  showPage=function(name){
    var r=origShowPage3.apply(this, arguments);
    var strip=document.getElementById('alphaStrip');
    if(strip && name!=='customers') strip.style.display='none';
    return r;
  };
})();

/* شكل زر القفل (أيقونة + نص قابل للإخفاء على الشاشات الضيقة عبر CSS) */
(function(){
  var lockBtn = document.querySelector('header.topbar .small-link');
  if(lockBtn && !lockBtn.dataset.wrapped){
    lockBtn.dataset.wrapped='1';
    lockBtn.innerHTML = '🔒<span class="lock-text"> قفل</span>';
  }
})();

/* إحساس ضغط فوري للوحة أرقام القفل + قفل مؤقت أثناء التحقق من الرقم */
(function(){
  function setup(){
    var keypad = document.getElementById('keypad');
    if(!keypad || keypad.dataset.fastTapEnabled) return;
    keypad.dataset.fastTapEnabled='1';

    keypad.addEventListener('touchstart', function(e){
      var btn = e.target.closest('button');
      if(btn) btn.classList.add('pressed');
    }, {passive:true});
    ['touchend','touchcancel'].forEach(function(ev){
      keypad.addEventListener(ev, function(e){
        var btn = e.target.closest('button');
        if(btn) btn.classList.remove('pressed');
        else keypad.querySelectorAll('.pressed').forEach(function(b){ b.classList.remove('pressed'); });
      }, {passive:true});
    });
  }
  setup();

  var origCheckPin = checkPin;
  checkPin = function(){
    var keypad = document.getElementById('keypad');
    if(keypad) keypad.style.pointerEvents='none';
    origCheckPin();
    setTimeout(function(){ if(keypad) keypad.style.pointerEvents=''; }, 450);
  };
})();

/* 28) لوحة كانبان لصفحة الطلبات */
(function(){
  window.ordersView = 'list';
  var KANBAN_STATUSES = [
    {key:'قيد العمل', label:'🧵 قيد العمل', icon:'🧵'},
    {key:'جاهز للتسليم', label:'📦 جاهز للتسليم', icon:'📦'},
    {key:'تم التسليم', label:'✅ تم التسليم', icon:'✅'}
  ];
  var DELIVERED_LIMIT = 20; // نعرض آخر عدد محدود من الطلبات المُسلَّمة بس عشان الأداء ووضوح اللوحة

  window.setOrdersView = function(v){
    window.ordersView = v;
    var listBox = document.getElementById('ordersList');
    var kanbanBox = document.getElementById('ordersKanban');
    var statusFilters = document.getElementById('orderStatusFilters');
    var extraControls = document.getElementById('ordersExtraControls');
    var listBtn = document.getElementById('ordersViewListBtn');
    var kanbanBtn = document.getElementById('ordersViewKanbanBtn');
    if(v==='kanban'){
      if(listBox) listBox.style.display='none';
      if(kanbanBox) kanbanBox.style.display='';
      if(statusFilters) statusFilters.style.display='none';
      if(extraControls) extraControls.style.display='none';
      if(listBtn) listBtn.classList.remove('active');
      if(kanbanBtn) kanbanBtn.classList.add('active');
      renderOrdersKanban();
    } else {
      if(listBox) listBox.style.display='';
      if(kanbanBox) kanbanBox.style.display='none';
      if(statusFilters) statusFilters.style.display='';
      if(extraControls) extraControls.style.display='';
      if(listBtn) listBtn.classList.add('active');
      if(kanbanBtn) kanbanBtn.classList.remove('active');
      renderOrders();
    }
  };

  // نفس منطق البحث والفلترة بالتاريخ المستخدم في renderOrders، لكن من غير فلتر الحالة (لأن الحالة هنا أعمدة)
  function filteredOrdersForKanban(){
    var qEl = document.getElementById('orderSearch');
    var fromEl = document.getElementById('orderDateFrom');
    var toEl = document.getElementById('orderDateTo');
    var q = qEl ? (qEl.value||'').trim() : '';
    var dateFrom = fromEl ? fromEl.value : '';
    var dateTo = toEl ? toEl.value : '';
    var list = db.orders.slice().sort(function(a,b){ return (b.dateReceived||'').localeCompare(a.dateReceived||''); });
    if(q){
      list = list.filter(function(o){
        var c = customerById(o.customerId);
        return (c && c.name.includes(q)) || orderTypeLabel(o).includes(q);
      });
    }
    if(dateFrom) list = list.filter(function(o){ return o.dateReceived && o.dateReceived>=dateFrom; });
    if(dateTo) list = list.filter(function(o){ return o.dateReceived && o.dateReceived<=dateTo; });
    return list;
  }

  function kanbanCardHtml(o){
    var c = customerById(o.customerId);
    var idx = KANBAN_STATUSES.findIndex(function(s){ return s.key===o.status; });
    var moveButtons = '';
    if(idx>0){
      var prev = KANBAN_STATUSES[idx-1];
      moveButtons += '<button class="btn sm outline" onclick="moveOrderToStatus(\''+o.id+'\',\''+prev.key.replace(/'/g,"\\'")+'\')">◀ '+escapeHtml(prev.label.replace(/^\S+\s/,''))+'</button>';
    }
    if(idx>=0 && idx<KANBAN_STATUSES.length-1){
      var next = KANBAN_STATUSES[idx+1];
      moveButtons += '<button class="btn sm accent" onclick="moveOrderToStatus(\''+o.id+'\',\''+next.key.replace(/'/g,"\\'")+'\')">'+escapeHtml(next.label.replace(/^\S+\s/,''))+' ▶</button>';
    }
    return '<div class="kanban-card" draggable="true" data-order-id="'+o.id+'">'
      + '<div class="row"><h3 class="name-row">'+avatarChip(c?c.name:'؟')+(c?escapeHtml(c.name):'عميل محذوف')+'</h3></div>'
      + '<div class="meta">👗 '+escapeHtml(orderTypeLabel(o))+'</div>'
      + '<div class="meta">📅 التسليم: '+fmtDate(o.dateDelivery)+'</div>'
      + '<div class="meta">💰 المتبقي: <b style="color:'+(orderRemaining(o)>0?'var(--danger)':'var(--ok)')+'">'+orderRemaining(o).toLocaleString('ar-EG')+'</b></div>'
      + '<div class="btn-row">'
      +   '<button class="btn sm outline" onclick="openOrderModal(\''+o.id+'\')">✏️</button>'
      +   moveButtons
      + '</div>'
      + '</div>';
  }

  window.renderOrdersKanban = function(){
    var box = document.getElementById('ordersKanban');
    if(!box) return;
    var all = filteredOrdersForKanban();
    var html = '<div class="kanban-wrap" id="kanbanWrap">';
    KANBAN_STATUSES.forEach(function(st){
      var items = all.filter(function(o){ return o.status===st.key; });
      var note = '';
      if(st.key==='تم التسليم' && items.length>DELIVERED_LIMIT){
        note = '<div class="meta" style="text-align:center;">عرض آخر '+DELIVERED_LIMIT+' من '+items.length+'</div>';
        items = items.slice(0, DELIVERED_LIMIT);
      }
      var cardsHtml = items.length
        ? items.map(kanbanCardHtml).join('')
        : '<div class="kanban-empty-col">لا يوجد طلبات هنا</div>';
      html += '<div class="kanban-col" data-status="'+escapeHtml(st.key)+'">'
        + '<div class="kanban-col-head"><span>'+st.label+'</span><span class="cnt">'+items.length+'</span></div>'
        + cardsHtml + note
        + '</div>';
    });
    html += '</div>';
    box.innerHTML = html;
    wireKanbanDragDrop();
  };

  function wireKanbanDragDrop(){
    var wrap = document.getElementById('kanbanWrap');
    if(!wrap) return;
    wrap.querySelectorAll('.kanban-card').forEach(function(card){
      card.addEventListener('dragstart', function(e){
        card.classList.add('dragging');
        try{ e.dataTransfer.setData('text/plain', card.dataset.orderId); }catch(err){}
      });
      card.addEventListener('dragend', function(){ card.classList.remove('dragging'); });
    });
    wrap.querySelectorAll('.kanban-col').forEach(function(col){
      col.addEventListener('dragover', function(e){ e.preventDefault(); col.classList.add('drag-over'); });
      col.addEventListener('dragleave', function(){ col.classList.remove('drag-over'); });
      col.addEventListener('drop', function(e){
        e.preventDefault();
        col.classList.remove('drag-over');
        var id = '';
        try{ id = e.dataTransfer.getData('text/plain'); }catch(err){}
        var newStatus = col.getAttribute('data-status');
        if(id && newStatus) moveOrderToStatus(id, newStatus);
      });
    });
  }

  // تحديث حالة الطلب من اللوحة (سواء بالسحب أو بالأزرار) — بيعيد استخدام markOrderDelivered
  // عشان يحافظ على كل التأثيرات الجانبية الحالية (تسجيل وقت التسليم، سجل النشاط، التراجع...)
  window.moveOrderToStatus = function(orderId, newStatus){
    var o = db.orders.find(function(x){ return x.id===orderId; });
    if(!o || o.status===newStatus) return;
    if(newStatus==='تم التسليم'){
      markOrderDelivered(orderId);
      renderOrdersKanban();
      return;
    }
    var before = {status:o.status, deliveredDate:o.deliveredDate};
    var wasDelivered = (before.status==='تم التسليم');
    o.status = newStatus;
    if(wasDelivered) o.deliveredDate = null;
    var c = customerById(o.customerId);
    logActivity('🔄 تغيير حالة طلب '+(c?c.name:'')+' إلى "'+newStatus+'"');
    setUndo('تغيير حالة الطلب', function(){
      o.status = before.status;
      o.deliveredDate = before.deliveredDate;
      saveDB();
      renderHome();
      renderOrders();
      renderOrdersKanban();
    });
    saveDB();
    renderHome();
    renderOrders();
    renderOrdersKanban();
    toast('تم تحديث حالة الطلب ✅');
  };

  // [مدموج] مزامنة الكانبان بقت جزء من اللفة الوحيدة لـ renderOrders (فوق، جنب ensureControls/applyEnhancements)
  // بدل ما تتلف تاني هنا.

  // الوضع الافتراضي: قائمة (نفس السلوك القديم)
  var listBtnInit = document.getElementById('ordersViewListBtn');
  if(listBtnInit) listBtnInit.classList.add('active');
})();

/* 29) تقسيم صفحة الإعدادات لأقسام (تابات) بدل قائمة طويلة واحدة */
(function(){
  var section = document.getElementById('page-settings');
  if(!section || document.getElementById('settingsTabs')) return;

  var GROUPS = [
    {id:'general', label:'🏷️ عام', keywords:['بيانات الورشة','عن التطبيق']},
    {id:'appearance', label:'🎨 المظهر', keywords:['تخصيص الألوان','شكل الأزرار','تخصيص الشاشة الرئيسية','وضع الشاشة الكبيرة','تخصيص الخط','تأثير التحميل']},
    {id:'operations', label:'⚙️ التشغيل', keywords:['الطاقة الاستيعابية','يوم الإجازة الأسبوعية','مواعيد الأعياد','أنواع التفصيل','عملاء VIP','تنبيه المديونية','رقم الفاتورة والضريبة']},
    {id:'security', label:'🔒 الأمان والصلاحيات', keywords:['تغيير الرقم السري','القفل التلقائي','وضع المدير','وضع الاستقبال','صفحة المالية']},
    {id:'data', label:'💾 البيانات', keywords:['نسخة احتياطية','سلة المحذوفات','سجل النشاط','تصدير تقارير Excel']},
    {id:'advanced', label:'🧑‍💻 متقدم', keywords:['تعديل متقدم','تنزيل كود التطبيق']}
  ];
  var GROUP_BY_ID = {cloudSyncCardWrap:'data', pushNotifyCardWrap:'data'};

  function categorize(){
    var cards = section.querySelectorAll(':scope > .card');
    cards.forEach(function(c){
      if(c.dataset.settingsGroup) return;
      if(GROUP_BY_ID[c.id]){ c.dataset.settingsGroup = GROUP_BY_ID[c.id]; return; }
      var h3 = c.querySelector('h3');
      var text = h3 ? h3.textContent : '';
      var found = 'general';
      for(var i=0;i<GROUPS.length;i++){
        if(GROUPS[i].keywords.some(function(k){ return text.indexOf(k)!==-1; })){ found=GROUPS[i].id; break; }
      }
      c.dataset.settingsGroup = found;
    });
  }

  var currentSettingsTab = 'all';
  function applyFilter(group){
    currentSettingsTab = group;
    section.querySelectorAll(':scope > .card[data-settings-group]').forEach(function(c){
      c.style.display = (group==='all' || c.dataset.settingsGroup===group) ? '' : 'none';
    });
  }

  categorize();

  var bar = document.createElement('div');
  bar.className='settings-tabs'; bar.id='settingsTabs';
  var html = '<button class="settings-tab-btn active" data-group="all">📁 الكل</button>';
  GROUPS.forEach(function(g){ html += '<button class="settings-tab-btn" data-group="'+g.id+'">'+g.label+'</button>'; });
  bar.innerHTML = html;
  section.insertBefore(bar, section.firstChild);
  bar.addEventListener('click', function(e){
    var btn = e.target.closest('.settings-tab-btn');
    if(!btn) return;
    bar.querySelectorAll('.settings-tab-btn').forEach(function(b){ b.classList.toggle('active', b===btn); });
    applyFilter(btn.getAttribute('data-group'));
  });

  // أي بطاقات جديدة تتضاف بعد كده (زي بطاقات صلاحيات المدير/الاستقبال/المالية) لازم تتصنّف وتتفلتر برضه
  var obs = new MutationObserver(function(){
    categorize();
    applyFilter(currentSettingsTab);
  });
  obs.observe(section, {childList:true});
})();

/* 11) نافذة تأكيد قبل حفظ أي تعديل على بيانات عميل موجود بالفعل
   (الإضافة الجديدة مش محتاجة تأكيد لوحدها — أصلاً فيه خطوة "حفظ"
   صريحة، والتأكيد هنا يبقى مخصص للتعديل على بيانات موجودة). */
(function(){
  var origSaveCustomerConfirm = saveCustomer;
  saveCustomer = async function(id){
    if(id){
      var c = customerById(id);
      var ok = await appConfirm(
        'هل تريد حفظ التعديلات على بيانات العميل' + (c?(' "'+c.name+'"'):'') + '؟',
        {okText:'حفظ التعديل', cancelText:'إلغاء', danger:false}
      );
      if(!ok) return;
    }
    __skipUnsavedCheckOnce = true;
    var r = await origSaveCustomerConfirm.apply(this, arguments);
    // لو الفورم لسه فاتح (يعني الحفظ فشل في تحقق ما ورجع بدري)، نلغي التجاوز
    var ov = document.getElementById('modalOverlay');
    if(ov && ov.classList.contains('active')) __skipUnsavedCheckOnce = false;
    return r;
  };
})();

/* 12) نافذة تأكيد قبل حفظ أي تعديل على طلب موجود بالفعل
   [تم التحديث] لو التعديل بيغيّر حالة الطلب لـ"تم التسليم" (سواء من
   قائمة الحالة المنسدلة أو غيرها) بيظهر تنبيه مخصص وأوضح، بدل رسالة
   "حفظ التعديلات" العامة — لأن ده إجراء نهائي وأسهل حاجة تتضغط غلط
   من قائمة منسدلة أثناء التمرير بالإصبع. */
(function(){
  var origSaveOrderConfirm = saveOrder;
  saveOrder = async function(id){
    if(id){
      var o = db.orders.find(function(x){ return x.id===id; });
      var c = o ? customerById(o.customerId) : null;
      var statusSel = document.getElementById('f_status');
      var newStatus = statusSel ? statusSel.value : null;
      var becomingDelivered = o && o.status!=='تم التسليم' && newStatus==='تم التسليم';
      var ok;
      if(becomingDelivered){
        ok = await appConfirm(
          '⚠️ هذا التغيير هيسجّل' + (c?(' طلب "'+c.name+'"'):' هذا الطلب') + ' كـ"تم التسليم" بالكامل. هل أنت متأكد؟',
          {okText:'نعم، تم التسليم', cancelText:'إلغاء', danger:false}
        );
      } else {
        ok = await appConfirm(
          'هل تريد حفظ التعديلات على' + (c?(' طلب "'+c.name+'"'):' هذا الطلب') + '؟',
          {okText:'حفظ التعديل', cancelText:'إلغاء', danger:false}
        );
      }
      if(!ok) return;
    }
    __skipUnsavedCheckOnce = true;
    var r = await origSaveOrderConfirm.apply(this, arguments);
    var ov = document.getElementById('modalOverlay');
    if(ov && ov.classList.contains('active')) __skipUnsavedCheckOnce = false;
    return r;
  };
})();

/* 13) تحذير عند إغلاق فورم فيه تعديلات لم تُحفظ
   بيقارن قيم كل حقول المودال وقت ما اتفتح بقيمها وقت ما حد حاول يقفله.
   لو مختلفة، بيسأل قبل ما يقفل فعليًا. الحفظ الناجح (عبر saveCustomer/
   saveOrder) بيتخطى السؤال ده لأنه مش "إغلاق بدون حفظ". */
(function(){
  var snapshot = null;

  function snapshotModal(){
    var box = document.getElementById('modalBox');
    if(!box) return null;
    var els = box.querySelectorAll('input, textarea, select');
    if(!els.length) return null; // مفيش حقول = مفيش حاجة نراقبها (مودال معلومات/تأكيد)
    var parts = [];
    els.forEach(function(el){
      if(el.type==='checkbox' || el.type==='radio'){ parts.push(el.checked?'1':'0'); }
      else { parts.push(el.value); }
    });
    return parts.join('\u0001');
  }

  var origOpenModalDirty = openModal;
  openModal = function(html){
    var r = origOpenModalDirty.apply(this, arguments);
    snapshot = snapshotModal();
    return r;
  };

  var origCloseModalDirty = closeModal;
  closeModal = function(){
    if(__skipUnsavedCheckOnce){
      __skipUnsavedCheckOnce = false;
      snapshot = null;
      return origCloseModalDirty.apply(this, arguments);
    }
    if(snapshot!==null && snapshotModal()!==snapshot){
      appConfirm('عندك تعديلات لم تُحفظ. هل تريد الإغلاق من غير حفظها؟', {okText:'إغلاق من غير حفظ', cancelText:'متابعة التعديل', danger:true}).then(function(ok){
        if(ok){
          snapshot = null;
          origCloseModalDirty.apply(null, []);
        }
      });
      return; // منع الإغلاق الفوري لحد ما المستخدم يرد
    }
    snapshot = null;
    return origCloseModalDirty.apply(this, arguments);
  };
})();

/* 14) قفل الطلبات "تم التسليم" من التعديل العرضي
   فتح طلب مُسلَّم بالفعل بيعرض شاشة تنبيه بدل الفورم مباشرة، وتعديله
   الفعلي محتاج ضغطة واعية على "فتح للتعديل رغم كده". القفل بيترجع
   تلقائيًا في المرة الجاية اللي تتفتح فيها المودال (مش فضّال مفتوح
   لبقية الجلسة) لأننا بنصفّر unlockedOrderId كل ما المودال يتقفل فعليًا. */
(function(){
  var unlockedOrderId = null;

  var origOpenOrderModalLock = openOrderModal;
  openOrderModal = function(id, presetCustomerId){
    if(id && id!==unlockedOrderId){
      var o = db.orders.find(function(x){ return x.id===id; });
      if(o && o.status==='تم التسليم'){
        var c = customerById(o.customerId);
        openModal(
          '<div class="modal-head"><h3>🔒 طلب مُسلَّم بالفعل</h3><button class="modal-close" onclick="closeModal()">✕</button></div>'
          + '<p class="meta">طلب' + (c?(' "'+escapeHtml(c.name)+'"'):'') + ' متسجل "تم التسليم" بالفعل. الفورم مقفول تلقائيًا لمنع أي تعديل غير مقصود عليه.</p>'
          + '<button class="btn outline" onclick="window.__unlockOrderForEdit(\''+id+'\')">✏️ فتح للتعديل رغم كده</button>'
        );
        return;
      }
    }
    return origOpenOrderModalLock.apply(this, arguments);
  };
  window.__unlockOrderForEdit = function(id){
    unlockedOrderId = id;
    openOrderModal(id);
  };

  // أي إغلاق فعلي للمودال يصفّر القفل، عشان فتح نفس الطلب تاني يتطلب فتح واعٍ من جديد
  var origCloseModalLock = closeModal;
  closeModal = function(){
    unlockedOrderId = null;
    return origCloseModalLock.apply(this, arguments);
  };
})();

/* 15) شريط تراجع بأكثر من خطوة (بدل خطوة واحدة بس)
   بيحتفظ بآخر 5 إجراءات قابلة للتراجع بدل ما يفقد الإجراء اللي قبل
   الأخير بمجرد ما تعمل حاجة تانية بعده. */
(function(){
  var MAX_UNDO = 5;
  window.__undoStack = [];

  setUndo = function(label, restoreFn){
    window.__undoStack.unshift({label:label, restoreFn:restoreFn});
    if(window.__undoStack.length>MAX_UNDO) window.__undoStack.length = MAX_UNDO;
    renderUndoBar();
  };

  performUndo = function(idx){
    idx = idx||0;
    var entry = window.__undoStack[idx];
    if(!entry){ toast('لا يوجد إجراء حديث للتراجع عنه'); return; }
    window.__undoStack.splice(idx,1);
    entry.restoreFn();
    renderUndoBar();
    toast('تم التراجع عن: '+entry.label+' ↩️');
  };

  renderUndoBar = function(){
    var box = document.getElementById('undoBarWrap');
    if(!box) return;
    if(!window.__undoStack.length){ box.innerHTML=''; return; }
    box.innerHTML = window.__undoStack.map(function(entry, i){
      return '<button class="btn sm outline" style="width:100%;margin-bottom:8px;" onclick="performUndo('+i+')">↩️ تراجع عن: '+escapeHtml(entry.label)+'</button>';
    }).join('');
  };
})();

/* 16) [إصلاح حرج] كان فيه سباق بين "تحميل البيانات من السحابة" و"رفع
   البيانات المحلية" لحظة الاتصال بمساحة مزامنة — لو كان فيه اتصال سابق
   في نفس الجلسة، استدعاء saveDB() جوه دالة الاتصال كان بيجدول رفع تلقائي
   بعد أقل من ثانية، وده كان بيكتب فوق بيانات السحابة الحقيقية ببيانات
   الجهاز المحلية (اللي بتكون فاضية وقت الاتصال) قبل ما التحميل يخلص.
   الحل: منع أي رفع للسحابة تمامًا لمدة كافية بعد أي محاولة اتصال/إنشاء
   مساحة مزامنة، لحد ما يتضمن وصول أول تحديث حقيقي من السحابة. */
(function(){
  var blockPush = false;
  if(typeof pushToCloud==='function'){
    var origPushToCloudGuard = pushToCloud;
    pushToCloud = async function(){
      if(blockPush) return; // ممنوع الرفع لحد ما ناخد فرصة كافية للتحميل الأول
      return origPushToCloudGuard.apply(this, arguments);
    };
  }
  function guardConnect(fn){
    return async function(){
      blockPush = true;
      try{
        return await fn.apply(this, arguments);
      } finally {
        setTimeout(function(){ blockPush = false; }, 8000);
      }
    };
  }
  if(typeof connectCloudSyncSpace==='function') connectCloudSyncSpace = guardConnect(connectCloudSyncSpace);
  if(typeof createCloudSyncSpace==='function') createCloudSyncSpace = guardConnect(createCloudSyncSpace);
})();

/* 17) [تنظيم داخلي] تبسيط صفوف الأزرار في كروت العملاء والطلبات
   بدل ما كل كارت يعرض 6-7 زراير في صف واحد مزدحم، بنسيب أهم زرارين
   ظاهرين، والباقي يتجمع في قائمة "⋮ المزيد" منسدلة ونضيفة —
   مستوحاة من قائمة الثلاث نقاط في تطبيق "مقاس". */
(function(){
  function consolidateCardActions(containerId, primaryLabels){
    var container = document.getElementById(containerId);
    if(!container) return;
    container.querySelectorAll('.card').forEach(function(card){
      var row = card.querySelector('.btn-row');
      if(!row) return;
      var buttons = Array.prototype.slice.call(row.children).filter(function(el){ return el.tagName==='BUTTON'; });
      if(buttons.length <= primaryLabels.length) return;
      var isPrimary = buttons.map(function(b){
        return primaryLabels.some(function(l){ return b.textContent.trim()===l; });
      });
      var secondary = buttons.filter(function(b,i){ return !isPrimary[i]; });
      if(!secondary.length) return;
      row.style.position = 'relative';

      var menu = document.createElement('div');
      menu.className = 'card-more-menu';
      menu.style.cssText = 'display:none;position:absolute;top:100%;inset-inline-start:0;margin-top:6px;background:var(--card);border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow-lift);z-index:20;overflow:hidden;min-width:180px;';

      secondary.forEach(function(b, i){
        b.classList.remove('sm','outline','secondary','accent','danger');
        b.style.cssText = 'display:block;width:100%;text-align:start;background:none;border:none;'
          + (i<secondary.length-1 ? 'border-bottom:1px solid var(--border);' : '')
          + 'padding:11px 14px;font-size:14px;color:var(--text);cursor:pointer;border-radius:0;flex:none;';
        menu.appendChild(b);
      });

      var moreBtn = document.createElement('button');
      moreBtn.type = 'button';
      moreBtn.className = 'btn sm outline';
      moreBtn.textContent = '⋮ المزيد';
      moreBtn.addEventListener('click', function(e){
        e.stopPropagation();
        document.querySelectorAll('.card-more-menu.open').forEach(function(m){
          if(m!==menu){ m.classList.remove('open'); m.style.display='none'; }
        });
        var isOpen = menu.classList.toggle('open');
        menu.style.display = isOpen ? 'block' : 'none';
      });
      row.appendChild(moreBtn);
      row.appendChild(menu);
    });
  }

  if(!window.__cardMoreMenuDocClick){
    window.__cardMoreMenuDocClick = true;
    document.addEventListener('click', function(){
      document.querySelectorAll('.card-more-menu.open').forEach(function(m){
        m.classList.remove('open'); m.style.display='none';
      });
    });
  }

  var origRenderOrdersUI = renderOrders;
  renderOrders = function(){
    origRenderOrdersUI.apply(this, arguments);
    consolidateCardActions('ordersList', ['✏️ تعديل', '📲 فاتورة واتساب']);
  };

  var origRenderCustomersUI = renderCustomers;
  renderCustomers = function(){
    origRenderCustomersUI.apply(this, arguments);
    consolidateCardActions('customersList', ['✏️ تعديل', '➕ طلب جديد']);
  };
})();

/* 18) [ضمان استرجاع دائم] حارس أمان قبل الرفع + نسخ احتياطية سحابية
   بتاريخ منفصلة عن مستند المزامنة الحي — عشان لو حصل أي خطأ (حتى لو
   خطأ مستقبلي غير اللي أصلحناه) يفضل عندك تاريخ نقاط استرجاع تقدر
   ترجع لأي يوم منها بدل ما تعتمد بس على نسخة حية واحدة ممكن تتكتب
   فوقها غلط. */
(function(){
  // أ) قبل أي رفع فعلي، اتأكد إن البيانات المحلية مش أقل بشكل مريب من
  // اللي على السحابة حاليًا — لو كده امنع الرفع بدل ما يحصل استبدال كارثي
  var origPushToCloudSafe = pushToCloud;
  pushToCloud = async function(){
    try{
      if(cloudDb && db && db.cloudSync && db.cloudSync.enabled && db.cloudSync.syncId){
        var ref = cloudDb.collection('workshops').doc(db.cloudSync.syncId);
        var snap = await ref.get();
        if(snap.exists){
          var remote = snap.data() || {};
          var remoteC = (remote.customers||[]).length;
          var remoteO = (remote.orders||[]).length;
          var localC = (db.customers||[]).length;
          var localO = (db.orders||[]).length;
          var suspicious = (remoteC>0 && localC===0) || (remoteO>0 && localO===0)
                         || (remoteC - localC > 5) || (remoteO - localO > 5);
          if(suspicious){
            console.warn('⛔ تم إيقاف الرفع للسحابة وقائيًا — البيانات المحلية أقل بكثير من السحابة (سحابة: '+remoteC+' عميل/'+remoteO+' طلب، جهاز: '+localC+' عميل/'+localO+' طلب).');
            return;
          }
        }
      }
    }catch(e){ return; } // لو التحقق فشل، الأسلم إننا مانرفعش من غير ما نتأكد
    var r = await origPushToCloudSafe.apply(this, arguments);
    scheduleDailyCloudBackup();
    return r;
  };

  // ب) نسخة احتياطية سحابية تلقائية مرة كل يوم، في مستند منفصل بتاريخه
  function scheduleDailyCloudBackup(){
    try{
      if(!cloudDb || !db.cloudSync || !db.cloudSync.enabled || !db.cloudSync.syncId) return;
      var today = new Date().toISOString().slice(0,10);
      if(db.__lastCloudBackupDate === today) return;
      var safeData = JSON.parse(JSON.stringify(db));
      cloudDb.collection('workshops').doc(db.cloudSync.syncId).collection('backups').doc(today).set(safeData)
        .then(function(){
          db.__lastCloudBackupDate = today;
          try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }catch(e){}
        }).catch(function(){});
    }catch(e){}
  }

  // ج) نسخة احتياطية سحابية يدوية فورية
  window.backupNowToCloud = async function(){
    if(!cloudDb || !db.cloudSync || !db.cloudSync.enabled || !db.cloudSync.syncId){
      toast('المزامنة السحابية لازم تكون مفعّلة الأول');
      return;
    }
    try{
      var key = new Date().toISOString().replace(/[:.]/g,'-');
      var safeData = JSON.parse(JSON.stringify(db));
      await cloudDb.collection('workshops').doc(db.cloudSync.syncId).collection('backups').doc(key).set(safeData);
      toast('✅ اتحفظت نسخة احتياطية سحابية دلوقتي');
    }catch(e){
      toast('⚠️ فشل حفظ النسخة الاحتياطية: '+(e && (e.code||e.message)||'خطأ غير معروف'));
    }
  };

  // د) عرض النسخ السحابية السابقة واسترجاع أي واحدة منها
  window.listCloudBackups = async function(){
    if(!cloudDb || !db.cloudSync || !db.cloudSync.enabled || !db.cloudSync.syncId){
      toast('المزامنة السحابية لازم تكون مفعّلة الأول');
      return;
    }
    var box = document.getElementById('cloudBackupsListBox');
    if(!box) return;
    box.innerHTML = '<p class="meta">⏳ جاري التحميل...</p>';
    try{
      var qs = await cloudDb.collection('workshops').doc(db.cloudSync.syncId).collection('backups').orderBy('updatedAt','desc').limit(30).get();
      if(qs.empty){
        box.innerHTML = '<p class="meta">لا توجد نسخ احتياطية سحابية بعد.</p>';
        return;
      }
      var rows = [];
      qs.forEach(function(doc){
        var d = doc.data();
        var custN = (d.customers||[]).length;
        var ordN = (d.orders||[]).length;
        var dt = d.updatedAt ? new Date(d.updatedAt).toLocaleString('ar-EG') : doc.id;
        rows.push('<div class="card" style="padding:10px;margin-bottom:8px;">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">'
          + '<div><b>'+doc.id+'</b><br><span class="meta">'+dt+' — '+custN+' عميل / '+ordN+' طلب</span></div>'
          + '<button class="btn sm outline" onclick="restoreCloudBackup(\''+doc.id+'\')">استرجاع</button>'
          + '</div></div>');
      });
      box.innerHTML = rows.join('');
    }catch(e){
      box.innerHTML = '<p class="meta">⚠️ تعذر تحميل القائمة: '+(e && (e.code||e.message)||'خطأ غير معروف')+'</p>';
    }
  };

  window.restoreCloudBackup = async function(backupId){
    var ok = await appConfirm('هل تريد استرجاع النسخة الاحتياطية بتاريخ '+backupId+'؟ سيتم استبدال كل البيانات الحالية على هذا الجهاز بها.', {okText:'استرجاع', cancelText:'إلغاء', danger:true});
    if(!ok) return;
    try{
      var docSnap = await cloudDb.collection('workshops').doc(db.cloudSync.syncId).collection('backups').doc(backupId).get();
      if(!docSnap.exists){ toast('⚠️ النسخة دي مش موجودة'); return; }
      var restored = docSnap.data();
      var mySettings = db.cloudSync;
      db = restored;
      db.cloudSync = mySettings;
      fillMissingDefaults();
      try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }catch(e){}
      renderAll();
      toast('✅ تم استرجاع النسخة الاحتياطية بنجاح');
    }catch(e){
      toast('⚠️ فشل الاسترجاع: '+(e && (e.code||e.message)||'خطأ غير معروف'));
    }
  };

  // هـ) إضافة قسم النسخ الاحتياطية السحابية تحت كارت المزامنة في الإعدادات
  var origRenderCloudSyncCardBackup = renderCloudSyncCard;
  renderCloudSyncCard = function(){
    origRenderCloudSyncCardBackup.apply(this, arguments);
    var box = document.getElementById('cloudSyncCardWrap');
    if(!box || !(db.cloudSync && db.cloudSync.enabled && db.cloudSync.syncId)) return;
    if(box.querySelector('#cloudBackupsSection')) return; // متتكررش لو اتنادت تاني
    box.insertAdjacentHTML('beforeend', ''
      + '<div id="cloudBackupsSection" style="margin-top:14px;border-top:1px solid var(--border);padding-top:12px;">'
      + '<p class="meta">نسخة احتياطية سحابية يومية تلقائية، منفصلة عن بيانات المزامنة الحية — لو أي مشكلة حصلت، تقدر ترجع لأي يوم سابق من غير ما تعتمد على النسخة الحية بس.</p>'
      + '<div class="btn-row"><button class="btn sm outline" onclick="backupNowToCloud()">🗄️ احفظ نسخة الآن</button>'
      + '<button class="btn sm outline" onclick="listCloudBackups()">📜 عرض النسخ السابقة</button></div>'
      + '<div id="cloudBackupsListBox" style="margin-top:10px;"></div>'
      + '</div>');
  };
})();

/* 19) توليد رمز ربط جديد (تدوير) — لو الرمز القديم اتسرب أو مش مطمّن
   له، بينشئ مساحة مزامنة جديدة، ينقل البيانات ليها، ويوقف الاعتماد
   على الرمز القديم تمامًا من غير ما يمسح بياناته القديمة (احتياط). */
(function(){
  window.rotateCloudSyncCode = async function(){
    if(!db.cloudSync || !db.cloudSync.enabled || !db.cloudSync.syncId){
      toast('لازم تكون المزامنة السحابية مفعّلة الأول');
      return;
    }
    var ok = await appConfirm('هيتم إنشاء رمز ربط جديد ونقل بياناتك الحالية ليه. الرمز القديم مش هيقدر يزامن بيانات جديدة تاني. هل تريد المتابعة؟', {okText:'توليد رمز جديد', cancelText:'إلغاء', danger:true});
    if(!ok) return;
    try{
      var newSyncId = randomSyncId();
      var safeData = JSON.parse(JSON.stringify(db));
      await cloudDb.collection('workshops').doc(newSyncId).set(safeData);
      db.cloudSync.syncId = newSyncId;
      saveDB();
      if(typeof cloudUnsub==='function'){ cloudUnsub(); cloudUnsub=null; }
      initCloudSync();
      renderCloudSyncCard();
      toast('✅ اتعمل رمز ربط جديد — انسخه واحفظه في مكان آمن فورًا');
    }catch(e){
      toast('⚠️ فشل توليد الرمز الجديد: '+(e && (e.code||e.message)||'خطأ غير معروف'));
    }
  };

  var origRenderCloudSyncCardRotate = renderCloudSyncCard;
  renderCloudSyncCard = function(){
    origRenderCloudSyncCardRotate.apply(this, arguments);
    var box = document.getElementById('cloudSyncCardWrap');
    if(!box || !(db.cloudSync && db.cloudSync.enabled && db.cloudSync.syncId)) return;
    if(box.querySelector('#rotateSyncCodeBtn')) return;
    var btn = document.createElement('button');
    btn.id = 'rotateSyncCodeBtn';
    btn.type = 'button';
    btn.className = 'btn sm outline';
    btn.style.marginTop = '10px';
    btn.textContent = '🔄 توليد رمز ربط جديد';
    btn.addEventListener('click', function(){ rotateCloudSyncCode(); });
    box.appendChild(btn);
  };
})();

/* 20) تنبيه في الرئيسية لو النسخة الاحتياطية السحابية اليومية توقفت */
(function(){
  var origRenderHomeAlertsStale = renderHomeAlerts;
  renderHomeAlerts = function(){
    origRenderHomeAlertsStale.apply(this, arguments);
    if(!(db.cloudSync && db.cloudSync.enabled && db.cloudSync.syncId)) return;
    var box = document.getElementById('homeAlerts');
    if(!box) return;
    var last = db.__lastCloudBackupDate;
    var days = last ? Math.round((new Date(todayStr())-new Date(last))/86400000) : null;
    if(days===null || days>=3){
      var msg = days===null
        ? 'لم تُحفظ أي نسخة احتياطية سحابية بعد — افتح الإعدادات واضغط "🗄️ احفظ نسخة الآن".'
        : 'لم تُحفظ نسخة احتياطية سحابية منذ '+days+' يوم — تأكد من اتصال الجهاز بالنت.';
      box.insertAdjacentHTML('beforeend',
        '<div class="alert-banner warn"><span class="ic">☁️</span><div><b>النسخة الاحتياطية السحابية اليومية متأخرة</b>'+msg+'</div></div>');
    }
  };
})();

/* 21) [مستوحى من تطبيق مقاس] عند تسليم طلب فيه مبلغ متبقي، اسأل فورًا
   هل تحب تسجّل الدفعة دلوقتي كمان، بدل ما يكون إجراء منفصل بعدين. */
(function(){
  var origMarkOrderDeliveredBundle = markOrderDelivered;
  markOrderDelivered = async function(orderId){
    origMarkOrderDeliveredBundle.apply(this, arguments);
    var o = db.orders.find(function(x){ return x.id===orderId; });
    if(o){
      var remaining = orderRemaining(o);
      if(remaining>0){
        var ok = await appConfirm('باقي على العميل '+remaining.toLocaleString('ar-EG')+' ج.م. هل تريد تسجيل الدفعة دلوقتي؟', {okText:'تسجيل الدفعة', cancelText:'لاحقًا', danger:false});
        if(ok) openPaymentModal(orderId);
      }
    }
  };
})();

/* 22) أداة دمج العملاء المكررين (نفس رقم الهاتف)
   التطبيق بيتحقق من رقم الهاتف المكرر وقت الحفظ، لكن لو حد تجاهل
   التحذير أو استورد بيانات قديمة، ممكن يتكون عملاء مكررين فعليًا.
   الأداة دي بتكتشفهم وبتسيبك تختار مين تحتفظ بيه، وبتنقل كل الطلبات
   للنسخة المختارة قبل ما تمسح الباقي. */
(function(){
  function findDuplicateCustomers(){
    var byPhone = {};
    (db.customers||[]).forEach(function(c){
      var p = (c.phone||'').trim();
      if(!p) return;
      if(!byPhone[p]) byPhone[p] = [];
      byPhone[p].push(c);
    });
    var dups = [];
    Object.keys(byPhone).forEach(function(p){
      if(byPhone[p].length>1) dups.push(byPhone[p]);
    });
    return dups;
  }

  window.renderDuplicateCustomersUI = function(){
    var box = document.getElementById('duplicateCustomersBox');
    if(!box) return;
    var dups = findDuplicateCustomers();
    window.__dupGroups = dups;
    if(!dups.length){ box.innerHTML = '<p class="meta">مفيش عملاء مكررين حاليًا 👍</p>'; return; }
    box.innerHTML = dups.map(function(group, gi){
      var rows = group.map(function(c,i){
        var ordersCount = db.orders.filter(function(o){ return o.customerId===c.id; }).length;
        return '<label style="display:block;margin:6px 0;"><input type="radio" name="dupKeep'+gi+'" value="'+c.id+'" '+(i===0?'checked':'')+'> '
          + escapeHtml(c.name) + ' <span class="meta">('+ordersCount+' طلب)</span></label>';
      }).join('');
      return '<div class="card" style="padding:10px;margin-bottom:10px;">'
        + '<p class="meta">نفس رقم الهاتف ('+escapeHtml(group[0].phone)+'):</p>'
        + rows
        + '<button class="btn sm outline" style="margin-top:8px;" onclick="mergeDuplicateGroup('+gi+')">🔗 دمج في المختار</button>'
        + '</div>';
    }).join('');
  };

  window.mergeDuplicateGroup = async function(gi){
    var group = (window.__dupGroups||[])[gi];
    if(!group) return;
    var radios = document.getElementsByName('dupKeep'+gi);
    var keepId = null;
    for(var i=0;i<radios.length;i++){ if(radios[i].checked) keepId = radios[i].value; }
    if(!keepId) return;
    var ok = await appConfirm('هيتم نقل كل طلبات باقي النسخ المكررة لهذا العميل، وحذف النسخ التانية نهائيًا. هل أنت متأكد؟', {okText:'دمج', cancelText:'إلغاء', danger:true});
    if(!ok) return;
    group.forEach(function(c){
      if(c.id===keepId) return;
      db.orders.forEach(function(o){ if(o.customerId===c.id) o.customerId = keepId; });
      db.customers = db.customers.filter(function(x){ return x.id!==c.id; });
    });
    logActivity('🔗 دمج عملاء مكررين لنفس الرقم');
    saveDB();
    renderCustomers();
    renderDuplicateCustomersUI();
    toast('✅ تم الدمج بنجاح');
  };

  var origRenderSettingsDup = renderSettings;
  renderSettings = function(){
    origRenderSettingsDup.apply(this, arguments);
    var page = document.getElementById('page-settings');
    if(!page) return;
    if(page.querySelector('#duplicateCustomersCard')) { renderDuplicateCustomersUI(); return; }
    var card = document.createElement('div');
    card.className = 'card';
    card.id = 'duplicateCustomersCard';
    card.innerHTML = '<h3>🔗 دمج عملاء مكررين</h3>'
      + '<p class="meta">بتكتشف تلقائيًا أي عملاء عندهم نفس رقم الهاتف، وتسيبك تدمجهم في نسخة واحدة مع نقل كل طلباتهم.</p>'
      + '<div id="duplicateCustomersBox"></div>';
    page.appendChild(card);
    renderDuplicateCustomersUI();
  };
})();

/* 23) أداة تجميع القياسات المتقاربة (للتقطيع/التنفيذ الدفعي)
   بتجمع الطلبات "قيد العمل" حسب نوع اللبس، وترتبهم حسب قياس الصدر،
   وتقفّلهم في مجموعات لو الفرق بينهم جوه النطاق المسموح — عشان
   المعلم يقدر يقطّع أكتر من قطعة بنفس القالب مرة واحدة. */
(function(){
  function getMeasurements(customerId){
    var c = customerById(customerId);
    if(!c) return null;
    var chest = Number(c.chest);
    if(!chest) return null; // من غير قياس صدر مفيش معنى للتجميع
    return {
      chest: chest,
      waist: Number(c.waist)||null,
      length: Number(c.length)||null,
      sleeve: Number(c.sleeve)||null,
      shoulder: Number(c.shoulder)||null,
      name: c.name
    };
  }

  function orderGarmentType(o){
    if(Array.isArray(o.items) && o.items.length) return o.items[0].type||'';
    return o.type||'';
  }

  function buildClusters(garmentTypeName, tolerance, onlyInProgress){
    var candidates = db.orders.filter(function(o){
      if(onlyInProgress && o.status!=='قيد العمل') return false;
      if(garmentTypeName && orderGarmentType(o)!==garmentTypeName) return false;
      return true;
    }).map(function(o){
      var m = getMeasurements(o.customerId);
      if(!m) return null;
      return {order:o, m:m};
    }).filter(Boolean);

    candidates.sort(function(a,b){ return a.m.chest - b.m.chest; });

    var clusters = [];
    var current = null;
    candidates.forEach(function(item){
      if(current && Math.abs(item.m.chest - current.anchor) <= tolerance){
        current.items.push(item);
      } else {
        current = {anchor:item.m.chest, items:[item]};
        clusters.push(current);
      }
    });
    return clusters.filter(function(c){ return c.items.length>=2; });
  }

  function diffTxt(val, anchor, label){
    if(val===null || val===undefined) return '';
    var d = val - anchor;
    var sign = d>0 ? '+'+d : (d<0 ? d : '=');
    return label+': '+val+' ('+sign+')';
  }

  window.renderMeasurementClusters = function(){
    var box = document.getElementById('clusterResultsBox');
    if(!box) return;
    var type = document.getElementById('clusterGarmentType').value;
    var tol = Number(document.getElementById('clusterTolerance').value)||2;
    var onlyWip = document.getElementById('clusterOnlyWip').checked;
    var clusters = buildClusters(type, tol, onlyWip);
    if(!clusters.length){
      box.innerHTML = '<p class="meta">مفيش مجموعات قياسات متقاربة حاليًا بالمعايير دي.</p>';
      return;
    }
    box.innerHTML = clusters.map(function(cl, ci){
      var base = cl.items[0].m;
      var rows = cl.items.map(function(it){
        var o = it.order, m = it.m;
        var parts = [diffTxt(m.waist, base.waist, 'الخصر'), diffTxt(m.length, base.length, 'الطول'), diffTxt(m.sleeve, base.sleeve, 'الكم'), diffTxt(m.shoulder, base.shoulder, 'الكتف')].filter(Boolean).join(' | ');
        return '<div style="padding:8px 0;border-bottom:1px solid var(--border);">'
          + '<b>'+escapeHtml(m.name)+'</b> — صدر '+m.chest
          + (parts?('<br><span class="meta">'+parts+'</span>'):'')
          + '</div>';
      }).join('');
      return '<div class="card" style="padding:12px;margin-bottom:10px;">'
        + '<p class="meta">مجموعة '+(ci+1)+' — '+cl.items.length+' طلب حول قياس صدر '+base.chest+'</p>'
        + rows + '</div>';
    }).join('');
  };

  window.openMeasurementClusterTool = function(){
    var typeOptions = '<option value="">كل الأنواع</option>' + db.garmentTypes.slice().sort(function(a,b){return a.name.localeCompare(b.name,'ar');}).map(function(g){
      return '<option value="'+escapeHtml(g.name)+'">'+escapeHtml(g.name)+'</option>';
    }).join('');
    openModal(
      '<div class="modal-head"><h3>📐 تجميع القياسات المتقاربة</h3><button class="modal-close" onclick="closeModal()">✕</button></div>'
      + '<p class="meta">بتجمع الطلبات اللي قياساتها قريبة من بعض حسب قياس الصدر، عشان تقدر تقطّع أكتر من قطعة بنفس القالب مرة واحدة.</p>'
      + '<div class="field"><label>نوع اللبس</label><select id="clusterGarmentType">'+typeOptions+'</select></div>'
      + '<div class="field"><label>نطاق التقارب (سم)</label><input id="clusterTolerance" type="number" value="2" min="0" step="0.5"></div>'
      + '<label style="display:flex;align-items:center;gap:6px;margin:8px 0;"><input type="checkbox" id="clusterOnlyWip" checked> بس الطلبات "قيد العمل"</label>'
      + '<button class="btn" onclick="renderMeasurementClusters()">🔎 جمّع دلوقتي</button>'
      + '<div id="clusterResultsBox" style="margin-top:14px;"></div>'
    );
    renderMeasurementClusters();
  };

  var origRenderOrdersCluster = renderOrders;
  renderOrders = function(){
    origRenderOrdersCluster.apply(this, arguments);
    var filters = document.getElementById('orderStatusFilters');
    if(!filters || filters.querySelector('#openClusterToolBtn')) return;
    var btn = document.createElement('button');
    btn.id = 'openClusterToolBtn';
    btn.type = 'button';
    btn.className = 'btn sm outline';
    btn.textContent = '📐 قياسات متقاربة';
    btn.addEventListener('click', function(){ openMeasurementClusterTool(); });
    filters.appendChild(btn);
  };
})();

/* 29-ب) ربط بانر "كسبت X من Y المطلوبين الشهر ده" (صفحة الالتزامات) بـ
   "🎯 الهدف الشهري للإيرادات" (صفحة المالية) — نفس الفلوس (db.payments)
   بيتعرضوا في مكانين من غير ربط؛ هنا بنضيف تنبيه لو الهدف اللي حدده
   صاحب الورشة بنفسه أقل من احتياجه الشخصي الفعلي المحسوب تلقائيًا. لازم
   يترنّدر قبل باتش تجميع البانرات (30) عشان يتلمّ معاهم في نفس الكارت. */
(function(){
  if(typeof renderPersonalAlerts !== 'function') return;
  var origRenderPersonalAlertsGoalLink = renderPersonalAlerts;
  renderPersonalAlerts = function(){
    origRenderPersonalAlertsGoalLink.apply(this, arguments);
    try{
      var box = document.getElementById('personalAlerts');
      if(!box) return;
      if(window.userRole==='receptionist') return;
      if(db.financePassword && !window.financeUnlocked) return; // البيانات محمية، متعرضش رقم الاحتياج هنا
      var goal = Number(db.monthlyRevenueGoal)||0;
      if(goal<=0) return; // لسه مفيش هدف متحدد أصلاً، مفيش داعي للتنبيه
      var prog = typeof monthlyCommitmentProgress==='function' ? monthlyCommitmentProgress() : null;
      if(!prog || prog.requiredMonthly<=0 || goal>=prog.requiredMonthly) return;
      var gap = Math.round(prog.requiredMonthly-goal);
      var banner = document.createElement('div');
      banner.className = 'alert-banner warn';
      banner.innerHTML = '<span class="ic">🎯</span><div><b>هدف الإيرادات اللي حددته في صفحة المالية أقل من احتياجك الشخصي الشهري</b>'
        + 'الهدف: '+goal.toLocaleString('ar-EG')+' ج.م، احتياجك الفعلي: '+Math.round(prog.requiredMonthly).toLocaleString('ar-EG')+' ج.م — فرق '+gap.toLocaleString('ar-EG')+' ج.م.'
        + '<div class="btn-row" style="margin-top:6px;"><button class="btn sm outline" onclick="showPage(\'finance\');setTimeout(function(){var b=document.getElementById(\'monthlyGoalBox\');if(b)b.scrollIntoView({behavior:\'smooth\'});},200)">🎯 مراجعة الهدف</button></div>'
        + '</div>';
      var emptyMsg = box.querySelector(':scope > .empty-msg');
      if(emptyMsg) box.innerHTML = ''; // مفيش تنبيهات تانية، امسح رسالة "مفيش تنبيهات" الوهمية دلوقتي
      if(box.firstChild) box.insertBefore(banner, box.firstChild); else box.appendChild(banner);
    }catch(e){ console.warn('[patches] فشل ربط الهدف الشهري بالتزاماتك الشخصية:', e); }
  };
})();

/* 29-ج) ربط "عملاء تجاوزوا حد المديونية" (تنبيهات الرئيسية) بالتزاماتك
   الشخصية المستحقة قريبًا — بدل رقمين منفصلين ("عندك مديونين" و"قسطك
   مستحق") من غير أي فعل مقترح، بنقترح تتابع مع أكبر مديون فورًا، وبنستخدم
   sendDebtReminder الموجودة بالفعل عشان الفعل يبقى بضغطة واحدة. */
(function(){
  if(typeof renderPersonalAlerts !== 'function') return;
  var origRenderPersonalAlertsDebtLink = renderPersonalAlerts;
  renderPersonalAlerts = function(){
    origRenderPersonalAlertsDebtLink.apply(this, arguments);
    try{
      var box = document.getElementById('personalAlerts');
      if(!box) return;
      if(window.userRole==='receptionist') return;
      if(db.financePassword && !window.financeUnlocked) return;
      if(typeof getCommitmentDueAlerts!=='function' || typeof debtorCustomers!=='function' || typeof sendDebtReminder!=='function') return;
      var dueAlerts = getCommitmentDueAlerts();
      if(!dueAlerts.length) return;
      var debtors = debtorCustomers();
      if(!debtors.length) return;
      var dueTotal = dueAlerts.reduce(function(s,a){ return s+Number(a.c.amount||0); }, 0);
      var topDebtor = debtors[0];
      var banner = document.createElement('div');
      banner.className = 'alert-banner warn';
      banner.innerHTML = '<span class="ic">🔗</span><div><b>عندك '+dueAlerts.length+' قسط مستحق قريب بإجمالي '+Math.round(dueTotal).toLocaleString('ar-EG')+' ج.م، وفي المقابل عندك '+debtors.length+' عميل متجاوز حد المديونية</b>'
        + 'أكبرهم "'+escapeHtml(topDebtor.customer.name)+'" بمبلغ '+Math.round(topDebtor.amount).toLocaleString('ar-EG')+' ج.م — تحصيله ممكن يغطي احتياجك القريب.'
        + '<div class="btn-row" style="margin-top:6px;"><button class="btn sm outline" onclick="sendDebtReminder(\''+topDebtor.customer.id+'\')">💬 ابعتله تذكير دلوقتي</button></div>'
        + '</div>';
      var emptyMsg = box.querySelector(':scope > .empty-msg');
      if(emptyMsg) box.innerHTML = '';
      box.appendChild(banner);
    }catch(e){ console.warn('[patches] فشل ربط المديونين بالتزاماتك المستحقة:', e); }
  };
})();

/* 30) [إعادة تنظيم] تجميع تنبيهات الالتزامات الشخصية في كارت واحد
   قابل للطي بدل حائط بانرات (ممكن توصل لـ8 بانر مرة واحدة). بنسيب
   المنطق الأصلي زي ما هو تمامًا (كل الأزرار والوظائف شغالة)، وبس
   بنغيّر طريقة العرض بعد ما يترندر عادي. */
(function(){
  // [إصلاح] لو core.js المحمّل مفيهوش renderPersonalAlerts (نسخة قديمة)،
  // كان قراية المتغيّر ده مباشرة بتعمل ReferenceError فورًا لحظة تحميل
  // الملف — وده بيوقف تنفيذ كل حاجة بعدها في الملف كله (البنود 31-34
  // بتاعت لوحة الصحة المالية والخريطة السنوية وصندوق الطوارئ والقروض
  // كانت بتضيع فعليًا من غير ما حد يلاحظ ليه). دلوقتي بنتأكد الأول.
  if(typeof renderPersonalAlerts !== 'function'){
    console.warn('[patches] تخطّي تجميع تنبيهات الالتزامات: renderPersonalAlerts مش موجودة في core.js المحمّل.');
    return;
  }
  var origRenderPersonalAlertsCollapse = renderPersonalAlerts;
  renderPersonalAlerts = function(){
    try{
      origRenderPersonalAlertsCollapse.apply(this, arguments);
      var box = document.getElementById('personalAlerts');
      if(!box) return;
      var banners = box.querySelectorAll(':scope > .alert-banner');
      if(banners.length < 2) return; // بانر واحد أو صفر، مفيش داعي نلخّص
      var level = box.querySelector(':scope > .alert-banner.danger') ? 'danger'
                : box.querySelector(':scope > .alert-banner.warn') ? 'warn' : 'good';
      var icon = level==='danger' ? '🔴' : (level==='warn' ? '🟡' : '🟢');
      var inner = box.innerHTML;
      var count = banners.length;
      box.innerHTML = ''
        + '<div class="alert-banner '+level+'" id="personalAlertsSummaryBtn" style="cursor:pointer;">'
        + '<span class="ic">'+icon+'</span><div><b>عندك '+count+' تنبيهات على التزاماتك الشخصية</b>'
        + '<span id="personalAlertsToggleTxt">اضغط لعرض التفاصيل ▾</span></div></div>'
        + '<div id="personalAlertsDetails" style="display:none;">'+inner+'</div>';
      document.getElementById('personalAlertsSummaryBtn').addEventListener('click', function(){
        var details = document.getElementById('personalAlertsDetails');
        var txt = document.getElementById('personalAlertsToggleTxt');
        var open = details.style.display!=='none';
        details.style.display = open ? 'none' : 'block';
        txt.textContent = open ? 'اضغط لعرض التفاصيل ▾' : 'اضغط للإخفاء ▴';
      });
    }catch(e){ console.warn('[patches] فشل تجميع بانرات الالتزامات الشخصية:', e); }
  };
})();

/* 31) لوحة "الصحة المالية الشخصية" — شاشة ملخّصة واحدة بدل التنقل بين
   كذا قسم منفصل عشان تجمع الصورة الكاملة. */
(function(){
  // [إصلاح] كل قيمة بتتحسب لوحدها بـ try/catch: لو دالة معيّنة مش موجودة
  // (زي getCommitmentDueAlerts أو savingsGoalProgress في نسخة core.js أقدم)،
  // بنسيب قيمتها فاضية ونكمل باقي اللوحة، بدل ما اللوحة كلها توقف عن الظهور.
  function safe(fn, fallback){ try{ return fn(); }catch(e){ return fallback; } }

  function calcHealthSnapshot(){
    var r = safe(function(){ return calcRequiredDailyCapacity(); }, {total:0});
    var currentCapacity = Number(db.dailyCapacity)||500;
    var coveragePct = r && r.total>0 ? Math.round((currentCapacity/r.total)*100) : 100;
    var missedCount = (db.missedCommitmentNotices||[]).length;
    var dueSoonCount = safe(function(){ return getCommitmentDueAlerts().length; }, 0);
    // [إصلاح] savingsGoalProgress() اتشالت من core.js (استُبدلت بهدف ادخار
    // بمبلغ مستهدف واحد بدل الشهري: db.savingsGoalTarget + totalSavedAmount()).
    // بنحسب نفس الفكرة (نسبة %) من البيانات الجديدة لو موجودة، وإلا نرجع فاضي.
    var goalProg = safe(function(){
      if(typeof savingsGoalProgress === 'function') return savingsGoalProgress(); // توافق مع نسخ قديمة
      var target = Number(db.savingsGoalTarget)||0;
      if(!target || typeof totalSavedAmount !== 'function') return null;
      var saved = totalSavedAmount();
      return {saved:saved, goal:target, pct:Math.min(100, Math.round(saved/target*100))};
    }, null);
    var ef = safe(function(){ return calcEmergencyFundRunway(); }, null);
    var totalDebt = safe(function(){ return typeof totalRemainingLoansDebt==='function' ? totalRemainingLoansDebt() : 0; }, 0);
    // [إضافة] "اللي ليك عند العملاء" (مستحقات الورشة) و"اللي عليك من قروض"
    // (ديون شخصية) كانوا رقمين منفصلين تمامًا في مكانين مختلفين من التطبيق —
    // صافيهم (وضعك المالي الحقيقي) مكانش ظاهر في أي مكان. لو عندك 20,000 ج.م
    // مستحقة عند عملاء لكن عليك 30,000 ج.م قروض، وضعك الحقيقي سالب حتى لو
    // إحساسك إنك "مستني فلوس" بيدّيك راحة كاذبة.
    var totalOwedToYou = safe(function(){
      var totalFees = (db.orders||[]).reduce(function(s,o){ return s+orderTotal(o); }, 0);
      var totalCollected = (db.payments||[]).reduce(function(s,p){ return s+Number(p.amount||0); }, 0);
      return totalFees-totalCollected;
    }, 0);
    var netPosition = totalOwedToYou - totalDebt;
    return {r:r, currentCapacity:currentCapacity, coveragePct:coveragePct, missedCount:missedCount, dueSoonCount:dueSoonCount, goalProg:goalProg, ef:ef, totalDebt:totalDebt, totalOwedToYou:totalOwedToYou, netPosition:netPosition};
  }

  window.renderFinancialHealthDashboard = function(){
    var box = document.getElementById('financialHealthBox');
    if(!box) return;
    if(db.financePassword && !window.financeUnlocked){ box.innerHTML=''; return; }
    var hasData = (db.commitments||[]).length>0 || (db.houseExpenses||[]).length>0;
    if(!hasData){
      box.innerHTML = '<div class="empty-msg">أضف التزاماتك الشهرية عشان تظهر لوحة الصحة المالية هنا.</div>';
      return;
    }
    var s = calcHealthSnapshot();
    var covColor = s.coveragePct>=100 ? 'var(--primary)' : (s.coveragePct>=70 ? 'var(--warn,#b8860b)' : 'var(--danger)');
    box.innerHTML = ''
      + '<div class="stat-card"><div class="stat-ic">📶</div><div><div class="num" style="color:'+covColor+';">'+s.coveragePct+'%</div><div class="lbl">نسبة تغطية التزاماتك بسعتك الحالية</div></div></div>'
      + '<div class="stat-card '+(s.missedCount>0?'danger':'')+'"><div class="stat-ic">⏮️</div><div><div class="num">'+s.missedCount+'</div><div class="lbl">التزامات فاتك تسجيلها كمدفوعة</div></div></div>'
      + '<div class="stat-card '+(s.dueSoonCount>0?'danger':'')+'"><div class="stat-ic">🔔</div><div><div class="num">'+s.dueSoonCount+'</div><div class="lbl">مستحق خلال 3 أيام أو أقل</div></div></div>'
      + (s.goalProg ? '<div class="stat-card"><div class="stat-ic">🎯</div><div><div class="num">'+s.goalProg.pct+'%</div><div class="lbl">تقدّم هدف الادخار</div></div></div>' : '')
      + (s.ef ? '<div class="stat-card '+(s.ef.months<3?'danger':'')+'"><div class="stat-ic">🧳</div><div><div class="num">'+s.ef.months.toFixed(1)+'</div><div class="lbl">شهر تغطية من صندوق الطوارئ</div></div></div>' : '')
      + (s.totalDebt>0 ? '<div class="stat-card"><div class="stat-ic">🧾</div><div><div class="num">'+Math.round(s.totalDebt).toLocaleString('ar-EG')+'</div><div class="lbl">إجمالي المتبقي على قروضك</div></div></div>' : '')
      + ((s.totalOwedToYou>0 || s.totalDebt>0) ? '<div class="stat-card '+(s.netPosition<0?'danger':'')+'"><div class="stat-ic">📐</div><div><div class="num">'+Math.round(s.netPosition).toLocaleString('ar-EG')+'</div><div class="lbl">صافي وضعك المالي (مستحقاتك عند العملاء − قروضك المتبقية)</div></div></div>' : '');

    // توزيع الالتزامات الحالية بالنوع (شامل مصاريف البيت والقروض) — عشان
    // توضّح "ليه احتياجك اليومي/الشهري بالرقم ده بالظبط"، مش بس رقم إجمالي
    try{
      var byType = {};
      (db.commitments||[]).filter(function(c){ return c.active!==false; }).forEach(function(c){
        var key = c.type||'تانية';
        var share = typeof commitmentMonthlyShare==='function' ? commitmentMonthlyShare(c) : Number(c.amount||0);
        byType[key] = (byType[key]||0) + share;
      });
      if(s.r && s.r.houseTotal>0 && s.r.housePerDay) byType['🏠 بيت'] = s.r.housePerDay*30;
      if(s.r && s.r.loanMonthly>0) byType['💳 قروض'] = s.r.loanMonthly;
      var keys = Object.keys(byType).sort(function(a,b){ return byType[b]-byType[a]; });
      if(keys.length){
        var breakdownBox = document.getElementById('financialHealthTypeBreakdown');
        if(!breakdownBox){
          breakdownBox = document.createElement('div');
          breakdownBox.id = 'financialHealthTypeBreakdown';
          breakdownBox.style.marginTop = '10px';
          box.parentNode.appendChild(breakdownBox);
        }
        breakdownBox.innerHTML = '<div class="meta" style="margin-bottom:4px;">📊 توزيع التزاماتك الشهرية بالنوع:</div>'
          + '<div class="meta">' + keys.map(function(k){
              var icon = (typeof commitmentTypeInfo==='function' && !/^[🏠💳]/.test(k)) ? commitmentTypeInfo(k).icon+' ' : '';
              return icon+k+': '+Math.round(byType[k]).toLocaleString('ar-EG')+' ج.م';
            }).join(' — ') + '</div>';
      }
    }catch(e){ console.warn('[patches] فشل رسم توزيع الالتزامات بالنوع:', e); }
  };

  // [إصلاح] كانت بتدوّر على دالة اسمها renderPersonalCommitments (مش موجودة
  // في core.js أصلاً) فكانت دايمًا بترجع لـ renderFinance غلط. الاسم الصح
  // هو renderPersonalPage، وكمان الكارت لازم يترمي جوّه تاب "نظرة عامة"
  // (#personalTab-overview) مش جوّه #page-personal مباشرة، عشان يظهر
  // ويختفي صح مع تبديل التابات بدل ما يفضل ظاهر فوق كل التابات.
  var hookHealthTarget = typeof renderPersonalPage === 'function' ? 'renderPersonalPage' : 'renderFinance';
  var hookHealthContainerId = hookHealthTarget === 'renderPersonalPage'
    ? (document.getElementById('personalTab-overview') ? 'personalTab-overview' : 'page-personal')
    : 'page-finance';
  var origRenderFinanceHealth = window[hookHealthTarget];
  window[hookHealthTarget] = function(){
    origRenderFinanceHealth.apply(this, arguments);
    try{
      var page = document.getElementById(hookHealthContainerId);
      if(!page) return;
      if(!page.querySelector('#financialHealthCard')){
        var card = document.createElement('div');
        card.className = 'card';
        card.id = 'financialHealthCard';
        card.innerHTML = '<h3>📋 لوحة الصحة المالية الشخصية</h3><div id="financialHealthBox" class="grid-cards"></div>';
        page.appendChild(card);
      }
      renderFinancialHealthDashboard();
    }catch(e){ console.warn('[patches] فشل رسم لوحة الصحة المالية:', e); }
  };
})();

/* 32) خريطة سنوية للالتزامات — الـ12 شهر الجايين وإجمالي كل شهر،
   شامل الالتزامات الموسمية (كل 3/6/12 شهر) — عشان تشوف "الشهر
   التقيل" قبل ما يجيلك بفترة كافية تستعد له. */
(function(){
  // [إصلاح] لو core.js المحمّل نسخة قديمة مفيهاش currentYM/isCommitmentCycleMonth/
  // addMonthsYM (دوال الالتزامات غير الشهرية)، بنرجع لحساب مبسّط بيفترض إن
  // كل الالتزامات شهرية عادية (intervalMonths=1)، بدل ما نطلع Error ونوقف
  // الخريطة وكل حاجة بعدها في السلسلة (صندوق الطوارئ + القروض).
  var hasCycleHelpers = typeof currentYM==='function' && typeof isCommitmentCycleMonth==='function' && typeof addMonthsYM==='function';

  function fallbackAddMonthsYM(ym, n){
    var parts = ym.split('-'); var y = Number(parts[0]); var m = Number(parts[1]);
    var total = (y*12+(m-1))+n;
    var ny = Math.floor(total/12); var nm = (total%12)+1;
    return ny+'-'+(nm<10?'0':'')+nm;
  }

  function calcAnnualCommitmentsMap(){
    var nowYM = hasCycleHelpers ? currentYM() : todayStr().slice(0,7);
    var housePerDay = 0;
    try{ housePerDay = calcRequiredDailyCapacity().housePerDay||0; }catch(e){}
    var houseMonthly = housePerDay*30;
    var loanMonthly = (db.personalLoans||[]).filter(function(l){ return l.active!==false; })
      .reduce(function(s,l){ return s+Number(l.monthlyPayment||0); }, 0);
    var loanSchedule = typeof calcLoanMonthlyByMonthIndex==='function' ? calcLoanMonthlyByMonthIndex() : null;
    var months = [];
    for(var i=0;i<12;i++){
      var ym = hasCycleHelpers ? addMonthsYM(nowYM, i) : fallbackAddMonthsYM(nowYM, i);
      var byType = {};
      var commitmentsTotal = 0;
      (db.commitments||[]).filter(function(c){
        if(c.active===false) return false;
        return hasCycleHelpers ? isCommitmentCycleMonth(c, ym) : true; // بدون الدوال دي منقدرش نحدد دورة الالتزامات غير الشهرية، فبنعتبرها شهرية عادية
      }).forEach(function(c){
        var amt = Number(c.amount||0); // القيمة كاملة في شهر استحقاقها الفعلي (مش موزّعة) عشان يبان "الشهر التقيل" بوضوح
        var key = c.type||'تانية';
        byType[key] = (byType[key]||0) + amt;
        commitmentsTotal += amt;
      });
      // نصيب القروض للشهر ده تحديدًا — بيهبط ويوصل صفر لما القرض يتسدد
      // بدل ما يفضل ثابت طول الـ12 شهر حتى بعد ما ينتهي فعليًا
      var loanForMonth = loanSchedule ? loanSchedule[i] : loanMonthly;
      if(houseMonthly>0) byType['🏠 بيت'] = houseMonthly;
      if(loanForMonth>0) byType['💳 قروض'] = loanForMonth;
      months.push({ym:ym, commitmentsTotal:commitmentsTotal, houseMonthly:houseMonthly, loanMonthly:loanForMonth, byType:byType, total:commitmentsTotal+houseMonthly+loanForMonth});
    }
    return months;
  }

  window.renderAnnualCommitmentsMap = function(){
    var box = document.getElementById('annualCommitmentsMapBox');
    if(!box) return;
    if(db.financePassword && !window.financeUnlocked){ box.innerHTML=''; return; }
    var months = calcAnnualCommitmentsMap();
    var avg = months.reduce(function(s,m){return s+m.total;},0)/months.length;
    box.innerHTML = months.map(function(m, i){
      var label = new Date(m.ym+'-01').toLocaleDateString('ar-EG',{month:'long', year:'numeric'});
      var heavy = avg>0 && m.total > avg*1.2;
      var typeKeys = Object.keys(m.byType).sort(function(a,b){ return m.byType[b]-m.byType[a]; });
      var breakdown = typeKeys.length ? '<div class="meta" style="padding-right:2px;">'
        + typeKeys.map(function(k){
            var icon = (typeof commitmentTypeInfo==='function' && !/^[🏠💳]/.test(k)) ? commitmentTypeInfo(k).icon+' ' : '';
            return icon+k+': '+Math.round(m.byType[k]).toLocaleString('ar-EG')+' ج.م';
          }).join(' — ')
        + '</div>' : '';
      return '<div style="padding:8px 0;'+(i<months.length-1?'border-bottom:1px solid var(--border);':'')+'">'
        + '<div class="row" style="'+(i===0?'font-weight:800;':'')+'">'
        + '<span>'+(i===0?'📍 ':'')+label+(heavy?' <span class="meta">🔥 شهر تقيل</span>':'')+'</span>'
        + '<b style="color:'+(heavy?'var(--danger)':'inherit')+';">'+Math.round(m.total).toLocaleString('ar-EG')+' ج.م</b>'
        + '</div>'
        + breakdown
        + '</div>';
    }).join('');
  };

  // [إصلاح] نفس مشكلة القسم اللي فوق: اسم الدالة الصح renderPersonalPage
  // (مش renderPersonalCommitments اللي مش موجودة أصلاً)، والخريطة دي جدول
  // تفصيلي فمكانها الطبيعي تاب "التقارير" (#personalTab-reports) جنب
  // التقرير الشهري، مش جوّه #page-personal مباشرة برّه كل التابات.
  var hookMapTarget = typeof renderPersonalPage === 'function' ? 'renderPersonalPage' : 'renderFinance';
  var hookMapContainerId = hookMapTarget === 'renderPersonalPage'
    ? (document.getElementById('personalTab-reports') ? 'personalTab-reports' : 'page-personal')
    : 'page-finance';
  var origRenderFinanceAnnualMap = window[hookMapTarget];
  window[hookMapTarget] = function(){
    origRenderFinanceAnnualMap.apply(this, arguments);
    try{
      var page = document.getElementById(hookMapContainerId);
      if(!page) return;
      if(!page.querySelector('#annualCommitmentsMapCard')){
        var card = document.createElement('div');
        card.className = 'card';
        card.id = 'annualCommitmentsMapCard';
        card.innerHTML = '<h3>🗓️ خريطة سنوية للالتزامات</h3><p class="meta">إجمالي الالتزامات المتوقعة (شاملة الموسمية) لكل شهر من الـ12 شهر الجايين، عشان تشوف الشهر التقيل بدري.</p><div id="annualCommitmentsMapBox"></div>';
        page.appendChild(card);
      }
      renderAnnualCommitmentsMap();
    }catch(e){ console.warn('[patches] فشل رسم الخريطة السنوية للالتزامات:', e); }
  };
})();

/* 33) صندوق الطوارئ — لو الدخل وقف فجأة، هتقدر تعيش قد إيه؟
   بيقارن رصيد مدخرات (بتدخله يدويًا) بإجمالي التزاماتك الشهرية. */
(function(){
  window.calcEmergencyFundRunway = function(){
    var savings = Number(db.emergencyFundBalance)||0;
    var monthlyCommitments = (db.commitments||[]).filter(function(c){ return c.active!==false; })
      .reduce(function(s,c){ return s+(Number(c.amount||0)/(Number(c.intervalMonths)||1)); }, 0);
    var loanMonthly = (db.personalLoans||[]).filter(function(l){ return l.active!==false; })
      .reduce(function(s,l){ return s+Number(l.monthlyPayment||0); }, 0);
    var houseMonthly = calcRequiredDailyCapacity().housePerDay*30;
    var totalMonthly = monthlyCommitments + loanMonthly + houseMonthly;
    if(totalMonthly<=0) return null;
    return {savings:savings, totalMonthly:totalMonthly, months:savings/totalMonthly};
  };

  window.saveEmergencyFundBalance = function(){
    var input = document.getElementById('emergencyFundInput');
    if(!input) return;
    db.emergencyFundBalance = Number(input.value)||0;
    saveDB();
    renderEmergencyFundCard();
    renderFinancialHealthDashboard();
    toast('✅ اتحفظ رصيد صندوق الطوارئ');
  };

  window.renderEmergencyFundCard = function(){
    var box = document.getElementById('emergencyFundBox');
    if(!box) return;
    if(db.financePassword && !window.financeUnlocked){ box.innerHTML=''; return; }
    var ef = calcEmergencyFundRunway();
    var status = !ef ? {label:'', color:''}
      : ef.months>=6 ? {label:'قوي 💪', color:'var(--primary)'}
      : ef.months>=3 ? {label:'مقبول 👍', color:'var(--warn,#b8860b)'}
      : ef.months>=1 ? {label:'ضعيف ⚠️', color:'var(--danger)'}
      : {label:'خطر 🚨', color:'var(--danger)'};
    box.innerHTML = ''
      + '<div class="field"><label>رصيد مدخراتك الحالي (ج.م)</label><input id="emergencyFundInput" type="number" value="'+(db.emergencyFundBalance||0)+'"></div>'
      + '<button class="btn sm outline" onclick="saveEmergencyFundBalance()">💾 حفظ الرصيد</button>'
      + (ef ? ('<div class="meta" style="margin-top:10px;line-height:1.8;">لو الدخل وقف تمامًا النهاردة، مدخراتك هتغطي احتياجاتك الشهرية لمدة تقريبية: '
          + '<b style="color:'+status.color+';font-size:16px;"> '+ef.months.toFixed(1)+' شهر</b> ('+status.label+')'
          + '<br><span class="meta">إجمالي احتياجك الشهري: '+Math.round(ef.totalMonthly).toLocaleString('ar-EG')+' ج.م</span>'
          + '<br><span class="meta">المعدل الصحي المتعارف عليه: 3-6 شهور على الأقل</span></div>')
        : '<p class="meta" style="margin-top:8px;">أضف التزاماتك الشهرية الأول عشان نحسبلك المدة.</p>')
      + '<div class="meta" style="margin-top:8px;">ℹ️ الرصيد هنا منفصل عن "🎯 هدف الادخار" — تقدر ترحّل رصيد أي هدف ادخار تحققه هنا كإضافة لصندوق الطوارئ.</div>';
  };

  // [إصلاح] نفس المشكلة: الاسم الصح renderPersonalPage. صندوق الطوارئ
  // فيه إدخال بيانات (رصيد المدخرات) فمكانه الطبيعي تاب "القائمة"
  // (#personalTab-list) جنب هدف الادخار والالتزامات، مش برّه التابات.
  var hookEfTarget = typeof renderPersonalPage === 'function' ? 'renderPersonalPage' : 'renderFinance';
  var hookEfContainerId = hookEfTarget === 'renderPersonalPage'
    ? (document.getElementById('personalTab-list') ? 'personalTab-list' : 'page-personal')
    : 'page-finance';
  var origRenderFinanceEmergency = window[hookEfTarget];
  window[hookEfTarget] = function(){
    origRenderFinanceEmergency.apply(this, arguments);
    try{
      var page = document.getElementById(hookEfContainerId);
      if(!page) return;
      if(!page.querySelector('#emergencyFundCard')){
        var card = document.createElement('div');
        card.className = 'card';
        card.id = 'emergencyFundCard';
        card.innerHTML = '<h3>🧳 صندوق الطوارئ</h3><div id="emergencyFundBox"></div>';
        page.appendChild(card);
      }
      renderEmergencyFundCard();
    }catch(e){ console.warn('[patches] فشل رسم كارت صندوق الطوارئ:', e); }
  };
})();

/* 34) قروض شخصية بجدول سداد — مختلفة عن الالتزام الشهري العادي: ليها
   مبلغ أصلي، رصيد متبقي بينزل مع كل دفعة، ونسبة سداد واضحة. */
(function(){
  // [إصلاح] كلاس progress-track/progress-fill في index.html معرّف بس جوّه
  // .alert-banner، فشريط تقدّم سداد القرض هنا (جوّه .card عادي) كان
  // بيتعرض من غير أي شكل (بلا لون ولا ارتفاع). بنضيف تعريف عام مرة واحدة.
  if(!document.getElementById('rcLoanProgressStyle')){
    var styleTag = document.createElement('style');
    styleTag.id = 'rcLoanProgressStyle';
    styleTag.textContent = '.progress-track{background:rgba(0,0,0,0.08);border-radius:8px;height:8px;overflow:hidden;}'
      + '.progress-fill{background:var(--primary);height:100%;}';
    document.head.appendChild(styleTag);
  }

  function ensureLoansArray(){ if(!db.personalLoans) db.personalLoans=[]; return db.personalLoans; }

  // أيام متبقية لاستحقاق قسط القرض الشهري (زي commitmentDaysUntilDue بالظبط،
  // بس للقروض) — null لو مفيش يوم استحقاق متسجل أو القرض متسدد بالكامل
  function loanDaysUntilDue(l){
    if(!l.dueDay || l.active===false) return null;
    var today = todayStr();
    var parts = today.split('-').map(Number);
    var y = parts[0], m = parts[1];
    var lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    var day = Math.min(Number(l.dueDay), lastDay);
    var due = y+'-'+String(m).padStart(2,'0')+'-'+String(day).padStart(2,'0');
    return Math.round((new Date(due)-new Date(today))/86400000);
  }

  // إجمالي المديونية المتبقية على كل القروض النشطة (رقم واحد يلخّص "قد إيه لسه عليك")
  window.totalRemainingLoansDebt = function(){
    return ensureLoansArray().filter(function(l){ return l.active!==false; })
      .reduce(function(s,l){ return s+Number(l.remainingBalance||0); }, 0);
  };

  // جدول سداد القروض شهر بشهر (12 شهر جايين، index 0 = الشهر الحالي)، مراعيًا
  // إن القرض بيوقف يساهم في الالتزام الشهري بمجرد ما يتسدد بالكامل — بدل ما
  // نفترضه ثابت طول السنة زي ما كان بيحصل في الخريطة السنوية قبل كده
  window.calcLoanMonthlyByMonthIndex = function(){
    var loans = ensureLoansArray().filter(function(l){ return l.active!==false && Number(l.monthlyPayment)>0; });
    var perMonth = new Array(12).fill(0);
    loans.forEach(function(l){
      var remaining = Number(l.remainingBalance)||0;
      var pay = Number(l.monthlyPayment)||0;
      for(var i=0;i<12 && remaining>0;i++){
        var thisMonth = Math.min(pay, remaining);
        perMonth[i] += thisMonth;
        remaining -= thisMonth;
      }
    });
    return perMonth;
  };

  window.addPersonalLoan = function(){
    var desc = document.getElementById('loanDescInput').value.trim();
    var principal = Number(document.getElementById('loanPrincipalInput').value)||0;
    var monthlyPayment = Number(document.getElementById('loanMonthlyInput').value)||0;
    var dueDay = Number(document.getElementById('loanDueDayInput').value)||null;
    if(!desc || principal<=0){ toast('اكتب وصف القرض والمبلغ الأصلي على الأقل'); return; }
    ensureLoansArray().push({id:uid(), desc:desc, principal:principal, remainingBalance:principal, monthlyPayment:monthlyPayment, dueDay:dueDay, lastPaidMonth:null, startDate:todayStr(), active:true, payments:[]});
    saveDB();
    document.getElementById('loanDescInput').value='';
    document.getElementById('loanPrincipalInput').value='';
    document.getElementById('loanMonthlyInput').value='';
    document.getElementById('loanDueDayInput').value='';
    renderPersonalLoans();
    toast('✅ اتضاف القرض');
  };

  window.recordLoanPayment = async function(loanId){
    var loan = ensureLoansArray().find(function(l){ return l.id===loanId; });
    if(!loan) return;
    var suggested = loan.monthlyPayment || loan.remainingBalance;
    var input = prompt('قيمة الدفعة (ج.م):', suggested);
    if(input===null) return;
    var amount = Number(input)||0;
    if(amount<=0) return;
    loan.remainingBalance = Math.max(0, loan.remainingBalance - amount);
    loan.payments = loan.payments||[];
    loan.payments.push({date:todayStr(), amount:amount});
    loan.lastPaidMonth = typeof currentYM==='function' ? currentYM() : todayStr().slice(0,7);
    if(loan.remainingBalance<=0){ loan.active=false; logActivity('🏁 انتهى سداد قرض: '+loan.desc); }
    saveDB();
    renderPersonalLoans();
    if(typeof renderFinancialHealthDashboard==='function') renderFinancialHealthDashboard();
    toast(loan.active ? '✅ اتسجلت الدفعة' : '🎉 مبروك، اتسدد القرض بالكامل!');
  };

  window.deletePersonalLoan = async function(loanId){
    var ok = await appConfirm('هل تريد حذف هذا القرض نهائيًا؟', {okText:'حذف', cancelText:'إلغاء', danger:true});
    if(!ok) return;
    db.personalLoans = ensureLoansArray().filter(function(l){ return l.id!==loanId; });
    saveDB();
    renderPersonalLoans();
    if(typeof renderFinancialHealthDashboard==='function') renderFinancialHealthDashboard();
  };

  window.renderPersonalLoans = function(){
    var box = document.getElementById('personalLoansBox');
    if(!box) return;
    if(db.financePassword && !window.financeUnlocked){ box.innerHTML=''; return; }
    var loans = ensureLoansArray().slice().sort(function(a,b){ return (b.active?1:0)-(a.active?1:0); });
    var nowYM = typeof currentYM==='function' ? currentYM() : todayStr().slice(0,7);
    box.innerHTML = loans.length ? loans.map(function(l){
      var pct = l.principal>0 ? Math.round(((l.principal-l.remainingBalance)/l.principal)*100) : 0;
      var dueLine = '';
      if(l.active!==false && l.dueDay){
        var paidThisMonth = l.lastPaidMonth===nowYM;
        var diff = loanDaysUntilDue(l);
        if(!paidThisMonth && diff!=null){
          if(diff<0) dueLine = '<div class="meta" style="color:var(--danger);margin-top:4px;">⏰ متأخر '+Math.abs(diff)+' يوم عن يوم استحقاقه ('+l.dueDay+' من الشهر)</div>';
          else if(diff<=3) dueLine = '<div class="meta" style="color:var(--danger);margin-top:4px;">🔔 قسط القرض مستحق '+(diff===0?'النهاردة':diff===1?'بكرة':'خلال '+diff+' أيام')+'</div>';
        } else if(paidThisMonth){
          dueLine = '<div class="meta" style="margin-top:4px;">✅ مدفوع الشهر ده</div>';
        }
      }
      return '<div class="card" style="padding:12px;margin-bottom:10px;'+(!l.active?'opacity:.65;':'')+'">'
        + '<div class="row"><h3>'+escapeHtml(l.desc)+(!l.active?' <span class="meta">(مسدّد بالكامل ✅)</span>':'')+'</h3>'
        + '<button class="btn sm outline" onclick="deletePersonalLoan(\''+l.id+'\')">🗑️</button></div>'
        + '<div class="meta">المبلغ الأصلي: '+Number(l.principal).toLocaleString('ar-EG')+' ج.م — المتبقي: <b>'+Number(l.remainingBalance).toLocaleString('ar-EG')+' ج.م</b>'+(l.dueDay?' — 📅 يستحق يوم '+l.dueDay+' من كل شهر':'')+'</div>'
        + '<div class="progress-track" style="margin-top:6px;"><div class="progress-fill" style="width:'+pct+'%;"></div></div>'
        + '<div class="meta" style="margin-top:4px;">نسبة السداد: '+pct+'%</div>'
        + dueLine
        + (l.active ? '<button class="btn sm outline" style="margin-top:8px;" onclick="recordLoanPayment(\''+l.id+'\')">💵 تسجيل دفعة</button>' : '')
        + '</div>';
    }).join('') : '<p class="meta">لا توجد قروض مسجّلة.</p>';
  };

  // [إصلاح] نفس المشكلة: الاسم الصح renderPersonalPage. القروض فيها إدخال
  // وتشغيل يومي (إضافة قرض، تسجيل دفعات) فمكانها الطبيعي تاب "القائمة".
  var hookLoansTarget = typeof renderPersonalPage === 'function' ? 'renderPersonalPage' : 'renderFinance';
  var hookLoansContainerId = hookLoansTarget === 'renderPersonalPage'
    ? (document.getElementById('personalTab-list') ? 'personalTab-list' : 'page-personal')
    : 'page-finance';
  var origRenderFinanceLoans = window[hookLoansTarget];
  window[hookLoansTarget] = function(){
    origRenderFinanceLoans.apply(this, arguments);
    try{
      var page = document.getElementById(hookLoansContainerId);
      if(!page) return;
      if(!page.querySelector('#personalLoansCard')){
        var card = document.createElement('div');
        card.className = 'card';
        card.id = 'personalLoansCard';
        card.innerHTML = '<h3>💳 قروض شخصية بجدول سداد</h3>'
          + '<div class="field"><label>وصف القرض</label><input id="loanDescInput" type="text" placeholder="مثال: قرض سيارة"></div>'
          + '<div class="field"><label>المبلغ الأصلي (ج.م)</label><input id="loanPrincipalInput" type="number"></div>'
          + '<div class="field"><label>القسط الشهري المعتاد (ج.م) <span class="meta">— اختياري</span></label><input id="loanMonthlyInput" type="number"></div>'
          + '<div class="field"><label>يوم استحقاق القسط من الشهر <span class="meta">— اختياري</span></label><input id="loanDueDayInput" type="number" min="1" max="31" placeholder="مثال: 10"></div>'
          + '<button class="btn sm outline" onclick="addPersonalLoan()">➕ إضافة قرض</button>'
          + '<div id="personalLoansBox" style="margin-top:14px;"></div>';
        page.appendChild(card);
      }
      renderPersonalLoans();
    }catch(e){ console.warn('[patches] فشل رسم كارت القروض الشخصية:', e); }
  };
})();

/* 35) تجميع الأيقونات الخمسة (قفل / كثافة العرض / تباين / عرض للعميل / وضع ليلي)
   في قائمة منسدلة واحدة بدل ما تتكدس جنب بعض في الشريط العلوي. الأزرار
   الأصلية بتفضل موجودة في الـ DOM (مخفية بس) عشان كل المنطق اللي بيقرأ
   حالتها (applyDarkMode, toggleDisplayMode...) يفضل شغال زي ما هو. */
(function(){
  function setup(){
    if(document.getElementById('topbarMenuBtn')) return; // امنع التكرار
    var holder = document.querySelector('header.topbar > div:last-child');
    if(!holder) return;

    var themeBtn    = document.getElementById('themeToggleBtn');
    var displayBtn  = document.getElementById('displayModeBtn');
    var contrastBtn = document.getElementById('contrastToggleBtn');
    var densityBtn  = document.getElementById('densityToggleBtn');
    var lockBtn     = holder.querySelector('.small-link');

    var originals = [themeBtn, displayBtn, contrastBtn, densityBtn, lockBtn].filter(Boolean);
    if(originals.length < 5) return; // استنى لحد ما كل الأزرار الخمسة تتعمل

    // نخبّي الأزرار الأصلية بدل ما نمسحها، عشان أي كود تاني بيرجع لها بالـ id يفضل شغال
    originals.forEach(function(b){ b.style.display = 'none'; });

    if(!document.getElementById('topbarMenuStyle')){
      var styleTag = document.createElement('style');
      styleTag.id = 'topbarMenuStyle';
      styleTag.textContent =
        '.topbar-menu-wrap{display:inline-flex;}'+
        /* [إصلاح] الشريط العلوي فيه overflow:hidden على الموبايل عشان يمنع
           طفح محتواه، وده كان بيقص القائمة المنسدلة لو اتحطت جوّه الشريط
           كعنصر position:absolute. الحل: القائمة بقت position:fixed ومتضافة
           لـ body مباشرة (بره الشريط العلوي بالكامل)، ومكانها بيتحسب
           بالجافاسكريبت وقت الفتح (شوف openPanel) عشان متتقصش. */
        '.topbar-menu-panel{position:fixed;min-width:220px;max-width:calc(100vw - 24px);'+
          'background:var(--card,#fff);color:var(--text,#1a1a1a);border-radius:12px;'+
          'box-shadow:0 12px 30px rgba(0,0,0,.28);padding:6px;z-index:9999;display:none;}'+
        '.topbar-menu-panel.open{display:block;}'+
        '.topbar-menu-item{display:flex;align-items:center;gap:10px;width:100%;'+
          'background:none;border:0;text-align:right;padding:10px 12px;border-radius:8px;'+
          'font-size:14px;font-weight:700;cursor:pointer;color:inherit;}'+
        '.topbar-menu-item:active,.topbar-menu-item:hover{background:rgba(31,109,87,0.1);}'+
        '.topbar-menu-item .tmi-icon{font-size:16px;width:20px;text-align:center;flex-shrink:0;}'+
        '.topbar-menu-item .tmi-state{margin-inline-start:auto;font-size:11px;color:var(--muted,#888);}';
      document.head.appendChild(styleTag);
    }

    var wrap = document.createElement('div');
    wrap.className = 'topbar-menu-wrap';

    var toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'theme-toggle-btn';
    toggleBtn.id = 'topbarMenuBtn';
    toggleBtn.setAttribute('aria-label', 'المزيد من الخيارات');
    toggleBtn.textContent = '⋮';

    var panel = document.createElement('div');
    panel.className = 'topbar-menu-panel';
    panel.id = 'topbarMenuPanel';

    function itemDefs(){
      return [
        {
          icon: themeBtn.textContent.trim() || '🌙',
          label: 'الوضع الليلي',
          state: (document.documentElement.getAttribute('data-theme')==='dark') ? 'مفعّل' : 'متوقف',
          run: function(){ themeBtn.click(); }
        },
        {
          icon: '👁️',
          label: 'وضع عرض للعميل',
          state: displayBtn.classList.contains('active-display-mode') ? 'مفعّل' : 'متوقف',
          run: function(){ displayBtn.click(); }
        },
        {
          icon: '◐',
          label: 'تباين عالٍ',
          state: document.documentElement.classList.contains('high-contrast') ? 'مفعّل' : 'متوقف',
          run: function(){ contrastBtn.click(); }
        },
        {
          icon: densityBtn.textContent.trim() || '☰',
          label: 'كثافة العرض',
          state: document.documentElement.classList.contains('compact-view') ? 'مضغوط' : 'مريح',
          run: function(){ densityBtn.click(); }
        },
        {
          icon: '🔒',
          label: 'قفل التطبيق',
          state: '',
          run: function(){ lockBtn.click(); }
        }
      ];
    }

    function renderPanel(){
      panel.innerHTML = '';
      itemDefs().forEach(function(def){
        var item = document.createElement('button');
        item.type = 'button';
        item.className = 'topbar-menu-item';
        item.innerHTML =
          '<span class="tmi-icon">'+def.icon+'</span>'+
          '<span>'+def.label+'</span>'+
          (def.state ? '<span class="tmi-state">'+def.state+'</span>' : '');
        item.onclick = function(){
          closePanel();
          def.run();
        };
        panel.appendChild(item);
      });
    }

    function positionPanel(){
      var rect = toggleBtn.getBoundingClientRect();
      // نحط القائمة الأول عشان نقدر نقيس عرضها الفعلي (offsetWidth) بعد ما اتملت
      var panelWidth = panel.offsetWidth || 220;
      var left = rect.left; // نفس بداية الزر افتراضيًا
      // لو هتخرج بره يمين الشاشة، نلزقها بحافة الشاشة اليمين بمسافة أمان 12px
      if(left + panelWidth > window.innerWidth - 12){
        left = window.innerWidth - panelWidth - 12;
      }
      if(left < 12) left = 12;
      var top = rect.bottom + 8;
      var maxTop = window.innerHeight - 12;
      panel.style.left = left + 'px';
      panel.style.top = Math.min(top, maxTop) + 'px';
    }

    function openPanel(){
      renderPanel();
      panel.classList.add('open');
      positionPanel(); // تحسب المكان بعد ما تتملى وتظهر عشان offsetWidth يبقى صحيح
      document.addEventListener('click', onOutsideClick, true);
      window.addEventListener('scroll', positionPanel, true);
      window.addEventListener('resize', positionPanel);
    }
    function closePanel(){
      panel.classList.remove('open');
      document.removeEventListener('click', onOutsideClick, true);
      window.removeEventListener('scroll', positionPanel, true);
      window.removeEventListener('resize', positionPanel);
    }
    function onOutsideClick(e){
      if(!wrap.contains(e.target) && !panel.contains(e.target)) closePanel();
    }

    toggleBtn.onclick = function(e){
      e.stopPropagation();
      if(panel.classList.contains('open')) closePanel();
      else openPanel();
    };

    wrap.appendChild(toggleBtn);
    holder.appendChild(wrap);
    document.body.appendChild(panel); // بره الشريط العلوي خالص عشان overflow:hidden متأثرش عليها
  }

  // الأزرار التانية بتتضاف بترتيب مختلف في الملف، فبنستنى لحد ما تخلص كلها
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(setup, 0); });
  } else {
    setTimeout(setup, 0);
  }
})();

})(); /* نهاية الملف — إغلاق الـ IIFE الرئيسية */

