'use strict';
/* XSchool views : tableaux de bord + ecrans (eleves, notes, finance, emploi du temps, presences, bulletins, parametres). */
  // ---------- DASHBOARDS ----------
  // Bannière de notification : alertes d'absences répétées (générées par le moteur auto).
  function absenceAlertBanner(){
    if(typeof archiveOldAlerts==='function') archiveOldAlerts();
    const all=(typeof ALERTS!=='undefined'?ALERTS:[]).filter(a=>a&&a.auto&&a.kind==='absence'&&!a.read&&!a.archived);
    if(!all.length) return '';
    // classe de chaque alerte (via l'élève) pour le filtre
    const clsOf=a=>{ const e=DB.students.find(s=>s.id===a.stu); return e&&e.cls?e.cls:''; };
    const clsIds=[...new Set(all.map(clsOf).filter(Boolean))];
    let flt=state.alBannerCls||'all';
    if(flt!=='all'&&!clsIds.includes(flt)){ flt='all'; state.alBannerCls='all'; }
    const list=flt==='all'?all:all.filter(a=>clsOf(a)===flt);
    const n=list.length;
    // puces de filtre par classe (affichées seulement si >1 classe concernée)
    const chip=(id,label,cnt)=>'<button data-albflt="'+id+'" class="px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition '+(flt===id?'bg-rose-600 text-white':'bg-white/70 dark:bg-slate-900/50 text-rose-700 dark:text-rose-200 border border-rose-200 dark:border-rose-500/30')+'">'+escH(label)+'<span class="ml-1 opacity-70">'+cnt+'</span></button>';
    const chips=clsIds.length>1
      ? '<div class="flex gap-1.5 overflow-x-auto no-scrollbar mt-3">'
        +chip('all','Toutes',all.length)
        +clsIds.map(id=>chip(id,clsLabel(id),all.filter(a=>clsOf(a)===id).length)).join('')
        +'</div>'
      : '';
    const items=list.slice(0,3).map(a=>'<li class="flex items-start gap-2"><span class="mt-1 w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span><span class="min-w-0"><span class="font-semibold">'+escH(a.target)+'</span> <span class="opacity-80">· '+escH(a.msg)+'</span></span></li>').join('');
    const more=n>3?'<p class="text-[11px] text-rose-600/80 dark:text-rose-300/80 mt-1 pl-3.5">+'+(n-3)+' autre(s)…</p>':'';
    const emptyFlt=n===0?'<p class="text-xs text-rose-600/80 dark:text-rose-300/80 mt-3 pl-0.5">Aucune alerte pour cette classe.</p>':'';
    // pied : archivage auto (option) + marquer comme lu (selon la classe filtrée)
    const readLabel=flt==='all'?'Tout marquer comme lu':'Marquer « '+escH(clsLabel(flt))+' » comme lu';
    const archOn=(typeof ABS_ALERT_AUTO_ARCHIVE==='undefined')?true:ABS_ALERT_AUTO_ARCHIVE;
    const archDays=(typeof ABS_ALERT_ARCHIVE_DAYS==='undefined')?7:ABS_ALERT_ARCHIVE_DAYS;
    const archToggle='<button data-albarch="1" class="inline-flex items-center gap-1.5 text-[11px] font-semibold '+(archOn?'text-rose-700 dark:text-rose-200':'text-slate-400')+'"><span class="relative w-7 h-4 rounded-full transition '+(archOn?'bg-rose-500':'bg-slate-300 dark:bg-slate-600')+'"><span class="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all '+(archOn?'left-3.5':'left-0.5')+'"></span></span>Archivage auto après '+archDays+' j</button>';
    const footer=n>0?'<div class="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-rose-200/70 dark:border-rose-500/20">'+archToggle+'<button data-albread="'+flt+'" class="text-[11px] font-bold text-rose-700 dark:text-rose-200 bg-white/70 dark:bg-slate-900/40 border border-rose-200 dark:border-rose-500/30 px-3 py-1.5 rounded-full active:scale-95 transition">✓ '+readLabel+'</button></div>':'';
    return '<div class="card-in rounded-2xl p-4 mt-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 shadow-soft">'
      +'<div class="flex items-center gap-3">'
        +'<span class="relative w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300 grid place-items-center shrink-0">'+svg(I.bell)
          +'<span class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold grid place-items-center">'+all.length+'</span></span>'
        +'<div class="flex-1 min-w-0"><p class="text-sm font-bold text-rose-700 dark:text-rose-200">Absences répétées — '+all.length+' alerte(s)</p>'
          +'<p class="text-[11px] text-rose-600/80 dark:text-rose-300/80">Élèves ayant atteint le seuil d’absences — parents à notifier.</p></div>'
        +'<button data-go="notify" class="text-xs font-bold text-white bg-rose-600 px-3 py-1.5 rounded-full active:scale-95 transition shrink-0">Traiter</button>'
      +'</div>'
      +chips
      +'<ul class="mt-3 space-y-1 text-xs text-rose-800 dark:text-rose-100">'+items+'</ul>'+more+emptyFlt+footer
    +'</div>';
  }
  function dash(role){
    const actCyc=activeCycles();
    const perTypes=[...new Set(actCyc.map(c=>cyclePeriodType(c)))];
    const curPeriod = perTypes.length>1 ? 'Trim./Sem. (selon cycle)' : (perTypes[0]==='semestre'?'Semestrielle':'Trimestrielle');
    const hero = (name,sub)=>`<div class="rounded-2xl p-5 bg-gradient-to-br from-brand-800 to-brand-900 text-white shadow-soft card-in">
        <p class="text-sm opacity-80">Bonjour,</p><p class="text-2xl font-extrabold">${name}</p>
        <p class="text-xs opacity-80 mt-1">${sub}</p>
        <div class="mt-4 flex gap-2">${badge('Année '+state.year,'bg-white/20')}${badge(curPeriod,'bg-white/20')}</div></div>`;
    const grid = html => `<div class="grid grid-cols-2 gap-3 mt-4 lg:grid-cols-4">${html}</div>`;
    if(role==='super'){
      const incidents=LOGS.filter(l=>l.level==='error').length;
      const dotC=l=>({ok:'bg-emerald-500',warn:'bg-amber-500',error:'bg-rose-500',info:'bg-slate-400'}[l]||'bg-slate-400');
      const lastLogs=LOGS.slice(0,4).map(l=>row(
        '<span class="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 grid place-items-center text-slate-500">'+svg(I.doc)+'</span>',
        '<p class="text-sm font-semibold truncate">'+escH(l.action)+'</p><p class="text-xs text-slate-500 truncate">'+escH(l.when)+' · '+escH(schoolNameById(l.school))+'</p>',
        '<span class="w-2.5 h-2.5 rounded-full '+dotC(l.level)+'"></span>')).join('');
      return hero('SuperAdmin','Vue consolidée multi-établissements')
      + grid(
          '<button data-go="schools" class="text-left">'+stat('Établissements',String(SCHOOLS.length),'réseau géré','bg-slate-600')+'</button>'
          +'<button data-go="users" class="text-left">'+stat('Utilisateurs',String(USERS.length),'comptes','bg-brand-600')+'</button>'
          +stat('Élèves actifs','3 204','98% assidus','bg-emerald-500')
          +'<button data-go="logs" class="text-left">'+stat('Incidents',String(incidents),incidents?'à examiner':'système sain','bg-amber-500')+'</button>')
      + section('Charge système')+'<div class="card-in rounded-2xl p-3 bg-white dark:bg-slate-900 shadow-soft lg:max-w-2xl"><canvas id="chart" height="150"></canvas></div>'
      + section('Accès rapides')
      + '<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">'
        + '<button data-go="users" class="rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft card-in text-left"><div class="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300 p-2 mb-2">'+svg(I.users)+'</div><p class="text-sm font-bold">Utilisateurs</p><p class="text-[11px] text-slate-500">Comptes &amp; rôles</p></button>'
        + '<button data-go="schools" class="rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft card-in text-left"><div class="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300 p-2 mb-2">'+svg(I.shield)+'</div><p class="text-sm font-bold">Établissements</p><p class="text-[11px] text-slate-500">Cycles &amp; branches</p></button>'
        + '<button data-go="logs" class="rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft card-in text-left"><div class="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300 p-2 mb-2">'+svg(I.doc)+'</div><p class="text-sm font-bold">Journaux</p><p class="text-[11px] text-slate-500">Audit &amp; sécurité</p></button>'
        + '<button data-go="settings" class="rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft card-in text-left"><div class="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300 p-2 mb-2">'+svg(I.cog)+'</div><p class="text-sm font-bold">Paramètres</p><p class="text-[11px] text-slate-500">Configuration</p></button>'
        + '</div>'
      + section('Derniers journaux','<button class="text-xs font-bold text-brand-600" data-go="logs">Tout voir</button>')
      + '<div class="space-y-2">'+lastLogs+'</div>';
    }
    if(role==='teacher') return hero('Mme Sarr','3 cours aujourd’hui · Mathématiques')
      + grid(stat('Mes classes','4','Tle F2, 1ère...','bg-emerald-500')+stat('À noter','18','saisies en attente','bg-amber-500')+stat('Heures/sem.','22','pointage ✓','bg-brand-600')+stat('Moyenne cl.','13,4','+0,6 pt','bg-slate-600'))
      + section('Prochain cours')
      + row('<div class="w-12 text-center"><p class="font-extrabold text-brand-600">10:00</p><p class="text-[10px] text-slate-500">Salle B2</p></div>','<p class="text-sm font-semibold">Mathématiques — Tle F2</p><p class="text-xs text-slate-500">Analyse · 32 élèves</p>',badge('En cours','bg-emerald-100 text-emerald-700'))
      + section('Saisie de notes','<button class="text-xs font-bold text-brand-600" data-go="grades">Ouvrir</button>');
    if(role==='student') return hero('K. Mensah','Classe Tle F2 · Externe · Matricule 2026-0481')
      + grid(stat('Moyenne gén.','14,2','Rang 6/32','bg-emerald-500')+stat('Présence','96%','2 retards','bg-brand-600')+stat('Solde scolarité','75 000','reste à payer','bg-amber-500')+stat('Bulletins','1','T1 dispo.','bg-slate-600'))
      + section('Mon emploi du temps','<button class="text-xs font-bold text-brand-600" data-go="timetable">Voir</button>')
      + row('<div class="w-12 text-center"><p class="font-extrabold text-brand-600">10:00</p></div>','<p class="text-sm font-semibold">Mathématiques</p><p class="text-xs text-slate-500">Mme Sarr · Salle B2</p>',badge('Externe','bg-amber-100 text-amber-700'))
      + section('Performance')+'<div class="card-in rounded-2xl p-3 bg-white dark:bg-slate-900 shadow-soft lg:max-w-2xl"><canvas id="chart" height="150"></canvas></div>';
    if(role==='surveillant') return hero('M. Ba','Surveillance générale · Journée du jour')
      + absenceAlertBanner()
      + grid(stat('Appels faits','18/24','classes','bg-sky-500')+stat('Absents','37','du jour','bg-rose-500')+stat('Retards','12','à traiter','bg-amber-500')+stat('Alertes','9','SMS envoyés','bg-brand-600'))
      + section('À traiter maintenant','<button class="text-xs font-bold text-brand-600" data-go="appel">Faire l’appel</button>')
      + row('<div class="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 p-2">'+svg(I.bell)+'</div>','<p class="text-sm font-semibold">3 absences non justifiées — Tle F2</p><p class="text-xs text-slate-500">Notifier les parents</p>',badge('Urgent','bg-rose-100 text-rose-700'));
    if(role==='comptable') return hero('Mme Either','Comptabilité & scolarité · Trimestre 1')
      + grid(stat('Encaissé','48,2M','FCFA T1','bg-emerald-500')+stat('Impayés','13,6M','312 élèves','bg-rose-500')+stat('Recouvrement','78%','+5% / T0','bg-brand-600')+stat('Reçus','1 204','émis','bg-amber-500'))
      + section('Recettes par cycle')+'<div class="card-in rounded-2xl p-3 bg-white dark:bg-slate-900 shadow-soft lg:max-w-2xl"><canvas id="chart" height="150"></canvas></div>'
      + section('Derniers paiements','<button class="text-xs font-bold text-brand-600" data-go="payments">Tout voir</button>')
      + row('<div class="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 p-2">'+svg(I.cash)+'</div>','<p class="text-sm font-semibold">Diallo A. — 50 000 FCFA</p><p class="text-xs text-slate-500">Espèces · reçu #1204</p>',badge('Validé','bg-emerald-100 text-emerald-700'));
    // admin
    return hero('M. Dupont','Lycée Technique Moderne · Direction')
      + absenceAlertBanner()
      + grid(stat('Élèves','1 248','+42 inscrits','bg-brand-600')+stat('Enseignants','86','4 absents','bg-emerald-500')+stat('Recouvrement','78%','scolarité T1','bg-amber-500')+stat('Alertes','12','SMS parents','bg-slate-600'))
      + section('Effectifs par cycle')+'<div class="card-in rounded-2xl p-3 bg-white dark:bg-slate-900 shadow-soft lg:max-w-2xl"><canvas id="chart" height="150"></canvas></div>'
      + section('Validations en attente','<button class="text-xs font-bold text-brand-600" data-go="grades">Tout voir</button>')
      + row('<div class="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 p-2">'+svg(I.grade)+'</div>','<p class="text-sm font-semibold">Déverrouillage notes — Tle F3</p><p class="text-xs text-slate-500">Demande de Mme Sarr</p>',badge('À valider','bg-amber-100 text-amber-700'))
      + academicStructure();
  }
  // ---------- MODULE SCREENS ----------
  const searchBar = ph => `<div class="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-white dark:bg-slate-900 shadow-soft card-in">
      <svg class="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
      <input placeholder="${ph}" class="bg-transparent flex-1 text-sm outline-none"></div>`;

  function students(){
    const q=(state.stuSearch||'').trim().toLowerCase();
    const flt=state.stuFilterCls||'all';
    const inCls=e=> flt==='all'?true : flt==='none'?!e.cls : e.cls===flt;
    let list=DB.students.filter(inCls);
    if(q) list=list.filter(e=> (stuName(e).toLowerCase().includes(q)) || (e.mat||'').toLowerCase().includes(q) );
    list=list.slice().sort((a,b)=>stuName(a).localeCompare(stuName(b),'fr'));
    // filtres par classe (liste des élèves par classe)
    const chip=(id,label,n)=>`<button data-stuflt="${id}" class="px-3 py-1.5 rounded-full whitespace-nowrap ${flt===id?'bg-brand-600 text-white':'bg-white dark:bg-slate-900 text-slate-500'}">${label}<span class="ml-1 opacity-70">${n}</span></button>`;
    const noCls=DB.students.filter(e=>!e.cls).length;
    const chips=[chip('all','Tous',DB.students.length)]
      .concat(DB.classes.map(c=>chip(c.id,clsLabel(c.id),DB.students.filter(e=>e.cls===c.id).length)))
      .concat(noCls?[chip('none','Sans classe',noCls)]:[]).join('');
    const title = flt==='all'?'Tous les élèves' : flt==='none'?'Élèves sans classe' : 'Classe — '+clsLabel(flt);
    const statBadge=s=>s==='Redoublant'?badge('Redoublant','bg-rose-100 text-rose-700'):(s==='Abandon'?badge('Abandon','bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'):badge('Nouveau','bg-emerald-100 text-emerald-700'));
    const photoEl=e=>e.photo?`<img src="${e.photo}" class="w-10 h-10 rounded-xl object-cover bg-slate-200 dark:bg-slate-800" alt="">`:avatar((e.id.charCodeAt(e.id.length-1)*7)%70);
    const rows=list.length?list.map(e=>row(
        photoEl(e),
        `<p class="text-sm font-semibold truncate">${escH(stuName(e))}</p><p class="text-xs text-slate-500">${escH(e.mat||'—')} · ${e.cls?clsLabel(e.cls):'<span class=\'text-amber-600 dark:text-amber-400 font-semibold\'>Sans classe</span>'}</p>`,
        `<div class="flex items-center gap-1.5">${e.sexe==='F'?badge('F','bg-pink-100 text-pink-700'):badge('M','bg-sky-100 text-sky-700')}${statBadge(e.statut)}</div>`
      )).join(''):'<p class="text-xs text-slate-400 px-1">Aucun élève pour ce filtre.</p>';
    const exportBtn=`<button data-stuxls="1" class="text-xs font-bold text-white bg-brand-600 px-3 py-1.5 rounded-full active:scale-95 transition">↓ Exporter la liste</button>`;
    return `<div class="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-white dark:bg-slate-900 shadow-soft card-in"><svg class="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg><input id="stu_q" value="${escH(state.stuSearch)}" placeholder="Rechercher un élève, matricule..." class="bg-transparent flex-1 text-sm outline-none"></div>`
      + `<div class="flex gap-2 mt-3 text-[11px] font-semibold overflow-x-auto pb-1">${chips}</div>`
      + section(title+' · '+list.length+' élève(s)', exportBtn)
      + `<div class="space-y-2">${rows}</div>`
      + `<p class="text-[11px] text-slate-400 mt-2">💡 Choisis une classe pour obtenir la liste des élèves de cette classe. « Exporter » télécharge la liste affichée au format Excel.</p>`;
  }
  function wireStudents(){
    const main=$('#main');
    const qi=main.querySelector('#stu_q'); if(qi) qi.addEventListener('input',()=>{ state.stuSearch=qi.value; const q=qi.value.trim().toLowerCase(); /* light re-render */ renderView(); const f=$('#stu_q'); if(f){ f.focus(); f.setSelectionRange(f.value.length,f.value.length);} });
    main.querySelectorAll('[data-stuflt]').forEach(b=>b.addEventListener('click',()=>{ state.stuFilterCls=b.dataset.stuflt; renderView(); }));
    const xb=main.querySelector('[data-stuxls]'); if(xb) xb.addEventListener('click',()=>exportStudents());
  }
  function exportStudents(){
    const q=(state.stuSearch||'').trim().toLowerCase();
    const flt=state.stuFilterCls||'all';
    const inCls=e=> flt==='all'?true : flt==='none'?!e.cls : e.cls===flt;
    let list=DB.students.filter(inCls);
    if(q) list=list.filter(e=> stuName(e).toLowerCase().includes(q) || (e.mat||'').toLowerCase().includes(q));
    list=list.slice().sort((a,b)=>stuName(a).localeCompare(stuName(b),'fr'));
    if(!list.length){toast('Aucun élève à exporter');return;}
    const head=['Matricule','Nom','Prénom','Date de naissance','Sexe','Lieu','Classe','Statut','Régime','Père','Contact père','Mère','Contact mère'];
    const aoa=[head].concat(list.map(e=>[e.mat||'',e.nom||'',e.prenom||'',e.dob||'',e.sexe||'',e.lieu||'',e.cls?clsLabel(e.cls):'Sans classe',e.statut||'',e.st||'',e.pere||'',e.pereTel||'',e.mere||'',e.mereTel||'']));
    const label = flt==='all'?'Tous' : flt==='none'?'Sans_classe' : clsLabel(flt);
    const fname='eleves_'+String(label).replace(/[^a-zA-Z0-9]+/g,'_')+'.xlsx';
    if(typeof XLSX!=='undefined'){ try{ const ws=XLSX.utils.aoa_to_sheet(aoa); ws['!cols']=head.map(()=>({wch:16})); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Eleves'); XLSX.writeFile(wb,fname); toast(list.length+' élève(s) exporté(s) ✓'); return; }catch(err){} }
    const csv=aoa.map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n');
    const a=document.createElement('a'); a.href='data:text/csv;charset=utf-8,\ufeff'+encodeURIComponent(csv); a.download=fname.replace('.xlsx','.csv'); a.click(); toast(list.length+' élève(s) exporté(s) (CSV) ✓');
  }

  function grades(){
    const isAdmin = state.role==='admin';
    // Classes accessibles : admin = cycles actifs ; enseignant = ses classes
    let clsList=DB.classes.filter(c=>activeCycles().includes(c.cycle));
    let me=null;
    if(state.role==='teacher'){ me=DB.teachers.find(t=>t.n===ROLES.teacher.name); clsList=me?clsList.filter(c=>me.cls.includes(c.id)):[]; }
    if(!clsList.length) return `<div class="rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft card-in text-sm text-slate-500">Aucune classe ne t'est attribuée pour la saisie des notes.</div>`;
    if(!clsList.find(c=>c.id===state.grCls)) state.grCls=clsList[0].id;
    const cls=getCls(state.grCls);
    const allowCycle = teacherGradesAllowed(cls.cycle);
    // Matières : programme de la classe (fallback : toutes) ; enseignant limité à ses matières
    let subList=DB.program.filter(p=>p.cls===cls.id).map(p=>getSub(p.sub)).filter(Boolean);
    if(!subList.length) subList=DB.subjects.slice();
    if(me) subList=subList.filter(s=>me.subs.includes(s.id));
    if(!subList.length) return `<div class="rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft card-in text-sm text-slate-500">Aucune matière à saisir pour cette classe.</div>`;
    if(!subList.find(s=>s.id===state.grSub)) state.grSub=subList[0].id;
    const sub=getSub(state.grSub);
    // Périodes selon le type configuré pour le cycle de la classe
    const ptype=cyclePeriodType(cls.cycle), pers=periodList(ptype);
    if(state.grPeriod>=pers.length) state.grPeriod=0;
    const per=pers[state.grPeriod];
    const dl=getDeadline(cls.cycle,per), passed=deadlinePassed(cls.cycle,per);
    const canEdit = isAdmin || (allowCycle && !passed);
    const studs=DB.students.filter(e=>e.cls===cls.id);
    const store=gGet(cls.id,sub.id,per);
    const prog=DB.program.find(p=>p.cls===cls.id&&p.sub===sub.id);
    const coef=prog?prog.coef:1;
    const gmax=schoolCfg().gradeMax||20;

    const opt=(arr,val,fn)=>arr.map((x,i)=>{const v=fn?fn(x,i):x; return `<option value="${v.v}"${v.v==val?' selected':''}>${v.t}</option>`;}).join('');
    const clsSel=`<select id="gr_cls" class="${MGIN}">${opt(clsList,state.grCls,c=>({v:c.id,t:clsLabel(c.id)+' · '+c.cycle}))}</select>`;
    const subSel=`<select id="gr_sub" class="${MGIN}">${opt(subList,state.grSub,s=>({v:s.id,t:s.n}))}</select>`;
    const perSel=`<select id="gr_per" class="${MGIN}">${opt(pers,state.grPeriod,(p,i)=>({v:i,t:p}))}</select>`;

    const rows=studs.map((e,i)=>{
      const g=store[e.id]||{i:'',d:'',c:''};
      const inp=(f,v)=>`<input type="number" min="0" max="${gmax}" step="0.25" data-gr="${e.id}:${f}" value="${v===''||v==null?'':v}" ${canEdit?'':'readonly'} class="w-full text-center text-sm py-1.5 rounded-lg outline-none ${canEdit?'bg-slate-100 dark:bg-slate-800 focus:ring-2 ring-brand-500':'bg-transparent text-slate-500 cursor-default'}">`;
      return `<div class="grid grid-cols-[1.3fr_.8fr_.8fr_.8fr_.8fr_.8fr_.8fr] gap-1 items-center text-sm px-2 py-1.5 min-w-[640px] ${i%2?'bg-white dark:bg-slate-900':'bg-slate-50 dark:bg-slate-900/60'}">
        <div class="font-semibold truncate pr-1">${stuName(e)}</div>
        <div>${inp('i',g.i)}</div><div>${inp('d',g.d)}</div>
        <div class="text-center text-xs font-semibold text-slate-500 dark:text-slate-400" data-grcl="${e.id}">${fmtN(moyClasse(g))}</div>
        <div>${inp('c',g.c)}</div>
        <div class="text-center font-bold text-brand-600" data-grmoy="${e.id}">${fmtN(moyenne(g))}</div>
        <div class="text-center text-xs font-extrabold text-slate-700 dark:text-slate-200" data-grcoef="${e.id}">${fmtN(noteCoef(g,coef))}</div>
      </div>`;
    }).join('')||`<div class="px-3 py-6 text-center text-sm text-slate-400">Aucun élève inscrit dans cette classe.</div>`;
    const rankBlock=gradesRankBlock(studs,store,coef);

    return (isAdmin?`<div class="rounded-2xl p-3 bg-brand-50 dark:bg-slate-900 text-brand-700 dark:text-brand-300 text-xs font-semibold card-in flex items-center gap-2">${svg_(I.shield)} Mode administrateur — tu peux saisir et surcharger les notes de toutes les classes.</div>`:(!allowCycle?`<div class="rounded-2xl p-3 bg-amber-50 dark:bg-slate-900 text-amber-700 dark:text-amber-300 text-xs font-semibold card-in flex items-center gap-2">${svg_(I.shield)} Consultation seule — la saisie des notes par les enseignants est désactivée par l'administration pour le cycle « ${cls.cycle} ».</div>`:(passed?`<div class="rounded-2xl p-3 bg-rose-50 dark:bg-slate-900 text-rose-600 dark:text-rose-300 text-xs font-semibold card-in flex items-center gap-2">${svg_(I.clock)} Consultation seule — la date limite de saisie pour ${per} (${fmtDate(dl)}) est dépassée. Contacte l'administration.</div>`:`<div class="rounded-2xl p-3 bg-emerald-50 dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 text-xs font-semibold card-in flex items-center gap-2">${svg_(I.grade)} Saisie ouverte sur tes classes attribuées.${dl?' Échéance : '+fmtDate(dl)+'.':''}</div>`)))
      + `<div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 card-in"><div><label class="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Classe</label>${clsSel}</div><div><label class="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Matière</label>${subSel}</div><div><label class="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Période</label>${perSel}</div></div>`
      + section(sub.n+' · '+clsLabel(cls.id), `<span class="text-xs ${passed?'text-rose-500 font-semibold':'text-slate-400'}">${state.year} · ${per} · coef ${coef}${dl?' · ⏳ '+fmtDate(dl):''}</span>`)
      + `<div class="rounded-2xl overflow-x-auto shadow-soft card-in">
          <div class="grid grid-cols-[1.3fr_.8fr_.8fr_.8fr_.8fr_.8fr_.8fr] gap-1 bg-slate-800 text-white text-[11px] font-bold px-2 py-2 min-w-[640px]"><div>Élève</div><div class="text-center">Interro</div><div class="text-center">Devoir</div><div class="text-center">Moy. cl.</div><div class="text-center">Compo</div><div class="text-center">Moy.</div><div class="text-center">N. coef</div></div>
          ${rows}</div>`
      + `<p class="text-[11px] text-slate-400 mt-2">💡 Calcul : <strong>Moy. de classe</strong> = (Interro + Devoir) ÷ 2 · <strong>Moyenne</strong> = (Compo + Moy. de classe) ÷ 2 · <strong>Note coefficientée</strong> = Moyenne × coef (${coef}). Notes sur ${gmax} (maximum ${gmax}).</p>`
      + (canEdit?`<button data-grsave class="mt-3 w-full py-3 rounded-2xl bg-brand-600 text-white font-bold shadow-glow active:scale-95 transition">Enregistrer les notes</button>`:'')
      + rankBlock;
  }
  // Bloc classement (décroissant à l'écran) + bouton impression (alphabétique)
  function gradesRankBlock(studs,store,coef){
    const ranked=studs.map(e=>{ const g=store[e.id]||{i:'',d:'',c:''}; return {e,m:moyenne(g),k:noteCoef(g,coef)}; })
      .sort((a,b)=>{ if(a.m==null&&b.m==null) return stuName(a.e).localeCompare(stuName(b.e),'fr'); if(a.m==null) return 1; if(b.m==null) return -1; return b.m-a.m; });
    const rows=ranked.map((r,i)=>{
      const med=r.m==null?'bg-slate-100 text-slate-400 dark:bg-slate-800':i===0?'bg-amber-100 text-amber-700':i===1?'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200':i===2?'bg-orange-100 text-orange-700':'bg-slate-100 text-slate-500 dark:bg-slate-800';
      return `<div class="flex items-center gap-3 px-3 py-2 ${i%2?'bg-white dark:bg-slate-900':'bg-slate-50 dark:bg-slate-900/60'}">
          <span class="w-7 h-7 rounded-lg grid place-items-center text-xs font-extrabold ${med}">${r.m==null?'—':(i+1)}</span>
          <span class="flex-1 min-w-0 text-sm font-semibold truncate">${stuName(r.e)}</span>
          <span class="text-[11px] text-slate-400 whitespace-nowrap">coef : <strong class="text-slate-600 dark:text-slate-300">${fmtN(r.k)}</strong></span>
          <span class="font-bold text-brand-600 w-12 text-right">${fmtN(r.m)}</span>
        </div>`;
    }).join('')||'<div class="px-3 py-6 text-center text-sm text-slate-400">Aucun élève.</div>';
    return section('Classement par moyenne','<button data-grprint class="text-xs font-bold text-brand-600">🖨️ Imprimer</button>')
      + `<div class="rounded-2xl overflow-hidden shadow-soft card-in"><div class="flex items-center gap-3 bg-slate-800 text-white text-[11px] font-bold px-3 py-2"><span class="w-7 text-center">#</span><span class="flex-1">Élève (ordre décroissant)</span><span>N. coef</span><span class="w-12 text-right">Moy.</span></div>${rows}</div>`
      + `<p class="text-[11px] text-slate-400 mt-2">📌 Classement par <strong>moyenne décroissante</strong>, basé sur les notes <strong>enregistrées</strong>. À l'impression, la liste est triée par ordre alphabétique.</p>`;
  }
  function printGrades(){
    const cls=getCls(state.grCls), sub=getSub(state.grSub); if(!cls||!sub){toast('Sélection incomplète');return;}
    const ptype=cyclePeriodType(cls.cycle), pers=periodList(ptype); const per=pers[state.grPeriod]||pers[0];
    const store=gGet(cls.id,sub.id,per);
    const prog=DB.program.find(p=>p.cls===cls.id&&p.sub===sub.id); const coef=prog?prog.coef:1;
    const gmax=schoolCfg().gradeMax||20;
    const sc=activeSchool();
    const studs=DB.students.filter(e=>e.cls===cls.id).slice().sort((a,b)=>stuName(a).localeCompare(stuName(b),'fr'));
    const sh=v=>(v===''||v==null?'':v);
    const rows=studs.map((e,i)=>{ const g=store[e.id]||{i:'',d:'',c:''}; return `<tr><td class="n">${i+1}</td><td class="nm">${escH(stuName(e))}</td><td>${sh(g.i)}</td><td>${sh(g.d)}</td><td>${fmtN(moyClasse(g))}</td><td>${sh(g.c)}</td><td class="mo">${fmtN(moyenne(g))}</td><td>${coef}</td><td class="mo">${fmtN(noteCoef(g,coef))}</td></tr>`; }).join('')||'<tr><td colspan="9" class="empty">Aucun élève inscrit.</td></tr>';
    const today=new Date(); const pad=x=>(''+x).padStart(2,'0'); const dstr=pad(today.getDate())+'/'+pad(today.getMonth()+1)+'/'+today.getFullYear();
    const doc=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Notes — ${escH(clsLabel(cls.id))} — ${escH(sub.n)}</title>
      <style>*{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}body{margin:24px;color:#111}h1{font-size:18px;margin:0 0 2px}.sub{color:#555;font-size:12px;margin:0 0 14px}.meta{font-size:12px;margin:2px 0;color:#333}table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}th,td{border:1px solid #999;padding:6px 8px;text-align:center}th{background:#1f2937;color:#fff}td.nm{text-align:left}td.n{width:34px;color:#666}td.mo{font-weight:bold}.empty{color:#888;padding:20px}.sign{margin-top:36px;display:flex;justify-content:space-between;font-size:12px}.sign div{width:40%;border-top:1px solid #999;padding-top:6px;text-align:center;color:#555}@media print{body{margin:12mm}}</style></head>
      <body><h1>${escH(sc.name||'Établissement')}</h1><p class="sub">Relevé de notes — liste par ordre alphabétique</p>
      <p class="meta"><strong>Classe :</strong> ${escH(clsLabel(cls.id))} &nbsp;&nbsp; <strong>Matière :</strong> ${escH(sub.n)} (coef ${coef})</p>
      <p class="meta"><strong>Année :</strong> ${escH(state.year)} &nbsp;&nbsp; <strong>Période :</strong> ${escH(per)} &nbsp;&nbsp; <strong>Notes sur :</strong> ${gmax} &nbsp;&nbsp; <strong>Date :</strong> ${dstr}</p>
      <table><thead><tr><th>#</th><th style="text-align:left">Élève</th><th>Interro</th><th>Devoir</th><th>Moy. classe</th><th>Compo</th><th>Moyenne</th><th>Coef</th><th>Note coef.</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="sign"><div>L'enseignant(e)</div><div>La Direction</div></div></body></html>`;
    const w=window.open('','_blank'); if(!w){toast('Autorise les fenêtres pop-up pour imprimer');return;}
    w.document.open(); w.document.write(doc); w.document.close(); w.focus();
    setTimeout(()=>{ try{ w.print(); }catch(e){} },300);
  }
  function wireGrades(){
    const main=$('#main');
    if(typeof apiOn==='function'&&apiOn()){ const _cl=state.grCls,_sb=state.grSub; const _c=getCls(_cl); if(_c&&_sb){ const _pt=cyclePeriodType(_c.cycle),_per=periodList(_pt)[state.grPeriod]; const _key='gr:'+state.year+':'+_cl+':'+_sb+':'+_per; window._xsLoaded=window._xsLoaded||{}; if(!window._xsLoaded[_key]){ window._xsLoaded[_key]=true; hydrateGradesApi(_cl,_sb,_per).then(ok=>{ if(ok) renderView(); }); } } }
    const cls=main.querySelector('#gr_cls'); if(cls) cls.addEventListener('change',()=>{ state.grCls=cls.value; state.grSub=''; state.grPeriod=0; renderView(); });
    const sub=main.querySelector('#gr_sub'); if(sub) sub.addEventListener('change',()=>{ state.grSub=sub.value; renderView(); });
    const per=main.querySelector('#gr_per'); if(per) per.addEventListener('change',()=>{ state.grPeriod=+per.value; renderView(); });
    // recalcul live des colonnes calculées par ligne
    const curProg=DB.program.find(p=>p.cls===state.grCls&&p.sub===state.grSub); const curCoef=curProg?curProg.coef:1;
    const rowVal=stu=>{ const g={i:'',d:'',c:''}; main.querySelectorAll('[data-gr^="'+stu+':"]').forEach(inp=>{ g[inp.dataset.gr.split(':')[1]]=inp.value.trim(); }); return g; };
    main.querySelectorAll('[data-gr]').forEach(inp=>inp.addEventListener('input',()=>{ if(inp.value!==''){ const v=parseFloat(inp.value); if(!isNaN(v)){ const mx=+inp.max||20; if(v>mx){ inp.value=String(mx); toast('Note maximale : '+mx); } else if(v<0){ inp.value='0'; } } } const stu=inp.dataset.gr.split(':')[0]; const g=rowVal(stu); const clc=main.querySelector('[data-grcl="'+stu+'"]'); if(clc) clc.textContent=fmtN(moyClasse(g)); const cell=main.querySelector('[data-grmoy="'+stu+'"]'); if(cell) cell.textContent=fmtN(moyenne(g)); const kc=main.querySelector('[data-grcoef="'+stu+'"]'); if(kc) kc.textContent=fmtN(noteCoef(g,curCoef)); }));
    const grPrint=main.querySelector('[data-grprint]'); if(grPrint) grPrint.addEventListener('click',printGrades);
    const save=main.querySelector('[data-grsave]'); if(save) save.addEventListener('click',()=>{
      const cl=main.querySelector('#gr_cls').value, sb=main.querySelector('#gr_sub').value, pr=+main.querySelector('#gr_per').value;
      const ptype=cyclePeriodType(getCls(cl).cycle), perName=periodList(ptype)[pr];
      const store=gGet(cl,sb,perName);
      main.querySelectorAll('[data-gr]').forEach(inp=>{ const [stu,f]=inp.dataset.gr.split(':'); if(!store[stu]) store[stu]={i:'',d:'',c:''}; let vv=inp.value.trim(); if(vv!==''){ let n=parseFloat(vv); if(isNaN(n)) vv=''; else { const mx=schoolCfg().gradeMax||20; if(n>mx) n=mx; if(n<0) n=0; vv=String(n); } } store[stu][f]=vv; });
      if(typeof apiOn==='function'&&apiOn()){ saveGradesBatchApi(cl,sb,perName).then(()=>toast('Notes enregistrées ✓')).catch(ex=>toast('Enregistrement refusé : '+((ex&&ex.message)||'erreur'))); return; }
      toast('Notes enregistrées ✓');
    });
  }
  const svg_ = p=>`<span class="w-4 h-4 inline-block align-middle">${svg(p)}</span>`;

  function finance(){
    const F=[['Mensah K.','Tle F2','75 000','Partiel','amber'],['Diallo A.','1ère F1','0','Soldé','emerald'],['Traoré M.','2nde C','150 000','Impayé','rose']];
    return `<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">${stat('Encaissé','48,2M','FCFA T1','bg-emerald-500')}${stat('Impayés','13,6M','312 élèves','bg-rose-500')}</div>`
      + section('Suivi des paiements','<button class="text-xs font-bold text-brand-600">Exporter</button>')
      + listWrap(F.map(f=>row('<div class="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 p-2">'+svg(I.cash)+'</div>',`<p class="text-sm font-semibold">${f[0]}</p><p class="text-xs text-slate-500">${f[1]} · ${f[2]} FCFA</p>`,badge(f[3],`bg-${f[4]}-100 text-${f[4]}-700`))).join(''));
  }
  function timetable(){
    const H=[['1ʳᵉ','07:00'],['2ᵉ','07:55'],['3ᵉ','08:50'],['4ᵉ','10:00'],['5ᵉ','10:55'],['6ᵉ','11:50'],['7ᵉ','14:00'],['8ᵉ','14:55'],['9ᵉ','15:50']];
    const days=['Lun','Mar','Mer','Jeu','Ven','Sam'];
    const S=TT_SUBJ;
    const canEdit=state.role==='admin'||state.role==='surveillant';
    const isTeacher=state.role==='teacher';
    const me=isTeacher?(DB.teachers.find(t=>t.n===ROLES.teacher.name)||{n:ROLES.teacher.name,cls:[]}):null;
    const myCls=me?me.cls.map(getCls).filter(Boolean):[];
    let g, curName, editing=false, showTeacher=true;
    if(canEdit){
      const list=state.ttScope==='class'?ttClasses():TT_TEACHERS;
      if(state.ttIdx>=list.length) state.ttIdx=0;
      g=ttGrid(); curName=ttName(); editing=state.ttEdit;
      showTeacher=state.ttScope==='class';
    } else if(isTeacher){
      if(state.ttTScope==='classes' && myCls.length){
        if(state.ttTClsIdx>=myCls.length) state.ttTClsIdx=0;
        const c=myCls[state.ttTClsIdx]; const key='class:'+c.cycle+':'+c.name+':ALL';
        if(!TT_STORE[key]) TT_STORE[key]=ttDefault((state.ttTClsIdx+2)%6);
        g=TT_STORE[key]; curName=clsLabel(c.id)+' · '+c.cycle; showTeacher=true;
      } else {
        const key='teacher:'+me.n;
        if(!TT_STORE[key]) TT_STORE[key]=ttDefault(0);
        g=TT_STORE[key]; curName=me.n+' · mon emploi du temps'; showTeacher=false;
      }
    } else { g=ttDefault(0); curName='Tle F2'; showTeacher=true; }
    const optsFor=sel=>`<option value="">—</option>`+Object.entries(S).map(([k,v])=>`<option value="${k}" ${sel===k?'selected':''}>${v[0]}</option>`).join('');
    const cell=(code,ri,ci)=>{
      if(editing) return `<select data-cell="${ri}-${ci}" class="h-full min-h-[52px] w-full rounded-lg text-[11px] font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center outline-none focus:border-brand-400">${optsFor(code)}</select>`;
      if(!code) return '<div class="h-full min-h-[52px] rounded-lg border border-dashed border-slate-200 dark:border-slate-800"></div>';
      const[n,c]=S[code]; const teach=showTeacher?`<span class="block text-[9px] font-semibold opacity-70 truncate leading-tight max-w-full">${TT_TEACH[code]||''}</span>`:'';
      return `<div class="h-full min-h-[52px] rounded-lg px-1 py-1 flex flex-col items-center justify-center text-center text-[11px] font-bold bg-${c}-100 text-${c}-700 dark:bg-${c}-500/20 dark:text-${c}-300"><span class="leading-tight">${n}</span>${teach}</div>`; };
    let toolbar='';
    if(canEdit){
      const scopeBtn=(key,label)=>`<button data-ttscope="${key}" class="px-3 py-1.5 rounded-lg text-xs font-bold ${state.ttScope===key?'bg-brand-600 text-white':'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}">${label}</button>`;
      const selCls='px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-semibold outline-none';
      const actions=editing
        ? `<button id="ttSave" class="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold whitespace-nowrap">Enregistrer</button><button id="ttClear" class="px-3 py-2 rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300 text-xs font-bold whitespace-nowrap">Vider</button>`
        : `<button id="ttEdit" class="px-3 py-2 rounded-xl bg-brand-700 text-white text-xs font-bold whitespace-nowrap">Modifier</button><button id="ttClear" class="px-3 py-2 rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300 text-xs font-bold whitespace-nowrap">Supprimer</button>`;
      let selectorRows;
      if(state.ttScope==='teacher'){
        const teacherSel=`<select id="ttPick" class="flex-1 min-w-0 ${selCls}">${TT_TEACHERS.map((n,i)=>`<option value="${i}" ${i===state.ttIdx?'selected':''}>${n}</option>`).join('')}</select>`;
        selectorRows=`<div class="flex items-center gap-2">${teacherSel}${actions}</div>`;
      } else {
        const cycleSel=`<select id="ttCycle" class="flex-1 min-w-0 ${selCls}">${CYCLE_NAMES.map(c=>`<option ${c===state.ttCycle?'selected':''}>${c}</option>`).join('')}</select>`;
        const groupSel=`<select id="ttGroup" class="${selCls}">${GROUPS.map(gr=>`<option value="${gr[0]}" ${gr[0]===state.ttGroup?'selected':''}>${gr[1]}</option>`).join('')}</select>`;
        const classSel=`<select id="ttPick" class="flex-1 min-w-0 ${selCls}">${ttClasses().map((n,i)=>`<option value="${i}" ${i===state.ttIdx?'selected':''}>${n}</option>`).join('')}</select>`;
        selectorRows=`<div class="flex items-center gap-2"><span class="text-[11px] font-bold text-slate-400 shrink-0">Cycle</span>${cycleSel}</div>
          <div class="flex items-center gap-2">${classSel}${groupSel}</div>
          <div class="flex items-center gap-2">${actions}</div>`;
      }
      toolbar=`<div class="rounded-2xl p-3 bg-white dark:bg-slate-900 shadow-soft card-in space-y-3">
          <div class="flex items-center gap-2"><span class="text-xs font-bold text-slate-500">Vue :</span>${scopeBtn('class','Par classe')}${scopeBtn('teacher','Par enseignant')}</div>
          ${selectorRows}
          <p class="text-[11px] text-slate-400">Accès gestion — ${ROLES[state.role].tag} : consulter, enregistrer, modifier et supprimer l’emploi du temps de toutes les classes et de tous les enseignants.</p>
        </div>`;
    }
    if(isTeacher){
      const selCls='px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-semibold outline-none';
      const tBtn=(key,label)=>`<button data-tts="${key}" class="px-3 py-1.5 rounded-lg text-xs font-bold ${state.ttTScope===key?'bg-brand-600 text-white':'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}">${label}</button>`;
      let pick='';
      if(state.ttTScope==='classes'){
        pick = myCls.length
          ? `<select id="ttTPick" class="w-full ${selCls}">${myCls.map((c,i)=>`<option value="${i}" ${i===state.ttTClsIdx?'selected':''}>${clsLabel(c.id)} · ${c.cycle}</option>`).join('')}</select>`
          : `<p class="text-[11px] text-slate-400">Aucune classe ne t'est encore affectée par l'administration.</p>`;
      }
      toolbar=`<div class="rounded-2xl p-3 bg-white dark:bg-slate-900 shadow-soft card-in space-y-3">
          <div class="flex items-center gap-2"><span class="text-xs font-bold text-slate-500">Vue :</span>${tBtn('mine','Mon emploi')}${tBtn('classes','Mes classes')}</div>
          ${pick}
          <p class="text-[11px] text-slate-400">Consultation seule — ton emploi du temps et celui des classes où tu interviens.</p>
        </div>`;
    }
    return toolbar
      + section((state.ttScope==='teacher'&&canEdit?'Emploi du temps · '+curName:'Emploi du temps · '+curName),'<span class="text-xs text-slate-400">'+(editing?'Mode édition':'Semaine')+'</span>')
      + `<div class="overflow-x-auto -mx-4 px-4 pb-2 card-in">
        <div class="min-w-[560px]">
          <div class="grid gap-1" style="grid-template-columns:56px repeat(6,1fr)">
            <div class="text-[10px] font-bold text-slate-400 flex items-end justify-center pb-1">Heure</div>
            ${days.map(d=>`<div class="text-xs font-extrabold text-center py-1.5 rounded-lg bg-slate-800 text-white">${d}</div>`).join('')}
            ${H.map((h,i)=>`
              <div class="flex flex-col items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 py-1"><span class="text-xs font-extrabold text-brand-600">${h[0]}</span><span class="text-[9px] text-slate-400">${h[1]}</span></div>
              ${g[i].map((code,ci)=>cell(code,i,ci)).join('')}
            `).join('')}
          </div>
        </div></div>`
      + `<div class="flex flex-wrap gap-2 mt-3 text-[10px] font-semibold">${Object.values(S).map(([n,c])=>`<span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-${c}-500"></span>${n}</span>`).join('')}</div>`
      + '<p class="text-[11px] text-slate-400 mt-2">💡 Faites défiler horizontalement sur mobile pour voir tous les jours.</p>';
  }
  function wireTimetable(){
    const main=$('#main');
    if(state.role==='teacher'){
      main.querySelectorAll('[data-tts]').forEach(b=>b.addEventListener('click',()=>{ state.ttTScope=b.dataset.tts; state.ttTClsIdx=0; renderView(); }));
      const tp=main.querySelector('#ttTPick'); if(tp) tp.addEventListener('change',()=>{ state.ttTClsIdx=+tp.value; renderView(); });
      return;
    }
    if(!(state.role==='admin'||state.role==='surveillant')) return;
    main.querySelectorAll('[data-ttscope]').forEach(b=>b.addEventListener('click',()=>{ state.ttScope=b.dataset.ttscope; state.ttIdx=0; state.ttEdit=false; renderView(); }));
    const pick=main.querySelector('#ttPick'); if(pick) pick.addEventListener('change',()=>{ state.ttIdx=+pick.value; state.ttEdit=false; renderView(); });
    const cyc=main.querySelector('#ttCycle'); if(cyc) cyc.addEventListener('change',()=>{ state.ttCycle=cyc.value; state.ttIdx=0; state.ttGroup=''; state.ttEdit=false; renderView(); });
    const grp=main.querySelector('#ttGroup'); if(grp) grp.addEventListener('change',()=>{ state.ttGroup=grp.value; state.ttEdit=false; renderView(); });
    const eb=main.querySelector('#ttEdit'); if(eb) eb.addEventListener('click',()=>{ state.ttEdit=true; renderView(); });
    const sb=main.querySelector('#ttSave'); if(sb) sb.addEventListener('click',()=>{ const gr=ttGrid(); main.querySelectorAll('[data-cell]').forEach(s=>{ const p=s.dataset.cell.split('-'); gr[+p[0]][+p[1]]=s.value; }); state.ttEdit=false; renderView(); toast('Emploi du temps enregistré ✓'); });
    const cb=main.querySelector('#ttClear'); if(cb) cb.addEventListener('click',()=>{ if(!confirm('Vider / supprimer l’emploi du temps de '+ttName()+' ?')) return; TT_STORE[ttKey()]=Array.from({length:9},()=>['','','','','','']); state.ttEdit=false; renderView(); toast('Emploi du temps supprimé'); });
  }
  function attendance(){
    return `<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">${stat('Présence','96%','ce trimestre','bg-emerald-500')}${stat('Retards','2','justifiés: 1','bg-amber-500')}</div>`
      + section('Historique')
      + ['2026-10-21 · Retard 15 min · non justifié|rose','2026-10-14 · Absence · justifiée|emerald','2026-10-02 · Retard · justifié|emerald']
        .map(x=>{const[a,c]=x.split('|');return row(`<div class="w-9 h-9 rounded-xl bg-${c}-100 text-${c}-600 p-2">`+svg(I.check)+'</div>',`<p class="text-sm">${a}</p>`,'');}).join('');
  }
  // Pointage des enseignants — effectué par le SURVEILLANT, cumul des heures par période
  function pointage(){
    // Pointage des enseignants par la surveillance : date, heure d'arrivée, heure de départ, heures réalisées
    const T=[
      {n:'Mme Sarr',  s:'Mathématiques', d:'24/10', a:'07:00', p:'—',     h:'—',    hv:0,    prev:4, st:'arrivee'},
      {n:'M. Ndiaye', s:'Physique',      d:'24/10', a:'07:55', p:'11:50', h:'3h55', hv:3.92, prev:4, st:'sortie'},
      {n:'Mme Fall',  s:'Français',      d:'24/10', a:'—',     p:'—',     h:'0h',   hv:0,    prev:3, st:'absent'},
      {n:'M. Koné',   s:'Atelier Ind.',  d:'24/10', a:'08:00', p:'16:45', h:'8h45', hv:8.75, prev:9, st:'sortie'}
    ];
    const st={arrivee:['En cours','emerald'],sortie:['Terminé','slate'],absent:['Absent','rose']};
    const totalReal=T.reduce((s,t)=>s+t.hv,0), totalPrev=T.reduce((s,t)=>s+t.prev,0);
    const fmt=v=>(Math.floor(v)+'h'+String(Math.round((v-Math.floor(v))*60)).padStart(2,'0'));
    return `<div class="rounded-2xl p-3 bg-white dark:bg-slate-900 shadow-soft card-in">
        <p class="text-xs font-bold text-slate-500 mb-2">Période de calcul</p>
        <div class="flex items-center gap-2 text-sm">
          <input type="date" value="2026-10-01" class="flex-1 min-w-0 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 outline-none">
          <span class="text-slate-400">→</span>
          <input type="date" value="2026-10-24" class="flex-1 min-w-0 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 outline-none">
          <button class="px-3 py-2 rounded-xl bg-brand-700 text-white font-bold text-xs whitespace-nowrap">Calculer</button>
        </div></div>`
      + `<div class="grid grid-cols-2 gap-3 mt-3 lg:grid-cols-4">${stat('Heures réalisées',fmt(totalReal),'sur '+totalPrev+'h prévues','bg-brand-600')}${stat('Taux',Math.round(totalReal/totalPrev*100)+'%','présence profs','bg-emerald-600')}</div>`
      + section('Pointage du jour','<span class="text-xs text-slate-400">24/10 · par la surveillance</span>')
      + `<div class="rounded-2xl overflow-hidden shadow-soft card-in overflow-x-auto">
          <table class="w-full text-sm min-w-[560px]">
            <thead><tr class="bg-slate-800 text-white text-[11px] font-bold">
              <th class="text-left px-3 py-2">Enseignant</th><th class="px-2 py-2">Date</th><th class="px-2 py-2">Arrivée</th><th class="px-2 py-2">Départ</th><th class="px-2 py-2">Réalisé</th><th class="px-2 py-2">Statut</th><th class="px-2 py-2">Action</th>
            </tr></thead>
            <tbody>${T.map((t,i)=>`<tr class="${i%2?'bg-white dark:bg-slate-900':'bg-slate-50 dark:bg-slate-900/60'}">
              <td class="px-3 py-2"><p class="font-semibold">${t.n}</p><p class="text-[11px] text-slate-500">${t.s}</p></td>
              <td class="px-2 py-2 text-center text-slate-500">${t.d}</td>
              <td class="px-2 py-2 text-center font-semibold">${t.a}</td>
              <td class="px-2 py-2 text-center font-semibold">${t.p}</td>
              <td class="px-2 py-2 text-center font-extrabold ${t.hv?'text-emerald-600':'text-slate-400'}">${t.h}</td>
              <td class="px-2 py-2 text-center">${badge(st[t.st][0],`bg-${st[t.st][1]}-100 text-${st[t.st][1]}-700`)}</td>
              <td class="px-2 py-2 text-center"><button class="text-xs font-bold text-white bg-brand-700 rounded-lg px-2.5 py-1.5 whitespace-nowrap">${t.st==='arrivee'?'Pointer départ':t.st==='absent'?'Pointer arrivée':'Modifier'}</button></td>
            </tr>`).join('')}</tbody>
          </table></div>`
      + section('Cumul par enseignant (période)','<button class="text-xs font-bold text-brand-600">Exporter</button>')
      + listWrap(T.map(t=>row('<div class="w-9 h-9 rounded-xl bg-brand-50 text-brand-700 dark:bg-slate-800 dark:text-brand-300 p-2">'+svg(I.clock)+'</div>',`<p class="text-sm font-semibold">${t.n}</p><p class="text-xs text-slate-500">${t.s}</p>`,`<div class="text-right"><p class="font-extrabold text-brand-700 dark:text-brand-300">${t.h}</p><p class="text-[10px] text-slate-400">/ ${t.prev}h prévues</p></div>`)).join(''));
  }
  // Côté enseignant : simple consultation (lecture seule) de ses heures
  function myhours(){
    const D=[['Lun 20/10','07:00','12:45','5h45'],['Mar 21/10','07:55','11:50','3h55'],['Jeu 23/10','10:00','16:45','6h45'],['Ven 24/10','07:00','09:45','2h45']];
    return `<div class="rounded-2xl p-3 bg-brand-50 dark:bg-slate-900 text-brand-700 dark:text-brand-300 text-xs font-semibold card-in flex items-center gap-2">${svg_(I.clock)} Vos heures sont enregistrées par la surveillance — consultation en lecture seule.</div>`
      + `<div class="grid grid-cols-2 gap-3 mt-3 lg:grid-cols-4">${stat('Heures (période)','22h','du 01 au 24/10','bg-emerald-600')}${stat('Prévues','24h','taux 92%','bg-brand-600')}</div>`
      + section('Détail des pointages')
      + `<div class="rounded-2xl overflow-hidden shadow-soft card-in">
          <div class="grid grid-cols-4 bg-slate-800 text-white text-[11px] font-bold"><div class="p-2">Jour</div><div class="p-2 text-center">Arrivée</div><div class="p-2 text-center">Sortie</div><div class="p-2 text-center">Total</div></div>
          ${D.map((d,i)=>`<div class="grid grid-cols-4 text-sm ${i%2?'bg-white dark:bg-slate-900':'bg-slate-50 dark:bg-slate-900/60'}"><div class="p-2 font-semibold">${d[0]}</div><div class="p-2 text-center">${d[1]}</div><div class="p-2 text-center">${d[2]}</div><div class="p-2 text-center font-bold text-emerald-600">${d[3]}</div></div>`).join('')}</div>`;
  }
  // ---------- ADMINISTRATION : GÉNÉRATION DES BULLETINS PAR CLASSE ----------
  // Encodeur QR local → SVG inline (aucun réseau, aucun <script> dans le document imprimé)
  function qrSVG(text,px){
    try{
      if(typeof qrcode==='undefined') return '';
      const qr=qrcode(0,'M'); qr.addData(String(text||'')); qr.make();
      const n=qr.getModuleCount(); const cell=Math.max(1,Math.floor((px||96)/n)); const size=n*cell;
      let rects='';
      for(let row=0;row<n;row++){ for(let col=0;col<n;col++){ if(qr.isDark(row,col)) rects+='<rect x="'+(col*cell)+'" y="'+(row*cell)+'" width="'+cell+'" height="'+cell+'"/>'; } }
      return '<svg xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'" shape-rendering="crispEdges"><rect width="'+size+'" height="'+size+'" fill="#fff"/><g fill="#111">'+rects+'</g></svg>';
    }catch(e){ return ''; }
  }
  // Format de bulletin applicable à un cycle (surcharge par cycle, sinon défaut de l'école)
  function bulletinFmtFor(cycle){ const cfg=schoolCfg(); const m=cfg.bulletinFmtByCycle||{}; return m[cycle]||cfg.bulletinFmt||'vrac'; }
  function classBulletinData(clsId,per){
    const cls=getCls(clsId), cfg=schoolCfg();
    const subs=DB.program.filter(p=>p.cls===clsId).map(p=>({sub:getSub(p.sub),coef:p.coef,oblig:p.oblig,spec:p.spec})).filter(x=>x.sub);
    const studs=DB.students.filter(e=>e.cls===clsId);
    const optOn=!!cfg.optFacCoef1;
    let rows=studs.map(e=>{
      let totPts=0, totCoef=0, sumMoy=0, nMoy=0, facSum=0, facN=0; const lines=[];
      subs.forEach(({sub,coef,oblig,spec})=>{
        const g=gGet(clsId,sub.id,per)[e.id]; const m=moyenne(g);
        const fac=!oblig;
        lines.push({sub,coef,moy:m,fac,spec:!!spec,dom:sub.dom||'autre'});
        if(optOn && fac){ if(m!=null){ facSum+=m; facN++; } return; }
        if(m!=null){ totPts+=m*coef; totCoef+=coef; sumMoy+=m; nMoy++; }
      });
      let facMoy=null;
      if(optOn && facN){ facMoy=avgRound(facSum/facN,cfg); totPts+=facMoy; totCoef+=1; sumMoy+=facMoy; nMoy++; }
      let moyGen = cfg.avgMode==='simple' ? (nMoy?sumMoy/nMoy:null) : (totCoef?totPts/totCoef:null);
      if(moyGen!=null) moyGen=avgRound(moyGen,cfg);
      return { stu:e, lines, facMoy, optOn, totPts:avgRound(totPts,cfg), totCoef, moyGen };
    });
    rows=rows.sort((a,b)=>{ if(a.moyGen==null&&b.moyGen==null) return 0; if(a.moyGen==null) return 1; if(b.moyGen==null) return -1; return b.moyGen-a.moyGen; });
    let lastMoy=null, lastRank=0;
    rows.forEach((r,i)=>{ if(r.moyGen==null){ r.rank=null; return; } if(cfg.rankTies && lastMoy!=null && r.moyGen===lastMoy){ r.rank=lastRank; } else { r.rank=i+1; lastRank=r.rank; } lastMoy=r.moyGen; });
    return { cls, per, rows, subs, cfg };
  }
  function bulletinsAdmin(){
    const cfg=schoolCfg();
    const clsList=DB.classes.filter(c=>activeCycles().includes(c.cycle));
    if(!clsList.length) return `<div class="rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft card-in text-sm text-slate-500">Aucune classe disponible pour les cycles actifs.</div>`;
    if(!clsList.find(c=>c.id===state.blCls)) state.blCls=clsList[0].id;
    const cls=getCls(state.blCls);
    const ptype=cyclePeriodType(cls.cycle), pers=periodList(ptype);
    if(state.blPeriod>=pers.length) state.blPeriod=0;
    const per=pers[state.blPeriod];
    const data=classBulletinData(cls.id,per);
    const gmax=cfg.gradeMax||20;
    const opt=(arr,val,fn)=>arr.map((x,i)=>{const v=fn(x,i);return `<option value="${v.v}"${v.v==val?' selected':''}>${v.t}</option>`;}).join('');
    const clsSel=`<select id="bl_cls" class="${MGIN}">${opt(clsList,state.blCls,c=>({v:c.id,t:clsLabel(c.id)+' · '+c.cycle}))}</select>`;
    const perSel=`<select id="bl_per" class="${MGIN}">${opt(pers,state.blPeriod,(p,i)=>({v:i,t:p}))}</select>`;
    const toolbar=`<div class="rounded-2xl p-3 bg-white dark:bg-slate-900 shadow-soft card-in space-y-2">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2"><div><p class="text-[11px] font-bold text-slate-400 mb-1">Classe</p>${clsSel}</div><div><p class="text-[11px] font-bold text-slate-400 mb-1">Période</p>${perSel}</div></div>
        <button data-blprintall class="${MGBTN} w-full justify-center">🖨️ Imprimer tous les bulletins (${data.rows.length})</button>
      </div>`;
    const got=data.rows.filter(r=>r.moyGen!=null);
    const classAvg=got.length?avgRound(got.reduce((s,r)=>s+r.moyGen,0)/got.length,cfg):null;
    const success=got.length?Math.round(got.filter(r=>r.moyGen>=cfg.passMark).length/got.length*100):0;
    const tiles=`<div class="grid grid-cols-3 gap-3 mt-3">${stat('Élèves',String(data.rows.length),'dans la classe','bg-brand-600')}${stat('Moy. classe',classAvg==null?'–':fmtN(classAvg),'/'+gmax,'bg-emerald-600')}${stat('Réussite',success+'%','≥ '+cfg.passMark+'/'+gmax,'bg-indigo-500')}</div>`;
    const head=`<div class="grid grid-cols-6 bg-slate-800 text-white text-[11px] font-bold"><div class="p-2">${cfg.rankVisible?'Rang':'#'}</div><div class="p-2 col-span-2">Élève</div><div class="p-2 text-center">Moy. gén.</div><div class="p-2 text-center col-span-2">Mention</div></div>`;
    const body=data.rows.length?data.rows.map((r,i)=>{
      const ment=r.moyGen==null?'–':mentionFor(r.moyGen,cfg);
      const rk=cfg.rankVisible?(r.rank==null?'–':r.rank+(r.rank===1?'er':'e')):(i+1);
      const pass=r.moyGen!=null&&r.moyGen>=cfg.passMark;
      return `<div class="grid grid-cols-6 items-center text-sm ${i%2?'bg-white dark:bg-slate-900':'bg-slate-50 dark:bg-slate-900/60'}">
          <div class="p-2 font-bold text-brand-600">${rk}</div>
          <div class="p-2 col-span-2 font-semibold truncate">${escH(stuName(r.stu))}</div>
          <div class="p-2 text-center font-bold ${r.moyGen==null?'text-slate-400':(pass?'text-emerald-600':'text-rose-500')}">${r.moyGen==null?'–':fmtN(r.moyGen)}</div>
          <div class="p-2 col-span-2 flex items-center justify-between gap-1"><span class="text-xs text-slate-500 truncate">${escH(ment)}</span><button data-blone="${r.stu.id}" class="shrink-0 text-xs font-bold text-brand-600">Bulletin</button></div>
        </div>`;
    }).join(''):`<div class="p-4 text-sm text-slate-400">Aucun élève inscrit dans cette classe.</div>`;
    const note=data.subs.length?'':`<div class="rounded-2xl p-3 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-semibold card-in mt-3">⚠️ Aucune matière au programme de cette classe — les moyennes resteront vides. Configure le programme dans Gestion → Programmes.</div>`;
    const _fmtLbl={vrac:'en vrac',groupe:'groupé Sci/Litt/Fac',specialite:'groupé Spéc/Gén/Fac'}[bulletinFmtFor(cls.cycle)]||'en vrac';
    return `<div class="rounded-2xl p-3 bg-brand-50 dark:bg-slate-900 text-brand-700 dark:text-brand-300 text-xs font-semibold card-in flex items-center gap-2">${svg_(I.book)} Bulletins calculés selon tes règles (moyenne ${cfg.avgMode==='simple'?'simple':'pondérée'}, arrondi ${cfg.avgDecimals} déc., rang ${cfg.rankVisible?'affiché':'masqué'}, format ${_fmtLbl} pour ${escH(cls.cycle)}).</div>`
      + toolbar + tiles + note
      + section('Classement · '+clsLabel(cls.id)+' · '+per)
      + `<div class="rounded-2xl overflow-hidden shadow-soft card-in">${head}${body}</div>`
      + `<p class="text-[11px] text-slate-400 mt-2">Astuce : « Bulletin » imprime un élève, « Imprimer tous » génère la classe entière (un bulletin par page).</p>`;
  }
  function wireBulletins(){
    const main=$('#main');
    const c=main.querySelector('#bl_cls'); if(c) c.addEventListener('change',()=>{ state.blCls=c.value; state.blPeriod=0; renderView(); });
    const p=main.querySelector('#bl_per'); if(p) p.addEventListener('change',()=>{ state.blPeriod=+p.value; renderView(); });
    main.querySelectorAll('[data-blone]').forEach(b=>b.addEventListener('click',()=>printBulletins(state.blCls,periodList(cyclePeriodType(getCls(state.blCls).cycle))[state.blPeriod],b.dataset.blone)));
    const all=main.querySelector('[data-blprintall]'); if(all) all.addEventListener('click',()=>printBulletins(state.blCls,periodList(cyclePeriodType(getCls(state.blCls).cycle))[state.blPeriod],null));
  }

  // ---------- CARTES SCOLAIRES (par classe) ----------
  function cartesAdmin(){
    const cfg=schoolCfg();
    const clsList=DB.classes.filter(c=>activeCycles().includes(c.cycle));
    if(!clsList.length) return `<div class="rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft card-in text-sm text-slate-500">Aucune classe disponible pour les cycles actifs.</div>`;
    if(!clsList.find(c=>c.id===state.cartesCls)) state.cartesCls=clsList[0].id;
    const data=classCardsData(state.cartesCls);
    const n=data.cards.length;
    const opt=(arr,val,fn)=>arr.map(x=>{const v=fn(x);return `<option value="${v.v}"${v.v==val?' selected':''}>${escH(v.t)}</option>`;}).join('');
    const clsSel=`<select id="ca_cls" class="${MGIN}">${opt(clsList,state.cartesCls,c=>({v:c.id,t:clsLabel(c.id)+' · '+c.cycle}))}</select>`;
    const toolbar=`<div class="rounded-2xl p-3 bg-white dark:bg-slate-900 shadow-soft card-in space-y-2">
        <div><p class="text-[11px] font-bold text-slate-400 mb-1">Classe</p>${clsSel}</div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button data-caprint ${n?'':'disabled'} class="${MGBTN} w-full justify-center ${n?'':'opacity-50 pointer-events-none'}">🖨️ Imprimer les cartes (${n})</button>
          <button data-capdf ${n?'':'disabled'} class="px-4 py-2.5 rounded-xl bg-slate-800 dark:bg-slate-700 text-white text-xs font-bold whitespace-nowrap active:scale-95 transition w-full justify-center ${n?'':'opacity-50 pointer-events-none'}">⬇️ Exporter en PDF (${n})</button>
        </div>
      </div>`;
    const cards=n?data.cards.map(c=>cardPreviewHTML(c,data)).join(''):`<div class="p-4 text-sm text-slate-400">Aucun élève inscrit dans cette classe.</div>`;
    const grid=n?`<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">${cards}</div>`:cards;
    return `<div class="rounded-2xl p-3 bg-brand-50 dark:bg-slate-900 text-brand-700 dark:text-brand-300 text-xs font-semibold card-in flex items-center gap-2">${svg_(I.users)} Cartes scolaires au format carte bancaire (85×54 mm) — recto avec photo, matricule, classe et QR. Valable pour l'année ${escH(data.year)}.</div>`
      + toolbar
      + section('Aperçu · '+clsLabel(data.klass.id)+' · '+n+' carte'+(n>1?'s':''))
      + grid
      + `<p class="text-[11px] text-slate-400 mt-2">Astuce : le bouton ci-dessus ouvre une page prête à imprimer (plusieurs cartes par feuille A4).</p>`;
  }
  function wireCartes(){
    const main=$('#main');
    const c=main.querySelector('#ca_cls'); if(c) c.addEventListener('change',()=>{ state.cartesCls=c.value; renderView(); });
    const p=main.querySelector('[data-caprint]'); if(p) p.addEventListener('click',()=>printCards(state.cartesCls));
    const d=main.querySelector('[data-capdf]'); if(d) d.addEventListener('click',()=>exportCardsPDF(state.cartesCls));
  }
  function _cardInitials(c){ return ((c.prenom||' ')[0]+''+(c.nom||' ')[0]).toUpperCase().trim()||'·'; }
  // Aperçu (tailwind) d'une carte dans l'app.
  function cardPreviewHTML(c,data){
    const sc=data.school||{}; const k=data.klass||{};
    const photo=c.photo
      ? `<img src="${c.photo}" alt="" class="w-14 h-16 rounded-lg object-cover border border-slate-200 dark:border-slate-700">`
      : `<div class="w-14 h-16 rounded-lg grid place-items-center bg-brand-100 text-brand-700 font-extrabold text-lg">${escH(_cardInitials(c))}</div>`;
    const logo=sc.logo?`<img src="${sc.logo}" alt="" class="w-7 h-7 rounded-md object-cover">`:`<div class="w-7 h-7 rounded-md bg-white/20"></div>`;
    const qr=qrSVG(c.qr,120); const qrBox=qr?`<div class="w-14 h-14 bg-white rounded-md p-0.5 shrink-0" style="line-height:0">${qr}</div>`:'';
    const clsLbl=(k.name||'')+(k.grp?' · Gr.'+k.grp:'');
    return `<div class="rounded-2xl overflow-hidden shadow-soft card-in bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div class="bg-gradient-to-r from-brand-600 to-indigo-500 text-white px-3 py-2 flex items-center gap-2">
          ${logo}<div class="min-w-0 flex-1"><p class="text-[11px] font-extrabold truncate">${escH(sc.name||'')}</p><p class="text-[9px] uppercase tracking-wider opacity-90">Carte scolaire</p></div>
          <span class="text-[9px] font-bold bg-white/20 px-1.5 py-0.5 rounded">${escH(data.year||'')}</span>
        </div>
        <div class="p-3 flex gap-3">
          ${photo}
          <div class="min-w-0 flex-1 text-xs space-y-0.5">
            <p class="font-extrabold text-sm truncate text-slate-900 dark:text-white">${escH(c.full_name||'')}</p>
            <p class="text-slate-500">Mat. <b class="text-slate-700 dark:text-slate-200">${escH(c.matricule||'—')}</b></p>
            <p class="text-slate-500">Classe <b class="text-slate-700 dark:text-slate-200">${escH(clsLbl)}</b></p>
            <p class="text-slate-500">Régime <b class="text-slate-700 dark:text-slate-200">${escH(c.regime||'—')}</b></p>
          </div>
          ${qrBox}
        </div>
        <div class="px-3 pb-2 flex items-center justify-between text-[9px] text-slate-400"><span class="font-mono">${escH(c.card_no||'')}</span><span>Valable ${escH(data.year||'')}</span></div>
      </div>`;
  }
  // Markup imprimable (mm) d'une carte.
  function cardFaceHTML(c,data){
    const sc=data.school||{}; const k=data.klass||{};
    const clsLbl=escH((k.name||'')+(k.grp?' · Gr.'+k.grp:''));
    const photo=c.photo?`<img class="ph" src="${c.photo}" alt="">`:`<div class="ph ini">${escH(_cardInitials(c))}</div>`;
    const logo=sc.logo?`<img class="lg" src="${sc.logo}" alt="">`:`<div class="lg"></div>`;
    const qr=qrSVG(c.qr,120);
    return `<div class="card"><div class="hd">${logo}<div class="ht"><b>${escH(sc.name||'')}</b><span>CARTE SCOLAIRE</span></div><div class="yr">${escH(data.year||'')}</div></div>
      <div class="bd">${photo}<div class="inf"><p class="nm">${escH(c.full_name||'')}</p>
        <p><i>Mat.</i> ${escH(c.matricule||'—')}</p><p><i>Classe</i> ${clsLbl}</p>
        <p><i>Régime</i> ${escH(c.regime||'—')}</p>${c.dob?('<p><i>Né(e)</i> '+escH(c.dob)+'</p>'):''}</div>
        <div class="qr">${qr}</div></div>
      <div class="ft"><span class="no">${escH(c.card_no||'')}</span><span>Valable ${escH(data.year||'')}</span></div></div>`;
  }
  function cardsDocHTML(data){
    const faces=(data.cards||[]).map(c=>cardFaceHTML(c,data)).join('');
    const css=`*{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}body{margin:0;background:#eef2f7;color:#111}`
      +`.sheet{display:flex;flex-wrap:wrap;gap:4mm;padding:8mm;justify-content:flex-start}`
      +`.card{width:85.6mm;height:53.98mm;background:#fff;border:1px solid #cbd5e1;border-radius:3mm;overflow:hidden;display:flex;flex-direction:column;page-break-inside:avoid}`
      +`.hd{display:flex;align-items:center;gap:2mm;padding:2mm 3mm;background:linear-gradient(90deg,#2563eb,#6366f1);color:#fff}`
      +`.lg{width:9mm;height:9mm;border-radius:1.5mm;object-fit:cover;background:rgba(255,255,255,.25)}`
      +`.ht{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.1}.ht b{font-size:3.4mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ht span{font-size:2.1mm;letter-spacing:.6mm;opacity:.9}`
      +`.yr{font-size:2.3mm;font-weight:bold;background:rgba(255,255,255,.22);padding:.6mm 1.4mm;border-radius:1mm}`
      +`.bd{flex:1;display:flex;gap:2.5mm;padding:2.5mm 3mm;align-items:center}`
      +`.ph{width:16mm;height:20mm;border-radius:1.5mm;object-fit:cover;border:.3mm solid #cbd5e1;flex-shrink:0}`
      +`.ph.ini{display:flex;align-items:center;justify-content:center;background:#dbeafe;color:#1d4ed8;font-weight:800;font-size:6mm}`
      +`.inf{flex:1;min-width:0;font-size:2.7mm;line-height:1.5}.inf p{margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.inf .nm{font-size:3.4mm;font-weight:800;margin-bottom:.6mm}.inf i{color:#64748b;font-style:normal;font-size:2.3mm;display:inline-block;min-width:13mm}`
      +`.qr{width:17mm;height:17mm;flex-shrink:0}.qr svg{width:100%;height:100%;border:.3mm solid #cbd5e1;border-radius:1mm;background:#fff}`
      +`.ft{display:flex;justify-content:space-between;align-items:center;padding:1.4mm 3mm;border-top:.3mm solid #e2e8f0;font-size:2.1mm;color:#64748b}.ft .no{font-family:monospace;font-weight:bold;color:#334155}`
      +`@media print{body{background:#fff}.sheet{gap:3mm;padding:6mm}.card{border-color:#94a3b8}}`;
    const title='Cartes — '+((data.klass&&data.klass.name)||'')+' — '+(data.year||'');
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escH(title)}</title><style>${css}</style></head><body><div class="sheet">${faces}</div></body></html>`;
  }
  function _openCardsPrint(data){
    if(!data||!data.cards||!data.cards.length){ toast('Aucune carte à imprimer'); return; }
    const doc=cardsDocHTML(data);
    const w=window.open('','_blank'); if(!w){ toast('Autorise les fenêtres pop-up pour imprimer'); return; }
    w.document.open(); w.document.write(doc); w.document.close(); w.focus();
    setTimeout(()=>{ try{ w.print(); }catch(e){} },400);
  }
  function printCards(clsId){
    if(!getCls(clsId)){ toast('Classe introuvable'); return; }
    if(typeof apiOn==='function' && apiOn()){
      classCardsApi(clsId).then(d=>_openCardsPrint(d)).catch(ex=>toast('Cartes indisponibles : '+((ex&&ex.message)||'erreur')));
      return;
    }
    _openCardsPrint(classCardsData(clsId));
  }

  // ---------- Export PDF des cartes (jsPDF, vectoriel, hors-ligne) ----------
  // Convertit une source image en data-URL (les data: passent tels quels).
  function _imgToDataURL(src){
    return new Promise(res=>{
      if(!src){ res(''); return; }
      if(/^data:/i.test(src)){ res(src); return; }
      const im=new Image(); im.crossOrigin='anonymous';
      im.onload=function(){ try{ const cv=document.createElement('canvas'); cv.width=im.naturalWidth||im.width; cv.height=im.naturalHeight||im.height; cv.getContext('2d').drawImage(im,0,0); res(cv.toDataURL('image/png')); }catch(e){ res(''); } };
      im.onerror=function(){ res(''); };
      im.src=src;
    });
  }
  function _pdfFmt(d){ const m=/^data:image\/(png|jpe?g|webp)/i.exec(d||''); if(!m) return 'PNG'; const t=m[1].toLowerCase(); return t==='jpg'||t==='jpeg'?'JPEG':(t==='webp'?'WEBP':'PNG'); }
  // Tronque un texte pour tenir dans maxW (mm) avec … si besoin.
  function _pdfFit(doc,str,maxW){ str=String(str||''); if(doc.getTextWidth(str)<=maxW) return str; let s=str; while(s.length>1 && doc.getTextWidth(s+'…')>maxW){ s=s.slice(0,-1); } return s+'…'; }
  // Dessine le QR (modules) en vectoriel a (x,y) sur size mm.
  function _pdfQR(doc,text,x,y,size){
    try{ if(typeof qrcode==='undefined') return; const qr=qrcode(0,'M'); qr.addData(String(text||'')); qr.make(); const nn=qr.getModuleCount(); const cell=size/nn;
      doc.setFillColor(255,255,255); doc.rect(x,y,size,size,'F');
      doc.setFillColor(17,17,17);
      for(let r=0;r<nn;r++){ for(let c=0;c<nn;c++){ if(qr.isDark(r,c)) doc.rect(x+c*cell,y+r*cell,cell+0.02,cell+0.02,'F'); } }
    }catch(e){}
  }
  // Dessine une carte a (x,y). imgMap: src -> data-url.
  function _pdfCard(doc,c,data,x,y,imgMap){
    const sc=data.school||{}, k=data.klass||{}; const W=85.6,H=53.98,R=3;
    doc.setFillColor(255,255,255); doc.roundedRect(x,y,W,H,R,R,'F');
    // bandeau
    doc.setFillColor(37,99,235); doc.roundedRect(x,y,W,11,R,R,'F'); doc.rect(x,y+8,W,3,'F');
    const logo=sc.logo?imgMap[sc.logo]:''; let tx=x+3;
    if(logo){ try{ doc.addImage(logo,_pdfFmt(logo),x+2.5,y+1.5,8,8); tx=x+12.5; }catch(e){} }
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(9);
    doc.text(_pdfFit(doc,sc.name||'',(x+W-14)-tx),tx,y+4.6);
    doc.setFont('helvetica','normal'); doc.setFontSize(6); doc.text('CARTE SCOLAIRE',tx,y+8.2);
    doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.text(String(data.year||''),x+W-3,y+4.6,{align:'right'});
    // photo
    const px=x+3,py=y+13,pw=16,ph=20; const photo=c.photo?imgMap[c.photo]:''; let ok=false;
    if(photo){ try{ doc.addImage(photo,_pdfFmt(photo),px,py,pw,ph); ok=true; }catch(e){} }
    if(!ok){ doc.setFillColor(219,234,254); doc.roundedRect(px,py,pw,ph,1.5,1.5,'F'); doc.setTextColor(29,78,216); doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.text(_cardInitials(c),px+pw/2,py+ph/2+2.5,{align:'center'}); }
    doc.setDrawColor(203,213,225); doc.roundedRect(px,py,pw,ph,1.5,1.5,'S');
    // infos
    const ix=x+22; let iy=y+16.5; const iw=(x+W-20)-ix;
    doc.setTextColor(17,17,17); doc.setFont('helvetica','bold'); doc.setFontSize(9.5); doc.text(_pdfFit(doc,c.full_name||'',iw),ix,iy); iy+=4.6;
    const clsLbl=(k.name||'')+(k.grp?' · Gr.'+k.grp:'');
    const rows=[['Mat.',c.matricule||'—'],['Classe',clsLbl||'—'],['Régime',c.regime||'—']]; if(c.dob) rows.push(['Né(e)',c.dob]);
    doc.setFontSize(7.5);
    rows.forEach(rw=>{ doc.setTextColor(100,116,139); doc.setFont('helvetica','normal'); doc.text(rw[0],ix,iy); doc.setTextColor(30,41,59); doc.setFont('helvetica','bold'); doc.text(_pdfFit(doc,rw[1],iw-13),ix+13,iy); iy+=4; });
    // QR
    _pdfQR(doc,c.qr,x+W-19,y+14,16);
    // pied
    doc.setDrawColor(226,232,240); doc.line(x+3,y+H-5.5,x+W-3,y+H-5.5);
    doc.setFontSize(6); doc.setTextColor(51,65,85); doc.setFont('courier','bold'); doc.text(_pdfFit(doc,c.card_no||'',W-34),x+3,y+H-2.2);
    doc.setTextColor(100,116,139); doc.setFont('helvetica','normal'); doc.text('Valable '+(data.year||''),x+W-3,y+H-2.2,{align:'right'});
    // bordure
    doc.setDrawColor(148,163,184); doc.roundedRect(x,y,W,H,R,R,'S');
  }
  function _buildCardsPDF(data,imgMap){
    const J=(window.jspdf&&window.jspdf.jsPDF)?window.jspdf.jsPDF:(window.jsPDF||null);
    if(!J){ toast('Module PDF indisponible'); return; }
    const doc=new J({unit:'mm',format:'a4',orientation:'portrait'});
    const W=85.6,H=53.98,gx=6,gy=5,mx=(210-(2*W+gx))/2,my=8; const cols=2,rows=5,per=cols*rows;
    (data.cards||[]).forEach((c,i)=>{ const p=Math.floor(i/per); if(i>0&&i%per===0) doc.addPage(); const idx=i%per; const col=idx%cols, row=Math.floor(idx/cols); const x=mx+col*(W+gx), y=my+row*(H+gy); _pdfCard(doc,c,data,x,y,imgMap); });
    const slug=(data.school&&data.school.slug)||'xs'; const kn=(data.klass&&data.klass.name)||'classe';
    const safe=s=>String(s||'').normalize('NFD').replace(/[^\w.-]+/g,'-').replace(/^-+|-+$/g,'')||'x';
    doc.save('cartes-'+safe(slug)+'-'+safe(kn)+'-'+safe(data.year)+'.pdf');
  }
  function _exportCardsData(data){
    if(!data||!data.cards||!data.cards.length){ toast('Aucune carte à exporter'); return; }
    const srcs=[]; if(data.school&&data.school.logo) srcs.push(data.school.logo); data.cards.forEach(c=>{ if(c.photo) srcs.push(c.photo); });
    const uniq=srcs.filter((v,i)=>v&&srcs.indexOf(v)===i);
    toast('Génération du PDF…');
    Promise.all(uniq.map(s=>_imgToDataURL(s).then(d=>[s,d]))).then(pairs=>{ const map={}; pairs.forEach(p=>{ if(p[1]) map[p[0]]=p[1]; }); _buildCardsPDF(data,map); }).catch(()=>_buildCardsPDF(data,{}));
  }
  function exportCardsPDF(clsId){
    if(!getCls(clsId)){ toast('Classe introuvable'); return; }
    if(typeof apiOn==='function' && apiOn()){
      classCardsApi(clsId).then(d=>_exportCardsData(d)).catch(ex=>toast('Cartes indisponibles : '+((ex&&ex.message)||'erreur')));
      return;
    }
    _exportCardsData(classCardsData(clsId));
  }

  // ---------- FEUILLES DE PRÉSENCE (par classe) ----------
  function feuillesAdmin(){
    const clsList=DB.classes.filter(c=>activeCycles().includes(c.cycle));
    if(!clsList.length) return `<div class="rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft card-in text-sm text-slate-500">Aucune classe disponible pour les cycles actifs.</div>`;
    if(!clsList.find(c=>c.id===state.feuillesCls)) state.feuillesCls=clsList[0].id;
    const data=classCardsData(state.feuillesCls);
    const n=data.cards.length; const cols=state.feuillesCols||15;
    const opt=(arr,val,fn)=>arr.map(x=>{const v=fn(x);return `<option value="${v.v}"${v.v==val?' selected':''}>${escH(v.t)}</option>`;}).join('');
    const clsSel=`<select id="fp_cls" class="${MGIN}">${opt(clsList,state.feuillesCls,c=>({v:c.id,t:clsLabel(c.id)+' · '+c.cycle}))}</select>`;
    const colSel=`<select id="fp_cols" class="${MGIN}">${[5,10,15,20,25].map(v=>`<option value="${v}"${v===cols?' selected':''}>${v} colonnes</option>`).join('')}</select>`;
    const toolbar=`<div class="rounded-2xl p-3 bg-white dark:bg-slate-900 shadow-soft card-in space-y-2">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2"><div><p class="text-[11px] font-bold text-slate-400 mb-1">Classe</p>${clsSel}</div><div><p class="text-[11px] font-bold text-slate-400 mb-1">Colonnes de séances</p>${colSel}</div></div>
        <button data-fppdf ${n?'':'disabled'} class="px-4 py-2.5 rounded-xl bg-slate-800 dark:bg-slate-700 text-white text-xs font-bold whitespace-nowrap active:scale-95 transition w-full justify-center ${n?'':'opacity-50 pointer-events-none'}">⬇️ Exporter la feuille de présence en PDF (${n})</button>
      </div>`;
    const head=`<div class="grid grid-cols-12 bg-slate-800 text-white text-[11px] font-bold"><div class="p-2 col-span-1">N°</div><div class="p-2 col-span-3">Matricule</div><div class="p-2 col-span-6">Nom & prénom</div><div class="p-2 col-span-2 text-center">Sexe</div></div>`;
    const body=n?data.cards.map((c,i)=>`<div class="grid grid-cols-12 items-center text-sm ${i%2?'bg-white dark:bg-slate-900':'bg-slate-50 dark:bg-slate-900/60'}"><div class="p-2 col-span-1 font-bold text-brand-600">${i+1}</div><div class="p-2 col-span-3 font-mono text-xs">${escH(c.matricule||'—')}</div><div class="p-2 col-span-6 font-semibold truncate">${escH(c.full_name||'')}</div><div class="p-2 col-span-2 text-center">${escH(c.sexe||'—')}</div></div>`).join(''):`<div class="p-4 text-sm text-slate-400">Aucun élève inscrit dans cette classe.</div>`;
    return `<div class="rounded-2xl p-3 bg-brand-50 dark:bg-slate-900 text-brand-700 dark:text-brand-300 text-xs font-semibold card-in flex items-center gap-2">${svg_(I.doc)} Feuille de présence imprimable (A4 paysage) — effectif de la classe + colonnes de séances à émarger. Année ${escH(data.year)}.</div>`
      + toolbar
      + section('Effectif · '+clsLabel(data.klass.id)+' · '+n+' élève'+(n>1?'s':''))
      + `<div class="rounded-2xl overflow-hidden shadow-soft card-in">${head}${body}</div>`
      + `<p class="text-[11px] text-slate-400 mt-2">Le PDF ajoute ${cols} colonnes vierges pour cocher la présence et une ligne de date à remplir.</p>`;
  }
  function wireFeuilles(){
    const main=$('#main');
    const c=main.querySelector('#fp_cls'); if(c) c.addEventListener('change',()=>{ state.feuillesCls=c.value; renderView(); });
    const k=main.querySelector('#fp_cols'); if(k) k.addEventListener('change',()=>{ state.feuillesCols=+k.value; renderView(); });
    const d=main.querySelector('[data-fppdf]'); if(d) d.addEventListener('click',()=>exportAttendancePDF(state.feuillesCls));
  }
  function _buildAttendancePDF(data,cols){
    const J=(window.jspdf&&window.jspdf.jsPDF)?window.jspdf.jsPDF:(window.jsPDF||null);
    if(!J){ toast('Module PDF indisponible'); return; }
    const doc=new J({unit:'mm',format:'a4',orientation:'landscape'});
    const PW=297,PH=210,M=12; const sc=data.school||{}, k=data.klass||{};
    const clsLbl=(k.name||'')+(k.grp?' · Gr.'+k.grp:'');
    // colonnes du tableau
    const base=[['N°',9],['Matricule',26],['Nom & prénom',68],['Sexe',11]];
    const fixed=base.reduce((s,c)=>s+c[1],0); const rest=(PW-2*M)-fixed; const cw=rest/cols;
    const cells=base.slice(); for(let i=0;i<cols;i++) cells.push([String(i+1),cw]);
    const xs=[]; let xx=M; cells.forEach(c=>{ xs.push(xx); xx+=c[1]; }); const tableW=xx-M;
    const rowH=7.2, headH=9; const topTable=42; const bottom=PH-10;
    function titleBlock(){
      doc.setTextColor(17,17,17); doc.setFont('helvetica','bold'); doc.setFontSize(13);
      doc.text(_pdfFit(doc,sc.name||'',PW-2*M-40),M,M+5);
      doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(100,116,139);
      if(sc.address||sc.phone) doc.text(_pdfFit(doc,[sc.address,sc.phone].filter(Boolean).join(' · '),PW-2*M-40),M,M+9.5);
      doc.setTextColor(17,17,17); doc.setFont('helvetica','bold'); doc.setFontSize(8.5);
      doc.text('Année : '+(data.year||''),PW-M,M+5,{align:'right'});
      doc.setFontSize(12); doc.text('LISTE DE PRÉSENCE',PW/2,M+15,{align:'center'});
      doc.setFont('helvetica','normal'); doc.setFontSize(9);
      doc.text('Classe : '+clsLbl+'      Effectif : '+(data.cards||[]).length+'      Date : ____ / ____ / ________      Matière / Séance : _______________',M,M+22);
    }
    function header(y){
      doc.setFillColor(31,41,55); doc.rect(M,y,tableW,headH,'F');
      doc.setTextColor(255,255,255); doc.setFont('helvetica','bold');
      cells.forEach((c,i)=>{ const isS=i>=base.length; doc.setFontSize(isS?7:8); const cx=isS?(xs[i]+c[1]/2):(xs[i]+1.5); const al=isS?'center':'left'; doc.text(String(c[0]),cx,y+headH/2+1.3,{align:al}); });
      // verticales header
      doc.setDrawColor(203,213,225); cells.forEach((c,i)=>{ doc.line(xs[i],y,xs[i],y+headH); }); doc.line(M+tableW,y,M+tableW,y+headH);
      return y+headH;
    }
    titleBlock(); let y=header(topTable); let idx=0;
    (data.cards||[]).forEach((c,i)=>{
      if(y+rowH>bottom){ doc.setDrawColor(148,163,184); doc.rect(M,topTable,tableW, y-topTable,'S'); doc.addPage(); titleBlock(); y=header(topTable); idx=0; }
      if(idx%2===1){ doc.setFillColor(243,246,250); doc.rect(M,y,tableW,rowH,'F'); }
      doc.setTextColor(17,17,17); doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
      doc.text(String(i+1),xs[0]+c0off(),y+rowH/2+1.3,{align:'center'});
      doc.setFontSize(7.5); doc.setFont('courier','normal'); doc.text(_pdfFit(doc,c.matricule||'',base[1][1]-3),xs[1]+1.5,y+rowH/2+1.3);
      doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.text(_pdfFit(doc,c.full_name||'',base[2][1]-3),xs[2]+1.5,y+rowH/2+1.3);
      doc.setFont('helvetica','normal'); doc.text(c.sexe||'',xs[3]+base[3][1]/2,y+rowH/2+1.3,{align:'center'});
      // verticales ligne
      doc.setDrawColor(226,232,240); cells.forEach((cc,j)=>{ doc.line(xs[j],y,xs[j],y+rowH); }); doc.line(M+tableW,y,M+tableW,y+rowH);
      doc.setDrawColor(226,232,240); doc.line(M,y+rowH,M+tableW,y+rowH);
      y+=rowH; idx++;
    });
    function c0off(){ return base[0][1]/2; }
    doc.setDrawColor(148,163,184); doc.rect(M,topTable,tableW,y-topTable,'S');
    doc.setFontSize(7.5); doc.setTextColor(100,116,139); doc.setFont('helvetica','normal');
    doc.text('Signature de l\'enseignant : __________________________          Signature du responsable : __________________________',M,Math.min(y+8,PH-5));
    const safe=s=>String(s||'').normalize('NFD').replace(/[^\w.-]+/g,'-').replace(/^-+|-+$/g,'')||'x';
    doc.save('feuille-presence-'+safe((sc.slug)||'xs')+'-'+safe(k.name||'classe')+'-'+safe(data.year)+'.pdf');
  }
  function _exportAttendance(data){
    if(!data||!data.cards||!data.cards.length){ toast('Aucun élève à lister'); return; }
    toast('Génération du PDF…'); _buildAttendancePDF(data,state.feuillesCols||15);
  }
  function exportAttendancePDF(clsId){
    if(!getCls(clsId)){ toast('Classe introuvable'); return; }
    if(typeof apiOn==='function' && apiOn()){
      classCardsApi(clsId).then(d=>_exportAttendance(d)).catch(ex=>toast('Liste indisponible : '+((ex&&ex.message)||'erreur')));
      return;
    }
    _exportAttendance(classCardsData(clsId));
  }
  function bulletinBlockHTML(r,ctx){
    const {cls,per,cfg,gmax,sc}=ctx; const e=r.stu;
    const fmt=n=>n==null?'–':fmtN(n);
    const optOn=!!r.optOn;
    const subTr=l=>{
      const app=l.moy==null?'–':mentionFor(l.moy,cfg);
      const ncCell=(optOn&&l.fac)?'<span class="opt">opt.</span>':fmt(l.moy==null?null:avgRound(l.moy*l.coef,cfg));
      const coefCell=l.coef+((optOn&&l.fac)?' *':'');
      return `<tr><td class="nm">${escH(l.sub.n)}${l.fac?' <span class="fac">(fac.)</span>':''}</td><td>${fmt(l.moy)}</td><td>${coefCell}</td><td class="b">${ncCell}</td><td class="ap">${escH(app)}</td></tr>`;
    };
    const facAggTr=(optOn&&r.facMoy!=null)?`<tr class="agg"><td class="nm">Moyenne des matières facultatives *</td><td>${fmt(r.facMoy)}</td><td>1</td><td class="b">${fmt(r.facMoy)}</td><td class="ap">—</td></tr>`:'';
    const grpRows=(label,arr,withAgg)=>{
      const showAgg=withAgg&&optOn&&r.facMoy!=null;
      if(!arr.length&&!showAgg) return '';
      return `<tr class="grp"><td colspan="5">${escH(label)}</td></tr>`+arr.map(subTr).join('')+(showAgg?facAggTr:'');
    };
    let lignes;
    const fmt_=ctx.fmt||cfg.bulletinFmt||'vrac';
    if(fmt_==='groupe'){
      const sci=r.lines.filter(l=>!l.fac&&l.dom==='sci');
      const litt=r.lines.filter(l=>!l.fac&&l.dom==='litt');
      const autre=r.lines.filter(l=>!l.fac&&l.dom!=='sci'&&l.dom!=='litt');
      const fac=r.lines.filter(l=>l.fac);
      lignes=grpRows('Matières scientifiques',sci)+grpRows('Matières littéraires',litt)+grpRows('Autres matières',autre)+grpRows('Matières facultatives',fac,true);
    }else if(fmt_==='specialite'){
      const spec=r.lines.filter(l=>!l.fac&&l.spec);
      const gen=r.lines.filter(l=>!l.fac&&!l.spec);
      const fac=r.lines.filter(l=>l.fac);
      lignes=grpRows('Matières de spécialité',spec)+grpRows('Matières générales',gen)+grpRows('Matières facultatives',fac,true);
    }else{
      lignes=r.lines.map(subTr).join('')+facAggTr;
    }
    if(!lignes) lignes='<tr><td colspan="5" class="empty">Aucune matière au programme.</td></tr>';
    const rang=cfg.rankVisible&&r.rank!=null?(r.rank+(r.rank===1?'er':'e')+' / '+ctx.eff):'';
    const ment=r.moyGen==null?'–':mentionFor(r.moyGen,cfg);
    const pass=r.moyGen!=null&&r.moyGen>=cfg.passMark;
    const decision=r.moyGen==null?'–':(pass?'Admis(e) en classe supérieure':'Travail insuffisant');
    const en=e.enrollments&&e.enrollments.find(x=>x.year===state.year); const statut=en?en.statut:(e.statut||'');
    return `<section class="bul">
      ${printHeaderHTML(ctx)}
      <p class="title">BULLETIN DE NOTES — ${escH(per)} · ${escH(state.year)}</p>
      <table class="info"><tbody>
        <tr><td class="k">Élève</td><td>${escH(stuName(e))}</td><td class="k">Matricule</td><td>${escH(e.mat||'–')}</td></tr>
        <tr><td class="k">Classe</td><td>${escH(clsLabel(cls.id))}</td><td class="k">Statut</td><td>${escH(statut||'–')}</td></tr>
      </tbody></table>
      <table class="grades"><thead><tr><th style="text-align:left">Matière</th><th>Moyenne /${gmax}</th><th>Coef</th><th>Moy×Coef</th><th>Appréciation</th></tr></thead>
        <tbody>${lignes}</tbody>
        <tfoot><tr><td class="nm">Totaux</td><td></td><td>${r.totCoef}</td><td class="b">${fmt(r.totPts)}</td><td></td></tr></tfoot></table>
      <div class="synth">
        <div class="box"><span>Moyenne générale</span><b class="${pass?'ok':'ko'}">${fmt(r.moyGen)} / ${gmax}</b></div>
        ${rang?`<div class="box"><span>Rang</span><b>${escH(rang)}</b></div>`:''}
        <div class="box"><span>Mention</span><b>${escH(ment)}</b></div>
        <div class="box"><span>Décision</span><b class="${pass?'ok':'ko'}">${escH(decision)}</b></div>
      </div>
      <p class="appr"><b>Appréciation du conseil :</b> ____________________________________________</p>
      ${optOn?'<p class="foot">* La moyenne des matières facultatives compte comme une note unique au coefficient 1.</p>':''}
      <div class="bottom"><div class="qr">${ctx.qr?ctx.qr([sc.name||'',(e.mat||e.id||''),per,(r.moyGen==null?'NA':fmtN(r.moyGen)),state.year].join('|')):''}<span>Bulletin vérifiable<br>${escH(e.mat||'–')} · ${escH(per)}</span></div><div class="sign"><div>Le/la Titulaire</div><div>${escH(cfg.director||'La Direction')}</div></div></div>
    </section>`;
  }
  // CSS commun des bulletins imprimables (standard + officiel) : banniere d'en-tete partagee.
  function bulletinCSS(){
    return `*{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}body{margin:0;color:#111}.bul{padding:18mm 14mm;page-break-after:always}.bul:last-child{page-break-after:auto}.bhead{display:flex;align-items:center;gap:12px;border-bottom:2px solid #1f2937;padding-bottom:8px}.logo{width:54px;height:54px;object-fit:cover;border-radius:8px}h1{font-size:17px;margin:0}.addr{color:#555;font-size:11px;margin:2px 0 0}.title{text-align:center;font-weight:bold;font-size:13px;margin:12px 0;letter-spacing:.5px}table{width:100%;border-collapse:collapse;font-size:12px}table.info{margin-bottom:10px}table.info td{border:1px solid #cbd5e1;padding:6px 8px}table.info td.k{background:#f1f5f9;font-weight:bold;width:14%}table.grades th,table.grades td{border:1px solid #94a3b8;padding:6px 8px;text-align:center}table.grades th{background:#1f2937;color:#fff}table.grades td.nm{text-align:left;font-weight:600}table.grades td.b{font-weight:bold}table.grades td.ap{font-size:11px;color:#444}table.grades tfoot td{background:#f1f5f9;font-weight:bold}.empty{color:#888;padding:14px}.synth{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap}.synth .box{flex:1;min-width:120px;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;display:flex;flex-direction:column;gap:3px}.synth .box span{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.4px}.synth .box b{font-size:15px}.synth .ok{color:#047857}.synth .ko{color:#dc2626}.appr{font-size:12px;margin-top:16px;color:#333}.sign{margin-top:28px;display:flex;justify-content:space-between;font-size:12px}.sign div{width:42%;border-top:1px solid #999;padding-top:6px;text-align:center;color:#555}table.grades tr.grp td{background:#e2e8f0;color:#1f2937;text-align:left;font-weight:bold;font-size:10px;letter-spacing:.4px;text-transform:uppercase}table.grades tr.agg td{background:#f8fafc;font-style:italic}.fac{color:#64748b;font-size:10px;font-style:italic}.opt{color:#94a3b8;font-size:10px}.foot{font-size:10px;color:#64748b;margin:6px 0 0;font-style:italic}.bottom{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-top:20px}.bottom .sign{flex:1;margin-top:0}.qr{display:flex;align-items:center;gap:8px}.qr svg{width:82px;height:82px;border:1px solid #cbd5e1;border-radius:6px;padding:3px;background:#fff}.qr span{font-size:9px;color:#64748b;line-height:1.35}`
      + `.xs-hd{display:flex;align-items:center;gap:14px;border-bottom:3px solid #1f2937;padding-bottom:10px}.xs-logo{width:58px;height:58px;object-fit:cover;border-radius:10px;flex:0 0 auto}.xs-logo.xs-ph{background:#eef2f7;border:1px dashed #cbd5e1}.xs-hd-main{flex:1;min-width:0}.xs-hd-main h1{font-size:18px;margin:0;letter-spacing:.3px}.xs-sub{color:#555;font-size:11px;margin:2px 0 0}.xs-sub2{color:#64748b;font-size:10px;margin:1px 0 0}.xs-hd-year{font-size:11px;font-weight:bold;color:#1f2937;border:1px solid #cbd5e1;border-radius:999px;padding:3px 10px;white-space:nowrap}table.recap{margin-top:14px}table.recap th,table.recap td{border:1px solid #94a3b8;padding:6px 8px;text-align:center}table.recap th{background:#334155;color:#fff}table.recap td.pl{text-align:left;font-weight:600}table.recap tr.an td{background:#f1f5f9;font-weight:bold}`
      + `@media print{.bul{padding:12mm}}`;
  }
  // ===== En-tete STANDARD reutilisable (banniere commune a tous les docs imprimables) =====
  function printHeaderHTML(ctx){
    const sc=ctx.sc||{}, cfg=ctx.cfg||schoolCfg();
    const line2=[cfg.email,cfg.director?('Directeur : '+cfg.director):''].filter(Boolean).join(' · ');
    return `<div class="xs-hd">${sc.logo?`<img class="xs-logo" src="${sc.logo}" alt="">`:'<div class="xs-logo xs-ph"></div>'}<div class="xs-hd-main"><h1>${escH(sc.name||'Établissement')}</h1><p class="xs-sub">${escH(ctx.addr||'')}</p>${line2?`<p class="xs-sub2">${escH(line2)}</p>`:''}</div><div class="xs-hd-year">Année ${escH(ctx.year||state.year||'')}</div></div>`;
  }
  // Blocs communs (identite eleve + pied signature/QR + synthese annuelle)
  function _bulInfoHTML(e,cls){
    const en=e.enrollments&&e.enrollments.find(x=>x.year===state.year); const statut=en?en.statut:(e.statut||'');
    return `<table class="info"><tbody><tr><td class="k">Élève</td><td>${escH(stuName(e))}</td><td class="k">Matricule</td><td>${escH(e.mat||'–')}</td></tr><tr><td class="k">Classe</td><td>${escH(clsLabel(cls.id))}</td><td class="k">Statut</td><td>${escH(statut||'–')}</td></tr></tbody></table>`;
  }
  function _bulBottomHTML(e,ctx,moy,perLabel){
    const sc=ctx.sc||{}, cfg=ctx.cfg||schoolCfg();
    return `<div class="bottom"><div class="qr">${ctx.qr?ctx.qr([sc.name||'',(e.mat||e.id||''),perLabel,(moy==null?'NA':fmtN(moy)),state.year].join('|')):''}<span>Bulletin vérifiable<br>${escH(e.mat||'–')} · ${escH(perLabel)}</span></div><div class="sign"><div>Le/la Titulaire</div><div>${escH(cfg.director||'La Direction')}</div></div></div>`;
  }
  function _synthHTML(moy,rank,eff,cfg,gmax){
    const fmt=n=>n==null?'–':fmtN(n);
    const rang=cfg.rankVisible&&rank!=null?(rank+(rank===1?'er':'e')+' / '+eff):'';
    const ment=moy==null?'–':mentionFor(moy,cfg);
    const pass=moy!=null&&moy>=cfg.passMark;
    const decision=moy==null?'–':(pass?'Admis(e) en classe supérieure':'Travail insuffisant');
    return `<div class="synth"><div class="box"><span>Moyenne annuelle</span><b class="${pass?'ok':'ko'}">${fmt(moy)} / ${gmax}</b></div>${rang?`<div class="box"><span>Rang annuel</span><b>${escH(rang)}</b></div>`:''}<div class="box"><span>Mention</span><b>${escH(ment)}</b></div><div class="box"><span>Décision finale</span><b class="${pass?'ok':'ko'}">${escH(decision)}</b></div></div>`;
  }
  // Recapitulatif des periodes (moy. generale + rang + mention) + ligne annuelle — commun aux 2 modeles
  function _recapPeriodesHTML(r,agg,ctx){
    const {cfg,gmax,eff}=ctx; const pers=agg.pers; const fmt=n=>n==null?'–':fmtN(n);
    return `<table class="recap"><thead><tr><th class="pl" style="text-align:left">Période</th><th>Moy. générale /${gmax}</th><th>Rang</th><th>Mention</th></tr></thead><tbody>`
      + pers.map((p,i)=>{ const pm=r.per[i]; const rk=(cfg.rankVisible&&pm.rank!=null)?(pm.rank+(pm.rank===1?'er':'e')+' / '+eff):'–'; return `<tr><td class="pl">${escH(p)}</td><td>${fmt(pm.moyGen)}</td><td>${escH(rk)}</td><td>${pm.moyGen==null?'–':escH(mentionFor(pm.moyGen,cfg))}</td></tr>`; }).join('')
      + `<tr class="an"><td class="pl">Moyenne annuelle</td><td>${fmt(r.annualMoy)}</td><td>${(cfg.rankVisible&&r.annualRank!=null)?escH(r.annualRank+(r.annualRank===1?'er':'e')+' / '+eff):'–'}</td><td>${r.annualMoy==null?'–':escH(mentionFor(r.annualMoy,cfg))}</td></tr>`
      + `</tbody></table>`;
  }
  // ===== MODELE 2 (cycles SEMESTRIELS) : detail par matiere S1 / S2 / Annuel + rang =====
  function officielBlockSemestre(r,agg,ctx){
    const {cfg,gmax,eff}=ctx; const e=r.stu; const fmt=n=>n==null?'–':fmtN(n);
    let totCoef=0, totPts=0;
    const lignes=agg.subs.map(({sub})=>{
      const o=r.subj[sub.id]; if(!o) return '';
      const an=o.annual, coef=o.coef; const mc=(an==null)?null:avgRound(an*coef,cfg);
      if(an!=null){ totCoef+=coef; totPts+=mc; }
      const rk=(cfg.rankVisible&&o.annualRank!=null)?(o.annualRank+(o.annualRank===1?'er':'e')):'';
      return `<tr><td class="nm">${escH(sub.n)}${o.fac?' <span class="fac">(fac.)</span>':''}</td><td>${o.coef}</td><td>${fmt(o.per[0])}</td><td>${fmt(o.per[1])}</td><td class="b">${fmt(an)}</td><td>${fmt(mc)}</td><td class="ap">${escH(rk)}</td></tr>`;
    }).join('')||'<tr><td colspan="7" class="empty">Aucune matière au programme.</td></tr>';
    return `<section class="bul">
      ${printHeaderHTML(ctx)}
      <p class="title">BULLETIN ANNUEL — ${escH(state.year)} · (Cycle semestriel)</p>
      ${_bulInfoHTML(e,ctx.cls)}
      <table class="grades"><thead><tr><th style="text-align:left">Matière</th><th>Coef</th><th>Moy. S1</th><th>Moy. S2</th><th>Moy. An.</th><th>Moy×Coef</th><th>Rang</th></tr></thead><tbody>${lignes}</tbody>
        <tfoot><tr><td class="nm">Totaux</td><td>${totCoef}</td><td></td><td></td><td></td><td class="b">${fmt(avgRound(totPts,cfg))}</td><td></td></tr></tfoot></table>
      ${_recapPeriodesHTML(r,agg,ctx)}
      ${_synthHTML(r.annualMoy,r.annualRank,eff,cfg,gmax)}
      <p class="appr"><b>Appréciation du conseil de classe :</b> ____________________________________________</p>
      ${_bulBottomHTML(e,ctx,r.annualMoy,'Annuel '+state.year)}
    </section>`;
  }
  // ===== MODELE 3 (cycles TRIMESTRIELS) : detail matiere T1/T2/T3/Annuel + recap eleve 3 trim + annuel =====
  function officielBlockTrimestre(r,agg,ctx){
    const {cfg,gmax,eff}=ctx; const e=r.stu; const fmt=n=>n==null?'–':fmtN(n);
    let totCoef=0, totPts=0;
    const lignes=agg.subs.map(({sub})=>{
      const o=r.subj[sub.id]; if(!o) return '';
      const an=o.annual, coef=o.coef; const mc=(an==null)?null:avgRound(an*coef,cfg);
      if(an!=null){ totCoef+=coef; totPts+=mc; }
      return `<tr><td class="nm">${escH(sub.n)}${o.fac?' <span class="fac">(fac.)</span>':''}</td><td>${o.coef}</td><td>${fmt(o.per[0])}</td><td>${fmt(o.per[1])}</td><td>${fmt(o.per[2])}</td><td class="b">${fmt(an)}</td><td>${fmt(mc)}</td></tr>`;
    }).join('')||'<tr><td colspan="7" class="empty">Aucune matière au programme.</td></tr>';
    return `<section class="bul">
      ${printHeaderHTML(ctx)}
      <p class="title">BULLETIN ANNUEL — ${escH(state.year)} · (Cycle trimestriel)</p>
      ${_bulInfoHTML(e,ctx.cls)}
      <table class="grades"><thead><tr><th style="text-align:left">Matière</th><th>Coef</th><th>T1</th><th>T2</th><th>T3</th><th>Moy. An.</th><th>Moy×Coef</th></tr></thead><tbody>${lignes}</tbody>
        <tfoot><tr><td class="nm">Totaux</td><td>${totCoef}</td><td></td><td></td><td></td><td></td><td class="b">${fmt(avgRound(totPts,cfg))}</td></tr></tfoot></table>
      ${_recapPeriodesHTML(r,agg,ctx)}
      ${_synthHTML(r.annualMoy,r.annualRank,eff,cfg,gmax)}
      <p class="appr"><b>Appréciation du conseil de classe :</b> ____________________________________________</p>
      ${_bulBottomHTML(e,ctx,r.annualMoy,'Annuel '+state.year)}
    </section>`;
  }
  function printBulletinsOfficiel(clsId,onlyStu){
    const agg=classYearAgg(clsId); if(!agg||!agg.cls){toast('Classe introuvable');return;}
    const cfg=agg.cfg, sc=activeSchool();
    const gmax=cfg.gradeMax||20; const eff=agg.rows.length;
    const addr=(cfg.address||'')+(cfg.phone?' · '+cfg.phone:'');
    const ctx={cls:agg.cls,cfg,gmax,sc:{name:sc.name,logo:cfg.logo},addr,eff,qr:qrSVG,year:state.year,pers:agg.pers};
    let targets=agg.rows; if(onlyStu) targets=agg.rows.filter(r=>r.stu.id===onlyStu);
    if(!targets.length){toast('Aucun élève');return;}
    const build=agg.ptype==='semestre'?officielBlockSemestre:officielBlockTrimestre;
    const blocks=targets.map(r=>build(r,agg,ctx)).join('');
    const doc=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Bulletins annuels — ${escH(clsLabel(agg.cls.id))}</title><style>${bulletinCSS()}</style></head><body>${blocks}</body></html>`;
    const w=window.open('','_blank'); if(!w){toast('Autorise les fenêtres pop-up pour imprimer');return;}
    w.document.open(); w.document.write(doc); w.document.close(); w.focus();
    setTimeout(()=>{ try{ w.print(); }catch(e){} },350);
  }
  function printBulletins(clsId,per,onlyStu){
    const _cls0=getCls(clsId); if(!_cls0){toast('Classe introuvable');return;}
    const _cfg0=schoolCfg();
    const _pers0=periodList(cyclePeriodType(_cls0.cycle));
    // Bulletin OFFICIEL + periode finale (dernier sem./trim.) => synthese annuelle complete
    if(_cfg0.bulletinTpl==='officiel' && per===_pers0[_pers0.length-1]){ return printBulletinsOfficiel(clsId,onlyStu); }
    const data=classBulletinData(clsId,per); if(!data.cls){toast('Classe introuvable');return;}
    const cfg=schoolCfg(), sc=activeSchool();
    const gmax=cfg.gradeMax||20; const eff=data.rows.length;
    const addr=(cfg.address||'')+(cfg.phone?' · '+cfg.phone:'');
    const ctx={cls:data.cls,per,cfg,gmax,sc:{name:sc.name,logo:cfg.logo},addr,eff,qr:qrSVG,fmt:bulletinFmtFor(data.cls.cycle)};
    let targets=data.rows; if(onlyStu) targets=data.rows.filter(r=>r.stu.id===onlyStu);
    if(!targets.length){toast('Aucun élève');return;}
    const blocks=targets.map(r=>bulletinBlockHTML(r,ctx)).join('');
    const css=bulletinCSS();
    const doc=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Bulletins — ${escH(clsLabel(data.cls.id))} — ${escH(per)}</title><style>${css}</style></head><body>${blocks}</body></html>`;
    const w=window.open('','_blank'); if(!w){toast('Autorise les fenêtres pop-up pour imprimer');return;}
    w.document.open(); w.document.write(doc); w.document.close(); w.focus();
    setTimeout(()=>{ try{ w.print(); }catch(e){} },350);
  }
  function bulletin(){
    return section('Bulletins disponibles')
      + row('<div class="w-9 h-9 rounded-xl bg-brand-100 text-brand-600 p-2">'+svg(I.book)+'</div>','<p class="text-sm font-semibold">Bulletin — Trimestre 1</p><p class="text-xs text-slate-500">Moy. 14,2 · Rang 6/32</p>','<button class="text-xs font-bold text-white bg-brand-600 px-3 py-1.5 rounded-full">PDF</button>')
      + `<div class="mt-4 rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft card-in text-sm space-y-2">
          <div class="flex justify-between"><span>Mathématiques (coef 4)</span><b>13,8</b></div>
          <div class="flex justify-between"><span>Français (coef 3)</span><b>15,0</b></div>
          <div class="flex justify-between"><span>Physique (coef 3)</span><b>12,5</b></div>
          <div class="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-800 font-bold text-brand-600"><span>Moyenne gén.</span><span>14,2 / 20</span></div>
          <p class="text-xs text-slate-500 pt-1 italic">« Élève sérieux, en progrès constant. » — Le Directeur</p></div>`;
  }
  function settings(){
    const s=activeSchool(), cfg=schoolCfg();
    const card=h=>`<div class="rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft card-in space-y-3">${h}</div>`;
    const lbl=t=>`<label class="text-[11px] font-bold text-slate-400 uppercase tracking-wide">${t}</label>`;
    const esc=v=>(v||'').replace(/"/g,'&quot;');
    // -- Identité --
    const logo = cfg.logo
      ? `<img src="${cfg.logo}" alt="logo" class="w-16 h-16 rounded-2xl object-cover shadow-soft">`
      : `<div class="w-16 h-16 rounded-2xl grid place-items-center bg-brand-50 dark:bg-slate-800 text-brand-600">${svg_(I.shield)}</div>`;
    const identite = card(
      `<p class="font-bold text-sm">Identité de l'établissement</p>
       <div class="flex items-center gap-3">${logo}
         <div class="flex flex-col gap-1.5">
           <label class="px-3 py-1.5 rounded-xl bg-brand-600 text-white text-xs font-bold cursor-pointer active:scale-95 transition">Changer le logo<input id="set_logo" type="file" accept="image/*" class="hidden"></label>
           ${cfg.logo?`<button data-logoclear class="text-xs font-bold text-rose-500 text-left">Retirer</button>`:''}
         </div>
       </div>
       <div>${lbl('Nom de l\'établissement')}<input id="set_name" class="${MGIN}" value="${esc(s.name)}" placeholder="Nom de l'école"></div>
       <div class="grid grid-cols-2 gap-2"><div>${lbl('Téléphone')}<input id="set_phone" class="${MGIN}" value="${esc(cfg.phone)}" placeholder="+228 ..."></div><div>${lbl('Email')}<input id="set_email" class="${MGIN}" value="${esc(cfg.email)}" placeholder="contact@..."></div></div>
       <div>${lbl('Adresse')}<input id="set_addr" class="${MGIN}" value="${esc(cfg.address)}" placeholder="BP / rue / ville"></div>
       <div>${lbl('Directeur (signature bulletins)')}<input id="set_dir" class="${MGIN}" value="${esc(cfg.director)}" placeholder="Nom du directeur"></div>
       <button data-setsave="info" class="${MGBTN} w-full justify-center">Enregistrer l'identité</button>`);
    // -- Structure académique --
    const chips = activeCycles().map(c=>`<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-50 text-brand-700 dark:bg-slate-800 dark:text-brand-300">${c}</span>`).join('')||'<span class="text-xs text-slate-400">Aucun cycle actif</span>';
    const structure = card(
      `<p class="font-bold text-sm">Structure académique</p>
       <div><p class="text-xs text-slate-500 mb-1">Cycles actifs (définis par le SuperAdmin)</p><div class="flex flex-wrap gap-1.5">${chips}</div></div>
       <button data-mtabgo="annee" class="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-left active:scale-[.99] transition"><span class="text-sm font-semibold">Année scolaire & périodes</span><span class="text-xs font-bold text-brand-600">Configurer →</span></button>`);
    // -- Notation --
    const notation = card(
      `<p class="font-bold text-sm">Barème de notation</p>
       <div class="grid grid-cols-2 gap-2"><div>${lbl('Note maximale')}<input id="set_max" type="number" min="10" max="100" step="1" class="${MGIN}" value="${cfg.gradeMax}"></div><div>${lbl('Moyenne de passage')}<input id="set_pass" type="number" min="0" max="100" step="0.5" class="${MGIN}" value="${cfg.passMark}"></div></div>
       <label class="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800"><span class="text-sm">Afficher le rang des élèves sur les bulletins</span><input id="set_rank" type="checkbox" ${cfg.rankVisible?'checked':''} class="w-5 h-5 accent-brand-600"></label>
       <button data-setsave="grading" class="${MGBTN} w-full justify-center">Enregistrer le barème</button>`);
    // -- Règles de calcul du bulletin --
    const decSel=[0,1,2].map(n=>`<option value="${n}"${(+cfg.avgDecimals)===n?' selected':''}>${n} décimale${n>1?'s':''}</option>`).join('');
    const mentRows=(cfg.mentions||[]).map((m,i)=>`<div class="flex items-center gap-2">
         <input data-mlabel="${i}" class="${MGIN}" value="${esc(m.l)}" placeholder="ex: Très Bien">
         <div class="flex items-center gap-1 shrink-0"><span class="text-xs font-bold text-slate-400">≥</span><input data-mmin="${i}" type="number" min="0" max="${cfg.gradeMax}" step="0.5" class="${MGIN} w-20 text-center" value="${m.min}"></div>
         <button data-mdel="${i}" class="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300 grid place-items-center shrink-0">${svg_(I.trash)}</button>
       </div>`).join('')||'<p class="text-xs text-slate-400">Aucune mention définie.</p>';
    const calc = card(
      `<p class="font-bold text-sm">Règles de calcul du bulletin</p>
       <div class="grid grid-cols-2 gap-2">
         <div>${lbl('Moyenne générale')}<select id="set_avgmode" class="${MGIN}"><option value="weighted"${cfg.avgMode!=='simple'?' selected':''}>Pondérée par coefficient</option><option value="simple"${cfg.avgMode==='simple'?' selected':''}>Moyenne simple</option></select></div>
         <div>${lbl('Arrondi')}<select id="set_dec" class="${MGIN}">${decSel}</select></div>
       </div>
       <label class="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800"><span class="text-sm">Afficher le rang sur les bulletins</span><input id="set_rank2" type="checkbox" ${cfg.rankVisible?'checked':''} class="w-5 h-5 accent-brand-600"></label>
       <label class="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800"><span class="text-sm">Gérer les ex-aequo (même rang)</span><input id="set_ties" type="checkbox" ${cfg.rankTies?'checked':''} class="w-5 h-5 accent-brand-600"></label>
       <label class="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800"><span class="text-sm">Matières facultatives → une note au coef 1</span><input id="set_optfac" type="checkbox" ${cfg.optFacCoef1?'checked':''} class="w-5 h-5 accent-brand-600"></label>
       <div>
         <div class="flex items-center justify-between mb-1">${lbl('Mentions (seuil sur '+cfg.gradeMax+')')}<button data-madd class="text-xs font-bold text-brand-600">+ Ajouter</button></div>
         <div class="space-y-2">${mentRows}</div>
         <p class="text-[11px] text-slate-400 mt-1">La mention affichée correspond au seuil le plus élevé atteint par la moyenne générale.</p>
       </div>
       <button data-setsave="calc" class="${MGBTN} w-full justify-center">Enregistrer les règles</button>`);
    // -- Système --
    const tplOpt=(v,t)=>`<option value="${v}"${cfg.bulletinTpl===v?' selected':''}>${t}</option>`;
    const fmtOpt=(v,t)=>`<option value="${v}"${cfg.bulletinFmt===v?' selected':''}>${t}</option>`;
    const cycFmtRows=activeCycles().map(cy=>{
      const cur=(cfg.bulletinFmtByCycle||{})[cy]||'';
      const o=(v,t)=>`<option value="${v}"${cur===v?' selected':''}>${t}</option>`;
      return `<div class="flex items-center gap-2"><span class="flex-1 text-sm truncate">${esc(cy)}</span><select data-blfmtcyc="${esc(cy)}" class="${MGIN} w-auto shrink-0">`+o('','Par défaut')+o('vrac','En vrac')+o('groupe','Groupé Sci/Litt/Fac')+o('specialite','Groupé Spéc/Gén/Fac')+`</select></div>`;
    }).join('')||'<p class="text-xs text-slate-400">Aucun cycle actif.</p>';
    const systeme = card(
      `<p class="font-bold text-sm">Système & communication</p>
       <div>${lbl('Modèle de bulletin')}<select id="set_tpl" class="${MGIN}">${tplOpt('officiel','Officiel · synthèse annuelle (recommandé)')}${tplOpt('standard','Standard (notes + moyenne)')}${tplOpt('detaille','Détaillé (par type d\'épreuve)')}${tplOpt('compact','Compact (synthèse)')}</select><p class="text-[11px] text-slate-400 mt-1">« Officiel » : le dernier bulletin de l'année reprend toutes les périodes + la moyenne annuelle et les rangs (Modèle 2 pour les cycles semestriels, Modèle 3 pour les cycles trimestriels).</p></div>
       <div>${lbl('Format du bulletin (défaut)')}<select id="set_fmt" class="${MGIN}">${fmtOpt('vrac','En vrac (toutes les matières)')}${fmtOpt('groupe','Groupé · Scientifique / Littéraire / Facultatives')}${fmtOpt('specialite','Groupé · Spécialité / Générales / Facultatives')}</select></div>
       <div>${lbl('Format par cycle')}<div class="space-y-2 mt-1">${cycFmtRows}</div><p class="text-[11px] text-slate-400 mt-1">« Par défaut » applique le format ci-dessus. Chaque cycle peut utiliser un format différent.</p></div>
       <label class="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800"><span class="text-sm">Passerelle SMS</span><input id="set_sms" type="checkbox" ${cfg.sms?'checked':''} class="w-5 h-5 accent-brand-600"></label>
       <label class="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800"><span class="text-sm">Passerelle WhatsApp</span><input id="set_wa" type="checkbox" ${cfg.whatsapp?'checked':''} class="w-5 h-5 accent-brand-600"></label>
       <div>${lbl('Nom d\'expéditeur (SMS)')}<input id="set_sender" class="${MGIN}" value="${esc(cfg.sender)}" maxlength="11" placeholder="ex: XSCHOOL"></div>
       <button data-setsave="sys" class="${MGBTN} w-full justify-center">Enregistrer les paramètres</button>`);
    return `<div class="rounded-2xl p-3 bg-brand-50 dark:bg-slate-900 text-brand-700 dark:text-brand-300 text-xs font-semibold card-in flex items-center gap-2">${svg_(I.cog)} Paramètres de « ${s.name} » — identité, barème de notation et communication.</div>`
      + section('Identité') + identite
      + section('Structure académique') + structure
      + section('Notation') + notation
      + section('Règles de calcul') + calc
      + section('Système') + systeme;
  }
  function wireSettings(){
    const main=$('#main');
    const val=id=>{const e=main.querySelector('#'+id);return e?e.value.trim():'';};
    const chk=id=>{const e=main.querySelector('#'+id);return e?e.checked:false;};
    const cfg=schoolCfg(), s=activeSchool();
    const readInfo=()=>{ if(main.querySelector('#set_name')){ s.name=val('set_name')||s.name; cfg.phone=val('set_phone'); cfg.email=val('set_email'); cfg.address=val('set_addr'); cfg.director=val('set_dir'); } };
    const logoIn=main.querySelector('#set_logo');
    if(logoIn) logoIn.addEventListener('change',e=>{ const f=e.target.files&&e.target.files[0]; if(!f) return; if(f.size>8*1024*1024){toast('Image trop lourde (max 8 Mo)');return;} const r=new FileReader(); r.onload=()=>{ readInfo(); cropPhoto(r.result,256,d=>{ cfg.logo=d; renderView(); toast('Logo mis à jour ✓'); }); }; r.readAsDataURL(f); });
    const lc=main.querySelector('[data-logoclear]'); if(lc) lc.addEventListener('click',()=>{ readInfo(); cfg.logo=''; renderView(); });
    main.querySelectorAll('[data-mtabgo]').forEach(b=>b.addEventListener('click',()=>{ state.manageTab=b.dataset.mtabgo; go('manage'); }));
    const readCalc=()=>{
      const am=main.querySelector('#set_avgmode'); if(am) cfg.avgMode=am.value;
      const dc=main.querySelector('#set_dec'); if(dc) cfg.avgDecimals=+dc.value;
      if(main.querySelector('#set_rank2')) cfg.rankVisible=chk('set_rank2');
      if(main.querySelector('#set_ties')) cfg.rankTies=chk('set_ties');
      if(main.querySelector('#set_optfac')) cfg.optFacCoef1=chk('set_optfac');
      const rows=[...main.querySelectorAll('[data-mlabel]')];
      if(rows.length){ cfg.mentions=rows.map(inp=>{ const i=inp.dataset.mlabel; const mm=main.querySelector('[data-mmin="'+i+'"]'); return {l:inp.value.trim(),min:parseFloat(mm&&mm.value)||0}; }); }
    };
    main.querySelectorAll('[data-mdel]').forEach(b=>b.addEventListener('click',()=>{ readCalc(); const i=+b.dataset.mdel; cfg.mentions.splice(i,1); renderView(); }));
    const madd=main.querySelector('[data-madd]'); if(madd) madd.addEventListener('click',()=>{ readCalc(); if(!cfg.mentions) cfg.mentions=[]; cfg.mentions.push({l:'Nouvelle mention',min:0}); renderView(); });
    main.querySelectorAll('[data-setsave]').forEach(b=>b.addEventListener('click',()=>{
      const k=b.dataset.setsave;
      if(k==='info'){ const nm=val('set_name'); if(!nm){toast('Le nom est requis');return;} s.name=nm; cfg.phone=val('set_phone'); cfg.email=val('set_email'); cfg.address=val('set_addr'); cfg.director=val('set_dir'); toast('Identité enregistrée ✓'); }
      else if(k==='grading'){ const mx=+val('set_max')||20, ps=+val('set_pass'); if(mx<10){toast('Note max invalide');return;} if(ps<0||ps>mx){toast('Moyenne de passage invalide');return;} cfg.gradeMax=mx; cfg.passMark=ps; cfg.rankVisible=chk('set_rank'); toast('Barème enregistré ✓'); }
      else if(k==='calc'){ readCalc(); cfg.mentions=(cfg.mentions||[]).filter(m=>m.l).sort((a,b)=>b.min-a.min); toast('Règles de calcul enregistrées ✓'); }
      else if(k==='sys'){ cfg.bulletinTpl=val('set_tpl')||'officiel'; cfg.bulletinFmt=val('set_fmt')||'vrac'; const fm={}; main.querySelectorAll('[data-blfmtcyc]').forEach(sel=>{ if(sel.value) fm[sel.dataset.blfmtcyc]=sel.value; }); cfg.bulletinFmtByCycle=fm; cfg.sms=chk('set_sms'); cfg.whatsapp=chk('set_wa'); cfg.sender=val('set_sender')||'XSCHOOL'; toast('Paramètres enregistrés ✓'); }
      renderView();
    }));
  }
