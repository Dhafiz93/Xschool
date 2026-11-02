/* XSchool · Module STATISTIQUES résultats scolaires.
   Scope partagé (pas d'IIFE) : fonctions top-level = globales, réutilise les helpers
   de data.js / views.js / core.js. Stats par classe + globales école, par période
   (semestre/trimestre selon cyclePeriodType) + annuel. Exports PDF / Excel / impression.
   Marche hors-ligne et via API (fallback offline). */

  // Statut d'inscription effectif de l'élève pour l'année active (enrollment prioritaire).
  function statStatut(e){ const en=(typeof enrollFor==='function')?enrollFor(e,state.year):null; return (en&&en.statut)||e.statut||'Nouveau'; }
  function statIsAbandon(e){ return statStatut(e)==='Abandon'; }

  // Liste des périodes d'un cycle (selon sa configuration semestre/trimestre).
  function statPeriods(cycle){ return periodList(cyclePeriodType(cycle)); }

  // Moyenne générale par élève pour une classe : idx=-1 => annuel (moyenne des périodes),
  // idx>=0 => période. Retourne un objet { stuId: moy|null }.
  function statMoyMap(clsId,idx){
    const cls=getCls(clsId); if(!cls) return {};
    const cfg=schoolCfg(); const pers=statPeriods(cls.cycle); const map={};
    if(idx===-1){
      const acc={}, cnt={};
      pers.forEach(per=>{ const d=classBulletinData(clsId,per); d.rows.forEach(r=>{ if(r.moyGen!=null){ acc[r.stu.id]=(acc[r.stu.id]||0)+r.moyGen; cnt[r.stu.id]=(cnt[r.stu.id]||0)+1; } }); });
      Object.keys(acc).forEach(id=>{ map[id]=avgRound(acc[id]/cnt[id],cfg); });
    } else if(idx>=0 && idx<pers.length){
      const d=classBulletinData(clsId,pers[idx]); d.rows.forEach(r=>{ if(r.moyGen!=null) map[r.stu.id]=r.moyGen; });
    }
    return map;
  }

  // Statistiques d'une classe. idx=-1 annuel, sinon index de période.
  // graded=false quand la période demandée n'existe pas pour ce cycle (ex. 3e trim. d'un cycle semestriel).
  function statClassData(clsId,idx){
    const cls=getCls(clsId); const cfg=schoolCfg(); const pass=+cfg.passMark||10;
    const pers=cls?statPeriods(cls.cycle):[];
    const graded = (idx===-1) || (idx>=0 && idx<pers.length);
    const studs=studentsInClass(clsId);
    const moyMap=graded?statMoyMap(clsId,idx):{};
    let f=0,m=0,ab=0,re=0,ec=0; const list=[];
    studs.forEach(e=>{
      const abandon=statIsAbandon(e);
      const moy=(moyMap[e.id]!=null)?moyMap[e.id]:null;
      if((e.sexe||'')==='F') f++; else m++;
      let result;
      if(abandon){ ab++; result='abandon'; }
      else if(!graded){ result='na'; }
      else if(moy!=null && moy>=pass){ re++; result='reussi'; }
      else { ec++; result='echoue'; }
      list.push({stu:e, sexe:e.sexe||'', moy, abandon, result});
    });
    list.sort((a,b)=>{ if(a.abandon!==b.abandon) return a.abandon?1:-1; const am=a.moy==null?-1:a.moy, bm=b.moy==null?-1:b.moy; return bm-am; });
    const scopeLabel = idx===-1?'Annuel':(pers[idx]||('Période '+(idx+1)));
    return {cls, idx, graded, total:studs.length, f, m, abandon:ab, reussi:re, echoue:ec, list, pass, scopeLabel};
  }

  // Statistiques globales de l'école (toutes classes des cycles actifs).
  // idx générique : -1 annuel, 0..2 numéro de période (ignorée pour les cycles où elle n'existe pas).
  function statSchoolData(idx){
    const clsList=DB.classes.filter(c=>activeCycles().includes(c.cycle));
    let total=0,f=0,m=0,ab=0,re=0,ec=0,gradedTotal=0; const rows=[];
    clsList.forEach(c=>{ const d=statClassData(c.id,idx); total+=d.total; f+=d.f; m+=d.m; ab+=d.abandon;
      if(d.graded){ re+=d.reussi; ec+=d.echoue; gradedTotal+=(d.total-d.abandon); }
      rows.push(d); });
    rows.sort((a,b)=>b.total-a.total);
    const scopeLabel = idx===-1?'Annuel':('Période '+(idx+1));
    return {idx, total, f, m, abandon:ab, reussi:re, echoue:ec, gradedTotal, rows, scopeLabel};
  }

  // Nombre maxi de périodes parmi les cycles actifs (pour les onglets globaux).
  function statMaxPeriods(){ const cs=DB.classes.filter(c=>activeCycles().includes(c.cycle)); let mx=0; cs.forEach(c=>{ mx=Math.max(mx,statPeriods(c.cycle).length); }); return mx||3; }

  // Pastille de résultat d'un élève.
  function statResultBadge(r){
    if(r==='reussi') return badge('Réussi','bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300');
    if(r==='echoue') return badge('Échoué','bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300');
    if(r==='abandon') return badge('Abandon','bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200');
    return badge('—','bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500');
  }

  // ---------- PONT API STATS (calcul serveur + repli hors-ligne) ----------
  // Cache des resultats calcules cote serveur. Cle = portee courante.
  // Non invasif : si l'API est desactivee, on garde le calcul local (demo).
  if(typeof STAT_CACHE==='undefined'){ var STAT_CACHE={}; }

  // id serveur d'un eleve front (champ apiId, ou prefixe 'e').
  function studentApiId(e){ if(!e) return null; if(e.apiId!=null) return e.apiId; const m=/^e(\d+)$/.exec(e.id||''); return m?+m[1]:null; }

  // Query params communs (annee + index de periode ; -1/annuel => pas d'idx).
  function _statParams(idx){ const p={ year:state.year }; if(idx!=null && idx!==-1) p.idx=idx; return p; }

  // Adapte la reponse /api/stats/global a la forme attendue par les vues.
  function _adaptSchool(g,idx){
    return { idx:idx, total:g.total|0, f:g.f|0, m:g.m|0, abandon:g.abandon|0,
      reussi:g.reussi|0, echoue:g.echoue|0, gradedTotal:g.gradedTotal|0,
      scopeLabel:g.scope||(idx===-1?'Annuel':'Période '+(idx+1)),
      rows:(g.rows||[]).map(r=>{
        const cls=DB.classes.find(c=>classApiId(c)===r.class_id)||{id:'c'+r.class_id,name:r.name,cycle:r.cycle,grp:''};
        return { cls:cls, total:r.total|0, f:r.f|0, m:r.m|0, graded:!!r.graded,
          reussi:r.reussi||0, echoue:r.echoue||0, abandon:r.abandon|0 };
      }) };
  }
  // Adapte la reponse /api/stats/class/<id> a la forme attendue par les vues.
  function _adaptClass(d,idx){
    return { idx:idx, graded:!!d.graded, total:d.total|0, f:d.f|0, m:d.m|0,
      abandon:d.abandon|0, reussi:d.reussi|0, echoue:d.echoue|0, pass:d.pass,
      scopeLabel:d.scope||(idx===-1?'Annuel':'Période '+(idx+1)),
      list:(d.list||[]).map(it=>{
        const stu=DB.students.find(e=>studentApiId(e)===it.student_id)||{id:'e'+it.student_id,nom:it.name,prenom:'',sexe:it.sexe};
        return { stu:stu, sexe:it.sexe||'', moy:(it.moy==null?null:it.moy), abandon:!!it.abandon, result:it.result };
      }) };
  }

  // Bloc "chargement" pendant l'appel reseau.
  function _statLoading(msg){
    return '<div class="card-in rounded-2xl p-6 bg-white dark:bg-slate-900 shadow-soft flex items-center gap-3 text-sm text-slate-500">'
      +'<span class="inline-block w-4 h-4 rounded-full border-2 border-brand-500 border-t-transparent animate-spin"></span>'
      +escH(msg||'Chargement…')+'</div>';
  }

  // Resout les stats globales : API (cache + fetch async + re-render) ou local.
  // Retourne null tant que le resultat serveur n'est pas pret (affiche un loader).
  function resolveSchoolData(idx){
    if(!apiOn()) return statSchoolData(idx);
    const key='g|'+idx+'|'+state.year;
    if(STAT_CACHE[key]) return STAT_CACHE[key];
    if(!STAT_CACHE[key+'|L']){ STAT_CACHE[key+'|L']=true;
      API.statsGlobal(_statParams(idx)).then(g=>{ STAT_CACHE[key]=_adaptSchool(g,idx); delete STAT_CACHE[key+'|L'];
        if(state.view==='stats' && state.statTab==='globale') renderView();
      }).catch(e=>{ delete STAT_CACHE[key+'|L']; STAT_CACHE[key]=statSchoolData(idx);
        if(typeof toast==='function') toast('Stats globales : '+((e&&e.message)||'indisponibles'));
        if(state.view==='stats' && state.statTab==='globale') renderView(); });
    }
    return null;
  }
  // Adapte la reponse /api/stats/synthesis a la forme attendue par statsSynthesis().
  // Resout les objets classe front depuis DB.classes (comme _adaptSchool).
  function _adaptSynth(s,idx){
    const findCls=(cid,nm,cy,gp)=>DB.classes.find(c=>classApiId(c)===cid)||{id:'c'+cid,name:nm,cycle:cy||'',grp:gp||''};
    const scope=s.scope||(idx===-1?'Annuel':'Periode '+(idx+1));
    const rows=(s.rows||[]).map(r=>({
      cls:findCls(r.class_id,r.name,r.cycle,r.grp), idx:idx, graded:!!r.graded,
      total:r.total|0, abandon:r.abandon|0, noted:r.noted|0,
      avg:(r.avg==null?null:r.avg), min:(r.min==null?null:r.min), max:(r.max==null?null:r.max),
      reussi:r.reussi|0, taux:(r.taux==null?null:r.taux),
      mentions:r.mentions||{}, top:(r.top?{name:r.top.name,moy:r.top.moy}:null),
      rank:(r.rank==null?null:r.rank), scopeLabel:r.scope||scope
    }));
    return { idx:idx, rows:rows, classes:s.classes|0,
      totalEff:s.totalEff|0, abandonTotal:s.abandonTotal|0,
      notedTotal:s.notedTotal|0, reussiTotal:s.reussiTotal|0,
      schoolAvg:(s.schoolAvg==null?null:s.schoolAvg), taux:(s.taux==null?null:s.taux),
      best:(s.best?{cls:findCls(s.best.class_id,s.best.name),avg:s.best.avg}:null),
      weak:(s.weak?{cls:findCls(s.weak.class_id,s.weak.name),avg:s.weak.avg}:null),
      scopeLabel:scope };
  }

  // Resout la synthese par classe : API (cache + fetch async + re-render) ou local.
  // Retourne null tant que le resultat serveur n'est pas pret (affiche un loader).
  function resolveSynthData(idx){
    if(!apiOn()) return statSchoolSynthesis(idx);
    const key='s|'+idx+'|'+state.year;
    if(STAT_CACHE[key]) return STAT_CACHE[key];
    if(!STAT_CACHE[key+'|L']){ STAT_CACHE[key+'|L']=true;
      API.statsSynthesis(_statParams(idx)).then(s=>{ STAT_CACHE[key]=_adaptSynth(s,idx); delete STAT_CACHE[key+'|L'];
        if(state.view==='stats' && state.statTab==='synthese') renderView();
      }).catch(e=>{ delete STAT_CACHE[key+'|L']; STAT_CACHE[key]=statSchoolSynthesis(idx);
        if(typeof toast==='function') toast('Synthese : '+((e&&e.message)||'indisponible'));
        if(state.view==='stats' && state.statTab==='synthese') renderView(); });
    }
    return null;
  }

  // Resout les stats d'une classe (meme principe).
  function resolveClassData(clsId,idx){
    if(!apiOn()) return statClassData(clsId,idx);
    const key='c|'+clsId+'|'+idx+'|'+state.year;
    if(STAT_CACHE[key]) return STAT_CACHE[key];
    if(!STAT_CACHE[key+'|L']){ STAT_CACHE[key+'|L']=true;
      const apiId=classApiId(getCls(clsId));
      API.statsClass(apiId,_statParams(idx)).then(d=>{ STAT_CACHE[key]=_adaptClass(d,idx); delete STAT_CACHE[key+'|L'];
        if(state.view==='stats' && state.statTab!=='globale') renderView();
      }).catch(e=>{ delete STAT_CACHE[key+'|L']; STAT_CACHE[key]=statClassData(clsId,idx);
        if(typeof toast==='function') toast('Stats classe : '+((e&&e.message)||'indisponibles'));
        if(state.view==='stats' && state.statTab!=='globale') renderView(); });
    }
    return null;
  }
  // Versions synchrones pour exports/impression : cache serveur si present, sinon local.
  function statSchoolDataNow(idx){ if(apiOn()){ const k='g|'+idx+'|'+state.year; if(STAT_CACHE[k]) return STAT_CACHE[k]; } return statSchoolData(idx); }
  function statClassDataNow(clsId,idx){ if(apiOn()){ const k='c|'+clsId+'|'+idx+'|'+state.year; if(STAT_CACHE[k]) return STAT_CACHE[k]; } return statClassData(clsId,idx); }
  function statSchoolSynthesisNow(idx){ if(apiOn()){ const k='s|'+idx+'|'+state.year; if(STAT_CACHE[k]) return STAT_CACHE[k]; } return statSchoolSynthesis(idx); }
  // Vide le cache (apres une ecriture : abandon, changement d'annee...).
  function statInvalidateCache(){ for(const k in STAT_CACHE){ if(Object.prototype.hasOwnProperty.call(STAT_CACHE,k)) delete STAT_CACHE[k]; } }

  // ---------- VUE STATISTIQUES ----------
  function statsAdmin(){
    const clsList=DB.classes.filter(c=>activeCycles().includes(c.cycle));
    if(!clsList.length) return `<div class="rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft card-in text-sm text-slate-500">Aucune classe disponible pour les cycles actifs. Crée d'abord des classes et inscris des élèves.</div>`;
    const tab=(state.statTab==='globale')?'globale':(state.statTab==='synthese')?'synthese':'classe';
    const tabChip=(id,label)=>'<button data-sttab="'+id+'" class="px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition '+(tab===id?'bg-brand-600 text-white shadow-soft':'bg-white dark:bg-slate-900 text-slate-500 shadow-soft')+'">'+label+'</button>';
    const tabBar='<div class="flex gap-2 mb-4 overflow-x-auto no-scrollbar">'+tabChip('classe','Par classe')+tabChip('synthese','Synthèse par classe')+tabChip('globale','Globales école')+'</div>';
    const yearBadge='<div class="flex items-center gap-2 mb-3"><span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"><span class="w-3.5 h-3.5 inline-block">'+svg(I.cal)+'</span>Année scolaire : '+escH(state.year||'')+'</span></div>';
    const expBar='<div class="flex flex-wrap gap-2 mb-3">'
      +'<button data-stpdf class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition">'+'<span class="w-3.5 h-3.5 inline-block">'+svg(I.doc)+'</span>'+'PDF</button>'
      +'<button data-stxlsx class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition">'+'<span class="w-3.5 h-3.5 inline-block">'+svg(I.doc)+'</span>'+'Excel</button>'
      +'<button data-stprint class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition">'+'<span class="w-3.5 h-3.5 inline-block">'+svg(I.doc)+'</span>'+'Imprimer</button>'
      +'</div>';
    return yearBadge + tabBar + (tab==='classe'?statsByClass():tab==='synthese'?statsSynthesis():statsGlobal()) + '<div class="mt-4">'+expBar+'</div>';
  }

  // Petite tuile colorée avec valeur + sous-titre (réutilise le style stat()).
  function statTile(label,val,sub,color){ return stat(label,String(val),escH(sub||''),color); }
  function statPct(part,whole){ return whole?Math.round(part/whole*100):0; }

  // ----- Onglet « Par classe » -----
  function statsByClass(){
    const clsList=DB.classes.filter(c=>activeCycles().includes(c.cycle));
    if(!clsList.find(c=>c.id===state.statCls)) state.statCls=clsList[0].id;
    const cls=getCls(state.statCls); const pers=statPeriods(cls.cycle);
    if(state.statIdx!==-1 && (state.statIdx<0 || state.statIdx>=pers.length)) state.statIdx=-1;
    const clsOpts=clsList.map(c=>'<option value="'+c.id+'"'+(c.id===state.statCls?' selected':'')+'>'+escH(clsLabel(c.id))+'</option>').join('');
    const clsSel='<label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">Classe<select id="st_cls" class="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 shadow-soft text-sm font-normal text-slate-700 dark:text-slate-200">'+clsOpts+'</select></label>';
    const perChip=(i,label)=>'<button data-stidx="'+i+'" class="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition '+(state.statIdx===i?'bg-brand-600 text-white':'bg-white dark:bg-slate-900 text-slate-500 shadow-soft')+'">'+label+'</button>';
    let scopeBar='<div class="flex gap-1.5 overflow-x-auto no-scrollbar">';
    pers.forEach((p,i)=>{ scopeBar+=perChip(i,p); }); scopeBar+=perChip(-1,'Annuel'); scopeBar+='</div>';
    const head='<div class="flex flex-col sm:flex-row sm:items-end gap-3 mb-4">'+clsSel+'<div class="flex-1">'+scopeBar+'</div></div>';
    const d=resolveClassData(state.statCls,state.statIdx);
    if(d==null) return head+_statLoading('Chargement des statistiques de la classe…');
    const nonAb=d.total-d.abandon;
    const tiles='<div class="grid grid-cols-2 gap-3 lg:grid-cols-3">'
      +statTile('Effectif total',d.total,d.scopeLabel,'bg-brand-600')
      +statTile('Filles',d.f,statPct(d.f,d.total)+'% de l\'effectif','bg-pink-500')
      +statTile('Garçons',d.m,statPct(d.m,d.total)+'% de l\'effectif','bg-sky-500')
      +statTile('Réussi',d.graded?d.reussi:'—',d.graded?(statPct(d.reussi,nonAb)+'% des présents'):'période non ouverte','bg-emerald-500')
      +statTile('Échoué',d.graded?d.echoue:'—',d.graded?(statPct(d.echoue,nonAb)+'% des présents'):'période non ouverte','bg-rose-500')
      +statTile('Abandon',d.abandon,statPct(d.abandon,d.total)+'% de l\'effectif','bg-slate-600')
      +'</div>';
    // table élèves
    const rowsHtml=d.list.length?d.list.map((it,i)=>{
      const action = it.abandon
        ? '<button data-stnotify="'+it.stu.id+'" class="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">Notifier parents</button>'
        : '<button data-stab="'+it.stu.id+'" class="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">Marquer abandon</button>';
      return '<tr class="border-t border-slate-100 dark:border-slate-800'+(i%2?' bg-slate-50/50 dark:bg-slate-800/30':'')+'">'
        +'<td class="px-3 py-2 text-slate-400 text-xs">'+(i+1)+'</td>'
        +'<td class="px-3 py-2 font-semibold text-sm">'+escH(stuName(it.stu))+'</td>'
        +'<td class="px-3 py-2 text-center text-xs">'+(it.sexe||'—')+'</td>'
        +'<td class="px-3 py-2 text-center font-extrabold text-brand-700 dark:text-brand-300">'+(it.moy==null?'<span class="text-slate-300">–</span>':fmtN(it.moy))+'</td>'
        +'<td class="px-3 py-2 text-center">'+statResultBadge(it.result)+'</td>'
        +'<td class="px-3 py-2 text-right">'+action+'</td></tr>';
    }).join(''):'<tr><td colspan="6" class="px-3 py-6 text-center text-sm text-slate-400">Aucun élève inscrit dans cette classe.</td></tr>';
    const table='<div class="card-in rounded-2xl bg-white dark:bg-slate-900 shadow-soft overflow-hidden mt-4"><div class="overflow-x-auto"><table class="w-full text-left"><thead class="text-[11px] uppercase tracking-wide text-slate-400"><tr>'
      +'<th class="px-3 py-2">N°</th><th class="px-3 py-2">Élève</th><th class="px-3 py-2 text-center">Sexe</th><th class="px-3 py-2 text-center">Moyenne</th><th class="px-3 py-2 text-center">Résultat</th><th class="px-3 py-2 text-right">Action</th>'
      +'</tr></thead><tbody>'+rowsHtml+'</tbody></table></div></div>';
    return head+tiles+section('Détail des élèves · '+escH(clsLabel(state.statCls)))+table;
  }

  // ----- Onglet « Globales école » -----
  function statsGlobal(){
    const maxP=statMaxPeriods();
    if(state.statGIdx!==-1 && (state.statGIdx<0 || state.statGIdx>=maxP)) state.statGIdx=-1;
    const perChip=(i,label)=>'<button data-stgidx="'+i+'" class="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition '+(state.statGIdx===i?'bg-brand-600 text-white':'bg-white dark:bg-slate-900 text-slate-500 shadow-soft')+'">'+label+'</button>';
    let scopeBar='<div class="flex gap-1.5 overflow-x-auto no-scrollbar mb-4">';
    for(let i=0;i<maxP;i++) scopeBar+=perChip(i,'Période '+(i+1)); scopeBar+=perChip(-1,'Annuel'); scopeBar+='</div>';
    const d=resolveSchoolData(state.statGIdx);
    if(d==null) return scopeBar+_statLoading('Chargement des statistiques globales…');
    const tiles='<div class="grid grid-cols-2 gap-3 lg:grid-cols-3">'
      +statTile('Effectif total',d.total,activeCycles().length+' cycle(s) · '+d.rows.length+' classe(s)','bg-brand-600')
      +statTile('Filles',d.f,statPct(d.f,d.total)+'% de l\'effectif','bg-pink-500')
      +statTile('Garçons',d.m,statPct(d.m,d.total)+'% de l\'effectif','bg-sky-500')
      +statTile('Abandon',d.abandon,statPct(d.abandon,d.total)+'% de l\'effectif','bg-slate-600')
      +statTile('Réussi',d.reussi,statPct(d.reussi,d.gradedTotal)+'% des présents','bg-emerald-500')
      +statTile('Échoué',d.echoue,statPct(d.echoue,d.gradedTotal)+'% des présents','bg-rose-500')
      +'</div>';
    const rowsHtml=d.rows.length?d.rows.map((c,i)=>{
      const nonAb=c.total-c.abandon; const taux=c.graded?statPct(c.reussi,nonAb):null;
      return '<tr class="border-t border-slate-100 dark:border-slate-800'+(i%2?' bg-slate-50/50 dark:bg-slate-800/30':'')+'">'
        +'<td class="px-3 py-2 font-semibold text-sm">'+escH(clsLabel(c.cls.id))+'</td>'
        +'<td class="px-3 py-2 text-center">'+c.total+'</td>'
        +'<td class="px-3 py-2 text-center text-pink-600 dark:text-pink-400">'+c.f+'</td>'
        +'<td class="px-3 py-2 text-center text-sky-600 dark:text-sky-400">'+c.m+'</td>'
        +'<td class="px-3 py-2 text-center text-emerald-600 dark:text-emerald-400">'+(c.graded?c.reussi:'—')+'</td>'
        +'<td class="px-3 py-2 text-center text-rose-600 dark:text-rose-400">'+(c.graded?c.echoue:'—')+'</td>'
        +'<td class="px-3 py-2 text-center text-slate-500">'+c.abandon+'</td>'
        +'<td class="px-3 py-2 text-center font-bold">'+(taux==null?'<span class="text-slate-300">–</span>':taux+'%')+'</td></tr>';
    }).join(''):'<tr><td colspan="8" class="px-3 py-6 text-center text-sm text-slate-400">Aucune classe.</td></tr>';
    const table='<div class="card-in rounded-2xl bg-white dark:bg-slate-900 shadow-soft overflow-hidden mt-4"><div class="overflow-x-auto"><table class="w-full text-left"><thead class="text-[11px] uppercase tracking-wide text-slate-400"><tr>'
      +'<th class="px-3 py-2">Classe</th><th class="px-3 py-2 text-center">Effectif</th><th class="px-3 py-2 text-center">F</th><th class="px-3 py-2 text-center">G</th><th class="px-3 py-2 text-center">Réussi</th><th class="px-3 py-2 text-center">Échoué</th><th class="px-3 py-2 text-center">Abandon</th><th class="px-3 py-2 text-center">Taux</th>'
      +'</tr></thead><tbody>'+rowsHtml+'</tbody></table></div></div>';
    return scopeBar+tiles+section('Répartition par classe · '+escH(d.scopeLabel))+table;
  }

  // ----- SYNTHÈSE PAR CLASSE (résultats académiques consolidés) -----
  // Agrège la performance académique d'une classe : moyenne de classe (moyenne des
  // moyennes des élèves notés), min/max, taux de réussite, répartition des mentions,
  // 1er de la classe. Réutilise statClassData (offline-first, même source que les onglets).
  function statClassSynthesis(clsId,idx){
    const cls=getCls(clsId); const cfg=schoolCfg();
    const d=statClassData(clsId,idx);
    const pass=d.pass; const graded=d.graded;
    const scored=d.list.filter(it=>!it.abandon && it.moy!=null);
    const moys=scored.map(it=>it.moy);
    const noted=moys.length;
    const sum=moys.reduce((s,x)=>s+x,0);
    const avg=noted?avgRound(sum/noted,cfg):null;
    const min=noted?Math.min.apply(null,moys):null;
    const max=noted?Math.max.apply(null,moys):null;
    const reussi=moys.filter(m=>m>=pass).length;
    const taux=noted?Math.round(reussi/noted*100):null;
    const mentions={};
    (cfg.mentions||[]).forEach(mn=>{ if(mn.l) mentions[mn.l]=0; });
    scored.forEach(it=>{ const lb=mentionFor(it.moy,cfg); if(lb && lb!=='—'){ mentions[lb]=(mentions[lb]||0)+1; } });
    let top=null; scored.forEach(it=>{ if(!top || it.moy>top.moy) top={name:stuName(it.stu),moy:it.moy}; });
    return { cls, idx, graded, total:d.total, abandon:d.abandon, noted, sum, avg, min, max, reussi, taux, pass, mentions, top, rank:null, scopeLabel:d.scopeLabel };
  }

  // Synthèse de l'établissement : une ligne par classe, classement des classes par
  // moyenne de classe, + indicateurs globaux (moyenne pondérée, meilleure/plus faible classe).
  function statSchoolSynthesis(idx){
    const cfg=schoolCfg();
    const clsList=DB.classes.filter(c=>activeCycles().includes(c.cycle));
    const rows=clsList.map(c=>statClassSynthesis(c.id,idx));
    rankByVal(rows,o=>(o.graded&&o.noted)?o.avg:null,(o,rk)=>o.rank=rk,cfg);
    let notedTotal=0, reussiTotal=0, sumW=0, totalEff=0, abandonTotal=0;
    rows.forEach(r=>{ totalEff+=r.total; abandonTotal+=r.abandon; if(r.graded&&r.noted){ notedTotal+=r.noted; reussiTotal+=r.reussi; sumW+=r.sum; } });
    const schoolAvg=notedTotal?avgRound(sumW/notedTotal,cfg):null;
    const taux=notedTotal?Math.round(reussiTotal/notedTotal*100):null;
    const gr=rows.filter(r=>r.graded&&r.noted);
    const best=gr.slice().sort((a,b)=>b.avg-a.avg)[0]||null;
    const weak=gr.slice().sort((a,b)=>a.avg-b.avg)[0]||null;
    const display=rows.slice().sort((a,b)=>{ const ar=(a.graded&&a.noted),br=(b.graded&&b.noted); if(ar!==br) return ar?-1:1; if(ar&&br) return b.avg-a.avg; return 0; });
    const scopeLabel = idx===-1?'Annuel':('Période '+(idx+1));
    return { idx, rows:display, classes:rows.length, totalEff, abandonTotal, notedTotal, reussiTotal, schoolAvg, taux, best, weak, scopeLabel };
  }

  // Abréviation d'un libellé de mention (initiales) pour l'en-tête compact du tableau.
  function _mentAbbr(l){ const w=String(l||'').trim().split(/\s+/); if(w.length>1) return w.map(x=>x[0]).join('').toUpperCase(); return (l||'').slice(0,3); }

  // ----- Onglet « Synthèse par classe » -----
  function statsSynthesis(){
    const maxP=statMaxPeriods();
    if(state.statSIdx!==-1 && (state.statSIdx<0 || state.statSIdx>=maxP)) state.statSIdx=-1;
    const perChip=(i,label)=>'<button data-stsidx="'+i+'" class="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition '+(state.statSIdx===i?'bg-brand-600 text-white':'bg-white dark:bg-slate-900 text-slate-500 shadow-soft')+'">'+label+'</button>';
    let scopeBar='<div class="flex gap-1.5 overflow-x-auto no-scrollbar mb-4">';
    for(let i=0;i<maxP;i++) scopeBar+=perChip(i,'Période '+(i+1)); scopeBar+=perChip(-1,'Annuel'); scopeBar+='</div>';
    const s=resolveSynthData(state.statSIdx);
    if(s==null) return scopeBar+_statLoading('Chargement de la synthèse par classe…');
    const gmax=fmtN(schoolCfg().gradeMax||20);
    const tiles='<div class="grid grid-cols-2 gap-3 lg:grid-cols-3">'
      +statTile('Classes',s.classes,s.notedTotal+' élève(s) noté(s)','bg-brand-600')
      +statTile('Moyenne établissement',s.schoolAvg==null?'—':fmtN(s.schoolAvg),'sur '+gmax,'bg-indigo-500')
      +statTile('Taux de réussite',s.taux==null?'—':(s.taux+'%'),s.reussiTotal+'/'+s.notedTotal+' admis','bg-emerald-500')
      +statTile('Meilleure classe',s.best?clsLabel(s.best.cls.id):'—',s.best?('moy. '+fmtN(s.best.avg)):'—','bg-amber-500')
      +statTile('À renforcer',s.weak?clsLabel(s.weak.cls.id):'—',s.weak?('moy. '+fmtN(s.weak.avg)):'—','bg-rose-500')
      +statTile('Abandons',s.abandonTotal,statPct(s.abandonTotal,s.totalEff)+'% de l\'effectif','bg-slate-600')
      +'</div>';
    const mLabels=(schoolCfg().mentions||[]).filter(m=>m.l).map(m=>m.l);
    const mHead=mLabels.map(l=>'<th class="px-2 py-2 text-center" title="'+escH(l)+'">'+escH(_mentAbbr(l))+'</th>').join('');
    const rowsHtml=s.rows.length?s.rows.map((r,i)=>{
      const ok=r.graded&&r.noted;
      const ments=mLabels.map(l=>'<td class="px-2 py-2 text-center text-xs text-slate-500">'+((r.mentions[l]||0)||'<span class="text-slate-300">·</span>')+'</td>').join('');
      return '<tr class="border-t border-slate-100 dark:border-slate-800'+(i%2?' bg-slate-50/50 dark:bg-slate-800/30':'')+'">'
        +'<td class="px-3 py-2 text-center">'+(ok?'<span class="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-extrabold '+(r.rank===1?'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300':'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')+'">'+r.rank+'</span>':'<span class="text-slate-300">–</span>')+'</td>'
        +'<td class="px-3 py-2 font-semibold text-sm">'+escH(clsLabel(r.cls.id))+'</td>'
        +'<td class="px-3 py-2 text-center text-slate-500">'+r.noted+(r.abandon?(' <span class="text-[10px] text-slate-400">(+'+r.abandon+' ab.)</span>'):'')+'</td>'
        +'<td class="px-3 py-2 text-center font-extrabold text-brand-700 dark:text-brand-300">'+(r.avg==null?'<span class="text-slate-300">–</span>':fmtN(r.avg))+'</td>'
        +'<td class="px-3 py-2 text-center text-rose-500">'+(r.min==null?'–':fmtN(r.min))+'</td>'
        +'<td class="px-3 py-2 text-center text-emerald-600 dark:text-emerald-400">'+(r.max==null?'–':fmtN(r.max))+'</td>'
        +'<td class="px-3 py-2 text-center font-bold">'+(r.taux==null?'<span class="text-slate-300">–</span>':r.taux+'%')+'</td>'
        +ments
        +'<td class="px-3 py-2 text-xs">'+(r.top?('<span class="font-semibold">'+escH(r.top.name)+'</span> <span class="text-slate-400">('+fmtN(r.top.moy)+')</span>'):'<span class="text-slate-300">–</span>')+'</td>'
        +'</tr>';
    }).join(''):'<tr><td colspan="'+(8+mLabels.length)+'" class="px-3 py-6 text-center text-sm text-slate-400">Aucune classe.</td></tr>';
    const table='<div class="card-in rounded-2xl bg-white dark:bg-slate-900 shadow-soft overflow-hidden mt-4"><div class="overflow-x-auto"><table class="w-full text-left"><thead class="text-[11px] uppercase tracking-wide text-slate-400"><tr>'
      +'<th class="px-3 py-2 text-center">Rang</th><th class="px-3 py-2">Classe</th><th class="px-3 py-2 text-center">Notés</th><th class="px-3 py-2 text-center">Moy.</th><th class="px-3 py-2 text-center">Min</th><th class="px-3 py-2 text-center">Max</th><th class="px-3 py-2 text-center">Taux</th>'+mHead+'<th class="px-3 py-2">1er de la classe</th>'
      +'</tr></thead><tbody>'+rowsHtml+'</tbody></table></div></div>';
    const legend=mLabels.length?('<p class="text-[11px] text-slate-400 mt-2">Classes triées par moyenne de classe (moyenne des moyennes des élèves notés). Mentions : '+mLabels.map(l=>escH(_mentAbbr(l))+' = '+escH(l)).join(' · ')+'.</p>'):'';
    return scopeBar+tiles+section('Synthèse comparative des classes · '+escH(s.scopeLabel))+table+legend;
  }

  // ---------- ACTIONS : abandon + notification parents ----------
  // Envoie une alerte aux parents signalant l'abandon de l'élève.
  function statNotifyAbandon(e){
    if(!e) return;
    const cls=e.cls?(' · '+clsLabel(e.cls)):'';
    const al={ id:uid('al'), cat:'info',
      target:'Parents '+stuName(e)+cls, channel:'sms',
      msg:'Nous avons enregistré l\'abandon de '+stuName(e)+'. Merci de contacter la vie scolaire.',
      when:logNow(), count:1, by:'Administration', kind:'abandon', stu:e.id };
    ALERTS.unshift(al);
    logit('Notification abandon', stuName(e)+(e.cls?(' · '+clsLabel(e.cls)):''),'warn');
    toast('Parents de '+stuName(e)+' notifiés ✉');
  }
  // Marque l'élève en abandon (statut d'inscription) puis notifie les parents.
  function statSetAbandon(stuId){
    const e=DB.students.find(x=>x.id===stuId); if(!e) return;
    if(!confirm('Marquer '+stuName(e)+' comme ABANDON et notifier les parents ?')) return;
    const done=()=>{ e.statut='Abandon'; statNotifyAbandon(e); statInvalidateCache(); renderView(); };
    if(typeof apiOn==='function' && apiOn()){
      upsertEnrollmentApi(e,state.year,e.cls,'Abandon').then(done).catch(ex=>toast('Mise à jour refusée : '+((ex&&ex.message)||'erreur')));
      return;
    }
    setEnroll(e,state.year,e.cls,'Abandon'); done();
  }

  function wireStats(){
    const main=$('#main');
    main.querySelectorAll('[data-sttab]').forEach(b=>b.addEventListener('click',()=>{ state.statTab=b.dataset.sttab; renderView(); }));
    const cs=main.querySelector('#st_cls'); if(cs) cs.addEventListener('change',()=>{ state.statCls=cs.value; state.statIdx=-1; renderView(); });
    main.querySelectorAll('[data-stidx]').forEach(b=>b.addEventListener('click',()=>{ state.statIdx=+b.dataset.stidx; renderView(); }));
    main.querySelectorAll('[data-stgidx]').forEach(b=>b.addEventListener('click',()=>{ state.statGIdx=+b.dataset.stgidx; renderView(); }));
    main.querySelectorAll('[data-stsidx]').forEach(b=>b.addEventListener('click',()=>{ state.statSIdx=+b.dataset.stsidx; renderView(); }));
    main.querySelectorAll('[data-stab]').forEach(b=>b.addEventListener('click',()=>statSetAbandon(b.dataset.stab)));
    main.querySelectorAll('[data-stnotify]').forEach(b=>b.addEventListener('click',()=>{ const e=DB.students.find(x=>x.id===b.dataset.stnotify); if(e) statNotifyAbandon(e); }));
    const pdf=main.querySelector('[data-stpdf]'); if(pdf) pdf.addEventListener('click',exportStatsPDF);
    const xls=main.querySelector('[data-stxlsx]'); if(xls) xls.addEventListener('click',exportStatsXLSX);
    const pr=main.querySelector('[data-stprint]'); if(pr) pr.addEventListener('click',printStats);
  }

  // ---------- EXPORTS ----------
  function _statSafe(s){ return String(s||'').normalize('NFD').replace(/[^\w.-]+/g,'_').replace(/^_+|_+$/g,'')||'stats'; }
  function _statResultLabel(r){ return r==='reussi'?'Réussi':r==='echoue'?'Échoué':r==='abandon'?'Abandon':'—'; }

  // Export Excel (XLSX) — selon l'onglet actif (classe ou global). Fallback CSV.
  function exportStatsXLSX(){
    const sch=activeSchool(); let aoa=[], title='', fname='';
    if((state.statTab==='globale')){
      const d=statSchoolDataNow(state.statGIdx);
      title='Statistiques globales';
      aoa=[[sch.name||'École'],['Statistiques globales · '+d.scopeLabel+' · '+state.year],[],
        ['Effectif total',d.total],['Filles',d.f],['Garçons',d.m],['Abandon',d.abandon],['Réussi',d.reussi],['Échoué',d.echoue],[],
        ['Classe','Effectif','Filles','Garçons','Réussi','Échoué','Abandon','Taux réussite']];
      d.rows.forEach(c=>{ const nonAb=c.total-c.abandon; aoa.push([clsLabel(c.cls.id),c.total,c.f,c.m,c.graded?c.reussi:'',c.graded?c.echoue:'',c.abandon,c.graded?(statPct(c.reussi,nonAb)+'%'):'']); });
      fname='stats_globales_'+_statSafe(sch.slug||'ecole')+'_'+_statSafe(state.year)+'.xlsx';
    } else if(state.statTab==='synthese'){
      const s=statSchoolSynthesisNow(state.statSIdx); const gmax=fmtN(schoolCfg().gradeMax||20);
      const mLabels=(schoolCfg().mentions||[]).filter(m=>m.l).map(m=>m.l);
      title='Synthèse par classe';
      aoa=[[sch.name||'École'],['Synthèse comparative des classes · '+s.scopeLabel+' · '+state.year],[],
        ['Classes',s.classes],['Élèves notés',s.notedTotal],['Moyenne établissement',s.schoolAvg==null?'':fmtN(s.schoolAvg)+'/'+gmax],
        ['Taux de réussite',s.taux==null?'':s.taux+'%'],['Admis',s.reussiTotal],['Abandons',s.abandonTotal],
        ['Meilleure classe',s.best?(clsLabel(s.best.cls.id)+' ('+fmtN(s.best.avg)+')'):''],['À renforcer',s.weak?(clsLabel(s.weak.cls.id)+' ('+fmtN(s.weak.avg)+')'):''],[],
        ['Rang','Classe','Notés','Abandons','Moy. classe','Min','Max','Taux réussite'].concat(mLabels).concat(['1er de la classe'])];
      s.rows.forEach(r=>{ const ok=r.graded&&r.noted; aoa.push([ok?r.rank:'',clsLabel(r.cls.id),r.noted,r.abandon,r.avg==null?'':fmtN(r.avg),r.min==null?'':fmtN(r.min),r.max==null?'':fmtN(r.max),r.taux==null?'':r.taux+'%'].concat(mLabels.map(l=>r.mentions[l]||0)).concat([r.top?(r.top.name+' ('+fmtN(r.top.moy)+')'):''])); });
      fname='synthese_classes_'+_statSafe(sch.slug||'ecole')+'_'+_statSafe(state.year)+'.xlsx';
    } else {
      const d=statClassDataNow(state.statCls,state.statIdx); const nonAb=d.total-d.abandon;
      title='Statistiques '+clsLabel(state.statCls);
      aoa=[[sch.name||'École'],['Statistiques · '+clsLabel(state.statCls)+' · '+d.scopeLabel+' · '+state.year],[],
        ['Effectif total',d.total],['Filles',d.f],['Garçons',d.m],['Réussi',d.graded?d.reussi:'',],['Échoué',d.graded?d.echoue:''],['Abandon',d.abandon],[],
        ['N°','Élève','Sexe','Moyenne','Résultat']];
      d.list.forEach((it,i)=>{ aoa.push([i+1,stuName(it.stu),it.sexe||'',it.moy==null?'':fmtN(it.moy),_statResultLabel(it.result)]); });
      fname='stats_'+_statSafe(clsLabel(state.statCls))+'_'+_statSafe(state.year)+'.xlsx';
    }
    if(typeof XLSX!=='undefined'){ try{ const ws=XLSX.utils.aoa_to_sheet(aoa); ws['!cols']=(aoa[aoa.length-1]||[]).map(()=>({wch:18})); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Stats'); XLSX.writeFile(wb,fname); toast('Statistiques exportées ✓'); return; }catch(err){} }
    const csv=aoa.map(r=>r.map(c=>'"'+String(c==null?'':c).replace(/"/g,'""')+'"').join(',')).join('\n');
    downloadFile(fname.replace('.xlsx','.csv'), '\uFEFF'+csv, 'text/csv;charset=utf-8'); toast('Statistiques exportées (CSV) ✓');
  }

  // Export PDF (jsPDF) — portrait A4, en-tête école + tuiles résumé + tableau.
  function exportStatsPDF(){
    const J=(window.jspdf&&window.jspdf.jsPDF)?window.jspdf.jsPDF:(window.jsPDF||null);
    if(!J){ toast('Module PDF indisponible'); return; }
    const sch=activeSchool(); const cfg=schoolCfg(); const doc=new J({unit:'mm',format:'a4',orientation:'portrait'});
    const PW=210, PH=297, M=14; const tableW=PW-2*M;
    const _logo=cfg.logo||'';
    const glob=(state.statTab==='globale'); const syn=(state.statTab==='synthese');
    const d=syn?statSchoolSynthesisNow(state.statSIdx):(glob?statSchoolDataNow(state.statGIdx):statClassDataNow(state.statCls,state.statIdx));
    const sub=syn?'Synthèse par classe':(glob?('Statistiques globales'):('Classe : '+clsLabel(state.statCls)));
    function head(){
      let tx=M;
      if(_logo){ try{ doc.addImage(_logo,'PNG',M,M-1,15,15); tx=M+18; }catch(e){ try{ doc.addImage(_logo,'JPEG',M,M-1,15,15); tx=M+18; }catch(e2){} } }
      const tw2=tableW-(tx-M);
      doc.setTextColor(17,17,17); doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.text(_pdfFit(doc,sch.name||'École',tw2),tx,M+4);
      doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(100,116,139);
      if(sch.address||sch.phone) doc.text(_pdfFit(doc,[sch.address,sch.phone].filter(Boolean).join(' · '),tw2),tx,M+9);
      doc.setTextColor(17,17,17); doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.text('STATISTIQUES DES RÉSULTATS',PW/2,M+17,{align:'center'});
      doc.setFont('helvetica','normal'); doc.setFontSize(9.5); doc.setTextColor(60,60,60);
      doc.text(sub+'      Période : '+d.scopeLabel+'      Année : '+(state.year||''),M,M+24);
    }
    head();
    // bandeau résumé
    let y=M+30; const tiles=syn
      ? [['Classes',d.classes],['Moy. étab.',d.schoolAvg==null?'—':fmtN(d.schoolAvg)],['Notés',d.notedTotal],['Taux',d.taux==null?'—':d.taux+'%'],['Admis',d.reussiTotal],['Abandons',d.abandonTotal]]
      : glob
      ? [['Effectif',d.total],['Filles',d.f],['Garçons',d.m],['Abandon',d.abandon],['Réussi',d.reussi],['Échoué',d.echoue]]
      : [['Effectif',d.total],['Filles',d.f],['Garçons',d.m],['Abandon',d.abandon],['Réussi',d.graded?d.reussi:'—'],['Échoué',d.graded?d.echoue:'—']];
    const tw=tableW/tiles.length;
    tiles.forEach((t,i)=>{ const x=M+i*tw; doc.setDrawColor(226,232,240); doc.setFillColor(247,249,252); doc.roundedRect(x+1,y,tw-2,16,2,2,'FD');
      doc.setTextColor(100,116,139); doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.text(String(t[0]),x+tw/2,y+5,{align:'center'});
      doc.setTextColor(17,24,39); doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.text(String(t[1]),x+tw/2,y+12.5,{align:'center'}); });
    y+=22;
    // tableau
    let cols, rows;
    if(syn){
      cols=[['Rg',12,'center'],['Classe',52,'left'],['Notés',18,'center'],['Moy.',20,'center'],['Min',16,'center'],['Max',16,'center'],['Taux',20,'center'],['1er de la classe',48,'left']];
      rows=d.rows.map(r=>{ const ok=r.graded&&r.noted; return [ok?String(r.rank):'—',clsLabel(r.cls.id),String(r.noted),r.avg==null?'–':fmtN(r.avg),r.min==null?'–':fmtN(r.min),r.max==null?'–':fmtN(r.max),r.taux==null?'–':r.taux+'%',r.top?(r.top.name+' ('+fmtN(r.top.moy)+')'):'–']; });
    } else if(glob){
      cols=[['Classe',52,'left'],['Eff.',18,'center'],['F',14,'center'],['G',14,'center'],['Réussi',22,'center'],['Échoué',22,'center'],['Aband.',20,'center'],['Taux',20,'center']];
      rows=d.rows.map(c=>{ const nonAb=c.total-c.abandon; return [clsLabel(c.cls.id),String(c.total),String(c.f),String(c.m),c.graded?String(c.reussi):'—',c.graded?String(c.echoue):'—',String(c.abandon),c.graded?(statPct(c.reussi,nonAb)+'%'):'—']; });
    } else {
      cols=[['N°',12,'center'],['Élève',86,'left'],['Sexe',22,'center'],['Moyenne',28,'center'],['Résultat',34,'center']];
      rows=d.list.map((it,i)=>[String(i+1),stuName(it.stu),it.sexe||'',it.moy==null?'–':fmtN(it.moy),_statResultLabel(it.result)]);
    }
    const scale=tableW/cols.reduce((s,c)=>s+c[1],0); cols.forEach(c=>c[1]*=scale);
    const xs=[]; let xx=M; cols.forEach(c=>{ xs.push(xx); xx+=c[1]; });
    const rowH=7, headH=8, bottom=PH-14;
    function thead(){ doc.setFillColor(31,41,55); doc.rect(M,y,tableW,headH,'F'); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(8);
      cols.forEach((c,i)=>{ const al=c[2]; const cx=al==='center'?xs[i]+c[1]/2:xs[i]+2; doc.text(String(c[0]),cx,y+headH/2+1.3,{align:al==='center'?'center':'left'}); }); y+=headH; }
    thead();
    rows.forEach((r,ri)=>{ if(y+rowH>bottom){ doc.addPage(); y=M; head(); y=M+30; thead(); }
      if(ri%2===1){ doc.setFillColor(243,246,250); doc.rect(M,y,tableW,rowH,'F'); }
      doc.setTextColor(17,17,17); doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
      cols.forEach((c,i)=>{ const al=c[2]; const cx=al==='center'?xs[i]+c[1]/2:xs[i]+2; doc.text(_pdfFit(doc,String(r[i]==null?'':r[i]),c[1]-3),cx,y+rowH/2+1.3,{align:al==='center'?'center':'left'}); });
      doc.setDrawColor(226,232,240); doc.line(M,y+rowH,M+tableW,y+rowH); y+=rowH; });
    doc.setDrawColor(148,163,184); doc.setFontSize(7.5); doc.setTextColor(100,116,139);
    doc.text('Généré le '+new Date().toLocaleDateString('fr-FR')+' · XSchool',M,Math.min(y+8,PH-6));
    const base=syn?('synthese_'+_statSafe(sch.slug||'ecole')):(glob?('globales_'+_statSafe(sch.slug||'ecole')):('classe_'+_statSafe(clsLabel(state.statCls))));
    doc.save('stats_'+base+'_'+_statSafe(state.year)+'.pdf'); toast('PDF généré ✓');
  }

  // Impression : ouvre une fenêtre avec une version imprimable puis lance l'impression.
  function printStats(){
    const sch=activeSchool(); const _logo=(schoolCfg().logo)||''; const glob=(state.statTab==='globale'); const syn=(state.statTab==='synthese');
    const d=syn?statSchoolSynthesisNow(state.statSIdx):(glob?statSchoolDataNow(state.statGIdx):statClassDataNow(state.statCls,state.statIdx));
    const sub=syn?'Synthèse par classe':(glob?'Statistiques globales':('Classe : '+escH(clsLabel(state.statCls))));
    const tiles=syn
      ? [['Classes',d.classes],['Moy. étab.',d.schoolAvg==null?'—':fmtN(d.schoolAvg)],['Notés',d.notedTotal],['Taux',d.taux==null?'—':d.taux+'%'],['Admis',d.reussiTotal],['Abandons',d.abandonTotal]]
      : glob
      ? [['Effectif',d.total],['Filles',d.f],['Garçons',d.m],['Abandon',d.abandon],['Réussi',d.reussi],['Échoué',d.echoue]]
      : [['Effectif',d.total],['Filles',d.f],['Garçons',d.m],['Abandon',d.abandon],['Réussi',d.graded?d.reussi:'—'],['Échoué',d.graded?d.echoue:'—']];
    const tilesHtml=tiles.map(t=>'<div class="tile"><span>'+escH(t[0])+'</span><strong>'+escH(t[1])+'</strong></div>').join('');
    let thead, tbody;
    if(syn){
      const mLabels=(schoolCfg().mentions||[]).filter(m=>m.l).map(m=>m.l);
      thead='<tr><th>Rang</th><th class="l">Classe</th><th>Notés</th><th>Moy.</th><th>Min</th><th>Max</th><th>Taux</th>'+mLabels.map(l=>'<th>'+escH(_mentAbbr(l))+'</th>').join('')+'<th class="l">1er de la classe</th></tr>';
      tbody=d.rows.map(r=>{ const ok=r.graded&&r.noted; return '<tr><td>'+(ok?r.rank:'—')+'</td><td class="l">'+escH(clsLabel(r.cls.id))+'</td><td>'+r.noted+'</td><td>'+(r.avg==null?'–':escH(fmtN(r.avg)))+'</td><td>'+(r.min==null?'–':escH(fmtN(r.min)))+'</td><td>'+(r.max==null?'–':escH(fmtN(r.max)))+'</td><td>'+(r.taux==null?'–':r.taux+'%')+'</td>'+mLabels.map(l=>'<td>'+(r.mentions[l]||0)+'</td>').join('')+'<td class="l">'+(r.top?escH(r.top.name)+' ('+escH(fmtN(r.top.moy))+')':'–')+'</td></tr>'; }).join('');
    } else if(glob){
      thead='<tr><th>Classe</th><th>Effectif</th><th>F</th><th>G</th><th>Réussi</th><th>Échoué</th><th>Abandon</th><th>Taux</th></tr>';
      tbody=d.rows.map(c=>{ const nonAb=c.total-c.abandon; return '<tr><td class="l">'+escH(clsLabel(c.cls.id))+'</td><td>'+c.total+'</td><td>'+c.f+'</td><td>'+c.m+'</td><td>'+(c.graded?c.reussi:'—')+'</td><td>'+(c.graded?c.echoue:'—')+'</td><td>'+c.abandon+'</td><td>'+(c.graded?(statPct(c.reussi,nonAb)+'%'):'—')+'</td></tr>'; }).join('');
    } else {
      thead='<tr><th>N°</th><th class="l">Élève</th><th>Sexe</th><th>Moyenne</th><th>Résultat</th></tr>';
      tbody=d.list.map((it,i)=>'<tr><td>'+(i+1)+'</td><td class="l">'+escH(stuName(it.stu))+'</td><td>'+escH(it.sexe||'')+'</td><td>'+(it.moy==null?'–':escH(fmtN(it.moy)))+'</td><td>'+escH(_statResultLabel(it.result))+'</td></tr>').join('');
    }
    const css='body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px;}h1{font-size:18px;margin:0;}h2{font-size:13px;font-weight:normal;color:#555;margin:2px 0 0;}.meta{font-size:12px;color:#444;margin:8px 0 16px;}.tiles{display:flex;gap:8px;margin-bottom:16px;}.tile{flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:8px;text-align:center;}.tile span{display:block;font-size:10px;color:#64748b;}.tile strong{font-size:18px;}table{width:100%;border-collapse:collapse;font-size:12px;}th{background:#1f2937;color:#fff;padding:6px;text-align:center;}td{padding:5px 6px;border-bottom:1px solid #e5e7eb;text-align:center;}td.l,th.l{text-align:left;}tr:nth-child(even) td{background:#f5f7fa;}.ft{margin-top:14px;font-size:10px;color:#777;}.hdr{display:flex;align-items:center;gap:12px;}.hdr img{width:54px;height:54px;object-fit:contain;border-radius:8px;}.hdr .ht{flex:1;}@media print{button{display:none;}}';
    const html='<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Statistiques</title><style>'+css+'</style></head><body>'
      +'<div class="hdr">'+(_logo?'<img src="'+escH(_logo)+'" alt="logo">':'')+'<div class="ht"><h1>'+escH(sch.name||'École')+'</h1>'+((sch.address||sch.phone)?'<h2>'+escH([sch.address,sch.phone].filter(Boolean).join(' · '))+'</h2>':'')+'</div></div>'
      +'<div class="meta"><strong>Statistiques des résultats</strong> — '+sub+' · Période : '+escH(d.scopeLabel)+' · Année : '+escH(state.year||'')+'</div>'
      +'<div class="tiles">'+tilesHtml+'</div>'
      +'<table><thead>'+thead+'</thead><tbody>'+tbody+'</tbody></table>'
      +'<div class="ft">Généré le '+escH(new Date().toLocaleString('fr-FR'))+' · XSchool</div>'
      +'</body></html>';
    const w=window.open('','_blank'); if(!w){ toast('Autorise les fenêtres pop-up pour imprimer'); return; }
    w.document.open(); w.document.write(html); w.document.close();
    w.focus(); setTimeout(function(){ try{ w.print(); }catch(e){} },300);
  }
