/* ============================================================
   feature-personal-overview.js
   مرحلة 2 من التحديث الشامل — تاب "🏠 نظرة عامة" في صفحة
   الالتزامات الشخصية (التبويبات نفسها موجودة بالفعل في index.html):
   1) خط الأمان البصري: شريط لوني (أخضر/أصفر/أحمر) بيقارن
      إيه اللي حصّلته الشهر ده من احتياجك الحقيقي، مقابل مين
      المفروض تكون وصلته لحد النهاردة حسب تاريخ الشهر.
   2) نسخة "ملخص 3 أرقام": المطلوب الشهر ده / المحصّل / فائض
      أو عجز النهاردة — للحظة اللي عايز تطمن فيها بسرعة.
   ملف مستقل مش بيلمس core.js ولا patches.js: بيحقن الحاويات
   بتاعته بنفسه وبيلف (wrap) دالة renderPersonalAlerts الموجودة
   عشان يتحدّث في كل نفس اللحظات اللي هي بتتحدث فيها.
   ============================================================ */
(function(){

  function daysInMonth(ym){
    const [y,m] = ym.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }

  function safetyStatus(){
    let prog;
    try{ prog = monthlyCommitmentProgress(); }catch(e){ prog = null; }
    if(!prog) return null;
    const ym = todayStr().slice(0,7);
    const dayNum = Number(todayStr().slice(8,10));
    const totalDays = daysInMonth(ym);
    const expectedPct = Math.min(100, Math.round((dayNum/totalDays)*100));
    const pct = prog.pct;
    let level, label, color;
    if(pct >= expectedPct){
      level='safe'; label='✅ على المسار الصحيح'; color='var(--primary)';
    } else if(pct >= expectedPct*0.7){
      level='warn'; label='⚠️ قريب من المطلوب — محتاج تسرّع شوية'; color='var(--accent)';
    } else {
      level='danger'; label='🔴 متأخر عن المطلوب الشهر ده'; color='var(--danger)';
    }
    return {...prog, expectedPct, level, label, color, dayNum, totalDays};
  }

  function renderSafetyLine(){
    const box = document.getElementById('personalSafetyLine');
    if(!box) return;
    const s = safetyStatus();
    if(!s){ box.innerHTML=''; return; }
    box.innerHTML = `
      <div class="card">
        <div class="row"><h3>${s.label}</h3><b style="color:${s.color};font-size:15px;">${s.pct}%</b></div>
        <div style="position:relative;height:12px;border-radius:99px;background:var(--card-alt);overflow:hidden;margin-top:6px;">
          <div style="position:absolute;inset-inline-start:0;top:0;bottom:0;width:${s.pct}%;background:${s.color};border-radius:99px;transition:width .4s var(--ease-smooth,ease);"></div>
          <div style="position:absolute;inset-inline-start:${s.expectedPct}%;top:-3px;bottom:-3px;width:2px;background:var(--text);opacity:.55;"></div>
        </div>
        <div class="meta" style="margin-top:6px;">
          حصّلت ${Math.round(s.collectedMonth).toLocaleString('ar-EG')} من ${Math.round(s.requiredMonthly).toLocaleString('ar-EG')} ج.م المطلوبين — إحنا في يوم ${s.dayNum} من ${s.totalDays} (الخط الرفيع بيوضح أين المفروض تكون وصلت لحد دلوقتي)
        </div>
      </div>
    `;
  }

  function render3Numbers(){
    const box = document.getElementById('personal3Numbers');
    if(!box) return;
    let prog; try{ prog = monthlyCommitmentProgress(); }catch(e){ prog=null; }
    let surplus; try{ surplus = todaySurplus(); }catch(e){ surplus=null; }
    if(!prog && !surplus){ box.innerHTML=''; return; }
    const remaining = prog ? Math.max(0, prog.requiredMonthly - prog.collectedMonth) : 0;
    box.innerHTML = `
      <div class="three-num-row" style="display:flex;gap:8px;margin-top:8px;">
        <div class="card" style="flex:1;text-align:center;padding:10px 6px;">
          <div class="meta">باقي هذا الشهر</div>
          <b style="font-size:16px;">${Math.round(remaining).toLocaleString('ar-EG')}</b>
        </div>
        <div class="card" style="flex:1;text-align:center;padding:10px 6px;">
          <div class="meta">النهاردة</div>
          <b style="font-size:16px;color:${surplus && surplus.surplus>=0?'var(--primary)':'var(--danger)'};">
            ${surplus ? (surplus.surplus>=0?'+':'') + Math.round(surplus.surplus).toLocaleString('ar-EG') : '—'}
          </b>
        </div>
        <div class="card" style="flex:1;text-align:center;padding:10px 6px;">
          <div class="meta">محصّل الشهر</div>
          <b style="font-size:16px;">${prog ? Math.round(prog.collectedMonth).toLocaleString('ar-EG') : '—'}</b>
        </div>
      </div>
    `;
  }

  function renderOverviewExtras(){
    renderSafetyLine();
    render3Numbers();
  }

  function injectContainers(){
    const tab = document.getElementById('personalTab-overview');
    if(!tab || document.getElementById('personalSafetyLine')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div id="personalSafetyLine"></div><div id="personal3Numbers"></div>`;
    tab.insertBefore(wrap, tab.firstChild);
    // فك التغليف بحيث الحاويتين تبقوا أبناء مباشرين للتاب (مش جوه wrap)
    while(wrap.firstChild) tab.insertBefore(wrap.firstChild, wrap);
    wrap.remove();
  }

  function boot(){
    injectContainers();
    if(typeof renderPersonalAlerts === 'function'){
      const orig = renderPersonalAlerts;
      window.renderPersonalAlerts = function(){
        const r = orig.apply(this, arguments);
        renderOverviewExtras();
        return r;
      };
    }
    renderOverviewExtras();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
