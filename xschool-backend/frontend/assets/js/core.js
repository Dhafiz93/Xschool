'use strict';
/* XSchool core : helpers, icones, roles, etat, UI helpers, modales mail. */
  const $ = s => document.querySelector(s);
  const el = (t,c,h) => { const e=document.createElement(t); if(c)e.className=c; if(h!=null)e.innerHTML=h; return e; };

  // ---------- ICONS ----------
  // Jeu d'icones standard "developpeur" (Feather Icons / Lucide, MIT) : trace a
  // 24x24, contour uniquement (fill=none, stroke=currentColor), coins arrondis.
  // Compatible tel quel avec le wrapper svg() ci-dessous.
  const I = {
    home:'<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    users:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    teacher:'<path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1 2.7 2 6 2s6-1 6-2v-5"/><path d="M22 10v6"/>',
    grade:'<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h6M8.5 12h.01M8.5 16h.01"/>',
    cash:'<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
    cal:'<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    bell:'<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    chart:'<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    cog:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    book:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    check:'<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>',
    doc:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>',
    clock:'<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    trash:'<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
    plus:'<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    edit:'<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
    lock:'<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
  };
  const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-full h-full">${p}</svg>`;
  // ---------- ROLE CONFIG (espaces distincts) ----------
  const ROLES = {
    super:   { tag:'SuperAdmin', name:'A. Kodjo', email:'super@xschool.io', badge:'bg-slate-600',
      icon:I.shield, grad:'from-brand-700 to-brand-900', desc:'Gestion globale multi-établissements, utilisateurs & journaux.',
      nav:['dash','users','schools','logs','settings'] },
    admin:   { tag:'Administration', name:'M. Dupont', email:'direction@lyceemoderne.tg', badge:'bg-brand-600',
      icon:I.cog, grad:'from-brand-600 to-indigo-500', desc:'Direction, scolarité, emplois du temps, validation des notes.',
      nav:['dash','manage','users','timetable','grades','bulletins','cartes','feuilles','stats','notify','absstats','logs','settings'] },
    teacher: { tag:'Enseignant', name:'Mme Sarr', email:'sarr@lyceemoderne.tg', badge:'bg-emerald-500',
      icon:I.teacher, grad:'from-emerald-500 to-teal-600', desc:'Mes classes, saisie des notes, mes heures, emploi du temps.',
      nav:['dash','classes','grades','myhours','timetable','profile'] },
    surveillant:{ tag:'Surveillant', name:'M. Ba', email:'surveillance@lyceemoderne.tg', badge:'bg-sky-500',
      icon:I.check, grad:'from-sky-600 to-brand-700', desc:'Appel, pointage des enseignants, discipline, alertes parents.',
      nav:['dash','appel','pointage','timetable','discipline','absstats','notify'] },
    comptable:{ tag:'Comptable', name:'Mme Either', email:'compta@lyceemoderne.tg', badge:'bg-amber-500',
      icon:I.cash, grad:'from-amber-500 to-orange-600', desc:'Encaissements, échéanciers, reçus et rapports financiers.',
      nav:['dash','finance','payments','schedules','reports'] },
    student: { tag:'Élève / Parent', name:'K. Mensah', email:'parent.mensah@gmail.com', badge:'bg-rose-500',
      icon:I.book, grad:'from-slate-600 to-slate-800', desc:'Notes en direct, bulletins, emploi du temps, scolarité.',
      nav:['dash','bulletin','timetable','attendance','fees','profile'] }
  };
  const NAV = {
    dash:{t:'Accueil',i:I.home}, users:{t:'Utilisateurs',i:I.users}, schools:{t:'Établissements',i:I.shield},
    logs:{t:'Historique',i:I.doc}, settings:{t:'Paramètres',i:I.cog}, students:{t:'Élèves',i:I.users},
    finance:{t:'Scolarité',i:I.cash}, timetable:{t:'Emploi',i:I.cal}, notify:{t:'Alertes',i:I.bell},
    classes:{t:'Classes',i:I.teacher}, grades:{t:'Notes',i:I.grade}, pointage:{t:'Pointage',i:I.clock},
    bulletin:{t:'Bulletin',i:I.book}, attendance:{t:'Présence',i:I.check}, fees:{t:'Frais',i:I.cash},
    appel:{t:'Appel',i:I.check}, discipline:{t:'Discipline',i:I.shield}, absences:{t:'Absences',i:I.bell}, absstats:{t:'Stats absences',i:I.chart},
    payments:{t:'Paiements',i:I.cash}, schedules:{t:'Échéancier',i:I.cal}, reports:{t:'Rapports',i:I.chart},
    myhours:{t:'Mes heures',i:I.clock}, manage:{t:'Gestion',i:I.cog}, bulletins:{t:'Bulletins',i:I.book},
    cartes:{t:'Cartes scolaires',i:I.users},
    feuilles:{t:'Feuilles de présence',i:I.doc},
    stats:{t:'Statistiques résultats',i:I.chart},
    profile:{t:'Mon profil',i:I.users}
  };

  const state = { screen:'tenant', role:'admin', view:'dash', schoolId:'sc1', tenant:'', manageTab:'annee', manageForm:'', mgStuOpen:'', mgStuMode:'classe', mgStuEdit:'', mgStuAssign:'', mgStatYear:'', mgPhoto:'', stuSearch:'', stuFilterCls:'all', mgEnsOpen:'', mgEnsEdit:'', mgEnsPhoto:'', alCat:'absence', alTarget:'all', alChannel:'sms', mgCycle:'', mgDip:'CAP', ttTScope:'mine', ttTClsIdx:0, ttScope:'class', ttCycle:'Lycée Moderne', ttIdx:0, ttGroup:'', ttClsId:'', ttTeachId:'', ttEdit:false, year:'2025-2026', grCls:'', grSub:'', grPeriod:0, mgUserOpen:'', mgProgEdit:'', payOpen:false, payMode:'especes', payDraft:{}, paySearch:'', blCls:'', blPeriod:0, cartesCls:'', feuillesCls:'', feuillesCols:15, statTab:'classe', statCls:'', statIdx:-1, statGIdx:-1, statSIdx:-1, suSchool:'all', suRole:'all', logQ:'', logLevel:'all', logSchool:'all', alBannerCls:'all', absStatPeriod:'month' };

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
  // ---------- AVATARS (initiales generees localement) ----------
  // Plus de service externe aleatoire (i.pravatar) : on derive des initiales a
  // partir du nom + une couleur de fond deterministe (meme nom => meme couleur).
  function initials(name){
    const parts=(''+(name==null?'':name)).trim().split(/\s+/).filter(Boolean);
    if(!parts.length) return '?';
    if(parts.length===1) return parts[0].slice(0,2).toUpperCase();
    return (parts[0][0]+parts[parts.length-1][0]).toUpperCase();
  }
  const AVA_COLORS=['#4f46e5','#0891b2','#059669','#d97706','#dc2626','#db2777','#7c3aed','#2563eb','#0d9488','#ea580c'];
  function avaColor(name){ const s=''+(name==null?'':name); let h=0; for(let i=0;i<s.length;i++){ h=(h*31+s.charCodeAt(i))>>>0; } return AVA_COLORS[h%AVA_COLORS.length]; }
  // avatar(nom, classes?) -> pastille d'initiales. `classes` permet d'ajuster la
  // taille/forme (defaut : carre arrondi 40px, comme l'ancien rendu).
  const avatar = (name,cls) => `<span class="${cls||'w-10 h-10'} rounded-xl grid place-items-center font-extrabold text-white shrink-0" style="background:${avaColor(name)}" title="${escH(name)}" aria-label="${escH(name)}">${escH(initials(name))}</span>`;
  const escH=v=>(''+(v==null?'':v)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function toast(msg){
    let t=document.getElementById('toast');
    if(!t){ t=document.createElement('div'); t.id='toast'; t.className='fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold shadow-soft opacity-0 transition-opacity pointer-events-none'; document.body.appendChild(t); }
    t.textContent=msg; t.classList.remove('opacity-0'); clearTimeout(t._h); t._h=setTimeout(()=>t.classList.add('opacity-0'),2200);
  }

  // ---------- CHAMPS OBLIGATOIRES + CONTROLES DE SAISIE ----------
  // Petite etoile rouge placee DEVANT le libelle d'un champ obligatoire.
  // Reutilisee tel quel dans tous les formulaires : `${RQ} Nom`.
  const RQ='<span class="text-rose-500 font-bold mr-0.5" title="Champ obligatoire" aria-hidden="true">*</span>';

  // Chaque controle renvoie '' si la valeur est acceptable (vide compris quand le
  // champ est facultatif), sinon un message d'erreur en francais pret pour toast().

  // Date de naissance : vraie date, ni dans le futur, ni avant 1900. Vide = accepte.
  function errDob(v){
    v=(v==null?'':(''+v)).trim();
    if(!v) return '';
    if(!/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'Date de naissance invalide (format attendu : AAAA-MM-JJ).';
    const parts=v.split('-'), y=+parts[0], m=+parts[1], day=+parts[2];
    const d=new Date(v+'T00:00:00');
    if(isNaN(d.getTime())||d.getFullYear()!==y||(d.getMonth()+1)!==m||d.getDate()!==day) return 'Date de naissance invalide (jour inexistant).';
    const today=new Date(); today.setHours(0,0,0,0);
    if(d.getTime()>today.getTime()) return 'La date de naissance ne peut pas être dans le futur.';
    if(y<1900) return 'Date de naissance invalide (année trop ancienne).';
    return '';
  }
  // Numero de telephone : chiffres et signes + ( ) - . espaces ; de 6 a 15 chiffres. Vide = accepte.
  function errTel(v,label){
    v=(v==null?'':(''+v)).trim(); label=label||'Le numéro de téléphone';
    if(!v) return '';
    if(!/^[0-9+()\-.\s]+$/.test(v)) return label+' ne doit contenir que des chiffres et les signes + ( ) - .';
    const digits=v.replace(/\D/g,'');
    if(digits.length<6) return label+' est trop court (au moins 6 chiffres).';
    if(digits.length>15) return label+' est trop long (15 chiffres maximum).';
    return '';
  }
  // Montant numerique strictement positif (chiffres uniquement).
  function errAmount(v){
    v=(v==null?'':(''+v)).trim();
    if(!v) return 'Le montant est obligatoire.';
    if(!/^\d+(?:[.,]\d+)?$/.test(v)) return 'Le montant doit être un nombre (chiffres uniquement).';
    const n=+v.replace(',','.');
    if(!isFinite(n)||n<=0) return 'Le montant doit être un nombre supérieur à 0.';
    return '';
  }
  // Date generique valide. allowFuture=false => interdit une date future. Vide = accepte.
  function errDate(v,label,allowFuture){
    v=(v==null?'':(''+v)).trim(); label=label||'La date';
    if(!v) return '';
    if(!/^\d{4}-\d{2}-\d{2}$/.test(v)) return label+' est invalide (format attendu : AAAA-MM-JJ).';
    const parts=v.split('-'), y=+parts[0], m=+parts[1], day=+parts[2];
    const d=new Date(v+'T00:00:00');
    if(isNaN(d.getTime())||d.getFullYear()!==y||(d.getMonth()+1)!==m||d.getDate()!==day) return label+' est invalide.';
    if(!allowFuture){ const today=new Date(); today.setHours(0,0,0,0); if(d.getTime()>today.getTime()) return label+' ne peut pas être dans le futur.'; }
    return '';
  }
  // Renvoie le 1er message non vide d'une liste de controles, '' si tout est bon.
  function firstErr(){ for(var i=0;i<arguments.length;i++){ if(arguments[i]) return arguments[i]; } return ''; }

  // ---------- TELECHARGEMENT FIABLE ----------
  // Declenche un telechargement de fichier de maniere robuste et cross-navigateur.
  // On passe TOUJOURS par un Blob + une ancre AJOUTEE AU DOM puis revoquee :
  //  - les URI "data:" sur une ancre detachee sont bloquees/ignorees par
  //    plusieurs navigateurs (Firefox exige l'ancre dans le DOM) et echouent
  //    au-dela de quelques Mo (limite de longueur des data-URL) -> d'ou les
  //    "liens de telechargement qui ne marchent pas".
  // `content` peut etre une chaine ou un Blob deja construit.
  function downloadFile(filename, content, mime){
    try{
      const blob = (content instanceof Blob)
        ? content
        : new Blob([content], { type: mime || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename || 'export'; a.style.display = 'none';
      a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>{ try{ URL.revokeObjectURL(url); }catch(e){} }, 1500);
      return true;
    }catch(e){
      if(typeof toast==='function') toast('Téléchargement impossible : '+((e&&e.message)||'erreur'));
      return false;
    }
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
