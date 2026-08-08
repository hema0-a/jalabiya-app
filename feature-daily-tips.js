/* ============================================================
   feature-daily-tips.js
   بطاقة "💡 نصيحة اليوم المالية" — تُضاف داخل صفحة "📊 نظرة مالية
   شاملة" (خيار الدمج، مش صفحة/زر مستقل). ملف مستقل مش بيلمس أي
   ملف تاني، بيحقن حاويته بنفسه بعد #financialOverviewBody ويلف
   (wrap) renderFinancialOverviewPage عشان يتحدّث في نفس اللحظة.

   المحتوى:
   1) نصيحة ثابتة يوميًا (بتتغير مرة كل يوم فقط، مش كل تحديث)
      مأخوذة من مكتبة نصائح عامة + نصائح مبنية على بيانات المستخدم
      الفعلية (لو متاحة) — بتتنافس كلها مع بعض حسب يوم السنة.
   2) زر "⭐ احفظ" لتثبيت النصيحة في قائمة مفضلة تفضل ظاهرة.
   3) زر "التالي" لعرض نصيحة تانية عشوائية (بدون التأثير على
      نصيحة الغد المحسوبة تلقائيًا).
   ============================================================ */
(function(){

  const GENERIC_TIPS = [
    'خصص نسبة ثابتة من كل مبلغ يدخل (حتى لو 10%) للادخار قبل أي إنفاق تاني.',
    'افصل حساب/محفظة الورشة عن مصاريفك الشخصية عشان تعرف تقيّم الاثنين صح.',
    'قبل أي شراء غير ضروري، سيب المبلغ يوم كامل قبل ما تقرر — القرارات المتسرعة أغلى.',
    'راجع اشتراكاتك الشهرية كل 3 شهور، وألغِ أي حاجة مش بتستخدمها فعليًا.',
    'صندوق الطوارئ المثالي يغطي من 3 إلى 6 أشهر من مصاريفك الأساسية.',
    'سجّل كل مصروف مهما كان صغير لمدة أسبوع واحد بس — هتتفاجئ بالنتيجة.',
    'الدين اللي بيدفع فوائد عالية لازم يتقفل الأول قبل أي ادخار إضافي.',
    'حدد سقف إنفاق لكل بند شهريًا، ولو عدّيته اعتبره إنذار مش تفصيلة.',
    'اجعل الادخار "تلقائي" بقدر الإمكان — الحاجات اليدوية بننساها بسهولة.',
    'قبل ما تاخد أي التزام شهري جديد (اشتراك، قسط)، اسأل نفسك: هل ده هيفضل مهم بعد 6 شهور؟',
    'متابعة صافي ثروتك (أصول − التزامات) شهريًا أهم من متابعة الدخل بس.',
    'خصّص جزء بسيط من أي دخل غير متوقع (مكافأة، هدية) للادخار فورًا قبل ما "يدوب" في المصاريف اليومية.',
    'قارن نفسك بنفسك الشهر اللي فات، مش بحد تاني — كل ظرف مختلف.',
    'لو عندك أكتر من هدف ادخار، رتبهم بالأولوية بدل ما توزع بالتساوي على الكل.',
    'اسأل نفسك قبل كل قرض: هل أقدر أدفع القسط ده حتى لو الشهر ده كان ضعيف؟',
    'خلي جزء من مدخراتك في مكان "صعب الوصول له بسرعة" عشان ميترصفش وقت الإغراء.',
    'التضخم بياكل من قيمة الفلوس الساكنة — فكر في استثمار جزء بسيط بدل الاحتفاظ بكل حاجة كاش.',
    'وثّق كل دين عليك أو لك — الديون الشفهية بتضيع أو بتتنسى بسهولة.',
    'خصص يوم ثابت كل شهر (مثلاً أول الشهر) لمراجعة كل حساباتك المالية في جلسة واحدة.',
    'الفرق بين "أنا محتاجه" و"أنا عايزه" هو أهم سؤال قبل أي مصروف كبير.',
    'لو دخلك بيتغير من شهر لشهر، احسب على أساس أقل شهر حصلته السنة دي، مش المتوسط.',
    'خلي هدف الادخار رقم واضح وتاريخ محدد — الأهداف الغامضة بتتأجل للأبد.',
    'راجع أسعارك/رسومك كل فترة — لو تكاليفك زادت وسعرك ثابت يبقى ربحك بيقل من غير ما تحس.',
    'لا تخلط بين "مصروف الورشة" و"مصروف البيت" في نفس الجيب، حتى لو الفلوس كلها بتيجي من مكان واحد.',
    'كل جنيه بتوفره من مصروف متكرر (شهري) قيمته الحقيقية = المبلغ × 12 في السنة.',
  ];

  function dynamicTips(){
    const tips = [];
    try{
      // مقارنة مصروف البيت الشهر ده مع اللي فات
      if(typeof db!=='undefined' && Array.isArray(db.houseExpenses)){
        const ym = currentYM();
        const lastYm = (typeof addMonthsYM==='function') ? addMonthsYM(ym,-1) : null;
        const thisMonth = db.houseExpenses.filter(e=>e.date && e.date.slice(0,7)===ym).reduce((s,e)=>s+Number(e.amount||0),0);
        const lastMonth = lastYm ? db.houseExpenses.filter(e=>e.date && e.date.slice(0,7)===lastYm).reduce((s,e)=>s+Number(e.amount||0),0) : 0;
        if(lastMonth>0 && thisMonth>lastMonth*1.15){
          const pct = Math.round((thisMonth/lastMonth-1)*100);
          tips.push(`مصاريف بيتك الشهر ده أعلى من الشهر اللي فات بنسبة ${pct}% — يستاهل نظرة سريعة على السبب.`);
        }
      }
      // صندوق الطوارئ مقابل الاحتياج الشهري
      if(typeof db!=='undefined' && typeof calcRequiredDailyCapacity==='function'){
        const r = calcRequiredDailyCapacity();
        const monthlyNeed = (r.monthlyCommitments||0) + (r.loanMonthly||0) + (r.housePerDay||0)*30;
        const emergency = Number(db.emergencyFundBalance||0);
        if(monthlyNeed>0){
          const months = emergency/monthlyNeed;
          if(months < 1){
            tips.push('صندوق الطوارئ عندك حاليًا أقل من احتياج شهر واحد — لو قدرت تضيف له حتى مبلغ بسيط بانتظام هيفرق كتير.');
          } else if(months >= 6){
            tips.push(`صندوق الطوارئ عندك بيغطي أكتر من ${Math.floor(months)} شهور من احتياجك — ده وضع ممتاز، ممكن تفكر توجه فائض إضافي للاستثمار.`);
          }
        }
      }
      // التزامات هتخلص قريب
      if(typeof endingSoonCommitments==='function'){
        const ending = endingSoonCommitments();
        if(ending && ending.length){
          tips.push(`عندك ${ending.length} التزام هيخلص خلال شهرين — فكّر بدري فين هتوجه المبلغ اللي هيتفضّى بعدهم.`);
        }
      }
      // اتجاه صافي الثروة
      if(typeof db!=='undefined' && Array.isArray(db.netWorthHistory) && db.netWorthHistory.length>=2){
        const h = db.netWorthHistory;
        const last = h[h.length-1].value, prev = h[h.length-2].value;
        if(prev>0 && last < prev*0.95){
          tips.push('صافي ثروتك التقديري نزل عن الشهر اللي فات — مش بالضرورة مشكلة، بس يستاهل تشوف السبب (سحب استثمار؟ قسط جديد؟).');
        }
      }
    }catch(e){ /* تجاهل أي خطأ، النصائح العامة كفاية */ }
    return tips;
  }

  function dayOfYear(){
    const d = new Date();
    const start = new Date(d.getFullYear(),0,0);
    const diff = d - start;
    return Math.floor(diff/86400000);
  }

  function ensureDefaults(){
    if(!Array.isArray(db.savedTips)) db.savedTips = [];
  }

  function pool(){
    return dynamicTips().concat(GENERIC_TIPS);
  }

  let manualIndex = null; // لو المستخدم ضغط "التالي" بنفصله عن نصيحة اليوم الثابتة

  function pickTipIndex(){
    if(manualIndex!=null) return manualIndex;
    const p = pool();
    return dayOfYear() % p.length;
  }

  window.showNextDailyTip = function(){
    const p = pool();
    let idx = pickTipIndex();
    idx = (idx+1) % p.length;
    manualIndex = idx;
    renderDailyTip();
  };

  window.saveDailyTip = function(text){
    ensureDefaults();
    if(db.savedTips.some(t=>t.text===text)){ toast('محفوظة عندك بالفعل'); return; }
    db.savedTips.unshift({id:uid(), text, date:todayStr()});
    if(db.savedTips.length>30) db.savedTips = db.savedTips.slice(0,30);
    saveDB();
    toast('⭐ اتحفظت');
    renderDailyTip();
  };

  window.removeSavedTip = function(id){
    ensureDefaults();
    db.savedTips = db.savedTips.filter(t=>t.id!==id);
    saveDB();
    renderDailyTip();
  };

  function renderDailyTip(){
    const box = document.getElementById('dailyTipCard');
    if(!box) return;
    ensureDefaults();
    const p = pool();
    const idx = pickTipIndex() % p.length;
    const text = p[idx];
    const alreadySaved = db.savedTips.some(t=>t.text===text);

    const savedHtml = db.savedTips.length ? `
      <div style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--card-alt);">
        <div class="meta" style="margin-bottom:4px;">⭐ نصائحك المحفوظة</div>
        ${db.savedTips.map(t=>`
          <div class="row" style="align-items:flex-start;gap:6px;margin-bottom:4px;">
            <span style="flex:1;font-size:13px;">${escapeHtml(t.text)}</span>
            <button class="btn sm outline" style="padding:2px 8px;" onclick="removeSavedTip('${t.id}')">حذف</button>
          </div>
        `).join('')}
      </div>
    ` : '';

    box.innerHTML = `
      <div class="card">
        <div class="row"><h3>💡 نصيحة اليوم</h3></div>
        <div style="font-size:14px;line-height:1.8;margin-top:4px;">${escapeHtml(text)}</div>
        <div class="btn-row" style="margin-top:8px;">
          <button class="btn sm outline" onclick="showNextDailyTip()">↻ نصيحة تانية</button>
          <button class="btn sm secondary" ${alreadySaved?'disabled':''} onclick="saveDailyTip('${text.replace(/'/g,"\\'")}')">${alreadySaved?'⭐ محفوظة':'⭐ احفظ'}</button>
        </div>
        ${savedHtml}
      </div>
    `;
  }

  function injectContainer(){
    const anchor = document.getElementById('financialOverviewBody');
    if(!anchor || document.getElementById('dailyTipCard')) return;
    const div = document.createElement('div');
    div.id = 'dailyTipCard';
    div.style.marginTop = '8px';
    anchor.insertAdjacentElement('afterend', div);
  }

  function hookRender(){
    if(typeof window.renderFinancialOverviewPage === 'function'){
      const orig = window.renderFinancialOverviewPage;
      window.renderFinancialOverviewPage = function(){
        const r = orig.apply(this, arguments);
        renderDailyTip();
        return r;
      };
    }
  }

  function boot(){
    injectContainer();
    hookRender();
    if(document.getElementById('page-financial-overview')) renderDailyTip();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
