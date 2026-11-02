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
        <div class="mt-4 flex gap-2">${badge('Année '+state.year,'bg-white/20')}${badge(curPeriod,'bg-white/20')}</div>
        <p class="text-xs uppercase tracking-[0.18em] opacity-80 mt-3 font-bold" style="font-family:'Plus Jakarta Sans',Inter,sans-serif">XSchool · L’école connectée</p></div>`;
    const grid = html => `<div class="grid grid-cols-2 gap-3 mt-4 lg:grid-cols-4">${html}</div>`;
    // Diagramme d'accueil : donnees REELLES (voir dashChartData). kind='effectifs'|'recettes'.
    const chartCard = kind => '<div class="card-in rounded-2xl p-3 bg-white dark:bg-slate-900 shadow-soft lg:max-w-2xl"><canvas id="chart" data-chart="'+kind+'" height="150"></canvas></div>';
    const who=sessionUserName();
    const sname=(activeSchool()&&activeSchool().name)||'';
    if(role==='super'){
      const incidents=LOGS.filter(l=>l.level==='error').length;
      return hero(who||'SuperAdmin','Vue consolidée multi-établissements')
      + grid(stat('Établissements',String(SCHOOLS.length),'réseau géré','bg-slate-600')
          +stat('Utilisateurs',String(USERS.length),'comptes','bg-brand-600')
          +stat('Élèves',numStr(DB.students.length),(studentsOfYear(state.year).length)+' cette année','bg-emerald-500')
          +stat('Incidents',String(incidents),incidents?'à examiner':'système sain','bg-amber-500'))
      + section('Effectifs par cycle') + chartCard('effectifs')
      + dashMenu('super');
    }
    if(role==='teacher'){ const _me=(typeof currentTeacher==='function'?currentTeacher():null);
      const _tcls=teacherClasses(_me), _tsubs=teacherSubjects(_me);
      const _tp=teacherPendingCount(_me), _tavg=teacherAverage(_me);
      return hero(who||ROLES.teacher.name, sname+' · Enseignant')
      + grid(stat('Mes classes',numStr(_tcls.length),(_me?'attribuées':'aucune attribuée'),'bg-emerald-500')+stat('À noter',numStr(_tp),'saisies en attente','bg-amber-500')+stat('Mes matières',numStr(_tsubs.length),'au programme','bg-brand-600')+stat('Moyenne',_tavg==null?'—':fmtN(_tavg),'mes classes','bg-slate-600'))
      + dashMenu('teacher'); }
    if(role==='student'){
      const _me=(typeof currentStudent==='function')?currentStudent():null;
      if(_me){
        // Mode connecte : donnees REELLES de l'eleve/parent connecte (sa classe,
        // sa moyenne, sa presence, ses bulletins) — aucun chiffre de demo.
        const _cls=clsOfYear(_me,state.year);
        const _smoy=studentMoyenne(_me), _mpres=studentAttendanceRate(_me), _mlate=studentLateCount(_me);
        const _msubs=studentSubjects(_me).length, _mbul=studentPeriodsWithGrades(_me);
        return hero(who||stuName(_me), sname+' · Élève / Parent'+(_cls?(' · '+clsLabel(_cls)):' · Sans classe'))
        + grid(stat('Ma moyenne',_smoy==null?'—':fmtN(_smoy),_cls?clsLabel(_cls):'—','bg-emerald-500')+stat('Ma présence',pctStr(_mpres),numStr(_mlate)+' retard(s)','bg-brand-600')+stat('Mes matières',numStr(_msubs),'suivies','bg-amber-500')+stat('Mes bulletins',numStr(_mbul),'période(s)','bg-slate-600'))
        + studentNoClassAlert(_me)
        + studentSummaryWidget(_me)
        + studentAbsenceNotif(_me)
        + dashMenu('student');
      }
      // Hors-ligne (demo) ou compte sans fiche eleve rattachee : vue etablissement.
      const _savg=schoolAverage(), _spres=attendanceRate();
      return hero(who||ROLES.student.name, sname+' · Élève / Parent')
      + grid(stat('Moyenne gén.',_savg==null?'—':fmtN(_savg),'établissement','bg-emerald-500')+stat('Présence',pctStr(_spres),numStr(attByStatusLatest('retard'))+' retards','bg-brand-600')+stat('Matières',numStr(DB.subjects.length),'suivies','bg-amber-500')+stat('Bulletins',numStr(periodsWithGrades()),'période(s)','bg-slate-600'))
      + dashMenu('student'); }
    if(role==='surveillant') return hero(who||ROLES.surveillant.name, sname+' · Surveillance générale')
      + absenceAlertBanner()
      + grid(stat('Appels faits',callsDoneLatest()+'/'+numStr(DB.classes.length),'classes','bg-sky-500')+stat('Absents',numStr(attByStatusLatest('absent')),'du jour','bg-rose-500')+stat('Retards',numStr(attByStatusLatest('retard')),'du jour','bg-amber-500')+stat('Incidents',numStr(DISC_STORE.length),'enregistrés','bg-brand-600'))
      + dashMenu('surveillant');
    if(role==='comptable') return hero(who||ROLES.comptable.name, sname+' · Comptabilité & scolarité')
      + grid(stat('Encaissé',fmtMoney(totalEncaisse()),'FCFA '+state.year,'bg-emerald-500')+stat('Impayés',numStr(unpaidCount()),'élève(s)','bg-rose-500')+stat('Recouvrement',pctStr(recouvrementPct()),'des élèves','bg-brand-600')+stat('Reçus',numStr(PAY_STORE.length),'émis','bg-amber-500'))
      + section('Recettes par cycle') + chartCard('recettes')
      + dashMenu('comptable');
    // admin
    const _ys=yearStats(state.year), _recov=recouvrementPct(), _assid=attendanceRate();
    const _retards=attByStatusLatest('retard');
    return hero(who||ROLES.admin.name, sname+' · Direction')
      + absenceAlertBanner()
      + grid(stat('Élèves',numStr(_ys.total),_ys.f+' F · '+_ys.m+' G','bg-brand-600')+stat('Enseignants',numStr(DB.teachers.length),DB.classes.length+' classes','bg-emerald-500')+stat('Recouvrement',pctStr(_recov),fmtMoney(totalEncaisse())+' FCFA','bg-amber-500')+stat('Assiduité',pctStr(_assid),_retards+' retards','bg-slate-600'))
      + section('Effectifs par cycle') + chartCard('effectifs')
      + dashMenu('admin');
  }
  // Menu d'accueil : grille d'acces rapides generee a partir de la navigation
  // du role (NAV + ROLES[role].nav), hors « Accueil ». Remplace les longues
  // listes de donnees sur le tableau de bord.
  function dashMenu(role){
    const r=ROLES[role]; if(!r||!r.nav) return '';
    const items=r.nav.filter(k=>k!=='dash'&&NAV[k]);
    if(!items.length) return '';
    const cards=items.map(k=>'<button data-go="'+k+'" class="rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft card-in text-left hover:shadow-glow transition active:scale-95">'
      +'<div class="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300 p-2 mb-2">'+svg(NAV[k].i)+'</div>'
      +'<p class="text-sm font-bold">'+escH(NAV[k].t)+'</p></button>').join('');
    return section('Menu')+'<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">'+cards+'</div>';
  }
  // Widget de synthese Eleve/Parent : moyenne (+ mention, barre) et assiduite
  // (presences / retards / absences). Donnees REELLES de l'eleve connecte.
  function studentSummaryWidget(e){
    if(!e) return '';
    const cfg=schoolCfg(), gmax=+cfg.gradeMax||20, pass=+cfg.passMark||10;
    const moy=studentMoyenne(e);
    const ment=moy==null?'—':mentionFor(moy,cfg);
    const pct=moy==null?0:Math.max(0,Math.min(100,Math.round(moy/gmax*100)));
    const moyCol=moy==null?'slate':(moy>=pass?'emerald':'rose');
    const mine=ATT_STORE.filter(a=>a.stu===e.id);
    const pres=mine.filter(a=>a.status==='present').length;
    const ret=mine.filter(a=>a.status==='retard').length;
    const abs=mine.filter(a=>a.status==='absent').length;
    const rate=studentAttendanceRate(e);
    const pill=(val,lbl,col)=>`<div class="flex-1 rounded-xl px-2 py-2 text-center bg-${col}-50 dark:bg-${col}-500/10"><p class="text-lg font-extrabold text-${col}-600 dark:text-${col}-300 leading-none">${val}</p><p class="text-[10px] font-bold text-slate-500 mt-1">${lbl}</p></div>`;
    const moyCard=`<div class="flex-1 rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft card-in">
        <div class="flex items-center justify-between"><p class="text-xs font-bold text-slate-500">Ma moyenne générale</p>${badge(ment,'bg-'+moyCol+'-100 text-'+moyCol+'-700 dark:bg-'+moyCol+'-500/15 dark:text-'+moyCol+'-300')}</div>
        <p class="mt-1"><span class="text-3xl font-extrabold text-${moyCol}-600 dark:text-${moyCol}-300">${moy==null?'—':fmtN(moy)}</span><span class="text-sm font-bold text-slate-400"> / ${gmax}</span></p>
        <div class="mt-2 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div class="h-full rounded-full bg-${moyCol}-500 transition-all" style="width:${pct}%"></div></div>
        <p class="text-[11px] text-slate-400 mt-2">Moyenne de passage : ${fmtN(pass)}/${gmax}</p>
      </div>`;
    const absCard=`<div class="flex-1 rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft card-in">
        <div class="flex items-center justify-between"><p class="text-xs font-bold text-slate-500">Mon assiduité</p><span class="text-xs font-extrabold text-brand-600">${pctStr(rate)}</span></div>
        <div class="flex gap-2 mt-2">${pill(numStr(pres),'Présences','emerald')}${pill(numStr(ret),'Retards','amber')}${pill(numStr(abs),'Absences','rose')}</div>
        <p class="text-[11px] text-slate-400 mt-2">${mine.length?('Sur '+mine.length+' relevé(s) enregistré(s).'):'Aucun pointage enregistré pour le moment.'}</p>
      </div>`;
    return section('Ma synthèse')
      + `<div class="flex flex-col sm:flex-row gap-3">${moyCard}${absCard}</div>`;
  }
  // Alerte « aucune classe assignée » pour l'élève/parent connecté.
  //   - clsOfYear === null : l'élève n'est pas inscrit pour l'année sélectionnée
  //     (incohérence année) -> on propose les années où il a une classe.
  //   - clsOfYear === ''   : inscrit mais sans classe affectée -> renvoyer vers
  //     le secrétariat. Dans les deux cas : pas de bulletin/notes possibles.
  function studentNoClassAlert(e){
    if(!e) return '';
    const cid=clsOfYear(e,state.year);
    if(cid) return ''; // une classe est bien assignée : aucune alerte
    const notEnrolled = (cid===null);
    const clsYears=(typeof studentClassYears==='function')?studentClassYears(e):[];
    const chips=notEnrolled && clsYears.some(y=>y!==state.year)
      ? `<div class="flex flex-wrap gap-1.5 mt-2">${_yearChips(clsYears,'rose')}</div>
         <p class="text-[11px] text-rose-600/70 dark:text-rose-300/70 mt-1">Année(s) où une classe est assignée à ${escH(stuName(e))}.</p>`
      : '';
    const msg = notEnrolled
      ? `Aucune classe n'est assignée pour l'année <strong>${escH(state.year)}</strong>. Sans classe, le bulletin et les notes ne peuvent pas s'afficher.`
      : `Tu es inscrit(e) pour <strong>${escH(state.year)}</strong> mais aucune classe ne t'a encore été affectée. Rapproche-toi du secrétariat pour l'affectation.`;
    return section('Alerte')+`<div class="rounded-2xl p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 shadow-soft card-in">
      <div class="flex items-start gap-3"><span class="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300 grid place-items-center shrink-0">${svg(I.shield)}</span>
      <div class="flex-1 min-w-0"><p class="text-sm font-bold text-rose-700 dark:text-rose-200">Aucune classe assignée</p>
      <p class="text-[11px] text-rose-600/80 dark:text-rose-300/80">${msg}</p>${chips}</div></div></div>`;
  }
  // Notifications d'absence côté élève / parent : surface les absences & retards
  // de l'élève connecté + l'alerte « absences répétées » (seuil atteint). Données
  // REELLES issues de ATT_STORE / ALERTS pour l'élève concerné uniquement.
  function studentAbsenceNotif(e){
    if(!e) return '';
    if(typeof checkRepeatedAbsences==='function') checkRepeatedAbsences();
    const rows=(typeof ATT_STORE!=='undefined'?ATT_STORE:[])
      .filter(a=>a&&a.stu===e.id&&(a.status==='absent'||a.status==='retard'))
      .slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
    const myAl=(typeof ALERTS!=='undefined'?ALERTS:[])
      .filter(a=>a&&a.auto&&a.kind==='absence'&&a.stu===e.id&&!a.read&&!a.archived);
    if(!rows.length && !myAl.length)
      return section('Mes notifications')+`<div class="rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft card-in text-sm text-slate-500 flex items-center gap-2">${svg(I.bell)} Aucune absence ni retard signalé — tout est en ordre ✅</div>`;
    const absN=rows.filter(r=>r.status==='absent').length;
    const retN=rows.filter(r=>r.status==='retard').length;
    const fmtD=d=>{ const p=String(d||'').split('-'); return p.length===3?(p[2]+'/'+p[1]+'/'+p[0]):String(d||''); };
    const alert=myAl.length?`<div class="rounded-2xl p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 shadow-soft card-in">
        <div class="flex items-center gap-3">
          <span class="relative w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300 grid place-items-center shrink-0">${svg(I.bell)}
            <span class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold grid place-items-center">${myAl.length}</span></span>
          <div class="flex-1 min-w-0"><p class="text-sm font-bold text-rose-700 dark:text-rose-200">Alerte : absences répétées</p>
          <p class="text-[11px] text-rose-600/80 dark:text-rose-300/80">${escH(myAl[0].msg||'')}</p></div>
          <button data-stunotifread="${e.id}" class="text-[11px] font-bold text-rose-700 dark:text-rose-200 bg-white/70 dark:bg-slate-900/40 border border-rose-200 dark:border-rose-500/30 px-3 py-1.5 rounded-full active:scale-95 transition shrink-0">✓ Vu</button>
        </div></div>`:'';
    const pills=`<div class="flex gap-2 ${alert?'mt-3':''}">
        <div class="flex-1 rounded-xl px-3 py-2 text-center bg-rose-50 dark:bg-rose-500/10"><p class="text-lg font-extrabold text-rose-600 dark:text-rose-300 leading-none">${numStr(absN)}</p><p class="text-[10px] font-bold text-slate-500 mt-1">Absence(s)</p></div>
        <div class="flex-1 rounded-xl px-3 py-2 text-center bg-amber-50 dark:bg-amber-500/10"><p class="text-lg font-extrabold text-amber-600 dark:text-amber-300 leading-none">${numStr(retN)}</p><p class="text-[10px] font-bold text-slate-500 mt-1">Retard(s)</p></div>
      </div>`;
    const items=rows.slice(0,6).map(r=>{ const col=r.status==='absent'?'rose':'amber'; const lbl=r.status==='absent'?'Absence':'Retard'; return `<li class="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0"><span class="w-2 h-2 rounded-full bg-${col}-500 shrink-0"></span><span class="text-sm font-semibold flex-1">${lbl}</span><span class="text-xs text-slate-500">${fmtD(r.date)}</span></li>`; }).join('');
    const more=rows.length>6?`<p class="text-[11px] text-slate-400 px-3 py-2">+${rows.length-6} autre(s)…</p>`:'';
    const listCard=rows.length?`<div class="rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-soft card-in mt-3"><ul>${items}${more}</ul></div>`:'';
    const tip=absN>0?`<p class="text-[11px] text-slate-400 mt-2">💡 Pense à justifier les absences auprès de la vie scolaire.</p>`:'';
    return section('Mes notifications')+alert+pills+listCard+tip;
  }
  // ---------- MODULE SCREENS ----------
  const searchBar = ph => `<div class="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-white dark:bg-slate-900 shadow-soft card-in">
      <svg class="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input placeholder="${ph}" class="bg-transparent flex-1 text-sm outline-none"></div>`;

  function students(){
    const q=(state.stuSearch||'').trim().toLowerCase();
    const flt=state.stuFilterCls||'all';
    const inCls=e=>{ const c=clsOfYear(e,state.year); if(c===null) return false; return flt==='all'?true : flt==='none'?(c===''):(c===flt); };
    let list=DB.students.filter(inCls);
    if(q) list=list.filter(e=> (stuName(e).toLowerCase().includes(q)) || (e.mat||'').toLowerCase().includes(q) );
    list=list.slice().sort((a,b)=>stuName(a).localeCompare(stuName(b),'fr'));
    // filtres par classe (liste des élèves par classe)
    const chip=(id,label,n)=>`<button data-stuflt="${id}" class="px-3 py-1.5 rounded-full whitespace-nowrap ${flt===id?'bg-brand-600 text-white':'bg-white dark:bg-slate-900 text-slate-500'}">${label}<span class="ml-1 opacity-70">${n}</span></button>`;
    const yrList=studentsOfYear(state.year);
    const noCls=yrList.filter(e=>clsOfYear(e,state.year)==='').length;
    const chips=[chip('all','Tous',yrList.length)]
      .concat(DB.classes.map(c=>chip(c.id,clsLabel(c.id),studentsInClass(c.id).length)))
      .concat(noCls?[chip('none','Sans classe',noCls)]:[]).join('');
    const title = flt==='all'?'Tous les élèves' : flt==='none'?'Élèves sans classe' : 'Classe — '+clsLabel(flt);
    const statBadge=s=>s==='Redoublant'?badge('Redoublant','bg-rose-100 text-rose-700'):(s==='Abandon'?badge('Abandon','bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'):badge('Nouveau','bg-emerald-100 text-emerald-700'));
    const photoEl=e=>e.photo?`<img src="${e.photo}" class="w-10 h-10 rounded-xl object-cover bg-slate-200 dark:bg-slate-800" alt="">`:avatar(`${e.prenom||''} ${e.nom||''}`.trim(),'w-10 h-10');
    const rows=list.length?list.map(e=>row(
        photoEl(e),
        `<p class="text-sm font-semibold truncate">${escH(stuName(e))}</p><p class="text-xs text-slate-500">${escH(e.mat||'—')} · ${clsOfYear(e,state.year)?clsLabel(clsOfYear(e,state.year)):'<span class=\'text-amber-600 dark:text-amber-400 font-semibold\'>Sans classe</span>'}</p>`,
        `<div class="flex items-center gap-1.5">${e.sexe==='F'?badge('F','bg-pink-100 text-pink-700'):badge('M','bg-sky-100 text-sky-700')}${statBadge(e.statut)}</div>`
      )).join(''):'<p class="text-xs text-slate-400 px-1">Aucun élève pour ce filtre.</p>';
    const exportBtn=`<button data-stuxls="1" class="text-xs font-bold text-white bg-brand-600 px-3 py-1.5 rounded-full active:scale-95 transition">↓ Exporter la liste</button>`;
    return `<div class="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-white dark:bg-slate-900 shadow-soft card-in"><svg class="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input id="stu_q" value="${escH(state.stuSearch)}" placeholder="Rechercher un élève, matricule..." class="bg-transparent flex-1 text-sm outline-none"></div>`
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
    const inCls=e=>{ const c=clsOfYear(e,state.year); if(c===null) return false; return flt==='all'?true : flt==='none'?(c===''):(c===flt); };
    let list=DB.students.filter(inCls);
    if(q) list=list.filter(e=> stuName(e).toLowerCase().includes(q) || (e.mat||'').toLowerCase().includes(q));
    list=list.slice().sort((a,b)=>stuName(a).localeCompare(stuName(b),'fr'));
    if(!list.length){toast('Aucun élève à exporter');return;}
    const head=['Matricule','Nom','Prénom','Date de naissance','Sexe','Lieu','Classe','Statut','Régime','Père','Contact père','Mère','Contact mère'];
    const aoa=[head].concat(list.map(e=>[e.mat||'',e.nom||'',e.prenom||'',e.dob||'',e.sexe||'',e.lieu||'',clsOfYear(e,state.year)?clsLabel(clsOfYear(e,state.year)):'Sans classe',e.statut||'',e.st||'',e.pere||'',e.pereTel||'',e.mere||'',e.mereTel||'']));
    const label = flt==='all'?'Tous' : flt==='none'?'Sans_classe' : clsLabel(flt);
    const fname='eleves_'+String(label).replace(/[^a-zA-Z0-9]+/g,'_')+'.xlsx';
    if(typeof XLSX!=='undefined'){ try{ const ws=XLSX.utils.aoa_to_sheet(aoa); ws['!cols']=head.map(()=>({wch:16})); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Eleves'); XLSX.writeFile(wb,fname); toast(list.length+' élève(s) exporté(s) ✓'); return; }catch(err){} }
    const csv=aoa.map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n');
    downloadFile(fname.replace('.xlsx','.csv'), '\uFEFF'+csv, 'text/csv;charset=utf-8'); toast(list.length+' élève(s) exporté(s) (CSV) ✓');
  }

  function grades(){
    const isAdmin = state.role==='admin';
    // Classes accessibles : admin = cycles actifs ; enseignant = ses classes
    let clsList=DB.classes.filter(c=>activeCycles().includes(c.cycle));
    let me=null;
    if(state.role==='teacher'){ me=currentTeacher(); clsList=me?clsList.filter(c=>me.cls.includes(c.id)):[]; }
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
    const studs=studentsInClass(cls.id);
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
      return `<div class="grid grid-cols-[1.3fr_.8fr_.8fr_.8fr_.8fr_.8fr_.6fr_.8fr] gap-1 items-center text-sm px-2 py-1.5 min-w-[700px] ${i%2?'bg-white dark:bg-slate-900':'bg-slate-50 dark:bg-slate-900/60'}">
        <div class="font-semibold truncate pr-1">${stuName(e)}</div>
        <div>${inp('i',g.i)}</div>
        <div>${inp('d',g.d)}</div>
        <div>${inp('c',g.c)}</div>
        <div class="text-center text-xs font-semibold text-slate-500 dark:text-slate-400" data-grcl="${e.id}">${fmtN(moyClasse(g))}</div>
        <div class="text-center font-bold text-brand-600" data-grmoy="${e.id}">${fmtN(moyenne(g))}</div>
        <div class="text-center text-xs font-semibold text-slate-500 dark:text-slate-400">${coef}</div>
        <div class="text-center text-xs font-extrabold text-slate-700 dark:text-slate-200" data-grcoef="${e.id}">${fmtN(noteCoef(g,coef))}</div>
      </div>`;
    }).join('')||`<div class="px-3 py-6 text-center text-sm text-slate-400">Aucun élève inscrit dans cette classe.</div>`;
    const rankBlock=gradesRankBlock(studs,store,coef);

    return (isAdmin?`<div class="rounded-2xl p-3 bg-brand-50 dark:bg-slate-900 text-brand-700 dark:text-brand-300 text-xs font-semibold card-in flex items-center gap-2">${svg_(I.shield)} Mode administrateur — tu peux saisir et surcharger les notes de toutes les classes.</div>`:(!allowCycle?`<div class="rounded-2xl p-3 bg-amber-50 dark:bg-slate-900 text-amber-700 dark:text-amber-300 text-xs font-semibold card-in flex items-center gap-2">${svg_(I.shield)} Consultation seule — la saisie des notes par les enseignants est désactivée par l'administration pour le cycle « ${cls.cycle} ».</div>`:(passed?`<div class="rounded-2xl p-3 bg-rose-50 dark:bg-slate-900 text-rose-600 dark:text-rose-300 text-xs font-semibold card-in flex items-center gap-2">${svg_(I.clock)} Consultation seule — la date limite de saisie pour ${per} (${fmtDate(dl)}) est dépassée. Contacte l'administration.</div>`:`<div class="rounded-2xl p-3 bg-emerald-50 dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 text-xs font-semibold card-in flex items-center gap-2">${svg_(I.grade)} Saisie ouverte sur tes classes attribuées.${dl?' Échéance : '+fmtDate(dl)+'.':''}</div>`)))
      + `<div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 card-in"><div><label class="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Classe</label>${clsSel}</div><div><label class="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Matière</label>${subSel}</div><div><label class="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Période</label>${perSel}</div></div>`
      + section(sub.n+' · '+clsLabel(cls.id), `<span class="text-xs ${passed?'text-rose-500 font-semibold':'text-slate-400'}">${state.year} · ${per} · coef ${coef}${dl?' · ⏳ '+fmtDate(dl):''}</span>`)
      + `<div class="rounded-2xl overflow-x-auto shadow-soft card-in">
          <div class="grid grid-cols-[1.3fr_.8fr_.8fr_.8fr_.8fr_.8fr_.6fr_.8fr] gap-1 bg-slate-800 text-white text-[11px] font-bold px-2 py-2 min-w-[700px]"><div>Élève</div><div class="text-center">Interro</div><div class="text-center">Devoir</div><div class="text-center">Compo</div><div class="text-center">Moy. cl.</div><div class="text-center">Moy.</div><div class="text-center">Coef</div><div class="text-center">N. coef</div></div>
          ${rows}</div>`
      + `<p class="text-[11px] text-slate-400 mt-2">💡 Calcul : <strong>Moy. de classe</strong> = (Interro + Devoir) ÷ 2 · <strong>Moyenne</strong> = (Compo + Moy. de classe) ÷ 2 · <strong>Note coefficientée</strong> = Moyenne × coef (${coef}). Notes sur ${gmax} (maximum ${gmax}).</p>`
      + (canEdit?`<button data-grsave class="mt-3 w-full py-3 rounded-2xl bg-brand-600 text-white font-bold shadow-glow active:scale-95 transition">Enregistrer les notes</button>`:'')
      + ((canEdit&&typeof apiOn==='function'&&apiOn())?`<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 card-in"><button data-grtpl class="py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm active:scale-95 transition">\uD83D\uDCE5 Mod\u00e8le Excel (noms des \u00e9l\u00e8ves)</button><label class="py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm text-center cursor-pointer active:scale-95 transition">\uD83D\uDCE4 Importer les notes (Excel)<input type="file" accept=".xlsx" data-grimp class="hidden"></label></div><p class="text-[11px] text-slate-400 mt-1">\uD83D\uDCA1 T\u00e9l\u00e9charge le mod\u00e8le pr\u00e9-rempli avec les \u00e9l\u00e8ves de la classe, saisis les notes (Interro / Devoir / Compo), puis r\u00e9-importe le fichier. Ne modifie pas la colonne ID.</p>`:'')
      + rankBlock;
  }
  // Bloc classement (décroissant à l'écran) + bouton impression (alphabétique)
  function gradesRankBlock(studs,store,coef){
    const ranked=studs.map(e=>{ const g=store[e.id]||{i:'',d:'',c:''}; return {e,g,m:moyenne(g),k:noteCoef(g,coef)}; })
      .sort((a,b)=>{ if(a.m==null&&b.m==null) return stuName(a.e).localeCompare(stuName(b.e),'fr'); if(a.m==null) return 1; if(b.m==null) return -1; return b.m-a.m; });
    const sh=v=>(v===''||v==null?'—':v);
    const rows=ranked.map((r,i)=>{
      const med=r.m==null?'bg-slate-100 text-slate-400 dark:bg-slate-800':i===0?'bg-amber-100 text-amber-700':i===1?'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200':i===2?'bg-orange-100 text-orange-700':'bg-slate-100 text-slate-500 dark:bg-slate-800';
      return `<div class="grid grid-cols-[2.2fr_.7fr_.7fr_.7fr_.8fr_.8fr_.6fr_.8fr] gap-1 items-center text-sm px-2 py-1.5 min-w-[720px] ${i%2?'bg-white dark:bg-slate-900':'bg-slate-50 dark:bg-slate-900/60'}">
          <div class="flex items-center gap-2 min-w-0"><span class="w-6 h-6 rounded-lg grid place-items-center text-[11px] font-extrabold shrink-0 ${med}">${r.m==null?'—':(i+1)}</span><span class="min-w-0 font-semibold truncate">${stuName(r.e)}</span></div>
          <div class="text-center text-xs text-slate-500 dark:text-slate-400">${sh(r.g.i)}</div>
          <div class="text-center text-xs text-slate-500 dark:text-slate-400">${sh(r.g.d)}</div>
          <div class="text-center text-xs text-slate-500 dark:text-slate-400">${sh(r.g.c)}</div>
          <div class="text-center text-xs font-semibold text-slate-600 dark:text-slate-300">${fmtN(moyClasse(r.g))}</div>
          <div class="text-center font-bold text-brand-600">${fmtN(r.m)}</div>
          <div class="text-center text-xs text-slate-500 dark:text-slate-400">${coef}</div>
          <div class="text-center text-xs font-extrabold text-slate-700 dark:text-slate-200">${fmtN(r.k)}</div>
        </div>`;
    }).join('')||'<div class="px-3 py-6 text-center text-sm text-slate-400">Aucun élève.</div>';
    return section('Classement par moyenne','<button data-grprint class="text-xs font-bold text-brand-600">🖨️ Imprimer</button>')
      + `<div class="rounded-2xl overflow-x-auto shadow-soft card-in"><div class="grid grid-cols-[2.2fr_.7fr_.7fr_.7fr_.8fr_.8fr_.6fr_.8fr] gap-1 bg-slate-800 text-white text-[11px] font-bold px-2 py-2 min-w-[720px]"><div># Élève (ordre décroissant)</div><div class="text-center">Interro</div><div class="text-center">Devoir</div><div class="text-center">Compo</div><div class="text-center">Moy. cl.</div><div class="text-center">Moy.</div><div class="text-center">Coef</div><div class="text-center">N. coef</div></div>${rows}</div>`
      + `<p class="text-[11px] text-slate-400 mt-2">📌 Classement par <strong>moyenne décroissante</strong>, basé sur les notes <strong>enregistrées</strong>. À l'impression, la liste est triée par ordre alphabétique.</p>`;
  }
  function printGrades(){
    const cls=getCls(state.grCls), sub=getSub(state.grSub); if(!cls||!sub){toast('Sélection incomplète');return;}
    const ptype=cyclePeriodType(cls.cycle), pers=periodList(ptype); const per=pers[state.grPeriod]||pers[0];
    const store=gGet(cls.id,sub.id,per);
    const prog=DB.program.find(p=>p.cls===cls.id&&p.sub===sub.id); const coef=prog?prog.coef:1;
    const gmax=schoolCfg().gradeMax||20;
    const sc=activeSchool();
    const studs=studentsInClass(cls.id).slice().sort((a,b)=>stuName(a).localeCompare(stuName(b),'fr'));
    const sh=v=>(v===''||v==null?'':v);
    const rows=studs.map((e,i)=>{ const g=store[e.id]||{i:'',d:'',c:''}; return `<tr><td class="n">${i+1}</td><td class="nm">${escH(stuName(e))}</td><td>${sh(g.i)}</td><td>${sh(g.d)}</td><td>${sh(g.c)}</td><td>${fmtN(moyClasse(g))}</td><td class="mo">${fmtN(moyenne(g))}</td><td>${coef}</td><td class="mo">${fmtN(noteCoef(g,coef))}</td></tr>`; }).join('')||'<tr><td colspan="9" class="empty">Aucun élève inscrit.</td></tr>';
    const today=new Date(); const pad=x=>(''+x).padStart(2,'0'); const dstr=pad(today.getDate())+'/'+pad(today.getMonth()+1)+'/'+today.getFullYear();
    const doc=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Notes — ${escH(clsLabel(cls.id))} — ${escH(sub.n)}</title>
      <style>*{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}body{margin:24px;color:#111}h1{font-size:18px;margin:0 0 2px}.sub{color:#555;font-size:12px;margin:0 0 14px}.meta{font-size:12px;margin:2px 0;color:#333}table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}th,td{border:1px solid #999;padding:6px 8px;text-align:center}th{background:#1f2937;color:#fff}td.nm{text-align:left}td.n{width:34px;color:#666}td.mo{font-weight:bold}.empty{color:#888;padding:20px}.sign{margin-top:36px;display:flex;justify-content:space-between;font-size:12px}.sign div{width:40%;border-top:1px solid #999;padding-top:6px;text-align:center;color:#555}@media print{body{margin:12mm}}</style></head>
      <body><h1>${escH(sc.name||'Établissement')}</h1><p class="sub">Relevé de notes — liste par ordre alphabétique</p>
      <p class="meta"><strong>Classe :</strong> ${escH(clsLabel(cls.id))} &nbsp;&nbsp; <strong>Matière :</strong> ${escH(sub.n)} (coef ${coef})</p>
      <p class="meta"><strong>Année :</strong> ${escH(state.year)} &nbsp;&nbsp; <strong>Période :</strong> ${escH(per)} &nbsp;&nbsp; <strong>Notes sur :</strong> ${gmax} &nbsp;&nbsp; <strong>Date :</strong> ${dstr}</p>
      <table><thead><tr><th>#</th><th style="text-align:left">Élève</th><th>Interro</th><th>Devoir</th><th>Compo</th><th>Moy. classe</th><th>Moyenne</th><th>Coef</th><th>Note coef.</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="sign"><div>L'enseignant(e)</div><div>La Direction</div></div></body></html>`;
    openPrintPreview(doc);
  }
  function wireGrades(){
    const main=$('#main');
    if(typeof staffApiOn==='function'&&staffApiOn()){ const _cl=state.grCls,_sb=state.grSub; const _c=getCls(_cl); if(_c&&_sb){ const _pt=cyclePeriodType(_c.cycle),_per=periodList(_pt)[state.grPeriod]; const _key='gr:'+state.year+':'+_cl+':'+_sb+':'+_per; window._xsLoaded=window._xsLoaded||{}; if(!window._xsLoaded[_key]){ window._xsLoaded[_key]=true; hydrateGradesApi(_cl,_sb,_per).then(ok=>{ if(ok) renderView(); }); } } }
    const cls=main.querySelector('#gr_cls'); if(cls) cls.addEventListener('change',()=>{ state.grCls=cls.value; state.grSub=''; state.grPeriod=0; renderView(); });
    const sub=main.querySelector('#gr_sub'); if(sub) sub.addEventListener('change',()=>{ state.grSub=sub.value; renderView(); });
    const per=main.querySelector('#gr_per'); if(per) per.addEventListener('change',()=>{ state.grPeriod=+per.value; renderView(); });
    // recalcul live des colonnes calculées par ligne
    const curProg=DB.program.find(p=>p.cls===state.grCls&&p.sub===state.grSub); const curCoef=curProg?curProg.coef:1;
    const rowVal=stu=>{ const g={i:'',d:'',c:''}; main.querySelectorAll('[data-gr^="'+stu+':"]').forEach(inp=>{ g[inp.dataset.gr.split(':')[1]]=inp.value.trim(); }); return g; };
    main.querySelectorAll('[data-gr]').forEach(inp=>inp.addEventListener('input',()=>{ if(inp.value!==''){ const v=parseFloat(inp.value); if(!isNaN(v)){ const mx=+inp.max||20; if(v>mx){ inp.value=String(mx); toast('Note maximale : '+mx); } else if(v<0){ inp.value='0'; } } } const stu=inp.dataset.gr.split(':')[0]; const g=rowVal(stu); const clc=main.querySelector('[data-grcl="'+stu+'"]'); if(clc) clc.textContent=fmtN(moyClasse(g)); const cell=main.querySelector('[data-grmoy="'+stu+'"]'); if(cell) cell.textContent=fmtN(moyenne(g)); const kc=main.querySelector('[data-grcoef="'+stu+'"]'); if(kc) kc.textContent=fmtN(noteCoef(g,curCoef)); }));
    const grPrint=main.querySelector('[data-grprint]'); if(grPrint) grPrint.addEventListener('click',printGrades);
    // Modele Excel : telecharge le classeur pre-rempli (noms des eleves + notes).
    const grTpl=main.querySelector('[data-grtpl]'); if(grTpl) grTpl.addEventListener('click',()=>{
      const cl=main.querySelector('#gr_cls').value, sb=main.querySelector('#gr_sub').value, pr=+main.querySelector('#gr_per').value;
      const c=getCls(cl); if(!c||!sb){ toast('S\u00e9lection incompl\u00e8te'); return; }
      const perName=periodList(cyclePeriodType(c.cycle))[pr];
      grTpl.disabled=true; toast('G\u00e9n\u00e9ration du mod\u00e8le\u2026');
      gradesTemplateApi(cl,sb,perName).then(res=>{
        if(!res||!res.data_b64){ toast('Mod\u00e8le indisponible'); return; }
        const bin=atob(res.data_b64); const len=bin.length; const buf=new Uint8Array(len);
        for(let i=0;i<len;i++) buf[i]=bin.charCodeAt(i);
        const mime=res.mime||'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        downloadFile(res.filename||'notes.xlsx', new Blob([buf],{type:mime}), mime);
        toast('Mod\u00e8le t\u00e9l\u00e9charg\u00e9 ('+(res.count||0)+' \u00e9l\u00e8ve(s)) \u2713');
      }).catch(ex=>toast('Mod\u00e8le refus\u00e9 : '+((ex&&ex.message)||'erreur'))).then(()=>{ grTpl.disabled=false; });
    });
    // Import Excel : relit un modele rempli et met a jour les notes.
    const grImp=main.querySelector('[data-grimp]'); if(grImp) grImp.addEventListener('change',()=>{
      const file=grImp.files&&grImp.files[0]; if(!file){ return; }
      const cl=main.querySelector('#gr_cls').value, sb=main.querySelector('#gr_sub').value, pr=+main.querySelector('#gr_per').value;
      const c=getCls(cl); if(!c||!sb){ toast('S\u00e9lection incompl\u00e8te'); grImp.value=''; return; }
      const perName=periodList(cyclePeriodType(c.cycle))[pr];
      const rd=new FileReader();
      rd.onload=()=>{ const dataUrl=String(rd.result||''); toast('Import en cours\u2026');
        gradesImportApi(cl,sb,perName,dataUrl).then(r=>{
          toast('Import termin\u00e9 : '+(r.saved||0)+' note(s)'+(r.skipped?(' \u00b7 '+r.skipped+' ignor\u00e9e(s)'):'')+' \u2713');
          renderView();
        }).catch(ex=>toast('Import refus\u00e9 : '+((ex&&ex.message)||'erreur'))).then(()=>{ grImp.value=''; });
      };
      rd.onerror=()=>{ toast('Lecture du fichier impossible'); grImp.value=''; };
      rd.readAsDataURL(file);
    });
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
    // Donnees reelles : encaissements issus de PAY_STORE, impayes calcules.
    const pays=PAY_STORE.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    const rows=pays.length?pays.map(p=>{ const e=DB.students.find(x=>x.id===p.stu); const nm=e?stuName(e):'Élève'; const cl=e&&e.cls?clsLabel(e.cls):'—';
        return row('<div class="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 p-2">'+svg(I.cash)+'</div>',`<p class="text-sm font-semibold">${escH(nm)}</p><p class="text-xs text-slate-500">${escH(cl)} · ${fmtMoney(p.amount)} FCFA · ${escH(payModeLabel(p.mode))}</p>`,badge(p.recu||'Reçu','bg-emerald-100 text-emerald-700')); }).join('')
      : '<div class="p-4 text-sm text-slate-400">Aucun paiement enregistré.</div>';
    return `<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">${stat('Encaissé',fmtMoney(totalEncaisse()),'FCFA '+state.year,'bg-emerald-500')}${stat('Impayés',numStr(unpaidCount()),'élève(s)','bg-rose-500')}${stat('Recouvrement',pctStr(recouvrementPct()),'des élèves','bg-brand-600')}${stat('Reçus',numStr(PAY_STORE.length),'émis','bg-amber-500')}</div>`
      + section('Suivi des paiements','<button class="text-xs font-bold text-brand-600" data-go="payments">Gérer</button>')
      + listWrap(rows);
  }
  function timetable(){
    const H=[['1ʳᵉ','07:00'],['2ᵉ','07:55'],['3ᵉ','08:50'],['4ᵉ','10:00'],['5ᵉ','10:55'],['6ᵉ','11:50'],['7ᵉ','14:00'],['8ᵉ','14:55'],['9ᵉ','15:50']];
    const days=['Lun','Mar','Mer','Jeu','Ven','Sam'];
    const canEdit=state.role==='admin'||state.role==='surveillant';
    const isTeacher=state.role==='teacher';
    const isStudent=state.role==='student';
    const me=isTeacher?(currentTeacher()||{n:sessionUserName()||ROLES.teacher.name,cls:[],id:''}):null;
    const myCls=me?me.cls.map(getCls).filter(Boolean):[];
    // Vue élève / parent : emploi du temps DYNAMIQUE de la classe de l'élève connecté.
    let stu=null, stuClsId='';
    if(isStudent){
      stu=studentForView();
      if(!stu) return noStudentCard();
      stuClsId=clsOfYear(stu,state.year);
      if(!stuClsId) return `<div class="rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft card-in text-sm text-slate-500">${escH(stuName(stu))} n'est affecté(e) à aucune classe pour ${escH(state.year)} — aucun emploi du temps à afficher.</div>`;
    }
    // ----- rendus de cellule (vraies données) -----
    const subOpts=(cid,sel)=>`<option value="">—</option>`+ttSubjectsFor(cid).map(id=>`<option value="${id}" ${sel===id?'selected':''}>${escH(ttSubName(id))}</option>`).join('');
    const teachOpts=(cid,sel)=>`<option value="">— (enseignant)</option>`+ttTeachersFor(cid).map(t=>`<option value="${t.id}" ${sel===t.id?'selected':''}>${escH(t.n||teacName(t))}</option>`).join('');
    const editCell=(val,ri,ci,cid,isGap)=>{
      const sub=(val&&val.sub)||'', teach=(val&&val.teach)||'';
      const sc='w-full rounded-md text-[10px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-center outline-none focus:border-brand-400 py-0.5';
      const gapCls=isGap?' ring-1 ring-inset ring-amber-300 dark:ring-amber-500/50 bg-amber-50/70 dark:bg-amber-500/10':'';
      return `<div data-cell="${ri}-${ci}" class="h-full min-h-[64px] rounded-lg p-1 flex flex-col gap-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700${gapCls}">${isGap?'<span class="text-[8px] font-bold text-amber-600 dark:text-amber-300 text-center leading-none -mb-0.5">trou</span>':''}<select data-k="sub" class="${sc}">${subOpts(cid,sub)}</select><select data-k="teach" class="${sc}">${teachOpts(cid,teach)}</select></div>`;
    };
    // mode : 'teacher' affiche l'enseignant sous la matière ; 'class' affiche la classe (vue consolidée).
    const viewCell=(val,mode,isGap)=>{
      if(!val||!val.sub) return isGap
        ? '<div class="h-full min-h-[52px] rounded-lg flex flex-col items-center justify-center gap-0.5 bg-amber-50 dark:bg-amber-500/10 border border-dashed border-amber-300 dark:border-amber-500/40 text-amber-600 dark:text-amber-300"><span class="text-[11px] leading-none">⏱</span><span class="text-[8px] font-bold uppercase tracking-wide">trou</span></div>'
        : '<div class="h-full min-h-[52px] rounded-lg border border-dashed border-slate-200 dark:border-slate-800"></div>';
      const c=ttSubColor(val.sub);
      let second='';
      if(mode==='teacher') second=val.teach?`<span class="block text-[9px] font-semibold opacity-70 truncate max-w-full">${escH(ttTeacherShort(val.teach))}</span>`:'';
      else if(mode==='class') second=val.cls?`<span class="block text-[9px] font-semibold opacity-70 truncate max-w-full">${escH(clsLabel(val.cls))}</span>`:'';
      return `<div class="h-full min-h-[52px] rounded-lg px-1 py-1 flex flex-col items-center justify-center text-center text-[10px] font-bold bg-${c}-100 text-${c}-700 dark:bg-${c}-500/20 dark:text-${c}-300"><span class="leading-tight">${escH(ttSubName(val.sub))}</span>${second}</div>`;
    };
    // ----- choix de la grille & du mode -----
    let g, curName, editing=false, cellMode='teacher', clsId='', editable=false;
    if(canEdit){
      if(state.ttScope==='teacher'){
        if(!DB.teachers.find(t=>t.id===state.ttTeachId)) state.ttTeachId=(DB.teachers[0]||{}).id||'';
        g=ttTeacherAgg(state.ttTeachId);
        const t=DB.teachers.find(x=>x.id===state.ttTeachId);
        curName=(t?(t.n||teacName(t)):'—')+' · vue consolidée'; cellMode='class';
      } else {
        if(!getCls(state.ttClsId)) state.ttClsId=(DB.classes[0]||{}).id||'';
        clsId=state.ttClsId; g=ttClassGrid(clsId);
        const c=getCls(clsId); curName=c?(clsLabel(clsId)+' · '+c.cycle):'—';
        editing=state.ttEdit; editable=true; cellMode='teacher';
      }
    } else if(isTeacher){
      if(state.ttTScope==='classes' && myCls.length){
        if(state.ttTClsIdx>=myCls.length) state.ttTClsIdx=0;
        const c=myCls[state.ttTClsIdx]; clsId=c.id; g=ttClassGrid(clsId);
        curName=clsLabel(c.id)+' · '+c.cycle; cellMode='teacher';
      } else {
        g=ttTeacherAgg(me.id); curName=(me.n||teacName(me))+' · mon emploi du temps'; cellMode='class';
      }
    } else { g=ttEmptyGrid(); curName='—'; cellMode='teacher'; }
    if(isStudent){
      clsId=stuClsId; g=ttClassGrid(stuClsId);
      const c=getCls(stuClsId);
      curName=clsLabel(stuClsId)+(c?' · '+c.cycle:''); cellMode='teacher'; editable=false; editing=false;
    }
    if(!DB.classes.length && canEdit && state.ttScope!=='teacher'){
      return `<div class="rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft card-in text-sm text-slate-500">Aucune classe enregistrée. Crée d'abord des classes dans Gestion → Classes pour bâtir un emploi du temps.</div>`;
    }
    // ----- barre d'outils -----
    let toolbar='';
    if(canEdit){
      const scopeBtn=(key,label)=>`<button data-ttscope="${key}" class="px-3 py-1.5 rounded-lg text-xs font-bold ${state.ttScope===key?'bg-brand-600 text-white':'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}">${label}</button>`;
      const selCls='px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-semibold outline-none';
      let selectorRows;
      if(state.ttScope==='teacher'){
        const tSel=`<select id="ttTeachPick" class="flex-1 min-w-0 ${selCls}">${DB.teachers.map(t=>`<option value="${t.id}" ${t.id===state.ttTeachId?'selected':''}>${escH(t.n||teacName(t))}</option>`).join('')}</select>`;
        selectorRows=`<div class="flex items-center gap-2"><span class="text-[11px] font-bold text-slate-400 shrink-0">Enseignant</span>${tSel}</div>
          <p class="text-[11px] text-slate-400">Vue consolidée (lecture seule) — calculée automatiquement à partir des emplois du temps des classes où l'enseignant intervient.</p>`;
      } else {
        const actions=editing
          ? `<button id="ttSave" class="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold whitespace-nowrap">Enregistrer</button><button id="ttClear" class="px-3 py-2 rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300 text-xs font-bold whitespace-nowrap">Vider</button>`
          : `<button id="ttEdit" class="px-3 py-2 rounded-xl bg-brand-700 text-white text-xs font-bold whitespace-nowrap">Modifier</button><button id="ttClear" class="px-3 py-2 rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300 text-xs font-bold whitespace-nowrap">Supprimer</button>`;
        const clsSel=`<select id="ttClsPick" class="flex-1 min-w-0 ${selCls}">${DB.classes.map(c=>`<option value="${c.id}" ${c.id===state.ttClsId?'selected':''}>${escH(clsLabel(c.id)+' · '+c.cycle)}</option>`).join('')}</select>`;
        selectorRows=`<div class="flex items-center gap-2"><span class="text-[11px] font-bold text-slate-400 shrink-0">Classe</span>${clsSel}</div>
          <div class="flex items-center gap-2">${actions}</div>`;
      }
      toolbar=`<div class="rounded-2xl p-3 bg-white dark:bg-slate-900 shadow-soft card-in space-y-3">
          <div class="flex items-center gap-2"><span class="text-xs font-bold text-slate-500">Vue :</span>${scopeBtn('class','Par classe')}${scopeBtn('teacher','Par enseignant')}</div>
          ${selectorRows}
          <p class="text-[11px] text-slate-400">Accès gestion — ${ROLES[state.role].tag} : l'emploi du temps se construit à partir des classes, matières et enseignants réellement enregistrés. Choisis une matière dans une case : l'enseignant qui l'assure pour cette classe est affecté automatiquement (modifiable), puis Enregistre.</p>
        </div>`;
    }
    if(isTeacher){
      const selCls='px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-semibold outline-none';
      const tBtn=(key,label)=>`<button data-tts="${key}" class="px-3 py-1.5 rounded-lg text-xs font-bold ${state.ttTScope===key?'bg-brand-600 text-white':'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}">${label}</button>`;
      let pick='';
      if(state.ttTScope==='classes'){
        pick = myCls.length
          ? `<select id="ttTPick" class="w-full ${selCls}">${myCls.map((c,i)=>`<option value="${i}" ${i===state.ttTClsIdx?'selected':''}>${escH(clsLabel(c.id)+' · '+c.cycle)}</option>`).join('')}</select>`
          : `<p class="text-[11px] text-slate-400">Aucune classe ne t'est encore affectée par l'administration.</p>`;
      }
      toolbar=`<div class="rounded-2xl p-3 bg-white dark:bg-slate-900 shadow-soft card-in space-y-3">
          <div class="flex items-center gap-2"><span class="text-xs font-bold text-slate-500">Vue :</span>${tBtn('mine','Mon emploi')}${tBtn('classes','Mes classes')}</div>
          ${pick}
          <p class="text-[11px] text-slate-400">Consultation seule — ton emploi du temps et celui des classes où tu interviens.</p>
        </div>`;
    }
    const gaps=ttGapMap(g); let gapCount=0; for(let r=0;r<gaps.length;r++) for(let c=0;c<gaps[r].length;c++) if(gaps[r][c]) gapCount++;
    if(isStudent){
      const c=getCls(stuClsId);
      toolbar=`<div class="rounded-2xl p-3 bg-brand-50 dark:bg-slate-900 text-brand-700 dark:text-brand-300 text-xs font-semibold card-in flex items-center gap-2">${svg_(I.cal)} ${escH(stuName(stu))} — ${escH(clsLabel(stuClsId))}${c?' · '+escH(c.cycle):''} · ${escH(state.year)}<span class="ml-auto font-normal text-[11px] text-slate-400">Consultation seule</span></div>`;
    }
    const renderOne=(val,ri,ci)=> (editable && editing) ? editCell(val,ri,ci,clsId,gaps[ri]&&gaps[ri][ci]) : viewCell(val,cellMode,gaps[ri]&&gaps[ri][ci]);
    const legend=DB.subjects.map(s=>`<span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-${ttSubColor(s.id)}-500"></span>${escH(s.n)}</span>`).join('')
      +`<span class="flex items-center gap-1"><span class="w-3 h-3 rounded border border-dashed border-amber-400 bg-amber-100 dark:bg-amber-500/20"></span>Trou (créneau libre entre deux cours)</span>`;
    const gapBadge=gapCount
      ? `<span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">⏱ ${gapCount} trou${gapCount>1?'s':''}</span>`
      : `<span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">Aucun trou</span>`;
    return toolbar
      + section('Emploi du temps · '+curName,'<span class="flex items-center gap-2">'+gapBadge+'<span class="text-xs text-slate-400">'+(editing?'Mode édition':'Semaine')+'</span></span>')
      + `<div class="overflow-x-auto -mx-4 px-4 pb-2 card-in">
        <div class="min-w-[560px]">
          <div class="grid gap-1" style="grid-template-columns:56px repeat(6,1fr)">
            <div class="text-[10px] font-bold text-slate-400 flex items-end justify-center pb-1">Heure</div>
            ${days.map(d=>`<div class="text-xs font-extrabold text-center py-1.5 rounded-lg bg-slate-800 text-white">${d}</div>`).join('')}
            ${H.map((h,i)=>`
              <div class="flex flex-col items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 py-1"><span class="text-xs font-extrabold text-brand-600">${h[0]}</span><span class="text-[9px] text-slate-400">${h[1]}</span></div>
              ${g[i].map((val,ci)=>renderOne(val,i,ci)).join('')}
            `).join('')}
          </div>
        </div></div>`
      + `<div class="flex flex-wrap gap-2 mt-3 text-[10px] font-semibold">${legend}</div>`
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
    main.querySelectorAll('[data-ttscope]').forEach(b=>b.addEventListener('click',()=>{ state.ttScope=b.dataset.ttscope; state.ttEdit=false; renderView(); }));
    const cls=main.querySelector('#ttClsPick'); if(cls) cls.addEventListener('change',()=>{ state.ttClsId=cls.value; state.ttEdit=false; renderView(); });
    const tch=main.querySelector('#ttTeachPick'); if(tch) tch.addEventListener('change',()=>{ state.ttTeachId=tch.value; renderView(); });
    const eb=main.querySelector('#ttEdit'); if(eb) eb.addEventListener('click',()=>{ state.ttEdit=true; renderView(); });
    const sb=main.querySelector('#ttSave'); if(sb) sb.addEventListener('click',()=>{
      const gr=ttClassGrid(state.ttClsId);
      const next=ttEmptyGrid();
      main.querySelectorAll('[data-cell]').forEach(div=>{
        const p=div.dataset.cell.split('-');
        const sub=(div.querySelector('[data-k="sub"]')||{}).value||'';
        const teach=(div.querySelector('[data-k="teach"]')||{}).value||'';
        next[+p[0]][+p[1]] = sub ? {sub:sub,teach:teach} : '';
      });
      // Alerte conflit d'horaire : meme enseignant, meme creneau, dans une autre classe.
      const conflicts=(typeof ttGridConflicts==='function')?ttGridConflicts(state.ttClsId,next):[];
      if(conflicts.length){
        const _days=['Lun','Mar','Mer','Jeu','Ven','Sam'];
        const _hours=['1ʳᵉ','2ᵉ','3ᵉ','4ᵉ','5ᵉ','6ᵉ','7ᵉ','8ᵉ','9ᵉ'];
        const lines=conflicts.slice(0,8).map(cf=>'• '+ttTeacherShort(cf.teach)+' — '+(_days[cf.ci]||'')+' '+(_hours[cf.ri]||'')+' (déjà en cours avec '+clsLabel(cf.other)+')').join('\n');
        const more=conflicts.length>8?('\n… +'+(conflicts.length-8)+' autre(s)'):'';
        if(!confirm('⚠ Conflit d’horaire détecté :\n'+lines+more+'\n\nLe même enseignant est déjà occupé dans une autre classe à ce créneau. Enregistrer quand même ?')) return;
      }
      for(let ri=0;ri<next.length;ri++) for(let ci=0;ci<next[ri].length;ci++) gr[ri][ci]=next[ri][ci];
      state.ttEdit=false; persistTT(); renderView();
      toast(conflicts.length?('Enregistré — '+conflicts.length+' conflit(s) d’horaire ⚠'):'Emploi du temps enregistré ✓');
    });
    const cb=main.querySelector('#ttClear'); if(cb) cb.addEventListener('click',()=>{
      const c=getCls(state.ttClsId);
      if(!confirm('Vider / supprimer l’emploi du temps de '+(c?clsLabel(c.id):'cette classe')+' ?')) return;
      TT_STORE['cls:'+state.ttClsId]=ttEmptyGrid(); state.ttEdit=false; persistTT(); renderView(); toast('Emploi du temps supprimé');
    });
    // Auto-affectation du prof intervenant + alerte conflit d'horaire. Quand on
    // choisit une matiere, on pre-remplit l'enseignant qui l'assure (modifiable) ;
    // si cet enseignant est deja occupe ailleurs au meme creneau, la case est
    // surlignee en rouge et un message d'alerte s'affiche.
    main.querySelectorAll('[data-cell]').forEach(div=>{
      const subSel=div.querySelector('[data-k="sub"]');
      const teachSel=div.querySelector('[data-k="teach"]');
      if(!subSel||!teachSel) return;
      const _p=div.dataset.cell.split('-'); const ri=+_p[0], ci=+_p[1];
      const mark=()=>{
        const teach=teachSel.value||'';
        const other=(teach&&typeof ttFindConflict==='function')?ttFindConflict(state.ttClsId,ri,ci,teach):'';
        div.classList.toggle('ring-2',!!other);
        div.classList.toggle('ring-inset',!!other);
        div.classList.toggle('ring-rose-500',!!other);
        div.title=other?('Conflit d’horaire : '+ttTeacherShort(teach)+' déjà en cours avec '+clsLabel(other)+' à ce créneau'):'';
        return other;
      };
      subSel.addEventListener('change',()=>{
        if(subSel.value){
          const tid=(typeof ttTeacherForSub==='function')?ttTeacherForSub(state.ttClsId, subSel.value):'';
          if(tid && Array.prototype.some.call(teachSel.options,o=>o.value===tid)){ teachSel.value=tid; }
        } else { teachSel.value=''; }
        const other=mark();
        if(other) toast('⚠ Conflit : '+ttTeacherShort(teachSel.value)+' déjà en cours avec '+clsLabel(other)+' à ce créneau');
      });
      teachSel.addEventListener('change',()=>{
        const other=mark();
        if(other) toast('⚠ Conflit : '+ttTeacherShort(teachSel.value)+' déjà en cours avec '+clsLabel(other)+' à ce créneau');
      });
      mark();
    });
  }
  function attendance(){
    // Vue élève / parent : la présence PROPRE a l'élève connecté (relevés ATT_STORE).
    const me=studentForView();
    if(!me) return noStudentCard();
    const mine=ATT_STORE.filter(a=>a.stu===me.id);
    const rate=studentAttendanceRate(me);
    const retards=mine.filter(a=>a.status==='retard').length;
    const absents=mine.filter(a=>a.status==='absent').length;
    const presents=mine.filter(a=>a.status==='present').length;
    const hist=mine.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,30);
    const clsId=clsOfYear(me,state.year); const cls=clsId?getCls(clsId):null;
    const LBL={present:['Présent','emerald'],retard:['Retard','amber'],absent:['Absent','rose']};
    const rows=hist.length?hist.map(a=>{ const m=LBL[a.status]||['—','slate'];
        return row(`<div class="w-9 h-9 rounded-xl bg-${m[1]}-100 text-${m[1]}-600 dark:bg-${m[1]}-500/15 dark:text-${m[1]}-300 p-2">`+svg(I.check)+'</div>',`<p class="text-sm font-semibold">${m[0]}</p><p class="text-xs text-slate-500">${escH(a.date||'')}</p>`,''); }).join('')
      : '<div class="p-4 text-sm text-slate-400">Aucun pointage enregistré pour le moment.</div>';
    return `<div class="rounded-2xl p-3 bg-brand-50 dark:bg-slate-900 text-brand-700 dark:text-brand-300 text-xs font-semibold card-in flex items-center gap-2">${svg_(I.check)} ${escH(stuName(me))}${cls?' — '+escH(clsLabel(cls.id)):''} · ${escH(state.year)}</div>`
      + `<div class="grid grid-cols-2 gap-3 lg:grid-cols-4 mt-3">${stat('Présence',pctStr(rate),presents+' présence(s)','bg-emerald-500')}${stat('Retards',numStr(retards),'cumul','bg-amber-500')}${stat('Absences',numStr(absents),'cumul','bg-rose-500')}${stat('Relevés',numStr(mine.length),'enregistrés','bg-brand-600')}</div>`
      + section('Mon historique de présence')
      + listWrap(rows);
  }
  // Pointage des enseignants — par le SURVEILLANT, branché sur l'emploi du temps
  function pointage(){
    // Pointage AUTOMATIQUE : chaque séance de l'emploi du temps = 1 heure pleine, présence déduite automatiquement.
    // La surveillance CONSULTE uniquement (lecture seule) — aucun bouton de pointage.
    const teachers=DB.teachers.slice();
    const today=todayIso();
    const day=state.ptDay||today;
    const start=state.ptStart||(today.slice(0,8)+'01');
    const end=state.ptEnd||today;
    let totReal=0,totPlan=0;
    teachers.forEach(t=>{ totReal+=teacherRealizedHours(t.id,start,end); totPlan+=teacherPlannedHours(t.id,start,end); });
    const taux = totPlan>0 ? Math.round(totReal/totPlan*100) : null;
    const dayIdx=ttDayIndex(day);
    const periodCard=`<div class="rounded-2xl p-3 bg-white dark:bg-slate-900 shadow-soft card-in">
        <p class="text-xs font-bold text-slate-500 mb-2">Période de calcul</p>
        <div class="flex items-center gap-2 text-sm">
          <input id="pt_start" type="date" value="${start}" class="flex-1 min-w-0 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 outline-none">
          <span class="text-slate-400">→</span>
          <input id="pt_end" type="date" value="${end}" class="flex-1 min-w-0 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 outline-none">
        </div>
        <p class="text-[11px] text-slate-400 mt-2">Pointage automatique d'après l'emploi du temps — chaque séance = 1 heure pleine. Lecture seule.</p></div>`;
    const tiles=`<div class="grid grid-cols-2 gap-3 mt-3 lg:grid-cols-4">${stat('Heures réalisées',fmtHours(totReal),'sur '+fmtHours(totPlan)+' prévues','bg-brand-600')}${stat('Taux présence',taux==null?'—':taux+'%',teachers.length+' enseignant(s)','bg-emerald-600')}</div>`;
    const rows=teachers.map((t,i)=>{
      const cells=dayIdx<0?0:teacherDayCells(t.id,dayIdx);
      const planned=dayIdx<0?0:teacherDayHours(t.id,dayIdx);
      const done = planned; // présence automatique : réalisé = prévu
      const nm=t.n||teacName(t), sp=t.spec||'';
      return `<tr class="${i%2?'bg-white dark:bg-slate-900':'bg-slate-50 dark:bg-slate-900/60'}">
        <td class="px-3 py-2"><p class="font-semibold">${escH(nm)}</p><p class="text-[11px] text-slate-500">${escH(sp)}</p></td>
        <td class="px-2 py-2 text-center text-slate-500">${cells}</td>
        <td class="px-2 py-2 text-center font-semibold">${fmtHours(planned)}</td>
        <td class="px-2 py-2 text-center font-extrabold ${done?'text-emerald-600':'text-slate-400'}">${fmtHours(done)}</td></tr>`;
    }).join('')||'<tr><td colspan="4" class="p-4 text-sm text-slate-400 text-center">Aucun enseignant enregistré — ajoute des enseignants puis construis l\'emploi du temps.</td></tr>';
    const dayTable=`<div class="rounded-2xl overflow-hidden shadow-soft card-in overflow-x-auto">
        <table class="w-full text-sm min-w-[420px]">
          <thead><tr class="bg-slate-800 text-white text-[11px] font-bold">
            <th class="text-left px-3 py-2">Enseignant</th><th class="px-2 py-2">Cours</th><th class="px-2 py-2">Prévu</th><th class="px-2 py-2">Réalisé</th>
          </tr></thead><tbody>${rows}</tbody></table></div>`;
    const dayPicker=`<input id="pt_day" type="date" value="${day}" class="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs outline-none">`;
    const cumul=teachers.map(t=>{ const r=teacherRealizedHours(t.id,start,end), p=teacherPlannedHours(t.id,start,end);
        return row('<div class="w-9 h-9 rounded-xl bg-brand-50 text-brand-700 dark:bg-slate-800 dark:text-brand-300 p-2">'+svg(I.clock)+'</div>',`<p class="text-sm font-semibold">${escH(t.n||teacName(t))}</p><p class="text-xs text-slate-500">${escH(t.spec||'')}</p>`,`<div class="text-right"><p class="font-extrabold text-brand-700 dark:text-brand-300">${fmtHours(r)}</p><p class="text-[10px] text-slate-400">/ ${fmtHours(p)} prévues</p></div>`); }).join('')||'<div class="p-4 text-sm text-slate-400">Aucun enseignant.</div>';
    return periodCard + tiles
      + section('Pointage du jour', dayPicker)
      + dayTable
      + section('Cumul par enseignant (période)')
      + listWrap(cumul);
  }
  function wirePointage(){
    const main=$('#main');
    // En mode backend : charger une fois le pointage serveur sur la plage affichee,
    // puis re-rendre pour superposer les vrais statuts (garde anti-boucle par clef).
    if(typeof staffApiOn==='function'&&staffApiOn()&&typeof hydrateTeacherAttendanceApi==='function'){
      const today=todayIso(); const from=state.ptStart||(today.slice(0,8)+'01'); const to=state.ptEnd||today;
      const key='tpt:'+from+':'+to; window._xsLoaded=window._xsLoaded||{};
      if(!window._xsLoaded[key]){ window._xsLoaded[key]=true; hydrateTeacherAttendanceApi(from,to).then(ok=>{ if(ok) renderView(); }); }
    }
    const s=main.querySelector('#pt_start'); if(s) s.addEventListener('change',()=>{ state.ptStart=s.value; renderView(); });
    const e=main.querySelector('#pt_end'); if(e) e.addEventListener('change',()=>{ state.ptEnd=e.value; renderView(); });
    const d=main.querySelector('#pt_day'); if(d) d.addEventListener('change',()=>{ state.ptDay=d.value; renderView(); });
    // Pointage automatique (lecture seule) : plus aucun bouton P/R/A à câbler.
  }
  // Côté enseignant : consultation (lecture seule) de ses heures, d'après l'emploi du temps
  function myhours(){
    const me=currentTeacher();
    const days=['Lun','Mar','Mer','Jeu','Ven','Sam'];
    if(!me){
      return `<div class="rounded-2xl p-3 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-semibold card-in flex items-center gap-2">${svg_(I.clock)} Aucune fiche enseignant associée à ce compte.</div>`;
    }
    const today=todayIso();
    const start=state.ptStart||(today.slice(0,8)+'01');
    const end=state.ptEnd||today;
    const planned=teacherPlannedHours(me.id,start,end);
    const real=teacherRealizedHours(me.id,start,end);
    const taux=planned>0?Math.round(real/planned*100):null;
    const detRows=days.map((d,i)=>({d:d,c:teacherDayCells(me.id,i),h:teacherDayHours(me.id,i)})).filter(x=>x.c>0);
    const detail=detRows.length?detRows.map((x,i)=>`<div class="grid grid-cols-3 text-sm ${i%2?'bg-white dark:bg-slate-900':'bg-slate-50 dark:bg-slate-900/60'}"><div class="p-2 font-semibold">${x.d}</div><div class="p-2 text-center">${x.c} créneau(x)</div><div class="p-2 text-center font-bold text-emerald-600">${fmtHours(x.h)}</div></div>`).join('')
      : '<div class="p-4 text-sm text-slate-400">Aucun cours dans ton emploi du temps.</div>';
    return `<div class="rounded-2xl p-3 bg-brand-50 dark:bg-slate-900 text-brand-700 dark:text-brand-300 text-xs font-semibold card-in flex items-center gap-2">${svg_(I.clock)} Tes heures sont calculées à partir de l'emploi du temps — la surveillance valide ta présence (lecture seule).</div>`
      + `<div class="grid grid-cols-2 gap-3 mt-3 lg:grid-cols-4">${stat('Heures réalisées',fmtHours(real),'période courante','bg-emerald-600')}${stat('Prévues',fmtHours(planned),taux==null?'—':'taux '+taux+'%','bg-brand-600')}${stat('Semaine type',fmtHours(teacherWeekHours(me.id)),teacherWeekCells(me.id)+' créneaux','bg-slate-600')}</div>`
      + section('Répartition hebdomadaire',"<span class=\"text-xs text-slate-400\">d'après l'emploi du temps</span>")
      + `<div class="rounded-2xl overflow-hidden shadow-soft card-in">
          <div class="grid grid-cols-3 bg-slate-800 text-white text-[11px] font-bold"><div class="p-2">Jour</div><div class="p-2 text-center">Cours</div><div class="p-2 text-center">Heures</div></div>
          ${detail}</div>`;
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
  // Code-barres Code 128 (variante B) genere en SVG, 100% local (aucune librairie).
  // Sert de verification visuelle imprimable (ex : matricule de l'eleve).
  function barcodeSVG(text,opts){
    try{
      opts=opts||{};
      const unit=opts.unit||1.05, h=opts.height||38, quiet=opts.quiet!=null?opts.quiet:8;
      const PAT=["212222","222122","222221","121223","121322","131222","122213","122312","132212","221213","221312","231212","112232","122132","122231","113222","123122","123221","223211","221132","221231","213212","223112","312131","311222","321122","321221","312212","322112","322211","212123","212321","232121","111323","131123","131321","112313","132113","132311","211313","231113","231311","112133","112331","132131","113123","113321","133121","313121","211331","231131","213113","213311","213131","311123","311321","331121","312113","312311","332111","314111","221411","431111","111224","111422","121124","121421","141122","141221","112214","112412","122114","122411","142112","142211","241211","221114","413111","241112","134111","111242","121142","121241","114212","124112","124211","411212","421112","421211","212141","214121","412121","111143","111341","131141","114113","114311","411113","411311","113141","114131","311141","411131","211412","211214","211232","2331112"];
      let s=String(text||'').replace(/[^\x20-\x7e]/g,'').slice(0,22)||'0';
      const codes=[104]; // Start B
      let sum=104;
      for(let i=0;i<s.length;i++){ const v=s.charCodeAt(i)-32; codes.push(v); sum+=v*(i+1); }
      codes.push(sum%103); // somme de controle
      codes.push(106);     // Stop
      let x=quiet, rects='';
      for(let k=0;k<codes.length;k++){ const p=PAT[codes[k]]; let bar=true; for(let m=0;m<p.length;m++){ const w=(+p[m])*unit; if(bar){ rects+='<rect x="'+x.toFixed(2)+'" y="0" width="'+w.toFixed(2)+'" height="'+h+'"/>'; } x+=w; bar=!bar; } }
      const total=x+quiet;
      return '<svg xmlns="http://www.w3.org/2000/svg" width="'+total.toFixed(2)+'" height="'+h+'" viewBox="0 0 '+total.toFixed(2)+' '+h+'" shape-rendering="crispEdges" preserveAspectRatio="none"><rect width="'+total.toFixed(2)+'" height="'+h+'" fill="#fff"/><g fill="#111">'+rects+'</g></svg>';
    }catch(e){ return ''; }
  }
  // Format de bulletin applicable à un cycle (surcharge par cycle, sinon défaut de l'école)
  function bulletinFmtFor(cycle){ const cfg=schoolCfg(); const m=cfg.bulletinFmtByCycle||{}; return m[cycle]||cfg.bulletinFmt||'vrac'; }
  // Nom du professeur titulaire d'une classe pour l'année active (state.year).
  // Le titulaire peut changer d'une année à l'autre : on résout via classTitulaireFor
  // (affectation de l'année, repli sur le titulaire par défaut), puis repli final
  // sur le prof principal global (cfg.profPrincipal) si rien n'est défini.
  function classTitulaireName(cls,cfg){
    cfg=cfg||schoolCfg();
    const fid=(typeof classTitulaireFor==='function')?classTitulaireFor(cls,state.year):(cls&&cls.titulaire);
    if(fid){ const t=DB.teachers.find(x=>x.id===fid); if(t) return teacName(t); }
    return cfg.profPrincipal||'';
  }
  function classBulletinData(clsId,per){
    const cls=getCls(clsId), cfg=schoolCfg();
    const subs=DB.program.filter(p=>p.cls===clsId).map(p=>({sub:getSub(p.sub),coef:p.coef,oblig:p.oblig,spec:p.spec})).filter(x=>x.sub);
    const studs=studentsInClass(clsId);
    const optOn=!!cfg.optFacCoef1;
    let rows=studs.map(e=>{
      let totPts=0, totCoef=0, sumMoy=0, nMoy=0, facSum=0, facN=0; const lines=[];
      // Une matière obligatoire SANS note compte 0 et entre dans tous les calculs
      // de moyennes/bulletins (les matières facultatives ne sont PAS mises à 0).
      subs.forEach(({sub,coef,oblig,spec})=>{
        const g=gGet(clsId,sub.id,per)[e.id]; let m=moyenne(g);
        if(m==null && oblig) m=0;
        const fac=!oblig;
        lines.push({sub,coef,moy:m,fac,spec:!!spec,dom:sub.dom||'autre',gi:(g&&g.i)||'',gd:(g&&g.d)||'',gc:(g&&g.c)||''});
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
    const tplList=[['officiel','Officiel · synthèse annuelle'],['standard','Standard (notes + moyenne)'],['detaille','Détaillé (par type d\'épreuve)'],['compact','Compact (synthèse)'],['m_ci_trim','Modèle CI · Trimestriel (disciplines+bilans)'],['m_ci_sem','Modèle CI · Semestriel (S1/S2+annuel)'],['m_tg_trim','Modèle TG · Trimestriel (conseil+visas)'],['m_tg_sem','Modèle TG · Semestriel']];
    const tplSel=`<select id="bl_tpl" class="${MGIN}">${tplList.map(x=>`<option value="${x[0]}"${cfg.bulletinTpl===x[0]?' selected':''}>${x[1]}</option>`).join('')}</select>`;
    const toolbar=`<div class="rounded-2xl p-3 bg-white dark:bg-slate-900 shadow-soft card-in space-y-2">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2"><div><p class="text-[11px] font-bold text-slate-400 mb-1">Classe</p>${clsSel}</div><div><p class="text-[11px] font-bold text-slate-400 mb-1">Période</p>${perSel}</div></div>
        <div><p class="text-[11px] font-bold text-slate-400 mb-1">Modèle de bulletin</p>${tplSel}<p class="text-[11px] text-slate-400 mt-1">S'applique à l'impression. « Officiel » : le dernier bulletin de l'année reprend toutes les périodes + moyenne annuelle et rangs. Réglage détaillé aussi dans Paramètres → Système.</p></div>
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
    const tpl=main.querySelector('#bl_tpl'); if(tpl) tpl.addEventListener('change',()=>{ schoolCfg().bulletinTpl=tpl.value||'officiel'; persistCfg(); renderView(); toast('Modèle de bulletin : '+tpl.options[tpl.selectedIndex].text); });
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
            ${c.dob?`<p class="text-slate-500">Né(e) le <b class="text-slate-700 dark:text-slate-200">${escH(c.dob)}</b></p>`:''}
            ${c.lieu?`<p class="text-slate-500">Lieu <b class="text-slate-700 dark:text-slate-200">${escH(c.lieu)}</b></p>`:''}
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
        <p><i>Régime</i> ${escH(c.regime||'—')}</p>${c.dob?('<p><i>Né(e) le</i> '+escH(c.dob)+'</p>'):''}${c.lieu?('<p><i>Lieu</i> '+escH(c.lieu)+'</p>'):''}</div>
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
    openPrintPreview(doc);
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
    const rows=[['Mat.',c.matricule||'—'],['Classe',clsLbl||'—'],['Régime',c.regime||'—']]; if(c.dob) rows.push(['Né(e) le',c.dob]); if(c.lieu) rows.push(['Lieu',c.lieu]);
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
    const pN=v=>{const x=parseFloat(String(v==null?'':v).replace(',','.'));return isNaN(x)?null:x;};
    const optOn=!!r.optOn;
    const tpl=ctx.tpl||cfg.bulletinTpl||'standard';
    const detail=(tpl!=='compact');            // colonnes Interro / Devoir / Moy.cl. / Compo (sauf modèle compact)
    const showAppr=(tpl!=='compact');          // compact = sans colonne Appréciation
    const ncols=1+(detail?4:0)+3+(showAppr?1:0);
    const subTr=l=>{
      const app=l.moy==null?'–':mentionFor(l.moy,cfg);
      const ncCell=(optOn&&l.fac)?'<span class="opt">opt.</span>':fmt(l.moy==null?null:avgRound(l.moy*l.coef,cfg));
      const coefCell=l.coef+((optOn&&l.fac)?' *':'');
      let tds=`<td class="nm">${escH(l.sub.n)}${l.fac?' <span class="fac">(fac.)</span>':''}</td>`;
      if(detail){ const mcl=moyClasse({i:l.gi,d:l.gd}); tds+=`<td>${fmt(pN(l.gi))}</td><td>${fmt(pN(l.gd))}</td><td class="mcl">${fmt(mcl)}</td><td>${fmt(pN(l.gc))}</td>`; }
      tds+=`<td class="moy">${fmt(l.moy)}</td><td>${coefCell}</td><td class="b">${ncCell}</td>`;
      if(showAppr) tds+=`<td class="ap">${escH(app)}</td>`;
      return `<tr>${tds}</tr>`;
    };
    const facAggTr=(optOn&&r.facMoy!=null)?(()=>{ let tds=`<td class="nm">Moyenne des matières facultatives *</td>`; if(detail) tds+='<td>–</td><td>–</td><td>–</td><td>–</td>'; tds+=`<td class="moy">${fmt(r.facMoy)}</td><td>1</td><td class="b">${fmt(r.facMoy)}</td>`; if(showAppr) tds+='<td class="ap">—</td>'; return `<tr class="agg">${tds}</tr>`; })():'';
    const grpRows=(label,arr,withAgg)=>{
      const showAgg=withAgg&&optOn&&r.facMoy!=null;
      if(!arr.length&&!showAgg) return '';
      return `<tr class="grp"><td colspan="${ncols}">${escH(label)}</td></tr>`+arr.map(subTr).join('')+(showAgg?facAggTr:'');
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
    if(!lignes) lignes=`<tr><td colspan="${ncols}" class="empty">Aucune matière au programme.</td></tr>`;
    let theadTr=`<th style="text-align:left">Matière</th>`;
    if(detail) theadTr+='<th>Interro</th><th>Devoir</th><th>Moy. cl.</th><th>Compo</th>';
    theadTr+=`<th class="moy">Moyenne /${gmax}</th><th>Coef</th><th>Moy×Coef</th>`;
    if(showAppr) theadTr+='<th>Appréciation</th>';
    let tfootTr=`<td class="nm">Totaux</td>`;
    if(detail) tfootTr+='<td></td><td></td><td></td><td></td>';
    tfootTr+=`<td class="moy"></td><td>${r.totCoef}</td><td class="b">${fmt(r.totPts)}</td>`;
    if(showAppr) tfootTr+='<td></td>';
    const rang=cfg.rankVisible&&r.rank!=null?(r.rank+(r.rank===1?'er':'e')+' / '+ctx.eff):'';
    const ment=r.moyGen==null?'–':mentionFor(r.moyGen,cfg);
    const pass=r.moyGen!=null&&r.moyGen>=cfg.passMark;
    // La decision de PASSAGE en classe superieure n'a de sens qu'au DERNIER
    // bulletin (3e trimestre / 2e semestre). Sur les bulletins intermediaires,
    // on affiche un simple bilan de periode, sans mention de passage.
    const isLastPer=(function(){ try{ const ps=periodList(cyclePeriodType(cls.cycle)); return per===ps[ps.length-1]; }catch(e){ return false; } })();
    const decLabel=isLastPer?'Décision':'Bilan de la période';
    const decision=r.moyGen==null?'–':(isLastPer?(pass?'Admis(e) en classe supérieure':'Travail insuffisant'):(pass?'Résultats satisfaisants':'Travail à renforcer'));
    const en=e.enrollments&&e.enrollments.find(x=>x.year===state.year); const statut=en?en.statut:(e.statut||'');
    return `<section class="bul">
      ${printHeaderHTML(ctx)}
      <p class="title">BULLETIN DE NOTES — ${escH(per)} · ${escH(state.year)}</p>
      <table class="info"><tbody>
        <tr><td class="k">Élève</td><td>${escH(stuName(e))}</td><td class="k">Matricule</td><td>${escH(e.mat||'–')}</td></tr>
        <tr><td class="k">Classe</td><td>${escH(clsLabel(cls.id))}</td><td class="k">Statut</td><td>${escH(statut||'–')}</td></tr>
      </tbody></table>
      <table class="grades"><thead><tr>${theadTr}</tr></thead>
        <tbody>${lignes}</tbody>
        <tfoot><tr>${tfootTr}</tr></tfoot></table>
      <div class="synth">
        <div class="box"><span>Moyenne générale</span><b class="${pass?'ok':'ko'}">${fmt(r.moyGen)} / ${gmax}</b></div>
        ${rang?`<div class="box"><span>Rang</span><b>${escH(rang)}</b></div>`:''}
        <div class="box"><span>Mention</span><b>${escH(ment)}</b></div>
        <div class="box"><span>${decLabel}</span><b class="${pass?'ok':'ko'}">${escH(decision)}</b></div>
      </div>
      <p class="appr"><b>Appréciation du conseil :</b> ____________________________________________</p>
      ${optOn?'<p class="foot">* La moyenne des matières facultatives compte comme une note unique au coefficient 1.</p>':''}
      ${_verifFooterHTML(e,ctx,r.moyGen,per)}
    </section>`;
  }
  // CSS commun des bulletins imprimables (standard + officiel) : banniere d'en-tete partagee.
  function bulletinCSS(){
    return `*{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}body{margin:0;color:#111}.bul{padding:18mm 14mm;page-break-after:always}.bul:last-child{page-break-after:auto}.bhead{display:flex;align-items:center;gap:12px;border-bottom:2px solid #1f2937;padding-bottom:8px}.logo{width:54px;height:54px;object-fit:cover;border-radius:8px}h1{font-size:17px;margin:0}.addr{color:#555;font-size:11px;margin:2px 0 0}.title{text-align:center;font-weight:bold;font-size:13px;margin:20px 0 12px;letter-spacing:.5px}table{width:100%;border-collapse:collapse;font-size:12px}table.info{margin-bottom:10px}table.info td{border:1px solid #cbd5e1;padding:6px 8px;vertical-align:middle}table.info td.k{background:#f1f5f9;font-weight:bold;width:14%}table.grades th,table.grades td{border:1px solid #cbd5e1;padding:6px 8px;text-align:center;vertical-align:middle}table.grades th{background:#1f2937;color:#fff}table.grades td.nm{text-align:left;font-weight:600}table.grades td.b{font-weight:bold}table.grades td.ap{font-size:11px;color:#444}table.grades tfoot td{background:#f1f5f9;font-weight:bold}table.grades th.moy{background:#0b2a4a}table.grades td.moy{background:#eef6ff;font-weight:600}table.grades tfoot td.moy{background:#e3eefb}table.grades td.mcl{color:#475569;font-style:italic}.empty{color:#888;padding:14px}.synth{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap}.synth .box{flex:1;min-width:120px;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;display:flex;flex-direction:column;gap:3px}.synth .box span{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.4px}.synth .box b{font-size:15px}.synth .ok{color:#047857}.synth .ko{color:#dc2626}.appr{font-size:12px;margin-top:16px;color:#333}.sign{margin-top:28px;display:flex;justify-content:space-between;font-size:12px}.sign div{width:42%;border-top:1px solid #999;padding-top:6px;text-align:center;color:#555}table.grades tr.grp td{background:#e2e8f0;color:#1f2937;text-align:left;font-weight:bold;font-size:10px;letter-spacing:.4px;text-transform:uppercase}table.grades tr.agg td{background:#f8fafc;font-style:italic}table.grades tbody tr:nth-child(even):not(.grp):not(.agg) td{background:#f6f9fc}table.grades tbody tr:nth-child(even):not(.grp):not(.agg) td.moy{background:#e3eefb}.fac{color:#64748b;font-size:10px;font-style:italic}.opt{color:#94a3b8;font-size:10px}.foot{font-size:10px;color:#64748b;margin:6px 0 0;font-style:italic}.bottom{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-top:22px;padding-top:12px;border-top:1px solid #e2e8f0}.bottom .sign{flex:0 0 42%;margin-top:0}.codes{display:flex;align-items:center;gap:14px;flex-wrap:wrap}.codes .qr svg{width:74px;height:74px;background:#fff;display:block}.codes .bc{display:flex;flex-direction:column;align-items:center;gap:3px}.codes .bc svg{width:155px;height:34px;display:block}.codes .bc-val{font-size:9px;letter-spacing:2px;color:#334155;font-family:'Courier New',monospace}.codes .verif-note{font-size:9px;color:#94a3b8;max-width:92px;line-height:1.35}`
      + `.xs-hd{display:flex;align-items:center;gap:14px;border-bottom:3px solid #1f2937;padding-bottom:10px}.xs-logo{width:58px;height:58px;object-fit:cover;border-radius:10px;flex:0 0 auto}.xs-logo.xs-ph{background:#eef2f7;border:1px dashed #cbd5e1}.xs-hd-main{flex:1;min-width:0}.xs-hd-main h1{font-size:18px;margin:0;letter-spacing:.3px}.xs-sub{color:#555;font-size:11px;margin:2px 0 0}.xs-sub2{color:#64748b;font-size:10px;margin:1px 0 0}.xs-hd-year{font-size:11px;font-weight:bold;color:#1f2937;border:1px solid #cbd5e1;border-radius:999px;padding:3px 10px;white-space:nowrap}table.recap{margin-top:14px}table.recap th,table.recap td{border:1px solid #94a3b8;padding:6px 8px;text-align:center;vertical-align:middle}table.recap th{background:#334155;color:#fff}table.recap td.pl{text-align:left;font-weight:600}table.recap tr.an td{background:#f1f5f9;font-weight:bold}table.recap tbody tr:nth-child(even):not(.an) td{background:#f6f9fc}table.recap th,table.recap td{border-left:1.3px solid #64748b;border-right:1.3px solid #64748b}`
      + `@media print{.bul{padding:12mm}}`
      + `@page{size:A4 portrait;margin:0}`
      + printHeaderCSS();
  }
  // CSS autonome de l'en-tete 2 colonnes (ministère / école) : reutilisable dans
  // les bulletins ET les autres documents imprimables (ex : reçus de paiement).
  function printHeaderCSS(){
    return `.xs-hd2{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;border-bottom:3px solid #1f2937;padding-bottom:10px}.xs-hd2 .xs-min{flex:1;min-width:0;display:flex;align-items:flex-start;gap:8px}.xs-min-logo{width:46px;height:46px;object-fit:contain;flex:0 0 auto}.xs-min-pays{font-size:11px;font-weight:bold;margin:0;text-transform:uppercase;letter-spacing:.3px}.xs-min-dev{font-size:10px;font-style:italic;color:#444;margin:1px 0 4px}.xs-min-l{font-size:10px;color:#333;margin:0;line-height:1.35}.xs-hd2 .xs-eco{flex:1;min-width:0;display:flex;flex-direction:row-reverse;align-items:flex-start;gap:12px;text-align:right}.xs-logo{width:58px;height:58px;object-fit:cover;border-radius:10px;flex:0 0 auto}.xs-logo.xs-ph{background:#eef2f7;border:1px dashed #cbd5e1}.xs-eco-main{min-width:0}.xs-eco-main h1{font-size:17px;margin:0;letter-spacing:.3px}.xs-hd2 .xs-eco .xs-sub{color:#555;font-size:11px;margin:2px 0 0}.xs-hd2 .xs-eco .xs-sub2{color:#64748b;font-size:10px;margin:1px 0 0}.xs-hd-yr{text-align:center;margin:8px 0 2px}.xs-hd-yr span{font-size:11px;font-weight:bold;color:#1f2937;border:1px solid #cbd5e1;border-radius:999px;padding:2px 12px}`
      + `.xs-hd3{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin:2mm 4mm 0;border-bottom:3px solid #1f2937;padding-bottom:10px}.xs-hd3 .xs-c-min,.xs-hd3 .xs-c-eco{flex:1;min-width:0;text-align:center}.xs-hd3 .xs-c-logo{flex:0 0 auto;align-self:center;display:flex;align-items:center;justify-content:center;padding:0 10px}.xs-hd3 .xs-c-logo .xs-logo{width:78px;height:78px;border-radius:12px}.xs-hd3 .xs-c-min p{margin:0 0 2px;line-height:1.45}.xs-hd3 .xs-eco-main p{line-height:1.45}.xs-hd3 .xs-eco-main h1{line-height:1.25}.xs-hd3 .xs-min-logo{display:block;margin:0 auto 8px;width:50px;height:50px}.xs-hd3 .xs-eco-main h1{font-size:19px;margin:0;letter-spacing:.3px}.xs-hd3 .xs-eco-main .xs-sub{color:#555;font-size:12px;margin:2px 0 0}.xs-hd3 .xs-eco-main .xs-sub2{color:#64748b;font-size:11px;margin:1px 0 0}.xs-hd3 .xs-min-pays{font-size:12px}.xs-hd3 .xs-min-dev{font-size:11px}.xs-hd3 .xs-min-l{font-size:11px}`;
  }
  // ===== En-tete STANDARD reutilisable (banniere commune a tous les docs imprimables) =====
  // Deux colonnes : a GAUCHE la tutelle (ministere), a DROITE l'etablissement.
  // Les champs sont renseignes via Parametres > En-tetes (schoolCfg).
  function printHeaderHTML(ctx){
    const sc=ctx.sc||{}, cfg=ctx.cfg||schoolCfg();
    const center=!!ctx.hdCenter;
    // --- Textes du ministere (tutelle) ---
    const hasMin=[cfg.minCountry,cfg.minMotto,cfg.minName,cfg.minDirection,cfg.minInspection].some(x=>x&&String(x).trim());
    const minTxt=(cfg.minCountry?`<p class="xs-min-pays">${escH(cfg.minCountry)}</p>`:'')
        + (cfg.minMotto?`<p class="xs-min-dev">${escH(cfg.minMotto)}</p>`:'')
        + (cfg.minName?`<p class="xs-min-l">${escH(cfg.minName)}</p>`:'')
        + (cfg.minDirection?`<p class="xs-min-l">${escH(cfg.minDirection)}</p>`:'')
        + (cfg.minInspection?`<p class="xs-min-l">${escH(cfg.minInspection)}</p>`:'');
    const minLogoTag=cfg.minLogo?`<img class="xs-min-logo" src="${cfg.minLogo}" alt="">`:'';
    // --- Textes de l'ecole ---
    const line2=[cfg.email,cfg.director?('Directeur : '+cfg.director):''].filter(Boolean).join(' · ');
    const ecoTxt=`<h1>${escH(sc.name||'Établissement')}</h1><p class="xs-sub">${escH(ctx.addr||'')}</p>${line2?`<p class="xs-sub2">${escH(line2)}</p>`:''}`;
    const ecoLogoTag=sc.logo?`<img class="xs-logo" src="${sc.logo}" alt="">`:'<div class="xs-logo xs-ph"></div>';
    // --- Disposition CENTREE : logo au milieu, textes centres a gauche / a droite ---
    if(center){
      const left='<div class="xs-c-min">'+minLogoTag+(hasMin?minTxt:'')+'</div>';
      const mid='<div class="xs-c-logo">'+ecoLogoTag+'</div>';
      const right='<div class="xs-c-eco"><div class="xs-eco-main">'+ecoTxt+'</div></div>';
      return '<div class="xs-hd3">'+left+mid+right+'</div>'
        + `<div class="xs-hd-yr"><span>Année scolaire ${escH(ctx.year||state.year||'')}</span></div>`;
    }
    // --- Disposition 2 colonnes par defaut (ministere a gauche, ecole a droite) ---
    const left = hasMin
      ? '<div class="xs-min">'+minLogoTag+'<div>'+minTxt+'</div></div>'
      : '<div class="xs-min"></div>';
    const right='<div class="xs-eco">'
      + ecoLogoTag
      + `<div class="xs-eco-main">${ecoTxt}</div>`
      + '</div>';
    return '<div class="xs-hd2">'+left+right+'</div>'
      + `<div class="xs-hd-yr"><span>Année scolaire ${escH(ctx.year||state.year||'')}</span></div>`;
  }
  // Pied de verification partage : code QR (charge utile complete) + code-barres
  // Code 128 (matricule) + bloc de signature. Rendu propre et sobre.
  function _verifFooterHTML(e,ctx,moy,perLabel){
    const sc=ctx.sc||{}, cfg=ctx.cfg||schoolCfg();
    const mat=e.mat||e.id||'';
    const qrPayload=[sc.name||'',mat,perLabel,(moy==null?'NA':fmtN(moy)),state.year].join('|');
    const qrTag=ctx.qr?ctx.qr(qrPayload,120):'';
    const bcTag=(typeof barcodeSVG==='function')?barcodeSVG(mat||'0'):'';
    const codes=`<div class="codes">`
      + (qrTag?`<div class="qr">${qrTag}</div>`:'')
      + (bcTag?`<div class="bc">${bcTag}<span class="bc-val">${escH(mat||'—')}</span></div>`:'')
      + `<span class="verif-note">Bulletin vérifiable · ${escH(perLabel)}</span></div>`;
    return `<div class="bottom">${codes}<div class="sign"><div>Le/la Titulaire</div><div>${escH(ctx.titulaire||cfg.director||'La Direction')}</div></div></div>`;
  }
  // Blocs communs (identite eleve + pied signature/QR + synthese annuelle)
  function _bulInfoHTML(e,cls){
    const en=e.enrollments&&e.enrollments.find(x=>x.year===state.year); const statut=en?en.statut:(e.statut||'');
    return `<table class="info"><tbody><tr><td class="k">Élève</td><td>${escH(stuName(e))}</td><td class="k">Matricule</td><td>${escH(e.mat||'–')}</td></tr><tr><td class="k">Classe</td><td>${escH(clsLabel(cls.id))}</td><td class="k">Statut</td><td>${escH(statut||'–')}</td></tr></tbody></table>`;
  }
  function _bulBottomHTML(e,ctx,moy,perLabel){
    return _verifFooterHTML(e,ctx,moy,perLabel);
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
    const ctx={cls:agg.cls,cfg,gmax,sc:{name:sc.name,logo:cfg.logo},addr,eff,qr:qrSVG,year:state.year,pers:agg.pers,hdCenter:true,titulaire:classTitulaireName(agg.cls,cfg)};
    let targets=agg.rows; if(onlyStu) targets=agg.rows.filter(r=>r.stu.id===onlyStu);
    if(!targets.length){toast('Aucun élève');return;}
    const build=agg.ptype==='semestre'?officielBlockSemestre:officielBlockTrimestre;
    const blocks=targets.map(r=>build(r,agg,ctx)).join('');
    const doc=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Bulletins annuels — ${escH(clsLabel(agg.cls.id))}</title><style>${bulletinCSS()}</style></head><body>${blocks}</body></html>`;
    openPrintPreview(doc);
  }
  // Ouvre un apercu (previsualisation) avant impression : fenetre avec barre d'outils
  // (Imprimer / Enregistrer en PDF, Fermer) masquee a l'impression. Pas d'impression auto.
  // Charge (une seule fois, a la demande) la librairie html2pdf dans la fenetre d'apercu.
  // Necessite une connexion la 1re fois ; sinon on retombe sur l'impression navigateur.
  function _ensureHtml2Pdf(w,cb){
    if(w.html2pdf){ cb(true); return; }
    let done=false; const fin=function(ok){ if(done) return; done=true; cb(ok); };
    try{
      const d=w.document; const s=d.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.2/dist/html2pdf.bundle.min.js';
      s.onload=function(){ fin(!!w.html2pdf); };
      s.onerror=function(){ fin(false); };
      d.head.appendChild(s);
      setTimeout(function(){ fin(!!w.html2pdf); },12000);
    }catch(e){ fin(false); }
  }
  // Telechargement PDF direct depuis la fenetre d'apercu (sans passer par la boîte d'impression).
  function _downloadPdf(w,bar,dl){
    const d=w.document;
    const base=((d.title||'document').replace(/[\\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim())||'document';
    const fname=base+'.pdf';
    const orig=dl.textContent; dl.disabled=true; dl.textContent='Préparation du PDF…';
    const restore=function(){ dl.disabled=false; dl.textContent=orig; };
    _ensureHtml2Pdf(w,function(ok){
      if(!ok||!w.html2pdf){ restore(); try{ w.alert('Téléchargement PDF indisponible (connexion internet requise la première fois). Utilise le bouton « Imprimer / Enregistrer en PDF ».'); }catch(e){} return; }
      const prev=bar.style.display; bar.style.display='none';
      const back=function(){ bar.style.display=prev; restore(); };
      const opt={ margin:0, filename:fname, image:{type:'jpeg',quality:0.98}, html2canvas:{scale:2,useCORS:true,backgroundColor:'#ffffff'}, jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}, pagebreak:{mode:['css','legacy']} };
      try{
        const p=w.html2pdf().set(opt).from(d.body).save();
        if(p&&p.then){ p.then(back).catch(function(){ back(); try{ w.focus(); w.print(); }catch(e){} }); }
        else { setTimeout(back,1500); }
      }catch(e){ back(); try{ w.focus(); w.print(); }catch(e){} }
    });
  }
  // Telechargement PDF 100% SERVEUR (WeasyPrint) : on renvoie le HTML d'origine de
  // l'apercu au backend qui fait la mise en page et renvoie le PDF (aucun navigateur,
  // aucune connexion CDN cote client).
  function _downloadPdfServer(w,bar,dl){
    const d=w.document;
    const base=((d.title||'document').replace(/[\\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim())||'document';
    const fname=base+'.pdf';
    const html=w.__xsDoc||('<!doctype html>'+d.documentElement.outerHTML);
    const orig=dl.textContent; dl.disabled=true; dl.textContent='Génération serveur…';
    const restore=function(){ dl.disabled=false; dl.textContent=orig; };
    if(typeof API==='undefined'||!API.enabled||!API.enabled()){ restore(); try{ w.alert('Génération PDF serveur indisponible : connecte-toi au serveur pour l\'utiliser.'); }catch(e){} return; }
    API.renderPdf(html,fname).then(function(blob){
      try{
        const url=w.URL.createObjectURL(blob);
        const a=d.createElement('a'); a.href=url; a.download=fname; d.body.appendChild(a); a.click();
        setTimeout(function(){ try{ w.URL.revokeObjectURL(url); a.remove(); }catch(e){} },4000);
      }catch(e){ try{ toast('PDF reçu mais téléchargement bloqué'); }catch(_){} }
      restore();
    }).catch(function(err){
      restore();
      const m=(err&&err.message)||'erreur';
      try{ w.alert('Génération PDF serveur impossible : '+m); }catch(e){}
      try{ toast('PDF serveur : '+m); }catch(e){}
    });
  }
  function openPrintPreview(doc){
    const w=window.open('','_blank'); if(!w){ toast('Autorise les fenêtres pop-up pour la prévisualisation'); return null; }
    w.document.open(); w.document.write(doc); w.document.close();
    try{ w.__xsDoc=doc; }catch(e){}
    try{
      const d=w.document;
      const st=d.createElement('style');
      st.textContent='#xs-print-bar{position:sticky;top:0;z-index:99999;display:flex;gap:10px;align-items:center;justify-content:center;padding:9px 14px;background:#0f172a;color:#fff;font-family:Arial,Helvetica,sans-serif;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,.3)}#xs-print-bar button{cursor:pointer;border:none;border-radius:6px;padding:8px 16px;font-size:13px;font-weight:600;font-family:inherit}#xs-print-bar button[disabled]{opacity:.6;cursor:progress}#xs-print-bar .xs-srv{background:#7c3aed;color:#fff}#xs-print-bar .xs-print{background:#2563eb;color:#fff}#xs-print-bar .xs-dl{background:#16a34a;color:#fff}#xs-print-bar .xs-close{background:#e2e8f0;color:#0f172a}#xs-print-bar .xs-hint{font-weight:400;color:#cbd5e1}@media print{#xs-print-bar{display:none!important}}';
      d.head.appendChild(st);
      const bar=d.createElement('div'); bar.id='xs-print-bar';
      const hint=d.createElement('span'); hint.className='xs-hint'; hint.textContent='Aperçu avant impression —';
      const srvOn=(typeof API!=='undefined'&&API.enabled&&API.enabled());
      let bsrv=null;
      if(srvOn){ bsrv=d.createElement('button'); bsrv.className='xs-srv'; bsrv.textContent='🗎 PDF (serveur)'; }
      const bdl=d.createElement('button'); bdl.className='xs-dl'; bdl.textContent='⬇️ Télécharger PDF';
      const bp=d.createElement('button'); bp.className='xs-print'; bp.textContent='🖨️ Imprimer / Enregistrer en PDF';
      const bc=d.createElement('button'); bc.className='xs-close'; bc.textContent='Fermer';
      bar.appendChild(hint); if(bsrv) bar.appendChild(bsrv); bar.appendChild(bdl); bar.appendChild(bp); bar.appendChild(bc);
      d.body.insertBefore(bar,d.body.firstChild);
      bp.addEventListener('click',function(){ try{ w.focus(); w.print(); }catch(e){} });
      bc.addEventListener('click',function(){ try{ w.close(); }catch(e){} });
      bdl.addEventListener('click',function(){ _downloadPdf(w,bar,bdl); });
      if(bsrv) bsrv.addEventListener('click',function(){ _downloadPdfServer(w,bar,bsrv); });
    }catch(e){}
    try{ w.focus(); }catch(e){}
    return w;
  }
  function printBulletins(clsId,per,onlyStu){
    const _cls0=getCls(clsId); if(!_cls0){toast('Classe introuvable');return;}
    const _cfg0=schoolCfg();
    const _pers0=periodList(cyclePeriodType(_cls0.cycle));
    // Modeles de bulletins reproduits d'apres les maquettes fournies (selecteur de modele).
    const _MODELS=['m_ci_trim','m_ci_sem','m_tg_trim','m_tg_sem'];
    if(_MODELS.indexOf(_cfg0.bulletinTpl)>=0){ return printBulletinsModel(clsId,per,onlyStu,_cfg0.bulletinTpl); }
    // Dernier sem./trim. => synthese annuelle complete (moyennes + rangs de toutes
    // les periodes), quel que soit le modele de bulletin choisi.
    if(per===_pers0[_pers0.length-1]){ return printBulletinsOfficiel(clsId,onlyStu); }
    const data=classBulletinData(clsId,per); if(!data.cls){toast('Classe introuvable');return;}
    const cfg=schoolCfg(), sc=activeSchool();
    const gmax=cfg.gradeMax||20; const eff=data.rows.length;
    const addr=(cfg.address||'')+(cfg.phone?' · '+cfg.phone:'');
    const ctx={cls:data.cls,per,cfg,gmax,sc:{name:sc.name,logo:cfg.logo},addr,eff,qr:qrSVG,fmt:bulletinFmtFor(data.cls.cycle),tpl:cfg.bulletinTpl||'standard',hdCenter:true,titulaire:classTitulaireName(data.cls,cfg)};
    let targets=data.rows; if(onlyStu) targets=data.rows.filter(r=>r.stu.id===onlyStu);
    if(!targets.length){toast('Aucun élève');return;}
    const blocks=targets.map(r=>bulletinBlockHTML(r,ctx)).join('');
    const css=bulletinCSS();
    const doc=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Bulletins — ${escH(clsLabel(data.cls.id))} — ${escH(per)}</title><style>${css}</style></head><body>${blocks}</body></html>`;
    openPrintPreview(doc);
  }
  // ===================================================================
  // ===== MODELES DE BULLETINS (reproduction des maquettes fournies) ==
  // ===================================================================
  function _teacherForSub(clsId,subId){ try{ if(typeof DB==='undefined'||!DB.teachers) return ''; const t=DB.teachers.find(t=>t.cls&&t.cls.indexOf(clsId)>=0&&t.subs&&t.subs.indexOf(subId)>=0); return t?teacName(t):''; }catch(e){ return ''; } }
  function _classStats(agg,pi){ const vals=agg.rows.map(o=>pi==null?o.annualMoy:(o.per[pi]?o.per[pi].moyGen:null)).filter(v=>v!=null); if(!vals.length) return {moy:null,min:null,max:null,n:0}; const s=vals.reduce((a,b)=>a+b,0); return {moy:avgRound(s/vals.length,agg.cfg),min:Math.min.apply(null,vals),max:Math.max.apply(null,vals),n:vals.length}; }
  function _grpBilan(o,subs,pred,pi){ let tp=0,tc=0; subs.forEach(({sub,coef})=>{ if(!pred(sub.dom)) return; const sj=o.subj[sub.id]; if(!sj) return; const m=(pi==null?sj.annual:sj.per[pi]); if(m!=null){ tp+=m*coef; tc+=coef; } }); return tc?avgRound(tp/tc,schoolCfg()):null; }
  function _domLitt(d){ return d==='litt'; }
  function _domSci(d){ return d==='sci'; }
  function _domAutre(d){ return d!=='sci'&&d!=='litt'; }
  function _stuFields(e){ const en=e.enrollments&&e.enrollments.find(x=>x.year===state.year); const statut=en?en.statut:(e.statut||''); return {nom:(e.nom||'').toUpperCase(),prenom:e.prenom||'',mat:e.mat||'',sexe:e.sexe||'',dob:e.dob||'',lieu:e.lieu||'',regime:e.st||'',statut:statut||'',redo:(statut==='Redoublant'?'Oui':'Non'),interne:(e.st==='Interne'?'Oui':'Non'),photo:e.photo||''}; }
  function _modCity(cfg){ const a=(cfg.address||'').trim(); if(!a) return ''; const parts=a.split(/[,/]/).map(s=>s.trim()).filter(Boolean); return parts.length?parts[parts.length-1]:a; }
  function _modToday(){ try{ return new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}); }catch(e){ return new Date().toLocaleDateString(); } }
  function _modMoy(n){ return n==null?'':fmtN(n); }
  function _modRk(v){ return v==null?'':(v+(v===1?'er':'ème')); }
  // Dispatcher : choisit le constructeur + la feuille de style du modele selectionne.
  function printBulletinsModel(clsId,per,onlyStu,tpl){
    const agg=classYearAgg(clsId); if(!agg||!agg.cls){toast('Classe introuvable');return;}
    const cfg=agg.cfg, sc=activeSchool();
    const gmax=cfg.gradeMax||20; const eff=agg.rows.length;
    let pi=agg.pers.indexOf(per); if(pi<0) pi=agg.pers.length-1;
    const ctx={cls:agg.cls,cfg,gmax,sc,eff,per,pi,pers:agg.pers,subs:agg.subs,agg,stats:_classStats(agg,pi),titulaire:classTitulaireName(agg.cls,cfg)};
    let targets=agg.rows; if(onlyStu) targets=agg.rows.filter(o=>o.stu.id===onlyStu);
    if(!targets.length){toast('Aucun élève');return;}
    const map={m_ci_trim:[modelBlockCItrim,modelCSS_ci_trim],m_ci_sem:[modelBlockCIsem,modelCSS_ci_sem],m_tg_trim:[modelBlockTGtrim,modelCSS_tg_trim],m_tg_sem:[modelBlockTGsem,modelCSS_tg_sem]};
    const pair=map[tpl]||map.m_ci_trim; const build=pair[0], css=pair[1];
    const blocks=targets.map(o=>build(o,ctx)).join('');
    const doc='<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Bulletins — '+escH(clsLabel(agg.cls.id))+'</title><style>'+css()+'</style></head><body>'+blocks+'</body></html>';
    openPrintPreview(doc);
  }
  // ----- Modele 1 : Cote d'Ivoire, bulletin TRIMESTRIEL (type Lycee Moderne 2 d'Abobo) -----
  function modelBlockCItrim(o,ctx){
    const {cfg,sc,eff,per,pi,subs,stats,gmax}=ctx; const e=o.stu; const f=_stuFields(e);
    const mv=_modMoy, rk=_modRk;
    const subRow=(sub,coef)=>{ const sj=o.subj[sub.id]; const m=sj?sj.per[pi]:null; const r=sj?sj.perRank[pi]:null; const mc=(m==null)?null:avgRound(m*coef,cfg); const prof=_teacherForSub(ctx.cls.id,sub.id); const app=m==null?'':mentionFor(m,cfg); return '<tr><td class="align-left">'+escH(sub.n)+'</td><td>'+(m==null?'nc':mv(m))+'</td><td>'+coef+'</td><td>'+(mc==null?'nc':mv(mc))+'</td><td>'+rk(r)+'</td><td class="align-left">'+escH(prof)+'</td><td class="align-left">'+escH(app)+'</td></tr>'; };
    const grp=(label,pred)=>{ const arr=subs.filter(s=>pred(s.sub.dom)); if(!arr.length) return ''; const bil=_grpBilan(o,subs,pred,pi); return arr.map(s=>subRow(s.sub,s.coef)).join('')+'<tr class="bilan-row"><td colspan="3">'+label+'</td><td colspan="4">'+(bil==null?'':mv(bil))+'</td></tr>'; };
    let tc=0,tp=0; subs.forEach(function(x){ const sj=o.subj[x.sub.id]; const m=sj?sj.per[pi]:null; if(m!=null){ tc+=x.coef; tp+=avgRound(m*x.coef,cfg); } });
    const body=grp('BILAN LETTRES',_domLitt)+grp('BILAN SCIENCES',_domSci)+grp('BILAN AUTRES',_domAutre);
    const pm=o.per[pi]||{moyGen:null,rank:null};
    const logo=cfg.logo?'<img src="'+cfg.logo+'" alt="logo" style="width:35px;height:35px;object-fit:cover;border-radius:50%;">':'<div class="logo-placeholder">LOGO</div>';
    return '<div class="page">'
      +'<div class="header-top"><div class="header-top-left">'+escH(cfg.minCountry||'')+(cfg.minName?('<br>'+escH(cfg.minName)):'')+'</div>'
      +'<div class="header-top-center"><h1>BULLETIN TRIMESTRIEL DE NOTES</h1><h2>'+escH(per)+'</h2></div>'
      +'<div class="header-top-right">ANNEE SCOLAIRE<br><strong>'+escH(state.year||'')+'</strong></div></div>'
      +'<div class="school-info-box"><div class="school-info-left">'+logo+'<div>Etablissement: <strong>'+escH(sc.name||'')+'</strong><br>Adresse : <strong>'+escH(cfg.address||'')+'</strong></div></div>'
      +'<div class="school-info-right">Code : <strong>'+escH(cfg.code||'')+'</strong> &nbsp;&nbsp; Statut : <strong>'+escH(cfg.statut||'')+'</strong><br>Téléphone : <strong>'+escH(cfg.phone||'')+'</strong> &nbsp; E-mail : '+escH(cfg.email||'')+'</div></div>'
      +'<div class="student-info-box"><div style="width:82%;"><div class="student-name">Nom : '+escH(f.nom)+'</div><div class="student-details-grid">'
      +'<div>Prénoms : <strong>'+escH(f.prenom)+'</strong></div><div>Sexe : '+escH(f.sexe)+'</div><div>Redoublant : '+escH(f.redo)+'</div>'
      +'<div>Matricule : <strong>'+escH(f.mat)+'</strong></div><div>Né le : '+escH(f.dob)+'</div><div>Régime : '+escH(f.regime)+'</div>'
      +'<div>Classe : <strong>'+escH(clsLabel(ctx.cls.id))+'</strong></div><div>Interne : '+escH(f.interne)+'</div><div></div>'
      +'<div>Effectif : <strong>'+eff+'</strong></div><div>Lieu de Naissance : '+escH(f.lieu)+'</div><div></div>'
      +'</div></div><div class="student-photo-container">'+(f.photo?'<img src="'+f.photo+'" alt="" style="width:100%;height:100%;object-fit:cover;">':'Photo')+'</div></div>'
      +'<table class="grades-table"><thead><tr><th style="width:26%;">DISCIPLINES</th><th style="width:7%;">Moy/20</th><th style="width:6%;">Coef</th><th style="width:8%;">Moy*Coef</th><th style="width:7%;">Rang</th><th style="width:25%;">NOM ET PRENOMS</th><th style="width:21%;">APPRECIATION SIGNATURE</th></tr></thead>'
      +'<tbody>'+body+'<tr class="totaux-row"><td class="align-left">TOTAUX TRIMESTRE :</td><td></td><td>'+tc+'</td><td>'+mv(tp)+'</td><td colspan="3"></td></tr></tbody></table>'
      +'<div class="bottom-grid"><div class="b-col-1"><div class="box-title">Assiduité</div>'
      +'<div class="p-2"><div class="assiduite-row"><span>Total heures</span> <span>Justifiées :</span></div><div class="assiduite-row" style="border-bottom:1px solid #ccc;padding-bottom:3px;margin-bottom:3px;"><span>d\'absence :</span> <span>Non justifiées :</span></div></div>'
      +'<div class="box-title" style="border-top:1px solid #000;">Mentions du Conseil de classe</div>'
      +'<div class="p-2"><div class="section-subtitle">DISTINCTIONS</div><div><span class="checkbox"></span> Tableau d\'honneur + Félicitations</div><div><span class="checkbox"></span> Tableau d\'honneur + Encouragements</div><div><span class="checkbox"></span> Tableau d\'honneur</div><div class="section-subtitle">SANCTIONS</div><div><span class="checkbox"></span> Avertissement travail</div><div><span class="checkbox"></span> Avertissement conduite</div><div><span class="checkbox"></span> Blâme Travail</div><div><span class="checkbox"></span> Blâme conduite</div></div></div>'
      +'<div class="b-col-2"><div class="box-title">Moyenne '+escH(per)+'</div>'
      +'<div style="text-align:center;padding:6px;font-weight:bold;font-size:11px;border-bottom:1px solid #000;">'+mv(pm.moyGen)+' <span style="font-size:8.5px;font-weight:normal;">/ '+gmax+'</span><br><span style="font-size:8.5px;font-weight:normal;">Rang : <strong>'+(pm.rank!=null?(rk(pm.rank)+' / '+eff):'—')+'</strong></span></div>'
      +'<div class="box-title" style="border-top:1px solid #000;">Appréciations du Conseil de classe</div><div style="height:60px;"></div>'
      +'<div style="text-align:center;font-size:8px;border-top:1px solid #000;border-bottom:1px solid #000;padding:3px;"><u>Nom /Signature du Professeur Principal</u><br><strong style="font-size:9px;margin-top:2px;display:inline-block;">'+escH(ctx.titulaire||cfg.profPrincipal||'')+'</strong></div></div>'
      +'<div class="b-col-3"><div class="box-title">Résultats de la classe</div>'
      +'<div class="p-2" style="border-bottom:1px solid #000;display:flex;justify-content:space-between;"><div>Moyenne générale<br>de la classe : <strong>'+mv(stats.moy)+'</strong></div><div>Moyenne mini : <strong>'+mv(stats.min)+'</strong><br>Moyenne maxi : <strong>'+mv(stats.max)+'</strong></div></div>'
      +'<div class="signature-area"><div style="font-size:8.5px;">'+escH(_modCity(cfg))+(_modCity(cfg)?', le ':'')+_modToday()+'</div><div style="font-weight:bold;font-size:9px;margin-top:2px;">LE PROVISEUR</div><div class="stamp-container"><div style="font-weight:bold;font-size:9px;color:#00008b;">'+escH(cfg.director||'')+'</div></div></div></div></div>'
      +'</div>';
  }
  function modelCSS_ci_trim(){
    return '*{box-sizing:border-box;margin:0;padding:0}'
      +'body{font-family:Arial,sans-serif;background:#e6e6e6;color:#000;padding:20px}'
      +'.page{background:#fff;width:210mm;min-height:297mm;margin:0 auto;padding:10mm 12mm;box-shadow:0 0 10px rgba(0,0,0,.2);border:1px solid #000;font-size:9.5px;page-break-after:always}.page:last-child{page-break-after:auto}'
      +'.header-top{display:flex;justify-content:space-between;align-items:flex-start;border:1px solid #000;padding:5px;font-weight:bold}'
      +'.header-top-left{font-size:8px;line-height:1.2;width:35%}'
      +'.header-top-center{text-align:center;width:40%;border-left:1px solid #000;border-right:1px solid #000;padding:0 5px;margin:-5px 0;display:flex;flex-direction:column;justify-content:center;min-height:40px}'
      +'.header-top-center h1{font-size:11px;font-weight:bold;text-transform:uppercase}.header-top-center h2{font-size:11px;font-weight:bold;margin-top:2px}'
      +'.header-top-right{text-align:right;font-size:8.5px;width:25%;line-height:1.3}'
      +'.school-info-box{border:1px solid #000;border-top:none;display:flex;justify-content:space-between;align-items:center;padding:4px 6px;font-size:8.5px}'
      +'.school-info-left{display:flex;align-items:center;gap:8px}'
      +'.logo-placeholder{width:35px;height:35px;border:1px dashed #666;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:7px;text-align:center}'
      +'.school-info-right{text-align:right;line-height:1.3}'
      +'.student-info-box{border:1px solid #000;border-top:none;display:flex;justify-content:space-between;padding:6px;background:#fafafa}'
      +'.student-name{font-size:11px;font-weight:bold;margin-bottom:3px}'
      +'.student-details-grid{display:flex;flex-wrap:wrap;font-size:9px}.student-details-grid>div{flex:0 0 33.33%;padding:1px 6px 1px 0;line-height:1.35}'
      +'.student-photo-container{width:65px;height:75px;border:1px solid #000;background:#e5e5e5;display:flex;align-items:center;justify-content:center;text-align:center;font-size:8px;overflow:hidden}'
      +'table.grades-table{width:100%;border-collapse:collapse;border:1px solid #000;border-top:none;font-size:9px}'
      +'table.grades-table th,table.grades-table td{border:1px solid #000;padding:2.5px 3px;text-align:center}'
      +'table.grades-table th{background:#e6e6e6;font-weight:bold;font-size:8.5px}'
      +'.align-left{text-align:left!important;padding-left:5px!important}'
      +'.bilan-row{background:#e0e0e0;font-weight:bold;text-align:left!important;padding-left:5px!important}'
      +'.totaux-row{background:#d0d0d0;font-weight:bold}'
      +'.bottom-grid{display:flex;border:1px solid #000;border-top:none}'
      +'.b-col-1{width:32%;border-right:1px solid #000;display:flex;flex-direction:column}'
      +'.b-col-2{width:38%;border-right:1px solid #000;display:flex;flex-direction:column}'
      +'.b-col-3{width:30%;display:flex;flex-direction:column}'
      +'.box-title{background:#e0e0e0;border-bottom:1px solid #000;text-align:center;font-weight:bold;padding:3px;font-size:8.5px}'
      +'.p-2{padding:4px;font-size:8.5px}'
      +'.assiduite-row{display:flex;justify-content:space-between;margin-bottom:2px}'
      +'.checkbox{width:9px;height:9px;border:1px solid #000;display:inline-block;vertical-align:middle;margin-right:4px}'
      +'.section-subtitle{font-weight:bold;font-size:8px;text-decoration:underline;margin-top:3px;margin-bottom:2px}'
      +'.signature-area{text-align:center;padding:5px;font-size:8.5px;flex-grow:1;display:flex;flex-direction:column;justify-content:space-between}'
      +'.stamp-container{margin-top:5px;text-align:center}'
      +'@page{size:A4 portrait;margin:0}'
      +'@media print{body{background:none;padding:0}.page{box-shadow:none;border:none;width:100%}}';
  }
  // ----- Modele 2 : Cote d'Ivoire, bulletin SEMESTRIEL (type College Moderne Kirmann, S1/S2 + annuel) -----
  function modelBlockCIsem(o,ctx){
    const {cfg,sc,eff,subs,stats,pi,per}=ctx; const e=o.stu; const f=_stuFields(e);
    const mv=_modMoy, rk=_modRk;
    const i1=0, i2=(ctx.pers.length>1?1:0);
    const subRow=(sub,coef)=>{ const sj=o.subj[sub.id]; const s1=sj?sj.per[i1]:null; const s2=(sj&&i2!==i1)?sj.per[i2]:null; const an=sj?sj.annual:null; const r=sj?sj.perRank[pi]:null; const ar=sj?sj.annualRank:null; const mc=an==null?null:avgRound(an*coef,cfg); const prof=_teacherForSub(ctx.cls.id,sub.id); const app=an==null?'':mentionFor(an,cfg); return '<tr><td class="align-left">'+escH(sub.n)+'</td><td>'+(s1==null?'':mv(s1))+'</td><td>'+(s2==null?'':mv(s2))+'</td><td>'+coef+'</td><td>'+(mc==null?'':mv(mc))+'</td><td>'+(r==null?'':rk(r))+'</td><td>'+(an==null?'':mv(an))+'</td><td>'+(ar==null?'':rk(ar))+'</td><td class="align-left">'+escH(prof)+'</td><td class="align-left">'+escH(app)+'</td></tr>'; };
    const grp=(label,pred)=>{ const arr=subs.filter(s=>pred(s.sub.dom)); if(!arr.length) return ''; const bil=_grpBilan(o,subs,pred,null); return arr.map(s=>subRow(s.sub,s.coef)).join('')+'<tr class="bilan-row"><td colspan="6">'+label+'</td><td colspan="4">'+(bil==null?'':mv(bil))+'</td></tr>'; };
    let tc=0,tp=0; subs.forEach(function(x){ const sj=o.subj[x.sub.id]; const an=sj?sj.annual:null; if(an!=null){ tc+=x.coef; tp+=avgRound(an*x.coef,cfg); } });
    const body=grp('BILAN LETTRES',_domLitt)+grp('BILAN SCIENCES',_domSci)+grp('BILAN AUTRES',_domAutre);
    const am=o.annualMoy, ar=o.annualRank;
    const logo=cfg.logo?'<img src="'+cfg.logo+'" alt="logo" style="width:55px;height:55px;object-fit:cover;border-radius:50%;">':'<div class="logo-ph">LOGO</div>';
    return '<div class="page">'
      +'<div class="header-box">'+logo+'<div class="header-titles"><div class="ht-country">'+escH(cfg.minCountry||'RÉPUBLIQUE')+'</div><div class="ht-school">'+escH(sc.name||'')+'</div><div class="ht-sub">'+escH(cfg.address||'')+(cfg.phone?(' — Tél : '+escH(cfg.phone)):'')+'</div><div class="ht-sub">Année scolaire : <strong>'+escH(state.year||'')+'</strong></div></div></div>'
      +'<div class="bulletin-title-banner">BULLETIN SEMESTRIEL — '+escH(per)+'</div>'
      +'<div class="student-grid"><div><span class="lbl">Nom &amp; Prénoms :</span> <strong>'+escH(f.nom)+' '+escH(f.prenom)+'</strong></div><div><span class="lbl">Matricule :</span> '+escH(f.mat)+'</div>'
      +'<div><span class="lbl">Classe :</span> <strong>'+escH(clsLabel(ctx.cls.id))+'</strong></div><div><span class="lbl">Effectif :</span> '+eff+'</div>'
      +'<div><span class="lbl">Sexe :</span> '+escH(f.sexe)+'</div><div><span class="lbl">Né(e) le :</span> '+escH(f.dob)+(f.lieu?(' à '+escH(f.lieu)):'')+'</div>'
      +'<div><span class="lbl">Régime :</span> '+escH(f.regime)+'</div><div><span class="lbl">Redoublant :</span> '+escH(f.redo)+'</div></div>'
      +'<table class="grades-table"><thead><tr><th style="width:21%;">Matière</th><th>M. S1</th><th>M. S2</th><th>Coef</th><th>M×Coef</th><th>Rang</th><th>M. An</th><th>Rg An</th><th style="width:17%;">Professeur</th><th style="width:16%;">Appréciation</th></tr></thead>'
      +'<tbody>'+body+'<tr class="totaux-row"><td class="align-left">TOTAUX</td><td></td><td></td><td>'+tc+'</td><td>'+mv(tp)+'</td><td colspan="5"></td></tr></tbody></table>'
      +'<div class="recap-grid"><div class="recap-box"><div class="recap-title">Moyenne annuelle</div><div class="recap-big">'+mv(am)+' <span>/ '+ctx.gmax+'</span></div><div class="recap-sub">Rang : <strong>'+(ar!=null?(rk(ar)+' / '+eff):'—')+'</strong></div></div>'
      +'<div class="recap-box"><div class="recap-title">Résultats de la classe</div><div class="recap-line">Moyenne de la classe : <strong>'+mv(stats.moy)+'</strong></div><div class="recap-line">Plus forte moyenne : <strong>'+mv(stats.max)+'</strong></div><div class="recap-line">Plus faible moyenne : <strong>'+mv(stats.min)+'</strong></div></div>'
      +'<div class="recap-box"><div class="recap-title">Appréciation générale</div><div class="recap-app">'+escH(am==null?'':mentionFor(am,cfg))+'</div></div></div>'
      +'<div class="signature-row"><div>'+escH(_modCity(cfg))+(_modCity(cfg)?', le ':'Le ')+_modToday()+'</div><div class="sig-right">Le Chef d\'établissement<br><strong>'+escH(cfg.director||'')+'</strong></div></div>'
      +'</div>';
  }
  function modelCSS_ci_sem(){
    return '*{box-sizing:border-box;margin:0;padding:0}'
      +'body{font-family:"Segoe UI",Arial,sans-serif;background:#e6e6e6;color:#1a1a1a;padding:20px}'
      +'.page{background:#fff;width:210mm;min-height:297mm;margin:0 auto;padding:12mm;box-shadow:0 0 10px rgba(0,0,0,.2);font-size:10px;page-break-after:always}.page:last-child{page-break-after:auto}'
      +'.header-box{display:flex;align-items:center;gap:14px;border-bottom:3px solid #0a6b3b;padding-bottom:8px}'
      +'.logo-ph{width:55px;height:55px;border:1px dashed #0a6b3b;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:8px;color:#0a6b3b}'
      +'.header-titles{flex:1}.ht-country{font-size:9px;letter-spacing:1px;color:#555;text-transform:uppercase}.ht-school{font-size:17px;font-weight:700;color:#0a6b3b}.ht-sub{font-size:9px;color:#444}'
      +'.bulletin-title-banner{background:#0a6b3b;color:#fff;text-align:center;font-weight:700;letter-spacing:1px;padding:7px;margin:10px 0;font-size:12px;border-radius:4px}'
      +'.student-grid{display:flex;flex-wrap:wrap;font-size:10px;border:1px solid #cdd;background:#f5faf7;padding:8px 10px;border-radius:4px}.student-grid>div{flex:0 0 50%;padding:2px 10px 2px 0}.student-grid .lbl{color:#0a6b3b;font-weight:600}'
      +'table.grades-table{width:100%;border-collapse:collapse;margin-top:10px;font-size:9px}'
      +'table.grades-table th,table.grades-table td{border:1px solid #bbb;padding:3px 4px;text-align:center}'
      +'table.grades-table th{background:#0a6b3b;color:#fff;font-weight:600;font-size:8.5px}'
      +'.align-left{text-align:left!important}'
      +'.bilan-row{background:#d9f0e4;font-weight:700;text-align:left!important}'
      +'.totaux-row{background:#b9e4cd;font-weight:700}'
      +'.recap-grid{display:flex;margin-top:12px}.recap-grid .recap-box{flex:1;margin-right:10px}.recap-grid .recap-box:last-child{margin-right:0}'
      +'.recap-box{border:1px solid #bbb;border-radius:5px;padding:8px;background:#f9fdfb}'
      +'.recap-title{font-weight:700;color:#0a6b3b;font-size:9.5px;border-bottom:1px solid #cde;padding-bottom:3px;margin-bottom:5px}'
      +'.recap-big{font-size:18px;font-weight:700;text-align:center;color:#0a6b3b}.recap-big span{font-size:10px;color:#777;font-weight:400}'
      +'.recap-sub{text-align:center;font-size:9px;margin-top:3px}.recap-line{font-size:9.5px;margin:2px 0}.recap-app{font-size:11px;font-weight:600;color:#0a6b3b;padding-top:4px}'
      +'.signature-row{display:flex;justify-content:space-between;margin-top:20px;font-size:10px}.sig-right{text-align:center}'
      +'@page{size:A4 portrait;margin:0}'
      +'@media print{body{background:none;padding:0}.page{box-shadow:none;width:100%}}';
  }
  // ----- Modele 3 : Togo, bulletin TRIMESTRIEL (type Lycee de Sokode, conseil + visas) -----
  function modelBlockTGtrim(o,ctx){
    const {cfg,sc,eff,subs,stats,pi,per,gmax}=ctx; const e=o.stu; const f=_stuFields(e);
    const mv=_modMoy, rk=_modRk;
    const subRow=(sub,coef)=>{ const sj=o.subj[sub.id]; const m=sj?sj.per[pi]:null; const r=sj?sj.perRank[pi]:null; const mc=m==null?null:avgRound(m*coef,cfg); const prof=_teacherForSub(ctx.cls.id,sub.id); const app=m==null?'':mentionFor(m,cfg); return '<tr><td class="align-left">'+escH(sub.n)+'</td><td>'+(m==null?'':mv(m))+'</td><td>'+coef+'</td><td>'+(mc==null?'':mv(mc))+'</td><td>'+(r==null?'':rk(r))+'</td><td class="align-left">'+escH(prof)+'</td><td class="align-left">'+escH(app)+'</td></tr>'; };
    const grp=(label,pred)=>{ const arr=subs.filter(s=>pred(s.sub.dom)); if(!arr.length) return ''; const bil=_grpBilan(o,subs,pred,pi); return arr.map(s=>subRow(s.sub,s.coef)).join('')+'<tr class="bilan-row"><td colspan="3">'+label+'</td><td colspan="4">'+(bil==null?'':mv(bil))+'</td></tr>'; };
    let tc=0,tp=0; subs.forEach(function(x){ const sj=o.subj[x.sub.id]; const m=sj?sj.per[pi]:null; if(m!=null){ tc+=x.coef; tp+=avgRound(m*x.coef,cfg); } });
    const body=grp('TOTAL LETTRES',_domLitt)+grp('TOTAL SCIENCES',_domSci)+grp('TOTAL AUTRES',_domAutre);
    const pm=o.per[pi]||{moyGen:null,rank:null};
    const logo=cfg.logo?'<img src="'+cfg.logo+'" alt="logo" style="width:60px;height:60px;object-fit:cover;">':'<div class="logo-ph">LOGO</div>';
    const city=_modCity(cfg)||'Sokodé';
    return '<div class="page">'
      +'<div class="tg-header"><div class="tg-h-left"><div class="tg-strong">'+escH(cfg.minName||'MINISTÈRE DES ENSEIGNEMENTS')+'</div><div>'+escH(sc.name||'')+'</div><div>'+escH(cfg.address||'')+'</div>'+(cfg.phone?('<div>Tél : '+escH(cfg.phone)+'</div>'):'')+'</div>'
      +'<div class="tg-h-center">'+logo+'</div>'
      +'<div class="tg-h-right"><div class="tg-strong">'+escH(cfg.minCountry||'RÉPUBLIQUE TOGOLAISE')+'</div><div class="tg-devise">Travail - Liberté - Patrie</div><div>Année : <strong>'+escH(state.year||'')+'</strong></div></div></div>'
      +'<div class="tg-title">BULLETIN DE NOTES — '+escH(per)+'</div>'
      +'<div class="tg-student"><div><strong>'+escH(f.nom)+' '+escH(f.prenom)+'</strong></div><div>Matricule : '+escH(f.mat)+'</div><div>Classe : <strong>'+escH(clsLabel(ctx.cls.id))+'</strong></div><div>Effectif : '+eff+'</div><div>Sexe : '+escH(f.sexe)+'</div><div>Né(e) le : '+escH(f.dob)+(f.lieu?(' à '+escH(f.lieu)):'')+'</div><div>Régime : '+escH(f.regime)+'</div><div>Redoublant : '+escH(f.redo)+'</div></div>'
      +'<table class="grades-table"><thead><tr><th style="width:28%;">DISCIPLINES</th><th>Moy/'+gmax+'</th><th>Coef</th><th>Moy×Coef</th><th>Rang</th><th style="width:22%;">Professeur</th><th style="width:20%;">Appréciation</th></tr></thead>'
      +'<tbody>'+body+'<tr class="totaux-row"><td class="align-left">TOTAUX</td><td></td><td>'+tc+'</td><td>'+mv(tp)+'</td><td colspan="3"></td></tr></tbody></table>'
      +'<div class="tg-recap"><table class="trimestre-table"><tr><th>Moyenne du '+escH(per)+'</th><td class="big">'+mv(pm.moyGen)+' / '+gmax+'</td></tr><tr><th>Rang</th><td>'+(pm.rank!=null?(rk(pm.rank)+' / '+eff):'—')+'</td></tr><tr><th>Appréciation</th><td>'+escH(pm.moyGen==null?'':mentionFor(pm.moyGen,cfg))+'</td></tr></table>'
      +'<table class="stats-table"><tr><th>Plus forte moyenne</th><td>'+mv(stats.max)+'</td></tr><tr><th>Plus faible moyenne</th><td>'+mv(stats.min)+'</td></tr><tr><th>Moyenne de la classe</th><td>'+mv(stats.moy)+'</td></tr></table></div>'
      +'<div class="tg-conseil"><div class="tg-conseil-col"><div class="tg-conseil-title">DISTINCTIONS</div><div><span class="checkbox"></span> Félicitations</div><div><span class="checkbox"></span> Encouragements</div><div><span class="checkbox"></span> Tableau d\'honneur</div></div>'
      +'<div class="tg-conseil-col"><div class="tg-conseil-title">SANCTIONS</div><div><span class="checkbox"></span> Avertissement (travail)</div><div><span class="checkbox"></span> Avertissement (conduite)</div><div><span class="checkbox"></span> Blâme</div></div></div>'
      +'<div class="tg-visas"><div class="tg-visa">Le Professeur Titulaire<div class="tg-visa-name">'+escH(ctx.titulaire||cfg.profPrincipal||'')+'</div></div><div class="tg-visa">Fait à '+escH(city)+', le '+_modToday()+'<br>Le Directeur<div class="tg-visa-name">'+escH(cfg.director||'')+'</div></div></div>'
      +'</div>';
  }
  function modelCSS_tg_trim(){
    return '*{box-sizing:border-box;margin:0;padding:0}'
      +'body{font-family:Arial,Helvetica,sans-serif;background:#e6e6e6;color:#111;padding:20px}'
      +'.page{background:#fff;width:210mm;min-height:297mm;margin:0 auto;padding:12mm;box-shadow:0 0 10px rgba(0,0,0,.2);font-size:10px;page-break-after:always}.page:last-child{page-break-after:auto}'
      +'.tg-header{display:flex;justify-content:space-between;align-items:flex-start;text-align:center;font-size:9px;line-height:1.35}'
      +'.tg-h-left,.tg-h-right{width:34%}.tg-h-center{width:22%;display:flex;justify-content:center}'
      +'.logo-ph{width:60px;height:60px;border:1px dashed #666;display:flex;align-items:center;justify-content:center;font-size:8px}'
      +'.tg-strong{font-weight:700;text-transform:uppercase}.tg-devise{font-style:italic;font-size:8.5px}'
      +'.tg-title{text-align:center;font-weight:700;font-size:13px;letter-spacing:1px;margin:12px 0 8px;padding:5px;border-top:2px solid #111;border-bottom:2px solid #111}'
      +'.tg-student{display:flex;flex-wrap:wrap;font-size:9.5px;border:1px solid #111;padding:7px;margin-bottom:8px}.tg-student>div{flex:0 0 25%;padding:2px 10px 2px 0}'
      +'table.grades-table{width:100%;border-collapse:collapse;font-size:9px}'
      +'table.grades-table th,table.grades-table td{border:1px solid #111;padding:2.5px 3px;text-align:center}'
      +'table.grades-table th{background:#d9d9d9;font-weight:700;font-size:8.5px}'
      +'.align-left{text-align:left!important;padding-left:5px!important}'
      +'.bilan-row{background:#ededed;font-weight:700;text-align:left!important}'
      +'.totaux-row{background:#cfcfcf;font-weight:700}'
      +'.tg-recap{display:flex;gap:12px;margin-top:10px}'
      +'.trimestre-table,.stats-table{border-collapse:collapse;font-size:9.5px;flex:1}'
      +'.trimestre-table th,.trimestre-table td,.stats-table th,.stats-table td{border:1px solid #111;padding:4px 6px}'
      +'.trimestre-table th,.stats-table th{background:#d9d9d9;text-align:left;font-weight:700}'
      +'.trimestre-table td,.stats-table td{text-align:center}'
      +'.trimestre-table .big{font-size:13px;font-weight:700}'
      +'.tg-conseil{display:flex;gap:14px;margin-top:10px;border:1px solid #111;padding:8px}'
      +'.tg-conseil-col{flex:1;font-size:9.5px}.tg-conseil-title{font-weight:700;text-decoration:underline;margin-bottom:4px}'
      +'.checkbox{width:10px;height:10px;border:1px solid #111;display:inline-block;margin-right:5px;vertical-align:middle}'
      +'.tg-visas{display:flex;justify-content:space-between;margin-top:22px;font-size:9.5px;text-align:center}'
      +'.tg-visa{width:45%}.tg-visa-name{margin-top:28px;font-weight:700;color:#00008b}'
      +'@page{size:A4 portrait;margin:0}'
      +'@media print{body{background:none;padding:0}.page{box-shadow:none;width:100%}}';
  }
  // ----- Modele 4 : Togo, bulletin SEMESTRIEL (type Complexe La Fabienne, serif bleu, pointilles) -----
  function modelBlockTGsem(o,ctx){
    const {cfg,sc,eff,subs,stats,pi,per,gmax}=ctx; const e=o.stu; const f=_stuFields(e);
    const mv=_modMoy, rk=_modRk;
    const i1=0, i2=(ctx.pers.length>1?1:0);
    const subRow=(sub,coef)=>{ const sj=o.subj[sub.id]; const s1=sj?sj.per[i1]:null; const s2=(sj&&i2!==i1)?sj.per[i2]:null; const an=sj?sj.annual:null; const ar=sj?sj.annualRank:null; const prod=an==null?null:avgRound(an*coef,cfg); const prof=_teacherForSub(ctx.cls.id,sub.id); const app=an==null?'':mentionFor(an,cfg); return '<tr><td class="align-left">'+escH(sub.n)+'</td><td>'+(s1==null?'':mv(s1))+'</td><td>'+(s2==null?'':mv(s2))+'</td><td>'+(an==null?'':mv(an))+'</td><td>'+coef+'</td><td>'+(prod==null?'':mv(prod))+'</td><td>'+(ar==null?'':rk(ar))+'</td><td class="align-left">'+escH(prof)+'</td><td class="align-left">'+escH(app)+'</td></tr>'; };
    const grp=(label,pred)=>{ const arr=subs.filter(s=>pred(s.sub.dom)); if(!arr.length) return ''; const bil=_grpBilan(o,subs,pred,null); return arr.map(s=>subRow(s.sub,s.coef)).join('')+'<tr class="bilan-row"><td colspan="5">'+label+'</td><td colspan="4">'+(bil==null?'':mv(bil))+'</td></tr>'; };
    let tc=0,tp=0; subs.forEach(function(x){ const sj=o.subj[x.sub.id]; const an=sj?sj.annual:null; if(an!=null){ tc+=x.coef; tp+=avgRound(an*x.coef,cfg); } });
    const body=grp('BILAN LETTRES',_domLitt)+grp('BILAN SCIENCES',_domSci)+grp('BILAN AUTRES',_domAutre);
    const am=o.annualMoy, ar=o.annualRank;
    const logo=cfg.logo?'<img src="'+cfg.logo+'" alt="logo" style="width:62px;height:62px;object-fit:cover;">':'<div class="logo-ph">LOGO</div>';
    const city=_modCity(cfg)||'Lomé';
    return '<div class="page">'
      +'<div class="fab-header"><div class="fab-h-side"><div class="fab-strong">'+escH(cfg.minName||'MINISTÈRE DES ENSEIGNEMENTS')+'</div><div>'+escH(sc.name||'')+'</div><div>'+escH(cfg.address||'')+'</div>'+(cfg.phone?('<div>Tél : '+escH(cfg.phone)+'</div>'):'')+'</div>'
      +'<div class="fab-h-logo">'+logo+'</div>'
      +'<div class="fab-h-side fab-h-right"><div class="fab-strong">'+escH(cfg.minCountry||'RÉPUBLIQUE TOGOLAISE')+'</div><div class="fab-devise">Travail - Liberté - Patrie</div><div>Année scolaire '+escH(state.year||'')+'</div></div></div>'
      +'<div class="fab-title">BULLETIN SEMESTRIEL — '+escH(per)+'</div>'
      +'<div class="fab-student"><div class="fab-line"><span>Nom &amp; Prénoms :</span> <strong>'+escH(f.nom)+' '+escH(f.prenom)+'</strong></div>'
      +'<div class="fab-two"><div class="fab-line"><span>Classe :</span> <strong>'+escH(clsLabel(ctx.cls.id))+'</strong></div><div class="fab-line"><span>Effectif :</span> '+eff+'</div></div>'
      +'<div class="fab-two"><div class="fab-line"><span>Matricule :</span> '+escH(f.mat)+'</div><div class="fab-line"><span>Sexe :</span> '+escH(f.sexe)+'</div></div>'
      +'<div class="fab-two"><div class="fab-line"><span>Né(e) le :</span> '+escH(f.dob)+(f.lieu?(' à '+escH(f.lieu)):'')+'</div><div class="fab-line"><span>Régime :</span> '+escH(f.regime)+'</div></div></div>'
      +'<table class="grades-table"><thead><tr><th style="width:22%;">Discipline</th><th>Moy 1<sup>er</sup> Sem.</th><th>Moy 2<sup>e</sup> Sem.</th><th>Moy. An.</th><th>Coef</th><th>Moy×Coef</th><th>Rang</th><th style="width:17%;">Professeur</th><th style="width:16%;">Appréciation</th></tr></thead>'
      +'<tbody>'+body+'<tr class="totaux-row"><td class="align-left">TOTAUX</td><td></td><td></td><td></td><td>'+tc+'</td><td>'+mv(tp)+'</td><td colspan="3"></td></tr></tbody></table>'
      +'<div class="fab-recap"><div class="fab-recap-line">Moyenne annuelle : <strong>'+mv(am)+' / '+gmax+'</strong> &nbsp;&nbsp;&middot;&nbsp;&nbsp; Rang : <strong>'+(ar!=null?(rk(ar)+' / '+eff):'—')+'</strong></div>'
      +'<div class="fab-recap-line">Moyenne de la classe : <strong>'+mv(stats.moy)+'</strong> &nbsp;&middot;&nbsp; Plus forte : <strong>'+mv(stats.max)+'</strong> &nbsp;&middot;&nbsp; Plus faible : <strong>'+mv(stats.min)+'</strong></div>'
      +'<div class="fab-recap-line">Appréciation du conseil : <strong>'+escH(am==null?'':mentionFor(am,cfg))+'</strong></div></div>'
      +'<div class="fab-sign"><div class="fab-sign-col">Le Professeur Principal<div class="fab-dots"></div><div class="fab-name">'+escH(ctx.titulaire||cfg.profPrincipal||'')+'</div></div>'
      +'<div class="fab-sign-col">Fait à '+escH(city)+', le '+_modToday()+'<br>Le Directeur<div class="fab-dots"></div><div class="fab-name">'+escH(cfg.director||'')+'</div></div></div>'
      +'</div>';
  }
  function modelCSS_tg_sem(){
    return '*{box-sizing:border-box;margin:0;padding:0}'
      +'body{font-family:"Times New Roman",Georgia,serif;background:#e6e6e6;color:#111;padding:20px}'
      +'.page{background:#fff;width:210mm;min-height:297mm;margin:0 auto;padding:13mm;box-shadow:0 0 10px rgba(0,0,0,.2);font-size:11px;page-break-after:always}.page:last-child{page-break-after:auto}'
      +'.fab-header{display:flex;justify-content:space-between;align-items:flex-start;text-align:center;font-size:10px;line-height:1.4}'
      +'.fab-h-side{width:36%}.fab-h-right{text-align:center}.fab-h-logo{width:24%;display:flex;justify-content:center}'
      +'.logo-ph{width:62px;height:62px;border:1px dashed #00008b;display:flex;align-items:center;justify-content:center;font-size:8px;color:#00008b}'
      +'.fab-strong{font-weight:700;text-transform:uppercase}.fab-devise{font-style:italic}'
      +'.fab-title{text-align:center;font-weight:700;font-size:16px;color:#00008b;letter-spacing:1px;margin:14px 0 10px;border-top:2px solid #00008b;border-bottom:2px solid #00008b;padding:6px}'
      +'.fab-student{font-size:11px;margin-bottom:10px}.fab-line span{color:#00008b}.fab-line{border-bottom:1px dotted #555;padding:2px 0}.fab-two{display:flex;gap:30px}.fab-two .fab-line{flex:1}'
      +'table.grades-table{width:100%;border-collapse:collapse;font-size:10px}'
      +'table.grades-table th,table.grades-table td{border:1px solid #00008b;padding:3px 4px;text-align:center}'
      +'table.grades-table th{background:#e7e9f5;color:#00008b;font-weight:700;font-size:9px}'
      +'.align-left{text-align:left!important;padding-left:5px!important}'
      +'.bilan-row{background:#eef0fa;font-weight:700;text-align:left!important;color:#00008b}'
      +'.totaux-row{background:#dfe2f3;font-weight:700}'
      +'.fab-recap{margin-top:12px;border:1px solid #00008b;padding:9px 11px;font-size:11px}.fab-recap-line{padding:2px 0;border-bottom:1px dotted #99a}.fab-recap-line:last-child{border-bottom:none}'
      +'.fab-sign{display:flex;justify-content:space-between;margin-top:26px;font-size:11px;text-align:center}.fab-sign-col{width:45%}'
      +'.fab-dots{border-bottom:1px dotted #333;height:34px;margin:4px 8px 0}.fab-name{font-weight:700;color:#00008b;margin-top:3px}'
      +'@page{size:A4 portrait;margin:0}'
      +'@media print{body{background:none;padding:0}.page{box-shadow:none;width:100%}}';
  }
  // Resout l'eleve a afficher dans les vues Eleve/Parent (bulletin, presence, frais).
  // - Mode connecte (apiOn) : la vraie fiche de l'eleve connecte via currentStudent().
  //   Si le compte n'a pas de fiche liee -> null (on n'expose JAMAIS un autre eleve).
  // - Mode demo / hors-ligne : correspondance par nom, sinon 1er eleve avec classe.
  function studentForView(){
    let me = (typeof currentStudent==='function') ? currentStudent() : null;
    if(me) return me;
    if(typeof apiOn==='function' && apiOn()) return null;
    const yrStuds=studentsOfYear(state.year);
    const who=(sessionUserName()||'').trim().toLowerCase();
    let m = who ? DB.students.find(e=>stuName(e).toLowerCase()===who) : null;
    if(!m) m = yrStuds.find(e=>clsOfYear(e,state.year)) || yrStuds[0] || null;
    return m;
  }
  // Encart affiche quand un compte connecte n'a aucune fiche eleve associee.
  function noStudentCard(){
    return `<div class="rounded-2xl p-4 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 text-sm font-semibold card-in flex items-center gap-2">${svg_(I.shield)} Aucune fiche élève n'est associée à ce compte. Contacte l'administration de l'établissement.</div>`;
  }
  // Vérification de cohérence année / classe pour le bulletin élève.
  // Rend un « chip » par année suggérée (bouton data-setyear) pour basculer vite.
  function _yearChips(ys,tone){
    const c=tone==='rose'
      ? 'border-rose-300 dark:border-rose-500/30 text-rose-700 dark:text-rose-200'
      : 'border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-200';
    return (ys||[]).filter(y=>y!==state.year).map(y=>`<button data-setyear="${escH(y)}" class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/70 dark:bg-slate-900/40 border ${c} active:scale-95 transition">→ ${escH(y)}</button>`).join('');
  }
  // Bannière affichée quand l'élève a bien une classe cette année mais qu'aucune
  // note n'y est enregistrée alors qu'une autre année en contient (cas le plus
  // fréquent de « bulletin vide » : mauvaise année scolaire sélectionnée).
  function yearCoherenceBanner(me){
    if(!me) return '';
    const grYears=(typeof studentGradeYears==='function')?studentGradeYears(me):[];
    if(grYears.includes(state.year) || !grYears.length) return '';
    return `<div class="rounded-2xl p-4 mt-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 shadow-soft card-in">
      <div class="flex items-start gap-3"><span class="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300 grid place-items-center shrink-0">${svg(I.bell)}</span>
      <div class="flex-1 min-w-0"><p class="text-sm font-bold text-amber-700 dark:text-amber-200">Aucune note pour l'année ${escH(state.year)}</p>
      <p class="text-[11px] text-amber-600/80 dark:text-amber-300/80">Des notes existent pour une autre année scolaire. Sélectionne l'année concernée pour les consulter.</p>
      <div class="flex flex-wrap gap-1.5 mt-2">${_yearChips(grYears,'amber')}</div></div></div></div>`;
  }
  function bulletin(){
    // Vue élève / parent : TOUTES les notes de l'élève, matière par matière, pour la période choisie.
    const me=studentForView();
    if(!me) return noStudentCard();
    const clsId=clsOfYear(me,state.year);
    if(!clsId){
      // Incohérence année/classe : l'élève n'est pas inscrit (avec classe) pour
      // l'année sélectionnée. On propose les années où il a une classe et/ou des notes.
      const clsYears=(typeof studentClassYears==='function')?studentClassYears(me):[];
      const grYears=(typeof studentGradeYears==='function')?studentGradeYears(me):[];
      const sugg=YEARS.filter(y=>y!==state.year&&(clsYears.includes(y)||grYears.includes(y)));
      const chips=sugg.length?`<div class="flex flex-wrap gap-1.5 mt-3">${_yearChips(sugg,'rose')}</div>
          <p class="text-[11px] text-rose-600/70 dark:text-rose-300/70 mt-2">Année(s) avec une classe ou des notes pour ${escH(stuName(me))}.</p>`:'';
      return `<div class="rounded-2xl p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 shadow-soft card-in">
        <div class="flex items-start gap-3"><span class="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300 grid place-items-center shrink-0">${svg(I.shield)}</span>
        <div class="flex-1 min-w-0"><p class="text-sm font-bold text-rose-700 dark:text-rose-200">${escH(stuName(me))} n'est affecté(e) à aucune classe pour ${escH(state.year)}</p>
        <p class="text-[11px] text-rose-600/80 dark:text-rose-300/80">Vérifie l'année scolaire sélectionnée : le bulletin se construit à partir de la classe de l'élève pour cette année-là.</p>
        ${chips}</div></div></div>`;
    }
    const cls=getCls(clsId);
    const ptype=cyclePeriodType(cls.cycle), pers=periodList(ptype);
    // Période affichée : tant que l'élève n'a pas choisi, on ouvre sur la 1ère
    // période qui contient effectivement des notes pour lui (sinon le bulletin
    // s'ouvrait toujours sur le 1er trimestre, souvent vide, donc « aucune note »).
    const perHasGrades=p=>{ const _ks=state.year+'|'+cls.id+'|'; let ok=false;
      for(const k in GRADES){ if(k.indexOf(_ks)!==0) continue; if(k.split('|')[3]!==p) continue; const cell=GRADES[k][me.id]; if(cell&&moyenne(cell)!=null){ ok=true; break; } } return ok; };
    if(!state.stuGrPeriodSet){ const idx=pers.findIndex(perHasGrades); state.stuGrPeriod=idx>=0?idx:0; }
    if(state.stuGrPeriod==null||state.stuGrPeriod>=pers.length) state.stuGrPeriod=0;
    const per=pers[state.stuGrPeriod];
    const gmax=schoolCfg().gradeMax||20;
    let subs=DB.program.filter(p=>p.cls===cls.id).map(p=>({sub:getSub(p.sub),coef:p.coef})).filter(x=>x.sub);
    if(!subs.length) subs=DB.subjects.map(s=>({sub:s,coef:1}));
    const sh=v=>(v===''||v==null?'—':v);
    let totPts=0, totCoef=0;
    const rows=subs.map((x,i)=>{
      const store=gGet(cls.id,x.sub.id,per);
      const g=store[me.id]||{i:'',d:'',c:''};
      const m=moyenne(g), k=noteCoef(g,x.coef);
      if(m!=null){ totPts+=k; totCoef+=x.coef; }
      return `<div class="grid grid-cols-[2fr_.7fr_.7fr_.7fr_.8fr_.8fr_.6fr_.8fr] gap-1 items-center text-sm px-2 py-1.5 min-w-[720px] ${i%2?'bg-white dark:bg-slate-900':'bg-slate-50 dark:bg-slate-900/60'}">
          <div class="font-semibold truncate pr-1">${escH(x.sub.n)}</div>
          <div class="text-center text-xs text-slate-500 dark:text-slate-400">${sh(g.i)}</div>
          <div class="text-center text-xs text-slate-500 dark:text-slate-400">${sh(g.d)}</div>
          <div class="text-center text-xs text-slate-500 dark:text-slate-400">${sh(g.c)}</div>
          <div class="text-center text-xs font-semibold text-slate-600 dark:text-slate-300">${fmtN(moyClasse(g))}</div>
          <div class="text-center font-bold text-brand-600">${fmtN(m)}</div>
          <div class="text-center text-xs text-slate-500 dark:text-slate-400">${x.coef}</div>
          <div class="text-center text-xs font-extrabold text-slate-700 dark:text-slate-200">${fmtN(k)}</div>
        </div>`;
    }).join('')||'<div class="px-3 py-6 text-center text-sm text-slate-400">Aucune matière au programme.</div>';
    const moyGen = totCoef ? totPts/totCoef : null;
    const perSel=`<select id="stu_per" class="${MGIN}">`+pers.map((p,idx)=>`<option value="${idx}"${idx===state.stuGrPeriod?' selected':''}>${p}</option>`).join('')+`</select>`;
    return `<div class="rounded-2xl p-3 bg-brand-50 dark:bg-slate-900 text-brand-700 dark:text-brand-300 text-xs font-semibold card-in flex items-center gap-2">${svg_(I.book)} ${escH(stuName(me))} — ${escH(clsLabel(cls.id))} · ${escH(cls.cycle)} · ${escH(state.year)}</div>`
      + yearCoherenceBanner(me)
      + `<div class="mt-3 card-in"><label class="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Période</label>${perSel}</div>`
      + section('Mes notes · '+per)
      + `<div class="rounded-2xl overflow-x-auto shadow-soft card-in">
          <div class="grid grid-cols-[2fr_.7fr_.7fr_.7fr_.8fr_.8fr_.6fr_.8fr] gap-1 bg-slate-800 text-white text-[11px] font-bold px-2 py-2 min-w-[720px]"><div>Matière</div><div class="text-center">Interro</div><div class="text-center">Devoir</div><div class="text-center">Compo</div><div class="text-center">Moy. cl.</div><div class="text-center">Moy.</div><div class="text-center">Coef</div><div class="text-center">N. coef</div></div>
          ${rows}
          <div class="grid grid-cols-[2fr_.7fr_.7fr_.7fr_.8fr_.8fr_.6fr_.8fr] gap-1 items-center text-sm px-2 py-2 bg-brand-50 dark:bg-brand-500/10 font-bold text-brand-700 dark:text-brand-300"><div class="col-span-5">Moyenne générale (pondérée par coef)</div><div class="text-center text-brand-600">${fmtN(moyGen)}</div><div></div><div></div></div>
        </div>`
      + `<p class="text-[11px] text-slate-400 mt-2">💡 <strong>Moy. cl.</strong> = (Interro + Devoir) ÷ 2 · <strong>Moy.</strong> = (Compo + Moy. cl.) ÷ 2 · <strong>N. coef</strong> = Moy. × coef. Notes sur ${gmax}. La moyenne générale est pondérée par les coefficients.</p>`;
  }
  function wireBulletin(){
    const main=$('#main');
    // Mode connecte : les notes ne sont PAS chargées au démarrage (hydratation
    // à la demande). Le bulletin de l'élève doit donc récupérer ses notes via
    // l'API pour la classe + la période affichée, matiere par matiere, puis
    // rafraîchir la vue une fois chargées (sans quoi le bulletin reste vide).
    // Espace eleve : ses notes sont deja chargees via /me/overview. On NE
    // rappelle PAS l'endpoint staff /grades ici (staffApiOn => faux pour un
    // eleve), pour ne pas generer de 403 ni polluer le journal de securite.
    if(typeof staffApiOn==='function'&&staffApiOn()){
      const me=(typeof studentForView==='function')?studentForView():null;
      const clsId=me?clsOfYear(me,state.year):null;
      const cls=clsId?getCls(clsId):null;
      if(cls){
        const ptype=cyclePeriodType(cls.cycle), pers=periodList(ptype);
        let subs=DB.program.filter(p=>p.cls===cls.id).map(p=>p.sub);
        if(!subs.length) subs=DB.subjects.map(s=>s.id);
        window._xsLoaded=window._xsLoaded||{};
        const jobs=[];
        // On charge toutes les périodes x matieres : indispensable pour ouvrir
        // automatiquement la bonne période et basculer sans latence.
        pers.forEach(per=>{ subs.forEach(sb=>{ const key='gr:'+state.year+':'+cls.id+':'+sb+':'+per;
          if(!window._xsLoaded[key]){ window._xsLoaded[key]=true; jobs.push(hydrateGradesApi(cls.id,sb,per)); } }); });
        if(jobs.length) Promise.all(jobs).then(res=>{ if(res.some(Boolean)) renderView(); });
      }
    }
    const ps=main.querySelector('#stu_per'); if(ps) ps.addEventListener('change',()=>{ state.stuGrPeriod=+ps.value; state.stuGrPeriodSet=true; renderView(); });
    // Consultation seule : l'élève ne peut pas télécharger / imprimer son bulletin.
  }
  // ---------- VUE ÉLÈVE / PARENT : FRAIS DE SCOLARITÉ ----------
  function fees(){
    // Situation PROPRE a l'eleve connecte : du annuel (bareme cycle), paye, reste.
    const me=studentForView();
    if(!me) return noStudentCard();
    const clsId=clsOfYear(me,state.year);
    if(!clsId) return `<div class="rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft card-in text-sm text-slate-500">${escH(stuName(me))} n'est affecté(e) à aucune classe pour ${escH(state.year)}.</div>`;
    const online=(typeof apiOn==='function'&&apiOn());
    const info=studentFeeInfo(me,state.year); const cls=info.cls;
    const solde=info.due>0;
    const pays=studentPayments(me,state.year);
    // Tranches : on affiche le statut (payee / en cours / a venir) a partir du total paye.
    let running=info.paid;
    const trNames=['1ère tranche (inscription)','2e tranche','3e tranche (solde)'];
    const trRows=info.tranches.map((amt,i)=>{
      const covered=Math.max(0,Math.min(amt,running)); running-=covered;
      const done=covered>=amt-1, part=covered>0&&!done;
      const st=done?['Réglée','emerald']:part?['Partielle','amber']:['À venir','slate'];
      return `<div class="flex items-center justify-between gap-3 px-3 py-2.5 ${i%2?'bg-white dark:bg-slate-900':'bg-slate-50 dark:bg-slate-900/60'}">
          <div class="min-w-0"><p class="text-sm font-semibold truncate">${trNames[i]}</p><p class="text-[11px] text-slate-500">${fmtMoney(amt)} FCFA</p></div>
          ${badge(st[0],'bg-'+st[1]+'-100 text-'+st[1]+'-700 dark:bg-'+st[1]+'-500/15 dark:text-'+st[1]+'-300')}
        </div>`;
    }).join('');
    const recus=pays.length?pays.map(p=>{
      const bank=payIsBank(p.mode);
      const sub=[payModeLabel(p.mode),p.date]; if(bank&&p.ref) sub.push('bord. '+p.ref); if(bank&&p.bank) sub.push(p.bank);
      return row('<div class="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300 p-2">'+svg(I.cash)+'</div>',
        `<p class="text-sm font-semibold">${fmtMoney(p.amount)} FCFA</p><p class="text-xs text-slate-500">${escH(sub.join(' · '))}</p>`,
        `<span class="text-[11px] font-bold text-slate-400">reçu ${escH(p.recu||'')}</span>`);
    }).join(''):'<div class="p-4 text-sm text-slate-400">Aucun paiement enregistré pour le moment.</div>';
    const head=`<div class="rounded-2xl p-3 bg-brand-50 dark:bg-slate-900 text-brand-700 dark:text-brand-300 text-xs font-semibold card-in flex items-center gap-2">${svg_(I.cash)} ${escH(stuName(me))} — ${escH(clsLabel(cls.id))} · ${escH(cls.cycle)} · ${escH(state.year)}</div>`;
    if(online){
      // MODE CONNECTE (donnees reelles) : aucun bareme / echeancier / reste du
      // code en dur. On n'affiche QUE le reel : le total deja paye et les recus
      // enregistres par l'administration. Le montant annuel et l'echeancier
      // seront integres quand le backend fournira le bareme de scolarite.
      return head
        + `<div class="grid grid-cols-1 gap-3 mt-3">${stat('Déjà payé',fmtMoney(info.paid),pays.length+' reçu(s) enregistré(s)','bg-emerald-500')}</div>`
        + section('Mes reçus')
        + listWrap(recus)
        + `<p class="text-[11px] text-slate-400 mt-2">💡 Seuls les paiements réellement enregistrés par l'administration sont affichés. Le montant annuel de scolarité et l'échéancier apparaîtront une fois le barème renseigné côté serveur.</p>`;
    }
    // MODE DEMO (hors-ligne) : affichage complet avec bareme du cycle + echeancier.
    return head
      + `<div class="grid grid-cols-2 gap-3 lg:grid-cols-3 mt-3">${stat('Scolarité annuelle',fmtMoney(info.total),'FCFA · '+escH(cls.cycle),'bg-brand-600')}${stat('Déjà payé',fmtMoney(info.paid),pctStr(info.pct)+' du total','bg-emerald-500')}${stat('Reste dû',fmtMoney(info.due),solde?'à régler':'✅ solde à jour','bg-'+(solde?'rose':'emerald')+'-500')}</div>`
      + `<div class="rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft card-in mt-3">
          <div class="flex items-center justify-between text-xs font-bold mb-2"><span class="text-slate-500">Progression du paiement</span><span class="text-brand-600">${pctStr(info.pct)}</span></div>
          <div class="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div class="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-500 transition-all" style="width:${info.pct}%"></div></div>
          <p class="text-[11px] text-slate-400 mt-2">${solde?('Il reste <strong>'+fmtMoney(info.due)+' FCFA</strong> à payer. Rapproche-toi de l\'administration pour régler la prochaine tranche.'):'Scolarité entièrement réglée. Merci !'}</p>
        </div>`
      + section('Échéancier (3 tranches)')
      + `<div class="rounded-2xl overflow-hidden shadow-soft card-in">${trRows}</div>`
      + section('Mes reçus')
      + listWrap(recus)
      + `<p class="text-[11px] text-slate-400 mt-2">💡 Le montant annuel suit le barème du cycle <strong>${escH(cls.cycle)}</strong>. Les paiements affichés sont ceux enregistrés par l'administration.</p>`;
  }
  // ---------- VUE PROFIL : INFOS PERSONNELLES (ÉLÈVE / PARENT & ENSEIGNANT) ----------
  function profile(){
    const infoRow=(lbl,val)=>`<div class="flex items-start justify-between gap-3 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
        <span class="text-xs font-bold text-slate-400 shrink-0">${lbl}</span>
        <span class="text-sm font-semibold text-right break-words min-w-0">${(val!=null&&String(val).trim())?escH(String(val)):'<span class=\'text-slate-400 font-normal\'>—</span>'}</span></div>`;
    const group=(title,rows)=>section(title)+`<div class="rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-soft card-in">${rows}</div>`;
    const photoBlock=(photo,name)=> photo?`<img src="${photo}" class="w-20 h-20 rounded-2xl object-cover shadow-soft" alt="">`:avatar(name,'w-20 h-20 text-2xl');
    const fmtDob=d=>{ if(!d) return ''; const p=String(d).split('-'); return p.length===3?(p[2]+'/'+p[1]+'/'+p[0]):String(d); };
    const age=d=>{ if(!d) return ''; const b=new Date(d); if(isNaN(+b)) return ''; const n=new Date(); let a=n.getFullYear()-b.getFullYear(); const m=n.getMonth()-b.getMonth(); if(m<0||(m===0&&n.getDate()<b.getDate())) a--; return (a>0&&a<120)?(a+' ans'):''; };
    const esc=v=>(v==null?'':String(v)).replace(/"/g,'&quot;');
    const inp=(id,val,lbl,type)=>`<div><label class="text-[11px] font-bold text-slate-400 uppercase tracking-wide">${lbl}</label><input id="${id}"${type?(' type="'+type+'"'):''} class="${MGIN}" value="${esc(val)}" placeholder="${escH(lbl)}"></div>`;
    const lockNote=txt=>`<p class="text-[11px] text-slate-400 px-1">🔒 ${txt}</p>`;
    const headCard=(photo,name,subtitle,badges)=>`<div class="rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft card-in flex items-center gap-4">
        ${photoBlock(photo,name)}
        <div class="min-w-0 flex-1"><p class="text-lg font-extrabold truncate">${escH(name)}</p><p class="text-xs text-slate-500 truncate">${escH(subtitle)}</p>
        <div class="flex flex-wrap gap-1.5 mt-2">${badges}</div></div>
        ${state.profEdit?'':'<button data-profedit class="shrink-0 px-3 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold active:scale-95 transition">✏️ Modifier</button>'}</div>`;
    const photoEditor=(photo,name)=>`<div class="rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft card-in flex items-center gap-4">
        ${photoBlock(photo,name)}
        <div class="flex flex-col gap-1.5">
          <label class="px-3 py-1.5 rounded-xl bg-brand-600 text-white text-xs font-bold cursor-pointer active:scale-95 transition">Changer la photo<input id="pf_file" type="file" accept="image/*" class="hidden"></label>
          ${photo?`<button data-pfphoto-clear class="text-xs font-bold text-rose-500 text-left">Retirer la photo</button>`:''}
        </div></div>`;
    const actions=`<div class="flex items-center gap-2 mt-4"><button data-profsave class="${MGBTN}">Enregistrer</button><button data-profcancel class="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold active:scale-95 transition">Annuler</button></div>`;

    if(state.role==='teacher'){
      const me=currentTeacher();
      if(!me) return `<div class="rounded-2xl p-4 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 text-sm font-semibold card-in flex items-center gap-2">${svg_(I.shield)} Aucune fiche enseignant n'est associée à ce compte. Contacte l'administration.</div>`;
      const nm=me.n||teacName(me);
      const subs=(me.subs||[]).map(id=>{ const s=getSub(id); return s?s.n:null; }).filter(Boolean);
      const cls=(me.cls||[]).map(id=>clsLabel(id)).filter(x=>x&&x!=='—');
      const badges=badge(me.spec||'Enseignant','bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300')
        +badge(cls.length+' classe(s)','bg-brand-50 text-brand-700 dark:bg-slate-800 dark:text-brand-300')
        +badge(subs.length+' matière(s)','bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300');
      if(state.profEdit){
        const ph=(state.profPhoto!==undefined?state.profPhoto:(me.photo||''));
        return headCard(ph||me.photo,nm,(activeSchool().name||'')+' · Enseignant',badges)
          + section('Modifier mon profil')
          + photoEditor(ph,nm)
          + `<div class="rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft card-in space-y-3 mt-3">
              ${inp('pf_dob',me.dob,'Date de naissance','date')}
              ${inp('pf_dip',me.dip,'Diplôme')}
              ${inp('pf_tel',me.tel,'Téléphone')}
              ${inp('pf_email',me.email,'E-mail','email')}
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${inp('pf_urgn',me.urgNom,'Personne à prévenir')}${inp('pf_urgt',me.urgTel,'Tél. à prévenir')}</div>
            </div>`
          + lockNote('Nom, prénom, spécialité, matières et classes sont gérés par l\'administration.')
          + actions;
      }
      return headCard(me.photo,nm,(activeSchool().name||'')+' · Enseignant',badges)
        + group('Identité',
            infoRow('Nom',me.nom||'')+infoRow('Prénom',me.prenom||'')
            +infoRow('Date de naissance',fmtDob(me.dob)+(age(me.dob)?(' · '+age(me.dob)):''))
            +infoRow('Diplôme',me.dip||''))
        + group('Contact',
            infoRow('Téléphone',me.tel||'')+infoRow('E-mail',me.email||''))
        + group('Personne à prévenir',
            infoRow('Nom',me.urgNom||'')+infoRow('Téléphone',me.urgTel||''))
        + group('Enseignement',
            infoRow('Spécialité',me.spec||'')
            +infoRow('Matières',subs.length?subs.join(', '):'')
            +infoRow('Classes',cls.length?cls.join(', '):''))
        + `<p class="text-[11px] text-slate-400 mt-2">💡 Tu peux mettre à jour tes coordonnées et ta photo via <strong>Modifier</strong>. Nom, spécialité et affectations restent gérés par l'administration.</p>`;
    }

    // Élève / Parent
    const me=studentForView();
    if(!me) return noStudentCard();
    const nm=stuName(me);
    const clsId=clsOfYear(me,state.year); const cls=clsId?getCls(clsId):null;
    const badges=badge(me.sexe==='F'?'Fille':'Garçon',me.sexe==='F'?'bg-pink-100 text-pink-700':'bg-sky-100 text-sky-700')
      +badge(cls?clsLabel(cls.id):'Sans classe','bg-brand-50 text-brand-700 dark:bg-slate-800 dark:text-brand-300')
      +badge(me.statut||'Élève','bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300');
    if(state.profEdit){
      const ph=(state.profPhoto!==undefined?state.profPhoto:(me.photo||''));
      return headCard(ph||me.photo,nm,(activeSchool().name||'')+' · Élève / Parent',badges)
        + section('Modifier mon profil')
        + photoEditor(ph,nm)
        + `<div class="rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft card-in space-y-3 mt-3">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${inp('pf_dob',me.dob,'Date de naissance','date')}${inp('pf_lieu',me.lieu,'Lieu de naissance')}</div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${inp('pf_pere',me.pere,'Père')}${inp('pf_peretel',me.pereTel,'Tél. du père')}</div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${inp('pf_mere',me.mere,'Mère')}${inp('pf_meretel',me.mereTel,'Tél. de la mère')}</div>
          </div>`
        + lockNote('Matricule, nom, prénom, sexe, classe et statut sont gérés par l\'établissement.')
        + actions;
    }
    return headCard(me.photo,nm,(activeSchool().name||'')+' · Élève / Parent',badges)
      + group('Identité de l\'élève',
          infoRow('Matricule',me.mat||'')+infoRow('Nom',me.nom||'')+infoRow('Prénom',me.prenom||'')
          +infoRow('Date de naissance',fmtDob(me.dob)+(age(me.dob)?(' · '+age(me.dob)):''))
          +infoRow('Lieu de naissance',me.lieu||'')+infoRow('Sexe',me.sexe==='F'?'Féminin':'Masculin'))
      + group('Scolarité',
          infoRow('Classe',cls?clsLabel(cls.id):'')+infoRow('Cycle',cls?cls.cycle:'')
          +infoRow('Année scolaire',state.year)+infoRow('Régime',me.st||'')+infoRow('Statut',me.statut||''))
      + group('Parents / Contacts',
          infoRow('Père',me.pere||'')+infoRow('Tél. père',me.pereTel||'')
          +infoRow('Mère',me.mere||'')+infoRow('Tél. mère',me.mereTel||''))
      + `<p class="text-[11px] text-slate-400 mt-2">💡 Tu peux corriger ta date/lieu de naissance, les coordonnées des parents et la photo via <strong>Modifier</strong>. Matricule, nom, classe et statut restent gérés par l'établissement.</p>`;
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
    // -- En-tête des documents imprimables (ministere a gauche, ecole a droite) --
    const minLogo = cfg.minLogo
      ? `<img src="${cfg.minLogo}" alt="logo ministère" class="w-14 h-14 rounded-xl object-contain bg-slate-50 dark:bg-slate-800 shadow-soft">`
      : `<div class="w-14 h-14 rounded-xl grid place-items-center bg-slate-50 dark:bg-slate-800 text-slate-400 text-[10px] text-center leading-tight px-1">Blason<br>(option)</div>`;
    const ecoLogo = cfg.logo
      ? `<img src="${cfg.logo}" alt="logo" class="w-14 h-14 rounded-xl object-cover shadow-soft">`
      : `<div class="w-14 h-14 rounded-xl grid place-items-center bg-brand-50 dark:bg-slate-800 text-brand-600">${svg_(I.shield)}</div>`;
    const colMin = `<div class="rounded-xl p-3 bg-slate-50 dark:bg-slate-800/60 space-y-2.5">
         <p class="text-xs font-extrabold text-slate-600 dark:text-slate-300 flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>Côté gauche · Ministère (tutelle)</p>
         <div class="flex items-center gap-3">${minLogo}
           <div class="flex flex-col gap-1.5"><label class="px-3 py-1.5 rounded-xl bg-slate-600 text-white text-xs font-bold cursor-pointer active:scale-95 transition">Blason / logo<input id="set_minlogo" type="file" accept="image/*" class="hidden"></label>${cfg.minLogo?`<button data-minlogoclear class="text-xs font-bold text-rose-500 text-left">Retirer</button>`:''}</div>
         </div>
         <div>${lbl('Pays / République')}<input id="set_mpays" class="${MGIN}" value="${esc(cfg.minCountry)}" placeholder="ex : RÉPUBLIQUE TOGOLAISE"></div>
         <div>${lbl('Devise')}<input id="set_mdev" class="${MGIN}" value="${esc(cfg.minMotto)}" placeholder="ex : Travail - Liberté - Patrie"></div>
         <div>${lbl('Ministère')}<input id="set_mnom" class="${MGIN}" value="${esc(cfg.minName)}" placeholder="ex : Ministère des Enseignements..."></div>
         <div>${lbl('Direction régionale')}<input id="set_mdir" class="${MGIN}" value="${esc(cfg.minDirection)}" placeholder="ex : Direction Régionale de l'Éducation..."></div>
         <div>${lbl('Inspection')}<input id="set_minsp" class="${MGIN}" value="${esc(cfg.minInspection)}" placeholder="ex : Inspection de..."></div>
       </div>`;
    const colEco = `<div class="rounded-xl p-3 bg-brand-50 dark:bg-slate-800/60 space-y-2.5">
         <p class="text-xs font-extrabold text-brand-700 dark:text-brand-300 flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-brand-500"></span>Côté droit · Établissement</p>
         <div class="flex items-center gap-3">${ecoLogo}
           <div class="flex flex-col gap-1.5"><label class="px-3 py-1.5 rounded-xl bg-brand-600 text-white text-xs font-bold cursor-pointer active:scale-95 transition">Logo de l'école<input id="set_logo" type="file" accept="image/*" class="hidden"></label>${cfg.logo?`<button data-logoclear class="text-xs font-bold text-rose-500 text-left">Retirer</button>`:''}</div>
         </div>
         <div>${lbl('Nom de l\'établissement')}<input id="set_e_name" class="${MGIN}" value="${esc(s.name)}" placeholder="Nom de l'école"></div>
         <div>${lbl('Adresse')}<input id="set_e_addr" class="${MGIN}" value="${esc(cfg.address)}" placeholder="BP / rue / ville"></div>
         <div class="grid grid-cols-2 gap-2"><div>${lbl('Téléphone')}<input id="set_e_phone" class="${MGIN}" value="${esc(cfg.phone)}" placeholder="+228 ..."></div><div>${lbl('Email')}<input id="set_e_email" class="${MGIN}" value="${esc(cfg.email)}" placeholder="contact@..."></div></div>
         <div>${lbl('Directeur (signature)')}<input id="set_e_dir" class="${MGIN}" value="${esc(cfg.director)}" placeholder="Nom du directeur"></div>
       </div>`;
    const entetes = card(
      `<p class="font-bold text-sm">En-tête des documents imprimables</p>
       <p class="text-[11px] text-slate-500">Ces informations s'affichent en haut des bulletins et des documents à imprimer : le <b>ministère à gauche</b>, l'<b>établissement à droite</b>.</p>
       <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">${colMin}${colEco}</div>
       <div class="flex items-center gap-2 rounded-xl p-2.5 bg-slate-50 dark:bg-slate-800 text-[11px] text-slate-500">🗒️ Les bulletins sont imprimés au format <b class="mx-1">portrait (A4)</b>.</div>
       <button data-setsave="entetes" class="${MGBTN} w-full justify-center">Enregistrer l'en-tête</button>`);
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
    const bulletinCard = card(
      `<p class="font-bold text-sm">Modèle & format du bulletin</p>
       <div>${lbl('Modèle de bulletin')}<select id="set_tpl" class="${MGIN}">${tplOpt('officiel','Officiel · synthèse annuelle (recommandé)')}${tplOpt('standard','Standard (notes + moyenne)')}${tplOpt('detaille','Détaillé (par type d\'épreuve)')}${tplOpt('compact','Compact (synthèse)')}${tplOpt('m_ci_trim','Modèle CI · Trimestriel (disciplines+bilans)')}${tplOpt('m_ci_sem','Modèle CI · Semestriel (S1/S2+annuel)')}${tplOpt('m_tg_trim','Modèle TG · Trimestriel (conseil+visas)')}${tplOpt('m_tg_sem','Modèle TG · Semestriel')}</select><p class="text-[11px] text-slate-400 mt-1">« Officiel » : le dernier bulletin de l'année reprend toutes les périodes + la moyenne annuelle et les rangs (Modèle 2 pour les cycles semestriels, Modèle 3 pour les cycles trimestriels).</p></div>
       <div>${lbl('Format du bulletin (défaut)')}<select id="set_fmt" class="${MGIN}">${fmtOpt('vrac','En vrac (toutes les matières)')}${fmtOpt('groupe','Groupé · Scientifique / Littéraire / Facultatives')}${fmtOpt('specialite','Groupé · Spécialité / Générales / Facultatives')}</select></div>
       <div>${lbl('Format par cycle')}<div class="space-y-2 mt-1">${cycFmtRows}</div><p class="text-[11px] text-slate-400 mt-1">« Par défaut » applique le format ci-dessus. Chaque cycle peut utiliser un format différent.</p></div>
       <button data-setsave="bulletin" class="${MGBTN} w-full justify-center">Enregistrer les bulletins</button>`);
    const commCard = card(
      `<p class="font-bold text-sm">Communication (SMS / WhatsApp)</p>
       <label class="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800"><span class="text-sm">Passerelle SMS</span><input id="set_sms" type="checkbox" ${cfg.sms?'checked':''} class="w-5 h-5 accent-brand-600"></label>
       <label class="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800"><span class="text-sm">Passerelle WhatsApp</span><input id="set_wa" type="checkbox" ${cfg.whatsapp?'checked':''} class="w-5 h-5 accent-brand-600"></label>
       <div>${lbl('Nom d\'expéditeur (SMS)')}<input id="set_sender" class="${MGIN}" value="${esc(cfg.sender)}" maxlength="11" placeholder="ex: XSCHOOL"></div>
       <button data-setsave="comm" class="${MGBTN} w-full justify-center">Enregistrer la communication</button>`);
    // Onglets : on n'affiche qu'une rubrique a la fois pour alleger l'ecran.
    const tab=state.setTab||'identite';
    const TABS=[['identite','Identité','identité & coordonnées'],
                ['entetes','En-têtes','ministère & école'],
                ['structure','Structure','cycles, année & périodes'],
                ['notation','Notation','barème & règles de calcul'],
                ['bulletin','Bulletins','modèle & format'],
                ['comm','Communication','SMS / WhatsApp']];
    const meta=TABS.find(x=>x[0]===tab)||TABS[0];
    const tabBar=`<div class="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">`+TABS.map(x=>`<button data-settab="${x[0]}" class="px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${tab===x[0]?'bg-brand-600 text-white shadow-soft':'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}">${x[1]}</button>`).join('')+`</div>`;
    let body='';
    if(tab==='identite') body=identite;
    else if(tab==='entetes') body=entetes;
    else if(tab==='structure') body=structure;
    else if(tab==='notation') body=notation+calc;
    else if(tab==='bulletin') body=bulletinCard;
    else if(tab==='comm') body=commCard;
    else body=identite;
    return `<div class="rounded-2xl p-3 bg-brand-50 dark:bg-slate-900 text-brand-700 dark:text-brand-300 text-xs font-semibold card-in flex items-center gap-2">${svg_(I.cog)} Paramètres de « ${escH(s.name)} » — ${meta[2]}.</div>`
      + tabBar
      + `<div class="mt-3 space-y-3">`+body+`</div>`;
  }
  function wireSettings(){
    const main=$('#main');
    const val=id=>{const e=main.querySelector('#'+id);return e?e.value.trim():'';};
    const chk=id=>{const e=main.querySelector('#'+id);return e?e.checked:false;};
    const cfg=schoolCfg(), s=activeSchool();
    const readInfo=()=>{ if(main.querySelector('#set_name')){ s.name=val('set_name')||s.name; cfg.phone=val('set_phone'); cfg.email=val('set_email'); cfg.address=val('set_addr'); cfg.director=val('set_dir'); } if(main.querySelector('#set_e_name')){ s.name=val('set_e_name')||s.name; cfg.phone=val('set_e_phone'); cfg.email=val('set_e_email'); cfg.address=val('set_e_addr'); cfg.director=val('set_e_dir'); } if(main.querySelector('#set_mpays')){ cfg.minCountry=val('set_mpays'); cfg.minMotto=val('set_mdev'); cfg.minName=val('set_mnom'); cfg.minDirection=val('set_mdir'); cfg.minInspection=val('set_minsp'); } };
    const logoIn=main.querySelector('#set_logo');
    if(logoIn) logoIn.addEventListener('change',e=>{ const f=e.target.files&&e.target.files[0]; if(!f) return; if(f.size>8*1024*1024){toast('Image trop lourde (max 8 Mo)');return;} const r=new FileReader(); r.onload=()=>{ readInfo(); cropPhoto(r.result,256,d=>{ cfg.logo=d; persistCfg(); renderView(); toast('Logo mis à jour ✓'); }); }; r.readAsDataURL(f); });
    const lc=main.querySelector('[data-logoclear]'); if(lc) lc.addEventListener('click',()=>{ readInfo(); cfg.logo=''; persistCfg(); renderView(); });
    const minLogoIn=main.querySelector('#set_minlogo');
    if(minLogoIn) minLogoIn.addEventListener('change',e=>{ const f=e.target.files&&e.target.files[0]; if(!f) return; if(f.size>8*1024*1024){toast('Image trop lourde (max 8 Mo)');return;} const r=new FileReader(); r.onload=()=>{ readInfo(); cropPhoto(r.result,256,d=>{ cfg.minLogo=d; persistCfg(); renderView(); toast('Blason du ministère mis à jour ✓'); }); }; r.readAsDataURL(f); });
    const mlc=main.querySelector('[data-minlogoclear]'); if(mlc) mlc.addEventListener('click',()=>{ readInfo(); cfg.minLogo=''; persistCfg(); renderView(); });
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
    main.querySelectorAll('[data-settab]').forEach(b=>b.addEventListener('click',()=>{ state.setTab=b.dataset.settab; renderView(); }));
    main.querySelectorAll('[data-setsave]').forEach(b=>b.addEventListener('click',()=>{
      const k=b.dataset.setsave;
      if(k==='info'){ const nm=val('set_name'); if(!nm){toast('Le nom est requis');return;} s.name=nm; cfg.phone=val('set_phone'); cfg.email=val('set_email'); cfg.address=val('set_addr'); cfg.director=val('set_dir'); toast('Identité enregistrée ✓'); }
      else if(k==='grading'){ const mx=+val('set_max')||20, ps=+val('set_pass'); if(mx<10){toast('Note max invalide');return;} if(ps<0||ps>mx){toast('Moyenne de passage invalide');return;} cfg.gradeMax=mx; cfg.passMark=ps; toast('Barème enregistré ✓'); }
      else if(k==='calc'){ readCalc(); cfg.mentions=(cfg.mentions||[]).filter(m=>m.l).sort((a,b)=>b.min-a.min); toast('Règles de calcul enregistrées ✓'); }
      else if(k==='bulletin'){ cfg.bulletinTpl=val('set_tpl')||'officiel'; cfg.bulletinFmt=val('set_fmt')||'vrac'; const fm={}; main.querySelectorAll('[data-blfmtcyc]').forEach(sel=>{ if(sel.value) fm[sel.dataset.blfmtcyc]=sel.value; }); cfg.bulletinFmtByCycle=fm; toast('Bulletins enregistrés ✓'); }
      else if(k==='entetes'){ const nm=val('set_e_name'); if(!nm){toast('Le nom de l\'établissement est requis');return;} s.name=nm; cfg.address=val('set_e_addr'); cfg.phone=val('set_e_phone'); cfg.email=val('set_e_email'); cfg.director=val('set_e_dir'); cfg.minCountry=val('set_mpays'); cfg.minMotto=val('set_mdev'); cfg.minName=val('set_mnom'); cfg.minDirection=val('set_mdir'); cfg.minInspection=val('set_minsp'); toast('En-tête enregistré ✓'); }
      else if(k==='comm'){ cfg.sms=chk('set_sms'); cfg.whatsapp=chk('set_wa'); cfg.sender=val('set_sender')||'XSCHOOL'; toast('Communication enregistrée ✓'); }
      persistCfg();
      renderView();
    }));
  }
