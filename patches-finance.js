/* ============================================================
   patches-finance.js - المالية والالتزامات الشخصية
   [الجزء 3 من 4 من patches.js القديم]
   
   المحتوى:
   - المستحقات المتوقعة أسبوعياً + ربطها بالالتزامات
   - أفضل أيام الأسبوع للتحصيل
   - الهدف الشهري للإيرادات
   - ربط المديونين بالالتزامات المستحقة
   - لوحة الصحة المالية الشخصية
   - الخريطة السنوية للالتزامات
   - صندوق الطوارئ
   - القروض الشخصية بجدول سداد
   - تجميع بانرات تنبيهات الالتزامات
   ============================================================ */

(function() {
  if (window.__patchesFinanceLoaded) return;
  window.__patchesFinanceLoaded = true;

  console.log('💰 تحميل patches-finance.js...');

  /* ============================================================
     [1] المستحقات المتوقعة أسبوعياً + ربطها بالالتزامات
     ============================================================ */
  function dueWithinDays(days) {
    var today = todayStr();
    var commitmentsTotal = 0, commitmentsCount = 0;
    try {
      var nowYM = currentYM();
      (db.commitments || []).filter(function(c) {
        return c.active !== false && c.dueDay;
      }).forEach(function(c) {
        if (c.lastPaidMonth === nowYM) return;
        if (!isCommitmentCycleMonth(c, nowYM)) return;
        var due = commitmentDueDateStr(c);
        var diff = Math.round((new Date(due) - new Date(today)) / 86400000);
        if (diff <= days) {
          commitmentsTotal += Number(c.amount || 0);
          commitmentsCount++;
        }
      });
    } catch (e) { /* تجاهل */ }

    var loanTotal = 0, loanCount = 0;
    try {
      var nowYM2 = currentYM();
      var parts = today.split('-').map(Number);
      var lastDay = new Date(Date.UTC(parts[0], parts[1], 0)).getUTCDate();
      (db.personalLoans || []).filter(function(l) {
        return l.active !== false && l.dueDay;
      }).forEach(function(l) {
        if (l.lastPaidMonth === nowYM2) return;
        var day = Math.min(Number(l.dueDay), lastDay);
        var due = nowYM2 + '-' + String(day).padStart(2, '0');
        var diff = Math.round((new Date(due) - new Date(today)) / 86400000);
        if (diff <= days) {
          loanTotal += Number(l.monthlyPayment || 0);
          loanCount++;
        }
      });
    } catch (e) { /* تجاهل */ }

    return { total: commitmentsTotal + loanTotal, count: commitmentsCount + loanCount };
  }

  var origRF_cashflow = renderFinance;
  renderFinance = function() {
    origRF_cashflow.apply(this, arguments);
    try {
      var today = todayStr();
      var in7 = new Date();
      in7.setDate(in7.getDate() + 7);
      var in7Str = in7.toISOString().slice(0, 10);
      var upcoming = db.orders.filter(function(o) {
        return o.status !== 'تم التسليم' && o.dateDelivery &&
          o.dateDelivery >= today && o.dateDelivery <= in7Str;
      });
      var expectedTotal = upcoming.reduce(function(s, o) { return s + orderRemaining(o); }, 0);
      var noDeposit = upcoming.filter(function(o) { return (Number(o.paid) || 0) === 0; });
      var noDepositAmount = noDeposit.reduce(function(s, o) { return s + orderRemaining(o); }, 0);
      var owed = dueWithinDays(7);
      var net = expectedTotal - owed.total;

      var box = document.getElementById('expectedCashflowBox');
      if (!box) {
        box = document.createElement('div');
        box.id = 'expectedCashflowBox';
        var financeStats = document.getElementById('financeStats');
        if (financeStats) financeStats.insertAdjacentElement('afterend', box);
      }

      var riskLine = noDeposit.length > 0
        ? '<div class="meta" style="margin-top:6px;color:var(--warn,#b8860b);">⚠️ منها ' + noDeposit.length +
          ' طلب من غير أي عربون بإجمالي ' + Math.round(noDepositAmount).toLocaleString('ar-EG') +
          ' ج.م — تحصيله وقت التسليم مش مضمون زي الطلبات اللي أخدت عربون.</div>'
        : '';

      var owedLine = owed.count > 0
        ? '<div class="row" style="margin-top:8px;"><span class="meta">مستحق عليك في نفس الفترة (أقساط/قروض)</span>' +
          '<b style="color:var(--danger);">' + Math.round(owed.total).toLocaleString('ar-EG') + ' ج.م</b></div>' +
          '<div class="meta">من ' + owed.count + ' قسط/التزام مستحق خلال 7 أيام</div>' +
          '<div class="row" style="margin-top:8px;border-top:1px solid var(--border);padding-top:8px;">' +
          '<span class="meta">' + (net >= 0 ? 'الصافي المتوقع بعد التزاماتك' : 'العجز المتوقع لو اتحصّل المتوقع بس') + '</span>' +
          '<b style="color:' + (net >= 0 ? 'var(--ok)' : 'var(--danger)') + ';">' +
          Math.round(net).toLocaleString('ar-EG') + ' ج.م</b></div>'
        : '<div class="meta" style="margin-top:6px;">مفيش أقساط أو قروض مستحقة عليك في نفس الفترة.</div>';

      box.innerHTML =
        '<div class="section-title">📥 مستحقات متوقعة (الأسبوع القادم)</div>' +
        '<div class="card"><div class="row"><h3>إجمالي المتوقع تحصيله</h3>' +
        '<b style="color:var(--ok);font-size:17px;">' + expectedTotal.toLocaleString('ar-EG') + ' ج.م</b></div>' +
        '<div class="meta">من ' + upcoming.length + ' طلب مجدول للتسليم خلال 7 أيام</div>' +
        riskLine + owedLine + '</div>';
    } catch (e) { /* تجاهل */ }
  };

  /* ============================================================
     [2] أفضل أيام الأسبوع للتحصيل
     ============================================================ */
  var origRF_bestday = renderFinance;
  renderFinance = function() {
    origRF_bestday.apply(this, arguments);
    try {
      var dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      var totals = [0, 0, 0, 0, 0, 0, 0];
      db.payments.forEach(function(p) {
        var d = new Date(p.date);
        if (isNaN(d.getTime())) return;
        totals[d.getDay()] += Number(p.amount) || 0;
      });
      var maxIdx = 0;
      for (var i = 1; i < 7; i++) if (totals[i] > totals[maxIdx]) maxIdx = i;
      var hasData = totals.some(function(t) { return t > 0; });

      var rows = dayNames.map(function(name, i) {
        var pct = totals[maxIdx] > 0 ? Math.round(totals[i] / totals[maxIdx] * 100) : 0;
        return '<div class="row" style="padding:4px 0;">' +
          '<span>' + name + '</span>' +
          '<div style="flex:1;margin:0 10px;background:var(--border);border-radius:6px;height:8px;overflow:hidden;">' +
          '<div style="width:' + pct + '%;height:100%;background:' +
          (i === maxIdx ? 'var(--accent)' : 'var(--primary)') + ';"></div></div>' +
          '<b style="font-size:12px;">' + totals[i].toLocaleString('ar-EG') + '</b>' +
          '</div>';
      }).join('');

      var box = document.getElementById('bestDayBox');
      if (!box) {
        box = document.createElement('div');
        box.id = 'bestDayBox';
        var anchor = document.getElementById('advancedAnalytics');
        if (anchor && anchor.parentElement) {
          anchor.parentElement.insertBefore(box, anchor.nextSibling);
        }
      }

      box.innerHTML = '<div class="section-title">📆 أفضل أيام الأسبوع (حسب التحصيل)</div>' +
        '<div class="card">' +
        (hasData
          ? rows + '<p class="meta" style="margin-top:8px;">🏆 يوم ' + dayNames[maxIdx] +
            ' هو الأعلى تحصيلاً — فكّر تزود الطاقة أو تركّز المتابعة حواليه</p>'
          : '<div class="empty-msg">لسه مفيش بيانات كفاية</div>') +
        '</div>';
    } catch (e) { /* تجاهل */ }
  };

  /* ============================================================
     [3] الهدف الشهري للإيرادات
     ============================================================ */
  function monthRevenue() {
    var prefix = todayStr().slice(0, 7);
    return db.payments.filter(function(p) {
      return p.date && p.date.slice(0, 7) === prefix;
    }).reduce(function(s, p) { return s + (Number(p.amount) || 0); }, 0);
  }

  function requiredPersonalMonthly() {
    try {
      var prog = monthlyCommitmentProgress();
      return prog ? prog.requiredMonthly : 0;
    } catch (e) { return 0; }
  }

  window.saveMonthlyGoal = function() {
    var val = Number(document.getElementById('f_monthlyGoal').value) || 0;
    db.monthlyRevenueGoal = val;
    saveDB(true);
    closeModal();
    toast('✅ تم حفظ الهدف الشهري');
    renderFinance();
  };

  window.useRequiredAsGoal = function() {
    var required = requiredPersonalMonthly();
    var input = document.getElementById('f_monthlyGoal');
    if (required > 0 && input) input.value = Math.ceil(required);
  };

  window.editMonthlyGoalModal = function() {
    var required = requiredPersonalMonthly();
    openModal(
      '<div class="modal-head"><h3>🎯 تحديد الهدف الشهري</h3><button class="modal-close" onclick="closeModal()">✕</button></div>' +
      '<div class="field"><label>الهدف الشهري (ج.م)</label><input id="f_monthlyGoal" type="number" value="' + (db.monthlyRevenueGoal || 0) + '"></div>' +
      (required > 0
        ? '<div class="meta" style="margin-bottom:10px;">💡 احتياجك الشخصي الشهري (من التزاماتك المسجلة) هو <b>' +
          Math.round(required).toLocaleString('ar-EG') +
          ' ج.م</b>. <span style="text-decoration:underline;cursor:pointer;" onclick="useRequiredAsGoal()">استخدمه كهدف</span></div>'
        : '') +
      '<button class="btn" onclick="saveMonthlyGoal()">💾 حفظ</button>'
    );
  };

  var origRF_goal = renderFinance;
  renderFinance = function() {
    origRF_goal.apply(this, arguments);
    try {
      var goal = Number(db.monthlyRevenueGoal) || 0;
      var revenue = monthRevenue();
      var pct = goal > 0 ? Math.min(100, Math.round(revenue / goal * 100)) : 0;
      var required = requiredPersonalMonthly();

      var box = document.getElementById('monthlyGoalBox');
      if (!box) {
        box = document.createElement('div');
        box.id = 'monthlyGoalBox';
        var anchor = document.getElementById('expectedCashflowBox') ||
          document.getElementById('financeStats');
        if (anchor) anchor.insertAdjacentElement('afterend', box);
      }

      var warnLine = (goal > 0 && required > 0 && goal < required)
        ? '<div class="alert-banner warn" style="margin-top:10px;"><span class="ic">⚠️</span><div>' +
          '<b>الهدف اللي حددته أقل من احتياجك الشخصي الشهري</b>' +
          'احتياجك الفعلي (من التزاماتك) ' + Math.round(required).toLocaleString('ar-EG') +
          ' ج.م — يعني حتى لو حققت الهدف بالكامل هتفضل ناقص ' +
          Math.round(required - goal).toLocaleString('ar-EG') + ' ج.م لتغطية التزاماتك.</div></div>'
        : '';

      box.innerHTML = '<div class="section-title">🎯 الهدف الشهري للإيرادات</div>' +
        '<div class="card" style="padding:10px 12px;">' +
        (goal > 0
          ? '<div class="row"><span class="meta">المحصّل هذا الشهر</span><b>' +
            revenue.toLocaleString('ar-EG') + ' / ' + goal.toLocaleString('ar-EG') + ' ج.م</b></div>' +
            '<div style="background:var(--border);border-radius:6px;height:10px;overflow:hidden;margin-top:8px;">' +
            '<div style="width:' + pct + '%;height:100%;background:var(--accent);"></div></div>' +
            '<div class="meta" style="margin-top:6px;">' + pct + '% من الهدف</div>'
          : '<div class="empty-msg">لسه معملتش هدف شهري' +
            (required > 0 ? ' — احتياجك الشخصي الشهري (من التزاماتك) ' +
              Math.round(required).toLocaleString('ar-EG') + ' ج.م' : '') + '</div>') +
        '<button class="btn sm secondary" style="margin-top:10px;" onclick="editMonthlyGoalModal()">' +
        (goal > 0 ? '✏️ تعديل الهدف' : '🎯 تحديد الهدف') + '</button>' +
        '</div>' + warnLine;
    } catch (e) { /* تجاهل */ }
  };

  /* ============================================================
     [4] ربط المديونين بالالتزامات المستحقة
     ============================================================ */
  if (typeof renderPersonalAlerts === 'function') {
    var origRPA_debtLink = renderPersonalAlerts;
    renderPersonalAlerts = function() {
      origRPA_debtLink.apply(this, arguments);
      try {
        var box = document.getElementById('personalAlerts');
        if (!box) return;
        if (window.userRole === 'receptionist') return;
        if (db.financePassword && !window.financeUnlocked) return;
        if (typeof getCommitmentDueAlerts !== 'function') return;
        if (typeof debtorCustomers !== 'function') return;
        if (typeof sendDebtReminder !== 'function') return;

        var dueAlerts = getCommitmentDueAlerts();
        if (!dueAlerts.length) return;
        var debtors = debtorCustomers();
        if (!debtors.length) return;

        var dueTotal = dueAlerts.reduce(function(s, a) { return s + Number(a.c.amount || 0); }, 0);
        var topDebtor = debtors[0];

        var banner = document.createElement('div');
        banner.className = 'alert-banner warn';
        banner.innerHTML = '<span class="ic">🔗</span><div>' +
          '<b>عندك ' + dueAlerts.length + ' قسط مستحق قريب بإجمالي ' +
          Math.round(dueTotal).toLocaleString('ar-EG') + ' ج.م، وفي المقابل عندك ' +
          debtors.length + ' عميل متجاوز حد المديونية</b>' +
          'أكبرهم "' + escapeHtml(topDebtor.customer.name) + '" بمبلغ ' +
          Math.round(topDebtor.amount).toLocaleString('ar-EG') +
          ' ج.م — تحصيله ممكن يغطي احتياجك القريب.' +
          '<div class="btn-row" style="margin-top:6px;">' +
          '<button class="btn sm outline" onclick="sendDebtReminder(\'' + topDebtor.customer.id + '\')">💬 ابعتله تذكير دلوقتي</button>' +
          '</div></div>';

        var emptyMsg = box.querySelector(':scope > .empty-msg');
        if (emptyMsg) box.innerHTML = '';
        box.appendChild(banner);
      } catch (e) { /* تجاهل */ }
    };
  }

  /* ============================================================
     [5] ربط الهدف الشهري بالالتزامات الشخصية
     ============================================================ */
  if (typeof renderPersonalAlerts === 'function') {
    var origRPA_goalLink = renderPersonalAlerts;
    renderPersonalAlerts = function() {
      origRPA_goalLink.apply(this, arguments);
      try {
        var box = document.getElementById('personalAlerts');
        if (!box) return;
        if (window.userRole === 'receptionist') return;
        if (db.financePassword && !window.financeUnlocked) return;

        var goal = Number(db.monthlyRevenueGoal) || 0;
        if (goal <= 0) return;

        var prog = typeof monthlyCommitmentProgress === 'function' ? monthlyCommitmentProgress() : null;
        if (!prog || prog.requiredMonthly <= 0 || goal >= prog.requiredMonthly) return;

        var gap = Math.round(prog.requiredMonthly - goal);
        var banner = document.createElement('div');
        banner.className = 'alert-banner warn';
        banner.innerHTML = '<span class="ic">🎯</span><div>' +
          '<b>هدف الإيرادات اللي حددته في صفحة المالية أقل من احتياجك الشخصي الشهري</b>' +
          'الهدف: ' + goal.toLocaleString('ar-EG') + ' ج.م، احتياجك الفعلي: ' +
          Math.round(prog.requiredMonthly).toLocaleString('ar-EG') +
          ' ج.م — فرق ' + gap.toLocaleString('ar-EG') + ' ج.م.' +
          '<div class="btn-row" style="margin-top:6px;">' +
          '<button class="btn sm outline" onclick="showPage(\'finance\');setTimeout(function(){var b=document.getElementById(\'monthlyGoalBox\');if(b)b.scrollIntoView({behavior:\'smooth\'});},200)">🎯 مراجعة الهدف</button>' +
          '</div></div>';

        var emptyMsg = box.querySelector(':scope > .empty-msg');
        if (emptyMsg) box.innerHTML = '';
        if (box.firstChild) box.insertBefore(banner, box.firstChild);
        else box.appendChild(banner);
      } catch (e) { /* تجاهل */ }
    };
  }

  /* ============================================================
     [6] تجميع بانرات تنبيهات الالتزامات في كارت قابل للطي
     ============================================================ */
  if (typeof renderPersonalAlerts === 'function') {
    var origRPA_collapse = renderPersonalAlerts;
    renderPersonalAlerts = function() {
      try {
        origRPA_collapse.apply(this, arguments);
        var box = document.getElementById('personalAlerts');
        if (!box) return;
        var banners = box.querySelectorAll(':scope > .alert-banner');
        if (banners.length < 2) return;

        var level = box.querySelector(':scope > .alert-banner.danger') ? 'danger'
          : box.querySelector(':scope > .alert-banner.warn') ? 'warn' : 'good';
        var icon = level === 'danger' ? '🔴' : (level === 'warn' ? '🟡' : '🟢');
        var inner = box.innerHTML;
        var count = banners.length;

        box.innerHTML = '' +
          '<div class="alert-banner ' + level + '" id="personalAlertsSummaryBtn" style="cursor:pointer;">' +
          '<span class="ic">' + icon + '</span><div><b>عندك ' + count + ' تنبيهات على التزاماتك الشخصية</b>' +
          '<span id="personalAlertsToggleTxt">اضغط لعرض التفاصيل ▾</span></div></div>' +
          '<div id="personalAlertsDetails" style="display:none;">' + inner + '</div>';

        var summaryBtn = document.getElementById('personalAlertsSummaryBtn');
        if (summaryBtn) {
          summaryBtn.addEventListener('click', function() {
            var details = document.getElementById('personalAlertsDetails');
            var txt = document.getElementById('personalAlertsToggleTxt');
            var open = details.style.display !== 'none';
            details.style.display = open ? 'none' : 'block';
            txt.textContent = open ? 'اضغط لعرض التفاصيل ▾' : 'اضغط للإخفاء ▴';
          });
        }
      } catch (e) { /* تجاهل */ }
    };
  }

  /* ============================================================
     [7] لوحة الصحة المالية الشخصية
     ============================================================ */
  function safe(fn, fallback) {
    try { return fn(); } catch (e) { return fallback; }
  }

  function calcHealthSnapshot() {
    var r = safe(function() { return calcRequiredDailyCapacity(); }, { total: 0 });
    var currentCapacity = Number(db.dailyCapacity) || 500;
    var coveragePct = r && r.total > 0 ? Math.round((currentCapacity / r.total) * 100) : 100;
    var missedCount = (db.missedCommitmentNotices || []).length;
    var dueSoonCount = safe(function() { return getCommitmentDueAlerts().length; }, 0);

    var goalProg = safe(function() {
      if (typeof savingsGoalProgress === 'function') return savingsGoalProgress();
      var target = Number(db.savingsGoalTarget) || 0;
      if (!target || typeof totalSavedAmount !== 'function') return null;
      var saved = totalSavedAmount();
      return { saved: saved, goal: target, pct: Math.min(100, Math.round(saved / target * 100)) };
    }, null);

    var ef = safe(function() { return calcEmergencyFundRunway(); }, null);
    var totalDebt = safe(function() {
      return typeof totalRemainingLoansDebt === 'function' ? totalRemainingLoansDebt() : 0;
    }, 0);

    var totalOwedToYou = safe(function() {
      var totalFees = (db.orders || []).reduce(function(s, o) { return s + orderTotal(o); }, 0);
      var totalCollected = (db.payments || []).reduce(function(s, p) { return s + Number(p.amount || 0); }, 0);
      return totalFees - totalCollected;
    }, 0);

    var netPosition = totalOwedToYou - totalDebt;

    return {
      r: r, currentCapacity: currentCapacity, coveragePct: coveragePct,
      missedCount: missedCount, dueSoonCount: dueSoonCount, goalProg: goalProg,
      ef: ef, totalDebt: totalDebt, totalOwedToYou: totalOwedToYou, netPosition: netPosition
    };
  }

  window.renderFinancialHealthDashboard = function() {
    var box = document.getElementById('financialHealthBox');
    if (!box) return;
    if (db.financePassword && !window.financeUnlocked) { box.innerHTML = ''; return; }
    var hasData = (db.commitments || []).length > 0 || (db.houseExpenses || []).length > 0;
    if (!hasData) {
      box.innerHTML = '<div class="empty-msg">أضف التزاماتك الشهرية عشان تظهر لوحة الصحة المالية هنا.</div>';
      return;
    }

    var s = calcHealthSnapshot();
    var covColor = s.coveragePct >= 100 ? 'var(--primary)' :
      (s.coveragePct >= 70 ? 'var(--warn,#b8860b)' : 'var(--danger)');

    box.innerHTML = '' +
      '<div class="stat-card"><div class="stat-ic">📶</div><div>' +
      '<div class="num" style="color:' + covColor + ';">' + s.coveragePct + '%</div>' +
      '<div class="lbl">نسبة تغطية التزاماتك بسعتك الحالية</div></div></div>' +
      '<div class="stat-card ' + (s.missedCount > 0 ? 'danger' : '') + '"><div class="stat-ic">⏮️</div><div>' +
      '<div class="num">' + s.missedCount + '</div>' +
      '<div class="lbl">التزامات فاتك تسجيلها كمدفوعة</div></div></div>' +
      '<div class="stat-card ' + (s.dueSoonCount > 0 ? 'danger' : '') + '"><div class="stat-ic">🔔</div><div>' +
      '<div class="num">' + s.dueSoonCount + '</div>' +
      '<div class="lbl">مستحق خلال 3 أيام أو أقل</div></div></div>' +
      (s.goalProg ? '<div class="stat-card"><div class="stat-ic">🎯</div><div>' +
        '<div class="num">' + s.goalProg.pct + '%</div>' +
        '<div class="lbl">تقدّم هدف الادخار</div></div></div>' : '') +
      (s.ef ? '<div class="stat-card ' + (s.ef.months < 3 ? 'danger' : '') + '"><div class="stat-ic">🧳</div><div>' +
        '<div class="num">' + s.ef.months.toFixed(1) + '</div>' +
        '<div class="lbl">شهر تغطية من صندوق الطوارئ</div></div></div>' : '') +
      (s.totalDebt > 0 ? '<div class="stat-card"><div class="stat-ic">🧾</div><div>' +
        '<div class="num">' + Math.round(s.totalDebt).toLocaleString('ar-EG') + '</div>' +
        '<div class="lbl">إجمالي المتبقي على قروضك</div></div></div>' : '') +
      ((s.totalOwedToYou > 0 || s.totalDebt > 0) ?
        '<div class="stat-card ' + (s.netPosition < 0 ? 'danger' : '') + '"><div class="stat-ic">📐</div><div>' +
        '<div class="num">' + Math.round(s.netPosition).toLocaleString('ar-EG') + '</div>' +
        '<div class="lbl">صافي وضعك المالي (مستحقاتك عند العملاء − قروضك المتبقية)</div></div></div>' : '');

    // توزيع الالتزامات بالنوع
    try {
      var byType = {};
      (db.commitments || []).filter(function(c) { return c.active !== false; }).forEach(function(c) {
        var key = c.type || 'تانية';
        var share = typeof commitmentMonthlyShare === 'function' ? commitmentMonthlyShare(c) : Number(c.amount || 0);
        byType[key] = (byType[key] || 0) + share;
      });
      if (s.r && s.r.houseTotal > 0 && s.r.housePerDay) byType['🏠 بيت'] = s.r.housePerDay * 30;
      if (s.r && s.r.loanMonthly > 0) byType['💳 قروض'] = s.r.loanMonthly;

      var keys = Object.keys(byType).sort(function(a, b) { return byType[b] - byType[a]; });
      if (keys.length) {
        var breakdownBox = document.getElementById('financialHealthTypeBreakdown');
        if (!breakdownBox) {
          breakdownBox = document.createElement('div');
          breakdownBox.id = 'financialHealthTypeBreakdown';
          breakdownBox.style.marginTop = '10px';
          if (box.parentNode) box.parentNode.appendChild(breakdownBox);
        }
        breakdownBox.innerHTML = '<div class="meta" style="margin-bottom:4px;">📊 توزيع التزاماتك الشهرية بالنوع:</div>' +
          '<div class="meta">' + keys.map(function(k) {
            var icon = (typeof commitmentTypeInfo === 'function' && !/^[🏠💳]/.test(k)) ?
              commitmentTypeInfo(k).icon + ' ' : '';
            return icon + k + ': ' + Math.round(byType[k]).toLocaleString('ar-EG') + ' ج.م';
          }).join(' — ') + '</div>';
      }
    } catch (e) { /* تجاهل */ }
  };

  // ربط لوحة الصحة المالية بصفحة الالتزامات الشخصية
  var hookHealthTarget = typeof renderPersonalPage === 'function' ? 'renderPersonalPage' : 'renderFinance';
  var hookHealthContainerId = hookHealthTarget === 'renderPersonalPage'
    ? (document.getElementById('personalTab-overview') ? 'personalTab-overview' : 'page-personal')
    : 'page-finance';

  var origHealthRender = window[hookHealthTarget];
  window[hookHealthTarget] = function() {
    origHealthRender.apply(this, arguments);
    try {
      var page = document.getElementById(hookHealthContainerId);
      if (!page) return;
      if (!page.querySelector('#financialHealthCard')) {
        var card = document.createElement('div');
        card.className = 'card';
        card.id = 'financialHealthCard';
        card.innerHTML = '<h3>📋 لوحة الصحة المالية الشخصية</h3>' +
          '<div id="financialHealthBox" class="grid-cards"></div>';
        page.appendChild(card);
      }
      renderFinancialHealthDashboard();
    } catch (e) { /* تجاهل */ }
  };

  /* ============================================================
     [8] الخريطة السنوية للالتزامات
     ============================================================ */
  var hasCycleHelpers = typeof currentYM === 'function' &&
    typeof isCommitmentCycleMonth === 'function' &&
    typeof addMonthsYM === 'function';

  function fallbackAddMonthsYM(ym, n) {
    var parts = ym.split('-');
    var y = Number(parts[0]);
    var m = Number(parts[1]);
    var total = (y * 12 + (m - 1)) + n;
    var ny = Math.floor(total / 12);
    var nm = (total % 12) + 1;
    return ny + '-' + (nm < 10 ? '0' : '') + nm;
  }

  function calcAnnualCommitmentsMap() {
    var nowYM = hasCycleHelpers ? currentYM() : todayStr().slice(0, 7);
    var housePerDay = 0;
    try { housePerDay = calcRequiredDailyCapacity().housePerDay || 0; } catch (e) { /* تجاهل */ }
    var houseMonthly = housePerDay * 30;
    var loanMonthly = (db.personalLoans || []).filter(function(l) { return l.active !== false; })
      .reduce(function(s, l) { return s + Number(l.monthlyPayment || 0); }, 0);
    var loanSchedule = typeof calcLoanMonthlyByMonthIndex === 'function' ?
      calcLoanMonthlyByMonthIndex() : null;

    var months = [];
    for (var i = 0; i < 12; i++) {
      var ym = hasCycleHelpers ? addMonthsYM(nowYM, i) : fallbackAddMonthsYM(nowYM, i);
      var byType = {};
      var commitmentsTotal = 0;

      (db.commitments || []).filter(function(c) {
        if (c.active === false) return false;
        return hasCycleHelpers ? isCommitmentCycleMonth(c, ym) : true;
      }).forEach(function(c) {
        var amt = Number(c.amount || 0);
        var key = c.type || 'تانية';
        byType[key] = (byType[key] || 0) + amt;
        commitmentsTotal += amt;
      });

      var loanForMonth = loanSchedule ? loanSchedule[i] : loanMonthly;
      if (houseMonthly > 0) byType['🏠 بيت'] = houseMonthly;
      if (loanForMonth > 0) byType['💳 قروض'] = loanForMonth;

      months.push({
        ym: ym, commitmentsTotal: commitmentsTotal, houseMonthly: houseMonthly,
        loanMonthly: loanForMonth, byType: byType,
        total: commitmentsTotal + houseMonthly + loanForMonth
      });
    }
    return months;
  }

  window.renderAnnualCommitmentsMap = function() {
    var box = document.getElementById('annualCommitmentsMapBox');
    if (!box) return;
    if (db.financePassword && !window.financeUnlocked) { box.innerHTML = ''; return; }
    var months = calcAnnualCommitmentsMap();
    var avg = months.reduce(function(s, m) { return s + m.total; }, 0) / months.length;

    box.innerHTML = months.map(function(m, i) {
      var label = new Date(m.ym + '-01').toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
      var heavy = avg > 0 && m.total > avg * 1.2;
      var typeKeys = Object.keys(m.byType).sort(function(a, b) { return m.byType[b] - m.byType[a]; });
      var breakdown = typeKeys.length ? '<div class="meta" style="padding-right:2px;">' +
        typeKeys.map(function(k) {
          var icon = (typeof commitmentTypeInfo === 'function' && !/^[🏠💳]/.test(k)) ?
            commitmentTypeInfo(k).icon + ' ' : '';
          return icon + k + ': ' + Math.round(m.byType[k]).toLocaleString('ar-EG') + ' ج.م';
        }).join(' — ') + '</div>' : '';

      return '<div style="padding:8px 0;' + (i < months.length - 1 ? 'border-bottom:1px solid var(--border);' : '') + '">' +
        '<div class="row" style="' + (i === 0 ? 'font-weight:800;' : '') + '">' +
        '<span>' + (i === 0 ? '📍 ' : '') + label +
        (heavy ? ' <span class="meta">🔥 شهر تقيل</span>' : '') + '</span>' +
        '<b style="color:' + (heavy ? 'var(--danger)' : 'inherit') + ';">' +
        Math.round(m.total).toLocaleString('ar-EG') + ' ج.م</b>' +
        '</div>' + breakdown + '</div>';
    }).join('');
  };

  var hookMapTarget = typeof renderPersonalPage === 'function' ? 'renderPersonalPage' : 'renderFinance';
  var hookMapContainerId = hookMapTarget === 'renderPersonalPage'
    ? (document.getElementById('personalTab-reports') ? 'personalTab-reports' : 'page-personal')
    : 'page-finance';

  var origMapRender = window[hookMapTarget];
  window[hookMapTarget] = function() {
    origMapRender.apply(this, arguments);
    try {
      var page = document.getElementById(hookMapContainerId);
      if (!page) return;
      if (!page.querySelector('#annualCommitmentsMapCard')) {
        var card = document.createElement('div');
        card.className = 'card';
        card.id = 'annualCommitmentsMapCard';
        card.innerHTML = '<h3>🗓️ خريطة سنوية للالتزامات</h3>' +
          '<p class="meta">إجمالي الالتزامات المتوقعة (شاملة الموسمية) لكل شهر من الـ12 شهر الجايين، عشان تشوف الشهر التقيل بدري.</p>' +
          '<div id="annualCommitmentsMapBox"></div>';
        page.appendChild(card);
      }
      renderAnnualCommitmentsMap();
    } catch (e) { /* تجاهل */ }
  };

  /* ============================================================
     [9] صندوق الطوارئ
     ============================================================ */
  window.calcEmergencyFundRunway = function() {
    var savings = Number(db.emergencyFundBalance) || 0;
    var monthlyCommitments = (db.commitments || []).filter(function(c) {
      return c.active !== false;
    }).reduce(function(s, c) {
      return s + (Number(c.amount || 0) / (Number(c.intervalMonths) || 1));
    }, 0);
    var loanMonthly = (db.personalLoans || []).filter(function(l) {
      return l.active !== false;
    }).reduce(function(s, l) { return s + Number(l.monthlyPayment || 0); }, 0);
    var houseMonthly = calcRequiredDailyCapacity().housePerDay * 30;
    var totalMonthly = monthlyCommitments + loanMonthly + houseMonthly;
    if (totalMonthly <= 0) return null;
    return { savings: savings, totalMonthly: totalMonthly, months: savings / totalMonthly };
  };

  window.saveEmergencyFundBalance = function() {
    var input = document.getElementById('emergencyFundInput');
    if (!input) return;
    db.emergencyFundBalance = Number(input.value) || 0;
    saveDB(true);
    renderEmergencyFundCard();
    renderFinancialHealthDashboard();
    toast('✅ اتحفظ رصيد صندوق الطوارئ');
  };

  window.renderEmergencyFundCard = function() {
    var box = document.getElementById('emergencyFundBox');
    if (!box) return;
    if (db.financePassword && !window.financeUnlocked) { box.innerHTML = ''; return; }
    var ef = calcEmergencyFundRunway();
    var status = !ef ? { label: '', color: '' }
      : ef.months >= 6 ? { label: 'قوي 💪', color: 'var(--primary)' }
      : ef.months >= 3 ? { label: 'مقبول 👍', color: 'var(--warn,#b8860b)' }
      : ef.months >= 1 ? { label: 'ضعيف ⚠️', color: 'var(--danger)' }
      : { label: 'خطر 🚨', color: 'var(--danger)' };

    box.innerHTML = '' +
      '<div class="field"><label>رصيد مدخراتك الحالي (ج.م)</label>' +
      '<input id="emergencyFundInput" type="number" value="' + (db.emergencyFundBalance || 0) + '"></div>' +
      '<button class="btn sm outline" onclick="saveEmergencyFundBalance()">💾 حفظ الرصيد</button>' +
      (ef
        ? '<div class="meta" style="margin-top:10px;line-height:1.8;">' +
          'لو الدخل وقف تمامًا النهاردة، مدخراتك هتغطي احتياجاتك الشهرية لمدة تقريبية: ' +
          '<b style="color:' + status.color + ';font-size:16px;"> ' + ef.months.toFixed(1) + ' شهر</b> (' + status.label + ')' +
          '<br><span class="meta">إجمالي احتياجك الشهري: ' + Math.round(ef.totalMonthly).toLocaleString('ar-EG') + ' ج.م</span>' +
          '<br><span class="meta">المعدل الصحي المتعارف عليه: 3-6 شهور على الأقل</span></div>'
        : '<p class="meta" style="margin-top:8px;">أضف التزاماتك الشهرية الأول عشان نحسبلك المدة.</p>') +
      '<div class="meta" style="margin-top:8px;">ℹ️ الرصيد هنا منفصل عن "🎯 هدف الادخار" — تقدر ترحّل رصيد أي هدف ادخار تحققه هنا كإضافة لصندوق الطوارئ.</div>';
  };

  var hookEfTarget = typeof renderPersonalPage === 'function' ? 'renderPersonalPage' : 'renderFinance';
  var hookEfContainerId = hookEfTarget === 'renderPersonalPage'
    ? (document.getElementById('personalTab-list') ? 'personalTab-list' : 'page-personal')
    : 'page-finance';

  var origEfRender = window[hookEfTarget];
  window[hookEfTarget] = function() {
    origEfRender.apply(this, arguments);
    try {
      var page = document.getElementById(hookEfContainerId);
      if (!page) return;
      if (!page.querySelector('#emergencyFundCard')) {
        var card = document.createElement('div');
        card.className = 'card';
        card.id = 'emergencyFundCard';
        card.innerHTML = '<h3>🧳 صندوق الطوارئ</h3><div id="emergencyFundBox"></div>';
        page.appendChild(card);
      }
      renderEmergencyFundCard();
    } catch (e) { /* تجاهل */ }
  };

  /* ============================================================
     [10] القروض الشخصية بجدول سداد
     ============================================================ */
  if (!document.getElementById('rcLoanProgressStyle')) {
    var styleTag = document.createElement('style');
    styleTag.id = 'rcLoanProgressStyle';
    styleTag.textContent =
      '.progress-track{background:rgba(0,0,0,0.08);border-radius:8px;height:8px;overflow:hidden;}' +
      '.progress-fill{background:var(--primary);height:100%;}';
    document.head.appendChild(styleTag);
  }

  function ensureLoansArray() {
    if (!db.personalLoans) db.personalLoans = [];
    return db.personalLoans;
  }

  function loanDaysUntilDue(l) {
    if (!l.dueDay || l.active === false) return null;
    var today = todayStr();
    var parts = today.split('-').map(Number);
    var y = parts[0], m = parts[1];
    var lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    var day = Math.min(Number(l.dueDay), lastDay);
    var due = y + '-' + String(m).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    return Math.round((new Date(due) - new Date(today)) / 86400000);
  }

  window.totalRemainingLoansDebt = function() {
    return ensureLoansArray().filter(function(l) { return l.active !== false; })
      .reduce(function(s, l) { return s + Number(l.remainingBalance || 0); }, 0);
  };

  window.calcLoanMonthlyByMonthIndex = function() {
    var loans = ensureLoansArray().filter(function(l) {
      return l.active !== false && Number(l.monthlyPayment) > 0;
    });
    var perMonth = new Array(12).fill(0);
    loans.forEach(function(l) {
      var remaining = Number(l.remainingBalance) || 0;
      var pay = Number(l.monthlyPayment) || 0;
      for (var i = 0; i < 12 && remaining > 0; i++) {
        var thisMonth = Math.min(pay, remaining);
        perMonth[i] += thisMonth;
        remaining -= thisMonth;
      }
    });
    return perMonth;
  };

  window.addPersonalLoan = function() {
    var desc = document.getElementById('loanDescInput').value.trim();
    var principal = Number(document.getElementById('loanPrincipalInput').value) || 0;
    var monthlyPayment = Number(document.getElementById('loanMonthlyInput').value) || 0;
    var dueDay = Number(document.getElementById('loanDueDayInput').value) || null;
    if (!desc || principal <= 0) {
      toast('اكتب وصف القرض والمبلغ الأصلي على الأقل');
      return;
    }
    ensureLoansArray().push({
      id: uid(), desc: desc, principal: principal, remainingBalance: principal,
      monthlyPayment: monthlyPayment, dueDay: dueDay, lastPaidMonth: null,
      startDate: todayStr(), active: true, payments: []
    });
    saveDB(true);
    document.getElementById('loanDescInput').value = '';
    document.getElementById('loanPrincipalInput').value = '';
    document.getElementById('loanMonthlyInput').value = '';
    document.getElementById('loanDueDayInput').value = '';
    renderPersonalLoans();
    toast('✅ اتضاف القرض');
  };

  window.recordLoanPayment = async function(loanId) {
    var loan = ensureLoansArray().find(function(l) { return l.id === loanId; });
    if (!loan) return;
    var suggested = loan.monthlyPayment || loan.remainingBalance;
    var input = prompt('قيمة الدفعة (ج.م):', suggested);
    if (input === null) return;
    var amount = Number(input) || 0;
    if (amount <= 0) return;

    loan.remainingBalance = Math.max(0, loan.remainingBalance - amount);
    loan.payments = loan.payments || [];
    loan.payments.push({ date: todayStr(), amount: amount });
    loan.lastPaidMonth = typeof currentYM === 'function' ? currentYM() : todayStr().slice(0, 7);

    if (loan.remainingBalance <= 0) {
      loan.active = false;
      logActivity('🏁 انتهى سداد قرض: ' + loan.desc);
    }
    saveDB(true);
    renderPersonalLoans();
    if (typeof renderFinancialHealthDashboard === 'function') renderFinancialHealthDashboard();
    toast(loan.active ? '✅ اتسجلت الدفعة' : '🎉 مبروك، اتسدد القرض بالكامل!');
  };

  window.deletePersonalLoan = async function(loanId) {
    var ok = await appConfirm('هل تريد حذف هذا القرض نهائيًا؟',
      { okText: 'حذف', cancelText: 'إلغاء', danger: true });
    if (!ok) return;
    db.personalLoans = ensureLoansArray().filter(function(l) { return l.id !== loanId; });
    saveDB(true);
    renderPersonalLoans();
    if (typeof renderFinancialHealthDashboard === 'function') renderFinancialHealthDashboard();
  };

  window.renderPersonalLoans = function() {
    var box = document.getElementById('personalLoansBox');
    if (!box) return;
    if (db.financePassword && !window.financeUnlocked) { box.innerHTML = ''; return; }
    var loans = ensureLoansArray().slice().sort(function(a, b) {
      return (b.active ? 1 : 0) - (a.active ? 1 : 0);
    });
    var nowYM = typeof currentYM === 'function' ? currentYM() : todayStr().slice(0, 7);

    box.innerHTML = loans.length ? loans.map(function(l) {
      var pct = l.principal > 0 ? Math.round(((l.principal - l.remainingBalance) / l.principal) * 100) : 0;
      var dueLine = '';

      if (l.active !== false && l.dueDay) {
        var paidThisMonth = l.lastPaidMonth === nowYM;
        var diff = loanDaysUntilDue(l);
        if (!paidThisMonth && diff != null) {
          if (diff < 0) dueLine = '<div class="meta" style="color:var(--danger);margin-top:4px;">⏰ متأخر ' +
            Math.abs(diff) + ' يوم عن يوم استحقاقه (' + l.dueDay + ' من الشهر)</div>';
          else if (diff <= 3) dueLine = '<div class="meta" style="color:var(--danger);margin-top:4px;">🔔 قسط القرض مستحق ' +
            (diff === 0 ? 'النهاردة' : diff === 1 ? 'بكرة' : 'خلال ' + diff + ' أيام') + '</div>';
        } else if (paidThisMonth) {
          dueLine = '<div class="meta" style="margin-top:4px;">✅ مدفوع الشهر ده</div>';
        }
      }

      return '<div class="card" style="padding:12px;margin-bottom:10px;' +
        (!l.active ? 'opacity:.65;' : '') + '">' +
        '<div class="row"><h3>' + escapeHtml(l.desc) +
        (!l.active ? ' <span class="meta">(مسدّد بالكامل ✅)</span>' : '') + '</h3>' +
        '<button class="btn sm outline" onclick="deletePersonalLoan(\'' + l.id + '\')">🗑️</button></div>' +
        '<div class="meta">المبلغ الأصلي: ' + Number(l.principal).toLocaleString('ar-EG') +
        ' ج.م — المتبقي: <b>' + Number(l.remainingBalance).toLocaleString('ar-EG') + ' ج.م</b>' +
        (l.dueDay ? ' — 📅 يستحق يوم ' + l.dueDay + ' من كل شهر' : '') + '</div>' +
        '<div class="progress-track" style="margin-top:6px;"><div class="progress-fill" style="width:' + pct + '%;"></div></div>' +
        '<div class="meta" style="margin-top:4px;">نسبة السداد: ' + pct + '%</div>' +
        dueLine +
        (l.active ? '<button class="btn sm outline" style="margin-top:8px;" onclick="recordLoanPayment(\'' + l.id + '\')">💵 تسجيل دفعة</button>' : '') +
        '</div>';
    }).join('') : '<p class="meta">لا توجد قروض مسجّلة.</p>';
  };

  var hookLoansTarget = typeof renderPersonalPage === 'function' ? 'renderPersonalPage' : 'renderFinance';
  var hookLoansContainerId = hookLoansTarget === 'renderPersonalPage'
    ? (document.getElementById('personalTab-list') ? 'personalTab-list' : 'page-personal')
    : 'page-finance';

  var origLoansRender = window[hookLoansTarget];
  window[hookLoansTarget] = function() {
    origLoansRender.apply(this, arguments);
    try {
      var page = document.getElementById(hookLoansContainerId);
      if (!page) return;
      if (!page.querySelector('#personalLoansCard')) {
        var card = document.createElement('div');
        card.className = 'card';
        card.id = 'personalLoansCard';
        card.innerHTML = '<h3>💳 قروض شخصية بجدول سداد</h3>' +
          '<div class="field"><label>وصف القرض</label>' +
          '<input id="loanDescInput" type="text" placeholder="مثال: قرض سيارة"></div>' +
          '<div class="field"><label>المبلغ الأصلي (ج.م)</label>' +
          '<input id="loanPrincipalInput" type="number"></div>' +
          '<div class="field"><label>القسط الشهري المعتاد (ج.م) <span class="meta">— اختياري</span></label>' +
          '<input id="loanMonthlyInput" type="number"></div>' +
          '<div class="field"><label>يوم استحقاق القسط من الشهر <span class="meta">— اختياري</span></label>' +
          '<input id="loanDueDayInput" type="number" min="1" max="31" placeholder="مثال: 10"></div>' +
          '<button class="btn sm outline" onclick="addPersonalLoan()">➕ إضافة قرض</button>' +
          '<div id="personalLoansBox" style="margin-top:14px;"></div>';
        page.appendChild(card);
      }
      renderPersonalLoans();
    } catch (e) { /* تجاهل */ }
  };

  console.log('✅ تم تحميل patches-finance.js بنجاح');
})();