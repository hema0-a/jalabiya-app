/* ============================================================
   feature-receptionist-restrict.js
   🧑‍💼 تضييق "وضع الاستقبال" (receptionist) ليكون مقتصر فعليًا على:
   - إضافة عميل جديد (زرار ➕ الموجود في صفحة العملاء)
   - إضافة طلب جديد (زرار "➕ طلب جديد" الموجود على كارت كل عميل —
     موجود بالفعل في core.js، مش محتاج إضافة حاجة له)
   - حسابات/سجل العميل (زرار "📜 السجل" الموجود بالفعل كمان)

   يعني الصفحة الوحيدة المسموحة لوضع الاستقبال هي "العملاء" بس.
   باقي الصفحات (الرئيسية، الطلبات، المواعيد، المالية، المصروفات،
   التزاماتي، الإعدادات، وأي صفحة تانية بتتضاف مستقبلاً زي نظرة
   مالية شاملة/الاستثمار/العمال) بتتقفل تلقائيًا.

   ملحوظة: زرار "✏️ تعديل" العميل و"🖨️ بطاقة المقاسات" و"📲 مشاركة
   واتساب" سيبتهم شغالين لأنهم جزء طبيعي من التعامل مع "حسابات
   العملاء"، وزرار "🗑️ حذف" أصلاً متخفي في وضع الاستقبال من قاعدة
   CSS موجودة بالفعل في index.html (.btn.danger).

   ملف مستقل، بيلف (wrap) دالة showPage الموجودة، وبيحقن CSS
   خاص بيه، مش بيلمس أي ملف تاني.
   ============================================================ */
(function(){

  const ALLOWED_PAGE = 'customers';

  function hookShowPage(){
    if(typeof window.showPage !== 'function') return;
    const orig = window.showPage;
    window.showPage = function(name){
      if(window.userRole==='receptionist' && name!==ALLOWED_PAGE){
        name = ALLOWED_PAGE;
      }
      return orig.call(this, name);
    };
  }

  function injectStyles(){
    if(document.getElementById('receptionistRestrictStyles')) return;
    const style = document.createElement('style');
    style.id = 'receptionistRestrictStyles';
    // بنخفي كل أزرار التنقل ما عدا "العملاء" — بيغطي أي زرار تنقل
    // حالي أو مستقبلي (طالما شايل class="navbtn") بدل ما نعدد كل صفحة
    style.textContent = `
      html.role-receptionist .navbtn:not([data-page="${ALLOWED_PAGE}"]){
        display:none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function boot(){
    injectStyles();
    hookShowPage();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
