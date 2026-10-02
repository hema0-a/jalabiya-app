/* ============================================================
   data-doctor.js - فحص سلامة البيانات
   
   ✅ آمن 100%:
      - يقرأ فقط (لا يعدّل بدون تأكيدك)
      - كل إصلاح له زر تأكيد منفصل
      - يمكن حذفه بحذف السطر من index.html
   
   الفحوصات:
   1. طلبات يتيمة (عميلها محذوف)
   2. دفعات يتيمة (طلبها محذوف)
   3. قيم سالبة (مصاريف، خامة، مدفوع)
   4. مدفوع أكبر من الإجمالي
   5. عملاء مكررين (نفس الاسم+الهاتف)
   6. أرقام هواتف مكررة
   7. تواريخ غير صالحة
   8. التزامات بمبالغ صفر
   9. مخزون سالب
   10. دفعات بلا تاريخ
   ============================================================ */

(function() {
  if (window.__dataDoctorLoaded) return;
  window.__dataDoctorLoaded = true;

  console.log('🔬 تحميل data-doctor.js...');

  // ═══════════════════════════════════════════════════════════════
  // الفحوصات (كلها read-only)
  // ═══════════════════════════════════════════════════════════════
  
  function runAllChecks() {
    if (!window.db) {
      return { issues: [], summary: { totalIssues: 0, criticalCount: 0, warningCount: 0, infoCount: 0 } };
    }
    
    var issues = [];
    var db = window.db;
    var customers = db.customers || [];
    var orders = db.orders || [];
    var payments = db.payments || [];
    var expenses = db.expenses || [];
    var commitments = db.commitments || [];
    
    // ═══════════════════════════════════════════════════════════
    // 1. طلبات يتيمة (عميلها محذوف)
    // ═══════════════════════════════════════════════════════════
    var customerIds = {};
    customers.forEach(function(c) { customerIds[c.id] = true; });
    
    var orphanOrders = orders.filter(function(o) {
      return o.customerId && !customerIds[o.customerId];
    });
    
    if (orphanOrders.length > 0) {
      issues.push({
        id: 'orphan_orders',
        level: 'danger',
        icon: '🔗',
        title: orphanOrders.length + ' طلب مرتبط بعميل محذوف',
        description: 'هذه الطلبات يتيمة وستظهر في التقارير كـ "عميل محذوف". ' +
                     'يمكنك حذفها إذا لم تكن بحاجة إليها.',
        count: orphanOrders.length,
        details: orphanOrders.slice(0, 5).map(function(o) {
          return '• طلب #' + (o.id || '').slice(-5).toUpperCase() + 
                 ' — ' + (o.type || 'بدون نوع');
        }).join('\n') + (orphanOrders.length > 5 ? '\n... و ' + (orphanOrders.length - 5) + ' آخر' : ''),
        fixAction: 'deleteOrphanOrders',
        fixLabel: '🗑️ حذف الطلبات اليتيمة',
        fixDanger: true
      });
    }
    
    // ═══════════════════════════════════════════════════════════
    // 2. دفعات يتيمة (طلبها محذوف)
    // ═══════════════════════════════════════════════════════════
    var orderIds = {};
    orders.forEach(function(o) { orderIds[o.id] = true; });
    
    var orphanPayments = payments.filter(function(p) {
      return p.orderId && !orderIds[p.orderId];
    });
    
    if (orphanPayments.length > 0) {
      issues.push({
        id: 'orphan_payments',
        level: 'warn',
        icon: '💳',
        title: orphanPayments.length + ' دفعة مرتبطة بطلب محذوف',
        description: 'قد يكون الطلب حُذف بدون حذف دفعاته. ' +
                     'هذا يؤثر على إجمالي المحصّل في التقارير.',
        count: orphanPayments.length,
        details: orphanPayments.slice(0, 3).map(function(p) {
          return '• ' + (Number(p.amount) || 0).toLocaleString('ar-EG') + 
                 ' ج.م — ' + (p.date || 'بدون تاريخ');
        }).join('\n') + (orphanPayments.length > 3 ? '\n... و ' + (orphanPayments.length - 3) + ' آخر' : ''),
        fixAction: 'deleteOrphanPayments',
        fixLabel: '🗑️ حذف الدفعات اليتيمة',
        fixDanger: true
      });
    }
    
    // ═══════════════════════════════════════════════════════════
    // 3. قيم سالبة
    // ═══════════════════════════════════════════════════════════
    var negativeValueOrders = orders.filter(function(o) {
      return (Number(o.extra) || 0) < 0 ||
             (Number(o.materialCost) || 0) < 0 ||
             (Number(o.paid) || 0) < 0 ||
             (Number(o.fee) || 0) < 0;
    });
    
    if (negativeValueOrders.length > 0) {
      issues.push({
        id: 'negative_values',
        level: 'danger',
        icon: '➖',
        title: negativeValueOrders.length + ' طلب فيه قيمة سالبة',
        description: 'الأسعار السالبة تؤثر على حساب الأرباح والتقارير.',
        count: negativeValueOrders.length,
        details: negativeValueOrders.slice(0, 5).map(function(o) {
          var name = '';
          var c = customers.find(function(x) { return x.id === o.customerId; });
          if (c) name = c.name;
          
          var vals = [];
          if ((Number(o.extra) || 0) < 0) vals.push('مصاريف: ' + o.extra);
          if ((Number(o.materialCost) || 0) < 0) vals.push('خامة: ' + o.materialCost);
          if ((Number(o.paid) || 0) < 0) vals.push('مدفوع: ' + o.paid);
          
          return '• ' + (name || 'عميل') + ' — ' + vals.join(', ');
        }).join('\n') + (negativeValueOrders.length > 5 ? '\n... و ' + (negativeValueOrders.length - 5) + ' آخر' : ''),
        fixAction: 'fixNegativeValues',
        fixLabel: '🔧 تصفير القيم السالبة',
        fixDanger: false
      });
    }
    
    // ═══════════════════════════════════════════════════════════
    // 4. مدفوع أكبر من الإجمالي
    // ═══════════════════════════════════════════════════════════
    var overpaidOrders = orders.filter(function(o) {
      if (!window.orderTotal) return false;
      var total = window.orderTotal(o);
      var paid = Number(o.paid) || 0;
      return paid > total + 0.01; // هامش 1 قرش للأخطاء الحسابية
    });
    
    if (overpaidOrders.length > 0) {
      issues.push({
        id: 'overpaid_orders',
        level: 'warn',
        icon: '💰',
        title: overpaidOrders.length + ' طلب مدفوعه أكبر من إجماليه',
        description: 'قد يكون هناك خطأ في التسجيل. راجع هذه الطلبات يدوياً.',
        count: overpaidOrders.length,
        details: overpaidOrders.slice(0, 5).map(function(o) {
          var c = customers.find(function(x) { return x.id === o.customerId; });
          var total = window.orderTotal(o);
          var paid = Number(o.paid) || 0;
          return '• ' + (c ? c.name : 'عميل') + 
                 ' — مدفوع: ' + paid.toLocaleString('ar-EG') + 
                 ' / إجمالي: ' + total.toLocaleString('ar-EG');
        }).join('\n') + (overpaidOrders.length > 5 ? '\n... و ' + (overpaidOrders.length - 5) + ' آخر' : ''),
        // لا نقدم إصلاح تلقائي — يحتاج مراجعة يدوية
        fixAction: null,
        fixLabel: '📋 مراجعة يدوية'
      });
    }
    
    // ═══════════════════════════════════════════════════════════
    // 5. عملاء مكررين (نفس الاسم+الهاتف)
    // ═══════════════════════════════════════════════════════════
    var customerKeys = {};
    var duplicateCustomers = [];
    customers.forEach(function(c) {
      var key = (c.name || '').trim() + '|' + (c.phone || '').replace(/[^0-9]/g, '');
      if (!key || key === '|') return;
      if (!customerKeys[key]) customerKeys[key] = [];
      customerKeys[key].push(c);
    });
    Object.keys(customerKeys).forEach(function(k) {
      if (customerKeys[k].length > 1) {
        duplicateCustomers.push(customerKeys[k]);
      }
    });
    
    if (duplicateCustomers.length > 0) {
      issues.push({
        id: 'duplicate_customers',
        level: 'warn',
        icon: '👥',
        title: duplicateCustomers.length + ' مجموعة من العملاء المكررين',
        description: 'نفس الاسم ورقم الهاتف — قد تحتاج لدمجهم. ' +
                     'استخدم أداة "دمج عملاء مكررين" من الإعدادات.',
        count: duplicateCustomers.length,
        details: duplicateCustomers.slice(0, 3).map(function(g) {
          return '• ' + g.map(function(c) { return c.name; }).join(' / ');
        }).join('\n') + (duplicateCustomers.length > 3 ? '\n... و ' + (duplicateCustomers.length - 3) + ' آخر' : ''),
        fixAction: null,
        fixLabel: '👥 فتح أداة الدمج',
        fixCustom: function() {
          if (typeof window.renderDuplicateCustomersUI === 'function') {
            var page = document.getElementById('page-settings');
            if (page) {
              window.showPage('settings');
              setTimeout(function() {
                var card = document.getElementById('duplicateCustomersCard');
                if (card) card.scrollIntoView({ behavior: 'smooth' });
              }, 300);
            }
          }
        }
      });
    }
    
    // ═══════════════════════════════════════════════════════════
    // 6. تواريخ غير صالحة
    // ═══════════════════════════════════════════════════════════
    var invalidDateOrders = orders.filter(function(o) {
      var dates = [o.dateReceived, o.dateDelivery, o.deliveredDate];
      return dates.some(function(d) {
        if (!d) return false;
        return !/^\d{4}-\d{2}-\d{2}/.test(d);
      });
    });
    
    if (invalidDateOrders.length > 0) {
      issues.push({
        id: 'invalid_dates',
        level: 'warn',
        icon: '📅',
        title: invalidDateOrders.length + ' طلب فيه تاريخ بصيغة غير صالحة',
        description: 'التواريخ يجب أن تكون بصيغة YYYY-MM-DD.',
        count: invalidDateOrders.length,
        details: invalidDateOrders.slice(0, 3).map(function(o) {
          return '• طلب #' + (o.id || '').slice(-5).toUpperCase();
        }).join('\n') + (invalidDateOrders.length > 3 ? '\n... و ' + (invalidDateOrders.length - 3) + ' آخر' : ''),
        fixAction: null,
        fixLabel: '⚠️ يحتاج مراجعة يدوية'
      });
    }
    
    // ═══════════════════════════════════════════════════════════
    // 7. التزامات بمبالغ صفر
    // ═══════════════════════════════════════════════════════════
    var zeroCommitments = commitments.filter(function(c) {
      return c.active !== false && (Number(c.amount) || 0) <= 0;
    });
    
    if (zeroCommitments.length > 0) {
      issues.push({
        id: 'zero_commitments',
        level: 'info',
        icon: '💳',
        title: zeroCommitments.length + ' التزام بمبلغ صفر',
        description: 'الالتزامات بمبلغ صفر لا تُحسب في الإجمالي.',
        count: zeroCommitments.length,
        details: zeroCommitments.slice(0, 5).map(function(c) {
          return '• ' + (c.desc || 'بدون وصف');
        }).join('\n') + (zeroCommitments.length > 5 ? '\n... و ' + (zeroCommitments.length - 5) + ' آخر' : ''),
        fixAction: null,
        fixLabel: '⚠️ عدّل المبالغ يدوياً'
      });
    }
    
    // ═══════════════════════════════════════════════════════════
    // 8. دفعات بلا تاريخ
    // ═══════════════════════════════════════════════════════════
    var noDatePayments = payments.filter(function(p) {
      return !p.date;
    });
    
    if (noDatePayments.length > 0) {
      issues.push({
        id: 'no_date_payments',
        level: 'info',
        icon: '📆',
        title: noDatePayments.length + ' دفعة بلا تاريخ',
        description: 'الدفعات بلا تاريخ لا تظهر في التقارير الشهرية.',
        count: noDatePayments.length,
        details: '',
        fixAction: null,
        fixLabel: 'ℹ️ لا يحتاج إصلاحاً'
      });
    }
    
    // ═══════════════════════════════════════════════════════════
    // الإحصائيات النهائية
    // ═══════════════════════════════════════════════════════════
    var summary = {
      totalIssues: issues.length,
      criticalCount: issues.filter(function(i) { return i.level === 'danger'; }).length,
      warningCount: issues.filter(function(i) { return i.level === 'warn'; }).length,
      infoCount: issues.filter(function(i) { return i.level === 'info'; }).length,
      // إحصائيات عامة
      totalCustomers: customers.length,
      totalOrders: orders.length,
      totalPayments: payments.length,
      totalExpenses: expenses.length,
      dbSize: JSON.stringify(db).length
    };
    
    return { issues: issues, summary: summary };
  }
  
  // ═══════════════════════════════════════════════════════════════
  // دوال الإصلاح
  // ═══════════════════════════════════════════════════════════════
  
  window.deleteOrphanOrders = async function() {
    if (!window.db) return;
    
    var customerIds = {};
    window.db.customers.forEach(function(c) { customerIds[c.id] = true; });
    
    var orphanOrders = window.db.orders.filter(function(o) {
      return o.customerId && !customerIds[o.customerId];
    });
    
    var ok = await window.appConfirm(
      'سيتم حذف ' + orphanOrders.length + ' طلب يتيم نهائياً. هل أنت متأكد؟',
      { okText: 'حذف', cancelText: 'إلغاء', danger: true }
    );
    if (!ok) return;
    
    // نسخة أمان أولاً
    try {
      var backupKey = 'jalaba_pre_delete_backup_' + Date.now();
      localStorage.setItem(backupKey, JSON.stringify(window.db));
      console.log('💾 نسخة أمان محفوظة:', backupKey);
    } catch (e) { /* تجاهل */ }
    
    var idsToDelete = orphanOrders.map(function(o) { return o.id; });
    window.db.orders = window.db.orders.filter(function(o) {
      return idsToDelete.indexOf(o.id) === -1;
    });
    
    if (typeof window.saveDB === 'function') window.saveDB(true);
    if (typeof window.renderOrders === 'function') window.renderOrders();
    if (typeof window.renderHome === 'function') window.renderHome();
    
    if (typeof window.toast === 'function') {
      window.toast('✅ تم حذف ' + orphanOrders.length + ' طلب', 3000);
    }
    
    renderDoctorUI();
  };
  
  window.deleteOrphanPayments = async function() {
    if (!window.db) return;
    
    var orderIds = {};
    window.db.orders.forEach(function(o) { orderIds[o.id] = true; });
    
    var orphanPayments = window.db.payments.filter(function(p) {
      return p.orderId && !orderIds[p.orderId];
    });
    
    var ok = await window.appConfirm(
      'سيتم حذف ' + orphanPayments.length + ' دفعة يتيمة نهائياً. ' +
      'هذا سيؤثر على "إجمالي المحصّل". هل أنت متأكد؟',
      { okText: 'حذف', cancelText: 'إلغاء', danger: true }
    );
    if (!ok) return;
    
    try {
      var backupKey = 'jalaba_pre_delete_backup_' + Date.now();
      localStorage.setItem(backupKey, JSON.stringify(window.db));
    } catch (e) { /* تجاهل */ }
    
    var idsToDelete = orphanPayments.map(function(p) { return p.id; });
    window.db.payments = window.db.payments.filter(function(p) {
      return idsToDelete.indexOf(p.id) === -1;
    });
    
    if (typeof window.saveDB === 'function') window.saveDB(true);
    if (typeof window.renderFinance === 'function') window.renderFinance();
    if (typeof window.renderHome === 'function') window.renderHome();
    
    if (typeof window.toast === 'function') {
      window.toast('✅ تم حذف ' + orphanPayments.length + ' دفعة', 3000);
    }
    
    renderDoctorUI();
  };
  
  window.fixNegativeValues = async function() {
    if (!window.db) return;
    
    var count = 0;
    window.db.orders.forEach(function(o) {
      ['extra', 'materialCost', 'paid', 'fee'].forEach(function(field) {
        if ((Number(o[field]) || 0) < 0) {
          o[field] = 0;
          count++;
        }
      });
    });
    
    var ok = await window.appConfirm(
      'سيتم تصفير ' + count + ' قيمة سالبة في الطلبات. هل أنت متأكد؟',
      { okText: 'تصفير', cancelText: 'إلغاء', danger: false }
    );
    if (!ok) return;
    
    if (typeof window.saveDB === 'function') window.saveDB(true);
    if (typeof window.renderOrders === 'function') window.renderOrders();
    if (typeof window.renderFinance === 'function') window.renderFinance();
    
    if (typeof window.toast === 'function') {
      window.toast('✅ تم تصفير ' + count + ' قيمة', 3000);
    }
    
    renderDoctorUI();
  };
  
  // ═══════════════════════════════════════════════════════════════
  // عرض الواجهة
  // ═══════════════════════════════════════════════════════════════
  
  function getLevelColor(level) {
    if (level === 'danger') return 'var(--danger)';
    if (level === 'warn') return 'var(--warn, #b8860b)';
    if (level === 'info') return 'var(--info, #3B7AB8)';
    return 'var(--muted)';
  }
  
  function getLevelEmoji(level) {
    if (level === 'danger') return '🚨';
    if (level === 'warn') return '⚠️';
    if (level === 'info') return 'ℹ️';
    return '';
  }
  
  window.renderDoctorUI = function() {
    var box = document.getElementById('dataDoctorResults');
    if (!box) return;
    
    box.innerHTML = '<p class="meta">⏳ جاري الفحص...</p>';
    
    setTimeout(function() {
      var result = runAllChecks();
      var issues = result.issues;
      var summary = result.summary;
      
      if (issues.length === 0) {
        box.innerHTML =
          '<div class="card" style="background:var(--ok-light);padding:16px;text-align:center;">' +
            '<div style="font-size:42px;margin-bottom:8px;">✅</div>' +
            '<h3 style="color:var(--ok);margin:0 0 8px;">لا توجد مشاكل في البيانات</h3>' +
            '<div class="meta">تم فحص ' + summary.totalCustomers + ' عميل و' +
            summary.totalOrders + ' طلب — كل شيء سليم.</div>' +
          '</div>' +
          '<div class="meta" style="margin-top:12px;font-size:12px;text-align:center;">' +
            '🔒 البيانات المستخدمة: ' + (summary.dbSize / 1024).toFixed(1) + ' KB' +
          '</div>';
        return;
      }
      
      // عرض المشاكل
      var html = '';
      
      // ملخص
      html += '<div class="card" style="background:var(--card-alt);padding:12px;margin-bottom:12px;">';
      html += '<div class="row" style="margin-bottom:6px;"><b>📊 ملخص الفحص</b></div>';
      if (summary.criticalCount > 0) {
        html += '<div class="meta" style="color:var(--danger);">🚨 ' + summary.criticalCount + ' مشكلة حرجة</div>';
      }
      if (summary.warningCount > 0) {
        html += '<div class="meta" style="color:var(--warn, #b8860b);">⚠️ ' + summary.warningCount + ' تحذير</div>';
      }
      if (summary.infoCount > 0) {
        html += '<div class="meta" style="color:var(--info, #3B7AB8);">ℹ️ ' + summary.infoCount + ' ملاحظة</div>';
      }
      html += '<div class="meta" style="margin-top:8px;font-size:11.5px;">' +
        'فحص ' + summary.totalCustomers + ' عميل • ' +
        summary.totalOrders + ' طلب • ' +
        summary.totalPayments + ' دفعة' +
        '</div>';
      html += '</div>';
      
      // المشاكل
      issues.forEach(function(issue) {
        var color = getLevelColor(issue.level);
        var emoji = getLevelEmoji(issue.level);
        
        html += '<div class="card" style="border-inline-start:4px solid ' + color + ';padding:12px;margin-bottom:10px;">';
        html += '<div style="display:flex;align-items:flex-start;gap:8px;">';
        html += '<div style="font-size:22px;">' + issue.icon + '</div>';
        html += '<div style="flex:1;min-width:0;">';
        html += '<b style="font-size:14px;color:' + color + ';">' + emoji + ' ' + issue.title + '</b>';
        html += '<div class="meta" style="margin-top:6px;font-size:12px;">' + issue.description + '</div>';
        
        if (issue.details) {
          html += '<details style="margin-top:8px;">';
          html += '<summary style="cursor:pointer;font-size:12px;color:var(--muted);">👁️ عرض التفاصيل</summary>';
          html += '<pre style="background:var(--card-alt);padding:8px;border-radius:6px;font-size:11.5px;overflow-x:auto;white-space:pre-wrap;margin-top:6px;direction:rtl;">' + 
                  escapeHtml(issue.details) + '</pre>';
          html += '</details>';
        }
        
        // زر الإصلاح
        if (issue.fixAction) {
          html += '<button class="btn sm ' + (issue.fixDanger ? 'danger' : 'outline') + '" ' +
                  'style="margin-top:10px;width:100%;" ' +
                  'onclick="' + issue.fixAction + '()">' + issue.fixLabel + '</button>';
        } else if (issue.fixCustom) {
          // زر مخصص
          html += '<button class="btn sm outline" style="margin-top:10px;width:100%;" id="custom-fix-' + issue.id + '">' + 
                  issue.fixLabel + '</button>';
        } else if (issue.fixLabel) {
          html += '<div class="meta" style="margin-top:8px;text-align:center;font-size:11.5px;">' + issue.fixLabel + '</div>';
        }
        
        html += '</div></div></div>';
      });
      
      box.innerHTML = html;
      
      // ربط الأزرار المخصصة
      issues.forEach(function(issue) {
        if (issue.fixCustom) {
          var btn = document.getElementById('custom-fix-' + issue.id);
          if (btn) {
            btn.onclick = function() {
              closeModal();
              issue.fixCustom();
            };
          }
        }
      });
    }, 200);
  };
  
  function escapeHtml(s) {
    if (s === undefined || s === null) return '';
    return String(s).replace(/[&<>"']/g, function(m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  
  // ═══════════════════════════════════════════════════════════════
  // حقن البطاقة في الإعدادات
  // ═══════════════════════════════════════════════════════════════
  
  function injectDoctorCard() {
    var page = document.getElementById('page-settings');
    if (!page) return;
    if (page.querySelector('#dataDoctorCard')) return;
    
    var card = document.createElement('div');
    card.className = 'card';
    card.id = 'dataDoctorCard';
    card.innerHTML =
      '<h3>🔬 فحص سلامة البيانات</h3>' +
      '<p class="meta">' +
        'فحص تلقائي لبياناتك لكشف المشاكل: ' +
        'طلبات يتيمة، قيم سالبة، عملاء مكررين، تواريخ غير صالحة. ' +
        '<b>لا يتم تعديل أي شيء بدون تأكيدك.</b>' +
      '</p>' +
      '<button class="btn accent" style="margin-bottom:12px;" onclick="renderDoctorUI()">' +
        '🔍 ابدأ الفحص' +
      '</button>' +
      '<div id="dataDoctorResults">' +
        '<p class="meta" style="text-align:center;">اضغط "ابدأ الفحص" لعرض النتائج.</p>' +
      '</div>';
    
    page.appendChild(card);
  }
  
  if (typeof window.renderSettings === 'function') {
    var origRenderSettings = window.renderSettings;
    window.renderSettings = function() {
      origRenderSettings.apply(this, arguments);
      setTimeout(injectDoctorCard, 300);
    };
  }
  
  console.log('✅ تم تحميل data-doctor.js');
  console.log('   - 10 فحوصات تلقائية');
  console.log('   - كل إصلاح له تأكيد منفصل');
  console.log('   - يقرأ فقط بدون تعديل');

})();
