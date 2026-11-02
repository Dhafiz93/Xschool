'use strict';
/* XSchool admin : surveillant, comptable, alertes, enseignant, gestion/config CRUD, superadmin (users, logs), import CSV/Excel. */
  // ---------- SURVEILLANT ----------
  function appel(){
    const today=new Date().toISOString().slice(0,10);
    const clsList=DB.classes.filter(c=>activeCycles().includes(c.cycle));
    if(!clsList.length) return `<div class="rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft card-in text-sm text-slate-500">Aucune classe disponible pour faire l'appel.</div>`;
    if(!clsList.find(c=>c.id===state.appelCls)) state.appelCls=clsList[0].id;
    if(!state.appelDate) state.appelDate=today;
    const date=state.appelDate;
    const studs=studentsInClass(state.appelCls);
    const marks=state.appelMarks||{};
    const resolve=e=>{ if(Object.prototype.hasOwnProperty.call(marks,e.id)) return marks[e.id]; const rec=ATT_STORE.find(a=>a.stu===e.id&&a.cls===state.appelCls&&a.date===date); return rec?rec.status:'present'; };
    let nP=0,nR=0,nA=0; studs.forEach(e=>{ const s=resolve(e); if(s==='present')nP++; else if(s==='retard')nR++; else nA++; });
    const clsSel=`<select id="ap_cls" class="${MGSEL} max-w-[62%]">${clsList.map(c=>`<option value="${c.id}"${c.id===state.appelCls?' selected':''}>${escH(clsLabel(c.id))} · ${escH(c.cycle)}</option>`).join('')}</select>`;
    const dateIn=`<input id="ap_date" type="date" value="${escH(date)}" class="${MGIN} max-w-[160px]">`;
    const tiles=`<div class="grid grid-cols-3 gap-3">${stat('Présents',String(nP),'élève(s)','bg-emerald-500')}${stat('Retards',String(nR),'élève(s)','bg-amber-500')}${stat('Absents',String(nA),'élève(s)','bg-rose-500')}</div>`;
    const bar=`<div class="flex items-center gap-2 flex-wrap mt-3">${clsSel}${dateIn}</div>`;
    const rows=studs.length?listWrap(studs.map(e=>{
      const cur=resolve(e);
      const seg=ATT_STATUS.map(s=>`<button data-apmark="${e.id}:${s[0]}" class="px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap ${cur===s[0]?`bg-${s[2]}-500 text-white`:'bg-slate-100 dark:bg-slate-800 text-slate-400'}">${s[1]}</button>`).join('');
      return row('<div class="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 p-2 shrink-0">'+svg(I.users)+'</div>',
        `<p class="text-sm font-semibold truncate">${escH(stuName(e))}</p><p class="text-xs text-slate-500">${escH(e.mat||'—')}</p>`,
        `<div class="flex gap-1 shrink-0">${seg}</div>`);
    }).join('')):`<p class="text-xs text-slate-400 px-1">Aucun élève inscrit dans cette classe.</p>`;
    const saveBtn=studs.length?`<button data-apsave class="mt-3 w-full py-3 rounded-2xl bg-brand-600 text-white font-bold shadow-glow active:scale-95 transition">Valider l'appel · ${escH(clsLabel(state.appelCls))}</button>`:'';
    return tiles + bar
      + section('Appel · '+escH(clsLabel(state.appelCls))+' · '+escH(date))
      + rows + saveBtn;
  }
  function discipline(){
    const today=new Date().toISOString().slice(0,10);
    const d=state.discDraft||{};
    const stuOpts=`<option value="">— Choisir l'élève —</option>`+DB.students.map(e=>`<option value="${e.id}"${d.stu===e.id?' selected':''}>${escH(stuName(e))} · ${escH(clsLabel(e.cls))}</option>`).join('');
    const gravSeg=GRAVITES.map(g=>`<button data-discgrav="${g[0]}" class="px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${(state.discGrav||'legere')===g[0]?`bg-${g[2]}-500 text-white`:'bg-slate-100 dark:bg-slate-800 text-slate-500'}">${g[1]}</button>`).join('');
    const composer=state.discOpen?mgCard(
      `<p class="font-bold text-sm">Nouveau signalement</p>
       <label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">${RQ}Élève<select id="disc_stu" class="${MGSEL} font-normal">${stuOpts}</select></label>
       <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
         <label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">${RQ}Date<input id="disc_date" type="date" class="${MGIN} font-normal" value="${escH(d.date||today)}"></label>
         <div><p class="text-[11px] font-bold text-slate-400 mb-1">Gravité</p><div class="flex gap-2 flex-wrap">${gravSeg}</div></div>
       </div>
       <label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">${RQ}Motif<input id="disc_motif" class="${MGIN} font-normal" value="${escH(d.motif||'')}" placeholder="ex : Absence non justifiée"></label>
       <div class="flex gap-2 justify-end"><button data-disccancel class="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold">Annuler</button><button data-discsave class="${MGBTN}">Enregistrer</button></div>`):'';
    const list=DISC_STORE.slice().reverse();
    const nOpen=DISC_STORE.length, nGrave=DISC_STORE.filter(x=>x.gravite==='grave').length;
    const tiles=`<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">${stat('Cas enregistrés',String(nOpen),'registre','bg-rose-500')}${stat('Cas graves',String(nGrave),'à convoquer','bg-amber-500')}</div>`;
    const rows=list.length?listWrap(list.map(x=>{
      const e=DB.students.find(s=>s.id===x.stu); const col=graviteColor(x.gravite);
      return `<div class="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 shadow-soft card-in">
          <div class="w-9 h-9 rounded-xl bg-${col}-100 text-${col}-600 dark:bg-${col}-500/15 p-2 shrink-0">${svg(I.shield)}</div>
          <div class="flex-1 min-w-0"><p class="text-sm font-semibold truncate">${escH(e?stuName(e):'—')}</p><p class="text-xs text-slate-500 truncate">${escH(x.motif)} · ${escH(x.date)}</p></div>
          <div class="flex items-center gap-2 shrink-0">${badge(graviteLabel(x.gravite),`bg-${col}-100 text-${col}-700 dark:bg-${col}-500/15 dark:text-${col}-300`)}<button data-discdel="${x.id}" class="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300 grid place-items-center">${svg_(I.trash)}</button></div>
        </div>`;
    }).join('')):`<p class="text-xs text-slate-400 px-1">Aucun cas enregistré.</p>`;
    return tiles
      + section('Registre de discipline', state.discOpen?'':'<button data-discnew class="text-xs font-bold text-white bg-brand-600 px-3 py-1.5 rounded-full">+ Signalement</button>')
      + composer
      + `<div class="mt-2">${rows}</div>`;
  }
  function absences(){
    const today=new Date().toISOString().slice(0,10);
    if(!state.absDate) state.absDate=today;
    const date=state.absDate;
    const recs=ATT_STORE.filter(a=>a.date===date);
    // Regroupement par classe
    const byCls={};
    recs.forEach(a=>{ const g=byCls[a.cls]||(byCls[a.cls]={abs:0,ret:0,pre:0}); if(a.status==='absent')g.abs++; else if(a.status==='retard')g.ret++; else g.pre++; });
    const clsIds=Object.keys(byCls).filter(id=>getCls(id)).sort((x,y)=>clsLabel(x).localeCompare(clsLabel(y)));
    const totAbs=recs.filter(a=>a.status==='absent').length, totRet=recs.filter(a=>a.status==='retard').length;
    const dateIn=`<input id="abs_date" type="date" value="${escH(date)}" class="${MGIN} max-w-[160px]">`;
    const tiles=`<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">${stat('Absents',String(totAbs),'le '+escH(date),'bg-rose-500')}${stat('Retards',String(totRet),'le '+escH(date),'bg-amber-500')}${stat('Classes pointées',String(clsIds.length),'appel saisi','bg-slate-600')}</div>`;
    const bar=`<div class="flex items-center gap-2 flex-wrap mt-3">${dateIn}<span class="text-[11px] text-slate-400">Synthèse issue des appels enregistrés.</span></div>`;
    const fmtLine=g=>{ const bits=[]; if(g.abs) bits.push(g.abs+' absent'+(g.abs>1?'s':'')); if(g.ret) bits.push(g.ret+' retard'+(g.ret>1?'s':'')); return bits.length?bits.join(' · '):(g.pre+' présent'+(g.pre>1?'s':'')+' · complet'); };
    const colOf=g=>g.abs?'rose':(g.ret?'amber':'emerald');
    const rows=clsIds.length?listWrap(clsIds.map(id=>{ const g=byCls[id]; const col=colOf(g);
      return row('<div class="w-9 h-9 rounded-xl bg-'+col+'-100 text-'+col+'-600 dark:bg-'+col+'-500/15 p-2 shrink-0">'+svg(I.users)+'</div>',
        `<p class="text-sm font-semibold truncate">${escH(clsLabel(id))}</p><p class="text-xs text-slate-500 truncate">${escH(fmtLine(g))}</p>`,
        `<button data-go="appel" class="text-xs font-bold text-brand-600 shrink-0">Appel</button>`);
    }).join('')):`<p class="text-xs text-slate-400 px-1">Aucun appel enregistré pour cette date.</p>`;
    return tiles + bar
      + section('Absences du jour · '+escH(date), totAbs?'<button class="text-xs font-bold text-brand-600" data-go="notify">Notifier</button>':'')
      + `<div class="mt-2">${rows}</div>`;
  }
  function wireAbsences(){
    const main=$('#main');
    if(typeof staffApiOn==='function'&&staffApiOn()){ window._xsLoaded=window._xsLoaded||{}; const _k='absday:'+state.absDate; if(!window._xsLoaded[_k]){ window._xsLoaded[_k]=true; hydrateAttendanceApi(null,state.absDate).then(ok=>{ if(ok) renderView(); }); } }
    const ds=main.querySelector('#abs_date'); if(ds) ds.addEventListener('change',()=>{ state.absDate=ds.value; renderView(); });
  }
  // ---------- TABLEAU DE BORD STATISTIQUE DES ABSENCES ----------
  function absStats(){
    const per=state.absStatPeriod||'month';
    const perMeta={week:['Semaine',7],month:['Mois',30],trimester:['Trimestre',90],all:['Tout',0]};
    const days=(perMeta[per]||perMeta.month)[1];
    let recs=ATT_STORE;
    if(days){ const c=new Date(Date.now()-days*864e5).toISOString().slice(0,10); recs=ATT_STORE.filter(a=>a.date>=c); }
    const perLabel=(perMeta[per]||perMeta.month)[0];
    const perChip=(id,label)=>'<button data-absper="'+id+'" class="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition '+(per===id?'bg-brand-600 text-white':'bg-white dark:bg-slate-900 text-slate-500 shadow-soft')+'">'+label+'</button>';
    const perBar='<div class="flex gap-1.5 overflow-x-auto no-scrollbar mb-3">'+perChip('week','Semaine')+perChip('month','Mois')+perChip('trimester','Trimestre')+perChip('all','Tout')+'</div>';
    const sub=days?'7 derniers jours'.replace('7',String(days)):'depuis le début';
    const totAbs=recs.filter(a=>a.status==='absent').length;
    const totRet=recs.filter(a=>a.status==='retard').length;
    const totPre=recs.filter(a=>a.status==='present').length;
    const tot=recs.length;
    const taux=tot?Math.round(totPre/tot*100):100;
    const seuil=(typeof ABS_ALERT_THRESHOLD!=='undefined')?ABS_ALERT_THRESHOLD:3;
    const cnt=id=>recs.filter(a=>a.stu===id&&a.status==='absent').length;
    const enAlerte=studentsOfYear(state.year).filter(e=>cnt(e.id)>=seuil).length;
    const tiles='<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">'
      +stat('Taux de présence',taux+'%',tot+' pointage(s)','bg-emerald-500')
      +stat('Absences',String(totAbs),escH(sub),'bg-rose-500')
      +stat('Retards',String(totRet),escH(sub),'bg-amber-500')
      +stat('Élèves en alerte',String(enAlerte),'≥ '+seuil+' absences','bg-slate-600')+'</div>';
    if(!tot) return perBar+tiles+'<div class="rounded-2xl p-6 mt-4 bg-white dark:bg-slate-900 shadow-soft card-in text-sm text-slate-500 text-center">Aucun appel enregistré sur la période « '+escH(perLabel)+' ». Essaie une période plus large ou saisis des appels.</div>';
    // répartition globale (barre empilée)
    const pc=v=>tot?Math.round(v/tot*100):0;
    const legend=(c,l,v)=>'<span class="inline-flex items-center gap-1 text-[11px] text-slate-500"><span class="w-2.5 h-2.5 rounded-full bg-'+c+'-500"></span>'+l+' '+v+' ('+pc(v)+'%)</span>';
    const repart='<div class="card-in rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft">'
      +'<div class="flex h-3 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">'
        +'<div class="bg-emerald-500 h-full" style="width:'+pc(totPre)+'%"></div>'
        +'<div class="bg-amber-500 h-full" style="width:'+pc(totRet)+'%"></div>'
        +'<div class="bg-rose-500 h-full" style="width:'+pc(totAbs)+'%"></div></div>'
      +'<div class="flex flex-wrap gap-x-4 gap-y-1 mt-3">'+legend('emerald','Présents',totPre)+legend('amber','Retards',totRet)+legend('rose','Absents',totAbs)+'</div></div>';
    // barres par classe (triées par absences)
    const bar=(label,val,max,col,sub)=>'<div class="mb-2.5"><div class="flex justify-between items-baseline text-[11px] mb-1"><span class="font-semibold truncate">'+escH(label)+'</span><span class="text-slate-500 shrink-0 ml-2">'+sub+'</span></div><div class="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div class="h-full rounded-full bg-'+col+'-500" style="width:'+(max?Math.round(val/max*100):0)+'%"></div></div></div>';
    const byCls={}; recs.forEach(a=>{ const g=byCls[a.cls]||(byCls[a.cls]={abs:0,ret:0,tot:0}); g.tot++; if(a.status==='absent')g.abs++; else if(a.status==='retard')g.ret++; });
    const clsIds=Object.keys(byCls).filter(id=>getCls(id)).sort((x,y)=>byCls[y].abs-byCls[x].abs);
    const maxAbs=Math.max(1,...clsIds.map(id=>byCls[id].abs));
    const clsBars='<div class="card-in rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft">'+(clsIds.length?clsIds.map(id=>{ const g=byCls[id]; return bar(clsLabel(id),g.abs,maxAbs,'rose',g.abs+' abs · '+g.ret+' ret'); }).join(''):'<p class="text-xs text-slate-400">Aucune donnée par classe.</p>')+'</div>';
    // top élèves les plus absents
    const top=studentsOfYear(state.year).map(e=>({e,n:cnt(e.id)})).filter(o=>o.n>0).sort((a,b)=>b.n-a.n).slice(0,8);
    const topRows=top.length?listWrap(top.map(o=>{ const col=o.n>=seuil?'rose':'amber';
      return row('<div class="w-9 h-9 rounded-xl bg-'+col+'-100 text-'+col+'-600 dark:bg-'+col+'-500/15 p-2 shrink-0">'+svg(I.users)+'</div>',
        '<p class="text-sm font-semibold truncate">'+escH(stuName(o.e))+'</p><p class="text-xs text-slate-500 truncate">'+escH(clsOfYear(o.e,state.year)?clsLabel(clsOfYear(o.e,state.year)):'Sans classe')+'</p>',
        badge(o.n+' absence'+(o.n>1?'s':''),'bg-'+col+'-100 text-'+col+'-700 dark:bg-'+col+'-500/15 dark:text-'+col+'-300')+(o.n>=seuil?'':''));
    }).join('')):'<p class="text-xs text-slate-400 px-1">Aucun élève absent.</p>';
    return perBar
      + tiles
      + section('Répartition des pointages')
      + repart
      + section('Évolution des absences')
      + '<div class="card-in rounded-2xl p-3 bg-white dark:bg-slate-900 shadow-soft lg:max-w-2xl"><canvas id="absEvoChart" height="150"></canvas></div>'
      + section('Absences par classe','<button class="text-xs font-bold text-brand-600" data-go="absences">Par jour</button>')
      + clsBars
      + section('Élèves les plus absents', enAlerte?'<button class="text-xs font-bold text-brand-600" data-go="notify">Alertes</button>':'')
      + '<div class="mt-2">'+topRows+'</div>';
  }
  // Série temporelle des absences selon la période (pour le graphique d'évolution).
  function absEvoSeries(){
    const per=state.absStatPeriod||'month';
    const cfg={week:{days:7,bucket:1},month:{days:30,bucket:7},trimester:{days:90,bucket:14}}[per]||null;
    const absByDate={};
    ATT_STORE.forEach(a=>{ if(a.status==='absent') absByDate[a.date]=(absByDate[a.date]||0)+1; });
    const dts=Object.keys(absByDate);
    const today=new Date(); today.setHours(0,0,0,0);
    let start,bucket;
    if(cfg){ start=new Date(today.getTime()-(cfg.days-1)*864e5); bucket=cfg.bucket; }
    else { start=dts.length?new Date(Math.min.apply(null,dts.map(d=>new Date(d+'T00:00:00').getTime()))):new Date(today); const span=Math.max(1,Math.round((today-start)/864e5)+1); bucket=Math.max(1,Math.ceil(span/8)); }
    const labels=[],data=[];
    for(let t=start.getTime(); t<=today.getTime(); t+=bucket*864e5){
      const b0=new Date(t), b1=new Date(t+bucket*864e5); let sum=0;
      dts.forEach(d=>{ const dt=new Date(d+'T00:00:00'); if(dt>=b0&&dt<b1) sum+=absByDate[d]; });
      const dd=String(b0.getDate()).padStart(2,'0'), mm=String(b0.getMonth()+1).padStart(2,'0');
      labels.push(dd+'/'+mm); data.push(sum);
    }
    return {labels,data};
  }
  function wireAbsStats(){
    const main=$('#main');
    if(typeof staffApiOn==='function'&&staffApiOn()){ window._xsLoaded=window._xsLoaded||{}; if(!window._xsLoaded['absstats']){ window._xsLoaded['absstats']=true; hydrateAttendanceApi(null,null).then(ok=>{ if(ok) renderView(); }); } }
    main.querySelectorAll('[data-absper]').forEach(b=>b.addEventListener('click',()=>{ state.absStatPeriod=b.dataset.absper; renderView(); }));
    const cv=document.getElementById('absEvoChart');
    if(cv&&typeof Chart!=='undefined'){ const dark=document.documentElement.classList.contains('dark');
      const grid=dark?'rgba(255,255,255,.08)':'rgba(0,0,0,.06)', tick=dark?'#94a3b8':'#64748b';
      const s=absEvoSeries();
      new Chart(cv,{type:'line',data:{labels:s.labels,datasets:[{label:'Absences',data:s.data,borderColor:'#f43f5e',backgroundColor:'rgba(244,63,94,.15)',fill:true,tension:.35,pointRadius:3,pointBackgroundColor:'#f43f5e',borderWidth:2}]},
        options:{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:grid},ticks:{color:tick,precision:0}},x:{grid:{display:false},ticks:{color:tick,maxRotation:0,autoSkip:true}}}}});
    }
  }
  function wireAppel(){
    const main=$('#main');
    if(typeof staffApiOn==='function'&&staffApiOn()){ window._xsLoaded=window._xsLoaded||{}; const _k='att:'+state.appelCls+':'+state.appelDate; if(!window._xsLoaded[_k]){ window._xsLoaded[_k]=true; hydrateAttendanceApi(state.appelCls,state.appelDate).then(ok=>{ if(ok) renderView(); }); } }
    const cs=main.querySelector('#ap_cls'); if(cs) cs.addEventListener('change',()=>{ state.appelCls=cs.value; state.appelMarks={}; renderView(); });
    const ds=main.querySelector('#ap_date'); if(ds) ds.addEventListener('change',()=>{ state.appelDate=ds.value; state.appelMarks={}; renderView(); });
    main.querySelectorAll('[data-apmark]').forEach(b=>b.addEventListener('click',()=>{ const [stu,st]=b.dataset.apmark.split(':'); state.appelMarks=state.appelMarks||{}; state.appelMarks[stu]=st; renderView(); }));
    const sv=main.querySelector('[data-apsave]'); if(sv) sv.addEventListener('click',()=>{
      const cl=state.appelCls, date=state.appelDate; const studs=studentsInClass(cl); const marks=state.appelMarks||{};
      const resolve=e=>{ if(Object.prototype.hasOwnProperty.call(marks,e.id)) return marks[e.id]; const rec=ATT_STORE.find(a=>a.stu===e.id&&a.cls===cl&&a.date===date); return rec?rec.status:'present'; };
      const rows=studs.map(e=>({stu:e.id,cls:cl,date:date,status:resolve(e)}));
      if(!rows.length){ toast('Aucun élève à pointer'); return; }
            const notifyAbs=()=>{ const n=(typeof checkRepeatedAbsences==='function')?checkRepeatedAbsences():[]; if(n&&n.length) toast('⚠ '+n.length+' alerte(s) absences répétées'); };
      if(typeof apiOn==='function'&&apiOn()){ saveAttendanceApi(rows).then(()=>{ logit('Appel validé',clsLabel(cl)+' · '+date+' · '+rows.length+' élève(s)','ok'); notifyAbs(); state.appelMarks={}; renderView(); toast('Appel enregistré ✓'); }).catch(ex=>toast('Enregistrement refusé : '+((ex&&ex.message)||'erreur'))); return; }
      for(let i=ATT_STORE.length-1;i>=0;i--){ const a=ATT_STORE[i]; if(a.cls===cl&&a.date===date) ATT_STORE.splice(i,1); }
      rows.forEach(r=>ATT_STORE.push({id:'a'+(++ATT_SEQ),stu:r.stu,cls:cl,date:date,status:r.status}));
      logit('Appel validé',clsLabel(cl)+' · '+date+' · '+rows.length+' élève(s)','ok');
      notifyAbs(); state.appelMarks={}; renderView(); toast('Appel enregistré ✓');
    });
  }
  function wireDiscipline(){
    const main=$('#main');
    if(typeof staffApiOn==='function'&&staffApiOn()){ window._xsLoaded=window._xsLoaded||{}; if(!window._xsLoaded['disc']){ window._xsLoaded['disc']=true; hydrateDisciplineApi().then(ok=>{ if(ok) renderView(); }); } }
    const readDraft=()=>{ const g=id=>{const e=main.querySelector('#'+id);return e?e.value.trim():undefined;}; const dr=state.discDraft||{}; const a=g('disc_stu'); if(a!==undefined)dr.stu=a; const b=g('disc_date'); if(b!==undefined)dr.date=b; const c=g('disc_motif'); if(c!==undefined)dr.motif=c; state.discDraft=dr; };
    const nb=main.querySelector('[data-discnew]'); if(nb) nb.addEventListener('click',()=>{ state.discOpen=true; state.discDraft={date:new Date().toISOString().slice(0,10)}; state.discGrav='legere'; renderView(); });
    const cc=main.querySelector('[data-disccancel]'); if(cc) cc.addEventListener('click',()=>{ state.discOpen=false; state.discDraft={}; renderView(); });
    main.querySelectorAll('[data-discgrav]').forEach(b=>b.addEventListener('click',()=>{ readDraft(); state.discGrav=b.dataset.discgrav; renderView(); }));
    main.querySelectorAll('[data-discdel]').forEach(b=>b.addEventListener('click',()=>{ if(!confirm('Supprimer ce cas de discipline ?')) return; const _x=DISC_STORE.find(z=>z.id===b.dataset.discdel); if(typeof apiOn==='function'&&apiOn()&&_x){ deleteDisciplineApi(_x).then(()=>{ renderView(); toast('Cas supprimé'); }).catch(ex=>toast('Suppression refusée : '+((ex&&ex.message)||'erreur'))); return; } DISC_STORE=DISC_STORE.filter(z=>z.id!==b.dataset.discdel); renderView(); toast('Cas supprimé'); }));
    const sv=main.querySelector('[data-discsave]'); if(sv) sv.addEventListener('click',()=>{
      readDraft(); const d=state.discDraft||{}; const grav=state.discGrav||'legere';
      if(!d.stu){ toast('Sélectionne un élève'); return; }
      if(!d.date){ toast('Indique la date'); return; }
      if(!(d.motif||'').trim()){ toast('Décris le motif'); return; }
      if(typeof apiOn==='function'&&apiOn()){ createDisciplineApi(d.stu,{date:d.date,motif:d.motif.trim(),gravite:grav}).then(()=>{ logit('Signalement discipline',(d.motif||'').trim(),'warn'); state.discOpen=false; state.discDraft={}; renderView(); toast('Signalement enregistré ✓'); }).catch(ex=>toast('Enregistrement refusé : '+((ex&&ex.message)||'erreur'))); return; }
      DISC_STORE.push({id:'d'+(++DISC_SEQ),stu:d.stu,date:d.date,motif:d.motif.trim(),gravite:grav,year:state.year});
      logit('Signalement discipline',(d.motif||'').trim(),'warn');
      state.discOpen=false; state.discDraft={}; renderView(); toast('Signalement enregistré ✓');
    });
  }
  // ---------- COMPTABLE ----------
  function payments(){
    const fmt=n=>(+n||0).toLocaleString('fr-FR');
    const today=new Date().toISOString().slice(0,10);
    const d=state.payDraft||{};
    // ---- Composer ----
    const stuOpts=`<option value="">— Choisir l'élève —</option>`+DB.students.map(e=>`<option value="${e.id}"${d.stu===e.id?' selected':''}>${escH(stuName(e))} · ${escH(clsLabel(e.cls))}</option>`).join('');
    const modeSeg=PAY_MODES.map(m=>`<button data-paymode="${m[0]}" class="px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${state.payMode===m[0]?'bg-brand-600 text-white':'bg-slate-100 dark:bg-slate-800 text-slate-500'}">${m[1]}</button>`).join('');
    const bankFields=payIsBank(state.payMode)
      ? `<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
           <label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">${RQ}N° de bordereau<input id="pay_ref" class="${MGIN} font-normal" value="${escH(d.ref||'')}" placeholder="ex : BRD-0099"></label>
           <label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">Banque<input id="pay_bank" class="${MGIN} font-normal" value="${escH(d.bank||'')}" placeholder="ex : Ecobank"></label>
         </div>`
      : '';
    const composer=state.payOpen?mgCard(
      `<p class="font-bold text-sm">Nouveau paiement</p>
       <label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">${RQ}Élève<select id="pay_stu" class="${MGSEL} font-normal">${stuOpts}</select></label>
       <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
         <label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">${RQ}Montant (FCFA)<input id="pay_amount" type="number" min="0" step="500" class="${MGIN} font-normal" value="${d.amount!=null&&d.amount!==''?escH(d.amount):''}" placeholder="0"></label>
         <label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">${RQ}Date de paiement<input id="pay_date" type="date" class="${MGIN} font-normal" value="${escH(d.date||today)}"></label>
       </div>
       <div><p class="text-[11px] font-bold text-slate-400 mb-1">Mode de paiement</p><div class="flex gap-2 flex-wrap">${modeSeg}</div></div>
       ${bankFields}
       <div class="flex items-center justify-between gap-2 flex-wrap">
         <span class="text-[11px] text-slate-400">${payIsBank(state.payMode)?'ℹ️ Le n° de bordereau est obligatoire pour les paiements bancaires.':'Un reçu est généré automatiquement.'}</span>
         <div class="flex gap-2 ml-auto"><button data-paycancel class="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold">Annuler</button><button data-paysave class="${MGBTN}">Enregistrer</button></div>
       </div>`):'';
    // ---- Recherche + liste ----
    const q=(state.paySearch||'').trim().toLowerCase();
    const match=p=>{ if(!q) return true; const e=DB.students.find(s=>s.id===p.stu); const hay=[(e?stuName(e):''),payModeLabel(p.mode),p.ref||'',p.bank||'',p.recu||''].join(' ').toLowerCase(); return hay.includes(q); };
    const list=PAY_STORE.filter(match).slice().reverse();
    const rows=list.length?list.map(p=>{
      const e=DB.students.find(s=>s.id===p.stu); const bank=payIsBank(p.mode);
      const bits=[payModeLabel(p.mode),p.date]; if(bank&&p.ref) bits.push('bord. '+escH(p.ref)); if(bank&&p.bank) bits.push(escH(p.bank)); bits.push('reçu '+escH(p.recu));
      return `<div class="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 shadow-soft card-in">
          <div class="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 p-2 shrink-0">${svg(bank?I.doc:I.cash)}</div>
          <div class="flex-1 min-w-0"><p class="text-sm font-semibold truncate">${escH(e?stuName(e):'—')} · ${fmt(p.amount)} FCFA</p><p class="text-xs text-slate-500 truncate">${bits.join(' · ')}</p></div>
          <div class="flex items-center gap-2 shrink-0">${bank?badge('Banque','bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'):''}<button data-payrecu="${p.id}" class="text-xs font-bold text-brand-600">Reçu</button><button data-paydel="${p.id}" class="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300 grid place-items-center">${svg_(I.trash)}</button></div>
        </div>`;
    }).join(''):`<p class="text-xs text-slate-400 px-1">${q?'Aucun résultat pour cette recherche.':'Aucun encaissement enregistré.'}</p>`;
    const total=PAY_STORE.reduce((s,p)=>s+(+p.amount||0),0);
    const bankTotal=PAY_STORE.filter(p=>payIsBank(p.mode)).reduce((s,p)=>s+(+p.amount||0),0);
    const bankCount=PAY_STORE.filter(p=>payIsBank(p.mode)).length;
    const tiles=`<div class="grid grid-cols-2 gap-3 lg:grid-cols-3">${stat('Encaissé',fmt(total),'FCFA · '+PAY_STORE.length+' paiement(s)','bg-emerald-500')}${stat('Par banque',fmt(bankTotal),bankCount+' virement(s)/chèque(s)','bg-brand-600')}</div>`;
    const searchBox=`<div class="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-white dark:bg-slate-900 shadow-soft card-in">
        <svg class="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input id="pay_search" value="${escH(state.paySearch||'')}" placeholder="Rechercher un élève, un bordereau, un reçu..." class="bg-transparent flex-1 text-sm outline-none"></div>`;
    return tiles
      + `<div class="mt-3"></div>` + searchBox
      + section('Encaissements récents', state.payOpen?'':'<button data-paynew class="text-xs font-bold text-white bg-brand-600 px-3 py-1.5 rounded-full">+ Paiement</button>')
      + composer
      + `<div class="space-y-2 mt-2">${rows}</div>`;
  }
  function readPayDraft(){
    const main=$('#main'); const g=id=>{const e=main.querySelector('#'+id);return e?e.value.trim():undefined;};
    const dr=state.payDraft||{};
    const vs=g('pay_stu'); if(vs!==undefined) dr.stu=vs;
    const va=g('pay_amount'); if(va!==undefined) dr.amount=va;
    const vd=g('pay_date'); if(vd!==undefined) dr.date=vd;
    const vr=g('pay_ref'); if(vr!==undefined) dr.ref=vr;
    const vb=g('pay_bank'); if(vb!==undefined) dr.bank=vb;
    state.payDraft=dr;
  }
  function printRecu(id){
    const p=PAY_STORE.find(x=>x.id===id); if(!p){toast('Reçu introuvable');return;}
    const e=DB.students.find(s=>s.id===p.stu); const sc=activeSchool(); const cfg=schoolCfg();
    const fmt=n=>(+n||0).toLocaleString('fr-FR'); const bank=payIsBank(p.mode);
    const lignes=[['Élève',e?stuName(e):'—'],['Classe',e?clsLabel(e.cls):'—'],['Date de paiement',p.date],['Mode de paiement',payModeLabel(p.mode)]];
    if(bank){ lignes.push(['N° de bordereau',p.ref||'—']); if(p.bank) lignes.push(['Banque',p.bank]); }
    lignes.push(['Année scolaire',state.year]);
    // En-tete 2 colonnes partage (ministere a gauche, ecole a droite) + format portrait.
    const addr=(cfg.address||'')+(cfg.phone?' · '+cfg.phone:'');
    // Bloc signature automatique : lieu (derniere partie de l'adresse), date du jour,
    // nom du comptable connecte, et signataire pour la Direction.
    const _parts=(cfg.address||'').split(/[,\/]/).map(x=>x.trim()).filter(Boolean);
    const city=_parts.length?_parts[_parts.length-1]:'';
    const today=new Date().toLocaleDateString('fr-FR');
    const compName=(typeof sessionUserName==='function'&&sessionUserName())||'';
    const dirName=cfg.director||'';
    const ctx={sc:{name:sc.name,logo:cfg.logo},cfg,addr,year:state.year};
    const hdCss=(typeof printHeaderCSS==='function')?printHeaderCSS():'';
    const hdHtml=(typeof printHeaderHTML==='function')?printHeaderHTML(ctx):('<h1>'+escH(sc.name||'Établissement')+'</h1><p class="sub">'+escH(addr)+'</p>');
    const doc=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Reçu ${escH(p.recu)}</title>
      <style>*{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}body{margin:24px;color:#111}h1{font-size:18px;margin:0 0 2px}.sub{color:#555;font-size:12px;margin:0 0 4px}.rc{font-size:13px;font-weight:bold;color:#047857;margin:14px 0 14px}table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}td{border:1px solid #ccc;padding:8px 10px}td.k{background:#f1f5f9;font-weight:bold;width:45%}.amt{margin-top:16px;padding:12px 14px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;font-size:16px;font-weight:bold;color:#047857;display:flex;justify-content:space-between}.sign{margin-top:28px;display:flex;justify-content:space-between;font-size:12px}.sign div{width:42%;text-align:center;color:#555}.sign .role{display:block;font-weight:bold;color:#333;margin-bottom:38px}.sign .line{display:block;border-top:1px solid #999;padding-top:5px}.sign .nm{display:block;font-weight:bold;color:#111;min-height:14px}.done{text-align:right;font-size:12px;color:#444;margin-top:22px}@page{size:A4 portrait;margin:0}@media print{body{margin:12mm}}${hdCss}</style></head>
      <body>${hdHtml}
      <p class="rc">REÇU DE PAIEMENT — ${escH(p.recu)}</p>
      <table><tbody>${lignes.map(l=>`<tr><td class="k">${escH(l[0])}</td><td>${escH(l[1])}</td></tr>`).join('')}</tbody></table>
      <div class="amt"><span>Montant perçu</span><span>${fmt(p.amount)} FCFA</span></div>
      <p class="done">Fait${city?' à '+escH(city):''}, le ${escH(today)}</p>
      <div class="sign"><div><span class="role">Le/la comptable</span><span class="line"></span><span class="nm">${escH(compName)}</span></div><div><span class="role">Pour la Direction</span><span class="line"></span><span class="nm">${escH(dirName||'Cachet & signature')}</span></div></div></body></html>`;
    const w=window.open('','_blank'); if(!w){toast('Autorise les fenêtres pop-up pour imprimer');return;}
    w.document.open(); w.document.write(doc); w.document.close(); w.focus();
    setTimeout(()=>{ try{ w.print(); }catch(e){} },300);
  }
  function wirePayments(){
    const main=$('#main');
    if(typeof staffApiOn==='function'&&staffApiOn()){ window._xsLoaded=window._xsLoaded||{}; const _k='pay:'+state.year; if(!window._xsLoaded[_k]){ window._xsLoaded[_k]=true; hydratePaymentsApi({year:state.year}).then(ok=>{ if(ok) renderView(); }); } }
    const nb=main.querySelector('[data-paynew]'); if(nb) nb.addEventListener('click',()=>{ state.payOpen=true; state.payDraft={date:new Date().toISOString().slice(0,10)}; if(!state.payMode) state.payMode='especes'; renderView(); });
    const cc=main.querySelector('[data-paycancel]'); if(cc) cc.addEventListener('click',()=>{ state.payOpen=false; state.payDraft={}; renderView(); });
    main.querySelectorAll('[data-paymode]').forEach(b=>b.addEventListener('click',()=>{ readPayDraft(); state.payMode=b.dataset.paymode; renderView(); }));
    const sb=main.querySelector('#pay_search'); if(sb) sb.addEventListener('input',()=>{ state.paySearch=sb.value; const v=sb.value; renderView(); const n=$('#main').querySelector('#pay_search'); if(n){ n.focus(); n.setSelectionRange(v.length,v.length); } });
    main.querySelectorAll('[data-payrecu]').forEach(b=>b.addEventListener('click',()=>printRecu(b.dataset.payrecu)));
    main.querySelectorAll('[data-paydel]').forEach(b=>b.addEventListener('click',()=>{ if(!confirm('Supprimer ce paiement ?')) return; const _p=PAY_STORE.find(x=>x.id===b.dataset.paydel); if(typeof apiOn==='function'&&apiOn()&&_p){ deletePaymentApi(_p).then(()=>{ renderView(); toast('Paiement supprimé'); }).catch(ex=>toast('Suppression refusée : '+((ex&&ex.message)||'erreur'))); return; } PAY_STORE=PAY_STORE.filter(x=>x.id!==b.dataset.paydel); renderView(); toast('Paiement supprimé'); }));
    const save=main.querySelector('[data-paysave]'); if(save) save.addEventListener('click',()=>{
      readPayDraft(); const d=state.payDraft||{};
      if(!d.stu){ toast('Sélectionne un élève'); return; }
      const amount=parseFloat(d.amount); if(isNaN(amount)||amount<=0){ toast('Saisis un montant valide'); return; }
      if(!d.date){ toast('Indique la date de paiement'); return; }
      if(payIsBank(state.payMode) && !(d.ref||'').trim()){ toast('Le n° de bordereau est obligatoire'); return; }
      if(typeof apiOn==='function'&&apiOn()){ PAY_SEQ++; const _recu='#'+PAY_SEQ; createPaymentApi({stu:d.stu,amount:Math.round(amount),mode:state.payMode,date:d.date,ref:(d.ref||'').trim(),recu:_recu,year:state.year}).then(()=>{ logit('Paiement enregistré','Reçu '+_recu+' · '+fmt(Math.round(amount))+' FCFA','ok'); state.payOpen=false; state.payDraft={}; renderView(); toast('Paiement enregistré ✓ reçu '+_recu); }).catch(ex=>{ PAY_SEQ--; toast('Enregistrement refusé : '+((ex&&ex.message)||'erreur')); }); return; }
      PAY_SEQ++;
      PAY_STORE.push({ id:'p'+Date.now(), stu:d.stu, amount:Math.round(amount), mode:state.payMode, date:d.date, ref:(d.ref||'').trim(), bank:(d.bank||'').trim(), recu:'#'+PAY_SEQ });
      logit('Paiement enregistré','Reçu #'+PAY_SEQ+' · '+fmt(Math.round(amount))+' FCFA','ok');
      state.payOpen=false; state.payDraft={}; renderView(); toast('Paiement enregistré ✓ reçu #'+PAY_SEQ);
    });
  }
  function schedules(){
    const S=[['Collège','120 000',''],['Lycée général','180 000',''],['Industriel','220 000','+ frais atelier'],['Professionnel','200 000','']];
    return section('Barèmes de scolarité par cycle','<button class="text-xs font-bold text-brand-600">Modifier</button>')
      + listWrap(S.map(s=>row('<div class="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 p-2">'+svg(I.cal)+'</div>',`<p class="text-sm font-semibold">${s[0]}</p><p class="text-xs text-slate-500">${s[1]} FCFA / an ${s[2]}</p>`,badge('3 tranches','bg-slate-100 text-slate-600 dark:bg-slate-800'))).join(''));
  }
  function reports(){
    return `<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">${stat('Recettes','48,2M','FCFA T1','bg-emerald-500')}${stat('Reste dû','13,6M','à recouvrer','bg-rose-500')}</div>`
      + section('Recouvrement par cycle')+'<div class="card-in rounded-2xl p-3 bg-white dark:bg-slate-900 shadow-soft lg:max-w-2xl"><canvas id="chart" height="150"></canvas></div>'
      + section('Exports')
      + listWrap(['Journal des recettes (PDF)','État des impayés (Excel)','Rapport trimestriel (PDF)'].map(r=>row('<div class="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 p-2">'+svg(I.doc)+'</div>',`<p class="text-sm font-semibold">${r}</p>`,'<button class="text-xs font-bold text-brand-600">Télécharger</button>')).join(''));
  }
  // ---------- CENTRE D'ALERTES (ADMIN / SURVEILLANT) ----------
  // Normalise un numero en format international (chiffres seuls). Togo : +228 si 8 chiffres.
  function _telIntl(raw){ let d=String(raw||'').replace(/[^0-9]/g,''); if(!d) return ''; if(d.length===8) d='228'+d; return d; }
  function notify(){
    const sentCount=ALERTS.length;
    const reach=ALERTS.reduce((s,a)=>s+(a.count||0),0);
    const autoOn=ALERT_RULE_META.filter(r=>ALERT_RULES[r[0]]).length;
    const cfg=schoolCfg();
    const chTxt=c=>c==='sms'?'SMS':c==='email'?'E-mail':c==='whatsapp'?'WhatsApp':'SMS + E-mail';
    // Une passerelle doit etre activee dans les Parametres pour pouvoir envoyer SMS / WhatsApp.
    const chanOff=c=>(c==='sms'&&!cfg.sms)||(c==='whatsapp'&&!cfg.whatsapp);
    const catMeta=id=>ALERT_CATS.find(c=>c[0]===id)||ALERT_CATS[0];
    const canaux=`<div class="rounded-2xl p-3 bg-white dark:bg-slate-900 shadow-soft card-in flex items-center gap-3 flex-wrap">
        <span class="text-[11px] font-bold text-slate-400">Canaux actifs :</span>
        ${badge('SMS '+(cfg.sms?'activé':'inactif'),cfg.sms?'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-500 dark:bg-slate-800')}
        ${badge('WhatsApp '+(cfg.whatsapp?'activé':'inactif'),cfg.whatsapp?'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-500 dark:bg-slate-800')}
        ${badge('Expéditeur : '+(cfg.sender||'XSCHOOL'),'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300')}
        <button data-go="settings" class="ml-auto text-[11px] font-bold text-brand-600">Configurer les canaux →</button>
      </div>`;
    const tiles=`<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">${stat('Alertes envoyées',String(sentCount),'historique','bg-brand-600')}${stat('Destinataires',reach>=1000?(Math.round(reach/100)/10+'k'):String(reach),'contacts touchés','bg-sky-500')}${stat('Règles auto',autoOn+'/'+ALERT_RULE_META.length,'activées','bg-emerald-500')}${stat('Modèles',String(ALERT_CATS.length),'catégories','bg-slate-600')}</div>`;
    const catChips=ALERT_CATS.map(c=>`<button data-alcat="${c[0]}" class="px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap ${state.alCat===c[0]?'bg-brand-600 text-white':'bg-slate-100 dark:bg-slate-800 text-slate-500'}">${c[1]}</button>`).join('');
    const clsOpts=DB.classes.map(c=>`<option value="${c.id}">${clsLabel(c.id)}</option>`).join('');
    const targetSel=`<select id="al_target" class="${MGSEL}">
        <option value="all" ${state.alTarget==='all'?'selected':''}>Tous les parents</option>
        <option value="class" ${state.alTarget==='class'?'selected':''}>Une classe</option>
        <option value="nouveaux" ${state.alTarget==='nouveaux'?'selected':''}>Parents des nouveaux élèves</option>
        <option value="redoublants" ${state.alTarget==='redoublants'?'selected':''}>Parents des redoublants</option>
        <option value="teachers" ${state.alTarget==='teachers'?'selected':''}>Les enseignants</option>
      </select>`;
    const clsRow=state.alTarget==='class'?`<label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">Classe concernée<select id="al_cls" class="${MGSEL} font-normal">${clsOpts||'<option value="">—</option>'}</select></label>`:'';
    const chanSeg=['sms','whatsapp','email','both'].map(c=>{
      const off=chanOff(c); const act=state.alChannel===c;
      const cls=act?'bg-brand-600 text-white shadow-glow':(off?'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600':'bg-slate-100 dark:bg-slate-800 text-slate-500');
      return `<button data-alchan="${c}" data-chanoff="${off?1:0}" title="${off?'Passerelle inactive — à activer dans Paramètres':''}" class="flex-1 min-w-[72px] py-2 rounded-lg text-xs font-bold transition ${cls}">${chTxt(c)}${off?' · off':''}</button>`;
    }).join('');
    const composer=mgCard(
      `<p class="font-bold text-sm">Nouvelle alerte</p>
       <div><p class="text-[11px] font-bold text-slate-400 mb-1">Catégorie</p><div class="flex gap-2 overflow-x-auto pb-1">${catChips}</div></div>
       <div class="grid grid-cols-1 sm:grid-cols-2 gap-2"><label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">Destinataires${targetSel}</label>${clsRow||'<div></div>'}</div>
       <div><p class="text-[11px] font-bold text-slate-400 mb-1">Canal d'envoi</p><div class="flex gap-2 flex-wrap">${chanSeg}</div>${chanOff(state.alChannel)?`<p class="text-[11px] text-amber-600 dark:text-amber-400 mt-1">⚠️ La passerelle ${chTxt(state.alChannel)} est inactive. <button data-go="settings" class="font-bold underline">L'activer dans Paramètres</button></p>`:''}</div>
       <label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">Message<textarea id="al_msg" rows="3" class="${MGIN} font-normal resize-none" placeholder="Saisis le message envoyé aux parents..."></textarea></label>
       <div class="flex items-center justify-between gap-2"><span class="text-[11px] text-slate-400">ℹ️ Si la passerelle serveur est configurée, WhatsApp &amp; SMS partent automatiquement (sans clic du destinataire) ; sinon des liens d'envoi par destinataire sont générés (l'e-mail reste simulé).</span><button data-alsend="1" class="${MGBTN}">📤 Envoyer l'alerte</button></div>`);
    const ruleRows=ALERT_RULE_META.map(r=>{
      const on=!!ALERT_RULES[r[0]];
      return `<div class="flex items-start justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 shadow-soft card-in">
          <div class="min-w-0"><p class="text-sm font-semibold">${r[1]}</p><p class="text-[11px] text-slate-500 leading-snug">${r[2]}</p></div>
          <button data-alrule="${r[0]}" role="switch" aria-checked="${on}" class="shrink-0 w-11 h-6 rounded-full transition relative ${on?'bg-brand-600':'bg-slate-300 dark:bg-slate-700'}"><span class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style="left:${on?'1.375rem':'0.125rem'}"></span></button>
        </div>`;
    }).join('');
    const hist=ALERTS.length?ALERTS.map(a=>{
      const cm=catMeta(a.cat);
      return `<div class="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 shadow-soft card-in">
          <div class="w-9 h-9 rounded-xl bg-${cm[3]}-100 text-${cm[3]}-600 dark:bg-${cm[3]}-500/15 p-2 shrink-0">${svg(cm[2])}</div>
          <div class="flex-1 min-w-0"><p class="text-sm font-semibold truncate">${escH(a.msg)}</p><p class="text-xs text-slate-500">${cm[1]} · ${escH(a.target)} · ${chTxt(a.channel)} · ${a.count} destinataire(s)</p><p class="text-[11px] text-slate-400 mt-0.5">${a.when}</p>${(a.server&&a.result)?`<p class="text-[11px] mt-0.5 font-semibold ${a.result.failed?'text-amber-600 dark:text-amber-400':'text-emerald-600 dark:text-emerald-400'}">📡 Envoi serveur${a.result.provider?' ('+escH(a.result.provider)+')':''} : ${a.result.sent} envoyé(s)${a.result.simulated?' · '+a.result.simulated+' simulé(s)':''}${a.result.failed?' · '+a.result.failed+' échec(s)':''}${a.result.sansNum?' · '+a.result.sansNum+' sans numéro':''}</p>`:''}${(a.links&&a.links.length)?`<details class="mt-1"><summary class="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 cursor-pointer">${a.channel==='whatsapp'?'Ouvrir les liens WhatsApp':'Ouvrir les liens SMS'} (${a.links.length})</summary><div class="mt-1 flex flex-wrap gap-1 max-h-36 overflow-auto">${a.links.map(l=>`<a href="${escH(l.link)}" target="_blank" rel="noopener" class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">${escH(l.name)}</a>`).join('')}</div></details>`:''}</div>
          <button data-aldel="${a.id}" class="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300 grid place-items-center shrink-0">${svg_(I.trash)}</button>
        </div>`;
    }).join(''):'<p class="text-xs text-slate-400 px-1">Aucune alerte envoyée.</p>';
    // --- Tableau recapitulatif des alertes par canal ---
    const chanAgg=['sms','whatsapp','email','both'].map(c=>{
      const rws=ALERTS.filter(a=>a.channel===c);
      return { c, nb:rws.length,
        dest:rws.reduce((s,a)=>s+(a.count||0),0),
        sent:rws.reduce((s,a)=>s+((a.result&&a.result.sent)||0),0),
        failed:rws.reduce((s,a)=>s+((a.result&&a.result.failed)||0),0) };
    }).filter(x=>x.nb>0);
    let chanTable;
    if(!chanAgg.length){
      chanTable='<div class="rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft card-in text-sm text-slate-400">Aucune alerte à récapituler pour le moment.</div>';
    } else {
      const tot=chanAgg.reduce((o,x)=>({nb:o.nb+x.nb,dest:o.dest+x.dest,sent:o.sent+x.sent,failed:o.failed+x.failed}),{nb:0,dest:0,sent:0,failed:0});
      const body=chanAgg.map((x,i)=>`<tr class="${i%2?'bg-white dark:bg-slate-900':'bg-slate-50 dark:bg-slate-900/60'}">
          <td class="px-3 py-2 font-semibold">${chTxt(x.c)}</td>
          <td class="px-2 py-2 text-center">${x.nb}</td>
          <td class="px-2 py-2 text-center">${x.dest}</td>
          <td class="px-2 py-2 text-center text-emerald-600 dark:text-emerald-400 font-semibold">${x.sent||'—'}</td>
          <td class="px-2 py-2 text-center ${x.failed?'text-amber-600 dark:text-amber-400 font-semibold':'text-slate-400'}">${x.failed||'—'}</td></tr>`).join('');
      chanTable=`<div class="rounded-2xl overflow-hidden shadow-soft card-in overflow-x-auto">
        <table class="w-full text-sm min-w-[460px]">
          <thead><tr class="bg-slate-800 text-white text-[11px] font-bold">
            <th class="text-left px-3 py-2">Canal</th><th class="px-2 py-2">Alertes</th><th class="px-2 py-2">Destinataires</th><th class="px-2 py-2">Envoyés</th><th class="px-2 py-2">Échecs</th>
          </tr></thead><tbody>${body}</tbody>
          <tfoot><tr class="bg-slate-100 dark:bg-slate-800 font-extrabold">
            <td class="px-3 py-2">Total</td><td class="px-2 py-2 text-center">${tot.nb}</td><td class="px-2 py-2 text-center">${tot.dest}</td><td class="px-2 py-2 text-center">${tot.sent||'—'}</td><td class="px-2 py-2 text-center">${tot.failed||'—'}</td></tr></tfoot>
        </table></div>
        <p class="text-[11px] text-slate-400 mt-2">« Envoyés » / « Échecs » concernent les envois via la passerelle serveur ; les alertes par liens / e-mail simulé n'alimentent que « Alertes » et « Destinataires ».</p>`;
    }
    return canaux+`<div class="mt-3"></div>`+tiles
      + section('Envoyer une alerte')+composer
      + section('Alertes automatiques','<span class="text-[11px] text-slate-400">Déclenchement sans intervention</span>')+`<div class="space-y-2">${ruleRows}</div>`
      + section('Récapitulatif par canal')+chanTable
      + section('Historique des envois',String(ALERTS.length)+' alerte(s)')+`<div class="space-y-2">${hist}</div>`;
  }
  function wireNotify(){
    const main=$('#main');
    main.querySelectorAll('[data-alcat]').forEach(b=>b.addEventListener('click',()=>{ state.alCat=b.dataset.alcat; renderView(); }));
    main.querySelectorAll('[data-alchan]').forEach(b=>b.addEventListener('click',()=>{ state.alChannel=b.dataset.alchan; renderView(); }));
    const tg=main.querySelector('#al_target'); if(tg) tg.addEventListener('change',()=>{ state.alTarget=tg.value; renderView(); });
    main.querySelectorAll('[data-alrule]').forEach(b=>b.addEventListener('click',()=>{ const k=b.dataset.alrule; ALERT_RULES[k]=!ALERT_RULES[k]; renderView(); toast('Règle '+(ALERT_RULES[k]?'activée':'désactivée')+' ✓'); }));
    main.querySelectorAll('[data-aldel]').forEach(b=>b.addEventListener('click',()=>{ ALERTS=ALERTS.filter(a=>a.id!==b.dataset.aldel); renderView(); toast('Alerte supprimée'); }));
    const send=main.querySelector('[data-alsend]'); if(send) send.addEventListener('click',async ()=>{
      const msg=(main.querySelector('#al_msg')||{}).value||''; if(!msg.trim()){toast('Saisis un message');return;}
      const chan=state.alChannel; const cfg=schoolCfg();
      // Passerelle requise : SMS / WhatsApp doivent etre actives dans les Parametres.
      if((chan==='sms'&&!cfg.sms)||(chan==='whatsapp'&&!cfg.whatsapp)){
        toast('Active d\'abord la passerelle '+(chan==='whatsapp'?'WhatsApp':'SMS')+' dans Param\u00e8tres');
        go('settings'); return;
      }
      // Construit la liste des destinataires (nom + telephone) selon la cible.
      let target='Tous les parents'; let recs=[];
      const stuRec=e=>({name:((e.prenom?e.prenom+' ':'')+(e.nom||'')).trim()||(e.mat||'Élève'), tel:_telIntl(e.pereTel||e.mereTel)});
      if(state.alTarget==='class'){ const cid=(main.querySelector('#al_cls')||{}).value||''; target='Parents '+(cid?clsLabel(cid):'—'); recs=DB.students.filter(e=>e.cls===cid).map(stuRec); }
      else if(state.alTarget==='nouveaux'){ target='Parents des nouveaux'; recs=DB.students.filter(e=>(e.statut||'')!=='Redoublant').map(stuRec); }
      else if(state.alTarget==='redoublants'){ target='Parents des redoublants'; recs=DB.students.filter(e=>(e.statut||'')==='Redoublant').map(stuRec); }
      else if(state.alTarget==='teachers'){ target='Les enseignants'; recs=DB.teachers.map(t=>({name:((t.prenom?t.prenom+' ':'')+(t.nom||t.n||'')).trim()||'Enseignant', tel:_telIntl(t.tel)})); }
      else { recs=DB.students.map(stuRec); }
      const count=recs.length;
      const now=new Date(); const pad=n=>(''+n).padStart(2,'0'); const when=now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate())+' '+pad(now.getHours())+':'+pad(now.getMinutes());
      // Auteur reel de l'alerte : sert au recapitulatif « alertes envoyees par l'enseignant ».
      const _meT=(typeof currentTeacher==='function')?currentTeacher():null;
      const sender=(typeof sessionUserName==='function'&&sessionUserName())||'Administration';
      const senderRole=state.role||'';
      const senderTeacherId=(senderRole==='teacher'&&_meT)?_meT.id:null;
      // Notification de confirmation pour l'admin avant tout envoi reel (evite les
      // envois massifs accidentels). Les autres roles envoient directement.
      if(senderRole==='admin'){
        const chLbl=chan==='sms'?'SMS':chan==='email'?'E-mail':chan==='whatsapp'?'WhatsApp':'SMS + E-mail';
        if(!confirm('Confirmer l\'envoi de cette alerte '+chLbl+' à '+count+' destinataire(s) ?')){ toast('Envoi annulé'); return; }
      }

      // --- Envoi serveur (passerelle API) si disponible : aucun clic du destinataire. ---
      // On tente l'API seulement pour WhatsApp/SMS, quand elle est branchee et que
      // le serveur peut reellement envoyer (passerelle configuree). Sinon -> liens wa.me.
      if((chan==='whatsapp'||chan==='sms') && window.API && API.enabled() && API.authenticated()){
        const cid=(main.querySelector('#al_cls')||{}).value||'';
        const payload={ channel:chan, message:msg.trim(), target:state.alTarget||'all' };
        if(state.alTarget==='class') payload.class_id=cid;
        if(typeof state.year!=='undefined' && state.year) payload.year=state.year;
        try{
          const st=await API.notifyStatus();
          if(st && st.can_send){
            const r=await API.notifySend(payload);
            const label=chan==='whatsapp'?'WhatsApp':'SMS';
            ALERTS.unshift({id:uid('al'),cat:state.alCat,target,channel:chan,msg:msg.trim(),when,count:(r.total||count),by:sender,byRole:senderRole,byTeacher:senderTeacherId,links:[],server:true,result:{sent:r.sent||0,simulated:r.simulated||0,failed:r.failed||0,sansNum:r.sans_numero||0,provider:r.provider||''}});
            renderView();
            if(r.simulation){ toast(label+' : '+(r.simulated||0)+' message(s) simulé(s) (passerelle en mode test) ✓'); }
            else { toast(label+' : '+(r.sent||0)+' message(s) envoyé(s)'+(r.failed?' · '+r.failed+' échec(s)':'')+(r.sans_numero?' · '+r.sans_numero+' sans numéro':'')+' ✓'); }
            return;
          }
        }catch(err){ toast('Passerelle serveur indisponible — passage aux liens '+(chan==='whatsapp'?'WhatsApp':'SMS')); }
      }

      // --- Repli : liens wa.me / sms: par destinataire (le destinataire clique). ---
      let links=[];
      if(chan==='whatsapp'||chan==='sms'){
        const enc=encodeURIComponent(msg.trim());
        links=recs.filter(r=>r.tel).map(r=>({ name:r.name,
          link: chan==='whatsapp' ? ('https://wa.me/'+r.tel+'?text='+enc) : ('sms:+'+r.tel+'?body='+enc) }));
      }
      ALERTS.unshift({id:uid('al'),cat:state.alCat,target,channel:chan,msg:msg.trim(),when,count,by:sender,byRole:senderRole,byTeacher:senderTeacherId,links});
      // Ouvre directement le 1er lien pour lancer l'envoi ; les autres sont dans l'historique.
      if(links.length){ try{ window.open(links[0].link,'_blank','noopener'); }catch(e){} }
      renderView();
      if(chan==='whatsapp'||chan==='sms'){
        const noTel=count-links.length;
        toast(links.length+' lien(s) '+(chan==='whatsapp'?'WhatsApp':'SMS')+' prêt(s)'+(noTel>0?' · '+noTel+' sans numéro':'')+' ✓');
      } else {
        toast('Alerte envoyée à '+count+' destinataire(s) ✓ (e-mail simulé)');
      }
    });
  }
  // ---------- ENSEIGNANT : MES CLASSES ----------
  function classes(){
    const me=currentTeacher();
    if(!me) return `<div class="rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft card-in text-sm text-slate-500">Profil enseignant introuvable.</div>`;
    const list=DB.classes.filter(c=>me.cls.includes(c.id)&&activeCycles().includes(c.cycle));
    if(!list.length) return `<div class="rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft card-in text-sm text-slate-500">Aucune classe ne t'est attribuée pour le moment. Rapproche-toi de l'administration.</div>`;
    const totalStu=list.reduce((n,c)=>n+studentsInClass(c.id).length,0);
    const mySubs=me.subs.map(getSub).filter(Boolean);
    const head=`<div class="rounded-2xl p-3 bg-brand-50 dark:bg-slate-900 text-brand-700 dark:text-brand-300 text-xs font-semibold card-in flex items-center gap-2">${svg_(I.teacher)} Tes classes attribuées — effectifs, matières et accès rapide à la saisie des notes.</div>`;
    const stats=`<div class="grid grid-cols-3 gap-3 mt-3">${stat('Classes',list.length,'attribuées','bg-brand-600')}${stat('Élèves',totalStu,'au total','bg-emerald-600')}${stat('Matières',mySubs.length,'enseignées','bg-indigo-500')}</div>`;
    const cards=list.map(c=>{
      const eff=studentsInClass(c.id).length;
      const prog=DB.program.filter(p=>p.cls===c.id).map(p=>p.sub);
      let subs=mySubs.filter(s=>prog.includes(s.id));
      if(!subs.length) subs=mySubs.slice();
      const chips=subs.map(s=>`<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-50 text-brand-700 dark:bg-slate-800 dark:text-brand-300">${escH(s.n)}</span>`).join('')||'<span class="text-[11px] text-slate-400">Aucune matière définie</span>';
      return `<div class="rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft card-in space-y-3">
        <div class="flex items-start gap-3">
          <div class="w-11 h-11 rounded-2xl bg-brand-100 dark:bg-slate-800 text-brand-600 p-2.5 shrink-0">${svg(I.teacher)}</div>
          <div class="flex-1 min-w-0">
            <p class="font-bold leading-tight">${escH(clsLabel(c.id))}</p>
            <p class="text-xs text-slate-500">${escH(c.cycle)}${c.spec?' · '+escH(c.spec):''}</p>
          </div>
          ${badge(eff+' élève'+(eff>1?'s':''),'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300')}
        </div>
        <div class="flex flex-wrap gap-1.5">${chips}</div>
        <button data-clsgrade="${c.id}" class="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold active:scale-[.99] transition">${svg_(I.grade)} Saisir les notes</button>
      </div>`;
    }).join('');
    return head + stats + section('Détail par classe') + `<div class="grid gap-3 lg:grid-cols-2">${cards}</div>`;
  }
  function wireClasses(){
    $('#main').querySelectorAll('[data-clsgrade]').forEach(b=>b.addEventListener('click',()=>{ state.grCls=b.dataset.clsgrade; go('grades'); }));
  }
  function generic(key){
    const map={users:'Gestion des utilisateurs & rôles',schools:'Multi-établissements / branches',logs:'Journaux d’audit système',notify:'Centre de notifications parents',classes:'Mes classes assignées',fees:'Détail de la scolarité'};
    return `<div class="rounded-3xl p-8 text-center bg-white dark:bg-slate-900 shadow-soft card-in mt-6">
      <div class="w-14 h-14 mx-auto rounded-2xl bg-brand-50 dark:bg-slate-800 text-brand-600 p-3.5">${svg(NAV[key].i)}</div>
      <p class="mt-3 font-bold">${NAV[key].t}</p><p class="text-sm text-slate-500 mt-1">${map[key]||'Module XSchool'}</p>
      <p class="text-xs text-slate-400 mt-3">Maquette — écran fonctionnel à brancher sur l’API.</p></div>`;
  }
  // ---------- RENDER ----------
  // ---------- ADMIN : GESTION / CONFIGURATION (CRUD) ----------
  function manage(){
    const tabs=[['annee','Année scolaire'],['classes','Classes'],['mat','Matières'],['prog','Programmes'],['ens','Enseignants'],['eleves','Élèves']];
    const tabBar=`<div class="flex gap-2 overflow-x-auto pb-1 card-in">${tabs.map(t=>`<button data-mtab="${t[0]}" class="px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap ${state.manageTab===t[0]?'bg-brand-600 text-white':'bg-white dark:bg-slate-900 text-slate-500'}">${t[1]}</button>`).join('')}</div>`;
    const banner=`<div class="rounded-2xl p-3 bg-brand-50 dark:bg-slate-900 text-brand-700 dark:text-brand-300 text-xs font-semibold card-in flex items-center gap-2 mt-3">${svg_(I.cog)} Administration — créer et configurer élèves, classes, enseignants, matières et programmes.</div>`;
    const T=state.manageTab; let body;
    if(T==='classes') body=mgClasses(); else if(T==='ens') body=mgEns();
    else if(T==='mat') body=mgMat(); else if(T==='prog') body=mgProg(); else if(T==='annee') body=mgAnnee(); else if(T==='users') body=mgUsers(); else body=mgEleves();
    return tabBar+banner+`<div class="mt-4 space-y-4">${body}</div>`;
  }
  function mgAnnee(){
    const yearRows=YEARS.map(y=>{
      const locked=(typeof yearHasData==='function')&&yearHasData(y);
      let action='';
      if(y!==state.year){
        if(locked){
          action=`<span title="Des donn\u00e9es sont li\u00e9es \u00e0 cette ann\u00e9e : suppression impossible." class="w-7 h-7 grid place-items-center rounded-lg text-slate-400 dark:text-slate-500 cursor-not-allowed">${svg_(I.lock)}</span>`;
        } else if(YEARS.length>1){
          action=`<button data-mdel="year:${y}" class="w-7 h-7 grid place-items-center rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10">${svg_(I.trash)}</button>`;
        }
      }
      return `
      <div class="flex items-center justify-between gap-2 p-3 rounded-2xl bg-white dark:bg-slate-900 shadow-soft card-in">
        <div class="flex items-center gap-3 min-w-0">
          <span class="w-9 h-9 rounded-xl grid place-items-center ${y===state.year?'bg-brand-600 text-white':'bg-slate-100 dark:bg-slate-800 text-slate-500'}">${svg_(I.cal)}</span>
          <div class="min-w-0"><p class="text-sm font-semibold truncate">${y}</p><p class="text-xs text-slate-500">${y===state.year?'Année active':(locked?'Archivée · données liées':'Archivée')}</p></div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          ${y===state.year?badge('Active','bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'):`<button data-yact="${y}" class="text-xs font-bold text-brand-600">Activer</button>`}
          ${action}
        </div>
      </div>`;
    }).join('');
    const addYear=mgCard(`<p class="font-bold text-sm">Nouvelle année scolaire</p><div class="flex gap-2"><label class="flex-1 text-[11px] font-bold text-slate-400 flex flex-col gap-1">${RQ}Année scolaire<input id="yr_n" class="${MGIN} font-normal" placeholder="ex : 2027-2028"></label><button data-madd="year" class="${MGBTN} self-end">+ Ajouter</button></div>`);
    const cyTog=activeCycles().map(c=>{
      const t=cyclePeriodType(c), pl=periodList(t);
      const btn=(key,label)=>`<button data-perset="${c}|${key}" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${t===key?'bg-brand-600 text-white shadow-soft':'bg-slate-100 dark:bg-slate-800 text-slate-500'}">${label}</button>`;
      return `<div class="flex items-center justify-between gap-2 p-3 rounded-2xl bg-white dark:bg-slate-900 shadow-soft card-in">
        <div class="min-w-0"><p class="text-sm font-semibold truncate">${c}</p><p class="text-xs text-slate-500 truncate">${pl.length} périodes · ${pl.join(', ')}</p></div>
        <div class="flex gap-1.5 shrink-0">${btn('trimestre','Trimestre')}${btn('semestre','Semestre')}</div></div>`;
    }).join('')||'<p class="text-sm text-slate-400">Aucun cycle actif pour cette école.</p>';
    const gradeTog=activeCycles().map(c=>{
      const allow=teacherGradesAllowed(c);
      return `<div class="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 shadow-soft card-in">
        <div class="min-w-0"><p class="text-sm font-semibold truncate">${c}</p><p class="text-xs text-slate-500">${allow?'Saisie autorisée pour les enseignants':'Saisie bloquée — consultation seule'}</p></div>
        <button data-grallow="${c}" class="w-11 h-6 rounded-full flex items-center px-0.5 transition shrink-0 ${allow?'bg-emerald-500 justify-end':'bg-slate-300 dark:bg-slate-700 justify-start'}"><span class="w-5 h-5 rounded-full bg-white shadow block"></span></button>
      </div>`;
    }).join('')||'<p class="text-sm text-slate-400">Aucun cycle actif pour cette école.</p>';
    const dlRows=activeCycles().map(c=>{
      const pers=periodList(cyclePeriodType(c));
      const inputs=pers.map(p=>{
        const passed=deadlinePassed(c,p), d=getDeadline(c,p);
        return `<div class="flex items-center justify-between gap-2 py-1.5">
          <span class="text-xs ${passed?'text-rose-500 font-semibold':'text-slate-500'}">${p}${passed?' · échue':''}</span>
          <input type="date" data-dl="${c}|${p}" value="${d}" class="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs outline-none ${passed?'ring-1 ring-rose-400':''}">
        </div>`;
      }).join('');
      return `<div class="p-3 rounded-2xl bg-white dark:bg-slate-900 shadow-soft card-in"><p class="text-sm font-semibold mb-1">${c}</p><div class="divide-y divide-slate-100 dark:divide-slate-800">${inputs}</div></div>`;
    }).join('')||'<p class="text-sm text-slate-400">Aucun cycle actif pour cette école.</p>';
    // Sous-onglets pour alleger : on n'affiche qu'une rubrique a la fois.
    const sub=state.anneeTab||'annees';
    const SUB=[['annees','Années'],['periodes','Périodes'],['notes','Saisie notes'],['deadlines','Dates limites']];
    const subBar=`<div class="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">`+SUB.map(x=>`<button data-anneetab="${x[0]}" class="px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${sub===x[0]?'bg-brand-600 text-white shadow-soft':'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}">${x[1]}</button>`).join('')+`</div>`;
    let body;
    if(sub==='periodes') body=section('Périodes de composition par cycle') + `<div class="space-y-2">${cyTog}</div>`;
    else if(sub==='notes') body=section('Saisie des notes par les enseignants','<span class="text-xs text-slate-400">par cycle</span>') + `<div class="space-y-2">${gradeTog}</div>`;
    else if(sub==='deadlines') body=section('Dates limites de saisie','<span class="text-xs text-slate-400">'+state.year+' · par période</span>') + `<div class="space-y-2">${dlRows}</div>` + `<p class="text-[11px] text-slate-400 mt-2">💡 Laisse vide pour aucune limite. Passée la date, les enseignants passent en consultation seule (l'admin garde l'accès).</p>`;
    else body=section('Années scolaires') + addYear + `<div class="space-y-2 mt-3">${yearRows}</div>`;
    return `<div class="rounded-2xl p-3 bg-brand-50 dark:bg-slate-900 text-brand-700 dark:text-brand-300 text-xs font-semibold card-in flex items-center gap-2">${svg_(I.cal)} L'année active sert de base à tous les modules (notes, emplois, scolarité). Définis aussi le découpage des compositions, cycle par cycle.</div>`
      + subBar + `<div class="mt-3 space-y-3">`+body+`</div>`;
  }
  function mgUsers(){
    const roleBadge=r=>{ const col={admin:'bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',teacher:'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',surveillant:'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',comptable:'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',student:'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}[r]||'bg-slate-200 text-slate-600'; return badge(ROLE_LABELS[r]||r,col); };
    const roleOpts=Object.keys(ROLE_LABELS).map(r=>`<option value="${r}">${ROLE_LABELS[r]}</option>`).join('');
    const form=mgCard(`<p class="font-bold text-sm">Créer un utilisateur</p>
      <div class="grid grid-cols-2 gap-2"><label id="us_name_lbl" class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">${RQ}Nom complet<input id="us_n" class="${MGIN} font-normal" placeholder="Nom complet"></label><label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">${RQ}Rôle<select id="us_r" class="${MGIN} font-normal">${roleOpts}</select></label></div>
      <label id="us_person_lbl" class="hidden text-[11px] font-bold text-slate-400 flex flex-col gap-1"><span id="us_person_cap">${RQ}Personne enregistrée</span><select id="us_person" class="${MGSEL} font-normal"></select></label>
      <p id="us_person_hint" class="hidden text-[11px] text-slate-400"></p>
      <label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">${RQ}Email<input id="us_e" class="${MGIN} font-normal" type="email" placeholder="Email (sert d'identifiant de connexion)" autocomplete="off"></label>
      <div class="grid grid-cols-2 gap-2"><label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">${RQ}Mot de passe<input id="us_p" class="${MGIN} font-normal" type="password" placeholder="Mot de passe (min. 8 car.)" autocomplete="new-password"></label><label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">${RQ}Confirmer<input id="us_p2" class="${MGIN} font-normal" type="password" placeholder="Confirmer le mot de passe" autocomplete="new-password"></label></div>
      <button data-madd="user" class="${MGBTN} w-full justify-center">+ Ajouter l'utilisateur</button>`);
    let scoped = state.role==='super' ? USERS.slice() : USERS.filter(u=>!u.schoolId||u.schoolId===state.schoolId);
    if(state.role==='super'){ if(state.suSchool!=='all') scoped=scoped.filter(u=>u.schoolId===state.suSchool); if(state.suRole!=='all') scoped=scoped.filter(u=>u.role===state.suRole); }
    const list=scoped.map(u=>{
      const open=state.mgUserOpen===u.id;
      const permGrid=PERM_DEFS.map(([k,lab])=>{
        const on=hasPerm(u,k), ov=isPermOverridden(u,k);
        return `<label class="flex items-center justify-between gap-2 p-2 rounded-lg ${on?'bg-emerald-50 dark:bg-emerald-500/10':'bg-slate-50 dark:bg-slate-800'}">
          <span class="text-xs ${on?'font-semibold':''}">${lab}${ov?' <span class=\'text-[9px] text-brand-600 font-bold\'>(perso)</span>':''}</span>
          <input type="checkbox" data-uperm="${u.id}|${k}" ${on?'checked':''} class="w-4 h-4 accent-brand-600">
        </label>`;
      }).join('');
      const detail=open?`<div class="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
        <div class="flex items-center justify-between"><p class="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Permissions détaillées</p><button data-ureset="${u.id}" class="text-[11px] font-bold text-brand-600">Réinitialiser au rôle</button></div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">${permGrid}</div></div>`:'';
      return `<div class="rounded-2xl p-3 bg-white dark:bg-slate-900 shadow-soft card-in">
        <div class="flex items-center justify-between gap-2">
          <button data-uopen="${u.id}" class="flex items-center gap-3 min-w-0 text-left flex-1">
            <span class="w-9 h-9 rounded-xl grid place-items-center bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">${svg_(I.users)}</span>
            <span class="min-w-0"><span class="text-sm font-semibold truncate block">${u.name}${u.status==='pending'?' <span class=\'text-[10px] text-amber-600 dark:text-amber-400 font-bold\'>(en attente)</span>':(u.active?'':' <span class=\'text-[10px] text-rose-500\'>(désactivé)</span>')}</span><span class="text-xs text-slate-500 truncate block">${u.email||'—'}${u.gmail?' · <span class=\'text-emerald-600 dark:text-emerald-400 font-semibold\'>Google</span>':''}${state.role==='super'?' · '+schoolNameById(u.schoolId):''}</span></span>
          </button>
          <div class="flex items-center gap-2 shrink-0">${roleBadge(u.role)}
            <button data-utoggle="${u.id}" title="Activer / désactiver" class="w-10 h-5 rounded-full flex items-center px-0.5 transition ${u.active?'bg-emerald-500 justify-end':'bg-slate-300 dark:bg-slate-700 justify-start'}"><span class="w-4 h-4 rounded-full bg-white shadow block"></span></button>
            <button data-udel="${u.id}" class="w-7 h-7 grid place-items-center rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10">${svg_(I.trash)}</button>
          </div>
        </div>
        <div class="mt-2 flex items-center gap-2"><label class="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Rôle</label><select data-urole="${u.id}" class="text-xs font-bold bg-slate-100 dark:bg-slate-800 rounded-lg px-2 py-1 outline-none">${Object.keys(ROLE_LABELS).map(r=>`<option value="${r}"${r===u.role?' selected':''}>${ROLE_LABELS[r]}</option>`).join('')}</select><span class="text-[11px] text-slate-400">${PERM_DEFS.filter(([k])=>hasPerm(u,k)).length}/${PERM_DEFS.length} droits</span></div>
        ${detail}</div>`;
    }).join('')||'<p class="text-xs text-slate-400 px-1">Aucun utilisateur.</p>';
    const pending=scoped.filter(u=>u.status==='pending');
    const pendingCard=pending.length?(`<div class="rounded-2xl p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 card-in space-y-2">
      <p class="text-sm font-bold text-amber-700 dark:text-amber-300 flex items-center gap-2">${svg_(I.shield)} ${pending.length} demande(s) d'inscription en attente</p>
      <p class="text-[11px] text-amber-700/80 dark:text-amber-300/80">Comptes élèves créés en libre-service. Valide pour activer l'accès, ou refuse.</p>
      ${pending.map(u=>`<div class="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 rounded-xl p-2.5">
        <div class="min-w-0"><p class="text-sm font-semibold truncate">${u.name}</p><p class="text-xs text-slate-500 truncate">${u.email}${u.gmail?' · <span class=\'text-emerald-600 dark:text-emerald-400 font-semibold\'>Google</span>':''}${u.classId?' · '+clsLabel(u.classId):''}</p></div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button data-uvalid="${u.id}" class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold">Valider</button>
          <button data-urefuse="${u.id}" class="px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-500/40 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-500/10">Refuser</button>
        </div></div>`).join('')}
    </div>`):'';
    return `<div class="rounded-2xl p-3 bg-brand-50 dark:bg-slate-900 text-brand-700 dark:text-brand-300 text-xs font-semibold card-in flex items-center gap-2">${svg_(I.shield)} Rôles & permissions — ${state.role==='super'?'vue multi-établissements (tous les comptes)':'comptes de <strong class=\'font-extrabold\'>'+activeSchool().name+'</strong>'} ; chaque utilisateur hérite des droits de son rôle.</div>`
      + pendingCard
      + (state.role==='super'?'':form)
      + section(scoped.length+' utilisateur(s)','<span class="text-xs text-slate-400">Tape un utilisateur pour ses permissions</span>')
      + `<div class="space-y-2">${list}</div>`;
  }
  // ---------- SUPERADMIN : vue consolidée des utilisateurs (multi-établissements) ----------
  function superUsers(){
    const schoolChip=(id,label)=>`<button data-suschool="${id}" class="px-3 py-1.5 rounded-full whitespace-nowrap ${state.suSchool===id?'bg-brand-600 text-white':'bg-white dark:bg-slate-900 text-slate-500'}">${label}</button>`;
    const chips=[schoolChip('all','Tous les établissements')].concat(SCHOOLS.map(s=>schoolChip(s.id,s.name))).join('');
    const roleSel=`<select id="su_role" class="text-xs font-bold bg-white dark:bg-slate-900 shadow-soft rounded-full px-3 py-1.5 outline-none"><option value="all"${state.suRole==='all'?' selected':''}>Tous les rôles</option>${Object.keys(ROLE_LABELS).map(r=>`<option value="${r}"${state.suRole===r?' selected':''}>${ROLE_LABELS[r]}</option>`).join('')}</select>`;
    const bar=`<div class="flex gap-2 overflow-x-auto pb-1 text-[11px] font-semibold card-in">${chips}</div><div class="mt-2 flex justify-end">${roleSel}</div>`;
    return bar + superAdminForm() + mgUsers();
  }
  // ---------- SUPERADMIN : formulaire « Ajouter un administrateur » (branche backend) ----------
  function superAdminForm(){
    const sel = (state.suSchool && state.suSchool!=='all') ? SCHOOLS.find(s=>s.id===state.suSchool) : null;
    if(!sel){
      return mgCard(`<p class="font-bold text-sm flex items-center gap-2">${svg_(I.shield)} Ajouter un administrateur</p>
        <p class="text-xs text-slate-500">Sélectionne d'abord un établissement ci-dessus pour lui créer un administrateur.</p>`);
    }
    return mgCard(`<p class="font-bold text-sm flex items-center gap-2">${svg_(I.shield)} Ajouter un administrateur — <span class="text-brand-600 dark:text-brand-300">${escH(sel.name)}</span></p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">${RQ}Nom complet<input id="ad_n" class="${MGIN} font-normal" placeholder="Nom complet" autocomplete="off"></label>
        <label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">${RQ}Email<input id="ad_e" class="${MGIN} font-normal" type="email" placeholder="Email" autocomplete="off"></label>
        <input id="ad_l" class="${MGIN}" placeholder="Identifiant de connexion (optionnel)" autocomplete="off">
        <span class="hidden sm:block"></span>
        <label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">${RQ}Mot de passe<input id="ad_p" class="${MGIN} font-normal" type="password" placeholder="Mot de passe (min. 8 car.)" autocomplete="new-password"></label>
        <label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">${RQ}Confirmer<input id="ad_p2" class="${MGIN} font-normal" type="password" placeholder="Confirmer le mot de passe" autocomplete="new-password"></label>
      </div>
      <p class="text-[11px] text-slate-400">🔑 L'administrateur pourra se connecter avec son <strong>email</strong> ou son <strong>identifiant</strong>.</p>
      <button data-addadmin="1" class="${MGBTN} w-full justify-center">+ Créer l'administrateur</button>`);
  }
  // ---------- SUPERVISION : stats connexions + comptes par profil ----------
  // Libelles de profil (couvre les cles backend ET front) + ordre d'affichage.
  const PROFILE_LABELS={ admin:'Administration', teacher:'Enseignants', surveillant:'Surveillants', supervisor:'Surveillants', comptable:'Comptables', student:'\u00c9l\u00e8ves / Parents', super:'Super-admin', superadmin:'Super-admin' };
  const PROFILE_ORDER=['admin','teacher','surveillant','supervisor','comptable','student','super','superadmin'];
  const CAUSE_LABELS={ inconnu:'Identifiant inconnu', mauvais_mot_de_passe:'Mot de passe incorrect', compte_inactif:'Compte d\u00e9sactiv\u00e9', non_precise:'Non pr\u00e9cis\u00e9' };
  function _profLabel(k){ return PROFILE_LABELS[k]||k; }
  function _orderedRoleKeys(obj){ const keys=Object.keys(obj||{}).filter(k=>obj[k]>0); keys.sort((a,b)=>{ const ia=PROFILE_ORDER.indexOf(a), ib=PROFILE_ORDER.indexOf(b); return (ia<0?99:ia)-(ib<0?99:ib); }); return keys; }
  function _causeFromDetail(d){ const h=String(d||'').split('\u00b7')[0].trim(); return ['inconnu','mauvais_mot_de_passe','compte_inactif'].includes(h)?h:'non_precise'; }
  // --- normalisation des sources (API serveur OU calcul local hors-ligne) ---
  function _connFromApi(cs){
    const g=cs['global']||{};
    const etabs=(cs.etablissements||[]).map(e=>({ name:e.name||'\u2014', reussite:e.reussite||0, echec:e.echec||0, total:e.total||0, taux:(e.taux_reussite==null?null:e.taux_reussite), causes:e.causes||{}, pic:e.pic_actif===true }));
    return { jours:cs.jours, global:{ reussite:g.reussite||0, echec:g.echec||0, total:g.total||0, taux:(g.taux_reussite==null?null:g.taux_reussite), causes:g.causes||{}, pic:g.pic_actif===true }, etabs:etabs, alertes:(cs.alertes||[]), seuil:cs.seuil_pic, fenetre:cs.fenetre_pic_min };
  }
  function _connFromLogs(){
    const isSuper=state.role==='super';
    const base=isSuper?LOGS.slice():LOGS.filter(l=>l.school===state.schoolId);
    const isOk=l=>l.code==='login'||(/connexion/i.test(l.action)&&l.level==='ok');
    const isKo=l=>l.code==='login_echec'||(/connexion/i.test(l.action)&&l.level==='error');
    const mk=()=>({reussite:0,echec:0,total:0,causes:{}});
    const g=mk(), per={};
    base.forEach(l=>{ const ok=isOk(l), ko=isKo(l); if(!ok&&!ko) return; const b=per[l.school]||(per[l.school]=mk());
      if(ok){ g.reussite++; b.reussite++; } else { const c=_causeFromDetail(l.detail); g.echec++; b.echec++; g.causes[c]=(g.causes[c]||0)+1; b.causes[c]=(b.causes[c]||0)+1; }
      g.total++; b.total++; });
    g.taux=g.total?Math.round(g.reussite/g.total*100):null;
    // Hors-ligne : pas de fenetre glissante -> on signale un pic si le volume
    // global d'echecs atteint le seuil (5), a titre indicatif.
    g.pic=(g.echec>=5);
    const etabs=Object.keys(per).map(k=>{ const b=per[k]; b.name=schoolNameById(k); b.taux=b.total?Math.round(b.reussite/b.total*100):null; b.pic=(b.echec>=5); return b; }).sort((a,b)=>b.total-a.total);
    return { jours:null, global:g, etabs:etabs, alertes:[], seuil:5, fenetre:null };
  }
  function _usersFromApi(us){
    const etabs=(us.etablissements||[]).map(e=>({ name:e.name||'\u2014', total:e.total||0, actifs:e.actifs||0, inactifs:e.inactifs||0, roles:e.roles||{} }));
    return { total:us.total||0, actifs:us.actifs||0, inactifs:us.inactifs||0, global:us['global']||{}, etabs:etabs };
  }
  function _usersFromLocal(){
    const isSuper=state.role==='super';
    const base=isSuper?USERS.slice():USERS.filter(u=>u.schoolId===state.schoolId);
    const g={}; let total=0,actifs=0,inactifs=0; const per={};
    base.forEach(u=>{ total++; const act=u.active!==false; if(act)actifs++; else inactifs++;
      g[u.role]=(g[u.role]||0)+1; const key=u.schoolId||'\u2014'; const b=per[key]||(per[key]={total:0,actifs:0,inactifs:0,roles:{}});
      b.total++; if(act)b.actifs++; else b.inactifs++; b.roles[u.role]=(b.roles[u.role]||0)+1; });
    const etabs=Object.keys(per).map(k=>{ const b=per[k]; b.name=(k&&k!=='\u2014')?schoolNameById(k):'Super-admin / hors \u00e9tablissement'; return b; }).sort((a,b)=>b.total-a.total);
    return { total:total, actifs:actifs, inactifs:inactifs, global:g, etabs:etabs };
  }
  // --- rendu des blocs ---
  function _connBlock(conn){
    const api=(typeof apiOn==='function'&&apiOn());
    const g=conn.global;
    const jChip=(v,label)=>`<button data-connj="${v}" class="px-3 py-1.5 rounded-full whitespace-nowrap ${(state.connJours||30)===v?'bg-brand-600 text-white':'bg-white dark:bg-slate-900 text-slate-500'}">${label}</button>`;
    const period=api?`<div class="flex gap-2 overflow-x-auto pb-1 text-[11px] font-semibold">${jChip(7,'7 jours')}${jChip(30,'30 jours')}${jChip(90,'90 jours')}</div>`:'';
    const tiles=`<div class="grid grid-cols-2 gap-3 lg:grid-cols-4 mt-3">${stat('Connexions r\u00e9ussies',String(g.reussite),'authentifications OK','bg-emerald-500')}${stat('\u00c9checs de connexion',String(g.echec),'tentatives rejet\u00e9es','bg-rose-500')}${stat('Total tentatives',String(g.total),'r\u00e9ussies + \u00e9checs','bg-slate-600')}${stat('Taux de r\u00e9ussite',(g.taux==null?'\u2014':g.taux+' %'),'sur la p\u00e9riode','bg-brand-600')}</div>`;
    // Banniere d'alerte "pic d'echecs" : pic actif en live OU alertes recentes.
    let banner='';
    const alertes=conn.alertes||[];
    if(g.pic||alertes.length){
      const fen=conn.fenetre?(' en '+conn.fenetre+' min'):'';
      const seuil=conn.seuil||5;
      const items=alertes.slice(0,6).map(a=>{ const when=a.quand?new Date(a.quand).toLocaleString('fr-FR'):''; const scope=a.scope==='pic_ip'?'IP':'\u00c9tablissement'; return `<li class="flex gap-2"><span class="font-semibold">${escH(a.name||'\u2014')}</span><span class="text-rose-500">${escH(a.detail||'')}</span><span class="text-rose-400/80">${escH(scope)}</span>${when?`<span class="ml-auto text-[10px] text-rose-400/70">${escH(when)}</span>`:''}</li>`; }).join('');
      banner=`<div class="mt-3 rounded-2xl border border-rose-300 bg-rose-50 dark:bg-rose-500/15 dark:border-rose-500/40 p-4"><div class="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-300"><span class="text-lg">\u26a0\ufe0f</span><span>Pic d'\u00e9checs de connexion d\u00e9tect\u00e9</span></div><p class="text-xs text-rose-600/90 dark:text-rose-300/80 mt-1">Seuil d\u00e9clencheur : ${seuil} \u00e9checs${fen}. ${g.pic?'Un pic est <b>actif</b> en ce moment.':'Des alertes ont \u00e9t\u00e9 enregistr\u00e9es sur la p\u00e9riode.'}</p>${items?`<ul class="mt-2 space-y-1 text-[11px] text-rose-700 dark:text-rose-200">${items}</ul>`:''}</div>`;
    }
    const ck=Object.keys(g.causes||{}).filter(k=>g.causes[k]>0);
    const causes=ck.length?`<p class="text-xs font-bold text-slate-500 mt-3 mb-1">Causes des \u00e9checs</p><div class="flex flex-wrap gap-2">${ck.map(k=>`<span class="px-3 py-1.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">${escH(CAUSE_LABELS[k]||k)} \u00b7 ${g.causes[k]}</span>`).join('')}</div>`:`<p class="text-[11px] text-slate-400 mt-2">Aucun \u00e9chec de connexion sur la p\u00e9riode.</p>`;
    let table='';
    if(conn.etabs&&conn.etabs.length){
      const rows=conn.etabs.map(e=>{ const cz=Object.keys(e.causes||{}).filter(k=>e.causes[k]>0).map(k=>(CAUSE_LABELS[k]||k)+' '+e.causes[k]).join(', ');
        return `<tr class="border-t border-slate-100 dark:border-slate-800${e.pic?' bg-rose-50 dark:bg-rose-500/10':''}"><td class="py-2 pr-2 font-semibold">${e.pic?'<span title="Pic d\'\u00e9checs actif">\u26a0\ufe0f </span>':''}${escH(e.name)}</td><td class="py-2 px-2 text-center text-emerald-600 font-bold">${e.reussite}</td><td class="py-2 px-2 text-center text-rose-600 font-bold">${e.echec}</td><td class="py-2 px-2 text-center">${e.total}</td><td class="py-2 px-2 text-center font-bold">${e.taux==null?'\u2014':e.taux+' %'}</td><td class="py-2 pl-2 text-[11px] text-slate-500">${escH(cz||'\u2014')}</td></tr>`; }).join('');
      table=`<p class="text-xs font-bold text-slate-500 mt-4 mb-1">D\u00e9tail par \u00e9tablissement</p><div class="overflow-x-auto rounded-2xl bg-white dark:bg-slate-900 shadow-soft p-3"><table class="w-full text-xs"><thead><tr class="text-left text-slate-400"><th class="py-1 pr-2">\u00c9tablissement</th><th class="py-1 px-2 text-center">R\u00e9ussies</th><th class="py-1 px-2 text-center">\u00c9checs</th><th class="py-1 px-2 text-center">Total</th><th class="py-1 px-2 text-center">Taux</th><th class="py-1 pl-2">Causes d'\u00e9chec</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }
    const title='Statistiques de connexion'+(conn.jours?' \u00b7 '+conn.jours+' derniers jours':'');
    return section(title,period)+banner+tiles+causes+table;
  }
  function _usersBlock(usr){
    const tiles=`<div class="grid grid-cols-2 gap-3 lg:grid-cols-4 mt-3">${stat('Comptes au total',String(usr.total),'tous profils','bg-brand-600')}${stat('Comptes actifs',String(usr.actifs),'peuvent se connecter','bg-emerald-500')}${stat('Comptes d\u00e9sactiv\u00e9s',String(usr.inactifs),'acc\u00e8s bloqu\u00e9','bg-slate-500')}${stat('Profils distincts',String(_orderedRoleKeys(usr['global']).length),'r\u00f4les pr\u00e9sents','bg-amber-500')}</div>`;
    const gk=_orderedRoleKeys(usr['global']);
    const chips=gk.length?`<p class="text-xs font-bold text-slate-500 mt-3 mb-1">R\u00e9partition par profil</p><div class="flex flex-wrap gap-2">${gk.map(k=>`<span class="px-3 py-1.5 rounded-full text-[11px] font-semibold bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">${escH(_profLabel(k))} \u00b7 ${usr['global'][k]}</span>`).join('')}</div>`:'<p class="text-[11px] text-slate-400 mt-2">Aucun compte \u00e0 comptabiliser.</p>';
    let table='';
    if(usr.etabs&&usr.etabs.length){
      const roleCols=_orderedRoleKeys((function(){ const u={}; usr.etabs.forEach(e=>Object.keys(e.roles||{}).forEach(k=>{ u[k]=(u[k]||0)+e.roles[k]; })); return u; })());
      const head=`<tr class="text-left text-slate-400"><th class="py-1 pr-2">\u00c9tablissement</th><th class="py-1 px-2 text-center">Total</th>${roleCols.map(k=>`<th class="py-1 px-2 text-center">${escH(_profLabel(k))}</th>`).join('')}<th class="py-1 px-2 text-center">Actifs</th><th class="py-1 px-2 text-center">D\u00e9sactiv\u00e9s</th></tr>`;
      const rows=usr.etabs.map(e=>`<tr class="border-t border-slate-100 dark:border-slate-800"><td class="py-2 pr-2 font-semibold">${escH(e.name)}</td><td class="py-2 px-2 text-center font-bold">${e.total}</td>${roleCols.map(k=>`<td class="py-2 px-2 text-center">${(e.roles&&e.roles[k])||0}</td>`).join('')}<td class="py-2 px-2 text-center text-emerald-600 font-bold">${e.actifs}</td><td class="py-2 px-2 text-center text-slate-500">${e.inactifs}</td></tr>`).join('');
      table=`<p class="text-xs font-bold text-slate-500 mt-4 mb-1">D\u00e9tail par \u00e9tablissement</p><div class="overflow-x-auto rounded-2xl bg-white dark:bg-slate-900 shadow-soft p-3"><table class="w-full text-xs"><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
    }
    return section('Utilisateurs par profil')+tiles+chips+table;
  }
  // Bloc complet de supervision (consomme l'API si dispo, sinon calcul local).
  function supervisionBlocks(){
    const api=(typeof apiOn==='function'&&apiOn());
    const conn=(api&&typeof CONN_STATS!=='undefined'&&CONN_STATS)?_connFromApi(CONN_STATS):_connFromLogs();
    const usr=(api&&typeof USER_STATS!=='undefined'&&USER_STATS)?_usersFromApi(USER_STATS):_usersFromLocal();
    return _connBlock(conn)+_usersBlock(usr);
  }

  // ---------- SUPERADMIN : journaux d'audit ----------
  function logs(){
    const isSuper=state.role==='super';
    const q=(state.logQ||'').trim().toLowerCase();
    const lvl=state.logLevel||'all';
    const sch=isSuper?(state.logSchool||'all'):state.schoolId;
    // Un admin ne voit que la traçabilité de son propre établissement.
    const base=isSuper?LOGS.slice():LOGS.filter(l=>l.school===state.schoolId);
    let list=base.slice();
    if(sch!=='all') list=list.filter(l=>l.school===sch);
    if(lvl!=='all') list=list.filter(l=>l.level===lvl);
    if(q) list=list.filter(l=>((l.user+' '+l.action+' '+l.detail+' '+l.ip+' '+schoolNameById(l.school)).toLowerCase().includes(q)));
    const cOk=base.filter(l=>l.level==='ok').length, cWarn=base.filter(l=>l.level==='warn').length, cErr=base.filter(l=>l.level==='error').length;
    const tiles=`<div class="grid grid-cols-2 gap-3 lg:grid-cols-4 mt-3">${stat('Événements',String(base.length),'journal complet','bg-slate-600')}${stat('Succès',String(cOk),'opérations OK','bg-emerald-500')}${stat('Alertes',String(cWarn),'à surveiller','bg-amber-500')}${stat('Erreurs',String(cErr),'échecs / sécurité','bg-rose-500')}</div>`;
    const lvlChip=(id,label)=>`<button data-loglvl="${id}" class="px-3 py-1.5 rounded-full whitespace-nowrap ${lvl===id?'bg-brand-600 text-white':'bg-white dark:bg-slate-900 text-slate-500'}">${label}</button>`;
    const lvlBar=`<div class="flex gap-2 overflow-x-auto pb-1 text-[11px] font-semibold">${lvlChip('all','Tout')}${lvlChip('ok','Succès')}${lvlChip('warn','Alertes')}${lvlChip('error','Erreurs')}${lvlChip('info','Info')}</div>`;
    const schoolSel=isSuper?`<select id="log_school" class="text-xs font-bold bg-white dark:bg-slate-900 shadow-soft rounded-full px-3 py-1.5 outline-none shrink-0"><option value="all"${sch==='all'?' selected':''}>Tous les établissements</option>${SCHOOLS.map(s=>`<option value="${s.id}"${sch===s.id?' selected':''}>${s.name}</option>`).join('')}</select>`:'';
    const lvlBadge=l=>({ok:badge('OK','bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'),warn:badge('Alerte','bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'),error:badge('Erreur','bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'),info:badge('Info','bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}[l]||badge(l,'bg-slate-200 text-slate-600'));
    const dot=l=>({ok:'bg-emerald-500',warn:'bg-amber-500',error:'bg-rose-500',info:'bg-slate-400'}[l]||'bg-slate-400');
    const rows=list.length?list.map(l=>`<div class="rounded-2xl p-3 bg-white dark:bg-slate-900 shadow-soft card-in flex items-start gap-3">
        <span class="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${dot(l.level)}"></span>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap"><p class="text-sm font-semibold">${escH(l.action)}</p>${lvlBadge(l.level)}</div>
          <p class="text-xs text-slate-500 mt-0.5">${escH(l.detail||'')}</p>
          <p class="text-[11px] text-slate-400 mt-1">${escH(l.when)} · ${escH(l.user)}${l.role&&l.role!=='—'?' ('+escH(ROLE_LABELS[l.role]||l.role)+')':''} · ${escH(schoolNameById(l.school))} · IP ${escH(l.ip)}</p>
        </div></div>`).join(''):'<p class="text-xs text-slate-400 px-1">Aucun événement pour ce filtre.</p>';
    const actions=`<div class="flex items-center gap-2"><button data-logxls="1" class="text-xs font-bold text-white bg-brand-600 px-3 py-1.5 rounded-full active:scale-95 transition">↓ Exporter</button><button data-logclear="1" class="text-xs font-bold text-rose-600 border border-rose-300 dark:border-rose-500/40 px-3 py-1.5 rounded-full hover:bg-rose-50 dark:hover:bg-rose-500/10">Purger</button></div>`;
    const search=`<div class="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-white dark:bg-slate-900 shadow-soft card-in"><svg class="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input id="log_q" value="${escH(state.logQ)}" placeholder="Rechercher un événement, utilisateur, IP..." class="bg-transparent flex-1 text-sm outline-none"></div>`;
    return `<div class="rounded-2xl p-3 bg-brand-50 dark:bg-slate-900 text-brand-700 dark:text-brand-300 text-xs font-semibold card-in flex items-center gap-2">${svg_(I.doc)} Historique & traçabilité — connexions et actions sensibles ${isSuper?'sur tous les établissements':'de <strong class=\'font-extrabold\'>'+escH(activeSchool().name)+'</strong>'}.</div>`
      + tiles
      + supervisionBlocks()
      + section('Journal des \u00e9v\u00e9nements')
      + `<div class="mt-3">${search}</div>`
      + `<div class="flex items-center justify-between gap-2 mt-3 flex-wrap">${lvlBar}${schoolSel}</div>`
      + section(list.length+' événement(s)', actions)
      + `<div class="space-y-2">${rows}</div>`
      + `<p class="text-[11px] text-slate-400 mt-2">💡 Les journaux tracent connexions, modifications de rôles, paiements et incidents système. « Exporter » télécharge le journal filtré (Excel).</p>`;
  }
  function wireLogs(){
    const main=$('#main');
    if(typeof apiOn==='function'&&apiOn()){
      window._xsLoaded=window._xsLoaded||{};
      if(!window._xsLoaded['logs']){ window._xsLoaded['logs']=true; hydrateLogsApi(200).then(ok=>{ if(ok) renderView(); }); }
      // Stats de supervision (connexions + comptes) : charge une fois, puis
      // recharge les connexions quand la fenetre (jours) change.
      if(!window._xsLoaded['sup']){ window._xsLoaded['sup']=true;
        hydrateConnStatsApi(state.connJours||30).then(ok=>{ if(ok) renderView(); });
        hydrateUserStatsApi().then(ok=>{ if(ok) renderView(); });
      }
    }
    main.querySelectorAll('[data-connj]').forEach(b=>b.addEventListener('click',()=>{
      const v=+b.dataset.connj; if((state.connJours||30)===v) return; state.connJours=v;
      if(typeof apiOn==='function'&&apiOn()){ hydrateConnStatsApi(v).then(()=>renderView()); } else { renderView(); }
    }));
    const qi=main.querySelector('#log_q'); if(qi) qi.addEventListener('input',()=>{ state.logQ=qi.value; const v=qi.value; renderView(); const n=$('#main').querySelector('#log_q'); if(n){ n.focus(); n.setSelectionRange(v.length,v.length);} });
    main.querySelectorAll('[data-loglvl]').forEach(b=>b.addEventListener('click',()=>{ state.logLevel=b.dataset.loglvl; renderView(); }));
    const ss=main.querySelector('#log_school'); if(ss) ss.addEventListener('change',()=>{ state.logSchool=ss.value; renderView(); });
    const xb=main.querySelector('[data-logxls]'); if(xb) xb.addEventListener('click',()=>exportLogs());
    const cb=main.querySelector('[data-logclear]'); if(cb) cb.addEventListener('click',()=>{ if(!confirm('Purger le journal affiché ? (simulation — vide les événements en mémoire)')) return; LOGS=[]; renderView(); toast('Journal purgé'); });
  }
  function exportLogs(){
    const isSuper=state.role==='super';
    const q=(state.logQ||'').trim().toLowerCase(); const lvl=state.logLevel||'all'; const sch=isSuper?(state.logSchool||'all'):state.schoolId;
    let list=isSuper?LOGS.slice():LOGS.filter(l=>l.school===state.schoolId);
    if(sch!=='all') list=list.filter(l=>l.school===sch);
    if(lvl!=='all') list=list.filter(l=>l.level===lvl);
    if(q) list=list.filter(l=>((l.user+' '+l.action+' '+l.detail+' '+l.ip+' '+schoolNameById(l.school)).toLowerCase().includes(q)));
    if(!list.length){toast('Aucun événement à exporter');return;}
    const head=['Date','Niveau','Action','Détail','Utilisateur','Rôle','Établissement','IP'];
    const lvlTxt={ok:'Succès',warn:'Alerte',error:'Erreur',info:'Info'};
    const aoa=[head].concat(list.map(l=>[l.when,lvlTxt[l.level]||l.level,l.action,l.detail||'',l.user,ROLE_LABELS[l.role]||l.role||'',schoolNameById(l.school),l.ip]));
    const fname='journaux_audit.xlsx';
    if(typeof XLSX!=='undefined'){ try{ const ws=XLSX.utils.aoa_to_sheet(aoa); ws['!cols']=head.map(()=>({wch:18})); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Journaux'); XLSX.writeFile(wb,fname); toast(list.length+' événement(s) exporté(s) ✓'); return; }catch(err){} }
    const csv=aoa.map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n');
    downloadFile('journaux_audit.csv', '\uFEFF'+csv, 'text/csv;charset=utf-8'); toast(list.length+' événement(s) exporté(s) (CSV) ✓');
  }
  const CSV_MAP={ matricule:['matricule','mat'], nom:['nom'], prenom:['prenom','prenoms','prenom(s)'], dob:['date_naissance','naissance','ddn','date de naissance','dob'], sexe:['sexe','genre'], lieu:['lieu','lieu_naissance','lieu de naissance'], pere:['pere','nom_pere','nom du pere'], pereTel:['contact_pere','tel_pere','telephone_pere','contact du pere'], mere:['mere','nom_mere','nom de la mere'], mereTel:['contact_mere','tel_mere','telephone_mere','contact de la mere'], cls:['classe','class'], statut:['statut','status'], st:['regime'] };
  function parseCSV(text){
    text=text.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
    const first=text.split('\n')[0]||'';
    const delim=(first.split(';').length>first.split(',').length)?';':',';
    const rows=[]; let row=[],cur='',q=false;
    for(let i=0;i<text.length;i++){ const ch=text[i];
      if(q){ if(ch==='"'){ if(text[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=ch; }
      else { if(ch==='"') q=true; else if(ch===delim){ row.push(cur); cur=''; } else if(ch==='\n'){ row.push(cur); rows.push(row); row=[]; cur=''; } else cur+=ch; }
    }
    if(cur!==''||row.length){ row.push(cur); rows.push(row); }
    return rows.filter(r=>r.some(c=>(c||'').trim()!==''));
  }
  function importStudentsRows(rows,targetClsId){
    if(!rows||rows.length<2) return {added:0,skipped:0,error:'Fichier vide ou sans ligne de données'};
    const norm=s=>(s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const header=(rows[0]||[]).map(c=>norm(String(c==null?'':c)));
    const idx={}; Object.keys(CSV_MAP).forEach(key=>{ idx[key]=header.findIndex(h=>CSV_MAP[key].map(norm).includes(h)); });
    if(idx.nom<0&&idx.prenom<0) return {added:0,skipped:0,error:'En-tête invalide : colonnes « nom » / « prenom » introuvables'};
    const findCls=label=>{ const n=norm(label); if(!n) return ''; const c=DB.classes.find(x=>norm(clsLabel(x.id))===n||norm(x.name)===n); return c?c.id:''; };
    let added=0,skipped=0;
    for(let i=1;i<rows.length;i++){ const r=rows[i]||[]; const g=k=>idx[k]>=0?String(r[idx[k]]==null?'':r[idx[k]]).trim():'';
      const nom=g('nom'),prenom=g('prenom'); if(!nom&&!prenom){skipped++;continue;}
      const sexe=(g('sexe')||'').toUpperCase().charAt(0)==='F'?'F':'M';
      const cls=targetClsId||findCls(g('cls'));
      DB.students.push({id:uid('e'),mat:g('matricule')||('2026-'+String(1000+Math.floor(Math.random()*9000))),nom,prenom,dob:g('dob'),sexe,lieu:g('lieu'),pere:g('pere'),pereTel:g('pereTel'),mere:g('mere'),mereTel:g('mereTel'),cls,st:g('st'),statut:g('statut')||'Nouveau',photo:''});
      const _ni=DB.students[DB.students.length-1]; _ni.year=state.year; _ni.enrollments=[{year:state.year,cls:_ni.cls,statut:_ni.statut}];
      added++;
    }
    return {added,skipped};
  }
  function importStudentsCSV(text,targetClsId){ return importStudentsRows(parseCSV(text),targetClsId); }
  function importStudentsExcel(data,targetClsId){
    if(typeof XLSX==='undefined') return {added:0,skipped:0,error:'Lecteur Excel indisponible (vérifie ta connexion)'};
    let wb; try{ wb=XLSX.read(data,{type:'array'}); }catch(err){ return {added:0,skipped:0,error:'Fichier Excel illisible'}; }
    const ws=wb.Sheets[wb.SheetNames[0]]; if(!ws) return {added:0,skipped:0,error:'Aucune feuille dans le classeur'};
    const rows=XLSX.utils.sheet_to_json(ws,{header:1,blankrows:false,defval:''});
    return importStudentsRows(rows,targetClsId);
  }
  const TPL_HEAD=['matricule','nom','prenom','date_naissance','sexe','lieu','pere','contact_pere','mere','contact_mere','classe','statut','regime'];
  const TPL_ROWS=[['2026-1001','Kodjo','Ama','2009-05-14','F','Lome','Kodjo Pierre','90000001','Afi Marie','90000002','Tle F2','Nouveau','Externe'],['','Mensah','Kossi','2008-11-02','M','Kpalime','','','','','','','']];
  function downloadTemplate(){
    if(typeof XLSX!=='undefined'){ try{ const ws=XLSX.utils.aoa_to_sheet([TPL_HEAD].concat(TPL_ROWS)); ws['!cols']=TPL_HEAD.map(()=>({wch:16})); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Eleves'); XLSX.writeFile(wb,'modele_eleves_xschool.xlsx'); toast('Modèle Excel téléchargé ✓'); return; }catch(err){} }
    const csv=[TPL_HEAD.join(',')].concat(TPL_ROWS.map(r=>r.join(','))).join('\n');
    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=url; a.download='modele_eleves_xschool.csv'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500); toast('Modèle CSV téléchargé ✓');
  }
  // ---------- Import Excel / CSV des enseignants ----------
  const TEA_MAP={ nom:['nom'], prenom:['prenom','prenoms','prenom(s)'], dob:['date_naissance','naissance','ddn','date de naissance','dob'], dip:['diplome','diplomes','diplôme','diploma'], spec:['specialite','specialites','spécialité','matiere','matieres','specialty'], tel:['contact','telephone','tel','phone','contact_tel'], urgNom:['personne_a_prevenir','personne a prevenir','urgence','contact_urgence_nom','a_prevenir'], urgTel:['contact_urgence','tel_urgence','telephone_urgence','contact urgence'] };
  function importTeachersRows(rows){
    if(!rows||rows.length<2) return {added:0,skipped:0,error:'Fichier vide ou sans ligne de données'};
    const norm=s=>(s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const header=(rows[0]||[]).map(c=>norm(String(c==null?'':c)));
    const idx={}; Object.keys(TEA_MAP).forEach(key=>{ idx[key]=header.findIndex(h=>TEA_MAP[key].map(norm).includes(h)); });
    if(idx.nom<0&&idx.prenom<0) return {added:0,skipped:0,error:'En-tête invalide : colonnes « nom » / « prenom » introuvables'};
    let added=0,skipped=0;
    for(let i=1;i<rows.length;i++){ const r=rows[i]||[]; const g=k=>idx[k]>=0?String(r[idx[k]]==null?'':r[idx[k]]).trim():'';
      const nom=g('nom'),prenom=g('prenom'); if(!nom&&!prenom){skipped++;continue;}
      DB.teachers.push({id:uid('t'),n:((nom+' '+prenom).trim()),nom,prenom,dob:g('dob'),dip:g('dip'),spec:g('spec'),tel:g('tel'),urgNom:g('urgNom'),urgTel:g('urgTel'),photo:'',subs:[],cls:[]});
      added++;
    }
    return {added,skipped};
  }
  function importTeachersCSV(text){ return importTeachersRows(parseCSV(text)); }
  function importTeachersExcel(data){
    if(typeof XLSX==='undefined') return {added:0,skipped:0,error:'Lecteur Excel indisponible (vérifie ta connexion)'};
    let wb; try{ wb=XLSX.read(data,{type:'array'}); }catch(err){ return {added:0,skipped:0,error:'Fichier Excel illisible'}; }
    const ws=wb.Sheets[wb.SheetNames[0]]; if(!ws) return {added:0,skipped:0,error:'Aucune feuille dans le classeur'};
    const rows=XLSX.utils.sheet_to_json(ws,{header:1,blankrows:false,defval:''});
    return importTeachersRows(rows);
  }
  const TEA_HEAD=['nom','prenom','date_naissance','diplome','specialite','contact','personne_a_prevenir','contact_urgence'];
  const TEA_ROWS=[['Sarr','Aminata','1985-04-12','Master en Lettres','Français','+228 90 12 34 56','Ousmane Sarr (époux)','+228 91 00 00 01'],['Ndiaye','Cheikh','1979-09-28','CAPES','Mathématiques','+228 92 22 11 00','Awa Ndiaye (épouse)','+228 93 44 55 66']];
  function downloadTeacherTemplate(){
    if(typeof XLSX!=='undefined'){ try{ const ws=XLSX.utils.aoa_to_sheet([TEA_HEAD].concat(TEA_ROWS)); ws['!cols']=TEA_HEAD.map(()=>({wch:18})); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Enseignants'); XLSX.writeFile(wb,'modele_enseignants_xschool.xlsx'); toast('Modèle Excel téléchargé ✓'); return; }catch(err){} }
    const csv=[TEA_HEAD.join(',')].concat(TEA_ROWS.map(r=>r.join(','))).join('\n');
    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=url; a.download='modele_enseignants_xschool.csv'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500); toast('Modèle CSV téléchargé ✓');
  }
  function mgEleves(){
    const esc=v=>(''+(v==null?'':v)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    const cls=DB.classes.filter(c=>activeCycles().includes(c.cycle));
    const ed=state.mgStuEdit?DB.students.find(e=>e.id===state.mgStuEdit):null;
    const editing=!!ed;
    const mode=editing?'classe':state.mgStuMode;
    const clsOpt=sel=>cls.map(c=>`<option value="${c.id}" ${sel===c.id?'selected':''}>${clsLabel(c.id)} · ${c.cycle}</option>`).join('');
    const selA=(a,v)=>a===v?'selected':'';
    let clsField;
    if(editing){
      clsField=`<select id="el_c" class="${MGSEL}"><option value="" ${ed.cls?'':'selected'}>— Aucune classe (base de l'école) —</option>${clsOpt(ed.cls)}</select>`;
    } else if(mode==='classe'){
      clsField=`<select id="el_c" class="${MGSEL}">${clsOpt('')||'<option value="">Crée d\'abord une classe</option>'}</select>`;
    } else {
      clsField=`<div class="rounded-xl p-2.5 bg-sky-50 dark:bg-sky-500/10 border border-sky-100 dark:border-sky-500/20 text-[11px] text-sky-700 dark:text-sky-300 font-semibold leading-snug">L'élève sera enregistré dans la base de l'école, <strong>sans classe</strong>. Tu pourras l'affecter à une classe ensuite depuis sa fiche.</div>`;
    }
    const modeTog=editing?'':`<div class="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
         <button data-stumode="base" class="py-1.5 rounded-lg text-[11px] font-bold transition ${mode==='base'?'bg-white dark:bg-slate-900 shadow-soft text-brand-600 dark:text-brand-300':'text-slate-500'}">Dans la base (sans classe)</button>
         <button data-stumode="classe" class="py-1.5 rounded-lg text-[11px] font-bold transition ${mode==='classe'?'bg-white dark:bg-slate-900 shadow-soft text-brand-600 dark:text-brand-300':'text-slate-500'}">Directement dans une classe</button>
       </div>`;
    const submit=editing
      ?`<div class="flex gap-2"><button data-msave="${ed.id}" class="${MGBTN} flex-1 justify-center">Enregistrer les modifications</button><button data-mcancel="1" class="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200 text-xs font-bold active:scale-95 transition">Annuler</button></div>`
      :`<button data-madd="eleves" class="${MGBTN} w-full">+ Inscrire l'élève ${mode==='base'?'dans la base':'dans la classe'}</button>`;
    const form=mgCard(
      `<p class="font-bold text-sm">${editing?'Modifier l\'élève':'Inscrire un élève'} <span class="text-slate-400 font-medium">(fiche complète)</span></p>
       ${modeTog}
       <input id="el_mat" class="${MGIN}" value="${editing?esc(ed.mat):''}" placeholder="Matricule (laisser vide = auto)">
       <div class="grid grid-cols-2 gap-2">
         <label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">${RQ}Nom<input id="el_nom" class="${MGIN} font-normal" value="${editing?esc(ed.nom):''}" placeholder="Nom"></label>
         <label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">${RQ}Prénom(s)<input id="el_prenom" class="${MGIN} font-normal" value="${editing?esc(ed.prenom):''}" placeholder="Prénom(s)"></label>
       </div>
       <div class="grid grid-cols-2 gap-2">
         <label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">Date de naissance<input id="el_dob" type="date" class="${MGIN} font-normal" value="${editing?esc(ed.dob):''}"></label>
         <label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">Sexe<select id="el_sexe" class="${MGSEL} font-normal"><option value="M" ${selA(editing?ed.sexe:'M','M')}>Masculin</option><option value="F" ${selA(editing?ed.sexe:'','F')}>Féminin</option></select></label>
       </div>
       <input id="el_lieu" class="${MGIN}" value="${editing?esc(ed.lieu):''}" placeholder="Lieu de naissance">
       <div class="pt-2 border-t border-slate-100 dark:border-slate-800"><p class="text-[11px] font-bold text-slate-400 mb-2">Parents / tuteurs</p>
         <div class="grid grid-cols-2 gap-2">
           <input id="el_pere" class="${MGIN}" value="${editing?esc(ed.pere):''}" placeholder="Nom et prénom du père">
           <input id="el_peretel" class="${MGIN}" value="${editing?esc(ed.pereTel):''}" placeholder="Contact père">
         </div>
         <div class="grid grid-cols-2 gap-2 mt-2">
           <input id="el_mere" class="${MGIN}" value="${editing?esc(ed.mere):''}" placeholder="Nom et prénom de la mère">
           <input id="el_meretel" class="${MGIN}" value="${editing?esc(ed.mereTel):''}" placeholder="Contact mère">
         </div>
       </div>
       <div class="pt-2 border-t border-slate-100 dark:border-slate-800"><p class="text-[11px] font-bold text-slate-400 mb-2">Scolarité</p>
         ${clsField}
         <div class="grid grid-cols-2 gap-2 mt-2">
           <label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">Statut<select id="el_statut" class="${MGSEL} font-normal"><option ${selA(editing?ed.statut:'Nouveau','Nouveau')}>Nouveau</option><option ${selA(editing?ed.statut:'','Redoublant')}>Redoublant</option><option ${selA(editing?ed.statut:'','Abandon')}>Abandon</option></select></label>
           <label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">Régime <span class="text-slate-300">(optionnel)</span><select id="el_s" class="${MGSEL} font-normal"><option value="" ${selA(editing?ed.st:'','')}>— Non défini</option><option ${selA(editing?ed.st:'','Externe')}>Externe</option><option ${selA(editing?ed.st:'','Interne')}>Interne</option><option ${selA(editing?ed.st:'','Demi-pension')}>Demi-pension</option></select></label>
         </div>
       </div>
       <div class="flex items-center gap-3">
         <div class="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden grid place-items-center shrink-0">${state.mgPhoto?`<img src="${state.mgPhoto}" class="w-full h-full object-cover" alt="">`:`<span class="w-6 h-6 text-slate-400">${svg(I.users)}</span>`}</div>
         <label class="flex-1 cursor-pointer px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-semibold text-center active:scale-95 transition"><span>${state.mgPhoto?'Changer la photo':'📷 Choisir une photo (optionnel)'}</span><input id="el_file" type="file" accept="image/*" class="hidden"></label>
         ${state.mgPhoto?`<button data-mphoto-clear="1" class="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300 grid place-items-center shrink-0">${svg_(I.trash)}</button>`:''}
       </div>
       ${submit}`);
    const impCls=cls.map(c=>`<option value="${c.id}">${clsLabel(c.id)} · ${c.cycle}</option>`).join('');
    const impCard=editing?'':mgCard(
      `<p class="font-bold text-sm">Importer des élèves <span class="text-slate-400 font-medium">(fichier Excel)</span></p>
       <p class="text-[11px] text-slate-500 leading-snug">Colonnes : matricule, nom, prenom, date_naissance, sexe, lieu, pere, contact_pere, mere, contact_mere, classe, statut, regime. Seuls <strong>nom</strong> / <strong>prenom</strong> sont obligatoires. Formats acceptés : .xlsx, .xls (CSV aussi).</p>
       <label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">Classe cible (optionnel)<select id="csv_cls" class="${MGSEL} font-normal"><option value="">— Selon la colonne « classe », sinon base de l'école —</option>${impCls}</select></label>
       <div class="flex gap-2">
         <label class="flex-1 cursor-pointer px-3 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-bold text-center active:scale-95 transition"><span>📊 Choisir un fichier Excel</span><input id="csv_file" type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" class="hidden"></label>
         <button data-csvtpl="1" class="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200 text-xs font-bold active:scale-95 transition whitespace-nowrap">Modèle Excel</button>
       </div>`);
    const regBadge=st=>st?badge(st,'bg-amber-100 text-amber-700'):'';
    const statBadge=s=>s==='Redoublant'?badge('Redoublant','bg-rose-100 text-rose-700'):(s==='Abandon'?badge('Abandon','bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'):badge('Nouveau','bg-emerald-100 text-emerald-700'));
    const photoEl=e=>e.photo?`<img src="${e.photo}" class="w-10 h-10 rounded-xl object-cover bg-slate-200 dark:bg-slate-800" alt="">`:avatar(`${e.prenom||''} ${e.nom||''}`.trim(),'w-10 h-10');
    const detail=e=>{
      const li=(l,v)=>`<div class="flex justify-between gap-3 py-1 border-b border-slate-100 dark:border-slate-800 last:border-0"><span class="text-[11px] font-bold text-slate-400">${l}</span><span class="text-xs font-semibold text-right">${v||'—'}</span></div>`;
      const assign=`<div class="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800"><p class="text-[11px] font-bold text-slate-400 mb-1">${e.cls?'Changer de classe':'Affecter à une classe'}</p><div class="flex gap-2"><select id="as_cls_${e.id}" class="${MGSEL}"><option value="">— Aucune (rester dans la base) —</option>${clsOpt(e.cls)}</select><button data-sassign="${e.id}" class="${MGBTN}">${e.cls?'Mettre à jour':'Affecter'}</button></div></div>`;
      const quick=[];
      if(e.cls) quick.push(`<button data-sremovecls="${e.id}" class="flex-1 justify-center px-3 py-2 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 text-xs font-bold active:scale-95 transition">Retirer de la classe</button>`);
      if((e.statut||'')==='Abandon') quick.push(`<button data-sunabandon="${e.id}" class="flex-1 justify-center px-3 py-2 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 text-xs font-bold active:scale-95 transition">Annuler l'abandon</button>`);
      const quickRow=quick.length?`<div class="flex gap-2 mt-2">${quick.join('')}</div>`:'';
      return `<div class="rounded-2xl p-3 mt-1 bg-slate-50 dark:bg-slate-900/60 shadow-soft card-in">
        ${li('Matricule',e.mat)}${li('Date de naissance',e.dob)}${li('Sexe',e.sexe==='F'?'Féminin':e.sexe==='M'?'Masculin':'')}${li('Lieu de naissance',e.lieu)}
        ${li('Classe',e.cls?clsLabel(e.cls):'<span class=\'text-amber-600 dark:text-amber-400\'>Sans classe</span>')}${li('Statut',e.statut)}${li('Régime',e.st)}
        ${li('Père',e.pere)}${li('Contact père',e.pereTel)}${li('Mère',e.mere)}${li('Contact mère',e.mereTel)}
        ${assign}
        ${quickRow}
        <div class="flex gap-2 mt-2"><button data-medit="${e.id}" class="${MGBTN} flex-1 justify-center">${svg_(I.edit)} Modifier la fiche</button></div></div>`;
    };
    const editBtn=id=>`<button data-medit="${id}" class="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300 grid place-items-center shrink-0" title="Modifier">${svg_(I.edit)}</button>`;
    const noCls=studentsOfYear(state.year).filter(e=>clsOfYear(e,state.year)==='').length;
    const list=DB.students.length?DB.students.map(e=>{
       const open=state.mgStuOpen===e.id;
       return row(
        photoEl(e),
        `<button data-stu="${e.id}" class="text-left w-full"><p class="text-sm font-semibold truncate">${stuName(e)}</p><p class="text-xs text-slate-500">${e.mat||'—'} · ${e.cls?clsLabel(e.cls):'<span class=\'text-amber-600 dark:text-amber-400 font-semibold\'>Sans classe</span>'}</p></button>`,
        `<div class="flex items-center gap-1.5">${statBadge(e.statut)}${regBadge(e.st)}${editBtn(e.id)}${mgDel('eleves:'+e.id)}</div>`
       )+(open?detail(e):'');
     }).join(''):'<p class="text-xs text-slate-400 px-1">Aucun élève inscrit.</p>';
    const sub=`<span class="text-xs text-slate-400">${noCls?noCls+' sans classe · ':''}Tape un élève pour sa fiche</span>`;
    const statYear=state.mgStatYear||state.year;
    const stY=yearStats(statYear);
    const yrOpts=s=>YEARS.map(y=>`<option value="${y}" ${y===s?'selected':''}>${y}</option>`).join('');
    const tile=(n,l,cl)=>`<div class="rounded-xl p-2.5 ${cl} text-center"><p class="text-lg font-extrabold leading-none">${n}</p><p class="text-[10px] font-semibold mt-1 opacity-80">${l}</p></div>`;
    const byCls=cls.map(c=>{ const n=stY.list.filter(e=>{const en=enrollFor(e,statYear);return en&&en.cls===c.id;}).length; return n?`<div class="flex justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800 last:border-0"><span class="font-semibold truncate">${clsLabel(c.id)}</span><span class="text-slate-500">${n}</span></div>`:''; }).join('');
    const statsCard=mgCard(
      `<div class="flex items-center justify-between gap-2"><p class="font-bold text-sm">Statistiques des élèves</p><select id="stat_year" class="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold outline-none">${yrOpts(statYear)}</select></div>
       <div class="grid grid-cols-3 gap-2">${tile(stY.total,'Total','bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300')}${tile(stY.f,'Filles','bg-pink-50 text-pink-600 dark:bg-pink-500/15 dark:text-pink-300')}${tile(stY.m,'Garçons','bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300')}</div>
       <div class="grid grid-cols-3 gap-2">${tile(stY.nouv,'Nouveaux','bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300')}${tile(stY.red,'Redoublants','bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300')}${tile(stY.sans,'Sans classe','bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300')}</div>
       ${byCls?`<div class="pt-2 border-t border-slate-100 dark:border-slate-800"><p class="text-[11px] font-bold text-slate-400 mb-1">Répartition par classe — ${statYear}</p>${byCls}</div>`:`<p class="text-[11px] text-slate-400">Aucun élève inscrit pour ${statYear}.</p>`}`);
    const nextYear=(()=>{ const i=YEARS.indexOf(state.year); return i>=0&&i<YEARS.length-1?YEARS[i+1]:state.year; })();
    const liveClsOpts=cls.map(c=>`<option value="${c.id}">${clsLabel(c.id)} · ${c.cycle}</option>`).join('');
    const bulkCard=editing?'':mgCard(
      `<p class="font-bold text-sm">Passage de classe <span class="text-slate-400 font-medium">(en masse)</span></p>
       <p class="text-[11px] text-slate-500 leading-snug">Transfère d'un coup tous les élèves d'une classe vers une autre, pour l'année choisie (promotion de fin d'année).</p>
       <label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">Classe de départ<select id="bp_src" class="${MGSEL} font-normal">${liveClsOpts||'<option value="">—</option>'}</select></label>
       <div class="grid grid-cols-2 gap-2">
         <label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">Année cible<select id="bp_year" class="${MGSEL} font-normal">${yrOpts(nextYear)}</select></label>
         <label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">Classe d'arrivée<select id="bp_dst" class="${MGSEL} font-normal"><option value="">— Sortie / sans classe —</option>${liveClsOpts}</select></label>
       </div>
       <label class="flex items-center gap-2 text-xs text-slate-500"><input id="bp_reset" type="checkbox" checked class="w-4 h-4 accent-brand-600"> Repasser le statut à « Nouveau » pour l'année cible</label>
       <button data-bulkpromote="1" class="${MGBTN} w-full">Transférer les élèves</button>`);
    return form+statsCard+bulkCard+impCard+section(DB.students.length+' élève(s)',sub)+`<div class="space-y-2">${list}</div>`;
  }
  function mgClasses(){
    const cur=activeCycles().includes(state.mgCycle)?state.mgCycle:(activeCycles()[0]||'');
    const cycleSel=`<select id="cl_cy" class="${MGSEL}">${activeCycles().map(c=>`<option ${c===cur?'selected':''}>${c}</option>`).join('')}</select>`;
    const grpSel=`<select id="cl_g" class="${MGSEL}">${GROUPS.map(g=>`<option value="${g[0]}">${g[1]}</option>`).join('')}</select>`;
    let fields;
    if(cur==='Cycle Professionnel'){
      const dip=PRO_SPECS[state.mgDip]?state.mgDip:'CAP';
      const specOpts=Object.entries(PRO_SPECS[dip]).map(([g,arr])=>`<optgroup label="${g}">${arr.map(s=>`<option>${s}</option>`).join('')}</optgroup>`).join('');
      fields=`<div class="grid grid-cols-2 gap-2">
           <select id="cl_dip" class="${MGSEL}"><option value="CAP" ${dip==='CAP'?'selected':''}>Diplôme : CAP</option><option value="BT" ${dip==='BT'?'selected':''}>Diplôme : BT</option></select>
           <select id="cl_lv" class="${MGSEL}"><option value="1">1ʳᵉ année</option><option value="2">2ᵉ année</option><option value="3">3ᵉ année</option></select>
         </div>
         <label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">${RQ}Filière<select id="cl_sp" class="${MGSEL} font-normal">${specOpts}</select></label>
         ${grpSel}`;
    } else {
      fields=`<div class="grid grid-cols-2 gap-2">
           <label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">${RQ}Nom<input id="cl_n" class="${MGIN} font-normal" placeholder="Nom (ex: Tle D, 6ᵉme...)"></label>
           ${grpSel}
         </div>`;
    }
    const form=mgCard(
      `<p class="font-bold text-sm">Créer une classe</p>
       ${cycleSel}
       ${fields}
       <button data-madd="classes" class="${MGBTN} w-full">+ Créer la classe</button>`);
    const list=DB.classes.length?DB.classes.map(c=>{
       const nb=studentsInClass(c.id).length;
       const sub=c.spec?c.spec+' · '+nb+' élève(s)':c.cycle+' · '+nb+' élève(s)';
       const titId=classTitulaireFor(c, state.year);
       const tit=titId?DB.teachers.find(x=>x.id===titId):null;
       const teaOpts=DB.teachers.map(t=>`<option value="${t.id}" ${t.id===titId?'selected':''}>${escH(teacName(t))}</option>`).join('');
       const titRow=`<div class="pt-2 mt-1 border-t border-slate-100 dark:border-slate-800">
           <p class="text-[11px] font-bold text-slate-400 mb-1">Professeur titulaire · <span class="text-brand-600 dark:text-brand-300">${escH(state.year)}</span></p>
           <p class="text-xs mb-1.5">${tit?'<span class="font-semibold">'+escH(teacName(tit))+'</span>':'<span class="text-amber-600 dark:text-amber-400 font-semibold">Aucun titulaire</span>'}</p>
           ${DB.teachers.length?`<div class="flex gap-2"><select id="tit_${c.id}" class="${MGSEL}"><option value="">— Aucun titulaire —</option>${teaOpts}</select><button data-cltit="${c.id}" class="${MGBTN} whitespace-nowrap">${tit?'Mettre à jour':'Affecter'}</button></div><p class="text-[10px] text-slate-400 mt-1">Le titulaire est enregistré pour l'année active (${escH(state.year)}) ; change d'année en haut pour en définir un autre.</p>`:`<p class="text-[11px] text-slate-400">Ajoute d'abord des enseignants dans l'onglet « Enseignants ».</p>`}
         </div>`;
       return mgCard(
        `<div class="flex items-center gap-3">
           <div class="w-9 h-9 rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 p-2 shrink-0">${svg(I.teacher)}</div>
           <div class="min-w-0 flex-1"><p class="text-sm font-semibold truncate">${clsLabel(c.id)}</p><p class="text-xs text-slate-500 truncate">${sub}</p></div>
           ${mgDel('classes:'+c.id)}
         </div>
         ${titRow}`);
     }).join(''):'<p class="text-xs text-slate-400 px-1">Aucune classe.</p>';
    return form+section(DB.classes.length+' classe(s)')+(DB.classes.length?`<div class="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">${list}</div>`:listWrap(list));
  }
  function mgMat(){
    const form=mgCard(
      `<p class="font-bold text-sm">Créer une matière</p>
       <label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">${RQ}Nom de la matière<input id="ma_n" class="${MGIN} font-normal" placeholder="Nom de la matière"></label>
       <select id="ma_d" class="${MGSEL}"><option value="litt">Domaine : Littéraire</option><option value="sci">Domaine : Scientifique</option><option value="autre">Domaine : Général</option></select>
       <button data-madd="mat" class="${MGBTN} w-full">+ Créer la matière</button>`);
    const list=DB.subjects.length?DB.subjects.map(s=>{const[d,c]=DOM[s.dom]||DOM.autre;return row(
        `<div class="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 p-2">${svg(I.book)}</div>`,
        `<p class="text-sm font-semibold truncate">${s.n}</p>`,
        `<div class="flex items-center gap-2">${badge(d,'bg-'+c+'-100 text-'+c+'-700')}${mgDel('mat:'+s.id)}</div>`);
     }).join(''):'<p class="text-xs text-slate-400 px-1">Aucune matière.</p>';
    return form+section(DB.subjects.length+' matière(s)')+listWrap(list);
  }
  function mgEns(){
    const ed = state.mgEnsEdit?DB.teachers.find(t=>t.id===state.mgEnsEdit):null;
    const gv=f=>ed?escH(ed[f]||''):'';
    const photo=state.mgEnsPhoto;
    const photoRow=`<div class="flex items-center gap-3">
         <div class="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden grid place-items-center shrink-0">${photo?`<img src="${photo}" class="w-full h-full object-cover" alt="">`:`<span class="w-6 h-6 text-slate-400">${svg(I.users)}</span>`}</div>
         <label class="flex-1 cursor-pointer px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-semibold text-center active:scale-95 transition"><span>${photo?'Changer la photo':'📷 Photo (optionnel)'}</span><input id="en_file" type="file" accept="image/*" class="hidden"></label>
         ${photo?`<button data-tphoto-clear="1" class="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300 grid place-items-center shrink-0">${svg_(I.trash)}</button>`:''}
       </div>`;
    const submit = ed
      ? `<div class="flex gap-2"><button data-tsave="${ed.id}" class="${MGBTN} flex-1 justify-center">Enregistrer les modifications</button><button data-tcancel="1" class="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200 text-xs font-bold active:scale-95 transition">Annuler</button></div>`
      : `<button data-madd="ens" class="${MGBTN} w-full">+ Ajouter l'enseignant</button>`;
    const form=mgCard(
      `<p class="font-bold text-sm">${ed?'Modifier l\'enseignant':'Ajouter un enseignant'}</p>
       ${photoRow}
       <div class="grid grid-cols-2 gap-2"><label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">${RQ}Nom<input id="en_nom" class="${MGIN} font-normal" placeholder="Nom" value="${gv('nom')}"></label><label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">${RQ}Prénom<input id="en_prenom" class="${MGIN} font-normal" placeholder="Prénom" value="${gv('prenom')}"></label></div>
       <div class="grid grid-cols-2 gap-2"><label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">Date de naissance<input id="en_dob" type="date" class="${MGIN} font-normal" value="${gv('dob')}"></label><label class="text-[11px] font-bold text-slate-400 flex flex-col gap-1">Contact (téléphone)<input id="en_tel" class="${MGIN} font-normal" placeholder="+228 ..." value="${gv('tel')}"></label></div>
       <div class="grid grid-cols-2 gap-2"><input id="en_dip" class="${MGIN}" placeholder="Diplôme (ex : Master, CAPES...)" value="${gv('dip')}"><input id="en_spec" class="${MGIN}" placeholder="Spécialité (ex : Mathématiques)" value="${gv('spec')}"></div>
       <div class="pt-2 border-t border-slate-100 dark:border-slate-800"><p class="text-[11px] font-bold text-slate-400 mb-1">Personne à prévenir (urgence)</p><div class="grid grid-cols-2 gap-2"><input id="en_urgn" class="${MGIN}" placeholder="Nom & lien" value="${gv('urgNom')}"><input id="en_urgt" class="${MGIN}" placeholder="Contact" value="${gv('urgTel')}"></div></div>
       ${submit}`);
    const actClasses=DB.classes.filter(c=>activeCycles().includes(c.cycle));
    const clsOptsFor=t=>{ const avail=actClasses.filter(c=>!t.cls.includes(c.id)); if(!avail.length) return ''; const byCyc={}; avail.forEach(c=>{ (byCyc[c.cycle]=byCyc[c.cycle]||[]).push(c); }); return Object.keys(byCyc).map(cy=>`<optgroup label="${escH(cy)}">${byCyc[cy].map(c=>`<option value="${c.id}">${escH(clsLabel(c.id))}</option>`).join('')}</optgroup>`).join(''); };
    const subOptsFor=t=>DB.subjects.filter(s=>!t.subs.includes(s.id)).map(s=>`<option value="${s.id}">${escH(s.n)}</option>`).join('');
    const photoEl=t=>t.photo?`<img src="${t.photo}" class="w-11 h-11 rounded-xl object-cover bg-slate-200 dark:bg-slate-800" alt="">`:avatar(teacName(t),'w-11 h-11');
    const li=(l,v)=>`<div class="flex justify-between gap-3 py-1 border-b border-slate-100 dark:border-slate-800 last:border-0"><span class="text-[11px] font-bold text-slate-400">${l}</span><span class="text-xs font-semibold text-right">${v?escH(v):'—'}</span></div>`;
    const cards=DB.teachers.length?DB.teachers.map(t=>{
      const open=state.mgEnsOpen===t.id;
      const subChips=t.subs.length?t.subs.map(id=>`<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300 flex items-center gap-1">${getSub(id)?getSub(id).n:id}<button data-tdel="${t.id}:subs:${id}" class="text-sky-500 font-black">×</button></span>`).join(''):'<span class="text-[11px] text-slate-400">aucune matière</span>';
      const clsChips=t.cls.length?t.cls.map(id=>`<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 flex items-center gap-1">${clsLabel(id)}<button data-tdel="${t.id}:cls:${id}" class="text-slate-400 font-black">×</button></span>`).join(''):'<span class="text-[11px] text-slate-400">aucune classe</span>';
      const detail=open?`<div class="rounded-xl p-2.5 bg-slate-50 dark:bg-slate-900/60 mt-1">
           ${li('Date de naissance',t.dob)}${li('Diplôme',t.dip)}${li('Spécialité',t.spec)}${li('Contact',t.tel)}${li('Personne à prévenir',t.urgNom)}${li('Contact urgence',t.urgTel)}
         </div>`:'';
      return mgCard(
        `<div class="flex items-center gap-3">
           <button data-tview="${t.id}" class="flex items-center gap-3 flex-1 min-w-0 text-left">${photoEl(t)}<span class="min-w-0"><span class="block font-bold text-sm truncate">${escH(teacName(t))}</span><span class="block text-[11px] text-slate-500 truncate">${escH(t.spec||t.dip||'Enseignant')}</span></span></button>
           <button data-tedit="${t.id}" class="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300 grid place-items-center shrink-0" title="Modifier">${svg_(I.edit)}</button>
           ${mgDel('ens:'+t.id)}
         </div>
         ${detail}
         <div><p class="text-[11px] font-bold text-slate-400 mb-1">Matières enseignées</p><div class="flex flex-wrap gap-1.5">${subChips}</div></div>
         <div><p class="text-[11px] font-bold text-slate-400 mb-1">Classes affectées</p><div class="flex flex-wrap gap-1.5">${clsChips}</div></div>
         ${(subOptsFor(t)||clsOptsFor(t))?`<div class="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
           <p class="text-[11px] font-bold text-slate-400">Attribuer une matière et/ou une classe</p>
           <div class="grid grid-cols-2 gap-2"><select id="as_s_${t.id}" class="${MGSEL}"><option value="">Matière…</option>${subOptsFor(t)}</select><select id="as_c_${t.id}" class="${MGSEL}"><option value="">Classe…</option>${clsOptsFor(t)}</select></div>
           <button data-tassign="${t.id}" class="${MGBTN} w-full">+ Attribuer</button>
         </div>`:`<div class="pt-2 border-t border-slate-100 dark:border-slate-800"><p class="text-[11px] text-slate-400">✓ Toutes les matières et classes disponibles sont déjà attribuées.</p></div>`}`);
    }).join(''):'<p class="text-xs text-slate-400 px-1">Aucun enseignant.</p>';
    const impCard=ed?'':mgCard(
      `<p class="font-bold text-sm">Importer des enseignants <span class="text-slate-400 font-medium">(fichier Excel)</span></p>
       <p class="text-[11px] text-slate-500 leading-snug">Colonnes : nom, prenom, date_naissance, diplome, specialite, contact, personne_a_prevenir, contact_urgence. Seuls <strong>nom</strong> / <strong>prenom</strong> sont obligatoires. Formats acceptés : .xlsx, .xls (CSV aussi). Les matières/classes s'attribuent ensuite à la main.</p>
       <div class="flex gap-2">
         <label class="flex-1 cursor-pointer px-3 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-bold text-center active:scale-95 transition"><span>📊 Choisir un fichier Excel</span><input id="tea_file" type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" class="hidden"></label>
         <button data-teatpl="1" class="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200 text-xs font-bold active:scale-95 transition whitespace-nowrap">Modèle Excel</button>
       </div>`);
    return form+impCard+section(DB.teachers.length+' enseignant(s)')+`<div class="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">${cards}</div>`;
  }
  function mgProg(){
    const form=mgCard(
      `<p class="font-bold text-sm">Attribuer une matière à une classe</p>
       <div class="grid grid-cols-2 gap-2">
         <select id="pr_c" class="${MGSEL}">${DB.classes.map(c=>`<option value="${c.id}">${clsLabel(c.id)}</option>`).join('')||'<option value="">—</option>'}</select>
         <select id="pr_s" class="${MGSEL}">${DB.subjects.map(s=>`<option value="${s.id}">${s.n}</option>`).join('')||'<option value="">—</option>'}</select>
       </div>
       <div class="flex items-center gap-2">
         <span class="text-xs font-bold text-slate-500 shrink-0">Coefficient</span>
         <input id="pr_k" type="number" min="1" max="20" value="2" class="w-20 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-bold text-center outline-none">
         <div class="flex flex-wrap gap-3 ml-auto">
           <label class="flex items-center gap-2 text-xs font-semibold"><input id="pr_o" type="checkbox" checked class="w-4 h-4 accent-brand-600"> Oblig.</label>
           <label class="flex items-center gap-2 text-xs font-semibold"><input id="pr_sp" type="checkbox" class="w-4 h-4 accent-brand-600"> Spécialité</label>
         </div>
       </div>
       <button data-madd="prog" class="${MGBTN} w-full">+ Ajouter au programme</button>`);
    let body='';
    DB.classes.forEach(c=>{
      const items=DB.program.filter(p=>p.cls===c.id); if(!items.length) return;
      body+=section(clsLabel(c.id)+' · '+c.cycle)+listWrap(items.map(p=>{
        const s=getSub(p.sub); const[d,dc]=DOM[s?s.dom:'autre']||DOM.autre;
        const ekey=c.id+':'+p.sub;
        if(state.mgProgEdit===ekey){
          return `<div class="rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft card-in space-y-3 ring-2 ring-brand-400">
            <p class="text-sm font-bold truncate">${s?s.n:'—'} <span class="text-slate-400 font-medium">· ${clsLabel(c.id)}</span></p>
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-slate-500 shrink-0">Coefficient</span>
              <input id="pe_k" type="number" min="1" max="20" value="${p.coef}" class="w-20 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-bold text-center outline-none">
              <div class="flex flex-wrap gap-3 ml-auto">
                <label class="flex items-center gap-2 text-xs font-semibold"><input id="pe_o" type="checkbox" ${p.oblig?'checked':''} class="w-4 h-4 accent-brand-600"> Oblig.</label>
                <label class="flex items-center gap-2 text-xs font-semibold"><input id="pe_sp" type="checkbox" ${p.spec?'checked':''} class="w-4 h-4 accent-brand-600"> Spécialité</label>
              </div>
            </div>
            <div class="flex gap-2">
              <button data-psave="${ekey}" class="${MGBTN} flex-1 justify-center">Enregistrer</button>
              <button data-pcancel class="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200 text-xs font-bold active:scale-95 transition">Annuler</button>
            </div>
          </div>`;
        }
        return row(
          `<div class="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 grid place-items-center text-xs font-extrabold text-brand-600">${p.coef}</div>`,
          `<p class="text-sm font-semibold truncate">${s?s.n:'—'}</p><p class="text-xs text-slate-500">Coef ${p.coef} · ${p.oblig?'Obligatoire':'Facultative'}</p>`,
          `<div class="flex items-center gap-1.5">${p.spec?badge('Spécialité','bg-emerald-100 text-emerald-700'):''}${badge(d,'bg-'+dc+'-100 text-'+dc+'-700')}<button data-pedit="${ekey}" class="w-8 h-8 rounded-lg bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300 grid place-items-center shrink-0">${svg_(I.edit)}</button>${mgDel('prog:'+c.id+':'+p.sub)}</div>`);
      }).join(''));
    });
    if(!body) body='<p class="text-xs text-slate-400 px-1">Aucun programme défini.</p>';
    return form+body;
  }
