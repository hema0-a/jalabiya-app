/* ============================================================
   ملف رقعة جديد منفصل (مش هيتضاف داخل core.js ولا patches.js)
   يحتوي على ميزتين فقط، كل ميزة في IIFE مستقلة:
   1) جدولة سعة الورشة القادمة (10 أيام) في الصفحة الرئيسية
   2) تذكير (يدوي بضغطة واحدة، أو جماعي) لأصحاب الطلبات المتأخرة عبر واتساب
   ملحوظة: renderHome بيتلف مرة واحدة بس هنا لكل الميزتين مع بعض
   (تعلمنا من تجربة renderOrders اللي كانت متلفوفة مرتين بالغلط)
   ============================================================ */
(function(){
  if(window.__capacityRemindersLoaded) return;
  window.__capacityRemindersLoaded = true;

  /* ---------- 1) جدولة السعة القادمة ---------- */
  function buildCapacityScheduleHtml(){
    var capacity = Number(db.dailyCapacity)||500;
    var days = [];
    var base = new Date();
    for(var i=0;i<10;i++){
      var day = new Date(base.getFullYear(), base.getMonth(), base.getDate()+i);
      var key = day.toISOString().slice(0,10);
      var value = db.orders.filter(function(o){
        return o.status!=='تم التسليم' && o.dateDelivery===key;
      }).reduce(function(s,o){ return s + orderTotal(o); }, 0);
      var pct = capacity>0 ? Math.round((value/capacity)*100) : 0;
      days.push({key:key, value:value, pct:pct});
    }

    var overDays = days.filter(function(d){ return d.pct>100; });
    var summary = overDays.length>0
      ? '<div class="alert-banner danger" style="margin-bottom:10px;"><span class="ic">⚠️</span><div>'
        + 'عندك <b>'+overDays.length+'</b> يوم من أصل 10 أيام جايين فوق طاقتك اليومية ('+capacity.toLocaleString('ar-EG')+' ج.م). '
        + 'فكّر تأجل استلام طلبات جديدة لتلك الأيام أو تزود الطاقة اليومية من الإعدادات.</div></div>'
      : '<div class="meta" style="margin-bottom:8px;">طاقتك اليومية الحالية: '+capacity.toLocaleString('ar-EG')+' ج.م — تقدر تغيّرها من الإعدادات.</div>';

    var rows = days.map(function(d){
      var color = d.pct>100 ? 'var(--danger)' : (d.pct>=70 ? '#C89B2C' : 'var(--ok)');
      var barPct = Math.min(d.pct, 100);
      return '<div style="margin-bottom:9px;">'
        + '<div class="meta" style="display:flex;justify-content:space-between;">'
        +   '<span>'+fmtDate(d.key)+'</span>'
        +   '<span>'+d.value.toLocaleString('ar-EG')+' / '+capacity.toLocaleString('ar-EG')+' ج.م ('+d.pct+'%)</span>'
        + '</div>'
        + '<div style="background:var(--stitch,#e5e0d5);border-radius:6px;height:8px;overflow:hidden;">'
        +   '<div style="width:'+barPct+'%;height:100%;background:'+color+';"></div>'
        + '</div>'
        + '</div>';
    }).join('');

    return summary + rows;
  }

  function ensureCapacityWidget(){
    if(document.getElementById('widget-capacity')) return;
    var container = document.getElementById('homeWidgetsContainer');
    if(!container) return;
    var wrap = document.createElement('div');
    wrap.id = 'widget-capacity';
    wrap.className = 'home-widget';
    wrap.innerHTML = '<div class="section-title">📊 جدولة السعة القادمة (10 أيام)</div><div id="capacityScheduleBox"></div>';
    var lateWidget = document.getElementById('widget-late');
    if(lateWidget && lateWidget.parentNode===container){
      container.insertBefore(wrap, lateWidget);
    } else {
      container.appendChild(wrap);
    }
  }

  function renderCapacityWidget(){
    ensureCapacityWidget();
    var box = document.getElementById('capacityScheduleBox');
    if(box) box.innerHTML = buildCapacityScheduleHtml();
  }

  /* ---------- 2) تذكير الطلبات المتأخرة ---------- */
  function lateOrdersList(){
    return db.orders.filter(isOverdue).sort(function(a,b){
      return (a.dateDelivery||'').localeCompare(b.dateDelivery||'');
    });
  }

  window.sendLateOrderReminder = function(orderId){
    var o = db.orders.find(function(x){ return x.id===orderId; });
    if(!o) return;
    var c = customerById(o.customerId);
    if(!c || !c.phone){ toast('لا يوجد رقم هاتف مسجل لهذا العميل'); return; }
    var phone = c.phone.replace(/[^0-9]/g,'');
    if(phone.indexOf('0')===0) phone = '2'+phone;
    var msg = 'تذكير من '+(db.workshopName||'ورشة تفصيل الجلابيب')+' 🧵\n'
      + 'حضرتك، طلبك ('+orderTypeLabel(o)+') كان المفروض يتسلم في '+fmtDate(o.dateDelivery)+' ولسه متأخر شوية.\n'
      + 'تقدر تمر تستلمه في أقرب وقت يناسبك 🙏';
    openExternalLink('https://wa.me/'+phone+'?text='+encodeURIComponent(msg));
    o.lastReminderSentAt = todayStr();
    saveDB();
    logActivity('🔔 إرسال تذكير تأخير لـ '+c.name);
    renderLateOrdersWithReminders();
  };

  window.sendAllLateReminders = function(){
    var today = todayStr();
    var candidates = lateOrdersList().filter(function(o){
      var c = customerById(o.customerId);
      return c && c.phone && o.lastReminderSentAt!==today;
    });
    if(candidates.length===0){ toast('مفيش طلبات متأخرة محتاجة تذكير دلوقتي'); return; }
    appConfirm('هيتفتح '+candidates.length+' رسالة واتساب واحدة ورا التانية، تحب تكمل؟', {okText:'إرسال', danger:false}).then(function(ok){
      if(!ok) return;
      var i = 0;
      function next(){
        if(i>=candidates.length) return;
        window.sendLateOrderReminder(candidates[i].id);
        i++;
        setTimeout(next, 700);
      }
      next();
    });
  };

  function renderLateOrdersWithReminders(){
    var container = document.getElementById('homeLate');
    if(!container) return;
    var late = lateOrdersList();
    var today = todayStr();

    container.innerHTML = late.length ? late.map(function(o){
      var c = customerById(o.customerId);
      var already = o.lastReminderSentAt===today;
      var hasPhone = c && c.phone;
      return '<div class="card" style="border-right-color:var(--danger)">'
        + '<div class="row"><h3 class="name-row">'+avatarChip(c?c.name:'؟')+(c?escapeHtml(c.name):'عميل محذوف')+' - '+escapeHtml(orderTypeLabel(o))+'</h3><span class="tag-late-text">متأخر ⏰</span></div>'
        + '<div class="meta">كان يجب التسليم في: '+fmtDate(o.dateDelivery)+'</div>'
        + (already ? '<div class="meta" style="color:var(--ok);">✅ اتبعت تذكير النهاردة</div>' : '')
        + '<div class="btn-row">'
        +   (hasPhone
              ? '<button class="btn sm outline" onclick="sendLateOrderReminder(\''+o.id+'\')">🔔 إرسال تذكير</button>'
              : '<span class="meta">مفيش رقم هاتف مسجل</span>')
        + '</div></div>';
    }).join('') : '<div class="empty-msg">لا توجد طلبات متأخرة 👍</div>';

    var existingBar = document.getElementById('lateRemindAllBar');
    var needReminder = late.filter(function(o){
      var c = customerById(o.customerId);
      return c && c.phone && o.lastReminderSentAt!==today;
    });
    var lateWidget = document.getElementById('widget-late');
    if(needReminder.length>0 && lateWidget){
      if(!existingBar){
        existingBar = document.createElement('div');
        existingBar.id = 'lateRemindAllBar';
        existingBar.className = 'alert-banner danger';
        existingBar.style.marginBottom = '10px';
        var title = lateWidget.querySelector('.section-title');
        if(title && title.nextSibling){
          lateWidget.insertBefore(existingBar, title.nextSibling);
        } else {
          lateWidget.insertBefore(existingBar, lateWidget.firstChild);
        }
      }
      existingBar.innerHTML = '<span class="ic">🔔</span><div>عندك <b>'+needReminder.length+'</b> طلب متأخر لسه ما اتبعتلوش تذكير النهاردة. '
        + '<button class="btn sm accent" style="margin-top:6px;" onclick="sendAllLateReminders()">إرسال تذكير للكل</button></div>';
    } else if(existingBar){
      existingBar.remove();
    }
  }

  /* ---------- لفة واحدة فقط لـ renderHome، للميزتين مع بعض ---------- */
  var origRenderHome = renderHome;
  renderHome = function(){
    origRenderHome.apply(this, arguments);
    renderCapacityWidget();
    renderLateOrdersWithReminders();
  };
})();
