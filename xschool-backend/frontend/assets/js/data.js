'use strict';
/* XSchool data : structure academique, ecoles, annees, notes, config, DB (en memoire), RBAC, logs, emploi du temps, compta. */
  // ---------- STRUCTURE ACADÉMIQUE (cycles → classes → groupes) ----------
  const CYCLES={
    'Préscolaire':['Préscolaire 1','Préscolaire 2'],
    'Primaire':['CP1','CP2','CE1','CE2','CM1','CM2'],
    'Collège':['6ᵉme','5ᵉme','4ᵉme','3ᵉme'],
    'Lycée Moderne':['2nde A','2nde CD','1ᵉre A4','1ᵉre C','1ᵉre D','Tle A4','Tle C','Tle D'],
    'Lycée Technique':['2nde G1','2nde G2','2nde G3','1ᵉre G1','1ᵉre G2','1ᵉre G3','Tle G1','Tle G2','Tle G3'],
    'Cycle Industriel':['2nde F1','2nde F2','2nde F3','2nde F4','1ᵉre F1','1ᵉre F2','1ᵉre F3','1ᵉre F4','Tle F1','Tle F2','Tle F3','Tle F4'],
    'Cycle Professionnel':['CAP1 Maçonnerie','CAP2 Maçonnerie','CAP1 Menuiserie bois','CAP2 Menuiserie bois','CAP1 Coupe-couture','CAP2 Coupe-couture','BT1 Comptabilité','BT2 Comptabilité','BT3 Comptabilité','BT1 Électrotechnique','BT2 Électrotechnique','BT3 Électrotechnique']
  };
  // Filières officielles du Cycle Professionnel (CAP / BT), groupées par domaine
  const PRO_SPECS={
    CAP:{
      'Bâtiment & Artisanat':['Maçonnerie','Plomberie','Menuiserie bois','Électricité bâtiment','Peinture / Dessin bâtiment'],
      'Mécanique & Industrie':['Mécanique automobile','Chaudronnerie & Construction métallique','Froid & climatisation'],
      'Services & Mode':['Coupe-couture','Coiffure','Cuisine & Pâtisserie','Tissage de pagnes / Batik'],
      'Agriculture & Élevage':['Agriculture','Élevage','Mécanique agricole']
    },
    BT:{
      'Tertiaire & Gestion':['Secrétariat de direction','Comptabilité','Commerce / Action commerciale','Transit & Douane','Informatique','Transport & Logistique'],
      'Industrie & Électrotechnique':['Électrotechnique','Électronique','Maintenance informatique & réseaux','Télé-surveillance','Froid & climatisation industrielle'],
      'Bâtiment & Génie Civil':['Génie civil','Construction métallique','Hydraulique','Menuiserie aluminium'],
      'Autres domaines':['Guide touristique','Photovoltaïque','Gestion des collectivités locales']
    }
  };
  const CYCLE_NAMES=Object.keys(CYCLES);
  const GROUPS=[['','Classe entière'],['A','Groupe A'],['B','Groupe B']];
  function academicStructure(){
    const total=CYCLE_NAMES.reduce((s,c)=>s+CYCLES[c].length,0);
    return section('Structure académique','<span class="text-xs text-slate-400">'+CYCLE_NAMES.length+' cycles · '+total+' classes</span>')
      + '<div class="space-y-2">'+CYCLE_NAMES.map(c=>`
        <div class="rounded-2xl p-3 bg-white dark:bg-slate-900 shadow-soft card-in">
          <div class="flex items-center justify-between"><p class="font-bold text-sm">${c}</p><span class="text-[11px] font-semibold text-slate-400">${CYCLES[c].length} classes</span></div>
          <div class="flex flex-wrap gap-1.5 mt-2">${CYCLES[c].map(n=>`<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-50 text-brand-700 dark:bg-slate-800 dark:text-brand-300">${n}</span>`).join('')}</div>
        </div>`).join('')+'</div>'
      + '<p class="text-[11px] text-slate-400 mt-2">💡 Chaque classe peut être scindée en Groupe A / Groupe B.</p>';
  }
  // ---------- CONFIGURATION ÉCOLES (superadmin) + BASE DE DONNÉES (en mémoire) ----------
  const SCHOOLS=[
    {id:'sc1',name:'Lycée Technique Moderne',code:'LTM228',slug:'ltm',cycles:['Collège','Lycée Moderne','Lycée Technique','Cycle Industriel','Cycle Professionnel']},
    {id:'sc2',name:'Groupe Scolaire Les Palmiers',code:'GSP228',slug:'palmiers',cycles:['Préscolaire','Primaire','Collège']},
    {id:'sc3',name:'Complexe Éducatif El Hadj',code:'CEH228',slug:'elhadj',cycles:['Primaire','Collège','Lycée Moderne']}
  ];
  function activeSchool(){ return SCHOOLS.find(s=>s.id===state.schoolId)||SCHOOLS[0]; }
  // Nom de l'utilisateur réellement connecté (mode API) ; sinon nom de démo du rôle.
  function sessionUserName(){
    try{ if(typeof API!=='undefined' && API.authenticated()){ const u=API.user(); if(u) return u.full_name||u.email||''; } }catch(e){}
    return (typeof ROLES!=='undefined' && ROLES[state.role] && ROLES[state.role].name)||'';
  }
  // Fiche enseignant correspondant au compte REELLEMENT connecte.
  //  - Mode connecte (donnees reelles, demo videe) : on resout le prof via le
  //    compte authentifie (lien explicite teacherId sinon correspondance par
  //    nom complet / email). Aucune fiche trouvee => null (vues vides, pas de
  //    prof de demo code en dur).
  //  - Mode demo (hors ligne) : on retombe sur le nom de demo du role.
  function currentTeacher(){
    const norm=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
    const list=(typeof DB!=='undefined' && DB.teachers)?DB.teachers:[];
    if(!list.length) return null;
    try{
      if(typeof apiOn==='function' && apiOn() && typeof API!=='undefined' && API.authenticated()){
        const u=API.user?API.user():null;
        if(!u) return null;
        // 1) lien explicite compte -> fiche (teacherId cote front, le cas echeant)
        let tid;
        if(typeof USERS!=='undefined' && u.id!=null){
          const acc=USERS.find(x=>x.apiId!=null && x.apiId===u.id);
          if(acc && acc.teacherId) tid=acc.teacherId;
        }
        if(tid==null) tid=u.teacher_id!=null?u.teacher_id:u.teacherId;
        if(tid!=null){ const byId=list.find(t=>t.id===tid||t.apiId===tid); if(byId) return byId; }
        // 2) correspondance par nom complet
        const nm=norm(u.full_name||u.name||'');
        if(nm){ const byName=list.find(t=>norm(teacName(t))===nm || norm(t.n||'')===nm); if(byName) return byName; }
        // 3) correspondance par email
        const em=(u.email||'').toLowerCase();
        if(em){ const byMail=list.find(t=>(t.email||'').toLowerCase()===em); if(byMail) return byMail; }
        return null; // compte connecte sans fiche enseignant : donnees reelles vides
      }
    }catch(e){}
    // Mode demo : nom de demo du role enseignant.
    const dnm=(typeof ROLES!=='undefined' && ROLES.teacher)?ROLES.teacher.name:'';
    return list.find(t=>t.n===dnm)||null;
  }
  // Fiche eleve correspondant au compte REELLEMENT connecte (espace Eleve/Parent).
  //  - Mode connecte (donnees reelles, demo videe) : on resout l'eleve via le
  //    compte authentifie (lien explicite studentId sinon correspondance par
  //    nom complet / email). Aucune fiche trouvee => null (dashboard vide, pas
  //    de chiffres de demo codes en dur).
  //  - Mode demo (hors ligne) : null (le dashboard garde la vue etablissement).
  function currentStudent(){
    // Normalisation robuste : minuscules, SANS accents, ponctuation/espaces reduits.
    const strip=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const norm=s=>strip(s).toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
    // Jeu de mots trie : compare deux noms sans tenir compte de l'ordre
    // (nom/prenom inverses) ni des accents/espaces.
    const tokens=s=>norm(s).split(' ').filter(Boolean).sort();
    const sameName=(a,b)=>{ const ta=tokens(a), tb=tokens(b); if(!ta.length||!tb.length) return false; return ta.length===tb.length && ta.every((w,i)=>w===tb[i]); };
    const list=(typeof DB!=='undefined' && DB.students)?DB.students:[];
    if(!list.length) return null;
    try{
      if(typeof apiOn==='function' && apiOn() && typeof API!=='undefined' && API.authenticated()){
        const u=API.user?API.user():null;
        if(!u) return null;
        // 1) lien explicite compte -> fiche (prioritaire, toujours respecte)
        let sid;
        if(typeof USERS!=='undefined' && u.id!=null){
          const acc=USERS.find(x=>x.apiId!=null && x.apiId===u.id);
          if(acc && acc.studentId) sid=acc.studentId;
        }
        if(sid==null) sid=u.student_id!=null?u.student_id:u.studentId;
        if(sid!=null){ const byId=list.find(s=>s.id===sid||s.apiId===sid); if(byId) return byId; }
        // 2) correspondance par matricule (present dans login/email/username/nom).
        //    On n'accepte QU'UNE seule fiche candidate (jamais exposer autrui).
        const mats=[u.matricule,u.login,u.username,(u.email||'').split('@')[0],u.name,u.full_name].map(v=>norm(v)).filter(Boolean);
        const hay=' '+mats.join(' ')+' ';
        if(mats.length){
          const byMat=list.filter(s=>{ const m=norm(s.mat); return !!m && (mats.indexOf(m)>=0 || hay.indexOf(' '+m+' ')>=0); });
          if(byMat.length===1) return byMat[0];
        }
        // 3) correspondance par nom complet (jeu de mots, ordre indifferent).
        const full=u.full_name||u.name||'';
        if(norm(full)){ const byName=list.filter(s=>sameName(stuName(s),full)); if(byName.length===1) return byName[0]; }
        // 4) correspondance par email exact (si la fiche porte un email).
        const em=norm(u.email);
        if(em){ const byMail=list.filter(s=>norm(s.email)===em); if(byMail.length===1) return byMail[0]; }
        // Non resolu : on NE devine PAS (jamais exposer un autre eleve). Trace discrete.
        try{ if(typeof console!=='undefined' && console.info) console.info('[XSchool] Compte connecte sans fiche eleve resolue (id=%s, nom=%s).', u.id, full); }catch(_){}
        return null; // compte connecte sans fiche identifiable : donnees reelles vides
      }
    }catch(e){}
    return null; // mode demo : pas d'eleve connecte specifique
  }
  function activeCycles(){ return activeSchool().cycles.filter(c=>CYCLES[c]); }
  // ---------- ANNÉES SCOLAIRES + PÉRIODES DE COMPOSITION + NOTES ----------
  const YEARS=['2024-2025','2025-2026','2026-2027'];
  // ---------- Centre d'alertes administrateur (simulation prototype) ----------
  const ALERT_CATS=[['absence','Absence',I.bell,'rose'],['paiement','Scolarité impayée',I.cash,'amber'],['reunion','Réunion / Convocation',I.cal,'sky'],['discipline','Discipline',I.shield,'rose'],['note','Notes publiées',I.grade,'emerald'],['info','Information générale',I.bell,'brand']];
  const ALERT_RULES={ absence:true, retard:true, impaye:true, note:false, echeance:true };
  const ALERT_RULE_META=[['absence','Absence non justifiée','Alerte automatique aux parents dès qu’une absence non justifiée est enregistrée.'],['retard','Retards répétés','Prévenir le parent au 3e retard sur la période.'],['impaye','Scolarité impayée','Rappel automatique à l’approche de l’échéance d’une tranche.'],['note','Publication des notes','Notifier les parents quand un bulletin / une note est publié.'],['echeance','Échéance de saisie','Rappeler aux enseignants la date limite de saisie des notes.']];
  let ALERTS=[
    {id:'al1',cat:'absence',target:'Tle F2',channel:'sms',msg:'3 absences non justifiées cette semaine.',when:'2026-10-24 08:15',count:28,by:'Administration'},
    {id:'al2',cat:'paiement',target:'Parents 1ère F1',channel:'both',msg:'Rappel : 2e tranche de scolarité à régler avant le 31/10.',when:'2026-10-22 16:40',count:32,by:'Administration'},
    {id:'al3',cat:'reunion',target:'Tous les parents',channel:'email',msg:'Réunion parents-professeurs le samedi 02/11 à 09h00.',when:'2026-10-20 11:00',count:1248,by:'Administration'}
  ];
  // ---- Moteur d'alerte automatique : absences répétées ----
  const ABS_ALERT_THRESHOLD=3; // nb d'absences déclenchant l'alerte parent
  function absenceCount(stuId){ return ATT_STORE.filter(a=>a.stu===stuId&&a.status==='absent').length; }
  // Crée une alerte « absences répétées » par élève ayant atteint le seuil ;
  // idempotent : une seule alerte par palier d'absences (seuil, seuil+1, ...).
  function checkRepeatedAbsences(){
    if(!ALERT_RULES.absence) return [];
    const created=[];
    DB.students.forEach(e=>{
      const n=absenceCount(e.id);
      if(n<ABS_ALERT_THRESHOLD) return;
      if(ALERTS.some(a=>a.auto&&a.kind==='absence'&&a.stu===e.id&&a.absN===n)) return;
      const al={ id:uid('al'), cat:'absence',
        target:'Parents '+stuName(e)+(e.cls?(' · '+clsLabel(e.cls)):''), channel:'sms',
        msg:n+' absences enregistrées. Merci de justifier auprès de la vie scolaire.',
        when:logNow(), count:1, by:'Système (auto)', auto:true, kind:'absence', stu:e.id, absN:n };
      ALERTS.unshift(al);
      logit('Alerte absences répétées', stuName(e)+' · '+n+' absences cumulées','warn');
      created.push(al);
    });
    return created;
  }
  // ---- Archivage automatique des alertes d'absences après N jours ----
  let ABS_ALERT_AUTO_ARCHIVE=true;   // option : archivage automatique activé
  const ABS_ALERT_ARCHIVE_DAYS=7;    // délai avant archivage (jours)
  function whenToDate(w){ return w?new Date(String(w).replace(' ','T')):null; }
  // Archive les alertes auto d'absences dont l'horodatage dépasse le délai.
  // Retourne le nombre d'alertes nouvellement archivées. Idempotent.
  function archiveOldAlerts(){
    if(!ABS_ALERT_AUTO_ARCHIVE) return 0;
    const limit=Date.now()-ABS_ALERT_ARCHIVE_DAYS*864e5;
    let n=0;
    ALERTS.forEach(a=>{
      if(!(a&&a.auto&&a.kind==='absence'&&!a.archived)) return;
      const d=whenToDate(a.when);
      if(d&&!isNaN(d)&&d.getTime()<limit){ a.archived=true; n++; }
    });
    if(n) logit('Alertes archivées (auto)', n+' alerte(s) de plus de '+ABS_ALERT_ARCHIVE_DAYS+' jours','info');
    return n;
  }
  // Type de periode configure PAR ANNEE SCOLAIRE, PAR CYCLE et PAR ecole, persiste
  // dans la config de l'ecole : schoolCfg().periods[annee][cycle] = 'trimestre'|'semestre'.
  // Sauvegarde en local + serveur et partage entre le directeur (qui regle) et les
  // enseignants (qui saisissent les notes). Une ecole peut donc etre en trimestre une
  // annee et en semestre la suivante. Retro-compat : ancien format plat {cycle:type}.
  function cyclePeriodType(cycle){
    const cfg=schoolCfg(); if(!cfg.periods||typeof cfg.periods!=='object') cfg.periods={};
    const byYear=cfg.periods[state.year];
    if(byYear&&typeof byYear==='object'&&(byYear[cycle]==='trimestre'||byYear[cycle]==='semestre')) return byYear[cycle];
    // ancien format plat {cycle:'trimestre'} -> fallback toutes annees
    const flat=cfg.periods[cycle];
    if(flat==='trimestre'||flat==='semestre') return flat;
    return 'trimestre';
  }
  function setPeriodType(cycle,type){
    const cfg=schoolCfg(); if(!cfg.periods||typeof cfg.periods!=='object') cfg.periods={};
    const y=state.year; if(!cfg.periods[y]||typeof cfg.periods[y]!=='object') cfg.periods[y]={};
    cfg.periods[y][cycle]=(type==='semestre'?'semestre':'trimestre'); persistCfg();
  }
  function periodList(type){ return type==='semestre'?['1er Semestre','2e Semestre']:['1er Trimestre','2e Trimestre','3e Trimestre']; }
  // Stockage des notes : clé year|cls|sub|period -> { stuId:{i,d,c} }
  const GRADES={};
  // Jeu de notes de démonstration (classe c1 · 1er Trimestre) pour illustrer les bulletins
  (function seedGrades(){
    const y='2025-2026', per='1er Trimestre';
    const set=(cls,sub,data)=>{ GRADES[y+'|'+cls+'|'+sub+'|'+per]=data; };
    set('c1','s1',{ e2:{i:'12',d:'14',c:'13'}, e4:{i:'16',d:'15',c:'17'}, e5:{i:'9',d:'11',c:'10'}, e6:{i:'14',d:'13',c:'15'}, e7:{i:'8',d:'7',c:'9'} });
    set('c1','s2',{ e2:{i:'15',d:'14',c:'15'}, e4:{i:'13',d:'14',c:'12'}, e5:{i:'12',d:'10',c:'11'}, e6:{i:'16',d:'15',c:'16'}, e7:{i:'10',d:'9',c:'11'} });
    set('c1','s8',{ e2:{i:'13',d:'12',c:'14'}, e4:{i:'14',d:'15',c:'13'}, e5:{i:'11',d:'12',c:'10'}, e6:{i:'15',d:'14',c:'13'}, e7:{i:'9',d:'10',c:'8'} });
  })();
  function gKey(cls,sub,per){ return state.year+'|'+cls+'|'+sub+'|'+per; }
  function gGet(cls,sub,per){ const k=gKey(cls,sub,per); return GRADES[k]||(GRADES[k]={}); }
  function gNum(v){ return (v===''||v==null||isNaN(+v))?null:+v; }
  // Moyenne de classe = (Interrogation + Devoir) / 2
  function moyClasse(g){ if(!g) return null; const i=gNum(g.i), d=gNum(g.d); const p=[]; if(i!=null)p.push(i); if(d!=null)p.push(d); return p.length?p.reduce((s,x)=>s+x,0)/p.length:null; }
  // Moyenne = (Composition + Moyenne de classe) / 2
  function moyenne(g){ if(!g) return null; const c=gNum(g.c), mc=moyClasse(g); const p=[]; if(mc!=null)p.push(mc); if(c!=null)p.push(c); return p.length?p.reduce((s,x)=>s+x,0)/p.length:null; }
  // Note coefficiée = Moyenne × coefficient
  function noteCoef(g,coef){ const m=moyenne(g); return m==null?null:m*(coef||1); }
  function fmtN(n){ return n==null?'–':(Math.round(n*100)/100).toString().replace('.',','); }
  // Autorisation PAR CYCLE (par école) : les enseignants peuvent-ils saisir les notes ? (défaut : oui)
  function teacherGradesAllowed(cycle){ const cfg=schoolCfg(); if(!cfg.teacherGrades) cfg.teacherGrades={}; return cfg.teacherGrades[cycle]!==false; }
  function setTeacherGrades(cycle,v){ const cfg=schoolCfg(); if(!cfg.teacherGrades) cfg.teacherGrades={}; cfg.teacherGrades[cycle]=v; persistCfg(); }
  // Date limite de saisie PAR ANNÉE + CYCLE + PÉRIODE (par école). Vide = pas de limite.
  function dlKey(cycle,per){ return state.year+'|'+cycle+'|'+per; }
  function getDeadline(cycle,per){ const cfg=schoolCfg(); if(!cfg.deadlines) cfg.deadlines={}; return cfg.deadlines[dlKey(cycle,per)]||''; }
  function setDeadline(cycle,per,d){ const cfg=schoolCfg(); if(!cfg.deadlines) cfg.deadlines={}; const k=dlKey(cycle,per); if(d) cfg.deadlines[k]=d; else delete cfg.deadlines[k]; persistCfg(); }
  function deadlinePassed(cycle,per){ const d=getDeadline(cycle,per); if(!d) return false; return new Date().toISOString().slice(0,10) > d; }
  function fmtDate(d){ if(!d) return ''; const [y,m,j]=d.split('-'); return j+'/'+m+'/'+y; }
  // Paramètres généraux de l'école (identité, notation, système)
  function schoolCfg(){ const s=activeSchool(); if(!s.cfg) s.cfg={ phone:'', email:'', address:'', director:'', logo:'', minCountry:'', minMotto:'', minName:'', minDirection:'', minInspection:'', minLogo:'', bulletinOrient:'portrait', gradeMax:20, passMark:10, bulletinTpl:'officiel', bulletinFmt:'vrac', bulletinFmtByCycle:{}, periods:{}, teacherGrades:{}, deadlines:{}, optFacCoef1:false, sms:false, whatsapp:false, sender:'XSCHOOL', rankVisible:true, avgMode:'weighted', avgDecimals:2, rankTies:true, mentions:[{l:'Excellent',min:18},{l:'Très Bien',min:16},{l:'Bien',min:14},{l:'Assez Bien',min:12},{l:'Passable',min:10}] }; if(!s.cfg.mentions){ s.cfg.avgMode=s.cfg.avgMode||'weighted'; s.cfg.avgDecimals=(s.cfg.avgDecimals==null?2:s.cfg.avgDecimals); s.cfg.rankTies=(s.cfg.rankTies==null?true:s.cfg.rankTies); s.cfg.mentions=[{l:'Excellent',min:18},{l:'Très Bien',min:16},{l:'Bien',min:14},{l:'Assez Bien',min:12},{l:'Passable',min:10}]; } if(s.cfg.bulletinFmt==null) s.cfg.bulletinFmt='vrac'; if(!s.cfg.bulletinFmtByCycle) s.cfg.bulletinFmtByCycle={}; if(!s.cfg.periods) s.cfg.periods={}; if(!s.cfg.teacherGrades) s.cfg.teacherGrades={}; if(!s.cfg.deadlines) s.cfg.deadlines={}; if(s.cfg.optFacCoef1==null) s.cfg.optFacCoef1=false; if(s.cfg.minCountry==null) s.cfg.minCountry=''; if(s.cfg.minMotto==null) s.cfg.minMotto=''; if(s.cfg.minName==null) s.cfg.minName=''; if(s.cfg.minDirection==null) s.cfg.minDirection=''; if(s.cfg.minInspection==null) s.cfg.minInspection=''; if(s.cfg.minLogo==null) s.cfg.minLogo=''; if(s.cfg.bulletinOrient==null) s.cfg.bulletinOrient='portrait'; if(!s.cfg._lsLoaded){ s.cfg._lsLoaded=true; _loadCfgOverrides(s); } return s.cfg; }
  // ---------- Persistance locale (localStorage) des parametres d'ecole ----------
  // Le backend n'expose pas d'endpoint de sauvegarde des parametres : on conserve
  // donc les reglages (logo, modele de bulletin, identite...) dans le navigateur,
  // par ecole. Ils survivent ainsi a une deconnexion / reconnexion.
  function _cfgLsKey(s){ return 'xschool-cfg:'+((s&&s.id)||'x'); }
  function _loadCfgOverrides(s){
    try{ if(typeof localStorage==='undefined') return; const raw=localStorage.getItem(_cfgLsKey(s)); if(!raw) return;
      const o=JSON.parse(raw); if(o&&typeof o==='object'){ for(const k in o){ if(k==='_lsLoaded') continue; s.cfg[k]=o[k]; } }
    }catch(e){}
  }
  function persistCfg(){
    try{ if(typeof localStorage==='undefined') return; const s=activeSchool(); if(!s||!s.cfg) return;
      const save={}; for(const k in s.cfg){ if(k==='_lsLoaded') continue; save[k]=s.cfg[k]; }
      localStorage.setItem(_cfgLsKey(s), JSON.stringify(save));
    }catch(e){}
    try{ saveCfgApi(); }catch(e){}   // write-through serveur (best-effort, async)
  }
  // Traduit le cfg (camelCase, cote front) vers le payload API (snake_case).
  function cfgToApiPayload(cfg){
    return {
      phone:cfg.phone||'', email:cfg.email||'', address:cfg.address||'', director:cfg.director||'', logo:cfg.logo||'',
      grade_max:(cfg.gradeMax!=null?cfg.gradeMax:20), pass_mark:(cfg.passMark!=null?cfg.passMark:10),
      avg_mode:cfg.avgMode||'weighted', avg_decimals:(cfg.avgDecimals!=null?cfg.avgDecimals:2),
      rank_visible:cfg.rankVisible!==false, rank_ties:cfg.rankTies!==false, opt_fac_coef1:!!cfg.optFacCoef1,
      bulletin_tpl:cfg.bulletinTpl||'officiel', bulletin_fmt:cfg.bulletinFmt||'vrac',
      bulletin_fmt_by_cycle:cfg.bulletinFmtByCycle||{}, periods:cfg.periods||{}, teacher_grades:cfg.teacherGrades||{}, deadlines:cfg.deadlines||{}, mentions:cfg.mentions||[],
      sms:!!cfg.sms, whatsapp:!!cfg.whatsapp, sender:cfg.sender||'XSCHOOL'
    };
  }
  // Sauvegarde serveur des reglages (best-effort). N'agit qu'en mode connecte
  // et pour un admin rattache a une ecole (le superadmin n'a pas d'ecole
  // courante -> on evite un appel voue a l'echec). Renvoie une promesse.
  function saveCfgApi(){
    if(!apiOn() || !API.authenticated()) return Promise.resolve(false);
    const u=API.user(); if(u && u.role==='superadmin') return Promise.resolve(false);
    const s=activeSchool(); if(!s||!s.cfg) return Promise.resolve(false);
    return API.updateCurrentSchoolConfig({ config:cfgToApiPayload(s.cfg) })
      .then(()=>true)
      .catch(ex=>{ if(typeof toast==='function') toast('Paramètres : sauvegarde serveur impossible ('+((ex&&ex.message)||'erreur')+'), gardés sur cet appareil'); return false; });
  }
  // ---------- Bulletin : helpers de calcul (consomment la config) ----------
  function avgRound(n,cfg){ cfg=cfg||schoolCfg(); let d=+cfg.avgDecimals; if(isNaN(d)) d=2; const f=Math.pow(10,d); return Math.round((+n||0)*f)/f; }
  function mentionFor(moy,cfg){ cfg=cfg||schoolCfg(); const ms=(cfg.mentions||[]).slice().filter(m=>m.l).sort((a,b)=>b.min-a.min); const hit=ms.find(m=>moy>=m.min); return hit?hit.l:'—'; }
  // Classement competition (meme logique que classBulletinData) : affecte un rang
  // par ordre decroissant de valeur ; egalites au meme rang si cfg.rankTies.
  function rankByVal(arr,getVal,setRank,cfg){
    cfg=cfg||schoolCfg();
    const withV=arr.filter(o=>getVal(o)!=null).slice().sort((a,b)=>getVal(b)-getVal(a));
    let lastMoy=null,lastRank=0;
    withV.forEach((o,i)=>{ const v=getVal(o); let rk; if(cfg.rankTies&&lastMoy!=null&&v===lastMoy){ rk=lastRank; } else { rk=i+1; lastRank=rk; } lastMoy=v; setRank(o,rk); });
    arr.filter(o=>getVal(o)==null).forEach(o=>setRank(o,null));
  }
  // ---------- Agregation ANNUELLE d'une classe (bulletin officiel) ----------
  // Par eleve : moyenne generale + rang de CHAQUE periode, moyenne annuelle + rang,
  // et (utile au modele semestriel) la moyenne + rang par matiere/periode + annuel.
  // Miroir client de GET /api/bulletins/class/<id>. Fonctionne 100% hors-ligne.
  function classYearAgg(clsId){
    const cls=getCls(clsId); if(!cls) return null;
    const cfg=schoolCfg();
    const ptype=cyclePeriodType(cls.cycle);
    const pers=periodList(ptype);
    const subs=DB.program.filter(p=>p.cls===clsId).map(p=>({sub:getSub(p.sub),coef:p.coef,oblig:p.oblig,spec:p.spec})).filter(x=>x.sub);
    const studs=studentsInClass(clsId);
    // Donnees deja calculees periode par periode (moyGen + rang + lignes matieres)
    const perData=pers.map(per=>classBulletinData(clsId,per));
    const byStu={};
    studs.forEach(e=>{ byStu[e.id]={ stu:e, per:pers.map(()=>({moyGen:null,rank:null})), subj:{}, annualMoy:null, annualRank:null }; });
    perData.forEach((d,pi)=>{
      d.rows.forEach(r=>{
        const o=byStu[r.stu.id]; if(!o) return;
        o.per[pi]={ moyGen:r.moyGen, rank:r.rank };
        r.lines.forEach(l=>{
          const sid=l.sub.id;
          if(!o.subj[sid]) o.subj[sid]={ sub:l.sub, coef:l.coef, oblig:l.oblig, spec:!!l.spec, dom:l.dom, fac:!!l.fac, per:pers.map(()=>null), perRank:pers.map(()=>null), annual:null, annualRank:null };
          o.subj[sid].per[pi]=l.moy;
        });
      });
    });
    // Moyenne annuelle (eleve) = moyenne des moyennes generales disponibles
    studs.forEach(e=>{ const o=byStu[e.id]; const vals=o.per.map(p=>p.moyGen).filter(v=>v!=null); o.annualMoy=vals.length?avgRound(vals.reduce((s,x)=>s+x,0)/vals.length,cfg):null; });
    rankByVal(studs.map(e=>byStu[e.id]),o=>o.annualMoy,(o,rk)=>o.annualMoy!=null?o.annualRank=rk:o.annualRank=null,cfg);
    // Niveau matiere : rang par periode, moyenne annuelle + rang
    subs.forEach(({sub})=>{
      const sid=sub.id;
      pers.forEach((per,pi)=>{
        const arr=studs.map(e=>byStu[e.id]).filter(o=>o.subj[sid]);
        rankByVal(arr,o=>o.subj[sid].per[pi],(o,rk)=>{ o.subj[sid].perRank[pi]=rk; },cfg);
      });
      studs.forEach(e=>{ const o=byStu[e.id]; if(!o.subj[sid]) return; const vals=o.subj[sid].per.filter(v=>v!=null); o.subj[sid].annual=vals.length?avgRound(vals.reduce((s,x)=>s+x,0)/vals.length,cfg):null; });
      const arr=studs.map(e=>byStu[e.id]).filter(o=>o.subj[sid]);
      rankByVal(arr,o=>o.subj[sid].annual,(o,rk)=>{ o.subj[sid].annualRank=rk; },cfg);
    });
    const rows=studs.map(e=>byStu[e.id]).sort((a,b)=>{ if(a.annualMoy==null&&b.annualMoy==null) return 0; if(a.annualMoy==null) return 1; if(b.annualMoy==null) return -1; return b.annualMoy-a.annualMoy; });
    return { cls, cfg, ptype, pers, subs, rows, perData };
  }
  let _seq=100; const uid=p=>p+(++_seq);
  const DB={
    subjects:[
      {id:'s1',n:'Mathématiques',dom:'sci'},{id:'s2',n:'Français',dom:'litt'},
      {id:'s3',n:'Physique-Chimie',dom:'sci'},{id:'s4',n:'Histoire-Géo',dom:'litt'},
      {id:'s5',n:'Anglais',dom:'litt'},{id:'s6',n:'EPS',dom:'autre'},
      {id:'s7',n:'Atelier / Techno',dom:'sci'},{id:'s8',n:'Philosophie',dom:'litt'}
    ],
    classes:[
      {id:'c1',cycle:'Lycée Moderne',name:'Tle D',grp:''},
      {id:'c2',cycle:'Cycle Industriel',name:'Tle F2',grp:''},
      {id:'c3',cycle:'Collège',name:'3ᵉme',grp:'A'},
      {id:'c4',cycle:'Cycle Professionnel',name:'BT2 Comptabilité',grp:'',spec:'BT · Comptabilité'}
    ],
    teachers:[
      {id:'t1',n:'Mme Sarr',nom:'Sarr',prenom:'Aminata',dob:'1985-04-12',dip:'Master en Lettres',spec:'Français',tel:'+228 90 12 34 56',urgNom:'Ousmane Sarr (époux)',urgTel:'+228 91 00 00 01',photo:'',subs:['s1','s3'],cls:['c1','c2']},
      {id:'t2',n:'M. Ndiaye',nom:'Ndiaye',prenom:'Cheikh',dob:'1979-09-28',dip:'CAPES',spec:'Mathématiques',tel:'+228 92 22 11 00',urgNom:'Awa Ndiaye (épouse)',urgTel:'+228 93 44 55 66',photo:'',subs:['s3'],cls:['c2']},
      {id:'t3',n:'Mme Fall',nom:'Fall',prenom:'Rokhaya',dob:'1990-01-15',dip:'Licence SVT',spec:'Sciences de la Vie et de la Terre',tel:'+228 97 88 99 00',urgNom:'Modou Fall (frère)',urgTel:'+228 96 77 88 99',photo:'',subs:['s2','s8'],cls:['c1','c3']}
    ],
    students:[
      {id:'e1',mat:'2026-0481',nom:'Mensah',prenom:'Kofi',dob:'2009-03-12',sexe:'M',lieu:'Lomé',pere:'Mensah Ayité',pereTel:'+228 90 11 22 33',mere:'Akossiwa Mensah',mereTel:'+228 91 44 55 66',cls:'c2',st:'Externe',statut:'Nouveau',photo:'',year:'2025-2026',enrollments:[{year:'2025-2026',cls:'c2',statut:'Nouveau'}]},
      {id:'e2',mat:'2026-0482',nom:'Diallo',prenom:'Aïcha',dob:'2008-11-05',sexe:'F',lieu:'Kara',pere:'Diallo Amadou',pereTel:'+228 92 33 44 55',mere:'Fatou Diallo',mereTel:'+228 93 66 77 88',cls:'c1',st:'Interne',statut:'Redoublant',photo:'',year:'2025-2026',enrollments:[{year:'2024-2025',cls:'c1',statut:'Nouveau'},{year:'2025-2026',cls:'c1',statut:'Redoublant'}]},
      {id:'e3',mat:'2026-0483',nom:'Traoré',prenom:'Moussa',dob:'2010-07-21',sexe:'M',lieu:'Sokodé',pere:'Traoré Ibrahim',pereTel:'+228 94 00 11 22',mere:'Mariam Traoré',mereTel:'+228 95 22 33 44',cls:'c3',st:'Externe',statut:'Nouveau',photo:'',year:'2025-2026',enrollments:[{year:'2025-2026',cls:'c3',statut:'Nouveau'}]},
      {id:'e4',mat:'2026-0484',nom:'Koffi',prenom:'Ama',dob:'2008-05-09',sexe:'F',lieu:'Lomé',pere:'Koffi Koÿo',pereTel:'+228 90 55 44 11',mere:'Adélaïde Koffi',mereTel:'+228 91 22 33 44',cls:'c1',st:'Externe',statut:'Nouveau',photo:'',year:'2025-2026',enrollments:[{year:'2025-2026',cls:'c1',statut:'Nouveau'}]},
      {id:'e5',mat:'2026-0485',nom:'Agbeko',prenom:'Edem',dob:'2008-02-18',sexe:'M',lieu:'Kpalimé',pere:'Agbeko Yao',pereTel:'+228 92 11 00 55',mere:'Afi Agbeko',mereTel:'+228 93 77 11 22',cls:'c1',st:'Interne',statut:'Nouveau',photo:'',year:'2025-2026',enrollments:[{year:'2025-2026',cls:'c1',statut:'Nouveau'}]},
      {id:'e6',mat:'2026-0486',nom:'Sow',prenom:'Bineta',dob:'2008-12-30',sexe:'F',lieu:'Dapaong',pere:'Sow Mamadou',pereTel:'+228 97 44 55 66',mere:'Khady Sow',mereTel:'+228 96 33 22 11',cls:'c1',st:'Externe',statut:'Nouveau',photo:'',year:'2025-2026',enrollments:[{year:'2025-2026',cls:'c1',statut:'Nouveau'}]},
      {id:'e7',mat:'2026-0487',nom:'Lawson',prenom:'Komi',dob:'2008-08-14',sexe:'M',lieu:'Aného',pere:'Lawson Paul',pereTel:'+228 90 99 88 77',mere:'Rose Lawson',mereTel:'+228 91 66 55 44',cls:'c1',st:'Externe',statut:'Redoublant',photo:'',year:'2025-2026',enrollments:[{year:'2024-2025',cls:'c1',statut:'Nouveau'},{year:'2025-2026',cls:'c1',statut:'Redoublant'}]}
    ],
    program:[
      {cls:'c1',sub:'s1',coef:5,oblig:true,spec:true},
      {cls:'c1',sub:'s2',coef:3,oblig:true,spec:false},
      {cls:'c1',sub:'s8',coef:3,oblig:true,spec:false},
      {cls:'c2',sub:'s1',coef:4,oblig:true,spec:false},
      {cls:'c2',sub:'s7',coef:6,oblig:true,spec:true}
    ]
  };
  const getCls=id=>DB.classes.find(c=>c.id===id);
  const getSub=id=>DB.subjects.find(s=>s.id===id);
  const clsLabel=id=>{ const c=getCls(id); return c?(c.name+(c.grp?' · Gr.'+c.grp:'')):'—'; };
  const stuName=e=>(((e.nom||'')+' '+(e.prenom||'')).trim())||e.n||'—';
  const teacName=t=>(((t.nom||'')+' '+(t.prenom||'')).trim())||t.n||'—';
  // ---------- Inscriptions par année scolaire (historique de classe) ----------
  function ensureEnroll(e){ if(!Array.isArray(e.enrollments)){ e.enrollments=[]; } if(!e.enrollments.length){ e.enrollments.push({year:e.year||state.year,cls:e.cls||'',statut:e.statut||'Nouveau'}); } if(!e.year) e.year=e.enrollments[e.enrollments.length-1].year; return e.enrollments; }
  function enrollFor(e,year){ ensureEnroll(e); return e.enrollments.find(x=>x.year===year)||null; }
  function setEnroll(e,year,cls,statut){ ensureEnroll(e); const en=e.enrollments.find(x=>x.year===year); if(en){ en.cls=cls; if(statut!=null) en.statut=statut; } else { e.enrollments.push({year,cls,statut:statut||'Nouveau'}); } }
  function studentsOfYear(year){ return DB.students.filter(e=>!!enrollFor(e,year)); }
  // ---------- Appartenance a une classe PAR ANNEE SCOLAIRE (via inscriptions) ----------
  // clsOfYear : classe effective de l'eleve pour l'annee demandee.
  //   - renvoie l'id de classe si l'eleve est inscrit cette annee-la ;
  //   - '' s'il est inscrit sans classe ;
  //   - null s'il n'etait pas (encore) inscrit cette annee (il disparait alors des filtres).
  // Repli retro-compat : si aucune inscription explicite mais que l'annee demandee
  // est l'annee de reference de l'eleve, on prend e.cls.
  function clsOfYear(e,year){ year=year||state.year; const en=enrollFor(e,year); if(en) return en.cls||''; if((e.year||'')===year) return e.cls||''; return null; }
  // Eleves inscrits dans une classe pour une annee (defaut : annee active).
  function studentsInClass(clsId,year){ year=year||state.year; return DB.students.filter(e=>clsOfYear(e,year)===clsId); }
  // Eleves inscrits cette annee mais sans classe affectee.
  function studentsNoClass(year){ year=year||state.year; return DB.students.filter(e=>clsOfYear(e,year)===''); }
  // ---------- Coherence annee/classe (bulletin eleve/parent) ----------
  // Annees ou l'eleve est inscrit AVEC une classe (via enrollments + retro-compat).
  function studentClassYears(e){ if(!e) return []; ensureEnroll(e); const ys=new Set();
    (e.enrollments||[]).forEach(x=>{ if(x&&x.year&&x.cls) ys.add(x.year); });
    if(e.year&&e.cls) ys.add(e.year);
    return YEARS.filter(y=>ys.has(y)); }
  // Annees ou l'eleve possede au moins une note exploitable (moyenne calculable).
  function studentGradeYears(e){ if(!e) return []; const ys=new Set();
    for(const k in GRADES){ const cell=GRADES[k]&&GRADES[k][e.id]; if(cell&&moyenne(cell)!=null) ys.add(k.split('|')[0]); }
    return YEARS.filter(y=>ys.has(y)); }
  function yearStats(year){ const list=studentsOfYear(year); let f=0,m=0,red=0,nouv=0,sans=0; list.forEach(e=>{ const en=enrollFor(e,year); if(e.sexe==='F') f++; else m++; if((en.statut||'')==='Redoublant') red++; else nouv++; if(!en.cls) sans++; }); return {total:list.length,f,m,red,nouv,sans,list}; }
  // Renvoie true si une annee scolaire possede des donnees rattachees (inscriptions, notes, paiements, discipline).
  // Sert de garde-fou pour interdire la suppression d'une annee non vide.
  function yearHasData(year){
    if(!year) return false;
    // Eleves inscrits cette annee (via enrollments ou retro-compat e.year)
    if(DB.students.some(e=>!!enrollFor(e,year) || (e.year||'')===year)) return true;
    // Notes saisies cette annee (cle 'year|cls|sub|per')
    const pfx=year+'|';
    for(const k in GRADES){ if(k.indexOf(pfx)===0 && Object.keys(GRADES[k]||{}).length) return true; }
    // Paiements rattaches a cette annee
    if(typeof PAY_STORE!=='undefined' && PAY_STORE.some(p=>p.year===year)) return true;
    // Incidents de discipline rattaches a cette annee
    if(typeof DISC_STORE!=='undefined' && DISC_STORE.some(d=>d.year===year)) return true;
    return false;
  }

  /* ---------- INDICATEURS DYNAMIQUES (tableaux de bord) ----------
   * Tout est calcule a la volee a partir des donnees en memoire (reelles en
   * mode API). Aucune valeur n'est codee en dur : si une donnee manque, on
   * renvoie null -> l'affichage montre « — ». */
  function fmtMoney(n){ n=+n||0; const neg=n<0; n=Math.abs(n);
    let out; if(n>=1e6) out=(Math.round(n/1e5)/10).toString().replace('.',',')+' M';
    else if(n>=1e3) out=Math.round(n/1e3)+' k'; else out=String(Math.round(n));
    return (neg?'-':'')+out; }
  function pctStr(n){ return n==null?'—':(n+'%'); }
  function numStr(n){ return n==null?'—':String(n); }
  function _attLatestDate(){ let d=''; for(let i=0;i<ATT_STORE.length;i++){ const x=ATT_STORE[i].date||''; if(x>d) d=x; } return d; }
  function attendanceRate(){ if(!ATT_STORE.length) return null; const ok=ATT_STORE.filter(a=>a.status==='present'||a.status==='retard').length; return Math.round(ok/ATT_STORE.length*100); }
  function attByStatusLatest(status){ const d=_attLatestDate(); if(!d) return 0; return ATT_STORE.filter(a=>a.date===d&&a.status===status).length; }
  function callsDoneLatest(){ const d=_attLatestDate(); if(!d) return 0; const s=new Set(); ATT_STORE.forEach(a=>{ if(a.date===d) s.add(a.cls); }); return s.size; }
  function totalEncaisse(year){ year=year||state.year; return PAY_STORE.filter(p=>!p.year||p.year===year).reduce((s,p)=>s+(+p.amount||0),0); }
  function studentsWithPayment(year){ year=year||state.year; const paid=new Set(); PAY_STORE.forEach(p=>{ if(!p.year||p.year===year) paid.add(p.stu); }); return paid; }
  function recouvrementPct(year){ year=year||state.year; const studs=studentsOfYear(year); if(!studs.length) return null; const paid=studentsWithPayment(year); let n=0; studs.forEach(e=>{ if(paid.has(e.id)) n++; }); return Math.round(n/studs.length*100); }
  function unpaidCount(year){ year=year||state.year; const studs=studentsOfYear(year); const paid=studentsWithPayment(year); return studs.filter(e=>!paid.has(e.id)).length; }
  function schoolAverage(){ let sum=0,cnt=0; const pfx=state.year+'|'; for(const k in GRADES){ if(k.indexOf(pfx)!==0) continue; const data=GRADES[k]; for(const sid in data){ const m=moyenne(data[sid]); if(m!=null){ sum+=m; cnt++; } } } return cnt?sum/cnt:null; }
  function gradesPendingCount(){ let n=0; const pfx=state.year+'|'; DB.program.forEach(pr=>{ let has=false; const key=pfx+pr.cls+'|'+pr.sub+'|'; for(const k in GRADES){ if(k.indexOf(key)===0){ has=true; break; } } if(!has) n++; }); return n; }
  // ---------- Helpers PERIMETRE ENSEIGNANT ----------
  // Tout ce qui suit ne considere QUE les classes/matieres reellement
  // attribuees a l'enseignant (me.cls / me.subs), jamais l'etablissement entier.
  // Classes attribuees (objets classe), limitees aux cycles actifs de l'ecole.
  function teacherClasses(me){
    if(!me||!Array.isArray(me.cls)) return [];
    const cyc=activeCycles();
    return me.cls.map(getCls).filter(c=>c&&cyc.includes(c.cycle));
  }
  // Matieres attribuees (objets matiere).
  function teacherSubjects(me){
    if(!me||!Array.isArray(me.subs)) return [];
    return me.subs.map(getSub).filter(Boolean);
  }
  // Lignes de programme (classe+matiere) qui relevent de l'enseignant :
  // la classe est dans me.cls ET la matiere dans me.subs.
  function teacherProgram(me){
    if(!me) return [];
    const cls=new Set((me.cls||[])), subs=new Set((me.subs||[]));
    const cyc=activeCycles();
    return DB.program.filter(p=>{ if(!cls.has(p.cls)||!subs.has(p.sub)) return false; const c=getCls(p.cls); return c&&cyc.includes(c.cycle); });
  }
  // Saisies en attente pour l'enseignant : par ligne de programme (classe+matiere+
  // periode du cycle), on compte celles sans aucune note enregistree.
  function teacherPendingCount(me){
    if(!me) return 0; let n=0; const pfx=state.year+'|';
    teacherProgram(me).forEach(pr=>{
      const c=getCls(pr.cls); if(!c) return;
      const pers=periodList(cyclePeriodType(c.cycle));
      pers.forEach(per=>{ const store=GRADES[pfx+pr.cls+'|'+pr.sub+'|'+per];
        const has=store&&Object.keys(store).some(sid=>moyenne(store[sid])!=null);
        if(!has) n++; });
    });
    return n;
  }
  // Moyenne calculee UNIQUEMENT sur les notes des eleves des classes de
  // l'enseignant, pour ses matieres (toutes periodes du cycle). null si vide.
  function teacherAverage(me){
    if(!me) return null; let sum=0,cnt=0; const pfx=state.year+'|';
    teacherProgram(me).forEach(pr=>{
      const c=getCls(pr.cls); if(!c) return;
      const studs=new Set(studentsInClass(pr.cls).map(e=>e.id));
      const pers=periodList(cyclePeriodType(c.cycle));
      pers.forEach(per=>{ const store=GRADES[pfx+pr.cls+'|'+pr.sub+'|'+per]; if(!store) return;
        for(const sid in store){ if(!studs.has(sid)) continue; const m=moyenne(store[sid]); if(m!=null){ sum+=m; cnt++; } } });
    });
    return cnt?sum/cnt:null;
  }
  function periodsWithGrades(){ const pfx=state.year+'|'; const pers=new Set(); for(const k in GRADES){ if(k.indexOf(pfx)!==0) continue; if(Object.keys(GRADES[k]||{}).length){ const parts=k.split('|'); pers.add(parts[3]); } } return pers.size; }
  // ---------- Helpers PERIMETRE ELEVE (espace Eleve / Parent) ----------
  // Tout ce qui suit ne considere QUE l'eleve passe en argument (ses notes, sa
  // presence, ses bulletins), jamais l'etablissement entier. null si aucune donnee.
  // Matieres suivies par l'eleve = programme de sa classe de l'annee active.
  function studentSubjects(e){ if(!e) return []; const cls=clsOfYear(e,state.year); return cls?DB.program.filter(p=>p.cls===cls):[]; }
  // Moyenne generale de l'eleve : moyenne (ponderee par coef) de ses notes sur
  // toutes les matieres/periodes enregistrees de sa classe (annee active).
  function studentMoyenne(e){
    if(!e) return null; const cls=clsOfYear(e,state.year); if(!cls) return null;
    const coefOf={}; DB.program.filter(p=>p.cls===cls).forEach(p=>{ coefOf[p.sub]=(+p.coef||1); });
    const pfx=state.year+'|'+cls+'|'; let sum=0,cnt=0;
    for(const k in GRADES){ if(k.indexOf(pfx)!==0) continue; const cell=GRADES[k][e.id]; if(!cell) continue; const m=moyenne(cell); if(m==null) continue; const sub=k.split('|')[2]; const co=coefOf[sub]||1; sum+=m*co; cnt+=co; }
    return cnt?sum/cnt:null;
  }
  // Taux de presence PROPRE a l'eleve (present+retard / total de ses releves).
  function studentAttendanceRate(e){ if(!e) return null; const rows=ATT_STORE.filter(a=>a.stu===e.id); if(!rows.length) return null; const ok=rows.filter(a=>a.status==='present'||a.status==='retard').length; return Math.round(ok/rows.length*100); }
  // Nombre de retards de l'eleve.
  function studentLateCount(e){ if(!e) return 0; return ATT_STORE.filter(a=>a.stu===e.id&&a.status==='retard').length; }
  // Nombre de periodes pour lesquelles l'eleve a au moins une note (bulletins dispo).
  function studentPeriodsWithGrades(e){ if(!e) return 0; const cls=clsOfYear(e,state.year); if(!cls) return 0; const pfx=state.year+'|'+cls+'|'; const pers=new Set(); for(const k in GRADES){ if(k.indexOf(pfx)!==0) continue; if(GRADES[k][e.id]) pers.add(k.split('|')[3]); } return pers.size; }
  // ---- Scolarite PROPRE a l'eleve : bareme annuel par cycle + calcul paye/du ----
  // Bareme annuel (FCFA) aligne sur la grille affichee cote admin (schedules()).
  const FEE_BAREME={
    'Préscolaire':100000,'Primaire':100000,'Collège':120000,
    'Lycée Moderne':180000,'Lycée Technique':180000,
    'Cycle Industriel':220000,'Cycle Professionnel':200000
  };
  function cycleAnnualFee(cycle){ return FEE_BAREME[cycle]||120000; }
  // Repartition en 3 tranches : 40% / 30% / 30% (la 3e absorbe l'arrondi).
  function feeTranches(total){ total=+total||0; const t1=Math.round(total*0.4), t2=Math.round(total*0.3); return [t1,t2,Math.max(0,total-t1-t2)]; }
  // Total deja paye par l'eleve pour l'annee (PAY_STORE, meme logique que totalEncaisse).
  function studentPaid(e,year){ year=year||state.year; if(!e) return 0; return PAY_STORE.filter(p=>p.stu===e.id&&(!p.year||p.year===year)).reduce((s,p)=>s+(+p.amount||0),0); }
  // Liste des recus/paiements de l'eleve, du plus recent au plus ancien.
  function studentPayments(e,year){ year=year||state.year; if(!e) return []; return PAY_STORE.filter(p=>p.stu===e.id&&(!p.year||p.year===year)).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))); }
  // Situation complete de scolarite de l'eleve pour l'annee active.
  function studentFeeInfo(e,year){
    year=year||state.year; if(!e) return null;
    const clsId=clsOfYear(e,year); if(!clsId) return null;
    const cls=getCls(clsId); if(!cls) return null;
    const total=cycleAnnualFee(cls.cycle);
    const paid=studentPaid(e,year);
    const due=Math.max(0,total-paid);
    return { cls, total, paid, due, tranches:feeTranches(total), pct: total?Math.min(100,Math.round(paid/total*100)):0 };
  }
  // Abrege un nom de cycle pour l'axe du diagramme (ex: "Cycle Industriel" -> "Industriel").
  function cycleShort(c){ return String(c||'').replace('Cycle ','').replace('Lycee ','Lyc. ').replace('Lyc\u00e9e ','Lyc. ').replace('Pr\u00e9scolaire','Pr\u00e9sco.'); }
  // Donnees REELLES du diagramme d'accueil, calculees a la volee pour l'annee
  // active et l'ecole active (aucune valeur codee en dur).
  //   kind='recettes' -> somme des paiements par cycle ;
  //   sinon           -> effectif (nb d'eleves) par cycle.
  function dashChartData(kind){
    const year=state.year, cycles=activeCycles();
    const map={}; cycles.forEach(c=>{ map[c]=0; });
    if(kind==='recettes'){
      PAY_STORE.forEach(p=>{ if(p.year&&p.year!==year) return; const st=DB.students.find(s=>s.id===p.stu); if(!st) return;
        const en=enrollFor(st,year); const cl=en&&en.cls?getCls(en.cls):null; const cy=cl&&cl.cycle;
        if(cy&&Object.prototype.hasOwnProperty.call(map,cy)) map[cy]+=(+p.amount||0); });
    } else {
      studentsOfYear(year).forEach(e=>{ const en=enrollFor(e,year); const cl=en&&en.cls?getCls(en.cls):null; const cy=cl&&cl.cycle;
        if(cy&&Object.prototype.hasOwnProperty.call(map,cy)) map[cy]++; });
    }
    const keep=cycles.filter(c=>map[c]>0);
    return { labels:keep.map(cycleShort), data:keep.map(c=>map[c]) };
  }
  // ---------- UTILISATEURS, RÔLES & PERMISSIONS (RBAC par utilisateur) ----------
  const ROLE_LABELS={ admin:'Administration', teacher:'Enseignant', surveillant:'Surveillant', comptable:'Comptable', student:'Élève / Parent' };
  // Catalogue des permissions gérées
  const PERM_DEFS=[
    ['manage_students','Gérer les élèves'],
    ['manage_classes','Gérer classes / matières / programmes'],
    ['enter_grades','Saisir les notes'],
    ['validate_grades','Valider / verrouiller les notes'],
    ['manage_timetable','Gérer les emplois du temps'],
    ['take_attendance','Faire l\'appel / présences'],
    ['discipline','Gérer la discipline'],
    ['view_finance','Consulter la scolarité'],
    ['manage_finance','Encaisser / gérer les paiements'],
    ['send_notify','Envoyer des alertes aux parents'],
    ['school_settings','Paramètres de l\'école'],
    ['manage_users','Gérer les utilisateurs & rôles']
  ];
  // Permissions par défaut selon le rôle
  const ROLE_PERMS={
    admin:{ manage_students:1,manage_classes:1,enter_grades:1,validate_grades:1,manage_timetable:1,take_attendance:1,discipline:1,view_finance:1,manage_finance:1,send_notify:1,school_settings:1,manage_users:1 },
    teacher:{ enter_grades:1,take_attendance:1 },
    surveillant:{ take_attendance:1,discipline:1,send_notify:1 },
    comptable:{ view_finance:1,manage_finance:1 },
    student:{ }
  };
  let USERS=[
    {id:'u1',name:'M. Dupont',email:'direction@lyceemoderne.tg',role:'admin',active:true,schoolId:'sc1',perms:{}},
    {id:'u2',name:'Mme Sarr',email:'sarr@lyceemoderne.tg',role:'teacher',active:true,schoolId:'sc1',perms:{}},
    {id:'u3',name:'M. Ba',email:'surveillance@lyceemoderne.tg',role:'surveillant',active:true,schoolId:'sc1',perms:{}},
    {id:'u4',name:'Mme Either',email:'compta@lyceemoderne.tg',role:'comptable',active:true,schoolId:'sc1',perms:{}},
    {id:'u5',name:'M. Agbeko',email:'direction@palmiers.tg',role:'admin',active:true,schoolId:'sc2',perms:{}},
    {id:'u6',name:'Mme Toure',email:'compta@palmiers.tg',role:'comptable',active:true,schoolId:'sc2',perms:{}},
    {id:'u7',name:'Mme Lawson',email:'p.lawson@palmiers.tg',role:'teacher',active:false,schoolId:'sc2',perms:{}},
    {id:'u8',name:'M. El Hadj',email:'direction@elhadj.tg',role:'admin',active:true,schoolId:'sc3',perms:{}},
    {id:'u9',name:'M. Mensah',email:'surveillance@elhadj.tg',role:'surveillant',active:true,schoolId:'sc3',perms:{}}
  ];
  function schoolNameById(id){ const s=SCHOOLS.find(x=>x.id===id); return s?s.name:'—'; }
  function schoolCodeById(id){ const s=SCHOOLS.find(x=>x.id===id); return s?s.code:'—'; }
  // ---------- JOURNAUX D'AUDIT (simulation prototype, en mémoire) ----------
  let LOG_SEQ=0;
  function logNow(){ const d=new Date(); const p=n=>String(n).padStart(2,'0'); return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes()); }
  function logit(action,detail,level,school){ LOGS.unshift({id:'lg'+(++LOG_SEQ), when:logNow(), school:school||state.schoolId, user:(typeof ROLES!=='undefined'&&ROLES[state.role]?ROLES[state.role].name:'Système'), role:state.role, action:action, detail:detail||'', ip:'127.0.0.1', level:level||'ok'}); if(LOGS.length>500) LOGS.length=500; }
  let LOGS=[
    {id:'lg_s1',when:'2026-10-25 07:14',school:'sc1',user:'M. Dupont',role:'admin',action:'Connexion',detail:'Authentification réussie',ip:'10.0.2.4',level:'ok'},
    {id:'lg_s2',when:'2026-10-25 07:02',school:'sc2',user:'M. Agbeko',role:'admin',action:'Connexion',detail:'Authentification réussie',ip:'41.207.0.12',level:'ok'},
    {id:'lg_s3',when:'2026-10-24 22:47',school:'sc3',user:'Inconnu',role:'—',action:'Échec de connexion',detail:'Mot de passe invalide (3 tentatives)',ip:'102.64.9.31',level:'error'},
    {id:'lg_s4',when:'2026-10-24 18:20',school:'sc1',user:'Mme Either',role:'comptable',action:'Paiement enregistré',detail:'Reçu #1204 · 50 000 FCFA',ip:'10.0.2.9',level:'ok'},
    {id:'lg_s5',when:'2026-10-24 16:05',school:'sc1',user:'M. Dupont',role:'admin',action:'Modification de rôle',detail:'Mme Sarr → Enseignant',ip:'10.0.2.4',level:'warn'},
    {id:'lg_s6',when:'2026-10-24 11:32',school:'sc2',user:'M. Agbeko',role:'admin',action:'Création utilisateur',detail:'Nouveau compte : Mme Toure (Comptable)',ip:'41.207.0.12',level:'ok'},
    {id:'lg_s7',when:'2026-10-23 20:10',school:'sc1',user:'Système',role:'—',action:'Sauvegarde automatique',detail:'Export quotidien de la base effectué',ip:'127.0.0.1',level:'info'},
    {id:'lg_s8',when:'2026-10-23 14:58',school:'sc3',user:'M. El Hadj',role:'admin',action:'Compte désactivé',detail:'Mme Lawson (Enseignant) suspendue',ip:'102.64.9.5',level:'warn'},
    {id:'lg_s9',when:'2026-10-23 09:15',school:'sc1',user:'M. Ba',role:'surveillant',action:'Alerte envoyée',detail:'28 SMS parents — absences Tle F2',ip:'10.0.2.7',level:'ok'},
    {id:'lg_s10',when:'2026-10-22 23:41',school:'sc2',user:'Système',role:'—',action:'Pic de charge',detail:'Latence API 820 ms (seuil 500 ms)',ip:'127.0.0.1',level:'warn'}
  ];
  // Permission effective = override utilisateur sinon défaut du rôle
  function permDefault(role,key){ return !!(ROLE_PERMS[role]&&ROLE_PERMS[role][key]); }
  function hasPerm(user,key){ if(!user) return false; if(user.perms&&key in user.perms) return !!user.perms[key]; return permDefault(user.role,key); }
  function isPermOverridden(user,key){ return !!(user.perms&&key in user.perms); }
  // Recadrage auto : recadre au centre en carré puis redimensionne (sortie JPEG compacte)
  function cropPhoto(src,size,cb){
    const img=new Image();
    img.onload=()=>{
      const s=Math.min(img.width,img.height);
      const sx=(img.width-s)/2, sy=(img.height-s)/2;
      const cv=document.createElement('canvas'); cv.width=size; cv.height=size;
      const ctx=cv.getContext('2d');
      ctx.drawImage(img,sx,sy,s,s,0,0,size,size);
      try{ cb(cv.toDataURL('image/jpeg',0.85)); }catch(_){ cb(src); }
    };
    img.onerror=()=>cb(src);
    img.src=src;
  }
  const DOM={sci:['Scientifique','sky'],litt:['Littéraire','rose'],autre:['Général','slate']};
  // ---------- EMPLOI DU TEMPS (données partagées, CRUD admin & surveillant) ----------
  const TT_TEACHERS=['Mme Sarr','M. Ndiaye','Mme Fall','M. Koné'];
  const TT_SUBJ={M:['Math','brand'],F:['Franç.','rose'],P:['Phys.','sky'],A:['Atelier','emerald'],E:['EPS','amber'],H:['Hist-Géo','slate'],I:['Info','teal']};
  const TT_TEACH={M:'Mme Sarr',F:'Mme Fall',P:'M. Ndiaye',A:'M. Koné',E:'M. Koné',H:'Mme Fall',I:'M. Ndiaye'};
  const TT_STORE={};
  // Persistance locale de l'emploi du temps (le backend ne stocke pas encore les
  // grilles). On sauvegarde tout TT_STORE dans le navigateur : une grille videe
  // puis recreee est ainsi conservee apres rechargement. Les ids de classe sont
  // globalement uniques, une seule cle suffit.
  let _ttLoaded=false;
  function ttEnsureLoaded(){
    if(_ttLoaded) return; _ttLoaded=true;
    try{ if(typeof localStorage==='undefined') return; const raw=localStorage.getItem('xschool-tt'); if(!raw) return;
      const o=JSON.parse(raw); if(o&&typeof o==='object'){ for(const k in o){ TT_STORE[k]=o[k]; } }
    }catch(e){}
  }
  function persistTT(){
    try{ if(typeof localStorage==='undefined') return; _ttLoaded=true; localStorage.setItem('xschool-tt', JSON.stringify(TT_STORE)); }catch(e){}
  }
  // ---------- COMPTABILITÉ : encaissements ----------
  const PAY_MODES=[['especes','Espèces'],['momo','Mobile Money'],['virement','Virement bancaire'],['cheque','Chèque']];
  const payIsBank=m=>m==='virement'||m==='cheque';
  const payModeLabel=m=>(PAY_MODES.find(x=>x[0]===m)||['',m])[1];
  let PAY_SEQ=1205;
  let PAY_STORE=[
    {id:'p1',stu:'e2',amount:50000,mode:'especes',date:'2026-10-20',ref:'',bank:'',recu:'#1204'},
    {id:'p2',stu:'e1',amount:25000,mode:'momo',date:'2026-10-19',ref:'MM-77810',bank:'',recu:'#1203'},
    {id:'p3',stu:'e3',amount:75000,mode:'virement',date:'2026-10-18',ref:'BRD-0098',bank:'Ecobank',recu:'#1202'}
  ];
  // ---- Registre de discipline (demo hors-ligne) ----
  let DISC_SEQ=3;
  let DISC_STORE=[
    {id:'d3',stu:'e3',date:'2026-10-21',motif:'Absence non justifiée',gravite:'moyenne',year:'2026-2027'},
    {id:'d2',stu:'e1',date:'2026-10-18',motif:'Retard répété (3 fois)',gravite:'legere',year:'2026-2027'},
    {id:'d1',stu:'e2',date:'2026-10-15',motif:'Comportement perturbateur en classe',gravite:'moyenne',year:'2026-2027'}
  ];
  const GRAVITES=[['legere','Légère','amber'],['moyenne','Moyenne','amber'],['grave','Grave','rose']];
  const graviteLabel=g=>{ const x=GRAVITES.find(v=>v[0]===g); return x?x[1]:'Légère'; };
  const graviteColor=g=>{ const x=GRAVITES.find(v=>v[0]===g); return x?x[2]:'amber'; };
  // ---- Registre de présences / appel (demo hors-ligne) ----
  let ATT_SEQ=3;
  let ATT_STORE=[
    {id:'a1',stu:'e2',cls:'c1',date:'2026-10-24',status:'present'},
    {id:'a2',stu:'e4',cls:'c1',date:'2026-10-24',status:'retard'},
    {id:'a3',stu:'e5',cls:'c1',date:'2026-10-24',status:'absent'}
  ];
  const ATT_STATUS=[['present','Présent','emerald'],['retard','Retard','amber'],['absent','Absent','rose']];
  const attLabel=s=>{ const x=ATT_STATUS.find(v=>v[0]===s); return x?x[1]:'Présent'; };
  const attColor=s=>{ const x=ATT_STATUS.find(v=>v[0]===s); return x?x[2]:'emerald'; };
  function ttClasses(){ return CYCLES[state.ttCycle]||[]; }
  function ttClassName(){ const l=ttClasses(); return l[state.ttIdx]||l[0]||''; }
  function ttName(){
    if(state.ttScope==='teacher') return TT_TEACHERS[state.ttIdx]||TT_TEACHERS[0];
    const g=state.ttGroup?' · Groupe '+state.ttGroup:'';
    return ttClassName()+g;
  }
  function ttKey(){ return state.ttScope==='teacher' ? 'teacher:'+ttName() : 'class:'+state.ttCycle+':'+ttClassName()+':'+(state.ttGroup||'ALL'); }
  function ttDefault(seed){
    const base=[['M','F','P','A','E','H'],['M','F','P','A','E','I'],['P','M','F','A','','H'],['F','P','M','E','A','I'],['E','A','','M','F','P'],['H','I','A','F','P','M'],['A','E','M','','H','F'],['I','A','F','P','M',''],['','','','','','']];
    return base.map(r=>r.map((_,ci)=>r[(ci+seed)%6]));
  }
  function ttGrid(){ ttEnsureLoaded(); const k=ttKey(); if(!TT_STORE[k]) TT_STORE[k]=ttDefault((state.ttIdx+(state.ttGroup==='B'?1:0))%6); return TT_STORE[k]; }
  // ---- EMPLOI DU TEMPS v2 : piloté par les VRAIES données (classes / matières / enseignants) ----
  // Grille d'une classe = 9 lignes (créneaux) x 6 colonnes (jours).
  // Chaque cellule vaut '' (vide) ou un objet {sub:<idMatière>, teach:<idEnseignant>}.
  function ttEmptyGrid(){ return Array.from({length:9},()=>Array.from({length:6},()=>'')); }
  function ttClassGrid(clsId){ ttEnsureLoaded(); const k='cls:'+clsId; if(!TT_STORE[k]) TT_STORE[k]=ttEmptyGrid(); return TT_STORE[k]; }
  // Couleur/nom d'une matière (via son domaine sci/litt/autre).
  function ttSubColor(subId){ const s=getSub(subId); const d=s&&DOM[s.dom]; return d?d[1]:'slate'; }
  function ttSubName(subId){ const s=getSub(subId); return s?s.n:'—'; }
  // Nom court d'un enseignant (ex. « Mme Sarr »).
  function ttTeacherShort(tId){ const t=DB.teachers.find(x=>x.id===tId); return t?(t.n||teacName(t)):''; }
  // Matières proposées pour une classe : d'abord son programme, sinon toutes.
  function ttSubjectsFor(clsId){
    const prog=DB.program.filter(p=>p.cls===clsId).map(p=>p.sub);
    const ids=prog.length?prog:DB.subjects.map(s=>s.id);
    return ids.filter((v,i)=>ids.indexOf(v)===i);
  }
  // Enseignants proposés : ceux affectés à la classe d'abord, puis le reste de l'équipe.
  function ttTeachersFor(clsId){
    const assigned=DB.teachers.filter(t=>Array.isArray(t.cls)&&t.cls.includes(clsId));
    const rest=DB.teachers.filter(t=>!assigned.includes(t));
    return assigned.concat(rest);
  }
  // Enseignant intervenant pour une matiere dans une classe (id front, ex 't5').
  // Priorite : enseignant affecte A LA FOIS a la classe ET a la matiere ; a defaut
  // un enseignant qui enseigne cette matiere (meme non rattache a la classe).
  // Sert a pre-remplir automatiquement le prof quand on choisit une matiere dans
  // une case de l'emploi du temps. Renvoie '' si aucun enseignant ne convient.
  function ttTeacherForSub(clsId, subId){
    if(!subId) return '';
    const teaches=t=>Array.isArray(t.subs)&&t.subs.includes(subId);
    const inClass=t=>Array.isArray(t.cls)&&t.cls.includes(clsId);
    let t=DB.teachers.find(x=>inClass(x)&&teaches(x));
    if(!t) t=DB.teachers.find(x=>teaches(x));
    return t?t.id:'';
  }
  // Conflit d'horaire : l'enseignant `teachId` est-il deja occupe dans une AUTRE
  // classe au meme creneau (ri=ligne/heure, ci=colonne/jour) ? Renvoie l'id front
  // de la classe en conflit, ou '' si libre. Compare avec les grilles persistees.
  function ttFindConflict(clsId, ri, ci, teachId){
    if(!teachId) return '';
    for(let i=0;i<DB.classes.length;i++){ const c=DB.classes[i]; if(!c||c.id===clsId) continue;
      const g=TT_STORE['cls:'+c.id]; if(!g||!g[ri]) continue;
      const v=g[ri][ci];
      if(v && typeof v==='object' && v.teach===teachId) return c.id;
    }
    return '';
  }
  // Tous les conflits d'horaire enseignant pour une grille de classe donnee.
  // Renvoie [{ri,ci,teach,other}] (other = id front de la classe en conflit).
  function ttGridConflicts(clsId, grid){
    const out=[];
    if(!Array.isArray(grid)) return out;
    for(let ri=0;ri<grid.length;ri++){ const row=grid[ri]||[]; for(let ci=0;ci<row.length;ci++){
      const v=row[ci]; if(!v||typeof v!=='object'||!v.teach) continue;
      const other=ttFindConflict(clsId, ri, ci, v.teach);
      if(other) out.push({ri:ri,ci:ci,teach:v.teach,other:other});
    }}
    return out;
  }
  // Carte des "trous" d'une grille (vide entouré de cours la même journée).
  // true = case VIDE encadrée par au moins un cours plus tôt ET un cours plus
  // tard dans la MEME colonne (journée). Les vides en début/fin de journée (avant
  // le 1er cours ou après le dernier) ne comptent pas comme des trous.
  function ttGapMap(grid){
    const R=(grid&&grid.length)||0, C=(grid&&grid[0]&&grid[0].length)||0;
    const map=Array.from({length:R},()=>Array.from({length:C},()=>false));
    const filled=(r,c)=>{ const v=grid[r]&&grid[r][c]; return !!(v&&typeof v==='object'&&v.sub); };
    for(let c=0;c<C;c++){
      let first=-1,last=-1;
      for(let r=0;r<R;r++){ if(filled(r,c)){ if(first<0) first=r; last=r; } }
      if(first<0) continue;
      for(let r=first+1;r<last;r++){ if(!filled(r,c)) map[r][c]=true; }
    }
    return map;
  }
  // Nombre total de trous dans une grille.
  function ttGapCount(grid){ const m=ttGapMap(grid); let n=0; for(let r=0;r<m.length;r++) for(let c=0;c<m[r].length;c++) if(m[r][c]) n++; return n; }
  // Vue consolidée (lecture seule) d'un enseignant, calculée à partir des grilles de classes.
  // Cellule = '' ou {cls:<idClasse>, sub:<idMatière>}.
  function ttTeacherAgg(tId){
    const out=ttEmptyGrid();
    DB.classes.forEach(c=>{
      const g=TT_STORE['cls:'+c.id]; if(!g) return;
      for(let r=0;r<9;r++) for(let ci=0;ci<6;ci++){
        const v=g[r] && g[r][ci];
        if(v && typeof v==='object' && v.teach===tId) out[r][ci]={cls:c.id,sub:v.sub};
      }
    });
    return out;
  }

  /* ===================== POINTAGE ENSEIGNANT (branché sur l'emploi du temps) =====================
   * Les heures PRÉVUES proviennent directement des grilles de classe (ttTeacherAgg) :
   * chaque cellule occupée = 1 créneau de cours. La surveillance ne fait que pointer
   * la présence du jour (présent / retard / absent) ; les heures RÉALISÉES en découlent.
   * Aucune donnée codée en dur : tout est calculé à partir de l'emploi du temps réel.
   */
  const TT_SLOT_MIN=55; // durée réelle d'un créneau (info) — mais compté 1 HEURE PLEINE pour le pointage
  // Règle métier : chaque séance de l'emploi du temps = 1 heure pleine (50/55 min comptées 1h).
  function cellsToHours(n){ return (n||0); }
  function fmtHours(v){ const m=Math.round((v||0)*60); return Math.floor(m/60)+'h'+String(m%60).padStart(2,'0'); }
  // Nombre de créneaux occupés (toutes classes) d'un enseignant sur la semaine type.
  function teacherWeekCells(tId){ const g=ttTeacherAgg(tId); let n=0; for(let r=0;r<9;r++) for(let c=0;c<6;c++){ if(g[r]&&g[r][c]) n++; } return n; }
  // Créneaux occupés un jour donné (colonne 0=Lun … 5=Sam).
  function teacherDayCells(tId,dayIdx){ const g=ttTeacherAgg(tId); let n=0; for(let r=0;r<9;r++){ if(g[r]&&g[r][dayIdx]) n++; } return n; }
  function teacherWeekHours(tId){ return cellsToHours(teacherWeekCells(tId)); }
  function teacherDayHours(tId,dayIdx){ return cellsToHours(teacherDayCells(tId,dayIdx)); }
  function todayIso(){ return new Date().toISOString().slice(0,10); }
  // Index colonne emploi du temps (Lun=0 … Sam=5) d'une date ISO ; dimanche => -1.
  function ttDayIndex(iso){ const d=new Date(iso+'T00:00:00'); if(isNaN(d.getTime())) return -1; const w=d.getDay(); return w===0?-1:w-1; }
  // Store de pointage : clé « tId|YYYY-MM-DD » -> 'retard' | 'absent' (présent = valeur par défaut, non stockée).
  const TPT_STORE={}; let _tptLoaded=false;
  function tptEnsureLoaded(){ if(_tptLoaded) return; _tptLoaded=true; try{ if(typeof localStorage==='undefined') return; const raw=localStorage.getItem('xschool-tpt'); if(raw){ const o=JSON.parse(raw); if(o&&typeof o==='object') for(const k in o) TPT_STORE[k]=o[k]; } }catch(e){} }
  function tptPersist(){ try{ if(typeof localStorage==='undefined') return; _tptLoaded=true; localStorage.setItem('xschool-tpt', JSON.stringify(TPT_STORE)); }catch(e){} }
  function tptStatus(tId,iso){ tptEnsureLoaded(); return TPT_STORE[tId+'|'+iso]||'present'; }
  function tptSet(tId,iso,stt){ tptEnsureLoaded(); const k=tId+'|'+iso; if(stt==='present') delete TPT_STORE[k]; else TPT_STORE[k]=stt; tptPersist();
    // Write-through backend : persiste le pointage cote serveur quand l'API est active.
    if(apiOn()&&API.authenticated()){ const tid=_unpfx('t',tId); if(tid!=null){ try{ API.saveTeacherAttendance({ teacher_id:tid, date:iso, status:stt||'present' }).catch(function(){}); }catch(e){} } }
  }
  // Heures prévues sur une période = somme, jour par jour, des heures de l'emploi du temps.
  function teacherPlannedHours(tId,startIso,endIso){
    let h=0; const s=new Date(startIso+'T00:00:00'), e=new Date(endIso+'T00:00:00');
    if(isNaN(s.getTime())||isNaN(e.getTime())||s>e) return 0;
    for(let d=new Date(s); d<=e; d.setDate(d.getDate()+1)){ const w=d.getDay(); if(w===0) continue; h+=teacherDayHours(tId,w-1); }
    return h;
  }
  // Pointage AUTOMATIQUE : la présence est déduite directement de l'emploi du temps.
  // Chaque séance planifiée est considérée réalisée (1 séance = 1 heure pleine).
  // Les heures réalisées sont donc toujours égales aux heures prévues.
  function teacherRealizedHours(tId,startIso,endIso){
    return teacherPlannedHours(tId,startIso,endIso);
  }

  /* ===================== PONT API (data <-> backend) =====================
   * Non invasif : n'agit que si API.enabled(). Sinon le prototype reste
   * 100% en memoire (donnees de demo). Les vues restent synchrones :
   * l'hydratation remplit DB.classes / SCHOOLS EN PLACE avant le 1er rendu,
   * et les ecritures (create/delete) sont "write-through" cote serveur
   * puis refletees dans les tableaux en memoire.
   */
  function apiOn(){ return (typeof API!=='undefined') && API.enabled(); }

  // Charge-t-on des donnees STAFF via l'API ? Identique a apiOn() mais bloque
  // EN PLUS l'espace eleve. Un compte eleve ne doit JAMAIS declencher un appel
  // reserve au staff (/grades, /attendance, /payments, /discipline...) : cote
  // serveur ces endpoints sont proteges par role_required -> 403 + une ligne
  // d'audit "acces_refuse" parasite dans le journal de securite. Les donnees
  // de l'eleve (fiche, classe, notes, presences, paiements) arrivent toutes via
  // l'endpoint dedie /me/overview (hydrateStudentOverview). On garde donc tout
  // chargement staff derriere ce verrou : apiOn() ET role != 'student'.
  function staffApiOn(){ return apiOn() && (typeof state==='undefined' || state.role!=='student'); }

  // ---------- MODE DONNEES REELLES : purge des donnees de demonstration --------
  // En mode connecte au backend (apiOn), l'application ne doit afficher QUE les
  // vraies donnees de la base. On vide donc tous les jeux de demonstration en
  // memoire AVANT le 1er rendu / apres connexion : les listes sont ensuite
  // remplies par l'hydratation serveur. Si un endpoint ne renvoie rien, la
  // rubrique reste vide (condition reelle), au lieu de montrer des exemples.
  // SCHOOLS n'est PAS vide ici : la liste publique des etablissements est geree
  // a part (remplacee par la vraie liste active du serveur).
  let _demoWiped=false;
  function wipeDemoData(){
    if(_demoWiped) return; _demoWiped=true;
    try{
      DB.classes.length=0; DB.subjects.length=0; DB.teachers.length=0;
      DB.students.length=0; DB.program.length=0;
      for(const k in GRADES){ delete GRADES[k]; }
      if(Array.isArray(USERS)) USERS.length=0;
      if(Array.isArray(LOGS)) LOGS.length=0;
      if(Array.isArray(PAY_STORE)) PAY_STORE.length=0;
      if(Array.isArray(DISC_STORE)) DISC_STORE.length=0;
      if(Array.isArray(ATT_STORE)) ATT_STORE.length=0;
      // Vider aussi les alertes de demonstration (al1/al2/al3) : en mode reel,
      // le centre d'alertes et la banniere ne doivent afficher QUE les vraies
      // alertes (generees par les tests / le serveur), aucun faux compteur.
      if(Array.isArray(ALERTS)) ALERTS.length=0;
    }catch(e){}
  }
  // Purge immediate si on demarre deja en mode API (avant tout rendu).
  if(apiOn()){ wipeDemoData(); }

  // ---------- CARTES SCOLAIRES (donnees par classe, hors-ligne + API) ----------
  // Annee scolaire courante (bascule en aout), format AAAA-AAAA.
  function currentSchoolYear(){
    const d=new Date(); const y=d.getFullYear(); const start=(d.getMonth()>=7)?y:y-1;
    return start+'-'+(start+1);
  }
  // Construit les donnees de carte d'une classe depuis la DB locale.
  // Meme forme que l'endpoint backend GET /api/classes/<id>/cards.
  function classCardsData(clsId){
    const cls=getCls(clsId), sc=activeSchool(), cfg=schoolCfg();
    const slug=(sc&&(sc.slug||sc.code))?String(sc.slug||sc.code):'xs';
    const year=state.year||currentSchoolYear();
    const studs=studentsInClass(clsId,year)
      .sort((a,b)=>(stuName(a)).localeCompare(stuName(b),'fr'));
    const cards=studs.map(e=>{
      const enr=enrollFor(e,year);
      const ref=String(e.mat||e.id||'').toUpperCase();
      const full=stuName(e);
      const idNum=_unpfx('e',e.id); const sid=(idNum!=null?idNum:e.id);
      return {
        student_id:sid, matricule:e.mat||'', full_name:full, nom:e.nom||'', prenom:e.prenom||'',
        sexe:e.sexe||'', dob:e.dob||'', lieu:e.lieu||'', photo:e.photo||'',
        regime:(enr&&enr.regime)||e.st||'', statut:(enr&&enr.statut)||e.statut||'',
        card_no:slug.toUpperCase()+'-'+year.slice(0,4)+'-'+ref,
        qr:['XSCHOOL-CARD',slug,String(sid),e.mat||'',full,(cls&&cls.name)||'',year].join('|')
      };
    });
    return {
      school:{ name:(sc&&sc.name)||'', slug:slug, logo:cfg.logo||'', address:cfg.address||'',
               phone:cfg.phone||'', email:cfg.email||'', director:cfg.director||'' },
      klass:cls?{ id:cls.id, cycle:cls.cycle||'', name:cls.name||'', grp:cls.grp||'', spec:cls.spec||'' }:null,
      year:year, cards:cards
    };
  }
  // Version API : recupere les donnees aupres du backend (meme forme).
  function classCardsApi(clsId){
    const c=getCls(clsId); const apiId=(c&&c.apiId!=null)?c.apiId:_unpfx('c',clsId);
    // Securite : une classe locale/demo (sans identifiant serveur) est traitee
    // hors-ligne au lieu d'interroger le backend (sinon 404 "introuvable").
    if(apiId==null) return Promise.resolve(classCardsData(clsId));
    return API.classCards(apiId);
  }

  // role backend -> cle de role frontend (ROLES)
  const API_ROLE_MAP={ superadmin:'super', admin:'admin', teacher:'teacher', supervisor:'surveillant', comptable:'comptable', student:'student' };
  function mapApiRole(r){ return API_ROLE_MAP[r]||'admin'; }
  // cle de role frontend -> role backend (inverse de API_ROLE_MAP)
  const FRONT_ROLE_MAP={ super:'superadmin', admin:'admin', teacher:'teacher', surveillant:'supervisor', comptable:'comptable', student:'student' };
  function roleToApi(r){ return FRONT_ROLE_MAP[r]||'teacher'; }

  function mapApiSchool(s){
    const o={ id:'sc'+s.id, apiId:s.id, name:s.name||('École '+s.id), code:(s.slug||('SC'+s.id)).toUpperCase(),
             slug:s.slug||('sc'+s.id), active:s.active!==false, cycles:CYCLE_NAMES.slice() };
    // Si le backend fournit la config d'identite (endpoint /schools/current),
    // on la mappe vers le cfg attendu par le frontend (identite + bulletins).
    const c=s.config;
    if(c){
      o.cfg={ phone:c.phone||'', email:c.email||'', address:c.address||'', director:c.director||'', logo:c.logo||'',
              gradeMax:(c.grade_max!=null?c.grade_max:20), passMark:(c.pass_mark!=null?c.pass_mark:10),
              avgMode:c.avg_mode||'weighted', avgDecimals:(c.avg_decimals!=null?c.avg_decimals:2),
              rankVisible:c.rank_visible!==false, rankTies:c.rank_ties!==false, optFacCoef1:!!c.opt_fac_coef1,
              bulletinTpl:c.bulletin_tpl||'officiel', bulletinFmt:c.bulletin_fmt||'vrac',
              bulletinFmtByCycle:c.bulletin_fmt_by_cycle||{}, periods:c.periods||{}, teacherGrades:c.teacher_grades||{}, deadlines:c.deadlines||{}, mentions:(c.mentions&&c.mentions.length)?c.mentions:null,
              sms:!!c.sms, whatsapp:!!c.whatsapp, sender:c.sender||'XSCHOOL' };
      if(!o.cfg.mentions) delete o.cfg.mentions; // laisse schoolCfg() poser les defauts
    }
    return o;
  }
  function mapApiClass(c){
    const tby={}; const raw=(c&&c.titulaires_by_year)||{};
    for(const y in raw){ if(!Object.prototype.hasOwnProperty.call(raw,y)) continue; const fid=_pfxId('t', raw[y]); if(fid) tby[y]=fid; }
    return { id:'c'+c.id, apiId:c.id, cycle:c.cycle||'', name:c.name||'', grp:c.grp||'', spec:c.spec||'', titulaire:_pfxId('t', c.titulaire_id), titulaireByYear:tby };
  }
  // Titulaire (id front enseignant, ex 't5') d'une classe pour une annee donnee.
  // On privilegie l'affectation specifique a l'annee ; a defaut on retombe sur
  // le titulaire "par defaut" de la classe (retro-compat), sinon chaine vide.
  function classTitulaireFor(cls, year){
    year=year||(typeof state!=='undefined'&&state.year)||'';
    if(cls){
      if(cls.titulaireByYear && year && cls.titulaireByYear[year]) return cls.titulaireByYear[year];
      if(cls.titulaire) return cls.titulaire;
    }
    return '';
  }
  // retrouve l'id serveur d'une classe front (champ apiId, ou prefixe 'c')
  function classApiId(cls){ if(!cls) return null; if(cls.apiId!=null) return cls.apiId; const m=/^c(\d+)$/.exec(cls.id||''); return m?+m[1]:null; }

  // Remplace le contenu d'un tableau EN PLACE (preserve les references globales).
  function replaceArray(arr,items){ arr.length=0; for(let i=0;i<items.length;i++) arr.push(items[i]); return arr; }
  // Fusion NON destructive : conserve les entrees existantes (donnees fictives/demo)
  // et ajoute seulement les items dont la cle n'est pas deja presente. Permet
  // d'afficher les vraies donnees de la base TOUT EN laissant la demo sur toutes
  // les pages (et de ne jamais vider une liste si l'API renvoie vide).
  function mergeArray(arr,items,keyFn){
    keyFn=keyFn||function(x){ return x&&x.id; };
    const seen=new Set();
    for(let i=0;i<arr.length;i++){ const k=keyFn(arr[i]); if(k!=null) seen.add(k); }
    for(let i=0;i<items.length;i++){ const it=items[i]; const k=keyFn(it);
      if(k!=null&&seen.has(k)) continue; if(k!=null) seen.add(k); arr.push(it); }
    return arr;
  }

  // Hydrate la liste PUBLIQUE des etablissements AVANT la connexion (ecran tenant).
  // Best-effort : en mode API, on remplace les ecoles de demo par la vraie liste
  // active renvoyee par le backend public (GET /auth/schools), ce qui fait
  // apparaitre immediatement toute ecole creee par le superadmin. En cas d'echec
  // (hors-ligne, API absente, liste vide) on conserve les ecoles de demo.
  async function hydratePublicSchools(){
    if(!apiOn()) return false;
    try{
      const r=await API.publicSchools(); const items=(r&&r.items)||[];
      // Mode donnees reelles : on REMPLACE la liste de demo par la vraie liste
      // active du serveur, meme si elle est vide (aucune ecole cote serveur =
      // ecran de selection vide, condition reelle). On ne garde la demo que si
      // l'appel echoue vraiment (hors-ligne / API absente).
      replaceArray(SCHOOLS, items.map(mapApiSchool));
      if(!SCHOOLS.find(s=>s.id===state.schoolId) && SCHOOLS.length) state.schoolId=SCHOOLS[0].id;
      return true;
    }catch(e){ /* echec reel -> on garde la demo pour ne pas bloquer la connexion */ }
    return false;
  }

  // Hydrate les donnees depuis l'API (best-effort). A appeler avant le 1er rendu.
  async function hydrateFromApi(){
    if(!apiOn() || !API.authenticated()) return false;
    let u=API.user();
    try{ if(!u){ const r=await API.me(); u=r&&r.user; API.setUser(u||null); } }
    catch(e){ API.logout(); return false; } // token invalide/expire -> on repart hors-ligne
    const role=u?mapApiRole(u.role):'admin';
    if(role==='super'){
      try{ const r=await API.listSchools(); const items=(r&&r.items)||[];
        replaceArray(SCHOOLS, items.map(mapApiSchool)); if(SCHOOLS.length && !SCHOOLS.find(s=>s.id===state.schoolId)) state.schoolId=SCHOOLS[0].id; }
      catch(e){ if(typeof toast==='function') toast('Établissements : '+(e.message||'indisponibles')); }
    } else {
      // admin / enseignant / surveillant / eleve : on affiche l'etablissement du
      // compte connecte ET on laisse les ecoles de demo presentes (non destructif).
      try{ const r=await API.currentSchool(); const school=r&&r.school;
        if(school){ const real=mapApiSchool(school);
          const i=SCHOOLS.findIndex(s=>s.id===real.id);
          if(i>=0) SCHOOLS[i]=real; else SCHOOLS.unshift(real);
          state.schoolId=real.id; } }
      catch(e){ if(typeof toast==='function') toast('Établissement : '+(e.message||'indisponible')); }
    }
    // ESPACE ELEVE : les listes de reference (/classes, /students, /grades...)
    // sont reservees au STAFF (403 pour un eleve). En mode connecte la demo est
    // purgee -> tous les menus eleve etaient vides. On hydrate donc ici les
    // MEMES structures memoire (sa fiche, sa classe, son programme, ses notes,
    // presences et paiements) via l'endpoint dedie /me/overview.
    if(role==='student'){ await hydrateStudentOverview(); return true; }
    // Donnees de reference (best-effort : une liste indisponible n'empeche pas les autres).
    await _hydrateList(()=>API.listClasses(),  DB.classes,   mapApiClass,   'Classes');
    await _hydrateList(()=>API.listSubjects(), DB.subjects,  mapApiSubject, 'Matières');
    await _hydrateList(()=>API.listTeachers(), DB.teachers,  mapApiTeacher, 'Enseignants');
    await _hydrateList(()=>API.listStudents(), DB.students,  mapApiStudent, 'Élèves');
    await _hydrateList(()=>API.listPrograms(), DB.program,   mapApiProgram, 'Programme', function(p){ return p.cls+'|'+p.sub; });
    return true;
  }

  // ESPACE ELEVE : hydrate les structures memoire a partir de /me/overview.
  // Tout est scope a l'eleve connecte (sa fiche, sa classe, son programme, ses
  // notes/presences/paiements) et alimente EXACTEMENT les memes stores que les
  // vues lisent deja (DB.students/classes/subjects/program, GRADES, ATT_STORE,
  // PAY_STORE). Non destructif : fusion, jamais d'ecrasement d'autres entrees.
  async function hydrateStudentOverview(){
    if(!apiOn()||!API.authenticated()) return false;
    let r;
    try{ r=await API.overview(); }
    catch(e){
      // 403 = compte non lie a une fiche eleve -> espace vide (pas de demo).
      if(e&&e.status!==403&&typeof toast==='function') toast('Mes données : '+(e.message||'indisponibles'));
      return false;
    }
    if(!r) return false;
    // Fiche eleve + classe(s) + matieres + programme.
    if(r.student){ mergeArray(DB.students, [mapApiStudent(r.student)]); }
    if(Array.isArray(r.classes)){ mergeArray(DB.classes, r.classes.map(mapApiClass)); }
    if(Array.isArray(r.subjects)){ mergeArray(DB.subjects, r.subjects.map(mapApiSubject)); }
    if(Array.isArray(r.programs)){ mergeArray(DB.program, r.programs.map(mapApiProgram), function(p){ return p.cls+'|'+p.sub; }); }
    // Notes : cle year|cls|sub|period -> { stuId:{i,d,c,_gid} } (meme format que
    // hydrateGradesApi). On garde l'annee PROPRE de chaque note (pas state.year).
    if(Array.isArray(r.grades)){
      r.grades.forEach(function(g){
        const key=(g.year||'')+'|c'+g.class_id+'|s'+g.subject_id+'|'+(g.period||'');
        const store=GRADES[key]||(GRADES[key]={});
        const cell=_cellFromDetail(g.detail);
        store['e'+g.student_id]={ i:cell.i||'', d:cell.d||'', c:cell.c||'', _gid:g.id };
      });
    }
    // Presences + paiements (memes mappeurs que les hydratations STAFF).
    if(Array.isArray(r.attendance)){
      r.attendance.forEach(function(a){ const m=mapApiAttendance(a);
        const j=ATT_STORE.findIndex(function(x){ return x.stu===m.stu&&x.cls===m.cls&&x.date===m.date; });
        if(j>=0) ATT_STORE[j]=m; else ATT_STORE.push(m); });
    }
    if(Array.isArray(r.payments)){ mergeArray(PAY_STORE, r.payments.map(mapApiPayment)); }
    return true;
  }

  // Charge une liste API dans un tableau en memoire. FUSION non destructive :
  // les vraies donnees s'ajoutent aux donnees fictives deja presentes, et une
  // liste API vide ne vide jamais la demo. 403 = role sans acces -> ignore.
  async function _hydrateList(call, arr, mapper, label, keyFn){
    try{ const r=await call(); const items=(r&&r.items)||[];
      // Mode API reel : on REMPLACE les donnees de demo par les vraies (meme si
      // la liste est vide). La fusion avec la demo laissait des entrees fictives
      // (ex. classe 'c1') dont l'id pointe vers une AUTRE ecole cote serveur, ce
      // qui declenchait des 404 "introuvable" (cartes scolaires, feuilles, etc.).
      replaceArray(arr, items.map(mapper));
      return true; }
    catch(e){ if(e && e.status!==403 && typeof toast==='function') toast(label+' : '+(e.message||'indisponibles')); return false; }
  }

  // Connexion reelle : renvoie la cle de role frontend, ou leve une erreur.
  async function apiLogin(email,password){
    const d=await API.login(email,password); const u=d&&d.user; return u?mapApiRole(u.role):'admin';
  }
  function apiLogout(){ if(apiOn()) API.logout(); }

  // Write-through classes : cree cote serveur puis ajoute a DB.classes.
  async function createClassApi(payload){
    const r=await API.createClass(payload); const k=r&&r.klass; const obj=k?mapApiClass(k):null;
    if(obj) DB.classes.push(obj); return obj;
  }
  // Supprime cote serveur puis localement.
  async function deleteClassApi(cls){
    const id=classApiId(cls); if(id==null) throw new Error('Classe sans identifiant serveur');
    await API.deleteClass(id); const i=DB.classes.indexOf(cls); if(i>=0) DB.classes.splice(i,1); return true;
  }
  // Affecte / retire le titulaire (prof principal) d'une classe cote serveur,
  // puis reflete localement. `titFrontId` = id front enseignant ('t5') ou ''.
  // `year` (optionnel) scope l'affectation a une annee scolaire ; sans annee,
  // on met a jour le titulaire "par defaut" de la classe.
  async function setClassTitulaireApi(cls, titFrontId, year){
    const id=classApiId(cls); if(id==null) throw new Error('Classe sans identifiant serveur');
    const tid=titFrontId?_unpfx('t', titFrontId):null;
    const payload={ titulaire_id:tid }; if(year) payload.year=year;
    const r=await API.updateClass(id, payload);
    if(r&&r.klass){ Object.assign(cls, mapApiClass(r.klass)); } return cls;
  }
  // Cree un etablissement (superadmin) puis l'ajoute a SCHOOLS.
  async function createSchoolApi(payload){
    const r=await API.createSchool(payload); const s=r&&r.school; const obj=s?mapApiSchool(s):null;
    if(obj) SCHOOLS.push(obj); return obj;
  }
  // Cree un administrateur pour une ecole existante (superadmin), puis l'ajoute
  // a USERS. `schoolId` = id front ('sc3'). payload: {full_name,email,login?,password}.
  async function createSchoolAdminApi(schoolId, payload){
    const sc=SCHOOLS.find(s=>s.id===schoolId); const apiId=(sc&&sc.apiId!=null)?sc.apiId:_unpfx('sc',schoolId);
    if(apiId==null) throw new Error('\u00c9cole sans identifiant serveur');
    const r=await API.createSchoolAdmin(apiId, payload); const u=r&&r.admin; const obj=u?mapApiUser(u):null;
    if(obj) USERS.push(obj); return obj;
  }
  // id serveur d'un compte front (champ apiId, ou prefixe 'u').
  function userApiId(u){ if(!u) return null; if(u.apiId!=null) return u.apiId; return _unpfx('u', u.id); }
  // Cree un compte (avec mot de passe) cote serveur, puis l'ajoute a USERS.
  // `front` : { name, email, password, role(front), login? }. `schoolId` front
  // optionnel (le superadmin doit le preciser ; l'admin est confine cote serveur).
  async function createUserApi(front, schoolId){
    const payload={ full_name:front.name||'', email:(front.email||'').toLowerCase(),
                    password:front.password||'', role:roleToApi(front.role||'teacher') };
    if(front.login) payload.login=String(front.login).toLowerCase();
    // Lien explicite compte -> fiche (enseignant / eleve). On convertit l'id
    // front ('t5' / 'e3') en identifiant serveur attendu par le backend.
    if(front.personFrontId){
      if(front.role==='teacher'){ const t=DB.teachers.find(x=>x.id===front.personFrontId); const tid=t?teacherApiId(t):null; if(tid!=null) payload.teacher_id=tid; }
      else if(front.role==='student'){ const s=DB.students.find(x=>x.id===front.personFrontId); const sid2=s?studentApiId(s):null; if(sid2!=null) payload.student_id=sid2; }
    }
    if(schoolId && schoolId!=='all'){ const sc=SCHOOLS.find(s=>s.id===schoolId); const apiId=(sc&&sc.apiId!=null)?sc.apiId:_unpfx('sc',schoolId); if(apiId!=null) payload.school_id=apiId; }
    const r=await API.createUser(payload); const u=r&&r.user; const obj=u?mapApiUser(u):null;
    if(obj) USERS.push(obj); return obj;
  }
  // Active/desactive un compte cote serveur, puis reflete localement.
  async function setUserActiveApi(u, active){
    const id=userApiId(u); if(id==null) throw new Error('Compte sans identifiant serveur');
    const r=await API.updateUser(id, { active:!!active }); if(r&&r.user) u.active=r.user.active!==false; return u;
  }
  // Supprime un compte cote serveur, puis localement.
  async function deleteUserApi(u){
    const id=userApiId(u); if(id==null) throw new Error('Compte sans identifiant serveur');
    await API.deleteUser(id); const i=USERS.indexOf(u); if(i>=0) USERS.splice(i,1); return true;
  }

  /* ---------- Mappeurs backend -> prototype (ids prefixes, champs renommes) ---------- */
  // Les ids serveur (entiers) sont conserves dans `apiId` ; l'id front reste
  // prefixe ('s'/'t'/'e'/'c') pour rester reversible et compatible avec les vues.
  function _pfxId(prefix, v){ if(v==null||v==='') return ''; return prefix+v; }
  function _unpfx(prefix, id){ if(id==null) return null; const m=new RegExp('^'+prefix+'(\\d+)$').exec(String(id)); return m?+m[1]:null; }

  function mapApiSubject(s){
    return { id:'s'+s.id, apiId:s.id, n:s.name||'', dom:s.dom||'autre' };
  }
  function subjectApiId(sub){ if(!sub) return null; if(sub.apiId!=null) return sub.apiId; return _unpfx('s', sub.id); }

  function mapApiTeacher(t){
    return { id:'t'+t.id, apiId:t.id, n:t.full_name||((t.nom||'')+' '+(t.prenom||'')).trim(),
             nom:t.nom||'', prenom:t.prenom||'', dob:t.dob||'', dip:t.dip||'', spec:t.spec||'',
             tel:t.tel||'', urgNom:t.urg_nom||'', urgTel:t.urg_tel||'', photo:t.photo||'',
             subs:(t.subs||[]).map(x=>'s'+x), cls:(t.classes||[]).map(x=>'c'+x) };
  }
  function teacherApiId(t){ if(!t) return null; if(t.apiId!=null) return t.apiId; return _unpfx('t', t.id); }

  function mapApiStudent(s){
    const enr=(s.enrollments||[]).map(e=>({ year:e.year||'', cls:_pfxId('c', e.class_id), statut:e.statut||'', regime:e.regime||'' }));
    return { id:'e'+s.id, apiId:s.id, mat:s.matricule||'', nom:s.nom||'', prenom:s.prenom||'',
             dob:s.dob||'', sexe:s.sexe||'', lieu:s.lieu||'',
             pere:s.pere||'', pereTel:s.contact_pere||'', mere:s.mere||'', mereTel:s.contact_mere||'',
             photo:s.photo||'', cls:_pfxId('c', s.class_id),
             statut:(enr.length?enr[enr.length-1].statut:''),
             year:(enr.length?enr[enr.length-1].year:(state.year||'')),
             enrollments:enr };
  }
  function studentApiId(e){ if(!e) return null; if(e.apiId!=null) return e.apiId; return _unpfx('e', e.id); }

  function mapApiProgram(p){
    return { apiId:p.id, cls:'c'+p.class_id, sub:'s'+p.subject_id,
             coef:(+p.coef||1), oblig:p.oblig!==false, spec:!!p.spec };
  }
  function programApiId(pr){ return pr?pr.apiId:null; }

  /* ---------- Write-through : MATIERES ---------- */
  async function createSubjectApi(front){
    const r=await API.createSubject({ name:front.n, dom:front.dom||'autre' });
    const obj=r&&r.subject?mapApiSubject(r.subject):null; if(obj) DB.subjects.push(obj); return obj;
  }
  async function updateSubjectApi(sub, front){
    const id=subjectApiId(sub); if(id==null) throw new Error('Matière sans identifiant serveur');
    const r=await API.updateSubject(id, { name:front.n, dom:front.dom });
    if(r&&r.subject){ sub.n=r.subject.name; sub.dom=r.subject.dom; } return sub;
  }
  async function deleteSubjectApi(sub){
    const id=subjectApiId(sub); if(id==null) throw new Error('Matière sans identifiant serveur');
    await API.deleteSubject(id); const i=DB.subjects.indexOf(sub); if(i>=0) DB.subjects.splice(i,1); return true;
  }

  /* ---------- Write-through : ENSEIGNANTS ---------- */
  function _teacherPayload(front){
    return { nom:front.nom||'', prenom:front.prenom||'', dob:front.dob||'', dip:front.dip||'',
             spec:front.spec||'', tel:front.tel||'', urg_nom:front.urgNom||'', urg_tel:front.urgTel||'',
             photo:front.photo||'',
             subs:(front.subs||[]).map(x=>_unpfx('s',x)).filter(v=>v!=null),
             classes:(front.cls||[]).map(x=>_unpfx('c',x)).filter(v=>v!=null) };
  }
  async function createTeacherApi(front){
    const r=await API.createTeacher(_teacherPayload(front));
    const obj=r&&r.teacher?mapApiTeacher(r.teacher):null; if(obj) DB.teachers.push(obj); return obj;
  }
  async function updateTeacherApi(t, front){
    const id=teacherApiId(t); if(id==null) throw new Error('Enseignant sans identifiant serveur');
    const r=await API.updateTeacher(id, _teacherPayload(front));
    if(r&&r.teacher){ Object.assign(t, mapApiTeacher(r.teacher)); } return t;
  }
  async function deleteTeacherApi(t){
    const id=teacherApiId(t); if(id==null) throw new Error('Enseignant sans identifiant serveur');
    await API.deleteTeacher(id); const i=DB.teachers.indexOf(t); if(i>=0) DB.teachers.splice(i,1); return true;
  }

  /* ---------- Write-through : ELEVES (+ inscriptions) ---------- */
  function _studentPayload(front){
    const p={ matricule:front.mat||'', nom:front.nom||'', prenom:front.prenom||'', sexe:front.sexe||'',
              dob:front.dob||'', lieu:front.lieu||'', pere:front.pere||'', contact_pere:front.pereTel||'',
              mere:front.mere||'', contact_mere:front.mereTel||'', photo:front.photo||'' };
    const cid=_unpfx('c', front.cls); if(cid!=null) p.class_id=cid;
    if(front.year) p.year=front.year; if(front.statut) p.statut=front.statut;
    return p;
  }
  async function createStudentApi(front){
    const r=await API.createStudent(_studentPayload(front));
    const obj=r&&r.student?mapApiStudent(r.student):null; if(obj) DB.students.push(obj); return obj;
  }
  async function updateStudentApi(e, front){
    const id=studentApiId(e); if(id==null) throw new Error('Élève sans identifiant serveur');
    const r=await API.updateStudent(id, _studentPayload(front));
    if(r&&r.student){ Object.assign(e, mapApiStudent(r.student)); } return e;
  }
  async function deleteStudentApi(e){
    const id=studentApiId(e); if(id==null) throw new Error('Élève sans identifiant serveur');
    await API.deleteStudent(id); const i=DB.students.indexOf(e); if(i>=0) DB.students.splice(i,1); return true;
  }
  // Cree/MAJ l'inscription d'un eleve pour une annee (year requis).
  async function upsertEnrollmentApi(e, year, cls, statut){
    const id=studentApiId(e); if(id==null) throw new Error('Élève sans identifiant serveur');
    const payload={ year:year }; const cid=_unpfx('c', cls);
    if(cid!=null) payload.class_id=cid; if(statut!=null) payload.statut=statut;
    await API.upsertEnrollment(id, payload);
    setEnroll(e, year, cls||'', statut); return e;
  }

  /* ---------- Write-through : PROGRAMME ---------- */
  async function saveProgramApi(cls, sub, attrs){
    const cid=_unpfx('c', cls), sid=_unpfx('s', sub);
    if(cid==null||sid==null) throw new Error('Classe/matière sans identifiant serveur');
    const r=await API.createProgram({ class_id:cid, subject_id:sid,
      coef:(attrs&&attrs.coef!=null?attrs.coef:1), oblig:(attrs?attrs.oblig!==false:true), spec:!!(attrs&&attrs.spec) });
    const obj=r&&r.program?mapApiProgram(r.program):null;
    if(obj){ const ex=DB.program.find(p=>p.cls===obj.cls&&p.sub===obj.sub);
      if(ex) Object.assign(ex, obj); else DB.program.push(obj); }
    return obj;
  }
  async function deleteProgramApi(pr){
    const id=programApiId(pr); if(id==null) throw new Error('Ligne de programme sans identifiant serveur');
    await API.deleteProgram(id); const i=DB.program.indexOf(pr); if(i>=0) DB.program.splice(i,1); return true;
  }

  /* ---------- Write-through : NOTES ----------
   * Le prototype stocke par eleve {i:interro, d:devoir, c:composition}.
   * Cote serveur : une ligne (year,period,class_id,subject_id,student_id) ;
   * la cellule {i,d,c} est rangee dans `detail` (liste) + `moy` calculee.
   */
  function _cellFromDetail(detail){ return (Array.isArray(detail)&&detail.length)?detail[0]:{}; }
  async function hydrateGradesApi(cls, sub, per){
    if(!apiOn()||!API.authenticated()) return false;
    const cid=_unpfx('c',cls), sid=_unpfx('s',sub);
    if(cid==null||sid==null) return false;
    try{
      const r=await API.listGrades({ class_id:cid, subject_id:sid, period:per, year:state.year });
      const items=(r&&r.items)||[]; const store=gGet(cls,sub,per);
      // Non destructif : on superpose les vraies notes sans effacer les cellules
      // fictives des eleves non renvoyes par l'API (on laisse la demo visible).
      items.forEach(g=>{ const cell=_cellFromDetail(g.detail);
        store['e'+g.student_id]={ i:cell.i||'', d:cell.d||'', c:cell.c||'', _gid:g.id }; });
      return true;
    }catch(e){ if(e&&e.status!==403&&typeof toast==='function') toast('Notes : '+(e.message||'indisponibles')); return false; }
  }
  async function saveGradeCellApi(cls, sub, per, stuFrontId, cell){
    const cid=_unpfx('c',cls), sid=_unpfx('s',sub), stid=_unpfx('e',stuFrontId);
    if(cid==null||sid==null||stid==null) throw new Error('Identifiant serveur manquant (classe/matière/élève)');
    const m=moyenne(cell);
    const r=await API.saveGrades({ year:state.year, period:per, class_id:cid, subject_id:sid, student_id:stid,
      detail:[{ i:cell.i||'', d:cell.d||'', c:cell.c||'' }], moy:m });
    const g=r&&r.grade; const store=gGet(cls,sub,per);
    store[stuFrontId]={ i:cell.i||'', d:cell.d||'', c:cell.c||'', _gid:(g?g.id:undefined) };
    return g;
  }
  // Enregistre toutes les cellules saisies d'une (classe, matiere, periode) en un lot.
  async function saveGradesBatchApi(cls, sub, per){
    const cid=_unpfx('c',cls), sid=_unpfx('s',sub);
    if(cid==null||sid==null) throw new Error('Classe/matière sans identifiant serveur');
    const store=gGet(cls,sub,per); const items=[];
    for(const stuFrontId in store){ if(!Object.prototype.hasOwnProperty.call(store,stuFrontId)) continue;
      const stid=_unpfx('e',stuFrontId); if(stid==null) continue; const cell=store[stuFrontId]||{};
      items.push({ year:state.year, period:per, class_id:cid, subject_id:sid, student_id:stid,
        detail:[{ i:cell.i||'', d:cell.d||'', c:cell.c||'' }], moy:moyenne(cell) }); }
    if(!items.length) return [];
    const r=await API.saveGrades({ items:items }); return (r&&r.items)||[];
  }

  // Import / export Excel des notes (cote enseignant/admin).
  // Telecharge le modele .xlsx (noms des eleves de la classe + notes existantes)
  // pour la (classe, matiere, periode, annee courante). Renvoie
  // { filename, mime, data_b64, count } ; le front construit le fichier a partir
  // de data_b64 (base64) et le propose au telechargement.
  async function gradesTemplateApi(cls, sub, per){
    const cid=_unpfx('c',cls), sid=_unpfx('s',sub);
    if(cid==null||sid==null) throw new Error('Classe/matière sans identifiant serveur');
    return await API.gradesTemplate({ class_id:cid, subject_id:sid, year:state.year, period:per });
  }
  // Re-televerse un modele rempli (base64) et met a jour le store GRADES local
  // avec les notes enregistrees cote serveur. Renvoie { saved, skipped }.
  async function gradesImportApi(cls, sub, per, dataB64){
    const cid=_unpfx('c',cls), sid=_unpfx('s',sub);
    if(cid==null||sid==null) throw new Error('Classe/matière sans identifiant serveur');
    const r=await API.gradesImport({ class_id:cid, subject_id:sid, year:state.year, period:per, data_b64:dataB64 });
    const items=(r&&r.items)||[]; const store=gGet(cls,sub,per);
    items.forEach(g=>{ const cell=_cellFromDetail(g.detail);
      store['e'+g.student_id]={ i:cell.i||'', d:cell.d||'', c:cell.c||'', _gid:g.id }; });
    return { saved:(r&&r.saved)||items.length, skipped:(r&&r.skipped)||0 };
  }

  /* ---------- Write-through : APPEL / PRESENCES ---------- */
  function mapApiAttendance(a){
    return { id:'a'+a.id, apiId:a.id, stu:'e'+a.student_id,
             cls:(a.class_id!=null?'c'+a.class_id:''), date:a.date||'', status:a.status||'present' };
  }
  async function hydrateAttendanceApi(cls, date){
    if(!apiOn()||!API.authenticated()) return false;
    const p={}; if(cls) p.class_id=_unpfx('c',cls); if(date) p.date=date;
    try{ const r=await API.listAttendance(p); const items=(r&&r.items)||[];
      // Non destructif : on superpose les vraies presences (meme eleve/classe/date)
      // sans supprimer les entrees fictives existantes (la demo reste visible).
      items.forEach(it=>{ const m=mapApiAttendance(it);
        const j=ATT_STORE.findIndex(x=>x.stu===m.stu&&x.cls===m.cls&&x.date===m.date);
        if(j>=0) ATT_STORE[j]=m; else ATT_STORE.push(m); }); return true; }
    catch(e){ if(e&&e.status!==403&&typeof toast==='function') toast('Présences : '+(e.message||'indisponibles')); return false; }
  }
  async function listAttendanceApi(params){
    const p={}; if(params){ if(params.cls) p.class_id=_unpfx('c',params.cls);
      if(params.student) p.student_id=_unpfx('e',params.student); if(params.date) p.date=params.date; }
    const r=await API.listAttendance(p); return (r&&r.items)||[];
  }
  async function saveAttendanceApi(rows){
    const arr=(Array.isArray(rows)?rows:[rows]);
    const list=arr.map(a=>({ student_id:_unpfx('e', a.student||a.stu), class_id:_unpfx('c', a.cls),
      date:a.date, status:a.status||'present' }));
    const r=await API.saveAttendance({ items:list });
    const items=(r&&(r.items||(r.attendance?[r.attendance]:null)));
    if(items&&items.length){ items.forEach(it=>{ const m=mapApiAttendance(it);
      const j=ATT_STORE.findIndex(x=>x.stu===m.stu&&x.cls===m.cls&&x.date===m.date);
      if(j>=0) ATT_STORE[j]=m; else ATT_STORE.push(m); }); }
    return items||[];
  }
  async function deleteAttendanceApi(id){ await API.deleteAttendance(id); return true; }

  /* ---------- Write-through : POINTAGE ENSEIGNANTS ---------- */
  // Charge le pointage enseignant depuis l'API sur une plage [from,to] et
  // remplit TPT_STORE (cle « t<apiId>|YYYY-MM-DD »). Non destructif : superpose
  // les statuts serveur sur l'existant local.
  async function hydrateTeacherAttendanceApi(from, to){
    if(!apiOn()||!API.authenticated()) return false;
    tptEnsureLoaded();
    const p={}; if(from) p.from=from; if(to) p.to=to;
    try{ const r=await API.listTeacherAttendance(p); const items=(r&&r.items)||[];
      items.forEach(it=>{ const k='t'+it.teacher_id+'|'+(it.date||'');
        const stt=it.status||'present';
        if(stt==='present') delete TPT_STORE[k]; else TPT_STORE[k]=stt; });
      tptPersist(); return true; }
    catch(e){ if(e&&e.status!==403&&typeof toast==='function') toast('Pointage : '+(e.message||'indisponible')); return false; }
  }

  /* ---------- Write-through : DISCIPLINE ---------- */
  function mapApiDiscipline(x){
    return { id:'d'+x.id, apiId:x.id, stu:'e'+x.student_id, date:x.date||'',
             motif:x.motif||'', gravite:x.gravite||'legere', year:x.year||'' };
  }
  function disciplineApiId(x){ if(!x) return null; if(x.apiId!=null) return x.apiId; return _unpfx('d', x.id); }
  async function hydrateDisciplineApi(){
    if(!apiOn()||!API.authenticated()) return false;
    try{ const r=await API.listDiscipline(null); const items=(r&&r.items)||[];
      mergeArray(DISC_STORE, items.map(mapApiDiscipline)); return true; }
    catch(e){ if(e&&e.status!==403&&typeof toast==='function') toast('Discipline : '+(e.message||'indisponible')); return false; }
  }
  async function listDisciplineApi(stuFrontId){
    const r=await API.listDiscipline(stuFrontId?{ student_id:_unpfx('e',stuFrontId) }:null); return (r&&r.items)||[];
  }
  async function createDisciplineApi(stuFrontId, d){
    const r=await API.createDiscipline({ student_id:_unpfx('e',stuFrontId),
      date:(d&&d.date)||'', motif:(d&&d.motif)||'', gravite:(d&&d.gravite)||'' });
    const obj=r&&r.discipline?mapApiDiscipline(r.discipline):null; if(obj) DISC_STORE.push(obj); return obj;
  }
  async function deleteDisciplineApi(x){
    const id=(x&&typeof x==='object')?disciplineApiId(x):x; if(id==null) throw new Error('Cas de discipline sans identifiant serveur');
    await API.deleteDiscipline(id);
    if(x&&typeof x==='object'){ const i=DISC_STORE.indexOf(x); if(i>=0) DISC_STORE.splice(i,1); } return true;
  }

  /* ---------- Write-through : PAIEMENTS ---------- */
  function mapApiPayment(p){
    return { id:'p'+p.id, apiId:p.id, stu:'e'+p.student_id, amount:(+p.amount||0),
             mode:p.mode||'', date:p.date||'', ref:p.ref||'', bank:'', recu:p.label||'', year:p.year||'' };
  }
  function paymentApiId(p){ if(!p) return null; if(p.apiId!=null) return p.apiId; return _unpfx('p', p.id); }
  async function hydratePaymentsApi(params){
    if(!apiOn()||!API.authenticated()) return false;
    const p={}; if(params){ if(params.student) p.student_id=_unpfx('e',params.student); if(params.year) p.year=params.year; }
    try{ const r=await API.listPayments(p); const items=(r&&r.items)||[]; mergeArray(PAY_STORE, items.map(mapApiPayment)); return true; }
    catch(e){ if(e&&e.status!==403&&typeof toast==='function') toast('Paiements : '+(e.message||'indisponibles')); return false; }
  }
  async function createPaymentApi(front){
    const r=await API.createPayment({ student_id:_unpfx('e', front.stu), year:(front.year||state.year),
      amount:(+front.amount||0), mode:front.mode||'', ref:front.ref||'', label:front.recu||'', date:front.date||'' });
    const obj=r&&r.payment?mapApiPayment(r.payment):null; if(obj) PAY_STORE.push(obj); return obj;
  }
  async function deletePaymentApi(p){
    const id=paymentApiId(p); if(id==null) throw new Error('Paiement sans identifiant serveur');
    await API.deletePayment(id); const i=PAY_STORE.indexOf(p); if(i>=0) PAY_STORE.splice(i,1); return true;
  }

  /* ---------- Hydratation : JOURNAL D'AUDIT (lecture seule) ---------- */
  function _fmtWhen(iso){ if(!iso) return ''; const d=new Date(iso);
    if(isNaN(d.getTime())) return String(iso).slice(0,16).replace('T',' ');
    const p=n=>String(n).padStart(2,'0');
    return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes()); }
  // Correspondance code d'action backend -> libelle FR + niveau d'affichage.
  const _LOG_LABELS={
    login:['Connexion','ok'], login_echec:['Échec de connexion','error'],
    alerte_pic_echecs:['Pic d\'échecs de connexion','error'],
    change_password:['Changement de mot de passe','warn'],
    save_grades:['Notes enregistrées','ok'], delete_grade:['Note supprimée','warn'],
    save_attendance:['Appel enregistré','ok'], delete_attendance:['Appel supprimé','warn'],
    create_class:['Classe créée','ok'], delete_class:['Classe supprimée','warn'],
    create_subject:['Matière créée','ok'], update_subject:['Matière modifiée','ok'], delete_subject:['Matière supprimée','warn'],
    save_program:['Programme enregistré','ok'], update_program:['Programme modifié','ok'], delete_program:['Programme supprimé','warn'],
    create_student:['Élève créé','ok'], update_student:['Élève modifié','ok'], delete_student:['Élève supprimé','warn'],
    save_enrollment:['Inscription enregistrée','ok'],
    create_teacher:['Enseignant créé','ok'], update_teacher:['Enseignant modifié','ok'], delete_teacher:['Enseignant supprimé','warn'],
    create_discipline:['Incident disciplinaire','warn'], delete_discipline:['Incident supprimé','warn'],
    create_payment:['Paiement enregistré','ok'], delete_payment:['Paiement supprimé','warn'],
    update_config:['Réglages établissement modifiés','ok'],
    compte_actif:['Compte activé','ok'], compte_desactive:['Compte désactivé','warn'], compte_supprime:['Compte supprimé','warn']
  };
  function _logLabel(code){ const m=_LOG_LABELS[code]; return m?m[0]:(code||'Action'); }
  function _logLevel(code){ const m=_LOG_LABELS[code]; return m?m[1]:'info'; }
  function mapApiLog(a){
    const code=a.action||'';
    return { id:'lg'+a.id, apiId:a.id, when:_fmtWhen(a.created_at),
             school:(a.school_id!=null?'sc'+a.school_id:'—'),
             user:(a.user_id!=null?('#'+a.user_id):'Système'), role:'—',
             action:_logLabel(code), code:code, detail:a.detail||'', ip:a.ip||'', level:_logLevel(code) };
  }
  async function hydrateLogsApi(limit){
    if(!apiOn()||!API.authenticated()) return false;
    try{ const r=await API.listLogs(limit?{ limit:limit }:null); const items=(r&&r.items)||[];
      mergeArray(LOGS, items.map(mapApiLog)); return true; }
    catch(e){ if(e&&e.status!==403&&typeof toast==='function') toast('Journal : '+(e.message||'indisponibles')); return false; }
  }

  // ---- Supervision : stats de connexion + comptage des comptes (serveur) ----
  // Resultats bruts de l'API, consommes par la vue "logs" (admin.js).
  let CONN_STATS=null;  // { jours, global:{...}, etablissements:[...] }
  let USER_STATS=null;  // { total, actifs, inactifs, global:{<role>:n}, etablissements:[...] }
  async function hydrateConnStatsApi(jours){
    if(!apiOn()||!API.authenticated()) return false;
    try{ CONN_STATS=await API.statsConnexions(jours?{ jours:jours }:null); return true; }
    catch(e){ if(e&&e.status!==403&&typeof toast==='function') toast('Stats connexions : '+(e.message||'indisponibles')); return false; }
  }
  async function hydrateUserStatsApi(){
    if(!apiOn()||!API.authenticated()) return false;
    try{ USER_STATS=await API.statsUsers(); return true; }
    catch(e){ if(e&&e.status!==403&&typeof toast==='function') toast('Stats utilisateurs : '+(e.message||'indisponibles')); return false; }
  }

  // backend user -> forme front (USERS). schoolId prefixe 'sc' pour coller aux vues.
  function mapApiUser(u){
    return { id:'u'+u.id, apiId:u.id, name:(u.full_name||u.email||('#'+u.id)),
             email:u.email||'', login:u.login||'', role:mapApiRole(u.role),
             active:u.active!==false, status:'active',
             schoolId:(u.school_id!=null?'sc'+u.school_id:''), perms:{},
             teacherId:(u.teacher_id!=null?('t'+u.teacher_id):undefined),
             studentId:(u.student_id!=null?('e'+u.student_id):undefined) };
  }
  // Charge les comptes depuis l'API. `schoolId` = id front ('sc3') ou 'all'/'' :
  //   - 'all'/'' -> tous les etablissements (superadmin) ;
  //   - 'scN'    -> seulement cette ecole.
  // Pour un admin d'ecole, le backend confine de toute facon a son ecole.
  async function hydrateUsersApi(schoolId){
    if(!apiOn()||!API.authenticated()) return false;
    let params=null;
    if(schoolId && schoolId!=='all'){ const sc=SCHOOLS.find(s=>s.id===schoolId); const apiId=(sc&&sc.apiId!=null)?sc.apiId:_unpfx('sc',schoolId); if(apiId!=null) params={ school_id:apiId }; }
    try{ const r=await API.listUsers(params); const items=(r&&r.items)||[];
      mergeArray(USERS, items.map(mapApiUser)); return true; }
    catch(e){ if(e&&e.status!==403&&typeof toast==='function') toast('Utilisateurs : '+(e.message||'indisponibles')); return false; }
  }
