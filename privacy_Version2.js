(function(){
  const STORAGE_KEY = 'jalaba_db_v1';
  let dbLocal = null;

  // قراءة/كتابة نسخة مبسطة من الـ db المحلي (نستخدم نفس المفتاح الموجود في التطبيق)
  function readDB(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      dbLocal = raw ? JSON.parse(raw) : {};
    }catch(e){
      dbLocal = {};
    }
  }
  function writeDB(){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(dbLocal)); }catch(e){}
    // لو التطبيق الأساسي يعرف saveDB فنناديه لنُبقِي تزامن الحالة
    try{ if(window.saveDB) window.saveDB(); }catch(e){}
  }

  // Overlay خفيف عند تفعيل الوضع الخاص
  function setOverlay(enable){
    let ov = document.getElementById('privateModeOverlay');
    if(enable){
      if(!ov){
        ov = document.createElement('div');
        ov.id = 'privateModeOverlay';
        ov.className = 'private-mode-overlay';
        document.body.appendChild(ov);
      }
    }else{
      if(ov) ov.remove();
    }
  }

  // نزوّد أقنعة افتراضية (خصوصاً للأسماء) إذا لم يوجد data-mask
  function ensureMasks(){
    // أسماء: نظهر الحرف الأول متبوعاً بنقاط
    document.querySelectorAll('[data-sensitive~="name"]').forEach(el=>{
      if(!el.hasAttribute('data-mask')){
        const raw = (el.textContent || el.value || '').trim();
        const mask = raw ? (raw.charAt(0) + '•••') : '•••';
        el.setAttribute('data-mask', mask);
      }
    });
    // أرقام الهاتف / العنوان: إذا لم توجد قيمة mask نضع قناع افتراضي
    document.querySelectorAll('[data-sensitive~="phone"]').forEach(el=>{
      if(!el.hasAttribute('data-mask')) el.setAttribute('data-mask','٠٠٠٠٠٠٠٠٠');
    });
    document.querySelectorAll('[data-sensitive~="address"]').forEach(el=>{
      if(!el.hasAttribute('data-mask')) el.setAttribute('data-mask','••••••••');
    });
  }

  // تفعيل/إلغاء وضع الخصوصية: يضيف/يزيل الصنف .private-mode على <html>
  function applyPrivacyMode(enable){
    document.documentElement.classList.toggle('private-mode', !!enable);
    setOverlay(!!enable);
    ensureMasks();
  }

  function togglePrivacyMode(){
    readDB();
    dbLocal.privateMode = !Boolean(dbLocal.privateMode);
    writeDB();
    // إذا التطبيق يحمل كائن db مركزي نزامنه
    try{ if(window.db) window.db.privateMode = dbLocal.privateMode; }catch(e){}
    applyPrivacyMode(dbLocal.privateMode);
    renderSettingsCardState();
    showToast(dbLocal.privateMode ? 'تم تفعيل الوضع الخاص' : 'تم إيقاف الوضع الخاص');
  }

  // وظيفة مساعدة لعرض رسالة صغيرة (toast)
  function showToast(msg){
    const t = document.getElementById('toast');
    if(!t){
      alert(msg);
      return;
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._hideTimer);
    t._hideTimer = setTimeout(()=> t.classList.remove('show'), 2200);
  }

  // إدراج بطاقة الإعداد في صفحة الإعدادات (تُدخل داخل العنصر cloudSyncCardWrap إن وُجد)
  function injectPrivacySettingsCard(){
    const wrap = document.getElementById('cloudSyncCardWrap') || document.querySelector('#page-settings');
    if(!wrap) return;
    // إذا الملف مُدرج سابقًا نتجنّب الإدراج مرتين
    if(document.getElementById('privacySettingsCard')) return;

    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'privacySettingsCard';
    card.innerHTML = `
      <h3>🔒 الوضع الخاص (خصوصية)</h3>
      <p class="meta">قناع الحقول الحساسة على الشاشة ليظهر المحتوى بدون معلومات حساسة عند الحاجة.</p>
      <div style="margin-top:8px;" id="privacySettingsControls">
        <div class="btn-row">
          <button class="btn" id="privacyToggleBtn">تفعيل/إيقاف الوضع الخاص</button>
          <button class="btn sm outline" id="privacyHowBtn">كيفية الاستخدام</button>
        </div>
        <div id="privacyStateInfo" style="margin-top:8px;font-size:13px;color:var(--muted)"></div>
      </div>
    `;
    // ندرجه في أعلى صفحة الإعدادات (قبل العنصر الأول داخل page-settings) إن وُجد
    if(wrap.id === 'page-settings'){
      wrap.insertBefore(card, wrap.firstElementChild);
    }else{
      wrap.appendChild(card);
    }

    document.getElementById('privacyToggleBtn').addEventListener('click', togglePrivacyMode);
    document.getElementById('privacyHowBtn').addEventListener('click', ()=> {
      openModal('كيفية استخدام الوضع الخاص', `
        <p>ضع السمة <code>data-sensitive</code> على أي عنصر يعرض معلومات حساسة، أمثلة:</p>
        <ul>
          <li><code>&lt;div data-sensitive="name"&gt;محمد علي&lt;/div&gt;</code></li>
          <li><code>&lt;span data-sensitive="phone"&gt;0123456789&lt;/span&gt;</code></li>
          <li><code>&lt;div data-sensitive="address"&gt;شارع...&lt;/div&gt;</code></li>
        </ul>
        <p>يمكنك أيضاً استخدام الدالة <code>markSensitive(el, type, mask)</code> من الكونسول أو من كود التطبيق لوضع القناع برمجياً.</p>
      `);
    });

    renderSettingsCardState();
  }

  function renderSettingsCardState(){
    readDB();
    const info = document.getElementById('privacyStateInfo');
    const btn = document.getElementById('privacyToggleBtn');
    if(info) info.textContent = dbLocal && dbLocal.privateMode ? 'الحالة: مفعل — العناصر الموسومة مُقنعة' : 'الحالة: متوقف — العناصر تظهر طبيعياً';
    if(btn) btn.textContent = dbLocal && dbLocal.privateMode ? 'إيقاف الوضع الخاص' : 'تفعيل الوضع الخاص';
  }

  // دوال مساعدة لفتح مودال (يستخدم عناصر التطبيق إن وُجدت)
  function openModal(title, html){
    const overlay = document.getElementById('modalOverlay');
    const box = document.getElementById('modalBox');
    if(!overlay || !box){
      alert(title + '\n\n' + (stripHtml(html) || ''));
      return;
    }
    box.innerHTML = `
      <div class="modal-head"><h3>${title}</h3><button class="modal-close" aria-label="إغلاق">✕</button></div>
      <div>${html}</div>
    `;
    // حدث إغلاق
    box.querySelector('.modal-close').addEventListener('click', ()=> overlay.classList.remove('active'));
    overlay.classList.add('active');
  }
  function stripHtml(s){ return s.replace(/<[^>]*>/g,''); }

  // API للاستخدام من كونسول أو كود: يعلّم عنصر معين أنه حساس
  // el: عنصر DOM أو selector string
  // type: "name" | "phone" | "address" | أي كلمة أخرى
  // mask: (اختياري) نص القناع الظاهر بدلاً من المحتوى
  function markSensitive(el, type='name', mask){
    try{
      let node = null;
      if(typeof el === 'string') node = document.querySelector(el);
      else node = el;
      if(!node) return false;
      node.setAttribute('data-sensitive', type);
      if(mask) node.setAttribute('data-mask', mask);
      else if(type === 'name' && !node.hasAttribute('data-mask')){
        const raw = (node.textContent || node.value || '').trim();
        node.setAttribute('data-mask', raw ? (raw.charAt(0) + '•••') : '•••');
      }
      return true;
    }catch(e){ return false; }
  }

  // تهيئة عند تحميل الـ DOM
  function init(){
    readDB();
    // إذا التطبيق المركزي موجود, استعمل حالته الأساسية إن وُجدت
    try{
      if(window.db && typeof window.db.privateMode !== 'undefined'){
        dbLocal = dbLocal || {};
        dbLocal.privateMode = window.db.privateMode;
      }
    }catch(e){}

    // إدراج الواجهة في صفحة الإعدادات
    injectPrivacySettingsCard();
    // تفعيل/إيقاف بحسب الحالة المحفوظة
    const enabled = dbLocal && dbLocal.privateMode;
    applyPrivacyMode(enabled);

    // ضمان وجود أقنعة للعناصر الحالية
    ensureMasks();

    // إذا التطبيق يستدعي renderAll بعد تحميله، فمن الأفضل أن نقوم بإعادة تطبيق الأقنعة بعده
    // لذا نوفّر هذه الدالة ليستخدمها المطور (renderAll سيستدعيها):
    window.applyPrivacyMode = applyPrivacyMode;
    window.markSensitive = markSensitive;
    window.privacyMode = {
      toggle: togglePrivacyMode,
      apply: applyPrivacyMode,
      mark: markSensitive,
      injectSettings: injectPrivacySettingsCard
    };
  }

  // نفّذ التهيئة بعد DOMContentLoaded (لو سبق ونُفّذ سيتم تجاهل النداء المتكرر)
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init,0);

})();