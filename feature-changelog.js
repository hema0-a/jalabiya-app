/* ============================================================
   feature-changelog.js
   🆕 سجل تغييرات بسيط داخل التطبيق — يعرض آخر الميزات المضافة،
   مفيد لو حد تاني (موظف/شريك) بيستخدم التطبيق ومش متابع كل تحديث.
   بيضيف زرار "🆕 جديد في التطبيق" أعلى صفحة الإعدادات، مع نقطة
   حمراء صغيرة لو فيه تحديثات لسه ما اتشافتش. الضغط عليه بيفتح
   مودال بقائمة آخر التحديثات (الأحدث فوق). ملف مستقل، بيحقن
   نفسه بس، مش بيلمس أي ملف تاني.

   لإضافة تحديث جديد مستقبلًا: ضيف عنصر جديد فوق مصفوفة CHANGELOG
   بنفس الشكل (date بصيغة YYYY-MM-DD، icon، title، desc).
   ============================================================ */
(function(){

  const CHANGELOG = [
    {date:'2026-08-09', icon:'🏠', title:'لوحة تحكم سريعة في الرئيسية', desc:'ملخص 4 مؤشرات (صافي اليوم، أقرب تسليم، أهم تنبيه، نصيحة اليوم) في بطاقة واحدة أعلى الصفحة الرئيسية.'},
    {date:'2026-08-09', icon:'🔗', title:'نظام تتبع الإحالات', desc:'اعرف مين رشّح مين من العملاء، مع لوحة أفضل المُرشِّحين ونظام مكافآت.'},
    {date:'2026-08-08', icon:'🔮', title:'محاكي "ماذا لو"', desc:'جرّب سيناريوهات مالية (زيادة دخل، التزام جديد، قرض...) وشوف تأثيرها فورًا من غير ما يلمس بياناتك الحقيقية.'},
    {date:'2026-08-08', icon:'💡', title:'نصيحة مالية يومية', desc:'بطاقة نصيحة بتتغيّر يوميًا جوه "نظرة مالية شاملة"، بعضها مبني على بياناتك الفعلية، مع إمكانية الحفظ في مفضلة.'},
  ];

  function latestDate(){
    return CHANGELOG.reduce((max,c)=> c.date>max?c.date:max, '0000-00-00');
  }

  function hasUnseen(){
    return !db.lastSeenChangelogDate || db.lastSeenChangelogDate < latestDate();
  }

  window.openChangelogModal = function(){
    db.lastSeenChangelogDate = latestDate();
    saveDB();
    const html = `
      <div class="modal-head"><h3>🆕 جديد في التطبيق</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
      ${CHANGELOG.map(c=>`
        <div class="card" style="margin-bottom:8px;">
          <div class="row"><h3>${c.icon} ${escapeHtml(c.title)}</h3><span class="meta">${fmtDate(c.date)}</span></div>
          <div class="meta" style="line-height:1.7;margin-top:2px;">${escapeHtml(c.desc)}</div>
        </div>
      `).join('')}
    `;
    openModal(html);
    renderChangelogButton();
  };

  function renderChangelogButton(){
    const btn = document.getElementById('changelogBtn');
    if(!btn) return;
    const dot = btn.querySelector('.changelog-dot');
    if(dot) dot.style.display = hasUnseen() ? 'inline-block' : 'none';
  }

  function injectButton(){
    if(document.getElementById('changelogBtn')) return;
    const settingsPage = document.getElementById('page-settings');
    if(!settingsPage) return;
    const firstCard = settingsPage.querySelector('.card');
    const wrap = document.createElement('div');
    wrap.className = 'card';
    wrap.style.marginBottom = '12px';
    wrap.innerHTML = `
      <button id="changelogBtn" class="btn secondary" style="width:100%;position:relative;" onclick="openChangelogModal()">
        🆕 جديد في التطبيق
        <span class="changelog-dot" style="display:none;position:absolute;top:6px;left:10px;width:9px;height:9px;border-radius:50%;background:var(--danger);"></span>
      </button>
    `;
    if(firstCard) firstCard.insertAdjacentElement('beforebegin', wrap);
    else settingsPage.insertAdjacentElement('afterbegin', wrap);
    renderChangelogButton();
  }

  function boot(){
    injectButton();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
