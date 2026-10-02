/* ============================================================
   patches-cloud-admin.js - المزامنة السحابية والإدارة
   [الجزء 4 من 4 من patches.js القديم - الملف الأخير]
   
   المحتوى:
   - حماية المزامنة السحابية من سباق التحميل
   - النسخ الاحتياطية السحابية اليومية
   - تبديل رمز الربط
   - تنبيه النسخة الاحتياطية المتأخرة
   - حفظ التسليم مع تسجيل دفعة تلقائي
   - أداة دمج العملاء المكررين
   - أداة تجميع القياسات المتقاربة
   - صلاحيات المالك/المدير/الاستقبال
   - قفل صفحة المالية
   - قائمة الشريط العلوي الموحدة (⋮)
   - تقييد وضع الاستقبال
   - كشف موسم الذروة
   ============================================================ */

(function() {
  if (window.__patchesCloudAdminLoaded) return;
  window.__patchesCloudAdminLoaded = true;

  console.log('☁️ تحميل patches-cloud-admin.js...');

  /* ============================================================
     [1] حماية المزامنة السحابية من سباق التحميل
     ============================================================ */
  var blockCloudPush = false;

  if (typeof pushToCloud === 'function' && !pushToCloud.__safeWrapped) {
    var origPushToCloud = pushToCloud;
    pushToCloud = async function() {
      if (blockCloudPush) return;
      try {
        // فحص أمان: هل البيانات المحلية أقل بشكل مريب من السحابة؟
        if (cloudDb && db && db.cloudSync && db.cloudSync.enabled && db.cloudSync.syncId) {
          var ref = cloudDb.collection('workshops').doc(db.cloudSync.syncId);
          var snap = await ref.get();
          if (snap.exists) {
            var remote = snap.data() || {};
            var remoteC = (remote.customers || []).length;
            var remoteO = (remote.orders || []).length;
            var localC = (db.customers || []).length;
            var localO = (db.orders || []).length;
            var suspicious = (remoteC > 0 && localC === 0) ||
              (remoteO > 0 && localO === 0) ||
              (remoteC - localC > 5) ||
              (remoteO - localO > 5);
            if (suspicious) {
              console.warn('⛔ تم إيقاف الرفع وقائيًا — البيانات المحلية أقل من السحابة');
              return;
            }
          }
        }
      } catch (e) { return; }

      var r = await origPushToCloud.apply(this, arguments);
      if (typeof scheduleDailyCloudBackup === 'function') {
        scheduleDailyCloudBackup();
      }
      return r;
    };
    pushToCloud.__safeWrapped = true;
  }

  function guardCloudConnect(fn) {
    return async function() {
      blockCloudPush = true;
      try {
        return await fn.apply(this, arguments);
      } finally {
        setTimeout(function() { blockCloudPush = false; }, 8000);
      }
    };
  }

  if (typeof connectCloudSyncSpace === 'function' && !connectCloudSyncSpace.__guarded) {
    connectCloudSyncSpace = guardCloudConnect(connectCloudSyncSpace);
    connectCloudSyncSpace.__guarded = true;
  }
  if (typeof createCloudSyncSpace === 'function' && !createCloudSyncSpace.__guarded) {
    createCloudSyncSpace = guardCloudConnect(createCloudSyncSpace);
    createCloudSyncSpace.__guarded = true;
  }

  /* ============================================================
     [2] النسخ الاحتياطية السحابية اليومية
     ============================================================ */
  window.scheduleDailyCloudBackup = function() {
    try {
      if (!cloudDb || !db.cloudSync || !db.cloudSync.enabled || !db.cloudSync.syncId) return;
      var today = new Date().toISOString().slice(0, 10);
      if (db.__lastCloudBackupDate === today) return;
      var safeData = JSON.parse(JSON.stringify(db));
      cloudDb.collection('workshops').doc(db.cloudSync.syncId)
        .collection('backups').doc(today).set(safeData)
        .then(function() {
          db.__lastCloudBackupDate = today;
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch (e) { /* تجاهل */ }
        }).catch(function() { /* تجاهل */ });
    } catch (e) { /* تجاهل */ }
  };

  window.backupNowToCloud = async function() {
    if (!cloudDb || !db.cloudSync || !db.cloudSync.enabled || !db.cloudSync.syncId) {
      toast('المزامنة السحابية لازم تكون مفعّلة الأول');
      return;
    }
    try {
      var key = new Date().toISOString().replace(/[:.]/g, '-');
      var safeData = JSON.parse(JSON.stringify(db));
      await cloudDb.collection('workshops').doc(db.cloudSync.syncId)
        .collection('backups').doc(key).set(safeData);
      toast('✅ اتحفظت نسخة احتياطية سحابية دلوقتي');
    } catch (e) {
      toast('⚠️ فشل حفظ النسخة: ' + (e && (e.code || e.message) || 'خطأ'));
    }
  };

  window.listCloudBackups = async function() {
    if (!cloudDb || !db.cloudSync || !db.cloudSync.enabled || !db.cloudSync.syncId) {
      toast('المزامنة السحابية لازم تكون مفعّلة الأول');
      return;
    }
    var box = document.getElementById('cloudBackupsListBox');
    if (!box) return;
    box.innerHTML = '<p class="meta">⏳ جاري التحميل...</p>';
    try {
      var qs = await cloudDb.collection('workshops').doc(db.cloudSync.syncId)
        .collection('backups').orderBy('updatedAt', 'desc').limit(30).get();
      if (qs.empty) {
        box.innerHTML = '<p class="meta">لا توجد نسخ احتياطية سحابية بعد.</p>';
        return;
      }
      var rows = [];
      qs.forEach(function(doc) {
        var d = doc.data();
        var custN = (d.customers || []).length;
        var ordN = (d.orders || []).length;
        var dt = d.updatedAt ? new Date(d.updatedAt).toLocaleString('ar-EG') : doc.id;
        rows.push('<div class="card" style="padding:10px;margin-bottom:8px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">' +
          '<div><b>' + doc.id + '</b><br><span class="meta">' + dt +
          ' — ' + custN + ' عميل / ' + ordN + ' طلب</span></div>' +
          '<button class="btn sm outline" onclick="restoreCloudBackup(\'' + doc.id + '\')">استرجاع</button>' +
          '</div></div>');
      });
      box.innerHTML = rows.join('');
    } catch (e) {
      box.innerHTML = '<p class="meta">⚠️ تعذر تحميل القائمة: ' +
        (e && (e.code || e.message) || 'خطأ غير معروف') + '</p>';
    }
  };

  window.restoreCloudBackup = async function(backupId) {
    var ok = await appConfirm('هل تريد استرجاع النسخة الاحتياطية بتاريخ ' + backupId +
      '؟ سيتم استبدال كل البيانات الحالية على هذا الجهاز بها.',
      { okText: 'استرجاع', cancelText: 'إلغاء', danger: true });
    if (!ok) return;
    try {
      var docSnap = await cloudDb.collection('workshops').doc(db.cloudSync.syncId)
        .collection('backups').doc(backupId).get();
      if (!docSnap.exists) { toast('⚠️ النسخة دي مش موجودة'); return; }
      var restored = docSnap.data();
      var mySettings = db.cloudSync;
      db = restored;
      db.cloudSync = mySettings;
      fillMissingDefaults();
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch (e) { /* تجاهل */ }
      renderAll();
      toast('✅ تم استرجاع النسخة الاحتياطية بنجاح');
    } catch (e) {
      toast('⚠️ فشل الاسترجاع: ' + (e && (e.code || e.message) || 'خطأ'));
    }
  };

  /* ============================================================
     [3] تبديل رمز الربط
     ============================================================ */
  window.rotateCloudSyncCode = async function() {
    if (!db.cloudSync || !db.cloudSync.enabled || !db.cloudSync.syncId) {
      toast('لازم تكون المزامنة السحابية مفعّلة الأول');
      return;
    }
    var ok = await appConfirm(
      'هيتم إنشاء رمز ربط جديد ونقل بياناتك الحالية ليه. الرمز القديم مش هيقدر يزامن بيانات جديدة تاني. هل تريد المتابعة؟',
      { okText: 'توليد رمز جديد', cancelText: 'إلغاء', danger: true }
    );
    if (!ok) return;
    try {
      var newSyncId = randomSyncId();
      var safeData = JSON.parse(JSON.stringify(db));
      await cloudDb.collection('workshops').doc(newSyncId).set(safeData);
      db.cloudSync.syncId = newSyncId;
      saveDB(true);
      if (typeof cloudUnsub === 'function') {
        cloudUnsub();
        cloudUnsub = null;
      }
      initCloudSync();
      if (typeof renderCloudSyncCard === 'function') renderCloudSyncCard();
      toast('✅ اتعمل رمز ربط جديد — انسخه واحفظه في مكان آمن فورًا');
    } catch (e) {
      toast('⚠️ فشل توليد الرمز: ' + (e && (e.code || e.message) || 'خطأ'));
    }
  };

  /* ============================================================
     [4] تنبيه النسخة الاحتياطية المتأخرة
     ============================================================ */
  if (typeof renderHomeAlerts === 'function') {
    var origRHA_staleBackup = renderHomeAlerts;
    renderHomeAlerts = function() {
      origRHA_staleBackup.apply(this, arguments);
      if (!(db.cloudSync && db.cloudSync.enabled && db.cloudSync.syncId)) return;
      var box = document.getElementById('homeAlerts');
      if (!box) return;
      var last = db.__lastCloudBackupDate;
      var days = last ? Math.round((new Date(todayStr()) - new Date(last)) / 86400000) : null;
      if (days === null || days >= 3) {
        var msg = days === null
          ? 'لم تُحفظ أي نسخة احتياطية سحابية بعد — افتح الإعدادات واضغط "🗄️ احفظ نسخة الآن".'
          : 'لم تُحفظ نسخة احتياطية سحابية منذ ' + days + ' يوم — تأكد من اتصال الجهاز بالنت.';
        box.insertAdjacentHTML('beforeend',
          '<div class="alert-banner warn"><span class="ic">☁️</span><div>' +
          '<b>النسخة الاحتياطية السحابية اليومية متأخرة</b>' + msg + '</div></div>');
      }
    };
  }

  /* ============================================================
     [5] حفظ التسليم مع تسجيل دفعة تلقائي
     ============================================================ */
  if (typeof markOrderDelivered === 'function') {
    var origMOD_payment = markOrderDelivered;
    markOrderDelivered = async function(orderId) {
      origMOD_payment.apply(this, arguments);
      var o = db.orders.find(function(x) { return x.id === orderId; });
      if (o) {
        var remaining = orderRemaining(o);
        if (remaining > 0) {
          var ok = await appConfirm(
            'باقي على العميل ' + remaining.toLocaleString('ar-EG') + ' ج.م. هل تريد تسجيل الدفعة دلوقتي؟',
            { okText: 'تسجيل الدفعة', cancelText: 'لاحقًا', danger: false }
          );
          if (ok && typeof openPaymentModal === 'function') {
            openPaymentModal(orderId);
          }
        }
      }
    };
  }

  /* ============================================================
     [6] أداة دمج العملاء المكررين
     ============================================================ */
  function findDuplicateCustomers() {
    var byPhone = {};
    (db.customers || []).forEach(function(c) {
      var p = (c.phone || '').trim();
      if (!p) return;
      if (!byPhone[p]) byPhone[p] = [];
      byPhone[p].push(c);
    });
    var dups = [];
    Object.keys(byPhone).forEach(function(p) {
      if (byPhone[p].length > 1) dups.push(byPhone[p]);
    });
    return dups;
  }

  window.renderDuplicateCustomersUI = function() {
    var box = document.getElementById('duplicateCustomersBox');
    if (!box) return;
    var dups = findDuplicateCustomers();
    window.__dupGroups = dups;
    if (!dups.length) {
      box.innerHTML = '<p class="meta">مفيش عملاء مكررين حاليًا 👍</p>';
      return;
    }
    box.innerHTML = dups.map(function(group, gi) {
      var rows = group.map(function(c, i) {
        var ordersCount = db.orders.filter(function(o) { return o.customerId === c.id; }).length;
        return '<label style="display:block;margin:6px 0;">' +
          '<input type="radio" name="dupKeep' + gi + '" value="' + c.id + '" ' + (i === 0 ? 'checked' : '') + '> ' +
          escapeHtml(c.name) + ' <span class="meta">(' + ordersCount + ' طلب)</span></label>';
      }).join('');
      return '<div class="card" style="padding:10px;margin-bottom:10px;">' +
        '<p class="meta">نفس رقم الهاتف (' + escapeHtml(group[0].phone) + '):</p>' +
        rows +
        '<button class="btn sm outline" style="margin-top:8px;" onclick="mergeDuplicateGroup(' + gi + ')">🔗 دمج في المختار</button>' +
        '</div>';
    }).join('');
  };

  window.mergeDuplicateGroup = async function(gi) {
    var group = (window.__dupGroups || [])[gi];
    if (!group) return;
    var radios = document.getElementsByName('dupKeep' + gi);
    var keepId = null;
    for (var i = 0; i < radios.length; i++) {
      if (radios[i].checked) keepId = radios[i].value;
    }
    if (!keepId) return;
    var ok = await appConfirm(
      'هيتم نقل كل طلبات باقي النسخ المكررة لهذا العميل، وحذف النسخ التانية نهائيًا. هل أنت متأكد؟',
      { okText: 'دمج', cancelText: 'إلغاء', danger: true }
    );
    if (!ok) return;
    group.forEach(function(c) {
      if (c.id === keepId) return;
      db.orders.forEach(function(o) { if (o.customerId === c.id) o.customerId = keepId; });
      db.customers = db.customers.filter(function(x) { return x.id !== c.id; });
    });
    logActivity('🔗 دمج عملاء مكررين لنفس الرقم');
    saveDB(true);
    renderCustomers();
    renderDuplicateCustomersUI();
    toast('✅ تم الدمج بنجاح');
  };

  if (typeof renderSettings === 'function') {
    var origRS_dup = renderSettings;
    renderSettings = function() {
      origRS_dup.apply(this, arguments);
      var page = document.getElementById('page-settings');
      if (!page) return;
      if (page.querySelector('#duplicateCustomersCard')) {
        renderDuplicateCustomersUI();
        return;
      }
      var card = document.createElement('div');
      card.className = 'card';
      card.id = 'duplicateCustomersCard';
      card.innerHTML = '<h3>🔗 دمج عملاء مكررين</h3>' +
        '<p class="meta">بتكتشف تلقائيًا أي عملاء عندهم نفس رقم الهاتف، وتسيبك تدمجهم في نسخة واحدة مع نقل كل طلباتهم.</p>' +
        '<div id="duplicateCustomersBox"></div>';
      page.appendChild(card);
      renderDuplicateCustomersUI();
    };
  }

  /* ============================================================
     [7] أداة تجميع القياسات المتقاربة
     ============================================================ */
  function getCustomerMeasurements(customerId) {
    var c = customerById(customerId);
    if (!c) return null;
    var chest = Number(c.chest);
    if (!chest) return null;
    return {
      chest: chest,
      waist: Number(c.waist) || null,
      length: Number(c.length) || null,
      sleeve: Number(c.sleeve) || null,
      shoulder: Number(c.shoulder) || null,
      name: c.name
    };
  }

  function orderGarmentType(o) {
    if (Array.isArray(o.items) && o.items.length) return o.items[0].type || '';
    return o.type || '';
  }

  function buildClusters(garmentTypeName, tolerance, onlyInProgress) {
    var candidates = db.orders.filter(function(o) {
      if (onlyInProgress && o.status !== 'قيد العمل') return false;
      if (garmentTypeName && orderGarmentType(o) !== garmentTypeName) return false;
      return true;
    }).map(function(o) {
      var m = getCustomerMeasurements(o.customerId);
      if (!m) return null;
      return { order: o, m: m };
    }).filter(Boolean);

    candidates.sort(function(a, b) { return a.m.chest - b.m.chest; });

    var clusters = [];
    var current = null;
    candidates.forEach(function(item) {
      if (current && Math.abs(item.m.chest - current.anchor) <= tolerance) {
        current.items.push(item);
      } else {
        current = { anchor: item.m.chest, items: [item] };
        clusters.push(current);
      }
    });
    return clusters.filter(function(c) { return c.items.length >= 2; });
  }

  function diffTxt(val, anchor, label) {
    if (val === null || val === undefined) return '';
    var d = val - anchor;
    var sign = d > 0 ? '+' + d : (d < 0 ? d : '=');
    return label + ': ' + val + ' (' + sign + ')';
  }

  window.renderMeasurementClusters = function() {
    var box = document.getElementById('clusterResultsBox');
    if (!box) return;
    var type = document.getElementById('clusterGarmentType').value;
    var tol = Number(document.getElementById('clusterTolerance').value) || 2;
    var onlyWip = document.getElementById('clusterOnlyWip').checked;
    var clusters = buildClusters(type, tol, onlyWip);

    if (!clusters.length) {
      box.innerHTML = '<p class="meta">مفيش مجموعات قياسات متقاربة حاليًا بالمعايير دي.</p>';
      return;
    }
    box.innerHTML = clusters.map(function(cl, ci) {
      var base = cl.items[0].m;
      var rows = cl.items.map(function(it) {
        var m = it.m;
        var parts = [
          diffTxt(m.waist, base.waist, 'الخصر'),
          diffTxt(m.length, base.length, 'الطول'),
          diffTxt(m.sleeve, base.sleeve, 'الكم'),
          diffTxt(m.shoulder, base.shoulder, 'الكتف')
        ].filter(Boolean).join(' | ');
        return '<div style="padding:8px 0;border-bottom:1px solid var(--border);">' +
          '<b>' + escapeHtml(m.name) + '</b> — صدر ' + m.chest +
          (parts ? ('<br><span class="meta">' + parts + '</span>') : '') +
          '</div>';
      }).join('');
      return '<div class="card" style="padding:12px;margin-bottom:10px;">' +
        '<p class="meta">مجموعة ' + (ci + 1) + ' — ' + cl.items.length +
        ' طلب حول قياس صدر ' + base.chest + '</p>' +
        rows + '</div>';
    }).join('');
  };

  window.openMeasurementClusterTool = function() {
    var typeOptions = '<option value="">كل الأنواع</option>' +
      db.garmentTypes.slice().sort(function(a, b) {
        return a.name.localeCompare(b.name, 'ar');
      }).map(function(g) {
        return '<option value="' + escapeHtml(g.name) + '">' + escapeHtml(g.name) + '</option>';
      }).join('');
    openModal(
      '<div class="modal-head"><h3>📐 تجميع القياسات المتقاربة</h3><button class="modal-close" onclick="closeModal()">✕</button></div>' +
      '<p class="meta">بتجمع الطلبات اللي قياساتها قريبة من بعض حسب قياس الصدر، عشان تقدر تقطّع أكتر من قطعة بنفس القالب مرة واحدة.</p>' +
      '<div class="field"><label>نوع اللبس</label><select id="clusterGarmentType">' + typeOptions + '</select></div>' +
      '<div class="field"><label>نطاق التقارب (سم)</label><input id="clusterTolerance" type="number" value="2" min="0" step="0.5"></div>' +
      '<label style="display:flex;align-items:center;gap:6px;margin:8px 0;">' +
      '<input type="checkbox" id="clusterOnlyWip" checked> بس الطلبات "قيد العمل"</label>' +
      '<button class="btn" onclick="renderMeasurementClusters()">🔎 جمّع دلوقتي</button>' +
      '<div id="clusterResultsBox" style="margin-top:14px;"></div>'
    );
    renderMeasurementClusters();
  };

  var origRO_cluster = renderOrders;
  renderOrders = function() {
    origRO_cluster.apply(this, arguments);
    var filters = document.getElementById('orderStatusFilters');
    if (!filters || filters.querySelector('#openClusterToolBtn')) return;
    var btn = document.createElement('button');
    btn.id = 'openClusterToolBtn';
    btn.type = 'button';
    btn.className = 'btn sm outline';
    btn.textContent = '📐 قياسات متقاربة';
    btn.addEventListener('click', function() { openMeasurementClusterTool(); });
    filters.appendChild(btn);
  };

  /* ============================================================
     [8] صلاحيات المالك/المدير/الاستقبال + قفل المالية
     ============================================================ */
  function injectSecuritySettings() {
    try {
      var cards = document.querySelectorAll('#page-settings .card');
      var anchorCard = null;
      cards.forEach(function(c) {
        var h3 = c.querySelector('h3');
        if (h3 && h3.textContent.indexOf('تغيير الرقم السري') !== -1) anchorCard = c;
      });
      if (!anchorCard) return;
      var lastInserted = anchorCard;

      // بطاقة رقم المدير
      if (!document.getElementById('managerPinCard')) {
        var mCard = document.createElement('div');
        mCard.className = 'card';
        mCard.id = 'managerPinCard';
        mCard.innerHTML =
          '<h3>🗂️ رقم سري لوضع المدير (اختياري)</h3>' +
          '<p class="meta">رقم سري تالت مختلف عن رقمك الأساسي وعن رقم الاستقبال — لو حد دخل بيه هيقدر يشتغل بكل الصفحات (الطلبات، العملاء، المواعيد، المصروفات، المالية) ما عدا صفحة الإعدادات. سيبه فاضي لإلغاء الميزة.</p>' +
          '<div class="field"><label>رقم سري المدير (4 أرقام)</label>' +
          '<input type="tel" maxlength="4" id="managerPinInput" inputmode="numeric" autocomplete="off" class="pin-input" oninput="this.value=this.value.replace(/\\D/g,\'\').slice(0,4)"></div>' +
          '<button class="btn" id="saveManagerPinBtn">💾 حفظ</button>';
        lastInserted.insertAdjacentElement('afterend', mCard);
        lastInserted = mCard;

        document.getElementById('saveManagerPinBtn').onclick = async function() {
          var val = (document.getElementById('managerPinInput').value || '').trim();
          if (val && val.length !== 4) {
            toast('لازم يكون 4 أرقام بالظبط، أو سيبه فاضي');
            return;
          }
          if (val && typeof verifyPin === 'function') {
            var matches = await verifyPin(val, db.password);
            if (matches) { toast('لازم يكون مختلف عن رقمك الأساسي'); return; }
          }
          var hashed = val && typeof sha256 === 'function' ? await sha256(val) : null;
          db.managerPassword = val ? hashed : null;
          saveDB(true);
          document.getElementById('managerPinInput').value = '';
          toast(val ? '✅ تم حفظ رقم وضع المدير' : '✅ تم إلغاء وضع المدير');
        };
      } else {
        lastInserted = document.getElementById('managerPinCard');
      }

      // بطاقة رقم الاستقبال
      if (!document.getElementById('receptionPinCard')) {
        var card = document.createElement('div');
        card.className = 'card';
        card.id = 'receptionPinCard';
        card.innerHTML =
          '<h3>🧑‍💼 رقم سري لوضع الاستقبال (اختياري)</h3>' +
          '<p class="meta">رقم سري تاني مختلف عن رقمك الأساسي وعن رقم المدير — لو حد دخل بيه هيفتح نسخة محدودة، بدون صفحات المالية/المصروفات/الإعدادات وبدون إمكانية حذف. سيبه فاضي لإلغاء الميزة.</p>' +
          '<div class="field"><label>رقم سري الاستقبال (4 أرقام)</label>' +
          '<input type="tel" maxlength="4" id="receptionPinInput" inputmode="numeric" autocomplete="off" class="pin-input" oninput="this.value=this.value.replace(/\\D/g,\'\').slice(0,4)"></div>' +
          '<button class="btn" id="saveReceptionPinBtn">💾 حفظ</button>';
        lastInserted.insertAdjacentElement('afterend', card);
        lastInserted = card;

        document.getElementById('saveReceptionPinBtn').onclick = async function() {
          var val = (document.getElementById('receptionPinInput').value || '').trim();
          if (val && val.length !== 4) {
            toast('لازم يكون 4 أرقام بالظبط، أو سيبه فاضي');
            return;
          }
          if (val && typeof verifyPin === 'function') {
            var matchesOwner = await verifyPin(val, db.password);
            if (matchesOwner) { toast('لازم يكون مختلف عن رقمك الأساسي'); return; }
            if (db.managerPassword) {
              var matchesMgr = await verifyPin(val, db.managerPassword);
              if (matchesMgr) { toast('لازم يكون مختلف عن رقم المدير'); return; }
            }
          }
          var hashed = val && typeof sha256 === 'function' ? await sha256(val) : null;
          db.receptionPassword = val ? hashed : null;
          saveDB(true);
          document.getElementById('receptionPinInput').value = '';
          toast(val ? '✅ تم حفظ رقم وضع الاستقبال' : '✅ تم إلغاء وضع الاستقبال');
        };
      } else {
        lastInserted = document.getElementById('receptionPinCard');
      }

      // بطاقة رقم المالية
      if (!document.getElementById('financePinCard')) {
        var fCard = document.createElement('div');
        fCard.className = 'card';
        fCard.id = 'financePinCard';
        fCard.innerHTML =
          '<h3>💰 رقم سري منفصل لصفحة المالية (اختياري)</h3>' +
          '<p class="meta">رقم سري إضافي مختلف عن رقم قفل التطبيق العام — لازم يتكتب عشان تفتح صفحة "المالية" فقط. كده تقدر تدّي حد يشتغل بالتطبيق عادي من غير ما يشوف أرباحك. سيبه فاضي لإلغاء الميزة.</p>' +
          '<div class="field"><label>رقم سري المالية (4 أرقام)</label>' +
          '<input type="tel" maxlength="4" id="financePinInput" inputmode="numeric" autocomplete="off" class="pin-input" oninput="this.value=this.value.replace(/\\D/g,\'\').slice(0,4)"></div>' +
          '<button class="btn" id="saveFinancePinBtn">💾 حفظ</button>';
        lastInserted.insertAdjacentElement('afterend', fCard);

        document.getElementById('saveFinancePinBtn').onclick = async function() {
          var val = (document.getElementById('financePinInput').value || '').trim();
          if (val && val.length !== 4) {
            toast('لازم يكون 4 أرقام بالظبط، أو سيبه فاضي');
            return;
          }
          var hashed = val && typeof sha256 === 'function' ? await sha256(val) : null;
          db.financePassword = val ? hashed : null;
          saveDB(true);
          window.financeUnlocked = false;
          if (typeof updateFinanceLockUI === 'function') updateFinanceLockUI();
          document.getElementById('financePinInput').value = '';
          toast(val ? '✅ تم حفظ رقم صفحة المالية' : '✅ تم إلغاء قفل صفحة المالية');
        };
      }
    } catch (e) { /* تجاهل */ }
  }

  // حقن بطاقات الأمان عند فتح الإعدادات
  if (typeof renderSettings === 'function') {
    var origRS_security = renderSettings;
    renderSettings = function() {
      origRS_security.apply(this, arguments);
      setTimeout(injectSecuritySettings, 50);
    };
  }

  /* ============================================================
     [9] تقييد وضع الاستقبال
     ============================================================ */
  var ALLOWED_PAGE = 'customers';

  if (typeof showPage === 'function' && !showPage.__receptionistGuarded) {
    var origShowPage_receptionist = showPage;
    showPage = function(name) {
      if (window.userRole === 'receptionist' && name !== ALLOWED_PAGE) {
        name = ALLOWED_PAGE;
      }
      return origShowPage_receptionist.call(this, name);
    };
    showPage.__receptionistGuarded = true;
  }

  function guardDelete(fnName) {
    if (typeof window[fnName] !== 'function' || window[fnName].__deleteGuarded) return;
    var orig = window[fnName];
    window[fnName] = function() {
      if (window.userRole === 'receptionist') {
        toast('🔒 الحذف مش متاح في وضع الاستقبال');
        return;
      }
      return orig.apply(this, arguments);
    };
    window[fnName].__deleteGuarded = true;
  }

  guardDelete('deleteCustomer');
  guardDelete('deleteOrder');

  function promoteHistoryButton() {
    if (window.userRole !== 'receptionist') return;
    var list = document.getElementById('customersList');
    if (!list) return;
    list.querySelectorAll('.card').forEach(function(card) {
      var row = card.querySelector('.btn-row');
      if (!row) return;
      var buttons = Array.from(row.querySelectorAll('button'));
      var moreMenu = row.querySelector('.card-more-menu');
      var historyBtn = buttons.find(function(b) { return b.textContent.trim() === '📜 السجل'; });
      if (!historyBtn && moreMenu) {
        historyBtn = Array.from(moreMenu.querySelectorAll('button')).find(function(b) {
          return b.textContent.trim() === '📜 السجل';
        });
      }
      if (!historyBtn) return;
      historyBtn.className = 'btn sm outline';
      historyBtn.removeAttribute('style');
      var moreBtn = buttons.find(function(b) { return b.textContent.trim() === '⋮ المزيد'; });
      row.insertBefore(historyBtn, moreBtn || null);
    });
  }

  if (typeof renderCustomers === 'function') {
    var origRC_receptionist = renderCustomers;
    renderCustomers = function() {
      var r = origRC_receptionist.apply(this, arguments);
      promoteHistoryButton();
      return r;
    };
  }

  if (!document.getElementById('receptionistRestrictStyles')) {
    var styleTag = document.createElement('style');
    styleTag.id = 'receptionistRestrictStyles';
    styleTag.textContent =
      'html.role-receptionist .navbtn:not([data-page="' + ALLOWED_PAGE + '"]){' +
        'display:none !important;}' +
      'html.role-receptionist #appConfirmOk{' +
        'display:inline-flex !important;}';
    document.head.appendChild(styleTag);
  }

  /* ============================================================
     [10] تنبيه موسم الذروة (مقارنة بالسنة الماضية)
     ============================================================ */
  function ordersInRange(startStr, endStr) {
    return db.orders.filter(function(o) {
      return o.dateReceived && o.dateReceived >= startStr && o.dateReceived <= endStr;
    });
  }

  function checkPeakSeason() {
    try {
      var today = new Date(todayStr());
      var alerts = [];

      var thisMonthStart = todayStr().slice(0, 8) + '01';
      var thisMonthOrders = ordersInRange(thisMonthStart, todayStr());

      var lastYear = new Date(today);
      lastYear.setFullYear(lastYear.getFullYear() - 1);
      var lyMonthPrefix = lastYear.toISOString().slice(0, 7);
      var lyMonthOrders = db.orders.filter(function(o) {
        return o.dateReceived && o.dateReceived.slice(0, 7) === lyMonthPrefix;
      });

      if (lyMonthOrders.length >= 5 && thisMonthOrders.length > 0) {
        var dayOfMonth = today.getDate();
        var lyOrdersUpToSameDay = lyMonthOrders.filter(function(o) {
          return Number(o.dateReceived.slice(8, 10)) <= dayOfMonth;
        });
        if (lyOrdersUpToSameDay.length > 0) {
          var pctChange = Math.round((thisMonthOrders.length - lyOrdersUpToSameDay.length) / lyOrdersUpToSameDay.length * 100);
          if (pctChange >= 20) {
            alerts.push('📈 الطلبات الشهر ده زادت ' + pctChange +
              '% عن نفس الفترة السنة اللي فاتت — استعد بخامات وتنظيم مواعيد إضافي');
          }
        }
      }

      (db.holidays || []).forEach(function(h) {
        if (!h.date) return;
        var diff = Math.round((new Date(h.date) - today) / 86400000);
        if (diff < 0 || diff > 28) return;
        var key = 'peakSeasonAlertShown_' + h.id + '_' + today.getFullYear();
        if (localStorage.getItem(key)) return;

        var hDate = new Date(h.date);
        var beforeStart = new Date(hDate);
        beforeStart.setDate(beforeStart.getDate() - 21);
        var lyHolidayDate = new Date(hDate);
        lyHolidayDate.setFullYear(lyHolidayDate.getFullYear() - 1);
        var lyBeforeStart = new Date(lyHolidayDate);
        lyBeforeStart.setDate(lyBeforeStart.getDate() - 21);
        var lyOrdersBeforeHoliday = ordersInRange(
          lyBeforeStart.toISOString().slice(0, 10),
          lyHolidayDate.toISOString().slice(0, 10)
        );

        var avgOrdersPerWeek = db.orders.length / 10;
        if (lyOrdersBeforeHoliday.length > avgOrdersPerWeek * 2) {
          alerts.push('🎉 باقي ' + diff + ' يوم على "' + h.name +
            '" — السنة اللي فاتت زادت الطلبات قبلها بشكل ملحوظ، جهّز خامات ونظّم مواعيد التسليم بدري');
          localStorage.setItem(key, '1');
        }
      });

      if (alerts.length > 0) {
        setTimeout(function() {
          openModal(
            '<div class="modal-head"><h3>📊 تنبيه موسم الذروة</h3>' +
            '<button class="modal-close" onclick="closeModal()">✕</button></div>' +
            alerts.map(function(a) {
              return '<div class="card" style="margin-bottom:8px;padding:10px 12px;">' + a + '</div>';
            }).join('')
          );
        }, 1500);
      }
    } catch (e) { /* تجاهل */ }
  }

  var todayKey = 'peakSeasonCheckedDate';
  if (localStorage.getItem(todayKey) !== todayStr()) {
    localStorage.setItem(todayKey, todayStr());
    setTimeout(checkPeakSeason, 1600);
  }

  /* ============================================================
     [11] قائمة الشريط العلوي الموحدة (⋮)
     ============================================================ */
  function setupTopbarMenu() {
    if (document.getElementById('topbarMenuBtn')) return;
    var holder = document.querySelector('header.topbar > div:last-child');
    if (!holder) return;

    var themeBtn = document.getElementById('themeToggleBtn');
    var displayBtn = document.getElementById('displayModeBtn');
    var contrastBtn = document.getElementById('contrastToggleBtn');
    var densityBtn = document.getElementById('densityToggleBtn');
    var lockBtn = holder.querySelector('.small-link');

    var originals = [themeBtn, displayBtn, contrastBtn, densityBtn, lockBtn].filter(Boolean);
    if (originals.length < 5) return;

    originals.forEach(function(b) { b.style.display = 'none'; });

    if (!document.getElementById('topbarMenuStyle')) {
      var styleTag = document.createElement('style');
      styleTag.id = 'topbarMenuStyle';
      styleTag.textContent =
        '.topbar-menu-wrap{display:inline-flex;}' +
        '.topbar-menu-panel{position:fixed;min-width:220px;max-width:calc(100vw - 24px);' +
          'background:var(--card,#fff);color:var(--text,#1a1a1a);border-radius:12px;' +
          'box-shadow:0 12px 30px rgba(0,0,0,.28);padding:6px;z-index:9999;display:none;}' +
        '.topbar-menu-panel.open{display:block;}' +
        '.topbar-menu-item{display:flex;align-items:center;gap:10px;width:100%;' +
          'background:none;border:0;text-align:right;padding:10px 12px;border-radius:8px;' +
          'font-size:14px;font-weight:700;cursor:pointer;color:inherit;}' +
        '.topbar-menu-item:active,.topbar-menu-item:hover{background:rgba(31,109,87,0.1);}' +
        '.topbar-menu-item .tmi-icon{font-size:16px;width:20px;text-align:center;flex-shrink:0;}' +
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

    function renderPanel() {
      panel.innerHTML = '';
      var items = [
        { icon: themeBtn.textContent.trim() || '🌙', label: 'الوضع الليلي',
          state: (document.documentElement.getAttribute('data-theme') === 'dark') ? 'مفعّل' : 'متوقف',
          run: function() { themeBtn.click(); } },
        { icon: '👁️', label: 'وضع عرض للعميل',
          state: displayBtn.classList.contains('active-display-mode') ? 'مفعّل' : 'متوقف',
          run: function() { displayBtn.click(); } },
        { icon: '◐', label: 'تباين عالٍ',
          state: document.documentElement.classList.contains('high-contrast') ? 'مفعّل' : 'متوقف',
          run: function() { contrastBtn.click(); } },
        { icon: densityBtn.textContent.trim() || '☰', label: 'كثافة العرض',
          state: document.documentElement.classList.contains('compact-view') ? 'مضغوط' : 'مريح',
          run: function() { densityBtn.click(); } },
        { icon: '🔒', label: 'قفل التطبيق', state: '',
          run: function() { lockBtn.click(); } }
      ];
      items.forEach(function(def) {
        var item = document.createElement('button');
        item.type = 'button';
        item.className = 'topbar-menu-item';
        item.innerHTML =
          '<span class="tmi-icon">' + def.icon + '</span>' +
          '<span>' + def.label + '</span>' +
          (def.state ? '<span class="tmi-state">' + def.state + '</span>' : '');
        item.onclick = function() { closePanel(); def.run(); };
        panel.appendChild(item);
      });
    }

    function positionPanel() {
      var rect = toggleBtn.getBoundingClientRect();
      var panelWidth = panel.offsetWidth || 220;
      var left = rect.left;
      if (left + panelWidth > window.innerWidth - 12) {
        left = window.innerWidth - panelWidth - 12;
      }
      if (left < 12) left = 12;
      var top = rect.bottom + 8;
      var maxTop = window.innerHeight - 12;
      panel.style.left = left + 'px';
      panel.style.top = Math.min(top, maxTop) + 'px';
    }

    function openPanel() {
      renderPanel();
      panel.classList.add('open');
      positionPanel();
      document.addEventListener('click', onOutsideClick, true);
      window.addEventListener('scroll', positionPanel, true);
      window.addEventListener('resize', positionPanel);
    }

    function closePanel() {
      panel.classList.remove('open');
      document.removeEventListener('click', onOutsideClick, true);
      window.removeEventListener('scroll', positionPanel, true);
      window.removeEventListener('resize', positionPanel);
    }

    function onOutsideClick(e) {
      if (!wrap.contains(e.target) && !panel.contains(e.target)) closePanel();
    }

    toggleBtn.onclick = function(e) {
      e.stopPropagation();
      if (panel.classList.contains('open')) closePanel();
      else openPanel();
    };

    wrap.appendChild(toggleBtn);
    holder.appendChild(wrap);
    document.body.appendChild(panel);
  }

  setTimeout(setupTopbarMenu, 1000);

  console.log('✅ تم تحميل patches-cloud-admin.js بنجاح');
  console.log('🎉 اكتمل تقسيم patches.js إلى 4 ملفات!');
})();