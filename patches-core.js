/* ============================================================
   patches-core.js - الأساسيات وواجهة المستخدم
   [الجزء 1 من 4 من patches.js القديم]
   
   المحتوى:
   - appConfirm (نسخة لا تمسح محتوى المودال)
   - تحسين أرقام الهواتف (روابط tel/wa)
   - الضغط المطول على الشعار
   - شريط آخر العملاء
   - عداد الطلبات المتأخرة
   - آخر نوع/سعر لكل عميل
   - وضع التباين العالي
   - كثافة العرض
   - زر الرجوع لأعلى
   - أكورديون الإعدادات
   - تابات الإعدادات
   - قائمة الشريط العلوي المنسدلة
   - تبسيط أزرار الكروت (⋮ المزيد)
   - وضع العرض للعميل
   - أيقونة القفل
   - نافذة تأكيد عدم الحفظ
   ============================================================ */

(function() {
  if (window.__patchesCoreLoaded) return;
  window.__patchesCoreLoaded = true;

  console.log('🔧 تحميل patches-core.js...');

  // علم مشترك لتخطي فحص "التعديلات غير المحفوظة"
  window.__skipUnsavedCheckOnce = false;

  /* ============================================================
     [1] appConfirm - نافذة تأكيد لا تمسح محتوى المودال
     ============================================================ */
  window.appConfirm = function(message, opts) {
    opts = opts || {};
    const okText = opts.okText || 'تأكيد';
    const cancelText = opts.cancelText || 'إلغاء';
    const danger = opts.danger !== false;
    
    return new Promise(function(resolve) {
      const ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:20px;';
      
      const box = document.createElement('div');
      box.style.cssText = 'background:var(--card,#fff);color:inherit;border-radius:14px;max-width:380px;width:100%;padding:16px 16px 14px;box-shadow:0 10px 30px rgba(0,0,0,.35);';
      
      box.innerHTML =
        '<div style="font-weight:800;font-size:15px;margin-bottom:10px;">⚠️ تأكيد</div>' +
        '<div style="font-size:14.5px;line-height:1.7;margin-bottom:16px;">' + escapeHtml(message) + '</div>' +
        '<div style="display:flex;gap:8px;">' +
          '<button type="button" data-a="cancel" class="btn outline" style="flex:1;">' + escapeHtml(cancelText) + '</button>' +
          '<button type="button" data-a="ok" class="btn ' + (danger ? 'danger' : '') + '" style="flex:1;">' + escapeHtml(okText) + '</button>' +
        '</div>';
      
      ov.appendChild(box);
      document.body.appendChild(ov);
      
      function cleanup(result) {
        ov.remove();
        resolve(result);
      }
      
      box.querySelector('[data-a="ok"]').onclick = function() { cleanup(true); };
      box.querySelector('[data-a="cancel"]').onclick = function() { cleanup(false); };
      ov.addEventListener('click', function(e) { if (e.target === ov) cleanup(false); });
    });
  };

  /* ============================================================
     [2] تحسين أرقام الهواتف (روابط tel + wa.me)
     ============================================================ */
  function enhancePhones() {
    document.querySelectorAll('.meta').forEach(function(el) {
      if (el.dataset.rcPhone) return;
      const txt = el.textContent || '';
      if (txt.trim().indexOf('📞') === 0) {
        const digits = txt.replace(/[^0-9]/g, '');
        if (digits.length >= 9) {
          el.dataset.rcPhone = '1';
          const waNum = digits.replace(/^0/, '2');
          const span = document.createElement('span');
          span.style.cssText = 'display:inline-flex;gap:6px;margin-inline-start:10px;';
          span.innerHTML =
            '<a href="tel:' + digits + '" style="text-decoration:none;background:var(--ok-light);color:var(--ok);border-radius:8px;padding:2px 9px;font-size:12px;font-weight:700;">📞</a>' +
            '<a href="https://wa.me/' + waNum + '" target="_blank" style="text-decoration:none;background:var(--ok-light);color:var(--ok);border-radius:8px;padding:2px 9px;font-size:12px;font-weight:700;">💬</a>';
          el.appendChild(span);
        }
      }
    });
  }
  new MutationObserver(enhancePhones).observe(document.getElementById('app'), { childList: true, subtree: true });
  enhancePhones();

  /* ============================================================
     [3] الضغط المطول على الشعار → البحث السريع
     ============================================================ */
  var brand = document.querySelector('.topbar-brand');
  if (brand) {
    var pressTimer;
    brand.addEventListener('touchstart', function() {
      pressTimer = setTimeout(function() {
        showPage('home');
        setTimeout(function() {
          var i = document.getElementById('globalSearch');
          if (i) i.focus();
        }, 150);
        if (navigator.vibrate) navigator.vibrate(30);
      }, 550);
    });
    ['touchend', 'touchmove', 'touchcancel'].forEach(function(ev) {
      brand.addEventListener(ev, function() { clearTimeout(pressTimer); });
    });
  }

  /* ============================================================
     [4] شريط آخر العملاء
     ============================================================ */
  function getRecent() {
    try { return JSON.parse(localStorage.getItem('recentCustomers') || '[]'); }
    catch (e) { return []; }
  }
  
  function pushRecent(id) {
    var list = getRecent().filter(function(x) { return x !== id; });
    list.unshift(id);
    localStorage.setItem('recentCustomers', JSON.stringify(list.slice(0, 3)));
  }

  var origHistory = openCustomerHistory;
  openCustomerHistory = function(id) {
    pushRecent(id);
    return origHistory.apply(this, arguments);
  };

  var origCustModal = openCustomerModal;
  openCustomerModal = function(id) {
    if (id) pushRecent(id);
    return origCustModal.apply(this, arguments);
  };

  var origRenderCustomers = renderCustomers;
  renderCustomers = function() {
    origRenderCustomers.apply(this, arguments);
    try {
      var pageBox = document.getElementById('page-customers');
      var searchBox = pageBox.querySelector('.search-box');
      var strip = document.getElementById('recentCustomersStrip');
      var list = getRecent().map(function(id) { return customerById(id); }).filter(Boolean);
      if (list.length === 0) { if (strip) strip.remove(); return; }
      if (!strip) {
        strip = document.createElement('div');
        strip.id = 'recentCustomersStrip';
        searchBox.insertAdjacentElement('afterend', strip);
      }
      strip.innerHTML = list.map(function(c) {
        return '<span class="rc-chip" onclick="openCustomerHistory(\'' + c.id + '\')">🕘 ' + escapeHtml(c.name) + '</span>';
      }).join('');
    } catch (e) { /* تجاهل */ }
  };

  /* ============================================================
     [5] عداد الطلبات المتأخرة على أيقونة الطلبات
     ============================================================ */
  function updateOrdersBadge() {
    try {
      var btn = document.querySelector('.navbtn[data-page="orders"]');
      if (!btn) return;
      var count = db.orders.filter(isOverdue).length;
      var badge = btn.querySelector('.overdue-badge');
      if (count > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'overdue-badge';
          badge.style.cssText = 'background:var(--danger);color:#fff;border-radius:10px;padding:1px 7px;font-size:11px;font-weight:900;margin-inline-start:auto;';
          btn.appendChild(badge);
        }
        badge.textContent = count;
      } else if (badge) {
        badge.remove();
      }
    } catch (e) { /* تجاهل */ }
  }

  var origOpenSideNav = openSideNav;
  openSideNav = function() {
    updateOrdersBadge();
    return origOpenSideNav.apply(this, arguments);
  };

  var origCloseModal = closeModal;
  closeModal = function() {
    var r = origCloseModal.apply(this, arguments);
    updateOrdersBadge();
    return r;
  };
  setTimeout(updateOrdersBadge, 800);

  /* ============================================================
     [6] حفظ آخر نوع وسعر للعميل
     ============================================================ */
  var origSaveOrderType = saveOrder;
  saveOrder = function(id) {
    try {
      var custSel = document.getElementById('f_customer');
      var firstRow = document.querySelector('#itemsContainer .item-row');
      if (custSel && firstRow) {
        var typeSel = firstRow.querySelector('.it-type');
        var priceInp = firstRow.querySelector('.it-price');
        if (custSel.value && typeSel && typeSel.value && typeSel.value !== '__custom__' && priceInp && priceInp.value) {
          localStorage.setItem('lastOrder_' + custSel.value, JSON.stringify({ typeId: typeSel.value, price: priceInp.value }));
        }
      }
    } catch (e) { /* تجاهل */ }
    return origSaveOrderType.apply(this, arguments);
  };

  var origOpenOrderModalType = openOrderModal;
  openOrderModal = function(id, presetCustomerId) {
    var result = origOpenOrderModalType.apply(this, arguments);
    if (!id) {
      setTimeout(function() {
        try {
          var custId = presetCustomerId || (document.getElementById('f_customer') ? document.getElementById('f_customer').value : '');
          if (!custId) return;
          var saved = localStorage.getItem('lastOrder_' + custId);
          if (!saved) return;
          var data = JSON.parse(saved);
          var firstRow = document.querySelector('#itemsContainer .item-row');
          if (!firstRow) return;
          var typeSel = firstRow.querySelector('.it-type');
          var priceInp = firstRow.querySelector('.it-price');
          var hasOption = Array.prototype.some.call(typeSel.options, function(o) { return o.value === data.typeId; });
          if (typeSel && hasOption) {
            typeSel.value = data.typeId;
            priceInp.value = data.price;
            recalcItemsTotal();
            toast('📌 تم تعبئة آخر نوع وسعر لهذا العميل');
          }
        } catch (e) { /* تجاهل */ }
      }, 50);
    }
    return result;
  };

  /* ============================================================
     [7] وضع التباين العالي
     ============================================================ */
  if (!document.getElementById('contrastToggleBtn')) {
    var themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      var contrastBtn = document.createElement('button');
      contrastBtn.className = 'theme-toggle-btn';
      contrastBtn.id = 'contrastToggleBtn';
      contrastBtn.setAttribute('aria-label', 'تباين عالٍ');
      contrastBtn.textContent = '◐';
      contrastBtn.onclick = function() {
        document.documentElement.classList.toggle('high-contrast');
        localStorage.setItem('highContrast', document.documentElement.classList.contains('high-contrast') ? '1' : '0');
      };
      themeBtn.insertAdjacentElement('afterend', contrastBtn);
      if (localStorage.getItem('highContrast') === '1') {
        document.documentElement.classList.add('high-contrast');
      }
    }
  }

  /* ============================================================
     [8] كثافة العرض (مريح / مضغوط)
     ============================================================ */
  var densityAnchor = document.getElementById('contrastToggleBtn') || document.getElementById('themeToggleBtn');
  if (densityAnchor && !document.getElementById('densityToggleBtn')) {
    var densityBtn = document.createElement('button');
    densityBtn.className = 'theme-toggle-btn';
    densityBtn.id = 'densityToggleBtn';
    densityBtn.setAttribute('aria-label', 'كثافة العرض');
    
    function updateDensityIcon() {
      densityBtn.textContent = document.documentElement.classList.contains('compact-view') ? '▤' : '☰';
    }
    
    densityBtn.onclick = function() {
      document.documentElement.classList.toggle('compact-view');
      localStorage.setItem('compactView', document.documentElement.classList.contains('compact-view') ? '1' : '0');
      updateDensityIcon();
    };
    
    densityAnchor.insertAdjacentElement('afterend', densityBtn);
    if (localStorage.getItem('compactView') === '1') {
      document.documentElement.classList.add('compact-view');
    }
    updateDensityIcon();
  }

  /* ============================================================
     [9] زر الرجوع لأعلى + ظل الهيدر عند التمرير
     ============================================================ */
  window.addEventListener('scroll', function() {
    var header = document.querySelector('header.topbar');
    if (header) header.classList.toggle('scrolled', window.scrollY > 10);
  }, { passive: true });

  var scrollBtn = document.createElement('button');
  scrollBtn.id = 'scrollTopBtn';
  scrollBtn.textContent = '⬆️';
  scrollBtn.onclick = function() { window.scrollTo({ top: 0, behavior: 'smooth' }); };
  document.getElementById('app').appendChild(scrollBtn);
  
  window.addEventListener('scroll', function() {
    scrollBtn.classList.toggle('show', window.scrollY > 400);
  }, { passive: true });

  /* ============================================================
     [10] أكورديون صفحة الإعدادات
     ============================================================ */
  function accordionizeCard(card) {
    if (card.dataset.accordionized) return;
    var heading = card.firstElementChild;
    if (!heading || heading.tagName !== 'H3') return;
    var rest = Array.prototype.slice.call(card.children, 1);
    if (rest.length === 0) return;
    
    card.dataset.accordionized = '1';
    var body = document.createElement('div');
    body.className = 'acc-body';
    body.style.display = 'none';
    rest.forEach(function(el) { body.appendChild(el); });
    card.appendChild(body);
    
    var chevron = document.createElement('span');
    chevron.textContent = '▾';
    chevron.style.cssText = 'margin-inline-start:auto;transition:transform .2s;font-size:13px;color:var(--muted);';
    heading.style.cssText = 'display:flex;align-items:center;cursor:pointer;margin:0;';
    heading.appendChild(chevron);
    
    heading.addEventListener('click', function() {
      var open = body.style.display !== 'none';
      body.style.display = open ? 'none' : 'block';
      chevron.style.transform = open ? '' : 'rotate(180deg)';
    });
  }
  
  function processSettingsCards() {
    document.querySelectorAll('#page-settings > .card').forEach(accordionizeCard);
  }
  
  processSettingsCards();
  var settingsPage = document.getElementById('page-settings');
  if (settingsPage) {
    new MutationObserver(processSettingsCards).observe(settingsPage, { childList: true });
  }

  /* ============================================================
     [11] تابات صفحة الإعدادات
     ============================================================ */
  var settingsSection = document.getElementById('page-settings');
  if (settingsSection && !document.getElementById('settingsTabs')) {
    var GROUPS = [
      { id: 'general', label: '🏷️ عام', keywords: ['بيانات الورشة', 'عن التطبيق'] },
      { id: 'appearance', label: '🎨 المظهر', keywords: ['تخصيص الألوان', 'شكل الأزرار', 'تخصيص الشاشة الرئيسية', 'وضع الشاشة الكبيرة', 'تخصيص الخط', 'تأثير التحميل'] },
      { id: 'operations', label: '⚙️ التشغيل', keywords: ['الطاقة الاستيعابية', 'يوم الإجازة الأسبوعية', 'مواعيد الأعياد', 'أنواع التفصيل', 'عملاء VIP', 'تنبيه المديونية', 'رقم الفاتورة والضريبة'] },
      { id: 'security', label: '🔒 الأمان والصلاحيات', keywords: ['تغيير الرقم السري', 'القفل التلقائي', 'وضع المدير', 'وضع الاستقبال', 'صفحة المالية'] },
      { id: 'data', label: '💾 البيانات', keywords: ['نسخة احتياطية', 'سلة المحذوفات', 'سجل النشاط', 'تصدير تقارير Excel'] },
      { id: 'advanced', label: '🧑‍💻 متقدم', keywords: ['تعديل متقدم', 'تنزيل كود التطبيق'] }
    ];
    
    var GROUP_BY_ID = { cloudSyncCardWrap: 'data', pushNotifyCardWrap: 'data' };
    var currentSettingsTab = 'all';
    
    function categorize() {
      var cards = settingsSection.querySelectorAll(':scope > .card');
      cards.forEach(function(c) {
        if (c.dataset.settingsGroup) return;
        if (GROUP_BY_ID[c.id]) { c.dataset.settingsGroup = GROUP_BY_ID[c.id]; return; }
        var h3 = c.querySelector('h3');
        var text = h3 ? h3.textContent : '';
        var found = 'general';
        for (var i = 0; i < GROUPS.length; i++) {
          if (GROUPS[i].keywords.some(function(k) { return text.indexOf(k) !== -1; })) {
            found = GROUPS[i].id;
            break;
          }
        }
        c.dataset.settingsGroup = found;
      });
    }
    
    function applyFilter(group) {
      currentSettingsTab = group;
      settingsSection.querySelectorAll(':scope > .card[data-settings-group]').forEach(function(c) {
        c.style.display = (group === 'all' || c.dataset.settingsGroup === group) ? '' : 'none';
      });
    }
    
    categorize();
    
    var tabsBar = document.createElement('div');
    tabsBar.className = 'settings-tabs';
    tabsBar.id = 'settingsTabs';
    var html = '<button class="settings-tab-btn active" data-group="all">📁 الكل</button>';
    GROUPS.forEach(function(g) {
      html += '<button class="settings-tab-btn" data-group="' + g.id + '">' + g.label + '</button>';
    });
    tabsBar.innerHTML = html;
    settingsSection.insertBefore(tabsBar, settingsSection.firstChild);
    
    tabsBar.addEventListener('click', function(e) {
      var btn = e.target.closest('.settings-tab-btn');
      if (!btn) return;
      tabsBar.querySelectorAll('.settings-tab-btn').forEach(function(b) {
        b.classList.toggle('active', b === btn);
      });
      applyFilter(btn.getAttribute('data-group'));
    });
    
    new MutationObserver(function() {
      categorize();
      applyFilter(currentSettingsTab);
    }).observe(settingsSection, { childList: true });
  }

  /* ============================================================
     [12] قائمة الشريط العلوي المنسدلة (⋮)
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

  setTimeout(setupTopbarMenu, 500);

  /* ============================================================
     [13] تبسيط أزرار الكروت (⋮ المزيد)
     ============================================================ */
  function consolidateCardActions(containerId, primaryLabels) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('.card').forEach(function(card) {
      var row = card.querySelector('.btn-row');
      if (!row) return;
      var buttons = Array.prototype.slice.call(row.children).filter(function(el) { return el.tagName === 'BUTTON'; });
      if (buttons.length <= primaryLabels.length) return;
      var isPrimary = buttons.map(function(b) {
        return primaryLabels.some(function(l) { return b.textContent.trim() === l; });
      });
      var secondary = buttons.filter(function(b, i) { return !isPrimary[i]; });
      if (!secondary.length) return;
      row.style.position = 'relative';

      var menu = document.createElement('div');
      menu.className = 'card-more-menu';
      menu.style.cssText = 'display:none;position:absolute;top:100%;inset-inline-start:0;margin-top:6px;background:var(--card);border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow-lift);z-index:20;overflow:hidden;min-width:180px;';

      secondary.forEach(function(b, i) {
        b.classList.remove('sm', 'outline', 'secondary', 'accent', 'danger');
        b.style.cssText = 'display:block;width:100%;text-align:start;background:none;border:none;' +
          (i < secondary.length - 1 ? 'border-bottom:1px solid var(--border);' : '') +
          'padding:11px 14px;font-size:14px;color:var(--text);cursor:pointer;border-radius:0;flex:none;';
        menu.appendChild(b);
      });

      var moreBtn = document.createElement('button');
      moreBtn.type = 'button';
      moreBtn.className = 'btn sm outline';
      moreBtn.textContent = '⋮ المزيد';
      moreBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        document.querySelectorAll('.card-more-menu.open').forEach(function(m) {
          if (m !== menu) { m.classList.remove('open'); m.style.display = 'none'; }
        });
        var isOpen = menu.classList.toggle('open');
        menu.style.display = isOpen ? 'block' : 'none';
      });
      row.appendChild(moreBtn);
      row.appendChild(menu);
    });
  }

  if (!window.__cardMoreMenuDocClick) {
    window.__cardMoreMenuDocClick = true;
    document.addEventListener('click', function() {
      document.querySelectorAll('.card-more-menu.open').forEach(function(m) {
        m.classList.remove('open');
        m.style.display = 'none';
      });
    });
  }

  var origRenderOrdersUI = renderOrders;
  renderOrders = function() {
    origRenderOrdersUI.apply(this, arguments);
    consolidateCardActions('ordersList', ['✏️ تعديل', '📲 فاتورة واتساب']);
  };

  var origRenderCustomersUI = renderCustomers;
  renderCustomers = function() {
    origRenderCustomersUI.apply(this, arguments);
    consolidateCardActions('customersList', ['✏️ تعديل', '➕ طلب جديد']);
  };

  /* ============================================================
     [14] وضع عرض للعميل (إخفاء الأرقام الحساسة)
     ============================================================ */
  var displayModeActive = false;

  function maskSensitiveElements() {
    document.querySelectorAll('.meta').forEach(function(el) {
      if (el.dataset.rcPhone || el.textContent.trim().indexOf('📞') === 0) {
        if (displayModeActive) {
          if (!el.dataset.origText) el.dataset.origText = el.innerHTML;
          el.innerHTML = '📞 •••••••••';
        } else if (el.dataset.origText) {
          el.innerHTML = el.dataset.origText;
          delete el.dataset.origText;
        }
      }
    });
  }

  new MutationObserver(function() {
    if (displayModeActive) maskSensitiveElements();
  }).observe(document.getElementById('app'), { childList: true, subtree: true });

  var themeBtnForDisplay = document.getElementById('themeToggleBtn');
  if (themeBtnForDisplay && !document.getElementById('displayModeBtn')) {
    var displayBtn = document.createElement('button');
    displayBtn.className = 'theme-toggle-btn';
    displayBtn.id = 'displayModeBtn';
    displayBtn.setAttribute('aria-label', 'وضع عرض للعميل');
    displayBtn.textContent = '👁️';
    displayBtn.onclick = function() {
      displayModeActive = !displayModeActive;
      document.documentElement.classList.toggle('display-mode', displayModeActive);
      displayBtn.classList.toggle('active-display-mode', displayModeActive);
      toast(displayModeActive ? '🙈 وضع العرض مفعّل — الأرقام والأسعار متخفية مؤقتًا' : '✅ تم إلغاء وضع العرض');
      maskSensitiveElements();
    };
    themeBtnForDisplay.insertAdjacentElement('afterend', displayBtn);
  }

  /* ============================================================
     [15] أيقونة القفل (أيقونة + نص)
     ============================================================ */
  var lockBtn = document.querySelector('header.topbar .small-link');
  if (lockBtn && !lockBtn.dataset.wrapped) {
    lockBtn.dataset.wrapped = '1';
    lockBtn.innerHTML = '🔒<span class="lock-text"> قفل</span>';
  }

  /* ============================================================
     [16] نافذة تأكيد عدم الحفظ عند إغلاق المودال
     ============================================================ */
  var modalSnapshot = null;

  function snapshotModal() {
    var box = document.getElementById('modalBox');
    if (!box) return null;
    var els = box.querySelectorAll('input, textarea, select');
    if (!els.length) return null;
    var parts = [];
    els.forEach(function(el) {
      if (el.type === 'checkbox' || el.type === 'radio') {
        parts.push(el.checked ? '1' : '0');
      } else {
        parts.push(el.value);
      }
    });
    return parts.join('\u0001');
  }

  var origOpenModalDirty = openModal;
  openModal = function(html) {
    var r = origOpenModalDirty.apply(this, arguments);
    modalSnapshot = snapshotModal();
    return r;
  };

  var origCloseModalDirty = closeModal;
  closeModal = function() {
    if (window.__skipUnsavedCheckOnce) {
      window.__skipUnsavedCheckOnce = false;
      modalSnapshot = null;
      return origCloseModalDirty.apply(this, arguments);
    }
    if (modalSnapshot !== null && snapshotModal() !== modalSnapshot) {
      appConfirm('عندك تعديلات لم تُحفظ. هل تريد الإغلاق من غير حفظها؟',
        { okText: 'إغلاق من غير حفظ', cancelText: 'متابعة التعديل', danger: true })
        .then(function(ok) {
          if (ok) {
            modalSnapshot = null;
            origCloseModalDirty.apply(null, []);
          }
        });
      return;
    }
    modalSnapshot = null;
    return origCloseModalDirty.apply(this, arguments);
  };

  /* ============================================================
     [17] الإحساس بالضغط على لوحة القفل
     ============================================================ */
  function setupKeypadFeedback() {
    var keypad = document.getElementById('keypad');
    if (!keypad || keypad.dataset.fastTapEnabled) return;
    keypad.dataset.fastTapEnabled = '1';

    keypad.addEventListener('touchstart', function(e) {
      var btn = e.target.closest('button');
      if (btn) btn.classList.add('pressed');
    }, { passive: true });

    ['touchend', 'touchcancel'].forEach(function(ev) {
      keypad.addEventListener(ev, function(e) {
        var btn = e.target.closest('button');
        if (btn) btn.classList.remove('pressed');
        else keypad.querySelectorAll('.pressed').forEach(function(b) { b.classList.remove('pressed'); });
      }, { passive: true });
    });
  }
  setupKeypadFeedback();

  console.log('✅ تم تحميل patches-core.js بنجاح');
})();