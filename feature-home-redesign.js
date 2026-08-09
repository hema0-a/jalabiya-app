/* ============================================================
   feature-home-redesign.js
   🎨 مرحلة 2 من التطوير البصري — الصفحة الرئيسية تحديدًا (مرحلة 1
   في feature-visual-refresh.js كانت عامة على كل التطبيق).

   التغييرات:
   1) شريط ترحيب أعلى الصفحة (تحية حسب الوقت + اسم صاحب الورشة لو
      متسجل + التاريخ)، بخلفية متدرّجة هادئة بلون الهوية (أخضر/ذهبي).
   2) بطاقة اللوحة السريعة (من feature-home-dashboard.js) بقت كل
      خانة فيها لون مميز خفيف يميّزها بصريًا بدل ما تبقى كلها نفس
      اللون الرمادي.
   3) أزرار الإجراءات السريعة (عميل جديد/طلب جديد/ملخص الأسبوع/
      حاسبة تسعير) بقت "شرائح" بالأيقونة فوق والنص تحت، شكل موحّد
      بدل خليط من الأشكال المختلفة، مرتبة أساسي/ثانوي بالوضوح.

   ملف مستقل، CSS بالكامل + إعادة ترتيب DOM بسيطة (بدون استنساخ
   عناصر، فبتحافظ على كل onclick الأصلي) — مش بيلمس أي ملف تاني.
   ============================================================ */
(function(){

  function injectStyles(){
    if(document.getElementById('homeRedesignStyles')) return;
    const style = document.createElement('style');
    style.id = 'homeRedesignStyles';
    style.textContent = `
      /* ---------- 1) شريط الترحيب ---------- */
      #homeGreetingHero{
        display:flex; align-items:center; gap:12px;
        padding:16px 18px; margin-bottom:14px;
        border-radius:var(--radius-lg, 18px);
        background:linear-gradient(120deg,
          color-mix(in srgb, var(--primary) 14%, var(--card)),
          color-mix(in srgb, var(--accent) 12%, var(--card)) 100%);
        border:1px solid color-mix(in srgb, var(--primary) 18%, var(--border));
      }
      #homeGreetingHero .ghe-emoji{
        font-size:26px; line-height:1; flex-shrink:0;
        width:46px; height:46px; border-radius:50%;
        display:flex; align-items:center; justify-content:center;
        background:color-mix(in srgb, var(--card) 60%, transparent);
      }
      #homeGreetingHero .ghe-text{ font-size:15.5px; font-weight:800; color:var(--text); }
      #homeGreetingHero .ghe-date{ font-size:12px; opacity:.65; margin-top:2px; }

      /* ---------- 2) ألوان مميزة لخانات اللوحة السريعة ---------- */
      .dash-grid .dash-cell:nth-child(1){
        background:color-mix(in srgb, var(--primary) 10%, var(--card-alt));
        border-inline-start:3px solid var(--primary);
      }
      .dash-grid .dash-cell:nth-child(2){
        background:color-mix(in srgb, var(--accent) 10%, var(--card-alt));
        border-inline-start:3px solid var(--accent);
      }
      .dash-grid .dash-cell:nth-child(4){
        background:color-mix(in srgb, var(--info, #3B7AB8) 10%, var(--card-alt));
        border-inline-start:3px solid var(--info, #3B7AB8);
      }
      .dash-grid .dash-cell{
        border-radius:14px;
        transition:transform .15s var(--ease-smooth, ease);
      }
      .dash-grid .dash-cell:active{ transform:scale(0.97); }

      /* ---------- 3) شرائح الإجراءات السريعة ---------- */
      #homeQuickActionsWrap .btn-row.quick-chips-row{
        display:grid; grid-template-columns:repeat(4, 1fr);
        gap:8px; flex-wrap:unset;
      }
      .quick-chip{
        display:flex !important; flex-direction:column; align-items:center; justify-content:center;
        gap:4px; padding:12px 6px !important; min-height:64px;
        border-radius:14px !important; text-align:center;
        font-size:11.5px !important; font-weight:700 !important;
        white-space:normal !important; line-height:1.3;
      }
      .quick-chip .qc-icon{ font-size:20px; line-height:1; }
      @media (max-width:360px){
        #homeQuickActionsWrap .btn-row.quick-chips-row{ grid-template-columns:repeat(2, 1fr); }
      }
    `;
    document.head.appendChild(style);
  }

  function greetingParts(){
    const hour = new Date().getHours();
    const emoji = hour<12 ? '☀️' : (hour<18 ? '🌤️' : '🌙');
    const base = hour<12 ? 'صباح الخير' : 'مساء الخير';
    const name = (db && db.ownerName) ? `يا ${db.ownerName}` : '';
    return {emoji, text:[base, name].filter(Boolean).join(' ')};
  }

  function renderGreeting(){
    const box = document.getElementById('homeGreetingHero');
    if(!box) return;
    const g = greetingParts();
    const dateStr = new Date().toLocaleDateString('ar-EG-u-ca-gregory', {weekday:'long', day:'numeric', month:'long'});
    box.innerHTML = `
      <div class="ghe-emoji">${g.emoji}</div>
      <div>
        <div class="ghe-text">${escapeHtml(g.text)}</div>
        <div class="ghe-date">${escapeHtml(dateStr)}</div>
      </div>
    `;
  }

  function injectGreeting(){
    if(document.getElementById('homeGreetingHero')) { renderGreeting(); return; }
    const page = document.getElementById('page-home');
    if(!page) return;
    const div = document.createElement('div');
    div.id = 'homeGreetingHero';
    page.insertAdjacentElement('afterbegin', div);
    renderGreeting();
  }

  // بنحوّل صف أزرار الإجراءات السريعة (اللي فيه أزرار بأشكال مختلطة)
  // لشرائح موحّدة الشكل (أيقونة فوق + نص تحت) من غير ما نستنسخ
  // العناصر — فكل onclick الأصلي بيفضل زي ما هو
  function restyleQuickActions(){
    const wrap = document.getElementById('homeQuickActionsWrap');
    if(!wrap) return;
    const row = wrap.querySelector('.btn-row');
    if(!row || row.classList.contains('quick-chips-row')) return;
    const buttons = Array.from(row.querySelectorAll('button'));
    if(!buttons.length) return;
    buttons.forEach(btn=>{
      const raw = btn.textContent.trim();
      const firstSpace = raw.indexOf(' ');
      const icon = firstSpace>0 ? raw.slice(0, firstSpace) : raw;
      const label = firstSpace>0 ? raw.slice(firstSpace+1) : '';
      btn.innerHTML = `<span class="qc-icon">${icon}</span><span>${escapeHtml(label)}</span>`;
      btn.classList.add('quick-chip');
    });
    row.classList.add('quick-chips-row');
  }

  function boot(){
    injectStyles();
    injectGreeting();
    restyleQuickActions();
  }

  function hookRenderHome(){
    if(typeof window.renderHome !== 'function') return;
    const orig = window.renderHome;
    window.renderHome = function(){
      const r = orig.apply(this, arguments);
      injectGreeting();
      restyleQuickActions();
      return r;
    };
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', function(){ boot(); hookRenderHome(); });
  } else {
    boot();
    hookRenderHome();
  }
})();
