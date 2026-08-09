/* ===================== core.js ===================== */

/* ============================================================
   ورشة تفصيل الجلابيب - إدارة كاملة بـ localStorage
   ============================================================ */

const STORAGE_KEY = 'jalaba_db_v1';
let db = null;

function defaultDB(){
  return {
    password:'0000',
    customers:[],
    orders:[],
    payments:[],
    expenses:[],
    commitments:[],
    houseExpenses:[],
    financePassword:null,
    savingsGoalTarget:0,
    dailyCapacity:500,
    garmentTypes:[],
    vipThreshold:3,
    vipDiscountPercent:0,
    idleLockMinutes:3,
    debtThreshold:2000,
    lastBackupDate:null,
    dayOffWeekday:0,
    workshopName:'ورشة تفصيل الجلابيب',
    ownerName:'',
    ownerPhone:'',
    workshopAddress:'',
    workshopLogo:null,
    theme:{primary:'#1F6D57', primaryDark:'#123C2F', accent:'#B8863B', bg:'#F6F1E6'},
    invoiceCustom:{},
    btnRadius:12,
    fontSettings:{family:'default', size:'1'},
    skeletonLoading:false,
    homeWidgets:['alerts','stats','weekly','today','commitment','upcoming','late'].map(id=>({id, visible:true})),
    lastCommitmentsMonthCheck:null,
    commitmentPayments:[],
    missedCommitmentNotices:[],
    commitmentsNotifyEnabled:false,
    commitmentsLastNotifiedDate:null,
    houseExpenseAlertPercent:50,
    houseExpenseAlertMinDays:10,
    wideMode:false,
    customCSS:'',
    customJS:'',
    darkMode:false,
    workStartHour:9,
    workEndHour:18,
    queueManualOrder:[],
    trash:[],
    nextInvoiceNumber:1001,
    taxDefaultPercent:0,
    urgentFeeDefaultPercent:0,
    holidays:[],
    occasions:[],
    activityLog:[],
    updatedAt: 0,
    cloudSync: {enabled:false, syncId:null, firebaseConfig:null},
    pushNotify: {vapidKey:null, daysBefore:1, deviceTokens:[], notifiedOrderIds:[]}
  };
}

/* فتح رابط خارجي (واتساب، إلخ) — بعض تطبيقات WebView (زي WebIntoApp)
   تمنع النوافذ المنبثقة الجديدة، فبيفشل window.open() بصمت.
   هنا بنجرب window.open ولو فشل أو رجع null بنستخدم location.href
   بدل منه عشان يتم تمرير الرابط لتطبيق واتساب/المتصفح مباشرة. */
function openExternalLink(url){
  let win = null;
  try{ win = window.open(url, '_blank'); }catch(e){ win = null; }
  if(!win){
    try{ location.href = url; }catch(e){ /* تجاهل */ }
  }
}

/* بيفتح شات عميل معين بالتحديد في تطبيق واتساب نفسه (مش رابط wa.me بس).
   رابط wa.me أحيانًا بيتفتح كصفحة ويب عادية جوه الـ WebView (فبيوديك لصفحة
   واتساب العامة وتضطر تدور على العميل)، لكن سكيم "whatsapp://" هو رابط
   التطبيق المباشر، وده اللي بتطبيقات تغليف الـ WebView (زي WebIntoApp)
   بتلقفه وتحوّله لفتح تطبيق واتساب نفسه على نفس الشات بالظبط.
   لو السكيم مش مدعوم لأي سبب، بعد لحظة بسيطة (لو الصفحة لسه ظاهرة يعني
   محصلش تنقّل لتطبيق تاني) بنرجع لرابط wa.me العادي كخطة بديلة. */
function openWhatsAppChat(phone, text){
  const encoded = text ? encodeURIComponent(text) : '';
  const textParam = text ? `&text=${encoded}` : '';
  const textParamOnly = text ? `?text=${encoded}` : '';
  const waScheme = phone ? `whatsapp://send?phone=${phone}${textParam}` : `whatsapp://send${textParamOnly}`;
  const waWeb = phone ? `https://wa.me/${phone}${text?`?text=${encoded}`:''}` : `https://wa.me/${textParamOnly}`;
  let fallbackDone = false;
  const tryFallback = ()=>{
    if(fallbackDone) return;
    fallbackDone = true;
    if(!document.hidden) openExternalLink(waWeb);
  };
  document.addEventListener('visibilitychange', function onVis(){
    if(document.hidden){ fallbackDone = true; document.removeEventListener('visibilitychange', onVis); }
  });
  setTimeout(tryFallback, 1200);
  openExternalLink(waScheme);
}

/* حفظ/مشاركة ملف (نسخة احتياطية، CSV، HTML...) — بعض تطبيقات WebView
   (زي WebIntoApp) لا تدعم تنزيل ملفات blob: بصمت من غير أي رسالة خطأ.
   هنا بنجرب أولاً مشاركة الملف عبر واجهة المشاركة الأصلية بالجهاز
   (بتفتح خيارات حفظ في الملفات/إرسال واتساب...إلخ)، ولو مش مدعومة
   بنرجع للطريقة العادية (رابط تنزيل)، ولو فشلت كمان بنطلع رسالة واضحة. */
async function saveOrShareFile(blob, filename){
  try{
    const file = new File([blob], filename, {type: blob.type});
    if(navigator.canShare && navigator.canShare({files:[file]})){
      await navigator.share({files:[file], title: filename});
      return true;
    }
  }catch(e){ /* نكمل للطريقة العادية */ }
  try{
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 60000);
    return true;
  }catch(e){
    toast('تعذر حفظ الملف. جرّب فتح التطبيق من متصفح Chrome بدل نافذة المعاينة');
    return false;
  }
}

function loadDB(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      db = JSON.parse(raw);
      if(!db.password) db.password = '0000';
      if(!db.customers) db.customers=[];
      if(!db.orders) db.orders=[];
      if(!db.payments) db.payments=[];
      if(!db.expenses) db.expenses=[];
      if(!db.commitments) db.commitments=[];
      db.commitments.forEach(c=>{
        if(!c.priority) c.priority='essential';
        if(c.remainingMonths===undefined) c.remainingMonths=null;
        if(c.lastPaidMonth===undefined) c.lastPaidMonth=null;
        if(!c.type) c.type='تانية';
        if(!c.intervalMonths) c.intervalMonths=1;
        if(c.cycleStartYM===undefined) c.cycleStartYM=null;
      });
      if(db.savingsGoalTransferredAmount===undefined) db.savingsGoalTransferredAmount=0;
      if(!db.personalLoans) db.personalLoans=[];
      if(!db.houseExpenses) db.houseExpenses=[];
      if(db.lastCommitmentsMonthCheck===undefined) db.lastCommitmentsMonthCheck=null;
      if(!db.commitmentPayments) db.commitmentPayments=[];
      if(!db.missedCommitmentNotices) db.missedCommitmentNotices=[];
      if(db.commitmentsNotifyEnabled===undefined) db.commitmentsNotifyEnabled=false;
      if(db.commitmentsLastNotifiedDate===undefined) db.commitmentsLastNotifiedDate=null;
      if(!db.houseExpenseAlertPercent) db.houseExpenseAlertPercent=50;
      if(!db.houseExpenseAlertMinDays) db.houseExpenseAlertMinDays=10;
      if(db.savingsGoalTarget===undefined) db.savingsGoalTarget=0;
      rolloverCommitmentsMonthly();
      if(db.financePassword===undefined) db.financePassword=null;
      if(!db.dailyCapacity) db.dailyCapacity=500;
      if(!db.garmentTypes) db.garmentTypes=[];
      if(!db.vipThreshold) db.vipThreshold=3;
      if(db.vipDiscountPercent===undefined || db.vipDiscountPercent===null) db.vipDiscountPercent=0;
      if(!db.idleLockMinutes) db.idleLockMinutes=3;
      if(!db.debtThreshold) db.debtThreshold=2000;
      if(db.lastBackupDate===undefined) db.lastBackupDate=null;
      if(db.dayOffWeekday===undefined || db.dayOffWeekday===null) db.dayOffWeekday=0;
      if(!db.workshopName) db.workshopName='ورشة تفصيل الجلابيب';
      if(db.ownerName===undefined) db.ownerName='';
      if(db.ownerPhone===undefined) db.ownerPhone='';
      if(db.workshopAddress===undefined) db.workshopAddress='';
      if(db.workshopLogo===undefined) db.workshopLogo=null;
      if(!db.theme) db.theme={primary:'#1F6D57', primaryDark:'#123C2F', accent:'#B8863B', bg:'#F6F1E6'};
      if(!db.invoiceCustom) db.invoiceCustom={};
      if(!db.btnRadius) db.btnRadius=12;
      if(db.customCSS===undefined) db.customCSS='';
      if(db.customJS===undefined) db.customJS='';
      if(db.darkMode===undefined) db.darkMode=false;
      if(!db.workStartHour) db.workStartHour=9;
      if(!db.workEndHour) db.workEndHour=18;
      if(!db.queueManualOrder) db.queueManualOrder=[];
      if(!db.trash) db.trash=[];
      if(!db.nextInvoiceNumber) db.nextInvoiceNumber=1001;
      if(db.taxDefaultPercent===undefined || db.taxDefaultPercent===null) db.taxDefaultPercent=0;
      if(db.urgentFeeDefaultPercent===undefined || db.urgentFeeDefaultPercent===null) db.urgentFeeDefaultPercent=0;
      if(!db.holidays) db.holidays=[];
      if(!db.occasions) db.occasions=[];
      if(!db.activityLog) db.activityLog=[];
      if(db.updatedAt===undefined) db.updatedAt=0;
      if(!db.cloudSync) db.cloudSync={enabled:false, syncId:null, firebaseConfig:null};
      if(!db.pushNotify) db.pushNotify={vapidKey:null, daysBefore:1, deviceTokens:[], notifiedOrderIds:[]};
      if(!Array.isArray(db.pushNotify.deviceTokens)) db.pushNotify.deviceTokens=[];
      if(!Array.isArray(db.pushNotify.notifiedOrderIds)) db.pushNotify.notifiedOrderIds=[];
      if(!db.pushNotify.daysBefore) db.pushNotify.daysBefore=1;
      purgeOldTrash();
    } else {
      db = defaultDB();
      saveDB();
    }
  }catch(e){
    db = defaultDB();
    saveDB();
  }
}

// كتابة localStorage الفعلية بتتأجل شوية (debounce) عشان الشاشات اللي بتنادي
// saveDB مرات كتير قريبة من بعض (كتابة في حقل، سحب-وإفلات، تعديلات متتالية)
// متعملش JSON.stringify لقاعدة بيانات كبيرة مع كل ضغطة زرار — ده كان بيبطّئ
// الواجهة على الأجهزة الضعيفة. db.updatedAt وباقي المنطق (المزامنة السحابية،
// الشارة) بيتحدثوا فورًا زي الأول؛ الحفظ الفعلي في localStorage بس هو اللي بيتأجل.
let saveDBTimer = null;
let saveDBPending = false;

function saveDB(){
  db.updatedAt = Date.now();
  // البيانات دايمًا بتتحفظ محليًا (شغل كامل بدون إنترنت)، والمزامنة السحابية
  // (لو مفعّلة) بتحصل لما يبقى فيه اتصال — لحد ما تنجح، التغيير فضل "معلّق"
  if(db.cloudSync && db.cloudSync.enabled) cloudPendingChanges = true;
  scheduleCloudPush();
  if(typeof window.refreshConnectivityBadge==='function') window.refreshConnectivityBadge();
  saveDBPending = true;
  clearTimeout(saveDBTimer);
  saveDBTimer = setTimeout(flushSaveDB, 400);
}

// يكتب db فعليًا في localStorage دلوقتي (من غير أي تأجيل). بينادَى تلقائيًا
// بعد فترة هدوء قصيرة من آخر saveDB()، وكمان فورًا لو الصفحة هتتقفل/تتخبّى
// عشان منضيعش آخر تعديل لسه معلّق في المؤقّت.
function flushSaveDB(){
  clearTimeout(saveDBTimer);
  if(!saveDBPending) return;
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    saveDBPending = false;
  }catch(e){
    console.warn('تعذر حفظ البيانات محليًا (وضع التصفح الخاص أو متصفح مقيّد):', e);
  }
}

// شبكة أمان: لو المستخدم قفل التطبيق أو بدّل تاب قبل ما يعدّي الـ 400ms،
// لازم نضمن إن آخر تعديل اتكتب فعليًا قبل ما الصفحة تختفي.
window.addEventListener('pagehide', flushSaveDB);
window.addEventListener('beforeunload', flushSaveDB);
document.addEventListener('visibilitychange', function(){
  if(document.visibilityState === 'hidden') flushSaveDB();
});

/* ============================================================
   المزامنة السحابية بين الأجهزة (Firebase Firestore)
   ============================================================
   الفكرة: نسخة db بالكامل بتتخزن في مستند واحد على Firestore
   باسم (رمز المزامنة). أي جهاز عارف نفس الرمز ونفس إعدادات
   مشروع Firebase بيقدر يقرأ ويكتب على نفس المستند، فبيبقى
   شغال زي مساحة تخزين مشتركة بين الموبايل والويندوز.
   لما فيه تعارض (تعديل في نفس الوقت من جهازين وهما أوفلاين)،
   بناخد بأحدث تعديل (updatedAt الأكبر) — "آخر تعديل بيكسب".
   ============================================================ */
let cloudApp = null;
let cloudDb = null;
let cloudUnsub = null;
let cloudPushTimer = null;
let cloudApplyingRemote = false; // true أثناء ما بنطبق تحديث جاي من السحابة، عشان منعملش لوب (نستقبل ونرجع نبعت)
let cloudStatus = 'off'; // off | connecting | online | error
let cloudPendingChanges = false; // true من وقت آخر تعديل لحد ما ينجح الرفع للسحابة
// true بس بعد ما نستلم أول رد فعلي من السحابة (onSnapshot) لجلسة الاتصال الحالية —
// سواء "فيه مستند وده اللي جواه" أو "المستند مش موجود لسه". قبل كده ممنوع منعًا باتًا
// أي رفع (push) للسحابة، حتى لو saveDB اتنادت، عشان منكررش كارثة إن بيانات محلية
// فاضية أو قديمة تكسب سباق ضد التحميل الحقيقي وتكتب فوق بيانات المستخدم الحقيقية.
let cloudInitialSyncDone = false;
let cloudPushWaitRetries = 0; // عداد أمان لمنع لوب لا نهائي لو الاتصال بالسحابة فشل باستمرار

function cloudStatusChanged(){
  const el = document.getElementById('cloudSyncStatusBadge');
  if(el) renderCloudSyncStatusBadge();
}

// يبعت نسخة db الحالية للسحابة بعد فترة هدوء قصيرة من آخر تعديل (عشان منبعتش مع كل ضغطة زرار)
function scheduleCloudPush(){
  if(!db || !db.cloudSync || !db.cloudSync.enabled || !cloudDb || cloudApplyingRemote) return;
  clearTimeout(cloudPushTimer);
  cloudPushTimer = setTimeout(pushToCloud, 900);
}

async function pushToCloud(){
  if(!cloudDb || !db.cloudSync || !db.cloudSync.syncId) return;
  if(!cloudInitialSyncDone){
    // لسه ما استلمناش تأكيد حقيقي من السحابة عن الحالة الحالية للمستند
    // (سواء فيه بيانات، أو المستند مش موجود لسه). الرفع في اللحظة دي خطر —
    // ممكن يكتب بيانات محلية فاضية/قديمة فوق بيانات حقيقية على السحابة.
    // بدل ما نرفع بعمى، بنأجل ونحاول تاني بعد شوية لحد ما يوصل أول snapshot حقيقي.
    if(cloudPushWaitRetries > 20){
      // اتأخرنا أكتر من كفاية (فيه مشكلة اتصال مستمرة) — بنوقف المحاولة دلوقتي
      // بدل ما نلف لوب لا نهائي؛ أي تعديل جديد (saveDB) هيعيد المحاولة تلقائي
      cloudStatusChanged();
      return;
    }
    cloudPushWaitRetries++;
    clearTimeout(cloudPushTimer);
    cloudPushTimer = setTimeout(pushToCloud, 400);
    return;
  }
  cloudPushWaitRetries = 0;
  if(!navigator.onLine){
    // محدش نت دلوقتي — نسيب التغيير معلّق، هيتبعت تلقائي أول ما الاتصال يرجع (حدث 'online')
    cloudStatusChanged();
    return;
  }
  try{
    // Firestore بيرفض قيم undefined كقيمة لحقل (زي qty/unitPrice القديمة اللي بنمسحها عند التعديل)،
    // فبنعمل نسخة "نضيفة" عن طريق JSON round-trip اللي بيشيل أي مفتاح قيمته undefined تلقائيًا
    const safeData = JSON.parse(JSON.stringify(db));
    await cloudDb.collection('workshops').doc(db.cloudSync.syncId).set(safeData);
    cloudStatus='online';
    cloudPendingChanges = false;
  }catch(e){
    console.warn('فشل رفع البيانات للسحابة:', e);
    cloudStatus='error';
  }
  cloudStatusChanged();
}

// يبني رابطة Firebase من إعدادات المشروع المحفوظة، ويشترك في تحديثات المستند لحظيًا
function initCloudSync(){
  if(!db.cloudSync || !db.cloudSync.enabled || !db.cloudSync.firebaseConfig || !db.cloudSync.syncId){
    cloudStatus='off';
    cloudStatusChanged();
    return;
  }
  // كل محاولة اتصال (بما فيها إعادة الاتصال) لازم تستنى تأكيد جديد من السحابة
  // قبل ما تسمح بأي رفع — منع الكارثة مش مقصور بس على أول ربط
  cloudInitialSyncDone = false;
  cloudPushWaitRetries = 0;
  try{
    cloudStatus='connecting';
    cloudStatusChanged();
    cloudApp = firebase.apps && firebase.apps.length ? firebase.apps[0] : firebase.initializeApp(db.cloudSync.firebaseConfig);
    cloudDb = firebase.firestore();
    try{ cloudDb.enablePersistence({synchronizeTabs:true}).catch(()=>{}); }catch(e){ /* تجاهل لو مش مدعومة */ }
    if(cloudUnsub) cloudUnsub();
    cloudUnsub = cloudDb.collection('workshops').doc(db.cloudSync.syncId).onSnapshot(
      snap=>{
        cloudStatus='online';
        if(!snap.exists){ cloudInitialSyncDone = true; cloudStatusChanged(); return; }
        const remote = snap.data();
        if(!remote || typeof remote.updatedAt!=='number'){ cloudInitialSyncDone = true; cloudStatusChanged(); return; }
        if(remote.updatedAt > (Number(db.updatedAt)||0)){
          // قبل ما نستبدل بيانات الجهاز ده ببيانات جاية من جهاز تاني (تعارض)،
          // ناخد نسخة احتياطية محلية من بيانات الجهاز ده الحالية أولًا — شبكة
          // أمان لو كان فيه تعديل محلي لسه ما اتزامنش لأي سبب. متعملش الباك أب
          // لو الجهاز ده أصلاً ولا عمل save قبل كده (db.updatedAt=0، مفيش حاجة تتفقد).
          if(Number(db.updatedAt) > 0) saveConflictBackup(db);
          cloudApplyingRemote = true;
          const myCloudSettings = db.cloudSync; // نحافظ على إعدادات الاتصال بتاعت الجهاز ده بالذات
          db = remote;
          db.cloudSync = myCloudSettings;
          fillMissingDefaults();
          try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }catch(e){}
          renderAll();
          renderConflictBackupsCard();
          try{ applyWorkshopBranding(); applyTheme(); applyFontSettings(); applyWideMode(); applyDarkMode(); applyCustomCSS(); applyHomeWidgetsLayout(); }catch(e){}
          cloudApplyingRemote = false;
        }
        // دلوقتي مؤكد إن db المحلية (سواء فضلت زي ما هي أو اتحدثت من فوق) متزامنة
        // فعليًا مع آخر حالة معروفة من السحابة — آمن نسمح بالرفع بعد كده
        cloudInitialSyncDone = true;
        cloudStatusChanged();
      },
      err=>{
        console.warn('خطأ في المزامنة السحابية:', err);
        cloudStatus='error';
        cloudStatusChanged();
      }
    );
  }catch(e){
    console.warn('تعذر تفعيل المزامنة السحابية:', e);
    cloudStatus='error';
    cloudStatusChanged();
  }
}

// يعيد ملء أي حقل ناقص في db (لو جاي من مستند سحابي أقدم من نسخة التطبيق الحالية) بنفس منطق loadDB
function fillMissingDefaults(){
  const d = defaultDB();
  Object.keys(d).forEach(k=>{
    if(db[k]===undefined) db[k] = d[k];
  });
  if(!db.theme) db.theme = d.theme;
  if(!db.pushNotify) db.pushNotify = d.pushNotify;
  if(!Array.isArray(db.pushNotify.deviceTokens)) db.pushNotify.deviceTokens=[];
  if(!Array.isArray(db.pushNotify.notifiedOrderIds)) db.pushNotify.notifiedOrderIds=[];
}

/* ============================================================
   نسخ احتياطية محلية عند تعارض المزامنة
   ============================================================
   مخزّنة في مفتاح localStorage منفصل عن db نفسه (عشان متتزامنش
   للسحابة وتفضل خاصة بالجهاز ده بس). بناخد نسخة تلقائيًا كل ما
   بيانات جهاز تاني هتستبدل بيانات الجهاز ده وقت تعارض (شوف
   initCloudSync فوق). آخر 5 نسخ بس بتفضل محفوظة.
   ============================================================ */
const CONFLICT_BACKUP_KEY = 'jalaba_conflict_backups_v1';
const CONFLICT_BACKUP_MAX = 5;

function loadConflictBackups(){
  try{
    const raw = localStorage.getItem(CONFLICT_BACKUP_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){ return []; }
}

function saveConflictBackup(localData){
  try{
    const list = loadConflictBackups();
    // Firestore-safe round-trip مش مطلوب هنا (localStorage مش زي Firestore بيرفض
    // undefined)، بس بنعمل نسخة مستقلة برضه عشان مانفلتش reference للـ db الحي
    const safeData = JSON.parse(JSON.stringify(localData));
    list.unshift({
      id: 'b' + Date.now(),
      ts: Date.now(),
      customersCount: (safeData.customers||[]).length,
      ordersCount: (safeData.orders||[]).length,
      data: safeData
    });
    while(list.length > CONFLICT_BACKUP_MAX) list.pop();
    localStorage.setItem(CONFLICT_BACKUP_KEY, JSON.stringify(list));
  }catch(e){
    console.warn('تعذر حفظ نسخة احتياطية عند تعارض المزامنة:', e);
  }
}

async function restoreConflictBackupLocal(id){
  const list = loadConflictBackups();
  const item = list.find((b) => b.id === id);
  if(!item){ toast('⚠️ النسخة دي مش موجودة'); return; }
  const ok = await appConfirm(
    'هل تريد استرجاع هذه النسخة الاحتياطية؟ سيتم استبدال كل بيانات هذا الجهاز الحالية بها.',
    {okText:'استرجاع', cancelText:'إلغاء', danger:true}
  );
  if(!ok) return;
  const myCloudSettings = db.cloudSync;
  db = JSON.parse(JSON.stringify(item.data));
  db.cloudSync = myCloudSettings;
  fillMissingDefaults();
  saveDB();
  flushSaveDB();
  renderAll();
  toast('✅ تم استرجاع النسخة الاحتياطية بنجاح');
}

function deleteConflictBackup(id){
  const list = loadConflictBackups().filter((b) => b.id !== id);
  try{ localStorage.setItem(CONFLICT_BACKUP_KEY, JSON.stringify(list)); }catch(e){}
  renderConflictBackupsCard();
}

function renderConflictBackupsCard(){
  const box = document.getElementById('conflictBackupsCardWrap');
  if(!box) return;
  const list = loadConflictBackups();
  const intro = '<h3>🛟 نسخ احتياطية عند تعارض المزامنة</h3>'
    + '<p class="meta">شبكة أمان محلية: لو حصل تعارض بين جهازين وقت المزامنة السحابية، '
    + 'بناخد نسخة من بيانات هذا الجهاز تلقائيًا قبل أي استبدال — من هنا تقدر ترجع أي نسخة ضاعت.</p>';
  if(!list.length){
    box.innerHTML = intro + '<p class="meta">لا توجد نسخ احتياطية حتى الآن.</p>';
    return;
  }
  const rows = list.map((b) => {
    const d = new Date(b.ts);
    const dateStr = d.toLocaleDateString('ar-EG') + ' ' + d.toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'});
    return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);">'
      + '<div><div style="font-weight:700;">' + escapeHtml(dateStr) + '</div>'
      + '<div class="meta">' + (b.customersCount||0) + ' عميل — ' + (b.ordersCount||0) + ' طلب</div></div>'
      + '<div class="btn-row">'
      + '<button class="btn sm outline" onclick="restoreConflictBackupLocal(\'' + b.id + '\')">↩️ استرجاع</button>'
      + '<button class="btn sm danger" onclick="deleteConflictBackup(\'' + b.id + '\')">🗑️</button>'
      + '</div></div>';
  }).join('');
  box.innerHTML = intro + rows;
}

function randomSyncId(){
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let s='';
  for(let i=0;i<28;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s;
}

// الجهاز الأول: ينشئ مساحة مزامنة جديدة على مشروع Firebase الخاص بصاحب الورشة
async function createCloudSyncSpace(){
  const raw = document.getElementById('firebaseConfigInput').value.trim();
  if(!raw){ toast('الصق إعدادات مشروع Firebase أولاً'); return; }
  let cfg;
  try{ cfg = JSON.parse(raw); }catch(e){ toast('صيغة إعدادات Firebase غير صحيحة — تأكد إنها JSON صحيح'); return; }
  if(!cfg.projectId || !cfg.apiKey){ toast('الإعدادات ناقصة — تأكد إنك نسخت كل الكود من Firebase'); return; }
  const syncId = randomSyncId();
  db.cloudSync = {enabled:true, syncId, firebaseConfig:cfg};
  saveDB();
  initCloudSync();
  setTimeout(pushToCloud, 500);
  renderSettings();
  toast('تم إنشاء مساحة المزامنة ✅ انسخ الرمز وحطه في الجهاز التاني');
}

// الجهاز الثاني: يتصل بمساحة مزامنة موجودة بالفعل عن طريق رمز الربط
async function connectCloudSyncSpace(){
  const code = document.getElementById('pairingCodeInput').value.trim();
  if(!code){ toast('الصق رمز الربط من الجهاز الأول'); return; }
  let parsed;
  try{ parsed = JSON.parse(atob(code)); }catch(e){ toast('رمز الربط غير صحيح'); return; }
  if(!parsed.syncId || !parsed.firebaseConfig){ toast('رمز الربط غير مكتمل'); return; }
  if(!await appConfirm('سيتم استبدال كل البيانات الحالية على هذا الجهاز ببيانات مساحة المزامنة. هل أنت متأكد؟')) return;
  db.cloudSync = {enabled:true, syncId:parsed.syncId, firebaseConfig:parsed.firebaseConfig};
  saveDB();
  // نصفّر الوقت المحلي عمداً (بعد saveDB اللي بيحدّثه) عشان نضمن إن أي نسخة موجودة
  // على السحابة، حتى لو أقدم، تتحمل بدل بيانات الجهاز ده — إحنا وافقنا على الاستبدال فوق
  db.updatedAt = 0;
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }catch(e){}
  initCloudSync();
  renderSettings();
  toast('جاري الاتصال وتحميل البيانات...');
}

function copyPairingCode(){
  if(!db.cloudSync || !db.cloudSync.syncId) return;
  const code = btoa(JSON.stringify({syncId:db.cloudSync.syncId, firebaseConfig:db.cloudSync.firebaseConfig}));
  const ta = document.createElement('textarea');
  ta.value = code;
  ta.style.position='fixed'; ta.style.opacity='0';
  document.body.appendChild(ta);
  ta.select();
  try{ document.execCommand('copy'); toast('تم نسخ رمز الربط ✅ الصقه في الجهاز التاني'); }
  catch(e){ toast('تعذر النسخ التلقائي — انسخ الرمز يدويًا من المربع'); }
  ta.remove();
}

async function disconnectCloudSync(){
  if(!await appConfirm('هل تريد فصل المزامنة السحابية؟ بياناتك المحلية هتفضل موجودة، بس مش هتتحدث لحظيًا مع الجهاز التاني بعد كده.')) return;
  if(cloudUnsub){ cloudUnsub(); cloudUnsub=null; }
  db.cloudSync.enabled = false;
  cloudPendingChanges = false;
  saveDB();
  cloudStatus='off';
  renderSettings();
  toast('تم فصل المزامنة');
}

function renderCloudSyncStatusBadge(){
  const el = document.getElementById('cloudSyncStatusBadge');
  if(!el) return;
  const map = {
    off: ['⚪','غير مفعّلة','var(--muted)'],
    connecting: ['🟡','جاري الاتصال...','var(--warn, #B8863B)'],
    online: ['🟢','متصلة ومتزامنة','var(--ok)'],
    pending: ['🟡','في انتظار المزامنة — هيتزامن تلقائي أول ما الاتصال يرجع','var(--warn, #B8863B)'],
    error: ['🔴','خطأ في الاتصال — تحقق من الإنترنت والإعدادات','var(--danger)']
  };
  let status = cloudStatus;
  if(db && db.cloudSync && db.cloudSync.enabled && (!navigator.onLine || cloudPendingChanges)) status = 'pending';
  const [ic,label,color] = map[status]||map.off;
  el.innerHTML = `<span style="color:${color};font-weight:700;">${ic} ${label}</span>`;
}

// يبني كارت المزامنة السحابية بالكامل حسب حالة الاتصال الحالية (مش متصل / متصل)
function renderCloudSyncCard(){
  const box = document.getElementById('cloudSyncCardWrap');
  if(!box) return;
  const cs = db.cloudSync || {enabled:false, syncId:null, firebaseConfig:null};

  if(cs.enabled && cs.syncId){
    const pairingCode = btoa(JSON.stringify({syncId:cs.syncId, firebaseConfig:cs.firebaseConfig}));
    box.innerHTML = `
      <h3>☁️ المزامنة السحابية بين الأجهزة</h3>
      <p class="meta">الحالة: <span id="cloudSyncStatusBadge"></span></p>
      <p class="meta">📴 لو النت قطع، التطبيق يفضل شغال عادي وأي تعديل بيتحفظ عندك — وهيتزامن تلقائي أول ما الاتصال يرجع.</p>
      <p class="meta">لربط جهاز جديد (تاني موبايل أو جهاز ويندوز)، انسخ رمز الربط ده والصقه في نفس الصفحة على الجهاز التاني.</p>
      <div class="field"><label>رمز الربط</label><textarea id="pairingCodeOutput" rows="3" readonly style="font-size:11px;direction:ltr;text-align:left;">${pairingCode}</textarea></div>
      <div class="btn-row">
        <button class="btn secondary" onclick="copyPairingCode()">📋 نسخ رمز الربط</button>
        <button class="btn outline" onclick="pushToCloud()">🔄 مزامنة الآن</button>
      </div>
      <p class="meta" style="margin-top:10px;color:var(--danger);">⚠️ رمز الربط زي كلمة سر لبياناتك — متبعتوش إلا للجهاز اللي إنت شخصيًا هتربطه.</p>
      <button class="btn sm danger" style="margin-top:10px;" onclick="disconnectCloudSync()">🔌 فصل المزامنة عن هذا الجهاز</button>
    `;
    renderCloudSyncStatusBadge();
  } else {
    box.innerHTML = `
      <h3>☁️ المزامنة السحابية بين الأجهزة</h3>
      <p class="meta">تخلي بيانات الموبايل والويندوز (أو أي جهاز تاني) تتحدث تلقائيًا مع بعض لحظيًا عن طريق مشروع Firebase مجاني خاص بيك.</p>
      <p class="meta">📴 التطبيق شغال بالكامل حتى من غير إنترنت — أي تعديل بيتحفظ فورًا على جهازك، ولما الاتصال يرجع بيتزامن تلقائي مع باقي الأجهزة من غير ما تعمل حاجة.</p>
      <div class="field-row2" style="margin-top:10px;">
        <button class="btn secondary" onclick="toggleCloudSetupMode('create')">🆕 هذا أول جهاز (إنشاء مساحة مزامنة)</button>
        <button class="btn outline" onclick="toggleCloudSetupMode('connect')">🔗 عندي رمز ربط من جهاز تاني</button>
      </div>
      <div id="cloudSetupCreateBox" style="display:none;margin-top:12px;">
        <p class="meta">1) افتح <b>console.firebase.google.com</b> واعمل مشروع مجاني جديد.<br>
        2) فعّل <b>Firestore Database</b> من القايمة الجانبية (Start in production mode).<br>
        3) من إعدادات المشروع (⚙️ Project settings) → طوّل لتحت لحد "Your apps" → أضف تطبيق ويب (</>) → هيديك كود فيه Config، انسخه والصقه هنا بالكامل.</p>
        <div class="field"><label>إعدادات مشروع Firebase (Config)</label><textarea id="firebaseConfigInput" rows="5" placeholder='{"apiKey": "...", "projectId": "...", ...}' style="font-size:12px;direction:ltr;text-align:left;"></textarea></div>
        <button class="btn" onclick="createCloudSyncSpace()">✅ إنشاء مساحة المزامنة</button>
      </div>
      <div id="cloudSetupConnectBox" style="display:none;margin-top:12px;">
        <p class="meta">الصق رمز الربط اللي نسخته من الجهاز الأول (من نفس الصفحة دي عنده).</p>
        <div class="field"><label>رمز الربط</label><textarea id="pairingCodeInput" rows="3" placeholder="الصق الرمز هنا..." style="font-size:11px;direction:ltr;text-align:left;"></textarea></div>
        <button class="btn" onclick="connectCloudSyncSpace()">🔗 اتصال وتحميل البيانات</button>
      </div>
    `;
  }
}

function toggleCloudSetupMode(mode){
  const createBox = document.getElementById('cloudSetupCreateBox');
  const connectBox = document.getElementById('cloudSetupConnectBox');
  if(createBox) createBox.style.display = mode==='create' ? 'block':'none';
  if(connectBox) connectBox.style.display = mode==='connect' ? 'block':'none';
}

/* ============================================================
   الإشعارات الحقيقية (Firebase Cloud Messaging - Web Push)
   ============================================================
   بتستخدم نفس مشروع Firebase بتاع المزامنة السحابية. كل جهاز بيسجّل
   "توكن" خاص بيه بيتخزن جوه db.pushNotify.deviceTokens (وبالتالي
   بيتبعت للسحابة زي أي بيانات تانية). Cloud Function منفصلة (مرفقة
   في ملفات المشروع) هي اللي بتراجع الطلبات يوميًا وتبعت الإشعار
   الفعلي عن طريق FCM حتى لو التطبيق مقفول تمامًا.
   ============================================================ */
let messagingInstance = null;
let commitmentPaymentsLogShowCount = 15;
let commitmentsListShowCount = 8;
let houseExpensesListShowCount = 8;

function getPushSwUrl(){
  const cfg = db.cloudSync && db.cloudSync.firebaseConfig;
  if(!cfg) return null;
  const params = new URLSearchParams({
    apiKey: cfg.apiKey||'', authDomain: cfg.authDomain||'', projectId: cfg.projectId||'',
    storageBucket: cfg.storageBucket||'', messagingSenderId: cfg.messagingSenderId||'', appId: cfg.appId||''
  });
  return 'firebase-messaging-sw.js?'+params.toString();
}

async function enablePushNotifications(){
  try{
    if(!db.cloudSync || !db.cloudSync.enabled || !db.cloudSync.firebaseConfig){
      toast('فعّل المزامنة السحابية الأول من الكارت اللي فوق');
      return;
    }
    const vapidInput = document.getElementById('vapidKeyInput');
    const vapidKey = vapidInput ? vapidInput.value.trim() : (db.pushNotify.vapidKey||'');
    if(!vapidKey){ toast('الصق مفتاح Web Push (VAPID) الأول — تلاقيه في Firebase Console'); return; }
    if(!('serviceWorker' in navigator) || typeof Notification==='undefined'){
      toast('المتصفح ده مش بيدعم الإشعارات الحقيقية');
      return;
    }
    const perm = await Notification.requestPermission();
    if(perm !== 'granted'){ toast('لازم توافق على إذن الإشعارات من المتصفح عشان تشتغل'); return; }

    const swUrl = getPushSwUrl();
    const reg = await navigator.serviceWorker.register(swUrl);
    if(!cloudApp){
      cloudApp = (firebase.apps && firebase.apps.length) ? firebase.apps[0] : firebase.initializeApp(db.cloudSync.firebaseConfig);
    }
    messagingInstance = firebase.messaging();
    const token = await messagingInstance.getToken({vapidKey, serviceWorkerRegistration: reg});
    if(!token){ toast('تعذر الحصول على رمز الإشعارات — تأكد من مفتاح VAPID'); return; }

    db.pushNotify.vapidKey = vapidKey;
    if(!db.pushNotify.deviceTokens.includes(token)) db.pushNotify.deviceTokens.push(token);
    saveDB();
    renderPushNotifyCard();
    toast('✅ تفعّلت الإشعارات الحقيقية على هذا الجهاز');

    messagingInstance.onMessage(function(payload){
      const title = (payload.notification && payload.notification.title) || 'تنبيه';
      const body = (payload.notification && payload.notification.body) || '';
      toast('🔔 '+title+(body?(' — '+body):''));
    });
  }catch(e){
    console.warn('فشل تفعيل الإشعارات:', e);
    toast('حصل خطأ أثناء تفعيل الإشعارات: '+(e && e.message ? e.message : ''));
  }
}

function disablePushNotifications(){
  db.pushNotify.deviceTokens = [];
  saveDB();
  renderPushNotifyCard();
  toast('تم إيقاف الإشعارات على هذا الجهاز');
}

function saveDaysBeforeSetting(){
  const el = document.getElementById('daysBeforeInput');
  if(!el) return;
  const v = Math.max(0, Math.min(14, Number(el.value)||1));
  db.pushNotify.daysBefore = v;
  saveDB();
  toast('✅ اتحفظ');
}

function renderPushNotifyCard(){
  const box = document.getElementById('pushNotifyCardWrap');
  if(!box) return;
  const cs = db.cloudSync || {};
  const pn = db.pushNotify || {vapidKey:null, daysBefore:1, deviceTokens:[]};

  if(!cs.enabled || !cs.syncId){
    box.innerHTML = `
      <h3>🔔 إشعارات حقيقية لمواعيد التسليم</h3>
      <p class="meta">فعّل المزامنة السحابية فوق الأول — الإشعارات الحقيقية بتشتغل من خلال نفس مشروع Firebase.</p>
    `;
    return;
  }

  const enabledHere = typeof Notification!=='undefined' && Notification.permission==='granted'
    && pn.deviceTokens && pn.deviceTokens.length>0;

  box.innerHTML = `
    <h3>🔔 إشعارات حقيقية لمواعيد التسليم</h3>
    <p class="meta">توصلك إشعارات على الموبايل حتى لو التطبيق مقفول تمامًا، قبل موعد تسليم أي طلب بعدد الأيام اللي تحددها. محتاجة إعداد لمرة واحدة على Firebase (راجع ملف الشرح المرفق مع المشروع).</p>
    ${enabledHere ? `
      <p class="meta" style="color:var(--ok);font-weight:700;">✅ الإشعارات مفعّلة على هذا الجهاز</p>
      <div class="field"><label>نبّهني قبل التسليم بعدد الأيام</label>
        <div class="field-row2">
          <input id="daysBeforeInput" type="number" min="0" max="14" value="${pn.daysBefore||1}">
          <button class="btn sm secondary" onclick="saveDaysBeforeSetting()">💾 حفظ</button>
        </div>
      </div>
      <button class="btn sm danger" onclick="disablePushNotifications()">🔕 إيقاف الإشعارات على هذا الجهاز</button>
    ` : `
      <div class="field"><label>مفتاح Web Push (VAPID key)</label>
        <input id="vapidKeyInput" type="text" placeholder="من Firebase Console → Cloud Messaging → Web Push certificates" style="font-size:12px;direction:ltr;text-align:left;" value="${pn.vapidKey?pn.vapidKey.replace(/"/g,'&quot;'):''}">
      </div>
      <button class="btn" onclick="enablePushNotifications()">🔔 تفعيل الإشعارات على هذا الجهاز</button>
    `}
  `;
}

function uid(){
  return Date.now().toString(36)+Math.random().toString(36).slice(2,7);
}

function todayStr(){
  return new Date().toISOString().slice(0,10);
}

const WEEKDAY_NAMES_AR = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

// هل التاريخ المُعطى (Date أو 'YYYY-MM-DD') يقع في يوم الإجازة الأسبوعي المحدد في الإعدادات، أو في يوم عيد/إجازة مُضاف يدوياً؟
function isDayOff(dateLike){
  if(!dateLike) return false;
  const d = (dateLike instanceof Date) ? dateLike : new Date(dateLike);
  if(isNaN(d.getTime())) return false;
  const dateStr = d.toISOString().slice(0,10);
  if((db.holidays||[]).some(h=>h.date===dateStr)) return true;
  return d.getDay() === Number(db.dayOffWeekday ?? 0);
}

function dayOffName(){
  return WEEKDAY_NAMES_AR[Number(db.dayOffWeekday ?? 0)];
}

// بيرجع سبب الإجازة كنص مناسب لعرضه للمستخدم: اسم العيد المحدد لو التاريخ يصادف عيد،
// وإلا اسم يوم الإجازة الأسبوعي لو التاريخ يصادفه، وإلا نص فاضي لو مش يوم إجازة أصلاً
function dayOffLabel(dateLike){
  if(!dateLike) return '';
  const d = (dateLike instanceof Date) ? dateLike : new Date(dateLike);
  if(isNaN(d.getTime())) return '';
  const dateStr = d.toISOString().slice(0,10);
  const holiday = (db.holidays||[]).find(h=>h.date===dateStr);
  if(holiday) return holiday.name;
  if(d.getDay() === Number(db.dayOffWeekday ?? 0)) return dayOffName();
  return '';
}

// بيضيف عدد "أيام شغل" فعلية بداية من الآن، متجاهلاً يوم الإجازة الأسبوعية تماماً
// (يوم الإجازة لا يُحتسب كيوم شغل، والتاريخ الناتج لا يقع أبداً في يوم الإجازة)
function addWorkDaysFromNow(workDays){
  let d = new Date();
  let count = 0;
  while(count < workDays){
    d = new Date(d.getTime() + 86400000);
    if(!isDayOff(d)) count++;
  }
  return d;
}

function fmtDate(d){
  if(!d) return '-';
  const parts = d.split('-');
  if(parts.length!==3) return d;
  return parts[2]+'/'+parts[1]+'/'+parts[0];
}

function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tm);
  t._tm = setTimeout(()=>t.classList.remove('show'), 1800);
}

/* ============================================================
   شاشة القفل
   ============================================================ */
let pin = '';
window.userRole = null;       // 'owner' | 'manager' | 'receptionist' — بيتحدد بعد نجاح فتح القفل
window.financeUnlocked = false; // هل اتفتح رقم صفحة المالية المنفصل في الجلسة الحالية

function initLock(){
  window.userRole = null;
  window.financeUnlocked = false;
  try{ loadDB(); }catch(e){ console.warn('loadDB failed, using defaults', e); db = defaultDB(); }
  try{ initCloudSync(); }catch(e){ console.warn('cloud sync init failed', e); }
  try{ applyWorkshopBranding(); }catch(e){ console.warn(e); }
  try{ applyTheme(); }catch(e){ console.warn(e); }
  try{ applyFontSettings(); }catch(e){ console.warn(e); }
  try{ applyWideMode(); }catch(e){ console.warn(e); }
  try{ applyDarkMode(); }catch(e){ console.warn(e); }
  try{ applyCustomCSS(); }catch(e){ console.warn(e); }
  const handleKeyTap = (e)=>{
    const btn = e.target.closest('button');
    if(!btn) return;
    if(e.type==='touchend') e.preventDefault(); // يمنع تكرار الضغطة (touch + click) في بعض تطبيقات الـ WebView
    const k = btn.getAttribute('data-k');
    if(k==='clear'){ pin=''; updatePinDots(); return; }
    if(k==='back'){ pin = pin.slice(0,-1); updatePinDots(); return; }
    if(pin.length<4){
      pin += k;
      updatePinDots();
      if(pin.length===4){
        setTimeout(checkPin, 120);
      }
    }
  };
  document.getElementById('keypad').addEventListener('click', handleKeyTap);
  document.getElementById('keypad').addEventListener('touchend', handleKeyTap, {passive:false});
}

function updatePinDots(){
  const dots = document.querySelectorAll('.pin-dot');
  dots.forEach((d,i)=>{
    d.classList.toggle('filled', i<pin.length);
    d.classList.remove('shake-err');
  });
  document.getElementById('lockError').textContent='';
}

function checkPin(){
  const realPass = (db && db.password) ? db.password : '0000';
  const managerPass = db && db.managerPassword;
  const receptionPass = db && db.receptionPassword;
  let matchedRole = null;
  if(pin === realPass) matchedRole = 'owner';
  else if(managerPass && pin === managerPass) matchedRole = 'manager';
  else if(receptionPass && pin === receptionPass) matchedRole = 'receptionist';
  if(matchedRole){
    window.userRole = matchedRole;
    window.financeUnlocked = false; // كل دخول جديد للتطبيق بيتطلب رقم المالية من تاني لو مفعّل
    document.getElementById('lockScreen').style.display='none';
    document.getElementById('app').style.display='block';
    pin='';
    applyRoleUI();
    boot();
    resetIdleTimer();
  } else {
    document.getElementById('lockError').textContent='الرقم السري غير صحيح، حاول مرة أخرى';
    document.querySelectorAll('.pin-dot').forEach(d=>d.classList.add('shake-err'));
    document.getElementById('keypad').parentElement.classList.add('lock-shake');
    setTimeout(()=>{
      pin='';
      updatePinDots();
      document.getElementById('lockScreen').classList.remove('lock-shake');
    }, 420);
  }
}

/* ---- تطبيق شكل الواجهة حسب مستوى الصلاحية (مالك/مدير/استقبال) ---- */
function applyRoleUI(){
  const html = document.documentElement;
  html.classList.toggle('role-receptionist', window.userRole==='receptionist');
  html.classList.toggle('role-manager', window.userRole==='manager');
  updateFinanceLockUI();
}

/* ---- قفل مستقل لصفحة المالية (رقم سري تاني غير رقم قفل التطبيق) ---- */
function updateFinanceLockUI(){
  const locked = !!(db && db.financePassword) && !window.financeUnlocked;
  document.documentElement.classList.toggle('finance-locked', locked);
}

let financeGatePin = '';
let financeGateTargetPage = 'finance'; // الصفحة اللي نرجعلها بعد فتح القفل (finance أو personal)
function openFinanceGate(targetPage){
  financeGatePin = '';
  financeGateTargetPage = targetPage || 'finance';
  openModal(`
    <div class="modal-head"><h3>💰 الصفحة محمية</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div style="padding:4px 2px 14px;font-size:14px;line-height:1.7;">الصفحة دي محمية برقم سري منفصل عن رقم قفل التطبيق. اكتب الرقم عشان تكمل.</div>
    <div class="field"><label>رقم سري المالية</label>
      <input type="tel" maxlength="4" id="financeGateInput" inputmode="numeric" autocomplete="off" class="pin-input" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,4)">
    </div>
    <div id="financeGateError" style="color:var(--danger);font-size:12.5px;min-height:16px;"></div>
    <div class="btn-row">
      <button class="btn outline" id="financeGateCancel">إلغاء</button>
      <button class="btn" id="financeGateOk">دخول</button>
    </div>
  `);
  const input = document.getElementById('financeGateInput');
  const tryEnter = ()=>{
    const val = (input.value||'').trim();
    if(db && val === db.financePassword){
      window.financeUnlocked = true;
      updateFinanceLockUI();
      closeModal();
      showPage(financeGateTargetPage||'finance');
    } else {
      const err = document.getElementById('financeGateError');
      if(err) err.textContent = 'الرقم السري غير صحيح، حاول تاني';
      input.value='';
    }
  };
  document.getElementById('financeGateOk').onclick = tryEnter;
  document.getElementById('financeGateCancel').onclick = ()=>closeModal();
  input.addEventListener('keydown', (e)=>{ if(e.key==='Enter') tryEnter(); });
  setTimeout(()=>{ if(input) input.focus(); }, 50);
}

function lockNow(){
  document.getElementById('app').style.display='none';
  document.getElementById('lockScreen').style.display='flex';
  pin='';
  updatePinDots();
  clearTimeout(idleTimer);
  window.userRole = null;
  window.financeUnlocked = false;
  document.documentElement.classList.remove('role-receptionist','role-manager','finance-locked');
}

/* ---- القفل التلقائي بعد فترة خمول ---- */
let idleTimer = null;
function resetIdleTimer(){
  if(document.getElementById('app').style.display!=='block') return;
  clearTimeout(idleTimer);
  const minutes = Number(db.idleLockMinutes)||3;
  idleTimer = setTimeout(()=>{ lockNow(); }, minutes*60000);
}
['click','touchstart','keydown','mousemove','scroll'].forEach(evt=>{
  document.addEventListener(evt, ()=>{ if(db) resetIdleTimer(); }, {passive:true});
});

/* ============================================================
   التنقل بين الصفحات
   ============================================================ */
let currentPage='home';
let calendarMonth = null; // 'YYYY-MM', يتم تعيينه أول مرة يفتح فيها صفحة المواعيد
let calendarSelectedDay = null; // 'YYYY-MM-DD' أو null لعرض كل المواعيد
let currentOrderFilter='all';
let currentOrdersView='list'; // 'list' أو 'kanban'
let personalActiveTab = 'overview'; // آخر تاب مفتوح في صفحة "التزاماتي الشخصية" (نظرة عامة/القائمة/التقارير/إعدادات)

const pageTitles = {
  home:'🏠 الرئيسية', customers:'👥 العملاء', orders:'📋 الطلبات',
  deliveries:'📅 مواعيد التسليم', finance:'💰 المالية', expenses:'🧵 المصروفات',
  personal:'💳 التزاماتي', settings:'⚙️ الإعدادات'
};
const fabPages = {home:false, customers:true, orders:true, deliveries:false, finance:false, expenses:true, personal:true, settings:false};

function showPage(name){
  if(window.userRole==='receptionist' && (name==='finance' || name==='expenses' || name==='personal' || name==='settings')){
    toast('🔒 الصفحة دي مش متاحة في وضع الاستقبال');
    name = 'home';
  } else if((name==='finance' || name==='personal') && db && db.financePassword && !window.financeUnlocked){
    openFinanceGate(name);
    return;
  } else if(window.userRole==='manager' && name==='settings'){
    toast('🔒 صفحة الإعدادات متاحة للمالك بس');
    name = 'home';
  }
  currentPage = name;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  document.querySelectorAll('.navbtn').forEach(b=>b.classList.toggle('active', b.getAttribute('data-page')===name));
  document.getElementById('pageTitle').textContent = pageTitles[name];
  document.getElementById('fabAdd').style.display = fabPages[name] ? 'flex':'none';
  if(db && db.skeletonLoading){
    showSkeleton();
    renderAll();
    clearTimeout(window._skelTm);
    window._skelTm = setTimeout(hideSkeleton, 280);
  } else {
    renderAll();
  }
  syncNavState();
  updateTopbarHeightVar();
}

// بيقيس ارتفاع الهيدر العلوي (topbar) فعليًا ويحطه في متغيّر CSS، عشان أي عنصر
// "لاصق" (sticky) تحته يعرف بالظبط تحت أي ارتفاع يقف من غير ما نكتب رقم ثابت
// ممكن يبوظ مع اختلاف حجم الخط أو الشاشة أو التفاف عنوان الصفحة لسطرين
function updateTopbarHeightVar(){
  const tb = document.querySelector('header.topbar');
  if(tb) document.documentElement.style.setProperty('--topbar-h', tb.offsetHeight+'px');
}

function openSideNav(){
  document.getElementById('sideNav').classList.add('open');
  document.getElementById('sideNavOverlay').classList.add('active');
  syncNavState();
}
function closeSideNav(){
  document.getElementById('sideNav').classList.remove('open');
  document.getElementById('sideNavOverlay').classList.remove('active');
  syncNavState();
}

function fabAction(){
  if(currentPage==='customers') openCustomerModal();
  else if(currentPage==='orders') openOrderModal();
  else if(currentPage==='expenses') openExpenseModal();
  else if(currentPage==='personal') openCommitmentModal();
}

function boot(){
  applyWorkshopBranding();
  document.getElementById('topDate').textContent = new Date().toLocaleDateString('ar-EG',{weekday:'long', year:'numeric', month:'long', day:'numeric'});
  applyHomeWidgetsLayout();
  showPage('home');
  runCustomJS();
}

function renderAll(){
  if(currentPage==='home') renderHome();
  if(currentPage==='customers') renderCustomers();
  if(currentPage==='orders') renderOrders();
  if(currentPage==='deliveries') renderDeliveries();
  if(currentPage==='finance') renderFinance();
  if(currentPage==='expenses') renderExpenses();
  if(currentPage==='personal') renderPersonalPage();
  if(currentPage==='settings') renderSettings();
}

/* ============================================================
   حسابات مساعدة
   ============================================================ */
// إجمالي أجرة الأصناف فقط (من غير مصاريف إضافية ولا رسوم استعجال ولا خصم/ضريبة)
function orderItemsSum(o){
  if(Array.isArray(o.items) && o.items.length){
    return o.items.reduce((s,it)=>s+(Number(it.unitPrice)||0)*(Number(it.qty)||1),0);
  }
  return Number(o.fee)||0;
}
// قيمة رسوم الاستعجال بالجنيه: نسبة % من أجرة الأصناف، لو الطلب مُعلّم كمستعجل
function orderUrgentFeeAmount(o){
  if(!o.urgent) return 0;
  const pct = Number(o.urgentFeePercent)||0;
  return orderItemsSum(o) * pct/100;
}
function orderSubtotal(o){
  return orderItemsSum(o) + (Number(o.extra)||0) + orderUrgentFeeAmount(o);
}
// قيمة الخصم بالجنيه (يدعم خصم نسبة % أو مبلغ ثابت، ولا يتعدى قيمة الإجمالي الفرعي)
function orderDiscountAmount(o){
  const sub = orderSubtotal(o);
  if(!o.discountType || o.discountType==='none') return 0;
  if(o.discountType==='percent') return Math.min(sub, sub*(Number(o.discountValue)||0)/100);
  if(o.discountType==='amount') return Math.min(sub, Math.max(0, Number(o.discountValue)||0));
  return 0;
}
// قيمة الضريبة/الرسوم الإضافية بالجنيه، محسوبة على الإجمالي بعد الخصم
function orderTaxAmount(o){
  const afterDiscount = orderSubtotal(o) - orderDiscountAmount(o);
  return afterDiscount * (Number(o.taxPercent)||0)/100;
}
function orderTotal(o){
  const sub = orderSubtotal(o);
  const discount = orderDiscountAmount(o);
  const tax = orderTaxAmount(o);
  return Math.max(0, sub - discount + tax);
}
function orderRemaining(o){ return orderTotal(o) - (Number(o.paid)||0); }

/* ============================================================
   سجل النشاط — يسجل كل عملية مهمة مع التاريخ والوقت
   (مفيد لو أكتر من شخص بيستخدم نفس الجهاز)
   ============================================================ */
function logActivity(text){
  if(!db.activityLog) db.activityLog=[];
  db.activityLog.push({id:uid(), text, ts:Date.now()});
  if(db.activityLog.length>200) db.activityLog = db.activityLog.slice(-200);
}

function fmtActivityTime(ts){
  const d = new Date(ts);
  return d.toLocaleDateString('ar-EG')+' '+d.toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});
}

/* ============================================================
   تراجع عن آخر إجراء — متاح خلال نفس الجلسة الحالية
   (مش بيتحفظ لو قفلت التطبيق، عشان بيحمل دالة استرجاع في الذاكرة)
   ============================================================ */
let lastUndo = null; // {label, restoreFn}

function setUndo(label, restoreFn){
  lastUndo = {label, restoreFn};
  renderUndoBar();
}

function performUndo(){
  if(!lastUndo){ toast('لا يوجد إجراء حديث للتراجع عنه'); return; }
  const {label, restoreFn} = lastUndo;
  lastUndo = null;
  restoreFn();
  renderUndoBar();
  toast('تم التراجع عن: '+label+' ↩️');
}

function renderUndoBar(){
  const box = document.getElementById('undoBarWrap');
  if(!box) return;
  box.innerHTML = lastUndo
    ? `<button class="btn sm outline" style="width:100%;margin-bottom:14px;" onclick="performUndo()">↩️ تراجع عن: ${escapeHtml(lastUndo.label)}</button>`
    : '';
}

/* ============================================================
   تتبع الوقت الفعلي المستغرق في كل طلب (بدء/إنهاء)
   ============================================================ */
function formatMinutesLabel(mins){
  mins = Math.max(0, Math.round(Number(mins)||0));
  if(mins<60) return mins+' د';
  const h = Math.floor(mins/60);
  const m = mins%60;
  return h+'س'+(m>0?' '+m+'د':'');
}

// لو فيه توقيت شغّال على الطلب، بيقفله ويجمع دقائقه على الإجمالي (تُستخدم عند تسليم الطلب تلقائياً)
function finalizeWorkTimeIfRunning(o){
  if(o && o.workStartedAt){
    const elapsedMin = Math.max(0, Math.round((Date.now()-o.workStartedAt)/60000));
    o.actualMinutes = (Number(o.actualMinutes)||0) + elapsedMin;
    o.workStartedAt = null;
  }
}

function startOrderWork(orderId){
  const o = db.orders.find(x=>x.id===orderId);
  if(!o || o.workStartedAt) return;
  o.workStartedAt = Date.now();
  o.updatedAt = Date.now();
  saveDB();
  renderOrders();
  toast('⏱️ بدأ تسجيل وقت الشغل');
}

function stopOrderWork(orderId){
  const o = db.orders.find(x=>x.id===orderId);
  if(!o || !o.workStartedAt) return;
  const elapsedMin = Math.max(0, Math.round((Date.now()-o.workStartedAt)/60000));
  finalizeWorkTimeIfRunning(o);
  o.updatedAt = Date.now();
  saveDB();
  renderOrders();
  toast(`⏹️ تم تسجيل ${formatMinutesLabel(elapsedMin)} — الإجمالي ${formatMinutesLabel(o.actualMinutes)}`);
}
function orderTypeLabel(o){
  if(Array.isArray(o.items) && o.items.length){
    return o.items.map(it=> ((it.qty||1)>1 ? (it.qty+' × ') : '') + it.type).join('، ');
  }
  return (o.qty && o.qty>1) ? (o.qty+' × '+o.type) : o.type;
}
function itemsBreakdownLines(o){
  if(Array.isArray(o.items) && o.items.length){
    return o.items.map(it=>`- ${((it.qty||1)>1?(it.qty+' × '):'')}${it.type}: ${((it.qty||1)*(Number(it.unitPrice)||0)).toLocaleString('ar-EG')} ج.م`);
  }
  return [`- ${orderTypeLabel(o)}: ${(Number(o.fee)||0).toLocaleString('ar-EG')} ج.م`];
}
function isOverdue(o){ return o.status!=='تم التسليم' && o.dateDelivery && o.dateDelivery < todayStr(); }
function customerById(id){ return db.customers.find(c=>c.id===id); }

// عدد طلبات العميل الفعلي (مش مخزّن على العميل نفسه — بيتحسب من سجل الطلبات في كل مرة)
function customerOrdersCount(customerId){
  if(!customerId) return 0;
  return db.orders.filter(o=>o.customerId===customerId).length;
}
function isCustomerVip(customerId){
  if(!customerId) return false;
  return customerOrdersCount(customerId) >= (Number(db.vipThreshold)||3);
}

// لو العميل المختار في طلب جديد وصل لعتبة الـ VIP، وفيه نسبة خصم VIP مفعّلة من الإعدادات،
// يقترحها تلقائيًا في حقول الخصم (من غير ما يبوّظ خصم دخله المستخدم بنفسه بالفعل).
// بيشتغل بس مع الطلبات الجديدة — مش وقت تعديل طلب قديم محفوظ بخصمه الأصلي.
function maybeApplyVipDiscount(){
  const badge = document.getElementById('vipDiscountBadge');
  if(currentEditingOrderId){ if(badge) badge.style.display='none'; return; }
  const pct = Number(db.vipDiscountPercent)||0;
  const sel = document.getElementById('f_customer');
  const cid = sel ? sel.value : '';
  if(pct<=0 || !isCustomerVip(cid)){
    if(badge) badge.style.display='none';
    return;
  }
  const typeEl = document.getElementById('f_discountType');
  const valEl = document.getElementById('f_discountValue');
  if(typeEl && valEl && typeEl.value==='none'){
    typeEl.value = 'percent';
    valEl.value = pct;
    onDiscountTypeChange();
    recalcItemsTotal();
  }
  if(badge) badge.style.display='block';
}

function statusBadge(o){
  const urgentTag = (o.urgent && o.status!=='تم التسليم') ? '<span class="badge" style="background:var(--danger-light);color:var(--danger);" title="طلب مستعجل">🔥 مستعجل</span> ' : '';
  if(isOverdue(o)) return urgentTag+'<span class="badge late">متأخر</span>';
  if(o.status==='قيد العمل') return urgentTag+'<span class="badge progress">قيد العمل</span>';
  if(o.status==='جاهز للتسليم') return urgentTag+'<span class="badge ready">جاهز للتسليم</span>';
  return '<span class="badge done">تم التسليم</span>';
}

/* ============================================================
   الصفحة الرئيسية
   ============================================================ */
function debtorCustomers(){
  const threshold = Number(db.debtThreshold)||2000;
  const map = {};
  db.orders.forEach(o=>{
    const rem = orderRemaining(o);
    if(rem>0){ map[o.customerId] = (map[o.customerId]||0) + rem; }
  });
  return Object.keys(map).filter(cid=>map[cid]>=threshold).map(cid=>({customer:customerById(cid), amount:map[cid]})).filter(x=>x.customer).sort((a,b)=>b.amount-a.amount);
}

function renderHomeAlerts(){
  const box = document.getElementById('homeAlerts');
  let html = '';

  const lateCount = db.orders.filter(isOverdue).length;
  if(lateCount>0){
    html += `<div class="alert-banner danger"><span class="ic">⏰</span><div><b>${lateCount} طلب متأخر عن موعد التسليم</b>تحقق من قسم "المواعيد" لمتابعتها وإبلاغ العملاء.</div></div>`;
  }

  const nearCount = db.orders.filter(o=>{
    if(o.status==='تم التسليم' || !o.dateDelivery) return false;
    const diff = Math.round((new Date(o.dateDelivery)-new Date(todayStr()))/86400000);
    return diff>=0 && diff<=1;
  }).length;
  if(nearCount>0){
    html += `<div class="alert-banner warn"><span class="ic">📦</span><div><b>${nearCount} طلب موعد تسليمه اليوم أو غداً</b>راجع قسم "المواعيد" للتجهيز.</div></div>`;
  }

  // تحذير استباقي: طلبات معادها بكرة ولسه "قيد العمل" (مش جاهزة للتسليم)
  const notReadyTomorrow = db.orders.filter(o=>{
    if(o.status!=='قيد العمل' || !o.dateDelivery) return false;
    const diff = Math.round((new Date(o.dateDelivery)-new Date(todayStr()))/86400000);
    return diff===1;
  }).length;
  if(notReadyTomorrow>0){
    html += `<div class="alert-banner danger"><span class="ic">🚨</span><div><b>${notReadyTomorrow} طلب معاده بكرة ولسه "قيد العمل" مش جاهز</b>باقي يوم واحد بس، يُفضّل تسرّع فيه دلوقتي قبل ما يتأخر.</div></div>`;
  }

  const noDepositOrders = db.orders.filter(o=>o.status==='قيد العمل' && (Number(o.paid)||0)===0).length;
  if(noDepositOrders>0){
    html += `<div class="alert-banner warn"><span class="ic">🪙</span><div><b>${noDepositOrders} طلب "قيد العمل" من غير أي دفعة مقدمة</b>يُفضّل تحصيل عربون قبل الاستمرار في التنفيذ.</div></div>`;
  }

  const debtors = debtorCustomers();
  if(debtors.length>0){
    const names = debtors.slice(0,3).map(d=>d.customer.name).join('، ');
    html += `<div class="alert-banner danger"><span class="ic">💸</span><div><b>${debtors.length} عميل تجاوز حد المديونية (${Number(db.debtThreshold).toLocaleString('ar-EG')} ج.م)</b>${escapeHtml(names)}${debtors.length>3?' وآخرون...':''}</div></div>`;
  }

  const upcomingOccasions = (db.occasions||[]).map(occ=>{
    const diff = Math.round((new Date(occ.date)-new Date(todayStr()))/86400000);
    return {occ, diff};
  }).filter(x=>x.diff>=0 && x.diff<=(Number(x.occ.alertDays)||14)).sort((a,b)=>a.diff-b.diff);
  if(upcomingOccasions.length>0){
    upcomingOccasions.forEach(({occ,diff})=>{
      const when = diff===0 ? 'النهاردة' : (diff===1?'بكرة':`بعد ${diff} يوم`);
      html += `<div class="alert-banner warn"><span class="ic">🎉</span><div><b>${escapeHtml(occ.name)} ${when} (${fmtDate(occ.date)})</b>موسم زي ده غالبًا بتزيد فيه الطلبات — استعد بدري (راجع طاقتك اليومية وجدول التسليم).</div></div>`;
    });
  }

  if(db.lastBackupDate){
    const days = Math.round((new Date(todayStr())-new Date(db.lastBackupDate))/86400000);
    if(days>=7){
      html += `<div class="alert-banner warn"><span class="ic">💾</span><div><b>لم يتم عمل نسخة احتياطية منذ ${days} يوم</b>يُفضّل تصدير نسخة احتياطية من صفحة الإعدادات بانتظام.</div></div>`;
    }
  } else if(db.customers.length>0 || db.orders.length>0){
    html += `<div class="alert-banner warn"><span class="ic">💾</span><div><b>لا توجد نسخة احتياطية محفوظة بعد</b>يُفضّل تصدير نسخة احتياطية من صفحة الإعدادات للحفاظ على بياناتك.</div></div>`;
  }

  const tomorrow = new Date(Date.now()+86400000);
  if(isDayOff(tomorrow)){
    const dueTomorrowOrOnOff = db.orders.filter(o=>{
      if(o.status==='تم التسليم' || !o.dateDelivery) return false;
      return o.dateDelivery===tomorrow.toISOString().slice(0,10);
    }).length;
    let msg = `بكرة (${dayOffLabel(tomorrow)}) إجازة — استغل شغل النهاردة عشان ميتأخرش شغلك.`;
    if(dueTomorrowOrOnOff>0){
      msg += ` وعندك ${dueTomorrowOrOnOff} طلب معاده بيصادف يوم الإجازة، يُفضّل تجهيزه أو التنسيق مع العميل قبلها.`;
    }
    html += `<div class="alert-banner warn"><span class="ic">🌿</span><div><b>غداً إجازة</b>${msg}</div></div>`;
  }

  box.innerHTML = html;
}

// عدد القطع الفعلي في الطلب (مش عدد الطلبات) — بيجمع qty كل صنف في الطلب
function orderPieceCount(o){
  const items = (Array.isArray(o.items) && o.items.length) ? o.items : [{qty:o.qty||1}];
  return items.reduce((s,it)=>s+(Number(it.qty)||1), 0);
}

// يطبّق الترتيب اليدوي (لو موجود) فوق الترتيب التلقائي، وأي عنصر جديد مش متسجل بيتضاف في الآخر
function applyManualQueueOrder(naturalQueue){
  const manual = Array.isArray(db.queueManualOrder) ? db.queueManualOrder : [];
  if(!manual.length) return naturalQueue;
  const byId = {};
  naturalQueue.forEach(o=>{ byId[o.id]=o; });
  const ordered = [];
  manual.forEach(id=>{ if(byId[id]){ ordered.push(byId[id]); delete byId[id]; } });
  naturalQueue.forEach(o=>{ if(byId[o.id]) ordered.push(o); });
  return ordered;
}

// يحسب دور الشغل النهاردة (نفس المنطق يُستخدم في العرض وفي إعادة الترتيب وتسجيل الإنجاز)
function computeTodayQueue(){
  const today = todayStr();
  const active = db.orders.filter(o=>o.status!=='تم التسليم');

  const mustFinish = active.filter(o=> o.dateDelivery && (o.dateDelivery<=today))
    .sort((a,b)=>(a.dateDelivery||'').localeCompare(b.dateDelivery||''));

  const startToday = active.filter(o=>{
    if(!o.dateDelivery || o.dateDelivery<=today) return false;
    const diff = Math.round((new Date(o.dateDelivery)-new Date(today))/86400000);
    return diff>=1 && diff<=2;
  }).sort((a,b)=>(a.dateDelivery||'').localeCompare(b.dateDelivery||''));

  const mustFinishIds = new Set(mustFinish.map(o=>o.id));
  const queue = applyManualQueueOrder(mustFinish.concat(startToday));
  const waitingCount = active.length - queue.length;
  return {active, mustFinish, mustFinishIds, startToday, queue, waitingCount};
}

// تحويل كسر اليوم (0 إلى 1) لوقت متوقع بصيغة عربية HH:MM ص/م بناءً على ساعات العمل المحددة
function formatEstimatedTime(fraction){
  const startH = Number(db.workStartHour ?? 9);
  const endH = Number(db.workEndHour ?? 18);
  const span = Math.max(1, endH-startH);
  const hoursFloat = startH + Math.min(1,fraction)*span;
  let h = Math.floor(hoursFloat);
  let m = Math.round((hoursFloat-h)*60);
  if(m===60){ h+=1; m=0; }
  h = ((h%24)+24)%24;
  const period = h<12 ? 'ص' : 'م';
  let h12 = h%12; if(h12===0) h12=12;
  return `${h12}:${String(m).padStart(2,'0')} ${period}`;
}

// تسجيل الطلب كمُنجز مباشرة من قايمة الدور
function markOrderDelivered(orderId){
  const o = db.orders.find(x=>x.id===orderId);
  if(!o) return;
  const before = {status:o.status, deliveredDate:o.deliveredDate, workStartedAt:o.workStartedAt, actualMinutes:o.actualMinutes};
  const beforeQueue = (db.queueManualOrder||[]).slice();
  finalizeWorkTimeIfRunning(o);
  o.status = 'تم التسليم';
  if(!o.deliveredDate) o.deliveredDate = todayStr();
  o.updatedAt = Date.now();
  db.queueManualOrder = (db.queueManualOrder||[]).filter(id=>id!==orderId);
  logActivity(`✅ تسليم طلب ${customerById(o.customerId)?customerById(o.customerId).name:''}`);
  setUndo('تسجيل الطلب كمُنجز', ()=>{
    o.status = before.status;
    o.deliveredDate = before.deliveredDate;
    o.workStartedAt = before.workStartedAt;
    o.actualMinutes = before.actualMinutes;
    db.queueManualOrder = beforeQueue;
    saveDB();
    renderHome();
    renderOrders();
  });
  saveDB();
  renderHome();
  toast('تم تسجيل الطلب كمُنجز ✅');
}

// تحريك عنصر في دور الشغل لأعلى (-1) أو لأسفل (+1) يدوياً
function moveQueueItem(orderId, direction){
  const {queue} = computeTodayQueue();
  const idx = queue.findIndex(o=>o.id===orderId);
  const newIdx = idx+direction;
  if(idx<0 || newIdx<0 || newIdx>=queue.length) return;
  const tmp = queue[idx];
  queue[idx] = queue[newIdx];
  queue[newIdx] = tmp;
  db.queueManualOrder = queue.map(o=>o.id);
  saveDB();
  renderTodayPlan();
}

// خطة اليوم: دور مرقّم واضح (مين الأول) + عدد القطع الحقيقي + تنبيه لو الشغل فوق طاقتك
function renderTodayPlan(){
  const box = document.getElementById('todayPlan');
  if(!box) return;

  if(isDayOff(new Date())){
    box.innerHTML = `<div class="alert-banner warn" style="margin-bottom:0;"><span class="ic">🌿</span><div><b>النهاردة ${dayOffLabel(new Date())} — يوم إجازة</b>مفيش شغل مجدول، خد راحتك وارجع لخطة الشغل بكرة.</div></div>`;
    return;
  }

  const {mustFinish, mustFinishIds, queue, waitingCount} = computeTodayQueue();

  // عدد القطع الحقيقي (مش عدد الطلبات) للي لازم يخلص النهاردة، ولكل الدور
  const piecesMustFinish = mustFinish.reduce((s,o)=>s+orderPieceCount(o), 0);
  const piecesQueue = queue.reduce((s,o)=>s+orderPieceCount(o), 0);

  // مقارنة حجم شغل "لازم يخلص النهاردة" بالطاقة اليومية المحددة في الإعدادات
  const capacity = Number(db.dailyCapacity)||500;
  const valueMustFinish = mustFinish.reduce((s,o)=>s+orderTotal(o), 0);
  const overCapacity = valueMustFinish > capacity;

  let html = '';

  // ملخص سريع أعلى الخطة: عدد القطع وعدد الطلبات في الدور
  html += `<div class="grid-cards" style="margin-bottom:10px;">
    <div class="stat-card ${mustFinish.length?'danger':''}"><div class="stat-ic">🧵</div><div><div class="num">${piecesMustFinish}</div><div class="lbl">قطعة لازم تخلص النهاردة</div></div></div>
    <div class="stat-card"><div class="stat-ic">📦</div><div><div class="num">${piecesQueue}</div><div class="lbl">إجمالي القطع في الدور</div></div></div>
  </div>`;

  if(overCapacity){
    html += `<div class="alert-banner danger" style="margin-bottom:10px;"><span class="ic">⚠️</span><div><b>حجم شغل النهاردة (${valueMustFinish.toLocaleString('ar-EG')} ج.م) فوق طاقتك اليومية (${capacity.toLocaleString('ar-EG')} ج.م)</b>فكّر تستعين بحد يساعدك، أو تتواصل مع أصحاب الطلبات الأقل أولوية لتأجيل بسيط.</div></div>`;
  }

  // تقدير وقت الانتهاء التقريبي لكل عنصر بناءً على القيمة التراكمية مقابل الطاقة اليومية وساعات العمل
  let cumValue = 0;
  const estimates = queue.map(o=>{
    cumValue += orderTotal(o);
    return formatEstimatedTime(cumValue/capacity);
  });

  function queueLine(o, position, urgent, estTime, isFirst, isLast){
    const c = customerById(o.customerId);
    const accent = urgent ? 'var(--danger)' : 'var(--warn)';
    const tint = urgent ? 'var(--danger-light)' : 'var(--warn-light)';
    const pieces = orderPieceCount(o);
    return `<div class="card" style="margin-bottom:8px;border-right:5px solid ${accent};background:linear-gradient(90deg, ${tint} 0%, var(--card) 14%);">
      <div class="row">
        <h3 class="name-row"><span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:${accent};color:#fff;font-size:12.5px;font-weight:900;margin-left:6px;flex-shrink:0;">${position}</span>${avatarChip(c?c.name:'؟')}${c?escapeHtml(c.name):'عميل محذوف'} - ${escapeHtml(orderTypeLabel(o))}</h3>
        ${statusBadge(o)}
      </div>
      <div class="meta">📅 التسليم: ${fmtDate(o.dateDelivery)} — 🧵 ${pieces} قطعة — 🕐 المتوقع الانتهاء حوالي ${estTime}</div>
      <div class="btn-row" style="margin-top:8px;">
        <button class="btn sm accent" onclick="markOrderDelivered('${o.id}')">✅ تم الإنجاز</button>
        <button class="btn sm outline" ${isFirst?'disabled style="opacity:0.4;"':''} onclick="moveQueueItem('${o.id}', -1)">🔼</button>
        <button class="btn sm outline" ${isLast?'disabled style="opacity:0.4;"':''} onclick="moveQueueItem('${o.id}', 1)">🔽</button>
      </div>
    </div>`;
  }

  if(queue.length){
    html += `<div class="section-title" style="margin:0 0 8px;font-size:14px;">🔢 دور الشغل النهاردة (ابدأ برقم 1)</div>`;
    html += `<p class="meta" style="margin:0 0 8px;">تقدر تغيّر ترتيب أي طلب يدوياً بالسهمين 🔼🔽 لو عندك سبب تقدّمه، وتسجّله "تم الإنجاز" مباشرة من هنا.</p>`;
    html += queue.map((o,i)=>queueLine(o, i+1, mustFinishIds.has(o.id), estimates[i], i===0, i===queue.length-1)).join('');
  } else {
    html += `<div class="empty-msg" style="padding:14px 10px;">مفيش طلبات مستعجلة النهاردة 🎉</div>`;
  }

  if(waitingCount>0){
    html += `<div class="meta" style="text-align:center;margin-top:6px;">🟢 ${waitingCount} طلب لسه بدري عليه، مستني دوره</div>`;
  }

  box.innerHTML = html;
}

// نظرة سريعة على توزيع القطع المطلوبة على أيام الأسبوع الجاي (مش بس النهاردة)
function renderWeeklyOverview(){
  const box = document.getElementById('weeklyOverview');
  if(!box) return;
  const active = db.orders.filter(o=>o.status!=='تم التسليم');
  let html = '<div class="card"><div style="display:flex;overflow-x:auto;gap:8px;padding-bottom:2px;">';
  for(let i=0;i<7;i++){
    const d = new Date(Date.now()+i*86400000);
    const dStr = d.toISOString().slice(0,10);
    const dayOff = isDayOff(d);
    const pieces = active.filter(o=>o.dateDelivery===dStr).reduce((s,o)=>s+orderPieceCount(o), 0);
    const label = i===0 ? 'النهاردة' : WEEKDAY_NAMES_AR[d.getDay()];
    html += `<div style="flex:0 0 auto;min-width:76px;text-align:center;padding:9px 6px;border-radius:12px;background:${dayOff?'var(--border)':(pieces>0?'var(--warn-light)':'var(--card-alt)')};">
      <div style="font-size:11px;color:var(--muted);margin-bottom:4px;">${label}</div>
      ${dayOff
        ? '<div style="font-size:17px;">🌿</div>'
        : `<div style="font-size:17px;font-weight:900;color:${pieces>0?'var(--warn)':'var(--muted)'};">${pieces}</div><div style="font-size:10px;color:var(--muted);">قطعة</div>`
      }
    </div>`;
  }
  html += '</div></div>';
  box.innerHTML = html;
}

// سجل بسيط: هل اتنفذت الطلبات اللي كان معادها في آخر 7 أيام ولا اتأجلت؟
function renderCommitmentLog(){
  const box = document.getElementById('commitmentLog');
  if(!box) return;
  let rows = '';
  let anyDue = false;
  for(let i=1;i<=7;i++){
    const d = new Date(Date.now()-i*86400000);
    const dStr = d.toISOString().slice(0,10);
    const due = db.orders.filter(o=>o.dateDelivery===dStr);
    if(!due.length) continue;
    anyDue = true;
    const completed = due.filter(o=>o.status==='تم التسليم').length;
    const missed = due.length-completed;
    const label = `${WEEKDAY_NAMES_AR[d.getDay()]} ${fmtDate(dStr)}`;
    rows += `<div class="row" style="padding:7px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:13px;">${label}</span>
      <span style="font-size:13px;">${missed>0 ? `<b style="color:var(--danger);">${missed} اتأجل</b> من ${due.length}` : `<b style="color:var(--ok);">كله خلص ✅</b> (${due.length})`}</span>
    </div>`;
  }
  box.innerHTML = anyDue ? `<div class="card">${rows}</div>` : `<div class="empty-msg">لا توجد بيانات كافية بعد لعرض سجل الالتزام</div>`;
}

/* ============================================================
   ملخص نهاية الأسبوع: نظرة سريعة على أداء آخر 7 أيام
   ============================================================ */
function showWeeklySummary(){
  const sevenDaysAgo = new Date(Date.now()-6*86400000).toISOString().slice(0,10);
  const today = todayStr();

  const deliveredThisWeek = db.orders.filter(o=>o.status==='تم التسليم' && o.deliveredDate && o.deliveredDate>=sevenDaysAgo && o.deliveredDate<=today);
  const newOrdersThisWeek = db.orders.filter(o=>o.dateReceived && o.dateReceived>=sevenDaysAgo && o.dateReceived<=today);
  const collected = db.payments.filter(p=>p.date>=sevenDaysAgo && p.date<=today).reduce((s,p)=>s+Number(p.amount||0),0);
  const stillActive = db.orders.filter(o=>o.status!=='تم التسليم').length;
  const lateNow = db.orders.filter(isOverdue).length;
  const piecesDelivered = deliveredThisWeek.reduce((s,o)=>s+orderPieceCount(o),0);

  const msg =
`📋 ملخص أسبوع الورشة
${db.workshopName||'ورشة تفصيل الجلابيب'}
من ${sevenDaysAgo} إلى ${today}

✅ طلبات اتسلّمت: ${deliveredThisWeek.length} طلب (${piecesDelivered} قطعة)
🧵 طلبات جديدة دخلت: ${newOrdersThisWeek.length}
💰 المحصّل: ${collected.toLocaleString('ar-EG')} ج.م
⏳ لسه شغالين على: ${stillActive} طلب
${lateNow>0?`⚠️ متأخر حالياً: ${lateNow} طلب\n`:''}`;

  const html = `
    <div class="modal-head"><h3>📋 ملخص الأسبوع</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="card" style="white-space:pre-wrap;font-size:14px;line-height:1.9;">${escapeHtml(msg)}</div>
    <div class="btn-row" style="margin-top:12px;">
      <button class="btn" onclick='shareWeeklySummary(${JSON.stringify(msg)})'>📤 مشاركة عبر واتساب</button>
    </div>
  `;
  openModal(html);
}

function shareWeeklySummary(msg){
  if(navigator.share){
    navigator.share({title:'ملخص أسبوع الورشة', text:msg}).catch(()=>{});
    return;
  }
  openExternalLink(`https://wa.me/?text=${encodeURIComponent(msg)}`);
}

function renderGlobalSearch(){
  const q = document.getElementById('globalSearch').value.trim().toLowerCase();
  const wrap = document.getElementById('homeQuickActionsWrap');
  const resultsBox = document.getElementById('globalSearchResults');
  if(!q){
    resultsBox.innerHTML = '';
    wrap.style.display = '';
    return;
  }
  wrap.style.display = 'none';

  const matchedCustomers = db.customers.filter(c=>
    c.name.toLowerCase().includes(q) || (c.phone||'').includes(q)
  ).slice(0,8);

  const matchedOrders = db.orders.filter(o=>{
    const label = orderTypeLabel(o).toLowerCase();
    const c = customerById(o.customerId);
    return label.includes(q) || (c && c.name.toLowerCase().includes(q));
  }).slice(0,8);

  let html = '';

  if(matchedCustomers.length){
    html += `<div class="section-title" style="margin-top:6px;">👥 عملاء (${matchedCustomers.length})</div>`;
    html += matchedCustomers.map(c=>`
      <div class="card" onclick="showPage('customers');document.getElementById('custSearch').value='${escapeHtml(c.name).replace(/'/g,"\\'")}';renderCustomers();" style="cursor:pointer;">
        <h3 class="name-row">${avatarChip(c.name)}${escapeHtml(c.name)}</h3>
        <div class="meta">📞 ${escapeHtml(c.phone||'-')}</div>
      </div>
    `).join('');
  }

  if(matchedOrders.length){
    html += `<div class="section-title">📋 طلبات (${matchedOrders.length})</div>`;
    html += matchedOrders.map(o=>{
      const c = customerById(o.customerId);
      return `
      <div class="card" onclick="openOrderModal('${o.id}')" style="cursor:pointer;">
        <div class="row"><h3 class="name-row">${avatarChip(c?c.name:'؟')}${c?escapeHtml(c.name):'عميل محذوف'}</h3>${statusBadge(o)}</div>
        <div class="meta">👗 ${escapeHtml(orderTypeLabel(o))}</div>
      </div>`;
    }).join('');
  }

  if(!matchedCustomers.length && !matchedOrders.length){
    html = `<div class="empty-msg">لا توجد نتائج مطابقة لـ "${escapeHtml(document.getElementById('globalSearch').value.trim())}"</div>`;
  }

  resultsBox.innerHTML = html;
}

// يبني رسم بياني صغير (SVG) من مصفوفة أرقام — بيستخدم في بطاقات الإحصائيات
// لإظهار اتجاه آخر 7 أيام بنظرة واحدة من غير ما ياخد مساحة كبيرة
function sparklineSvg(values){
  if(!values || values.length<2) return '';
  const w=58, h=22, pad=2;
  const max = Math.max.apply(null, values);
  const min = Math.min.apply(null, values);
  const range = (max-min)||1;
  const step = (w-pad*2)/(values.length-1);
  const pts = values.map((v,i)=>{
    const x = pad + i*step;
    const y = h - pad - ((v-min)/range)*(h-pad*2);
    return x.toFixed(1)+','+y.toFixed(1);
  }).join(' ');
  const trendClass = values[values.length-1] > values[0] ? 'trend-up' : (values[values.length-1] < values[0] ? 'trend-down' : 'trend-flat');
  return `<svg class="spark ${trendClass}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="M${pts}"/></svg>`;
}

function renderHome(){
  renderUndoBar();
  renderHomeAlerts();
  renderPersonalAlerts();
  renderWeeklyOverview();
  renderTodayPlan();
  renderCommitmentLog();
  const totalOrders = db.orders.length;
  const inProgress = db.orders.filter(o=>o.status!=='تم التسليم').length;
  const today = todayStr();
  const revenueToday = db.payments.filter(p=>p.date===today).reduce((s,p)=>s+Number(p.amount||0),0);
  const totalRemaining = db.orders.reduce((s,o)=>s+orderRemaining(o),0);

  // بيانات آخر 7 أيام (طلبات مستلمة / إيراد يومي) عشان الرسم البياني الصغير في البطاقات
  const last7Days = [];
  for(let i=6;i>=0;i--){
    const d = new Date();
    d.setDate(d.getDate()-i);
    last7Days.push(d.toISOString().slice(0,10));
  }
  const ordersTrend = last7Days.map(d=> db.orders.filter(o=>o.dateReceived===d).length);
  const revenueTrend = last7Days.map(d=> db.payments.filter(p=>p.date===d).reduce((s,p)=>s+Number(p.amount||0),0));

  document.getElementById('homeStats').innerHTML = `
    <div class="stat-card"><div class="stat-ic">📋</div><div><div class="num">${totalOrders}</div><div class="lbl">عدد الطلبات</div></div>${sparklineSvg(ordersTrend)}</div>
    <div class="stat-card warn"><div class="stat-ic">🧵</div><div><div class="num">${inProgress}</div><div class="lbl">قيد العمل</div></div></div>
    <div class="stat-card"><div class="stat-ic">💰</div><div><div class="num">${revenueToday.toLocaleString('ar-EG')}</div><div class="lbl">إيراد اليوم (ج.م)</div></div>${sparklineSvg(revenueTrend)}</div>
    <div class="stat-card danger"><div class="stat-ic">⏳</div><div><div class="num">${totalRemaining.toLocaleString('ar-EG')}</div><div class="lbl">إجمالي المتبقي (ج.م)</div></div></div>
  `;

  const upcoming = db.orders.filter(o=>o.status!=='تم التسليم').sort((a,b)=>(a.dateDelivery||'').localeCompare(b.dateDelivery||'')).slice(0,5);
  document.getElementById('homeUpcoming').innerHTML = upcoming.length ? upcoming.map(o=>{
    const c = customerById(o.customerId);
    return `<div class="card">
      <div class="row">
        <h3 class="name-row">${avatarChip(c?c.name:'؟')}${c?escapeHtml(c.name):'عميل محذوف'} - ${escapeHtml(orderTypeLabel(o))}</h3>
        ${statusBadge(o)}
      </div>
      <div class="meta">📅 التسليم: ${fmtDate(o.dateDelivery)}</div>
      <div class="meta">💰 المتبقي: ${orderRemaining(o).toLocaleString('ar-EG')} ج.م</div>
    </div>`;
  }).join('') : `<div class="empty-msg">لا توجد طلبات قيد العمل حالياً 🎉</div>`;

  const late = db.orders.filter(isOverdue).sort((a,b)=>(a.dateDelivery||'').localeCompare(b.dateDelivery||''));
  document.getElementById('homeLate').innerHTML = late.length ? late.map(o=>{
    const c = customerById(o.customerId);
    return `<div class="card" style="border-right-color:var(--danger)">
      <div class="row">
        <h3 class="name-row">${avatarChip(c?c.name:'؟')}${c?escapeHtml(c.name):'عميل محذوف'} - ${escapeHtml(orderTypeLabel(o))}</h3>
        <span class="tag-late-text">متأخر ⏰</span>
      </div>
      <div class="meta">كان يجب التسليم في: ${fmtDate(o.dateDelivery)}</div>
    </div>`;
  }).join('') : `<div class="empty-msg">لا توجد طلبات متأخرة 👍</div>`;
}

function escapeHtml(s){
  if(s===undefined||s===null) return '';
  return String(s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// دائرة صغيرة بحرف اسم العميل، بتضاف قبل الاسم في قوائم العملاء والطلبات والمواعيد
function avatarChip(name, variant){
  const letter = (name||'؟').trim().charAt(0) || '؟';
  return `<span class="avatar${variant?' '+variant:''}">${escapeHtml(letter)}</span>`;
}

// فتح نافذة طباعة بشكل آمن — لو المتصفح منع النوافذ المنبثقة (بيحصل داخل بعض بيئات المعاينة)
// بيتم عمل تنزيل للملف بدل الكراش، والمستخدم يقدر يفتحه ويطبعه بنفسه.
// رأس صغير ببيانات الورشة يُستخدم أعلى كل ورقة مطبوعة (إيصال / بطاقة مقاسات / ملصق)
function printBrandHeaderHtml(){
  const name = db.workshopName||'ورشة تفصيل الجلابيب';
  const lines = [escapeHtml(name)];
  if(db.ownerName) lines.push(escapeHtml(db.ownerName));
  if(db.ownerPhone) lines.push('📞 '+escapeHtml(db.ownerPhone));
  if(db.workshopAddress) lines.push('📍 '+escapeHtml(db.workshopAddress));
  const logoHtml = db.workshopLogo?`<img src="${db.workshopLogo}" style="width:54px;height:54px;border-radius:50%;object-fit:cover;display:block;margin:0 auto 8px;border:2px solid #1F6D57;">`:'';
  return `<div style="text-align:center;margin-bottom:10px;">
    ${logoHtml}
    <div style="font-size:17px;font-weight:900;color:#1F6D57;">${lines[0]}</div>
    ${lines.slice(1).map(l=>`<div style="font-size:12px;color:#666;">${l}</div>`).join('')}
  </div><hr style="border:none;border-top:1px dashed #ccc;margin-bottom:10px;">`;
}

function openPrintWindow(html, filename){
  let win = null;
  try{ win = window.open('', '_blank'); }catch(e){ win = null; }
  if(win && win.document){
    try{
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(()=>{ try{ win.print(); }catch(e){} }, 300);
      return;
    }catch(e){ /* نكمل للحل البديل */ }
  }
  // الحل البديل: نزّل الصفحة كملف HTML يقدر يفتحه ويطبعه من المتصفح
  try{
    const blob = new Blob([html], {type:'text/html'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (filename||'طباعة')+'.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 60000);
    toast('النوافذ المنبثقة ممنوعة هنا، تم حفظ الملف بدلاً من ذلك — افتحه واطبعه من متصفحك');
  }catch(e){
    toast('تعذر فتح الطباعة. جرّب فتح التطبيق في متصفح مثل Chrome بدل نافذة المعاينة');
  }
}

/* ============================================================
   العملاء
   ============================================================ */
let vipOnlyFilter = false;
function toggleVipOnly(){
  vipOnlyFilter = !vipOnlyFilter;
  const btn = document.getElementById('vipFilterBtn');
  if(vipOnlyFilter){ btn.style.background='var(--accent)'; btn.style.color='#fff'; btn.style.borderColor='var(--accent)'; }
  else { btn.style.background=''; btn.style.color=''; btn.style.borderColor=''; }
  renderCustomers();
}

function renderCustomers(){
  const q = (document.getElementById('custSearch').value||'').trim();
  let list = db.customers.filter(c=> !q || c.name.includes(q) || (c.phone||'').includes(q) || (c.family||'').includes(q));
  const vipThreshold = Number(db.vipThreshold)||3;
  list = list.map(c=>({c, ordersCount: db.orders.filter(o=>o.customerId===c.id).length}))
    .sort((a,b)=>{
      const aVip = a.ordersCount>=vipThreshold, bVip = b.ordersCount>=vipThreshold;
      if(aVip!==bVip) return aVip? -1:1;
      return b.ordersCount-a.ordersCount;
    });
  if(vipOnlyFilter) list = list.filter(({ordersCount})=>ordersCount>=vipThreshold);
  const html = list.map(({c, ordersCount})=>{
    const isVip = ordersCount >= vipThreshold;
    return `<div class="card">
      <div class="row">
        <h3 class="name-row">${avatarChip(c.name, isVip?'accent':'')}${escapeHtml(c.name)} ${isVip?'<span class="badge" style="background:#fff3d6;color:#9a6b00;">⭐ VIP</span>':''}</h3>
        <span class="meta">${ordersCount} طلب</span>
      </div>
      <div class="meta">📞 ${escapeHtml(c.phone||'-')}</div>
      ${c.family?`<div class="meta" style="cursor:pointer;" onclick="document.getElementById('custSearch').value='${escapeHtml(c.family).replace(/'/g,"\\'")}'; renderCustomers();">👪 عائلة ${escapeHtml(c.family)} <span style="text-decoration:underline;">(عرض الكل)</span></div>`:''}
      <div class="meas-row">
        <span class="meas-chip m-length">📏 <span class="meas-lbl">الطول</span> ${c.length||'-'}</span>
        <span class="meas-chip m-sleeve">📏 <span class="meas-lbl">طول الكم</span> ${c.sleeve||'-'}</span>
        <span class="meas-chip m-chest">📏 <span class="meas-lbl">الصدر</span> ${c.chest||'-'}</span>
        <span class="meas-chip m-waist">📏 <span class="meas-lbl">الخزنة</span> ${c.waist||'-'}</span>
        <span class="meas-chip m-shoulder">📏 <span class="meas-lbl">وسع الكم</span> ${c.shoulder||'-'}</span>
      </div>
      ${c.notes?`<div class="meta">📝 ${escapeHtml(c.notes)}</div>`:''}
      ${c.updatedAt?`<div class="meta" style="opacity:.65;font-size:12px;">🕒 آخر تعديل: ${fmtActivityTime(c.updatedAt)}</div>`:''}
      <div class="btn-row">
        <button class="btn sm secondary" onclick="openCustomerModal('${c.id}')">✏️ تعديل</button>
        <button class="btn sm outline" onclick="openOrderModal(null,'${c.id}')">➕ طلب جديد</button>
        <button class="btn sm outline" onclick="printMeasurementCard('${c.id}')">🖨️ بطاقة المقاسات</button>
        <button class="btn sm accent" onclick="shareMeasurementCard('${c.id}')">📲 مشاركة واتساب</button>
        <button class="btn sm outline" onclick="openCustomerHistory('${c.id}')">📜 السجل</button>
        <button class="btn sm danger" onclick="deleteCustomer('${c.id}')">🗑️ حذف</button>
      </div>
    </div>`;
  }).join('');
  document.getElementById('customersList').innerHTML = html || (vipOnlyFilter ? `<div class="empty-msg">لا يوجد عملاء VIP حاليًا</div>` : `<div class="empty-msg">لا يوجد عملاء بعد. اضغط ➕ لإضافة عميل جديد</div>`);
}

function openCustomerHistory(id){
  const c = customerById(id);
  if(!c) return;
  const orders = db.orders.filter(o=>o.customerId===id).sort((a,b)=>(b.dateReceived||'').localeCompare(a.dateReceived||''));
  const totalSpent = orders.reduce((s,o)=>s+(Number(o.paid)||0),0);
  const totalRemaining = orders.reduce((s,o)=>s+orderRemaining(o),0);
  const delivered = orders.filter(o=>o.status==='تم التسليم' && o.deliveredDate);
  let avgDelay = null;
  if(delivered.length){
    const totalDelayDays = delivered.reduce((s,o)=>{
      const d = Math.round((new Date(o.deliveredDate)-new Date(o.dateDelivery))/86400000);
      return s + (d>0? d:0);
    },0);
    avgDelay = Math.round(totalDelayDays/delivered.length);
  }
  const ordersHtml = orders.length ? orders.map(o=>`
    <div class="card" style="margin-bottom:8px;">
      <div class="row"><h3>${escapeHtml(orderTypeLabel(o))}</h3>${statusBadge(o)}</div>
      <div class="meta">📅 استلام: ${fmtDate(o.dateReceived)} | تسليم: ${fmtDate(o.dateDelivery)}</div>
      <div class="meta">💰 الإجمالي: ${orderTotal(o).toLocaleString('ar-EG')} | المتبقي: ${orderRemaining(o).toLocaleString('ar-EG')} ج.م</div>
    </div>
  `).join('') : `<div class="empty-msg">لا توجد طلبات سابقة لهذا العميل</div>`;
  const html = `
    <div class="modal-head"><h3>📜 سجل ${escapeHtml(c.name)}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="grid-cards" style="grid-template-columns:1fr 1fr;">
      <div class="stat-card"><div class="stat-ic">📋</div><div><div class="num">${orders.length}</div><div class="lbl">إجمالي الطلبات</div></div></div>
      <div class="stat-card"><div class="stat-ic">💵</div><div><div class="num">${totalSpent.toLocaleString('ar-EG')}</div><div class="lbl">إجمالي المدفوع (ج.م)</div></div></div>
      <div class="stat-card ${totalRemaining>0?'danger':''}"><div class="stat-ic">⏳</div><div><div class="num">${totalRemaining.toLocaleString('ar-EG')}</div><div class="lbl">المتبقي الحالي (ج.م)</div></div></div>
      <div class="stat-card ${avgDelay>0?'warn':''}"><div class="stat-ic">⏱️</div><div><div class="num">${avgDelay===null?'-':avgDelay}</div><div class="lbl">متوسط أيام التأخير</div></div></div>
    </div>
    <div class="section-title">🧵 طلبات العميل</div>
    ${ordersHtml}
  `;
  openModal(html);
}

function openCustomerModal(id){
  const c = id ? customerById(id) : null;
  const familyNames = Array.from(new Set(db.customers.map(cc=>cc.family).filter(Boolean)));
  const html = `
    <div class="modal-head"><h3>${c?'✏️ تعديل عميل':'➕ عميل جديد'}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="field"><label>اسم العميل</label><input id="f_name" value="${c?escapeHtml(c.name):''}" placeholder="مثال: أحمد محمد"></div>
    <div class="field"><label>رقم الهاتف</label><input id="f_phone" value="${c?escapeHtml(c.phone||''):''}" placeholder="01xxxxxxxxx" inputmode="tel" maxlength="11" dir="ltr"></div>
    <div class="field"><label>👪 اسم العائلة (اختياري)</label><input id="f_family" list="familyList" value="${c?escapeHtml(c.family||''):''}" placeholder="مثال: عائلة الحاج محمد">
      <datalist id="familyList">${familyNames.map(f=>`<option value="${escapeHtml(f)}">`).join('')}</datalist>
    </div>
    <div class="field-row2">
      <div class="field m-length"><label>📏 الطول (سم)</label><input id="f_length" type="number" value="${c?c.length||'':''}"></div>
      <div class="field m-sleeve"><label>📏 طول الكم (سم)</label><input id="f_sleeve" type="number" value="${c?c.sleeve||'':''}"></div>
    </div>
    <div class="field-row2">
      <div class="field m-chest"><label>📏 الصدر (سم)</label><input id="f_chest" type="number" value="${c?c.chest||'':''}"></div>
      <div class="field m-waist"><label>📏 الخزنة (سم)</label><input id="f_waist" type="number" value="${c?c.waist||'':''}"></div>
    </div>
    <div class="field m-shoulder"><label>📏 وسع الكم (سم)</label><input id="f_shoulder" type="number" value="${c?c.shoulder||'':''}"></div>
    <div class="field"><label>ملاحظات (اختياري)</label><textarea id="f_notes" rows="2" placeholder="مثال: بيحب الجيب من الشمال...">${c?escapeHtml(c.notes||''):''}</textarea></div>
    <button class="btn" onclick="saveCustomer(${c?`'${c.id}'`:'null'})">💾 حفظ</button>
  `;
  openModal(html);
}

// بيتحقق إن رقم الهاتف رقم موبايل مصري صحيح (01 + كود شبكة 0/1/2/5 + 8 أرقام = 11 رقم)
// بيسمح بمسافات أو شرطات جوه الرقم وبيتجاهلها وقت التحقق
function isValidEgyptPhone(phone){
  const digits = phone.replace(/[\s\-]/g,'');
  return /^01[0125]\d{8}$/.test(digits);
}

async function saveCustomer(id){
  const name = document.getElementById('f_name').value.trim();
  if(!name){ toast('من فضلك أدخل اسم العميل'); return; }
  const phoneRaw = document.getElementById('f_phone').value.trim();
  if(phoneRaw && !isValidEgyptPhone(phoneRaw)){
    toast('رقم الهاتف غير صحيح، لازم يكون 11 رقم ويبدأ بـ 010 أو 011 أو 012 أو 015');
    document.getElementById('f_phone').focus();
    return;
  }
  const cleanPhone = phoneRaw.replace(/[\s\-]/g,'');
  if(cleanPhone){
    const dup = db.customers.find(c=>c.id!==id && c.phone===cleanPhone);
    if(dup){
      const ok = await appConfirm(`رقم الهاتف ده مسجل بالفعل للعميل "${dup.name}". هل تريد المتابعة؟`, {okText:'متابعة', danger:false});
      if(!ok) return;
    }
  }
  const data = {
    name,
    phone: cleanPhone,
    family: document.getElementById('f_family').value.trim(),
    chest: document.getElementById('f_chest').value,
    waist: document.getElementById('f_waist').value,
    length: document.getElementById('f_length').value,
    sleeve: document.getElementById('f_sleeve').value,
    shoulder: document.getElementById('f_shoulder').value,
    notes: document.getElementById('f_notes').value.trim(),
    updatedAt: Date.now(),
  };
  if(id){
    const c = customerById(id);
    const before = {...c};
    Object.assign(c, data);
    logActivity(`✏️ تعديل بيانات العميل ${name}`);
    setUndo('تعديل بيانات العميل', ()=>{
      Object.assign(c, before);
      saveDB();
      renderCustomers();
    });
  } else {
    data.id = uid();
    db.customers.push(data);
    logActivity(`➕ عميل جديد: ${name}`);
    setUndo('إضافة عميل جديد', ()=>{
      db.customers = db.customers.filter(x=>x.id!==data.id);
      saveDB();
      renderCustomers();
    });
  }
  saveDB();
  closeModal();
  renderCustomers();
  toast('تم الحفظ بنجاح ✅');
}

async function deleteCustomer(id){
  if(!await appConfirm('هل تريد حذف هذا العميل؟ سيتم الاحتفاظ بطلباته السابقة، ويمكنك استرجاعه خلال 7 أيام من سلة المحذوفات.')) return;
  const c = customerById(id);
  if(!c) return;
  db.customers = db.customers.filter(x=>x.id!==id);
  db.trash.push({id:uid(), type:'customer', deletedAt:todayStr(), data:c});
  logActivity(`🗑️ حذف عميل: ${c.name}`);
  saveDB();
  renderCustomers();
  toast('تم نقل العميل لسلة المحذوفات');
}

function printMeasurementCard(id){
  const c = customerById(id);
  if(!c) return;
  const html = `
    <html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>بطاقة مقاسات - ${escapeHtml(c.name)}</title>
    <style>
      body{font-family:Tahoma,Arial,sans-serif;padding:24px;color:#222;}
      h1{font-size:20px;border-bottom:2px solid #1F6D57;padding-bottom:8px;}
      table{width:100%;border-collapse:collapse;margin-top:14px;}
      td{padding:10px 6px;border-bottom:1px solid #ddd;font-size:15px;}
      td.lbl{color:#666;width:45%;}
      td.val{font-weight:bold;}
      tr.meas td.lbl{border-right:4px solid var(--rc,#1F6D57);padding-right:10px;}
      .notes{margin-top:16px;padding:10px;background:#f5f3ef;border-radius:8px;font-size:14px;}
    </style></head><body>
      ${printBrandHeaderHtml()}
      <h1>🧵 بطاقة مقاسات - ${escapeHtml(c.name)}</h1>
      <table>
        <tr><td class="lbl">اسم العميل</td><td class="val">${escapeHtml(c.name)}</td></tr>
        <tr><td class="lbl">رقم الهاتف</td><td class="val">${escapeHtml(c.phone||'-')}</td></tr>
        <tr class="meas" style="--rc:#1F6D57"><td class="lbl">الطول</td><td class="val">${c.length||'-'} سم</td></tr>
        <tr class="meas" style="--rc:#8F6626"><td class="lbl">طول الكم</td><td class="val">${c.sleeve||'-'} سم</td></tr>
        <tr class="meas" style="--rc:#2F5673"><td class="lbl">الصدر</td><td class="val">${c.chest||'-'} سم</td></tr>
        <tr class="meas" style="--rc:#93691C"><td class="lbl">الخزنة</td><td class="val">${c.waist||'-'} سم</td></tr>
        <tr class="meas" style="--rc:#A23B2C"><td class="lbl">وسع الكم</td><td class="val">${c.shoulder||'-'} سم</td></tr>
      </table>
      ${c.notes?`<div class="notes">📝 ملاحظات: ${escapeHtml(c.notes)}</div>`:''}
    </body></html>
  `;
  openPrintWindow(html, 'بطاقة_مقاسات_'+c.name);
}

function shareMeasurementCard(id){
  const c = customerById(id);
  if(!c) return;
  const msg =
`📏 بطاقة مقاسات - ${c.name}
${db.workshopName||'ورشة تفصيل الجلابيب'}

الطول: ${c.length||'-'} سم
طول الكم: ${c.sleeve||'-'} سم
الصدر: ${c.chest||'-'} سم
الخزنة: ${c.waist||'-'} سم
وسع الكم: ${c.shoulder||'-'} سم
${c.notes?'\nملاحظات: '+c.notes:''}`;

  if(navigator.share){
    navigator.share({title:'بطاقة مقاسات '+c.name, text:msg}).catch(()=>{});
    return;
  }
  let phone = (c.phone||'').replace(/[^0-9]/g,'');
  if(phone){
    if(phone.startsWith('0')) phone = '2'+phone; // مصر
    openWhatsAppChat(phone, msg);
  } else {
    openExternalLink(`https://wa.me/?text=${encodeURIComponent(msg)}`);
  }
}

/* ============================================================
   الطلبات
   ============================================================ */
function setOrderFilter(f){
  currentOrderFilter = f;
  document.querySelectorAll('[id^="filt-"]').forEach(b=>b.classList.remove('active'));
  const btn = document.getElementById('filt-'+f);
  if(btn){ btn.style.background='var(--primary)'; btn.style.color='#fff'; }
  document.querySelectorAll('[id^="filt-"]').forEach(b=>{
    if(b.id!=='filt-'+f){ b.style.background=''; b.style.color=''; }
  });
  renderOrders();
}

function renderOrders(){
  const q = (document.getElementById('orderSearch').value||'').trim();
  const dateFrom = document.getElementById('orderDateFrom').value;
  const dateTo = document.getElementById('orderDateTo').value;
  let list = db.orders.slice().sort((a,b)=>(b.dateReceived||'').localeCompare(a.dateReceived||''));
  if(currentOrderFilter!=='all'){
    list = list.filter(o=>o.status===currentOrderFilter);
  }
  if(q){
    list = list.filter(o=>{
      const c = customerById(o.customerId);
      return (c && c.name.includes(q)) || orderTypeLabel(o).includes(q);
    });
  }
  if(dateFrom) list = list.filter(o=> o.dateReceived && o.dateReceived>=dateFrom);
  if(dateTo) list = list.filter(o=> o.dateReceived && o.dateReceived<=dateTo);

  const summaryBox = document.getElementById('orderDateFilterSummary');
  if(dateFrom || dateTo){
    const totalInRange = list.reduce((s,o)=>s+orderTotal(o),0);
    summaryBox.textContent = `${list.length} طلب في الفترة المحددة — بإجمالي ${totalInRange.toLocaleString('ar-EG')} ج.م`;
  } else {
    summaryBox.textContent = '';
  }

  const html = list.map(o=>{
    const c = customerById(o.customerId);
    return `<div class="card" data-status="${escapeHtml(o.status||'')}">
      <div class="row">
        <h3 class="name-row">${avatarChip(c?c.name:'؟')}${c?escapeHtml(c.name):'عميل محذوف'}</h3>
        ${statusBadge(o)}
      </div>
      <div class="meta">👗 النوع: ${escapeHtml(orderTypeLabel(o))}</div>
      <div class="meta">📅 الاستلام: ${fmtDate(o.dateReceived)} | التسليم: ${fmtDate(o.dateDelivery)}</div>
      <div class="meta">💰 الإجمالي: ${orderTotal(o).toLocaleString('ar-EG')} ج.م | المدفوع: ${(Number(o.paid)||0).toLocaleString('ar-EG')} | المتبقي: <b style="color:${orderRemaining(o)>0?'var(--danger)':'var(--ok)'}">${orderRemaining(o).toLocaleString('ar-EG')}</b></div>
      <div class="meta">⏱️ وقت الشغل الفعلي: ${o.workStartedAt ? `<b style="color:var(--accent);">جاري التسجيل الآن...</b>` : (o.actualMinutes?formatMinutesLabel(o.actualMinutes):'لم يبدأ بعد')}</div>
      ${o.updatedAt?`<div class="meta" style="opacity:.65;font-size:12px;">🕒 آخر تعديل: ${fmtActivityTime(o.updatedAt)}</div>`:''}
      <div class="btn-row">
        <button class="btn sm secondary" onclick="openOrderModal('${o.id}')">✏️ تعديل</button>
        <button class="btn sm outline" onclick="openPaymentModal('${o.id}')">💵 تسجيل دفعة</button>
        ${o.status!=='تم التسليم' ? (o.workStartedAt
          ? `<button class="btn sm accent" onclick="stopOrderWork('${o.id}')">⏹️ إنهاء الشغل</button>`
          : `<button class="btn sm outline" onclick="startOrderWork('${o.id}')">▶️ بدء الشغل</button>`) : ''}
        <button class="btn sm accent" onclick="sendWhatsApp('${o.id}')">📲 فاتورة واتساب</button>
        <button class="btn sm outline" onclick="printReceipt('${o.id}')">🖨️ إيصال</button>
        <button class="btn sm danger" onclick="deleteOrder('${o.id}')">🗑️ حذف</button>
      </div>
    </div>`;
  }).join('');
  document.getElementById('ordersList').innerHTML = html || `<div class="empty-msg">لا توجد طلبات مطابقة. اضغط ➕ لإضافة طلب جديد</div>`;
  renderOrdersKanban();
}

const ORDER_KANBAN_STATUSES = ['قيد العمل', 'جاهز للتسليم', 'تم التسليم'];

// تبديل عرض صفحة الطلبات بين القائمة والكانبان
function setOrdersView(view){
  currentOrdersView = view;
  const listBox = document.getElementById('ordersList');
  const kanbanBox = document.getElementById('ordersKanban');
  const listBtn = document.getElementById('ordersViewListBtn');
  const kanbanBtn = document.getElementById('ordersViewKanbanBtn');
  if(listBox) listBox.style.display = view==='kanban' ? 'none' : '';
  if(kanbanBox) kanbanBox.style.display = view==='kanban' ? '' : 'none';
  if(listBtn) listBtn.classList.toggle('active', view==='list');
  if(kanbanBtn) kanbanBtn.classList.toggle('active', view==='kanban');
  if(view==='kanban') renderOrdersKanban();
}

function renderOrdersKanban(){
  const box = document.getElementById('ordersKanban');
  if(!box) return;
  if(currentOrdersView!=='kanban'){ return; } // مفيش داعي نرسم الكانبان لو مش ظاهر

  const q = (document.getElementById('orderSearch').value||'').trim();
  const dateFrom = document.getElementById('orderDateFrom').value;
  const dateTo = document.getElementById('orderDateTo').value;
  let list = db.orders.slice().sort((a,b)=>(b.dateReceived||'').localeCompare(a.dateReceived||''));
  if(q){
    list = list.filter(o=>{
      const c = customerById(o.customerId);
      return (c && c.name.includes(q)) || orderTypeLabel(o).includes(q);
    });
  }
  if(dateFrom) list = list.filter(o=> o.dateReceived && o.dateReceived>=dateFrom);
  if(dateTo) list = list.filter(o=> o.dateReceived && o.dateReceived<=dateTo);

  box.innerHTML = `<div class="kanban-wrap">${ORDER_KANBAN_STATUSES.map(status=>{
    const colOrders = list.filter(o=>o.status===status);
    const cards = colOrders.map(o=>{
      const c = customerById(o.customerId);
      return `<div class="kanban-card" draggable="true" ondragstart="kanbanDragStart(event,'${o.id}')" ondragend="kanbanDragEnd(event)">
        <div class="name-row">${avatarChip(c?c.name:'؟')}${c?escapeHtml(c.name):'عميل محذوف'}</div>
        <div class="meta">👗 ${escapeHtml(orderTypeLabel(o))}</div>
        <div class="meta">📅 التسليم: ${fmtDate(o.dateDelivery)}</div>
        <div class="meta">💰 المتبقي: <b style="color:${orderRemaining(o)>0?'var(--danger)':'var(--ok)'}">${orderRemaining(o).toLocaleString('ar-EG')}</b></div>
        <div class="btn-row">
          <button class="btn sm secondary" onclick="openOrderModal('${o.id}')">✏️ تعديل</button>
          ${ORDER_KANBAN_STATUSES.filter(s=>s!==status).map(s=>`<button class="btn sm outline" onclick="changeOrderStatus('${o.id}','${s}')">➡️ ${s}</button>`).join('')}
        </div>
      </div>`;
    }).join('');
    return `<div class="kanban-col" data-status="${status}" ondragover="kanbanDragOver(event)" ondragleave="kanbanDragLeave(event)" ondrop="kanbanDrop(event,'${status}')">
      <div class="kanban-col-head"><span>${status}</span><span class="cnt">${colOrders.length}</span></div>
      ${cards || `<div class="kanban-empty-col">لا توجد طلبات</div>`}
    </div>`;
  }).join('')}</div>`;
}

let kanbanDraggedOrderId = null;
function kanbanDragStart(ev, orderId){
  kanbanDraggedOrderId = orderId;
  ev.target.classList.add('dragging');
  if(ev.dataTransfer) ev.dataTransfer.setData('text/plain', orderId);
}
function kanbanDragEnd(ev){
  ev.target.classList.remove('dragging');
  kanbanDraggedOrderId = null;
}
function kanbanDragOver(ev){
  ev.preventDefault();
  ev.currentTarget.classList.add('drag-over');
}
function kanbanDragLeave(ev){
  ev.currentTarget.classList.remove('drag-over');
}
function kanbanDrop(ev, status){
  ev.preventDefault();
  ev.currentTarget.classList.remove('drag-over');
  const orderId = kanbanDraggedOrderId || (ev.dataTransfer && ev.dataTransfer.getData('text/plain'));
  if(orderId) changeOrderStatus(orderId, status);
}

// تغيير حالة الطلب (مستخدمة في الكانبان)
function changeOrderStatus(orderId, newStatus){
  const o = db.orders.find(x=>x.id===orderId);
  if(!o || o.status===newStatus) return;
  if(newStatus==='تم التسليم'){
    markOrderDelivered(orderId);
    renderOrders();
    return;
  }
  const before = {status:o.status, deliveredDate:o.deliveredDate};
  o.status = newStatus;
  o.updatedAt = Date.now();
  logActivity(`🔄 تغيير حالة طلب ${customerById(o.customerId)?customerById(o.customerId).name:''} إلى "${newStatus}"`);
  setUndo('تغيير حالة الطلب', ()=>{
    o.status = before.status;
    o.deliveredDate = before.deliveredDate;
    saveDB();
    renderOrders();
  });
  saveDB();
  renderOrders();
  toast('تم تحديث الحالة ✅');
}

function customerOptions(selectedId){
  if(db.customers.length===0) return '<option value="">لا يوجد عملاء - أضف عميل أولاً</option>';
  return db.customers.map(c=>`<option value="${c.id}" ${c.id===selectedId?'selected':''}>${escapeHtml(c.name)}</option>`).join('');
}

function garmentTypeOptionsHtml(matchedId){
  return itemTypeOptionsHtml(matchedId);
}

let currentEditingOrderId = null;
let dateManuallyEdited = false;

function itemTypeOptionsHtml(matchedId){
  let opts = '<option value="">اختر النوع...</option>';
  db.garmentTypes.slice().sort((a,b)=>a.name.localeCompare(b.name,'ar')).forEach(g=>{
    opts += `<option value="${g.id}" data-price="${g.price}" ${g.id===matchedId?'selected':''}>${escapeHtml(g.name)} — ${Number(g.price).toLocaleString('ar-EG')} ج.م</option>`;
  });
  opts += `<option value="__custom__" ${matchedId==='__custom__'?'selected':''}>نوع آخر (كتابة يدوي)</option>`;
  return opts;
}

function itemRowHtml(item){
  item = item || {};
  const qty = item.qty || 1;
  const unitPrice = item.unitPrice!==undefined ? item.unitPrice : '';
  let matchedId = '';
  if(item.type){
    const found = db.garmentTypes.find(g=>g.name===item.type);
    matchedId = found ? found.id : '__custom__';
  }
  return `
    <div class="card item-row" style="margin-bottom:8px;padding:12px;">
      <div class="field"><label>النوع</label>
        <select class="it-type" onchange="onItemTypeChange(this)">${itemTypeOptionsHtml(matchedId)}</select>
      </div>
      <div class="field it-customWrap" style="display:${matchedId==='__custom__'?'block':'none'};margin-bottom:12px;">
        <label>اكتب النوع يدوياً</label><input class="it-custom" value="${matchedId==='__custom__'?escapeHtml(item.type||''):''}">
      </div>
      <div class="field-row2">
        <div class="field"><label>عدد القطع</label><input class="it-qty" type="number" min="1" step="1" value="${qty}" oninput="onItemQtyPriceInput()"></div>
        <div class="field"><label>سعر القطعة (ج.م)</label><input class="it-price" type="number" value="${unitPrice}" oninput="onItemQtyPriceInput()"></div>
      </div>
      <button type="button" class="btn sm danger" onclick="removeItemRow(this)">🗑️ حذف هذا الصنف</button>
    </div>
  `;
}

function addItemRow(item){
  document.getElementById('itemsContainer').insertAdjacentHTML('beforeend', itemRowHtml(item));
}

function removeItemRow(btn){
  const rows = document.querySelectorAll('#itemsContainer .item-row');
  if(rows.length<=1){ toast('لازم يفضل صنف واحد على الأقل'); return; }
  btn.closest('.item-row').remove();
  recalcItemsTotal();
}

function onItemTypeChange(sel){
  const row = sel.closest('.item-row');
  const wrap = row.querySelector('.it-customWrap');
  if(sel.value==='__custom__'){
    wrap.style.display='block';
  } else {
    wrap.style.display='none';
    const opt = sel.options[sel.selectedIndex];
    const price = opt ? opt.getAttribute('data-price') : null;
    if(price!==null){ row.querySelector('.it-price').value = price; }
  }
  recalcItemsTotal();
}

function onItemQtyPriceInput(){
  recalcItemsTotal();
}

// تبديل تسمية حقل قيمة الخصم حسب نوعه (نسبة % أو مبلغ ثابت)
// إظهار/إخفاء حقل نسبة رسوم الاستعجال حسب حالة checkbox "طلب مستعجل"
function onUrgentToggle(){
  const checked = document.getElementById('f_urgent').checked;
  const wrap = document.getElementById('urgentFeeFieldWrap');
  if(wrap) wrap.style.display = checked ? 'block' : 'none';
  recalcItemsTotal();
}

function onDiscountTypeChange(){
  const type = document.getElementById('f_discountType').value;
  const lbl = document.getElementById('f_discountValueLabel');
  if(lbl) lbl.textContent = type==='percent' ? 'قيمة الخصم (%)' : 'قيمة الخصم (ج.م)';
  recalcItemsTotal();
}

// إعادة حساب إجمالي أجرة كل الأصناف داخل الطلب، مع الخصم والضريبة والإجمالي النهائي
function recalcItemsTotal(){
  let sum = 0;
  document.querySelectorAll('#itemsContainer .item-row').forEach(row=>{
    const qty = Math.max(1, Number(row.querySelector('.it-qty').value)||1);
    const price = Number(row.querySelector('.it-price').value)||0;
    sum += qty*price;
  });
  const feeField = document.getElementById('f_feeTotal');
  if(feeField) feeField.textContent = sum.toLocaleString('ar-EG')+' ج.م';

  const extraEl = document.getElementById('f_extra');
  const extra = extraEl ? (Number(extraEl.value)||0) : 0;

  const urgentEl = document.getElementById('f_urgent');
  const urgentFeePctEl = document.getElementById('f_urgentFeePercent');
  const isUrgent = urgentEl ? urgentEl.checked : false;
  const urgentFeeAmount = isUrgent ? sum * (Math.max(0, Number(urgentFeePctEl && urgentFeePctEl.value)||0))/100 : 0;

  const subtotal = sum + extra + urgentFeeAmount;

  const urgentFeeRow = document.getElementById('sumUrgentFeeRow');
  if(urgentFeeRow) urgentFeeRow.style.display = urgentFeeAmount>0 ? '' : 'none';

  const discTypeEl = document.getElementById('f_discountType');
  const discValEl = document.getElementById('f_discountValue');
  const taxPctEl = document.getElementById('f_taxPercent');
  if(discTypeEl && discValEl && taxPctEl){
    const discType = discTypeEl.value;
    const discVal = Math.max(0, Number(discValEl.value)||0);
    let discountAmount = 0;
    if(discType==='percent') discountAmount = Math.min(subtotal, subtotal*discVal/100);
    else if(discType==='amount') discountAmount = Math.min(subtotal, discVal);
    const afterDiscount = subtotal - discountAmount;
    const taxPct = Math.max(0, Number(taxPctEl.value)||0);
    const taxAmount = afterDiscount * taxPct/100;
    const final = Math.max(0, afterDiscount + taxAmount);

    const set = (id, val)=>{ const el=document.getElementById(id); if(el) el.textContent = Math.round(val).toLocaleString('ar-EG')+' ج.م'; };
    set('sumSubtotal', subtotal);
    set('sumUrgentFee', urgentFeeAmount);
    set('sumDiscount', discountAmount);
    set('sumTax', taxAmount);
    set('sumFinal', final);
  }

  autoSuggestDate(false);
  return sum;
}

function openOrderModal(id, presetCustomerId){
  const o = id ? db.orders.find(x=>x.id===id) : null;
  currentEditingOrderId = o ? o.id : null;
  dateManuallyEdited = !!o; // في التعديل لا نعيد الاقتراح تلقائياً فوق موعد محفوظ

  // بناء قائمة الأصناف: من مصفوفة items الجديدة، أو من الحقول القديمة (توافقاً مع الطلبات السابقة)
  let items = [];
  if(o){
    if(Array.isArray(o.items) && o.items.length){
      items = o.items;
    } else {
      items = [{type:o.type||'', qty:o.qty||1, unitPrice:(o.unitPrice!==undefined?o.unitPrice:o.fee)||0}];
    }
  }

  const html = `
    <div class="modal-head"><h3>${o?'✏️ تعديل طلب':'➕ طلب جديد'}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="field"><label>العميل</label><select id="f_customer" onchange="renderOrderCustomerMeasurements();maybeApplyVipDiscount();">${customerOptions(o?o.customerId:presetCustomerId)}</select></div>
    <div id="orderCustomerMeasurements" style="margin:-6px 0 12px;"></div>
    <div class="section-title" style="margin:6px 0 8px;font-size:14.5px;">👗 أصناف الطلب</div>
    <div id="itemsContainer">${items.map(it=>itemRowHtml(it)).join('') || itemRowHtml()}</div>
    <button type="button" class="btn sm secondary" style="margin-bottom:14px;" onclick="addItemRow()">➕ إضافة صنف آخر</button>
    <div class="field-row2">
      <div class="field"><label>تاريخ الاستلام</label><input id="f_dateReceived" type="date" value="${o?o.dateReceived:todayStr()}"></div>
      <div class="field"><label>تاريخ التسليم</label><input id="f_dateDelivery" type="date" value="${o?o.dateDelivery:''}" onchange="dateManuallyEdited=true;checkDeliveryDateWarning();"></div>
      <div id="f_dateDeliveryWarn" class="meta" style="color:var(--danger);margin-top:-8px;"></div>
    </div>
    <div class="btn-row" style="margin-top:-4px;margin-bottom:10px;">
      <button type="button" class="btn sm outline" onclick="autoSuggestDate(true)">📅 اقتراح موعد تلقائي</button>
    </div>
    <div class="field-row2">
      <div class="field"><label>مصاريف إضافية (ج.م)</label><input id="f_extra" type="number" value="${o?o.extra||0:0}" oninput="recalcItemsTotal()"></div>
      <div class="field"><label>إجمالي أجرة الأصناف</label><div style="padding:11px 0;font-weight:900;color:var(--heading);font-size:16px;" id="f_feeTotal">0 ج.م</div></div>
    </div>
    <div class="section-title" style="margin:6px 0 8px;font-size:14.5px;">💵 خصم وضريبة (اختياري)</div>
    <div class="field-row2">
      <div class="field"><label>نوع الخصم</label>
        <select id="f_discountType" onchange="onDiscountTypeChange()">
          <option value="none" ${(!o||!o.discountType||o.discountType==='none')?'selected':''}>بدون خصم</option>
          <option value="percent" ${o&&o.discountType==='percent'?'selected':''}>نسبة %</option>
          <option value="amount" ${o&&o.discountType==='amount'?'selected':''}>مبلغ ثابت (ج.م)</option>
        </select>
      </div>
      <div class="field"><label id="f_discountValueLabel">قيمة الخصم</label><input id="f_discountValue" type="number" min="0" value="${o&&o.discountValue?o.discountValue:0}" oninput="recalcItemsTotal()"></div>
    </div>
    <div id="vipDiscountBadge" class="meta" style="display:none;color:#9a6b00;margin:-6px 0 6px;">⭐ العميل ده VIP — تم اقتراح خصم تلقائي، وتقدر تغيّره أو تلغيه من فوق</div>
    <div class="field"><label>نسبة ضريبة/رسوم إضافية على هذا الطلب (%)</label><input id="f_taxPercent" type="number" min="0" step="0.1" value="${o?(o.taxPercent!==undefined?o.taxPercent:0):(db.taxDefaultPercent||0)}" oninput="recalcItemsTotal()"></div>
    <div class="field"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input id="f_urgent" type="checkbox" style="width:18px;height:18px;" ${o&&o.urgent?'checked':''} onchange="onUrgentToggle()"> 🔥 طلب مستعجل</label></div>
    <div class="field" id="urgentFeeFieldWrap" style="display:${o&&o.urgent?'block':'none'};">
      <label>نسبة رسوم الاستعجال (%)</label>
      <input id="f_urgentFeePercent" type="number" min="0" step="0.1" value="${o&&o.urgentFeePercent!==undefined?o.urgentFeePercent:(db.urgentFeeDefaultPercent||0)}" oninput="recalcItemsTotal()">
    </div>
    <div class="card" id="orderTotalsBox" style="margin:4px 0 14px;padding:12px;background:var(--card-alt);">
      <div class="row"><span class="meta">الإجمالي الفرعي</span><b id="sumSubtotal">0 ج.م</b></div>
      <div class="row" id="sumUrgentFeeRow" style="display:none;"><span class="meta">🔥 رسوم الاستعجال</span><b id="sumUrgentFee">0 ج.م</b></div>
      <div class="row"><span class="meta">الخصم</span><b id="sumDiscount" style="color:var(--danger);">0 ج.م</b></div>
      <div class="row"><span class="meta">الضريبة/الرسوم</span><b id="sumTax">0 ج.م</b></div>
      <div class="row" style="border-top:1px dashed var(--stitch);margin-top:6px;padding-top:6px;"><span style="font-weight:700;">الإجمالي النهائي</span><b style="color:var(--heading);font-size:16px;" id="sumFinal">0 ج.م</b></div>
    </div>
    <div class="field"><label>تكلفة الخامة/القماش (ج.م) <span class="meta">— اختياري، لحساب صافي الربح</span></label><input id="f_materialCost" type="number" value="${o?o.materialCost||0:0}"></div>
    <div class="field"><label>المدفوع مقدماً (ج.م)</label><input id="f_paid" type="number" value="${o?o.paid||0:0}" ${o?'disabled':''}></div>
    ${o?'<p class="meta">لتسجيل دفعة جديدة استخدم زر "تسجيل دفعة" من قائمة الطلبات.</p>':''}
    <div class="field"><label>الحالة</label>
      <select id="f_status">
        <option value="قيد العمل" ${o&&o.status==='قيد العمل'?'selected':''}>قيد العمل</option>
        <option value="جاهز للتسليم" ${o&&o.status==='جاهز للتسليم'?'selected':''}>جاهز للتسليم</option>
        <option value="تم التسليم" ${o&&o.status==='تم التسليم'?'selected':''}>تم التسليم</option>
      </select>
    </div>
    <button class="btn" onclick="saveOrder(${o?`'${o.id}'`:'null'})">💾 حفظ</button>
  `;
  openModal(html);
  onDiscountTypeChange();
  checkDeliveryDateWarning();
  renderOrderCustomerMeasurements();
  maybeApplyVipDiscount();
}

// يعرض مقاسات العميل المختار كمرجع سريع أثناء إنشاء/تعديل الطلب، بدون الحاجة للرجوع لملفه
function renderOrderCustomerMeasurements(){
  const box = document.getElementById('orderCustomerMeasurements');
  if(!box) return;
  const sel = document.getElementById('f_customer');
  const cid = sel ? sel.value : '';
  const c = cid ? customerById(cid) : null;
  if(!c){ box.innerHTML=''; return; }
  const hasAny = c.length||c.sleeve||c.chest||c.waist||c.shoulder;
  if(!hasAny){
    box.innerHTML = `<div class="meta">📏 لا توجد مقاسات محفوظة لهذا العميل — <a href="javascript:void(0)" onclick="closeModal();openCustomerModal('${c.id}');" style="color:var(--primary);font-weight:600;">أضفها من ملفه</a></div>`;
    return;
  }
  box.innerHTML = `<div class="meas-chips-row" style="display:flex;flex-wrap:wrap;gap:6px;">
    <span class="meas-chip m-length">📏 <span class="meas-lbl">الطول</span> ${c.length||'-'}</span>
    <span class="meas-chip m-sleeve">📏 <span class="meas-lbl">طول الكم</span> ${c.sleeve||'-'}</span>
    <span class="meas-chip m-chest">📏 <span class="meas-lbl">الصدر</span> ${c.chest||'-'}</span>
    <span class="meas-chip m-waist">📏 <span class="meas-lbl">الخزنة</span> ${c.waist||'-'}</span>
    <span class="meas-chip m-shoulder">📏 <span class="meas-lbl">وسع الكم</span> ${c.shoulder||'-'}</span>
  </div>`;
}

// حساب قيمة الشغل المتبقي (غير المسلَّم) بالجنيه، باستثناء الطلب الجاري تعديله
function calcPendingWorkValue(excludeId){
  return db.orders
    .filter(o=>o.status!=='تم التسليم' && o.id!==excludeId)
    .reduce((s,o)=>s+orderTotal(o),0);
}

// متوسط أيام التأخير الفعلي عن الموعد المتوقع، بناءً على آخر الطلبات المسلَّمة فعلياً
function avgDelayDays(){
  const completed = db.orders.filter(o=>o.deliveredDate && o.dateDelivery).slice(-30);
  if(completed.length===0) return 0;
  const totalDelay = completed.reduce((s,o)=>{
    const diff = Math.round((new Date(o.deliveredDate)-new Date(o.dateDelivery))/86400000);
    return s+diff;
  },0);
  return totalDelay/completed.length;
}

// force=true يعني ضغط المستخدم على زر الاقتراح صراحةً (يتجاوز قفل التعديل اليدوي)
function autoSuggestDate(force){
  if(dateManuallyEdited && !force) return;
  let itemsSum = 0;
  document.querySelectorAll('#itemsContainer .item-row').forEach(row=>{
    const qty = Math.max(1, Number(row.querySelector('.it-qty').value)||1);
    const price = Number(row.querySelector('.it-price').value)||0;
    itemsSum += qty*price;
  });
  const extra = Number(document.getElementById('f_extra').value)||0;
  const capacity = Number(db.dailyCapacity)||500;
  const pending = calcPendingWorkValue(currentEditingOrderId) + itemsSum + extra;
  const daysNeeded = Math.max(1, Math.ceil(pending/capacity));
  const avgDelay = avgDelayDays();
  const safetyDays = avgDelay>0.5 ? 2+Math.ceil(avgDelay) : 2;
  const totalDays = daysNeeded + safetyDays;
  const suggested = addWorkDaysFromNow(totalDays);
  const suggestedStr = suggested.toISOString().slice(0,10);
  document.getElementById('f_dateDelivery').value = suggestedStr;
  dateManuallyEdited = !force ? dateManuallyEdited : false;
  checkDeliveryDateWarning();
  if(force) toast('تم اقتراح موعد تسليم مناسب 📅');
}

// يظهر تنبيه فوري تحت حقل تاريخ التسليم لو الموعد المختار يصادف عيد أو يوم الإجازة الأسبوعية
function checkDeliveryDateWarning(){
  const field = document.getElementById('f_dateDelivery');
  const warnBox = document.getElementById('f_dateDeliveryWarn');
  if(!field || !warnBox) return;
  const val = field.value;
  if(val && isDayOff(val)){
    warnBox.textContent = `⚠️ الموعد ده يصادف ${dayOffLabel(val)} (يوم إجازة)`;
  } else {
    warnBox.textContent = '';
  }
}

function saveOrder(id){
  const customerId = document.getElementById('f_customer').value;

  const items = [];
  let hasInvalidPrice = false;
  document.querySelectorAll('#itemsContainer .item-row').forEach(row=>{
    const typeSel = row.querySelector('.it-type');
    let type = '';
    if(typeSel.value==='__custom__'){
      type = row.querySelector('.it-custom').value.trim();
    } else {
      const g = db.garmentTypes.find(x=>x.id===typeSel.value);
      type = g ? g.name : '';
    }
    const qtyRaw = Number(row.querySelector('.it-qty').value);
    const qty = Math.max(1, qtyRaw||1);
    const priceRaw = Number(row.querySelector('.it-price').value);
    if(priceRaw<0){ hasInvalidPrice = true; }
    const unitPrice = Math.max(0, priceRaw||0);
    if(type){ items.push({type, qty, unitPrice}); }
  });

  const dateReceived = document.getElementById('f_dateReceived').value;
  const dateDelivery = document.getElementById('f_dateDelivery').value;
  const extra = Number(document.getElementById('f_extra').value)||0;
  const materialCost = Number(document.getElementById('f_materialCost').value)||0;
  const urgent = document.getElementById('f_urgent').checked;
  const urgentFeePercentEl = document.getElementById('f_urgentFeePercent');
  const urgentFeePercent = Math.max(0, Number(urgentFeePercentEl && urgentFeePercentEl.value)||0);
  const status = document.getElementById('f_status').value;
  const fee = items.reduce((s,it)=>s+it.qty*it.unitPrice,0);
  const discountType = document.getElementById('f_discountType').value;
  const discountValue = Math.max(0, Number(document.getElementById('f_discountValue').value)||0);
  const taxPercent = Math.max(0, Number(document.getElementById('f_taxPercent').value)||0);

  if(!customerId){ toast('اختر عميل أولاً'); return; }
  if(items.length===0){ toast('أضف صنف واحد على الأقل واختر نوعه'); return; }
  if(hasInvalidPrice){ toast('السعر لا يمكن أن يكون رقماً سالباً'); return; }
  if(extra<0){ toast('المصاريف الإضافية لا يمكن أن تكون رقماً سالباً'); return; }
  if(materialCost<0){ toast('تكلفة الخامة لا يمكن أن تكون رقماً سالباً'); return; }
  if(discountType==='percent' && discountValue>100){ toast('نسبة الخصم لا يمكن أن تتعدى 100%'); return; }
  if(!dateDelivery){ toast('أدخل تاريخ التسليم'); return; }
  if(dateReceived && dateDelivery && dateDelivery<dateReceived){
    toast('تاريخ التسليم لا يمكن أن يكون قبل تاريخ الاستلام');
    return;
  }

  // نحتفظ بحقول type/qty/unitPrice على مستوى الطلب (من أول صنف) لأغراض التوافق مع نسخ سابقة من التطبيق
  const legacyType = items.map(it=>(it.qty>1?it.qty+' × ':'')+it.type).join('، ');

  if(id){
    const o = db.orders.find(x=>x.id===id);
    const before = JSON.parse(JSON.stringify(o));
    const wasDelivered = o.status==='تم التسليم';
    Object.assign(o, {customerId, items, type:legacyType, qty:undefined, unitPrice:undefined, dateReceived, dateDelivery, fee, extra, materialCost, urgent, urgentFeePercent, status, discountType, discountValue, taxPercent, updatedAt:Date.now()});
    if(status==='تم التسليم' && !wasDelivered && !o.deliveredDate){
      o.deliveredDate = todayStr();
      finalizeWorkTimeIfRunning(o);
    }
    if(status!=='تم التسليم'){
      o.deliveredDate = null;
    }
    logActivity(`✏️ تعديل طلب ${customerById(customerId)?customerById(customerId).name:''}`);
    setUndo('تعديل الطلب', ()=>{
      const idx = db.orders.findIndex(x=>x.id===id);
      if(idx>-1) db.orders[idx] = before;
      saveDB();
      renderOrders();
      renderHome();
    });
  } else {
    const paid = Number(document.getElementById('f_paid').value)||0;
    if(paid<0){ toast('المبلغ المدفوع لا يمكن أن يكون رقماً سالباً'); return; }
    const newOrder = {id:uid(), customerId, items, type:legacyType, dateReceived, dateDelivery, fee, extra, materialCost, urgent, urgentFeePercent, paid, status, discountType, discountValue, taxPercent, deliveredDate: status==='تم التسليم'?todayStr():null, invoiceNumber: db.nextInvoiceNumber||1001, updatedAt:Date.now()};
    db.nextInvoiceNumber = (db.nextInvoiceNumber||1001) + 1;
    if(paid>orderTotal(newOrder)){ toast('المبلغ المدفوع أكبر من إجمالي الطلب، تأكد من الرقم'); db.nextInvoiceNumber--; return; }
    db.orders.push(newOrder);
    let paymentRecord = null;
    if(paid>0){
      paymentRecord = {id:uid(), orderId:newOrder.id, amount:paid, date:dateReceived||todayStr()};
      db.payments.push(paymentRecord);
    }
    logActivity(`➕ طلب جديد لـ ${customerById(customerId)?customerById(customerId).name:''} بقيمة ${Math.round(orderTotal(newOrder)).toLocaleString('ar-EG')} ج.م`);
    setUndo('إضافة الطلب الجديد', ()=>{
      db.orders = db.orders.filter(x=>x.id!==newOrder.id);
      if(paymentRecord) db.payments = db.payments.filter(p=>p.id!==paymentRecord.id);
      saveDB();
      renderOrders();
      renderHome();
    });
  }
  saveDB();
  closeModal();
  renderOrders();
  toast('تم حفظ الطلب ✅');
}

async function deleteOrder(id){
  if(!await appConfirm('هل تريد حذف هذا الطلب؟ يمكنك استرجاعه خلال 7 أيام من سلة المحذوفات.')) return;
  const o = db.orders.find(x=>x.id===id);
  if(!o) return;
  const relatedPayments = db.payments.filter(p=>p.orderId===id);
  db.orders = db.orders.filter(x=>x.id!==id);
  db.payments = db.payments.filter(p=>p.orderId!==id);
  db.trash.push({id:uid(), type:'order', deletedAt:todayStr(), data:o, payments:relatedPayments});
  logActivity(`🗑️ حذف طلب ${customerById(o.customerId)?customerById(o.customerId).name:''}`);
  saveDB();
  renderOrders();
  toast('تم نقل الطلب لسلة المحذوفات');
}

/* ============================================================
   حاسبة تسعير سريعة — قبل تسجيل الطلب رسمياً
   ============================================================ */
let _pcLastResult = null;

function openPricingCalculatorModal(){
  _pcLastResult = null;
  const html = `
    <div class="modal-head"><h3>🧮 حاسبة تسعير سريعة</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <p class="meta">اختار نوع القطعة وعدد القطع، وهيديك سعر مقترح بناءً على متوسط أسعارك في الطلبات السابقة لنفس النوع — من غير ما تسجل طلب رسمي.</p>
    <div class="field"><label>نوع القطعة</label><select id="pc_type" onchange="onPcTypeChange()">${itemTypeOptionsHtml('')}</select></div>
    <div class="field it-customWrap" id="pc_customWrap" style="display:none;">
      <label>اكتب النوع يدوياً</label><input id="pc_custom" oninput="calcQuickPrice()">
    </div>
    <div class="field"><label>عدد القطع</label><input id="pc_qty" type="number" min="1" value="1" oninput="calcQuickPrice()"></div>
    <div id="pc_result"></div>
  `;
  openModal(html);
  calcQuickPrice();
}

function onPcTypeChange(){
  const sel = document.getElementById('pc_type');
  document.getElementById('pc_customWrap').style.display = sel.value==='__custom__' ? 'block' : 'none';
  calcQuickPrice();
}

function calcQuickPrice(){
  const sel = document.getElementById('pc_type');
  let typeName = '';
  if(sel.value==='__custom__'){
    typeName = document.getElementById('pc_custom').value.trim();
  } else {
    const g = db.garmentTypes.find(x=>x.id===sel.value);
    typeName = g ? g.name : '';
  }
  const qty = Math.max(1, Number(document.getElementById('pc_qty').value)||1);
  const box = document.getElementById('pc_result');
  _pcLastResult = null;
  if(!typeName){ box.innerHTML = '<div class="empty-msg">اختر أو اكتب نوع القطعة</div>'; return; }

  // اجمع كل أسعار القطع من الطلبات السابقة لنفس النوع
  const prices = [];
  db.orders.forEach(o=>{
    const items = Array.isArray(o.items)&&o.items.length ? o.items : [{type:o.type, unitPrice:(o.unitPrice!==undefined?o.unitPrice:o.fee)||0}];
    items.forEach(it=>{ if(it.type===typeName && Number(it.unitPrice)>0) prices.push(Number(it.unitPrice)); });
  });

  if(!prices.length){
    const g = db.garmentTypes.find(x=>x.name===typeName);
    if(g && g.price){
      const total = g.price*qty;
      box.innerHTML = `
        <div class="card" style="padding:12px;background:var(--card-alt);">
          <p class="meta" style="margin-top:0;">لا يوجد تاريخ طلبات سابقة لهذا النوع، فالسعر مقترح من السعر الأساسي المسجل له في الإعدادات.</p>
          <div class="row"><span class="meta">السعر الأساسي للقطعة</span><b>${Number(g.price).toLocaleString('ar-EG')} ج.م</b></div>
          <div class="row" style="border-top:1px dashed var(--stitch);margin-top:6px;padding-top:6px;"><span style="font-weight:700;">إجمالي مقترح لـ ${qty} قطعة</span><b style="color:var(--heading);font-size:16px;">${total.toLocaleString('ar-EG')} ج.م</b></div>
          <button class="btn sm secondary" style="margin-top:10px;width:100%;" onclick="useQuickPriceInNewOrder()">➕ إنشاء طلب بهذا السعر</button>
        </div>`;
      _pcLastResult = {typeName, qty, unitPrice: Math.round(g.price)};
    } else {
      box.innerHTML = '<div class="empty-msg">لا يوجد تاريخ أسعار سابق لهذا النوع بعد — أضف سعره الأساسي من الإعدادات أو اكتب سعر يدوي في الطلب.</div>';
    }
    return;
  }

  const avg = prices.reduce((a,b)=>a+b,0)/prices.length;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const total = Math.round(avg)*qty;
  box.innerHTML = `
    <div class="card" style="padding:12px;background:var(--card-alt);">
      <div class="row"><span class="meta">متوسط سعر القطعة (آخر ${prices.length} ${prices.length===1?'طلب':'طلبات'})</span><b>${Math.round(avg).toLocaleString('ar-EG')} ج.م</b></div>
      <div class="row"><span class="meta">أقل سعر سُجل</span><b>${min.toLocaleString('ar-EG')} ج.م</b></div>
      <div class="row"><span class="meta">أعلى سعر سُجل</span><b>${max.toLocaleString('ar-EG')} ج.م</b></div>
      <div class="row" style="border-top:1px dashed var(--stitch);margin-top:6px;padding-top:6px;"><span style="font-weight:700;">إجمالي مقترح لـ ${qty} قطعة</span><b style="color:var(--heading);font-size:16px;">${total.toLocaleString('ar-EG')} ج.م</b></div>
      <button class="btn sm secondary" style="margin-top:10px;width:100%;" onclick="useQuickPriceInNewOrder()">➕ إنشاء طلب بهذا السعر</button>
    </div>`;
  _pcLastResult = {typeName, qty, unitPrice: Math.round(avg)};
}

// يفتح فورم "طلب جديد" ويملأ أول صنف بالنوع والعدد والسعر المقترح من الحاسبة
function useQuickPriceInNewOrder(){
  if(!_pcLastResult) return;
  const r = _pcLastResult;
  openOrderModal(null);
  setTimeout(()=>{
    const row = document.querySelector('#itemsContainer .item-row');
    if(!row) return;
    const sel = row.querySelector('.it-type');
    const g = db.garmentTypes.find(x=>x.name===r.typeName);
    if(g){
      sel.value = g.id;
    } else {
      sel.value = '__custom__';
    }
    onItemTypeChange(sel);
    if(!g){ row.querySelector('.it-custom').value = r.typeName; }
    row.querySelector('.it-qty').value = r.qty;
    row.querySelector('.it-price').value = r.unitPrice;
    recalcItemsTotal();
  }, 90);
}

/* ---- تسجيل دفعة ---- */
function openPaymentModal(orderId){
  const o = db.orders.find(x=>x.id===orderId);
  const remaining = orderRemaining(o);
  const html = `
    <div class="modal-head"><h3>💵 تسجيل دفعة</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <p class="meta">المتبقي الحالي: <b>${remaining.toLocaleString('ar-EG')} ج.م</b></p>
    <div class="field"><label>المبلغ المدفوع الآن (ج.م)</label><input id="f_payAmount" type="number" placeholder="0"></div>
    <div class="field"><label>التاريخ</label><input id="f_payDate" type="date" value="${todayStr()}"></div>
    <button class="btn" onclick="savePayment('${orderId}')">💾 حفظ الدفعة</button>
  `;
  openModal(html);
}

async function savePayment(orderId){
  const amount = Number(document.getElementById('f_payAmount').value)||0;
  const date = document.getElementById('f_payDate').value || todayStr();
  if(amount<=0){ toast('أدخل مبلغاً صحيحاً'); return; }
  const o = db.orders.find(x=>x.id===orderId);
  const remaining = orderRemaining(o);
  if(amount>remaining){
    const ok = await appConfirm(`💰 تنبيه مبلغ الدفعة\nالمتبقي على الطلب: ${remaining.toLocaleString('ar-EG')} ج.م\nالمبلغ المُدخل: ${amount.toLocaleString('ar-EG')} ج.م\n\nالمبلغ أكبر من المتبقي على الطلب. هل أنت متأكد من المبلغ؟`, {okText:'نعم، تسجيل', danger:false});
    if(!ok) return;
  }
  const beforePaid = Number(o.paid)||0;
  o.paid = beforePaid + amount;
  o.updatedAt = Date.now();
  const paymentRecord = {id:uid(), orderId, amount, date};
  db.payments.push(paymentRecord);
  logActivity(`💵 دفعة ${amount.toLocaleString('ar-EG')} ج.م من ${customerById(o.customerId)?customerById(o.customerId).name:''}`);
  setUndo('تسجيل الدفعة', ()=>{
    o.paid = beforePaid;
    db.payments = db.payments.filter(p=>p.id!==paymentRecord.id);
    saveDB();
    renderOrders();
    renderHome();
  });
  saveDB();
  closeModal();
  renderOrders();
  toast('تم تسجيل الدفعة ✅');
}

/* ---- فاتورة واتساب ----
   واتساب (زي أي تطبيق تاني) مابيسمحش لموقع يبعت ملف/صورة لمحادثة شخص معين
   تلقائيًا من غير تدخل المستخدم — ده قيد أمان من واتساب نفسه ضد السبام،
   مش قصور في الكود. كمان أي محاولة تلقائية (زي navigator.share بيتفتح
   لوحده) بتفتح قائمة اختيار جهات اتصال عامة، ولو المستخدم مركّزش ممكن
   الصورة تروح لشات غلط (زي "مراسلة نفسك") بدل شات العميل. عشان كده أفضل
   وأضمن طريقة هي: نعرض الإيصال كصورة حقيقية على الشاشة (مش نحاول نبعتها
   تلقائي)، والمستخدم بنفسه يضغط مطوّلاً عليها ويختار "مشاركة" فتفتح له
   واتساب وهو شايف الصورة قدامه فمش هيغلط في اختيار الشات؛ ده إجراء المتصفح
   الأصلي وشغال 100% على أي جهاز مهما كانت قيود الـ WebView. وبالتوازي بنديله
   زرار يفتح شات العميل بالتحديد فورًا مع نص الفاتورة، وزرار نسخ/مشاركة
   سريع كخيارات إضافية. */
let _waReceiptCtx = null;

async function sendWhatsApp(orderId){
  const o = db.orders.find(x=>x.id===orderId);
  if(!o.invoiceNumber){ o.invoiceNumber = db.nextInvoiceNumber||1001; db.nextInvoiceNumber=(db.nextInvoiceNumber||1001)+1; saveDB(); }
  const c = customerById(o.customerId);
  if(!c || !c.phone){ toast('لا يوجد رقم هاتف مسجل لهذا العميل'); return; }
  let phone = c.phone.replace(/[^0-9]/g,'');
  if(phone.startsWith('0')) phone = '2'+phone; // مصر

  let dataUrl = null, blob = null;
  try{
    const canvas = await drawReceiptCanvas(orderId);
    dataUrl = canvas.toDataURL('image/png');
    blob = await new Promise(res=>canvas.toBlob(res, 'image/png'));
  }catch(e){
    console.warn('sendWhatsApp: فشل تجهيز صورة الإيصال', e);
  }
  const filename = 'فاتورة_'+(c.name||'طلب')+'.png';
  _waReceiptCtx = {phone, dataUrl, blob, filename, customerName: c.name};

  // محاولة تلقائية لحفظ الصورة في المعرض فور الضغط على الزر. ملحوظة مهمة:
  // أندرويد WebView (اللي بيلف عليه التطبيق ده كتطبيق مش متصفح) بيمنع تنزيل
  // ملفات blob: بصمت من غير أي رسالة خطأ — يعني المحاولة ممكن "تنجح" من غير
  // ما تحفظ حاجة فعليًا على الجهاز. ده قيد من أندرويد نفسه على تطبيقات الـ
  // WebView (زي WebIntoApp) مش قصور في الكود، ومفيش طريقة نضمن بيها إنها
  // تنجح 100% غير لو التطبيق الملفوف بيه فيه صلاحية/دعم تنزيل ملفات مفعّلة
  // من إعدادات لوحة تحكم WebIntoApp نفسها. عشان كده سايبين نافذة المودال
  // تحت فيها الصورة ظاهرة بشكل مباشر + طريقة الحفظ اليدوي (الضغط المطوّل)
  // كخطة مضمونة الشغل لو المحاولة التلقائية دي متأثرتش فعليًا.
  if(blob){
    try{
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 60000);
    }catch(e){
      console.warn('sendWhatsApp: فشلت محاولة التنزيل التلقائي', e);
    }
  }

  openModal(`
    <h3 style="margin-top:0;">🧾 فاتورة واتساب — ${escapeHtml(c.name)}</h3>
    ${dataUrl?`
      <img src="${dataUrl}" style="width:100%;border:1px solid #ddd;border-radius:8px;margin:6px 0 10px;display:block;" />
      <div style="font-size:13px;color:#666;margin-bottom:12px;line-height:1.6;">
        📥 حاولنا نحفظ الصورة تلقائي في المعرض. لو لقيتها موجودة، اضغط 📎 في شات العميل واختارها وابعتها.<br>
        📌 لو مش لاقيها: اضغط <b>مطوّلاً على الصورة فوق</b> واختار <b>"تنزيل الصورة" / "حفظ الصورة"</b> (مش نسخ) — طريقة مضمونة الشغل 100%.
      </div>
    `:`<div class="hint" style="margin-bottom:12px;">تعذر تجهيز صورة الإيصال</div>`}
    <div style="display:flex;flex-direction:column;gap:8px;">
      <button class="btn accent" onclick="waOpenCustomerChat()">💬 افتح شات ${escapeHtml(c.name)}</button>
      ${blob?`<button class="btn outline" onclick="waShareImage()">📤 مشاركة سريعة ⚠️ (تأكد تختار شات ${escapeHtml(c.name)})</button>`:''}
      <button class="btn secondary" onclick="closeModal()">إغلاق</button>
    </div>
  `);

  // نفتح شات العميل في نفس اللحظة، من غير نص جاهز — الصورة بس
  openWhatsAppChat(phone);
}

function waOpenCustomerChat(){
  if(!_waReceiptCtx) return;
  openWhatsAppChat(_waReceiptCtx.phone);
}

async function waShareImage(){
  if(!_waReceiptCtx || !_waReceiptCtx.blob) return;
  try{
    const file = new File([_waReceiptCtx.blob], _waReceiptCtx.filename, {type:'image/png'});
    if(navigator.canShare && navigator.canShare({files:[file]})){
      await navigator.share({files:[file], title:_waReceiptCtx.filename});
      return;
    }
  }catch(e){
    if(e && e.name==='AbortError') return;
    console.warn('waShareImage: فشلت المشاركة', e);
  }
  toast('المشاركة مش مدعومة هنا — اضغط مطولاً على الصورة فوق واختار حفظ الصورة');
}

function sendReminder(orderId){
  const o = db.orders.find(x=>x.id===orderId);
  const c = customerById(o.customerId);
  if(!c || !c.phone){ toast('لا يوجد رقم هاتف مسجل لهذا العميل'); return; }
  let phone = c.phone.replace(/[^0-9]/g,'');
  if(phone.startsWith('0')) phone = '2'+phone;
  const msg =
`تذكير من ${db.workshopName||'ورشة تفصيل الجلابيب'} 🧵
حضرتك، جلابيتك (${orderTypeLabel(o)}) هتكون جاهزة يوم ${fmtDate(o.dateDelivery)} إن شاء الله.
المتبقي: ${orderRemaining(o).toLocaleString('ar-EG')} ج.م
في انتظار حضرتك 🙏`;
  openWhatsAppChat(phone, msg);
}

/* أنماط CSS لورقة الإيصال — مستخدمة في نافذة الطباعة وفي نسخة الصورة اللي بتتبعت في واتساب.
   تصميم بطاقة احترافية: شريط علوي ملون + شريط عنوان بلون داكن مع شارة رقم الفاتورة +
   جدول أصناف مقسّم بألوان متبادلة + صندوق إجمالي مميز + خاتمة شكر. الألوان بتتاخد من
   ثيم التطبيق (db.theme) عن طريق متغيرات CSS --pc/--pd عشان الفاتورة تفضل متناسقة مع
   هوية الورشة لو اتغيرت الألوان من الإعدادات. */
/* النصوص والألوان الافتراضية لكل سطر في إيصال الفاتورة — أي سطر مش موجود في
   db.invoiceCustom بيرجع لقيمته الافتراضية هنا، عشان الفاتورة تفضل شغالة حتى
   لو المستخدم عدّل جزء بسيط بس. */
const DEFAULT_INVOICE_CUSTOM = {
  labels: {
    title: '🧾 إيصال تفصيل جلابة',
    badgePrefix: 'رقم',
    clientLabel: 'العميل',
    phoneLabel: 'الهاتف',
    receivedLabel: 'تاريخ الاستلام',
    deliveryLabel: 'تاريخ التسليم المتوقع',
    colType: 'الصنف',
    colQty: 'العدد',
    colUnitPrice: 'سعر القطعة',
    colTotal: 'الإجمالي',
    extraLabel: 'مصاريف إضافية',
    discountLabel: 'الخصم',
    taxLabel: 'الضريبة/الرسوم',
    totalLabel: 'الإجمالي',
    paidLabel: 'المدفوع',
    remainingLabel: 'المتبقي',
    footerText: 'شكرًا لثقتكم بنا 🌿'
  },
  colors: {
    subText: '#777777',
    titleText: '#ffffff',
    labelText: '#888888',
    valueText: '#222222',
    itemsHeadBg: '',
    itemsHeadText: '#ffffff',
    rowAltBg: '#faf9f6',
    totalsBg: '#f8f6f1',
    footerText: '#999999'
  }
};

// بيدمج تخصيصات المستخدم (db.invoiceCustom) فوق القيم الافتراضية — أي سطر المستخدم
// مسّاش (لسه فاضي) بيفضل ياخد القيمة الافتراضية بدل ما يبوّظ شكل الفاتورة
function getInvoiceCustom(){
  const uc = (db && db.invoiceCustom) || {};
  return {
    labels: {...DEFAULT_INVOICE_CUSTOM.labels, ...(uc.labels||{})},
    colors: {...DEFAULT_INVOICE_CUSTOM.colors, ...(uc.colors||{})}
  };
}

const RECEIPT_STYLE = `
  .inv-card{max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;
    box-shadow:0 3px 20px rgba(0,0,0,.09);border:1px solid #ececec;}
  .inv-topbar{height:6px;background:var(--pc,#1F6D57);}
  .inv-header{text-align:center;padding:20px 20px 14px;}
  .inv-logo{width:58px;height:58px;border-radius:50%;object-fit:cover;margin:0 auto 8px;display:block;border:2px solid var(--pc,#1F6D57);}
  .inv-brand{font-size:19px;font-weight:900;color:var(--pc,#1F6D57);}
  .inv-sub{font-size:12.5px;color:var(--subc,#777);margin-top:3px;}
  .inv-titlebar{display:flex;align-items:center;justify-content:space-between;background:var(--pd,#123C2F);color:var(--ttlc,#fff);padding:12px 20px;}
  .inv-titlebar h1{font-size:16.5px;margin:0;border:none;padding:0;color:var(--ttlc,#fff);font-weight:900;}
  .inv-badge{background:rgba(255,255,255,.16);color:var(--ttlc,#fff);padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;white-space:nowrap;}
  .inv-body{padding:18px 20px 6px;}
  table{width:100%;border-collapse:collapse;}
  td{padding:9px 4px;border-bottom:1px solid #f0f0f0;font-size:14px;}
  td.lbl{color:var(--lblc,#888);width:45%;}
  td.val{font-weight:700;color:var(--valc,#222);}
  .items-table{margin-top:8px;border:1px solid #ececec;border-radius:10px;overflow:hidden;border-collapse:separate;border-spacing:0;}
  .items-table th{text-align:right;font-size:11.5px;color:var(--ihtext,#fff);background:var(--ihbg,var(--pc,#1F6D57));padding:9px 8px;font-weight:700;border:none;}
  .items-table td{font-size:13px;padding:8px;border-bottom:1px solid #f2f2f2;}
  .items-table tr:last-child td{border-bottom:none;}
  .items-table tr:nth-child(even) td{background:var(--rowalt,#faf9f6);}
  .totals-box{margin-top:14px;background:var(--totbg,#f8f6f1);border-radius:10px;padding:2px 12px;}
  .total-row td{font-size:16.5px;color:var(--pc,#1F6D57);border-top:2px solid var(--pc,#1F6D57);border-bottom:none;padding-top:12px;}
  .remaining-ok{color:#1F6D57!important;}
  .remaining-due{color:#B03A2E!important;}
  .inv-footer{text-align:center;padding:14px 20px 18px;font-size:12px;color:var(--ftc,#999);border-top:1px dashed #e2e2e2;margin-top:8px;}
`;

/* بيبني جسم ورقة الإيصال (نفس التصميم الاحترافي) من غير <html>/<head> عشان
   يتقدر يتحط جوه نافذة طباعة أو جوه عنصر مخفي بيتحول لصورة PNG لواتساب. */
function buildReceiptBodyHtml(orderId, opts){
  opts = opts || {};
  const o = opts.order || db.orders.find(x=>x.id===orderId);
  if(!o) return '';
  if(!opts.preview && !o.invoiceNumber){ o.invoiceNumber = db.nextInvoiceNumber||1001; db.nextInvoiceNumber=(db.nextInvoiceNumber||1001)+1; saveDB(); }
  const c = customerById(o.customerId);
  const urgentFee = orderUrgentFeeAmount(o);
  const discount = orderDiscountAmount(o);
  const tax = orderTaxAmount(o);
  const total = orderTotal(o);
  const remaining = orderRemaining(o);
  const theme = db.theme||{};
  const primary = theme.primary||'#1F6D57';
  const primaryDark = theme.primaryDark||'#123C2F';
  const name = db.workshopName||'ورشة تفصيل الجلابيب';
  const contactLines = [];
  if(db.ownerName) contactLines.push(escapeHtml(db.ownerName));
  if(db.ownerPhone) contactLines.push('📞 '+escapeHtml(db.ownerPhone));
  if(db.workshopAddress) contactLines.push('📍 '+escapeHtml(db.workshopAddress));
  const ic = getInvoiceCustom();
  const L = ic.labels, K = ic.colors;
  const cardVars = [
    `--pc:${primary}`, `--pd:${primaryDark}`,
    `--subc:${K.subText}`, `--ttlc:${K.titleText}`,
    `--lblc:${K.labelText}`, `--valc:${K.valueText}`,
    `--ihbg:${K.itemsHeadBg||primary}`, `--ihtext:${K.itemsHeadText}`,
    `--rowalt:${K.rowAltBg}`, `--totbg:${K.totalsBg}`, `--ftc:${K.footerText}`
  ].join(';');
  return `
    <div class="inv-card" style="${cardVars};">
      <div class="inv-topbar"></div>
      <div class="inv-header">
        ${db.workshopLogo?`<img src="${db.workshopLogo}" class="inv-logo">`:''}
        <div class="inv-brand">${escapeHtml(name)}</div>
        ${contactLines.map(l=>`<div class="inv-sub">${l}</div>`).join('')}
      </div>
      <div class="inv-titlebar">
        <h1>${escapeHtml(L.title)}</h1>
        <span class="inv-badge">${escapeHtml(L.badgePrefix)} ${o.invoiceNumber || (opts.preview?'معاينة':'-')}</span>
      </div>
      <div class="inv-body">
        <table>
          <tr><td class="lbl">${escapeHtml(L.clientLabel)}</td><td class="val">${escapeHtml(c?c.name:'-')}</td></tr>
          <tr><td class="lbl">${escapeHtml(L.phoneLabel)}</td><td class="val">${escapeHtml(c?c.phone||'-':'-')}</td></tr>
          <tr><td class="lbl">${escapeHtml(L.receivedLabel)}</td><td class="val">${fmtDate(o.dateReceived)}</td></tr>
          <tr><td class="lbl">${escapeHtml(L.deliveryLabel)}</td><td class="val">${fmtDate(o.dateDelivery)}</td></tr>
        </table>
        <table class="items-table">
          <tr><th>${escapeHtml(L.colType)}</th><th>${escapeHtml(L.colQty)}</th><th>${escapeHtml(L.colUnitPrice)}</th><th>${escapeHtml(L.colTotal)}</th></tr>
          ${(Array.isArray(o.items)&&o.items.length?o.items:[{type:o.type,qty:o.qty||1,unitPrice:o.unitPrice||o.fee||0}]).map(it=>`
            <tr>
              <td>${escapeHtml(it.type)}</td>
              <td>${it.qty||1}</td>
              <td>${(Number(it.unitPrice)||0).toLocaleString('ar-EG')} ج.م</td>
              <td>${((it.qty||1)*(Number(it.unitPrice)||0)).toLocaleString('ar-EG')} ج.م</td>
            </tr>
          `).join('')}
        </table>
        <div class="totals-box">
          <table>
            <tr><td class="lbl">${escapeHtml(L.extraLabel)}</td><td class="val">${o.extra||0} ج.م</td></tr>
            ${urgentFee>0?`<tr><td class="lbl">🔥 رسوم استعجال</td><td class="val">+${Math.round(urgentFee).toLocaleString('ar-EG')} ج.م</td></tr>`:''}
            ${discount>0?`<tr><td class="lbl">${escapeHtml(L.discountLabel)}</td><td class="val">-${Math.round(discount).toLocaleString('ar-EG')} ج.م</td></tr>`:''}
            ${tax>0?`<tr><td class="lbl">${escapeHtml(L.taxLabel)}</td><td class="val">+${Math.round(tax).toLocaleString('ar-EG')} ج.م</td></tr>`:''}
            <tr class="total-row"><td class="lbl">${escapeHtml(L.totalLabel)}</td><td class="val">${Math.round(total).toLocaleString('ar-EG')} ج.م</td></tr>
            <tr><td class="lbl">${escapeHtml(L.paidLabel)}</td><td class="val">${o.paid||0} ج.م</td></tr>
            <tr><td class="lbl">${escapeHtml(L.remainingLabel)}</td><td class="val ${remaining>0?'remaining-due':'remaining-ok'}">${Math.round(remaining).toLocaleString('ar-EG')} ج.م</td></tr>
          </table>
        </div>
      </div>
      <div class="inv-footer">${escapeHtml(L.footerText)}</div>
    </div>
  `;
}

function printReceipt(orderId){
  const o = db.orders.find(x=>x.id===orderId);
  const c = customerById(o.customerId);
  const html = `
    <html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>إيصال - ${escapeHtml(c?c.name:'')}</title>
    <style>
      body{font-family:Tahoma,Arial,sans-serif;padding:24px;color:#222;background:#f3f1ec;}
      ${RECEIPT_STYLE}
      @media print{
        body{background:#fff;padding:0;}
        .inv-card{box-shadow:none;border:1px solid #ddd;}
      }
    </style></head><body>
      ${buildReceiptBodyHtml(orderId)}
    </body></html>
  `;
  openPrintWindow(html, 'إيصال_'+(c?c.name:'طلب'));
}

// بيرجّع أحدث طلب حقيقي في السجل لاستخدامه في معاينة تصميم الفاتورة، ولو مفيش طلبات
// خالص بيبني طلب وهمي مؤقت (مش بيتحفظ في قاعدة البيانات) بس عشان تتشاف المعاينة
function sampleOrderForPreview(){
  if(Array.isArray(db.orders) && db.orders.length) return db.orders[db.orders.length-1];
  return {
    id:'__preview__',
    customerId:null,
    items:[{type:'جلابة قطن', qty:1, unitPrice:225}],
    extra:0, paid:0, discountType:'none', taxPercent:0,
    dateReceived:new Date().toISOString().slice(0,10),
    dateDelivery:new Date().toISOString().slice(0,10)
  };
}

// بيبني (أول مرة بس) بطاقة "شكل الفاتورة" داخل صفحة الإعدادات، وبعد كده بيحدّث محتواها
// في كل مرة تتفتح فيها الإعدادات — عشان صاحب الورشة يشوف شكل الإيصال فورًا بنفس الألوان
// والشعار المسجلين، من غير ما يحتاج يطبع أو يبعت واتساب للتجربة
function renderInvoicePreviewCard(){
  const anchorInput = document.getElementById('workshopNameInput');
  if(!anchorInput) return;
  let card = document.getElementById('invoicePreviewCard');
  if(!card){
    card = document.createElement('div');
    card.id = 'invoicePreviewCard';
    card.className = 'card';
    card.innerHTML = `
      <h3 style="margin-top:0;">🧾 شكل الفاتورة</h3>
      <p class="meta" style="margin-top:-6px;">معاينة حية لشكل إيصال الفاتورة بنفس اسم الورشة وشعارها وألوانها — أي تعديل تحفظه بالأعلى هيتحدث هنا فورًا.</p>
      <div id="invoicePreviewBox" style="background:#f3f1ec;border-radius:12px;padding:16px 8px;overflow:auto;"></div>
      <div class="row" style="margin-top:10px;">
        <button class="btn" onclick="printInvoicePreviewSample()">🖨️ تجربة طباعة</button>
      </div>
    `;
    // نحطها بعد أقرب "card" لحقل اسم الورشة مباشرة — بدل الاعتماد على تخمين هوية حاوية صفحة الإعدادات
    const anchorCard = anchorInput.closest('.card') || anchorInput.closest('section') || anchorInput.parentElement;
    if(anchorCard && anchorCard.parentNode){
      anchorCard.parentNode.insertBefore(card, anchorCard.nextSibling);
    } else {
      anchorInput.parentElement.appendChild(card);
    }
  }
  const box = document.getElementById('invoicePreviewBox');
  if(box) box.innerHTML = `<style>${RECEIPT_STYLE}</style>` + buildReceiptBodyHtml(null, {order: sampleOrderForPreview(), preview:true});
}

// يطبع نفس الطلب المعروض في معاينة الإعدادات، للتأكد إن ورقة الطباعة الفعلية مطابقة للمعاينة
function printInvoicePreviewSample(){
  const o = sampleOrderForPreview();
  const c = customerById(o.customerId);
  const html = `
    <html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>معاينة إيصال</title>
    <style>
      body{font-family:Tahoma,Arial,sans-serif;padding:24px;color:#222;background:#f3f1ec;}
      ${RECEIPT_STYLE}
      @media print{
        body{background:#fff;padding:0;}
        .inv-card{box-shadow:none;border:1px solid #ddd;}
      }
    </style></head><body>
      ${buildReceiptBodyHtml(null, {order:o, preview:true})}
    </body></html>
  `;
  openPrintWindow(html, 'معاينة_إيصال_'+(c?c.name:'تجربة'));
}

// يحمّل صورة (زي شعار الورشة) كـ Promise عشان نقدر نرسمها على Canvas بعد ما تخلص تحميل فعليًا
function loadImageAsync(src){
  return new Promise((resolve)=>{
    if(!src){ resolve(null); return; }
    const img = new Image();
    img.onload = ()=>resolve(img);
    img.onerror = ()=>resolve(null);
    img.src = src;
  });
}

// يرسم مسار مستطيل بزوايا دائرية — مستخدم لرسم البطاقة والشارات والصندوقات على الـ Canvas
function roundRectPath(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y);
  ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r);
  ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h);
  ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,y+r);
  ctx.arcTo(x,y,x+r,y,r);
  ctx.closePath();
}

/* بيرسم إيصال الفاتورة بنفس التصميم الاحترافي (بطاقة بزوايا دائرية، شريط علوي وعنوان
   ملوّنين، شارة رقم فاتورة، جدول أصناف مقسّم بألوان متبادلة، صندوق إجمالي مميز، خاتمة شكر)
   مباشرة على Canvas — من غير أي مكتبة خارجية أو اتصال إنترنت، عشان يشتغل 100% جوه أي
   WebView/تطبيق. بيرجّع الـ canvas الجاهز. دالة async عشان تقدر تنتظر تحميل شعار الورشة. */
async function drawReceiptCanvas(orderId){
  const o = db.orders.find(x=>x.id===orderId);
  if(!o.invoiceNumber){ o.invoiceNumber = db.nextInvoiceNumber||1001; db.nextInvoiceNumber=(db.nextInvoiceNumber||1001)+1; saveDB(); }
  const c = customerById(o.customerId);
  const urgentFee = orderUrgentFeeAmount(o);
  const discount = orderDiscountAmount(o);
  const tax = orderTaxAmount(o);
  const total = orderTotal(o);
  const remaining = orderRemaining(o);
  const items = (Array.isArray(o.items)&&o.items.length?o.items:[{type:o.type,qty:o.qty||1,unitPrice:o.unitPrice||o.fee||0}]);

  const theme = db.theme||{};
  const primary = theme.primary || '#1F6D57';
  const primaryDark = theme.primaryDark || '#123C2F';
  const ic = getInvoiceCustom();
  const L = ic.labels, K = ic.colors;
  const itemsHeadBg = K.itemsHeadBg || primary;

  const brandLines = [db.workshopName||'ورشة تفصيل الجلابيب'];
  if(db.ownerName) brandLines.push(db.ownerName);
  if(db.ownerPhone) brandLines.push('📞 '+db.ownerPhone);
  if(db.workshopAddress) brandLines.push('📍 '+db.workshopAddress);

  const infoRows = [
    [L.clientLabel, c?c.name:'-'],
    [L.phoneLabel, c?(c.phone||'-'):'-'],
    [L.receivedLabel, fmtDate(o.dateReceived)],
    [L.deliveryLabel, fmtDate(o.dateDelivery)]
  ];
  const totalsRows = [[L.extraLabel, (o.extra||0)+' ج.م', false, false]];
  if(urgentFee>0) totalsRows.push(['🔥 رسوم استعجال', '+'+Math.round(urgentFee).toLocaleString('ar-EG')+' ج.م', false, false]);
  if(discount>0) totalsRows.push([L.discountLabel, '-'+Math.round(discount).toLocaleString('ar-EG')+' ج.م', false, false]);
  if(tax>0) totalsRows.push([L.taxLabel, '+'+Math.round(tax).toLocaleString('ar-EG')+' ج.م', false, false]);
  totalsRows.push([L.totalLabel, Math.round(total).toLocaleString('ar-EG')+' ج.م', true, false]);
  totalsRows.push([L.paidLabel, (o.paid||0)+' ج.م', false, false]);
  totalsRows.push([L.remainingLabel, Math.round(remaining).toLocaleString('ar-EG')+' ج.م', false, remaining>0]);

  const logoImg = db.workshopLogo ? await loadImageAsync(db.workshopLogo) : null;

  const FONT = 'Tahoma, Arial, sans-serif';
  const OM = 14;   // هامش صفحة رفيع حوالين البطاقة (يظهر خلفها كإطار خفيف)
  const CW = 580;  // عرض البطاقة
  const PAD = 24;  // حشو داخلي
  const ROW_H = 36;

  const logoSize = logoImg ? 60 : 0;
  const headerH = 62 + (logoImg?logoSize+10:0) + (brandLines.length-1)*18;
  const titleBarH = 46;
  const infoH = infoRows.length*ROW_H;
  const itemHeadH = 32, itemRowH = 34;
  const itemsH = itemHeadH + items.length*itemRowH;
  const totalsPadV = 10;
  const totalsH = totalsPadV*2 + totalsRows.length*ROW_H;
  const GAP = 16;
  const footerH = 40;

  const CH = headerH + titleBarH + PAD + infoH + GAP + itemsH + GAP + totalsH + GAP + footerH + PAD;
  const W = CW + OM*2;
  const H = CH + OM*2;

  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = W*scale; canvas.height = H*scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.direction = 'rtl';
  ctx.textBaseline = 'middle';

  // خلفية الصفحة خلف البطاقة
  ctx.fillStyle = '#f3f1ec';
  ctx.fillRect(0,0,W,H);

  // ظل خفيف تحت البطاقة
  ctx.save();
  roundRectPath(ctx, OM+2, OM+3, CW, CH, 18);
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  ctx.fill();
  ctx.restore();

  // البطاقة البيضاء (كل المحتوى بيترسم جوه القص ده عشان الزوايا تفضل دائرية)
  ctx.save();
  roundRectPath(ctx, OM, OM, CW, CH, 18);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.clip();

  const X0 = OM, X1 = OM+CW;
  let y = OM;

  // الشريط العلوي الملون
  ctx.fillStyle = primary;
  ctx.fillRect(X0, y, CW, 6);
  y += 6 + 16;

  // شعار الورشة (لو موجود) واسمها وبيانات التواصل
  if(logoImg){
    const cx = OM+CW/2, cy = y+logoSize/2;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, logoSize/2, 0, Math.PI*2); ctx.closePath(); ctx.clip();
    ctx.drawImage(logoImg, cx-logoSize/2, cy-logoSize/2, logoSize, logoSize);
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, logoSize/2, 0, Math.PI*2);
    ctx.lineWidth = 2; ctx.strokeStyle = primary; ctx.stroke();
    ctx.restore();
    y += logoSize + 10;
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = primary;
  ctx.font = '900 19px '+FONT;
  ctx.fillText(brandLines[0], OM+CW/2, y+10);
  y += 26;
  ctx.font = '13px '+FONT;
  ctx.fillStyle = K.subText;
  for(let i=1;i<brandLines.length;i++){
    ctx.fillText(brandLines[i], OM+CW/2, y+8);
    y += 18;
  }
  y += 14;

  // شريط العنوان الملوّن + شارة رقم الفاتورة
  ctx.fillStyle = primaryDark;
  ctx.fillRect(X0, y, CW, titleBarH);
  ctx.textAlign = 'right';
  ctx.fillStyle = K.titleText;
  ctx.font = '900 17px '+FONT;
  ctx.fillText(L.title, X1-PAD, y+titleBarH/2);
  const badgeText = L.badgePrefix+' '+(o.invoiceNumber||'-');
  ctx.font = '12px '+FONT;
  const badgeW = ctx.measureText(badgeText).width + 20;
  const badgeH = 24;
  const badgeX = X0+PAD, badgeY = y+(titleBarH-badgeH)/2;
  ctx.save();
  roundRectPath(ctx, badgeX, badgeY, badgeW, badgeH, 12);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fill();
  ctx.restore();
  ctx.textAlign = 'center';
  ctx.fillStyle = K.titleText;
  ctx.fillText(badgeText, badgeX+badgeW/2, badgeY+badgeH/2);
  y += titleBarH + PAD;

  const solidLine = (yy, color, width)=>{
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(X0+PAD,yy); ctx.lineTo(X1-PAD,yy); ctx.stroke();
    ctx.restore();
  };
  const dashedLine = (yy)=>{
    ctx.save();
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(X0+PAD,yy); ctx.lineTo(X1-PAD,yy); ctx.stroke();
    ctx.restore();
  };
  const labelValueRow = (yy, label, value, big, danger)=>{
    ctx.textAlign = 'right';
    ctx.fillStyle = big ? primary : K.labelText;
    ctx.font = (big?'bold 17px ':'14px ')+FONT;
    ctx.fillText(label, X1-PAD, yy+ROW_H/2);
    ctx.textAlign = 'left';
    ctx.fillStyle = big ? primary : (danger ? '#B03A2E' : K.valueText);
    ctx.font = (big?'bold 17px ':'bold 14px ')+FONT;
    ctx.fillText(String(value), X0+PAD, yy+ROW_H/2);
    if(!big) solidLine(yy+ROW_H, '#f0f0f0', 1);
  };

  // صفوف بيانات العميل
  infoRows.forEach(([lbl,val])=>{ labelValueRow(y, lbl, val, false, false); y += ROW_H; });
  y += GAP;

  // جدول الأصناف (نفس تقسيم الأعمدة القديم، بس بمرجعية X0/X1 الجديدة)
  const totalColLeft = X0+PAD+90;
  const priceColRight = totalColLeft+120;
  const qtyColRight = priceColRight+64;
  const nameColRight = X1-PAD;

  ctx.fillStyle = itemsHeadBg;
  ctx.fillRect(X0+PAD, y, CW-2*PAD, itemHeadH);
  ctx.font = '12px '+FONT;
  ctx.fillStyle = K.itemsHeadText;
  ctx.textAlign='right'; ctx.fillText(L.colType, nameColRight, y+itemHeadH/2);
  ctx.textAlign='center'; ctx.fillText(L.colQty, qtyColRight-32, y+itemHeadH/2);
  ctx.textAlign='center'; ctx.fillText(L.colUnitPrice, priceColRight-60, y+itemHeadH/2);
  ctx.textAlign='left'; ctx.fillText(L.colTotal, totalColLeft-90, y+itemHeadH/2);
  y += itemHeadH;
  const itemsTopY = y;
  items.forEach((it,idx)=>{
    const qty = it.qty||1;
    const price = Number(it.unitPrice)||0;
    if(idx%2===1){
      ctx.fillStyle = K.rowAltBg;
      ctx.fillRect(X0+PAD, y, CW-2*PAD, itemRowH);
    }
    ctx.font = '13px '+FONT;
    ctx.fillStyle = '#222';
    ctx.textAlign='right'; ctx.fillText(String(it.type||''), nameColRight, y+itemRowH/2);
    ctx.textAlign='center'; ctx.fillText(String(qty), qtyColRight-32, y+itemRowH/2);
    ctx.textAlign='center'; ctx.fillText(price.toLocaleString('ar-EG')+' ج.م', priceColRight-60, y+itemRowH/2);
    ctx.textAlign='left'; ctx.fillText((qty*price).toLocaleString('ar-EG')+' ج.م', totalColLeft-90, y+itemRowH/2);
    y += itemRowH;
    if(idx<items.length-1) solidLine(y, '#f2f2f2', 1);
  });
  ctx.save();
  ctx.strokeStyle = '#ececec'; ctx.lineWidth = 1;
  ctx.strokeRect(X0+PAD+0.5, itemsTopY-itemHeadH+0.5, CW-2*PAD-1, itemsH-1);
  ctx.restore();
  y += GAP;

  // صندوق المصاريف والإجمالي (خلفية مميزة)
  ctx.save();
  roundRectPath(ctx, X0+PAD, y, CW-2*PAD, totalsH, 10);
  ctx.fillStyle = K.totalsBg;
  ctx.fill();
  ctx.restore();
  y += totalsPadV;
  totalsRows.forEach(([lbl,val,big,danger])=>{ labelValueRow(y, lbl, val, big, danger); y += ROW_H; });
  y += totalsPadV;
  y += GAP;

  // خط متقطع وخاتمة شكر
  dashedLine(y);
  y += 22;
  ctx.textAlign = 'center';
  ctx.fillStyle = K.footerText;
  ctx.font = '13px '+FONT;
  ctx.fillText(L.footerText, OM+CW/2, y);

  ctx.restore(); // فك القص عن حدود البطاقة

  // إطار رفيع حوالين البطاقة
  ctx.save();
  roundRectPath(ctx, OM, OM, CW, CH, 18);
  ctx.strokeStyle = '#eee';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  return canvas;
}

function printOrderLabel(orderId){
  const o = db.orders.find(x=>x.id===orderId);
  const c = customerById(o.customerId);
  const shortId = o.id.slice(-5).toUpperCase();
  const html = `
    <html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>ملصق - ${escapeHtml(c?c.name:'')}</title>
    <style>
      @page{ size:80mm 50mm; margin:4mm; }
      body{font-family:Tahoma,Arial,sans-serif;color:#111;margin:0;padding:10px;}
      .label{border:2px dashed #1F6D57;border-radius:10px;padding:10px 12px;}
      .label h1{font-size:16px;margin:0 0 6px;color:#1F6D57;}
      .label .row{display:flex;justify-content:space-between;font-size:12.5px;margin:3px 0;}
      .label .row b{font-weight:700;}
      .label .code{margin-top:6px;text-align:center;font-size:18px;font-weight:900;letter-spacing:2px;border-top:1px dashed #ccc;padding-top:6px;}
    </style></head><body>
      <div class="label">
        <div style="font-size:10.5px;color:#888;margin-bottom:2px;">${escapeHtml(db.workshopName||'ورشة تفصيل الجلابيب')}</div>
        <h1>🧵 ${escapeHtml(c?c.name:'عميل')}</h1>
        <div class="row"><span>النوع</span><b>${escapeHtml(orderTypeLabel(o))}</b></div>
        <div class="row"><span>الاستلام</span><b>${fmtDate(o.dateReceived)}</b></div>
        <div class="row"><span>التسليم</span><b>${fmtDate(o.dateDelivery)}</b></div>
        <div class="code">#${shortId}</div>
      </div>
    </body></html>
  `;
  openPrintWindow(html, 'ملصق_'+(c?c.name:'طلب'));
}

/* ============================================================
   المواعيد
   ============================================================ */
function renderDeliveriesCalendar(){
  const box = document.getElementById('deliveriesCalendar');
  if(!box) return;
  if(!calendarMonth) calendarMonth = todayStr().slice(0,7);

  const [y,m] = calendarMonth.split('-').map(Number);
  const firstOfMonth = new Date(y, m-1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const startWeekday = firstOfMonth.getDay(); // 0=الأحد
  const today = todayStr();
  const monthLabel = firstOfMonth.toLocaleDateString('ar-EG', {month:'long', year:'numeric'});

  // عدد الطلبات (غير المُسلَّمة) في كل يوم من الشهر
  const countsByDay = {};
  db.orders.forEach(o=>{
    if(o.status==='تم التسليم' || !o.dateDelivery) return;
    if(o.dateDelivery.slice(0,7)!==calendarMonth) return;
    countsByDay[o.dateDelivery] = (countsByDay[o.dateDelivery]||0)+1;
  });

  let cells = '';
  for(let i=0;i<startWeekday;i++){ cells += `<div></div>`; }
  for(let d=1; d<=daysInMonth; d++){
    const dateStr = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const count = countsByDay[dateStr]||0;
    const isToday = dateStr===today;
    const isSelected = dateStr===calendarSelectedDay;
    const off = isDayOff(dateStr);
    const isHoliday = (db.holidays||[]).some(h=>h.date===dateStr);
    cells += `<div onclick="selectCalendarDay('${dateStr}')" style="
        cursor:pointer;text-align:center;padding:6px 2px;border-radius:10px;position:relative;
        background:${isSelected?'var(--primary)':(isToday?'var(--primary-light)':'transparent')};
        color:${isSelected?'#fff':(off?'var(--danger)':'var(--text)')};
        font-weight:${isToday||isSelected?'800':'500'};font-size:13px;">
        ${isHoliday?'<span style="position:absolute;top:0;left:2px;font-size:9px;">🎉</span>':''}
        ${d}
        ${count>0?`<div style="position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:6px;height:6px;border-radius:50%;background:${isSelected?'#fff':'var(--accent)'};"></div>`:''}
      </div>`;
  }

  box.innerHTML = `
    <div class="card">
      <div class="row" style="margin-bottom:10px;">
        <button class="btn sm outline" onclick="changeCalendarMonth(-1)">◀</button>
        <h3 style="font-size:15px;">📅 ${monthLabel}</h3>
        <button class="btn sm outline" onclick="changeCalendarMonth(1)">▶</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px;">
        ${WEEKDAY_NAMES_AR.map(n=>`<div style="text-align:center;font-size:11px;color:var(--muted);font-weight:700;">${n[0]}</div>`).join('')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;">${cells}</div>
      ${calendarSelectedDay?`<button class="btn sm outline" style="margin-top:10px;" onclick="selectCalendarDay(null)">✕ إلغاء التصفية (${fmtDate(calendarSelectedDay)})</button>`:''}
    </div>
  `;
}

function changeCalendarMonth(delta){
  const [y,m] = calendarMonth.split('-').map(Number);
  const d = new Date(y, m-1+delta, 1);
  calendarMonth = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  renderDeliveriesCalendar();
}

function selectCalendarDay(dateStr){
  calendarSelectedDay = (calendarSelectedDay===dateStr) ? null : dateStr;
  renderDeliveriesCalendar();
  renderDeliveriesList();
}

function renderDeliveries(){
  renderDeliveriesCalendar();
  renderDeliveriesList();
}

function renderDeliveriesList(){
  let list = db.orders.filter(o=>o.status!=='تم التسليم').slice().sort((a,b)=>(a.dateDelivery||'').localeCompare(b.dateDelivery||''));
  if(calendarSelectedDay){ list = list.filter(o=>o.dateDelivery===calendarSelectedDay); }
  const today = todayStr();
  const html = list.map(o=>{
    const c = customerById(o.customerId);
    const diffDays = Math.round((new Date(o.dateDelivery) - new Date(today))/86400000);
    let daysTxt = '';
    if(diffDays<0) daysTxt = `<span class="tag-late-text">متأخر ${Math.abs(diffDays)} يوم</span>`;
    else if(diffDays===0) daysTxt = `<span style="color:var(--warn);font-weight:700;">التسليم اليوم</span>`;
    else daysTxt = `<span style="color:var(--primary);font-weight:700;">باقي ${diffDays} يوم</span>`;
    const onDayOff = isDayOff(o.dateDelivery);
    return `<div class="card">
      <div class="row">
        <h3 class="name-row">${avatarChip(c?c.name:'؟')}${c?escapeHtml(c.name):'عميل محذوف'}</h3>
        ${statusBadge(o)}
      </div>
      <div class="meta">👗 ${escapeHtml(orderTypeLabel(o))}</div>
      <div class="meta">📅 تاريخ التسليم: ${fmtDate(o.dateDelivery)} — ${daysTxt}</div>
      ${onDayOff?`<div class="meta" style="color:var(--danger);">⚠️ الموعد ده يصادف ${dayOffLabel(o.dateDelivery)} (يوم إجازة) — يُفضّل التنسيق مع العميل</div>`:''}
      <div class="btn-row">
        <button class="btn sm accent" onclick="sendReminder('${o.id}')">🔔 تذكير واتساب</button>
      </div>
    </div>`;
  }).join('');
  document.getElementById('deliveriesList').innerHTML = html || `<div class="empty-msg">${calendarSelectedDay?'لا توجد مواعيد تسليم في هذا اليوم':'لا توجد مواعيد تسليم قادمة'}</div>`;
}

/* ============================================================
   المالية
   ============================================================ */
function renderFinance(){
  const today = todayStr();
  const sevenDaysAgo = new Date(Date.now()-6*86400000).toISOString().slice(0,10);
  const yearMonth = today.slice(0,7);
  const year = today.slice(0,4);

  const revenueToday = db.payments.filter(p=>p.date===today).reduce((s,p)=>s+Number(p.amount||0),0);
  const revenue7 = db.payments.filter(p=>p.date>=sevenDaysAgo).reduce((s,p)=>s+Number(p.amount||0),0);
  const totalFees = db.orders.reduce((s,o)=>s+orderTotal(o),0);
  const totalCollected = db.payments.reduce((s,p)=>s+Number(p.amount||0),0);
  const totalRemaining = totalFees-totalCollected;

  const collectedMonth = db.payments.filter(p=>p.date.slice(0,7)===yearMonth).reduce((s,p)=>s+Number(p.amount||0),0);
  const expensesMonth = db.expenses.filter(e=>e.date.slice(0,7)===yearMonth).reduce((s,e)=>s+Number(e.amount||0),0);
  const netMonth = collectedMonth-expensesMonth;

  const collectedYear = db.payments.filter(p=>p.date.slice(0,4)===year).reduce((s,p)=>s+Number(p.amount||0),0);
  const expensesYear = db.expenses.filter(e=>e.date.slice(0,4)===year).reduce((s,e)=>s+Number(e.amount||0),0);
  const netYear = collectedYear-expensesYear;

  const totalMaterialCost = db.orders.reduce((s,o)=>s+(Number(o.materialCost)||0),0);
  const trueNetProfit = totalFees - totalMaterialCost - db.expenses.reduce((s,e)=>s+Number(e.amount||0),0);

  document.getElementById('financeStats').innerHTML = `
    <div class="stat-card"><div class="stat-ic">💰</div><div><div class="num">${revenueToday.toLocaleString('ar-EG')}</div><div class="lbl">إيراد اليوم</div></div></div>
    <div class="stat-card"><div class="stat-ic">📈</div><div><div class="num">${revenue7.toLocaleString('ar-EG')}</div><div class="lbl">إيراد آخر 7 أيام</div></div></div>
    <div class="stat-card"><div class="stat-ic">🧵</div><div><div class="num">${totalFees.toLocaleString('ar-EG')}</div><div class="lbl">إجمالي أجور التفصيل</div></div></div>
    <div class="stat-card"><div class="stat-ic">✅</div><div><div class="num">${totalCollected.toLocaleString('ar-EG')}</div><div class="lbl">إجمالي المحصّل</div></div></div>
    <div class="stat-card danger"><div class="stat-ic">⏳</div><div><div class="num">${totalRemaining.toLocaleString('ar-EG')}</div><div class="lbl">إجمالي المتبقي</div></div></div>
    <div class="stat-card ${netMonth<0?'danger':''}"><div class="stat-ic">📆</div><div><div class="num">${netMonth.toLocaleString('ar-EG')}</div><div class="lbl">صافي الشهر (بعد المصروفات)</div></div></div>
    <div class="stat-card ${netYear<0?'danger':''}"><div class="stat-ic">🗓️</div><div><div class="num">${netYear.toLocaleString('ar-EG')}</div><div class="lbl">صافي السنة (بعد المصروفات)</div></div></div>
    <div class="stat-card"><div class="stat-ic">🧶</div><div><div class="num">${totalMaterialCost.toLocaleString('ar-EG')}</div><div class="lbl">إجمالي تكلفة الخامة</div></div></div>
    <div class="stat-card ${trueNetProfit<0?'danger':''}"><div class="stat-ic">💎</div><div><div class="num">${trueNetProfit.toLocaleString('ar-EG')}</div><div class="lbl">صافي الربح الحقيقي (أجور - خامة - مصروفات)</div></div></div>
  `;

  renderAdvancedAnalytics();
  renderWorkshopInsights();
  renderDebtsList();
  const lastPays = db.payments.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);
  document.getElementById('lastPayments').innerHTML = lastPays.length ? lastPays.map(p=>{
    const o = db.orders.find(x=>x.id===p.orderId);
    const c = o ? customerById(o.customerId) : null;
    return `<div class="card">
      <div class="row">
        <h3>${c?escapeHtml(c.name):'عميل'}</h3>
        <b style="color:var(--primary)">${Number(p.amount).toLocaleString('ar-EG')} ج.م</b>
      </div>
      <div class="meta">📅 ${fmtDate(p.date)}${o?' — '+escapeHtml(orderTypeLabel(o)):''}</div>
    </div>`;
  }).join('') : `<div class="empty-msg">لا توجد دفعات مسجلة بعد</div>`;

  renderRevenueChart();
  populateMonthSelect();
  renderMonthlyReport();
}

function renderPersonalPage(){
  renderPersonalAlerts();
  renderRequiredCapacityCard();
  commitmentsListShowCount = 8;
  renderCommitments();
  houseExpensesListShowCount = 8;
  renderHouseExpenses();
  commitmentPaymentsLogShowCount = 15;
  renderCommitmentPaymentsLog();
  renderCommitmentsSettingsCard();
  populatePersonalMonthSelect();
  renderPersonalCommitmentsReport();
  showPersonalTab(personalActiveTab); // يحافظ على آخر تاب كان مفتوح بدل ما يرجّع لـ"نظرة عامة" كل مرة
}

// تبديل التابات الفرعية لصفحة "التزاماتي الشخصية" (نظرة عامة / القائمة / التقارير / إعدادات)
function showPersonalTab(tab){
  personalActiveTab = tab;
  document.querySelectorAll('#page-personal .personal-tab-content').forEach(el=>{
    el.classList.toggle('active', el.id === 'personalTab-'+tab);
  });
  document.querySelectorAll('#personalTabs .settings-tab-btn').forEach(b=>{
    b.classList.toggle('active', b.getAttribute('data-personal-tab')===tab);
  });
  // إعادة رسم أي محتوى بصري (زي رسم بياني) لو كان جوه تاب متخفي وقت أول رسم،
  // عشان الـ canvas مايطلعش فاضي بسبب إنه كان display:none وقت الرسم الأول
  if(tab==='list' && typeof renderHouseExpenses==='function') renderHouseExpenses();
}

function populatePersonalMonthSelect(){
  const sel = document.getElementById('personalMonthSelect');
  if(!sel) return;
  let opts = '';
  const now = new Date();
  for(let i=0;i<12;i++){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const val = d.toISOString().slice(0,7);
    const label = d.toLocaleDateString('ar-EG',{month:'long', year:'numeric'});
    opts += `<option value="${val}">${label}</option>`;
  }
  const prev = sel.value;
  sel.innerHTML = opts;
  sel.value = prev || now.toISOString().slice(0,7);
}

/* ============================================================
   الالتزامات الشخصية: أقساط شهرية ثابتة + مصاريف بيت يومية
   الهدف: نحسب "الحد الأدنى المطلوب تكسبه يوميًا من الورشة" عشان
   يغطي التزاماتك الشخصية، ونقدر نربطه بسعة العمل اليومية اللي
   بيتبني عليها اقتراح مواعيد التسليم. البيانات دي شخصية بحتة
   ومنفصلة تمامًا عن مصروفات الورشة (db.expenses) عشان مايتأثرش
   بيها حساب صافي ربح الورشة الحقيقي. القسم ده محمي أصلاً بنفس
   قفل صفحة المالية المستقل (db.financePassword).
   ============================================================ */

// بيحسب عدد أيام الشغل الفعلية (يستبعد يوم إجازتك الأسبوعي) في آخر n يوم
function workDaysInLastNDays(n){
  let count=0;
  for(let i=0;i<n;i++){
    const d = new Date(Date.now()-i*86400000);
    if(!isDayOff(d)) count++;
  }
  return Math.max(count,1);
}

// نصيب أي التزام شهريًا: الالتزامات العادية بقيمتها كاملة، أما الالتزامات
// غير الشهرية (كل 3/6/12 شهر عبر intervalMonths) فبنقسم قيمتها على دورتها
// عشان نوزّع تكلفتها على شهور الدورة كلها بدل ما تتحسب مرة واحدة بس
function commitmentMonthlyShare(c){
  const interval = Number(c.intervalMonths)||1;
  return Number(c.amount||0) / Math.max(1, interval);
}

// نصيب القروض الشخصية شهريًا (بند 34) — منفصلة عن db.commitments لكن لازم
// تدخل في حساب الاحتياج اليومي زي أي التزام تاني، وإلا هيبقى الرقم ناقص
function personalLoansMonthlyShare(){
  return (db.personalLoans||[]).filter(l=>l.active!==false).reduce((s,l)=>s+Number(l.monthlyPayment||0),0);
}

function calcRequiredDailyCapacity(){
  const monthlyCommitments = (db.commitments||[]).filter(c=>c.active!==false).reduce((s,c)=>s+commitmentMonthlyShare(c),0);
  const loanMonthly = personalLoansMonthlyShare();
  const wdays = workDaysInLastNDays(30); // متوسط أيام الشغل في الشهر
  const commitmentsPerDay = (monthlyCommitments+loanMonthly) / wdays;

  const since = new Date(Date.now()-29*86400000).toISOString().slice(0,10);
  const houseRecent = (db.houseExpenses||[]).filter(e=>e.date>=since);
  const houseTotal = houseRecent.reduce((s,e)=>s+Number(e.amount||0),0);
  const housePerDay = houseTotal / 30;

  const total = commitmentsPerDay + housePerDay;
  return {monthlyCommitments, loanMonthly, wdays, commitmentsPerDay, houseTotal, housePerDay, total};
}

function renderRequiredCapacityCard(){
  const box = document.getElementById('requiredCapacityCard');
  if(!box) return;
  const r = calcRequiredDailyCapacity();
  const currentCapacity = Number(db.dailyCapacity)||500;
  const hasData = r.monthlyCommitments>0 || r.houseTotal>0 || r.loanMonthly>0;
  if(!hasData){
    box.innerHTML = `<div class="card"><div class="empty-msg">أضف التزاماتك الشهرية ومصاريف بيتك اليومية تحت، وهنحسبلك تلقائي قد إيه محتاج تكسب يوميًا من الورشة.</div></div>`;
    return;
  }
  const diff = r.total - currentCapacity;
  box.innerHTML = `
    <div class="card" style="${diff>0?'border-right:4px solid var(--danger);':''}">
      <div class="row"><h3>💡 الحد الأدنى المطلوب يوميًا من الورشة</h3><b style="color:${diff>0?'var(--danger)':'var(--primary)'};font-size:18px;">${Math.ceil(r.total).toLocaleString('ar-EG')} ج.م</b></div>
      <div class="meta" style="line-height:1.8;">
        📌 نصيب الأقساط/الالتزامات الثابتة يوميًا (شامل أي بند "💰 ادخار" مسجّل، ومحسوب بالتناسب لأي التزام غير شهري): ${Math.ceil((r.monthlyCommitments)/r.wdays).toLocaleString('ar-EG')} ج.م (من إجمالي ${Math.round(r.monthlyCommitments).toLocaleString('ar-EG')} ج.م شهريًا ÷ ${r.wdays} يوم شغل)<br>
        ${r.loanMonthly>0?`💳 نصيب أقساط القروض الشخصية يوميًا: ${Math.ceil(r.loanMonthly/r.wdays).toLocaleString('ar-EG')} ج.م (من إجمالي ${Math.round(r.loanMonthly).toLocaleString('ar-EG')} ج.م شهريًا)<br>`:''}
        🏠 متوسط مصاريف البيت اليومية (آخر 30 يوم): ${Math.round(r.housePerDay).toLocaleString('ar-EG')} ج.م
      </div>
      ${diff>0
        ? `<div class="meta" style="color:var(--danger);margin-top:6px;">⚠️ سعتك اليومية المسجلة حاليًا (${currentCapacity.toLocaleString('ar-EG')} ج.م) أقل من المطلوب بـ ${Math.ceil(diff).toLocaleString('ar-EG')} ج.م</div>`
        : `<div class="meta" style="color:var(--primary);margin-top:6px;">✅ سعتك اليومية المسجلة حاليًا (${currentCapacity.toLocaleString('ar-EG')} ج.م) كافية لالتزاماتك</div>`
      }
      <button class="btn sm outline" style="margin-top:8px;" onclick="applyRequiredCapacityToSettings()">📥 استخدم الرقم ده كسعة يومية (بيأثر على اقتراح مواعيد التسليم)</button>
    </div>
  `;
}

async function applyRequiredCapacityToSettings(){
  const r = calcRequiredDailyCapacity();
  const val = Math.ceil(r.total);
  if(val<=0){ toast('لا يوجد بيانات كافية بعد'); return; }
  if(!await appConfirm(`هيتم تحديث السعة اليومية إلى ${val.toLocaleString('ar-EG')} ج.م، وده هيأثر على اقتراح مواعيد التسليم الجديدة. متأكد؟`)) return;
  db.dailyCapacity = val;
  const input = document.getElementById('dailyCapacityInput');
  if(input) input.value = val;
  saveDB();
  renderRequiredCapacityCard();
  toast('✅ اتحدثت السعة اليومية');
}

/* ============================================================
   قسم منفصل في الشاشة الرئيسية: تنبيهات الالتزامات الشخصية
   (مواعيد الأقساط، مصروف بيت غير طبيعي، تقدّم الشهر، الفائض
   المتاح، اقتراح تأجيل التزامات، وسيناريو "لو غبت يوم شغل").
   منفصل تمامًا عن renderHomeAlerts (تنبيهات الورشة) عشان
   ميتلخبطش مع بعض، ومحمي بنفس قفل صفحة المالية.
   ============================================================ */

function currentYM(){ return todayStr().slice(0,7); }

// فرق الشهور بين شهرين بصيغة 'YYYY-MM'
function diffMonthsYM(fromYM, toYM){
  const [fy,fm] = fromYM.split('-').map(Number);
  const [ty,tm] = toYM.split('-').map(Number);
  return (ty-fy)*12 + (tm-fm);
}

// بيضيف n شهر على شهر بصيغة 'YYYY-MM' ويرجّع نفس الصيغة
function addMonthsYM(ym, n){
  const [y,m] = ym.split('-').map(Number);
  const total = (y*12+(m-1))+n;
  const ny = Math.floor(total/12), nm = (total%12)+1;
  return ny+'-'+String(nm).padStart(2,'0');
}

// هل الشهر ده (ym) هو شهر استحقاق فعلي لالتزام غير شهري (كل 3/6/12 شهر)؟
// الالتزامات الشهرية العادية (intervalMonths=1 أو مش متسجل) مستحقة كل شهر
// زي ما هو معتاد. أما غير الشهرية فبتستحق بس كل N شهر بدءًا من cycleStartYM
// (أو الشهر الحالي وقت إضافتها لو مالهاش شهر بداية محدد).
function isCommitmentCycleMonth(c, ym){
  const interval = Number(c.intervalMonths)||1;
  if(interval<=1) return true;
  const anchor = c.cycleStartYM || currentYM();
  const diff = diffMonthsYM(anchor, ym);
  if(diff<0) return false; // لسه قبل أول استحقاق للالتزام ده
  return diff % interval === 0;
}

// بينزّل عداد "باقي كام شهر" لأي التزام له مدة محددة، مرة واحدة لكل شهر
// جديد (بيحسب كل الشهور اللي فاتت من غير ما تفتح التطبيق كمان). لما العداد
// يوصل صفر، الالتزام بيتوقف تلقائياً (active=false) زي ما لو دفعته وخلص.
function rolloverCommitmentsMonthly(){
  const nowYM = currentYM();
  if(!db.lastCommitmentsMonthCheck){ db.lastCommitmentsMonthCheck = nowYM; return; }
  const elapsed = diffMonthsYM(db.lastCommitmentsMonthCheck, nowYM);
  if(elapsed<=0) return;
  const prevYM = db.lastCommitmentsMonthCheck;
  if(!db.missedCommitmentNotices) db.missedCommitmentNotices=[];
  (db.commitments||[]).forEach(c=>{
    // فاتك تعليم الدفع؟ (بس للأقساط اللي ليها يوم استحقاق ومكانتش متعلّمة كمدفوعة قبل ما الشهر يخلص،
    // وبس لو الشهر اللي فات ده أصلاً شهر استحقاق فعلي للالتزام ده — عشان الالتزامات غير الشهرية
    // متتحسبش "فاتتك" في شهور مش من حقها)
    if(c.active!==false && c.dueDay && c.lastPaidMonth!==prevYM && isCommitmentCycleMonth(c, prevYM)){
      db.missedCommitmentNotices.push({id:uid(), commitmentId:c.id, desc:c.desc, amount:c.amount, type:c.type||'تانية', month:prevYM});
    }
    if(c.remainingMonths!=null && c.active!==false){
      c.remainingMonths = Math.max(0, c.remainingMonths - elapsed);
      if(c.remainingMonths===0){
        c.active = false;
        logActivity(`🏁 انتهت مدة الالتزام تلقائياً: ${c.desc}`);
      }
    }
  });
  if(db.missedCommitmentNotices.length>50) db.missedCommitmentNotices = db.missedCommitmentNotices.slice(-50);
  db.lastCommitmentsMonthCheck = nowYM;
  saveDB();
}

// تاريخ استحقاق القسط في شهر مرجعي معين (بصيغة نص 'YYYY-MM-DD')، مع مراعاة
// إن يوم الاستحقاق ممكن يكون أكبر من عدد أيام الشهر (زي يوم 31 في فبراير)
function commitmentDueDateStr(c, refStr){
  refStr = refStr || todayStr();
  const [y,m] = refStr.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const day = Math.min(Number(c.dueDay), lastDay);
  return `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

// عدد الأيام المتبقية لاستحقاق الالتزام (سالب لو فات موعده)، أو null لو مالوش يوم استحقاق
// أو كان متدفوع بالفعل الشهر ده (يبقى مالوش استحقاق "قريب" حاليًا)
function commitmentDaysUntilDue(c){
  if(!c.dueDay || c.lastPaidMonth===currentYM()) return null;
  if(!isCommitmentCycleMonth(c, currentYM())) return null; // التزام غير شهري ومش مستحق الشهر ده
  const due = commitmentDueDateStr(c);
  return Math.round((new Date(due)-new Date(todayStr()))/86400000);
}

// الأقساط اللي مستحقة خلال 3 أيام أو متأخرة، ولسه ملحّقتش تتعلّم كمدفوعة الشهر ده
function getCommitmentDueAlerts(){
  const today = todayStr();
  const nowYM = currentYM();
  const alerts = [];
  (db.commitments||[]).filter(c=>c.active!==false && c.dueDay).forEach(c=>{
    if(c.lastPaidMonth===nowYM) return;
    if(!isCommitmentCycleMonth(c, nowYM)) return; // مش شهر استحقاق للالتزام ده (غير شهري)
    const due = commitmentDueDateStr(c);
    const diff = Math.round((new Date(due)-new Date(today))/86400000);
    if(diff<=3) alerts.push({c, diff, due});
  });
  return alerts.sort((a,b)=>a.diff-b.diff);
}

// هل مصروف بيت النهاردة أعلى بكتير من المتوسط المعتاد؟ (محتاج على الأقل
// 10 أيام بيانات سابقة عشان "المتوسط" يبقى موثوق فيه ومنتجنبش إنذارات كاذبة)
function houseExpenseAnomalyToday(){
  const today = todayStr();
  const todayTotal = (db.houseExpenses||[]).filter(e=>e.date===today).reduce((s,e)=>s+Number(e.amount||0),0);
  if(todayTotal<=0) return null;
  const since = new Date(Date.now()-59*86400000).toISOString().slice(0,10);
  const priorDays = {};
  (db.houseExpenses||[]).filter(e=>e.date>=since && e.date<today).forEach(e=>{
    priorDays[e.date] = (priorDays[e.date]||0) + Number(e.amount||0);
  });
  const days = Object.keys(priorDays);
  const minDays = Number(db.houseExpenseAlertMinDays)||10;
  if(days.length<minDays) return null;
  const avg = days.reduce((s,d)=>s+priorDays[d],0)/days.length;
  const percent = Number(db.houseExpenseAlertPercent)||50;
  if(avg<=0 || todayTotal < avg*(1+percent/100)) return null;
  return {todayTotal, avg};
}

// شريط تقدّم الشهر: كسبت كام من إجمالي المطلوب لتغطية التزاماتك الشهر ده
function monthlyCommitmentProgress(){
  const r = calcRequiredDailyCapacity();
  const requiredMonthly = r.monthlyCommitments + r.loanMonthly + r.housePerDay*30;
  if(requiredMonthly<=0) return null;
  const yearMonth = currentYM();
  const collectedMonth = db.payments.filter(p=>p.date.slice(0,7)===yearMonth).reduce((s,p)=>s+Number(p.amount||0),0);
  const pct = Math.min(100, Math.round(collectedMonth/requiredMonthly*100));
  return {requiredMonthly, collectedMonth, pct};
}

// الفائض المتاح: هل إيراد النهاردة عدّى احتياجك اليومي ولا لسه ناقص؟
function todaySurplus(){
  const r = calcRequiredDailyCapacity();
  if(r.total<=0) return null;
  const revenueToday = db.payments.filter(p=>p.date===todayStr()).reduce((s,p)=>s+Number(p.amount||0),0);
  return {revenueToday, required:r.total, surplus:revenueToday-r.total};
}

// اقتراح تأجيل الالتزامات "ممكن تتأجل" لو سعتك اليومية الحالية أقل من المطلوب
function deferrableSuggestion(){
  const r = calcRequiredDailyCapacity();
  if(r.total<=0) return null;
  const currentCapacity = Number(db.dailyCapacity)||500;
  if(currentCapacity >= r.total) return null;
  const deferrable = (db.commitments||[]).filter(c=>c.active!==false && c.priority==='deferrable');
  if(!deferrable.length) return null;
  const deferrableTotal = deferrable.reduce((s,c)=>s+commitmentMonthlyShare(c),0);
  const reducedTotal = r.total - (deferrableTotal/r.wdays);
  return {count:deferrable.length, deferrableTotal, reducedTotal, currentTotal:r.total};
}

// التزامات هتخلص قريب (باقي شهرين أو أقل)
function endingSoonCommitments(){
  return (db.commitments||[]).filter(c=>c.active!==false && c.remainingMonths!=null && c.remainingMonths>0 && c.remainingMonths<=2);
}

// تعليم قسط كمدفوع لهذا الشهر — بيوقف تنبيه استحقاقه لحد الشهر الجاي
function markCommitmentPaidThisMonth(id){
  const c = (db.commitments||[]).find(x=>x.id===id);
  if(!c) return;
  const before = c.lastPaidMonth;
  c.lastPaidMonth = currentYM();
  if(!db.commitmentPayments) db.commitmentPayments=[];
  const paymentRecord = {id:uid(), commitmentId:c.id, desc:c.desc, amount:c.amount, type:c.type||'تانية', date:todayStr(), month:currentYM()};
  db.commitmentPayments.push(paymentRecord);
  if(db.commitmentPayments.length>200) db.commitmentPayments = db.commitmentPayments.slice(-200);
  saveDB();
  setUndo('تعليم القسط كمدفوع', ()=>{
    c.lastPaidMonth = before;
    db.commitmentPayments = db.commitmentPayments.filter(p=>p.id!==paymentRecord.id);
    saveDB();
    renderPersonalAlerts();
    renderCommitments();
    renderCommitmentPaymentsLog();
    renderPersonalCommitmentsReport();
  });
  renderPersonalAlerts();
  renderCommitments();
  renderCommitmentPaymentsLog();
  renderPersonalCommitmentsReport();
  toast('تم ✅');
}

// إقرار بإشعار "فاتك تعليم دفع الشهر اللي فات" — وإختياريًا تسجيله فعليًا كدفعة فات ميعادها
function acknowledgeMissedCommitmentNotice(id, alsoLogPaid){
  const n = (db.missedCommitmentNotices||[]).find(x=>x.id===id);
  if(!n) return;
  if(alsoLogPaid){
    if(!db.commitmentPayments) db.commitmentPayments=[];
    db.commitmentPayments.push({id:uid(), commitmentId:n.commitmentId, desc:n.desc, amount:n.amount, type:n.type||'تانية', date:todayStr(), month:n.month});
  }
  db.missedCommitmentNotices = (db.missedCommitmentNotices||[]).filter(x=>x.id!==id);
  saveDB();
  renderPersonalAlerts();
  renderCommitmentPaymentsLog();
  renderPersonalCommitmentsReport();
  toast(alsoLogPaid?'✅ اتسجلت الدفعة':'تمام');
}

// تجاهل جماعي لأقدم إشعارات "فاتك تعليم دفع" المتراكمة (بيسيب أحدث 5 بس ظاهرين فرادى)
function dismissOldMissedNotices(){
  const sorted = (db.missedCommitmentNotices||[]).slice().sort((a,b)=>b.month.localeCompare(a.month));
  const keepIds = new Set(sorted.slice(0,5).map(n=>n.id));
  db.missedCommitmentNotices = (db.missedCommitmentNotices||[]).filter(n=>keepIds.has(n.id));
  saveDB();
  renderPersonalAlerts();
  toast('تم تجاهل الإشعارات القديمة');
}

// سجل دفعات الأقساط (تاريخ فعلي لكل مرة اتعلّم فيها القسط كمدفوع)
function renderCommitmentPaymentsLog(){
  const box = document.getElementById('commitmentPaymentsLog');
  renderSavingsGoalCard();
  if(!box) return;
  const all = (db.commitmentPayments||[]).slice().sort((a,b)=>b.date.localeCompare(a.date));
  const list = all.slice(0, commitmentPaymentsLogShowCount);
  const rows = list.length ? list.map(p=>`
    <div class="card">
      <div class="row">
        <h3>${escapeHtml(p.desc)}</h3>
        <b style="color:var(--ok)">${Number(p.amount).toLocaleString('ar-EG')} ج.م</b>
      </div>
      <div class="meta">📅 ${fmtDate(p.date)}</div>
      <div class="btn-row">
        <button class="btn sm outline" onclick="editCommitmentPayment('${p.id}')">✏️ تعديل</button>
        <button class="btn sm danger" onclick="deleteCommitmentPayment('${p.id}')">🗑️ حذف</button>
      </div>
    </div>
  `).join('') : `<div class="empty-msg">لسه معملتش أي دفعة قسط بزرار "✅ اتدفع الشهر ده"</div>`;
  const more = all.length>list.length ? `<button class="btn sm outline" style="margin-top:6px;" onclick="showMoreCommitmentPayments()">⬇️ عرض المزيد (${all.length-list.length} متبقي)</button>` : '';
  box.innerHTML = rows + more;
}

function showMoreCommitmentPayments(){
  commitmentPaymentsLogShowCount += 15;
  renderCommitmentPaymentsLog();
}

/* ---- هدف الادخار: بند "💰 ادخار" جوه نفس قائمة الالتزامات، والمتجمّع
   بيتحسب من سجل الدفعات نفسه (نفس زرار "✅ اتدفع الشهر ده") من غير عداد منفصل
   عشان نضمن إنه دايمًا متطابق مع السجل، حتى لو السجل اتعدّل أو اتحذف منه دفعة ---- */
// إجمالي المُدّخر لهدف الادخار الحالي: من سجل دفعات بند "💰 ادخار" مطروحًا
// منه أي مبلغ اترحّل بالفعل لصندوق الطوارئ (عشان لما ترحّل هدف محقق، العداد
// يرجع يبدأ من الصفر للهدف الجديد بدل ما يفضل شايل رصيد قديم اترحّل بالفعل)
function totalSavedAmount(){
  const raw = (db.commitmentPayments||[]).filter(p=>p.type==='ادخار').reduce((s,p)=>s+Number(p.amount||0),0);
  return Math.max(0, raw - Number(db.savingsGoalTransferredAmount||0));
}

// ترحيل رصيد هدف الادخار الحالي (كله أو اللي اتجمع لحد دلوقتي) لصندوق
// الطوارئ — بيربط المفهومين ببعض بدل ما يفضلوا منفصلين تمامًا: هدف الادخار
// بيتجمع لغرض معيّن، ولما يتحقق (أو حتى قبل كده) تقدر ترحّله كاحتياطي جاهز
function transferSavingsToEmergencyFund(){
  const saved = totalSavedAmount();
  if(saved<=0){ toast('لا يوجد مبلغ للترحيل دلوقتي'); return; }
  db.emergencyFundBalance = Number(db.emergencyFundBalance||0) + saved;
  db.savingsGoalTransferredAmount = Number(db.savingsGoalTransferredAmount||0) + saved;
  saveDB();
  renderSavingsGoalCard();
  if(typeof renderEmergencyFundCard==='function') renderEmergencyFundCard();
  if(typeof renderFinancialHealthDashboard==='function') renderFinancialHealthDashboard();
  toast(`✅ اترحّل ${saved.toLocaleString('ar-EG')} ج.م لصندوق الطوارئ`);
}

function renderSavingsGoalCard(){
  const box = document.getElementById('savingsGoalCard');
  if(!box) return;
  const target = Number(db.savingsGoalTarget)||0;
  const saved = totalSavedAmount();
  const linkNote = `<div class="meta" style="margin-top:6px;">ℹ️ هدف الادخار لغرض بتحدده بمبلغ معيّن، وصندوق الطوارئ احتياطي جاهز لو الدخل وقف فجأة — لما توصل لهدفك (أو حتى قبل كده) ينفع ترحّل اللي اتجمع لصندوق الطوارئ.</div>`;
  if(!target && !saved){
    box.innerHTML = `
      <div class="row"><h3>🎯 هدف الادخار</h3></div>
      <div class="meta">حدد مبلغ تستهدف توفيره (زي مصاريف طوارئ لكذا شهر) وتابع تقدمك هنا. سجّل التوفير الشهري كبند "💰 ادخار" فوق واضغط "✅ اتدفع الشهر ده" عشان يتحسب هنا.</div>
      <div class="btn-row" style="margin-top:8px;"><button class="btn sm outline" onclick="openSavingsGoalModal()">🎯 تحديد هدف</button></div>
      ${linkNote}
    `;
    return;
  }
  const pct = target ? Math.min(100, Math.round(saved/target*100)) : 0;
  const goalReached = target>0 && saved>=target;
  box.innerHTML = `
    <div class="row"><h3>🎯 هدف الادخار</h3><button class="btn sm outline" onclick="openSavingsGoalModal()">✏️ تعديل الهدف</button></div>
    <div class="meta">اتجمع <b style="color:var(--ok)">${saved.toLocaleString('ar-EG')} ج.م</b>${target?` من ${target.toLocaleString('ar-EG')} ج.م (${pct}%)`:' — لسه محدّدتش هدف بمبلغ'}</div>
    ${target ? `<div class="savings-progress-track"><div class="savings-progress-fill" style="width:${pct}%;"></div></div>` : ''}
    ${goalReached ? `<div class="meta" style="color:var(--primary);margin-top:6px;">🎉 مبروك، حققت هدف الادخار!</div>` : ''}
    ${saved>0 ? `<div class="btn-row" style="margin-top:8px;"><button class="btn sm outline" onclick="transferSavingsToEmergencyFund()">🧳 رحّل ${saved.toLocaleString('ar-EG')} ج.م لصندوق الطوارئ</button></div>` : ''}
    ${linkNote}
  `;
}

function openSavingsGoalModal(){
  const html = `
    <div class="modal-head"><h3>🎯 هدف الادخار</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="field"><label>المبلغ المستهدف (ج.م)</label><input id="f_savingsTarget" type="number" min="0" placeholder="مثال: 15000" value="${db.savingsGoalTarget?db.savingsGoalTarget:''}"></div>
    <div class="meta">اقتراح: تقدر تحسبه كـ 3 أشهر من (إجمالي التزاماتك الشهرية + متوسط مصروف بيتك).</div>
    <button class="btn" onclick="saveSavingsGoal()">💾 حفظ</button>
  `;
  openModal(html);
}

function saveSavingsGoal(){
  const target = Math.max(0, Number(document.getElementById('f_savingsTarget').value)||0);
  db.savingsGoalTarget = target;
  saveDB();
  closeModal();
  renderSavingsGoalCard();
  toast('تم الحفظ ✅');
}

function editCommitmentPayment(id){
  const p = (db.commitmentPayments||[]).find(x=>x.id===id);
  if(!p) return;
  const html = `
    <div class="modal-head"><h3>✏️ تعديل دفعة "${escapeHtml(p.desc)}"</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="field"><label>المبلغ (ج.م)</label><input id="f_payAmount" type="number" value="${p.amount}"></div>
    <div class="field"><label>تاريخ الدفع</label><input id="f_payDate" type="date" value="${p.date}"></div>
    <button class="btn" onclick="saveCommitmentPaymentEdit('${p.id}')">💾 حفظ</button>
  `;
  openModal(html);
}

function saveCommitmentPaymentEdit(id){
  const p = (db.commitmentPayments||[]).find(x=>x.id===id);
  if(!p) return;
  const amount = Number(document.getElementById('f_payAmount').value)||0;
  const date = document.getElementById('f_payDate').value;
  if(amount<=0){ toast('أدخل مبلغاً صحيحاً'); return; }
  if(!date){ toast('اختر تاريخ الدفع'); return; }
  p.amount = amount;
  p.date = date;
  p.month = date.slice(0,7);
  saveDB();
  closeModal();
  renderCommitmentPaymentsLog();
  renderPersonalCommitmentsReport();
  toast('تم الحفظ ✅');
}

async function deleteCommitmentPayment(id){
  if(!await appConfirm('حذف سجل هذه الدفعة؟')) return;
  const removed = (db.commitmentPayments||[]).find(p=>p.id===id);
  if(!removed) return;
  db.commitmentPayments = db.commitmentPayments.filter(p=>p.id!==id);
  setUndo('حذف سجل الدفعة', ()=>{
    db.commitmentPayments.push(removed);
    saveDB();
    renderCommitmentPaymentsLog();
    renderPersonalCommitmentsReport();
  });
  saveDB();
  renderCommitmentPaymentsLog();
  renderPersonalCommitmentsReport();
  toast('تم الحذف');
}

/* ---- تنبيه محلي (Notification API) على الجهاز لما يبقى فيه قسط مستحق —
   ده إشعار محلي بيشتغل لما التطبيق مفتوح/في الخلفية على المتصفح، مش
   Push حقيقي زي بتاع مواعيد التسليم (اللي محتاج Cloud Function خارجية).
   محتاج نفس إذن الإشعارات (Notification.permission) بس من غير الحاجة
   لإعداد Firebase/VAPID. بيبعت إشعار واحد بس في اليوم عشان ميتكررش. ---- */
async function toggleCommitmentsNotify(checked){
  if(checked){
    if(typeof Notification==='undefined'){
      toast('المتصفح ده مش بيدعم الإشعارات');
      renderCommitmentsSettingsCard();
      return;
    }
    const perm = Notification.permission==='granted' ? 'granted' : await Notification.requestPermission();
    if(perm!=='granted'){
      toast('لازم توافق على إذن الإشعارات من المتصفح عشان تشتغل');
      renderCommitmentsSettingsCard();
      return;
    }
  }
  db.commitmentsNotifyEnabled = checked;
  saveDB();
  renderCommitmentsSettingsCard();
  toast(checked?'✅ اتفعّلت':'تم الإيقاف');
}

function maybeSendLocalCommitmentNotification(dueAlerts){
  if(!db.commitmentsNotifyEnabled) return;
  if(typeof Notification==='undefined' || Notification.permission!=='granted') return;
  if(!dueAlerts || !dueAlerts.length) return;
  if(db.commitmentsLastNotifiedDate===todayStr()) return;
  try{
    const first = dueAlerts[0];
    const title = dueAlerts.length===1 ? `🔔 قسط "${first.c.desc}" مستحق` : `🔔 عندك ${dueAlerts.length} أقساط مستحقة قريب`;
    const body = dueAlerts.length===1
      ? `${Number(first.c.amount).toLocaleString('ar-EG')} ج.م — ${fmtDate(first.due)}`
      : dueAlerts.slice(0,3).map(a=>a.c.desc).join('، ');
    new Notification(title, {body});
    db.commitmentsLastNotifiedDate = todayStr();
    saveDB();
  }catch(e){ /* تجاهل أي خطأ في الإشعار المحلي، مش حرج لباقي الفيتشر */ }
}

// إعدادات مجمّعة: تفعيل الإشعار المحلي + حساسية تنبيه المصروف غير الطبيعي
function saveAnomalySettings(){
  const percentEl = document.getElementById('houseAlertPercentInput');
  const daysEl = document.getElementById('houseAlertMinDaysInput');
  if(!percentEl || !daysEl) return;
  const percent = Math.max(10, Math.min(300, Number(percentEl.value)||50));
  const minDays = Math.max(3, Math.min(60, Number(daysEl.value)||10));
  db.houseExpenseAlertPercent = percent;
  db.houseExpenseAlertMinDays = minDays;
  saveDB();
  renderPersonalAlerts();
  toast('✅ اتحفظت الإعدادات');
}

function renderCommitmentsSettingsCard(){
  const box = document.getElementById('commitmentsSettingsCard');
  if(!box) return;
  const notifyOn = !!db.commitmentsNotifyEnabled;
  box.innerHTML = `
    <div class="row"><h3>⚙️ إعدادات تنبيهات الالتزامات الشخصية</h3></div>
    <div class="field"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
      <input type="checkbox" style="width:18px;height:18px;" ${notifyOn?'checked':''} onchange="toggleCommitmentsNotify(this.checked)"> 🔔 نبّهني بإشعار على الجهاز لما قسط يقرب يستحق (إشعار محلي، مرة في اليوم بحد أقصى)
    </label></div>
    <div class="meta">حساسية تنبيه "مصروف بيت غير طبيعي":</div>
    <div class="field-row2">
      <div class="field"><label>نسبة الزيادة عن المتوسط (%)</label><input id="houseAlertPercentInput" type="number" min="10" max="300" value="${Number(db.houseExpenseAlertPercent)||50}"></div>
      <div class="field"><label>أقل عدد أيام بيانات مطلوب</label><input id="houseAlertMinDaysInput" type="number" min="3" max="60" value="${Number(db.houseExpenseAlertMinDays)||10}"></div>
    </div>
    <button class="btn sm outline" onclick="saveAnomalySettings()">💾 حفظ الإعدادات</button>
  `;
}

// بيجمّع بيانات تقرير الالتزامات الشخصية لشهر معيّن (مستخدمة في العرض والطباعة معاً)
function buildPersonalCommitmentsReportData(month){
  const dueCommitments = (db.commitments||[]).filter(c=>c.dueDay);
  const paidThisMonth = new Set((db.commitmentPayments||[]).filter(p=>p.month===month).map(p=>p.commitmentId));
  const missedIds = new Set((db.missedCommitmentNotices||[]).filter(n=>n.month===month).map(n=>n.commitmentId));
  const totalDue = dueCommitments.reduce((s,c)=>s+Number(c.amount||0),0);
  const totalPaidAmount = (db.commitmentPayments||[]).filter(p=>p.month===month).reduce((s,p)=>s+Number(p.amount||0),0);
  const houseExpensesTotal = (db.houseExpenses||[]).filter(e=>e.date.slice(0,7)===month).reduce((s,e)=>s+Number(e.amount||0),0);
  const rows = dueCommitments.map(c=>{
    const paid = paidThisMonth.has(c.id) || c.lastPaidMonth===month;
    const missed = !paid && missedIds.has(c.id);
    const status = paid ? '✅ اتدفع' : (missed ? '⏮️ فات ميعاده' : '⏳ لسه');
    return {desc:c.desc, amount:Number(c.amount||0), status};
  });
  return {dueCommitments, totalDue, totalPaidAmount, houseExpensesTotal, rows};
}

// تقرير شهري لالتزاماتك الشخصية (بيستخدم نفس اختيار الشهر بتاع التقرير الشهري للورشة)
function renderPersonalCommitmentsReport(){
  const sel = document.getElementById('personalMonthSelect') || document.getElementById('reportMonthSelect');
  const box = document.getElementById('personalCommitmentsReportBody');
  if(!sel || !box) return;
  const month = sel.value || todayStr().slice(0,7);
  const data = buildPersonalCommitmentsReportData(month);
  if(!data.dueCommitments.length && !data.houseExpensesTotal){
    box.innerHTML = `<div class="empty-msg">لا توجد التزامات لها يوم استحقاق محدد، ولا مصروف بيت مسجّل لهذا الشهر.</div>`;
    return;
  }
  const rowsHtml = data.rows.map(r=>`<div class="meta">${escapeHtml(r.desc)} — ${r.amount.toLocaleString('ar-EG')} ج.م — ${r.status}</div>`).join('');
  const grandTotal = data.totalPaidAmount + data.houseExpensesTotal;
  box.innerHTML = `
    <div class="meta">💰 إجمالي المحصَّل من الأقساط الشهر ده: <b>${data.totalPaidAmount.toLocaleString('ar-EG')} ج.م</b> من أصل ${data.totalDue.toLocaleString('ar-EG')} ج.م</div>
    <div class="meta">🏠 إجمالي مصروف البيت المسجَّل الشهر ده: <b>${data.houseExpensesTotal.toLocaleString('ar-EG')} ج.م</b></div>
    <div class="meta">📦 إجمالي التزاماتك الشخصية الفعلي الشهر ده (أقساط مدفوعة + مصروف بيت): <b>${grandTotal.toLocaleString('ar-EG')} ج.م</b></div>
    <hr class="sep">
    ${rowsHtml}
    <button class="btn secondary" style="margin-top:8px;" onclick="printPersonalCommitmentsReport()">🖨️ طباعة / حفظ كـ PDF</button>
  `;
}

function printPersonalCommitmentsReport(){
  const sel = document.getElementById('personalMonthSelect') || document.getElementById('reportMonthSelect');
  const month = sel && sel.value ? sel.value : todayStr().slice(0,7);
  const label = new Date(month+'-01').toLocaleDateString('ar-EG',{month:'long', year:'numeric'});
  const data = buildPersonalCommitmentsReportData(month);
  const grandTotal = data.totalPaidAmount + data.houseExpensesTotal;
  const html = `
    <html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>التزاماتي الشخصية ${label}</title>
    <style>
      body{font-family:Tahoma,Arial,sans-serif;padding:24px;color:#222;}
      h1{font-size:20px;border-bottom:2px solid #1F6D57;padding-bottom:8px;}
      table{width:100%;border-collapse:collapse;margin-top:14px;}
      td{padding:10px 6px;border-bottom:1px solid #ddd;font-size:15px;}
      td.lbl{color:#666;width:55%;}
      td.val{font-weight:bold;}
      .total-row td{font-size:17px;color:#1F6D57;}
    </style></head><body>
      <h1>💳 تقرير الالتزامات الشخصية — ${label}</h1>
      <table>
        ${data.rows.map(r=>`<tr><td class="lbl">${escapeHtml(r.desc)}</td><td class="val">${r.amount.toLocaleString('ar-EG')} ج.م — ${r.status}</td></tr>`).join('')}
        <tr><td class="lbl">إجمالي مصروف البيت الشهر ده</td><td class="val">${data.houseExpensesTotal.toLocaleString('ar-EG')} ج.م</td></tr>
        <tr class="total-row"><td class="lbl">الإجمالي الفعلي (أقساط مدفوعة + مصروف بيت)</td><td class="val">${grandTotal.toLocaleString('ar-EG')} ج.م</td></tr>
      </table>
    </body></html>
  `;
  openPrintWindow(html, 'التزامات_شخصية_'+label);
}

function renderPersonalAlerts(){
  const box = document.getElementById('personalAlerts');
  if(!box) return;
  if(window.userRole==='receptionist'){ box.innerHTML=''; return; }
  if(db.financePassword && !window.financeUnlocked){
    box.innerHTML = `<div class="alert-banner warn"><span class="ic">🔒</span><div><b>تنبيهات التزاماتك الشخصية محمية</b>افتح الصفحة بالرقم السري لعرضها هنا.
      <div class="btn-row" style="margin-top:6px;"><button class="btn sm outline" onclick="openFinanceGate('personal')">🔓 فتح</button></div>
    </div></div>`;
    return;
  }
  const hasData = (db.commitments||[]).length>0 || (db.houseExpenses||[]).length>0;
  if(!hasData){
    box.innerHTML = `<div class="empty-msg">أضف التزاماتك الشهرية ومصاريف بيتك من تاب "📋 القائمة" عشان تظهر هنا تنبيهاتك الشخصية.</div>`;
    return;
  }

  let html = '';

  const dueAlerts = getCommitmentDueAlerts();
  dueAlerts.forEach(a=>{
    const when = a.diff<0 ? `متأخر ${Math.abs(a.diff)} يوم عن موعده (${fmtDate(a.due)})`
      : a.diff===0 ? 'مستحق النهاردة'
      : a.diff===1 ? 'مستحق بكرة'
      : `مستحق خلال ${a.diff} أيام (${fmtDate(a.due)})`;
    html += `<div class="alert-banner ${a.diff<0?'danger':'warn'}">
      <span class="ic">${a.diff<0?'⏰':'🔔'}</span>
      <div><b>قسط "${escapeHtml(a.c.desc)}" — ${Number(a.c.amount).toLocaleString('ar-EG')} ج.م</b>${when}
        <div class="btn-row" style="margin-top:6px;"><button class="btn sm outline" onclick="markCommitmentPaidThisMonth('${a.c.id}')">✅ اتدفع الشهر ده</button></div>
      </div>
    </div>`;
  });
  maybeSendLocalCommitmentNotification(dueAlerts);

  const missedSorted = (db.missedCommitmentNotices||[]).slice().sort((a,b)=>b.month.localeCompare(a.month));
  missedSorted.slice(0,5).forEach(n=>{
    html += `<div class="alert-banner danger"><span class="ic">⏮️</span><div><b>فاتك تعليم دفع قسط "${escapeHtml(n.desc)}" الشهر اللي فات</b>${Number(n.amount).toLocaleString('ar-EG')} ج.م — ${new Date(n.month+'-01').toLocaleDateString('ar-EG',{month:'long', year:'numeric'})}
      <div class="btn-row" style="margin-top:6px;">
        <button class="btn sm outline" onclick="acknowledgeMissedCommitmentNotice('${n.id}', true)">✅ سجّل إني دفعته</button>
        <button class="btn sm outline" onclick="acknowledgeMissedCommitmentNotice('${n.id}', false)">تمام، شفتها</button>
      </div>
    </div></div>`;
  });
  if(missedSorted.length>5){
    html += `<div class="alert-banner warn"><span class="ic">📦</span><div><b>عندك كمان ${missedSorted.length-5} إشعار "فاتك تعليم دفع" أقدم</b>غالبًا تراكموا من فترة ما فتحتش فيها التطبيق.
      <div class="btn-row" style="margin-top:6px;"><button class="btn sm outline" onclick="dismissOldMissedNotices()">🗑️ تجاهل القديم كله</button></div>
    </div></div>`;
  }

  const anomaly = houseExpenseAnomalyToday();
  if(anomaly){
    html += `<div class="alert-banner warn"><span class="ic">📈</span><div><b>مصروف بيت النهاردة أعلى من متوسطك المعتاد</b>النهاردة: ${Math.round(anomaly.todayTotal).toLocaleString('ar-EG')} ج.م، متوسطك المعتاد: ${Math.round(anomaly.avg).toLocaleString('ar-EG')} ج.م. تأكد إن كل حاجة مسجلة صح.</div></div>`;
  }

  endingSoonCommitments().forEach(c=>{
    html += `<div class="alert-banner good"><span class="ic">🏁</span><div><b>التزام "${escapeHtml(c.desc)}" هيخلص بعد ${c.remainingMonths} شهر</b>هتقل التزاماتك الشهرية بـ ${Number(c.amount).toLocaleString('ar-EG')} ج.م بعدها.</div></div>`;
  });

  const prog = monthlyCommitmentProgress();
  if(prog){
    html += `<div class="alert-banner good"><span class="ic">📊</span><div><b>كسبت ${Math.round(prog.collectedMonth).toLocaleString('ar-EG')} من ${Math.round(prog.requiredMonthly).toLocaleString('ar-EG')} ج.م المطلوبين الشهر ده (${prog.pct}%)</b>
      <div class="progress-track"><div class="progress-fill" style="width:${prog.pct}%;"></div></div>
    </div></div>`;
  }

  const surplus = todaySurplus();
  if(surplus && surplus.revenueToday>0){
    if(surplus.surplus>0){
      html += `<div class="alert-banner good"><span class="ic">💰</span><div><b>عندك فائض النهاردة ~${Math.round(surplus.surplus).toLocaleString('ar-EG')} ج.م</b>فوق احتياجك اليومي (${Math.ceil(surplus.required).toLocaleString('ar-EG')} ج.م) — تقدر تدّخره.</div></div>`;
    } else {
      html += `<div class="alert-banner warn"><span class="ic">⚠️</span><div><b>إيراد النهاردة (${Math.round(surplus.revenueToday).toLocaleString('ar-EG')} ج.م) لسه أقل من احتياجك اليومي</b>محتاج ${Math.ceil(Math.abs(surplus.surplus)).toLocaleString('ar-EG')} ج.م زيادة عشان تغطي التزاماتك النهاردة.</div></div>`;
    }
  }

  const defer = deferrableSuggestion();
  if(defer){
    html += `<div class="alert-banner warn"><span class="ic">⚖️</span><div><b>سعتك اليومية الحالية أقل من المطلوب</b>عندك ${defer.count} التزام "ممكن يتأجل" بإجمالي ${Math.round(defer.deferrableTotal).toLocaleString('ar-EG')} ج.م شهريًا — لو أجّلتهم، المطلوب يوميًا هينزل لـ ${Math.ceil(defer.reducedTotal).toLocaleString('ar-EG')} ج.م بدل ${Math.ceil(defer.currentTotal).toLocaleString('ar-EG')} ج.م.</div></div>`;
  }

  const r = calcRequiredDailyCapacity();
  if(r.total>0){
    html += `<div class="alert-banner warn"><span class="ic">🤕</span><div><b>لو غبت يوم شغل واحد</b>هتفقد تغطية ~${Math.ceil(r.total).toLocaleString('ar-EG')} ج.م من التزاماتك، هتحتاج تعوضها في الأيام اللي بعده.</div></div>`;
  }

  box.innerHTML = html || `<div class="empty-msg">تمام، مفيش تنبيهات على التزاماتك الشخصية دلوقتي 👍</div>`;
}

/* ---- الالتزامات الشهرية الثابتة (أقساط، إيجار، فواتير...) ---- */
/* ---- تصنيف الالتزامات الشهرية بالنوع ---- */
const COMMITMENT_TYPES = [
  {key:'إيجار', icon:'🏠', label:'🏠 إيجار'},
  {key:'قسط', icon:'💳', label:'💳 قسط'},
  {key:'فاتورة', icon:'🧾', label:'🧾 فاتورة'},
  {key:'اشتراك', icon:'🔁', label:'🔁 اشتراك'},
  {key:'ادخار', icon:'💰', label:'💰 ادخار'},
  {key:'تانية', icon:'📌', label:'📌 تانية'},
];
function commitmentTypeInfo(key){
  return COMMITMENT_TYPES.find(t=>t.key===key) || COMMITMENT_TYPES[COMMITMENT_TYPES.length-1];
}

let commitmentsArchiveOpen = false;
function toggleCommitmentsArchive(){
  commitmentsArchiveOpen = !commitmentsArchiveOpen;
  renderCommitments();
}

let commitmentsTypeFilter = 'all';
function setCommitmentsTypeFilter(type){
  commitmentsTypeFilter = type;
  commitmentsListShowCount = 8;
  renderCommitments();
}

function commitmentCardHtml(c, archived){
  const nowYM = currentYM();
  const paidThisMonth = c.lastPaidMonth===nowYM;
  const info = commitmentTypeInfo(c.type);
  const interval = Number(c.intervalMonths)||1;
  const intervalLabel = (COMMITMENT_INTERVALS.find(i=>i.key===interval)||{}).label || 'شهري';
  return `
    <div class="card" data-type="${escapeHtml(c.type||'تانية')}">
      <div class="row">
        <h3>${info.icon} ${escapeHtml(c.desc)}${archived?' <span class="meta">(متوقف)</span>':''}</h3>
        <b style="color:var(--danger)">${Number(c.amount).toLocaleString('ar-EG')} ج.م${interval>1?` <span class="meta">/ ${intervalLabel}</span>`:''}</b>
      </div>
      <div class="meta">
        ${info.label}${interval>1?` — 🔁 ${intervalLabel} (يعادل ${Math.round(commitmentMonthlyShare(c)).toLocaleString('ar-EG')} ج.م/شهر)`:''}${c.dueDay?` — 📅 يستحق يوم ${c.dueDay} من كل شهر استحقاق`:''} — ${c.priority==='deferrable'?'⚖️ ممكن يتأجل':'🔴 ضروري'}${c.remainingMonths!=null?` — 🏁 باقي ${c.remainingMonths} شهر`:''}${paidThisMonth?' — ✅ مدفوع الشهر ده':''}
      </div>
      <div class="btn-row">
        ${!archived && c.dueDay && !paidThisMonth && (interval<=1 || isCommitmentCycleMonth(c, nowYM)) ? `<button class="btn sm outline" onclick="markCommitmentPaidThisMonth('${c.id}')">✅ اتدفع الشهر ده</button>` : ''}
        <button class="btn sm outline" onclick="openCommitmentModal('${c.id}')">✏️ تعديل</button>
        <button class="btn sm danger" onclick="deleteCommitment('${c.id}')">🗑️ حذف</button>
      </div>
    </div>
  `;
}

function renderCommitments(){
  const activeAll = (db.commitments||[]).filter(c=>c.active!==false);
  const total = activeAll.reduce((s,c)=>s+commitmentMonthlyShare(c),0);
  const totalTxt = Math.round(total).toLocaleString('ar-EG')+' ج.م / شهر';
  const el = document.getElementById('totalCommitmentsTxt');
  if(el) el.textContent = totalTxt;
  const stickyEl = document.getElementById('stickyCommitmentsTotalTxt');
  const stickyBar = document.querySelector('.sticky-total-bar');
  if(stickyEl) stickyEl.textContent = totalTxt;
  if(stickyBar) stickyBar.style.display = activeAll.length ? 'flex' : 'none';

  const box = document.getElementById('commitmentsList');
  if(!box) return;

  // --- تحديث السطر الملخّص وعداد التاب: بنفس تعريف "مستحق قريب" اللي هيتقسم بيه القائمة تحت (خلال أسبوع أو متأخر)
  //     وده غير عتبة تنبيهات الهوم/الإشعارات (3 أيام) المستخدمة في مكان تاني، لأن الغرض هنا عرض تجميعي مش تنبيه فوري
  const dueSoonCount = activeAll.filter(c=>{
    const d = commitmentDaysUntilDue(c);
    return d!=null && d<=7;
  }).length;
  const summaryEl = document.getElementById('commitmentsSummaryLine');
  if(summaryEl){
    summaryEl.textContent = activeAll.length
      ? `📊 عندك ${activeAll.length} التزام نشط${dueSoonCount?` — منها ${dueSoonCount} مستحق قريب أو متأخر`:''}`
      : '';
  }
  const tabBadge = document.getElementById('commTabBadge');
  if(tabBadge){
    tabBadge.textContent = dueSoonCount;
    tabBadge.style.display = dueSoonCount ? 'inline-flex' : 'none';
  }

  // --- شرائح الفلترة حسب النوع مع الإجمالي الفرعي لكل نوع ---
  const chipsBox = document.getElementById('commitmentsTypeChips');
  if(chipsBox){
    if(activeAll.length){
      const byType = {};
      activeAll.forEach(c=>{
        const key = c.type||'تانية';
        if(!byType[key]) byType[key] = {count:0, amount:0};
        byType[key].count++;
        byType[key].amount += commitmentMonthlyShare(c);
      });
      let chips = `<span class="type-chip${commitmentsTypeFilter==='all'?' active':''}" onclick="setCommitmentsTypeFilter('all')">📋 الكل (${activeAll.length})</span>`;
      COMMITMENT_TYPES.forEach(t=>{
        const b = byType[t.key];
        if(!b) return;
        chips += `<span class="type-chip${commitmentsTypeFilter===t.key?' active':''}" onclick="setCommitmentsTypeFilter('${t.key}')">${t.icon} ${t.key} (${Math.round(b.amount).toLocaleString('ar-EG')})</span>`;
      });
      chipsBox.innerHTML = chips;
    } else {
      chipsBox.innerHTML = '';
    }
  }

  // --- تطبيق فلتر النوع على القائمتين النشطة والمؤرشفة ---
  const matchesFilter = c => commitmentsTypeFilter==='all' || (c.type||'تانية')===commitmentsTypeFilter;
  const allActive = activeAll.filter(matchesFilter).slice();
  const allArchived = (db.commitments||[]).filter(c=>c.active===false).filter(matchesFilter).slice().sort((a,b)=>Number(b.amount)-Number(a.amount));

  // --- تقسيم الالتزامات النشطة لمجموعتين: مستحق قريب (خلال أسبوع أو متأخر) ولسه بعيد ---
  const nearDue = allActive.filter(c=>{
    const d = commitmentDaysUntilDue(c);
    return d!=null && d<=7;
  }).sort((a,b)=>commitmentDaysUntilDue(a)-commitmentDaysUntilDue(b));
  const farDue = allActive.filter(c=>{
    const d = commitmentDaysUntilDue(c);
    return d==null || d>7;
  }).sort((a,b)=>Number(b.amount)-Number(a.amount));

  const nearSection = nearDue.length ? `
    <div class="commitment-group-title">🔔 مستحق قريب (${nearDue.length})</div>
    ${nearDue.map(c=>commitmentCardHtml(c, false)).join('')}
  ` : '';

  const farList = farDue.slice(0, commitmentsListShowCount);
  const farSection = farDue.length ? `
    ${nearDue.length ? `<div class="commitment-group-title">🕒 لسه بعيد (${farDue.length})</div>` : ''}
    ${farList.map(c=>commitmentCardHtml(c, false)).join('')}
    ${farDue.length>farList.length ? `<button class="btn sm outline" style="margin-top:6px;" onclick="showMoreCommitments()">⬇️ عرض المزيد (${farDue.length-farList.length} متبقي)</button>` : ''}
  ` : '';

  const rows = (nearSection || farSection) ? (nearSection + farSection) : `<div class="empty-msg">${activeAll.length?'لا توجد التزامات من هذا النوع':'لا توجد التزامات نشطة مسجلة'}</div>`;

  let archiveSection = '';
  if(allArchived.length){
    archiveSection = `
      <div class="archive-toggle" onclick="toggleCommitmentsArchive()">
        <span>📦 متوقفة (${allArchived.length})</span>
        <span class="archive-toggle-arrow">${commitmentsArchiveOpen?'▲':'▼'}</span>
      </div>
      ${commitmentsArchiveOpen ? `<div class="archive-body">${allArchived.map(c=>commitmentCardHtml(c, true)).join('')}</div>` : ''}
    `;
  }

  box.innerHTML = rows + archiveSection;
}

function showMoreCommitments(){
  commitmentsListShowCount += 8;
  renderCommitments();
}

const COMMITMENT_INTERVALS = [
  {key:1, label:'شهري'},
  {key:3, label:'كل 3 شهور'},
  {key:6, label:'كل 6 شهور'},
  {key:12, label:'سنوي (كل 12 شهر)'},
];

function onCommitmentIntervalChange(){
  const interval = Number(document.getElementById('f_commInterval').value)||1;
  const wrap = document.getElementById('f_commCycleStartWrap');
  const amountLabel = document.getElementById('f_commAmountLabel');
  if(wrap) wrap.style.display = interval>1 ? 'block' : 'none';
  if(amountLabel) amountLabel.textContent = interval>1 ? 'القيمة كل مرة استحقاق (ج.م)' : 'القيمة الشهرية (ج.م)';
}

function openCommitmentModal(id, presetType, presetDesc){
  const c = id ? (db.commitments||[]).find(x=>x.id===id) : null;
  const hasDuration = !!(c && c.remainingMonths!=null);
  const selectedType = c ? (c.type||'تانية') : (presetType||'تانية');
  const descValue = c ? c.desc : (presetDesc||'');
  const typeOptions = COMMITMENT_TYPES.map(t=>`<option value="${t.key}" ${t.key===selectedType?'selected':''}>${t.label}</option>`).join('');
  const selectedInterval = c ? (Number(c.intervalMonths)||1) : 1;
  const intervalOptions = COMMITMENT_INTERVALS.map(i=>`<option value="${i.key}" ${i.key===selectedInterval?'selected':''}>${i.label}</option>`).join('');
  const cycleStartVal = (c && c.cycleStartYM) ? c.cycleStartYM : currentYM();
  const html = `
    <div class="modal-head"><h3>${c?'✏️ تعديل التزام':'➕ التزام جديد'}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="field"><label>الوصف</label><input id="f_commDesc" placeholder="مثال: قسط سيارة، إيجار، فاتورة كهرباء..." value="${escapeHtml(descValue)}"></div>
    <div class="field"><label id="f_commAmountLabel">${selectedInterval>1?'القيمة كل مرة استحقاق (ج.م)':'القيمة الشهرية (ج.م)'}</label><input id="f_commAmount" type="number" placeholder="0" value="${c?c.amount:''}"></div>
    <div class="field"><label>النوع</label><select id="f_commType">${typeOptions}</select></div>
    <div class="field"><label>دورة الاستحقاق</label>
      <select id="f_commInterval" onchange="onCommitmentIntervalChange()">${intervalOptions}</select>
      <span class="meta">للالتزامات غير الشهرية (زي تجديد رخصة أو تأمين سنوي)، اكتب القيمة كاملة مرة واحدة، وهنوزّعها تلقائيًا على شهور الدورة عند حساب احتياجك اليومي.</span>
    </div>
    <div id="f_commCycleStartWrap" class="field" style="display:${selectedInterval>1?'block':'none'};">
      <label>شهر أول استحقاق</label>
      <input id="f_commCycleStart" type="month" value="${cycleStartVal}">
    </div>
    <div class="field"><label>يوم الاستحقاق من الشهر (اختياري)</label><input id="f_commDueDay" type="number" min="1" max="31" placeholder="مثال: 5" value="${c&&c.dueDay?c.dueDay:''}"></div>
    <div class="field"><label>الأولوية</label>
      <select id="f_commPriority">
        <option value="essential" ${(!c||c.priority!=='deferrable')?'selected':''}>🔴 ضروري</option>
        <option value="deferrable" ${(c&&c.priority==='deferrable')?'selected':''}>⚖️ ممكن يتأجل</option>
      </select>
    </div>
    <div class="field"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
      <input type="checkbox" id="f_commHasDuration" style="width:18px;height:18px;" onchange="document.getElementById('f_commDurationWrap').style.display=this.checked?'block':'none'" ${hasDuration?'checked':''}> له مدة محددة (مش لحد الأبد)
    </label></div>
    <div id="f_commDurationWrap" class="field" style="display:${hasDuration?'block':'none'};">
      <label>عدد الشهور الباقية</label>
      <input id="f_commRemainingMonths" type="number" min="1" placeholder="مثال: 12" value="${hasDuration?c.remainingMonths:''}">
    </div>
    <button class="btn" onclick="saveCommitment('${c?c.id:''}')">💾 حفظ</button>
  `;
  openModal(html);
}

function saveCommitment(id){
  const desc = document.getElementById('f_commDesc').value.trim();
  const amount = Number(document.getElementById('f_commAmount').value)||0;
  const type = document.getElementById('f_commType').value || 'تانية';
  const intervalMonths = Number(document.getElementById('f_commInterval').value)||1;
  const cycleStartEl = document.getElementById('f_commCycleStart');
  const cycleStartYM = intervalMonths>1 ? ((cycleStartEl&&cycleStartEl.value)||currentYM()) : null;
  const dueDay = Number(document.getElementById('f_commDueDay').value)||null;
  const priority = document.getElementById('f_commPriority').value==='deferrable' ? 'deferrable' : 'essential';
  const hasDuration = document.getElementById('f_commHasDuration').checked;
  const remainingMonths = hasDuration ? (Number(document.getElementById('f_commRemainingMonths').value)||null) : null;
  if(!desc){ toast('أدخل وصف الالتزام'); return; }
  if(amount<=0){ toast('أدخل مبلغاً صحيحاً'); return; }
  if(hasDuration && !remainingMonths){ toast('أدخل عدد الشهور الباقية'); return; }
  if(!db.commitments) db.commitments=[];
  if(id){
    const c = db.commitments.find(x=>x.id===id);
    if(c){ c.desc=desc; c.amount=amount; c.type=type; c.intervalMonths=intervalMonths; c.cycleStartYM=cycleStartYM; c.dueDay=dueDay; c.priority=priority; c.remainingMonths=remainingMonths; }
  }else{
    db.commitments.push({id:uid(), desc, amount, type, intervalMonths, cycleStartYM, dueDay, priority, remainingMonths, lastPaidMonth:null, active:true});
  }
  saveDB();
  closeModal();
  renderCommitments();
  renderRequiredCapacityCard();
  renderPersonalAlerts();
  toast('تم الحفظ ✅');
}

async function deleteCommitment(id){
  if(!await appConfirm('حذف هذا الالتزام؟')) return;
  const removed = (db.commitments||[]).find(c=>c.id===id);
  if(!removed) return;
  db.commitments = db.commitments.filter(c=>c.id!==id);
  setUndo('حذف الالتزام', ()=>{
    db.commitments.push(removed);
    saveDB();
    renderCommitments();
    renderRequiredCapacityCard();
    renderPersonalAlerts();
  });
  saveDB();
  renderCommitments();
  renderRequiredCapacityCard();
  renderPersonalAlerts();
  toast('تم الحذف');
}

/* ---- مصاريف البيت اليومية ---- */
const HOUSE_EXPENSE_CATEGORIES = [
  {key:'أكل', label:'🍽️ أكل', color:'#1F6D57'},
  {key:'مواصلات', label:'🚌 مواصلات', color:'#B08900'},
  {key:'فواتير', label:'🧾 فواتير', color:'#B0463C'},
  {key:'صحة', label:'💊 صحة', color:'#6A4EA8'},
  {key:'أخرى', label:'📦 أخرى', color:'#847c6c'},
];
function houseExpenseCategoryInfo(key){
  return HOUSE_EXPENSE_CATEGORIES.find(c=>c.key===key) || HOUSE_EXPENSE_CATEGORIES[HOUSE_EXPENSE_CATEGORIES.length-1];
}

function renderHouseExpenses(){
  const total = (db.houseExpenses||[]).reduce((s,e)=>s+Number(e.amount||0),0);
  const el = document.getElementById('totalHouseExpensesTxt');
  if(el) el.textContent = total.toLocaleString('ar-EG')+' ج.م (إجمالي كل الوقت)';
  const all = (db.houseExpenses||[]).slice().sort((a,b)=>b.date.localeCompare(a.date));
  const list = all.slice(0, houseExpensesListShowCount);
  const box = document.getElementById('houseExpensesList');
  if(box){
    const rows = list.length ? list.map(e=>`
      <div class="card">
        <div class="row">
          <h3>${escapeHtml(e.desc)}</h3>
          <b style="color:var(--danger)">${Number(e.amount).toLocaleString('ar-EG')} ج.م</b>
        </div>
        <div class="meta">${houseExpenseCategoryInfo(e.category).label} | 📅 ${fmtDate(e.date)}</div>
        <div class="btn-row">
          <button class="btn sm danger" onclick="deleteHouseExpense('${e.id}')">🗑️ حذف</button>
        </div>
      </div>
    `).join('') : `<div class="empty-msg">لا توجد مصاريف بيت مسجلة بعد</div>`;
    const more = all.length>list.length ? `<button class="btn sm outline" style="margin-top:6px;" onclick="showMoreHouseExpenses()">⬇️ عرض المزيد (${all.length-list.length} متبقي)</button>` : '';
    box.innerHTML = rows + more;
  }
  renderHouseExpenseCategoryBreakdown();
  renderHouseExpenseChart();
}

function showMoreHouseExpenses(){
  houseExpensesListShowCount += 8;
  renderHouseExpenses();
}

function renderHouseExpenseCategoryBreakdown(){
  const box = document.getElementById('houseExpenseCategoryBreakdown');
  if(!box) return;
  const all = db.houseExpenses||[];
  const total = all.reduce((s,e)=>s+Number(e.amount||0),0);
  if(!total){
    box.innerHTML = `<div class="empty-msg">لا توجد بيانات كافية بعد</div>`;
    return;
  }
  const sums = {};
  all.forEach(e=>{
    const key = e.category || 'أخرى';
    sums[key] = (sums[key]||0) + Number(e.amount||0);
  });
  const rows = Object.keys(sums)
    .map(key=>({key, amount:sums[key], info:houseExpenseCategoryInfo(key)}))
    .sort((a,b)=>b.amount-a.amount);
  box.innerHTML = rows.map(r=>{
    const pct = Math.round((r.amount/total)*100);
    return `
      <div style="margin-bottom:8px;">
        <div class="row" style="margin-bottom:3px;">
          <span>${r.info.label}</span>
          <span><b>${r.amount.toLocaleString('ar-EG')} ج.م</b> <span style="color:var(--muted);font-size:12px;">(${pct}%)</span></span>
        </div>
        <div style="background:var(--card-alt);border-radius:20px;height:8px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:${r.info.color};"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderHouseExpenseChart(){
  const canvas = document.getElementById('houseExpenseChart');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);

  const now = new Date();
  const months = [];
  for(let i=5;i>=0;i--){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    months.push({key:d.toISOString().slice(0,7), label:d.toLocaleDateString('ar-EG',{month:'short'})});
  }
  const values = months.map(m=>(db.houseExpenses||[]).filter(e=>e.date.slice(0,7)===m.key).reduce((s,e)=>s+Number(e.amount||0),0));
  const maxVal = Math.max(...values, 1);

  const padL=40, padB=26, padT=14, padR=10;
  const chartW = W-padL-padR, chartH = H-padT-padB;
  const barGap = 14;
  const barW = (chartW - barGap*(months.length-1)) / months.length;

  ctx.strokeStyle = '#e4d9bf';
  ctx.beginPath();
  ctx.moveTo(padL, padT); ctx.lineTo(padL, H-padB); ctx.lineTo(W-padR, H-padB);
  ctx.stroke();

  ctx.font = '11px "IBM Plex Sans Arabic", Tahoma, Arial, sans-serif';
  ctx.textAlign = 'center';

  months.forEach((m,i)=>{
    const x = padL + i*(barW+barGap);
    const h = (values[i]/maxVal) * (chartH-16);
    const y = H-padB-h;
    ctx.fillStyle = '#B0463C';
    ctx.beginPath();
    if(ctx.roundRect){ ctx.roundRect(x, y, barW, h, [5,5,0,0]); ctx.fill(); }
    else { ctx.fillRect(x,y,barW,h); }
    ctx.fillStyle = '#123C2F';
    ctx.fillText(values[i].toLocaleString('ar-EG'), x+barW/2, y-5);
    ctx.fillStyle = '#847c6c';
    ctx.fillText(m.label, x+barW/2, H-padB+14);
  });
}

function openHouseExpenseModal(){
  const catOptions = HOUSE_EXPENSE_CATEGORIES.map(c=>`<option value="${c.key}">${c.label}</option>`).join('');
  const html = `
    <div class="modal-head"><h3>➕ مصروف بيت</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="field"><label>وصف المصروف</label><input id="f_houseDesc" placeholder="مثال: أكل، مواصلات، فواتير..."></div>
    <div class="field"><label>المبلغ (ج.م)</label><input id="f_houseAmount" type="number" placeholder="0"></div>
    <div class="field"><label>النوع</label><select id="f_houseCategory">${catOptions}</select></div>
    <div class="field"><label>التاريخ</label><input id="f_houseDate" type="date" value="${todayStr()}"></div>
    <button class="btn" onclick="saveHouseExpense()">💾 حفظ</button>
  `;
  openModal(html);
}

function saveHouseExpense(){
  const desc = document.getElementById('f_houseDesc').value.trim();
  const amount = Number(document.getElementById('f_houseAmount').value)||0;
  const category = document.getElementById('f_houseCategory').value || 'أخرى';
  const date = document.getElementById('f_houseDate').value || todayStr();
  if(!desc){ toast('أدخل وصف المصروف'); return; }
  if(amount<=0){ toast('أدخل مبلغاً صحيحاً'); return; }
  if(!db.houseExpenses) db.houseExpenses=[];
  const record = {id:uid(), desc, amount, category, date};
  db.houseExpenses.push(record);
  setUndo('إضافة مصروف البيت', ()=>{
    db.houseExpenses = db.houseExpenses.filter(e=>e.id!==record.id);
    saveDB();
    renderHouseExpenses();
    renderRequiredCapacityCard();
    renderPersonalAlerts();
  });
  saveDB();
  closeModal();
  renderHouseExpenses();
  renderRequiredCapacityCard();
  renderPersonalAlerts();
  toast('تم الإضافة ✅');
}

async function deleteHouseExpense(id){
  if(!await appConfirm('حذف هذا المصروف؟')) return;
  const removed = (db.houseExpenses||[]).find(e=>e.id===id);
  if(!removed) return;
  db.houseExpenses = db.houseExpenses.filter(e=>e.id!==id);
  setUndo('حذف مصروف البيت', ()=>{
    db.houseExpenses.push(removed);
    saveDB();
    renderHouseExpenses();
    renderRequiredCapacityCard();
    renderPersonalAlerts();
  });
  saveDB();
  renderHouseExpenses();
  renderRequiredCapacityCard();
  renderPersonalAlerts();
  toast('تم الحذف');
}

/* ============================================================
   شاشة المديونيات: كل عميل عليه متبقي، مرتب من الأكبر للأصغر
   ============================================================ */
function renderDebtsList(){
  const box = document.getElementById('debtsList');
  if(!box) return;
  const byCustomer = {};
  db.orders.forEach(o=>{
    const remaining = orderRemaining(o);
    if(remaining<=0) return;
    if(!byCustomer[o.customerId]) byCustomer[o.customerId] = {remaining:0, orders:0};
    byCustomer[o.customerId].remaining += remaining;
    byCustomer[o.customerId].orders += 1;
  });
  const rows = Object.entries(byCustomer)
    .map(([cid,v])=>({c:customerById(cid), ...v}))
    .filter(r=>r.c)
    .sort((a,b)=>b.remaining-a.remaining);

  const totalDebt = rows.reduce((s,r)=>s+r.remaining,0);
  const totalTxt = document.getElementById('totalDebtsTxt');
  if(totalTxt) totalTxt.textContent = rows.length ? '('+totalDebt.toLocaleString('ar-EG')+' ج.م)' : '';

  box.innerHTML = rows.length ? rows.map(r=>`
    <div class="card">
      <div class="row">
        <h3 class="name-row">${avatarChip(r.c.name)}${escapeHtml(r.c.name)}</h3>
        <b style="color:var(--danger);font-size:16px;">${r.remaining.toLocaleString('ar-EG')} ج.م</b>
      </div>
      <div class="meta">${r.orders} طلب غير مسدد بالكامل${r.c.phone?' — 📞 '+escapeHtml(r.c.phone):''}</div>
      <div class="btn-row">
        ${r.c.phone?`<button class="btn sm outline" onclick="sendDebtReminder('${r.c.id}')">💬 تذكير واتساب</button>`:''}
        <button class="btn sm outline" onclick="openCustomerHistory('${r.c.id}')">📜 عرض السجل</button>
      </div>
    </div>
  `).join('') : `<div class="empty-msg">لا توجد مديونيات حالياً 🎉</div>`;
}

function sendDebtReminder(customerId){
  const c = customerById(customerId);
  if(!c || !c.phone){ toast('لا يوجد رقم هاتف مسجل لهذا العميل'); return; }
  const unpaidOrders = db.orders.filter(o=>o.customerId===customerId && orderRemaining(o)>0);
  const totalRemaining = unpaidOrders.reduce((s,o)=>s+orderRemaining(o),0);
  let phone = c.phone.replace(/[^0-9]/g,'');
  if(phone.startsWith('0')) phone = '2'+phone;
  const msg =
`تذكير من ${db.workshopName||'ورشة تفصيل الجلابيب'} 🧵
حضرتك، إجمالي المتبقي على حسابك: ${totalRemaining.toLocaleString('ar-EG')} ج.م
عدد الطلبات غير المسددة بالكامل: ${unpaidOrders.length}
في انتظار حضرتك 🙏`;
  openWhatsAppChat(phone, msg);
}

/* ============================================================
   تحليلات متقدمة: توقعات، قيمة العملاء، كفاءة التشغيل، خريطة حرارية
   ============================================================ */
function renderAdvancedAnalytics(){
  const box = document.getElementById('advancedAnalytics');
  if(!box) return;

  const now = new Date();
  const todayS = todayStr();
  const capacity = Number(db.dailyCapacity)||500;
  const weekCapacity = capacity*7;

  // 1) توقع إيراد الشهر القادم — متوسط تحصيل آخر 3 شهور فيهم دخل فعلي
  const last3 = [];
  for(let i=1;i<=3;i++){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const key = d.toISOString().slice(0,7);
    last3.push(db.payments.filter(p=>p.date.slice(0,7)===key).reduce((s,p)=>s+Number(p.amount||0),0));
  }
  const validMonths = last3.filter(v=>v>0);
  const forecast = validMonths.length ? Math.round(validMonths.reduce((a,b)=>a+b,0)/validMonths.length) : 0;

  // 2) تنبيه تكدس الأسبوع القادم
  const in7 = new Date(Date.now()+7*86400000).toISOString().slice(0,10);
  const nextWeekOrders = db.orders.filter(o=>o.status!=='تم التسليم' && o.dateDelivery && o.dateDelivery>todayS && o.dateDelivery<=in7);
  const nextWeekValue = nextWeekOrders.reduce((s,o)=>s+orderTotal(o),0);
  const congested = nextWeekValue > weekCapacity;

  // 3) متوسط قيمة الطلب (AOV) الشهر الحالي مقابل السابق
  const thisMonthKey = todayS.slice(0,7);
  const prevMonthKey = new Date(now.getFullYear(), now.getMonth()-1, 1).toISOString().slice(0,7);
  const thisMonthOrders = db.orders.filter(o=>(o.dateReceived||'').slice(0,7)===thisMonthKey);
  const prevMonthOrders = db.orders.filter(o=>(o.dateReceived||'').slice(0,7)===prevMonthKey);
  const aovThis = thisMonthOrders.length ? Math.round(thisMonthOrders.reduce((s,o)=>s+orderTotal(o),0)/thisMonthOrders.length) : 0;
  const aovPrev = prevMonthOrders.length ? Math.round(prevMonthOrders.reduce((s,o)=>s+orderTotal(o),0)/prevMonthOrders.length) : 0;
  const aovDiff = aovPrev>0 ? Math.round(((aovThis-aovPrev)/aovPrev)*100) : null;

  // 4) أفضل 10 عملاء بإجمالي المدفوع فعلياً (من سجل الدفعات)
  const paidByCustomer = {};
  db.payments.forEach(p=>{
    const o = db.orders.find(x=>x.id===p.orderId);
    if(!o) return;
    paidByCustomer[o.customerId] = (paidByCustomer[o.customerId]||0) + Number(p.amount||0);
  });
  const topCustomers = Object.entries(paidByCustomer)
    .map(([cid,total])=>({c:customerById(cid), total}))
    .filter(x=>x.c)
    .sort((a,b)=>b.total-a.total)
    .slice(0,10);

  // 5) نسبة العملاء المتكررين (عملهم أكتر من طلب واحد)
  const ordersPerCustomer = {};
  db.orders.forEach(o=>{ ordersPerCustomer[o.customerId] = (ordersPerCustomer[o.customerId]||0)+1; });
  const customersWithOrders = Object.keys(ordersPerCustomer).length;
  const repeatCustomers = Object.values(ordersPerCustomer).filter(n=>n>1).length;
  const retentionPct = customersWithOrders ? Math.round((repeatCustomers/customersWithOrders)*100) : 0;

  // 6) نسبة استخدام الطاقة — قيمة الطلبات المُستلمة آخر 7 أيام مقابل الطاقة الأسبوعية
  const sevenDaysAgo = new Date(Date.now()-6*86400000).toISOString().slice(0,10);
  const receivedLast7Value = db.orders.filter(o=>o.dateReceived && o.dateReceived>=sevenDaysAgo && o.dateReceived<=todayS).reduce((s,o)=>s+orderTotal(o),0);
  const utilizationPct = weekCapacity ? Math.round((receivedLast7Value/weekCapacity)*100) : 0;

  // 7) تكلفة التأخير — قيمة الطلبات المتأخرة حالياً
  const delayCost = db.orders.filter(isOverdue).reduce((s,o)=>s+orderTotal(o),0);

  // 8) تأثير الطلبات المستعجلة
  const activeOrders = db.orders.filter(o=>o.status!=='تم التسليم');
  const urgentActive = activeOrders.filter(o=>o.urgent);
  const urgentPct = activeOrders.length ? Math.round((urgentActive.length/activeOrders.length)*100) : 0;
  const urgentLateCount = urgentActive.filter(isOverdue).length;
  const urgentFeeThisMonth = db.orders
    .filter(o=>o.urgent && (o.dateReceived||'').slice(0,7)===thisMonthKey)
    .reduce((s,o)=>s+orderUrgentFeeAmount(o),0);

  // 9) خريطة حرارية شهرية لمواعيد التسليم
  const heatMonthKey = todayS.slice(0,7);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  const countsByDay = {};
  db.orders.forEach(o=>{
    if(o.dateDelivery && o.dateDelivery.slice(0,7)===heatMonthKey){
      countsByDay[o.dateDelivery] = (countsByDay[o.dateDelivery]||0)+1;
    }
  });
  const dayCountValues = Object.values(countsByDay);
  const maxDayCount = dayCountValues.length ? Math.max(...dayCountValues) : 0;
  let heatCells = '';
  for(let day=1; day<=daysInMonth; day++){
    const dStr = heatMonthKey+'-'+String(day).padStart(2,'0');
    const cnt = countsByDay[dStr]||0;
    const intensity = maxDayCount ? cnt/maxDayCount : 0;
    const bg = cnt===0 ? 'var(--border)' : `rgba(31,109,87,${(0.15+intensity*0.75).toFixed(2)})`;
    heatCells += `<div title="${fmtDate(dStr)}: ${cnt} تسليم" style="background:${bg};border-radius:4px;height:24px;display:flex;align-items:center;justify-content:center;font-size:9px;color:${intensity>0.5?'#fff':'var(--muted)'};">${day}</div>`;
  }

  box.innerHTML = `
    <div class="card">
      <h3>🔮 توقع إيراد الشهر القادم</h3>
      <div class="num" style="font-size:22px;color:var(--primary);">${forecast.toLocaleString('ar-EG')} ج.م</div>
      <p class="meta">بناءً على متوسط تحصيل ${validMonths.length||0} من آخر 3 شهور.</p>
    </div>
    ${congested?`<div class="alert-banner danger"><span class="ic">⚠️</span><div><b>تكدس متوقع الأسبوع القادم</b>قيمة الطلبات المستحقة (${nextWeekValue.toLocaleString('ar-EG')} ج.م) فوق طاقتك الأسبوعية (${weekCapacity.toLocaleString('ar-EG')} ج.م) — خطط بدري.</div></div>`:''}
    <div class="grid-cards">
      <div class="stat-card"><div class="stat-ic">🧾</div><div><div class="num">${aovThis.toLocaleString('ar-EG')}</div><div class="lbl">متوسط قيمة الطلب${aovDiff!==null?` (${aovDiff>=0?'+':''}${aovDiff}% عن الشهر اللي فات)`:''}</div></div></div>
      <div class="stat-card ${retentionPct<30?'warn':''}"><div class="stat-ic">🔁</div><div><div class="num">${retentionPct}%</div><div class="lbl">عملاء متكررون</div></div></div>
      <div class="stat-card ${utilizationPct>100?'danger':''}"><div class="stat-ic">⚙️</div><div><div class="num">${utilizationPct}%</div><div class="lbl">استخدام الطاقة (آخر 7 أيام)</div></div></div>
      <div class="stat-card ${delayCost>0?'danger':''}"><div class="stat-ic">⏳</div><div><div class="num">${delayCost.toLocaleString('ar-EG')}</div><div class="lbl">قيمة الطلبات المتأخرة (ج.م)</div></div></div>
      <div class="stat-card ${urgentPct>30?'warn':''}"><div class="stat-ic">🔥</div><div><div class="num">${urgentPct}%</div><div class="lbl">نسبة الطلبات المستعجلة${urgentLateCount>0?` (${urgentLateCount} متأخر منها)`:''}</div></div></div>
      ${urgentFeeThisMonth>0?`<div class="stat-card"><div class="stat-ic">💰</div><div><div class="num">${Math.round(urgentFeeThisMonth).toLocaleString('ar-EG')}</div><div class="lbl">رسوم استعجال الشهر ده (ج.م)</div></div></div>`:''}
    </div>
    ${topCustomers.length?`
    <div class="card">
      <h3>🏆 أفضل 10 عملاء (إجمالي المدفوع)</h3>
      ${topCustomers.map((x,i)=>`
        <div class="row" style="padding:6px 0;${i<topCustomers.length-1?'border-bottom:1px dashed var(--border);':''}">
          <span class="name-row">${avatarChip(x.c.name)} ${escapeHtml(x.c.name)}</span>
          <b style="color:var(--primary);">${x.total.toLocaleString('ar-EG')} ج.م</b>
        </div>
      `).join('')}
    </div>`:''}
    <div class="card">
      <h3>🗓️ خريطة مواعيد التسليم — ${new Date(heatMonthKey+'-01').toLocaleDateString('ar-EG',{month:'long',year:'numeric'})}</h3>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:8px;">${heatCells}</div>
    </div>
    <div class="btn-row">
      <button class="btn secondary" onclick="shareAnalyticsSummary()">📤 مشاركة ملخص التحليلات عبر واتساب</button>
    </div>
  `;
}

// مشاركة ملخص التحليلات كنص عبر واتساب (نفس أسلوب مشاركة ملخص الأسبوع)
function shareAnalyticsSummary(){
  const now = new Date();
  const last3 = [];
  for(let i=1;i<=3;i++){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const key = d.toISOString().slice(0,7);
    last3.push(db.payments.filter(p=>p.date.slice(0,7)===key).reduce((s,p)=>s+Number(p.amount||0),0));
  }
  const validMonths = last3.filter(v=>v>0);
  const forecast = validMonths.length ? Math.round(validMonths.reduce((a,b)=>a+b,0)/validMonths.length) : 0;
  const delayCost = db.orders.filter(isOverdue).reduce((s,o)=>s+orderTotal(o),0);
  const activeOrders = db.orders.filter(o=>o.status!=='تم التسليم');
  const urgentPct = activeOrders.length ? Math.round((activeOrders.filter(o=>o.urgent).length/activeOrders.length)*100) : 0;
  const capacity = Number(db.dailyCapacity)||500;
  const sevenDaysAgo = new Date(Date.now()-6*86400000).toISOString().slice(0,10);
  const todayS = todayStr();
  const receivedLast7Value = db.orders.filter(o=>o.dateReceived && o.dateReceived>=sevenDaysAgo && o.dateReceived<=todayS).reduce((s,o)=>s+orderTotal(o),0);
  const utilizationPct = capacity*7 ? Math.round((receivedLast7Value/(capacity*7))*100) : 0;

  const msg =
`🔮 ملخص تحليلات ${db.workshopName||'الورشة'}
📅 ${todayS}

💰 توقع إيراد الشهر القادم: ${forecast.toLocaleString('ar-EG')} ج.م
⚙️ استخدام الطاقة (آخر 7 أيام): ${utilizationPct}%
⏳ قيمة الطلبات المتأخرة: ${delayCost.toLocaleString('ar-EG')} ج.م
🔥 نسبة الطلبات المستعجلة: ${urgentPct}%
📋 عدد الطلبات النشطة: ${activeOrders.length}`;

  if(navigator.share){
    navigator.share({title:'ملخص التحليلات', text:msg}).catch(()=>{});
    return;
  }
  openExternalLink(`https://wa.me/?text=${encodeURIComponent(msg)}`);
}

/* ============================================================
   رؤى الورشة: أكتر نوع تفصيل مطلوب + متوسط وقت تنفيذ الطلب
   ============================================================ */
function renderWorkshopInsights(){
  const box = document.getElementById('workshopInsights');
  if(!box) return;

  // أكتر نوع تفصيل مطلوب (بالعدّ الفعلي للقطع في كل الطلبات)
  const typeCounts = {};
  db.orders.forEach(o=>{
    const items = (Array.isArray(o.items)&&o.items.length) ? o.items : [{type:o.type, qty:o.qty||1}];
    items.forEach(it=>{
      if(!it.type) return;
      typeCounts[it.type] = (typeCounts[it.type]||0) + (Number(it.qty)||1);
    });
  });
  const sortedTypes = Object.entries(typeCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const maxCount = sortedTypes.length ? sortedTypes[0][1] : 0;

  const topTypesHtml = sortedTypes.length ? `
    <div class="card">
      <h3>👗 الأنواع الأكثر طلباً</h3>
      ${sortedTypes.map(([name,count])=>`
        <div style="margin:10px 0;">
          <div class="row" style="margin-bottom:4px;">
            <span style="font-size:13.5px;">${escapeHtml(name)}</span>
            <b style="font-size:13px;color:var(--muted);">${count} قطعة</b>
          </div>
          <div style="background:var(--border);border-radius:20px;height:8px;overflow:hidden;">
            <div style="background:var(--primary);height:100%;width:${maxCount? Math.round(count/maxCount*100):0}%;border-radius:20px;"></div>
          </div>
        </div>
      `).join('')}
    </div>
  ` : `<div class="empty-msg">لا توجد بيانات كافية بعد</div>`;

  // متوسط وقت تنفيذ الطلب: من تاريخ الاستلام لتاريخ التسليم الفعلي (للطلبات المُسلَّمة فقط)
  const delivered = db.orders.filter(o=>o.status==='تم التسليم' && o.deliveredDate && o.dateReceived);
  let avgTurnaroundHtml = `<div class="empty-msg">لا توجد طلبات مُسلَّمة كفاية لحساب المتوسط</div>`;
  if(delivered.length){
    const totalDays = delivered.reduce((s,o)=>{
      const d = Math.round((new Date(o.deliveredDate)-new Date(o.dateReceived))/86400000);
      return s + (d>0?d:0);
    },0);
    const avgDays = Math.round(totalDays/delivered.length);

    // نفس الحساب لكن مقسّم حسب نوع القطعة (أول نوع في الطلب) عشان يبان لو نوع معين بياخد وقت أطول
    const byType = {};
    delivered.forEach(o=>{
      const items = (Array.isArray(o.items)&&o.items.length) ? o.items : [{type:o.type}];
      const typeName = items[0]?.type || 'غير محدد';
      const d = Math.round((new Date(o.deliveredDate)-new Date(o.dateReceived))/86400000);
      if(d<0) return;
      if(!byType[typeName]) byType[typeName] = {sum:0,count:0};
      byType[typeName].sum += d;
      byType[typeName].count += 1;
    });
    const byTypeRows = Object.entries(byType)
      .map(([name,v])=>({name, avg:Math.round(v.sum/v.count), count:v.count}))
      .sort((a,b)=>b.avg-a.avg)
      .slice(0,4);

    avgTurnaroundHtml = `
      <div class="card">
        <h3>⏱️ متوسط وقت تنفيذ الطلب</h3>
        <div class="row"><span style="font-size:13.5px;color:var(--muted);">من ${delivered.length} طلب مُسلَّم</span>
          <b style="font-family:var(--font-display);font-size:19px;color:var(--heading);">${avgDays} يوم</b>
        </div>
        ${byTypeRows.length?`<hr class="sep">${byTypeRows.map(r=>`
          <div class="row" style="margin-bottom:4px;">
            <span style="font-size:13px;">${escapeHtml(r.name)}</span>
            <span style="font-size:13px;color:var(--muted);">${r.avg} يوم (${r.count} طلب)</span>
          </div>
        `).join('')}`:''}
      </div>
    `;
  }

  box.innerHTML = topTypesHtml + avgTurnaroundHtml;
}

/* ---- رسم بياني بسيط للإيرادات الشهرية (Canvas بدون مكتبات) ---- */
function renderRevenueChart(){
  const canvas = document.getElementById('revenueChart');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);

  const now = new Date();
  const months = [];
  for(let i=5;i>=0;i--){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    months.push({key:d.toISOString().slice(0,7), label:d.toLocaleDateString('ar-EG',{month:'short'})});
  }
  const values = months.map(m=>db.payments.filter(p=>p.date.slice(0,7)===m.key).reduce((s,p)=>s+Number(p.amount||0),0));
  const maxVal = Math.max(...values, 1);

  const padL=40, padB=26, padT=14, padR=10;
  const chartW = W-padL-padR, chartH = H-padT-padB;
  const barGap = 14;
  const barW = (chartW - barGap*(months.length-1)) / months.length;

  ctx.strokeStyle = '#e4d9bf';
  ctx.beginPath();
  ctx.moveTo(padL, padT); ctx.lineTo(padL, H-padB); ctx.lineTo(W-padR, H-padB);
  ctx.stroke();

  ctx.font = '11px "IBM Plex Sans Arabic", Tahoma, Arial, sans-serif';
  ctx.fillStyle = '#847c6c';
  ctx.textAlign = 'center';

  months.forEach((m,i)=>{
    const x = padL + i*(barW+barGap);
    const h = (values[i]/maxVal) * (chartH-16);
    const y = H-padB-h;
    ctx.fillStyle = '#1F6D57';
    ctx.beginPath();
    if(ctx.roundRect){ ctx.roundRect(x, y, barW, h, [5,5,0,0]); ctx.fill(); }
    else { ctx.fillRect(x,y,barW,h); }
    ctx.fillStyle = '#123C2F';
    ctx.fillText(values[i].toLocaleString('ar-EG'), x+barW/2, y-5);
    ctx.fillStyle = '#847c6c';
    ctx.fillText(m.label, x+barW/2, H-padB+14);
  });
}

/* ---- التقرير الشهري ---- */
function populateMonthSelect(){
  const sel = document.getElementById('reportMonthSelect');
  const prev = sel.value;
  let opts = '';
  const now = new Date();
  for(let i=0;i<12;i++){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const val = d.toISOString().slice(0,7);
    const label = d.toLocaleDateString('ar-EG',{month:'long', year:'numeric'});
    opts += `<option value="${val}">${label}</option>`;
  }
  sel.innerHTML = opts;
  sel.value = prev || now.toISOString().slice(0,7);
}

function renderMonthlyReport(){
  const sel = document.getElementById('reportMonthSelect');
  if(!sel) return;
  const month = sel.value || todayStr().slice(0,7);
  const ordersReceived = db.orders.filter(o=>(o.dateReceived||'').slice(0,7)===month).length;
  const ordersDelivered = db.orders.filter(o=>o.deliveredDate && o.deliveredDate.slice(0,7)===month).length;
  const collected = db.payments.filter(p=>p.date.slice(0,7)===month).reduce((s,p)=>s+Number(p.amount||0),0);
  const expenses = db.expenses.filter(e=>e.date.slice(0,7)===month).reduce((s,e)=>s+Number(e.amount||0),0);
  const net = collected-expenses;
  document.getElementById('monthlyReportBody').innerHTML = `
    <div class="meta">📥 طلبات استُلمت هذا الشهر: <b>${ordersReceived}</b></div>
    <div class="meta">📤 طلبات تم تسليمها هذا الشهر: <b>${ordersDelivered}</b></div>
    <div class="meta">💰 المحصَّل: <b>${collected.toLocaleString('ar-EG')} ج.م</b></div>
    <div class="meta">🧵 المصروفات: <b style="color:var(--danger)">${expenses.toLocaleString('ar-EG')} ج.م</b></div>
    <hr class="sep">
    <div class="row"><h3>الصافي</h3><b style="color:${net<0?'var(--danger)':'var(--ok)'};font-size:17px;">${net.toLocaleString('ar-EG')} ج.م</b></div>
  `;
}

function printMonthlyReport(){
  const sel = document.getElementById('reportMonthSelect');
  const month = sel.value || todayStr().slice(0,7);
  const label = new Date(month+'-01').toLocaleDateString('ar-EG',{month:'long', year:'numeric'});
  const ordersReceived = db.orders.filter(o=>(o.dateReceived||'').slice(0,7)===month).length;
  const ordersDelivered = db.orders.filter(o=>o.deliveredDate && o.deliveredDate.slice(0,7)===month).length;
  const collected = db.payments.filter(p=>p.date.slice(0,7)===month).reduce((s,p)=>s+Number(p.amount||0),0);
  const expensesList = db.expenses.filter(e=>e.date.slice(0,7)===month);
  const expenses = expensesList.reduce((s,e)=>s+Number(e.amount||0),0);
  const net = collected-expenses;
  const html = `
    <html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>تقرير ${label}</title>
    <style>
      body{font-family:Tahoma,Arial,sans-serif;padding:24px;color:#222;}
      h1{font-size:20px;border-bottom:2px solid #1F6D57;padding-bottom:8px;}
      table{width:100%;border-collapse:collapse;margin-top:14px;}
      td{padding:10px 6px;border-bottom:1px solid #ddd;font-size:15px;}
      td.lbl{color:#666;width:55%;}
      td.val{font-weight:bold;}
      .total-row td{font-size:17px;color:#1F6D57;}
      h2{font-size:15px;margin-top:22px;}
    </style></head><body>
      <h1>📊 التقرير الشهري — ${label}</h1>
      <table>
        <tr><td class="lbl">طلبات استُلمت</td><td class="val">${ordersReceived}</td></tr>
        <tr><td class="lbl">طلبات تم تسليمها</td><td class="val">${ordersDelivered}</td></tr>
        <tr><td class="lbl">إجمالي المحصَّل</td><td class="val">${collected.toLocaleString('ar-EG')} ج.م</td></tr>
        <tr><td class="lbl">إجمالي المصروفات</td><td class="val">${expenses.toLocaleString('ar-EG')} ج.م</td></tr>
        <tr class="total-row"><td class="lbl">الصافي</td><td class="val">${net.toLocaleString('ar-EG')} ج.م</td></tr>
      </table>
      ${expensesList.length?`<h2>🧵 تفاصيل المصروفات</h2><table>${expensesList.map(e=>`<tr><td class="lbl">${escapeHtml(e.desc)} (${fmtDate(e.date)})</td><td class="val">${Number(e.amount).toLocaleString('ar-EG')} ج.م</td></tr>`).join('')}</table>`:''}
    </body></html>
  `;
  openPrintWindow(html, 'تقرير_'+label);
}

/* ============================================================
   المصروفات
   ============================================================ */
function renderExpenses(){
  const total = db.expenses.reduce((s,e)=>s+Number(e.amount||0),0);
  document.getElementById('totalExpensesTxt').textContent = total.toLocaleString('ar-EG')+' ج.م';
  const list = db.expenses.slice().sort((a,b)=>b.date.localeCompare(a.date));
  document.getElementById('expensesList').innerHTML = list.length ? list.map(e=>`
    <div class="card">
      <div class="row">
        <h3>${escapeHtml(e.desc)}</h3>
        <b style="color:var(--danger)">${Number(e.amount).toLocaleString('ar-EG')} ج.م</b>
      </div>
      <div class="meta">📅 ${fmtDate(e.date)}</div>
      <div class="btn-row">
        <button class="btn sm danger" onclick="deleteExpense('${e.id}')">🗑️ حذف</button>
      </div>
    </div>
  `).join('') : `<div class="empty-msg">لا توجد مصروفات مسجلة</div>`;
}

function openExpenseModal(){
  const html = `
    <div class="modal-head"><h3>➕ مصروف جديد</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="field"><label>وصف المصروف</label><input id="f_expDesc" placeholder="مثال: خيوط، أزرار، سوست..."></div>
    <div class="field"><label>المبلغ (ج.م)</label><input id="f_expAmount" type="number" placeholder="0"></div>
    <div class="field"><label>التاريخ</label><input id="f_expDate" type="date" value="${todayStr()}"></div>
    <button class="btn" onclick="saveExpense()">💾 حفظ</button>
  `;
  openModal(html);
}

function saveExpense(){
  const desc = document.getElementById('f_expDesc').value.trim();
  const amount = Number(document.getElementById('f_expAmount').value)||0;
  const date = document.getElementById('f_expDate').value || todayStr();
  if(!desc){ toast('أدخل وصف المصروف'); return; }
  if(amount<=0){ toast('أدخل مبلغاً صحيحاً'); return; }
  const record = {id:uid(), desc, amount, date};
  db.expenses.push(record);
  logActivity(`🧵 مصروف جديد: ${desc} (${amount.toLocaleString('ar-EG')} ج.م)`);
  setUndo('إضافة المصروف', ()=>{
    db.expenses = db.expenses.filter(e=>e.id!==record.id);
    saveDB();
    renderExpenses();
  });
  saveDB();
  closeModal();
  renderExpenses();
  toast('تم إضافة المصروف ✅');
}

async function deleteExpense(id){
  if(!await appConfirm('حذف هذا المصروف؟')) return;
  const removed = db.expenses.find(e=>e.id===id);
  if(!removed) return;
  db.expenses = db.expenses.filter(e=>e.id!==id);
  logActivity(`🗑️ حذف مصروف: ${removed.desc}`);
  setUndo('حذف المصروف', ()=>{
    db.expenses.push(removed);
    saveDB();
    renderExpenses();
  });
  saveDB();
  renderExpenses();
  toast('تم الحذف');
}

/* ============================================================
   الإعدادات: الطاقة اليومية + أنواع التفصيل
   ============================================================ */
function renderSettings(){
  document.getElementById('workshopNameInput').value = db.workshopName||'';
  document.getElementById('ownerNameInput').value = db.ownerName||'';
  document.getElementById('ownerPhoneInput').value = db.ownerPhone||'';
  document.getElementById('workshopAddressInput').value = db.workshopAddress||'';
  fillThemeInputs();
  fillInvoiceCustomInputs();
  fillFontInputs();
  fillSkeletonInput();
  fillWideModeInput();
  renderHomeWidgetsSettings();
  document.getElementById('customCSSInput').value = db.customCSS||'';
  document.getElementById('customJSInput').value = db.customJS||'';
  document.getElementById('dailyCapacityInput').value = db.dailyCapacity;
  document.getElementById('workStartHourInput').value = db.workStartHour;
  document.getElementById('workEndHourInput').value = db.workEndHour;
  document.getElementById('vipThresholdInput').value = db.vipThreshold;
  document.getElementById('vipDiscountInput').value = db.vipDiscountPercent||0;
  document.getElementById('idleLockInput').value = db.idleLockMinutes;
  document.getElementById('debtThresholdInput').value = db.debtThreshold;
  document.getElementById('dayOffInput').value = String(db.dayOffWeekday ?? 0);
  document.getElementById('nextInvoiceInput').value = db.nextInvoiceNumber||1001;
  document.getElementById('taxDefaultInput').value = db.taxDefaultPercent||0;
  document.getElementById('urgentFeeDefaultInput').value = db.urgentFeeDefaultPercent||0;
  document.getElementById('lastBackupTxt').textContent = db.lastBackupDate ? ('📅 آخر نسخة احتياطية: '+fmtDate(db.lastBackupDate)) : '⚠️ لم يتم عمل نسخة احتياطية بعد';
  renderTrash();
  renderGarmentTypes();
  renderHolidaysList();
  renderOccasionsList();
  renderActivityLog();
  renderCloudSyncCard();
  renderConflictBackupsCard();
  renderPushNotifyCard();
  renderInvoicePreviewCard();
  renderFinancePasswordCard();
}

function renderActivityLog(){
  const box = document.getElementById('activityLogList');
  const countTxt = document.getElementById('activityCountTxt');
  if(!box) return;
  const items = (db.activityLog||[]).slice().reverse().slice(0,50);
  if(countTxt) countTxt.textContent = (db.activityLog||[]).length ? `(${db.activityLog.length})` : '';
  box.innerHTML = items.length ? items.map(a=>`
    <div class="meta" style="padding:6px 0;border-bottom:1px dashed var(--stitch);">
      <span style="color:var(--muted);">${fmtActivityTime(a.ts)}</span> — ${escapeHtml(a.text)}
    </div>`).join('') : `<div class="empty-msg">لا يوجد نشاط مسجل بعد</div>`;
}

async function clearActivityLog(){
  if(!await appConfirm('هل تريد مسح سجل النشاط بالكامل؟')) return;
  db.activityLog = [];
  saveDB();
  renderActivityLog();
  toast('تم مسح السجل');
}

function saveWorkshopInfo(){
  const name = document.getElementById('workshopNameInput').value.trim();
  if(!name){ toast('أدخل اسم الورشة'); return; }
  db.workshopName = name;
  db.ownerName = document.getElementById('ownerNameInput').value.trim();
  db.ownerPhone = document.getElementById('ownerPhoneInput').value.trim();
  db.workshopAddress = document.getElementById('workshopAddressInput').value.trim();
  saveDB();
  applyWorkshopBranding();
  renderInvoicePreviewCard();
  toast('تم حفظ بيانات الورشة ✅');
}

// يحدّث اسم الورشة في كل الأماكن التي تظهر فيها داخل الواجهة
const BRAND_EMBLEM_DEFAULT_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>';

function applyWorkshopBranding(){
  const name = (db && db.workshopName) ? db.workshopName : 'ورشة تفصيل الجلابيب';
  document.title = name;
  const lockTitle = document.getElementById('lockTitle');
  if(lockTitle) lockTitle.textContent = name;
  const sidenavTitle = document.getElementById('sidenavTitle');
  if(sidenavTitle) sidenavTitle.textContent = name;

  const logo = db && db.workshopLogo;
  document.querySelectorAll('.brand-emblem').forEach(function(el){
    el.innerHTML = logo ? `<img src="${logo}" alt="شعار الورشة">` : BRAND_EMBLEM_DEFAULT_SVG;
  });
}

// يقرأ ملف الصورة اللي المستخدم اختاره ويخزنه كـ base64 داخل قاعدة البيانات (بيتزامن مع باقي البيانات لو المزامنة السحابية مفعّلة)
function onLogoFileChosen(input){
  const file = input.files && input.files[0];
  if(!file) return;
  if(!file.type.startsWith('image/')){ toast('اختار ملف صورة صالح'); input.value=''; return; }
  if(file.size > 900*1024){
    toast('⚠️ الصورة كبيرة أوي — اختار صورة أصغر من 900 كيلوبايت');
    input.value='';
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e){
    db.workshopLogo = e.target.result;
    saveDB();
    applyWorkshopBranding();
    renderSettings();
    toast('✅ اتحفظ شعار الورشة');
  };
  reader.onerror = function(){ toast('تعذر قراءة الصورة'); };
  reader.readAsDataURL(file);
}

function removeWorkshopLogo(){
  db.workshopLogo = null;
  saveDB();
  applyWorkshopBranding();
  renderSettings();
  toast('تم حذف الشعار — رجع الأيقونة الافتراضية');
}

/* ============================================================
   تخصيص المظهر: الألوان + شكل الأزرار + كود مخصص
   ============================================================ */
const DEFAULT_THEME = {primary:'#1F6D57', primaryDark:'#123C2F', accent:'#B8863B', bg:'#F6F1E6'};
const DEFAULT_BTN_RADIUS = 12;

function applyTheme(){
  const t = (db && db.theme) ? db.theme : DEFAULT_THEME;
  const root = document.documentElement.style;
  root.setProperty('--primary', t.primary||DEFAULT_THEME.primary);
  root.setProperty('--primary-dark', t.primaryDark||DEFAULT_THEME.primaryDark);
  root.setProperty('--accent', t.accent||DEFAULT_THEME.accent);
  root.setProperty('--bg', t.bg||DEFAULT_THEME.bg);
  root.setProperty('--btn-radius', (Number(db&&db.btnRadius)||DEFAULT_BTN_RADIUS)+'px');
}

function saveTheme(){
  db.theme = {
    primary: document.getElementById('colorPrimary').value,
    primaryDark: document.getElementById('colorPrimaryDark').value,
    accent: document.getElementById('colorAccent').value,
    bg: document.getElementById('colorBg').value
  };
  saveDB();
  applyTheme();
  renderInvoicePreviewCard();
  toast('تم حفظ الألوان ✅');
}

function resetTheme(){
  db.theme = {...DEFAULT_THEME};
  saveDB();
  applyTheme();
  fillThemeInputs();
  renderInvoicePreviewCard();
  toast('تم استعادة الألوان الافتراضية ✅');
}

// ===== أشكال ألوان جاهزة =====
const THEME_PRESETS = {
  classic: {primary:'#1F6D57', primaryDark:'#123C2F', accent:'#B8863B', bg:'#F6F1E6'},
  modern:  {primary:'#2563A6', primaryDark:'#123C5F', accent:'#3FB6A8', bg:'#EEF3F8'},
  warm:    {primary:'#A2453A', primaryDark:'#5C201A', accent:'#D4A24C', bg:'#FBF1E7'},
  mono:    {primary:'#3A3A3A', primaryDark:'#1A1A1A', accent:'#8A8A8A', bg:'#F2F2F0'}
};

function applyThemePreset(name){
  const preset = THEME_PRESETS[name];
  if(!preset) return;
  db.theme = {...preset};
  saveDB();
  applyTheme();
  fillThemeInputs();
  renderInvoicePreviewCard();
  toast('تم تطبيق الشكل الجديد ✅');
}

/* ============================================================
   تخصيص نصوص وألوان كل سطر في الفاتورة
   ============================================================ */
// أزواج [id عنصر الإدخال، اسم الحقل] — نفس القائمة بتتستخدم في التعبئة والحفظ عشان لو
// أضفنا سطر جديد نضيفه هنا مرة واحدة بس
const INVOICE_TEXT_FIELDS = [
  ['invText_title','title'], ['invText_badgePrefix','badgePrefix'],
  ['invText_clientLabel','clientLabel'], ['invText_phoneLabel','phoneLabel'],
  ['invText_receivedLabel','receivedLabel'], ['invText_deliveryLabel','deliveryLabel'],
  ['invText_colType','colType'], ['invText_colQty','colQty'],
  ['invText_colUnitPrice','colUnitPrice'], ['invText_colTotal','colTotal'],
  ['invText_extraLabel','extraLabel'], ['invText_discountLabel','discountLabel'],
  ['invText_taxLabel','taxLabel'], ['invText_totalLabel','totalLabel'],
  ['invText_paidLabel','paidLabel'], ['invText_remainingLabel','remainingLabel'],
  ['invText_footerText','footerText']
];
const INVOICE_COLOR_FIELDS = [
  ['invColor_subText','subText'], ['invColor_titleText','titleText'],
  ['invColor_labelText','labelText'], ['invColor_valueText','valueText'],
  ['invColor_itemsHeadBg','itemsHeadBg'], ['invColor_itemsHeadText','itemsHeadText'],
  ['invColor_rowAltBg','rowAltBg'], ['invColor_totalsBg','totalsBg'],
  ['invColor_footerText','footerText']
];

function fillInvoiceCustomInputs(){
  const ic = getInvoiceCustom();
  INVOICE_TEXT_FIELDS.forEach(([id,key])=>{
    const el = document.getElementById(id);
    if(el) el.value = ic.labels[key]||'';
  });
  INVOICE_COLOR_FIELDS.forEach(([id,key])=>{
    const el = document.getElementById(id);
    // لون "خلفية عناوين جدول الأصناف" ممكن يكون فاضي (يعني ياخد اللون الأساسي تلقائيًا)
    if(el) el.value = ic.colors[key] || (key==='itemsHeadBg' ? (db.theme&&db.theme.primary||'#1F6D57') : '#000000');
  });
}

function saveInvoiceCustom(){
  const labels = {};
  INVOICE_TEXT_FIELDS.forEach(([id,key])=>{
    const el = document.getElementById(id);
    const v = el ? el.value.trim() : '';
    if(v) labels[key] = v;
  });
  const colors = {};
  INVOICE_COLOR_FIELDS.forEach(([id,key])=>{
    const el = document.getElementById(id);
    if(el && el.value) colors[key] = el.value;
  });
  db.invoiceCustom = {labels, colors};
  saveDB();
  renderInvoicePreviewCard();
  toast('تم حفظ نصوص وألوان الفاتورة ✅');
}

function resetInvoiceCustom(){
  db.invoiceCustom = {};
  saveDB();
  fillInvoiceCustomInputs();
  renderInvoicePreviewCard();
  toast('تم استعادة نصوص وألوان الفاتورة الافتراضية ✅');
}

function saveButtonRadius(){
  db.btnRadius = Number(document.getElementById('btnRadiusInput').value)||DEFAULT_BTN_RADIUS;
  saveDB();
  applyTheme();
  toast('تم حفظ شكل الأزرار ✅');
}

/* ============================================================
   وضع الشاشة الكبيرة (تابلت)
   ============================================================ */
function applyWideMode(){
  document.documentElement.classList.toggle('wide-mode', !!(db && db.wideMode));
}
function toggleWideMode(on){
  db.wideMode = !!on;
  saveDB();
  applyWideMode();
}
function fillWideModeInput(){
  const el = document.getElementById('wideModeToggleInput');
  if(el) el.checked = !!(db && db.wideMode);
}

/* ============================================================
   تخصيص الشاشة الرئيسية (ترتيب/إخفاء الودجت)
   ============================================================ */
const HOME_WIDGETS_DEFAULT = ['alerts','stats','weekly','today','commitment','upcoming','late'];
const HOME_WIDGET_LABELS = {
  alerts:'🔔 التنبيهات', stats:'📊 الإحصائيات', weekly:'📅 نظرة الأسبوع', today:'🌅 خطة النهاردة',
  commitment:'📈 الالتزام بالخطة', upcoming:'📅 أقرب مواعيد التسليم', late:'⏰ طلبات متأخرة'
};

// يرجّع ترتيب الودجت المحفوظ، وبينشئ واحد افتراضي أول مرة أو لو فيه ودجت جديدة اتضافت في تحديث لاحق
// (وبيشيل أي ودجت قديم بقى مش موجود في القايمة الحالية، زي "تنبيهات الالتزامات الشخصية"
// اللي بقت جزء من تاب "نظرة عامة" جوه صفحة "التزاماتي الشخصية" بدل الشاشة الرئيسية)
function getHomeWidgetsOrder(){
  if(!Array.isArray(db.homeWidgets) || !db.homeWidgets.length){
    db.homeWidgets = HOME_WIDGETS_DEFAULT.map(id=>({id, visible:true}));
  }
  db.homeWidgets = db.homeWidgets.filter(w=>HOME_WIDGETS_DEFAULT.includes(w.id));
  HOME_WIDGETS_DEFAULT.forEach(id=>{
    if(!db.homeWidgets.some(w=>w.id===id)) db.homeWidgets.push({id, visible:true});
  });
  return db.homeWidgets;
}

// يطبّق الترتيب والإظهار/الإخفاء فعلياً على عناصر الشاشة الرئيسية
function applyHomeWidgetsLayout(){
  const order = getHomeWidgetsOrder();
  const container = document.getElementById('homeWidgetsContainer');
  if(!container) return;
  order.forEach(w=>{
    const el = document.getElementById('widget-'+w.id);
    if(!el) return;
    el.style.display = (w.visible===false) ? 'none' : '';
    container.appendChild(el);
  });
}

function moveHomeWidget(id, dir){
  const order = getHomeWidgetsOrder();
  const idx = order.findIndex(w=>w.id===id);
  const newIdx = idx+dir;
  if(idx<0 || newIdx<0 || newIdx>=order.length) return;
  const tmp = order[idx];
  order[idx] = order[newIdx];
  order[newIdx] = tmp;
  saveDB();
  applyHomeWidgetsLayout();
  renderHomeWidgetsSettings();
}

function toggleHomeWidget(id, visible){
  const order = getHomeWidgetsOrder();
  const w = order.find(w=>w.id===id);
  if(w) w.visible = !!visible;
  saveDB();
  applyHomeWidgetsLayout();
}

function resetHomeWidgets(){
  db.homeWidgets = HOME_WIDGETS_DEFAULT.map(id=>({id, visible:true}));
  saveDB();
  applyHomeWidgetsLayout();
  renderHomeWidgetsSettings();
  toast('تم استعادة ترتيب الشاشة الرئيسية الافتراضي ✅');
}

function renderHomeWidgetsSettings(){
  const box = document.getElementById('homeWidgetsSettingsList');
  if(!box) return;
  const order = getHomeWidgetsOrder();
  box.innerHTML = order.map((w,i)=>`
    <div class="row" style="padding:8px 0;border-bottom:1px solid var(--border);">
      <span>${HOME_WIDGET_LABELS[w.id]||w.id}</span>
      <div style="display:flex;gap:6px;align-items:center;">
        <button class="btn sm outline" style="padding:6px 10px;" ${i===0?'disabled':''} onclick="moveHomeWidget('${w.id}',-1)">⬆️</button>
        <button class="btn sm outline" style="padding:6px 10px;" ${i===order.length-1?'disabled':''} onclick="moveHomeWidget('${w.id}',1)">⬇️</button>
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
          <input type="checkbox" style="width:18px;height:18px;" ${w.visible!==false?'checked':''} onchange="toggleHomeWidget('${w.id}', this.checked)">
        </label>
      </div>
    </div>
  `).join('');
}

/* ============================================================
   تخصيص الخط
   ============================================================ */
const FONT_FAMILIES = {
  default:  '"IBM Plex Sans Arabic","Tajawal","Segoe UI",Tahoma,Arial,sans-serif',
  tajawal:  '"Tajawal","IBM Plex Sans Arabic","Segoe UI",Tahoma,Arial,sans-serif',
  cairo:    '"Cairo","IBM Plex Sans Arabic","Segoe UI",Tahoma,Arial,sans-serif',
  almarai:  '"Almarai","IBM Plex Sans Arabic","Segoe UI",Tahoma,Arial,sans-serif',
  notokufi: '"Noto Kufi Arabic","IBM Plex Sans Arabic","Segoe UI",Tahoma,Arial,sans-serif'
};
const DEFAULT_FONT = {family:'default', size:'1'};

function applyFontSettings(){
  const f = (db && db.fontSettings) ? db.fontSettings : DEFAULT_FONT;
  const fam = FONT_FAMILIES[f.family] || FONT_FAMILIES.default;
  document.documentElement.style.setProperty('--font-body', fam);
  const scale = Number(f.size) || 1;
  document.documentElement.style.setProperty('--font-scale', String(scale));
  // "zoom" بيكبّر/يصغّر كل حاجة (نص، مسافات، أيقونات) بشكل متناسق - مدعوم في متصفحات كروميوم وتطبيقات الـ WebView
  const appEl = document.getElementById('app');
  const lockEl = document.getElementById('lockScreen');
  if(appEl) appEl.style.zoom = String(scale);
  if(lockEl) lockEl.style.zoom = String(scale);
}

function fillFontInputs(){
  const f = (db && db.fontSettings) ? db.fontSettings : DEFAULT_FONT;
  const elF = document.getElementById('fontFamilyInput');
  const elS = document.getElementById('fontSizeInput');
  if(elF) elF.value = f.family || DEFAULT_FONT.family;
  if(elS) elS.value = String(f.size || DEFAULT_FONT.size);
}

function saveFontSettings(){
  db.fontSettings = {
    family: document.getElementById('fontFamilyInput').value,
    size: document.getElementById('fontSizeInput').value
  };
  saveDB();
  applyFontSettings();
  toast('تم حفظ إعدادات الخط ✅');
}

function resetFontSettings(){
  db.fontSettings = {...DEFAULT_FONT};
  saveDB();
  applyFontSettings();
  fillFontInputs();
  toast('تم استعادة الخط الافتراضي ✅');
}

/* ============================================================
   تأثير التحميل الهيكلي (Skeleton Loading)
   ============================================================ */
function showSkeleton(){
  const el = document.getElementById('skeletonOverlay');
  if(el) el.classList.add('show');
}
function hideSkeleton(){
  const el = document.getElementById('skeletonOverlay');
  if(el) el.classList.remove('show');
}
function toggleSkeletonLoading(on){
  db.skeletonLoading = !!on;
  saveDB();
  toast(on ? 'تم تفعيل تأثير التحميل ✅' : 'تم إيقاف تأثير التحميل');
}
function fillSkeletonInput(){
  const el = document.getElementById('skeletonToggleInput');
  if(el) el.checked = !!(db && db.skeletonLoading);
}

/* ===== الوضع الليلي ===== */
function applyDarkMode(){
  const on = !!(db && db.darkMode);
  document.documentElement.setAttribute('data-theme', on ? 'dark' : 'light');
  const btn = document.getElementById('themeToggleBtn');
  if(btn) btn.textContent = on ? '☀️' : '🌙';
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if(metaTheme) metaTheme.setAttribute('content', on ? '#171916' : '#1F6D57');
}

function toggleDarkMode(){
  db.darkMode = !db.darkMode;
  saveDB();
  applyDarkMode();
}

function fillThemeInputs(){
  const t = (db && db.theme) ? db.theme : DEFAULT_THEME;
  const elP=document.getElementById('colorPrimary'), elPD=document.getElementById('colorPrimaryDark'),
        elA=document.getElementById('colorAccent'), elBg=document.getElementById('colorBg'),
        elR=document.getElementById('btnRadiusInput');
  if(elP) elP.value = t.primary||DEFAULT_THEME.primary;
  if(elPD) elPD.value = t.primaryDark||DEFAULT_THEME.primaryDark;
  if(elA) elA.value = t.accent||DEFAULT_THEME.accent;
  if(elBg) elBg.value = t.bg||DEFAULT_THEME.bg;
  if(elR) elR.value = String(Number(db&&db.btnRadius)||DEFAULT_BTN_RADIUS);
}

// تطبيق CSS المخصص عبر وسم <style> منفصل، آمن ولا يحتاج تحذير
function applyCustomCSS(){
  let styleTag = document.getElementById('userCustomCSS');
  if(!styleTag){
    styleTag = document.createElement('style');
    styleTag.id = 'userCustomCSS';
    document.head.appendChild(styleTag);
  }
  styleTag.textContent = (db && db.customCSS) ? db.customCSS : '';
}

// تشغيل الـ JavaScript المخصص بأمان قدر الإمكان (محاط بـ try/catch حتى لا يعطل التطبيق كله لو فيه خطأ)
function runCustomJS(){
  if(!db || !db.customJS || !db.customJS.trim()) return;
  try{
    new Function(db.customJS)();
  }catch(e){
    toast('⚠️ خطأ في الكود المخصص: '+e.message);
  }
}

function saveCustomCode(){
  db.customCSS = document.getElementById('customCSSInput').value;
  db.customJS = document.getElementById('customJSInput').value;
  saveDB();
  applyCustomCSS();
  runCustomJS();
  toast('تم تطبيق وحفظ الكود المخصص ✅');
}

async function resetCustomCode(){
  if(!await appConfirm('هل تريد مسح كل الكود المخصص (CSS وJavaScript) والعودة للوضع الافتراضي؟')) return;
  db.customCSS = '';
  db.customJS = '';
  saveDB();
  applyCustomCSS();
  document.getElementById('customCSSInput').value = '';
  document.getElementById('customJSInput').value = '';
  toast('تم استعادة الوضع الافتراضي ✅');
}

// تنزيل نسخة كاملة من كود التطبيق (HTML) بكل التخصيصات الحالية، لفتحها أو تعديلها خارج التطبيق
async function downloadFullAppCode(){
  try{
    const fullHtml = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
    const blob = new Blob([fullHtml], {type:'text/html'});
    const ok = await saveOrShareFile(blob, (db.workshopName||'تطبيق_الورشة')+'.html');
    if(ok) toast('تم حفظ نسخة كود التطبيق ✅');
  }catch(e){
    toast('حدث خطأ أثناء التنزيل');
  }
}

function saveDayOff(){
  const val = Number(document.getElementById('dayOffInput').value);
  db.dayOffWeekday = val;
  saveDB();
  toast('تم حفظ يوم الإجازة ✅');
  if(currentPage==='home') renderHome();
}

/* ============================================================
   مواعيد الأعياد والإجازات (تواريخ محددة، بخلاف يوم الإجازة الأسبوعي)
   ============================================================ */
function addHoliday(){
  const date = document.getElementById('holidayDateInput').value;
  const name = document.getElementById('holidayNameInput').value.trim();
  if(!date){ toast('اختر تاريخ العيد أو الإجازة'); return; }
  if(!name){ toast('أدخل اسم المناسبة'); return; }
  if(!db.holidays) db.holidays=[];
  if(db.holidays.some(h=>h.date===date)){ toast('فيه إجازة متسجلة بالفعل في نفس التاريخ'); return; }
  db.holidays.push({id:uid(), date, name});
  saveDB();
  document.getElementById('holidayDateInput').value='';
  document.getElementById('holidayNameInput').value='';
  renderHolidaysList();
  if(currentPage==='home') renderHome();
  toast('تمت الإضافة ✅');
}

async function deleteHoliday(id){
  if(!await appConfirm('حذف هذه الإجازة؟')) return;
  db.holidays = (db.holidays||[]).filter(h=>h.id!==id);
  saveDB();
  renderHolidaysList();
  if(currentPage==='home') renderHome();
  toast('تم الحذف');
}

function renderHolidaysList(){
  const box = document.getElementById('holidaysList');
  if(!box) return;
  const list = (db.holidays||[]).slice().sort((a,b)=>a.date.localeCompare(b.date));
  if(!list.length){ box.innerHTML = '<div class="empty-msg">لا يوجد أعياد أو إجازات مضافة بعد</div>'; return; }
  const today = todayStr();
  box.innerHTML = list.map(h=>`
    <div class="row" style="padding:8px 0;border-bottom:1px dashed var(--stitch);">
      <span style="${h.date<today?'color:var(--muted);':''}">📅 ${fmtDate(h.date)} — ${escapeHtml(h.name)}</span>
      <button class="btn sm danger" onclick="deleteHoliday('${h.id}')">🗑️</button>
    </div>
  `).join('');
}

/* ============================================================
   تقويم المناسبات المسبق (تنبيه استعداد قبل مواسم الذروة)
   بخلاف "مواعيد الأعياد والإجازات" اللي بتوقف حساب أيام الشغل،
   المناسبات دي غرضها بس تنبيهك بدري إن الطلبات المتوقعة هتزيد
   ============================================================ */
function addOccasion(){
  const date = document.getElementById('occasionDateInput').value;
  const name = document.getElementById('occasionNameInput').value.trim();
  const alertDays = Number(document.getElementById('occasionAlertDaysInput').value)||14;
  if(!date){ toast('اختر تاريخ المناسبة'); return; }
  if(!name){ toast('أدخل اسم المناسبة'); return; }
  if(!db.occasions) db.occasions=[];
  db.occasions.push({id:uid(), date, name, alertDays});
  saveDB();
  document.getElementById('occasionDateInput').value='';
  document.getElementById('occasionNameInput').value='';
  document.getElementById('occasionAlertDaysInput').value='14';
  renderOccasionsList();
  if(currentPage==='home') renderHome();
  toast('تمت الإضافة ✅');
}

async function deleteOccasion(id){
  if(!await appConfirm('حذف هذه المناسبة؟')) return;
  db.occasions = (db.occasions||[]).filter(o=>o.id!==id);
  saveDB();
  renderOccasionsList();
  if(currentPage==='home') renderHome();
  toast('تم الحذف');
}

function renderOccasionsList(){
  const box = document.getElementById('occasionsList');
  if(!box) return;
  const list = (db.occasions||[]).slice().sort((a,b)=>a.date.localeCompare(b.date));
  if(!list.length){ box.innerHTML = '<div class="empty-msg">لا يوجد مناسبات مضافة بعد</div>'; return; }
  const today = todayStr();
  box.innerHTML = list.map(o=>`
    <div class="row" style="padding:8px 0;border-bottom:1px dashed var(--stitch);">
      <span style="${o.date<today?'color:var(--muted);':''}">🎉 ${fmtDate(o.date)} — ${escapeHtml(o.name)} <span class="meta">(تنبيه قبلها بـ${o.alertDays||14} يوم)</span></span>
      <button class="btn sm danger" onclick="deleteOccasion('${o.id}')">🗑️</button>
    </div>
  `).join('');
}

function saveDebtThreshold(){
  const val = Number(document.getElementById('debtThresholdInput').value);
  if(!val || val<=0){ toast('أدخل رقماً صحيحاً أكبر من صفر'); return; }
  db.debtThreshold = val;
  saveDB();
  toast('تم الحفظ ✅');
}

// إعادة حساب مواعيد التسليم لكل الطلبات النشطة (غير المسلَّمة) من جديد
// بنفس منطق اقتراح الموعد عند إنشاء الطلب، لكن بناءً على الطاقة الاستيعابية
// الحالية (بعد التعديل) — مرتبة حسب أسبقية الاستلام (الأقدم يتحسب أولاً)
function recalculateAllDeliveryDates(){
  const capacity = Number(db.dailyCapacity)||500;
  const avgDelay = avgDelayDays();
  const safetyDays = avgDelay>0.5 ? 2+Math.ceil(avgDelay) : 2;

  const active = db.orders
    .filter(o=>o.status!=='تم التسليم')
    .sort((a,b)=>(a.dateReceived||'').localeCompare(b.dateReceived||'') || String(a.id).localeCompare(String(b.id)));

  let cumValue = 0;
  active.forEach(o=>{
    cumValue += orderTotal(o);
    const daysNeeded = Math.max(1, Math.ceil(cumValue/capacity));
    const totalDays = daysNeeded + safetyDays;
    o.dateDelivery = addWorkDaysFromNow(totalDays).toISOString().slice(0,10);
  });

  saveDB();
  renderAll();
}

async function saveDailyCapacity(){
  const val = Number(document.getElementById('dailyCapacityInput').value);
  if(!val || val<=0){ toast('أدخل رقماً صحيحاً أكبر من صفر'); return; }
  const startH = Number(document.getElementById('workStartHourInput').value);
  const endH = Number(document.getElementById('workEndHourInput').value);
  if(!Number.isFinite(startH) || !Number.isFinite(endH) || endH<=startH){
    toast('تأكد إن ساعة النهاية بعد ساعة البداية'); return;
  }
  const capacityChanged = Number(db.dailyCapacity)!==val;
  db.dailyCapacity = val;
  db.workStartHour = startH;
  db.workEndHour = endH;
  saveDB();
  if(currentPage==='home') renderTodayPlan();
  toast('تم حفظ الطاقة اليومية ✅');

  if(capacityChanged){
    const hasActiveOrders = db.orders.some(o=>o.status!=='تم التسليم');
    if(hasActiveOrders && await appConfirm('تم تغيير الطاقة الاستيعابية اليومية. هل تريد إعادة حساب مواعيد التسليم لكل الطلبات الحالية (غير المسلَّمة) بناءً على القيمة الجديدة؟', {okText:'إعادة الحساب', danger:false})){
      recalculateAllDeliveryDates();
      toast('تم تحديث مواعيد التسليم لكل الطلبات ✅');
    }
  }
}

function saveInvoiceTaxSettings(){
  const nextInv = Number(document.getElementById('nextInvoiceInput').value);
  const taxDef = Number(document.getElementById('taxDefaultInput').value);
  const urgentFeeDef = Number(document.getElementById('urgentFeeDefaultInput').value);
  if(!nextInv || nextInv<=0){ toast('أدخل رقم فاتورة صحيح أكبر من صفر'); return; }
  if(!Number.isFinite(taxDef) || taxDef<0){ toast('نسبة الضريبة لا يمكن أن تكون رقماً سالباً'); return; }
  if(!Number.isFinite(urgentFeeDef) || urgentFeeDef<0){ toast('نسبة رسوم الاستعجال لا يمكن أن تكون رقماً سالباً'); return; }
  db.nextInvoiceNumber = Math.round(nextInv);
  db.taxDefaultPercent = taxDef;
  db.urgentFeeDefaultPercent = urgentFeeDef;
  saveDB();
  toast('تم الحفظ ✅');
}

function saveVipThreshold(){
  const val = Number(document.getElementById('vipThresholdInput').value);
  if(!val || val<=0){ toast('أدخل رقماً صحيحاً أكبر من صفر'); return; }
  const discPct = Number(document.getElementById('vipDiscountInput').value)||0;
  if(discPct<0 || discPct>100){ toast('نسبة الخصم لازم تكون بين 0 و100'); return; }
  db.vipThreshold = val;
  db.vipDiscountPercent = discPct;
  saveDB();
  toast('تم الحفظ ✅');
}

function saveIdleLock(){
  const val = Number(document.getElementById('idleLockInput').value);
  if(!val || val<=0){ toast('أدخل رقماً صحيحاً أكبر من صفر'); return; }
  db.idleLockMinutes = val;
  saveDB();
  resetIdleTimer();
  toast('تم الحفظ ✅');
}

function renderGarmentTypes(){
  const list = db.garmentTypes.slice().sort((a,b)=>a.name.localeCompare(b.name,'ar'));
  document.getElementById('garmentTypesList').innerHTML = list.length ? list.map(g=>`
    <div class="card" style="margin-bottom:8px;">
      <div class="row">
        <h3>${escapeHtml(g.name)}</h3>
        <b style="color:var(--primary)">${Number(g.price).toLocaleString('ar-EG')} ج.م</b>
      </div>
      <div class="btn-row">
        <button class="btn sm secondary" onclick="openGarmentTypeModal('${g.id}')">✏️ تعديل</button>
        <button class="btn sm danger" onclick="deleteGarmentType('${g.id}')">🗑️ حذف</button>
      </div>
    </div>
  `).join('') : `<div class="empty-msg">لا توجد أنواع مضافة بعد</div>`;
}

function openGarmentTypeModal(id){
  const g = id ? db.garmentTypes.find(x=>x.id===id) : null;
  const html = `
    <div class="modal-head"><h3>${g?'✏️ تعديل نوع':'➕ نوع تفصيل جديد'}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="field"><label>اسم نوع التفصيل</label><input id="f_gtName" value="${g?escapeHtml(g.name):''}" placeholder="مثال: جلابية رجالي كلاسيك"></div>
    <div class="field"><label>السعر الأساسي (ج.م)</label><input id="f_gtPrice" type="number" value="${g?g.price:''}" placeholder="0"></div>
    <button class="btn" onclick="saveGarmentType(${g?`'${g.id}'`:'null'})">💾 حفظ</button>
  `;
  openModal(html);
}

function saveGarmentType(id){
  const name = document.getElementById('f_gtName').value.trim();
  const price = Number(document.getElementById('f_gtPrice').value)||0;
  if(!name){ toast('أدخل اسم النوع'); return; }
  if(price<=0){ toast('أدخل سعراً صحيحاً'); return; }
  const duplicate = db.garmentTypes.find(g=>g.id!==id && g.name.trim()===name);
  if(duplicate){ toast('يوجد نوع بنفس الاسم بالفعل'); return; }
  if(id){
    const g = db.garmentTypes.find(x=>x.id===id);
    Object.assign(g, {name, price});
  } else {
    db.garmentTypes.push({id:uid(), name, price});
  }
  saveDB();
  closeModal();
  renderGarmentTypes();
  toast('تم الحفظ ✅');
}

async function deleteGarmentType(id){
  if(!await appConfirm('حذف هذا النوع؟')) return;
  db.garmentTypes = db.garmentTypes.filter(g=>g.id!==id);
  saveDB();
  renderGarmentTypes();
  toast('تم الحذف');
}

/* ============================================================
   الإعدادات: كلمة المرور + نسخ احتياطي
   ============================================================ */
function changePassword(){
  const oldP = document.getElementById('oldPass').value;
  const newP = document.getElementById('newPass').value;
  if(oldP !== db.password){ toast('الرقم الحالي غير صحيح'); return; }
  if(!/^\d{4}$/.test(newP)){ toast('الرقم الجديد يجب أن يكون 4 أرقام'); return; }
  db.password = newP;
  saveDB();
  document.getElementById('oldPass').value='';
  document.getElementById('newPass').value='';
  toast('تم تغيير الرقم السري بنجاح ✅');
}

/* ---- رقم سري إضافي ومستقل لصفحة المالية (خصوصية إضافية للبيانات
   المالية والالتزامات الشخصية، غير رقم قفل التطبيق العام) ---- */
function renderFinancePasswordCard(){
  const box = document.getElementById('financePasswordCardWrap');
  if(!box) return;
  const isSet = !!db.financePassword;
  box.innerHTML = `
    <h3>🔐 رقم سري إضافي لصفحتي المالية والتزاماتي الشخصية</h3>
    <p class="meta">حماية منفصلة عن رقم قفل التطبيق العام — تفيدك لو في حد تاني بيستخدم التطبيق (موظف استقبال مثلاً) ومش عايزه يشوف أرباحك أو التزاماتك الشخصية.</p>
    <p class="meta">الحالة: ${isSet?'🔒 مفعّلة':'🔓 غير مفعّلة'}</p>
    ${isSet?`<div class="field"><label>الرقم الحالي</label><input type="tel" maxlength="4" id="financeOldPass" inputmode="numeric" autocomplete="off" class="pin-input" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,4)"></div>`:''}
    <div class="field"><label>${isSet?'الرقم الجديد (4 أرقام)':'رقم سري المالية (4 أرقام)'}</label><input type="tel" maxlength="4" id="financeNewPass" inputmode="numeric" autocomplete="off" class="pin-input" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,4)"></div>
    <div class="btn-row">
      <button class="btn" onclick="saveFinancePassword()">💾 ${isSet?'تغيير الرقم':'تفعيل الحماية'}</button>
      ${isSet?`<button class="btn danger" onclick="removeFinancePassword()">🗑️ إلغاء الحماية</button>`:''}
    </div>
  `;
}

function saveFinancePassword(){
  const isSet = !!db.financePassword;
  if(isSet){
    const oldP = (document.getElementById('financeOldPass')||{}).value||'';
    if(oldP !== db.financePassword){ toast('الرقم الحالي غير صحيح'); return; }
  }
  const newP = (document.getElementById('financeNewPass')||{}).value||'';
  if(!/^\d{4}$/.test(newP)){ toast('الرقم يجب أن يكون 4 أرقام'); return; }
  db.financePassword = newP;
  window.financeUnlocked = false; // يتطلب دخول بالرقم الجديد من أول مرة
  updateFinanceLockUI();
  saveDB();
  renderFinancePasswordCard();
  toast(isSet?'تم تغيير رقم المالية ✅':'تم تفعيل حماية صفحة المالية ✅');
}

async function removeFinancePassword(){
  if(!db.financePassword) return;
  if(!await appConfirm('هيتم إلغاء الحماية الإضافية عن صفحة المالية، وأي حد يفتح التطبيق هيقدر يشوفها. متأكد؟')) return;
  db.financePassword = null;
  window.financeUnlocked = true;
  updateFinanceLockUI();
  saveDB();
  renderFinancePasswordCard();
  toast('تم إلغاء حماية صفحة المالية');
}

function csvEscape(val){
  let s = (val===null||val===undefined) ? '' : String(val);
  if(/[",\n]/.test(s)) s = '"'+s.replace(/"/g,'""')+'"';
  return s;
}

async function downloadCSV(rows, filename){
  const content = rows.map(r=>r.map(csvEscape).join(',')).join('\r\n');
  // BOM في الأول عشان Excel يعرض العربي صح
  const blob = new Blob(['\uFEFF'+content], {type:'text/csv;charset=utf-8;'});
  const ok = await saveOrShareFile(blob, filename);
  if(ok) toast('تم حفظ الملف ✅');
}

/* ============================================================
   تصدير Excel حقيقي (SpreadsheetML) — من غير أي مكتبة خارجية أو
   اتصال إنترنت (زي رسم الفاتورة بالظبط)، عشان يشتغل جوه أي WebView
   حتى من غير نت. الملف بيتفتح مباشرة في Excel/WPS/Google Sheets
   بتنسيق حقيقي (أعمدة، شيتات متعددة) مش مجرد نص مفصول بفواصل.
   ============================================================ */
function xmlEscape(s){
  return String(s===null||s===undefined?'':s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// sheets: [{name, headers:['عمود1',...], rows:[[قيمة1,...], ...]}]
function buildExcelXml(sheets){
  const sheetsXml = sheets.map(sheet=>{
    const headerCells = sheet.headers.map(h=>`<Cell ss:StyleID="hdr"><Data ss:Type="String">${xmlEscape(h)}</Data></Cell>`).join('');
    const dataRows = sheet.rows.map(r=>{
      const cells = r.map(v=>{
        const isNum = typeof v==='number' && isFinite(v);
        return `<Cell><Data ss:Type="${isNum?'Number':'String'}">${xmlEscape(v)}</Data></Cell>`;
      }).join('');
      return `<Row>${cells}</Row>`;
    }).join('');
    return `<Worksheet ss:Name="${xmlEscape(sheet.name)}"><Table>${`<Row>${headerCells}</Row>`}${dataRows}</Table></Worksheet>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="hdr"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1F6D57" ss:Pattern="Solid"/></Style></Styles>
${sheetsXml}
</Workbook>`;
}

async function downloadExcel(sheets, filename){
  const xml = buildExcelXml(sheets);
  const blob = new Blob(['\uFEFF'+xml], {type:'application/vnd.ms-excel;charset=utf-8;'});
  const ok = await saveOrShareFile(blob, filename);
  if(ok) toast('تم حفظ ملف الإكسل ✅');
}

// شيت واحد بس (طلبات، أو عملاء، أو مصروفات) — لو حبيت تصدير جدول لوحده كإكسل حقيقي
function ordersExcelSheet(){
  const headers = ['رقم الفاتورة','اسم العميل','رقم الهاتف','نوع الجلابية','تاريخ الاستلام','تاريخ التسليم','الحالة','الإجمالي','المدفوع','المتبقي'];
  const rows = db.orders.slice().sort((a,b)=>(b.dateReceived||'').localeCompare(a.dateReceived||'')).map(o=>{
    const c = customerById(o.customerId);
    return [o.invoiceNumber||'', c?c.name:'عميل محذوف', c?(c.phone||''):'', orderTypeLabel(o),
      fmtDate(o.dateReceived), fmtDate(o.dateDelivery), o.status||'',
      orderTotal(o), Number(o.paid)||0, orderRemaining(o)];
  });
  return {name:'الطلبات', headers, rows};
}
function customersExcelSheet(){
  const headers = ['اسم العميل','رقم الهاتف','الطول','طول الكم','الصدر','الخزنة','وسع الكم','ملاحظات'];
  const rows = db.customers.slice().sort((a,b)=>a.name.localeCompare(b.name,'ar')).map(c=>
    [c.name, c.phone||'', c.length||'', c.sleeve||'', c.chest||'', c.waist||'', c.shoulder||'', c.notes||'']);
  return {name:'العملاء', headers, rows};
}
function expensesExcelSheet(){
  const headers = ['الوصف','المبلغ','التاريخ'];
  const rows = db.expenses.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(e=>
    [e.desc||'', Number(e.amount)||0, fmtDate(e.date)]);
  return {name:'المصروفات', headers, rows};
}

// الزرار الرئيسي: ملف Excel واحد فيه 3 شيتات (الطلبات + العملاء + المصروفات)
function exportAllExcel(){
  downloadExcel([ordersExcelSheet(), customersExcelSheet(), expensesExcelSheet()], 'تقرير_الورشة_شامل_'+todayStr()+'.xls');
}

function exportOrdersCSV(){
  const rows = [['رقم الفاتورة','اسم العميل','رقم الهاتف','نوع الجلابية','تاريخ الاستلام','تاريخ التسليم','الحالة','الإجمالي','المدفوع','المتبقي']];
  db.orders.slice().sort((a,b)=>(b.dateReceived||'').localeCompare(a.dateReceived||'')).forEach(o=>{
    const c = customerById(o.customerId);
    rows.push([
      o.invoiceNumber||'', c?c.name:'عميل محذوف', c?(c.phone||''):'', orderTypeLabel(o),
      fmtDate(o.dateReceived), fmtDate(o.dateDelivery), o.status||'',
      orderTotal(o), Number(o.paid)||0, orderRemaining(o)
    ]);
  });
  downloadCSV(rows, 'تقرير_الطلبات_'+todayStr()+'.csv');
}

function exportCustomersCSV(){
  const rows = [['اسم العميل','رقم الهاتف','الطول','طول الكم','الصدر','الخزنة','وسع الكم','ملاحظات']];
  db.customers.slice().sort((a,b)=>a.name.localeCompare(b.name,'ar')).forEach(c=>{
    rows.push([c.name, c.phone||'', c.length||'', c.sleeve||'', c.chest||'', c.waist||'', c.shoulder||'', c.notes||'']);
  });
  downloadCSV(rows, 'تقرير_العملاء_'+todayStr()+'.csv');
}

function exportExpensesCSV(){
  const rows = [['الوصف','المبلغ','التاريخ']];
  db.expenses.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).forEach(e=>{
    rows.push([e.desc||'', Number(e.amount)||0, fmtDate(e.date)]);
  });
  downloadCSV(rows, 'تقرير_المصروفات_'+todayStr()+'.csv');
}

async function exportBackup(){
  const blob = new Blob([JSON.stringify(db, null, 2)], {type:'application/json'});
  await saveOrShareFile(blob, 'نسخة_احتياطية_ورشة_الجلابيب_'+todayStr()+'.json');
  db.lastBackupDate = todayStr();
  saveDB();
  if(currentPage==='settings') renderSettings();
  toast('تم تنزيل النسخة الاحتياطية ✅');
}


function importBackup(event){
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = async function(e){
    try{
      const imported = JSON.parse(e.target.result);
      if(!imported.customers || !imported.orders){
        toast('ملف غير صالح');
        return;
      }
      if(!await appConfirm('سيتم استبدال كل البيانات الحالية بالنسخة المستوردة. هل أنت متأكد؟')) return;
      db = imported;
      if(!db.password) db.password='0000';
      if(!db.payments) db.payments=[];
      if(!db.expenses) db.expenses=[];
      if(!db.commitments) db.commitments=[];
      db.commitments.forEach(c=>{
        if(!c.priority) c.priority='essential';
        if(c.remainingMonths===undefined) c.remainingMonths=null;
        if(c.lastPaidMonth===undefined) c.lastPaidMonth=null;
        if(!c.type) c.type='تانية';
        if(!c.intervalMonths) c.intervalMonths=1;
        if(c.cycleStartYM===undefined) c.cycleStartYM=null;
      });
      if(db.savingsGoalTransferredAmount===undefined) db.savingsGoalTransferredAmount=0;
      if(!db.personalLoans) db.personalLoans=[];
      if(!db.houseExpenses) db.houseExpenses=[];
      if(db.lastCommitmentsMonthCheck===undefined) db.lastCommitmentsMonthCheck=null;
      if(!db.commitmentPayments) db.commitmentPayments=[];
      if(!db.missedCommitmentNotices) db.missedCommitmentNotices=[];
      if(db.commitmentsNotifyEnabled===undefined) db.commitmentsNotifyEnabled=false;
      if(db.commitmentsLastNotifiedDate===undefined) db.commitmentsLastNotifiedDate=null;
      if(!db.houseExpenseAlertPercent) db.houseExpenseAlertPercent=50;
      if(!db.houseExpenseAlertMinDays) db.houseExpenseAlertMinDays=10;
      if(db.savingsGoalTarget===undefined) db.savingsGoalTarget=0;
      rolloverCommitmentsMonthly();
      if(db.financePassword===undefined) db.financePassword=null;
      if(!db.dailyCapacity) db.dailyCapacity=500;
      if(!db.garmentTypes) db.garmentTypes=[];
      if(!db.vipThreshold) db.vipThreshold=3;
      if(db.vipDiscountPercent===undefined || db.vipDiscountPercent===null) db.vipDiscountPercent=0;
      if(!db.idleLockMinutes) db.idleLockMinutes=3;
      if(!db.debtThreshold) db.debtThreshold=2000;
      if(db.lastBackupDate===undefined) db.lastBackupDate=null;
      if(db.dayOffWeekday===undefined || db.dayOffWeekday===null) db.dayOffWeekday=0;
      if(!db.workshopName) db.workshopName='ورشة تفصيل الجلابيب';
      if(db.ownerName===undefined) db.ownerName='';
      if(db.ownerPhone===undefined) db.ownerPhone='';
      if(db.workshopAddress===undefined) db.workshopAddress='';
      if(db.workshopLogo===undefined) db.workshopLogo=null;
      if(!db.theme) db.theme={...DEFAULT_THEME};
      if(!db.btnRadius) db.btnRadius=DEFAULT_BTN_RADIUS;
      if(db.customCSS===undefined) db.customCSS='';
      if(db.customJS===undefined) db.customJS='';
      if(db.darkMode===undefined) db.darkMode=false;
      if(!db.workStartHour) db.workStartHour=9;
      if(!db.workEndHour) db.workEndHour=18;
      if(!db.queueManualOrder) db.queueManualOrder=[];
      if(!db.trash) db.trash=[];
      if(!db.nextInvoiceNumber) db.nextInvoiceNumber=1001;
      if(db.taxDefaultPercent===undefined || db.taxDefaultPercent===null) db.taxDefaultPercent=0;
      if(db.urgentFeeDefaultPercent===undefined || db.urgentFeeDefaultPercent===null) db.urgentFeeDefaultPercent=0;
      if(!db.holidays) db.holidays=[];
      if(!db.occasions) db.occasions=[];
      if(!db.activityLog) db.activityLog=[];
      if(db.updatedAt===undefined) db.updatedAt=0;
      if(!db.cloudSync) db.cloudSync={enabled:false, syncId:null, firebaseConfig:null};
      saveDB();
      renderAll();
      applyWorkshopBranding();
      applyTheme();
      applyFontSettings();
      applyWideMode();
      applyDarkMode();
      applyCustomCSS();
      applyHomeWidgetsLayout();
      toast('تم استيراد النسخة الاحتياطية بنجاح ✅');
    }catch(err){
      toast('حدث خطأ أثناء قراءة الملف');
    }
  };
  reader.readAsText(file);
  event.target.value='';
}

/* ============================================================
   سلة المحذوفات — استرجاع العملاء/الطلبات المحذوفة خلال 7 أيام
   ============================================================ */
const TRASH_RETENTION_DAYS = 7;

function purgeOldTrash(){
  if(!db.trash || !db.trash.length) return;
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS*86400000).toISOString().slice(0,10);
  db.trash = db.trash.filter(t=>t.deletedAt >= cutoff);
}

function renderTrash(){
  const box = document.getElementById('trashList');
  const countTxt = document.getElementById('trashCountTxt');
  if(!box) return;
  purgeOldTrash();
  saveDB();
  const items = (db.trash||[]).slice().sort((a,b)=>b.deletedAt.localeCompare(a.deletedAt));
  if(countTxt) countTxt.textContent = items.length ? `(${items.length})` : '';
  box.innerHTML = items.length ? items.map(t=>{
    const daysLeft = Math.max(0, TRASH_RETENTION_DAYS - Math.round((new Date(todayStr())-new Date(t.deletedAt))/86400000));
    const label = t.type==='customer' ? `👤 عميل: ${escapeHtml(t.data.name)}` : `📋 طلب: ${escapeHtml(customerById(t.data.customerId)?customerById(t.data.customerId).name:(t.data.type||'طلب'))}`;
    return `<div class="card">
      <div class="row"><h3 style="font-size:14.5px;">${label}</h3><span class="meta">باقي ${daysLeft} يوم</span></div>
      <div class="meta">حُذف بتاريخ ${fmtDate(t.deletedAt)}</div>
      <div class="btn-row">
        <button class="btn sm outline" onclick="restoreFromTrash('${t.id}')">↩️ استرجاع</button>
        <button class="btn sm danger" onclick="permanentlyDeleteTrashItem('${t.id}')">🗑️ حذف نهائي</button>
      </div>
    </div>`;
  }).join('') : `<div class="empty-msg">سلة المحذوفات فارغة</div>`;
}

async function restoreFromTrash(trashId){
  const t = db.trash.find(x=>x.id===trashId);
  if(!t) return;
  if(t.type==='customer'){
    db.customers.push(t.data);
  } else if(t.type==='order'){
    db.orders.push(t.data);
    if(t.payments && t.payments.length){
      db.payments.push(...t.payments);
    }
  }
  db.trash = db.trash.filter(x=>x.id!==trashId);
  logActivity(`↩️ استرجاع ${t.type==='customer'?'عميل':'طلب'} من سلة المحذوفات`);
  saveDB();
  renderTrash();
  renderCustomers();
  renderOrders();
  toast('تم الاسترجاع بنجاح ✅');
}

async function permanentlyDeleteTrashItem(trashId){
  if(!await appConfirm('هل تريد حذف هذا العنصر نهائياً؟ لن يمكن التراجع عن هذا الإجراء.')) return;
  db.trash = db.trash.filter(x=>x.id!==trashId);
  logActivity('🗑️ حذف نهائي لعنصر من سلة المحذوفات');
  saveDB();
  renderTrash();
  toast('تم الحذف النهائي');
}

/* ============================================================
   المودال العام
   ============================================================ */
function openModal(html){
  const box = document.getElementById('modalBox');
  box.innerHTML = html;
  box.scrollTop = 0;
  document.getElementById('modalOverlay').classList.add('active');
  syncNavState();
}
function closeModal(){
  document.getElementById('modalOverlay').classList.remove('active');
  syncNavState();
}

/* ============================================================
   تأكيد مخصص (appConfirm) — بديل عن confirm() الأصلية
   بعض تطبيقات الـ WebView (زي تطبيقات WebIntoApp) تمنع أو تتجاهل
   نوافذ confirm()/alert()/prompt() الافتراضية بتاعة المتصفح، فبنستخدم
   مودال داخلي بدلها عشان أزرار الحذف والتأكيد تشتغل دايمًا.
   ============================================================ */
function appConfirm(message, opts){
  opts = opts || {};
  const okText = opts.okText || 'تأكيد';
  const cancelText = opts.cancelText || 'إلغاء';
  const danger = opts.danger !== false;
  return new Promise((resolve)=>{
    openModal(`
      <div class="modal-head"><h3>⚠️ تأكيد</h3></div>
      <div style="padding:4px 2px 14px;font-size:14.5px;line-height:1.7;white-space:pre-line;">${escapeHtml(message)}</div>
      <div class="btn-row">
        <button class="btn outline" id="appConfirmCancel">${escapeHtml(cancelText)}</button>
        <button class="btn ${danger?'danger':''}" id="appConfirmOk">${escapeHtml(okText)}</button>
      </div>
    `);
    const cleanup = (result)=>{
      closeModal();
      resolve(result);
    };
    document.getElementById('appConfirmOk').onclick = ()=>cleanup(true);
    document.getElementById('appConfirmCancel').onclick = ()=>cleanup(false);
  });
}
document.getElementById('modalOverlay').addEventListener('click', function(e){
  if(e.target===this) closeModal();
});

/* ============================================================
   دعم زر الرجوع في تطبيقات الأندرويد (WebView / APK)
   من غير الكود ده، ضغط زر الرجوع وانت فاتح مودال أو القائمة
   الجانبية أو صفحة غير الرئيسية كان هيقفل التطبيق نفسه فورًا.

   الفكرة: كل "طبقة" مفتوحة فوق الحالة الأساسية (صفحة غير الرئيسية،
   مودال، قائمة جانبية) ليها history entry واحد بالظبط. بعد أي تغيير
   في الواجهة بنحسب "العمق" المفروض (navDepth) ونطابق history الحقيقي
   معاه: نزوّد entries لو بعدنا طبقة، أو نسحب نفس عدد الطبقات اللي
   قفلناها لو رجعنا للخلف من غير ما نستخدم زرار الرجوع نفسه (زرار
   إلغاء/إغلاق مثلاً)، عشان history الحقيقي يفضل مطابق تمامًا للي
   ظاهر على الشاشة أيًا كان عمق التداخل.

   وبما إن بعض تطبيقات الـ WebView (مش كلها بتتعامل بنفس الطريقة مع
   زر الرجوع) ممكن ماتدعمش history.pushState فعليًا (خصوصًا لو الملف
   شغال من مسار محلي)، أو تبعت ضغطة الرجوع كإيفنت "backbutton" مخصص
   أو حتى كـ keydown عادي بدل تفعيل popstate، بنغطي الاحتمالات التلاتة
   مع بعض عشان أعلى فرصة ممكنة إن زر الرجوع يشتغل صح.
   ============================================================ */
let handlingBackNav = false;
let syntheticBackCount = 0;
let navDepth = 0;
let lockedScrollY = 0;
let scrollLocked = false;

function currentUiDepth(){
  const modalOpen = document.getElementById('modalOverlay').classList.contains('active');
  const navOpen = document.getElementById('sideNav').classList.contains('open');
  return (currentPage!=='home' ? 1:0) + (modalOpen?1:0) + (navOpen?1:0);
}

// هل فيه "طبقة عائمة" فوق الصفحة فعليًا (مودال أو قائمة جانبية)؟
// مهم إننا نفرّقها عن currentUiDepth، لأن الانتقال بين الصفحات العادية
// (زي فتح صفحة الطلبات أو المالية) بيزوّد currentUiDepth كمان لأغراض
// زر الرجوع، لكنه مش المفروض يقفل تمرير الصفحة — القفل مطلوب بس
// وقت ما يكون فيه حاجة عائمة فوق المحتوى نفسه.
function isOverlayOpen(){
  const modalOpen = document.getElementById('modalOverlay').classList.contains('active');
  const navOpen = document.getElementById('sideNav').classList.contains('open');
  return modalOpen || navOpen;
}

/* قفل تمرير الصفحة اللي وراء المودال/القائمة الجانبية أثناء فتحها.
   من غير القفل ده، سحب الإصبع فوق المودال ممكن "يسرّب" ويحرّك صفحة
   الخلفية بدل محتوى المودال بس — وده اللي بيسبب إحساس إنك تقدر تسحب
   المودال لتحت بس مش لفوق (لأن صفحة الخلفية بتتحرك في اتجاه واحد
   ومش بترجع تاني، خصوصًا لما تفتح لوحة المفاتيح على حقل داخل المودال). */
function lockBodyScroll(){
  lockedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
  document.body.style.position = 'fixed';
  document.body.style.top = (-lockedScrollY) + 'px';
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
}
function unlockBodyScroll(){
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';
  window.scrollTo(0, lockedScrollY);
}

// تنفيذ آمن لعمليات history — بعض بيئات WebView (خصوصًا لو الملف شغال
// من مسار محلي مش عبر سيرفر) ممكن ترفض pushState/back برمي خطأ بصمت،
// فبنلف كل نداء عشان أي خطأ هنا ميوقفش باقي منطق التنقل الداخلي للتطبيق
function safeHistoryOp(fn){
  try{ fn(); }catch(e){ /* تجاهل: التنقل الداخلي هيشتغل برضه من غير history */ }
}

// يُنادى بعد أي تغيير في الواجهة (فتح/قفل صفحة، مودال، أو قائمة جانبية)
// عشان يزامن حالة history الحقيقية مع اللي ظاهر على الشاشة فعليًا
function syncNavState(){
  if(handlingBackNav) return;
  const target = currentUiDepth();
  const overlayOpen = isOverlayOpen();
  if(!scrollLocked && overlayOpen){ lockBodyScroll(); scrollLocked = true; }
  else if(scrollLocked && !overlayOpen){ unlockBodyScroll(); scrollLocked = false; }
  if(target > navDepth){
    while(navDepth < target){
      navDepth++;
      safeHistoryOp(()=>history.pushState({navLevel:navDepth}, ''));
    }
  } else if(target < navDepth){
    const steps = navDepth - target;
    navDepth = target;
    syntheticBackCount += steps;
    for(let i=0;i<steps;i++) safeHistoryOp(()=>history.back());
  } else if(target === navDepth && target > 0){
    safeHistoryOp(()=>history.replaceState({navLevel:navDepth}, ''));
  }
}


// يقفل أعلى "طبقة" مفتوحة حاليًا: مودال، وإلا قائمة جانبية، وإلا يرجع للرئيسية
function closeTopLayer(){
  const modalOpen = document.getElementById('modalOverlay').classList.contains('active');
  const navOpen = document.getElementById('sideNav').classList.contains('open');
  if(modalOpen){
    closeModal();
  } else if(navOpen){
    closeSideNav();
  } else if(currentPage !== 'home'){
    showPage('home');
  }
}

function handleRealBackNavigation(){
  handlingBackNav = true;
  closeTopLayer();
  navDepth = Math.max(0, navDepth-1);
  setTimeout(()=>{ handlingBackNav = false; }, 0);
}

// 1) المسار المعتاد: الـ WebView بيدعم history الحقيقي، وضغط زر الرجوع بيطلق popstate
window.addEventListener('popstate', function(){
  if(syntheticBackCount > 0){
    // إحنا اللي استهلكنا الحالة دي برمجيًا (مش ضغطة زرار رجوع حقيقية)
    // فالواجهة أصلاً متزامنة، مفيش داعي نعمل أي إجراء إضافي
    syntheticBackCount--;
    return;
  }
  if(window.BACK_NAV_DEBUG) toast('🔧 popstate اشتغل');
  handleRealBackNavigation();
});

// 2) مسار احتياطي: بعض تطبيقات الـ WebView بتبعت إيفنت "backbutton" مخصص
//    (زي أسلوب Cordova القديم) بدل ما تعتمد على history الحقيقي فعليًا
document.addEventListener('backbutton', function(e){
  if(window.BACK_NAV_DEBUG) toast('🔧 backbutton اشتغل');
  if(currentUiDepth() > 0){
    if(e && typeof e.preventDefault==='function') e.preventDefault();
    handleRealBackNavigation();
  }
}, false);

// 3) مسار احتياطي أخير: لو الـ WebView بيمرر ضغطة الرجوع كـ keydown عادي
//    (keyCode 4 هو الكود التقليدي لزر الرجوع في أندرويد)
document.addEventListener('keydown', function(e){
  if(e.keyCode===4 || e.key==='GoBack'){
    if(window.BACK_NAV_DEBUG) toast('🔧 keydown اشتغل');
    if(currentUiDepth() > 0){
      e.preventDefault();
      handleRealBackNavigation();
    }
  }
});

window.BACK_NAV_DEBUG = false;

/* ============================================================
   بدء التشغيل
   ============================================================ */
initLock();
updateTopbarHeightVar();
window.addEventListener('resize', updateTopbarHeightVar);
window.addEventListener('load', updateTopbarHeightVar);

// تسجيل الـ Service Worker (يفعّل التثبيت كتطبيق وتشغيل الأوفلاين)
// شرط أساسي: لازم الملف يكون شغال من سيرفر HTTPS أو localhost (مش file:// مباشرة)
if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost')){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(()=>{ /* تجاهل الخطأ لو الملف مش موجود بجانب الصفحة */ });
  });
}


/* ===================== patches.js ===================== */

/* ============================================================
   [تم الإصلاح] الكود كله دلوقتي ملفوف جوه IIFE واحدة
   عشان الـ return في أول سطر يبقى شغال وميكسرش تحليل السكربت بالكامل
   ============================================================ */
(function(){

/* 0) حارس تنفيذ لمرة واحدة فقط لكل جلسة فتح للتطبيق */
if(window.__workshopPatchesLoaded) { return; }
window.__workshopPatchesLoaded = true;

/* علم مشترك: بيتحط true قبل ما نكمل حفظ ناجح (بعد تأكيد المستخدم)،
   عشان نافذة "عندك تعديلات لم تُحفظ" متظهرش وهي بتتقفل بسبب الحفظ نفسه. */
var __skipUnsavedCheckOnce = false;

/* 0-ب) [إصلاح مهم] appConfirm الأصلية بتكتب فوق محتوى المودال الحالي
   (modalBox.innerHTML) عشان تعرض رسالة التأكيد. ده معناه إن أي appConfirm
   بيتفتح والمستخدم لسه فاتح فورم (تعديل عميل/طلب) بيمسح كل حقول الفورم
   من الـ DOM فعليًا. لو المستخدم ضغط "تأكيد"، الكود اللي بعد appConfirm
   بيحاول يقرأ نفس الحقول (زي f_name) فيلاقيها اتمسحت ويفشل الحفظ بصمت —
   وده كان موجود بالفعل في الكود الأصلي (تأكيد رقم الهاتف المكرر) وكمان
   كان هيبوّظ نوافذ التأكيد الجديدة اللي بنضيفها هنا على التعديل.
   الحل: نافذة تأكيد مستقلة تتظهر فوق المودال الحالي من غير ما تمسح
   محتواه، فالفورم يفضل سليم لحد ما فعليًا نكمل الحفظ. */
(function(){
  window.appConfirm = function(message, opts){
    opts = opts || {};
    var okText = opts.okText || 'تأكيد';
    var cancelText = opts.cancelText || 'إلغاء';
    var danger = opts.danger !== false;
    return new Promise(function(resolve){
      var ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:20px;';
      var box = document.createElement('div');
      box.style.cssText = 'background:var(--card,#fff);color:inherit;border-radius:14px;max-width:380px;width:100%;padding:16px 16px 14px;box-shadow:0 10px 30px rgba(0,0,0,.35);';
      box.innerHTML =
        '<div style="font-weight:800;font-size:15px;margin-bottom:10px;">⚠️ تأكيد</div>'+
        '<div style="font-size:14.5px;line-height:1.7;margin-bottom:16px;">'+escapeHtml(message)+'</div>'+
        '<div style="display:flex;gap:8px;">'+
          '<button type="button" data-a="cancel" class="btn outline" style="flex:1;">'+escapeHtml(cancelText)+'</button>'+
          '<button type="button" data-a="ok" class="btn '+(danger?'danger':'')+'" style="flex:1;">'+escapeHtml(okText)+'</button>'+
        '</div>';
      ov.appendChild(box);
      document.body.appendChild(ov);
      function cleanup(result){ ov.remove(); resolve(result); }
      box.querySelector('[data-a="ok"]').onclick = function(){ cleanup(true); };
      box.querySelector('[data-a="cancel"]').onclick = function(){ cleanup(false); };
      ov.addEventListener('click', function(e){ if(e.target===ov) cleanup(false); });
    });
  };
})();
(function(){
  function enhancePhones(){
    document.querySelectorAll('.meta').forEach(function(el){
      if(el.dataset.rcPhone) return;
      var txt = el.textContent||'';
      if(txt.trim().indexOf('📞')===0){
        var digits = txt.replace(/[^0-9]/g,'');
        if(digits.length>=9){
          el.dataset.rcPhone='1';
          var waNum = digits.replace(/^0/,'2'); // افتراض رقم مصري — غيّرها لو بلدك مختلف
          var span=document.createElement('span');
          span.style.cssText='display:inline-flex;gap:6px;margin-inline-start:10px;';
          span.innerHTML =
            '<a href="tel:'+digits+'" style="text-decoration:none;background:var(--ok-light);color:var(--ok);border-radius:8px;padding:2px 9px;font-size:12px;font-weight:700;">📞</a>'+
            '<a href="https://wa.me/'+waNum+'" target="_blank" style="text-decoration:none;background:var(--ok-light);color:var(--ok);border-radius:8px;padding:2px 9px;font-size:12px;font-weight:700;">💬</a>';
          el.appendChild(span);
        }
      }
    });
  }
  new MutationObserver(enhancePhones).observe(document.getElementById('app'), {childList:true, subtree:true});
  enhancePhones();
})();

/* 2) ضغطة مطوّلة على شعار التطبيق تفتح البحث الشامل فورًا */
(function(){
  var brand = document.querySelector('.topbar-brand');
  if(!brand) return;
  var pressTimer;
  brand.addEventListener('touchstart', function(){
    pressTimer = setTimeout(function(){
      showPage('home');
      setTimeout(function(){ var i=document.getElementById('globalSearch'); if(i) i.focus(); }, 150);
      if(navigator.vibrate) navigator.vibrate(30);
    }, 550);
  });
  ['touchend','touchmove','touchcancel'].forEach(function(ev){
    brand.addEventListener(ev, function(){ clearTimeout(pressTimer); });
  });
})();

/* 3) شريط آخر 3 عملاء تم فتحهم أعلى صفحة العملاء */
(function(){
  function getRecent(){ try{ return JSON.parse(localStorage.getItem('recentCustomers')||'[]'); }catch(e){ return []; } }
  function pushRecent(id){
    var list = getRecent().filter(function(x){ return x!==id; });
    list.unshift(id);
    localStorage.setItem('recentCustomers', JSON.stringify(list.slice(0,3)));
  }
  var origHistory = openCustomerHistory;
  openCustomerHistory = function(id){ pushRecent(id); return origHistory.apply(this, arguments); };
  var origCustModal = openCustomerModal;
  openCustomerModal = function(id){ if(id) pushRecent(id); return origCustModal.apply(this, arguments); };

  var origRenderCustomers = renderCustomers;
  renderCustomers = function(){
    origRenderCustomers.apply(this, arguments);
    try{
      var pageBox = document.getElementById('page-customers');
      var searchBox = pageBox.querySelector('.search-box');
      var strip = document.getElementById('recentCustomersStrip');
      var list = getRecent().map(function(id){ return customerById(id); }).filter(Boolean);
      if(list.length===0){ if(strip) strip.remove(); return; }
      if(!strip){ strip=document.createElement('div'); strip.id='recentCustomersStrip'; searchBox.insertAdjacentElement('afterend', strip); }
      strip.innerHTML = list.map(function(c){
        return '<span class="rc-chip" onclick="openCustomerHistory(\''+c.id+'\')">🕘 '+escapeHtml(c.name)+'</span>';
      }).join('');
    }catch(e){}
  };
})();

/* 4) عداد الطلبات المتأخرة على زر "الطلبات" بالقائمة الجانبية */
(function(){
  function updateOrdersBadge(){
    try{
      var btn = document.querySelector('.navbtn[data-page="orders"]');
      if(!btn) return;
      var count = db.orders.filter(isOverdue).length;
      var badge = btn.querySelector('.overdue-badge');
      if(count>0){
        if(!badge){ badge=document.createElement('span'); badge.className='overdue-badge';
          badge.style.cssText='background:var(--danger);color:#fff;border-radius:10px;padding:1px 7px;font-size:11px;font-weight:900;margin-inline-start:auto;';
          btn.appendChild(badge); }
        badge.textContent=count;
      } else if(badge){ badge.remove(); }
    }catch(e){}
  }
  var origOpenSideNav = openSideNav;
  openSideNav = function(){ updateOrdersBadge(); return origOpenSideNav.apply(this, arguments); };
  var origCloseModal = closeModal;
  closeModal = function(){ var r = origCloseModal.apply(this, arguments); updateOrdersBadge(); return r; };
  setTimeout(updateOrdersBadge, 800);
})();

/* 5) حفظ آخر نوع وسعر تفصيل استُخدم لكل عميل، وتعبئته تلقائيًا في طلب جديد لنفس العميل */
(function(){
  var origSaveOrder = saveOrder;
  saveOrder = function(id){
    try{
      var custSel = document.getElementById('f_customer');
      var firstRow = document.querySelector('#itemsContainer .item-row');
      if(custSel && firstRow){
        var typeSel = firstRow.querySelector('.it-type');
        var priceInp = firstRow.querySelector('.it-price');
        if(custSel.value && typeSel && typeSel.value && typeSel.value!=='__custom__' && priceInp && priceInp.value){
          localStorage.setItem('lastOrder_'+custSel.value, JSON.stringify({typeId:typeSel.value, price:priceInp.value}));
        }
      }
    }catch(e){}
    return origSaveOrder.apply(this, arguments);
  };

  var origOpenOrderModal = openOrderModal;
  openOrderModal = function(id, presetCustomerId){
    var result = origOpenOrderModal.apply(this, arguments);
    if(!id){
      setTimeout(function(){
        try{
          var custId = presetCustomerId || (document.getElementById('f_customer')?document.getElementById('f_customer').value:'');
          if(!custId) return;
          var saved = localStorage.getItem('lastOrder_'+custId);
          if(!saved) return;
          var data = JSON.parse(saved);
          var firstRow = document.querySelector('#itemsContainer .item-row');
          if(!firstRow) return;
          var typeSel = firstRow.querySelector('.it-type');
          var priceInp = firstRow.querySelector('.it-price');
          var hasOption = Array.prototype.some.call(typeSel.options, function(o){ return o.value===data.typeId; });
          if(typeSel && hasOption){
            typeSel.value = data.typeId;
            priceInp.value = data.price;
            recalcItemsTotal();
            toast('📌 تم تعبئة آخر نوع وسعر لهذا العميل');
          }
        }catch(e){}
      }, 50);
    }
    return result;
  };
})();

/* 6) نظام نقاط ولاء بسيط: كل 5 طلبات تم تسليمها = خصم 10% تلقائي على الطلب التالي */
(function(){
  function customerLoyaltyInfo(c){
    var delivered = db.orders.filter(function(o){ return o.customerId===c.id && o.status==='تم التسليم'; }).length;
    var lastRedeemedAt = Number(localStorage.getItem('loyaltyRedeemed_'+c.id))||0;
    var progress = delivered - lastRedeemedAt;
    var threshold = 5;
    return {delivered:delivered, progress:progress, threshold:threshold, eligible: progress>=threshold};
  }

  var origRC = renderCustomers;
  renderCustomers = function(){
    origRC.apply(this, arguments);
    try{
      document.querySelectorAll('#customersList .card').forEach(function(card){
        if(card.dataset.loyaltyAdded) return;
        var metas = card.querySelectorAll('.meta');
        var phoneEl = null;
        metas.forEach(function(m){ if(!phoneEl && m.textContent.trim().indexOf('📞')===0) phoneEl = m; });
        if(!phoneEl) return;
        var digits = phoneEl.textContent.replace(/[^0-9]/g,'');
        var c = db.customers.find(function(x){ return (x.phone||'').replace(/[^0-9]/g,'')===digits; });
        if(!c) return;
        card.dataset.loyaltyAdded='1';
        var info = customerLoyaltyInfo(c);
        var chip = document.createElement('div');
        chip.className='meta'; chip.style.marginTop='4px';
        chip.innerHTML = info.eligible
          ? '<span style="background:var(--accent-light);color:var(--accent-dark);border-radius:8px;padding:3px 9px;font-size:12px;font-weight:800;">🎁 مؤهل لخصم ولاء 10% بالطلب القادم</span>'
          : '🎁 نقاط الولاء: '+info.progress+'/'+info.threshold+' طلبات للخصم القادم';
        phoneEl.insertAdjacentElement('afterend', chip);
      });
    }catch(e){}
  };

  var pendingLoyalty = null;
  var origOOM = openOrderModal;
  openOrderModal = function(id, presetCustomerId){
    var r = origOOM.apply(this, arguments);
    if(!id){
      setTimeout(function(){
        try{
          var custId = presetCustomerId || (document.getElementById('f_customer')?document.getElementById('f_customer').value:'');
          var c = custId ? customerById(custId) : null;
          if(!c) return;
          var info = customerLoyaltyInfo(c);
          if(info.eligible){
            var dType = document.getElementById('f_discountType');
            var dVal = document.getElementById('f_discountValue');
            if(dType && dVal && dType.value==='none'){
              dType.value='percent'; dVal.value='10';
              onDiscountTypeChange();
              pendingLoyalty = {customerId:c.id, offeredAtDelivered:info.delivered};
              toast('🎁 العميل مؤهل لخصم ولاء، تم تطبيق 10% تلقائيًا');
            }
          }
        }catch(e){}
      }, 60);
    }
    return r;
  };

  var origSOLoyalty = saveOrder;
  saveOrder = function(id){
    var beforeCount = db.orders.length;
    var custIdBefore = document.getElementById('f_customer') ? document.getElementById('f_customer').value : null;
    var r = origSOLoyalty.apply(this, arguments);
    try{
      if(!id && pendingLoyalty && pendingLoyalty.customerId===custIdBefore && db.orders.length>beforeCount){
        localStorage.setItem('loyaltyRedeemed_'+pendingLoyalty.customerId, pendingLoyalty.offeredAtDelivered);
        pendingLoyalty = null;
      }
    }catch(e){}
    return r;
  };
})();

/* 7) رسالة جاهزة لإشعار العميل عبر واتساب لما الطلب يبقى "جاهز للتسليم" */
(function(){
  function buildReadyMessage(o, c){
    var shopName = db.workshopName || 'ورشة تفصيل الجلابيب';
    return 'مرحبًا '+c.name+'، طلبك ('+orderTypeLabel(o)+') بقى جاهز للاستلام من '+shopName+'. تقدر تمر تستلمه في أقرب وقت يناسبك 🙏';
  }
  var origSOReady = saveOrder;
  saveOrder = function(id){
    var oldStatus = null;
    if(id){ var existing = db.orders.find(function(x){ return x.id===id; }); if(existing) oldStatus = existing.status; }
    var r = origSOReady.apply(this, arguments);
    try{
      if(id){
        var o = db.orders.find(function(x){ return x.id===id; });
        if(o && o.status==='جاهز للتسليم' && oldStatus!=='جاهز للتسليم'){
          var c = customerById(o.customerId);
          if(c && c.phone){
            var digits = c.phone.replace(/[^0-9]/g,'');
            var waNum = digits.replace(/^0/,'2'); // افتراض رقم مصري
            var msg = buildReadyMessage(o, c);
            setTimeout(function(){
              openModal(
                '<div class="modal-head"><h3>📲 إشعار العميل بجاهزية الطلب</h3><button class="modal-close" onclick="closeModal()">✕</button></div>'
                + '<p class="meta">تقدر ترسل رسالة جاهزة للعميل:</p>'
                + '<div class="card" style="padding:10px;font-size:13.5px;white-space:pre-wrap;">'+escapeHtml(msg)+'</div>'
                + '<a class="btn accent" style="display:block;text-align:center;margin-top:10px;text-decoration:none;" target="_blank" href="https://wa.me/'+waNum+'?text='+encodeURIComponent(msg)+'">💬 إرسال عبر واتساب</a>'
              );
            }, 300);
          }
        }
      }
    }catch(e){}
    return r;
  };
})();

/* 8) مستحقات مالية متوقعة خلال أسبوع في صفحة المالية — مربوطة بالتزاماتك
   (أقساط + قروض) المستحقة في نفس الأسبوع، عشان الرقم "المتوقع تحصيله"
   ميدّيش إحساس مضلل بالراحة من غير ما تعرف قد إيه منه لازم يروح لالتزاماتك */
(function(){
  // إجمالي الأقساط + أقساط القروض المستحقة عليك خلال N يوم جايين (متأخر
  // محسوب برضه، زي منطق getCommitmentDueAlerts بالظبط بس بنافذة أوسع من 3 أيام)
  function dueWithinDays(days){
    var today = todayStr();
    var commitmentsTotal = 0, commitmentsCount = 0;
    try{
      var nowYM = currentYM();
      (db.commitments||[]).filter(function(c){ return c.active!==false && c.dueDay; }).forEach(function(c){
        if(c.lastPaidMonth===nowYM) return;
        if(!isCommitmentCycleMonth(c, nowYM)) return; // مش شهر استحقاق للالتزام ده
        var due = commitmentDueDateStr(c);
        var diff = Math.round((new Date(due)-new Date(today))/86400000);
        if(diff<=days){ commitmentsTotal += Number(c.amount||0); commitmentsCount++; }
      });
    }catch(e){}
    var loanTotal = 0, loanCount = 0;
    try{
      var nowYM2 = currentYM();
      var parts = today.split('-').map(Number);
      var lastDay = new Date(Date.UTC(parts[0], parts[1], 0)).getUTCDate();
      (db.personalLoans||[]).filter(function(l){ return l.active!==false && l.dueDay; }).forEach(function(l){
        if(l.lastPaidMonth===nowYM2) return;
        var day = Math.min(Number(l.dueDay), lastDay);
        var due = nowYM2+'-'+String(day).padStart(2,'0');
        var diff = Math.round((new Date(due)-new Date(today))/86400000);
        if(diff<=days){ loanTotal += Number(l.monthlyPayment||0); loanCount++; }
      });
    }catch(e){}
    return {total:commitmentsTotal+loanTotal, count:commitmentsCount+loanCount};
  }

  var origRF = renderFinance;
  renderFinance = function(){
    origRF.apply(this, arguments);
    try{
      var today = todayStr();
      var in7 = new Date(); in7.setDate(in7.getDate()+7);
      var in7Str = in7.toISOString().slice(0,10);
      var upcoming = db.orders.filter(function(o){
        return o.status!=='تم التسليم' && o.dateDelivery && o.dateDelivery>=today && o.dateDelivery<=in7Str;
      });
      var expectedTotal = upcoming.reduce(function(s,o){ return s+orderRemaining(o); }, 0);
      var noDeposit = upcoming.filter(function(o){ return (Number(o.paid)||0)===0; });
      var noDepositAmount = noDeposit.reduce(function(s,o){ return s+orderRemaining(o); }, 0);
      var owed = dueWithinDays(7);
      var net = expectedTotal - owed.total;
      var box = document.getElementById('expectedCashflowBox');
      if(!box){
        box = document.createElement('div');
        box.id='expectedCashflowBox';
        document.getElementById('financeStats').insertAdjacentElement('afterend', box);
      }
      var riskLine = noDeposit.length>0
        ? '<div class="meta" style="margin-top:6px;color:var(--warn,#b8860b);">⚠️ منها '+noDeposit.length+' طلب من غير أي عربون بإجمالي '+Math.round(noDepositAmount).toLocaleString('ar-EG')+' ج.م — تحصيله وقت التسليم مش مضمون زي الطلبات اللي أخدت عربون.</div>'
        : '';
      var owedLine = owed.count>0
        ? '<div class="row" style="margin-top:8px;"><span class="meta">مستحق عليك في نفس الفترة (أقساط/قروض)</span>'
          + '<b style="color:var(--danger);">'+Math.round(owed.total).toLocaleString('ar-EG')+' ج.م</b></div>'
          + '<div class="meta">من '+owed.count+' قسط/التزام مستحق خلال 7 أيام</div>'
          + '<div class="row" style="margin-top:8px;border-top:1px solid var(--border);padding-top:8px;"><span class="meta">'+(net>=0?'الصافي المتوقع بعد التزاماتك':'العجز المتوقع لو اتحصّل المتوقع بس')+'</span>'
          + '<b style="color:'+(net>=0?'var(--ok)':'var(--danger)')+';">'+Math.round(net).toLocaleString('ar-EG')+' ج.م</b></div>'
        : '<div class="meta" style="margin-top:6px;">مفيش أقساط أو قروض مستحقة عليك في نفس الفترة.</div>';
      box.innerHTML =
        '<div class="section-title">📥 مستحقات متوقعة (الأسبوع القادم)</div>'
        + '<div class="card"><div class="row"><h3>إجمالي المتوقع تحصيله</h3>'
        + '<b style="color:var(--ok);font-size:17px;">'+expectedTotal.toLocaleString('ar-EG')+' ج.م</b></div>'
        + '<div class="meta">من '+upcoming.length+' طلب مجدول للتسليم خلال 7 أيام</div>'
        + riskLine
        + owedLine
        + '</div>';
    }catch(e){}
  };
})();

/* 9) خطة اليوم — تظهر تلقائيًا عند فتح التطبيق (مرة باليوم) */
setTimeout(function(){
  try{
    if(typeof computeTodayQueue!=='function') return;
    var today = todayStr();
    if(localStorage.getItem('dailyPlanShownDate')===today) return;
    if(isDayOff(new Date())){ localStorage.setItem('dailyPlanShownDate', today); return; }
    var q = computeTodayQueue();
    var queue = q.queue||[], mustFinish = q.mustFinish||[];
    if(queue.length===0){ localStorage.setItem('dailyPlanShownDate', today); return; }
    var items = queue.slice(0,5).map(function(o,i){
      var c = customerById(o.customerId);
      return '<div class="row" style="padding:6px 0;border-bottom:1px solid var(--border);"><span>'+(i+1)+'. '+(c?escapeHtml(c.name):'عميل محذوف')+' - '+escapeHtml(orderTypeLabel(o))+'</span></div>';
    }).join('');
    openModal(
      '<div class="modal-head"><h3>☀️ خطة شغل النهاردة</h3><button class="modal-close" onclick="closeModal()">✕</button></div>'
      + '<p class="meta">عندك '+queue.length+' طلب في الدور، منهم '+mustFinish.length+' لازم يخلص النهاردة.</p>'
      + items
      + (queue.length>5 ? '<p class="meta" style="margin-top:6px;">+ '+(queue.length-5)+' طلب تاني</p>' : '')
      + '<button class="btn" style="margin-top:12px;" onclick="closeModal();showPage(\'home\')">📋 فتح خطة اليوم كاملة</button>'
    );
    localStorage.setItem('dailyPlanShownDate', today);
  }catch(e){}
}, 900);

/* 10) عداد الأيام المتبقية على كل بطاقة طلب في صفحة الطلبات وخطة اليوم */
(function(){
  function tagOrderCards(container){
    if(!container) return;
    container.querySelectorAll('.card').forEach(function(card){
      if(card.dataset.orderId) return;
      var btn = card.querySelector('[onclick*="openOrderModal("]') || card.querySelector('[onclick*="markOrderDelivered("]');
      if(btn){
        var m = btn.getAttribute('onclick').match(/(?:openOrderModal|markOrderDelivered)\('([^']+)'/);
        if(m) card.dataset.orderId = m[1];
      }
    });
  }
  function addDaysBadges(container){
    if(!container) return;
    tagOrderCards(container);
    container.querySelectorAll('.card[data-order-id]').forEach(function(card){
      if(card.dataset.daysBadgeAdded) return;
      var o = db.orders.find(function(x){ return x.id===card.dataset.orderId; });
      if(!o || !o.dateDelivery || o.status==='تم التسليم') return;
      var diff = Math.round((new Date(o.dateDelivery) - new Date(todayStr()))/86400000);
      var label, color;
      if(diff<0){ label='متأخر '+Math.abs(diff)+' يوم'; color='var(--danger)'; }
      else if(diff===0){ label='التسليم النهاردة'; color='var(--warn)'; }
      else { label='باقي '+diff+' يوم'; color='var(--info)'; }
      var metaLine = Array.prototype.find.call(card.querySelectorAll('.meta'), function(m){ return m.textContent.indexOf('التسليم')!==-1; });
      if(metaLine){
        card.dataset.daysBadgeAdded='1';
        var badge=document.createElement('span');
        badge.style.cssText='display:inline-block;margin-inline-start:8px;font-size:11.5px;font-weight:800;color:'+color+';';
        badge.textContent='⏳ '+label;
        metaLine.appendChild(badge);
      }
    });
  }
  new MutationObserver(function(){
    addDaysBadges(document.getElementById('ordersList'));
    addDaysBadges(document.getElementById('todayPlan'));
  }).observe(document.getElementById('app'), {childList:true, subtree:true});
})();

/* 11) وضع التباين العالي — زر جنب زر الوضع الليلي */
(function(){
  if(document.getElementById('contrastToggleBtn')) return; // امنع التكرار لو الكود اشتغل أكتر من مرة
  var themeBtn = document.getElementById('themeToggleBtn');
  if(!themeBtn) return;
  var btn = document.createElement('button');
  btn.className='theme-toggle-btn'; btn.id='contrastToggleBtn';
  btn.setAttribute('aria-label','تباين عالٍ'); btn.textContent='◐';
  btn.onclick = function(){
    document.documentElement.classList.toggle('high-contrast');
    localStorage.setItem('highContrast', document.documentElement.classList.contains('high-contrast') ? '1':'0');
  };
  themeBtn.insertAdjacentElement('afterend', btn);
  if(localStorage.getItem('highContrast')==='1') document.documentElement.classList.add('high-contrast');
})();

/* 12) سحب بطاقة الطلب: يمين = يكشف زر "تم التسليم"، يسار = فتح التعديل
   [تم الإصلاح] كان السحب بينفّذ "تم التسليم" فورًا بمجرد رفع الإصبع،
   وده كان بيتفعّل غلط أثناء تمرير عادي (سكرول) لو الإصبع اتحرك بزاوية
   بسيطة. دلوقتي السحب لليمين بيكشف زر واضح تحت الكارت، والتنفيذ الفعلي
   بيحصل بس لو المستخدم ضغط الزر عمدًا (مع نافذة تأكيد كمان). */
(function(){
  var startX=0, startY=0, activeCard=null, openCard=null, dragging=false;

  function closeOpenCard(){
    if(openCard){
      openCard.style.transform='';
      var reveal = openCard.__revealEl;
      if(reveal) reveal.remove();
      openCard.__revealEl = null;
    }
    openCard = null;
  }

  function resetCard(){
    if(activeCard && activeCard!==openCard){
      activeCard.style.transform='';
      activeCard.style.opacity='';
    }
    activeCard=null;
    dragging=false;
  }

  function ensureCardId(card){
    if(card.dataset.orderId) return;
    var btn = card.querySelector('[onclick*="openOrderModal("]');
    if(btn){
      var m = btn.getAttribute('onclick').match(/openOrderModal\('([^']+)'/);
      if(m) card.dataset.orderId = m[1];
    }
  }

  // زر التسليم اللي بيتكشف تحت الكارت وقت السحب لليمين
  function revealDeliverButton(card, id){
    var wrap = card.parentElement;
    if(!wrap) return null;
    if(getComputedStyle(wrap).position==='static') wrap.style.position='relative';
    var el = document.createElement('div');
    el.className='swipe-reveal-deliver';
    el.style.cssText = 'position:absolute;border-radius:inherit;background:var(--ok,#1F6D57);color:#fff;display:flex;align-items:center;padding-inline-start:18px;font-weight:800;font-size:14px;z-index:0;box-sizing:border-box;';
    el.style.top = card.offsetTop+'px';
    el.style.left = card.offsetLeft+'px';
    el.style.width = card.offsetWidth+'px';
    el.style.height = card.offsetHeight+'px';
    el.textContent = '✅ اضغط لتسجيل تم التسليم';
    el.addEventListener('click', function(){
      var o = db.orders.find(function(x){ return x.id===id; });
      var custName = o ? ((customerById(o.customerId)||{}).name||'') : '';
      appConfirm('هل تريد تسجيل طلب' + (custName?(' "'+custName+'"'):'') + ' كـ"تم التسليم"؟', {okText:'تم التسليم', cancelText:'إلغاء', danger:false}).then(function(ok){
        closeOpenCard();
        if(ok){
          if(navigator.vibrate) navigator.vibrate(30);
          markOrderDelivered(id);
        }
      });
    });
    wrap.insertBefore(el, card);
    card.style.position='relative'; card.style.zIndex='1';
    if(!card.style.background) card.style.background = 'var(--card)';
    return el;
  }

  document.addEventListener('touchstart', function(e){
    if(e.target.closest('.swipe-reveal-deliver')) return; // سيب الزر المكشوف يستقبل الضغطة من غير ما نقفله تحته
    var card = e.target.closest('#ordersList .card');
    if(!card){
      // لمسة برّه أي كارت مفتوح تقفله
      if(openCard) closeOpenCard();
      return;
    }
    if(openCard && openCard!==card){ closeOpenCard(); }
    ensureCardId(card);
    activeCard = card;
    dragging=false;
    startX = e.touches[0].clientX; startY = e.touches[0].clientY;
  }, {passive:true});

  document.addEventListener('touchmove', function(e){
    if(!activeCard) return;
    var dx = e.touches[0].clientX-startX, dy = e.touches[0].clientY-startY;
    if(Math.abs(dx)>Math.abs(dy) && Math.abs(dx)>8){
      dragging = true;
      var clamped = Math.max(-90, Math.min(90, dx));
      activeCard.style.transform='translateX('+clamped+'px)';
      activeCard.style.opacity = Math.max(0.6, 1-Math.abs(clamped)/250);
    }
  }, {passive:true});

  document.addEventListener('touchend', function(e){
    if(!activeCard){ return; }
    if(!dragging){ activeCard=null; return; }
    var dx = e.changedTouches[0].clientX-startX;
    var dy = e.changedTouches[0].clientY-startY;
    var id = activeCard.dataset.orderId;
    var card = activeCard;
    var opened = false;
    if(Math.abs(dx)>60 && Math.abs(dx)>Math.abs(dy)*1.5 && id){
      var o = db.orders.find(function(x){ return x.id===id; });
      if(dx>0 && o && o.status!=='تم التسليم'){
        // اكشف الزر واستقر الكارت في وضع مفتوح، من غير أي تنفيذ فوري
        card.style.transform='translateX(70px)';
        card.__revealEl = revealDeliverButton(card, id);
        openCard = card;
        opened = true;
      } else if(dx<0){
        if(navigator.vibrate) navigator.vibrate(20);
        openOrderModal(id);
      }
    }
    if(!opened){ card.style.transform=''; card.style.opacity=''; }
    activeCard = null;
    dragging = false;
  });

  document.addEventListener('touchcancel', function(){
    resetCard();
  });
})();

/* 13) أفضل أيام الأسبوع من ناحية التحصيل في صفحة المالية */
(function(){
  var origRFDays = renderFinance;
  renderFinance = function(){
    origRFDays.apply(this, arguments);
    try{
      var dayNames = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
      var totals = [0,0,0,0,0,0,0];
      db.payments.forEach(function(p){
        var d = new Date(p.date);
        if(isNaN(d.getTime())) return;
        totals[d.getDay()] += Number(p.amount)||0;
      });
      var maxIdx = 0;
      for(var i=1;i<7;i++) if(totals[i]>totals[maxIdx]) maxIdx=i;
      var hasData = totals.some(function(t){ return t>0; });
      var rows = dayNames.map(function(name,i){
        var pct = totals[maxIdx]>0 ? Math.round(totals[i]/totals[maxIdx]*100) : 0;
        return '<div class="row" style="padding:4px 0;">'
          +'<span>'+name+'</span>'
          +'<div style="flex:1;margin:0 10px;background:var(--border);border-radius:6px;height:8px;overflow:hidden;">'
          +'<div style="width:'+pct+'%;height:100%;background:'+(i===maxIdx?'var(--accent)':'var(--primary)')+';"></div></div>'
          +'<b style="font-size:12px;">'+totals[i].toLocaleString('ar-EG')+'</b>'
          +'</div>';
      }).join('');
      var box = document.getElementById('bestDayBox');
      if(!box){
        box = document.createElement('div');
        box.id='bestDayBox';
        var anchor = document.getElementById('advancedAnalytics');
        anchor.parentElement.insertBefore(box, anchor.nextSibling);
      }
      box.innerHTML = '<div class="section-title">📆 أفضل أيام الأسبوع (حسب التحصيل)</div>'
        + '<div class="card">' + (hasData
            ? rows + '<p class="meta" style="margin-top:8px;">🏆 يوم '+dayNames[maxIdx]+' هو الأعلى تحصيلاً — فكّر تزود الطاقة أو تركّز المتابعة حواليه</p>'
            : '<div class="empty-msg">لسه مفيش بيانات كفاية</div>') + '</div>';
    }catch(e){}
  };
})();

/* 14) تنبيه المناسبات الموسمية القادمة */
setTimeout(function(){
  try{
    var today = todayStr();
    var alertWindow = 21; // يبدأ التنبيه قبل المناسبة بكام يوم
    (db.holidays||[]).forEach(function(h){
      if(!h.date) return;
      var diff = Math.round((new Date(h.date) - new Date(today))/86400000);
      if(diff>=0 && diff<=alertWindow){
        var key = 'seasonalAlertShown_'+h.id;
        var lastDiff = localStorage.getItem(key);
        var shouldShow = !lastDiff || (Number(lastDiff)-diff)>=7 || diff===0;
        if(shouldShow){
          toast('📆 باقي '+diff+' يوم على "'+h.name+'" — فكّر تجهز الطاقة الاستيعابية وتبلغ عملائك بمواعيد التسليم بدري');
          localStorage.setItem(key, diff);
        }
      }
    });
  }catch(e){}
}, 1300);

/* 15) عرض قياسات العميل المحفوظة كمرجع سريع عند فتح طلب جديد */
(function(){
  function measurementsHtml(c){
    if(!c) return '';
    var rows = [
      ['📏 الطول', c.length],
      ['📏 الصدر', c.chest],
      ['📏 الخزنة', c.waist],
      ['📏 طول الكم', c.sleeve],
      ['📏 وسع الكم', c.shoulder]
    ].filter(function(r){ return r[1]!==undefined && r[1]!==null && r[1]!==''; });
    if(rows.length===0 && !c.notes) return '';
    var rowsHtml = rows.map(function(r){
      return '<div class="row" style="padding:3px 0;"><span class="meta">'+r[0]+'</span><b>'+escapeHtml(String(r[1]))+' سم</b></div>';
    }).join('');
    var notesHtml = c.notes ? '<div class="meta" style="margin-top:6px;">📝 '+escapeHtml(c.notes)+'</div>' : '';
    return '<div class="card" id="customerMeasureBox" style="margin:-6px 0 14px;padding:10px 12px;background:var(--card-alt);">'
      + '<div class="section-title" style="font-size:13px;margin-bottom:4px;">📏 قياسات العميل المحفوظة</div>'
      + rowsHtml + notesHtml
      + '</div>';
  }

  function renderBox(){
    try{
      var sel = document.getElementById('f_customer');
      if(!sel) return;
      var old = document.getElementById('customerMeasureBox');
      if(old) old.remove();
      var c = sel.value ? customerById(sel.value) : null;
      var html = measurementsHtml(c);
      if(html){
        sel.closest('.field').insertAdjacentHTML('afterend', html);
      }
    }catch(e){}
  }

  var origOpenOrderModal = openOrderModal;
  openOrderModal = function(id, presetCustomerId){
    var r = origOpenOrderModal.apply(this, arguments);
    setTimeout(function(){
      renderBox();
      var sel = document.getElementById('f_customer');
      if(sel && !sel.dataset.measureBound){
        sel.dataset.measureBound='1';
        sel.addEventListener('change', renderBox);
      }
    }, 30);
    return r;
  };
})();

/* 16) وضع "يوم الجرد" — تقرير شامل يجمع المتأخرات والمستحقات في شاشة واحدة */
(function(){
  function buildAuditReport(){
    var today = todayStr();
    var active = db.orders.filter(function(o){ return o.status!=='تم التسليم'; });
    var overdue = active.filter(isOverdue);
    var dueToday = active.filter(function(o){ return o.dateDelivery===today; });
    var totalOutstanding = active.reduce(function(s,o){ return s+orderRemaining(o); }, 0);
    var debtors = (typeof debtorCustomers==='function') ? debtorCustomers() : [];

    var overdueRows = overdue.slice(0,10).map(function(o){
      var c = customerById(o.customerId);
      return '<div class="row" style="padding:5px 0;border-bottom:1px solid var(--border);"><span>'+(c?escapeHtml(c.name):'عميل محذوف')+' - '+escapeHtml(orderTypeLabel(o))+'</span></div>';
    }).join('') || '<div class="empty-msg">لا يوجد طلبات متأخرة 🎉</div>';

    var debtorRows = debtors.slice(0,10).map(function(d){
      return '<div class="row" style="padding:5px 0;border-bottom:1px solid var(--border);"><span>'+escapeHtml(d.customer.name)+'</span><b style="color:var(--danger);">'+d.amount.toLocaleString('ar-EG')+' ج.م</b></div>';
    }).join('') || '<div class="empty-msg">لا يوجد عملاء متجاوزين حد المديونية</div>';

    return '<div class="modal-head"><h3>🗓️ يوم الجرد</h3><button class="modal-close" onclick="closeModal()">✕</button></div>'
      + '<div class="card" style="padding:10px 12px;margin-bottom:10px;background:var(--card-alt);">'
        + '<div class="row"><span class="meta">طلبات متأخرة</span><b style="color:var(--danger);">'+overdue.length+'</b></div>'
        + '<div class="row"><span class="meta">طلبات مستحقة اليوم</span><b style="color:var(--warn);">'+dueToday.length+'</b></div>'
        + '<div class="row"><span class="meta">إجمالي المستحقات (كل الطلبات الجارية)</span><b>'+totalOutstanding.toLocaleString('ar-EG')+' ج.م</b></div>'
      + '</div>'
      + '<div class="section-title">⏰ الطلبات المتأخرة</div>'
      + '<div style="margin-bottom:14px;">'+overdueRows+(overdue.length>10?'<p class="meta" style="margin-top:6px;">+ '+(overdue.length-10)+' طلب تاني</p>':'')+'</div>'
      + '<div class="section-title">🧾 عملاء متجاوزين حد المديونية</div>'
      + '<div>'+debtorRows+(debtors.length>10?'<p class="meta" style="margin-top:6px;">+ '+(debtors.length-10)+' عميل تاني</p>':'')+'</div>';
  }

  window.openAuditDayMode = function(){
    try{ openModal(buildAuditReport()); }catch(e){ toast('تعذر فتح يوم الجرد'); }
  };

  var nav = document.getElementById('sideNav');
  if(nav && !document.getElementById('navAuditDay')){
    var btn = document.createElement('button');
    btn.className='navbtn'; btn.id='navAuditDay';
    btn.innerHTML = '<span class="ic">🗓️</span>يوم الجرد';
    btn.onclick = function(){ closeSideNav(); openAuditDayMode(); };
    var settingsBtn = nav.querySelector('.navbtn[data-page="settings"]');
    if(settingsBtn) settingsBtn.insertAdjacentElement('beforebegin', btn);
    else nav.appendChild(btn);
  }
})();

/* 17) اختصار صوتي بسيط لملء حقل الملاحظات بالصوت (لو المتصفح بيدعم التعرف على الصوت) */
(function(){
  function attachMic(textareaId){
    var ta = document.getElementById(textareaId);
    if(!ta || ta.dataset.micAdded) return;
    ta.dataset.micAdded='1';
    var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    var btn = document.createElement('button');
    btn.type='button'; btn.className='btn sm secondary'; btn.style.marginTop='6px';
    btn.textContent='🎤 إدخال بالصوت';
    if(!Recognition){
      btn.disabled = true;
      btn.title = 'التعرف على الصوت مش مدعوم في هذا المتصفح';
      btn.style.opacity='0.5';
    } else {
      btn.onclick = function(){
        try{
          var rec = new Recognition();
          rec.lang = 'ar-EG';
          rec.interimResults = false;
          btn.textContent = '🎙️ ...جارِ الاستماع';
          btn.disabled = true;
          rec.onresult = function(e){
            var text = e.results[0][0].transcript;
            ta.value = (ta.value ? ta.value.trim()+' ' : '') + text;
            toast('✅ تم إضافة النص بالصوت');
          };
          rec.onerror = function(){ toast('⚠️ تعذر التعرف على الصوت'); };
          rec.onend = function(){ btn.textContent='🎤 إدخال بالصوت'; btn.disabled=false; };
          rec.start();
        }catch(e){ toast('⚠️ خاصية الصوت مش متاحة'); btn.disabled=false; btn.textContent='🎤 إدخال بالصوت'; }
      };
    }
    ta.insertAdjacentElement('afterend', btn);
  }

  var origOpenCustomerModal = openCustomerModal;
  openCustomerModal = function(id){
    var r = origOpenCustomerModal.apply(this, arguments);
    setTimeout(function(){ attachMic('f_notes'); }, 30);
    return r;
  };
})();

/* 18) هدف شهري للإيرادات مع شريط تقدم في صفحة المالية — مربوط باحتياجك
   الشخصي الشهري (المحسوب تلقائيًا من صفحة الالتزامات) عشان متحطش هدف
   إيرادات أقل من اللي محتاجه فعليًا من غير ما تاخد بالك */
(function(){
  function monthRevenue(){
    var prefix = todayStr().slice(0,7);
    return db.payments.filter(function(p){ return p.date && p.date.slice(0,7)===prefix; })
      .reduce(function(s,p){ return s+(Number(p.amount)||0); }, 0);
  }

  // نفس الرقم اللي بيظهر في "📊 كسبت X من Y المطلوبين الشهر ده" بصفحة
  // الالتزامات الشخصية — بنجيبه هنا عشان نقارنه بالهدف اللي صاحب الورشة حدده بنفسه
  function requiredPersonalMonthly(){
    try{
      var prog = monthlyCommitmentProgress();
      return prog ? prog.requiredMonthly : 0;
    }catch(e){ return 0; }
  }

  window.saveMonthlyGoal = function(){
    var val = Number(document.getElementById('f_monthlyGoal').value)||0;
    db.monthlyRevenueGoal = val;
    saveDB();
    closeModal();
    toast('✅ تم حفظ الهدف الشهري');
    renderFinance();
  };

  window.useRequiredAsGoal = function(){
    var required = requiredPersonalMonthly();
    var input = document.getElementById('f_monthlyGoal');
    if(required>0 && input) input.value = Math.ceil(required);
  };

  window.editMonthlyGoalModal = function(){
    var required = requiredPersonalMonthly();
    openModal(
      '<div class="modal-head"><h3>🎯 تحديد الهدف الشهري</h3><button class="modal-close" onclick="closeModal()">✕</button></div>'
      + '<div class="field"><label>الهدف الشهري (ج.م)</label><input id="f_monthlyGoal" type="number" value="'+(db.monthlyRevenueGoal||0)+'"></div>'
      + (required>0
          ? '<div class="meta" style="margin-bottom:10px;">💡 احتياجك الشخصي الشهري (من التزاماتك المسجلة) هو <b>'+Math.round(required).toLocaleString('ar-EG')+' ج.م</b>. <span style="text-decoration:underline;cursor:pointer;" onclick="useRequiredAsGoal()">استخدمه كهدف</span></div>'
          : '')
      + '<button class="btn" onclick="saveMonthlyGoal()">💾 حفظ</button>'
    );
  };

  var origRFGoal = renderFinance;
  renderFinance = function(){
    origRFGoal.apply(this, arguments);
    try{
      var goal = Number(db.monthlyRevenueGoal)||0;
      var revenue = monthRevenue();
      var pct = goal>0 ? Math.min(100, Math.round(revenue/goal*100)) : 0;
      var required = requiredPersonalMonthly();
      var box = document.getElementById('monthlyGoalBox');
      if(!box){
        box = document.createElement('div');
        box.id='monthlyGoalBox';
        var anchor = document.getElementById('expectedCashflowBox') || document.getElementById('financeStats');
        anchor.insertAdjacentElement('afterend', box);
      }
      var warnLine = (goal>0 && required>0 && goal<required)
        ? '<div class="alert-banner warn" style="margin-top:10px;"><span class="ic">⚠️</span><div><b>الهدف اللي حددته أقل من احتياجك الشخصي الشهري</b>احتياجك الفعلي (من التزاماتك) '+Math.round(required).toLocaleString('ar-EG')+' ج.م — يعني حتى لو حققت الهدف بالكامل هتفضل ناقص '+Math.round(required-goal).toLocaleString('ar-EG')+' ج.م لتغطية التزاماتك.</div></div>'
        : '';
      box.innerHTML = '<div class="section-title">🎯 الهدف الشهري للإيرادات</div>'
        + '<div class="card" style="padding:10px 12px;">'
        + (goal>0
          ? '<div class="row"><span class="meta">المحصّل هذا الشهر</span><b>'+revenue.toLocaleString('ar-EG')+' / '+goal.toLocaleString('ar-EG')+' ج.م</b></div>'
            + '<div style="background:var(--border);border-radius:6px;height:10px;overflow:hidden;margin-top:8px;">'
            + '<div style="width:'+pct+'%;height:100%;background:var(--accent);"></div></div>'
            + '<div class="meta" style="margin-top:6px;">'+pct+'% من الهدف</div>'
          : '<div class="empty-msg">لسه معملتش هدف شهري'+(required>0?' — احتياجك الشخصي الشهري (من التزاماتك) '+Math.round(required).toLocaleString('ar-EG')+' ج.م':'')+'</div>')
        + '<button class="btn sm secondary" style="margin-top:10px;" onclick="editMonthlyGoalModal()">'+(goal>0?'✏️ تعديل الهدف':'🎯 تحديد الهدف')+'</button>'
        + '</div>'
        + warnLine;
    }catch(e){}
  };
})();

/* 19) قراءة خطة اليوم بصوت عالٍ (Text-to-Speech) */
(function(){
  var speaking = false;

  function updateBtn(btn){
    btn.textContent = speaking ? '⏹️ إيقاف القراءة' : '🔊 اقرأ خطة اليوم بصوت عالٍ';
  }

  function buildPlanSpeech(){
    var q = computeTodayQueue();
    var queue = q.queue||[], mustFinish = q.mustFinish||[];
    if(queue.length===0) return 'مفيش طلبات مستعجلة النهاردة';
    var parts = ['عندك '+queue.length+' طلب في الدور، منهم '+mustFinish.length+' لازم يخلص النهاردة.'];
    queue.slice(0,8).forEach(function(o,i){
      var c = customerById(o.customerId);
      parts.push('رقم '+(i+1)+': '+(c?c.name:'عميل محذوف')+'، '+orderTypeLabel(o));
    });
    if(queue.length>8) parts.push('وباقي '+(queue.length-8)+' طلب تاني في الدور');
    return parts.join('. ');
  }

  function speakPlan(btn){
    if(!('speechSynthesis' in window)){ toast('⚠️ المتصفح ده مش بيدعم القراءة الصوتية'); return; }
    if(speaking){
      window.speechSynthesis.cancel();
      speaking = false; updateBtn(btn);
      return;
    }
    try{
      var text = buildPlanSpeech();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'ar-SA'; u.rate = 0.95;
      u.onend = function(){ speaking=false; updateBtn(btn); };
      u.onerror = function(){ speaking=false; updateBtn(btn); };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      speaking = true; updateBtn(btn);
    }catch(e){ toast('⚠️ تعذرت القراءة الصوتية'); }
  }

  var origRTP = renderTodayPlan;
  renderTodayPlan = function(){
    origRTP.apply(this, arguments);
    try{
      var box = document.getElementById('todayPlan');
      if(!box || isDayOff(new Date())) return;
      speaking = false;
      var btn = document.createElement('button');
      btn.id='speakPlanBtn'; btn.className='btn sm secondary';
      btn.style.cssText='margin-bottom:10px;display:block;width:100%;';
      updateBtn(btn);
      btn.onclick = function(){ speakPlan(btn); };
      box.insertAdjacentElement('afterbegin', btn);
    }catch(e){}
  };
})();

/* 20) كشف حساب لعميل معين (طباعة + مشاركة واتساب) */
(function(){
  function statementRows(orders){
    return orders.map(function(o){
      return '- '+fmtDate(o.dateReceived)+' | '+orderTypeLabel(o)+' | الإجمالي: '+orderTotal(o).toLocaleString('ar-EG')+' | مدفوع: '+(Number(o.paid)||0).toLocaleString('ar-EG')+' | متبقي: '+orderRemaining(o).toLocaleString('ar-EG')+' ج.م';
    }).join('\n');
  }

  window.printCustomerStatement = function(id){
    var c = customerById(id);
    if(!c) return;
    var orders = db.orders.filter(function(o){ return o.customerId===id; }).sort(function(a,b){ return (a.dateReceived||'').localeCompare(b.dateReceived||''); });
    var totalPaid = orders.reduce(function(s,o){ return s+(Number(o.paid)||0); }, 0);
    var totalRemaining = orders.reduce(function(s,o){ return s+orderRemaining(o); }, 0);
    var rowsHtml = orders.length ? orders.map(function(o){
      return '<tr><td>'+fmtDate(o.dateReceived)+'</td><td>'+escapeHtml(orderTypeLabel(o))+'</td><td>'+orderTotal(o).toLocaleString('ar-EG')+'</td><td>'+(Number(o.paid)||0).toLocaleString('ar-EG')+'</td><td>'+orderRemaining(o).toLocaleString('ar-EG')+'</td></tr>';
    }).join('') : '<tr><td colspan="5" style="text-align:center;color:#888;">لا توجد طلبات</td></tr>';
    var html =
      '<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>كشف حساب - '+escapeHtml(c.name)+'</title>'
      + '<style>'
      + 'body{font-family:Tahoma,Arial,sans-serif;padding:24px;color:#222;}'
      + 'h1{font-size:19px;border-bottom:2px solid #1F6D57;padding-bottom:8px;}'
      + 'table{width:100%;border-collapse:collapse;margin-top:14px;font-size:13px;}'
      + 'th,td{padding:8px 6px;border-bottom:1px solid #ddd;text-align:center;}'
      + 'th{background:#f5f3ef;}'
      + '.totals{margin-top:16px;display:flex;gap:14px;justify-content:flex-end;font-size:14px;}'
      + '.totals b{color:#1F6D57;}'
      + '</style></head><body>'
      + printBrandHeaderHtml()
      + '<h1>🧾 كشف حساب - '+escapeHtml(c.name)+'</h1>'
      + '<p style="font-size:13px;color:#666;">📞 '+escapeHtml(c.phone||'-')+' — تاريخ الكشف: '+fmtDate(todayStr())+'</p>'
      + '<table><tr><th>تاريخ الاستلام</th><th>الصنف</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th></tr>'+rowsHtml+'</table>'
      + '<div class="totals"><div>إجمالي المدفوع: <b>'+totalPaid.toLocaleString('ar-EG')+' ج.م</b></div><div>إجمالي المتبقي: <b>'+totalRemaining.toLocaleString('ar-EG')+' ج.م</b></div></div>'
      + '</body></html>';
    openPrintWindow(html, 'كشف_حساب_'+c.name);
  };

  window.shareCustomerStatement = function(id){
    var c = customerById(id);
    if(!c) return;
    var orders = db.orders.filter(function(o){ return o.customerId===id; }).sort(function(a,b){ return (a.dateReceived||'').localeCompare(b.dateReceived||''); });
    var totalPaid = orders.reduce(function(s,o){ return s+(Number(o.paid)||0); }, 0);
    var totalRemaining = orders.reduce(function(s,o){ return s+orderRemaining(o); }, 0);
    var msg = '🧾 كشف حساب - '+c.name+'\n'+(db.workshopName||'ورشة تفصيل الجلابيب')+'\nتاريخ: '+fmtDate(todayStr())+'\n\n'+statementRows(orders)+'\n\nإجمالي المدفوع: '+totalPaid.toLocaleString('ar-EG')+' ج.م\nإجمالي المتبقي: '+totalRemaining.toLocaleString('ar-EG')+' ج.م';
    if(navigator.share){ navigator.share({title:'كشف حساب '+c.name, text:msg}).catch(function(){}); return; }
    var phone = (c.phone||'').replace(/[^0-9]/g,'');
    if(phone){ if(phone.indexOf('0')===0) phone='2'+phone; openExternalLink('https://wa.me/'+phone+'?text='+encodeURIComponent(msg)); }
    else openExternalLink('https://wa.me/?text='+encodeURIComponent(msg));
  };

  var origOCH = openCustomerHistory;
  openCustomerHistory = function(id){
    var r = origOCH.apply(this, arguments);
    setTimeout(function(){
      try{
        var box = document.getElementById('modalBox');
        var gridCards = box.querySelector('.grid-cards');
        if(!gridCards) return;
        var existingRow = document.getElementById('statementBtnRow');
        if(existingRow) existingRow.remove();
        var row = document.createElement('div');
        row.id='statementBtnRow'; row.className='btn-row'; row.style.margin='10px 0 4px';
        row.innerHTML =
          '<button class="btn sm secondary" onclick="printCustomerStatement(\''+id+'\')">🖨️ طباعة كشف حساب</button>'
          + '<button class="btn sm accent" onclick="shareCustomerStatement(\''+id+'\')">📲 مشاركة واتساب</button>';
        gridCards.insertAdjacentElement('afterend', row);
      }catch(e){}
    }, 30);
    return r;
  };
})();

/* 21) متوسط وقت التفصيل الفعلي لكل نوع (يعتمد على أزرار بدء/إيقاف التوقيت المسجّلة على الطلبات) */
(function(){
  function computeAvgWorkTimes(){
    var stats = {};
    db.orders.forEach(function(o){
      if(!o.actualMinutes || o.actualMinutes<=0) return;
      var entries = [];
      if(Array.isArray(o.items) && o.items.length===1){
        entries = [{type:o.items[0].type, qty:o.items[0].qty||1}];
      } else if(!Array.isArray(o.items) && o.type){
        entries = [{type:o.type, qty:o.qty||1}];
      }
      entries.forEach(function(e){
        var perPiece = o.actualMinutes/Math.max(1, e.qty);
        if(!stats[e.type]) stats[e.type] = {total:0, count:0};
        stats[e.type].total += perPiece;
        stats[e.type].count += 1;
      });
    });
    return Object.keys(stats).map(function(type){
      return {type:type, avg:Math.round(stats[type].total/stats[type].count), count:stats[type].count};
    }).sort(function(a,b){ return b.count-a.count; });
  }

  var origRF = renderFinance;
  renderFinance = function(){
    origRF.apply(this, arguments);
    try{
      var rows = computeAvgWorkTimes();
      var box = document.getElementById('avgWorkTimeBox');
      if(!box){
        box = document.createElement('div');
        box.id='avgWorkTimeBox';
        var anchor = document.getElementById('bestDayBox') || document.getElementById('expectedCashflowBox') || document.getElementById('financeStats');
        anchor.insertAdjacentElement('afterend', box);
      }
      var rowsHtml = rows.length ? rows.map(function(r){
        return '<div class="row" style="padding:5px 0;border-bottom:1px solid var(--border);"><span>'+escapeHtml(r.type)+'</span><b>'+formatMinutesLabel(r.avg)+' <span class="meta" style="font-size:11px;">('+r.count+' قطعة)</span></b></div>';
      }).join('') : '<div class="empty-msg">لسه مفيش وقت شغل مسجّل كفاية — استخدم زر "بدء/إيقاف التوقيت" على الطلبات عشان تتجمع بيانات كافية</div>';
      box.innerHTML = '<div class="section-title">⏱️ متوسط وقت التفصيل الفعلي لكل نوع</div><div class="card">'+rowsHtml+'</div>';
    }catch(e){}
  };
})();

/* 22) كشف تكرار أرقام الهواتف بين أكتر من عميل */
(function(){
  function findDuplicatePhones(){
    var groups = {};
    db.customers.forEach(function(c){
      var digits = (c.phone||'').replace(/[^0-9]/g,'');
      if(digits.length<8) return;
      if(!groups[digits]) groups[digits]=[];
      groups[digits].push(c);
    });
    return Object.keys(groups).map(function(k){ return groups[k]; }).filter(function(g){ return g.length>1; });
  }

  var origRC = renderCustomers;
  renderCustomers = function(){
    origRC.apply(this, arguments);
    try{
      var list = document.getElementById('customersList');
      var old = document.getElementById('dupPhoneAlert');
      if(old) old.remove();
      var dups = findDuplicatePhones();
      if(dups.length===0) return;
      var names = dups.map(function(g){ return g.map(function(c){ return c.name; }).join(' / '); }).join('، ');
      var box = document.createElement('div');
      box.id='dupPhoneAlert';
      box.className='alert-banner warn';
      box.style.marginBottom='10px';
      box.innerHTML = '<span class="ic">⚠️</span><div><b>فيه '+dups.length+' رقم هاتف مكرر بين أكتر من عميل</b>'+escapeHtml(names)+' — راجعهم علشان مايتلخبطش حساب الولاء وحد المديونية.</div>';
      list.insertAdjacentElement('beforebegin', box);
    }catch(e){}
  };
})();

/* 24) تصنيف المصروفات بفئات */
(function(){
  var DEFAULT_CATS = ['خامات وأقمشة','إيجار','فواتير','صيانة وأدوات','مواصلات','رواتب وعمالة','أخرى'];
  function expenseCats(){
    return (db.expenseCategories && db.expenseCategories.length) ? db.expenseCategories : DEFAULT_CATS;
  }
  var expenseCatFilter = 'all';

  openExpenseModal = function(){
    var cats = expenseCats();
    var html =
      '<div class="modal-head"><h3>➕ مصروف جديد</h3><button class="modal-close" onclick="closeModal()">✕</button></div>'
      + '<div class="field"><label>وصف المصروف</label><input id="f_expDesc" placeholder="مثال: خيوط، أزرار، سوست..."></div>'
      + '<div class="field"><label>الفئة</label><select id="f_expCat">'+cats.map(function(c){ return '<option value="'+escapeHtml(c)+'">'+escapeHtml(c)+'</option>'; }).join('')+'</select></div>'
      + '<div class="field"><label>المبلغ (ج.م)</label><input id="f_expAmount" type="number" placeholder="0"></div>'
      + '<div class="field"><label>التاريخ</label><input id="f_expDate" type="date" value="'+todayStr()+'"></div>'
      + '<button class="btn" onclick="saveExpense()">💾 حفظ</button>';
    openModal(html);
  };

  saveExpense = function(){
    var desc = document.getElementById('f_expDesc').value.trim();
    var catEl = document.getElementById('f_expCat');
    var cat = catEl ? catEl.value : 'أخرى';
    var amount = Number(document.getElementById('f_expAmount').value)||0;
    var date = document.getElementById('f_expDate').value || todayStr();
    if(!desc){ toast('أدخل وصف المصروف'); return; }
    if(amount<=0){ toast('أدخل مبلغاً صحيحاً'); return; }
    var record = {id:uid(), desc:desc, amount:amount, date:date, cat:cat};
    db.expenses.push(record);
    logActivity('🧵 مصروف جديد: '+desc+' ('+amount.toLocaleString('ar-EG')+' ج.م)');
    setUndo('إضافة المصروف', function(){
      db.expenses = db.expenses.filter(function(e){ return e.id!==record.id; });
      saveDB();
      renderExpenses();
    });
    saveDB();
    closeModal();
    renderExpenses();
    toast('تم إضافة المصروف ✅');
  };

  window.setExpenseCatFilter = function(cat){
    expenseCatFilter = cat;
    renderExpenses();
  };

  renderExpenses = function(){
    var all = db.expenses;
    var filtered = expenseCatFilter==='all' ? all : all.filter(function(e){ return (e.cat||'أخرى')===expenseCatFilter; });
    var total = filtered.reduce(function(s,e){ return s+Number(e.amount||0); }, 0);
    document.getElementById('totalExpensesTxt').textContent = total.toLocaleString('ar-EG')+' ج.م';

    var cats = expenseCats();
    var catTotals = {};
    all.forEach(function(e){ var c=e.cat||'أخرى'; catTotals[c]=(catTotals[c]||0)+Number(e.amount||0); });

    var chipsHtml = '<span class="rc-chip" style="'+(expenseCatFilter==='all'?'background:var(--accent);color:#fff;':'')+'" onclick="setExpenseCatFilter(\'all\')">الكل</span>'
      + cats.filter(function(c){ return catTotals[c]; }).map(function(c){
          return '<span class="rc-chip" style="'+(expenseCatFilter===c?'background:var(--accent);color:#fff;':'')+'" onclick="setExpenseCatFilter(\''+c.replace(/'/g,"\\'")+'\')">'+escapeHtml(c)+' ('+catTotals[c].toLocaleString('ar-EG')+')</span>';
        }).join('');

    var chipsBox = document.getElementById('expenseCatChips');
    if(!chipsBox){
      chipsBox = document.createElement('div');
      chipsBox.id='expenseCatChips';
      chipsBox.style.cssText='display:flex;gap:8px;overflow-x:auto;padding-bottom:8px;margin-bottom:10px;';
      var addBtn = document.querySelector('#page-expenses .btn[onclick="openExpenseModal()"]');
      if(addBtn) addBtn.insertAdjacentElement('afterend', chipsBox);
    }
    chipsBox.innerHTML = chipsHtml;

    var list = filtered.slice().sort(function(a,b){ return b.date.localeCompare(a.date); });
    document.getElementById('expensesList').innerHTML = list.length ? list.map(function(e){
      return '<div class="card">'
        + '<div class="row"><h3>'+escapeHtml(e.desc)+'</h3><b style="color:var(--danger)">'+Number(e.amount).toLocaleString('ar-EG')+' ج.م</b></div>'
        + '<div class="meta">📅 '+fmtDate(e.date)+' — <span class="badge">'+escapeHtml(e.cat||'أخرى')+'</span></div>'
        + '<div class="btn-row"><button class="btn sm danger" onclick="deleteExpense(\''+e.id+'\')">🗑️ حذف</button></div>'
        + '</div>';
    }).join('') : '<div class="empty-msg">لا توجد مصروفات '+(expenseCatFilter==='all'?'مسجلة':'في هذه الفئة')+'</div>';
  };
})();

/* 25) مؤشر واضح لحالة الاتصال بالإنترنت (أوفلاين/أونلاين) + تنبيه للتغييرات المعلّقة اللي هتتزامن لاحقًا */
(function(){
  function badgeState(){
    if(!navigator.onLine) return {show:true, text:'📴 أوفلاين — شغّال عادي وهيتزامن لما يرجع النت', color:'#E0796A'};
    if(db && db.cloudSync && db.cloudSync.enabled && cloudPendingChanges){
      return {show:true, text:'⏳ في انتظار المزامنة', color:'#D9A93D'};
    }
    return {show:false};
  }
  function updateOfflineBadge(){
    var state = badgeState();
    var badge = document.getElementById('offlineBadge');
    if(state.show){
      if(!badge){
        badge = document.createElement('span');
        badge.id = 'offlineBadge';
        badge.style.cssText = 'background:rgba(255,255,255,0.18);color:#fff;border-radius:20px;padding:6px 12px;font-size:12px;font-weight:800;margin-inline-end:6px;display:inline-flex;align-items:center;gap:5px;flex-shrink:0;';
        var holder = document.querySelector('header.topbar > div:last-child');
        if(holder) holder.insertAdjacentElement('afterbegin', badge);
      }
      badge.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:'+state.color+';display:inline-block;"></span>'+state.text;
    } else if(badge){
      badge.remove();
    }
  }
  window.refreshConnectivityBadge = updateOfflineBadge;

  window.addEventListener('offline', function(){
    updateOfflineBadge();
    toast('📴 محدش نت دلوقتي — التغييرات هتتحفظ عندك على الجهاز وتتزامن تلقائي أول ما الاتصال يرجع');
  });

  window.addEventListener('online', function(){
    updateOfflineBadge();
    var syncing = (db && db.cloudSync && db.cloudSync.enabled);
    if(syncing) scheduleCloudPush(); // نحاول نبعت أي تغييرات معلّقة فورًا
    toast(syncing ? '✅ رجع النت — جاري مزامنة أي تغييرات' : '✅ رجع النت');
  });

  var origBoot = boot;
  boot = function(){
    origBoot.apply(this, arguments);
    updateOfflineBadge();
  };
})();

const origCloudStatusChanged = cloudStatusChanged;
cloudStatusChanged = function(){
  origCloudStatusChanged();
  if(typeof window.refreshConnectivityBadge==='function') window.refreshConnectivityBadge();
};


/* 26) صلاحيات بمستويات (مالك / مدير / استقبال) + رقم سري منفصل لصفحة المالية — حقول الإعدادات */
(function(){
  try{
    var cards = document.querySelectorAll('#page-settings .card');
    var anchorCard = null;
    cards.forEach(function(c){
      var h3 = c.querySelector('h3');
      if(h3 && h3.textContent.indexOf('تغيير الرقم السري')!==-1) anchorCard = c;
    });
    if(!anchorCard) return;

    var lastInserted = anchorCard;

    // --- بطاقة رقم المدير (صلاحيات كاملة ما عدا الإعدادات) ---
    if(!document.getElementById('managerPinCard')){
      var mCard = document.createElement('div');
      mCard.className='card'; mCard.id='managerPinCard';
      mCard.innerHTML =
        '<h3>🗂️ رقم سري لوضع المدير (اختياري)</h3>'
        + '<p class="meta">رقم سري تالت مختلف عن رقمك الأساسي وعن رقم الاستقبال — لو حد دخل بيه هيقدر يشتغل بكل الصفحات (الطلبات، العملاء، المواعيد، المصروفات، المالية) ما عدا صفحة الإعدادات. سيبه فاضي لإلغاء الميزة.</p>'
        + '<div class="field"><label>رقم سري المدير (4 أرقام)</label><input type="tel" maxlength="4" id="managerPinInput" inputmode="numeric" autocomplete="off" class="pin-input" oninput="this.value=this.value.replace(/\\D/g,\'\').slice(0,4)"></div>'
        + '<button class="btn" id="saveManagerPinBtn">💾 حفظ</button>';
      lastInserted.insertAdjacentElement('afterend', mCard);
      lastInserted = mCard;
      document.getElementById('saveManagerPinBtn').onclick = function(){
        var val = (document.getElementById('managerPinInput').value||'').trim();
        if(val && val.length!==4){ toast('لازم يكون 4 أرقام بالظبط، أو سيبه فاضي لإلغاء الميزة'); return; }
        if(val && val===db.password){ toast('لازم يكون مختلف عن رقمك الأساسي'); return; }
        if(val && db.receptionPassword && val===db.receptionPassword){ toast('لازم يكون مختلف عن رقم الاستقبال'); return; }
        db.managerPassword = val || null;
        saveDB();
        document.getElementById('managerPinInput').value='';
        toast(val ? '✅ تم حفظ رقم وضع المدير' : '✅ تم إلغاء وضع المدير');
      };
    } else {
      lastInserted = document.getElementById('managerPinCard');
    }

    // --- بطاقة رقم الاستقبال (صلاحيات محدودة) ---
    if(!document.getElementById('receptionPinCard')){
      var card = document.createElement('div');
      card.className='card'; card.id='receptionPinCard';
      card.innerHTML =
        '<h3>🧑‍💼 رقم سري لوضع الاستقبال (اختياري)</h3>'
        + '<p class="meta">رقم سري تاني مختلف عن رقمك الأساسي وعن رقم المدير — لو حد دخل بيه هيفتح نسخة محدودة، بدون صفحات المالية/المصروفات/الإعدادات وبدون إمكانية حذف. سيبه فاضي لإلغاء الميزة.</p>'
        + '<div class="field"><label>رقم سري الاستقبال (4 أرقام)</label><input type="tel" maxlength="4" id="receptionPinInput" inputmode="numeric" autocomplete="off" class="pin-input" oninput="this.value=this.value.replace(/\\D/g,\'\').slice(0,4)"></div>'
        + '<button class="btn" id="saveReceptionPinBtn">💾 حفظ</button>';
      lastInserted.insertAdjacentElement('afterend', card);
      lastInserted = card;
      document.getElementById('saveReceptionPinBtn').onclick = function(){
        var val = (document.getElementById('receptionPinInput').value||'').trim();
        if(val && val.length!==4){ toast('لازم يكون 4 أرقام بالظبط، أو سيبه فاضي لإلغاء الميزة'); return; }
        if(val && val===db.password){ toast('لازم يكون مختلف عن رقمك الأساسي'); return; }
        if(val && db.managerPassword && val===db.managerPassword){ toast('لازم يكون مختلف عن رقم المدير'); return; }
        db.receptionPassword = val || null;
        saveDB();
        document.getElementById('receptionPinInput').value='';
        toast(val ? '✅ تم حفظ رقم وضع الاستقبال' : '✅ تم إلغاء وضع الاستقبال');
      };
    } else {
      lastInserted = document.getElementById('receptionPinCard');
    }

    // --- بطاقة رقم صفحة المالية (منفصل تمامًا عن رقم قفل التطبيق، بيتطلب مع أي مستوى) ---
    if(!document.getElementById('financePinCard')){
      var fCard = document.createElement('div');
      fCard.className='card'; fCard.id='financePinCard';
      fCard.innerHTML =
        '<h3>💰 رقم سري منفصل لصفحة المالية (اختياري)</h3>'
        + '<p class="meta">رقم سري إضافي مختلف عن رقم قفل التطبيق العام — لازم يتكتب عشان تفتح صفحة "المالية" فقط (مش باقي الصفحات). كده تقدر تدّي حد يشتغل بالتطبيق عادي (طلبات، عملاء، مواعيد...) من غير ما يشوف أرباحك، حتى لو بيستخدم رقمك الأساسي. سيبه فاضي لإلغاء الميزة.</p>'
        + '<div class="field"><label>رقم سري المالية (4 أرقام)</label><input type="tel" maxlength="4" id="financePinInput" inputmode="numeric" autocomplete="off" class="pin-input" oninput="this.value=this.value.replace(/\\D/g,\'\').slice(0,4)"></div>'
        + '<button class="btn" id="saveFinancePinBtn">💾 حفظ</button>';
      lastInserted.insertAdjacentElement('afterend', fCard);
      document.getElementById('saveFinancePinBtn').onclick = function(){
        var val = (document.getElementById('financePinInput').value||'').trim();
        if(val && val.length!==4){ toast('لازم يكون 4 أرقام بالظبط، أو سيبه فاضي لإلغاء الميزة'); return; }
        db.financePassword = val || null;
        saveDB();
        window.financeUnlocked = false;
        if(typeof updateFinanceLockUI==='function') updateFinanceLockUI();
        document.getElementById('financePinInput').value='';
        toast(val ? '✅ تم حفظ رقم صفحة المالية' : '✅ تم إلغاء قفل صفحة المالية');
      };
    }
  }catch(e){}
})();

/* 27) تمييز الطلبات عالية القيمة والقريبة من موعد التسليم */
(function(){
  function isHighValueUrgent(o){
    if(!o || o.status==='تم التسليم' || !o.dateDelivery) return false;
    var diffDays = Math.round((new Date(o.dateDelivery) - new Date(todayStr()))/86400000);
    if(diffDays>2) return false;
    var active = db.orders.filter(function(x){ return x.status!=='تم التسليم'; });
    if(active.length<3) return false;
    var avg = active.reduce(function(s,x){ return s+orderTotal(x); }, 0)/active.length;
    return orderTotal(o) >= avg*1.5;
  }

  function tagHighValueCards(container){
    if(!container) return;
    container.querySelectorAll('.card').forEach(function(card){
      var btn = card.querySelector('[onclick*="openOrderModal("]') || card.querySelector('[onclick*="markOrderDelivered("]');
      if(!btn) return;
      var m = btn.getAttribute('onclick').match(/(?:openOrderModal|markOrderDelivered)\('([^']+)'/);
      if(!m) return;
      var o = db.orders.find(function(x){ return x.id===m[1]; });
      var badge = card.querySelector('.high-value-badge');
      if(isHighValueUrgent(o)){
        card.classList.add('high-value-alert');
        if(!badge){
          badge = document.createElement('span');
          badge.className='high-value-badge';
          badge.style.cssText='display:inline-block;margin-inline-start:8px;background:var(--accent);color:#fff;border-radius:8px;padding:2px 8px;font-size:11px;font-weight:900;';
          badge.textContent='💎 قيمة عالية وقربت';
          var row = card.querySelector('.row');
          if(row) row.appendChild(badge);
        }
      } else {
        card.classList.remove('high-value-alert');
        if(badge) badge.remove();
      }
    });
  }

  new MutationObserver(function(){
    tagHighValueCards(document.getElementById('ordersList'));
    tagHighValueCards(document.getElementById('todayPlan'));
  }).observe(document.getElementById('app'), {childList:true, subtree:true});
})();

/* تنبيه موسم الذروة القادم — مقارنة بنفس الفترة من السنة اللي فاتت + مناسبات موسمية */
(function(){
  function ordersInRange(startStr, endStr){
    return db.orders.filter(function(o){
      return o.dateReceived && o.dateReceived>=startStr && o.dateReceived<=endStr;
    });
  }

  function checkPeakSeason(){
    try{
      var today = new Date(todayStr());
      var alerts = [];

      var thisMonthStart = todayStr().slice(0,8)+'01';
      var thisMonthOrders = ordersInRange(thisMonthStart, todayStr());

      var lastYear = new Date(today); lastYear.setFullYear(lastYear.getFullYear()-1);
      var lyMonthPrefix = lastYear.toISOString().slice(0,7);
      var lyMonthOrders = db.orders.filter(function(o){
        return o.dateReceived && o.dateReceived.slice(0,7)===lyMonthPrefix;
      });

      if(lyMonthOrders.length>=5 && thisMonthOrders.length>0){
        var dayOfMonth = today.getDate();
        var lyOrdersUpToSameDay = lyMonthOrders.filter(function(o){
          return Number(o.dateReceived.slice(8,10))<=dayOfMonth;
        });
        if(lyOrdersUpToSameDay.length>0){
          var pctChange = Math.round((thisMonthOrders.length-lyOrdersUpToSameDay.length)/lyOrdersUpToSameDay.length*100);
          if(pctChange>=20){
            alerts.push('📈 الطلبات الشهر ده زادت '+pctChange+'% عن نفس الفترة السنة اللي فاتت — استعد بخامات وتنظيم مواعيد إضافي');
          }
        }
      }

      (db.holidays||[]).forEach(function(h){
        if(!h.date) return;
        var diff = Math.round((new Date(h.date) - today)/86400000);
        if(diff<0 || diff>28) return;

        var key = 'peakSeasonAlertShown_'+h.id+'_'+today.getFullYear();
        if(localStorage.getItem(key)) return;

        var hDate = new Date(h.date);
        var beforeStart = new Date(hDate); beforeStart.setDate(beforeStart.getDate()-21);
        var beforeStartStr = beforeStart.toISOString().slice(0,10);
        var beforeEndStr = h.date;

        var lyHolidayDate = new Date(hDate); lyHolidayDate.setFullYear(lyHolidayDate.getFullYear()-1);
        var lyBeforeStart = new Date(lyHolidayDate); lyBeforeStart.setDate(lyBeforeStart.getDate()-21);
        var lyOrdersBeforeHoliday = ordersInRange(lyBeforeStart.toISOString().slice(0,10), lyHolidayDate.toISOString().slice(0,10));

        var avgOrdersPerWeek = db.orders.length / 10;
        if(lyOrdersBeforeHoliday.length > avgOrdersPerWeek*2){
          alerts.push('🎉 باقي '+diff+' يوم على "'+h.name+'" — السنة اللي فاتت زادت الطلبات قبلها بشكل ملحوظ، جهّز خامات ونظّم مواعيد التسليم بدري');
          localStorage.setItem(key, '1');
        }
      });

      if(alerts.length>0){
        setTimeout(function(){
          openModal(
            '<div class="modal-head"><h3>📊 تنبيه موسم الذروة</h3><button class="modal-close" onclick="closeModal()">✕</button></div>'
            + alerts.map(function(a){ return '<div class="card" style="margin-bottom:8px;padding:10px 12px;">'+a+'</div>'; }).join('')
          );
        }, 1500);
      }
    }catch(e){}
  }

  var todayKey = 'peakSeasonCheckedDate';
  if(localStorage.getItem(todayKey)!==todayStr()){
    localStorage.setItem(todayKey, todayStr());
    setTimeout(checkPeakSeason, 1600);
  }
})();

/* وضع "عرض للعميل" — تمويه مؤقت لأرقام وأسعار العملاء التانيين */
(function(){
  var active = false;

  function toggleDisplayMode(){
    active = !active;
    document.documentElement.classList.toggle('display-mode', active);
    var btn = document.getElementById('displayModeBtn');
    if(btn) btn.classList.toggle('active-display-mode', active);
    toast(active ? '🙈 وضع العرض مفعّل — الأرقام والأسعار متخفية مؤقتًا' : '✅ تم إلغاء وضع العرض');
    maskSensitiveElements();
  }

  function maskSensitiveElements(){
    document.querySelectorAll('.meta').forEach(function(el){
      if(el.dataset.rcPhone || el.textContent.trim().indexOf('📞')===0){
        if(active){
          if(!el.dataset.origText) el.dataset.origText = el.innerHTML;
          var phoneLinks = el.querySelector('a[href^="tel:"], a[href^="https://wa.me"]');
          el.innerHTML = '📞 •••••••••'+(phoneLinks ? '' : '');
        } else if(el.dataset.origText){
          el.innerHTML = el.dataset.origText;
          delete el.dataset.origText;
        }
      }
    });
  }

  new MutationObserver(function(){
    if(active) maskSensitiveElements();
  }).observe(document.getElementById('app'), {childList:true, subtree:true});

  var themeBtn = document.getElementById('themeToggleBtn');
  if(themeBtn && !document.getElementById('displayModeBtn')){
    var btn = document.createElement('button');
    btn.className='theme-toggle-btn'; btn.id='displayModeBtn';
    btn.setAttribute('aria-label','وضع عرض للعميل'); btn.textContent='👁️';
    btn.onclick = toggleDisplayMode;
    themeBtn.insertAdjacentElement('afterend', btn);
  }
})();

/* تسليم جزئي للطلب — لما الطلب فيه أكتر من صنف/قطعة */
(function(){
  function getDeliveredQty(order){
    return order.partialDeliveries || {};
  }

  function isFullyDelivered(order){
    if(!Array.isArray(order.items)) return false;
    var delivered = getDeliveredQty(order);
    return order.items.every(function(it, idx){
      return (delivered[idx]||0) >= (it.qty||1);
    });
  }

  window.openPartialDeliveryModal = function(orderId){
    var o = db.orders.find(function(x){ return x.id===orderId; });
    if(!o || !Array.isArray(o.items) || o.items.length===0){
      toast('التسليم الجزئي متاح فقط للطلبات اللي فيها أكتر من صنف');
      return;
    }
    var delivered = getDeliveredQty(o);
    var rows = o.items.map(function(it, idx){
      var already = delivered[idx]||0;
      var total = it.qty||1;
      return '<div class="field">'
        + '<label>'+escapeHtml(orderTypeLabel({items:[it]}))+' (الإجمالي: '+total+')</label>'
        + '<input type="number" id="pd_item_'+idx+'" min="0" max="'+total+'" value="'+already+'" style="width:100%;">'
        + '</div>';
    }).join('');
    openModal(
      '<div class="modal-head"><h3>📦 تسليم جزئي</h3><button class="modal-close" onclick="closeModal()">✕</button></div>'
      + '<p class="meta">حدّد كام قطعة اتسلمت من كل صنف:</p>'
      + rows
      + '<button class="btn" onclick="savePartialDelivery(\''+orderId+'\')">💾 حفظ التسليم الجزئي</button>'
    );
  };

  window.savePartialDelivery = function(orderId){
    var o = db.orders.find(function(x){ return x.id===orderId; });
    if(!o) return;
    if(!o.partialDeliveries) o.partialDeliveries = {};
    var anyInvalid = false;
    o.items.forEach(function(it, idx){
      var input = document.getElementById('pd_item_'+idx);
      var val = Number(input.value)||0;
      var max = it.qty||1;
      if(val<0 || val>max){ anyInvalid = true; return; }
      o.partialDeliveries[idx] = val;
    });
    if(anyInvalid){ toast('⚠️ فيه قيمة أكبر من الكمية المطلوبة'); return; }

    logActivity('📦 تسليم جزئي لطلب '+(customerById(o.customerId)?customerById(o.customerId).name:''));
    saveDB();
    closeModal();

    if(isFullyDelivered(o)){
      toast('✅ كل القطع اتسلمت — هل تحب تعلّم الطلب "تم التسليم" بالكامل؟');
      setTimeout(function(){
        openModal(
          '<div class="modal-head"><h3>✅ اكتمل التسليم</h3><button class="modal-close" onclick="closeModal()">✕</button></div>'
          + '<p class="meta">كل قطع الطلب اتسلمت، تحب تقفل الطلب كـ"تم التسليم"؟</p>'
          + '<button class="btn" onclick="closeModal();markOrderDelivered(\''+orderId+'\')">نعم، قفّل الطلب</button>'
        );
      }, 400);
    } else {
      toast('✅ تم حفظ التسليم الجزئي');
      renderOrders();
    }
  };

  var origOpenOrderModal = openOrderModal;
  openOrderModal = function(id, presetCustomerId){
    var r = origOpenOrderModal.apply(this, arguments);
    if(id){
      setTimeout(function(){
        try{
          var o = db.orders.find(function(x){ return x.id===id; });
          if(!o || !Array.isArray(o.items) || o.items.length<2 || o.status==='تم التسليم') return;
          var box = document.getElementById('modalBox');
          var btnRow = box.querySelector('.btn-row');
          if(btnRow && !document.getElementById('partialDeliveryBtn')){
            var btn = document.createElement('button');
            btn.id='partialDeliveryBtn'; btn.className='btn sm secondary';
            btn.textContent='📦 تسليم جزئي';
            btn.onclick = function(){ openPartialDeliveryModal(id); };
            btnRow.insertAdjacentElement('afterbegin', btn);
          }
        }catch(e){}
      }, 40);
    }
    return r;
  };

  function tagPartialBadges(container){
    if(!container) return;
    container.querySelectorAll('.card').forEach(function(card){
      var btn = card.querySelector('[onclick*="openOrderModal("]');
      if(!btn) return;
      var m = btn.getAttribute('onclick').match(/openOrderModal\('([^']+)'/);
      if(!m) return;
      var o = db.orders.find(function(x){ return x.id===m[1]; });
      if(!o || !Array.isArray(o.items) || o.items.length<2) return;
      var delivered = getDeliveredQty(o);
      var totalQty = o.items.reduce(function(s,it){ return s+(it.qty||1); }, 0);
      var deliveredQty = o.items.reduce(function(s,it,idx){ return s+Math.min(delivered[idx]||0, it.qty||1); }, 0);
      var existingBadge = card.querySelector('.partial-delivery-badge');
      if(deliveredQty>0 && deliveredQty<totalQty && o.status!=='تم التسليم'){
        if(!existingBadge){
          var row = card.querySelector('.row');
          if(row){
            var badge = document.createElement('span');
            badge.className='partial-delivery-badge';
            badge.style.cssText='display:inline-block;margin-inline-start:8px;background:var(--info);color:#fff;border-radius:8px;padding:2px 8px;font-size:11px;font-weight:800;';
            badge.textContent='📦 اتسلم '+deliveredQty+'/'+totalQty;
            row.appendChild(badge);
          }
        } else {
          existingBadge.textContent='📦 اتسلم '+deliveredQty+'/'+totalQty;
        }
      } else if(existingBadge){
        existingBadge.remove();
      }
    });
  }

  new MutationObserver(function(){
    tagPartialBadges(document.getElementById('ordersList'));
    tagPartialBadges(document.getElementById('todayPlan'));
  }).observe(document.getElementById('app'), {childList:true, subtree:true});
})();

/* ربط طلبات العائلة الواحدة — يستخدم حقل "family" الموجود بالفعل في بيانات العميل */
(function(){
  function familyMembers(familyName){
    return db.customers.filter(function(c){ return c.family===familyName; });
  }

  function familyOrdersData(familyName){
    var members = familyMembers(familyName);
    var rows = [];
    members.forEach(function(m){
      db.orders.filter(function(o){ return o.customerId===m.id; }).forEach(function(o){
        rows.push({order:o, customer:m});
      });
    });
    rows.sort(function(a,b){ return (a.order.dateReceived||'').localeCompare(b.order.dateReceived||''); });
    return {members:members, rows:rows};
  }

  window.viewFamilyGroup = function(familyName){
    var data = familyOrdersData(familyName);
    var totalPaid = data.rows.reduce(function(s,x){ return s+(Number(x.order.paid)||0); }, 0);
    var totalRemaining = data.rows.reduce(function(s,x){ return s+orderRemaining(x.order); }, 0);
    var rowsHtml = data.rows.map(function(x){
      return '<div class="card"><div class="row"><h3>'+escapeHtml(x.customer.name)+' - '+escapeHtml(orderTypeLabel(x.order))+'</h3>'
        + '<b>'+orderTotal(x.order).toLocaleString('ar-EG')+' ج.م</b></div>'
        + '<div class="meta">📅 '+fmtDate(x.order.dateReceived)+' — متبقي: '+orderRemaining(x.order).toLocaleString('ar-EG')+' ج.م</div></div>';
    }).join('') || '<div class="empty-msg">لا توجد طلبات مسجلة لهذه العائلة</div>';

    openModal(
      '<div class="modal-head"><h3>👪 '+escapeHtml(familyName)+'</h3><button class="modal-close" onclick="closeModal()">✕</button></div>'
      + '<p class="meta">'+data.members.length+' أفراد — '+data.rows.length+' طلب إجمالاً</p>'
      + '<div class="card" style="padding:10px 12px;margin-bottom:12px;background:var(--card-alt);">'
        + '<div class="row"><span class="meta">إجمالي المدفوع</span><b style="color:var(--ok);">'+totalPaid.toLocaleString('ar-EG')+' ج.م</b></div>'
        + '<div class="row"><span class="meta">إجمالي المتبقي</span><b style="color:var(--danger);">'+totalRemaining.toLocaleString('ar-EG')+' ج.م</b></div>'
      + '</div>'
      + rowsHtml
      + '<button class="btn sm secondary" style="margin-top:10px;" onclick="printFamilyStatement(\''+familyName.replace(/'/g,"\\'")+'\')">🖨️ طباعة كشف حساب العائلة</button>'
    );
  };

  window.printFamilyStatement = function(familyName){
    var data = familyOrdersData(familyName);
    var totalPaid = data.rows.reduce(function(s,x){ return s+(Number(x.order.paid)||0); }, 0);
    var totalRemaining = data.rows.reduce(function(s,x){ return s+orderRemaining(x.order); }, 0);
    var rowsHtml = data.rows.length ? data.rows.map(function(x){
      return '<tr><td>'+escapeHtml(x.customer.name)+'</td><td>'+fmtDate(x.order.dateReceived)+'</td><td>'+escapeHtml(orderTypeLabel(x.order))+'</td>'
        + '<td>'+orderTotal(x.order).toLocaleString('ar-EG')+'</td><td>'+(Number(x.order.paid)||0).toLocaleString('ar-EG')+'</td>'
        + '<td>'+orderRemaining(x.order).toLocaleString('ar-EG')+'</td></tr>';
    }).join('') : '<tr><td colspan="6" style="text-align:center;color:#888;">لا توجد طلبات</td></tr>';

    var html = '<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>كشف حساب عائلة - '+escapeHtml(familyName)+'</title>'
      + '<style>body{font-family:Tahoma,Arial,sans-serif;padding:24px;color:#222;} h1{font-size:19px;border-bottom:2px solid #1F6D57;padding-bottom:8px;}'
      + ' table{width:100%;border-collapse:collapse;margin-top:14px;font-size:13px;} th,td{padding:8px 6px;border-bottom:1px solid #ddd;text-align:center;}'
      + ' th{background:#f5f3ef;} .totals{margin-top:16px;display:flex;gap:14px;justify-content:flex-end;font-size:14px;} .totals b{color:#1F6D57;}</style></head><body>'
      + printBrandHeaderHtml()
      + '<h1>🧾 كشف حساب عائلة - '+escapeHtml(familyName)+'</h1>'
      + '<p style="font-size:13px;color:#666;">عدد الأفراد: '+data.members.length+' — تاريخ الكشف: '+fmtDate(todayStr())+'</p>'
      + '<table><tr><th>الاسم</th><th>تاريخ الاستلام</th><th>الصنف</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th></tr>'+rowsHtml+'</table>'
      + '<div class="totals"><div>إجمالي المدفوع: <b>'+totalPaid.toLocaleString('ar-EG')+' ج.م</b></div>'
      + '<div>إجمالي المتبقي: <b>'+totalRemaining.toLocaleString('ar-EG')+' ج.م</b></div></div>'
      + '</body></html>';
    openPrintWindow(html, 'كشف_حساب_عائلة_'+familyName);
  };

  var origRC = renderCustomers;
  renderCustomers = function(){
    origRC.apply(this, arguments);
    try{
      document.querySelectorAll('#customersList .card').forEach(function(card){
        if(card.dataset.familyBadgeAdded) return;
        var phoneEl = null;
        card.querySelectorAll('.meta').forEach(function(m){
          if(!phoneEl && m.textContent.trim().indexOf('📞')===0) phoneEl = m;
        });
        if(!phoneEl) return;
        var digits = phoneEl.textContent.replace(/[^0-9]/g,'');
        var c = db.customers.find(function(x){ return (x.phone||'').replace(/[^0-9]/g,'')===digits; });
        if(!c || !c.family) return;
        var siblingsCount = familyMembers(c.family).length;
        if(siblingsCount<2) return;
        card.dataset.familyBadgeAdded='1';
        var chip = document.createElement('div');
        chip.className='meta'; chip.style.cssText='margin-top:4px;';
        chip.innerHTML = '<span style="background:var(--info-light);color:var(--info);border-radius:8px;padding:3px 9px;font-size:11.5px;font-weight:700;cursor:pointer;">👪 '+escapeHtml(c.family)+' ('+siblingsCount+' أفراد)</span>';
        chip.querySelector('span').onclick = function(){ viewFamilyGroup(c.family); };
        phoneEl.insertAdjacentElement('afterend', chip);
      });
    }catch(e){}
  };
})();

/* ===== معرض الأعمال (نسخة أساسية) ===== */
(function(){
  function getGallery(){ try{ return JSON.parse(localStorage.getItem('workGallery')||'[]'); }catch(e){ return []; } }
  function saveGallery(list){
    try{ localStorage.setItem('workGallery', JSON.stringify(list)); return true; }
    catch(e){ toast('⚠️ مساحة التخزين ممتلئة — احذف صور قديمة عشان تضيف جديدة'); return false; }
  }
  function resizeImage(file, cb){
    var reader = new FileReader();
    reader.onload = function(e){
      var img = new Image();
      img.onload = function(){
        var maxW = 900;
        var scale = Math.min(1, maxW/img.width);
        var canvas = document.createElement('canvas');
        canvas.width = img.width*scale; canvas.height = img.height*scale;
        canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
        cb(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  window.openGalleryModal = function(){
    var list = getGallery();
    var grid = list.length===0
      ? '<div class="g-empty">لسه مفيش صور — ابدأ تضيف أفضل قطعك 👇</div>'
      : list.map(function(item){
          return '<div class="g-item" onclick="viewGalleryItem(\''+item.id+'\')"><img src="'+item.img+'" loading="lazy"></div>';
        }).join('');
    openModal(
      '<div class="modal-head"><h3>🖼️ معرض الأعمال</h3><button class="modal-close" onclick="closeModal()">✕</button></div>'
      + '<button class="gallery-add-btn" onclick="triggerGalleryUpload()">➕ إضافة صورة جديدة</button>'
      + '<div id="galleryGrid">'+grid+'</div>'
    );
  };

  window.viewGalleryItem = function(id){
    var item = getGallery().find(function(x){ return x.id===id; });
    if(!item) return;
    openModal(
      '<div class="modal-head"><h3>🖼️ تفاصيل الصورة</h3><button class="modal-close" onclick="closeModal()">✕</button></div>'
      + '<img src="'+item.img+'" style="width:100%;border-radius:10px;margin-bottom:10px;">'
      + (item.caption ? '<p class="meta">'+escapeHtml(item.caption)+'</p>' : '')
      + '<p class="meta">'+fmtDate(item.date)+'</p>'
      + '<button class="btn outline" style="width:100%;margin-top:10px;color:var(--danger);border-color:var(--danger);" onclick="deleteGalleryItem(\''+id+'\')">🗑️ حذف الصورة</button>'
    );
  };

  window.deleteGalleryItem = function(id){
    saveGallery(getGallery().filter(function(x){ return x.id!==id; }));
    toast('🗑️ اتحذفت الصورة');
    openGalleryModal();
  };

  // زر الوصول للمعرض في القائمة الجانبية
  var settingsBtn = document.querySelector('.navbtn[data-page="settings"]');
  if(settingsBtn){
    var galleryBtn = document.createElement('button');
    galleryBtn.className='navbtn';
    galleryBtn.innerHTML = '<span class="ic">🖼️</span>معرض الأعمال';
    galleryBtn.onclick = function(){ closeSideNav(); openGalleryModal(); };
    settingsBtn.insertAdjacentElement('beforebegin', galleryBtn);
  }

  // يُستبدلان لاحقًا بالنسخة المطوّرة (ربط بعميل/طلب) بالأسفل — موجودان هنا فقط لأخذ نفس الشكل الأساسي عند عدم توفر db
  window.triggerGalleryUpload = window.triggerGalleryUpload || function(){
    var input = document.createElement('input');
    input.type='file'; input.accept='image/*';
    input.onchange = function(){
      if(!input.files || !input.files[0]) return;
      resizeImage(input.files[0], function(dataUrl){
        window._pendingGalleryImage = dataUrl;
        openModal(
          '<div class="modal-head"><h3>✏️ وصف الصورة</h3><button class="modal-close" onclick="closeModal()">✕</button></div>'
          + '<img src="'+dataUrl+'" style="width:100%;border-radius:10px;margin-bottom:10px;">'
          + '<label>وصف مختصر (اختياري)</label>'
          + '<input id="galleryCaptionInput" placeholder="مثال: جلباب مناسبات - قماش كتان">'
          + '<button class="btn accent" style="width:100%;margin-top:12px;" onclick="saveGalleryItem()">💾 حفظ في المعرض</button>'
        );
      });
    };
    input.click();
  };

  window.saveGalleryItem = window.saveGalleryItem || function(){
    var dataUrl = window._pendingGalleryImage;
    if(!dataUrl) return;
    var caption = (document.getElementById('galleryCaptionInput')||{}).value || '';
    var list = getGallery();
    list.unshift({id:'g'+Date.now(), img:dataUrl, caption:caption, date:todayStr()});
    if(saveGallery(list)){
      toast('✅ اتضافت الصورة للمعرض');
      window._pendingGalleryImage = null;
      openGalleryModal();
    }
  };
})();

/* ===== معرض الأعمال (نسخة مطوّرة): ربط اختياري بعميل/طلب، شارة روابط، قسم "صور الطلب" داخل فورم الطلب ===== */
(function(){
  function getGallery(){ try{ return JSON.parse(localStorage.getItem('workGallery')||'[]'); }catch(e){ return []; } }
  function saveGallery(list){ try{ localStorage.setItem('workGallery', JSON.stringify(list)); return true; }catch(e){ toast('⚠️ مساحة التخزين ممتلئة'); return false; } }

  /* استبدال دالة الرفع عشان تقبل ربط اختياري بعميل/طلب من البداية */
  window.triggerGalleryUpload = function(presetCustomerId, presetOrderId){
    var input = document.createElement('input');
    input.type='file'; input.accept='image/*';
    input.onchange = function(){
      if(!input.files || !input.files[0]) return;
      var reader = new FileReader();
      reader.onload = function(e){
        var img = new Image();
        img.onload = function(){
          var maxW=900, scale=Math.min(1, maxW/img.width);
          var canvas=document.createElement('canvas');
          canvas.width=img.width*scale; canvas.height=img.height*scale;
          canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
          window._pendingGalleryImage = canvas.toDataURL('image/jpeg',0.72);
          openGalleryCaptionStep(presetCustomerId, presetOrderId);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(input.files[0]);
    };
    input.click();
  };

  window.openGalleryCaptionStep = function(presetCustomerId, presetOrderId){
    var custOptions = '<option value="">بدون ربط بعميل</option>' + db.customers.map(function(c){
      return '<option value="'+c.id+'" '+(c.id===presetCustomerId?'selected':'')+'>'+escapeHtml(c.name)+'</option>';
    }).join('');
    openModal(
      '<div class="modal-head"><h3>✏️ وصف الصورة</h3><button class="modal-close" onclick="closeModal()">✕</button></div>'
      + '<img src="'+window._pendingGalleryImage+'" style="width:100%;border-radius:10px;margin-bottom:10px;">'
      + '<label>وصف مختصر (اختياري)</label>'
      + '<input id="galleryCaptionInput" placeholder="مثال: جلباب مناسبات - قماش كتان">'
      + '<label style="margin-top:8px;">ربط بعميل (اختياري)</label>'
      + '<select id="galleryCustomerSelect" onchange="onGalleryCustomerChange()">'+custOptions+'</select>'
      + '<div id="galleryOrderSelectWrap"></div>'
      + '<button class="btn accent" style="width:100%;margin-top:12px;" onclick="saveGalleryItem()">💾 حفظ في المعرض</button>'
    );
    if(presetCustomerId){ onGalleryCustomerChange(presetOrderId); }
  };

  window.onGalleryCustomerChange = function(presetOrderId){
    var custId = document.getElementById('galleryCustomerSelect').value;
    var wrap = document.getElementById('galleryOrderSelectWrap');
    if(!custId){ wrap.innerHTML=''; return; }
    var orders = db.orders.filter(function(o){ return o.customerId===custId; });
    if(orders.length===0){ wrap.innerHTML='<p class="meta">مفيش طلبات مسجلة لهذا العميل</p>'; return; }
    var opts = '<option value="">بدون ربط بطلب معين</option>' + orders.map(function(o){
      return '<option value="'+o.id+'" '+(o.id===presetOrderId?'selected':'')+'>'+escapeHtml(orderTypeLabel(o))+' - '+fmtDate(o.dateDelivery)+'</option>';
    }).join('');
    wrap.innerHTML = '<label style="margin-top:8px;">ربط بطلب معين (اختياري)</label><select id="galleryOrderSelect">'+opts+'</select>';
  };

  /* استبدال دالة الحفظ عشان تخزن الربط */
  window.saveGalleryItem = function(){
    var dataUrl = window._pendingGalleryImage;
    if(!dataUrl) return;
    var caption = (document.getElementById('galleryCaptionInput')||{}).value || '';
    var custId = (document.getElementById('galleryCustomerSelect')||{}).value || '';
    var orderId = (document.getElementById('galleryOrderSelect')||{}).value || '';
    var list = getGallery();
    list.unshift({id:'g'+Date.now(), img:dataUrl, caption:caption, date:todayStr(), customerId:custId||null, orderId:orderId||null});
    if(saveGallery(list)){
      toast('✅ اتضافت الصورة للمعرض');
      window._pendingGalleryImage = null;
      if(orderId){ closeModal(); openOrderModal(orderId); }
      else{ openGalleryModal(); }
    }
  };

  /* شارة 🔗 على الصور المرتبطة داخل شبكة المعرض */
  var origOpenGalleryModal = openGalleryModal;
  openGalleryModal = function(){
    origOpenGalleryModal();
    setTimeout(function(){
      getGallery().forEach(function(item){
        if(!item.orderId && !item.customerId) return;
        var el = document.querySelector('.g-item[onclick*="'+item.id+'"]');
        if(el && !el.querySelector('.g-link-badge')){
          var b=document.createElement('span'); b.className='g-link-badge';
          b.style.cssText='position:absolute;top:4px;left:4px;background:rgba(0,0,0,0.55);color:#fff;border-radius:6px;padding:1px 5px;font-size:10px;';
          b.textContent='🔗';
          el.appendChild(b);
        }
      });
    }, 30);
  };

  /* قسم "صور الطلب" داخل فورم تعديل الطلب */
  var origOOMGallery = openOrderModal;
  openOrderModal = function(id, presetCustomerId){
    var r = origOOMGallery.apply(this, arguments);
    if(id){
      setTimeout(function(){
        try{
          var o = db.orders.find(function(x){ return x.id===id; });
          if(!o) return;
          var imgs = getGallery().filter(function(g){ return g.orderId===id; });
          var thumbs = imgs.map(function(g){
            return '<div style="width:56px;height:56px;border-radius:8px;overflow:hidden;flex-shrink:0;" onclick="viewGalleryItem(\''+g.id+'\')"><img src="'+g.img+'" style="width:100%;height:100%;object-fit:cover;"></div>';
          }).join('');
          var section = document.createElement('div');
          section.style.cssText='margin:14px 0;';
          section.innerHTML =
            '<label>📷 صور الطلب</label>'
            + '<div style="display:flex;gap:8px;overflow-x:auto;margin:6px 0;">'+thumbs+'</div>'
            + '<div style="display:flex;gap:8px;">'
            + '<button type="button" class="btn sm outline" onclick="triggerGalleryUpload(\''+o.customerId+'\',\''+id+'\')">➕ صورة جديدة</button>'
            + '<button type="button" class="btn sm outline" onclick="openGalleryPickerForOrder(\''+id+'\',\''+o.customerId+'\')">🖼️ من المعرض</button>'
            + '</div>';
          var saveBtn = document.querySelector('.modal-box button[onclick^="saveOrder("]');
          if(saveBtn) saveBtn.insertAdjacentElement('beforebegin', section);
        }catch(e){}
      }, 60);
    }
    return r;
  };

  window.openGalleryPickerForOrder = function(orderId, customerId){
    var list = getGallery();
    var grid = list.length===0 ? '<div class="g-empty">المعرض فاضي</div>' : list.map(function(item){
      return '<div class="g-item" onclick="linkGalleryItemToOrder(\''+item.id+'\',\''+orderId+'\',\''+customerId+'\')"><img src="'+item.img+'" loading="lazy"></div>';
    }).join('');
    openModal(
      '<div class="modal-head"><h3>🖼️ اختر صورة لربطها بالطلب</h3><button class="modal-close" onclick="closeModal()">✕</button></div>'
      + '<div id="galleryGrid">'+grid+'</div>'
    );
  };

  window.linkGalleryItemToOrder = function(itemId, orderId, customerId){
    var list = getGallery();
    var item = list.find(function(x){ return x.id===itemId; });
    if(item){ item.orderId=orderId; item.customerId=customerId; saveGallery(list); toast('🔗 اترابطت الصورة بالطلب'); }
    closeModal();
    openOrderModal(orderId);
  };
})();

/* 1) زر كثافة العرض (مريح/مضغوط) جنب باقي أيقونات الشريط العلوي */
(function(){
  var anchor = document.getElementById('contrastToggleBtn') || document.getElementById('themeToggleBtn');
  if(!anchor) return;
  var btn = document.createElement('button');
  btn.className='theme-toggle-btn'; btn.id='densityToggleBtn';
  btn.setAttribute('aria-label','كثافة العرض');
  function updateIcon(){ btn.textContent = document.documentElement.classList.contains('compact-view') ? '▤' : '☰'; }
  btn.onclick = function(){
    document.documentElement.classList.toggle('compact-view');
    localStorage.setItem('compactView', document.documentElement.classList.contains('compact-view')?'1':'0');
    updateIcon();
  };
  anchor.insertAdjacentElement('afterend', btn);
  if(localStorage.getItem('compactView')==='1') document.documentElement.classList.add('compact-view');
  updateIcon();
})();

/* 2) تحويل بطاقات صفحة الإعدادات لأكورديون قابل للطي */
(function(){
  function accordionizeCard(card){
    if(card.dataset.accordionized) return;
    var heading = card.firstElementChild;
    if(!heading || heading.tagName!=='H3') return;
    var rest = Array.prototype.slice.call(card.children, 1);
    if(rest.length===0) return;
    card.dataset.accordionized='1';
    var body = document.createElement('div');
    body.className='acc-body';
    body.style.display='none';
    rest.forEach(function(el){ body.appendChild(el); });
    card.appendChild(body);
    var chevron = document.createElement('span');
    chevron.textContent='▾';
    chevron.style.cssText='margin-inline-start:auto;transition:transform .2s;font-size:13px;color:var(--muted);';
    heading.style.cssText='display:flex;align-items:center;cursor:pointer;margin:0;';
    heading.appendChild(chevron);
    heading.addEventListener('click', function(){
      var open = body.style.display!=='none';
      body.style.display = open ? 'none' : 'block';
      chevron.style.transform = open ? '' : 'rotate(180deg)';
    });
  }
  function processSettingsCards(){
    document.querySelectorAll('#page-settings > .card').forEach(accordionizeCard);
  }
  processSettingsCards();
  new MutationObserver(processSettingsCards).observe(document.getElementById('page-settings'), {childList:true});
})();

/* 1) ظل يظهر على الهيدر عند التمرير + زر الرجوع لأعلى الصفحة */
(function(){
  window.addEventListener('scroll', function(){
    var header = document.querySelector('header.topbar');
    if(header) header.classList.toggle('scrolled', window.scrollY>10);
  }, {passive:true});

  var btn = document.createElement('button');
  btn.id='scrollTopBtn'; btn.textContent='⬆️';
  btn.onclick = function(){ window.scrollTo({top:0, behavior:'smooth'}); };
  document.getElementById('app').appendChild(btn);
  window.addEventListener('scroll', function(){
    btn.classList.toggle('show', window.scrollY>400);
  }, {passive:true});
})();

/* 2) فلاتر سريعة + فرز + تجميع بالحالة + فواصل تاريخ + دليل ألوان لصفحة الطلبات */
(function(){
  var extraFilter='none', sortMode='default', groupByStatus=false;

  function ensureControls(){
    if(document.getElementById('ordersExtraControls')) return;
    var list = document.getElementById('ordersList');
    if(!list) return;
    var wrap = document.createElement('div');
    wrap.id='ordersExtraControls'; wrap.style.cssText='margin-bottom:10px;';
    wrap.innerHTML =
      '<div class="btn-row" style="flex-wrap:wrap;margin-bottom:8px;" id="ordersChipsRow">'
      + '<button class="btn sm outline" data-chip="urgent">🔥 مستعجل</button>'
      + '<button class="btn sm outline" data-chip="soon">⏳ قريب الموعد</button>'
      + '<button class="btn sm outline" data-chip="nodeposit">💰 بدون عربون</button>'
      + '<button class="btn sm outline" data-chip="group">🗂️ تجميع بالحالة</button>'
      + '<button class="btn sm outline" id="legendToggleBtn">🎨 دليل الألوان</button>'
      + '</div>'
      + '<div class="field" style="margin-bottom:8px;"><label>ترتيب حسب</label>'
      + '<select id="ordersSortSelect">'
      + '<option value="default">📥 الأحدث إضافة</option>'
      + '<option value="nearest">⏳ الأقرب تسليمًا</option>'
      + '<option value="highest">💰 الأعلى قيمة</option>'
      + '</select></div>'
      + '<div id="legendBox" style="display:none;padding:10px;background:var(--card-alt);border-radius:10px;font-size:12px;margin-bottom:8px;">'
      + '🟢 قيد العمل &nbsp; 🟡 جاهز للتسليم &nbsp; ⚪ تم التسليم &nbsp; 🔴 متأخر / مستعجل'
      + '</div>';
    list.insertAdjacentElement('beforebegin', wrap);

    wrap.querySelectorAll('[data-chip]').forEach(function(b){
      b.addEventListener('click', function(){
        var chip=b.dataset.chip;
        if(chip==='group'){ groupByStatus=!groupByStatus; b.classList.toggle('accent',groupByStatus); }
        else{
          extraFilter=(extraFilter===chip)?'none':chip;
          wrap.querySelectorAll('[data-chip]').forEach(function(x){ if(x.dataset.chip!=='group') x.classList.remove('accent'); });
          if(extraFilter!=='none') b.classList.add('accent');
        }
        applyEnhancements();
      });
    });
    document.getElementById('ordersSortSelect').addEventListener('change', function(){ sortMode=this.value; applyEnhancements(); });
    document.getElementById('legendToggleBtn').addEventListener('click', function(){
      var box=document.getElementById('legendBox');
      box.style.display = box.style.display==='none' ? 'block':'none';
    });
  }

  function applyEnhancements(){
    var container=document.getElementById('ordersList');
    if(!container) return;
    container.querySelectorAll('.order-group-title').forEach(function(el){ el.remove(); });
    var cards=Array.prototype.slice.call(container.querySelectorAll('.card'));
    cards.forEach(function(card){
      if(!card.dataset.orderId){
        var btn=card.querySelector('[onclick^="openOrderModal("]');
        if(btn){ var m=btn.getAttribute('onclick').match(/openOrderModal\('([^']+)'/); if(m) card.dataset.orderId=m[1]; }
      }
    });
    var today=todayStr();
    var in3=new Date(); in3.setDate(in3.getDate()+3);
    var in3Str=in3.toISOString().slice(0,10);

    cards.forEach(function(card){
      var o=db.orders.find(function(x){ return x.id===card.dataset.orderId; });
      var show=true;
      if(o){
        if(extraFilter==='urgent') show=!!o.urgent;
        else if(extraFilter==='soon') show=o.status!=='تم التسليم' && o.dateDelivery && o.dateDelivery<=in3Str;
        else if(extraFilter==='nodeposit') show=o.status!=='تم التسليم' && !Number(o.paid);
      }
      card.style.display=show?'':'none';
    });

    var visible=cards.filter(function(c){ return c.style.display!=='none'; });
    if(sortMode!=='default'){
      visible.sort(function(a,b){
        var oa=db.orders.find(function(x){ return x.id===a.dataset.orderId; });
        var ob=db.orders.find(function(x){ return x.id===b.dataset.orderId; });
        if(!oa||!ob) return 0;
        if(sortMode==='nearest') return (oa.dateDelivery||'9999').localeCompare(ob.dateDelivery||'9999');
        if(sortMode==='highest') return orderTotal(ob)-orderTotal(oa);
        return 0;
      });
      visible.forEach(function(card){ container.appendChild(card); });
    }

    if(groupByStatus){
      var order=['قيد العمل','جاهز للتسليم','تم التسليم'];
      var groups={};
      visible.forEach(function(card){
        var o=db.orders.find(function(x){ return x.id===card.dataset.orderId; });
        var st=o?o.status:'أخرى';
        (groups[st]=groups[st]||[]).push(card);
      });
      order.forEach(function(st){
        if(!groups[st]||!groups[st].length) return;
        var title=document.createElement('div');
        title.className='section-title order-group-title';
        title.textContent=st+' ('+groups[st].length+')';
        container.appendChild(title);
        groups[st].forEach(function(card){ container.appendChild(card); });
      });
    } else if(sortMode==='nearest'){
      var lastDate=null;
      visible.forEach(function(card){
        var o=db.orders.find(function(x){ return x.id===card.dataset.orderId; });
        var d=o?(o.dateDelivery||'بدون تاريخ'):null;
        if(d && d!==lastDate){
          var sep=document.createElement('div');
          sep.className='order-group-title';
          sep.style.cssText='font-size:11.5px;color:var(--muted);margin:10px 2px 4px;font-weight:700;';
          sep.textContent='📅 '+(d==='بدون تاريخ'?d:fmtDate(d));
          container.insertBefore(sep, card);
          lastDate=d;
        }
      });
    }
  }

  // [مدموج] كانت الدالة دي متلفوفة مرتين (هنا + عند دعم الكانبان تحت).
  // دلوقتي الاتنين في مكان واحد عشان محدش يعدّل حتة من غير ما يشوف التانية.
  var origRO=renderOrders;
  renderOrders=function(){
    origRO.apply(this, arguments);
    ensureControls();
    setTimeout(applyEnhancements, 20);
    if(window.ordersView==='kanban' && typeof window.renderOrdersKanban==='function') window.renderOrdersKanban();
  };
})();

/* 3) تجميع العملاء أبجديًا + شريط حروف جانبي للقفز السريع */
(function(){
  function firstLetter(name){ return (name&&name.trim().charAt(0))||'#'; }

  function applyAlphaGroup(){
    var container=document.getElementById('customersList');
    if(!container) return;
    container.querySelectorAll('.cust-group-title').forEach(function(el){ el.remove(); });
    var cards=Array.prototype.slice.call(container.querySelectorAll('.card'));
    if(cards.length<6){ var s=document.getElementById('alphaStrip'); if(s) s.style.display='none'; return; }
    var items=cards.map(function(card){
      var phoneEl=Array.prototype.find.call(card.querySelectorAll('.meta'), function(m){ return m.textContent.trim().indexOf('📞')===0; });
      var digits=phoneEl?phoneEl.textContent.replace(/[^0-9]/g,''):'';
      var c=db.customers.find(function(x){ return (x.phone||'').replace(/[^0-9]/g,'')===digits; });
      return {card:card, name:c?c.name:''};
    }).filter(function(it){ return it.name; });
    items.sort(function(a,b){ return a.name.localeCompare(b.name,'ar'); });
    var lastLetter=null, letters=[];
    items.forEach(function(it){
      var letter=firstLetter(it.name);
      if(letter!==lastLetter){
        var title=document.createElement('div');
        title.className='section-title cust-group-title';
        title.id='cust-letter-'+letter.charCodeAt(0);
        title.textContent=letter;
        container.appendChild(title);
        lastLetter=letter; letters.push(letter);
      }
      container.appendChild(it.card);
    });
    buildLetterStrip(letters);
  }

  function buildLetterStrip(letters){
    var strip=document.getElementById('alphaStrip');
    if(!strip){
      strip=document.createElement('div'); strip.id='alphaStrip';
      strip.style.cssText='position:fixed;top:50%;left:4px;transform:translateY(-50%);display:flex;flex-direction:column;gap:2px;z-index:55;background:var(--card);border-radius:10px;padding:4px 3px;box-shadow:var(--shadow);';
      document.getElementById('app').appendChild(strip);
    }
    strip.innerHTML='';
    strip.style.display = letters.length>3 ? 'flex' : 'none';
    letters.forEach(function(letter){
      var b=document.createElement('button');
      b.textContent=letter;
      b.style.cssText='background:none;border:none;font-size:10.5px;color:var(--primary);font-weight:800;padding:1px 3px;';
      b.onclick=function(){
        var el=document.getElementById('cust-letter-'+letter.charCodeAt(0));
        if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
      };
      strip.appendChild(b);
    });
  }

  var origRC3=renderCustomers;
  renderCustomers=function(){
    origRC3.apply(this, arguments);
    setTimeout(applyAlphaGroup, 40);
  };

  var origShowPage3=showPage;
  showPage=function(name){
    var r=origShowPage3.apply(this, arguments);
    var strip=document.getElementById('alphaStrip');
    if(strip && name!=='customers') strip.style.display='none';
    return r;
  };
})();

/* شكل زر القفل (أيقونة + نص قابل للإخفاء على الشاشات الضيقة عبر CSS) */
(function(){
  var lockBtn = document.querySelector('header.topbar .small-link');
  if(lockBtn && !lockBtn.dataset.wrapped){
    lockBtn.dataset.wrapped='1';
    lockBtn.innerHTML = '🔒<span class="lock-text"> قفل</span>';
  }
})();

/* إحساس ضغط فوري للوحة أرقام القفل + قفل مؤقت أثناء التحقق من الرقم */
(function(){
  function setup(){
    var keypad = document.getElementById('keypad');
    if(!keypad || keypad.dataset.fastTapEnabled) return;
    keypad.dataset.fastTapEnabled='1';

    keypad.addEventListener('touchstart', function(e){
      var btn = e.target.closest('button');
      if(btn) btn.classList.add('pressed');
    }, {passive:true});
    ['touchend','touchcancel'].forEach(function(ev){
      keypad.addEventListener(ev, function(e){
        var btn = e.target.closest('button');
        if(btn) btn.classList.remove('pressed');
        else keypad.querySelectorAll('.pressed').forEach(function(b){ b.classList.remove('pressed'); });
      }, {passive:true});
    });
  }
  setup();

  var origCheckPin = checkPin;
  checkPin = function(){
    var keypad = document.getElementById('keypad');
    if(keypad) keypad.style.pointerEvents='none';
    origCheckPin();
    setTimeout(function(){ if(keypad) keypad.style.pointerEvents=''; }, 450);
  };
})();

/* 28) لوحة كانبان لصفحة الطلبات */
(function(){
  window.ordersView = 'list';
  var KANBAN_STATUSES = [
    {key:'قيد العمل', label:'🧵 قيد العمل', icon:'🧵'},
    {key:'جاهز للتسليم', label:'📦 جاهز للتسليم', icon:'📦'},
    {key:'تم التسليم', label:'✅ تم التسليم', icon:'✅'}
  ];
  var DELIVERED_LIMIT = 20; // نعرض آخر عدد محدود من الطلبات المُسلَّمة بس عشان الأداء ووضوح اللوحة

  window.setOrdersView = function(v){
    window.ordersView = v;
    var listBox = document.getElementById('ordersList');
    var kanbanBox = document.getElementById('ordersKanban');
    var statusFilters = document.getElementById('orderStatusFilters');
    var extraControls = document.getElementById('ordersExtraControls');
    var listBtn = document.getElementById('ordersViewListBtn');
    var kanbanBtn = document.getElementById('ordersViewKanbanBtn');
    if(v==='kanban'){
      if(listBox) listBox.style.display='none';
      if(kanbanBox) kanbanBox.style.display='';
      if(statusFilters) statusFilters.style.display='none';
      if(extraControls) extraControls.style.display='none';
      if(listBtn) listBtn.classList.remove('active');
      if(kanbanBtn) kanbanBtn.classList.add('active');
      renderOrdersKanban();
    } else {
      if(listBox) listBox.style.display='';
      if(kanbanBox) kanbanBox.style.display='none';
      if(statusFilters) statusFilters.style.display='';
      if(extraControls) extraControls.style.display='';
      if(listBtn) listBtn.classList.add('active');
      if(kanbanBtn) kanbanBtn.classList.remove('active');
      renderOrders();
    }
  };

  // نفس منطق البحث والفلترة بالتاريخ المستخدم في renderOrders، لكن من غير فلتر الحالة (لأن الحالة هنا أعمدة)
  function filteredOrdersForKanban(){
    var qEl = document.getElementById('orderSearch');
    var fromEl = document.getElementById('orderDateFrom');
    var toEl = document.getElementById('orderDateTo');
    var q = qEl ? (qEl.value||'').trim() : '';
    var dateFrom = fromEl ? fromEl.value : '';
    var dateTo = toEl ? toEl.value : '';
    var list = db.orders.slice().sort(function(a,b){ return (b.dateReceived||'').localeCompare(a.dateReceived||''); });
    if(q){
      list = list.filter(function(o){
        var c = customerById(o.customerId);
        return (c && c.name.includes(q)) || orderTypeLabel(o).includes(q);
      });
    }
    if(dateFrom) list = list.filter(function(o){ return o.dateReceived && o.dateReceived>=dateFrom; });
    if(dateTo) list = list.filter(function(o){ return o.dateReceived && o.dateReceived<=dateTo; });
    return list;
  }

  function kanbanCardHtml(o){
    var c = customerById(o.customerId);
    var idx = KANBAN_STATUSES.findIndex(function(s){ return s.key===o.status; });
    var moveButtons = '';
    if(idx>0){
      var prev = KANBAN_STATUSES[idx-1];
      moveButtons += '<button class="btn sm outline" onclick="moveOrderToStatus(\''+o.id+'\',\''+prev.key.replace(/'/g,"\\'")+'\')">◀ '+escapeHtml(prev.label.replace(/^\S+\s/,''))+'</button>';
    }
    if(idx>=0 && idx<KANBAN_STATUSES.length-1){
      var next = KANBAN_STATUSES[idx+1];
      moveButtons += '<button class="btn sm accent" onclick="moveOrderToStatus(\''+o.id+'\',\''+next.key.replace(/'/g,"\\'")+'\')">'+escapeHtml(next.label.replace(/^\S+\s/,''))+' ▶</button>';
    }
    return '<div class="kanban-card" draggable="true" data-order-id="'+o.id+'">'
      + '<div class="row"><h3 class="name-row">'+avatarChip(c?c.name:'؟')+(c?escapeHtml(c.name):'عميل محذوف')+'</h3></div>'
      + '<div class="meta">👗 '+escapeHtml(orderTypeLabel(o))+'</div>'
      + '<div class="meta">📅 التسليم: '+fmtDate(o.dateDelivery)+'</div>'
      + '<div class="meta">💰 المتبقي: <b style="color:'+(orderRemaining(o)>0?'var(--danger)':'var(--ok)')+'">'+orderRemaining(o).toLocaleString('ar-EG')+'</b></div>'
      + '<div class="btn-row">'
      +   '<button class="btn sm outline" onclick="openOrderModal(\''+o.id+'\')">✏️</button>'
      +   moveButtons
      + '</div>'
      + '</div>';
  }

  window.renderOrdersKanban = function(){
    var box = document.getElementById('ordersKanban');
    if(!box) return;
    var all = filteredOrdersForKanban();
    var html = '<div class="kanban-wrap" id="kanbanWrap">';
    KANBAN_STATUSES.forEach(function(st){
      var items = all.filter(function(o){ return o.status===st.key; });
      var note = '';
      if(st.key==='تم التسليم' && items.length>DELIVERED_LIMIT){
        note = '<div class="meta" style="text-align:center;">عرض آخر '+DELIVERED_LIMIT+' من '+items.length+'</div>';
        items = items.slice(0, DELIVERED_LIMIT);
      }
      var cardsHtml = items.length
        ? items.map(kanbanCardHtml).join('')
        : '<div class="kanban-empty-col">لا يوجد طلبات هنا</div>';
      html += '<div class="kanban-col" data-status="'+escapeHtml(st.key)+'">'
        + '<div class="kanban-col-head"><span>'+st.label+'</span><span class="cnt">'+items.length+'</span></div>'
        + cardsHtml + note
        + '</div>';
    });
    html += '</div>';
    box.innerHTML = html;
    wireKanbanDragDrop();
  };

  function wireKanbanDragDrop(){
    var wrap = document.getElementById('kanbanWrap');
    if(!wrap) return;
    wrap.querySelectorAll('.kanban-card').forEach(function(card){
      card.addEventListener('dragstart', function(e){
        card.classList.add('dragging');
        try{ e.dataTransfer.setData('text/plain', card.dataset.orderId); }catch(err){}
      });
      card.addEventListener('dragend', function(){ card.classList.remove('dragging'); });
    });
    wrap.querySelectorAll('.kanban-col').forEach(function(col){
      col.addEventListener('dragover', function(e){ e.preventDefault(); col.classList.add('drag-over'); });
      col.addEventListener('dragleave', function(){ col.classList.remove('drag-over'); });
      col.addEventListener('drop', function(e){
        e.preventDefault();
        col.classList.remove('drag-over');
        var id = '';
        try{ id = e.dataTransfer.getData('text/plain'); }catch(err){}
        var newStatus = col.getAttribute('data-status');
        if(id && newStatus) moveOrderToStatus(id, newStatus);
      });
    });
  }

  // تحديث حالة الطلب من اللوحة (سواء بالسحب أو بالأزرار) — بيعيد استخدام markOrderDelivered
  // عشان يحافظ على كل التأثيرات الجانبية الحالية (تسجيل وقت التسليم، سجل النشاط، التراجع...)
  window.moveOrderToStatus = function(orderId, newStatus){
    var o = db.orders.find(function(x){ return x.id===orderId; });
    if(!o || o.status===newStatus) return;
    if(newStatus==='تم التسليم'){
      markOrderDelivered(orderId);
      renderOrdersKanban();
      return;
    }
    var before = {status:o.status, deliveredDate:o.deliveredDate};
    var wasDelivered = (before.status==='تم التسليم');
    o.status = newStatus;
    if(wasDelivered) o.deliveredDate = null;
    var c = customerById(o.customerId);
    logActivity('🔄 تغيير حالة طلب '+(c?c.name:'')+' إلى "'+newStatus+'"');
    setUndo('تغيير حالة الطلب', function(){
      o.status = before.status;
      o.deliveredDate = before.deliveredDate;
      saveDB();
      renderHome();
      renderOrders();
      renderOrdersKanban();
    });
    saveDB();
    renderHome();
    renderOrders();
    renderOrdersKanban();
    toast('تم تحديث حالة الطلب ✅');
  };

  // [مدموج] مزامنة الكانبان بقت جزء من اللفة الوحيدة لـ renderOrders (فوق، جنب ensureControls/applyEnhancements)
  // بدل ما تتلف تاني هنا.

  // الوضع الافتراضي: قائمة (نفس السلوك القديم)
  var listBtnInit = document.getElementById('ordersViewListBtn');
  if(listBtnInit) listBtnInit.classList.add('active');
})();

/* 29) تقسيم صفحة الإعدادات لأقسام (تابات) بدل قائمة طويلة واحدة */
(function(){
  var section = document.getElementById('page-settings');
  if(!section || document.getElementById('settingsTabs')) return;

  var GROUPS = [
    {id:'general', label:'🏷️ عام', keywords:['بيانات الورشة','عن التطبيق']},
    {id:'appearance', label:'🎨 المظهر', keywords:['تخصيص الألوان','شكل الأزرار','تخصيص الشاشة الرئيسية','وضع الشاشة الكبيرة','تخصيص الخط','تأثير التحميل']},
    {id:'operations', label:'⚙️ التشغيل', keywords:['الطاقة الاستيعابية','يوم الإجازة الأسبوعية','مواعيد الأعياد','أنواع التفصيل','عملاء VIP','تنبيه المديونية','رقم الفاتورة والضريبة']},
    {id:'security', label:'🔒 الأمان والصلاحيات', keywords:['تغيير الرقم السري','القفل التلقائي','وضع المدير','وضع الاستقبال','صفحة المالية']},
    {id:'data', label:'💾 البيانات', keywords:['نسخة احتياطية','سلة المحذوفات','سجل النشاط','تصدير تقارير Excel']},
    {id:'advanced', label:'🧑‍💻 متقدم', keywords:['تعديل متقدم','تنزيل كود التطبيق']}
  ];
  var GROUP_BY_ID = {cloudSyncCardWrap:'data', pushNotifyCardWrap:'data'};

  function categorize(){
    var cards = section.querySelectorAll(':scope > .card');
    cards.forEach(function(c){
      if(c.dataset.settingsGroup) return;
      if(GROUP_BY_ID[c.id]){ c.dataset.settingsGroup = GROUP_BY_ID[c.id]; return; }
      var h3 = c.querySelector('h3');
      var text = h3 ? h3.textContent : '';
      var found = 'general';
      for(var i=0;i<GROUPS.length;i++){
        if(GROUPS[i].keywords.some(function(k){ return text.indexOf(k)!==-1; })){ found=GROUPS[i].id; break; }
      }
      c.dataset.settingsGroup = found;
    });
  }

  var currentSettingsTab = 'all';
  function applyFilter(group){
    currentSettingsTab = group;
    section.querySelectorAll(':scope > .card[data-settings-group]').forEach(function(c){
      c.style.display = (group==='all' || c.dataset.settingsGroup===group) ? '' : 'none';
    });
  }

  categorize();

  var bar = document.createElement('div');
  bar.className='settings-tabs'; bar.id='settingsTabs';
  var html = '<button class="settings-tab-btn active" data-group="all">📁 الكل</button>';
  GROUPS.forEach(function(g){ html += '<button class="settings-tab-btn" data-group="'+g.id+'">'+g.label+'</button>'; });
  bar.innerHTML = html;
  section.insertBefore(bar, section.firstChild);
  bar.addEventListener('click', function(e){
    var btn = e.target.closest('.settings-tab-btn');
    if(!btn) return;
    bar.querySelectorAll('.settings-tab-btn').forEach(function(b){ b.classList.toggle('active', b===btn); });
    applyFilter(btn.getAttribute('data-group'));
  });

  // أي بطاقات جديدة تتضاف بعد كده (زي بطاقات صلاحيات المدير/الاستقبال/المالية) لازم تتصنّف وتتفلتر برضه
  var obs = new MutationObserver(function(){
    categorize();
    applyFilter(currentSettingsTab);
  });
  obs.observe(section, {childList:true});
})();

/* 11) نافذة تأكيد قبل حفظ أي تعديل على بيانات عميل موجود بالفعل
   (الإضافة الجديدة مش محتاجة تأكيد لوحدها — أصلاً فيه خطوة "حفظ"
   صريحة، والتأكيد هنا يبقى مخصص للتعديل على بيانات موجودة). */
(function(){
  var origSaveCustomerConfirm = saveCustomer;
  saveCustomer = async function(id){
    if(id){
      var c = customerById(id);
      var ok = await appConfirm(
        'هل تريد حفظ التعديلات على بيانات العميل' + (c?(' "'+c.name+'"'):'') + '؟',
        {okText:'حفظ التعديل', cancelText:'إلغاء', danger:false}
      );
      if(!ok) return;
    }
    __skipUnsavedCheckOnce = true;
    var r = await origSaveCustomerConfirm.apply(this, arguments);
    // لو الفورم لسه فاتح (يعني الحفظ فشل في تحقق ما ورجع بدري)، نلغي التجاوز
    var ov = document.getElementById('modalOverlay');
    if(ov && ov.classList.contains('active')) __skipUnsavedCheckOnce = false;
    return r;
  };
})();

/* 12) نافذة تأكيد قبل حفظ أي تعديل على طلب موجود بالفعل
   [تم التحديث] لو التعديل بيغيّر حالة الطلب لـ"تم التسليم" (سواء من
   قائمة الحالة المنسدلة أو غيرها) بيظهر تنبيه مخصص وأوضح، بدل رسالة
   "حفظ التعديلات" العامة — لأن ده إجراء نهائي وأسهل حاجة تتضغط غلط
   من قائمة منسدلة أثناء التمرير بالإصبع. */
(function(){
  var origSaveOrderConfirm = saveOrder;
  saveOrder = async function(id){
    if(id){
      var o = db.orders.find(function(x){ return x.id===id; });
      var c = o ? customerById(o.customerId) : null;
      var statusSel = document.getElementById('f_status');
      var newStatus = statusSel ? statusSel.value : null;
      var becomingDelivered = o && o.status!=='تم التسليم' && newStatus==='تم التسليم';
      var ok;
      if(becomingDelivered){
        ok = await appConfirm(
          '⚠️ هذا التغيير هيسجّل' + (c?(' طلب "'+c.name+'"'):' هذا الطلب') + ' كـ"تم التسليم" بالكامل. هل أنت متأكد؟',
          {okText:'نعم، تم التسليم', cancelText:'إلغاء', danger:false}
        );
      } else {
        ok = await appConfirm(
          'هل تريد حفظ التعديلات على' + (c?(' طلب "'+c.name+'"'):' هذا الطلب') + '؟',
          {okText:'حفظ التعديل', cancelText:'إلغاء', danger:false}
        );
      }
      if(!ok) return;
    }
    __skipUnsavedCheckOnce = true;
    var r = await origSaveOrderConfirm.apply(this, arguments);
    var ov = document.getElementById('modalOverlay');
    if(ov && ov.classList.contains('active')) __skipUnsavedCheckOnce = false;
    return r;
  };
})();

/* 13) تحذير عند إغلاق فورم فيه تعديلات لم تُحفظ
   بيقارن قيم كل حقول المودال وقت ما اتفتح بقيمها وقت ما حد حاول يقفله.
   لو مختلفة، بيسأل قبل ما يقفل فعليًا. الحفظ الناجح (عبر saveCustomer/
   saveOrder) بيتخطى السؤال ده لأنه مش "إغلاق بدون حفظ". */
(function(){
  var snapshot = null;

  function snapshotModal(){
    var box = document.getElementById('modalBox');
    if(!box) return null;
    var els = box.querySelectorAll('input, textarea, select');
    if(!els.length) return null; // مفيش حقول = مفيش حاجة نراقبها (مودال معلومات/تأكيد)
    var parts = [];
    els.forEach(function(el){
      if(el.type==='checkbox' || el.type==='radio'){ parts.push(el.checked?'1':'0'); }
      else { parts.push(el.value); }
    });
    return parts.join('\u0001');
  }

  var origOpenModalDirty = openModal;
  openModal = function(html){
    var r = origOpenModalDirty.apply(this, arguments);
    snapshot = snapshotModal();
    return r;
  };

  var origCloseModalDirty = closeModal;
  closeModal = function(){
    if(__skipUnsavedCheckOnce){
      __skipUnsavedCheckOnce = false;
      snapshot = null;
      return origCloseModalDirty.apply(this, arguments);
    }
    if(snapshot!==null && snapshotModal()!==snapshot){
      appConfirm('عندك تعديلات لم تُحفظ. هل تريد الإغلاق من غير حفظها؟', {okText:'إغلاق من غير حفظ', cancelText:'متابعة التعديل', danger:true}).then(function(ok){
        if(ok){
          snapshot = null;
          origCloseModalDirty.apply(null, []);
        }
      });
      return; // منع الإغلاق الفوري لحد ما المستخدم يرد
    }
    snapshot = null;
    return origCloseModalDirty.apply(this, arguments);
  };
})();

/* 14) قفل الطلبات "تم التسليم" من التعديل العرضي
   فتح طلب مُسلَّم بالفعل بيعرض شاشة تنبيه بدل الفورم مباشرة، وتعديله
   الفعلي محتاج ضغطة واعية على "فتح للتعديل رغم كده". القفل بيترجع
   تلقائيًا في المرة الجاية اللي تتفتح فيها المودال (مش فضّال مفتوح
   لبقية الجلسة) لأننا بنصفّر unlockedOrderId كل ما المودال يتقفل فعليًا. */
(function(){
  var unlockedOrderId = null;

  var origOpenOrderModalLock = openOrderModal;
  openOrderModal = function(id, presetCustomerId){
    if(id && id!==unlockedOrderId){
      var o = db.orders.find(function(x){ return x.id===id; });
      if(o && o.status==='تم التسليم'){
        var c = customerById(o.customerId);
        openModal(
          '<div class="modal-head"><h3>🔒 طلب مُسلَّم بالفعل</h3><button class="modal-close" onclick="closeModal()">✕</button></div>'
          + '<p class="meta">طلب' + (c?(' "'+escapeHtml(c.name)+'"'):'') + ' متسجل "تم التسليم" بالفعل. الفورم مقفول تلقائيًا لمنع أي تعديل غير مقصود عليه.</p>'
          + '<button class="btn outline" onclick="window.__unlockOrderForEdit(\''+id+'\')">✏️ فتح للتعديل رغم كده</button>'
        );
        return;
      }
    }
    return origOpenOrderModalLock.apply(this, arguments);
  };
  window.__unlockOrderForEdit = function(id){
    unlockedOrderId = id;
    openOrderModal(id);
  };

  // أي إغلاق فعلي للمودال يصفّر القفل، عشان فتح نفس الطلب تاني يتطلب فتح واعٍ من جديد
  var origCloseModalLock = closeModal;
  closeModal = function(){
    unlockedOrderId = null;
    return origCloseModalLock.apply(this, arguments);
  };
})();

/* 15) شريط تراجع بأكثر من خطوة (بدل خطوة واحدة بس)
   بيحتفظ بآخر 5 إجراءات قابلة للتراجع بدل ما يفقد الإجراء اللي قبل
   الأخير بمجرد ما تعمل حاجة تانية بعده. */
(function(){
  var MAX_UNDO = 5;
  window.__undoStack = [];

  setUndo = function(label, restoreFn){
    window.__undoStack.unshift({label:label, restoreFn:restoreFn});
    if(window.__undoStack.length>MAX_UNDO) window.__undoStack.length = MAX_UNDO;
    renderUndoBar();
  };

  performUndo = function(idx){
    idx = idx||0;
    var entry = window.__undoStack[idx];
    if(!entry){ toast('لا يوجد إجراء حديث للتراجع عنه'); return; }
    window.__undoStack.splice(idx,1);
    entry.restoreFn();
    renderUndoBar();
    toast('تم التراجع عن: '+entry.label+' ↩️');
  };

  renderUndoBar = function(){
    var box = document.getElementById('undoBarWrap');
    if(!box) return;
    if(!window.__undoStack.length){ box.innerHTML=''; return; }
    box.innerHTML = window.__undoStack.map(function(entry, i){
      return '<button class="btn sm outline" style="width:100%;margin-bottom:8px;" onclick="performUndo('+i+')">↩️ تراجع عن: '+escapeHtml(entry.label)+'</button>';
    }).join('');
  };
})();

/* 16) [إصلاح حرج] كان فيه سباق بين "تحميل البيانات من السحابة" و"رفع
   البيانات المحلية" لحظة الاتصال بمساحة مزامنة — لو كان فيه اتصال سابق
   في نفس الجلسة، استدعاء saveDB() جوه دالة الاتصال كان بيجدول رفع تلقائي
   بعد أقل من ثانية، وده كان بيكتب فوق بيانات السحابة الحقيقية ببيانات
   الجهاز المحلية (اللي بتكون فاضية وقت الاتصال) قبل ما التحميل يخلص.
   الحل: منع أي رفع للسحابة تمامًا لمدة كافية بعد أي محاولة اتصال/إنشاء
   مساحة مزامنة، لحد ما يتضمن وصول أول تحديث حقيقي من السحابة. */
(function(){
  var blockPush = false;
  if(typeof pushToCloud==='function'){
    var origPushToCloudGuard = pushToCloud;
    pushToCloud = async function(){
      if(blockPush) return; // ممنوع الرفع لحد ما ناخد فرصة كافية للتحميل الأول
      return origPushToCloudGuard.apply(this, arguments);
    };
  }
  function guardConnect(fn){
    return async function(){
      blockPush = true;
      try{
        return await fn.apply(this, arguments);
      } finally {
        setTimeout(function(){ blockPush = false; }, 8000);
      }
    };
  }
  if(typeof connectCloudSyncSpace==='function') connectCloudSyncSpace = guardConnect(connectCloudSyncSpace);
  if(typeof createCloudSyncSpace==='function') createCloudSyncSpace = guardConnect(createCloudSyncSpace);
})();

/* 17) [تنظيم داخلي] تبسيط صفوف الأزرار في كروت العملاء والطلبات
   بدل ما كل كارت يعرض 6-7 زراير في صف واحد مزدحم، بنسيب أهم زرارين
   ظاهرين، والباقي يتجمع في قائمة "⋮ المزيد" منسدلة ونضيفة —
   مستوحاة من قائمة الثلاث نقاط في تطبيق "مقاس". */
(function(){
  function consolidateCardActions(containerId, primaryLabels){
    var container = document.getElementById(containerId);
    if(!container) return;
    container.querySelectorAll('.card').forEach(function(card){
      var row = card.querySelector('.btn-row');
      if(!row) return;
      var buttons = Array.prototype.slice.call(row.children).filter(function(el){ return el.tagName==='BUTTON'; });
      if(buttons.length <= primaryLabels.length) return;
      var isPrimary = buttons.map(function(b){
        return primaryLabels.some(function(l){ return b.textContent.trim()===l; });
      });
      var secondary = buttons.filter(function(b,i){ return !isPrimary[i]; });
      if(!secondary.length) return;
      row.style.position = 'relative';

      var menu = document.createElement('div');
      menu.className = 'card-more-menu';
      menu.style.cssText = 'display:none;position:absolute;top:100%;inset-inline-start:0;margin-top:6px;background:var(--card);border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow-lift);z-index:20;overflow:hidden;min-width:180px;';

      secondary.forEach(function(b, i){
        b.classList.remove('sm','outline','secondary','accent','danger');
        b.style.cssText = 'display:block;width:100%;text-align:start;background:none;border:none;'
          + (i<secondary.length-1 ? 'border-bottom:1px solid var(--border);' : '')
          + 'padding:11px 14px;font-size:14px;color:var(--text);cursor:pointer;border-radius:0;flex:none;';
        menu.appendChild(b);
      });

      var moreBtn = document.createElement('button');
      moreBtn.type = 'button';
      moreBtn.className = 'btn sm outline';
      moreBtn.textContent = '⋮ المزيد';
      moreBtn.addEventListener('click', function(e){
        e.stopPropagation();
        document.querySelectorAll('.card-more-menu.open').forEach(function(m){
          if(m!==menu){ m.classList.remove('open'); m.style.display='none'; }
        });
        var isOpen = menu.classList.toggle('open');
        menu.style.display = isOpen ? 'block' : 'none';
      });
      row.appendChild(moreBtn);
      row.appendChild(menu);
    });
  }

  if(!window.__cardMoreMenuDocClick){
    window.__cardMoreMenuDocClick = true;
    document.addEventListener('click', function(){
      document.querySelectorAll('.card-more-menu.open').forEach(function(m){
        m.classList.remove('open'); m.style.display='none';
      });
    });
  }

  var origRenderOrdersUI = renderOrders;
  renderOrders = function(){
    origRenderOrdersUI.apply(this, arguments);
    consolidateCardActions('ordersList', ['✏️ تعديل', '📲 فاتورة واتساب']);
  };

  var origRenderCustomersUI = renderCustomers;
  renderCustomers = function(){
    origRenderCustomersUI.apply(this, arguments);
    consolidateCardActions('customersList', ['✏️ تعديل', '➕ طلب جديد']);
  };
})();

/* 18) [ضمان استرجاع دائم] حارس أمان قبل الرفع + نسخ احتياطية سحابية
   بتاريخ منفصلة عن مستند المزامنة الحي — عشان لو حصل أي خطأ (حتى لو
   خطأ مستقبلي غير اللي أصلحناه) يفضل عندك تاريخ نقاط استرجاع تقدر
   ترجع لأي يوم منها بدل ما تعتمد بس على نسخة حية واحدة ممكن تتكتب
   فوقها غلط. */
(function(){
  // أ) قبل أي رفع فعلي، اتأكد إن البيانات المحلية مش أقل بشكل مريب من
  // اللي على السحابة حاليًا — لو كده امنع الرفع بدل ما يحصل استبدال كارثي
  var origPushToCloudSafe = pushToCloud;
  pushToCloud = async function(){
    try{
      if(cloudDb && db && db.cloudSync && db.cloudSync.enabled && db.cloudSync.syncId){
        var ref = cloudDb.collection('workshops').doc(db.cloudSync.syncId);
        var snap = await ref.get();
        if(snap.exists){
          var remote = snap.data() || {};
          var remoteC = (remote.customers||[]).length;
          var remoteO = (remote.orders||[]).length;
          var localC = (db.customers||[]).length;
          var localO = (db.orders||[]).length;
          var suspicious = (remoteC>0 && localC===0) || (remoteO>0 && localO===0)
                         || (remoteC - localC > 5) || (remoteO - localO > 5);
          if(suspicious){
            console.warn('⛔ تم إيقاف الرفع للسحابة وقائيًا — البيانات المحلية أقل بكثير من السحابة (سحابة: '+remoteC+' عميل/'+remoteO+' طلب، جهاز: '+localC+' عميل/'+localO+' طلب).');
            return;
          }
        }
      }
    }catch(e){ return; } // لو التحقق فشل، الأسلم إننا مانرفعش من غير ما نتأكد
    var r = await origPushToCloudSafe.apply(this, arguments);
    scheduleDailyCloudBackup();
    return r;
  };

  // ب) نسخة احتياطية سحابية تلقائية مرة كل يوم، في مستند منفصل بتاريخه
  function scheduleDailyCloudBackup(){
    try{
      if(!cloudDb || !db.cloudSync || !db.cloudSync.enabled || !db.cloudSync.syncId) return;
      var today = new Date().toISOString().slice(0,10);
      if(db.__lastCloudBackupDate === today) return;
      var safeData = JSON.parse(JSON.stringify(db));
      cloudDb.collection('workshops').doc(db.cloudSync.syncId).collection('backups').doc(today).set(safeData)
        .then(function(){
          db.__lastCloudBackupDate = today;
          try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }catch(e){}
        }).catch(function(){});
    }catch(e){}
  }

  // ج) نسخة احتياطية سحابية يدوية فورية
  window.backupNowToCloud = async function(){
    if(!cloudDb || !db.cloudSync || !db.cloudSync.enabled || !db.cloudSync.syncId){
      toast('المزامنة السحابية لازم تكون مفعّلة الأول');
      return;
    }
    try{
      var key = new Date().toISOString().replace(/[:.]/g,'-');
      var safeData = JSON.parse(JSON.stringify(db));
      await cloudDb.collection('workshops').doc(db.cloudSync.syncId).collection('backups').doc(key).set(safeData);
      toast('✅ اتحفظت نسخة احتياطية سحابية دلوقتي');
    }catch(e){
      toast('⚠️ فشل حفظ النسخة الاحتياطية: '+(e && (e.code||e.message)||'خطأ غير معروف'));
    }
  };

  // د) عرض النسخ السحابية السابقة واسترجاع أي واحدة منها
  window.listCloudBackups = async function(){
    if(!cloudDb || !db.cloudSync || !db.cloudSync.enabled || !db.cloudSync.syncId){
      toast('المزامنة السحابية لازم تكون مفعّلة الأول');
      return;
    }
    var box = document.getElementById('cloudBackupsListBox');
    if(!box) return;
    box.innerHTML = '<p class="meta">⏳ جاري التحميل...</p>';
    try{
      var qs = await cloudDb.collection('workshops').doc(db.cloudSync.syncId).collection('backups').orderBy('updatedAt','desc').limit(30).get();
      if(qs.empty){
        box.innerHTML = '<p class="meta">لا توجد نسخ احتياطية سحابية بعد.</p>';
        return;
      }
      var rows = [];
      qs.forEach(function(doc){
        var d = doc.data();
        var custN = (d.customers||[]).length;
        var ordN = (d.orders||[]).length;
        var dt = d.updatedAt ? new Date(d.updatedAt).toLocaleString('ar-EG') : doc.id;
        rows.push('<div class="card" style="padding:10px;margin-bottom:8px;">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">'
          + '<div><b>'+doc.id+'</b><br><span class="meta">'+dt+' — '+custN+' عميل / '+ordN+' طلب</span></div>'
          + '<button class="btn sm outline" onclick="restoreCloudBackup(\''+doc.id+'\')">استرجاع</button>'
          + '</div></div>');
      });
      box.innerHTML = rows.join('');
    }catch(e){
      box.innerHTML = '<p class="meta">⚠️ تعذر تحميل القائمة: '+(e && (e.code||e.message)||'خطأ غير معروف')+'</p>';
    }
  };

  window.restoreCloudBackup = async function(backupId){
    var ok = await appConfirm('هل تريد استرجاع النسخة الاحتياطية بتاريخ '+backupId+'؟ سيتم استبدال كل البيانات الحالية على هذا الجهاز بها.', {okText:'استرجاع', cancelText:'إلغاء', danger:true});
    if(!ok) return;
    try{
      var docSnap = await cloudDb.collection('workshops').doc(db.cloudSync.syncId).collection('backups').doc(backupId).get();
      if(!docSnap.exists){ toast('⚠️ النسخة دي مش موجودة'); return; }
      var restored = docSnap.data();
      var mySettings = db.cloudSync;
      db = restored;
      db.cloudSync = mySettings;
      fillMissingDefaults();
      try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }catch(e){}
      renderAll();
      toast('✅ تم استرجاع النسخة الاحتياطية بنجاح');
    }catch(e){
      toast('⚠️ فشل الاسترجاع: '+(e && (e.code||e.message)||'خطأ غير معروف'));
    }
  };

  // هـ) إضافة قسم النسخ الاحتياطية السحابية تحت كارت المزامنة في الإعدادات
  var origRenderCloudSyncCardBackup = renderCloudSyncCard;
  renderCloudSyncCard = function(){
    origRenderCloudSyncCardBackup.apply(this, arguments);
    var box = document.getElementById('cloudSyncCardWrap');
    if(!box || !(db.cloudSync && db.cloudSync.enabled && db.cloudSync.syncId)) return;
    if(box.querySelector('#cloudBackupsSection')) return; // متتكررش لو اتنادت تاني
    box.insertAdjacentHTML('beforeend', ''
      + '<div id="cloudBackupsSection" style="margin-top:14px;border-top:1px solid var(--border);padding-top:12px;">'
      + '<p class="meta">نسخة احتياطية سحابية يومية تلقائية، منفصلة عن بيانات المزامنة الحية — لو أي مشكلة حصلت، تقدر ترجع لأي يوم سابق من غير ما تعتمد على النسخة الحية بس.</p>'
      + '<div class="btn-row"><button class="btn sm outline" onclick="backupNowToCloud()">🗄️ احفظ نسخة الآن</button>'
      + '<button class="btn sm outline" onclick="listCloudBackups()">📜 عرض النسخ السابقة</button></div>'
      + '<div id="cloudBackupsListBox" style="margin-top:10px;"></div>'
      + '</div>');
  };
})();

/* 19) توليد رمز ربط جديد (تدوير) — لو الرمز القديم اتسرب أو مش مطمّن
   له، بينشئ مساحة مزامنة جديدة، ينقل البيانات ليها، ويوقف الاعتماد
   على الرمز القديم تمامًا من غير ما يمسح بياناته القديمة (احتياط). */
(function(){
  window.rotateCloudSyncCode = async function(){
    if(!db.cloudSync || !db.cloudSync.enabled || !db.cloudSync.syncId){
      toast('لازم تكون المزامنة السحابية مفعّلة الأول');
      return;
    }
    var ok = await appConfirm('هيتم إنشاء رمز ربط جديد ونقل بياناتك الحالية ليه. الرمز القديم مش هيقدر يزامن بيانات جديدة تاني. هل تريد المتابعة؟', {okText:'توليد رمز جديد', cancelText:'إلغاء', danger:true});
    if(!ok) return;
    try{
      var newSyncId = randomSyncId();
      var safeData = JSON.parse(JSON.stringify(db));
      await cloudDb.collection('workshops').doc(newSyncId).set(safeData);
      db.cloudSync.syncId = newSyncId;
      saveDB();
      if(typeof cloudUnsub==='function'){ cloudUnsub(); cloudUnsub=null; }
      initCloudSync();
      renderCloudSyncCard();
      toast('✅ اتعمل رمز ربط جديد — انسخه واحفظه في مكان آمن فورًا');
    }catch(e){
      toast('⚠️ فشل توليد الرمز الجديد: '+(e && (e.code||e.message)||'خطأ غير معروف'));
    }
  };

  var origRenderCloudSyncCardRotate = renderCloudSyncCard;
  renderCloudSyncCard = function(){
    origRenderCloudSyncCardRotate.apply(this, arguments);
    var box = document.getElementById('cloudSyncCardWrap');
    if(!box || !(db.cloudSync && db.cloudSync.enabled && db.cloudSync.syncId)) return;
    if(box.querySelector('#rotateSyncCodeBtn')) return;
    var btn = document.createElement('button');
    btn.id = 'rotateSyncCodeBtn';
    btn.type = 'button';
    btn.className = 'btn sm outline';
    btn.style.marginTop = '10px';
    btn.textContent = '🔄 توليد رمز ربط جديد';
    btn.addEventListener('click', function(){ rotateCloudSyncCode(); });
    box.appendChild(btn);
  };
})();

/* 20) تنبيه في الرئيسية لو النسخة الاحتياطية السحابية اليومية توقفت */
(function(){
  var origRenderHomeAlertsStale = renderHomeAlerts;
  renderHomeAlerts = function(){
    origRenderHomeAlertsStale.apply(this, arguments);
    if(!(db.cloudSync && db.cloudSync.enabled && db.cloudSync.syncId)) return;
    var box = document.getElementById('homeAlerts');
    if(!box) return;
    var last = db.__lastCloudBackupDate;
    var days = last ? Math.round((new Date(todayStr())-new Date(last))/86400000) : null;
    if(days===null || days>=3){
      var msg = days===null
        ? 'لم تُحفظ أي نسخة احتياطية سحابية بعد — افتح الإعدادات واضغط "🗄️ احفظ نسخة الآن".'
        : 'لم تُحفظ نسخة احتياطية سحابية منذ '+days+' يوم — تأكد من اتصال الجهاز بالنت.';
      box.insertAdjacentHTML('beforeend',
        '<div class="alert-banner warn"><span class="ic">☁️</span><div><b>النسخة الاحتياطية السحابية اليومية متأخرة</b>'+msg+'</div></div>');
    }
  };
})();

/* 21) [مستوحى من تطبيق مقاس] عند تسليم طلب فيه مبلغ متبقي، اسأل فورًا
   هل تحب تسجّل الدفعة دلوقتي كمان، بدل ما يكون إجراء منفصل بعدين. */
(function(){
  var origMarkOrderDeliveredBundle = markOrderDelivered;
  markOrderDelivered = async function(orderId){
    origMarkOrderDeliveredBundle.apply(this, arguments);
    var o = db.orders.find(function(x){ return x.id===orderId; });
    if(o){
      var remaining = orderRemaining(o);
      if(remaining>0){
        var ok = await appConfirm('باقي على العميل '+remaining.toLocaleString('ar-EG')+' ج.م. هل تريد تسجيل الدفعة دلوقتي؟', {okText:'تسجيل الدفعة', cancelText:'لاحقًا', danger:false});
        if(ok) openPaymentModal(orderId);
      }
    }
  };
})();

/* 22) أداة دمج العملاء المكررين (نفس رقم الهاتف)
   التطبيق بيتحقق من رقم الهاتف المكرر وقت الحفظ، لكن لو حد تجاهل
   التحذير أو استورد بيانات قديمة، ممكن يتكون عملاء مكررين فعليًا.
   الأداة دي بتكتشفهم وبتسيبك تختار مين تحتفظ بيه، وبتنقل كل الطلبات
   للنسخة المختارة قبل ما تمسح الباقي. */
(function(){
  function findDuplicateCustomers(){
    var byPhone = {};
    (db.customers||[]).forEach(function(c){
      var p = (c.phone||'').trim();
      if(!p) return;
      if(!byPhone[p]) byPhone[p] = [];
      byPhone[p].push(c);
    });
    var dups = [];
    Object.keys(byPhone).forEach(function(p){
      if(byPhone[p].length>1) dups.push(byPhone[p]);
    });
    return dups;
  }

  window.renderDuplicateCustomersUI = function(){
    var box = document.getElementById('duplicateCustomersBox');
    if(!box) return;
    var dups = findDuplicateCustomers();
    window.__dupGroups = dups;
    if(!dups.length){ box.innerHTML = '<p class="meta">مفيش عملاء مكررين حاليًا 👍</p>'; return; }
    box.innerHTML = dups.map(function(group, gi){
      var rows = group.map(function(c,i){
        var ordersCount = db.orders.filter(function(o){ return o.customerId===c.id; }).length;
        return '<label style="display:block;margin:6px 0;"><input type="radio" name="dupKeep'+gi+'" value="'+c.id+'" '+(i===0?'checked':'')+'> '
          + escapeHtml(c.name) + ' <span class="meta">('+ordersCount+' طلب)</span></label>';
      }).join('');
      return '<div class="card" style="padding:10px;margin-bottom:10px;">'
        + '<p class="meta">نفس رقم الهاتف ('+escapeHtml(group[0].phone)+'):</p>'
        + rows
        + '<button class="btn sm outline" style="margin-top:8px;" onclick="mergeDuplicateGroup('+gi+')">🔗 دمج في المختار</button>'
        + '</div>';
    }).join('');
  };

  window.mergeDuplicateGroup = async function(gi){
    var group = (window.__dupGroups||[])[gi];
    if(!group) return;
    var radios = document.getElementsByName('dupKeep'+gi);
    var keepId = null;
    for(var i=0;i<radios.length;i++){ if(radios[i].checked) keepId = radios[i].value; }
    if(!keepId) return;
    var ok = await appConfirm('هيتم نقل كل طلبات باقي النسخ المكررة لهذا العميل، وحذف النسخ التانية نهائيًا. هل أنت متأكد؟', {okText:'دمج', cancelText:'إلغاء', danger:true});
    if(!ok) return;
    group.forEach(function(c){
      if(c.id===keepId) return;
      db.orders.forEach(function(o){ if(o.customerId===c.id) o.customerId = keepId; });
      db.customers = db.customers.filter(function(x){ return x.id!==c.id; });
    });
    logActivity('🔗 دمج عملاء مكررين لنفس الرقم');
    saveDB();
    renderCustomers();
    renderDuplicateCustomersUI();
    toast('✅ تم الدمج بنجاح');
  };

  var origRenderSettingsDup = renderSettings;
  renderSettings = function(){
    origRenderSettingsDup.apply(this, arguments);
    var page = document.getElementById('page-settings');
    if(!page) return;
    if(page.querySelector('#duplicateCustomersCard')) { renderDuplicateCustomersUI(); return; }
    var card = document.createElement('div');
    card.className = 'card';
    card.id = 'duplicateCustomersCard';
    card.innerHTML = '<h3>🔗 دمج عملاء مكررين</h3>'
      + '<p class="meta">بتكتشف تلقائيًا أي عملاء عندهم نفس رقم الهاتف، وتسيبك تدمجهم في نسخة واحدة مع نقل كل طلباتهم.</p>'
      + '<div id="duplicateCustomersBox"></div>';
    page.appendChild(card);
    renderDuplicateCustomersUI();
  };
})();

/* 23) أداة تجميع القياسات المتقاربة (للتقطيع/التنفيذ الدفعي)
   بتجمع الطلبات "قيد العمل" حسب نوع اللبس، وترتبهم حسب قياس الصدر،
   وتقفّلهم في مجموعات لو الفرق بينهم جوه النطاق المسموح — عشان
   المعلم يقدر يقطّع أكتر من قطعة بنفس القالب مرة واحدة. */
(function(){
  function getMeasurements(customerId){
    var c = customerById(customerId);
    if(!c) return null;
    var chest = Number(c.chest);
    if(!chest) return null; // من غير قياس صدر مفيش معنى للتجميع
    return {
      chest: chest,
      waist: Number(c.waist)||null,
      length: Number(c.length)||null,
      sleeve: Number(c.sleeve)||null,
      shoulder: Number(c.shoulder)||null,
      name: c.name
    };
  }

  function orderGarmentType(o){
    if(Array.isArray(o.items) && o.items.length) return o.items[0].type||'';
    return o.type||'';
  }

  function buildClusters(garmentTypeName, tolerance, onlyInProgress){
    var candidates = db.orders.filter(function(o){
      if(onlyInProgress && o.status!=='قيد العمل') return false;
      if(garmentTypeName && orderGarmentType(o)!==garmentTypeName) return false;
      return true;
    }).map(function(o){
      var m = getMeasurements(o.customerId);
      if(!m) return null;
      return {order:o, m:m};
    }).filter(Boolean);

    candidates.sort(function(a,b){ return a.m.chest - b.m.chest; });

    var clusters = [];
    var current = null;
    candidates.forEach(function(item){
      if(current && Math.abs(item.m.chest - current.anchor) <= tolerance){
        current.items.push(item);
      } else {
        current = {anchor:item.m.chest, items:[item]};
        clusters.push(current);
      }
    });
    return clusters.filter(function(c){ return c.items.length>=2; });
  }

  function diffTxt(val, anchor, label){
    if(val===null || val===undefined) return '';
    var d = val - anchor;
    var sign = d>0 ? '+'+d : (d<0 ? d : '=');
    return label+': '+val+' ('+sign+')';
  }

  window.renderMeasurementClusters = function(){
    var box = document.getElementById('clusterResultsBox');
    if(!box) return;
    var type = document.getElementById('clusterGarmentType').value;
    var tol = Number(document.getElementById('clusterTolerance').value)||2;
    var onlyWip = document.getElementById('clusterOnlyWip').checked;
    var clusters = buildClusters(type, tol, onlyWip);
    if(!clusters.length){
      box.innerHTML = '<p class="meta">مفيش مجموعات قياسات متقاربة حاليًا بالمعايير دي.</p>';
      return;
    }
    box.innerHTML = clusters.map(function(cl, ci){
      var base = cl.items[0].m;
      var rows = cl.items.map(function(it){
        var o = it.order, m = it.m;
        var parts = [diffTxt(m.waist, base.waist, 'الخصر'), diffTxt(m.length, base.length, 'الطول'), diffTxt(m.sleeve, base.sleeve, 'الكم'), diffTxt(m.shoulder, base.shoulder, 'الكتف')].filter(Boolean).join(' | ');
        return '<div style="padding:8px 0;border-bottom:1px solid var(--border);">'
          + '<b>'+escapeHtml(m.name)+'</b> — صدر '+m.chest
          + (parts?('<br><span class="meta">'+parts+'</span>'):'')
          + '</div>';
      }).join('');
      return '<div class="card" style="padding:12px;margin-bottom:10px;">'
        + '<p class="meta">مجموعة '+(ci+1)+' — '+cl.items.length+' طلب حول قياس صدر '+base.chest+'</p>'
        + rows + '</div>';
    }).join('');
  };

  window.openMeasurementClusterTool = function(){
    var typeOptions = '<option value="">كل الأنواع</option>' + db.garmentTypes.slice().sort(function(a,b){return a.name.localeCompare(b.name,'ar');}).map(function(g){
      return '<option value="'+escapeHtml(g.name)+'">'+escapeHtml(g.name)+'</option>';
    }).join('');
    openModal(
      '<div class="modal-head"><h3>📐 تجميع القياسات المتقاربة</h3><button class="modal-close" onclick="closeModal()">✕</button></div>'
      + '<p class="meta">بتجمع الطلبات اللي قياساتها قريبة من بعض حسب قياس الصدر، عشان تقدر تقطّع أكتر من قطعة بنفس القالب مرة واحدة.</p>'
      + '<div class="field"><label>نوع اللبس</label><select id="clusterGarmentType">'+typeOptions+'</select></div>'
      + '<div class="field"><label>نطاق التقارب (سم)</label><input id="clusterTolerance" type="number" value="2" min="0" step="0.5"></div>'
      + '<label style="display:flex;align-items:center;gap:6px;margin:8px 0;"><input type="checkbox" id="clusterOnlyWip" checked> بس الطلبات "قيد العمل"</label>'
      + '<button class="btn" onclick="renderMeasurementClusters()">🔎 جمّع دلوقتي</button>'
      + '<div id="clusterResultsBox" style="margin-top:14px;"></div>'
    );
    renderMeasurementClusters();
  };

  var origRenderOrdersCluster = renderOrders;
  renderOrders = function(){
    origRenderOrdersCluster.apply(this, arguments);
    var filters = document.getElementById('orderStatusFilters');
    if(!filters || filters.querySelector('#openClusterToolBtn')) return;
    var btn = document.createElement('button');
    btn.id = 'openClusterToolBtn';
    btn.type = 'button';
    btn.className = 'btn sm outline';
    btn.textContent = '📐 قياسات متقاربة';
    btn.addEventListener('click', function(){ openMeasurementClusterTool(); });
    filters.appendChild(btn);
  };
})();

/* 29-ب) ربط بانر "كسبت X من Y المطلوبين الشهر ده" (صفحة الالتزامات) بـ
   "🎯 الهدف الشهري للإيرادات" (صفحة المالية) — نفس الفلوس (db.payments)
   بيتعرضوا في مكانين من غير ربط؛ هنا بنضيف تنبيه لو الهدف اللي حدده
   صاحب الورشة بنفسه أقل من احتياجه الشخصي الفعلي المحسوب تلقائيًا. لازم
   يترنّدر قبل باتش تجميع البانرات (30) عشان يتلمّ معاهم في نفس الكارت. */
(function(){
  if(typeof renderPersonalAlerts !== 'function') return;
  var origRenderPersonalAlertsGoalLink = renderPersonalAlerts;
  renderPersonalAlerts = function(){
    origRenderPersonalAlertsGoalLink.apply(this, arguments);
    try{
      var box = document.getElementById('personalAlerts');
      if(!box) return;
      if(window.userRole==='receptionist') return;
      if(db.financePassword && !window.financeUnlocked) return; // البيانات محمية، متعرضش رقم الاحتياج هنا
      var goal = Number(db.monthlyRevenueGoal)||0;
      if(goal<=0) return; // لسه مفيش هدف متحدد أصلاً، مفيش داعي للتنبيه
      var prog = typeof monthlyCommitmentProgress==='function' ? monthlyCommitmentProgress() : null;
      if(!prog || prog.requiredMonthly<=0 || goal>=prog.requiredMonthly) return;
      var gap = Math.round(prog.requiredMonthly-goal);
      var banner = document.createElement('div');
      banner.className = 'alert-banner warn';
      banner.innerHTML = '<span class="ic">🎯</span><div><b>هدف الإيرادات اللي حددته في صفحة المالية أقل من احتياجك الشخصي الشهري</b>'
        + 'الهدف: '+goal.toLocaleString('ar-EG')+' ج.م، احتياجك الفعلي: '+Math.round(prog.requiredMonthly).toLocaleString('ar-EG')+' ج.م — فرق '+gap.toLocaleString('ar-EG')+' ج.م.'
        + '<div class="btn-row" style="margin-top:6px;"><button class="btn sm outline" onclick="showPage(\'finance\');setTimeout(function(){var b=document.getElementById(\'monthlyGoalBox\');if(b)b.scrollIntoView({behavior:\'smooth\'});},200)">🎯 مراجعة الهدف</button></div>'
        + '</div>';
      var emptyMsg = box.querySelector(':scope > .empty-msg');
      if(emptyMsg) box.innerHTML = ''; // مفيش تنبيهات تانية، امسح رسالة "مفيش تنبيهات" الوهمية دلوقتي
      if(box.firstChild) box.insertBefore(banner, box.firstChild); else box.appendChild(banner);
    }catch(e){ console.warn('[patches] فشل ربط الهدف الشهري بالتزاماتك الشخصية:', e); }
  };
})();

/* 29-ج) ربط "عملاء تجاوزوا حد المديونية" (تنبيهات الرئيسية) بالتزاماتك
   الشخصية المستحقة قريبًا — بدل رقمين منفصلين ("عندك مديونين" و"قسطك
   مستحق") من غير أي فعل مقترح، بنقترح تتابع مع أكبر مديون فورًا، وبنستخدم
   sendDebtReminder الموجودة بالفعل عشان الفعل يبقى بضغطة واحدة. */
(function(){
  if(typeof renderPersonalAlerts !== 'function') return;
  var origRenderPersonalAlertsDebtLink = renderPersonalAlerts;
  renderPersonalAlerts = function(){
    origRenderPersonalAlertsDebtLink.apply(this, arguments);
    try{
      var box = document.getElementById('personalAlerts');
      if(!box) return;
      if(window.userRole==='receptionist') return;
      if(db.financePassword && !window.financeUnlocked) return;
      if(typeof getCommitmentDueAlerts!=='function' || typeof debtorCustomers!=='function' || typeof sendDebtReminder!=='function') return;
      var dueAlerts = getCommitmentDueAlerts();
      if(!dueAlerts.length) return;
      var debtors = debtorCustomers();
      if(!debtors.length) return;
      var dueTotal = dueAlerts.reduce(function(s,a){ return s+Number(a.c.amount||0); }, 0);
      var topDebtor = debtors[0];
      var banner = document.createElement('div');
      banner.className = 'alert-banner warn';
      banner.innerHTML = '<span class="ic">🔗</span><div><b>عندك '+dueAlerts.length+' قسط مستحق قريب بإجمالي '+Math.round(dueTotal).toLocaleString('ar-EG')+' ج.م، وفي المقابل عندك '+debtors.length+' عميل متجاوز حد المديونية</b>'
        + 'أكبرهم "'+escapeHtml(topDebtor.customer.name)+'" بمبلغ '+Math.round(topDebtor.amount).toLocaleString('ar-EG')+' ج.م — تحصيله ممكن يغطي احتياجك القريب.'
        + '<div class="btn-row" style="margin-top:6px;"><button class="btn sm outline" onclick="sendDebtReminder(\''+topDebtor.customer.id+'\')">💬 ابعتله تذكير دلوقتي</button></div>'
        + '</div>';
      var emptyMsg = box.querySelector(':scope > .empty-msg');
      if(emptyMsg) box.innerHTML = '';
      box.appendChild(banner);
    }catch(e){ console.warn('[patches] فشل ربط المديونين بالتزاماتك المستحقة:', e); }
  };
})();

/* 30) [إعادة تنظيم] تجميع تنبيهات الالتزامات الشخصية في كارت واحد
   قابل للطي بدل حائط بانرات (ممكن توصل لـ8 بانر مرة واحدة). بنسيب
   المنطق الأصلي زي ما هو تمامًا (كل الأزرار والوظائف شغالة)، وبس
   بنغيّر طريقة العرض بعد ما يترندر عادي. */
(function(){
  // [إصلاح] لو core.js المحمّل مفيهوش renderPersonalAlerts (نسخة قديمة)،
  // كان قراية المتغيّر ده مباشرة بتعمل ReferenceError فورًا لحظة تحميل
  // الملف — وده بيوقف تنفيذ كل حاجة بعدها في الملف كله (البنود 31-34
  // بتاعت لوحة الصحة المالية والخريطة السنوية وصندوق الطوارئ والقروض
  // كانت بتضيع فعليًا من غير ما حد يلاحظ ليه). دلوقتي بنتأكد الأول.
  if(typeof renderPersonalAlerts !== 'function'){
    console.warn('[patches] تخطّي تجميع تنبيهات الالتزامات: renderPersonalAlerts مش موجودة في core.js المحمّل.');
    return;
  }
  var origRenderPersonalAlertsCollapse = renderPersonalAlerts;
  renderPersonalAlerts = function(){
    try{
      origRenderPersonalAlertsCollapse.apply(this, arguments);
      var box = document.getElementById('personalAlerts');
      if(!box) return;
      var banners = box.querySelectorAll(':scope > .alert-banner');
      if(banners.length < 2) return; // بانر واحد أو صفر، مفيش داعي نلخّص
      var level = box.querySelector(':scope > .alert-banner.danger') ? 'danger'
                : box.querySelector(':scope > .alert-banner.warn') ? 'warn' : 'good';
      var icon = level==='danger' ? '🔴' : (level==='warn' ? '🟡' : '🟢');
      var inner = box.innerHTML;
      var count = banners.length;
      box.innerHTML = ''
        + '<div class="alert-banner '+level+'" id="personalAlertsSummaryBtn" style="cursor:pointer;">'
        + '<span class="ic">'+icon+'</span><div><b>عندك '+count+' تنبيهات على التزاماتك الشخصية</b>'
        + '<span id="personalAlertsToggleTxt">اضغط لعرض التفاصيل ▾</span></div></div>'
        + '<div id="personalAlertsDetails" style="display:none;">'+inner+'</div>';
      document.getElementById('personalAlertsSummaryBtn').addEventListener('click', function(){
        var details = document.getElementById('personalAlertsDetails');
        var txt = document.getElementById('personalAlertsToggleTxt');
        var open = details.style.display!=='none';
        details.style.display = open ? 'none' : 'block';
        txt.textContent = open ? 'اضغط لعرض التفاصيل ▾' : 'اضغط للإخفاء ▴';
      });
    }catch(e){ console.warn('[patches] فشل تجميع بانرات الالتزامات الشخصية:', e); }
  };
})();

/* 31) لوحة "الصحة المالية الشخصية" — شاشة ملخّصة واحدة بدل التنقل بين
   كذا قسم منفصل عشان تجمع الصورة الكاملة. */
(function(){
  // [إصلاح] كل قيمة بتتحسب لوحدها بـ try/catch: لو دالة معيّنة مش موجودة
  // (زي getCommitmentDueAlerts أو savingsGoalProgress في نسخة core.js أقدم)،
  // بنسيب قيمتها فاضية ونكمل باقي اللوحة، بدل ما اللوحة كلها توقف عن الظهور.
  function safe(fn, fallback){ try{ return fn(); }catch(e){ return fallback; } }

  function calcHealthSnapshot(){
    var r = safe(function(){ return calcRequiredDailyCapacity(); }, {total:0});
    var currentCapacity = Number(db.dailyCapacity)||500;
    var coveragePct = r && r.total>0 ? Math.round((currentCapacity/r.total)*100) : 100;
    var missedCount = (db.missedCommitmentNotices||[]).length;
    var dueSoonCount = safe(function(){ return getCommitmentDueAlerts().length; }, 0);
    // [إصلاح] savingsGoalProgress() اتشالت من core.js (استُبدلت بهدف ادخار
    // بمبلغ مستهدف واحد بدل الشهري: db.savingsGoalTarget + totalSavedAmount()).
    // بنحسب نفس الفكرة (نسبة %) من البيانات الجديدة لو موجودة، وإلا نرجع فاضي.
    var goalProg = safe(function(){
      if(typeof savingsGoalProgress === 'function') return savingsGoalProgress(); // توافق مع نسخ قديمة
      var target = Number(db.savingsGoalTarget)||0;
      if(!target || typeof totalSavedAmount !== 'function') return null;
      var saved = totalSavedAmount();
      return {saved:saved, goal:target, pct:Math.min(100, Math.round(saved/target*100))};
    }, null);
    var ef = safe(function(){ return calcEmergencyFundRunway(); }, null);
    var totalDebt = safe(function(){ return typeof totalRemainingLoansDebt==='function' ? totalRemainingLoansDebt() : 0; }, 0);
    // [إضافة] "اللي ليك عند العملاء" (مستحقات الورشة) و"اللي عليك من قروض"
    // (ديون شخصية) كانوا رقمين منفصلين تمامًا في مكانين مختلفين من التطبيق —
    // صافيهم (وضعك المالي الحقيقي) مكانش ظاهر في أي مكان. لو عندك 20,000 ج.م
    // مستحقة عند عملاء لكن عليك 30,000 ج.م قروض، وضعك الحقيقي سالب حتى لو
    // إحساسك إنك "مستني فلوس" بيدّيك راحة كاذبة.
    var totalOwedToYou = safe(function(){
      var totalFees = (db.orders||[]).reduce(function(s,o){ return s+orderTotal(o); }, 0);
      var totalCollected = (db.payments||[]).reduce(function(s,p){ return s+Number(p.amount||0); }, 0);
      return totalFees-totalCollected;
    }, 0);
    var netPosition = totalOwedToYou - totalDebt;
    return {r:r, currentCapacity:currentCapacity, coveragePct:coveragePct, missedCount:missedCount, dueSoonCount:dueSoonCount, goalProg:goalProg, ef:ef, totalDebt:totalDebt, totalOwedToYou:totalOwedToYou, netPosition:netPosition};
  }

  window.renderFinancialHealthDashboard = function(){
    var box = document.getElementById('financialHealthBox');
    if(!box) return;
    if(db.financePassword && !window.financeUnlocked){ box.innerHTML=''; return; }
    var hasData = (db.commitments||[]).length>0 || (db.houseExpenses||[]).length>0;
    if(!hasData){
      box.innerHTML = '<div class="empty-msg">أضف التزاماتك الشهرية عشان تظهر لوحة الصحة المالية هنا.</div>';
      return;
    }
    var s = calcHealthSnapshot();
    var covColor = s.coveragePct>=100 ? 'var(--primary)' : (s.coveragePct>=70 ? 'var(--warn,#b8860b)' : 'var(--danger)');
    box.innerHTML = ''
      + '<div class="stat-card"><div class="stat-ic">📶</div><div><div class="num" style="color:'+covColor+';">'+s.coveragePct+'%</div><div class="lbl">نسبة تغطية التزاماتك بسعتك الحالية</div></div></div>'
      + '<div class="stat-card '+(s.missedCount>0?'danger':'')+'"><div class="stat-ic">⏮️</div><div><div class="num">'+s.missedCount+'</div><div class="lbl">التزامات فاتك تسجيلها كمدفوعة</div></div></div>'
      + '<div class="stat-card '+(s.dueSoonCount>0?'danger':'')+'"><div class="stat-ic">🔔</div><div><div class="num">'+s.dueSoonCount+'</div><div class="lbl">مستحق خلال 3 أيام أو أقل</div></div></div>'
      + (s.goalProg ? '<div class="stat-card"><div class="stat-ic">🎯</div><div><div class="num">'+s.goalProg.pct+'%</div><div class="lbl">تقدّم هدف الادخار</div></div></div>' : '')
      + (s.ef ? '<div class="stat-card '+(s.ef.months<3?'danger':'')+'"><div class="stat-ic">🧳</div><div><div class="num">'+s.ef.months.toFixed(1)+'</div><div class="lbl">شهر تغطية من صندوق الطوارئ</div></div></div>' : '')
      + (s.totalDebt>0 ? '<div class="stat-card"><div class="stat-ic">🧾</div><div><div class="num">'+Math.round(s.totalDebt).toLocaleString('ar-EG')+'</div><div class="lbl">إجمالي المتبقي على قروضك</div></div></div>' : '')
      + ((s.totalOwedToYou>0 || s.totalDebt>0) ? '<div class="stat-card '+(s.netPosition<0?'danger':'')+'"><div class="stat-ic">📐</div><div><div class="num">'+Math.round(s.netPosition).toLocaleString('ar-EG')+'</div><div class="lbl">صافي وضعك المالي (مستحقاتك عند العملاء − قروضك المتبقية)</div></div></div>' : '');

    // توزيع الالتزامات الحالية بالنوع (شامل مصاريف البيت والقروض) — عشان
    // توضّح "ليه احتياجك اليومي/الشهري بالرقم ده بالظبط"، مش بس رقم إجمالي
    try{
      var byType = {};
      (db.commitments||[]).filter(function(c){ return c.active!==false; }).forEach(function(c){
        var key = c.type||'تانية';
        var share = typeof commitmentMonthlyShare==='function' ? commitmentMonthlyShare(c) : Number(c.amount||0);
        byType[key] = (byType[key]||0) + share;
      });
      if(s.r && s.r.houseTotal>0 && s.r.housePerDay) byType['🏠 بيت'] = s.r.housePerDay*30;
      if(s.r && s.r.loanMonthly>0) byType['💳 قروض'] = s.r.loanMonthly;
      var keys = Object.keys(byType).sort(function(a,b){ return byType[b]-byType[a]; });
      if(keys.length){
        var breakdownBox = document.getElementById('financialHealthTypeBreakdown');
        if(!breakdownBox){
          breakdownBox = document.createElement('div');
          breakdownBox.id = 'financialHealthTypeBreakdown';
          breakdownBox.style.marginTop = '10px';
          box.parentNode.appendChild(breakdownBox);
        }
        breakdownBox.innerHTML = '<div class="meta" style="margin-bottom:4px;">📊 توزيع التزاماتك الشهرية بالنوع:</div>'
          + '<div class="meta">' + keys.map(function(k){
              var icon = (typeof commitmentTypeInfo==='function' && !/^[🏠💳]/.test(k)) ? commitmentTypeInfo(k).icon+' ' : '';
              return icon+k+': '+Math.round(byType[k]).toLocaleString('ar-EG')+' ج.م';
            }).join(' — ') + '</div>';
      }
    }catch(e){ console.warn('[patches] فشل رسم توزيع الالتزامات بالنوع:', e); }
  };

  // [إصلاح] كانت بتدوّر على دالة اسمها renderPersonalCommitments (مش موجودة
  // في core.js أصلاً) فكانت دايمًا بترجع لـ renderFinance غلط. الاسم الصح
  // هو renderPersonalPage، وكمان الكارت لازم يترمي جوّه تاب "نظرة عامة"
  // (#personalTab-overview) مش جوّه #page-personal مباشرة، عشان يظهر
  // ويختفي صح مع تبديل التابات بدل ما يفضل ظاهر فوق كل التابات.
  var hookHealthTarget = typeof renderPersonalPage === 'function' ? 'renderPersonalPage' : 'renderFinance';
  var hookHealthContainerId = hookHealthTarget === 'renderPersonalPage'
    ? (document.getElementById('personalTab-overview') ? 'personalTab-overview' : 'page-personal')
    : 'page-finance';
  var origRenderFinanceHealth = window[hookHealthTarget];
  window[hookHealthTarget] = function(){
    origRenderFinanceHealth.apply(this, arguments);
    try{
      var page = document.getElementById(hookHealthContainerId);
      if(!page) return;
      if(!page.querySelector('#financialHealthCard')){
        var card = document.createElement('div');
        card.className = 'card';
        card.id = 'financialHealthCard';
        card.innerHTML = '<h3>📋 لوحة الصحة المالية الشخصية</h3><div id="financialHealthBox" class="grid-cards"></div>';
        page.appendChild(card);
      }
      renderFinancialHealthDashboard();
    }catch(e){ console.warn('[patches] فشل رسم لوحة الصحة المالية:', e); }
  };
})();

/* 32) خريطة سنوية للالتزامات — الـ12 شهر الجايين وإجمالي كل شهر،
   شامل الالتزامات الموسمية (كل 3/6/12 شهر) — عشان تشوف "الشهر
   التقيل" قبل ما يجيلك بفترة كافية تستعد له. */
(function(){
  // [إصلاح] لو core.js المحمّل نسخة قديمة مفيهاش currentYM/isCommitmentCycleMonth/
  // addMonthsYM (دوال الالتزامات غير الشهرية)، بنرجع لحساب مبسّط بيفترض إن
  // كل الالتزامات شهرية عادية (intervalMonths=1)، بدل ما نطلع Error ونوقف
  // الخريطة وكل حاجة بعدها في السلسلة (صندوق الطوارئ + القروض).
  var hasCycleHelpers = typeof currentYM==='function' && typeof isCommitmentCycleMonth==='function' && typeof addMonthsYM==='function';

  function fallbackAddMonthsYM(ym, n){
    var parts = ym.split('-'); var y = Number(parts[0]); var m = Number(parts[1]);
    var total = (y*12+(m-1))+n;
    var ny = Math.floor(total/12); var nm = (total%12)+1;
    return ny+'-'+(nm<10?'0':'')+nm;
  }

  function calcAnnualCommitmentsMap(){
    var nowYM = hasCycleHelpers ? currentYM() : todayStr().slice(0,7);
    var housePerDay = 0;
    try{ housePerDay = calcRequiredDailyCapacity().housePerDay||0; }catch(e){}
    var houseMonthly = housePerDay*30;
    var loanMonthly = (db.personalLoans||[]).filter(function(l){ return l.active!==false; })
      .reduce(function(s,l){ return s+Number(l.monthlyPayment||0); }, 0);
    var loanSchedule = typeof calcLoanMonthlyByMonthIndex==='function' ? calcLoanMonthlyByMonthIndex() : null;
    var months = [];
    for(var i=0;i<12;i++){
      var ym = hasCycleHelpers ? addMonthsYM(nowYM, i) : fallbackAddMonthsYM(nowYM, i);
      var byType = {};
      var commitmentsTotal = 0;
      (db.commitments||[]).filter(function(c){
        if(c.active===false) return false;
        return hasCycleHelpers ? isCommitmentCycleMonth(c, ym) : true; // بدون الدوال دي منقدرش نحدد دورة الالتزامات غير الشهرية، فبنعتبرها شهرية عادية
      }).forEach(function(c){
        var amt = Number(c.amount||0); // القيمة كاملة في شهر استحقاقها الفعلي (مش موزّعة) عشان يبان "الشهر التقيل" بوضوح
        var key = c.type||'تانية';
        byType[key] = (byType[key]||0) + amt;
        commitmentsTotal += amt;
      });
      // نصيب القروض للشهر ده تحديدًا — بيهبط ويوصل صفر لما القرض يتسدد
      // بدل ما يفضل ثابت طول الـ12 شهر حتى بعد ما ينتهي فعليًا
      var loanForMonth = loanSchedule ? loanSchedule[i] : loanMonthly;
      if(houseMonthly>0) byType['🏠 بيت'] = houseMonthly;
      if(loanForMonth>0) byType['💳 قروض'] = loanForMonth;
      months.push({ym:ym, commitmentsTotal:commitmentsTotal, houseMonthly:houseMonthly, loanMonthly:loanForMonth, byType:byType, total:commitmentsTotal+houseMonthly+loanForMonth});
    }
    return months;
  }

  window.renderAnnualCommitmentsMap = function(){
    var box = document.getElementById('annualCommitmentsMapBox');
    if(!box) return;
    if(db.financePassword && !window.financeUnlocked){ box.innerHTML=''; return; }
    var months = calcAnnualCommitmentsMap();
    var avg = months.reduce(function(s,m){return s+m.total;},0)/months.length;
    box.innerHTML = months.map(function(m, i){
      var label = new Date(m.ym+'-01').toLocaleDateString('ar-EG',{month:'long', year:'numeric'});
      var heavy = avg>0 && m.total > avg*1.2;
      var typeKeys = Object.keys(m.byType).sort(function(a,b){ return m.byType[b]-m.byType[a]; });
      var breakdown = typeKeys.length ? '<div class="meta" style="padding-right:2px;">'
        + typeKeys.map(function(k){
            var icon = (typeof commitmentTypeInfo==='function' && !/^[🏠💳]/.test(k)) ? commitmentTypeInfo(k).icon+' ' : '';
            return icon+k+': '+Math.round(m.byType[k]).toLocaleString('ar-EG')+' ج.م';
          }).join(' — ')
        + '</div>' : '';
      return '<div style="padding:8px 0;'+(i<months.length-1?'border-bottom:1px solid var(--border);':'')+'">'
        + '<div class="row" style="'+(i===0?'font-weight:800;':'')+'">'
        + '<span>'+(i===0?'📍 ':'')+label+(heavy?' <span class="meta">🔥 شهر تقيل</span>':'')+'</span>'
        + '<b style="color:'+(heavy?'var(--danger)':'inherit')+';">'+Math.round(m.total).toLocaleString('ar-EG')+' ج.م</b>'
        + '</div>'
        + breakdown
        + '</div>';
    }).join('');
  };

  // [إصلاح] نفس مشكلة القسم اللي فوق: اسم الدالة الصح renderPersonalPage
  // (مش renderPersonalCommitments اللي مش موجودة أصلاً)، والخريطة دي جدول
  // تفصيلي فمكانها الطبيعي تاب "التقارير" (#personalTab-reports) جنب
  // التقرير الشهري، مش جوّه #page-personal مباشرة برّه كل التابات.
  var hookMapTarget = typeof renderPersonalPage === 'function' ? 'renderPersonalPage' : 'renderFinance';
  var hookMapContainerId = hookMapTarget === 'renderPersonalPage'
    ? (document.getElementById('personalTab-reports') ? 'personalTab-reports' : 'page-personal')
    : 'page-finance';
  var origRenderFinanceAnnualMap = window[hookMapTarget];
  window[hookMapTarget] = function(){
    origRenderFinanceAnnualMap.apply(this, arguments);
    try{
      var page = document.getElementById(hookMapContainerId);
      if(!page) return;
      if(!page.querySelector('#annualCommitmentsMapCard')){
        var card = document.createElement('div');
        card.className = 'card';
        card.id = 'annualCommitmentsMapCard';
        card.innerHTML = '<h3>🗓️ خريطة سنوية للالتزامات</h3><p class="meta">إجمالي الالتزامات المتوقعة (شاملة الموسمية) لكل شهر من الـ12 شهر الجايين، عشان تشوف الشهر التقيل بدري.</p><div id="annualCommitmentsMapBox"></div>';
        page.appendChild(card);
      }
      renderAnnualCommitmentsMap();
    }catch(e){ console.warn('[patches] فشل رسم الخريطة السنوية للالتزامات:', e); }
  };
})();

/* 33) صندوق الطوارئ — لو الدخل وقف فجأة، هتقدر تعيش قد إيه؟
   بيقارن رصيد مدخرات (بتدخله يدويًا) بإجمالي التزاماتك الشهرية. */
(function(){
  window.calcEmergencyFundRunway = function(){
    var savings = Number(db.emergencyFundBalance)||0;
    var monthlyCommitments = (db.commitments||[]).filter(function(c){ return c.active!==false; })
      .reduce(function(s,c){ return s+(Number(c.amount||0)/(Number(c.intervalMonths)||1)); }, 0);
    var loanMonthly = (db.personalLoans||[]).filter(function(l){ return l.active!==false; })
      .reduce(function(s,l){ return s+Number(l.monthlyPayment||0); }, 0);
    var houseMonthly = calcRequiredDailyCapacity().housePerDay*30;
    var totalMonthly = monthlyCommitments + loanMonthly + houseMonthly;
    if(totalMonthly<=0) return null;
    return {savings:savings, totalMonthly:totalMonthly, months:savings/totalMonthly};
  };

  window.saveEmergencyFundBalance = function(){
    var input = document.getElementById('emergencyFundInput');
    if(!input) return;
    db.emergencyFundBalance = Number(input.value)||0;
    saveDB();
    renderEmergencyFundCard();
    renderFinancialHealthDashboard();
    toast('✅ اتحفظ رصيد صندوق الطوارئ');
  };

  window.renderEmergencyFundCard = function(){
    var box = document.getElementById('emergencyFundBox');
    if(!box) return;
    if(db.financePassword && !window.financeUnlocked){ box.innerHTML=''; return; }
    var ef = calcEmergencyFundRunway();
    var status = !ef ? {label:'', color:''}
      : ef.months>=6 ? {label:'قوي 💪', color:'var(--primary)'}
      : ef.months>=3 ? {label:'مقبول 👍', color:'var(--warn,#b8860b)'}
      : ef.months>=1 ? {label:'ضعيف ⚠️', color:'var(--danger)'}
      : {label:'خطر 🚨', color:'var(--danger)'};
    box.innerHTML = ''
      + '<div class="field"><label>رصيد مدخراتك الحالي (ج.م)</label><input id="emergencyFundInput" type="number" value="'+(db.emergencyFundBalance||0)+'"></div>'
      + '<button class="btn sm outline" onclick="saveEmergencyFundBalance()">💾 حفظ الرصيد</button>'
      + (ef ? ('<div class="meta" style="margin-top:10px;line-height:1.8;">لو الدخل وقف تمامًا النهاردة، مدخراتك هتغطي احتياجاتك الشهرية لمدة تقريبية: '
          + '<b style="color:'+status.color+';font-size:16px;"> '+ef.months.toFixed(1)+' شهر</b> ('+status.label+')'
          + '<br><span class="meta">إجمالي احتياجك الشهري: '+Math.round(ef.totalMonthly).toLocaleString('ar-EG')+' ج.م</span>'
          + '<br><span class="meta">المعدل الصحي المتعارف عليه: 3-6 شهور على الأقل</span></div>')
        : '<p class="meta" style="margin-top:8px;">أضف التزاماتك الشهرية الأول عشان نحسبلك المدة.</p>')
      + '<div class="meta" style="margin-top:8px;">ℹ️ الرصيد هنا منفصل عن "🎯 هدف الادخار" — تقدر ترحّل رصيد أي هدف ادخار تحققه هنا كإضافة لصندوق الطوارئ.</div>';
  };

  // [إصلاح] نفس المشكلة: الاسم الصح renderPersonalPage. صندوق الطوارئ
  // فيه إدخال بيانات (رصيد المدخرات) فمكانه الطبيعي تاب "القائمة"
  // (#personalTab-list) جنب هدف الادخار والالتزامات، مش برّه التابات.
  var hookEfTarget = typeof renderPersonalPage === 'function' ? 'renderPersonalPage' : 'renderFinance';
  var hookEfContainerId = hookEfTarget === 'renderPersonalPage'
    ? (document.getElementById('personalTab-list') ? 'personalTab-list' : 'page-personal')
    : 'page-finance';
  var origRenderFinanceEmergency = window[hookEfTarget];
  window[hookEfTarget] = function(){
    origRenderFinanceEmergency.apply(this, arguments);
    try{
      var page = document.getElementById(hookEfContainerId);
      if(!page) return;
      if(!page.querySelector('#emergencyFundCard')){
        var card = document.createElement('div');
        card.className = 'card';
        card.id = 'emergencyFundCard';
        card.innerHTML = '<h3>🧳 صندوق الطوارئ</h3><div id="emergencyFundBox"></div>';
        page.appendChild(card);
      }
      renderEmergencyFundCard();
    }catch(e){ console.warn('[patches] فشل رسم كارت صندوق الطوارئ:', e); }
  };
})();

/* 34) قروض شخصية بجدول سداد — مختلفة عن الالتزام الشهري العادي: ليها
   مبلغ أصلي، رصيد متبقي بينزل مع كل دفعة، ونسبة سداد واضحة. */
(function(){
  // [إصلاح] كلاس progress-track/progress-fill في index.html معرّف بس جوّه
  // .alert-banner، فشريط تقدّم سداد القرض هنا (جوّه .card عادي) كان
  // بيتعرض من غير أي شكل (بلا لون ولا ارتفاع). بنضيف تعريف عام مرة واحدة.
  if(!document.getElementById('rcLoanProgressStyle')){
    var styleTag = document.createElement('style');
    styleTag.id = 'rcLoanProgressStyle';
    styleTag.textContent = '.progress-track{background:rgba(0,0,0,0.08);border-radius:8px;height:8px;overflow:hidden;}'
      + '.progress-fill{background:var(--primary);height:100%;}';
    document.head.appendChild(styleTag);
  }

  function ensureLoansArray(){ if(!db.personalLoans) db.personalLoans=[]; return db.personalLoans; }

  // أيام متبقية لاستحقاق قسط القرض الشهري (زي commitmentDaysUntilDue بالظبط،
  // بس للقروض) — null لو مفيش يوم استحقاق متسجل أو القرض متسدد بالكامل
  function loanDaysUntilDue(l){
    if(!l.dueDay || l.active===false) return null;
    var today = todayStr();
    var parts = today.split('-').map(Number);
    var y = parts[0], m = parts[1];
    var lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    var day = Math.min(Number(l.dueDay), lastDay);
    var due = y+'-'+String(m).padStart(2,'0')+'-'+String(day).padStart(2,'0');
    return Math.round((new Date(due)-new Date(today))/86400000);
  }

  // إجمالي المديونية المتبقية على كل القروض النشطة (رقم واحد يلخّص "قد إيه لسه عليك")
  window.totalRemainingLoansDebt = function(){
    return ensureLoansArray().filter(function(l){ return l.active!==false; })
      .reduce(function(s,l){ return s+Number(l.remainingBalance||0); }, 0);
  };

  // جدول سداد القروض شهر بشهر (12 شهر جايين، index 0 = الشهر الحالي)، مراعيًا
  // إن القرض بيوقف يساهم في الالتزام الشهري بمجرد ما يتسدد بالكامل — بدل ما
  // نفترضه ثابت طول السنة زي ما كان بيحصل في الخريطة السنوية قبل كده
  window.calcLoanMonthlyByMonthIndex = function(){
    var loans = ensureLoansArray().filter(function(l){ return l.active!==false && Number(l.monthlyPayment)>0; });
    var perMonth = new Array(12).fill(0);
    loans.forEach(function(l){
      var remaining = Number(l.remainingBalance)||0;
      var pay = Number(l.monthlyPayment)||0;
      for(var i=0;i<12 && remaining>0;i++){
        var thisMonth = Math.min(pay, remaining);
        perMonth[i] += thisMonth;
        remaining -= thisMonth;
      }
    });
    return perMonth;
  };

  window.addPersonalLoan = function(){
    var desc = document.getElementById('loanDescInput').value.trim();
    var principal = Number(document.getElementById('loanPrincipalInput').value)||0;
    var monthlyPayment = Number(document.getElementById('loanMonthlyInput').value)||0;
    var dueDay = Number(document.getElementById('loanDueDayInput').value)||null;
    if(!desc || principal<=0){ toast('اكتب وصف القرض والمبلغ الأصلي على الأقل'); return; }
    ensureLoansArray().push({id:uid(), desc:desc, principal:principal, remainingBalance:principal, monthlyPayment:monthlyPayment, dueDay:dueDay, lastPaidMonth:null, startDate:todayStr(), active:true, payments:[]});
    saveDB();
    document.getElementById('loanDescInput').value='';
    document.getElementById('loanPrincipalInput').value='';
    document.getElementById('loanMonthlyInput').value='';
    document.getElementById('loanDueDayInput').value='';
    renderPersonalLoans();
    toast('✅ اتضاف القرض');
  };

  window.recordLoanPayment = async function(loanId){
    var loan = ensureLoansArray().find(function(l){ return l.id===loanId; });
    if(!loan) return;
    var suggested = loan.monthlyPayment || loan.remainingBalance;
    var input = prompt('قيمة الدفعة (ج.م):', suggested);
    if(input===null) return;
    var amount = Number(input)||0;
    if(amount<=0) return;
    loan.remainingBalance = Math.max(0, loan.remainingBalance - amount);
    loan.payments = loan.payments||[];
    loan.payments.push({date:todayStr(), amount:amount});
    loan.lastPaidMonth = typeof currentYM==='function' ? currentYM() : todayStr().slice(0,7);
    if(loan.remainingBalance<=0){ loan.active=false; logActivity('🏁 انتهى سداد قرض: '+loan.desc); }
    saveDB();
    renderPersonalLoans();
    if(typeof renderFinancialHealthDashboard==='function') renderFinancialHealthDashboard();
    toast(loan.active ? '✅ اتسجلت الدفعة' : '🎉 مبروك، اتسدد القرض بالكامل!');
  };

  window.deletePersonalLoan = async function(loanId){
    var ok = await appConfirm('هل تريد حذف هذا القرض نهائيًا؟', {okText:'حذف', cancelText:'إلغاء', danger:true});
    if(!ok) return;
    db.personalLoans = ensureLoansArray().filter(function(l){ return l.id!==loanId; });
    saveDB();
    renderPersonalLoans();
    if(typeof renderFinancialHealthDashboard==='function') renderFinancialHealthDashboard();
  };

  window.renderPersonalLoans = function(){
    var box = document.getElementById('personalLoansBox');
    if(!box) return;
    if(db.financePassword && !window.financeUnlocked){ box.innerHTML=''; return; }
    var loans = ensureLoansArray().slice().sort(function(a,b){ return (b.active?1:0)-(a.active?1:0); });
    var nowYM = typeof currentYM==='function' ? currentYM() : todayStr().slice(0,7);
    box.innerHTML = loans.length ? loans.map(function(l){
      var pct = l.principal>0 ? Math.round(((l.principal-l.remainingBalance)/l.principal)*100) : 0;
      var dueLine = '';
      if(l.active!==false && l.dueDay){
        var paidThisMonth = l.lastPaidMonth===nowYM;
        var diff = loanDaysUntilDue(l);
        if(!paidThisMonth && diff!=null){
          if(diff<0) dueLine = '<div class="meta" style="color:var(--danger);margin-top:4px;">⏰ متأخر '+Math.abs(diff)+' يوم عن يوم استحقاقه ('+l.dueDay+' من الشهر)</div>';
          else if(diff<=3) dueLine = '<div class="meta" style="color:var(--danger);margin-top:4px;">🔔 قسط القرض مستحق '+(diff===0?'النهاردة':diff===1?'بكرة':'خلال '+diff+' أيام')+'</div>';
        } else if(paidThisMonth){
          dueLine = '<div class="meta" style="margin-top:4px;">✅ مدفوع الشهر ده</div>';
        }
      }
      return '<div class="card" style="padding:12px;margin-bottom:10px;'+(!l.active?'opacity:.65;':'')+'">'
        + '<div class="row"><h3>'+escapeHtml(l.desc)+(!l.active?' <span class="meta">(مسدّد بالكامل ✅)</span>':'')+'</h3>'
        + '<button class="btn sm outline" onclick="deletePersonalLoan(\''+l.id+'\')">🗑️</button></div>'
        + '<div class="meta">المبلغ الأصلي: '+Number(l.principal).toLocaleString('ar-EG')+' ج.م — المتبقي: <b>'+Number(l.remainingBalance).toLocaleString('ar-EG')+' ج.م</b>'+(l.dueDay?' — 📅 يستحق يوم '+l.dueDay+' من كل شهر':'')+'</div>'
        + '<div class="progress-track" style="margin-top:6px;"><div class="progress-fill" style="width:'+pct+'%;"></div></div>'
        + '<div class="meta" style="margin-top:4px;">نسبة السداد: '+pct+'%</div>'
        + dueLine
        + (l.active ? '<button class="btn sm outline" style="margin-top:8px;" onclick="recordLoanPayment(\''+l.id+'\')">💵 تسجيل دفعة</button>' : '')
        + '</div>';
    }).join('') : '<p class="meta">لا توجد قروض مسجّلة.</p>';
  };

  // [إصلاح] نفس المشكلة: الاسم الصح renderPersonalPage. القروض فيها إدخال
  // وتشغيل يومي (إضافة قرض، تسجيل دفعات) فمكانها الطبيعي تاب "القائمة".
  var hookLoansTarget = typeof renderPersonalPage === 'function' ? 'renderPersonalPage' : 'renderFinance';
  var hookLoansContainerId = hookLoansTarget === 'renderPersonalPage'
    ? (document.getElementById('personalTab-list') ? 'personalTab-list' : 'page-personal')
    : 'page-finance';
  var origRenderFinanceLoans = window[hookLoansTarget];
  window[hookLoansTarget] = function(){
    origRenderFinanceLoans.apply(this, arguments);
    try{
      var page = document.getElementById(hookLoansContainerId);
      if(!page) return;
      if(!page.querySelector('#personalLoansCard')){
        var card = document.createElement('div');
        card.className = 'card';
        card.id = 'personalLoansCard';
        card.innerHTML = '<h3>💳 قروض شخصية بجدول سداد</h3>'
          + '<div class="field"><label>وصف القرض</label><input id="loanDescInput" type="text" placeholder="مثال: قرض سيارة"></div>'
          + '<div class="field"><label>المبلغ الأصلي (ج.م)</label><input id="loanPrincipalInput" type="number"></div>'
          + '<div class="field"><label>القسط الشهري المعتاد (ج.م) <span class="meta">— اختياري</span></label><input id="loanMonthlyInput" type="number"></div>'
          + '<div class="field"><label>يوم استحقاق القسط من الشهر <span class="meta">— اختياري</span></label><input id="loanDueDayInput" type="number" min="1" max="31" placeholder="مثال: 10"></div>'
          + '<button class="btn sm outline" onclick="addPersonalLoan()">➕ إضافة قرض</button>'
          + '<div id="personalLoansBox" style="margin-top:14px;"></div>';
        page.appendChild(card);
      }
      renderPersonalLoans();
    }catch(e){ console.warn('[patches] فشل رسم كارت القروض الشخصية:', e); }
  };
})();

/* 35) تجميع الأيقونات الخمسة (قفل / كثافة العرض / تباين / عرض للعميل / وضع ليلي)
   في قائمة منسدلة واحدة بدل ما تتكدس جنب بعض في الشريط العلوي. الأزرار
   الأصلية بتفضل موجودة في الـ DOM (مخفية بس) عشان كل المنطق اللي بيقرأ
   حالتها (applyDarkMode, toggleDisplayMode...) يفضل شغال زي ما هو. */
(function(){
  function setup(){
    if(document.getElementById('topbarMenuBtn')) return; // امنع التكرار
    var holder = document.querySelector('header.topbar > div:last-child');
    if(!holder) return;

    var themeBtn    = document.getElementById('themeToggleBtn');
    var displayBtn  = document.getElementById('displayModeBtn');
    var contrastBtn = document.getElementById('contrastToggleBtn');
    var densityBtn  = document.getElementById('densityToggleBtn');
    var lockBtn     = holder.querySelector('.small-link');

    var originals = [themeBtn, displayBtn, contrastBtn, densityBtn, lockBtn].filter(Boolean);
    if(originals.length < 5) return; // استنى لحد ما كل الأزرار الخمسة تتعمل

    // نخبّي الأزرار الأصلية بدل ما نمسحها، عشان أي كود تاني بيرجع لها بالـ id يفضل شغال
    originals.forEach(function(b){ b.style.display = 'none'; });

    if(!document.getElementById('topbarMenuStyle')){
      var styleTag = document.createElement('style');
      styleTag.id = 'topbarMenuStyle';
      styleTag.textContent =
        '.topbar-menu-wrap{display:inline-flex;}'+
        /* [إصلاح] الشريط العلوي فيه overflow:hidden على الموبايل عشان يمنع
           طفح محتواه، وده كان بيقص القائمة المنسدلة لو اتحطت جوّه الشريط
           كعنصر position:absolute. الحل: القائمة بقت position:fixed ومتضافة
           لـ body مباشرة (بره الشريط العلوي بالكامل)، ومكانها بيتحسب
           بالجافاسكريبت وقت الفتح (شوف openPanel) عشان متتقصش. */
        '.topbar-menu-panel{position:fixed;min-width:220px;max-width:calc(100vw - 24px);'+
          'background:var(--card,#fff);color:var(--text,#1a1a1a);border-radius:12px;'+
          'box-shadow:0 12px 30px rgba(0,0,0,.28);padding:6px;z-index:9999;display:none;}'+
        '.topbar-menu-panel.open{display:block;}'+
        '.topbar-menu-item{display:flex;align-items:center;gap:10px;width:100%;'+
          'background:none;border:0;text-align:right;padding:10px 12px;border-radius:8px;'+
          'font-size:14px;font-weight:700;cursor:pointer;color:inherit;}'+
        '.topbar-menu-item:active,.topbar-menu-item:hover{background:rgba(31,109,87,0.1);}'+
        '.topbar-menu-item .tmi-icon{font-size:16px;width:20px;text-align:center;flex-shrink:0;}'+
        '.topbar-menu-item .tmi-state{margin-inline-start:auto;font-size:11px;color:var(--muted,#888);}';
      document.head.appendChild(styleTag);
    }

    var wrap = document.createElement('div');
    wrap.className = 'topbar-menu-wrap';

    var toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'theme-toggle-btn';
    toggleBtn.id = 'topbarMenuBtn';
    toggleBtn.setAttribute('aria-label', 'المزيد من الخيارات');
    toggleBtn.textContent = '⋮';

    var panel = document.createElement('div');
    panel.className = 'topbar-menu-panel';
    panel.id = 'topbarMenuPanel';

    function itemDefs(){
      return [
        {
          icon: themeBtn.textContent.trim() || '🌙',
          label: 'الوضع الليلي',
          state: (document.documentElement.getAttribute('data-theme')==='dark') ? 'مفعّل' : 'متوقف',
          run: function(){ themeBtn.click(); }
        },
        {
          icon: '👁️',
          label: 'وضع عرض للعميل',
          state: displayBtn.classList.contains('active-display-mode') ? 'مفعّل' : 'متوقف',
          run: function(){ displayBtn.click(); }
        },
        {
          icon: '◐',
          label: 'تباين عالٍ',
          state: document.documentElement.classList.contains('high-contrast') ? 'مفعّل' : 'متوقف',
          run: function(){ contrastBtn.click(); }
        },
        {
          icon: densityBtn.textContent.trim() || '☰',
          label: 'كثافة العرض',
          state: document.documentElement.classList.contains('compact-view') ? 'مضغوط' : 'مريح',
          run: function(){ densityBtn.click(); }
        },
        {
          icon: '🔒',
          label: 'قفل التطبيق',
          state: '',
          run: function(){ lockBtn.click(); }
        }
      ];
    }

    function renderPanel(){
      panel.innerHTML = '';
      itemDefs().forEach(function(def){
        var item = document.createElement('button');
        item.type = 'button';
        item.className = 'topbar-menu-item';
        item.innerHTML =
          '<span class="tmi-icon">'+def.icon+'</span>'+
          '<span>'+def.label+'</span>'+
          (def.state ? '<span class="tmi-state">'+def.state+'</span>' : '');
        item.onclick = function(){
          closePanel();
          def.run();
        };
        panel.appendChild(item);
      });
    }

    function positionPanel(){
      var rect = toggleBtn.getBoundingClientRect();
      // نحط القائمة الأول عشان نقدر نقيس عرضها الفعلي (offsetWidth) بعد ما اتملت
      var panelWidth = panel.offsetWidth || 220;
      var left = rect.left; // نفس بداية الزر افتراضيًا
      // لو هتخرج بره يمين الشاشة، نلزقها بحافة الشاشة اليمين بمسافة أمان 12px
      if(left + panelWidth > window.innerWidth - 12){
        left = window.innerWidth - panelWidth - 12;
      }
      if(left < 12) left = 12;
      var top = rect.bottom + 8;
      var maxTop = window.innerHeight - 12;
      panel.style.left = left + 'px';
      panel.style.top = Math.min(top, maxTop) + 'px';
    }

    function openPanel(){
      renderPanel();
      panel.classList.add('open');
      positionPanel(); // تحسب المكان بعد ما تتملى وتظهر عشان offsetWidth يبقى صحيح
      document.addEventListener('click', onOutsideClick, true);
      window.addEventListener('scroll', positionPanel, true);
      window.addEventListener('resize', positionPanel);
    }
    function closePanel(){
      panel.classList.remove('open');
      document.removeEventListener('click', onOutsideClick, true);
      window.removeEventListener('scroll', positionPanel, true);
      window.removeEventListener('resize', positionPanel);
    }
    function onOutsideClick(e){
      if(!wrap.contains(e.target) && !panel.contains(e.target)) closePanel();
    }

    toggleBtn.onclick = function(e){
      e.stopPropagation();
      if(panel.classList.contains('open')) closePanel();
      else openPanel();
    };

    wrap.appendChild(toggleBtn);
    holder.appendChild(wrap);
    document.body.appendChild(panel); // بره الشريط العلوي خالص عشان overflow:hidden متأثرش عليها
  }

  // الأزرار التانية بتتضاف بترتيب مختلف في الملف، فبنستنى لحد ما تخلص كلها
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(setup, 0); });
  } else {
    setTimeout(setup, 0);
  }
})();

})(); /* نهاية الملف — إغلاق الـ IIFE الرئيسية */



/* ===================== feature-capacity-reminders.js ===================== */
/* ============================================================
   ملف رقعة جديد منفصل (مش هيتضاف داخل core.js ولا patches.js)
   يحتوي على ميزتين فقط، كل ميزة في IIFE مستقلة:
   1) جدولة سعة الورشة القادمة (10 أيام) في الصفحة الرئيسية
   2) تذكير (يدوي بضغطة واحدة، أو جماعي) لأصحاب الطلبات المتأخرة عبر واتساب
   ملحوظة: renderHome بيتلف مرة واحدة بس هنا لكل الميزتين مع بعض
   (تعلمنا من تجربة renderOrders اللي كانت متلفوفة مرتين بالغلط)
   ============================================================ */
(function(){
  if(window.__capacityRemindersLoaded) return;
  window.__capacityRemindersLoaded = true;

  /* ---------- 1) جدولة السعة القادمة ---------- */
  function buildCapacityScheduleHtml(){
    var capacity = Number(db.dailyCapacity)||500;
    var days = [];
    var base = new Date();
    for(var i=0;i<10;i++){
      var day = new Date(base.getFullYear(), base.getMonth(), base.getDate()+i);
      var key = day.toISOString().slice(0,10);
      var value = db.orders.filter(function(o){
        return o.status!=='تم التسليم' && o.dateDelivery===key;
      }).reduce(function(s,o){ return s + orderTotal(o); }, 0);
      var pct = capacity>0 ? Math.round((value/capacity)*100) : 0;
      days.push({key:key, value:value, pct:pct});
    }

    var overDays = days.filter(function(d){ return d.pct>100; });
    var summary = overDays.length>0
      ? '<div class="alert-banner danger" style="margin-bottom:10px;"><span class="ic">⚠️</span><div>'
        + 'عندك <b>'+overDays.length+'</b> يوم من أصل 10 أيام جايين فوق طاقتك اليومية ('+capacity.toLocaleString('ar-EG')+' ج.م). '
        + 'فكّر تأجل استلام طلبات جديدة لتلك الأيام أو تزود الطاقة اليومية من الإعدادات.</div></div>'
      : '<div class="meta" style="margin-bottom:8px;">طاقتك اليومية الحالية: '+capacity.toLocaleString('ar-EG')+' ج.م — تقدر تغيّرها من الإعدادات.</div>';

    var rows = days.map(function(d){
      var color = d.pct>100 ? 'var(--danger)' : (d.pct>=70 ? '#C89B2C' : 'var(--ok)');
      var barPct = Math.min(d.pct, 100);
      return '<div style="margin-bottom:9px;">'
        + '<div class="meta" style="display:flex;justify-content:space-between;">'
        +   '<span>'+fmtDate(d.key)+'</span>'
        +   '<span>'+d.value.toLocaleString('ar-EG')+' / '+capacity.toLocaleString('ar-EG')+' ج.م ('+d.pct+'%)</span>'
        + '</div>'
        + '<div style="background:var(--stitch,#e5e0d5);border-radius:6px;height:8px;overflow:hidden;">'
        +   '<div style="width:'+barPct+'%;height:100%;background:'+color+';"></div>'
        + '</div>'
        + '</div>';
    }).join('');

    return summary + rows;
  }

  function ensureCapacityWidget(){
    if(document.getElementById('widget-capacity')) return;
    var container = document.getElementById('homeWidgetsContainer');
    if(!container) return;
    var wrap = document.createElement('div');
    wrap.id = 'widget-capacity';
    wrap.className = 'home-widget';
    wrap.innerHTML = '<div class="section-title">📊 جدولة السعة القادمة (10 أيام)</div><div id="capacityScheduleBox"></div>';
    var lateWidget = document.getElementById('widget-late');
    if(lateWidget && lateWidget.parentNode===container){
      container.insertBefore(wrap, lateWidget);
    } else {
      container.appendChild(wrap);
    }
  }

  function renderCapacityWidget(){
    ensureCapacityWidget();
    var box = document.getElementById('capacityScheduleBox');
    if(box) box.innerHTML = buildCapacityScheduleHtml();
  }

  /* ---------- 2) تذكير الطلبات المتأخرة ---------- */
  function lateOrdersList(){
    return db.orders.filter(isOverdue).sort(function(a,b){
      return (a.dateDelivery||'').localeCompare(b.dateDelivery||'');
    });
  }

  window.sendLateOrderReminder = function(orderId){
    var o = db.orders.find(function(x){ return x.id===orderId; });
    if(!o) return;
    var c = customerById(o.customerId);
    if(!c || !c.phone){ toast('لا يوجد رقم هاتف مسجل لهذا العميل'); return; }
    var phone = c.phone.replace(/[^0-9]/g,'');
    if(phone.indexOf('0')===0) phone = '2'+phone;
    var msg = 'تذكير من '+(db.workshopName||'ورشة تفصيل الجلابيب')+' 🧵\n'
      + 'حضرتك، طلبك ('+orderTypeLabel(o)+') كان المفروض يتسلم في '+fmtDate(o.dateDelivery)+' ولسه متأخر شوية.\n'
      + 'تقدر تمر تستلمه في أقرب وقت يناسبك 🙏';
    openExternalLink('https://wa.me/'+phone+'?text='+encodeURIComponent(msg));
    o.lastReminderSentAt = todayStr();
    saveDB();
    logActivity('🔔 إرسال تذكير تأخير لـ '+c.name);
    renderLateOrdersWithReminders();
  };

  window.sendAllLateReminders = function(){
    var today = todayStr();
    var candidates = lateOrdersList().filter(function(o){
      var c = customerById(o.customerId);
      return c && c.phone && o.lastReminderSentAt!==today;
    });
    if(candidates.length===0){ toast('مفيش طلبات متأخرة محتاجة تذكير دلوقتي'); return; }
    appConfirm('هيتفتح '+candidates.length+' رسالة واتساب واحدة ورا التانية، تحب تكمل؟', {okText:'إرسال', danger:false}).then(function(ok){
      if(!ok) return;
      var i = 0;
      function next(){
        if(i>=candidates.length) return;
        window.sendLateOrderReminder(candidates[i].id);
        i++;
        setTimeout(next, 700);
      }
      next();
    });
  };

  function renderLateOrdersWithReminders(){
    var container = document.getElementById('homeLate');
    if(!container) return;
    var late = lateOrdersList();
    var today = todayStr();

    container.innerHTML = late.length ? late.map(function(o){
      var c = customerById(o.customerId);
      var already = o.lastReminderSentAt===today;
      var hasPhone = c && c.phone;
      return '<div class="card" style="border-right-color:var(--danger)">'
        + '<div class="row"><h3 class="name-row">'+avatarChip(c?c.name:'؟')+(c?escapeHtml(c.name):'عميل محذوف')+' - '+escapeHtml(orderTypeLabel(o))+'</h3><span class="tag-late-text">متأخر ⏰</span></div>'
        + '<div class="meta">كان يجب التسليم في: '+fmtDate(o.dateDelivery)+'</div>'
        + (already ? '<div class="meta" style="color:var(--ok);">✅ اتبعت تذكير النهاردة</div>' : '')
        + '<div class="btn-row">'
        +   (hasPhone
              ? '<button class="btn sm outline" onclick="sendLateOrderReminder(\''+o.id+'\')">🔔 إرسال تذكير</button>'
              : '<span class="meta">مفيش رقم هاتف مسجل</span>')
        + '</div></div>';
    }).join('') : '<div class="empty-msg">لا توجد طلبات متأخرة 👍</div>';

    var existingBar = document.getElementById('lateRemindAllBar');
    var needReminder = late.filter(function(o){
      var c = customerById(o.customerId);
      return c && c.phone && o.lastReminderSentAt!==today;
    });
    var lateWidget = document.getElementById('widget-late');
    if(needReminder.length>0 && lateWidget){
      if(!existingBar){
        existingBar = document.createElement('div');
        existingBar.id = 'lateRemindAllBar';
        existingBar.className = 'alert-banner danger';
        existingBar.style.marginBottom = '10px';
        var title = lateWidget.querySelector('.section-title');
        if(title && title.nextSibling){
          lateWidget.insertBefore(existingBar, title.nextSibling);
        } else {
          lateWidget.insertBefore(existingBar, lateWidget.firstChild);
        }
      }
      existingBar.innerHTML = '<span class="ic">🔔</span><div>عندك <b>'+needReminder.length+'</b> طلب متأخر لسه ما اتبعتلوش تذكير النهاردة. '
        + '<button class="btn sm accent" style="margin-top:6px;" onclick="sendAllLateReminders()">إرسال تذكير للكل</button></div>';
    } else if(existingBar){
      existingBar.remove();
    }
  }

  /* ---------- لفة واحدة فقط لـ renderHome، للميزتين مع بعض ---------- */
  var origRenderHome = renderHome;
  renderHome = function(){
    origRenderHome.apply(this, arguments);
    renderCapacityWidget();
    renderLateOrdersWithReminders();
  };
})();


/* ===================== feature-today-focus.js ===================== */
/* ============================================================
   ملف رقعة جديد منفصل (مش هيتضاف داخل core.js ولا patches.js ولا
   feature-capacity-reminders.js) — بيتحمّل هو آخر واحد، وكل ميزة
   جوه IIFE مستقلة عن التانية، بنفس أسلوب feature-capacity-reminders.js:

   1) ودجت "📌 مطلوب اليوم" على الرئيسية: بتجمع في مكان واحد الطلبات
      المتأخرة/المستحقة النهاردة + العملاء المديونين + الطلبات الجاهزة
      اللي لسه محتاجة إشعار واتساب — بدل ما تدور في أكتر من قسم.
   2) تحديد أكتر من طلب "قيد العمل" من شاشة الطلبات (قائمة) وتحويلهم
      كلهم لـ "جاهز للتسليم" بضغطة واحدة.
   3) طباعة كل تذاكر التقطيع لطلبات النهاردة (اللي استلمتها النهاردة)
      في نافذة طباعة واحدة بدل ما تفتح كل طلب لوحده.
   4) رسالة واتساب جماعية لكل عميل طلبه "جاهز للتسليم" ولسه ما اتبعتلوش
      إشعار النهاردة، بالتتابع (زي فكرة تذكيرات التأخير بالظبط).
   5) بطاقة "🩺 فحص وتشخيص تلقائي" في الإعدادات: فحص سلامة بيانات
      الورشة (طلبات يتيمة، أرقام سالبة، تكرار بيانات...) + فحص إن
      أهم دوال البرنامج شغالة فعلاً (يكشف لو ملف رقعة فشل يتحمّل).
      (ملحوظة صدق: الفحص ده منطق ثابت شغال محليًا في الجهاز فورًا،
      مش استدعاء ذكاء اصطناعي حي من جوه التطبيق نفسه — الفحص
      الحقيقي بالذكاء الاصطناعي لكل كود البرنامج تم عمل مرة يدويًا
      وقت كتابة هذا الملف، مش حاجة تتكرر أوتوماتيك جوه تطبيق العميل).
   ============================================================ */
(function(){
  if(window.__todayFocusLoaded) return;
  window.__todayFocusLoaded = true;

  /* ============================================================
     1) ودجت "📌 مطلوب اليوم"
     ============================================================ */
  function readyToNotifyList(){
    var today = todayStr();
    return db.orders.filter(function(o){
      return o.status==='جاهز للتسليم' && o.readyNotifiedAt!==today;
    });
  }

  function computeTodayFocusData(){
    var today = todayStr();
    var late = db.orders.filter(isOverdue);
    var dueToday = db.orders.filter(function(o){
      return o.status!=='تم التسليم' && o.dateDelivery===today;
    });
    var debtMap = {};
    db.orders.forEach(function(o){
      var rem = orderRemaining(o);
      if(rem<=0) return;
      if(!debtMap[o.customerId]) debtMap[o.customerId] = {remaining:0, orders:0};
      debtMap[o.customerId].remaining += rem;
      debtMap[o.customerId].orders += 1;
    });
    var debts = Object.keys(debtMap).map(function(cid){
      return {c:customerById(cid), remaining:debtMap[cid].remaining, orders:debtMap[cid].orders};
    }).filter(function(r){ return r.c; }).sort(function(a,b){ return b.remaining-a.remaining; });

    var readyToNotify = readyToNotifyList().filter(function(o){
      var c = customerById(o.customerId);
      return c && c.phone;
    });

    return {late:late, dueToday:dueToday, debts:debts, readyToNotify:readyToNotify};
  }

  function ensureTodayFocusWidget(){
    if(document.getElementById('widget-today-focus')) return;
    var container = document.getElementById('homeWidgetsContainer');
    if(!container) return;
    var wrap = document.createElement('div');
    wrap.id = 'widget-today-focus';
    wrap.className = 'home-widget';
    wrap.innerHTML = '<div class="section-title">📌 مطلوب اليوم</div><div id="todayFocusBox"></div>';
    container.insertBefore(wrap, container.firstChild); // فوق كل الودجتات التانية، أول حاجة تتشاف
  }

  window.renderTodayFocusWidget = function(){
    ensureTodayFocusWidget();
    var box = document.getElementById('todayFocusBox');
    if(!box) return;
    var d = computeTodayFocusData();

    if(!d.late.length && !d.dueToday.length && !d.debts.length && !d.readyToNotify.length){
      box.innerHTML = '<div class="empty-msg">مفيش حاجة محتاجة قرار عاجل النهاردة 🎉</div>';
      return;
    }

    var html = '';

    if(d.late.length){
      html += '<div class="alert-banner danger" style="margin-bottom:8px;"><span class="ic">⏰</span><div><b>'+d.late.length+' طلب متأخر فعلاً</b>يستاهل تتابعه الأول قبل أي حاجة تانية.</div></div>';
    }
    if(d.dueToday.length){
      html += '<div class="meta" style="margin-bottom:10px;">📅 <b>'+d.dueToday.length+'</b> طلب معاده تسليمه النهاردة بالظبط.</div>';
    }

    if(d.debts.length){
      var debtTotal = d.debts.reduce(function(s,r){ return s+r.remaining; }, 0);
      html += '<div class="meta" style="margin-bottom:6px;">🪙 <b>'+d.debts.length+'</b> عميل عليهم مديونية بإجمالي <b>'+Math.round(debtTotal).toLocaleString('ar-EG')+'</b> ج.م</div>';
      html += d.debts.slice(0,5).map(function(r){
        return '<div class="row" style="padding:5px 0;">'
          + '<span>'+escapeHtml(r.c.name)+' <span class="meta">('+r.orders+' طلب)</span></span>'
          + '<span style="display:flex;gap:6px;align-items:center;">'
          +   '<b style="color:var(--danger);">'+Math.round(r.remaining).toLocaleString('ar-EG')+' ج.م</b>'
          +   (r.c.phone ? '<button class="btn sm outline" style="padding:4px 8px;" onclick="sendDebtReminder(\''+r.c.id+'\')">💬</button>' : '')
          + '</span></div>';
      }).join('');
      if(d.debts.length>5){
        html += '<div class="meta">و'+(d.debts.length-5)+' عميل تاني... التفاصيل الكاملة من شاشة "المالية"</div>';
      }
    }

    if(d.readyToNotify.length){
      html += '<div class="meta" style="margin:10px 0 6px;">📲 <b>'+d.readyToNotify.length+'</b> طلب جاهز للتسليم لسه ما اتبعتش إشعار بيه النهاردة.</div>'
        + '<button class="btn sm accent" onclick="sendAllReadyPickupReminders()">📲 إرسال إشعار الجاهزية للكل</button>';
    }

    box.innerHTML = html;
  };

  var origRenderHomeTodayFocus = renderHome;
  renderHome = function(){
    origRenderHomeTodayFocus.apply(this, arguments);
    renderTodayFocusWidget();
  };

  /* ============================================================
     4) إشعار جاهزية واتساب (فردي + جماعي)
     ============================================================ */
  window.sendReadyPickupReminder = function(orderId){
    var o = db.orders.find(function(x){ return x.id===orderId; });
    if(!o) return;
    var c = customerById(o.customerId);
    if(!c || !c.phone){ toast('لا يوجد رقم هاتف مسجل لهذا العميل'); return; }
    var phone = c.phone.replace(/[^0-9]/g,'');
    if(phone.indexOf('0')===0) phone = '2'+phone;
    var msg = (db.workshopName||'ورشة تفصيل الجلابيب')+' 🧵\n'
      + 'حضرتك، طلبك ('+orderTypeLabel(o)+') بقى جاهز للاستلام ✅\n'
      + 'في انتظار حضرتك في أقرب وقت يناسبك 🙏';
    openWhatsAppChat(phone, msg);
    o.readyNotifiedAt = todayStr();
    saveDB();
    logActivity('📲 إرسال إشعار جاهزية لـ '+c.name);
    renderTodayFocusWidget();
  };

  window.sendAllReadyPickupReminders = function(){
    var candidates = readyToNotifyList().filter(function(o){
      var c = customerById(o.customerId);
      return c && c.phone;
    });
    if(!candidates.length){ toast('مفيش طلبات جاهزة محتاجة إشعار دلوقتي'); return; }
    appConfirm('هيتفتح '+candidates.length+' رسالة واتساب واحدة ورا التانية لعملاء طلباتهم جاهزة، تحب تكمل؟', {okText:'إرسال', danger:false}).then(function(ok){
      if(!ok) return;
      var i = 0;
      function next(){
        if(i>=candidates.length) return;
        window.sendReadyPickupReminder(candidates[i].id);
        i++;
        setTimeout(next, 700);
      }
      next();
    });
  };

  /* ============================================================
     2) تحديد جماعي لطلبات "قيد العمل" وتحويلها لـ "جاهز للتسليم"
     (شغالة على عرض القائمة بس، مش الكانبان)
     ============================================================ */
  var bulkSelectedIds = {}; // {orderId: true}

  function bulkSelectedCount(){
    return Object.keys(bulkSelectedIds).length;
  }

  function extractOrderIdFromCard(card){
    var btn = card.querySelector('button[onclick^="openOrderModal("]');
    if(!btn) return null;
    var m = /openOrderModal\('([^']+)'\)/.exec(btn.getAttribute('onclick')||'');
    return m ? m[1] : null;
  }

  function onBulkCheckboxChange(id, checked){
    if(checked) bulkSelectedIds[id] = true;
    else delete bulkSelectedIds[id];
    renderBulkStatusBar();
  }

  function ensureBulkStatusBar(){
    var existing = document.getElementById('bulkStatusBar');
    if(existing) return existing;
    var list = document.getElementById('ordersList');
    if(!list || !list.parentNode) return null;
    var bar = document.createElement('div');
    bar.id = 'bulkStatusBar';
    bar.className = 'alert-banner warn';
    bar.style.display = 'none';
    bar.style.marginBottom = '10px';
    list.parentNode.insertBefore(bar, list);
    return bar;
  }

  function renderBulkStatusBar(){
    var bar = ensureBulkStatusBar();
    if(!bar) return;
    var n = bulkSelectedCount();
    if(n===0){
      bar.style.display = 'none';
      bar.innerHTML = '';
      return;
    }
    bar.style.display = '';
    bar.innerHTML = '<span class="ic">✅</span><div>محدد حاليًا <b>'+n+'</b> طلب. '
      + '<button class="btn sm accent" style="margin-top:6px;" onclick="applyBulkReadyStatus()">✔️ تحويل الكل لـ "جاهز للتسليم"</button> '
      + '<button class="btn sm outline" style="margin-top:6px;" onclick="clearBulkSelection()">✕ إلغاء التحديد</button></div>';
  }

  window.clearBulkSelection = function(){
    bulkSelectedIds = {};
    renderOrders();
  };

  window.applyBulkReadyStatus = function(){
    var ids = Object.keys(bulkSelectedIds);
    if(!ids.length) return;
    appConfirm('هيتم تحويل '+ids.length+' طلب من "قيد العمل" لحالة "جاهز للتسليم" دفعة واحدة، تحب تكمل؟', {okText:'تحويل', danger:false}).then(function(ok){
      if(!ok) return;
      var snapshots = [];
      ids.forEach(function(id){
        var o = db.orders.find(function(x){ return x.id===id; });
        if(!o || o.status!=='قيد العمل') return;
        snapshots.push({id:id, status:o.status, updatedAt:o.updatedAt});
        o.status = 'جاهز للتسليم';
        o.updatedAt = Date.now();
      });
      if(!snapshots.length){
        toast('التحديد بقى مش صالح للتحويل (ممكن حالة الطلبات دي اتغيرت)');
        bulkSelectedIds = {};
        renderOrders();
        return;
      }
      logActivity('✅ تحويل '+snapshots.length+' طلب دفعة واحدة لحالة "جاهز للتسليم"');
      setUndo('تحويل '+snapshots.length+' طلب لـ جاهز للتسليم', function(){
        snapshots.forEach(function(s){
          var o = db.orders.find(function(x){ return x.id===s.id; });
          if(o){ o.status = s.status; o.updatedAt = s.updatedAt; }
        });
        saveDB();
        renderOrders();
        renderHome();
      });
      bulkSelectedIds = {};
      saveDB();
      renderOrders();
      renderHome();
      toast('✅ تم تحويل '+snapshots.length+' طلب لحالة "جاهز للتسليم"');
    });
  };

  function augmentOrdersListWithBulkSelect(){
    var list = document.getElementById('ordersList');
    if(!list) return;
    var validIds = {};
    var cards = list.querySelectorAll('.card[data-status]');
    cards.forEach(function(card){
      if(card.getAttribute('data-status')!=='قيد العمل') return;
      var id = extractOrderIdFromCard(card);
      if(!id) return;
      validIds[id] = true;
      if(card.querySelector('.bulkChk')) {
        var existingChk = card.querySelector('.bulkChk');
        existingChk.checked = !!bulkSelectedIds[id];
        return;
      }
      var label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:6px;cursor:pointer;';
      var chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.className = 'bulkChk';
      chk.style.cssText = 'width:18px;height:18px;';
      chk.checked = !!bulkSelectedIds[id];
      chk.addEventListener('change', function(){ onBulkCheckboxChange(id, chk.checked); });
      var span = document.createElement('span');
      span.className = 'meta';
      span.textContent = 'تحديد للتحويل الجماعي';
      label.appendChild(chk);
      label.appendChild(span);
      card.insertBefore(label, card.firstChild);
    });
    // تنظيف أي تحديد لطلب بقى مش "قيد العمل" أو اتشال من القائمة
    Object.keys(bulkSelectedIds).forEach(function(id){
      if(!validIds[id]) delete bulkSelectedIds[id];
    });
    renderBulkStatusBar();
  }

  var origRenderOrdersBulk = renderOrders;
  renderOrders = function(){
    origRenderOrdersBulk.apply(this, arguments);
    augmentOrdersListWithBulkSelect();
  };

  /* ============================================================
     3) طباعة كل تذاكر تقطيع طلبات النهاردة دفعة واحدة
     ============================================================ */
  window.printTodayCuttingTickets = function(){
    var today = todayStr();
    var todays = db.orders.filter(function(o){ return o.dateReceived===today; });
    if(!todays.length){ toast('لا يوجد طلبات استلمتها النهاردة عشان تطبع تذاكرها'); return; }

    var labels = todays.map(function(o, idx){
      var c = customerById(o.customerId);
      var shortId = o.id.slice(-5).toUpperCase();
      var pageBreak = idx < todays.length-1 ? 'page-break-after:always;' : '';
      return '<div class="label" style="'+pageBreak+'">'
        + '<div style="font-size:10.5px;color:#888;margin-bottom:2px;">'+escapeHtml(db.workshopName||'ورشة تفصيل الجلابيب')+'</div>'
        + '<h1>🧵 '+escapeHtml(c?c.name:'عميل')+'</h1>'
        + '<div class="row"><span>النوع</span><b>'+escapeHtml(orderTypeLabel(o))+'</b></div>'
        + '<div class="row"><span>الاستلام</span><b>'+fmtDate(o.dateReceived)+'</b></div>'
        + '<div class="row"><span>التسليم</span><b>'+fmtDate(o.dateDelivery)+'</b></div>'
        + '<div class="code">#'+shortId+'</div>'
        + '</div>';
    }).join('');

    var html = '<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>تذاكر تقطيع اليوم</title>'
      + '<style>'
      + '@page{ size:80mm 50mm; margin:4mm; }'
      + 'body{font-family:Tahoma,Arial,sans-serif;color:#111;margin:0;padding:0;}'
      + '.label{border:2px dashed #1F6D57;border-radius:10px;padding:10px 12px;margin:6px;}'
      + '.label h1{font-size:16px;margin:0 0 6px;color:#1F6D57;}'
      + '.label .row{display:flex;justify-content:space-between;font-size:12.5px;margin:3px 0;}'
      + '.label .row b{font-weight:700;}'
      + '.label .code{margin-top:6px;text-align:center;font-size:18px;font-weight:900;letter-spacing:2px;border-top:1px dashed #ccc;padding-top:6px;}'
      + '</style></head><body>'+labels+'</body></html>';

    openPrintWindow(html, 'تذاكر_تقطيع_'+today);
    toast('🖨️ جاري تجهيز '+todays.length+' تذكرة تقطيع للطباعة دفعة واحدة');
  };

  // بنضيف الزرار جوه شريط فلاتر الطلبات، بنفس أسلوب زرار "قياسات متقاربة" الموجود
  var origRenderOrdersPrintBtn = renderOrders;
  renderOrders = function(){
    origRenderOrdersPrintBtn.apply(this, arguments);
    var filters = document.getElementById('orderStatusFilters');
    if(!filters || filters.querySelector('#printTodayTicketsBtn')) return;
    var btn = document.createElement('button');
    btn.id = 'printTodayTicketsBtn';
    btn.type = 'button';
    btn.className = 'btn sm outline';
    btn.textContent = '🖨️ تذاكر تقطيع اليوم دفعة واحدة';
    btn.addEventListener('click', function(){ printTodayCuttingTickets(); });
    filters.appendChild(btn);
  };

  /* ============================================================
     5) بطاقة الفحص والتشخيص التلقائي (في الإعدادات)
     ============================================================ */
  function checkCoreFunctionsHealth(){
    var required = ['renderHome','renderOrders','renderCustomers','saveDB','openModal','customerById','orderTotal'];
    return required.filter(function(name){
      try{ return typeof eval(name)!=='function'; }
      catch(e){ return true; }
    });
  }

  function runDataIntegrityCheck(){
    var issues = []; // {msg, actionHtml}

    // طلبات يتيمة (عميلها محذوف)
    var orphanOrders = db.orders.filter(function(o){ return !customerById(o.customerId); });
    if(orphanOrders.length){
      issues.push({
        title: '🧩 '+orphanOrders.length+' طلب مرتبط بعميل محذوف',
        detail: 'الطلبات دي بقت "يتيمة" وممكن تسبب أرقام غلط في التقارير. تقدر تراجعها وتحذفها لو مش محتاجها.',
        rows: orphanOrders.slice(0,8).map(function(o){
          return '<div class="row" style="padding:4px 0;"><span>طلب #'+o.id.slice(-5).toUpperCase()+' — '+escapeHtml(orderTypeLabel(o)||'')+'</span>'
            + '<button class="btn sm danger" style="padding:4px 8px;" onclick="deleteOrder(\''+o.id+'\')">🗑️ حذف</button></div>';
        }).join('')
      });
    }

    // دفعات مرتبطة بطلب محذوف
    var orphanPayments = (db.payments||[]).filter(function(p){ return !db.orders.some(function(o){ return o.id===p.orderId; }); });
    if(orphanPayments.length){
      issues.push({
        title: '💳 '+orphanPayments.length+' دفعة مسجلة على طلب مش موجود',
        detail: 'ممكن يكون الطلب اتحذف قبل كده من غير ما دفعاته تتحذف معاه، وده ممكن يزوّد أرقام "إجمالي المحصّل" في المالية بشكل غير دقيق.',
        rows: ''
      });
    }

    // أرقام سالبة في الطلبات
    var negativeOrders = db.orders.filter(function(o){
      return (Number(o.extra)||0)<0 || (Number(o.materialCost)||0)<0 || (Number(o.paid)||0)<0;
    });
    if(negativeOrders.length){
      issues.push({
        title: '➖ '+negativeOrders.length+' طلب فيه قيمة رقمية سالبة (مصاريف/خامة/مدفوع)',
        detail: 'قيمة سالبة هنا غالبًا خطأ إدخال وبتأثر على حساب الأرباح.',
        rows: '<button class="btn sm accent" onclick="fixNegativeOrderValues()">🔧 تصفير القيم السالبة دي</button>'
      });
    }

    // طلب مدفوع أكتر من إجماليه
    var overpaidOrders = db.orders.filter(function(o){ return (Number(o.paid)||0) > orderTotal(o)+0.01; });
    if(overpaidOrders.length){
      issues.push({
        title: '💰 '+overpaidOrders.length+' طلب المدفوع فيه أكبر من إجماليه',
        detail: 'يستاهل مراجعة يدوية — يمكن خصم اتضاف بعد التحصيل، أو غلطة كتابة.',
        rows: overpaidOrders.slice(0,6).map(function(o){
          var c = customerById(o.customerId);
          return '<div class="row" style="padding:4px 0;"><span>'+escapeHtml(c?c.name:'عميل محذوف')+'</span>'
            + '<button class="btn sm outline" style="padding:4px 8px;" onclick="closeModal();openOrderModal(\''+o.id+'\')">✏️ فتح ومراجعة</button></div>';
        }).join('')
      });
    }

    // أرقام هواتف عملاء مكررة
    var phoneMap = {};
    db.customers.forEach(function(c){
      var p = (c.phone||'').replace(/[^0-9]/g,'');
      if(!p) return;
      if(!phoneMap[p]) phoneMap[p] = [];
      phoneMap[p].push(c);
    });
    var dupPhoneGroups = Object.keys(phoneMap).map(function(p){ return phoneMap[p]; }).filter(function(g){ return g.length>1; });
    if(dupPhoneGroups.length){
      issues.push({
        title: '📞 '+dupPhoneGroups.length+' رقم هاتف مسجل لأكتر من عميل',
        detail: 'ممكن يكون نفس العميل اتسجل مرتين بالغلط.',
        rows: dupPhoneGroups.slice(0,6).map(function(g){
          return '<div class="meta" style="padding:4px 0;">'+g.map(function(c){ return escapeHtml(c.name); }).join(' / ')+'</div>';
        }).join('')
      });
    }

    return issues;
  }

  window.fixNegativeOrderValues = function(){
    var fixed = 0;
    db.orders.forEach(function(o){
      ['extra','materialCost','paid'].forEach(function(f){
        if((Number(o[f])||0) < 0){ o[f] = 0; fixed++; }
      });
    });
    if(!fixed){ toast('مفيش قيم سالبة لتصفيرها'); return; }
    saveDB();
    logActivity('🔧 تصفير '+fixed+' قيمة سالبة في بيانات الطلبات (فحص تلقائي)');
    toast('✅ تم تصفير '+fixed+' قيمة سالبة');
    renderSystemHealthCard();
  };

  window.runSystemHealthCheck = function(){
    renderSystemHealthCard();
    toast('تم تحديث نتيجة الفحص');
  };

  function ensureSystemHealthCard(){
    var anchorInput = document.getElementById('workshopNameInput');
    if(!anchorInput) return null;
    var card = document.getElementById('systemHealthCard');
    if(card) return card;
    card = document.createElement('div');
    card.id = 'systemHealthCard';
    card.className = 'card';
    card.innerHTML = '<h3 style="margin-top:0;">🩺 فحص وتشخيص تلقائي</h3>'
      + '<p class="meta" style="margin-top:-6px;">فحص محلي فوري لسلامة بيانات الورشة (طلبات يتيمة، أرقام غلط، تكرار بيانات...) ولتشغيل أهم دوال البرنامج، عشان تكتشف أي مشكلة بدري قبل ما تأثر على أرقامك.</p>'
      + '<div id="systemHealthBox"></div>'
      + '<button class="btn sm outline" style="margin-top:10px;" onclick="runSystemHealthCheck()">🔄 إعادة الفحص</button>';
    var anchorCard = anchorInput.closest('.card') || anchorInput.closest('section') || anchorInput.parentElement;
    if(anchorCard && anchorCard.parentNode){
      anchorCard.parentNode.insertBefore(card, anchorCard.nextSibling);
    } else {
      anchorInput.parentElement.appendChild(card);
    }
    return card;
  }

  window.renderSystemHealthCard = function(){
    ensureSystemHealthCard();
    var box = document.getElementById('systemHealthBox');
    if(!box) return;

    var missingFns = checkCoreFunctionsHealth();
    var issues = runDataIntegrityCheck();

    var html = '';
    if(missingFns.length){
      html += '<div class="alert-banner danger" style="margin-bottom:10px;"><span class="ic">⚠️</span><div><b>تحذير: '+missingFns.length+' دالة أساسية مش شغالة</b>'
        + '('+missingFns.join('، ')+') — يمكن ملف من ملفات البرنامج فشل يتحمّل. جرّب تعمل تحديث/إغلاق وفتح للتطبيق.</div></div>';
    } else {
      html += '<div class="meta" style="color:var(--ok);margin-bottom:10px;">✅ كل دوال البرنامج الأساسية شغالة طبيعي.</div>';
    }

    if(!issues.length){
      html += '<div class="empty-msg">لا توجد مشاكل بيانات مكتشفة حاليًا 🎉</div>';
    } else {
      html += issues.map(function(iss){
        return '<div class="card" style="padding:10px 12px;margin-bottom:8px;border-right-color:var(--warn);">'
          + '<b>'+iss.title+'</b>'
          + '<div class="meta" style="margin:4px 0 6px;">'+iss.detail+'</div>'
          + (iss.rows||'')
          + '</div>';
      }).join('');
    }

    box.innerHTML = html;
  };

  var origSettingsRenderForHealth = null;
  if(typeof renderSettings==='function'){
    origSettingsRenderForHealth = renderSettings;
    renderSettings = function(){
      origSettingsRenderForHealth.apply(this, arguments);
      renderSystemHealthCard();
    };
  } else {
    // لو دالة renderSettings مش موجودة بالاسم ده، بنستخدم renderInvoicePreviewCard
    // كمرساة لأننا شفنا إنها بتتنفذ عند فتح صفحة الإعدادات
    var origInvoicePreviewForHealth = renderInvoicePreviewCard;
    renderInvoicePreviewCard = function(){
      origInvoicePreviewForHealth.apply(this, arguments);
      renderSystemHealthCard();
    };
  }
})();


/* ===================== feature-visual-refresh.js ===================== */
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


/* ===================== feature-personal-overview.js ===================== */
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


/* ===================== feature-personal-controls.js ===================== */
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


/* ===================== feature-inventory.js ===================== */
/* ============================================================
   feature-inventory.js
   مرحلة 3 من التحديث الشامل — إدارة مخزون بسيطة (قيمة مالية
   إجمالية بس، مفيش تتبّع بالصنف/المتر حسب الاختيار)، مربوطة
   بالطلبات: كل طلب فيه "تكلفة الخامة" (حقل موجود بالفعل)
   بيتخصم تلقائي من رصيد المخزون وقت إنشاء الطلب، ولو الطلب
   اتعدّل أو اتحذف الرصيد بيتعدّل معاه بالفرق عشان الرقم يفضل
   دقيق. ملف مستقل، مش بيلمس core.js ولا patches.js.
   ============================================================ */
(function(){

  function ensureInventoryDefaults(){
    if(typeof db.inventoryValue !== 'number') db.inventoryValue = 0;
    if(!Array.isArray(db.inventoryLog)) db.inventoryLog = [];
  }

  function logInventory(type, amount, note){
    ensureInventoryDefaults();
    db.inventoryLog.unshift({id:uid(), type, amount, note:note||'', date:todayStr(), ts:Date.now()});
    if(db.inventoryLog.length>100) db.inventoryLog = db.inventoryLog.slice(0,100);
  }

  /* ---------- خصم/إرجاع تلقائي مربوط بحفظ وحذف الطلبات ---------- */
  if(typeof saveOrder === 'function'){
    const origSaveOrder = saveOrder;
    window.saveOrder = function(id){
      ensureInventoryDefaults();
      if(id){
        const existing = db.orders.find(x=>x.id===id);
        const before = existing ? Number(existing.materialCost)||0 : 0;
        const countBefore = db.orders.length;
        const r = origSaveOrder.apply(this, arguments);
        // orig ممكن يرجع من غير تنفيذ لو فيه خطأ تحقق (validation) — التأكد إن التعديل فعلاً حصل
        const after = existing ? Number(existing.materialCost)||0 : 0;
        if(db.orders.length===countBefore && existing && after!==before){
          const diff = after - before;
          db.inventoryValue -= diff;
          if(diff!==0) logInventory('out', diff, `تعديل تكلفة خامة طلب #${existing.invoiceNumber||''}`);
          saveDB();
          if(typeof renderInventoryCard==='function') renderInventoryCard();
        }
        return r;
      } else {
        const countBefore = db.orders.length;
        const r = origSaveOrder.apply(this, arguments);
        if(db.orders.length===countBefore+1){
          const newOrder = db.orders[db.orders.length-1];
          const mc = Number(newOrder.materialCost)||0;
          if(mc>0){
            db.inventoryValue -= mc;
            logInventory('out', mc, `طلب جديد #${newOrder.invoiceNumber||''}`);
            saveDB();
            if(typeof renderInventoryCard==='function') renderInventoryCard();
          }
        }
        return r;
      }
    };
  }

  if(typeof deleteOrder === 'function'){
    const origDeleteOrder = deleteOrder;
    window.deleteOrder = async function(id){
      const existing = (db.orders||[]).find(x=>x.id===id);
      const mc = existing ? Number(existing.materialCost)||0 : 0;
      const countBefore = (db.orders||[]).length;
      const r = await origDeleteOrder.apply(this, arguments);
      const countAfter = (db.orders||[]).length;
      if(mc>0 && countAfter<countBefore){
        ensureInventoryDefaults();
        db.inventoryValue += mc;
        logInventory('in', mc, `استرجاع بسبب حذف طلب #${existing.invoiceNumber||''}`);
        saveDB();
        if(typeof renderInventoryCard==='function') renderInventoryCard();
      }
      return r;
    };
  }

  /* ---------- إضافة رصيد مخزون يدويًا (شراء خامة جديدة) ---------- */
  window.addInventoryStock = function(){
    ensureInventoryDefaults();
    const amountEl = document.getElementById('inventoryAddAmount');
    const noteEl = document.getElementById('inventoryAddNote');
    const amount = Number(amountEl && amountEl.value)||0;
    if(amount<=0){ toast('أدخل مبلغ صحيح'); return; }
    db.inventoryValue += amount;
    logInventory('in', amount, (noteEl && noteEl.value.trim()) || 'إضافة رصيد مخزون');
    saveDB();
    if(amountEl) amountEl.value='';
    if(noteEl) noteEl.value='';
    toast('✅ اتضاف للمخزون');
    renderInventoryCard();
  };

  window.renderInventoryCard = function(){
    ensureInventoryDefaults();
    const box = document.getElementById('inventoryCard');
    if(!box) return;
    const val = Number(db.inventoryValue)||0;
    const logHtml = db.inventoryLog.slice(0,6).map(l=>{
      const sign = l.type==='in' ? '+' : '−';
      const color = l.type==='in' ? 'var(--primary)' : 'var(--danger)';
      return `<div class="meta">${fmtDate(l.date)} — <b style="color:${color};">${sign}${Math.round(l.amount).toLocaleString('ar-EG')} ج.م</b> — ${escapeHtml(l.note)}</div>`;
    }).join('') || `<div class="meta">لا يوجد سجل حركة بعد</div>`;
    box.innerHTML = `
      <div class="row"><h3>📦 رصيد المخزون (خامات/أقمشة)</h3><b style="font-size:18px;color:${val<0?'var(--danger)':'var(--primary)'};">${Math.round(val).toLocaleString('ar-EG')} ج.م</b></div>
      <div class="meta">${val<0?'⚠️ الرصيد بالسالب — سجّل شراء خامة جديد عشان الرقم يبقى دقيق':'بيتخصم منه تلقائيًا "تكلفة الخامة" من أي طلب جديد'}</div>
      <div class="field-row2" style="margin-top:8px;">
        <div class="field"><label>إضافة رصيد (شراء خامة) ج.م</label><input id="inventoryAddAmount" type="number" min="0"></div>
        <div class="field"><label>ملاحظة (اختياري)</label><input id="inventoryAddNote" type="text" placeholder="مثال: قماش قطن دفعة جديدة"></div>
      </div>
      <button class="btn sm outline" onclick="addInventoryStock()">➕ إضافة للمخزون</button>
      <hr class="sep">
      <div class="meta" style="font-weight:700;margin-bottom:4px;">آخر الحركات:</div>
      ${logHtml}
    `;
  };

  function injectInventoryContainer(){
    if(document.getElementById('inventoryCard')) return;
    const stats = document.getElementById('financeStats');
    if(!stats) return;
    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'inventoryCard';
    stats.insertAdjacentElement('afterend', card);
  }

  if(typeof renderFinance === 'function'){
    const origRenderFinance = renderFinance;
    window.renderFinance = function(){
      const r = origRenderFinance.apply(this, arguments);
      injectInventoryContainer();
      renderInventoryCard();
      return r;
    };
  }

  document.addEventListener('DOMContentLoaded', function(){
    ensureInventoryDefaults();
    injectInventoryContainer();
    renderInventoryCard();
  });
})();


/* ===================== feature-workers.js ===================== */
/* ============================================================
   feature-workers.js
   مرحلة 4 من التحديث الشامل — إدارة عمال الورشة:
   1) كل عامل له نظام أجر خاص به: ثابت شهري أو بالقطعة (لكل صنف
      في الطلب المسند له)، حسب اختيارك وقت إضافة العامل.
   2) كل طلب ممكن يتسند لعامل مسئول عنه (حقل جديد في نموذج
      الطلب)، وبيظهر اسمه على كارت الطلب.
   3) صفحة جديدة كاملة "👷 العمال" (بتتحقن في الـ DOM وبتتضاف
      لها زرار في القائمة الجانبية) فيها: إضافة/تعديل عامل،
      حساب المستحق لكل عامل (ثابت + قطعة الشغل من طلباته
      المُسندة)، وتسجيل دفعات أجور.
   ملف مستقل، مش بيلمس core.js ولا patches.js — بيحقن الصفحة
   والحقول بنفسه وبيلف الدوال الموجودة.
   ============================================================ */
(function(){

  function ensureWorkersDefaults(){
    if(!Array.isArray(db.workers)) db.workers = [];
    if(!Array.isArray(db.workerPayments)) db.workerPayments = [];
  }

  /* ---------- 1) حساب المستحق لكل عامل ---------- */
  function workerPieceEarnings(workerId){
    return (db.orders||[]).filter(o=>o.assignedWorkerId===workerId)
      .reduce((s,o)=>{
        const itemsQty = Array.isArray(o.items) ? o.items.reduce((a,it)=>a+(Number(it.qty)||1),0) : 1;
        return s + itemsQty;
      }, 0);
  }

  function workerPaidTotal(workerId){
    return (db.workerPayments||[]).filter(p=>p.workerId===workerId).reduce((s,p)=>s+Number(p.amount||0),0);
  }

  function calcWorkerDue(w){
    ensureWorkersDefaults();
    const pieces = workerPieceEarnings(w.id);
    const pieceDue = w.payType==='piece' || w.payType==='both' ? pieces*(Number(w.pieceRate)||0) : 0;
    const monthlyDue = w.payType==='monthly' || w.payType==='both' ? (Number(w.monthlySalary)||0) : 0;
    const totalEarned = pieceDue + monthlyDue;
    const paid = workerPaidTotal(w.id);
    return {pieces, pieceDue, monthlyDue, totalEarned, paid, remaining: totalEarned-paid};
  }

  /* ---------- 2) ربط الطلبات بالعمال ---------- */
  function workersOptionsHtml(selectedId){
    ensureWorkersDefaults();
    const active = db.workers.filter(w=>w.active!==false);
    if(!active.length) return '<option value="">لا يوجد عمال مسجلين</option>';
    return '<option value="">— بدون تحديد —</option>' + active.map(w=>
      `<option value="${w.id}" ${selectedId===w.id?'selected':''}>${escapeHtml(w.name)}</option>`
    ).join('');
  }

  if(typeof openOrderModal === 'function'){
    const origOpenOrderModal = openOrderModal;
    window.openOrderModal = function(id, presetCustomerId){
      const r = origOpenOrderModal.apply(this, arguments);
      setTimeout(function(){
        ensureWorkersDefaults();
        const mcField = document.getElementById('f_materialCost');
        if(mcField && !document.getElementById('f_assignedWorker')){
          const o = id ? (db.orders||[]).find(x=>x.id===id) : null;
          const html = `<div class="field"><label>👷 مسند للعامل</label><select id="f_assignedWorker">${workersOptionsHtml(o?o.assignedWorkerId:'')}</select></div>`;
          mcField.closest('.field').insertAdjacentHTML('afterend', html);
        }
      }, 30);
      return r;
    };
  }

  if(typeof saveOrder === 'function'){
    const origSaveOrder = saveOrder;
    window.saveOrder = function(id){
      const sel = document.getElementById('f_assignedWorker');
      const workerId = sel ? sel.value : '';
      const countBefore = (db.orders||[]).length;
      const r = origSaveOrder.apply(this, arguments);
      let targetOrder = null;
      if(id){
        targetOrder = (db.orders||[]).find(x=>x.id===id);
      } else if((db.orders||[]).length===countBefore+1){
        targetOrder = db.orders[db.orders.length-1];
      }
      if(targetOrder){
        targetOrder.assignedWorkerId = workerId || null;
        saveDB();
      }
      return r;
    };
  }

  if(typeof renderOrders === 'function'){
    const origRenderOrders = renderOrders;
    window.renderOrders = function(){
      const r = origRenderOrders.apply(this, arguments);
      ensureWorkersDefaults();
      document.querySelectorAll('#ordersList .card, #page-orders .card[data-status]').forEach(function(card){
        // مفيش id للطلب في الكارت مباشرة، فبنستنتجه من زرار "تعديل"
        const btn = card.querySelector('button[onclick^="openOrderModal("]');
        if(!btn) return;
        const m = btn.getAttribute('onclick').match(/openOrderModal\('([^']+)'\)/);
        if(!m) return;
        const o = db.orders.find(x=>x.id===m[1]);
        if(!o || !o.assignedWorkerId || card.querySelector('.worker-badge-line')) return;
        const w = db.workers.find(x=>x.id===o.assignedWorkerId);
        if(!w) return;
        const line = document.createElement('div');
        line.className = 'meta worker-badge-line';
        line.textContent = '👷 مسند لـ: ' + w.name;
        const firstMeta = card.querySelector('.meta');
        if(firstMeta) firstMeta.insertAdjacentElement('afterend', line);
      });
      return r;
    };
  }

  /* ---------- 3) صفحة العمال ---------- */
  window.openWorkerModal = function(id){
    ensureWorkersDefaults();
    const w = id ? db.workers.find(x=>x.id===id) : null;
    const html = `
      <h3>${w?'✏️ تعديل عامل':'➕ إضافة عامل جديد'}</h3>
      <div class="field"><label>الاسم</label><input id="f_workerName" type="text" value="${w?escapeHtml(w.name):''}"></div>
      <div class="field"><label>نظام الأجر</label>
        <select id="f_workerPayType" onchange="onWorkerPayTypeChange()">
          <option value="monthly" ${w&&w.payType==='monthly'?'selected':''}>ثابت شهري</option>
          <option value="piece" ${w&&w.payType==='piece'?'selected':''}>بالقطعة</option>
          <option value="both" ${w&&w.payType==='both'?'selected':''}>الاتنين مع بعض</option>
        </select>
      </div>
      <div class="field" id="workerMonthlyField"><label>الأجر الثابت الشهري (ج.م)</label><input id="f_workerMonthly" type="number" min="0" value="${w?w.monthlySalary||0:0}"></div>
      <div class="field" id="workerPieceField"><label>سعر القطعة (ج.م لكل قطعة يشتغلها)</label><input id="f_workerPiece" type="number" min="0" value="${w?w.pieceRate||0:0}"></div>
      <button class="btn" onclick="saveWorker(${w?`'${w.id}'`:'null'})">💾 حفظ</button>
    `;
    openModal(html);
    onWorkerPayTypeChange();
  };

  window.onWorkerPayTypeChange = function(){
    const type = document.getElementById('f_workerPayType').value;
    document.getElementById('workerMonthlyField').style.display = (type==='monthly'||type==='both') ? 'block':'none';
    document.getElementById('workerPieceField').style.display = (type==='piece'||type==='both') ? 'block':'none';
  };

  window.saveWorker = function(id){
    ensureWorkersDefaults();
    const name = document.getElementById('f_workerName').value.trim();
    if(!name){ toast('أدخل اسم العامل'); return; }
    const payType = document.getElementById('f_workerPayType').value;
    const monthlySalary = Number(document.getElementById('f_workerMonthly').value)||0;
    const pieceRate = Number(document.getElementById('f_workerPiece').value)||0;
    if(id){
      const w = db.workers.find(x=>x.id===id);
      Object.assign(w, {name, payType, monthlySalary, pieceRate});
    } else {
      db.workers.push({id:uid(), name, payType, monthlySalary, pieceRate, active:true});
    }
    saveDB();
    closeModal();
    toast('✅ اتحفظ العامل');
    renderWorkersPage();
  };

  window.deactivateWorker = async function(id){
    if(!await appConfirm('إيقاف هذا العامل؟ (مش هيتحذف، بس هيتشال من قايمة الإسناد للطلبات الجديدة)')) return;
    const w = db.workers.find(x=>x.id===id);
    if(w) w.active = false;
    saveDB();
    toast('تم الإيقاف');
    renderWorkersPage();
  };

  window.reactivateWorker = function(id){
    const w = db.workers.find(x=>x.id===id);
    if(w) w.active = true;
    saveDB();
    renderWorkersPage();
  };

  window.recordWorkerPayment = function(workerId){
    const amountStr = document.getElementById('wpAmount_'+workerId);
    const amount = amountStr ? Number(amountStr.value)||0 : 0;
    if(amount<=0){ toast('أدخل مبلغ صحيح'); return; }
    db.workerPayments.push({id:uid(), workerId, amount, date:todayStr()});
    saveDB();
    toast('✅ اتسجلت دفعة الأجر');
    renderWorkersPage();
  };

  window.renderWorkersPage = function(){
    ensureWorkersDefaults();
    const box = document.getElementById('workersList');
    if(!box) return;
    if(!db.workers.length){
      box.innerHTML = '<div class="empty-msg">لا يوجد عمال مسجلين — ضيف أول عامل بالزرار +</div>';
      return;
    }
    const sorted = db.workers.slice().sort((a,b)=>(a.active===false?1:0)-(b.active===false?1:0));
    box.innerHTML = sorted.map(w=>{
      const d = calcWorkerDue(w);
      const payLabel = w.payType==='monthly'?'ثابت شهري':(w.payType==='piece'?'بالقطعة':'ثابت + قطعة');
      return `<div class="card" style="${w.active===false?'opacity:.6;':''}">
        <div class="row"><h3>👷 ${escapeHtml(w.name)}${w.active===false?' <span class="meta">(متوقف)</span>':''}</h3><b style="color:${d.remaining>0?'var(--danger)':'var(--primary)'};">${Math.round(d.remaining).toLocaleString('ar-EG')} ج.م</b></div>
        <div class="meta">💼 ${payLabel}${w.payType!=='monthly'?` — سعر القطعة ${Number(w.pieceRate).toLocaleString('ar-EG')} ج.م × ${d.pieces} قطعة = ${Math.round(d.pieceDue).toLocaleString('ar-EG')} ج.م`:''}${w.payType!=='piece'?` ${w.payType==='both'?'+ ':''}الثابت الشهري ${Number(w.monthlySalary).toLocaleString('ar-EG')} ج.م`:''}</div>
        <div class="meta">📊 إجمالي المستحق: ${Math.round(d.totalEarned).toLocaleString('ar-EG')} ج.م — المدفوع: ${Math.round(d.paid).toLocaleString('ar-EG')} ج.م</div>
        <div class="field-row2" style="margin-top:6px;">
          <div class="field"><label>تسجيل دفعة أجر (ج.م)</label><input id="wpAmount_${w.id}" type="number" min="0"></div>
        </div>
        <div class="btn-row">
          <button class="btn sm outline" onclick="recordWorkerPayment('${w.id}')">💵 تسجيل دفعة</button>
          <button class="btn sm secondary" onclick="openWorkerModal('${w.id}')">✏️ تعديل</button>
          ${w.active===false
            ? `<button class="btn sm outline" onclick="reactivateWorker('${w.id}')">▶️ إعادة تفعيل</button>`
            : `<button class="btn sm danger" onclick="deactivateWorker('${w.id}')">⏸️ إيقاف</button>`}
        </div>
      </div>`;
    }).join('');
  };

  /* ---------- حقن الصفحة + رابط القائمة الجانبية ---------- */
  function injectWorkersPage(){
    if(document.getElementById('page-workers')) return;
    const financePage = document.getElementById('page-finance');
    if(!financePage) return;
    const section = document.createElement('section');
    section.className = 'page';
    section.id = 'page-workers';
    section.innerHTML = `
      <div class="section-title">👷 عمال الورشة</div>
      <button class="btn outline" onclick="openWorkerModal()">➕ إضافة عامل</button>
      <div id="workersList" style="margin-top:8px;"></div>
    `;
    financePage.insertAdjacentElement('afterend', section);

    const sidenav = document.getElementById('sideNav');
    if(sidenav && !sidenav.querySelector('[data-page="workers"]')){
      const btn = document.createElement('button');
      btn.className = 'navbtn';
      btn.setAttribute('data-page','workers');
      btn.setAttribute('onclick',"showPage('workers');closeSideNav()");
      btn.innerHTML = '<span class="ic">👷</span>العمال';
      const financeBtn = sidenav.querySelector('[data-page="finance"]');
      if(financeBtn) financeBtn.insertAdjacentElement('afterend', btn);
      else sidenav.appendChild(btn);
    }

    if(typeof pageTitles==='object') pageTitles.workers = '👷 العمال';
    if(typeof fabPages==='object') fabPages.workers = false;
  }

  if(typeof renderAll === 'function'){
    const origRenderAll = renderAll;
    window.renderAll = function(){
      const r = origRenderAll.apply(this, arguments);
      if(document.getElementById('page-workers')) renderWorkersPage();
      return r;
    };
  }

  document.addEventListener('DOMContentLoaded', function(){
    ensureWorkersDefaults();
    injectWorkersPage();
  });
})();


/* ===================== feature-production-board.js ===================== */
/* ============================================================
   feature-production-board.js
   المرحلة الأخيرة من التحديث الشامل — لوحة إنتاج واحدة في
   الصفحة الرئيسية بتجمع في نظرة واحدة:
     • الشغل الجاري موزّع على كل عامل (كام قطعة عنده دلوقتي)
     • الطلبات اللي لسه من غير عامل مسئول (تنبيه لتوزيعها)
     • حالة رصيد المخزون
     • عدد الطلبات المتأخرة والجاهزة للتسليم
   ملف مستقل، بيحقن الويدجت بتاعه في الصفحة الرئيسية ومش بيلمس
   core.js ولا patches.js ولا أي ملف تاني من ملفات الميزات —
   بيقرأ بس من db.orders / db.workers / db.inventoryValue اللي
   feature-workers.js و feature-inventory.js أنشأوها.
   ============================================================ */
(function(){

  function activeOrders(){
    return (db.orders||[]).filter(o=>o.status!=='تم التسليم');
  }

  function orderPiecesCount(o){
    return Array.isArray(o.items) ? o.items.reduce((a,it)=>a+(Number(it.qty)||1),0) : 1;
  }

  function buildBoardData(){
    const orders = activeOrders();
    const workers = (db.workers||[]).filter(w=>w.active!==false);
    const byWorker = workers.map(w=>{
      const wOrders = orders.filter(o=>o.assignedWorkerId===w.id);
      const pieces = wOrders.reduce((s,o)=>s+orderPiecesCount(o),0);
      return {worker:w, count:wOrders.length, pieces};
    });
    const unassigned = orders.filter(o=>!o.assignedWorkerId);
    const overdue = orders.filter(o=> typeof isOverdue==='function' && isOverdue(o));
    const readyToDeliver = orders.filter(o=>o.status==='جاهز للتسليم');
    const inventoryValue = typeof db.inventoryValue==='number' ? db.inventoryValue : null;
    return {byWorker, unassigned, overdue, readyToDeliver, inventoryValue, totalActive:orders.length};
  }

  function renderProductionBoard(){
    const box = document.getElementById('productionBoardBody');
    if(!box) return;
    const d = buildBoardData();
    if(!d.totalActive){
      box.innerHTML = '<div class="empty-msg">مفيش طلبات قيد الشغل دلوقتي 🎉</div>';
      return;
    }

    const workerRows = d.byWorker.length ? d.byWorker.map(x=>{
      return `<div class="row" style="padding:6px 0;border-bottom:1px dashed var(--stitch);">
        <span>👷 ${escapeHtml(x.worker.name)}</span>
        <b>${x.count} طلب — ${x.pieces} قطعة</b>
      </div>`;
    }).join('') : '<div class="meta">لا يوجد عمال نشطين مسجلين — أضفهم من صفحة "العمال"</div>';

    const unassignedHtml = d.unassigned.length ? `
      <div class="alert-banner warn" style="margin-top:8px;">
        <span class="ic">⚠️</span>
        <div><b>${d.unassigned.length} طلب من غير عامل مسئول</b>وزّعهم من صفحة "الطلبات" عشان يدخلوا في حساب المستحقات
          <div class="btn-row" style="margin-top:6px;"><button class="btn sm outline" onclick="showPage('orders')">📋 روح للطلبات</button></div>
        </div>
      </div>` : '';

    const inventoryLine = d.inventoryValue!=null ? `
      <div class="meta" style="margin-top:8px;">📦 رصيد المخزون الحالي: <b style="color:${d.inventoryValue<0?'var(--danger)':'var(--primary)'};">${Math.round(d.inventoryValue).toLocaleString('ar-EG')} ج.م</b>${d.inventoryValue<0?' ⚠️ سالب':''}</div>
    ` : '';

    box.innerHTML = `
      <div class="grid-cards" style="margin-bottom:8px;">
        <div class="stat-card"><div class="stat-ic">🧵</div><div><div class="num">${d.totalActive}</div><div class="lbl">قيد الشغل</div></div></div>
        <div class="stat-card ${d.overdue.length?'danger':''}"><div class="stat-ic">⏰</div><div><div class="num">${d.overdue.length}</div><div class="lbl">متأخرة</div></div></div>
        <div class="stat-card"><div class="stat-ic">✅</div><div><div class="num">${d.readyToDeliver.length}</div><div class="lbl">جاهزة للتسليم</div></div></div>
      </div>
      <div class="meta" style="font-weight:700;margin-bottom:2px;">توزيع الشغل على العمال:</div>
      ${workerRows}
      ${unassignedHtml}
      ${inventoryLine}
    `;
  }

  function injectBoard(){
    if(document.getElementById('widget-production')) return;
    const container = document.getElementById('homeWidgetsContainer');
    const alertsWidget = document.getElementById('widget-alerts');
    if(!container) return;
    const widget = document.createElement('div');
    widget.id = 'widget-production';
    widget.className = 'home-widget';
    widget.innerHTML = `
      <div class="section-title">🏭 لوحة الإنتاج</div>
      <div class="card" id="productionBoardBody"></div>
    `;
    if(alertsWidget) alertsWidget.insertAdjacentElement('afterend', widget);
    else container.insertBefore(widget, container.firstChild);
  }

  if(typeof renderHome === 'function'){
    const origRenderHome = renderHome;
    window.renderHome = function(){
      const r = origRenderHome.apply(this, arguments);
      injectBoard();
      renderProductionBoard();
      return r;
    };
  }

  document.addEventListener('DOMContentLoaded', function(){
    injectBoard();
    renderProductionBoard();
  });
})();


/* ===================== feature-expenses-filter-compare.js ===================== */
/* ============================================================
   feature-expenses-filter-compare.js
   تكملة تحسينات مصاريف البيت:
   1) فلتر فوق القائمة: الكل / آخر 30 يوم / آخر 3 شهور — بيفلتر
      قائمة الأيام المعروضة بس (إجمالي "كل الوقت" في الأعلى
      بيفضل زي ما هو لأنه مؤشر تراكمي مقصود).
   2) كارت مقارنة "هذا الشهر مقابل اللي فات" لكل فئة مصروف،
      عشان تعرف فين بقيت بتصرف أكتر/أقل بسرعة.
   ملف مستقل، بيتحمّل بعد feature-topbar-and-expenses.js ومش
   بيلمس core.js ولا patches.js ولا الملف اللي قبله.

   ملحوظة: فكرة "بحث سريع داخل قائمة ⋮" اللي اتقالت كمثال
   للتوسع المستقبلي مش اتنفذت هنا — كانت إشارة لإمكانية لاحقة
   مش ميزة محددة المعالم (تبحث في إيه بالظبط؟)، فلو حابب حاجة
   بعينها زيها قولّي أعمل إيه بالظبط وهنفذها.
   ============================================================ */
(function(){

  let expensesFilterMode = 'all'; // all | 30d | 3m

  function filterExpensesByMode(all){
    if(expensesFilterMode==='all') return all;
    const today = new Date(todayStr());
    const cutoffDays = expensesFilterMode==='30d' ? 30 : 92;
    const cutoff = new Date(today.getTime() - cutoffDays*86400000);
    const cutoffStr = cutoff.toISOString().slice(0,10);
    return all.filter(e=>e.date>=cutoffStr);
  }

  function groupedFilteredHtml(){
    const all = (db.houseExpenses||[]).slice().sort((a,b)=>b.date.localeCompare(a.date));
    const filtered = filterExpensesByMode(all);
    if(!filtered.length) return `<div class="empty-msg">لا توجد مصاريف في النطاق ده</div>`;
    const groups = {};
    filtered.forEach(e=>{ (groups[e.date] = groups[e.date] || []).push(e); });
    const days = Object.keys(groups).sort((a,b)=>b.localeCompare(a));
    return days.map((d, idx)=>{
      const items = groups[d];
      const dayTotal = items.reduce((s,e)=>s+Number(e.amount||0), 0);
      const rows = items.map(e=>`
        <div class="card" style="margin-top:6px;">
          <div class="row"><h3>${escapeHtml(e.desc)}</h3><b style="color:var(--danger)">${Number(e.amount).toLocaleString('ar-EG')} ج.م</b></div>
          <div class="meta">${houseExpenseCategoryInfo(e.category).label}</div>
          <div class="btn-row"><button class="btn sm danger" onclick="deleteHouseExpense('${e.id}')">🗑️ حذف</button></div>
        </div>
      `).join('');
      return `
        <details class="card" style="padding:10px 12px;" ${idx===0 ? 'open' : ''}>
          <summary style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;">
            <span>📅 ${fmtDate(d)} <span class="meta">(${items.length} ${items.length===1?'مصروف':'مصاريف'})</span></span>
            <b style="color:var(--danger);">${dayTotal.toLocaleString('ar-EG')} ج.م</b>
          </summary>
          ${rows}
        </details>
      `;
    }).join('');
  }

  function renderFilterChips(){
    const anchor = document.getElementById('houseExpensesList');
    if(!anchor || document.getElementById('expensesFilterChips')) return;
    const chips = document.createElement('div');
    chips.id = 'expensesFilterChips';
    chips.className = 'btn-row';
    chips.style.cssText = 'flex-wrap:wrap;margin-bottom:8px;';
    chips.innerHTML = `
      <button class="btn sm outline" data-mode="all">📋 الكل</button>
      <button class="btn sm outline" data-mode="30d">🗓️ آخر 30 يوم</button>
      <button class="btn sm outline" data-mode="3m">📆 آخر 3 شهور</button>
    `;
    anchor.parentNode.insertBefore(chips, anchor);
    chips.querySelectorAll('button').forEach(btn=>{
      btn.addEventListener('click', function(){
        expensesFilterMode = this.dataset.mode;
        updateChipStyles();
        applyFilteredList();
      });
    });
    updateChipStyles();
  }

  function updateChipStyles(){
    const chips = document.getElementById('expensesFilterChips');
    if(!chips) return;
    chips.querySelectorAll('button').forEach(btn=>{
      const active = btn.dataset.mode===expensesFilterMode;
      btn.classList.toggle('accent', active);
      btn.classList.toggle('outline', !active);
    });
  }

  function applyFilteredList(){
    const box = document.getElementById('houseExpensesList');
    if(box) box.innerHTML = groupedFilteredHtml();
  }

  /* ---------- مقارنة شهرية بالفئة ---------- */
  function categoryTotalsForMonth(ym){
    const sums = {};
    (db.houseExpenses||[]).filter(e=>e.date.slice(0,7)===ym).forEach(e=>{
      const key = e.category || 'أخرى';
      sums[key] = (sums[key]||0) + Number(e.amount||0);
    });
    return sums;
  }

  function renderMonthlyCompare(){
    let box = document.getElementById('houseExpenseMonthlyCompare');
    if(!box){
      const anchorCard = document.getElementById('houseExpenseCategoryBreakdown');
      const parentCard = anchorCard ? anchorCard.closest('.card') : null;
      if(!parentCard) return;
      const card = document.createElement('div');
      card.className = 'card';
      card.style.cssText = 'margin-top:8px;';
      card.innerHTML = `<h3>📊 مقارنة الشهر بالشهر اللي فات</h3><div id="houseExpenseMonthlyCompare"></div>`;
      parentCard.insertAdjacentElement('afterend', card);
      box = document.getElementById('houseExpenseMonthlyCompare');
    }
    const thisYM = currentYM();
    const lastYM = addMonthsYM(thisYM, -1);
    const cur = categoryTotalsForMonth(thisYM);
    const prev = categoryTotalsForMonth(lastYM);
    const keys = Array.from(new Set([...Object.keys(cur), ...Object.keys(prev)]));
    if(!keys.length){
      box.innerHTML = `<div class="empty-msg">لا توجد بيانات كافية للمقارنة بعد</div>`;
      return;
    }
    keys.sort((a,b)=>(cur[b]||0)-(cur[a]||0));
    box.innerHTML = keys.map(key=>{
      const c = cur[key]||0, p = prev[key]||0;
      const diff = c - p;
      const info = houseExpenseCategoryInfo(key);
      const diffColor = diff>0 ? 'var(--danger)' : (diff<0 ? 'var(--primary)' : 'var(--muted)');
      const diffTxt = diff===0 ? 'زي الشهر اللي فات' : (diff>0 ? `+${Math.round(diff).toLocaleString('ar-EG')} عن اللي فات` : `${Math.round(diff).toLocaleString('ar-EG')} عن اللي فات`);
      return `
        <div class="row" style="margin-bottom:6px;">
          <span>${info.label}</span>
          <span style="text-align:left;">
            <b>${Math.round(c).toLocaleString('ar-EG')} ج.م</b>
            <span style="color:${diffColor};font-size:12px;display:block;">${diffTxt}</span>
          </span>
        </div>
      `;
    }).join('');
  }

  if(typeof renderHouseExpenses === 'function'){
    const origRenderHouseExpenses = renderHouseExpenses;
    window.renderHouseExpenses = function(){
      const r = origRenderHouseExpenses.apply(this, arguments);
      renderFilterChips();
      applyFilteredList();
      renderMonthlyCompare();
      return r;
    };
  }

  function boot(){
    if(document.getElementById('houseExpensesList') && typeof renderHouseExpenses==='function'){
      renderFilterChips();
      applyFilteredList();
      renderMonthlyCompare();
    }
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();


/* ===================== feature-financial-wellbeing.js ===================== */
/* ============================================================
   feature-financial-wellbeing.js
   خمس أفكار من ملف "تجميع أفكار الالتزامات الشخصية":
   1) 🎨 الميزانية الصامتة — لون خلفية خفيف في الصفحة الرئيسية
      يعكس وضعك المالي الحالي (أخضر/أصفر/أحمر) بهدوء من غير
      أرقام، بناءً على نفس منطق خط الأمان البصري.
   2) 🏆 تحدي شهري — هدف تلقائي "قلل مصروف البيت X% عن الشهر
      اللي فات" مع شريط تقدّم وشارة عند التحقيق.
   3) 🕵️ كشف التزام مستتر — لو نفس وصف مصروف البيت اتكرر بمبلغ
      متقارب في آخر 3 شهور، يقترح تحويله لالتزام ثابت.
   4) 📉 استراتيجية سداد الديون — ترتيب الأقساط بطريقة Snowball
      (الأصغر أولًا) أو Avalanche (الأعلى قسط شهري أولًا — بديل
      عملي لعدم وجود نسبة فايدة مسجّلة في التطبيق).
   5) 🔓 عدّاد التحرر من الالتزامات — "باقي كام شهر" على انتهاء
      كل الأقساط محددة المدة.
   ملف مستقل، بيتحمّل آخر واحد، مش بيلمس أي ملف تاني.
   ============================================================ */
(function(){

  /* ========== أدوات مشتركة ========== */
  function daysInMonth(ym){ const [y,m]=ym.split('-').map(Number); return new Date(y,m,0).getDate(); }

  function currentSafetyLevel(){
    let prog; try{ prog = monthlyCommitmentProgress(); }catch(e){ prog=null; }
    if(!prog) return null;
    const ym = todayStr().slice(0,7);
    const dayNum = Number(todayStr().slice(8,10));
    const expectedPct = Math.min(100, Math.round((dayNum/daysInMonth(ym))*100));
    if(prog.pct >= expectedPct) return 'safe';
    if(prog.pct >= expectedPct*0.7) return 'warn';
    return 'danger';
  }

  /* ========== 1) الميزانية الصامتة ========== */
  const moodCss = document.createElement('style');
  moodCss.textContent = `
    body.mood-safe{ background-image: radial-gradient(1400px 700px at 50% -15%, rgba(31,109,87,0.10), transparent 60%) !important; }
    body.mood-warn{ background-image: radial-gradient(1400px 700px at 50% -15%, rgba(184,134,59,0.13), transparent 60%) !important; }
    body.mood-danger{ background-image: radial-gradient(1400px 700px at 50% -15%, rgba(190,60,60,0.13), transparent 60%) !important; }
  `;
  document.head.appendChild(moodCss);

  function applyMood(){
    const level = currentSafetyLevel();
    document.body.classList.remove('mood-safe','mood-warn','mood-danger');
    if(level) document.body.classList.add('mood-'+level);
  }

  /* ========== 2) تحدي شهري ========== */
  function houseExpensesTotalForYM(ym){
    return (db.houseExpenses||[]).filter(e=>e.date.slice(0,7)===ym).reduce((s,e)=>s+Number(e.amount||0),0);
  }

  function challengeState(){
    if(typeof db.challengeTargetPct !== 'number') db.challengeTargetPct = 5;
    const thisYM = currentYM();
    const lastYM = addMonthsYM(thisYM, -1);
    const prevTotal = houseExpensesTotalForYM(lastYM);
    const curTotal = houseExpensesTotalForYM(thisYM);
    const targetAmount = prevTotal * (1 - db.challengeTargetPct/100);
    const dayNum = Number(todayStr().slice(8,10));
    const totalDays = daysInMonth(thisYM);
    const paceLimit = prevTotal ? (prevTotal*(1-db.challengeTargetPct/100)) * (dayNum/totalDays) : null;
    return {prevTotal, curTotal, targetAmount, achieved: prevTotal>0 && curTotal<=targetAmount, onPace: paceLimit==null || curTotal<=paceLimit, dayNum, totalDays};
  }

  function renderChallengeCard(){
    const box = document.getElementById('monthlyChallengeCard');
    if(!box) return;
    const s = challengeState();
    if(!s.prevTotal){
      box.innerHTML = `<div class="empty-msg">هيبدأ التحدي يظهر بعد ما يكون عندك بيانات مصروف بيت لشهر كامل على الأقل</div>`;
      return;
    }
    const pct = Math.min(100, Math.round((s.curTotal/(s.targetAmount||1))*100));
    const color = s.achieved ? 'var(--primary)' : (s.onPace ? 'var(--accent)' : 'var(--danger)');
    box.innerHTML = `
      <div class="field" style="margin-bottom:6px;">
        <label>هدف التقليل هذا الشهر (%)</label>
        <input id="challengePctInput" type="number" min="1" max="50" value="${db.challengeTargetPct}" style="max-width:100px;">
        <button class="btn sm outline" id="saveChallengePctBtn" style="margin-top:6px;">💾 حفظ الهدف</button>
      </div>
      <div class="row"><span>${s.achieved?'🏆 حققت الهدف!':'🎯 الهدف: تحت '+Math.round(s.targetAmount).toLocaleString('ar-EG')+' ج.م'}</span><b style="color:${color};">${Math.round(s.curTotal).toLocaleString('ar-EG')} ج.م</b></div>
      <div style="position:relative;height:10px;border-radius:99px;background:var(--card-alt);overflow:hidden;margin-top:6px;">
        <div style="position:absolute;inset-inline-start:0;top:0;bottom:0;width:${Math.min(100,pct)}%;background:${color};border-radius:99px;"></div>
      </div>
      <div class="meta" style="margin-top:6px;">${s.achieved?'أنت بالفعل وفّرت أكتر من الهدف — استمر كده 👏':(s.onPace?'لسه ماشي كويس على معدل التوفير المطلوب':'الصرف أسرع من المعدل المطلوب — حاول تهدي شوية باقي الشهر')} (مقارنة بالشهر اللي فات: ${Math.round(s.prevTotal).toLocaleString('ar-EG')} ج.م)</div>
    `;
    document.getElementById('saveChallengePctBtn').onclick = function(){
      const v = Number(document.getElementById('challengePctInput').value)||5;
      db.challengeTargetPct = Math.max(1, Math.min(50, v));
      saveDB();
      renderChallengeCard();
      toast('✅ اتحفظ الهدف');
    };
  }

  /* ========== 3) كشف التزام مستتر ========== */
  function normalizeDesc(s){ return (s||'').trim().replace(/\s+/g,' ').toLowerCase(); }

  function detectHiddenCommitments(){
    const all = db.houseExpenses||[];
    const dismissed = db.dismissedHiddenCommitments || [];
    const existingDescs = (db.commitments||[]).map(c=>normalizeDesc(c.desc));
    const groups = {};
    all.forEach(e=>{
      const key = normalizeDesc(e.desc);
      if(!key) return;
      (groups[key]=groups[key]||[]).push(e);
    });
    const suggestions = [];
    Object.keys(groups).forEach(key=>{
      if(dismissed.includes(key) || existingDescs.includes(key)) return;
      const items = groups[key];
      const monthsSet = new Set(items.map(e=>e.date.slice(0,7)));
      if(monthsSet.size < 3) return;
      const amounts = items.map(e=>Number(e.amount)||0);
      const avg = amounts.reduce((a,b)=>a+b,0)/amounts.length;
      const withinRange = amounts.every(a=>Math.abs(a-avg) <= avg*0.2);
      if(!withinRange) return;
      suggestions.push({key, desc: items[items.length-1].desc, avgAmount: avg, months: monthsSet.size});
    });
    return suggestions;
  }

  window.dismissHiddenCommitment = function(key){
    db.dismissedHiddenCommitments = db.dismissedHiddenCommitments || [];
    db.dismissedHiddenCommitments.push(key);
    saveDB();
    renderHiddenCommitmentSuggestions();
  };

  window.convertToFixedCommitment = function(key, desc, amount){
    openCommitmentModal();
    setTimeout(function(){
      const descEl = document.getElementById('f_commDesc');
      const amountEl = document.getElementById('f_commAmount');
      if(descEl) descEl.value = desc;
      if(amountEl) amountEl.value = Math.round(amount);
    }, 40);
    dismissHiddenCommitment(key);
  };

  function renderHiddenCommitmentSuggestions(){
    const box = document.getElementById('hiddenCommitmentSuggestions');
    if(!box) return;
    const suggestions = detectHiddenCommitments();
    if(!suggestions.length){ box.innerHTML=''; return; }
    box.innerHTML = suggestions.map(s=>`
      <div class="alert-banner warn" style="margin-top:8px;">
        <span class="ic">🕵️</span>
        <div>
          <b>"${escapeHtml(s.desc)}" بيتكرر بنفس القيمة تقريبًا من ${s.months} شهور</b>
          يمكن يبقى الأنسب تحوّله لالتزام ثابت (${Math.round(s.avgAmount).toLocaleString('ar-EG')} ج.م/شهر) عشان محدش يفوتك.
          <div class="btn-row" style="margin-top:6px;">
            <button class="btn sm outline" onclick="convertToFixedCommitment('${s.key}','${escapeHtml(s.desc).replace(/'/g,"\\'")}',${s.avgAmount})">➕ تحويل لالتزام ثابت</button>
            <button class="btn sm secondary" onclick="dismissHiddenCommitment('${s.key}')">تجاهل</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  /* ========== 4) استراتيجية سداد الديون + 5) عداد التحرر ========== */
  let debtStrategyMode = 'snowball'; // snowball | avalanche

  function getDebts(){
    return (db.commitments||[]).filter(c=>c.active!==false && c.type==='قسط' && c.remainingMonths!=null && c.remainingMonths>0)
      .map(c=>({c, remainingAmount: Number(c.amount)*c.remainingMonths}));
  }

  function renderDebtStrategy(){
    const box = document.getElementById('debtStrategyCard');
    if(!box) return;
    const debts = getDebts();
    if(!debts.length){
      box.innerHTML = `<div class="empty-msg">مفيش أقساط محددة المدة مسجلة دلوقتي</div>`;
      return;
    }
    const sorted = debts.slice().sort((a,b)=> debtStrategyMode==='snowball'
      ? a.remainingAmount - b.remainingAmount
      : b.c.amount - a.c.amount);
    const rows = sorted.map((d,idx)=>`
      <div class="card" style="margin-top:6px;${idx===0?'border-color:var(--primary);':''}">
        <div class="row"><h3>${idx===0?'🎯 ':''}${escapeHtml(d.c.desc)}</h3><b>${Math.round(d.remainingAmount).toLocaleString('ar-EG')} ج.م متبقي</b></div>
        <div class="meta">${Number(d.c.amount).toLocaleString('ar-EG')} ج.م/شهر — باقي ${d.c.remainingMonths} شهر${idx===0?' — ابدأ بيه الأول':''}</div>
      </div>
    `).join('');
    box.innerHTML = `
      <div class="btn-row" style="margin-bottom:6px;">
        <button class="btn sm ${debtStrategyMode==='snowball'?'accent':'outline'}" id="btnSnowball">❄️ الأصغر أولًا (Snowball)</button>
        <button class="btn sm ${debtStrategyMode==='avalanche'?'accent':'outline'}" id="btnAvalanche">⛰️ الأعلى قسط أولًا (Avalanche)</button>
      </div>
      <div class="meta">ملحوظة: التطبيق مش بيسجّل نسبة فايدة لكل قسط، فـ"الأعلى قسط شهري" هنا بديل عملي لترتيب الأولوية بدل ترتيب الفايدة الفعلي</div>
      ${rows}
    `;
    document.getElementById('btnSnowball').onclick = function(){ debtStrategyMode='snowball'; renderDebtStrategy(); };
    document.getElementById('btnAvalanche').onclick = function(){ debtStrategyMode='avalanche'; renderDebtStrategy(); };
  }

  function renderFreedomCounter(){
    const box = document.getElementById('freedomCounterCard');
    if(!box) return;
    const withDuration = (db.commitments||[]).filter(c=>c.active!==false && c.remainingMonths!=null && c.remainingMonths>0);
    if(!withDuration.length){
      box.innerHTML = `<div class="empty-msg">مفيش التزامات محددة المدة تحسب لها العدّاد</div>`;
      return;
    }
    const maxMonths = Math.max(...withDuration.map(c=>c.remainingMonths));
    const freeDate = new Date();
    freeDate.setMonth(freeDate.getMonth()+maxMonths);
    box.innerHTML = `
      <div class="row"><span>🔓 التحرر الكامل من الالتزامات محددة المدة</span><b style="color:var(--primary);font-size:16px;">${maxMonths} شهر</b></div>
      <div class="meta">يعني تقريبًا حوالي ${freeDate.toLocaleDateString('ar-EG',{month:'long',year:'numeric'})}، لو استمريت بنفس الوتيرة من غير ما تضيف أقساط جديدة</div>
    `;
  }

  /* ========== حقن الحاويات ========== */
  function injectOverviewExtra(){
    const tab = document.getElementById('personalTab-overview');
    if(!tab || document.getElementById('hiddenCommitmentSuggestions')) return;
    const div = document.createElement('div');
    div.id = 'hiddenCommitmentSuggestions';
    tab.appendChild(div);
  }

  function injectReportsExtra(){
    const tab = document.getElementById('personalTab-reports');
    if(!tab || document.getElementById('monthlyChallengeCard')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="section-title">🏆 التحدي الشهري</div>
      <div class="card" id="monthlyChallengeCard"></div>
      <div class="section-title">📉 استراتيجية سداد الديون</div>
      <div class="card" id="debtStrategyCard"></div>
      <div class="section-title">🔓 عدّاد التحرر من الالتزامات</div>
      <div class="card" id="freedomCounterCard"></div>
    `;
    while(wrap.firstChild) tab.appendChild(wrap.firstChild);
  }

  function renderAllWellbeing(){
    applyMood();
    injectOverviewExtra();
    renderHiddenCommitmentSuggestions();
    injectReportsExtra();
    renderChallengeCard();
    renderDebtStrategy();
    renderFreedomCounter();
  }

  if(typeof renderPersonalAlerts === 'function'){
    const orig = renderPersonalAlerts;
    window.renderPersonalAlerts = function(){
      const r = orig.apply(this, arguments);
      renderAllWellbeing();
      return r;
    };
  }
  if(typeof renderHome === 'function'){
    const origHome = renderHome;
    window.renderHome = function(){
      const r = origHome.apply(this, arguments);
      applyMood();
      return r;
    };
  }
  if(typeof showPersonalTab === 'function'){
    const origShowTab = showPersonalTab;
    window.showPersonalTab = function(tab){
      const r = origShowTab.apply(this, arguments);
      if(tab==='reports'){ injectReportsExtra(); renderChallengeCard(); renderDebtStrategy(); renderFreedomCounter(); }
      if(tab==='overview'){ injectOverviewExtra(); renderHiddenCommitmentSuggestions(); }
      return r;
    };
  }

  function boot(){
    applyMood();
    injectOverviewExtra();
    renderHiddenCommitmentSuggestions();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();


/* ===================== feature-investment-plan.js ===================== */
/* ============================================================
   feature-investment-plan.js  (نسخة v2)
   نفس الصفحة الأساسية + 5 تطويرات:
   1) 🧮 اقتراح تلقائي لمبلغ الفائض (دخل الشهر − الالتزامات −
      مصروف البيت) بدل ما تكتبه يدوي كل مرة.
   2) ➖ سحب من جيب: تسجيل تنفيذ فعلي (فتحت شهادة، اشتريت ذهب...)
      بتاريخ وسبب، بدل رصيد نظري بس متراكم.
   3) 📈 سجل نمو شهري لكل جيب + Sparkline بسيط جنب كل جيب.
   4) 🔗 ربط أي جيب بالمخزون: أي سحب منه يترحّل تلقائي لرصيد
      المخزون (feature-inventory.js) بدل ما تدخله مرتين.
   5) ⏰ تنبيه لو فائض الشهر اللي فات ما اتوزّعش (أو اتوزّع جزء
      بسيط منه) — بيظهر في أعلى صفحة الاستثمار.
   + لون ثابت مميز لكل جيب يفضل معاه في كل مكان.
   ============================================================ */
(function(){

  const BUCKET_COLORS = ['#B8863B','#1F6D57','#5A7EBB','#B65A6C','#8A6FBF','#4C9A8E','#C48A3A'];

  function ensureInvestmentDefaults(){
    if(!Array.isArray(db.investmentBuckets)) db.investmentBuckets = [];
    if(!Array.isArray(db.investmentLog)) db.investmentLog = [];
    if(!Array.isArray(db.investmentWithdrawals)) db.investmentWithdrawals = [];
    db.investmentBuckets.forEach((b,idx)=>{
      if(!b.color) b.color = BUCKET_COLORS[idx % BUCKET_COLORS.length];
      if(!Array.isArray(b.history)) b.history = [];
      if(typeof b.linkInventory !== 'boolean') b.linkInventory = false;
    });
  }

  function totalPct(){ return (db.investmentBuckets||[]).reduce((s,b)=>s+(Number(b.targetPct)||0),0); }

  function upsertBucketHistory(b){
    const ym = currentYM();
    const entry = b.history.find(h=>h.ym===ym);
    if(entry) entry.balance = b.balance;
    else b.history.push({ym, balance:b.balance});
    if(b.history.length>24) b.history = b.history.slice(-24);
  }

  /* ---------- 1) اقتراح الفائض تلقائي ---------- */
  function houseExpensesTotalForYM(ym){
    return (db.houseExpenses||[]).filter(e=>e.date.slice(0,7)===ym).reduce((s,e)=>s+Number(e.amount||0),0);
  }
  function monthRevenueLocal(ym){
    return (db.payments||[]).filter(p=>p.date && p.date.slice(0,7)===ym).reduce((s,p)=>s+(Number(p.amount)||0),0);
  }
  function requiredMonthlyLocal(){
    try{ const prog = monthlyCommitmentProgress(); return prog ? prog.requiredMonthly : 0; }catch(e){ return 0; }
  }
  function suggestedSurplusFor(ym){
    const income = monthRevenueLocal(ym);
    const required = requiredMonthlyLocal();
    const houseExp = houseExpensesTotalForYM(ym);
    return Math.max(0, income - required - houseExp);
  }

  window.applySuggestedSurplus = function(){
    const amount = Math.round(suggestedSurplusFor(currentYM()));
    const el = document.getElementById('investmentSurplusAmount');
    if(el) el.value = amount>0 ? amount : '';
    toast(amount>0 ? `✅ الاقتراح: ${amount.toLocaleString('ar-EG')} ج.م` : 'لسه مفيش فائض واضح الشهر ده');
  };

  /* ---------- إدارة الجيوب ---------- */
  window.openInvestmentBucketModal = function(id){
    ensureInvestmentDefaults();
    const b = id ? db.investmentBuckets.find(x=>x.id===id) : null;
    const html = `
      <h3>${b?'✏️ تعديل جيب':'➕ إضافة جيب استثمار جديد'}</h3>
      <div class="field"><label>اسم الجيب</label><input id="f_bucketName" type="text" placeholder="مثال: إعادة استثمار في الورشة" value="${b?escapeHtml(b.name):''}"></div>
      <div class="field"><label>نسبة الفائض المخصصة له (%)</label><input id="f_bucketPct" type="number" min="1" max="100" value="${b?b.targetPct:''}"></div>
      <div class="field"><label>هدف مبلغ (اختياري)</label><input id="f_bucketTarget" type="number" min="0" placeholder="مثال: 20000" value="${b&&b.targetAmount?b.targetAmount:''}"></div>
      <div class="field"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
        <input type="checkbox" id="f_bucketLinkInv" style="width:18px;height:18px;" ${b&&b.linkInventory?'checked':''}> 🔗 اربط الجيب ده بالمخزون (أي سحب منه يترحّل تلقائي لرصيد المخزون)
      </label></div>
      <button class="btn" onclick="saveInvestmentBucket(${b?`'${b.id}'`:'null'})">💾 حفظ</button>
    `;
    openModal(html);
  };

  window.saveInvestmentBucket = function(id){
    ensureInvestmentDefaults();
    const name = document.getElementById('f_bucketName').value.trim();
    const pct = Number(document.getElementById('f_bucketPct').value)||0;
    const targetAmount = Number(document.getElementById('f_bucketTarget').value)||0;
    const linkInventory = document.getElementById('f_bucketLinkInv').checked;
    if(!name){ toast('أدخل اسم الجيب'); return; }
    if(pct<=0 || pct>100){ toast('أدخل نسبة صحيحة بين 1 و100'); return; }
    const otherTotal = totalPct() - (id ? (db.investmentBuckets.find(x=>x.id===id)?.targetPct||0) : 0);
    if(otherTotal + pct > 100){ toast(`مجموع النسب هيبقى أكتر من 100% (باقي متاح: ${100-otherTotal}%)`); return; }
    if(id){
      const b = db.investmentBuckets.find(x=>x.id===id);
      Object.assign(b, {name, targetPct:pct, targetAmount, linkInventory});
    } else {
      db.investmentBuckets.push({id:uid(), name, targetPct:pct, targetAmount, balance:0, linkInventory, color: BUCKET_COLORS[db.investmentBuckets.length % BUCKET_COLORS.length], history:[]});
    }
    saveDB();
    closeModal();
    toast('✅ اتحفظ الجيب');
    renderInvestmentPage();
  };

  window.deleteInvestmentBucket = async function(id){
    if(!await appConfirm('حذف الجيب ده؟ الرصيد المتجمع فيه هيتحذف من السجل (مش بيرجع فلوس حقيقية، ده بس تنظيم داخلي)')) return;
    db.investmentBuckets = db.investmentBuckets.filter(x=>x.id!==id);
    saveDB();
    renderInvestmentPage();
  };

  /* ---------- توزيع فائض جديد ---------- */
  window.distributeInvestmentSurplus = function(){
    ensureInvestmentDefaults();
    const amountEl = document.getElementById('investmentSurplusAmount');
    const amount = Number(amountEl && amountEl.value)||0;
    if(amount<=0){ toast('أدخل مبلغ صحيح'); return; }
    if(!db.investmentBuckets.length){ toast('أضف جيب استثمار واحد على الأقل الأول'); return; }
    const tPct = totalPct();
    if(tPct<=0){ toast('حدد نسب الجيوب الأول'); return; }
    db.investmentBuckets.forEach(b=>{
      const share = amount * (Number(b.targetPct)||0) / tPct;
      b.balance = (Number(b.balance)||0) + share;
      upsertBucketHistory(b);
    });
    db.investmentLog.unshift({id:uid(), amount, date:todayStr()});
    if(db.investmentLog.length>50) db.investmentLog = db.investmentLog.slice(0,50);
    saveDB();
    if(amountEl) amountEl.value='';
    toast('✅ اتوزّع الفائض على الجيوب');
    renderInvestmentPage();
  };

  /* ---------- 2) سحب من جيب ---------- */
  window.openWithdrawModal = function(bucketId){
    const b = db.investmentBuckets.find(x=>x.id===bucketId);
    if(!b) return;
    const html = `
      <h3>➖ سحب من "${escapeHtml(b.name)}"</h3>
      <div class="meta">الرصيد الحالي: ${Math.round(b.balance).toLocaleString('ar-EG')} ج.م</div>
      <div class="field"><label>المبلغ</label><input id="f_withdrawAmount" type="number" min="0" max="${Math.round(b.balance)}"></div>
      <div class="field"><label>السبب (مثال: فتحت شهادة ادخار، اشتريت ذهب...)</label><input id="f_withdrawNote" type="text"></div>
      ${b.linkInventory ? `<div class="meta">🔗 هذا الجيب مربوط بالمخزون — المبلغ هيترحّل تلقائي لرصيد المخزون</div>` : ''}
      <button class="btn" onclick="confirmWithdraw('${b.id}')">✅ تأكيد السحب</button>
    `;
    openModal(html);
  };

  window.confirmWithdraw = function(bucketId){
    const b = db.investmentBuckets.find(x=>x.id===bucketId);
    if(!b) return;
    const amount = Number(document.getElementById('f_withdrawAmount').value)||0;
    const note = document.getElementById('f_withdrawNote').value.trim();
    if(amount<=0 || amount>b.balance){ toast('أدخل مبلغ صحيح لا يتعدى الرصيد'); return; }
    b.balance -= amount;
    upsertBucketHistory(b);
    db.investmentWithdrawals.unshift({id:uid(), bucketId, amount, note, date:todayStr()});
    if(db.investmentWithdrawals.length>80) db.investmentWithdrawals = db.investmentWithdrawals.slice(0,80);
    if(b.linkInventory){
      if(typeof db.inventoryValue !== 'number') db.inventoryValue = 0;
      if(!Array.isArray(db.inventoryLog)) db.inventoryLog = [];
      db.inventoryValue += amount;
      db.inventoryLog.unshift({id:uid(), type:'in', amount, note:`ترحيل من جيب استثمار: ${b.name}`, date:todayStr(), ts:Date.now()});
    }
    saveDB();
    closeModal();
    toast('✅ اتسجل السحب');
    renderInvestmentPage();
    if(typeof renderInventoryCard==='function') renderInventoryCard();
  };

  /* ---------- 3) Sparkline بسيط ---------- */
  function sparklineSvg(history, color){
    if(!history || history.length<2) return '';
    const vals = history.map(h=>h.balance);
    const min = Math.min(...vals), max = Math.max(...vals);
    const range = (max-min) || 1;
    const w = 120, h = 30, step = w/(vals.length-1);
    const points = vals.map((v,i)=> `${(i*step).toFixed(1)},${(h - ((v-min)/range)*h).toFixed(1)}`).join(' ');
    return `<svg width="${w}" height="${h}" style="display:block;margin-top:4px;"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="2"/></svg>`;
  }

  /* ---------- 5) تنبيه فائض غير موزّع ---------- */
  function unallocatedLastMonthBanner(){
    const lastYM = addMonthsYM(currentYM(), -1);
    const suggested = suggestedSurplusFor(lastYM);
    if(suggested<=0) return '';
    const distributed = (db.investmentLog||[]).filter(l=>l.date.slice(0,7)===lastYM).reduce((s,l)=>s+Number(l.amount||0),0);
    if(distributed >= suggested*0.8) return '';
    const remaining = Math.round(suggested - distributed);
    return `
      <div class="alert-banner warn" style="margin-bottom:8px;">
        <span class="ic">⏰</span>
        <div>عندك حوالي <b>${remaining.toLocaleString('ar-EG')} ج.م</b> فائض من الشهر اللي فات لسه ما اتوزّعش على الجيوب. حب توزّعه دلوقتي؟</div>
      </div>
    `;
  }

  /* ---------- العرض ---------- */
  window.renderInvestmentPage = function(){
    ensureInvestmentDefaults();
    const box = document.getElementById('investmentBucketsList');
    if(!box) return;
    const tPct = totalPct();
    box.innerHTML = unallocatedLastMonthBanner() + `
      <div class="card">
        <div class="field"><label>💵 فائض جديد لتوزيعه (ج.م)</label><input id="investmentSurplusAmount" type="number" min="0"></div>
        <div class="btn-row">
          <button class="btn sm outline" onclick="distributeInvestmentSurplus()">➗ وزّع على الجيوب</button>
          <button class="btn sm secondary" onclick="applySuggestedSurplus()">🧮 اقترح المبلغ تلقائي</button>
        </div>
        <div class="meta" style="margin-top:6px;">مجموع النسب الحالي: <b style="color:${tPct>100?'var(--danger)':'var(--text)'};">${tPct}%</b>${tPct<100?` (باقي ${100-tPct}% غير موزّع)`:''}</div>
      </div>
    ` + (db.investmentBuckets.length ? db.investmentBuckets.map(b=>{
      const progress = b.targetAmount>0 ? Math.min(100, Math.round((b.balance/b.targetAmount)*100)) : null;
      return `
        <div class="card" style="margin-top:8px;border-inline-start:4px solid ${b.color};">
          <div class="row"><h3>🌱 ${escapeHtml(b.name)}</h3><b>${Math.round(b.balance).toLocaleString('ar-EG')} ج.م</b></div>
          <div class="meta">${b.targetPct}% من كل فائض يُوزّع${b.targetAmount>0?` — الهدف ${Math.round(b.targetAmount).toLocaleString('ar-EG')} ج.م`:''}${b.linkInventory?' — 🔗 مربوط بالمخزون':''}</div>
          ${progress!=null ? `
            <div style="position:relative;height:8px;border-radius:99px;background:var(--card-alt);overflow:hidden;margin-top:6px;">
              <div style="position:absolute;inset-inline-start:0;top:0;bottom:0;width:${progress}%;background:${b.color};border-radius:99px;"></div>
            </div>` : ''}
          ${sparklineSvg(b.history, b.color)}
          <div class="btn-row" style="margin-top:6px;">
            <button class="btn sm outline" onclick="openWithdrawModal('${b.id}')">➖ سحب</button>
            <button class="btn sm secondary" onclick="openInvestmentBucketModal('${b.id}')">✏️ تعديل</button>
            <button class="btn sm danger" onclick="deleteInvestmentBucket('${b.id}')">🗑️ حذف</button>
          </div>
        </div>
      `;
    }).join('') : `<div class="empty-msg">لسه معندكش جيوب استثمار — ضيف أول واحد بالزرار +</div>`);
  };

  /* ---------- حقن الصفحة + رابط القائمة الجانبية ---------- */
  function injectInvestmentPage(){
    if(document.getElementById('page-investment')) return;
    const afterPage = document.getElementById('page-workers') || document.getElementById('page-finance');
    if(!afterPage) return;
    const section = document.createElement('section');
    section.className = 'page';
    section.id = 'page-investment';
    section.innerHTML = `
      <div class="section-title">🌱 تخطيط الاستثمار</div>
      <div class="alert-banner" style="margin-bottom:8px;">
        <span class="ic">ℹ️</span>
        <div>أداة تنظيم داخلي بس — بتوزّع الأرقام اللي إنت بتدخلها حسب نسب إنت حددتها، ومش بتحرّك فلوس حقيقية ولا بتدي نصيحة استثمار. القرار وتنفيذه (فتح شهادة، شراء ذهب...) برّه التطبيق تمامًا.</div>
      </div>
      <button class="btn outline" onclick="openInvestmentBucketModal()">➕ إضافة جيب استثمار</button>
      <div id="investmentBucketsList" style="margin-top:8px;"></div>
    `;
    afterPage.insertAdjacentElement('afterend', section);

    const sidenav = document.getElementById('sideNav');
    if(sidenav && !sidenav.querySelector('[data-page="investment"]')){
      const btn = document.createElement('button');
      btn.className = 'navbtn';
      btn.setAttribute('data-page','investment');
      btn.setAttribute('onclick',"showPage('investment');closeSideNav()");
      btn.innerHTML = '<span class="ic">🌱</span>الاستثمار';
      const workersBtn = sidenav.querySelector('[data-page="workers"]');
      if(workersBtn) workersBtn.insertAdjacentElement('afterend', btn);
      else sidenav.appendChild(btn);
    }

    if(typeof pageTitles==='object') pageTitles.investment = '🌱 الاستثمار';
    if(typeof fabPages==='object') fabPages.investment = false;
  }

  if(typeof renderAll === 'function'){
    const origRenderAll = renderAll;
    window.renderAll = function(){
      const r = origRenderAll.apply(this, arguments);
      if(document.getElementById('page-investment')) renderInvestmentPage();
      return r;
    };
  }

  document.addEventListener('DOMContentLoaded', function(){
    ensureInvestmentDefaults();
    injectInvestmentPage();
  });
})();


/* ===================== feature-financial-overview.js ===================== */
/* ============================================================
   feature-financial-overview.js
   صفحة جديدة "📊 نظرة مالية شاملة" تجمع:
   1) 💎 مؤشر صافي الثروة: صندوق الطوارئ + إجمالي جيوب الاستثمار
      + رصيد المخزون − إجمالي الأقساط المتبقية (الديون).
   2) 📐 نسبة كل جيب استثمار من صافي ربح السنة (تقديري: إجمالي
      المقبوضات هذا العام − تكلفة الخامة − مستحقات العمال).
   3) 📈 Sparkline لصافي الثروة عبر الشهور (لقطة شهرية تراكمية).
   ملف مستقل، بيتحمّل آخر واحد بعد feature-investment-plan.js
   و feature-inventory.js و feature-workers.js عشان يقرا من
   بياناتهم. مش بيلمس أي ملف تاني.
   ============================================================ */
(function(){

  function totalRemainingDebt(){
    return (db.commitments||[]).filter(c=>c.active!==false && c.type==='قسط' && c.remainingMonths!=null && c.remainingMonths>0)
      .reduce((s,c)=>s+Number(c.amount)*c.remainingMonths, 0);
  }

  function investmentBucketsTotal(){
    return (db.investmentBuckets||[]).reduce((s,b)=>s+Number(b.balance||0), 0);
  }

  function netWorth(){
    const emergency = Number(db.emergencyFundBalance||0);
    const inv = investmentBucketsTotal();
    const inventory = typeof db.inventoryValue==='number' ? db.inventoryValue : 0;
    const debt = totalRemainingDebt();
    return emergency + inv + inventory - debt;
  }

  function netProfitThisYear(){
    const year = todayStr().slice(0,4);
    const income = (db.payments||[]).filter(p=>p.date && p.date.slice(0,4)===year).reduce((s,p)=>s+Number(p.amount||0),0);
    const materialCosts = (db.orders||[]).filter(o=>o.dateReceived && o.dateReceived.slice(0,4)===year).reduce((s,o)=>s+Number(o.materialCost||0),0);
    const workerPay = (db.workerPayments||[]).filter(p=>p.date && p.date.slice(0,4)===year).reduce((s,p)=>s+Number(p.amount||0),0);
    return Math.max(0, income - materialCosts - workerPay);
  }

  function upsertNetWorthHistory(){
    if(!Array.isArray(db.netWorthHistory)) db.netWorthHistory = [];
    const ym = currentYM();
    const val = netWorth();
    const entry = db.netWorthHistory.find(h=>h.ym===ym);
    if(entry) entry.value = val;
    else db.netWorthHistory.push({ym, value:val});
    if(db.netWorthHistory.length>24) db.netWorthHistory = db.netWorthHistory.slice(-24);
    saveDB();
    return val;
  }

  function sparklineSvg(values, color){
    if(!values || values.length<2) return '';
    const min = Math.min(...values), max = Math.max(...values);
    const range = (max-min) || 1;
    const w = 200, h = 40, step = w/(values.length-1);
    const points = values.map((v,i)=> `${(i*step).toFixed(1)},${(h - ((v-min)/range)*h).toFixed(1)}`).join(' ');
    return `<svg width="${w}" height="${h}" style="display:block;margin-top:6px;"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="2.5"/></svg>`;
  }

  window.renderFinancialOverviewPage = function(){
    const box = document.getElementById('financialOverviewBody');
    if(!box) return;
    const nw = upsertNetWorthHistory();
    const history = (db.netWorthHistory||[]).map(h=>h.value);
    const profitYear = netProfitThisYear();
    const debt = totalRemainingDebt();
    const inventory = typeof db.inventoryValue==='number' ? db.inventoryValue : 0;
    const emergency = Number(db.emergencyFundBalance||0);
    const invTotal = investmentBucketsTotal();

    const bucketsHtml = (db.investmentBuckets||[]).length ? (db.investmentBuckets||[]).map(b=>{
      const pctOfProfit = profitYear>0 ? Math.round((b.balance/profitYear)*100) : null;
      return `
        <div class="row" style="margin-bottom:6px;">
          <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${b.color||'var(--primary)'};margin-inline-end:6px;"></span>${escapeHtml(b.name)}</span>
          <span>${Math.round(b.balance).toLocaleString('ar-EG')} ج.م${pctOfProfit!=null?` <span class="meta">(${pctOfProfit}% من ربح السنة)</span>`:''}</span>
        </div>
      `;
    }).join('') : `<div class="empty-msg">لسه معندكش جيوب استثمار</div>`;

    box.innerHTML = `
      <div class="card">
        <div class="row"><h3>💎 صافي الثروة التقديري</h3><b style="font-size:20px;color:${nw>=0?'var(--primary)':'var(--danger)'};">${Math.round(nw).toLocaleString('ar-EG')} ج.م</b></div>
        ${sparklineSvg(history, nw>=0?'var(--primary)':'var(--danger)')}
        <div class="meta" style="margin-top:6px;">= صندوق الطوارئ (${Math.round(emergency).toLocaleString('ar-EG')}) + جيوب الاستثمار (${Math.round(invTotal).toLocaleString('ar-EG')}) + المخزون (${Math.round(inventory).toLocaleString('ar-EG')}) − الأقساط المتبقية (${Math.round(debt).toLocaleString('ar-EG')})</div>
      </div>
      <div class="card" style="margin-top:8px;">
        <h3>📐 جيوب الاستثمار مقابل ربح السنة</h3>
        <div class="meta" style="margin-bottom:6px;">صافي ربح السنة التقديري: ${Math.round(profitYear).toLocaleString('ar-EG')} ج.م (مقبوضات − تكلفة خامة − مستحقات عمال)</div>
        ${bucketsHtml}
      </div>
    `;
  };

  function injectOverviewPage(){
    if(document.getElementById('page-financial-overview')) return;
    const afterPage = document.getElementById('page-investment') || document.getElementById('page-workers') || document.getElementById('page-finance');
    if(!afterPage) return;
    const section = document.createElement('section');
    section.className = 'page';
    section.id = 'page-financial-overview';
    section.innerHTML = `
      <div class="section-title">📊 نظرة مالية شاملة</div>
      <div id="financialOverviewBody"></div>
    `;
    afterPage.insertAdjacentElement('afterend', section);

    const sidenav = document.getElementById('sideNav');
    if(sidenav && !sidenav.querySelector('[data-page="financial-overview"]')){
      const btn = document.createElement('button');
      btn.className = 'navbtn';
      btn.setAttribute('data-page','financial-overview');
      btn.setAttribute('onclick',"showPage('financial-overview');closeSideNav()");
      btn.innerHTML = '<span class="ic">📊</span>نظرة مالية شاملة';
      const invBtn = sidenav.querySelector('[data-page="investment"]');
      if(invBtn) invBtn.insertAdjacentElement('afterend', btn);
      else sidenav.appendChild(btn);
    }

    if(typeof pageTitles==='object') pageTitles['financial-overview'] = '📊 نظرة مالية شاملة';
    if(typeof fabPages==='object') fabPages['financial-overview'] = false;
  }

  if(typeof renderAll === 'function'){
    const origRenderAll = renderAll;
    window.renderAll = function(){
      const r = origRenderAll.apply(this, arguments);
      if(document.getElementById('page-financial-overview')) renderFinancialOverviewPage();
      return r;
    };
  }

  document.addEventListener('DOMContentLoaded', function(){
    injectOverviewPage();
  });
})();


/* ===================== feature-daily-tips.js ===================== */
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

  // نصيحة اليوم لازم تفضل ثابتة طول اليوم حتى لو بيانات المستخدم اتغيرت
  // (مصروف جديد، التزام جديد...) وده بيغيّر تركيبة "pool()" الديناميكية.
  // فبنثبّت النص نفسه (مش الرقم بس) في db أول مرة نحسبه في اليوم ده.
  function todaysStableTip(){
    if(!db.dailyTipCache || db.dailyTipCache.date !== todayStr()){
      const p = pool();
      const idx = dayOfYear() % p.length;
      db.dailyTipCache = {date: todayStr(), text: p[idx]};
      saveDB();
    }
    return db.dailyTipCache.text;
  }

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
    const text = (manualIndex!=null) ? pool()[pickTipIndex() % pool().length] : todaysStableTip();
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


/* ===================== feature-whatif-simulator.js ===================== */
/* ============================================================
   feature-whatif-simulator.js
   بطاقة "🔮 محاكي ماذا لو" — تُضاف داخل صفحة "📊 نظرة مالية شاملة"
   (خيار الدمج، مش صفحة/زر مستقل). ملف مستقل مش بيلمس أي ملف
   تاني، بيحقن حاويته بعد #dailyTipCard (أو بعد #financialOverviewBody
   لو feature-daily-tips.js مش موجود) ويلف renderFinancialOverviewPage.

   السيناريوهات (بتقرا بيانات حقيقية من db بس متعملش أي تعديل
   عليها — كله حسابات مؤقتة في الذاكرة بس):
   1) زيادة/نقصان الدخل اليومي من الورشة
   2) إضافة التزام شهري جديد (قسط، اشتراك...)
   3) تقليل مصروف البيت بنسبة معينة
   4) أخذ تمويل/قرض (مبلغ + عدد شهور) وتأثيره على الاحتياج اليومي
   ============================================================ */
(function(){

  const SCENARIOS = {
    income: {label:'💰 تغيّر الدخل اليومي من الورشة', inputs:[
      {id:'sc_incomeDelta', label:'التغيّر في الدخل اليومي (ج.م) — بالسالب لو نقصان', type:'number', placeholder:'مثال: 100 أو -50'}
    ]},
    newCommit: {label:'➕ إضافة التزام شهري جديد', inputs:[
      {id:'sc_commitAmount', label:'قيمة الالتزام شهريًا (ج.م)', type:'number', placeholder:'مثال: 300'}
    ]},
    houseCut: {label:'🏠 تقليل مصروف البيت', inputs:[
      {id:'sc_houseCutPct', label:'نسبة التقليل (%)', type:'number', placeholder:'مثال: 20'}
    ]},
    loan: {label:'🏦 أخذ تمويل / قرض جديد', inputs:[
      {id:'sc_loanAmount', label:'مبلغ التمويل (ج.م)', type:'number', placeholder:'مثال: 6000'},
      {id:'sc_loanMonths', label:'عدد شهور السداد', type:'number', placeholder:'مثال: 12'}
    ]}
  };

  function currentReq(){
    try{ return calcRequiredDailyCapacity(); }catch(e){ return null; }
  }

  function fmt(n){ return Math.round(n).toLocaleString('ar-EG'); }

  function computeScenario(key){
    const r = currentReq();
    if(!r) return null;
    const currentCapacity = Number(db.dailyCapacity)||500;
    let newTotal = r.total;
    let note = '';

    if(key==='income'){
      const delta = Number(document.getElementById('sc_incomeDelta')?.value)||0;
      const newCapacity = currentCapacity + delta;
      const diffBefore = r.total - currentCapacity;
      const diffAfter = r.total - newCapacity;
      return {
        beforeLabel:'دخلك اليومي الحالي', beforeVal:currentCapacity,
        afterLabel:'دخلك اليومي بعد التغيير', afterVal:newCapacity,
        extraLine:`احتياجك اليومي الثابت (${fmt(r.total)} ج.م) هيفضل زي ما هو. ${diffAfter<=0?'هتغطي احتياجك بالكامل ويفضل معاك فائض.':`هيفضل عليك نقص قدره ${fmt(Math.abs(diffAfter))} ج.م يوميًا.`}`,
        good: diffAfter<=0
      };
    }

    if(key==='newCommit'){
      const amount = Number(document.getElementById('sc_commitAmount')?.value)||0;
      const newMonthlyCommitments = r.monthlyCommitments + amount;
      const newCommitmentsPerDay = (newMonthlyCommitments + r.loanMonthly) / r.wdays;
      newTotal = newCommitmentsPerDay + r.housePerDay;
      return {
        beforeLabel:'احتياجك اليومي الحالي', beforeVal:r.total,
        afterLabel:'احتياجك اليومي بعد الالتزام الجديد', afterVal:newTotal,
        extraLine:`ده هيزوّد احتياجك اليومي بحوالي ${fmt(newTotal-r.total)} ج.م. دخلك الحالي (${fmt(currentCapacity)} ج.م) ${newTotal>currentCapacity?'مش هيكفي — هيبقى عليك عجز يومي.':'لسه كافي.'}`,
        good: newTotal<=currentCapacity
      };
    }

    if(key==='houseCut'){
      const pct = Math.min(100, Math.max(0, Number(document.getElementById('sc_houseCutPct')?.value)||0));
      const newHouseTotal = r.houseTotal * (1-pct/100);
      const newHousePerDay = newHouseTotal/30;
      newTotal = r.commitmentsPerDay + newHousePerDay;
      const monthlySavings = r.houseTotal - newHouseTotal;
      return {
        beforeLabel:'احتياجك اليومي الحالي', beforeVal:r.total,
        afterLabel:'احتياجك اليومي بعد التقليل', afterVal:newTotal,
        extraLine:`ده هيوفرلك حوالي ${fmt(monthlySavings)} ج.م في الشهر (${fmt(monthlySavings*12)} ج.م في السنة).`,
        good: true
      };
    }

    if(key==='loan'){
      const amount = Number(document.getElementById('sc_loanAmount')?.value)||0;
      const months = Math.max(1, Number(document.getElementById('sc_loanMonths')?.value)||1);
      const monthly = amount/months;
      const newMonthlyCommitments = r.monthlyCommitments + monthly;
      const newCommitmentsPerDay = (newMonthlyCommitments + r.loanMonthly) / r.wdays;
      newTotal = newCommitmentsPerDay + r.housePerDay;
      return {
        beforeLabel:'احتياجك اليومي الحالي', beforeVal:r.total,
        afterLabel:'احتياجك اليومي بعد القسط', afterVal:newTotal,
        extraLine:`القسط الشهري هيكون حوالي ${fmt(monthly)} ج.م. دخلك الحالي (${fmt(currentCapacity)} ج.م) ${newTotal>currentCapacity?'مش هيكفي مع القسط ده — فكّر تاني قبل ما تاخده.':'لسه كافي حتى مع القسط ده.'}`,
        good: newTotal<=currentCapacity
      };
    }
    return null;
  }

  function renderInputs(key){
    const s = SCENARIOS[key];
    if(!s) return '';
    return s.inputs.map(i=>`
      <div class="field"><label>${i.label}</label><input id="${i.id}" type="${i.type}" placeholder="${i.placeholder||''}"></div>
    `).join('');
  }

  window.onWhatifScenarioChange = function(){
    const key = document.getElementById('whatifScenarioSelect')?.value;
    const box = document.getElementById('whatifInputsBox');
    const result = document.getElementById('whatifResultBox');
    if(box) box.innerHTML = renderInputs(key);
    if(result) result.innerHTML = '';
  };

  window.runWhatifSimulation = function(){
    const key = document.getElementById('whatifScenarioSelect')?.value;
    const result = document.getElementById('whatifResultBox');
    if(!result) return;
    const r = computeScenario(key);
    if(!r){
      result.innerHTML = `<div class="empty-msg">محتاج تسجّل بيانات ماليتك (التزامات / مصروف بيت / دخل يومي) الأول عشان المحاكي يقدر يحسب.</div>`;
      return;
    }
    const maxVal = Math.max(r.beforeVal, r.afterVal, 1);
    const beforePct = Math.max(2, Math.round((Math.max(0,r.beforeVal)/maxVal)*100));
    const afterPct = Math.max(2, Math.round((Math.max(0,r.afterVal)/maxVal)*100));
    result.innerHTML = `
      <div class="card" style="margin-top:8px;${r.good?'':'border-right:4px solid var(--danger);'}">
        <div class="meta">${r.beforeLabel}</div>
        <div style="position:relative;height:14px;border-radius:99px;background:var(--card-alt);overflow:hidden;margin:4px 0 8px;">
          <div style="position:absolute;inset-inline-start:0;top:0;bottom:0;width:${beforePct}%;background:var(--text);opacity:.35;border-radius:99px;"></div>
        </div>
        <div class="row"><span class="meta">قبل</span><b>${fmt(r.beforeVal)} ج.م</b></div>
        <div class="meta" style="margin-top:8px;">${r.afterLabel}</div>
        <div style="position:relative;height:14px;border-radius:99px;background:var(--card-alt);overflow:hidden;margin:4px 0 8px;">
          <div style="position:absolute;inset-inline-start:0;top:0;bottom:0;width:${afterPct}%;background:${r.good?'var(--primary)':'var(--danger)'};border-radius:99px;"></div>
        </div>
        <div class="row"><span class="meta">بعد</span><b style="color:${r.good?'var(--primary)':'var(--danger)'};">${fmt(r.afterVal)} ج.م</b></div>
        <div class="meta" style="margin-top:8px;line-height:1.8;">${r.extraLine}</div>
      </div>
    `;
  };

  function renderWhatifCard(){
    const box = document.getElementById('whatifSimulatorCard');
    if(!box) return;
    const currentKey = document.getElementById('whatifScenarioSelect')?.value || 'income';
    const optionsHtml = Object.keys(SCENARIOS).map(k=>`<option value="${k}" ${k===currentKey?'selected':''}>${SCENARIOS[k].label}</option>`).join('');
    box.innerHTML = `
      <div class="card">
        <div class="row"><h3>🔮 محاكي "ماذا لو"</h3></div>
        <div class="meta" style="margin-bottom:6px;">جرّب سيناريو مالي قبل ما تقرر فعليًا — الأرقام هنا تقديرية بس ومبنية على بياناتك الحالية.</div>
        <div class="field"><label>اختر السيناريو</label>
          <select id="whatifScenarioSelect" onchange="onWhatifScenarioChange()">${optionsHtml}</select>
        </div>
        <div id="whatifInputsBox">${renderInputs(currentKey)}</div>
        <button class="btn sm outline" onclick="runWhatifSimulation()">🧮 احسب التأثير</button>
        <div id="whatifResultBox"></div>
      </div>
    `;
  }

  function injectContainer(){
    if(document.getElementById('whatifSimulatorCard')) return;
    const afterTip = document.getElementById('dailyTipCard');
    const anchor = afterTip || document.getElementById('financialOverviewBody');
    if(!anchor) return;
    const div = document.createElement('div');
    div.id = 'whatifSimulatorCard';
    div.style.marginTop = '8px';
    anchor.insertAdjacentElement('afterend', div);
  }

  function hookRender(){
    if(typeof window.renderFinancialOverviewPage === 'function'){
      const orig = window.renderFinancialOverviewPage;
      window.renderFinancialOverviewPage = function(){
        const r = orig.apply(this, arguments);
        // متعملش إعادة رسم كاملة لو المستخدم شغّال في الأدخالات دلوقتي، بس أول مرة لازم تتحقن
        if(!document.getElementById('whatifSimulatorCard')) injectContainer();
        if(!document.getElementById('whatifScenarioSelect')) renderWhatifCard();
        return r;
      };
    }
  }

  function boot(){
    injectContainer();
    renderWhatifCard();
    hookRender();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();


/* ===================== feature-referrals.js ===================== */
/* ============================================================
   feature-referrals.js
   نظام "🔗 تتبع مين رشّح مين" — النسخة الكاملة:
   1) حقل اختياري في نموذج العميل: "مين رشّحه؟" (اسم عميل موجود
      أو مصدر حر زي "سوشيال ميديا"). بيتربط تلقائيًا بعميل موجود
      لو الاسم مطابق، وإلا بيتسجل كنص مصدر حر.
   2) في صفحة/سجل كل عميل: يظهر مين رشّحه، وقائمة العملاء اللي
      هو رشّحهم + إجمالي قيمة إنفاقهم (Attribution).
   3) لوحة "🏆 أفضل المُرشِّحين" أعلى صفحة العملاء، مرتبة حسب
      عدد الإحالات أو القيمة المالية.
   4) نظام مكافآت: تسجيل مكافأة لعميل رشّح غيره (نوع + تاريخ +
      ملاحظة)، مع تنبيه لو رشّح 3+ ولسه ما اتكافأش.
   ملف مستقل، بيلف (wrap) openCustomerModal / saveCustomer /
   openCustomerHistory / renderCustomers الموجودين في core.js
   بدون ما يعدّل فيهم مباشرة.
   ============================================================ */
(function(){

  function ensureDefaults(){
    if(!Array.isArray(db.referralRewards)) db.referralRewards = [];
    db.customers.forEach(c=>{
      if(c.referredById===undefined) c.referredById = null;
      if(c.referralSourceText===undefined) c.referralSourceText = '';
    });
  }

  function referredCustomers(customerId){
    return db.customers.filter(c=>c.referredById===customerId);
  }

  function customerTotalSpent(customerId){
    return db.orders.filter(o=>o.customerId===customerId).reduce((s,o)=>s+(Number(o.paid)||0),0);
  }

  function referralStats(customerId){
    const list = referredCustomers(customerId);
    const totalValue = list.reduce((s,c)=>s+customerTotalSpent(c.id), 0);
    return {count:list.length, list, totalValue};
  }

  function rewardsFor(customerId){
    return (db.referralRewards||[]).filter(r=>r.customerId===customerId).sort((a,b)=>b.date.localeCompare(a.date));
  }

  /* ---------- 1) حقل "مين رشّحه؟" في نموذج العميل ---------- */

  function injectReferralField(existingCustomer){
    const wrapAfter = document.getElementById('f_family');
    const fieldWrap = wrapAfter ? wrapAfter.closest('.field') : null;
    if(!fieldWrap || document.getElementById('f_referredBy')) return;

    const others = db.customers.filter(c=>!existingCustomer || c.id!==existingCustomer.id);
    let currentVal = '';
    if(existingCustomer){
      if(existingCustomer.referredById){
        const ref = customerById(existingCustomer.referredById);
        currentVal = ref ? ref.name : '';
      } else if(existingCustomer.referralSourceText){
        currentVal = existingCustomer.referralSourceText;
      }
    }

    const html = `
      <div class="field" id="referralFieldWrap">
        <label>🔗 مين رشّحه؟ (اسم عميل موجود، أو مصدر زي: سوشيال ميديا — اختياري)</label>
        <input id="f_referredBy" list="referralDatalist" value="${currentVal ? escapeHtml(currentVal) : ''}" placeholder="مثال: محمد أحمد أو سوشيال ميديا">
        <datalist id="referralDatalist">${others.map(c=>`<option value="${escapeHtml(c.name)}">`).join('')}</datalist>
      </div>
    `;
    fieldWrap.insertAdjacentHTML('afterend', html);
  }

  function hookCustomerModal(){
    if(typeof window.openCustomerModal !== 'function') return;
    const orig = window.openCustomerModal;
    window.openCustomerModal = function(id){
      const r = orig.apply(this, arguments);
      setTimeout(()=>{
        ensureDefaults();
        injectReferralField(id ? customerById(id) : null);
      }, 30);
      return r;
    };
  }

  function resolveReferralInput(rawValue, selfId){
    const text = (rawValue||'').trim();
    if(!text) return {referredById:null, referralSourceText:''};
    const match = db.customers.find(c=>c.id!==selfId && c.name.trim().toLowerCase()===text.toLowerCase());
    if(match) return {referredById:match.id, referralSourceText:''};
    return {referredById:null, referralSourceText:text};
  }

  function hookSaveCustomer(){
    if(typeof window.saveCustomer !== 'function') return;
    const orig = window.saveCustomer;
    window.saveCustomer = async function(id){
      const el = document.getElementById('f_referredBy');
      const rawValue = el ? el.value : null;
      const beforeIds = new Set(db.customers.map(c=>c.id));
      const r = await orig.apply(this, arguments);
      // لو المودال لسه مفتوح بعد ما انتظرنا orig، يبقى الحفظ ما اتمّش فعليًا
      // (المستخدم ألغى نافذة التأكيد، أو فشل تحقق زي رقم هاتف غير صحيح) —
      // في الحالة دي المفروض متتغيّرش بيانات الإحالة خالص
      const ov = document.getElementById('modalOverlay');
      const saveDidNotHappen = ov && ov.classList.contains('active');
      if(rawValue===null || saveDidNotHappen) return r;
      let targetId = id;
      if(!targetId){
        const added = db.customers.find(c=>!beforeIds.has(c.id));
        if(added) targetId = added.id;
      }
      if(targetId){
        const c = customerById(targetId);
        if(c){
          const resolved = resolveReferralInput(rawValue, targetId);
          // لو المستخدم مرشحش حد (referredById===null بعد الحل) ولا كتب مصدر، يبقى منع الدوائر: عميل مايرشحش نفسه
          if(resolved.referredById===targetId){ resolved.referredById=null; }
          c.referredById = resolved.referredById;
          c.referralSourceText = resolved.referralSourceText;
          saveDB();
        }
      }
      return r;
    };
  }

  /* ---------- 2) قسم الإحالات داخل سجل العميل ---------- */

  window.openGiveRewardModal = function(customerId){
    const c = customerById(customerId);
    if(!c) return;
    const html = `
      <div class="modal-head"><h3>🎁 منح مكافأة إحالة لـ ${escapeHtml(c.name)}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
      <div class="field"><label>نوع المكافأة</label>
        <select id="f_rewardType">
          <option value="خصم">خصم على الطلب القادم</option>
          <option value="هدية">هدية</option>
          <option value="تفصيلة مجانية">تفصيلة مجانية</option>
          <option value="أخرى">أخرى</option>
        </select>
      </div>
      <div class="field"><label>ملاحظة (اختياري)</label><input id="f_rewardNote" placeholder="مثال: خصم 10% على الطلب الجاي"></div>
      <button class="btn" onclick="saveReferralReward('${customerId}')">💾 حفظ المكافأة</button>
    `;
    openModal(html);
  };

  window.saveReferralReward = function(customerId){
    ensureDefaults();
    const type = document.getElementById('f_rewardType').value;
    const note = document.getElementById('f_rewardNote').value.trim();
    db.referralRewards.unshift({id:uid(), customerId, type, note, date:todayStr()});
    saveDB();
    closeModal();
    toast('✅ اتسجلت المكافأة');
    if(typeof window.openCustomerHistory==='function') window.openCustomerHistory(customerId);
  };

  window.deleteReferralReward = function(rewardId, customerId){
    db.referralRewards = (db.referralRewards||[]).filter(r=>r.id!==rewardId);
    saveDB();
    if(typeof window.openCustomerHistory==='function') window.openCustomerHistory(customerId);
  };

  function referralSectionHtml(customerId){
    ensureDefaults();
    const c = customerById(customerId);
    if(!c) return '';
    const stats = referralStats(customerId);
    const rewards = rewardsFor(customerId);

    let referredByLine = '';
    if(c.referredById){
      const ref = customerById(c.referredById);
      if(ref) referredByLine = `<div class="meta">🔗 رشّحه: <b>${escapeHtml(ref.name)}</b></div>`;
    } else if(c.referralSourceText){
      referredByLine = `<div class="meta">🔗 مصدر المعرفة: <b>${escapeHtml(c.referralSourceText)}</b></div>`;
    }

    const referredListHtml = stats.count ? stats.list.map(rc=>`
      <div class="row" style="margin-bottom:4px;">
        <span>${escapeHtml(rc.name)}</span>
        <span class="meta">${customerTotalSpent(rc.id).toLocaleString('ar-EG')} ج.م</span>
      </div>
    `).join('') : `<div class="empty-msg">لسه ما رشّحش حد</div>`;

    const rewardsHtml = rewards.length ? rewards.map(r=>`
      <div class="row" style="margin-bottom:4px;">
        <span class="meta">${fmtDate(r.date)} — ${escapeHtml(r.type)}${r.note?` (${escapeHtml(r.note)})`:''}</span>
        <button class="btn sm outline" style="padding:2px 8px;" onclick="deleteReferralReward('${r.id}','${customerId}')">حذف</button>
      </div>
    `).join('') : '';

    const unrewardedAlert = (stats.count>=3 && rewards.length===0) ? `
      <div class="alert-banner warn" style="margin:8px 0;">
        <span class="ic">🎁</span>
        <div>${escapeHtml(c.name)} رشّح ${stats.count} عملاء ولسه ما أخدش أي مكافأة.</div>
      </div>
    ` : '';

    return `
      <div class="section-title" style="margin-top:14px;">🔗 الإحالات</div>
      ${unrewardedAlert}
      <div class="card">
        ${referredByLine || '<div class="meta">🔗 المصدر: غير معروف</div>'}
        <div class="row" style="margin-top:6px;"><h3>👥 عملاء رشّحهم ${escapeHtml(c.name)}</h3><b>${stats.count}</b></div>
        <div class="meta" style="margin-bottom:6px;">إجمالي قيمة إنفاقهم: <b>${stats.totalValue.toLocaleString('ar-EG')} ج.م</b></div>
        ${referredListHtml}
        <div class="btn-row" style="margin-top:8px;">
          <button class="btn sm secondary" onclick="openGiveRewardModal('${customerId}')">🎁 امنح مكافأة</button>
        </div>
        ${rewardsHtml ? `<div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--card-alt);">${rewardsHtml}</div>` : ''}
      </div>
    `;
  }

  function hookCustomerHistory(){
    if(typeof window.openCustomerHistory !== 'function') return;
    const orig = window.openCustomerHistory;
    window.openCustomerHistory = function(id){
      const r = orig.apply(this, arguments);
      const box = document.getElementById('modalBox');
      if(box) box.insertAdjacentHTML('beforeend', referralSectionHtml(id));
      return r;
    };
  }

  /* ---------- 3) لوحة أفضل المُرشِّحين ---------- */

  let leaderboardSortMode = 'count'; // count | value

  window.toggleReferralLeaderboardSort = function(){
    leaderboardSortMode = leaderboardSortMode==='count' ? 'value' : 'count';
    renderReferralLeaderboard();
  };

  function renderReferralLeaderboard(){
    const box = document.getElementById('referralLeaderboardCard');
    if(!box) return;
    ensureDefaults();
    let rows = db.customers.map(c=>{
      const stats = referralStats(c.id);
      return {c, ...stats};
    }).filter(r=>r.count>0);

    if(!rows.length){
      box.innerHTML = '';
      return;
    }

    rows.sort((a,b)=> leaderboardSortMode==='count' ? (b.count-a.count) : (b.totalValue-a.totalValue));
    rows = rows.slice(0,5);

    box.innerHTML = `
      <div class="card" style="margin-bottom:12px;">
        <div class="row"><h3>🏆 أفضل المُرشِّحين</h3>
          <button class="btn sm outline" style="padding:3px 10px;" onclick="toggleReferralLeaderboardSort()">↻ ${leaderboardSortMode==='count'?'ترتيب بالقيمة':'ترتيب بالعدد'}</button>
        </div>
        ${rows.map((r,i)=>`
          <div class="row" style="margin-bottom:4px;">
            <span>${i+1}. ${escapeHtml(r.c.name)}</span>
            <span class="meta">${leaderboardSortMode==='count' ? `${r.count} إحالة` : `${r.totalValue.toLocaleString('ar-EG')} ج.م`}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  function injectLeaderboardContainer(){
    if(document.getElementById('referralLeaderboardCard')) return;
    const list = document.getElementById('customersList');
    if(!list) return;
    const div = document.createElement('div');
    div.id = 'referralLeaderboardCard';
    list.insertAdjacentElement('beforebegin', div);
  }

  function hookRenderCustomers(){
    if(typeof window.renderCustomers !== 'function') return;
    const orig = window.renderCustomers;
    window.renderCustomers = function(){
      const r = orig.apply(this, arguments);
      injectLeaderboardContainer();
      renderReferralLeaderboard();
      return r;
    };
  }

  function boot(){
    ensureDefaults();
    hookCustomerModal();
    hookSaveCustomer();
    hookCustomerHistory();
    hookRenderCustomers();
    injectLeaderboardContainer();
    renderReferralLeaderboard();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();


/* ===================== feature-home-dashboard.js ===================== */
/* ============================================================
   feature-home-dashboard.js
   🏠 لوحة تحكم سريعة أعلى الصفحة الرئيسية: 4 مؤشرات في بطاقة واحدة
   بدل ما المستخدم يفتح صفحات متفرقة كل مرة:
   1) 💰 صافي اليوم — إيراد النهاردة مقابل الحد الأدنى المطلوب
   2) 📅 أقرب تسليم — أقرب طلب لسه هيتسلّم
   3) ⚠️ أهم تنبيه — أهم حاجة تستاهل انتباه دلوقتي (متأخر/عجز/التزام)
   4) 💡 نصيحة اليوم — نفس نصيحة اليوم من feature-daily-tips.js
   كل مؤشر قابل للنقر وبيودّي لصفحته. ملف مستقل، بيلف renderHome
   وبيحقن حاويته أعلى صفحة الرئيسية، مش بيلمس أي ملف تاني.
   ============================================================ */
(function(){

  function todayRevenue(){
    const today = todayStr();
    return (db.payments||[]).filter(p=>p.date===today).reduce((s,p)=>s+Number(p.amount||0),0);
  }

  function requiredToday(){
    try{ return calcRequiredDailyCapacity().total; }catch(e){ return null; }
  }

  function nearestDelivery(){
    const upcoming = (db.orders||[]).filter(o=>o.status!=='تم التسليم')
      .sort((a,b)=>(a.dateDelivery||'').localeCompare(b.dateDelivery||''));
    return upcoming[0] || null;
  }

  // بيختار أهم تنبيه واحد بس حسب أولوية: متأخر > عجز يومي كبير > التزام قرب يخلص > مفيش تنبيهات
  function topAlert(){
    const lateCount = (db.orders||[]).filter(typeof isOverdue==='function' ? isOverdue : ()=>false).length;
    if(lateCount>0){
      return {text:`⏰ عندك ${lateCount} طلب متأخر عن التسليم`, action:()=>showPage('orders'), tone:'danger'};
    }
    const req = requiredToday();
    if(req!=null){
      const capacity = Number(db.dailyCapacity)||500;
      const rev = todayRevenue();
      const stillNeeded = req - rev;
      if(stillNeeded > capacity*0.5){
        return {text:`📉 لسه محتاج تحصّل ${Math.ceil(stillNeeded).toLocaleString('ar-EG')} ج.م النهاردة`, action:()=>showPage('personal'), tone:'warn'};
      }
    }
    if(typeof endingSoonCommitments==='function'){
      const ending = endingSoonCommitments();
      if(ending && ending.length){
        return {text:`🔔 ${ending.length} التزام هيخلص خلال شهرين`, action:()=>showPage('personal'), tone:'warn'};
      }
    }
    return {text:'✅ مفيش تنبيهات — كله تمام', action:null, tone:'ok'};
  }

  function dailyTipShort(){
    if(db.dailyTipCache && db.dailyTipCache.date===todayStr() && db.dailyTipCache.text){
      const t = db.dailyTipCache.text;
      return t.length>60 ? t.slice(0,58)+'…' : t;
    }
    return null;
  }

  function toneColor(tone){
    if(tone==='danger') return 'var(--danger)';
    if(tone==='warn') return 'var(--warn)';
    return 'var(--primary)';
  }

  function renderDashboard(){
    const box = document.getElementById('homeDashboardCard');
    if(!box) return;

    const rev = todayRevenue();
    const req = requiredToday();
    const revOk = req==null ? true : rev>=req;
    const nd = nearestDelivery();
    const alert = topAlert();
    const tip = dailyTipShort();

    const revenueCell = `
      <div class="dash-cell" onclick="showPage('personal')" style="cursor:pointer;">
        <div class="dash-lbl">💰 صافي اليوم</div>
        <div class="dash-val" style="color:${revOk?'var(--primary)':'var(--danger)'};">${rev.toLocaleString('ar-EG')} ج.م</div>
        ${req!=null ? `<div class="dash-sub">من ${Math.ceil(req).toLocaleString('ar-EG')} مطلوب</div>` : ''}
      </div>
    `;

    const deliveryCell = nd ? (()=>{
      const c = customerById(nd.customerId);
      return `
        <div class="dash-cell" onclick="showPage('orders')" style="cursor:pointer;">
          <div class="dash-lbl">📅 أقرب تسليم</div>
          <div class="dash-val" style="font-size:14px;">${c?escapeHtml(c.name):'عميل محذوف'}</div>
          <div class="dash-sub">${fmtDate(nd.dateDelivery)}</div>
        </div>
      `;
    })() : `
      <div class="dash-cell">
        <div class="dash-lbl">📅 أقرب تسليم</div>
        <div class="dash-sub">لا يوجد طلبات قيد العمل</div>
      </div>
    `;

    const alertCell = `
      <div class="dash-cell" ${alert.action?'style="cursor:pointer;"':''} ${alert.action?`onclick="window.__dashAlertAction && window.__dashAlertAction()"`:''}>
        <div class="dash-lbl">⚠️ أهم تنبيه</div>
        <div class="dash-val" style="font-size:13px;color:${toneColor(alert.tone)};line-height:1.5;">${escapeHtml(alert.text)}</div>
      </div>
    `;
    window.__dashAlertAction = alert.action || null;

    const tipCell = tip ? `
      <div class="dash-cell" onclick="showPage('financial-overview')" style="cursor:pointer;">
        <div class="dash-lbl">💡 نصيحة اليوم</div>
        <div class="dash-val" style="font-size:12.5px;font-weight:600;line-height:1.5;">${escapeHtml(tip)}</div>
      </div>
    ` : `
      <div class="dash-cell" onclick="showPage('financial-overview')" style="cursor:pointer;">
        <div class="dash-lbl">💡 نصيحة اليوم</div>
        <div class="dash-sub">افتح "نظرة مالية شاملة" لتشوفها</div>
      </div>
    `;

    box.innerHTML = `
      <div class="card" id="homeDashboardInner">
        <div class="dash-grid">
          ${revenueCell}
          ${deliveryCell}
          ${alertCell}
          ${tipCell}
        </div>
      </div>
    `;
  }

  function injectStyles(){
    if(document.getElementById('homeDashboardStyles')) return;
    const style = document.createElement('style');
    style.id = 'homeDashboardStyles';
    style.textContent = `
      .dash-grid{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }
      .dash-cell{ background:var(--card-alt); border-radius:12px; padding:10px 12px; min-height:64px; }
      .dash-lbl{ font-size:11.5px; opacity:.7; margin-bottom:4px; font-weight:700; }
      .dash-val{ font-size:16px; font-weight:800; }
      .dash-sub{ font-size:11.5px; opacity:.65; margin-top:2px; }
    `;
    document.head.appendChild(style);
  }

  function injectContainer(){
    if(document.getElementById('homeDashboardCard')) return;
    const anchor = document.getElementById('homeQuickActionsWrap');
    if(!anchor) return;
    const div = document.createElement('div');
    div.id = 'homeDashboardCard';
    div.style.marginBottom = '12px';
    anchor.insertAdjacentElement('beforebegin', div);
  }

  function hookRenderHome(){
    if(typeof window.renderHome !== 'function') return;
    const orig = window.renderHome;
    window.renderHome = function(){
      const r = orig.apply(this, arguments);
      injectContainer();
      renderDashboard();
      return r;
    };
  }

  function boot(){
    injectStyles();
    injectContainer();
    hookRenderHome();
    if(document.getElementById('page-home')) renderDashboard();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();


/* ===================== feature-changelog.js ===================== */
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


