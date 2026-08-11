/* ============================================================
   feature-personal-controls.js
   تكملة مرحلة 2 — ثلاث أفكار من ملف "تجميع أفكار الالتزامات
   الشخصية" مجموعة إدارية شاملة، بنفس أسلوب اللف (wrap) حوالين
   الدوال الموجودة من غير أي لمس لـ core.js أو patches.js:

   1) 🧊 تجميد التزام مؤقتًا — بدل حذف الالتزام وإعادة إضافته
      تاني، بيتحط "متوقف مؤقتًا" (بيستخدم نفس عمود active اللي
      كل حسابات الاحتياج اليومي والتنبيهات أصلاً بتفلتر عليه)
      وبيفضل ظاهر في قسم "📦 متوقفة" الموجود، مع تمييزه بأنه
      تجميد مش انتهاء، وزرار "إلغاء التجميد" يرجّعه فورًا.
   2) 🌙 ساعات الهدوء — تحديد نطاق ساعات (مثلاً بعد المغرب لحد
      الصبح) ميوصلش فيها إشعار محلي عن الأقساط.
   3) 🔥 وضع الشهر الصعب — زرار في الإعدادات، لما يتفعّل بيقلل
      تنبيهات الالتزامات لبنود "🔴 ضروري" بس، ويأجّل عرض "⚖️ ممكن
      يتأجل" من قايمة التنبيهات (تفضل موجودة عادي في تاب القائمة).
   ============================================================ */
(function(){

  /* ---------- 1) تجميد مؤقت ---------- */
  window.freezeCommitmentTemp = async function(id){
    const c = (db.commitments||[]).find(x=>x.id===id);
    if(!c) return;
    if(!await appConfirm(`تجميد "${c.desc}" مؤقتًا؟ هيتوقف من حساب احتياجك اليومي والتنبيهات لحد ما تلغي التجميد.`)) return;
    c.active = false;
    c.frozen = true;
    saveDB();
    if(typeof renderCommitments==='function') renderCommitments();
    if(typeof renderPersonalAlerts==='function') renderPersonalAlerts();
    if(typeof renderRequiredCapacityCard==='function') renderRequiredCapacityCard();
    toast('🧊 اتجمّد الالتزام مؤقتًا');
  };

  window.unfreezeCommitmentTemp = function(id){
    const c = (db.commitments||[]).find(x=>x.id===id);
    if(!c) return;
    c.active = true;
    c.frozen = false;
    saveDB();
    if(typeof renderCommitments==='function') renderCommitments();
    if(typeof renderPersonalAlerts==='function') renderPersonalAlerts();
    if(typeof renderRequiredCapacityCard==='function') renderRequiredCapacityCard();
    toast('✅ اتلغى التجميد');
  };

  if(typeof commitmentCardHtml === 'function'){
    const origCardHtml = commitmentCardHtml;
    window.commitmentCardHtml = function(c, archived){
      let html = origCardHtml.apply(this, arguments);
      if(!archived){
        const editBtn = `<button class="btn sm outline" onclick="openCommitmentModal('${c.id}')">✏️ تعديل</button>`;
        const freezeBtn = `<button class="btn sm outline" onclick="freezeCommitmentTemp('${c.id}')">🧊 تجميد مؤقت</button>`;
        if(html.indexOf(editBtn)!==-1) html = html.replace(editBtn, editBtn+freezeBtn);
      } else if(c.frozen){
        const closeIdx = html.lastIndexOf('</div>');
        const unfreezeBtn = `<div class="btn-row" style="margin-top:6px;"><span class="meta">🧊 مجمّد مؤقتًا</span><button class="btn sm outline" onclick="unfreezeCommitmentTemp('${c.id}')">▶️ إلغاء التجميد</button></div>`;
        if(closeIdx!==-1) html = html.slice(0,closeIdx) + unfreezeBtn + html.slice(closeIdx);
      }
      return html;
    };
  }

  /* ---------- 2) ساعات الهدوء ---------- */
  function isQuietHoursNow(){
    const q = db.commitmentsQuietHours;
    if(!q || !q.enabled) return false;
    const h = new Date().getHours();
    const start = Number(q.startHour), end = Number(q.endHour);
    if(isNaN(start) || isNaN(end)) return false;
    if(start === end) return false;
    if(start < end) return h >= start && h < end;
    return h >= start || h < end; // نطاق عابر لنص الليل، زي 20 → 7
  }

  if(typeof maybeSendLocalCommitmentNotification === 'function'){
    const origNotify = maybeSendLocalCommitmentNotification;
    window.maybeSendLocalCommitmentNotification = function(dueAlerts){
      if(isQuietHoursNow()) return;
      return origNotify.apply(this, arguments);
    };
  }

  /* ---------- 3) وضع الشهر الصعب ---------- */
  window.toggleHardMonthMode = function(checked){
    db.hardMonthMode = !!checked;
    saveDB();
    if(typeof renderPersonalAlerts==='function') renderPersonalAlerts();
    toast(checked ? '🔥 اتفعّل وضع الشهر الصعب — التنبيهات دلوقتي للضروري بس' : 'اتلغى وضع الشهر الصعب');
  };

  if(typeof getCommitmentDueAlerts === 'function'){
    const origDueAlerts = getCommitmentDueAlerts;
    window.getCommitmentDueAlerts = function(){
      const alerts = origDueAlerts.apply(this, arguments);
      if(db.hardMonthMode){
        return alerts.filter(a => a.c.priority !== 'deferrable');
      }
      return alerts;
    };
  }

  /* ---------- حقن واجهة الإعدادات (ساعات الهدوء + الشهر الصعب) ---------- */
  function renderExtraSettings(){
    const box = document.getElementById('commitmentsSettingsCard');
    if(!box) return;
    if(box.querySelector('#personalControlsExtra')) box.querySelector('#personalControlsExtra').remove();
    const q = db.commitmentsQuietHours || {enabled:false, startHour:21, endHour:8};
    const hardOn = !!db.hardMonthMode;
    const extra = document.createElement('div');
    extra.id = 'personalControlsExtra';
    extra.innerHTML = `
      <hr class="sep">
      <div class="field"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
        <input type="checkbox" style="width:18px;height:18px;" id="quietHoursEnabled" ${q.enabled?'checked':''}> 🌙 ساعات هدوء — متوصلش فيها إشعارات الأقساط
      </label></div>
      <div class="field-row2">
        <div class="field"><label>من الساعة (24h)</label><input id="quietHoursStart" type="number" min="0" max="23" value="${Number(q.startHour)||21}"></div>
        <div class="field"><label>لحد الساعة (24h)</label><input id="quietHoursEnd" type="number" min="0" max="23" value="${Number(q.endHour)||8}"></div>
      </div>
      <button class="btn sm outline" id="saveQuietHoursBtn">💾 حفظ ساعات الهدوء</button>
      <hr class="sep">
      <div class="field"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
        <input type="checkbox" style="width:18px;height:18px;" id="hardMonthToggle" ${hardOn?'checked':''}> 🔥 وضع الشهر الصعب — تنبيهات "ضروري" بس لحد ما تلغيه
      </label></div>
    `;
    box.appendChild(extra);
    extra.querySelector('#saveQuietHoursBtn').onclick = function(){
      db.commitmentsQuietHours = {
        enabled: extra.querySelector('#quietHoursEnabled').checked,
        startHour: Math.max(0, Math.min(23, Number(extra.querySelector('#quietHoursStart').value)||0)),
        endHour: Math.max(0, Math.min(23, Number(extra.querySelector('#quietHoursEnd').value)||0)),
      };
      saveDB();
      toast('✅ اتحفظت ساعات الهدوء');
    };
    extra.querySelector('#hardMonthToggle').onchange = function(){ toggleHardMonthMode(this.checked); };
  }

  if(typeof renderCommitmentsSettingsCard === 'function'){
    const origSettings = renderCommitmentsSettingsCard;
    window.renderCommitmentsSettingsCard = function(){
      const r = origSettings.apply(this, arguments);
      renderExtraSettings();
      return r;
    };
  }

  document.addEventListener('DOMContentLoaded', function(){
    if(typeof renderCommitmentsSettingsCard==='function') renderCommitmentsSettingsCard();
  });
})();
