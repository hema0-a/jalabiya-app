/* dock.js — شريط تنقل سفلي اختياري (تفعيل/إلغاء، اختيار العناصر، ترتيبها).
   الإعدادات محفوظة على كل جهاز على حدة في localStorage (مفتاح مستقل عن بيانات الورشة). */
(function(){
  var KEY='jalaba_dock_v1', MAX=5;
  var ALL=[
    {id:'home',ic:'🏠',lbl:'الرئيسية'},{id:'orders',ic:'📋',lbl:'الطلبات'},
    {id:'customers',ic:'👥',lbl:'العملاء'},{id:'deliveries',ic:'📅',lbl:'المواعيد'},
    {id:'finance',ic:'💰',lbl:'المالية'},{id:'expenses',ic:'🧵',lbl:'مصروفات'},
    {id:'personal',ic:'💳',lbl:'التزاماتي'},{id:'settings',ic:'⚙️',lbl:'إعدادات'},
    {id:'more',ic:'☰',lbl:'المزيد'}
  ];
  var DEF={enabled:true, items:['home','orders','customers','deliveries','more']};
  function byId(id){ for(var i=0;i<ALL.length;i++) if(ALL[i].id===id) return ALL[i]; return null; }
  function load(){
    try{
      var c=JSON.parse(localStorage.getItem(KEY));
      if(c && Array.isArray(c.items)) return {enabled:c.enabled!==false, items:c.items.filter(byId).slice(0,MAX)};
    }catch(e){}
    return {enabled:DEF.enabled, items:DEF.items.slice()};
  }
  var cfg=load();
  function save(){ try{ localStorage.setItem(KEY, JSON.stringify(cfg)); }catch(e){} }

  function currentName(){ try{ return (typeof currentPage!=='undefined') ? currentPage : 'home'; }catch(e){ return 'home'; } }
  function syncActive(){
    var cur=currentName();
    document.querySelectorAll('#dock .dock-btn[data-page]').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-page')===cur);
    });
  }
  function renderDock(){
    var app=document.getElementById('app'); if(!app) return;
    var dock=document.getElementById('dock');
    if(!dock){ dock=document.createElement('nav'); dock.id='dock'; dock.className='dock'; dock.setAttribute('aria-label','التنقل السريع'); app.appendChild(dock); }
    var on = cfg.enabled && cfg.items.length>0;
    document.documentElement.classList.toggle('has-dock', on);
    dock.innerHTML = cfg.items.map(function(id){
      var it=byId(id);
      return it.id==='more'
        ? '<button class="dock-btn" data-act="more"><span class="ic">'+it.ic+'</span>'+it.lbl+'</button>'
        : '<button class="dock-btn" data-page="'+it.id+'"><span class="ic">'+it.ic+'</span>'+it.lbl+'</button>';
    }).join('');
    syncActive();
  }
  document.addEventListener('click', function(e){
    var b=e.target.closest && e.target.closest('#dock .dock-btn'); if(!b) return;
    if(b.getAttribute('data-act')==='more'){ if(typeof openSideNav==='function') openSideNav(); return; }
    var p=b.getAttribute('data-page'); if(p && typeof showPage==='function') showPage(p);
  });

  /* ---- بطاقة الإعدادات ---- */
  function renderEditor(){
    var list=document.getElementById('dockItemsList'), chk=document.getElementById('dockEnabledChk');
    if(!list||!chk) return;
    chk.checked=cfg.enabled;
    var rest=ALL.filter(function(a){ return cfg.items.indexOf(a.id)<0; }).map(function(a){return a.id;});
    var order=cfg.items.concat(rest);
    list.innerHTML = order.map(function(id){
      var it=byId(id), sel=cfg.items.indexOf(id)>=0, idx=cfg.items.indexOf(id);
      return '<div class="dock-row" data-id="'+id+'">'
        +'<label><input type="checkbox" data-sel="'+id+'"'+(sel?' checked':'')+'> <span>'+it.ic+' '+it.lbl+'</span></label>'
        +(sel?'<button class="btn sm outline dock-mv" data-mv="-1"'+(idx===0?' disabled':'')+'>▲</button><button class="btn sm outline dock-mv" data-mv="1"'+(idx===cfg.items.length-1?' disabled':'')+'>▼</button>':'')
        +'</div>';
    }).join('')+'<p class="meta" style="margin-top:8px;">المختار: '+cfg.items.length+' من '+MAX+'</p>';
  }
  function bindEditor(){
    var card=document.getElementById('dockSettingsCard'); if(!card || card._bound) return; card._bound=true;
    card.addEventListener('change', function(e){
      var t=e.target;
      if(t.id==='dockEnabledChk'){ cfg.enabled=t.checked; save(); renderDock(); return; }
      var id=t.getAttribute && t.getAttribute('data-sel'); if(!id) return;
      if(t.checked){
        if(cfg.items.length>=MAX){ t.checked=false; if(typeof toast==='function') toast('الحد الأقصى '+MAX+' عناصر — ألغِ عنصرًا أولًا'); return; }
        cfg.items.push(id);
      } else cfg.items=cfg.items.filter(function(x){return x!==id;});
      save(); renderDock(); renderEditor();
    });
    card.addEventListener('click', function(e){
      var mv=e.target.closest && e.target.closest('[data-mv]');
      if(mv){
        var id=mv.parentNode.getAttribute('data-id'), i=cfg.items.indexOf(id), d=Number(mv.getAttribute('data-mv')), j=i+d;
        if(i<0||j<0||j>=cfg.items.length) return;
        var tmp=cfg.items[i]; cfg.items[i]=cfg.items[j]; cfg.items[j]=tmp;
        save(); renderDock(); renderEditor(); return;
      }
      if(e.target.id==='dockResetBtn'){ cfg={enabled:DEF.enabled, items:DEF.items.slice()}; save(); renderDock(); renderEditor(); }
    });
    renderEditor();
  }

  /* ---- ربط مع التنقل بدون تعديل showPage الأصلية ---- */
  var orig=window.showPage;
  if(typeof orig==='function'){
    window.showPage=function(name){ var r=orig.apply(this,arguments); try{ syncActive(); }catch(e){} return r; };
  }
  function init(){ renderDock(); bindEditor(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
