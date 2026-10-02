/* ============================================================
   display-modes.js - أوضاع العرض المتقدمة
   
   ✅ آمن 100% — إضافات فقط، يمكن حذفه بأمان
   
   الميزات:
   1. 🖥️ وضع كشك العرض (Kiosk Mode)
      - للتابلت المثبت في المحل
      - عرض الموديلات والأسعار للعملاء
      - لا يمكن الخروج بدون كلمة مرور
   
   2. 📱📱 تقسيم الشاشة للتابلت
      - عرض قائمة العملاء + التفاصيل
      - بدون تنقل متكرر
      - للشاشات الكبيرة فقط
   ============================================================ */

(function() {
  if (window.__displayModesLoaded) return;
  window.__displayModesLoaded = true;

  console.log('🖥️ تحميل display-modes.js...');

  // ═══════════════════════════════════════════════════════════════
  // الأدوات المساعدة
  // ═══════════════════════════════════════════════════════════════

  function escapeHtml(s) {
    if (s === undefined || s === null) return '';
    return String(s).replace(/[&<>"']/g, function(m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // [31] وضع كشك العرض (Kiosk Mode)
  // ═══════════════════════════════════════════════════════════════

  var kioskActive = false;
  var kioskInterval = null;

  function activateKiosk() {
    if (kioskActive) return;
    
    // اطلب كلمة المرور أولاً
    openKioskPasswordPrompt();
  }

  function openKioskPasswordPrompt() {
    var html = 
      '<div class="modal-head">' +
      '<h3>🖥️ تشغيل وضع الكشك</h3>' +
      '<button class="modal-close" onclick="closeModal()">✕</button>' +
      '</div>' +
      
      '<div class="card" style="background:var(--warn-light);padding:12px;margin-bottom:12px;">' +
      '<b style="display:block;margin-bottom:6px;">⚠️ تنبيه</b>' +
      '<div class="meta">وضع الكشك يفتح شاشة عرض للعملاء بدون إمكانية الوصول ' +
      'للبيانات الحساسة. للخروج، ستحتاج كلمة المرور.</div>' +
      '</div>' +
      
      '<div class="field">' +
      '<label>كلمة المرور (للخروج لاحقاً)</label>' +
      '<input type="password" id="kioskPasswordInput" ' +
      'placeholder="أدخل كلمة المرور الحالية للتأكيد" ' +
      'style="direction:ltr;text-align:center;letter-spacing:4px;">' +
      '</div>' +
      
      '<div class="btn-row">' +
      '<button class="btn outline" onclick="closeModal()">إلغاء</button>' +
      '<button class="btn accent" onclick="startKioskMode()">🖥️ تشغيل</button>' +
      '</div>';

    openModal(html);
  }

  window.startKioskMode = async function() {
    var input = document.getElementById('kioskPasswordInput');
    if (!input) return;
    
    var pass = (input.value || '').trim();
    if (!pass) {
      if (typeof window.toast === 'function') window.toast('أدخل كلمة المرور');
      return;
    }

    // تحقق من كلمة المرور
    var valid = false;
    if (typeof window.verifyPin === 'function') {
      valid = await window.verifyPin(pass, window.db.password);
    } else {
      valid = (pass === (window.db.password || '0000'));
    }

    if (!valid) {
      if (typeof window.toast === 'function') window.toast('كلمة المرور غير صحيحة');
      input.value = '';
      input.focus();
      return;
    }

    // خزّن كلمة المرور للخروج لاحقاً
    window.__kioskPassword = pass;
    closeModal();
    enterKioskMode();
  };

  function enterKioskMode() {
    kioskActive = true;

    // خزّن الحالة
    localStorage.setItem('jalaba_kiosk_active', '1');

    // أنشئ الشاشة
    var kioskScreen = document.createElement('div');
    kioskScreen.id = 'kioskScreen';
    kioskScreen.style.cssText = 
      'position:fixed;inset:0;z-index:99999;' +
      'background:linear-gradient(135deg, var(--primary-dark), var(--primary));' +
      'color:#fff;overflow-y:auto;' +
      'padding:20px;';

    document.body.appendChild(kioskScreen);
    renderKioskContent(kioskScreen);

    // فعّل حماية
    startKioskProtection();

    if (typeof window.toast === 'function') {
      window.toast('🖥️ وضع الكشك مفعّل — للخروج اضغط 3 مرات على الشعار', 5000);
    }
  }

  function renderKioskContent(container) {
    var shopName = window.db.workshopName || 'ورشة تفصيل الجلابيب';
    var ownerName = window.db.ownerName || '';
    var logo = window.db.workshopLogo;

    // احصائي
    var activeOrders = (window.db.orders || []).filter(function(o) {
      return o.status !== 'تم التسليم';
    }).length;
    
    var deliveredToday = (window.db.orders || []).filter(function(o) {
      return o.status === 'تم التسليم' && 
             o.deliveredDate === new Date().toISOString().slice(0, 10);
    }).length;

    // أنواع الجلابيب المتاحة
    var types = window.db.garmentTypes || [];

    var html = 
      // الهيدر
      '<div style="text-align:center;padding:30px 20px 20px;">' +
        (logo ? 
          '<img src="' + logo + '" style="width:100px;height:100px;' +
          'border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,0.3);' +
          'margin-bottom:16px;">' : 
          '<div style="font-size:70px;margin-bottom:16px;">🧵</div>') +
        '<h1 style="font-size:28px;margin:0;color:#fff;font-weight:700;">' + 
        escapeHtml(shopName) + '</h1>' +
        (ownerName ? 
          '<p style="color:rgba(255,255,255,0.8);margin-top:8px;font-size:15px;">' + 
          escapeHtml(ownerName) + '</p>' : '') +
      '</div>' +

      // الوضع الحالي
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;' +
      'max-width:700px;margin:20px auto;padding:0 20px;">' +
        '<div style="background:rgba(255,255,255,0.15);border-radius:14px;' +
        'padding:20px;text-align:center;backdrop-filter:blur(10px);">' +
          '<div style="font-size:36px;margin-bottom:8px;">🧵</div>' +
          '<div style="font-size:28px;font-weight:800;color:#fff;">' + 
          activeOrders + '</div>' +
          '<div style="font-size:12px;color:rgba(255,255,255,0.75);">' +
          'طلب تحت التنفيذ</div>' +
        '</div>' +
        '<div style="background:rgba(255,255,255,0.15);border-radius:14px;' +
        'padding:20px;text-align:center;backdrop-filter:blur(10px);">' +
          '<div style="font-size:36px;margin-bottom:8px;">✅</div>' +
          '<div style="font-size:28px;font-weight:800;color:#fff;">' + 
          deliveredToday + '</div>' +
          '<div style="font-size:12px;color:rgba(255,255,255,0.75);">' +
          'تم تسليمه اليوم</div>' +
        '</div>' +
      '</div>' +

      // الأنواع المتاحة
      (types.length > 0 ?
        '<div style="max-width:900px;margin:30px auto;padding:0 20px;">' +
          '<h2 style="color:#fff;font-size:18px;text-align:center;' +
          'margin-bottom:16px;">👗 الأنواع المتاحة</h2>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));' +
          'gap:12px;">' +
          types.slice(0, 12).map(function(t) {
            return '<div style="background:rgba(255,255,255,0.15);' +
              'border-radius:12px;padding:14px;text-align:center;' +
              'backdrop-filter:blur(10px);">' +
              '<div style="font-size:14px;font-weight:700;color:#fff;' +
              'margin-bottom:6px;">' + escapeHtml(t.name) + '</div>' +
              '<div style="font-size:18px;font-weight:800;color:var(--accent);">' + 
              Number(t.price).toLocaleString('ar-EG') + ' ج.م</div>' +
              '</div>';
          }).join('') +
          '</div>' +
        '</div>' : '') +

      // معلومات الاتصال
      '<div style="max-width:600px;margin:30px auto;padding:20px;' +
      'text-align:center;">' +
        '<h2 style="color:#fff;font-size:18px;margin-bottom:16px;">📞 تواصل معنا</h2>' +
        (window.db.ownerPhone ?
          '<div style="font-size:22px;font-weight:700;color:#fff;' +
          'margin-bottom:8px;direction:ltr;">' + 
          escapeHtml(window.db.ownerPhone) + '</div>' : '') +
        (window.db.workshopAddress ?
          '<div style="color:rgba(255,255,255,0.8);font-size:14px;">' +
          '📍 ' + escapeHtml(window.db.workshopAddress) + '</div>' : '') +
      '</div>' +

      // زر مخفي للخروج
      '<div style="text-align:center;padding:40px 20px;">' +
        '<button id="kioskExitBtn" ' +
        'style="background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);' +
        'border:1px solid rgba(255,255,255,0.2);border-radius:30px;' +
        'padding:10px 24px;font-size:12px;cursor:pointer;">' +
        '🚪 الخروج من وضع الكشك</button>' +
      '</div>';

    container.innerHTML = html;

    // ربط زر الخروج
    var exitBtn = document.getElementById('kioskExitBtn');
    if (exitBtn) {
      exitBtn.onclick = requestKioskExit;
    }

    // نقر 3 مرات على الشعار كمخرج سريع
    var logoEl = container.querySelector('img, div[style*="font-size:70px"]');
    if (logoEl) {
      var clickCount = 0;
      var clickTimer = null;
      logoEl.style.cursor = 'pointer';
      logoEl.onclick = function() {
        clickCount++;
        clearTimeout(clickTimer);
        clickTimer = setTimeout(function() { clickCount = 0; }, 800);
        if (clickCount >= 3) {
          clickCount = 0;
          requestKioskExit();
        }
      };
    }
  }

  function startKioskProtection() {
    // منع Escape
    document.addEventListener('keydown', blockKioskKeys, true);
    
    // منع الرجوع
    window.addEventListener('popstate', blockKioskBack, true);
    
    // تحديث دوري للمحتوى كل 30 ثانية
    kioskInterval = setInterval(function() {
      var screen = document.getElementById('kioskScreen');
      if (screen && kioskActive) {
        renderKioskContent(screen);
      }
    }, 30000);
  }

  function blockKioskKeys(e) {
    if (!kioskActive) return;
    
    // منع F12, Ctrl+Shift+I, Escape, Alt+Left, إلخ
    if (e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) ||
        (e.ctrlKey && e.key === 'u') ||
        e.key === 'Escape' ||
        (e.altKey && e.key === 'ArrowLeft')) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }

  function blockKioskBack(e) {
    if (!kioskActive) return;
    e.preventDefault();
    // دفع حالة جديدة لمنع الخروج
    try { history.pushState(null, '', location.href); } catch(err) {}
  }

  async function requestKioskExit() {
    // اطلب كلمة المرور
    openModal(
      '<div class="modal-head">' +
      '<h3>🚪 الخروج من وضع الكشك</h3>' +
      '<button class="modal-close" onclick="closeModal()">✕</button>' +
      '</div>' +
      '<p class="meta">أدخل كلمة المرور للخروج.</p>' +
      '<div class="field">' +
      '<label>كلمة المرور</label>' +
      '<input type="password" id="kioskExitPassword" ' +
      'style="direction:ltr;text-align:center;letter-spacing:4px;" ' +
      'onkeydown="if(event.key===\'Enter\')executeKioskExit()">' +
      '</div>' +
      '<div class="btn-row">' +
      '<button class="btn outline" onclick="closeModal()">إلغاء</button>' +
      '<button class="btn danger" onclick="executeKioskExit()">🚪 خروج</button>' +
      '</div>'
    );

    setTimeout(function() {
      var input = document.getElementById('kioskExitPassword');
      if (input) input.focus();
    }, 100);
  }

  window.executeKioskExit = async function() {
    var input = document.getElementById('kioskExitPassword');
    if (!input) return;
    
    var pass = (input.value || '').trim();
    if (!pass) return;

    var valid = false;
    if (typeof window.verifyPin === 'function') {
      valid = await window.verifyPin(pass, window.db.password);
    } else {
      valid = (pass === (window.db.password || '0000'));
    }

    if (!valid) {
      if (typeof window.toast === 'function') window.toast('كلمة المرور غير صحيحة');
      input.value = '';
      input.focus();
      return;
    }

    exitKioskMode();
  };

  function exitKioskMode() {
    kioskActive = false;
    localStorage.removeItem('jalaba_kiosk_active');

    // إزالة الشاشة
    var screen = document.getElementById('kioskScreen');
    if (screen) screen.remove();

    // إلغاء المستمعين
    document.removeEventListener('keydown', blockKioskKeys, true);
    window.removeEventListener('popstate', blockKioskBack, true);
    
    if (kioskInterval) {
      clearInterval(kioskInterval);
      kioskInterval = null;
    }

    closeModal();
    
    if (typeof window.toast === 'function') {
      window.toast('✅ تم الخروج من وضع الكشك');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // [34] تقسيم الشاشة للتابلت
  // ═══════════════════════════════════════════════════════════════

  function isWideScreen() {
    return window.innerWidth >= 1024;
  }

  function injectSplitScreenStyles() {
    if (document.getElementById('splitScreenStyles')) return;

    var style = document.createElement('style');
    style.id = 'splitScreenStyles';
    style.textContent = 
      // للشاشات الكبيرة فقط
      '@media (min-width: 1024px) {' +
      
      // تفعيل التخطيط المزدوج عند تفعيل الوضع
      'html.split-screen-active #page-customers .split-wrapper {' +
      'display:grid;grid-template-columns:1fr 1.3fr;gap:20px;' +
      'max-width:1400px;margin:0 auto;' +
      '}' +

      'html.split-screen-active #page-customers .split-list {' +
      'overflow-y:auto;max-height:calc(100vh - 200px);' +
      'padding-inline-end:8px;' +
      '}' +

      'html.split-screen-active #page-customers .split-detail {' +
      'position:sticky;top:100px;' +
      'overflow-y:auto;max-height:calc(100vh - 200px);' +
      '}' +

      // تنسيق الكارت المختار
      'html.split-screen-active #customersList .card.selected-card {' +
      'box-shadow:0 0 0 3px var(--primary), var(--shadow);' +
      'transform:translateX(-4px);' +
      'border-color:var(--primary);' +
      '}' +

      // تفاصيل العميل في اليمين
      '.customer-detail-panel {' +
      'background:var(--card);border-radius:16px;' +
      'border:1px solid var(--border);' +
      'padding:20px;' +
      'min-height:200px;' +
      '}' +

      '.customer-detail-panel .empty {' +
      'text-align:center;padding:60px 20px;' +
      'color:var(--muted);' +
      '}' +

      '.customer-detail-panel .empty-icon {' +
      'font-size:60px;margin-bottom:12px;' +
      '}' +

      '}' +

      // زر تبديل وضع التقسيم
      '.split-toggle-btn {' +
      'position:fixed;bottom:90px;right:18px;z-index:55;' +
      'width:48px;height:48px;border-radius:50%;' +
      'background:var(--card);color:var(--primary);' +
      'border:1px solid var(--border);' +
      'box-shadow:var(--shadow-lift);' +
      'display:none;align-items:center;justify-content:center;' +
      'font-size:20px;cursor:pointer;' +
      '}' +

      '@media (min-width:1024px){' +
      '.split-toggle-btn{display:flex;}' +
      '}' +

      '.split-toggle-btn.active {' +
      'background:var(--primary);color:#fff;' +
      '}';

    document.head.appendChild(style);
  }

  window.toggleSplitScreen = function() {
    var active = document.documentElement.classList.toggle('split-screen-active');
    localStorage.setItem('jalaba_split_screen', active ? '1' : '0');

    var btn = document.getElementById('splitScreenToggleBtn');
    if (btn) btn.classList.toggle('active', active);

    // إذا كنا في صفحة العملاء، أعد الرسم
    if (typeof window.currentPage !== 'undefined' && window.currentPage === 'customers') {
      if (typeof window.renderCustomers === 'function') {
        window.renderCustomers();
      }
    }

    if (typeof window.toast === 'function') {
      window.toast(active ? '📱📱 وضع التقسيم مفعّل' : '📱 وضع عمود واحد', 2500);
    }
  };

  function injectSplitScreenButton() {
    if (document.getElementById('splitScreenToggleBtn')) return;
    if (!isWideScreen()) return;

    var btn = document.createElement('button');
    btn.id = 'splitScreenToggleBtn';
    btn.className = 'split-toggle-btn';
    btn.setAttribute('aria-label', 'تقسيم الشاشة');
    btn.title = 'تقسيم الشاشة (عميلين)';
    btn.textContent = '◫';
    
    if (localStorage.getItem('jalaba_split_screen') === '1') {
      btn.classList.add('active');
      document.documentElement.classList.add('split-screen-active');
    }
    
    btn.onclick = window.toggleSplitScreen;
    document.body.appendChild(btn);
  }

  // ═══════════════════════════════════════════════════════════════
  // دمج تقسيم الشاشة مع صفحة العملاء
  // ═══════════════════════════════════════════════════════════════

  var selectedCustomerId = null;

  function setupSplitScreenLayout() {
    if (!document.documentElement.classList.contains('split-screen-active')) return;

    var page = document.getElementById('page-customers');
    if (!page) return;

    var list = document.getElementById('customersList');
    if (!list) return;

    // إذا كان اللف مغلقاً، لا تعيد الترتيب
    if (page.querySelector('.split-wrapper')) return;

    // أنشئ اللف
    var wrapper = document.createElement('div');
    wrapper.className = 'split-wrapper';

    var listDiv = document.createElement('div');
    listDiv.className = 'split-list';

    var detailDiv = document.createElement('div');
    detailDiv.className = 'split-detail';
    detailDiv.innerHTML = 
      '<div class="customer-detail-panel" id="customerDetailPanel">' +
      '<div class="empty">' +
      '<div class="empty-icon">👤</div>' +
      '<div>اختر عميلاً من القائمة</div>' +
      '</div>' +
      '</div>';

    // انقل عناصر صفحة العملاء إلى اللف
    var parent = list.parentNode;
    var searchBox = page.querySelector('.search-box');
    var vipBtn = page.querySelector('#vipFilterBtn');

    parent.insertBefore(wrapper, list);
    wrapper.appendChild(listDiv);
    wrapper.appendChild(detailDiv);

    // انقل العناصر
    if (searchBox) listDiv.appendChild(searchBox);
    if (vipBtn) listDiv.appendChild(vipBtn);
    listDiv.appendChild(list);

    // إزالة العناصر المكررة من الأصل
    // (بالفعل تم النقل)
  }

  // ربط النقر على كارت العميل
  function bindCustomerSelection() {
    if (!document.documentElement.classList.contains('split-screen-active')) return;

    var list = document.getElementById('customersList');
    if (!list) return;

    list.querySelectorAll('.card').forEach(function(card) {
      if (card.dataset.splitBound) return;
      card.dataset.splitBound = '1';

      // استخرج معرف العميل
      var phoneEl = null;
      card.querySelectorAll('.meta').forEach(function(m) {
        if (!phoneEl && m.textContent.trim().indexOf('📞') === 0) phoneEl = m;
      });
      if (!phoneEl) return;

      var digits = phoneEl.textContent.replace(/[^0-9]/g, '');
      var customer = (window.db.customers || []).find(function(c) {
        return (c.phone || '').replace(/[^0-9]/g, '') === digits;
      });
      if (!customer) return;

      card.style.cursor = 'pointer';
      card.onclick = function(e) {
        // إذا كان النقر على زر، لا تفعّل الاختيار
        if (e.target.closest('button') || e.target.closest('a')) return;
        
        e.stopPropagation();
        selectCustomerInSplitView(customer.id);
      };
    });
  }

  function selectCustomerInSplitView(customerId) {
    selectedCustomerId = customerId;

    // حدّث التمييز البصري
    var list = document.getElementById('customersList');
    if (list) {
      list.querySelectorAll('.card').forEach(function(card) {
        card.classList.remove('selected-card');
      });
    }

    // اعرض التفاصيل
    var panel = document.getElementById('customerDetailPanel');
    if (!panel) return;

    var customer = (window.db.customers || []).find(function(c) {
      return c.id === customerId;
    });
    if (!customer) return;

    var orders = (window.db.orders || []).filter(function(o) {
      return o.customerId === customerId;
    });

    var totalOrders = orders.length;
    var totalPaid = orders.reduce(function(s, o) {
      return s + (Number(o.paid) || 0);
    }, 0);
    var totalRemaining = orders.reduce(function(s, o) {
      return s + (window.orderRemaining ? window.orderRemaining(o) : 0);
    }, 0);

    var activeOrders = orders.filter(function(o) {
      return o.status !== 'تم التسليم';
    });

    // تنسيق المقاسات
    var measurements = [];
    if (customer.length) measurements.push('الطول: ' + customer.length);
    if (customer.chest) measurements.push('الصدر: ' + customer.chest);
    if (customer.waist) measurements.push('الخزنة: ' + customer.waist);
    if (customer.sleeve) measurements.push('طول الكم: ' + customer.sleeve);
    if (customer.shoulder) measurements.push('وسع الكم: ' + customer.shoulder);

    var html = 
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;' +
      'padding-bottom:14px;border-bottom:2px dashed var(--stitch);">' +
        '<div style="width:60px;height:60px;border-radius:50%;' +
        'background:var(--primary-light);display:flex;align-items:center;' +
        'justify-content:center;font-size:24px;font-weight:800;' +
        'color:var(--heading);flex-shrink:0;">' +
          escapeHtml((customer.name || '؟').charAt(0)) +
        '</div>' +
        '<div style="flex:1;min-width:0;">' +
          '<h3 style="margin:0 0 4px;font-size:18px;">' + 
          escapeHtml(customer.name) + '</h3>' +
          (customer.phone ? 
            '<div class="meta" style="direction:ltr;text-align:right;">📞 ' + 
            escapeHtml(customer.phone) + '</div>' : '') +
          (customer.family ? 
            '<div class="meta">👪 ' + escapeHtml(customer.family) + '</div>' : '') +
        '</div>' +
      '</div>' +

      // إحصائيات
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">' +
        '<div style="background:var(--card-alt);padding:10px;border-radius:10px;text-align:center;">' +
          '<div style="font-size:20px;font-weight:800;color:var(--heading);">' + 
          totalOrders + '</div>' +
          '<div style="font-size:11px;color:var(--muted);">إجمالي الطلبات</div>' +
        '</div>' +
        '<div style="background:var(--card-alt);padding:10px;border-radius:10px;text-align:center;">' +
          '<div style="font-size:20px;font-weight:800;color:var(--ok);">' + 
          Math.round(totalPaid).toLocaleString('ar-EG') + '</div>' +
          '<div style="font-size:11px;color:var(--muted);">إجمالي المدفوع</div>' +
        '</div>' +
      '</div>' +

      (totalRemaining > 0 ?
        '<div style="background:var(--danger-light);color:var(--danger);' +
        'padding:10px;border-radius:10px;margin-bottom:14px;text-align:center;">' +
          '<div style="font-size:18px;font-weight:800;">' + 
          Math.round(totalRemaining).toLocaleString('ar-EG') + ' ج.م</div>' +
          '<div style="font-size:11px;">إجمالي المتبقي</div>' +
        '</div>' : 
        '<div style="background:var(--ok-light);color:var(--ok);' +
        'padding:10px;border-radius:10px;margin-bottom:14px;text-align:center;">' +
          '<div style="font-size:14px;font-weight:700;">✅ لا مديونيات</div>' +
        '</div>') +

      // المقاسات
      (measurements.length > 0 ?
        '<div style="margin-bottom:14px;">' +
          '<div style="font-size:12px;color:var(--muted);margin-bottom:6px;' +
          'font-weight:700;">📏 المقاسات</div>' +
          '<div style="background:var(--card-alt);padding:10px;' +
          'border-radius:10px;font-size:12.5px;line-height:1.8;">' +
          measurements.join(' • ') +
          '</div>' +
        '</div>' : '') +

      // الطلبات النشطة
      (activeOrders.length > 0 ?
        '<div style="margin-bottom:14px;">' +
          '<div style="font-size:12px;color:var(--muted);margin-bottom:6px;' +
          'font-weight:700;">🧵 طلبات نشطة (' + activeOrders.length + ')</div>' +
          activeOrders.slice(0, 3).map(function(o) {
            var type = o.type || (o.items && o.items[0] ? o.items[0].type : 'طلب');
            var status = o.status || 'قيد العمل';
            return '<div style="background:var(--card-alt);padding:8px 10px;' +
              'border-radius:8px;margin-bottom:6px;font-size:12.5px;">' +
              '<div style="font-weight:700;margin-bottom:2px;">' + 
              escapeHtml(type) + '</div>' +
              '<div class="meta" style="font-size:11px;">' +
              status + ' • تسليم: ' + (o.dateDelivery || '-') +
              '</div>' +
              '</div>';
          }).join('') +
          (activeOrders.length > 3 ? 
            '<div style="font-size:11px;color:var(--muted);text-align:center;">' +
            '+ ' + (activeOrders.length - 3) + ' طلب آخر</div>' : '') +
        '</div>' : '') +

      // الأزرار
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">' +
        '<button class="btn sm accent" onclick="openOrderModal(null, \'' + 
        customerId + '\')">➕ طلب</button>' +
        '<button class="btn sm outline" onclick="openCustomerHistory(\'' + 
        customerId + '\')">📜 السجل</button>' +
        '<button class="btn sm outline" onclick="openCustomerModal(\'' + 
        customerId + '\')">✏️ تعديل</button>' +
        (customer.phone ?
          '<button class="btn sm outline" onclick="sendCustomerWhatsApp(\'' + 
          customerId + '\')">💬 واتساب</button>' : 
          '<button class="btn sm outline" disabled style="opacity:.4;">💬 واتساب</button>') +
      '</div>';

    panel.innerHTML = html;

    // حدّد الكارت
    if (list) {
      var customerCards = list.querySelectorAll('.card');
      for (var i = 0; i < customerCards.length; i++) {
        var phoneEl = null;
        customerCards[i].querySelectorAll('.meta').forEach(function(m) {
          if (!phoneEl && m.textContent.trim().indexOf('📞') === 0) phoneEl = m;
        });
        if (phoneEl) {
          var digits = phoneEl.textContent.replace(/[^0-9]/g, '');
          if ((customer.phone || '').replace(/[^0-9]/g, '') === digits) {
            customerCards[i].classList.add('selected-card');
            break;
          }
        }
      }
    }
  }

  window.sendCustomerWhatsApp = function(customerId) {
    var customer = (window.db.customers || []).find(function(c) {
      return c.id === customerId;
    });
    if (!customer || !customer.phone) return;

    var msg = 'أهلاً ' + customer.name + ' 🌹\n' +
      'كيف حالك؟ نتمنى تكون بخير.\n\n' +
      (window.db.workshopName || 'ورشة تفصيل الجلابيب');

    var phone = customer.phone.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) phone = '2' + phone;

    if (typeof window.openWhatsAppChat === 'function') {
      window.openWhatsAppChat(phone, msg);
    } else {
      window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(msg), '_blank');
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // دمج مع renderCustomers
  // ═══════════════════════════════════════════════════════════════

  if (typeof window.renderCustomers === 'function' && !window.renderCustomers.__splitWrapped) {
    var origRenderCustomers = window.renderCustomers;
    window.renderCustomers = function() {
      var r = origRenderCustomers.apply(this, arguments);
      
      // بعد الرسم، طبّق التقسيم
      setTimeout(function() {
        setupSplitScreenLayout();
        bindCustomerSelection();
        
        // إذا كان هناك عميل مختار، أعد عرضه
        if (selectedCustomerId && 
            document.documentElement.classList.contains('split-screen-active')) {
          selectCustomerInSplitView(selectedCustomerId);
        }
      }, 100);
      
      return r;
    };
    window.renderCustomers.__splitWrapped = true;
  }

  // ═══════════════════════════════════════════════════════════════
  // حقن زر الكشك في الإعدادات
  // ═══════════════════════════════════════════════════════════════

  function injectDisplayModesCard() {
    var page = document.getElementById('page-settings');
    if (!page) return;
    if (page.querySelector('#displayModesCard')) return;

    var card = document.createElement('div');
    card.className = 'card';
    card.id = 'displayModesCard';
    card.innerHTML = 
      '<h3>🖥️ أوضاع العرض</h3>' +
      '<p class="meta">أوضاع خاصة للتابلت والشاشات الكبيرة.</p>' +
      
      '<div style="background:var(--card-alt);padding:12px;border-radius:10px;margin-bottom:10px;">' +
        '<div style="font-weight:700;margin-bottom:6px;">🖥️ وضع كشك العرض</div>' +
        '<div class="meta" style="margin-bottom:8px;">' +
        'يفتح شاشة عرض للعملاء بدون إمكانية الوصول للبيانات. ' +
        'مناسبة للتابلت المثبت في المحل.</div>' +
        '<button class="btn sm accent" onclick="activateKioskFromSettings()">' +
        '🖥️ تشغيل وضع الكشك</button>' +
      '</div>' +

      '<div style="background:var(--card-alt);padding:12px;border-radius:10px;">' +
        '<div style="font-weight:700;margin-bottom:6px;">📱📱 تقسيم الشاشة للتابلت</div>' +
        '<div class="meta" style="margin-bottom:8px;">' +
        'يعرض قائمة العملاء + تفاصيل العميل المختار جنباً إلى جنب. ' +
        'يعمل على الشاشات 1024 بكسل أو أكثر.</div>' +
        '<button class="btn sm outline" onclick="toggleSplitScreen()">' +
        '📱📱 تفعيل/إلغاء تقسيم الشاشة</button>' +
      '</div>';

    page.appendChild(card);
  }

  window.activateKioskFromSettings = function() {
    openKioskPasswordPrompt();
  };

  if (typeof window.renderSettings === 'function' && !window.renderSettings.__displayWrapped) {
    var origRenderSettings = window.renderSettings;
    window.renderSettings = function() {
      var r = origRenderSettings.apply(this, arguments);
      setTimeout(injectDisplayModesCard, 400);
      return r;
    };
    window.renderSettings.__displayWrapped = true;
  }

  // ═══════════════════════════════════════════════════════════════
  // التشغيل الأولي
  // ═══════════════════════════════════════════════════════════════

  window.addEventListener('load', function() {
    injectSplitScreenStyles();
    
    // أضف زر التقسيم على الشاشات الكبيرة
    setTimeout(injectSplitScreenButton, 2000);

    // إذا كان الكشك مفعّلاً من قبل، أعد تفعيله
    if (localStorage.getItem('jalaba_kiosk_active') === '1') {
      // انتظر حتى يفتح المستخدم التطبيق
      setTimeout(function() {
        // اطلب كلمة المرور للخروج فقط (بدون تفعيل جديد)
        var appEl = document.getElementById('app');
        if (appEl && appEl.style.display === 'block') {
          enterKioskMode();
        }
      }, 5000);
    }
  });

  // راقب تغيير حجم الشاشة
  window.addEventListener('resize', function() {
    if (isWideScreen()) {
      injectSplitScreenButton();
    } else {
      var btn = document.getElementById('splitScreenToggleBtn');
      if (btn) btn.remove();
      
      // أزل تفعيل التقسيم
      if (document.documentElement.classList.contains('split-screen-active')) {
        document.documentElement.classList.remove('split-screen-active');
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // اختبار
  // ═══════════════════════════════════════════════════════════════

  window.testDisplayModes = function() {
    console.log('🖥️ اختبار أوضاع العرض:');
    console.log('  الشاشة عريضة؟', isWideScreen());
    console.log('  وضع التقسيم:', 
      document.documentElement.classList.contains('split-screen-active') ? 'مفعّل' : 'متوقف');
    console.log('  وضع الكشك:', kioskActive ? 'مفعّل' : 'متوقف');

    if (typeof window.toast === 'function') {
      window.toast('✅ اطلع على Console', 3000);
    }
  };

  console.log('✅ تم تحميل display-modes.js');
  console.log('   - وضع كشك العرض (31)');
  console.log('   - تقسيم الشاشة للتابلت (34)');

})();
