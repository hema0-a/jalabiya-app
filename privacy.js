/* خصوصية — ملف JS لإدارة "الوضع الخاص" (masking) */
(function(){
  // محاولة استخدام db من التطبيق الرئيسي؛ إذا لم يكن محمّلاً ننتظر أو ننشئ نسخة محدودة.
  function ensureDB(){
    if(window.db === undefined || window.db === null){
      if(typeof loadDB === 'function') {
        try { loadDB(); } catch(e){ window.db = window.db || { privateMode:false }; }
      } else {
        window.db = window.db || { privateMode:false };
      }
    }
  }

  function applyPrivateModeUI(){
    ensureDB();
    const enabled = !!window.db.privateMode;
    document.documentElement.classList.toggle('private-mode', enabled);

    // نطبق الأقنعة على كل عنصر لديه data-sensitive
    document.querySelectorAll('[data-sensitive]').forEach(el => {
      const orig = el.dataset.origText;
      if(!orig) el.dataset.origText = el.textContent || '';

      if(enabled){
        // لو لم يزوّد المطور data-mask نولّد واحد ذكي بناءً على النوع
        if(!el.dataset.mask){
          const type = (el.dataset.sensitive || '').toLowerCase();
          const text = (el.dataset.origText || '').trim();

          if(type.includes('phone')) el.dataset.mask = '٠٠٠٠٠٠٠٠٠';
          else if(type.includes('name')){
            if(text.length>0){
              const first = text.charAt(0);
              el.dataset.mask = first + ' ••••';
            } else {
              el.dataset.mask = '••••';
            }
          } else if(type.includes('address')) el.dataset.mask = '••••••••';
          else {
            // عام
            el.dataset.mask = '••••';
          }
        }
        // لا نغيّر textContent هنا لأن الـ CSS سيُظهر ::after بدلاً من النص
      } else {
        // إعادة النص الأصلي عند إيقاف الوضع
        if(el.dataset.origText !== undefined){
          el.textContent = el.dataset.origText;
        }
      }
    });

    // تحديث واجهة البطاقة (إن وُجدت)
    const notice = document.getElementById('privacyNotice');
    const btn = document.getElementById('privacyToggleBtn');
    if(notice) notice.textContent = enabled ? 'الوضع الخاص مفعل — بعض المعلومات مخفية.' : 'الوضع الخاص غير مفعل.';
    if(btn) btn.textContent = enabled ? 'إيقاف' : 'تفعيل';

    // حفظ التفضيل إن كانت الدالة saveDB متاحة من التطبيق الأصلي
    if(typeof saveDB === 'function') try{ saveDB(); }catch(e){}
  }

  // دالة التبديل العامة للمستخدم أو للـ UI
  function togglePrivateMode(){
    ensureDB();
    window.db.privateMode = !window.db.privateMode;
    applyPrivateModeUI();
  }

  // نجعل الدالة متاحة عالمياً حتى تقدر ربط زر inline أو استدعاؤها من console
  window.togglePrivateMode = togglePrivateMode;
  window.applyPrivateModeUI = applyPrivateModeUI;

  // إدراج بطاقة الإعداد تلقائياً داخل صفحة الإعدادات (إن وُجدت) لتفادي تعديل index.html يدوياً
  function injectSettingsCard(){
    const settingsSection = document.getElementById('page-settings');
    if(!settingsSection) return;
    if(document.getElementById('privacyCard')) return; // إذا موجودة لا نعيد

    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'privacyCard';
    card.innerHTML = `
      <h3>🔒 الوضع الخاص (خصوصية)</h3>
      <p class="meta">عند تفعيل الوضع الخاص، سيتم إخفاء الأسماء، أرقام الهواتف، والعناوين من العرض في الشاشة. يطبّق فورًا ويحفظ محليًا.</p>
      <div class="field" style="display:flex;align-items:center;gap:10px;">
        <label style="margin:0;font-weight:700;">تفعيل الوضع الخاص</label>
        <button id="privacyToggleBtn" class="btn sm outline"></button>
      </div>
      <div class="private-mode-notice" id="privacyNotice"></div>
    `;
    // ضع البطاقة في أعلى قسم الإعدادات (بعد أول بطاقة إن وجدت) وإلا أضفها في آخر القسم
    const firstCard = settingsSection.querySelector('.card');
    if(firstCard) settingsSection.insertBefore(card, firstCard);
    else settingsSection.appendChild(card);

    // ربط حدث الزر
    const btn = document.getElementById('privacyToggleBtn');
    if(btn) btn.addEventListener('click', togglePrivateMode);
  }

  // استدعاءات عند تحميل الصفحة
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=>{
      ensureDB();
      injectSettingsCard();
      applyPrivateModeUI();
    });
  } else {
    ensureDB();
    injectSettingsCard();
    applyPrivateModeUI();
  }

  // للتطوير: دالة لمساعدة المطورين على وضع data-sensitive عند بناء عناصر
  // window.markSensitive(element, type, mask) يمكن استخدامها من الكونسول أو من كود العرض
  window.markSensitive = function(el, type, mask){
    if(!el) return;
    el.setAttribute('data-sensitive', type || 'sensitive');
    if(mask) el.setAttribute('data-mask', mask);
    if(!el.dataset.origText) el.dataset.origText = el.textContent || '';
    // إعادة تطبيق الحالة الحالية
    applyPrivateModeUI();
  };

})();
