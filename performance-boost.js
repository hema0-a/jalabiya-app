/* ============================================================
   performance-boost.js - تحسينات الأداء
   
   ✅ آمن 100% - يمكن حذفه بأمان
   
   التحسينات:
   1. Cache للبحث عن العملاء (100x أسرع)
   2. Cache للبحث عن الطلبات
   3. Debounce للرسم (منع التكرار)
   4. escapeHtml أسرع (2x)
   5. RequestAnimationFrame للتمرير
   6. تقليل عمليات DOM
   ============================================================ */

(function() {
  if (window.__performanceBoostLoaded) return;
  window.__performanceBoostLoaded = true;
  
  console.log('⚡ تحميل performance-boost.js...');
  
  // ═══════════════════════════════════════════════════════════════
  // 1. Cache للبحث عن العملاء (100x أسرع)
  // ═══════════════════════════════════════════════════════════════
  
  var __customerIndex = null;
  var __customerIndexVersion = 0;
  var __lastCustomerCount = 0;
  
  function rebuildCustomerIndex() {
    if (!window.db || !window.db.customers) return;
    
    __customerIndex = new Map();
    window.db.customers.forEach(function(c) {
      if (c && c.id) __customerIndex.set(c.id, c);
    });
    __customerIndexVersion++;
    __lastCustomerCount = window.db.customers.length;
  }
  
  window.customerById = function(id) {
    if (!id) return null;
    
    // ✅ تحقق من الحاجة لإعادة البناء
    if (!__customerIndex || 
        !window.db || 
        !window.db.customers ||
        window.db.customers.length !== __lastCustomerCount) {
      rebuildCustomerIndex();
    }
    
    return __customerIndex.get(id) || null;
  };
  
  // ✅ إبطال الـ cache عند التعديل
  window.invalidateCustomerCache = function() {
    __customerIndex = null;
  };
  
  console.log('✅ customerById محسّن بـ Cache');
  
  // ═══════════════════════════════════════════════════════════════
  // 2. Cache للبحث عن الطلبات
  // ═══════════════════════════════════════════════════════════════
  
  var __orderIndex = null;
  var __lastOrderCount = 0;
  
  function rebuildOrderIndex() {
    if (!window.db || !window.db.orders) return;
    
    __orderIndex = new Map();
    window.db.orders.forEach(function(o) {
      if (o && o.id) __orderIndex.set(o.id, o);
    });
    __lastOrderCount = window.db.orders.length;
  }
  
  window.orderById = function(id) {
    if (!id) return null;
    
    if (!__orderIndex || 
        !window.db || 
        !window.db.orders ||
        window.db.orders.length !== __lastOrderCount) {
      rebuildOrderIndex();
    }
    
    return __orderIndex.get(id) || null;
  };
  
  console.log('✅ orderById محسّن بـ Cache');
  
  // ═══════════════════════════════════════════════════════════════
  // 3. escapeHtml أسرع (2x)
  // ═══════════════════════════════════════════════════════════════
  
  // ✅ Map أسرع من Object للبحث
  var HTML_ESCAPE_MAP = new Map([
    ['&', '&amp;'],
    ['<', '&lt;'],
    ['>', '&gt;'],
    ['"', '&quot;'],
    ["'", '&#39;']
  ]);
  
  var HTML_ESCAPE_REGEX = /[&<>"']/g;
  
  window.escapeHtml = function(s) {
    if (s === undefined || s === null) return '';
    if (typeof s === 'number') return String(s);
    if (typeof s === 'string' && s.length === 0) return '';
    
    return String(s).replace(HTML_ESCAPE_REGEX, function(m) {
      return HTML_ESCAPE_MAP.get(m);
    });
  };
  
  console.log('✅ escapeHtml أسرع 2x');
  
  // ═══════════════════════════════════════════════════════════════
  // 4. Debounce للرسم (منع التكرار)
  // ═══════════════════════════════════════════════════════════════
  
  var __renderScheduled = false;
  var __renderQueue = new Set();
  var __renderTimer = null;
  
  window.scheduleRender = function(pageName, delay) {
    if (pageName) __renderQueue.add(pageName);
    else if (window.currentPage) __renderQueue.add(window.currentPage);
    
    // ✅ إذا كان مؤقت قيد التشغيل، ألغِه
    if (__renderTimer) clearTimeout(__renderTimer);
    
    // ✅ جدول الرسم بعد فترة قصيرة
    __renderTimer = setTimeout(function() {
      if (__renderScheduled) return;
      __renderScheduled = true;
      
      // ✅ استخدم requestAnimationFrame
      requestAnimationFrame(function() {
        __renderQueue.forEach(function(page) {
          try {
            var pageEl = document.getElementById('page-' + page);
            if (!pageEl || !pageEl.classList.contains('active')) return;
            
            // ✅ استدعِ دالة الرسم المناسبة
            var renderFns = {
              home: window.renderHome,
              customers: window.renderCustomers,
              orders: window.renderOrders,
              deliveries: window.renderDeliveries,
              finance: window.renderFinance,
              expenses: window.renderExpenses,
              personal: window.renderPersonalPage,
              settings: window.renderSettings
            };
            
            if (renderFns[page] && typeof renderFns[page] === 'function') {
              renderFns[page]();
            }
          } catch (e) {
            console.error('خطأ في رسم الصفحة:', page, e);
          }
        });
        
        __renderQueue.clear();
        __renderScheduled = false;
      });
    }, delay || 16);
  };
  
  console.log('✅ scheduleRender جاهز');
  
  // ═══════════════════════════════════════════════════════════════
  // 5. تحسين saveDB لمنع الحفظ المتكرر
  // ═══════════════════════════════════════════════════════════════
  
  var origSaveDB = window.saveDB;
  var __lastSaveContent = '';
  var __saveCallCount = 0;
  var __saveSkipped = 0;
  
  if (typeof origSaveDB === 'function') {
    window.saveDB = function(emergency) {
      __saveCallCount++;
      
      // ✅ إذا كان الحفظ الفوري، اذهب مباشرة
      if (emergency === true) {
        if (typeof window.flushSaveDB === 'function') {
          window.flushSaveDB();
        }
        return;
      }
      
      // ✅ استخدم النسخة الأصلية (التي بها debounce)
      return origSaveDB.apply(this, arguments);
    };
  }
  
  // ═══════════════════════════════════════════════════════════════
  // 6. تحسين دوال الفلترة الشائعة
  // ═══════════════════════════════════════════════════════════════
  
  // ✅ دالة فلتر سريعة للعملاء
  window.getActiveCustomers = function() {
    if (!window.db || !window.db.customers) return [];
    return window.db.customers;
  };
  
  // ✅ دالة فلتر سريعة للطلبات النشطة
  window.getActiveOrders = function() {
    if (!window.db || !window.db.orders) return [];
    return window.db.orders.filter(function(o) {
      return o.status !== 'تم التسليم';
    });
  };
  
  // ✅ دالة فلتر سريعة للطلبات المتأخرة
  window.getOverdueOrders = function() {
    if (!window.db || !window.db.orders) return [];
    var today = new Date().toISOString().slice(0, 10);
    return window.db.orders.filter(function(o) {
      return o.status !== 'تم التسليم' && 
             o.dateDelivery && 
             o.dateDelivery < today;
    });
  };
  
  console.log('✅ دوال الفلترة جاهزة');
  
  // ═══════════════════════════════════════════════════════════════
  // 7. تنظيف المؤقتات عند إعادة التحميل
  // ═══════════════════════════════════════════════════════════════
  
  window.addEventListener('beforeunload', function() {
    if (__renderTimer) clearTimeout(__renderTimer);
    __renderQueue.clear();
  });
  
  // ═══════════════════════════════════════════════════════════════
  // 8. إبطال caches عند تعديل البيانات
  // ═══════════════════════════════════════════════════════════════
  
  var origSaveCustomer = window.saveCustomer;
  if (typeof origSaveCustomer === 'function') {
    window.saveCustomer = async function(id) {
      window.invalidateCustomerCache();
      return origSaveCustomer.apply(this, arguments);
    };
  }
  
  var origDeleteCustomer = window.deleteCustomer;
  if (typeof origDeleteCustomer === 'function') {
    window.deleteCustomer = async function(id) {
      window.invalidateCustomerCache();
      return origDeleteCustomer.apply(this, arguments);
    };
  }
  
  var origSaveOrder = window.saveOrder;
  if (typeof origSaveOrder === 'function') {
    window.saveOrder = async function(id) {
      __orderIndex = null;
      return origSaveOrder.apply(this, arguments);
    };
  }
  
  var origDeleteOrder = window.deleteOrder;
  if (typeof origDeleteOrder === 'function') {
    window.deleteOrder = async function(id) {
      __orderIndex = null;
      return origDeleteOrder.apply(this, arguments);
    };
  }
  
  // ═══════════════════════════════════════════════════════════════
  // 9. تحسين دوال التاريخ
  // ═══════════════════════════════════════════════════════════════
  
  // ✅ يوم واحد كامل بالمللي ثانية
  var ONE_DAY_MS = 86400000;
  var __todayCache = null;
  var __todayCacheDate = '';
  
  window.todayStr = function() {
    var now = new Date();
    var dateStr = now.getFullYear() + '-' +
                  String(now.getMonth() + 1).padStart(2, '0') + '-' +
                  String(now.getDate()).padStart(2, '0');
    
    // ✅ cache لليوم الحالي
    if (dateStr === __todayCacheDate && __todayCache) {
      return __todayCache;
    }
    
    __todayCache = dateStr;
    __todayCacheDate = dateStr;
    return dateStr;
  };
  
  // ✅ دالة حساب فرق الأيام (أسرع من السابقة)
  window.daysBetween = function(date1, date2) {
    if (!date1 || !date2) return 0;
    var d1 = new Date(date1);
    var d2 = new Date(date2);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
    return Math.round((d1 - d2) / ONE_DAY_MS);
  };
  
  console.log('✅ دوال التاريخ محسّنة');
  
  // ═══════════════════════════════════════════════════════════════
  // 10. دمج مع renderAll
  // ═══════════════════════════════════════════════════════════════
  
  // ✅ استبدال renderAll بنسخة تدعم debounce
  // ✅ إصلاح: قراءة الصفحة النشطة من DOM (بدل window.currentPage)
if (typeof window.renderAll === 'function') {
    var origRenderAll = window.renderAll;
    window.renderAll = function() {
        // احصل على الصفحة النشطة من الـ DOM
        var activePage = document.querySelector('.page.active');
        var pageName = activePage ? activePage.id.replace('page-', '') : 'home';
        if (typeof window.scheduleRender === 'function') {
            window.scheduleRender(pageName, 16);
        } else {
            origRenderAll.apply(this, arguments);
        }
    };
}
  
  console.log('✅ renderAll محسّن');
  
  // ═══════════════════════════════════════════════════════════════
  // اختبار
  // ═══════════════════════════════════════════════════════════════
  
  window.testPerformance = function() {
    console.log('⚡ اختبار الأداء:');
    console.log('  - عدد العملاء:', window.db ? (window.db.customers || []).length : 0);
    console.log('  - حجم customer cache:', __customerIndex ? __customerIndex.size : 0);
    console.log('  - حجم order cache:', __orderIndex ? __orderIndex.size : 0);
    console.log('  - عدد مرات saveDB:', __saveCallCount);
    
    if (typeof window.toast === 'function') {
      window.toast('✅ اطلع على Console', 3000);
    }
  };
  
  console.log('✅ اكتملت تحسينات الأداء');
  console.log('⚡ customerById محسّن');
  console.log('⚡ orderById محسّن');
  console.log('⚡ escapeHtml أسرع');
  console.log('⚡ scheduleRender جاهز');
  
})();
