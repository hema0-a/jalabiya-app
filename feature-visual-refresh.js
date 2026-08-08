/* ============================================================
   feature-visual-refresh.js
   مرحلة 1 من التحديث الشامل: تصميم بصري مبهر لكل شاشات التطبيق
   دفعة واحدة، عن طريق طبقة CSS إضافية فقط — من غير لمس أي منطق
   في core.js أو patches.js أو ملفات الميزات التانية.
   يتحمّل آخر واحد بعد كل السكربتات، بنفس أسلوب ملفات الرقعات.
   ============================================================ */
(function(){
  var css = `

/* ---------- 1) توكينز تصميم أعمق (طبقة فوق المتغيرات الحالية) ---------- */
:root{
  --radius-sm:10px; --radius-md:16px; --radius-lg:22px; --radius-xl:28px;
  --ease-smooth:cubic-bezier(.22,1,.36,1);
  --shadow-soft:0 2px 10px rgba(20,30,25,0.06), 0 1px 2px rgba(20,30,25,0.04);
  --shadow-lift-2:0 12px 28px -10px rgba(20,30,25,0.22), 0 4px 10px -4px rgba(20,30,25,0.10);
  --glow-accent:0 0 0 1px rgba(184,134,59,0.35), 0 8px 22px -8px rgba(184,134,59,0.45);
}
html[data-theme="dark"]{
  --shadow-soft:0 2px 10px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.25);
  --shadow-lift-2:0 14px 30px -10px rgba(0,0,0,0.55), 0 4px 12px -4px rgba(0,0,0,0.4);
}

/* ---------- 2) خلفية عامة بعمق خفيف بدل اللون المسطح ---------- */
body{
  background-image:
    radial-gradient(1200px 600px at 100% -10%, rgba(184,134,59,0.07), transparent 60%),
    radial-gradient(900px 500px at -10% 0%, rgba(31,109,87,0.06), transparent 55%);
  background-attachment:fixed;
}
html[data-theme="dark"] body{
  background-image:
    radial-gradient(1200px 600px at 100% -10%, rgba(184,134,59,0.10), transparent 60%),
    radial-gradient(900px 500px at -10% 0%, rgba(31,109,87,0.14), transparent 55%);
}

/* ---------- 3) الشريط العلوي: زجاجي خفيف + عمق ---------- */
.topbar{
  background:color-mix(in srgb, var(--card) 88%, transparent);
  backdrop-filter:saturate(160%) blur(14px);
  -webkit-backdrop-filter:saturate(160%) blur(14px);
  box-shadow:0 1px 0 rgba(0,0,0,0.04), var(--shadow-soft);
  transition:box-shadow .25s var(--ease-smooth);
}
.topbar-brand{ letter-spacing:.2px; }

/* ---------- 4) كروت أعمق مع رفعة عند اللمس/الهوفر ---------- */
.card, .stat-card{
  border-radius:var(--radius-lg) !important;
  box-shadow:var(--shadow-soft);
  transition:transform .22s var(--ease-smooth), box-shadow .22s var(--ease-smooth), border-color .2s;
}
.card:active{ transform:scale(0.985); }
@media (hover:hover){
  .card:hover, .stat-card:hover{
    transform:translateY(-2px);
    box-shadow:var(--shadow-lift-2);
    border-color:color-mix(in srgb, var(--primary) 30%, var(--border));
  }
}

/* ---------- 5) الأزرار: تدرّج أعمق + ردة فعل عند الضغط ---------- */
.btn{
  border-radius:var(--radius-md) !important;
  transition:transform .15s var(--ease-smooth), box-shadow .2s, filter .2s;
}
.btn.accent, .btn.primary, .btn[class*="primary"]{
  box-shadow:var(--shadow-soft);
}
.btn:active{ transform:scale(0.96); filter:brightness(0.97); }
@media (hover:hover){
  .btn.accent:hover{ box-shadow:var(--glow-accent); }
  .btn.primary:hover, .btn[class*="primary"]:hover{
    box-shadow:0 8px 20px -8px color-mix(in srgb, var(--primary) 55%, transparent);
  }
}

/* ---------- 6) الزر العائم: نبضة انتباه هادئة + عمق ---------- */
.fab{
  box-shadow:0 10px 26px -8px rgba(184,134,59,0.55), 0 3px 8px rgba(0,0,0,0.15) !important;
  transition:transform .2s var(--ease-smooth), box-shadow .2s;
}
.fab:active{ transform:scale(0.92); }

/* ---------- 7) عناوين الأقسام: خط توكيد ذهبي/أخضر متدرّج ---------- */
.section-title{
  position:relative;
  padding-inline-start:14px;
}
.section-title::after{
  content:"";
  position:absolute; inset-inline-start:0; top:8%; bottom:8%;
  width:4px; border-radius:4px;
  background:linear-gradient(180deg, var(--accent), var(--primary));
}

/* ---------- 8) الشارات (badges): نعومة أكتر ---------- */
.badge{
  border-radius:999px !important;
  transition:transform .15s var(--ease-smooth);
}

/* ---------- 9) القائمة الجانبية: انزلاق أنعم + ظل عمق ---------- */
.sidenav{
  box-shadow:-16px 0 40px -12px rgba(0,0,0,0.25);
  transition:transform .32s var(--ease-smooth) !important;
}
.sidenav-overlay{
  backdrop-filter:blur(2px);
  transition:opacity .28s var(--ease-smooth);
}

/* ---------- 10) انتقال هادئ بين الصفحات ---------- */
.page{ animation:pageIn .28s var(--ease-smooth); }
@keyframes pageIn{
  from{ opacity:0; transform:translateY(6px); }
  to{ opacity:1; transform:translateY(0); }
}

/* ---------- 11) خط سكرول أرفع وأنيق ---------- */
*::-webkit-scrollbar{ height:8px; width:8px; }
*::-webkit-scrollbar-thumb{
  background:color-mix(in srgb, var(--primary) 35%, transparent);
  border-radius:99px;
}
*::-webkit-scrollbar-track{ background:transparent; }

/* ---------- 12) حالة تحميل شيمر بسيطة (تُستخدم اختياريًا: class="skeleton") ---------- */
.skeleton{
  position:relative; overflow:hidden; background:var(--card-alt);
  border-radius:var(--radius-sm);
}
.skeleton::after{
  content:""; position:absolute; inset:0;
  background:linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent);
  animation:shimmer 1.3s infinite;
}
@keyframes shimmer{
  from{ transform:translateX(-100%); }
  to{ transform:translateX(100%); }
}

/* ---------- 13) تركيز واضح لسهولة الوصول (بديل أنيق) ---------- */
:focus-visible{
  outline:2px solid var(--accent) !important;
  outline-offset:2px;
  border-radius:6px;
}

/* ---------- 14) الأرقام (مبالغ) بخط أوضح وأثقل شوية ---------- */
.amount, [class*="amount"]{
  font-variant-numeric:tabular-nums;
  letter-spacing:.2px;
}

  `;

  var styleTag = document.createElement('style');
  styleTag.id = 'visual-refresh-v1';
  styleTag.textContent = css;
  document.head.appendChild(styleTag);
})();
