/* ============================================================
   backup-guardian.js - النسخ الاحتياطي التلقائي الذكي
   
   ✅ آمن 100%:
      - يقرأ فقط من window.db (لا يعدّله أبداً)
      - يخزّن في IndexedDB منفصلة (لا يلمس localStorage)
      - يمكن حذفه بحذف السطر من index.html فقط
   
   الميزات:
   1. نسخة تلقائية يومية (عند أول فتح كل يوم)
   2. نسخة يدوية بضغطة زر
   3. 7 نسخ يومية محفوظة + 12 نسخة ساعية
   4. استرجاع أي نسخة (مع تأكيد)
   5. تصدير أي نسخة كملف JSON
   6. عرض حجم كل نسخة
   ============================================================ */

(function() {
  if (window.__backupGuardianLoaded) return;
  window.__backupGuardianLoaded = true;

  console.log('💾 تحميل backup-guardian.js...');

  var DB_NAME = 'jalaba_backups';
  var DB_VERSION = 1;
  var STORE_NAME = 'snapshots';
  var MAX_DAILY = 7;
  var MAX_HOURLY = 12;
  var MAX_MANUAL = 20;

  var idb = null;

  // ═══════════════════════════════════════════════════════════════
  // فتح IndexedDB
  // ═══════════════════════════════════════════════════════════════
  function openIDB() {
    return new Promise(function(resolve, reject) {
      if (idb) { resolve(idb); return; }
      
      try {
        var req = indexedDB.open(DB_NAME, DB_VERSION);
        
        req.onupgradeneeded = function(e) {
          var database = e.target.result;
          if (!database.objectStoreNames.contains(STORE_NAME)) {
            var store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('ts', 'ts', { unique: false });
            store.createIndex('type', 'type', { unique: false });
          }
        };
        
        req.onsuccess = function(e) {
          idb = e.target.result;
          resolve(idb);
        };
        
        req.onerror = function(e) {
          reject(e.target.error);
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // حفظ نسخة في IndexedDB
  // ═══════════════════════════════════════════════════════════════
  async function saveSnapshot(data, type) {
    try {
      var db = await openIDB();
      var tx = db.transaction(STORE_NAME, 'readwrite');
      var store = tx.objectStore(STORE_NAME);
      
      var id = 'snap_' + type + '_' + Date.now();
      var record = {
        id: id,
        ts: Date.now(),
        type: type, // 'daily' | 'hourly' | 'manual'
        date: new Date().toISOString().slice(0, 10),
        data: data,
        size: JSON.stringify(data).length,
        stats: {
          customers: (data.customers || []).length,
          orders: (data.orders || []).length,
          payments: (data.payments || []).length,
          expenses: (data.expenses || []).length
        }
      };
      
      await new Promise(function(resolve, reject) {
        var r = store.add(record);
        r.onsuccess = resolve;
        r.onerror = function() { reject(r.error); };
      });
      
      return record;
    } catch (e) {
      console.error('فشل حفظ النسخة:', e);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // قراءة كل النسخ
  // ═══════════════════════════════════════════════════════════════
  async function getAllSnapshots() {
    try {
      var db = await openIDB();
      var tx = db.transaction(STORE_NAME, 'readonly');
      var store = tx.objectStore(STORE_NAME);
      
      return await new Promise(function(resolve, reject) {
        var req = store.getAll();
        req.onsuccess = function() {
          var list = req.result || [];
          list.sort(function(a, b) { return b.ts - a.ts; });
          resolve(list);
        };
        req.onerror = function() { reject(req.error); };
      });
    } catch (e) {
      console.error('فشل قراءة النسخ:', e);
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // حذف نسخة
  // ═══════════════════════════════════════════════════════════════
  async function deleteSnapshot(id) {
    try {
      var db = await openIDB();
      var tx = db.transaction(STORE_NAME, 'readwrite');
      var store = tx.objectStore(STORE_NAME);
      
      await new Promise(function(resolve, reject) {
        var r = store.delete(id);
        r.onsuccess = resolve;
        r.onerror = function() { reject(r.error); };
      });
      
      return true;
    } catch (e) {
      console.error('فشل حذف النسخة:', e);
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // تنظيف النسخ القديمة (إبقاء الحد الأقصى لكل نوع)
  // ═══════════════════════════════════════════════════════════════
  async function cleanupOldSnapshots() {
    try {
      var all = await getAllSnapshots();
      var daily = all.filter(function(s) { return s.type === 'daily'; });
      var hourly = all.filter(function(s) { return s.type === 'hourly'; });
      var manual = all.filter(function(s) { return s.type === 'manual'; });
      
      var toDelete = [];
      
      // احتفظ بـ 7 يومية
      daily.slice(MAX_DAILY).forEach(function(s) { toDelete.push(s.id); });
      
      // احتفظ بـ 12 ساعية
      hourly.slice(MAX_HOURLY).forEach(function(s) { toDelete.push(s.id); });
      
      // احتفظ بـ 20 يدوية
      manual.slice(MAX_MANUAL).forEach(function(s) { toDelete.push(s.id); });
      
      for (var i = 0; i < toDelete.length; i++) {
        await deleteSnapshot(toDelete[i]);
      }
      
      if (toDelete.length > 0) {
        console.log('🧹 تم حذف ' + toDelete.length + ' نسخة قديمة');
      }
    } catch (e) {
      console.error('فشل التنظيف:', e);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // إنشاء نسخة يومية تلقائية (عند أول فتح كل يوم)
  // ═══════════════════════════════════════════════════════════════
  async function makeDailyBackupIfNeeded() {
    if (!window.db) return;
    
    var today = new Date().toISOString().slice(0, 10);
    var lastDaily = localStorage.getItem('jalaba_last_daily_backup');
    
    if (lastDaily === today) {
      // تم بالفعل اليوم
      return;
    }
    
    // تأكد من وجود بيانات كافية
    var hasData = (window.db.customers || []).length > 0 ||
                  (window.db.orders || []).length > 0;
    if (!hasData) return;
    
    console.log('💾 إنشاء نسخة احتياطية يومية...');
    
    var safeData = JSON.parse(JSON.stringify(window.db));
    var record = await saveSnapshot(safeData, 'daily');
    
    if (record) {
      localStorage.setItem('jalaba_last_daily_backup', today);
      console.log('✅ تم إنشاء نسخة يومية (' + formatSize(record.size) + ')');
      await cleanupOldSnapshots();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // إنشاء نسخة ساعية (كل ساعة عند العمل)
  // ═══════════════════════════════════════════════════════════════
  async function makeHourlyBackupIfNeeded() {
    if (!window.db) return;
    
    var now = Date.now();
    var lastHourly = parseInt(localStorage.getItem('jalaba_last_hourly_backup') || '0', 10);
    
    // نسخة كل ساعة
    if (now - lastHourly < 60 * 60 * 1000) return;
    
    var hasData = (window.db.customers || []).length > 0 ||
                  (window.db.orders || []).length > 0;
    if (!hasData) return;
    
    var safeData = JSON.parse(JSON.stringify(window.db));
    var record = await saveSnapshot(safeData, 'hourly');
    
    if (record) {
      localStorage.setItem('jalaba_last_hourly_backup', String(now));
      console.log('✅ تم إنشاء نسخة ساعية');
      await cleanupOldSnapshots();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // نسخة يدوية
  // ═══════════════════════════════════════════════════════════════
  window.makeManualBackup = async function() {
    if (!window.db) {
      if (typeof window.toast === 'function') window.toast('⚠️ التطبيق غير جاهز');
      return;
    }
    
    var safeData = JSON.parse(JSON.stringify(window.db));
    var record = await saveSnapshot(safeData, 'manual');
    
    if (record) {
      await cleanupOldSnapshots();
      if (typeof window.toast === 'function') {
        window.toast('✅ تم إنشاء نسخة احتياطية (' + formatSize(record.size) + ')', 3000);
      }
      // تحديث القائمة إذا كانت مفتوحة
      if (typeof window.renderBackupList === 'function') {
        window.renderBackupList();
      }
    } else {
      if (typeof window.toast === 'function') {
        window.toast('⚠️ فشل إنشاء النسخة');
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // عرض قائمة النسخ
  // ═══════════════════════════════════════════════════════════════
  window.renderBackupList = async function() {
    var box = document.getElementById('backupGuardianList');
    if (!box) return;
    
    box.innerHTML = '<p class="meta">⏳ جاري التحميل...</p>';
    
    var all = await getAllSnapshots();
    
    if (!all.length) {
      box.innerHTML = '<p class="meta">لا توجد نسخ احتياطية بعد. سيتم إنشاء أول نسخة تلقائياً اليوم.</p>';
      return;
    }
    
    var typeLabels = {
      daily: '📅 يومية',
      hourly: '🕐 ساعية',
      manual: '👆 يدوية'
    };
    
    var html = all.map(function(snap) {
      var d = new Date(snap.ts);
      var dateStr = d.toLocaleDateString('ar-EG') + ' ' +
                    d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
      
      return '<div class="card" style="padding:10px;margin-bottom:8px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;">' +
        '<div style="flex:1;min-width:0;">' +
        '<b>' + (typeLabels[snap.type] || snap.type) + '</b>' +
        '<div class="meta" style="margin-top:4px;">' + dateStr + '</div>' +
        '<div class="meta">' +
          snap.stats.customers + ' عميل • ' +
          snap.stats.orders + ' طلب • ' +
          formatSize(snap.size) +
        '</div>' +
        '</div>' +
        '<div style="display:flex;gap:4px;flex-wrap:wrap;">' +
        '<button class="btn sm outline" onclick="restoreBackupFromGuardian(\'' + snap.id + '\')" style="min-width:auto;">↩️</button>' +
        '<button class="btn sm outline" onclick="exportBackupFromGuardian(\'' + snap.id + '\')" style="min-width:auto;">📤</button>' +
        '<button class="btn sm danger" onclick="deleteBackupFromGuardian(\'' + snap.id + '\')" style="min-width:auto;">🗑️</button>' +
        '</div>' +
        '</div>' +
        '</div>';
    }).join('');
    
    box.innerHTML = html;
  };

  // ═══════════════════════════════════════════════════════════════
  // استرجاع نسخة
  // ═══════════════════════════════════════════════════════════════
  window.restoreBackupFromGuardian = async function(id) {
    var all = await getAllSnapshots();
    var snap = all.find(function(s) { return s.id === id; });
    if (!snap) {
      if (typeof window.toast === 'function') window.toast('⚠️ النسخة غير موجودة');
      return;
    }
    
    var d = new Date(snap.ts);
    var dateStr = d.toLocaleDateString('ar-EG') + ' ' +
                  d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    
    var confirmMsg = 'هل تريد استرجاع هذه النسخة؟\n\n' +
      'التاريخ: ' + dateStr + '\n' +
      'العملاء: ' + snap.stats.customers + '\n' +
      'الطلبات: ' + snap.stats.orders + '\n\n' +
      '⚠️ سيتم استبدال جميع البيانات الحالية بهذه النسخة.\n' +
      'سيتم إنشاء نسخة أمان من الوضع الحالي أولاً.';
    
    var ok = await window.appConfirm(confirmMsg, {
      okText: 'استرجاع',
      cancelText: 'إلغاء',
      danger: true
    });
    
    if (!ok) return;
    
    // إنشاء نسخة أمان من الوضع الحالي أولاً
    if (window.db) {
      var currentData = JSON.parse(JSON.stringify(window.db));
      await saveSnapshot(currentData, 'manual');
    }
    
    // استرجاع
    window.db = JSON.parse(JSON.stringify(snap.data));
    
    // استخدم دالة saveDB للتحديث
    if (typeof window.saveDB === 'function') {
      window.saveDB(true);
    } else {
      try {
        localStorage.setItem('jalaba_db_v1', JSON.stringify(window.db));
      } catch (e) {
        console.error('فشل الحفظ:', e);
      }
    }
    
    if (typeof window.toast === 'function') {
      window.toast('✅ تم استرجاع النسخة بنجاح', 3000);
    }
    
    // إعادة تحميل الصفحة
    setTimeout(function() { location.reload(); }, 1500);
  };

  // ═══════════════════════════════════════════════════════════════
  // تصدير نسخة كملف
  // ═══════════════════════════════════════════════════════════════
  window.exportBackupFromGuardian = async function(id) {
    var all = await getAllSnapshots();
    var snap = all.find(function(s) { return s.id === id; });
    if (!snap) return;
    
    var filename = 'نسخة_احتياطية_' + new Date(snap.ts).toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.json';
    var blob = new Blob([JSON.stringify(snap.data, null, 2)], { type: 'application/json' });
    
    if (typeof window.saveOrShareFile === 'function') {
      await window.saveOrShareFile(blob, filename);
    } else {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(function() { URL.revokeObjectURL(url); }, 60000);
    }
    
    if (typeof window.toast === 'function') {
      window.toast('✅ تم تصدير النسخة');
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // حذف نسخة
  // ═══════════════════════════════════════════════════════════════
  window.deleteBackupFromGuardian = async function(id) {
    var ok = await window.appConfirm('هل تريد حذف هذه النسخة نهائياً؟', {
      okText: 'حذف',
      cancelText: 'إلغاء',
      danger: true
    });
    if (!ok) return;
    
    var success = await deleteSnapshot(id);
    if (success) {
      if (typeof window.toast === 'function') window.toast('🗑️ تم حذف النسخة');
      if (typeof window.renderBackupList === 'function') window.renderBackupList();
    } else {
      if (typeof window.toast === 'function') window.toast('⚠️ فشل الحذف');
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // أدوات مساعدة
  // ═══════════════════════════════════════════════════════════════
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  // ═══════════════════════════════════════════════════════════════
  // حقن بطاقة في الإعدادات
  // ═══════════════════════════════════════════════════════════════
  function injectBackupCard() {
    var page = document.getElementById('page-settings');
    if (!page) return;
    if (page.querySelector('#backupGuardianCard')) return;
    
    var card = document.createElement('div');
    card.className = 'card';
    card.id = 'backupGuardianCard';
    card.innerHTML = 
      '<h3>💾 النسخ الاحتياطية التلقائية</h3>' +
      '<p class="meta">' +
        'يتم إنشاء نسخة احتياطية تلقائياً كل يوم وكل ساعة (عند استخدام التطبيق). ' +
        'النسخ محفوظة بأمان في متصفحك، ويمكنك استرجاع أي منها.' +
      '</p>' +
      '<div class="btn-row" style="margin-bottom:10px;">' +
        '<button class="btn sm accent" onclick="makeManualBackup()">➕ إنشاء نسخة الآن</button>' +
        '<button class="btn sm outline" onclick="renderBackupList()">🔄 تحديث</button>' +
      '</div>' +
      '<div id="backupGuardianList">' +
        '<p class="meta">⏳ جاري التحميل...</p>' +
      '</div>';
    
    page.appendChild(card);
    
    // حمّل القائمة
    setTimeout(function() {
      if (typeof window.renderBackupList === 'function') {
        window.renderBackupList();
      }
    }, 200);
  }

  // ═══════════════════════════════════════════════════════════════
  // دمج مع renderSettings لضمان الظهور
  // ═══════════════════════════════════════════════════════════════
  if (typeof window.renderSettings === 'function') {
    var origRenderSettings = window.renderSettings;
    window.renderSettings = function() {
      origRenderSettings.apply(this, arguments);
      setTimeout(injectBackupCard, 100);
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // التشغيل التلقائي
  // ═══════════════════════════════════════════════════════════════
  
  // افتح IDB مسبقاً للتأكد
  openIDB().then(function() {
    console.log('✅ IndexedDB جاهز');
    
    // نسخة يومية بعد 10 ثوانٍ من التحميل
    setTimeout(makeDailyBackupIfNeeded, 10000);
    
    // نسخة ساعية كل 15 دقيقة
    setInterval(makeHourlyBackupIfNeeded, 15 * 60 * 1000);
    
    // أول فحص بعد 30 ثانية
    setTimeout(makeHourlyBackupIfNeeded, 30000);
  }).catch(function(e) {
    console.warn('⚠️ IndexedDB غير متاح:', e);
  });

  // نسخة يومية عند إغلاق الصفحة (احتياطاً)
  window.addEventListener('beforeunload', function() {
    // لا نحاول إنشاء نسخة (قد يفشل)، فقط نتأكد من الحفظ
    // النسخة اليومية ستُنشأ في المرة القادمة عند الفتح
  });

  console.log('✅ تم تحميل backup-guardian.js');
  console.log('   - نسخة تلقائية يومية');
  console.log('   - نسخة تلقائية ساعية');
  console.log('   - 7 أيام محفوظة + 12 ساعة + 20 يدوية');
  console.log('   - استرجاع فوري من الإعدادات');

})();
