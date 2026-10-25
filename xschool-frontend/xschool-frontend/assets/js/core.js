'use strict';
/* XSchool core : helpers, icones, roles, etat, UI helpers, modales mail. */
  const $ = s => document.querySelector(s);
  const el = (t,c,h) => { const e=document.createElement(t); if(c)e.className=c; if(h!=null)e.innerHTML=h; return e; };

  // ---------- ICONS ----------
  const I = {
    home:'<path d="M3 10.5 12 3l9 7.5V21a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/>',
    users:'<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0112 0M16 7a3 3 0 010 6M15 20a6 6 0 016-5"/>',
    teacher:'<path d="M12 3 2 8l10 5 8-4v6"/><path d="M6 11v4c0 1.5 2.7 3 6 3s6-1.5 6-3v-4"/>',
    grade:'<path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h8M8 17h5"/>',
    cash:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
    cal:'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
    bell:'<path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21a2 2 0 004 0"/>',
    chart:'<path d="M4 19V5M4 19h16M8 15v-4M12 15V8M16 15v-6"/>',
    cog:'<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 00-.2-1.6l2-1.5-2-3.4-2.3 1a7 7 0 00-2.7-1.6L13.5 2h-3l-.3 2.3A7 7 0 007.5 6l-2.3-1-2 3.4 2 1.5A7 7 0 005 12c0 .5 0 1 .2 1.6l-2 1.5 2 3.4 2.3-1a7 7 0 002.7 1.6l.3 2.3h3l.3-2.3a7 7 0 002.7-1.6l2.3 1 2-3.4-2-1.5c.2-.5.2-1 .2-1.6z"/>',
    book:'<path d="M4 4h9a3 3 0 013 3v13a2 2 0 00-2-2H4z"/><path d="M20 4h-3a3 3 0 00-3 3v13a2 2 0 012-2h4z"/>',
    check:'<path d="M4 12l5 5L20 6"/>',
    shield:'<path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/>',
    doc:'<path d="M6 2h8l4 4v16H6z"/><path d="M14 2v4h4M9 13h6M9 17h6"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    edit:'<path d="M4 20h4L18.5 9.5l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'
  };
  const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-full h-full">${p}</svg>`;
  // ---------- ROLE CONFIG (espaces distincts) ----------
  const ROLES = {
    super:   { tag:'SuperAdmin', name:'A. Kodjo', email:'super@xschool.io', badge:'bg-slate-600',
      icon:I.shield, grad:'from-brand-700 to-brand-900', desc:'Gestion globale multi-établissements, utilisateurs & journaux.',
      nav:['dash','users','schools','logs','settings'] },
    admin:   { tag:'Administration', name:'M. Dupont', email:'direction@lyceemoderne.tg', badge:'bg-brand-600',
      icon:I.cog, grad:'from-brand-600 to-indigo-500', desc:'Direction, scolarité, emplois du temps, validation des notes.',
      nav:['dash','manage','timetable','grades','bulletins','cartes','feuilles','stats','notify','absstats','settings'] },
    teacher: { tag:'Enseignant', name:'Mme Sarr', email:'sarr@lyceemoderne.tg', badge:'bg-emerald-500',
      icon:I.teacher, grad:'from-emerald-500 to-teal-600', desc:'Mes classes, saisie des notes, mes heures, emploi du temps.',
      nav:['dash','classes','grades','myhours','timetable'] },
    surveillant:{ tag:'Surveillant', name:'M. Ba', email:'surveillance@lyceemoderne.tg', badge:'bg-sky-500',
      icon:I.check, grad:'from-sky-600 to-brand-700', desc:'Appel, pointage des enseignants, discipline, alertes parents.',
      nav:['dash','appel','pointage','timetable','discipline','absstats','notify'] },
    comptable:{ tag:'Comptable', name:'Mme Either', email:'compta@lyceemoderne.tg', badge:'bg-amber-500',
      icon:I.cash, grad:'from-amber-500 to-orange-600', desc:'Encaissements, échéanciers, reçus et rapports financiers.',
      nav:['dash','finance','payments','schedules','reports'] },
    student: { tag:'Élève / Parent', name:'K. Mensah', email:'parent.mensah@gmail.com', badge:'bg-rose-500',
      icon:I.book, grad:'from-slate-600 to-slate-800', desc:'Notes en direct, bulletins, emploi du temps, scolarité.',
      nav:['dash','bulletin','timetable','attendance','fees'] }
  };
  const NAV = {
    dash:{t:'Accueil',i:I.home}, users:{t:'Utilisateurs',i:I.users}, schools:{t:'Établissements',i:I.shield},
    logs:{t:'Journaux',i:I.doc}, settings:{t:'Paramètres',i:I.cog}, students:{t:'Élèves',i:I.users},
    finance:{t:'Scolarité',i:I.cash}, timetable:{t:'Emploi',i:I.cal}, notify:{t:'Alertes',i:I.bell},
    classes:{t:'Classes',i:I.teacher}, grades:{t:'Notes',i:I.grade}, pointage:{t:'Pointage',i:I.clock},
    bulletin:{t:'Bulletin',i:I.book}, attendance:{t:'Présence',i:I.check}, fees:{t:'Frais',i:I.cash},
    appel:{t:'Appel',i:I.check}, discipline:{t:'Discipline',i:I.shield}, absences:{t:'Absences',i:I.bell}, absstats:{t:'Stats absences',i:I.chart},
    payments:{t:'Paiements',i:I.cash}, schedules:{t:'Échéancier',i:I.cal}, reports:{t:'Rapports',i:I.chart},
    myhours:{t:'Mes heures',i:I.clock}, manage:{t:'Gestion',i:I.cog}, bulletins:{t:'Bulletins',i:I.book},
    cartes:{t:'Cartes scolaires',i:I.users},
    feuilles:{t:'Feuilles de présence',i:I.doc},
    stats:{t:'Statistiques résultats',i:I.chart}
  };

  const state = { screen:'tenant', role:'admin', view:'dash', schoolId:'sc1', tenant:'', manageTab:'eleves', manageForm:'', mgStuOpen:'', mgStuMode:'classe', mgStuEdit:'', mgStuAssign:'', mgStatYear:'', mgPhoto:'', stuSearch:'', stuFilterCls:'all', mgEnsOpen:'', mgEnsEdit:'', mgEnsPhoto:'', alCat:'absence', alTarget:'all', alChannel:'sms', mgCycle:'', mgDip:'CAP', ttTScope:'mine', ttTClsIdx:0, ttScope:'class', ttCycle:'Lycée Moderne', ttIdx:0, ttGroup:'', ttEdit:false, year:'2025-2026', grCls:'', grSub:'', grPeriod:0, mgUserOpen:'', mgProgEdit:'', payOpen:false, payMode:'especes', payDraft:{}, paySearch:'', blCls:'', blPeriod:0, cartesCls:'', feuillesCls:'', feuillesCols:15, statTab:'classe', statCls:'', statIdx:-1, statGIdx:-1, statSIdx:-1, suSchool:'all', suRole:'all', logQ:'', logLevel:'all', logSchool:'all', alBannerCls:'all', absStatPeriod:'month' };

  // ---------- UI HELPERS ----------
  const badge = (txt,cls) => `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${cls}">${txt}</span>`;
  const stat = (label,val,sub,color) => `<div class="card-in rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft">
      <div class="w-9 h-9 rounded-xl ${color} text-white p-2 mb-2">${svg(I.chart)}</div>
      <p class="text-2xl font-extrabold">${val}</p>
      <p class="text-xs text-slate-500">${label}</p>
      <p class="text-[11px] mt-1 font-semibold text-emerald-500">${sub}</p></div>`;
  const section = (title,extra='') => `<div class="flex items-center justify-between mt-6 mb-2"><h3 class="font-bold">${title}</h3>${extra}</div>`;
  const row = (a,b,c) => `<div class="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 shadow-soft card-in">${a}<div class="flex-1 min-w-0">${b}</div>${c||''}</div>`;
  const listWrap = h => `<div class="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3">${h}</div>`;
  const avatar = n => `<img src="https://i.pravatar.cc/80?img=${n}" class="w-10 h-10 rounded-xl" alt="">`;
  const escH=v=>(''+(v==null?'':v)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function toast(msg){
    let t=document.getElementById('toast');
    if(!t){ t=document.createElement('div'); t.id='toast'; t.className='fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold shadow-soft opacity-0 transition-opacity pointer-events-none'; document.body.appendChild(t); }
    t.textContent=msg; t.classList.remove('opacity-0'); clearTimeout(t._h); t._h=setTimeout(()=>t.classList.add('opacity-0'),2200);
  }
  // Notification email automatique (simulation prototype) après validation d'un compte
  function mailSentModal(u){
    const esc=v=>(''+(v==null?'':v)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    const sc=schoolCfg(), school=activeSchool();
    const from=sc.email||'noreply@xschool.io';
    const cls=u.classId?clsLabel(u.classId):'—';
    const old=document.getElementById('mailOv'); if(old) old.remove();
    const ov=document.createElement('div'); ov.id='mailOv';
    ov.className='fixed inset-0 z-[70] bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4';
    ov.innerHTML=`<div class="bg-white dark:bg-slate-900 rounded-3xl shadow-soft border border-slate-200/70 dark:border-slate-800 w-full max-w-md max-h-[85vh] overflow-auto card-in">
      <div class="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <span class="w-8 h-8 rounded-xl grid place-items-center bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">${svg_(I.mail)}</span>
        <div class="flex-1"><p class="text-sm font-bold">Email de confirmation envoyé</p><p class="text-[11px] text-slate-500">Notification automatique (simulation)</p></div>
        <button id="mailClose" class="w-8 h-8 grid place-items-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 text-lg">×</button>
      </div>
      <div class="p-4 space-y-3 text-sm">
        <div class="space-y-1 text-xs bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
          <p><span class="text-slate-400">De :</span> <span class="font-semibold">${esc(school.name)} &lt;${esc(from)}&gt;</span></p>
          <p><span class="text-slate-400">À :</span> <span class="font-semibold">${esc(u.name)} &lt;${esc(u.email)}&gt;</span></p>
          <p><span class="text-slate-400">Objet :</span> <span class="font-semibold">Votre compte XSchool est activé ✅</span></p>
        </div>
        <div class="space-y-2 leading-relaxed">
          <p>Bonjour ${esc(u.name)},</p>
          <p>Bonne nouvelle ! Votre compte élève vient d'être <strong>validé</strong> par l'administration de ${esc(school.name)}.</p>
          <p>Classe : <strong>${esc(cls)}</strong></p>
          <p>Vous pouvez désormais vous connecter à votre espace XSchool ${u.gmail?('directement avec votre compte Google ('+esc(u.email)+')'):('avec l\'adresse '+esc(u.email))}.</p>
          <p class="text-slate-500 text-xs">Cet email a été envoyé automatiquement — merci de ne pas y répondre.</p>
        </div>
      </div>
      <div class="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
        <button id="mailOk" class="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold">Fermer</button>
      </div>
    </div>`;
    document.body.appendChild(ov);
    const close=()=>ov.remove();
    ov.addEventListener('click',e=>{ if(e.target===ov) close(); });
    ov.querySelector('#mailClose').addEventListener('click',close);
    ov.querySelector('#mailOk').addEventListener('click',close);
  }
  // Email de réinitialisation de mot de passe (simulation prototype) — contient le code à 6 chiffres
  function mailResetModal(u,code){
    const esc=v=>(''+(v==null?'':v)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    const sc=schoolCfg(), school=activeSchool();
    const from=sc.email||'noreply@xschool.io';
    const old=document.getElementById('mailOv'); if(old) old.remove();
    const ov=document.createElement('div'); ov.id='mailOv';
    ov.className='fixed inset-0 z-[70] bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4';
    ov.innerHTML=`<div class="bg-white dark:bg-slate-900 rounded-3xl shadow-soft border border-slate-200/70 dark:border-slate-800 w-full max-w-md max-h-[85vh] overflow-auto card-in">
      <div class="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <span class="w-8 h-8 rounded-xl grid place-items-center bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">${svg_(I.mail)}</span>
        <div class="flex-1"><p class="text-sm font-bold">Code de réinitialisation envoyé</p><p class="text-[11px] text-slate-500">Notification automatique (simulation)</p></div>
        <button id="mailClose" class="w-8 h-8 grid place-items-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 text-lg">×</button>
      </div>
      <div class="p-4 space-y-3 text-sm">
        <div class="space-y-1 text-xs bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
          <p><span class="text-slate-400">De :</span> <span class="font-semibold">${esc(school.name)} &lt;${esc(from)}&gt;</span></p>
          <p><span class="text-slate-400">À :</span> <span class="font-semibold">${esc(u.name)} &lt;${esc(u.email)}&gt;</span></p>
          <p><span class="text-slate-400">Objet :</span> <span class="font-semibold">Réinitialisation de votre mot de passe XSchool</span></p>
        </div>
        <div class="space-y-2 leading-relaxed">
          <p>Bonjour ${esc(u.name)},</p>
          <p>Une demande de réinitialisation a été reçue pour votre compte sur ${esc(school.name)}. Saisissez le code ci-dessous pour choisir un nouveau mot de passe :</p>
          <div class="text-center my-2"><span class="inline-block px-5 py-3 rounded-xl bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-200 text-2xl font-extrabold tracking-[0.3em]">${esc(code)}</span></div>
          <p class="text-slate-500 text-xs">Ce code expire dans 15 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
        </div>
      </div>
      <div class="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
        <button id="mailOk" class="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold">Fermer</button>
      </div>
    </div>`;
    document.body.appendChild(ov);
    const close=()=>ov.remove();
    ov.addEventListener('click',e=>{ if(e.target===ov) close(); });
    ov.querySelector('#mailClose').addEventListener('click',close);
    ov.querySelector('#mailOk').addEventListener('click',close);
  }
