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
  // Type de période configuré PAR CYCLE et PAR école : school.periods[cycle] = 'trimestre' | 'semestre'
  function cyclePeriodType(cycle){ const s=activeSchool(); if(!s.periods) s.periods={}; return s.periods[cycle]||'trimestre'; }
  function setPeriodType(cycle,type){ const s=activeSchool(); if(!s.periods) s.periods={}; s.periods[cycle]=type; }
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
  function teacherGradesAllowed(cycle){ const s=activeSchool(); if(!s.teacherGrades) s.teacherGrades={}; return s.teacherGrades[cycle]!==false; }
  function setTeacherGrades(cycle,v){ const s=activeSchool(); if(!s.teacherGrades) s.teacherGrades={}; s.teacherGrades[cycle]=v; }
  // Date limite de saisie PAR ANNÉE + CYCLE + PÉRIODE (par école). Vide = pas de limite.
  function dlKey(cycle,per){ return state.year+'|'+cycle+'|'+per; }
  function getDeadline(cycle,per){ const s=activeSchool(); if(!s.deadlines) s.deadlines={}; return s.deadlines[dlKey(cycle,per)]||''; }
  function setDeadline(cycle,per,d){ const s=activeSchool(); if(!s.deadlines) s.deadlines={}; const k=dlKey(cycle,per); if(d) s.deadlines[k]=d; else delete s.deadlines[k]; }
  function deadlinePassed(cycle,per){ const d=getDeadline(cycle,per); if(!d) return false; return new Date().toISOString().slice(0,10) > d; }
  function fmtDate(d){ if(!d) return ''; const [y,m,j]=d.split('-'); return j+'/'+m+'/'+y; }
  // Paramètres généraux de l'école (identité, notation, système)
  function schoolCfg(){ const s=activeSchool(); if(!s.cfg) s.cfg={ phone:'', email:'', address:'', director:'', logo:'', gradeMax:20, passMark:10, bulletinTpl:'officiel', bulletinFmt:'vrac', bulletinFmtByCycle:{}, optFacCoef1:false, sms:false, whatsapp:false, sender:'XSCHOOL', rankVisible:true, avgMode:'weighted', avgDecimals:2, rankTies:true, mentions:[{l:'Excellent',min:18},{l:'Très Bien',min:16},{l:'Bien',min:14},{l:'Assez Bien',min:12},{l:'Passable',min:10}] }; if(!s.cfg.mentions){ s.cfg.avgMode=s.cfg.avgMode||'weighted'; s.cfg.avgDecimals=(s.cfg.avgDecimals==null?2:s.cfg.avgDecimals); s.cfg.rankTies=(s.cfg.rankTies==null?true:s.cfg.rankTies); s.cfg.mentions=[{l:'Excellent',min:18},{l:'Très Bien',min:16},{l:'Bien',min:14},{l:'Assez Bien',min:12},{l:'Passable',min:10}]; } if(s.cfg.bulletinFmt==null) s.cfg.bulletinFmt='vrac'; if(!s.cfg.bulletinFmtByCycle) s.cfg.bulletinFmtByCycle={}; if(s.cfg.optFacCoef1==null) s.cfg.optFacCoef1=false; return s.cfg; }
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
    const studs=DB.students.filter(e=>e.cls===clsId);
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
  function yearStats(year){ const list=studentsOfYear(year); let f=0,m=0,red=0,nouv=0,sans=0; list.forEach(e=>{ const en=enrollFor(e,year); if(e.sexe==='F') f++; else m++; if((en.statut||'')==='Redoublant') red++; else nouv++; if(!en.cls) sans++; }); return {total:list.length,f,m,red,nouv,sans,list}; }
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
  function ttGrid(){ const k=ttKey(); if(!TT_STORE[k]) TT_STORE[k]=ttDefault((state.ttIdx+(state.ttGroup==='B'?1:0))%6); return TT_STORE[k]; }

  /* ===================== PONT API (data <-> backend) =====================
   * Non invasif : n'agit que si API.enabled(). Sinon le prototype reste
   * 100% en memoire (donnees de demo). Les vues restent synchrones :
   * l'hydratation remplit DB.classes / SCHOOLS EN PLACE avant le 1er rendu,
   * et les ecritures (create/delete) sont "write-through" cote serveur
   * puis refletees dans les tableaux en memoire.
   */
  function apiOn(){ return (typeof API!=='undefined') && API.enabled(); }

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
    const year=currentSchoolYear();
    const studs=DB.students.filter(e=>e.cls===clsId)
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
    return API.classCards(apiId);
  }

  // role backend -> cle de role frontend (ROLES)
  const API_ROLE_MAP={ superadmin:'super', admin:'admin', teacher:'teacher', supervisor:'surveillant', student:'student' };
  function mapApiRole(r){ return API_ROLE_MAP[r]||'admin'; }

  function mapApiSchool(s){
    return { id:'sc'+s.id, apiId:s.id, name:s.name||('École '+s.id), code:(s.slug||('SC'+s.id)).toUpperCase(),
             slug:s.slug||('sc'+s.id), active:s.active!==false, cycles:CYCLE_NAMES.slice() };
  }
  function mapApiClass(c){
    return { id:'c'+c.id, apiId:c.id, cycle:c.cycle||'', name:c.name||'', grp:c.grp||'', spec:c.spec||'' };
  }
  // retrouve l'id serveur d'une classe front (champ apiId, ou prefixe 'c')
  function classApiId(cls){ if(!cls) return null; if(cls.apiId!=null) return cls.apiId; const m=/^c(\d+)$/.exec(cls.id||''); return m?+m[1]:null; }

  // Remplace le contenu d'un tableau EN PLACE (preserve les references globales).
  function replaceArray(arr,items){ arr.length=0; for(let i=0;i<items.length;i++) arr.push(items[i]); return arr; }

  // Hydrate les donnees depuis l'API (best-effort). A appeler avant le 1er rendu.
  async function hydrateFromApi(){
    if(!apiOn() || !API.authenticated()) return false;
    let u=API.user();
    try{ if(!u){ const r=await API.me(); u=r&&r.user; API.setUser(u||null); } }
    catch(e){ API.logout(); return false; } // token invalide/expire -> on repart hors-ligne
    const role=u?mapApiRole(u.role):'admin';
    if(role==='super'){
      try{ const r=await API.listSchools(); const items=(r&&r.items)||[];
        if(items.length){ replaceArray(SCHOOLS, items.map(mapApiSchool)); if(!SCHOOLS.find(s=>s.id===state.schoolId)) state.schoolId=SCHOOLS[0].id; } }
      catch(e){ if(typeof toast==='function') toast('Établissements : '+(e.message||'indisponibles')); }
    }
    // Donnees de reference (best-effort : une liste indisponible n'empeche pas les autres).
    await _hydrateList(()=>API.listClasses(),  DB.classes,   mapApiClass,   'Classes');
    await _hydrateList(()=>API.listSubjects(), DB.subjects,  mapApiSubject, 'Matières');
    await _hydrateList(()=>API.listTeachers(), DB.teachers,  mapApiTeacher, 'Enseignants');
    await _hydrateList(()=>API.listStudents(), DB.students,  mapApiStudent, 'Élèves');
    await _hydrateList(()=>API.listPrograms(), DB.program,   mapApiProgram, 'Programme');
    return true;
  }

  // Charge une liste API dans un tableau en memoire (remplacement en place).
  // 403 = role sans acces a cette ressource : on ignore silencieusement.
  async function _hydrateList(call, arr, mapper, label){
    try{ const r=await call(); const items=(r&&r.items)||[]; replaceArray(arr, items.map(mapper)); return true; }
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
  // Cree un etablissement (superadmin) puis l'ajoute a SCHOOLS.
  async function createSchoolApi(payload){
    const r=await API.createSchool(payload); const s=r&&r.school; const obj=s?mapApiSchool(s):null;
    if(obj) SCHOOLS.push(obj); return obj;
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
      for(const k in store){ if(Object.prototype.hasOwnProperty.call(store,k)) delete store[k]; }
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

  /* ---------- Write-through : APPEL / PRESENCES ---------- */
  function mapApiAttendance(a){
    return { id:'a'+a.id, apiId:a.id, stu:'e'+a.student_id,
             cls:(a.class_id!=null?'c'+a.class_id:''), date:a.date||'', status:a.status||'present' };
  }
  async function hydrateAttendanceApi(cls, date){
    if(!apiOn()||!API.authenticated()) return false;
    const p={}; if(cls) p.class_id=_unpfx('c',cls); if(date) p.date=date;
    try{ const r=await API.listAttendance(p); const items=(r&&r.items)||[];
      for(let i=ATT_STORE.length-1;i>=0;i--){ const a=ATT_STORE[i]; if((!cls||a.cls===cls)&&(!date||a.date===date)) ATT_STORE.splice(i,1); }
      items.forEach(it=>ATT_STORE.push(mapApiAttendance(it))); return true; }
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

  /* ---------- Write-through : DISCIPLINE ---------- */
  function mapApiDiscipline(x){
    return { id:'d'+x.id, apiId:x.id, stu:'e'+x.student_id, date:x.date||'',
             motif:x.motif||'', gravite:x.gravite||'legere', year:x.year||'' };
  }
  function disciplineApiId(x){ if(!x) return null; if(x.apiId!=null) return x.apiId; return _unpfx('d', x.id); }
  async function hydrateDisciplineApi(){
    if(!apiOn()||!API.authenticated()) return false;
    try{ const r=await API.listDiscipline(null); const items=(r&&r.items)||[];
      replaceArray(DISC_STORE, items.map(mapApiDiscipline)); return true; }
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
    try{ const r=await API.listPayments(p); const items=(r&&r.items)||[]; replaceArray(PAY_STORE, items.map(mapApiPayment)); return true; }
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
  function mapApiLog(a){
    return { id:'lg'+a.id, apiId:a.id, when:_fmtWhen(a.created_at),
             school:(a.school_id!=null?'sc'+a.school_id:'—'),
             user:(a.user_id!=null?('#'+a.user_id):'Système'), role:'—',
             action:a.action||'', detail:a.detail||'', ip:a.ip||'', level:'ok' };
  }
  async function hydrateLogsApi(limit){
    if(!apiOn()||!API.authenticated()) return false;
    try{ const r=await API.listLogs(limit?{ limit:limit }:null); const items=(r&&r.items)||[];
      replaceArray(LOGS, items.map(mapApiLog)); return true; }
    catch(e){ if(e&&e.status!==403&&typeof toast==='function') toast('Journal : '+(e.message||'indisponibles')); return false; }
  }
