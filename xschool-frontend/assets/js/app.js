'use strict';
/* XSchool bootstrap : config ecoles, routage (renderView/renderNav), tenant, login, theme/drawer, init. */
  // ---------- SUPERADMIN : CONFIG DES CYCLES PAR ÉCOLE ----------
  const MGSEL='px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-semibold outline-none w-full';
  const MGIN='px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm outline-none w-full';
  const MGBTN='px-4 py-2.5 rounded-xl bg-brand-600 text-white text-xs font-bold whitespace-nowrap active:scale-95 transition';
  const mgDel=key=>`<button data-mdel="${key}" class="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300 grid place-items-center shrink-0">${svg_(I.trash)}</button>`;
  const mgCard=h=>`<div class="rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft card-in space-y-3">${h}</div>`;
  function schoolsConfig(){
    const s=activeSchool();
    const pills=SCHOOLS.map(x=>`<button data-school="${x.id}" class="px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap ${x.id===state.schoolId?'bg-brand-600 text-white':'bg-white dark:bg-slate-900 text-slate-500'}">${x.name}</button>`).join('');
    const toggles=CYCLE_NAMES.map(c=>{
      const on=s.cycles.includes(c);
      return `<button data-cyc="${c}" class="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 shadow-soft card-in text-left w-full">
        <div><p class="text-sm font-semibold">${c}</p><p class="text-xs text-slate-500">${CYCLES[c].length} classes types</p></div>
        <span class="w-11 h-6 rounded-full flex items-center px-0.5 transition ${on?'bg-emerald-500 justify-end':'bg-slate-300 dark:bg-slate-700 justify-start'}"><span class="w-5 h-5 rounded-full bg-white shadow block"></span></span>
      </button>`;
    }).join('');
    return `<div class="rounded-2xl p-3 bg-brand-50 dark:bg-slate-900 text-brand-700 dark:text-brand-300 text-xs font-semibold card-in flex items-center gap-2">${svg_(I.shield)} SuperAdmin — active les cycles scolaires de chaque établissement. Les administrateurs ne verront que les cycles activés ici.</div>`
      + `<div class="flex gap-2 mt-3 overflow-x-auto pb-1">${pills}</div>`
      + section('Cycles de « '+s.name+' »','<span class="text-xs text-slate-400">'+s.cycles.length+' actifs</span>')
      + `<div class="space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">${toggles}</div>`;
  }
  function wireSchools(){
    const main=$('#main');
    main.querySelectorAll('[data-school]').forEach(b=>b.addEventListener('click',()=>{ state.schoolId=b.dataset.school; renderView(); }));
    main.querySelectorAll('[data-cyc]').forEach(b=>b.addEventListener('click',()=>{
      const s=activeSchool(), c=b.dataset.cyc, i=s.cycles.indexOf(c);
      if(i>=0){ if(s.cycles.length<=1){ toast('Au moins un cycle doit rester actif'); return; } s.cycles.splice(i,1); }
      else s.cycles.push(c);
      renderView(); toast('Cycles mis à jour ✓');
    }));
  }

  function wireManage(){
    const main=$('#main');
    main.querySelectorAll('[data-mtab]').forEach(b=>b.addEventListener('click',()=>{ state.manageTab=b.dataset.mtab; renderView(); }));
    main.querySelectorAll('[data-yact]').forEach(b=>b.addEventListener('click',()=>{ state.year=b.dataset.yact; renderView(); toast('Année active : '+b.dataset.yact); }));
    main.querySelectorAll('[data-perset]').forEach(b=>b.addEventListener('click',()=>{ const [c,t]=b.dataset.perset.split('|'); setPeriodType(c,t); renderView(); toast('Périodes mises à jour ✓'); }));
    main.querySelectorAll('[data-grallow]').forEach(b=>b.addEventListener('click',()=>{ const c=b.dataset.grallow; setTeacherGrades(c,!teacherGradesAllowed(c)); renderView(); toast(teacherGradesAllowed(c)?('Saisie autorisée — '+c+' ✓'):('Saisie bloquée — '+c)); }));
    main.querySelectorAll('[data-dl]').forEach(inp=>inp.addEventListener('change',()=>{ const [c,p]=inp.dataset.dl.split('|'); setDeadline(c,p,inp.value); renderView(); toast(inp.value?('Échéance '+p+' : '+fmtDate(inp.value)):('Échéance retirée — '+p)); }));
    main.querySelectorAll('[data-suschool]').forEach(b=>b.addEventListener('click',()=>{ state.suSchool=b.dataset.suschool; renderView(); }));
    { const suR=main.querySelector('#su_role'); if(suR) suR.addEventListener('change',()=>{ state.suRole=suR.value; renderView(); }); }
    main.querySelectorAll('[data-uopen]').forEach(b=>b.addEventListener('click',()=>{ state.mgUserOpen = state.mgUserOpen===b.dataset.uopen?'':b.dataset.uopen; renderView(); }));
    main.querySelectorAll('[data-uvalid]').forEach(b=>b.addEventListener('click',()=>{ const u=USERS.find(x=>x.id===b.dataset.uvalid); if(!u) return; u.active=true; u.status='active'; u.notified=true; renderView(); toast('Compte validé ✔ — email de confirmation envoyé'); mailSentModal(u); }));
    main.querySelectorAll('[data-urefuse]').forEach(b=>b.addEventListener('click',()=>{ const u=USERS.find(x=>x.id===b.dataset.urefuse); if(!u) return; if(!confirm('Refuser et supprimer la demande de '+u.name+' ?')) return; USERS=USERS.filter(x=>x.id!==b.dataset.urefuse); renderView(); toast('Demande refusée'); }));
    main.querySelectorAll('[data-utoggle]').forEach(b=>b.addEventListener('click',()=>{ const u=USERS.find(x=>x.id===b.dataset.utoggle); if(!u) return; if(u.active&&u.role==='admin'&&USERS.filter(x=>x.role==='admin'&&x.active).length<=1){toast('Garde au moins un administrateur actif');return;} u.active=!u.active; logit(u.active?'Compte activé':'Compte désactivé',u.name+' ('+(ROLE_LABELS[u.role]||u.role)+')','warn',u.schoolId); renderView(); toast(u.active?'Compte activé ✓':'Compte désactivé'); }));
    main.querySelectorAll('[data-udel]').forEach(b=>b.addEventListener('click',()=>{ const u=USERS.find(x=>x.id===b.dataset.udel); if(!u) return; if(u.role==='admin'&&USERS.filter(x=>x.role==='admin').length<=1){toast('Impossible de supprimer le dernier administrateur');return;} USERS=USERS.filter(x=>x.id!==b.dataset.udel); renderView(); toast('Utilisateur supprimé'); }));
    main.querySelectorAll('[data-urole]').forEach(sel=>sel.addEventListener('change',()=>{ const u=USERS.find(x=>x.id===sel.dataset.urole); if(!u) return; const old=u.role; u.role=sel.value; logit('Modification de rôle',u.name+' : '+(ROLE_LABELS[old]||old)+' → '+(ROLE_LABELS[sel.value]||sel.value),'warn',u.schoolId); renderView(); toast('Rôle mis à jour → '+(ROLE_LABELS[sel.value]||sel.value)); }));
    main.querySelectorAll('[data-ureset]').forEach(b=>b.addEventListener('click',()=>{ const u=USERS.find(x=>x.id===b.dataset.ureset); if(!u) return; u.perms={}; renderView(); toast('Permissions réinitialisées au rôle ✓'); }));
    main.querySelectorAll('[data-uperm]').forEach(cb=>cb.addEventListener('change',()=>{ const [uid2,key]=cb.dataset.uperm.split('|'); const u=USERS.find(x=>x.id===uid2); if(!u) return; if(!u.perms) u.perms={}; if(cb.checked===permDefault(u.role,key)) delete u.perms[key]; else u.perms[key]=cb.checked; renderView(); }));
    const clCy=main.querySelector('#cl_cy'); if(clCy) clCy.addEventListener('change',()=>{ state.mgCycle=clCy.value; renderView(); });
    const clDip=main.querySelector('#cl_dip'); if(clDip) clDip.addEventListener('change',()=>{ state.mgDip=clDip.value; renderView(); });
    main.querySelectorAll('[data-stu]').forEach(b=>b.addEventListener('click',()=>{ state.mgStuOpen = state.mgStuOpen===b.dataset.stu?'':b.dataset.stu; renderView(); }));
    { const sy=main.querySelector('#stat_year'); if(sy) sy.addEventListener('change',()=>{ state.mgStatYear=sy.value; renderView(); }); }
    { const bp=main.querySelector('[data-bulkpromote]'); if(bp) bp.addEventListener('click',()=>{
        const src=(main.querySelector('#bp_src')||{}).value||'';
        const year=(main.querySelector('#bp_year')||{}).value||state.year;
        const dst=(main.querySelector('#bp_dst')||{}).value||'';
        const reset=!!(main.querySelector('#bp_reset')||{}).checked;
        if(!src){toast('Choisis une classe de départ');return;}
        if(src===dst){toast('Classe de départ et d\'arrivée identiques');return;}
        const moved=DB.students.filter(e=>e.cls===src);
        if(!moved.length){toast('Aucun élève dans cette classe');return;}
        moved.forEach(e=>{ const stt=reset?'Nouveau':(e.statut||'Nouveau'); setEnroll(e,year,dst,stt); e.cls=dst; e.statut=stt; e.year=year; });
        state.mgStatYear=year; renderView();
        toast(moved.length+' élève(s) transféré(s) → '+(dst?clsLabel(dst):'sortie')+' ('+year+')');
      }); }
    const elFile=main.querySelector('#el_file'); if(elFile) elFile.addEventListener('change',e=>{ const f=e.target.files&&e.target.files[0]; if(!f) return; if(f.size>8*1024*1024){toast('Image trop lourde (max 8 Mo)');return;} const r=new FileReader(); r.onload=()=>{ cropPhoto(r.result,256,d=>{ state.mgPhoto=d; renderView(); toast('Photo recadrée ✓'); }); }; r.readAsDataURL(f); });
    const clrPhoto=main.querySelector('[data-mphoto-clear]'); if(clrPhoto) clrPhoto.addEventListener('click',()=>{ state.mgPhoto=''; renderView(); });
    // Import Excel / CSV d'élèves (parsing navigateur, simulation)
    const csvFile=main.querySelector('#csv_file'); if(csvFile) csvFile.addEventListener('change',e=>{ const f=e.target.files&&e.target.files[0]; if(!f) return; if(f.size>8*1024*1024){toast('Fichier trop lourd (max 8 Mo)');return;} const target=(main.querySelector('#csv_cls')||{}).value||''; const name=(f.name||'').toLowerCase(); const isCsv=name.endsWith('.csv'); const r=new FileReader(); r.onload=()=>{ let res; if(isCsv){ res=importStudentsCSV(String(r.result||''),target); } else { res=importStudentsExcel(new Uint8Array(r.result),target); } if(res.error){toast(res.error);return;} renderView(); toast(res.added+' élève(s) importé(s) ✓'+(res.skipped?(' · '+res.skipped+' ligne(s) ignorée(s)'):'')); }; r.onerror=()=>toast('Lecture du fichier impossible'); if(isCsv) r.readAsText(f,'UTF-8'); else r.readAsArrayBuffer(f); });
    const csvTpl=main.querySelector('[data-csvtpl]'); if(csvTpl) csvTpl.addEventListener('click',downloadTemplate);
    // Deux modes d'inscription élève + édition + affectation de classe
    main.querySelectorAll('[data-stumode]').forEach(b=>b.addEventListener('click',()=>{ state.mgStuMode=b.dataset.stumode; state.mgStuEdit=''; renderView(); }));
    main.querySelectorAll('[data-medit]').forEach(b=>b.addEventListener('click',()=>{ const e=DB.students.find(x=>x.id===b.dataset.medit); if(!e) return; state.mgStuEdit=e.id; state.mgStuOpen=''; state.mgPhoto=e.photo||''; renderView(); }));
    const mCancel=main.querySelector('[data-mcancel]'); if(mCancel) mCancel.addEventListener('click',()=>{ state.mgStuEdit=''; state.mgPhoto=''; renderView(); });
    main.querySelectorAll('[data-sassign]').forEach(b=>b.addEventListener('click',()=>{ const e=DB.students.find(x=>x.id===b.dataset.sassign); if(!e) return; const sel=main.querySelector('#as_cls_'+e.id); if(typeof apiOn==='function'&&apiOn()){ const _c=sel?sel.value:''; upsertEnrollmentApi(e,state.year,_c,e.statut).then(()=>{ e.year=state.year; renderView(); toast(_c?('Affecté à '+clsLabel(_c)+' ✓'):'Retiré de sa classe (reste dans la base)'); }).catch(ex=>toast('Affectation refusée : '+((ex&&ex.message)||'erreur'))); return; } e.cls=sel?sel.value:''; setEnroll(e,state.year,e.cls,e.statut); e.year=state.year; renderView(); toast(e.cls?('Affecté à '+clsLabel(e.cls)+' ✓'):'Retiré de sa classe (reste dans la base)'); }));
    const val=id=>{const e=main.querySelector('#'+id);return e?e.value.trim():'';};
    const chk=id=>{const e=main.querySelector('#'+id);return e?e.checked:false;};
    main.querySelectorAll('[data-msave]').forEach(b=>b.addEventListener('click',()=>{ const e=DB.students.find(x=>x.id===b.dataset.msave); if(!e) return; const nom=val('el_nom'),prenom=val('el_prenom'); if(!nom&&!prenom){toast('Nom / prénom requis');return;} if(typeof apiOn==='function'&&apiOn()){ const _f={mat:val('el_mat')||e.mat,nom,prenom,dob:val('el_dob'),sexe:val('el_sexe')||'M',lieu:val('el_lieu'),pere:val('el_pere'),pereTel:val('el_peretel'),mere:val('el_mere'),mereTel:val('el_meretel'),cls:val('el_c'),statut:val('el_statut')||'Nouveau',photo:state.mgPhoto,year:state.year}; updateStudentApi(e,_f).then(()=>upsertEnrollmentApi(e,state.year,_f.cls,_f.statut)).then(()=>{ state.mgStuEdit=''; state.mgPhoto=''; renderView(); toast('Fiche élève mise à jour ✔'); }).catch(ex=>toast('Mise à jour refusée : '+((ex&&ex.message)||'erreur'))); return; } e.mat=val('el_mat')||e.mat; e.nom=nom; e.prenom=prenom; e.dob=val('el_dob'); e.sexe=val('el_sexe')||'M'; e.lieu=val('el_lieu'); e.pere=val('el_pere'); e.pereTel=val('el_peretel'); e.mere=val('el_mere'); e.mereTel=val('el_meretel'); e.cls=val('el_c'); e.st=val('el_s'); e.statut=val('el_statut')||'Nouveau'; e.photo=state.mgPhoto; setEnroll(e,state.year,e.cls,e.statut); e.year=state.year; state.mgStuEdit=''; state.mgPhoto=''; renderView(); toast('Fiche élève mise à jour ✔'); }));
    main.querySelectorAll('[data-madd]').forEach(b=>b.addEventListener('click',()=>{
      const k=b.dataset.madd;
      if(k==='eleves'){ const nom=val('el_nom'),prenom=val('el_prenom'); if(!nom&&!prenom){toast('Nom / prénom requis');return;} const mat=val('el_mat')||('2026-'+String(1000+Math.floor(Math.random()*9000))); if(typeof apiOn==='function'&&apiOn()){ const _f={mat,nom,prenom,dob:val('el_dob'),sexe:val('el_sexe')||'M',lieu:val('el_lieu'),pere:val('el_pere'),pereTel:val('el_peretel'),mere:val('el_mere'),mereTel:val('el_meretel'),cls:val('el_c'),statut:val('el_statut')||'Nouveau',photo:state.mgPhoto,year:state.year}; createStudentApi(_f).then(()=>{ state.mgPhoto=''; renderView(); toast(_f.cls?('Élève inscrit dans '+clsLabel(_f.cls)+' ✓'):'Élève ajouté à la base ✓'); }).catch(ex=>toast('Création refusée : '+((ex&&ex.message)||'erreur'))); return; } DB.students.push({id:uid('e'),mat,nom,prenom,dob:val('el_dob'),sexe:val('el_sexe')||'M',lieu:val('el_lieu'),pere:val('el_pere'),pereTel:val('el_peretel'),mere:val('el_mere'),mereTel:val('el_meretel'),cls:val('el_c'),st:val('el_s'),statut:val('el_statut')||'Nouveau',photo:state.mgPhoto}); const _ne=DB.students[DB.students.length-1]; _ne.year=state.year; _ne.enrollments=[{year:state.year,cls:_ne.cls,statut:_ne.statut}]; state.mgPhoto=''; toast(val('el_c')?('Élève inscrit dans '+clsLabel(val('el_c'))+' ✓'):'Élève ajouté à la base de l\'école ✓ (à affecter à une classe)'); }
      else if(k==='classes'){ const cy=val('cl_cy'); let payload; if(cy==='Cycle Professionnel'){ const dip=val('cl_dip')||'CAP', lv=val('cl_lv')||'1', sp=val('cl_sp'); if(!sp){toast('Sélectionne une filière');return;} payload={cycle:cy,name:dip+lv+' '+sp,grp:val('cl_g'),spec:dip+' · '+sp}; } else { const n=val('cl_n'); if(!n){toast('Nom de classe requis');return;} payload={cycle:cy,name:n,grp:val('cl_g'),spec:''}; } if(typeof apiOn==='function'&&apiOn()){ createClassApi(payload).then(()=>{ renderView(); toast('Classe créée ✓'); }).catch(ex=>toast('Création refusée : '+((ex&&ex.message)||'erreur'))); return; } DB.classes.push(Object.assign({id:uid('c')},payload)); toast('Classe créée ✓'); }
      else if(k==='ens'){ const nom=val('en_nom'),prenom=val('en_prenom'); if(!nom&&!prenom){toast('Nom / prénom requis');return;} if(typeof apiOn==='function'&&apiOn()){ const _f={nom,prenom,dob:val('en_dob'),dip:val('en_dip'),spec:val('en_spec'),tel:val('en_tel'),urgNom:val('en_urgn'),urgTel:val('en_urgt'),photo:state.mgEnsPhoto,subs:[],cls:[]}; createTeacherApi(_f).then(()=>{ state.mgEnsPhoto=''; renderView(); toast('Enseignant ajouté ✓'); }).catch(ex=>toast('Création refusée : '+((ex&&ex.message)||'erreur'))); return; } DB.teachers.push({id:uid('t'),n:((nom+' '+prenom).trim()),nom,prenom,dob:val('en_dob'),dip:val('en_dip'),spec:val('en_spec'),tel:val('en_tel'),urgNom:val('en_urgn'),urgTel:val('en_urgt'),photo:state.mgEnsPhoto,subs:[],cls:[]}); state.mgEnsPhoto=''; toast('Enseignant ajouté ✓'); }
      else if(k==='mat'){ const n=val('ma_n'); if(!n){toast('Nom requis');return;} if(typeof apiOn==='function'&&apiOn()){ createSubjectApi({n,dom:val('ma_d')||'autre'}).then(()=>{ renderView(); toast('Matière créée ✓'); }).catch(ex=>toast('Création refusée : '+((ex&&ex.message)||'erreur'))); return; } DB.subjects.push({id:uid('s'),n,dom:val('ma_d')||'autre'}); toast('Matière créée ✓'); }
      else if(k==='prog'){ const cls=val('pr_c'),sub=val('pr_s'); if(!cls||!sub){toast('Classe et matière requises');return;} if(DB.program.some(p=>p.cls===cls&&p.sub===sub)){toast('Déjà au programme');return;} if(typeof apiOn==='function'&&apiOn()){ saveProgramApi(cls,sub,{coef:+val('pr_k')||1,oblig:chk('pr_o'),spec:chk('pr_sp')}).then(()=>{ renderView(); toast('Ajouté au programme ✓'); }).catch(ex=>toast('Ajout refusé : '+((ex&&ex.message)||'erreur'))); return; } DB.program.push({cls,sub,coef:+val('pr_k')||1,oblig:chk('pr_o'),spec:chk('pr_sp')}); toast('Ajouté au programme ✓'); }
      else if(k==='year'){ const y=val('yr_n'); if(!/^\d{4}-\d{4}$/.test(y)){toast('Format attendu : AAAA-AAAA');return;} if(YEARS.includes(y)){toast('Cette année existe déjà');return;} YEARS.push(y); YEARS.sort(); toast('Année ajoutée ✓'); }
      else if(k==='user'){ const n=val('us_n'); if(!n){toast('Nom requis');return;} const r=val('us_r')||'teacher'; const sid=(state.role==='super'&&state.suSchool!=='all')?state.suSchool:state.schoolId; USERS.push({id:uid('u'),name:n,email:val('us_e'),role:r,active:true,status:'active',schoolId:sid,perms:{}}); logit('Création utilisateur',n+' ('+(ROLE_LABELS[r]||r)+')','ok',sid); toast('Utilisateur créé ✓'); }
      renderView();
    }));
    // --- Enseignants : photo, fiche, édition ---
    const enFile=main.querySelector('#en_file'); if(enFile) enFile.addEventListener('change',e=>{ const f=e.target.files&&e.target.files[0]; if(!f) return; if(f.size>8*1024*1024){toast('Image trop lourde (max 8 Mo)');return;} const r=new FileReader(); r.onload=()=>{ cropPhoto(r.result,256,d=>{ state.mgEnsPhoto=d; renderView(); toast('Photo recadrée ✓'); }); }; r.readAsDataURL(f); });
    const enClr=main.querySelector('[data-tphoto-clear]'); if(enClr) enClr.addEventListener('click',()=>{ state.mgEnsPhoto=''; renderView(); });
    const teaFile=main.querySelector('#tea_file'); if(teaFile) teaFile.addEventListener('change',e=>{ const f=e.target.files&&e.target.files[0]; if(!f) return; if(f.size>8*1024*1024){toast('Fichier trop lourd (max 8 Mo)');return;} const name=(f.name||'').toLowerCase(); const isCsv=name.endsWith('.csv'); const r=new FileReader(); r.onload=()=>{ let res; if(isCsv){ res=importTeachersCSV(String(r.result||'')); } else { res=importTeachersExcel(new Uint8Array(r.result)); } if(res.error){toast(res.error);return;} renderView(); toast(res.added+' enseignant(s) importé(s) ✓'+(res.skipped?(' · '+res.skipped+' ligne(s) ignorée(s)'):'')); }; r.onerror=()=>toast('Lecture du fichier impossible'); if(isCsv) r.readAsText(f,'UTF-8'); else r.readAsArrayBuffer(f); });
    const teaTpl=main.querySelector('[data-teatpl]'); if(teaTpl) teaTpl.addEventListener('click',downloadTeacherTemplate);
    main.querySelectorAll('[data-tview]').forEach(b=>b.addEventListener('click',()=>{ state.mgEnsOpen = state.mgEnsOpen===b.dataset.tview?'':b.dataset.tview; renderView(); }));
    main.querySelectorAll('[data-tedit]').forEach(b=>b.addEventListener('click',()=>{ const t=DB.teachers.find(x=>x.id===b.dataset.tedit); if(!t) return; state.mgEnsEdit=t.id; state.mgEnsOpen=''; state.mgEnsPhoto=t.photo||''; renderView(); }));
    const tCancel=main.querySelector('[data-tcancel]'); if(tCancel) tCancel.addEventListener('click',()=>{ state.mgEnsEdit=''; state.mgEnsPhoto=''; renderView(); });
    main.querySelectorAll('[data-tsave]').forEach(b=>b.addEventListener('click',()=>{ const t=DB.teachers.find(x=>x.id===b.dataset.tsave); if(!t) return; const nom=val('en_nom'),prenom=val('en_prenom'); if(!nom&&!prenom){toast('Nom / prénom requis');return;} if(typeof apiOn==='function'&&apiOn()){ const _f={nom,prenom,dob:val('en_dob'),dip:val('en_dip'),spec:val('en_spec'),tel:val('en_tel'),urgNom:val('en_urgn'),urgTel:val('en_urgt'),photo:state.mgEnsPhoto,subs:t.subs.slice(),cls:t.cls.slice()}; updateTeacherApi(t,_f).then(()=>{ state.mgEnsEdit=''; state.mgEnsPhoto=''; renderView(); toast('Fiche enseignant mise à jour ✔'); }).catch(ex=>toast('Mise à jour refusée : '+((ex&&ex.message)||'erreur'))); return; } t.nom=nom; t.prenom=prenom; t.n=((nom+' '+prenom).trim())||t.n; t.dob=val('en_dob'); t.dip=val('en_dip'); t.spec=val('en_spec'); t.tel=val('en_tel'); t.urgNom=val('en_urgn'); t.urgTel=val('en_urgt'); t.photo=state.mgEnsPhoto; state.mgEnsEdit=''; state.mgEnsPhoto=''; renderView(); toast('Fiche enseignant mise à jour ✔'); }));
    main.querySelectorAll('[data-tassign]').forEach(b=>b.addEventListener('click',()=>{
      const t=DB.teachers.find(x=>x.id===b.dataset.tassign); if(!t) return;
      const s=val('as_s_'+t.id), c=val('as_c_'+t.id);
      if(!s&&!c){ toast('Choisis une matière ou une classe'); return; }
      if(typeof apiOn==='function'&&apiOn()){ const _subs=t.subs.slice(),_cls=t.cls.slice(); if(s&&!_subs.includes(s))_subs.push(s); if(c&&!_cls.includes(c))_cls.push(c); updateTeacherApi(t,{nom:t.nom,prenom:t.prenom,dob:t.dob,dip:t.dip,spec:t.spec,tel:t.tel,urgNom:t.urgNom,urgTel:t.urgTel,photo:t.photo,subs:_subs,cls:_cls}).then(()=>{ renderView(); toast('Attribution enregistrée ✓'); }).catch(ex=>toast('Attribution refusée : '+((ex&&ex.message)||'erreur'))); return; }
      if(s&&!t.subs.includes(s)) t.subs.push(s);
      if(c&&!t.cls.includes(c)) t.cls.push(c);
      renderView(); toast('Attribution enregistrée ✓');
    }));
    main.querySelectorAll('[data-tdel]').forEach(b=>b.addEventListener('click',()=>{
      const p=b.dataset.tdel.split(':'); const t=DB.teachers.find(x=>x.id===p[0]); if(!t) return;
      if(typeof apiOn==='function'&&apiOn()){ const _subs=(p[1]==='subs'?t.subs.filter(x=>x!==p[2]):t.subs.slice()); const _cls=(p[1]==='cls'?t.cls.filter(x=>x!==p[2]):t.cls.slice()); updateTeacherApi(t,{nom:t.nom,prenom:t.prenom,dob:t.dob,dip:t.dip,spec:t.spec,tel:t.tel,urgNom:t.urgNom,urgTel:t.urgTel,photo:t.photo,subs:_subs,cls:_cls}).then(()=>renderView()).catch(ex=>toast('Suppression refusée : '+((ex&&ex.message)||'erreur'))); return; }
      t[p[1]]=t[p[1]].filter(x=>x!==p[2]); renderView();
    }));
    main.querySelectorAll('[data-pedit]').forEach(b=>b.addEventListener('click',()=>{ state.mgProgEdit=b.dataset.pedit; renderView(); }));
    { const pc=main.querySelector('[data-pcancel]'); if(pc) pc.addEventListener('click',()=>{ state.mgProgEdit=''; renderView(); }); }
    main.querySelectorAll('[data-psave]').forEach(b=>b.addEventListener('click',()=>{
      const [cls,sub]=b.dataset.psave.split(':'); const pr=DB.program.find(p=>p.cls===cls&&p.sub===sub); if(!pr){ state.mgProgEdit=''; renderView(); return; }
      if(typeof apiOn==='function'&&apiOn()){ const ki=main.querySelector('#pe_k'); let k=parseInt(ki&&ki.value,10); if(isNaN(k)||k<1)k=1; if(k>20)k=20; const oi=main.querySelector('#pe_o'); const si=main.querySelector('#pe_sp'); saveProgramApi(cls,sub,{coef:k,oblig:oi?oi.checked:pr.oblig,spec:si?si.checked:pr.spec}).then(()=>{ state.mgProgEdit=''; renderView(); toast('Programme mis à jour ✔'); }).catch(ex=>toast('Mise à jour refusée : '+((ex&&ex.message)||'erreur'))); return; }
      const ki=main.querySelector('#pe_k'); let k=parseInt(ki&&ki.value,10); if(isNaN(k)||k<1) k=1; if(k>20) k=20; pr.coef=k;
      const oi=main.querySelector('#pe_o'); pr.oblig=oi?oi.checked:pr.oblig;
      const si=main.querySelector('#pe_sp'); pr.spec=si?si.checked:pr.spec;
      state.mgProgEdit=''; renderView(); toast('Programme mis à jour ✔');
    }));
    main.querySelectorAll('[data-mdel]').forEach(b=>b.addEventListener('click',()=>{
      const p=b.dataset.mdel.split(':'); const k=p[0];
      if(k==='eleves'){ const _e=DB.students.find(e=>e.id===p[1]); if(typeof apiOn==='function'&&apiOn()&&_e){ deleteStudentApi(_e).then(()=>{ renderView(); toast('Supprimé'); }).catch(ex=>toast('Suppression refusée : '+((ex&&ex.message)||'erreur'))); return; } DB.students=DB.students.filter(e=>e.id!==p[1]); }
      else if(k==='classes'){ if(DB.students.some(e=>e.cls===p[1])&&!confirm('Des élèves sont inscrits dans cette classe. Supprimer quand même ?')) return; const _cleanup=()=>{ DB.classes=DB.classes.filter(c=>c.id!==p[1]); DB.program=DB.program.filter(pr=>pr.cls!==p[1]); DB.teachers.forEach(t=>t.cls=t.cls.filter(x=>x!==p[1])); DB.students.forEach(e=>{ if(e.cls===p[1]) e.cls=''; }); }; if(typeof apiOn==='function'&&apiOn()){ const _c=DB.classes.find(c=>c.id===p[1]); deleteClassApi(_c).then(()=>{ _cleanup(); renderView(); toast('Supprimé'); }).catch(ex=>toast('Suppression refusée : '+((ex&&ex.message)||'erreur'))); return; } _cleanup(); }
      else if(k==='ens'){ const _t=DB.teachers.find(t=>t.id===p[1]); if(typeof apiOn==='function'&&apiOn()&&_t){ deleteTeacherApi(_t).then(()=>{ renderView(); toast('Supprimé'); }).catch(ex=>toast('Suppression refusée : '+((ex&&ex.message)||'erreur'))); return; } DB.teachers=DB.teachers.filter(t=>t.id!==p[1]); }
      else if(k==='mat'){ const _s=DB.subjects.find(s=>s.id===p[1]); if(typeof apiOn==='function'&&apiOn()&&_s){ deleteSubjectApi(_s).then(()=>{ DB.program=DB.program.filter(pr=>pr.sub!==p[1]); DB.teachers.forEach(t=>t.subs=t.subs.filter(x=>x!==p[1])); renderView(); toast('Supprimé'); }).catch(ex=>toast('Suppression refusée : '+((ex&&ex.message)||'erreur'))); return; } DB.subjects=DB.subjects.filter(s=>s.id!==p[1]); DB.program=DB.program.filter(pr=>pr.sub!==p[1]); DB.teachers.forEach(t=>t.subs=t.subs.filter(x=>x!==p[1])); }
      else if(k==='prog'){ const _pr=DB.program.find(pr=>pr.cls===p[1]&&pr.sub===p[2]); if(typeof apiOn==='function'&&apiOn()&&_pr){ deleteProgramApi(_pr).then(()=>{ renderView(); toast('Supprimé'); }).catch(ex=>toast('Suppression refusée : '+((ex&&ex.message)||'erreur'))); return; } DB.program=DB.program.filter(pr=>!(pr.cls===p[1]&&pr.sub===p[2])); }
      else if(k==='year'){ if(YEARS.length<=1){toast('Au moins une année requise');return;} YEARS.splice(YEARS.indexOf(p[1]),1); if(state.year===p[1]) state.year=YEARS[YEARS.length-1]; }
      renderView(); toast('Supprimé');
    }));
  }

  function renderView(){
    const v=state.view;
    let html;
    if(v==='dash') html=dash(state.role);
    else if(v==='classes') html=classes();
    else if(v==='students') html=students();
    else if(v==='manage') html=manage();
    else if(v==='notify') html=notify();
    else if(v==='schools') html=schoolsConfig();
    else if(v==='grades') html=grades();
    else if(v==='finance') html=finance();
    else if(v==='timetable') html=timetable();
    else if(v==='attendance') html=attendance();
    else if(v==='pointage') html=pointage();
    else if(v==='myhours') html=myhours();
    else if(v==='bulletin') html=bulletin();
    else if(v==='bulletins') html=bulletinsAdmin();
    else if(v==='cartes') html=cartesAdmin();
    else if(v==='feuilles') html=feuillesAdmin();
    else if(v==='stats') html=statsAdmin();
    else if(v==='settings') html=settings();
    else if(v==='appel') html=appel();
    else if(v==='discipline') html=discipline();
    else if(v==='absences') html=absences();
    else if(v==='absstats') html=absStats();
    else if(v==='payments') html=payments();
    else if(v==='schedules') html=schedules();
    else if(v==='reports') html=reports();
    else if(v==='users') html=superUsers();
    else if(v==='logs') html=logs();
    else html=generic(v);
    const main=$('#main'); main.innerHTML=html; main.classList.remove('fade'); void main.offsetWidth; main.classList.add('fade');
    $('#viewTitle').textContent = NAV[v].t;
    syncYear();
    const c=document.getElementById('chart'); if(c) initChart(c);
    main.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
    main.querySelectorAll('[data-albflt]').forEach(b=>b.addEventListener('click',()=>{ state.alBannerCls=b.dataset.albflt; renderView(); }));
    main.querySelectorAll('[data-albread]').forEach(b=>b.addEventListener('click',()=>{
      const flt=b.dataset.albread;
      const clsOf=a=>{ const e=DB.students.find(s=>s.id===a.stu); return e&&e.cls?e.cls:''; };
      let cnt=0;
      ALERTS.forEach(a=>{ if(a&&a.auto&&a.kind==='absence'&&!a.read&&(flt==='all'||clsOf(a)===flt)){ a.read=true; cnt++; } });
      if(cnt){ logit('Alertes marquées comme lues',(flt==='all'?'Toutes classes':clsLabel(flt))+' · '+cnt+' alerte(s)','info'); toast(cnt+' alerte(s) marquée(s) comme lue(s)'); }
      state.alBannerCls='all'; renderView();
    }));
    main.querySelectorAll('[data-albarch]').forEach(b=>b.addEventListener('click',()=>{
      if(typeof ABS_ALERT_AUTO_ARCHIVE==='undefined') return;
      ABS_ALERT_AUTO_ARCHIVE=!ABS_ALERT_AUTO_ARCHIVE;
      if(ABS_ALERT_AUTO_ARCHIVE&&typeof archiveOldAlerts==='function') archiveOldAlerts();
      toast('Archivage auto '+(ABS_ALERT_AUTO_ARCHIVE?'activé':'désactivé'));
      renderView();
    }));
    if(v==='timetable') wireTimetable();
    if(v==='students') wireStudents();
    if(v==='manage') wireManage();
    if(v==='notify') wireNotify();
    if(v==='schools') wireSchools();
    if(v==='grades') wireGrades();
    if(v==='classes') wireClasses();
    if(v==='payments') wirePayments();
    if(v==='bulletins') wireBulletins();
    if(v==='cartes') wireCartes();
    if(v==='feuilles') wireFeuilles();
    if(v==='stats') wireStats();
    if(v==='settings') wireSettings();
    if(v==='users') wireManage();
    if(v==='logs') wireLogs();
    if(v==='appel') wireAppel();
    if(v==='discipline') wireDiscipline();
    if(v==='absences') wireAbsences();
    if(v==='absstats') wireAbsStats();
  }

  function syncYear(){
    const sel=$('#yearPick'); if(!sel) return;
    if(!YEARS.includes(state.year)) state.year=YEARS[YEARS.length-1];
    const canYear = state.role==='admin'||state.role==='super';
    sel.innerHTML=YEARS.map(y=>`<option value="${y}"${y===state.year?' selected':''}>${y}</option>`).join('');
    sel.disabled=!canYear;
    sel.title = canYear?'Année scolaire active (modifiable par l\'administration)':'Année scolaire active (définie par l\'administration)';
    sel.classList.toggle('cursor-pointer',canYear);
    sel.classList.toggle('pointer-events-none',!canYear);
    sel.classList.toggle('opacity-80',!canYear);
    sel.onchange = canYear ? (()=>{ state.year=sel.value; renderView(); toast('Année active : '+sel.value); }) : null;
  }

  function initChart(c){
    const dark=document.documentElement.classList.contains('dark');
    const grid=dark?'rgba(255,255,255,.08)':'rgba(0,0,0,.06)', tick=dark?'#94a3b8':'#64748b';
    new Chart(c,{type:'bar',data:{labels:['Coll.','Lyc.','Indus.','Pro'],
      datasets:[{label:'Effectif',data:[420,560,168,100],borderRadius:8,
        backgroundColor:['#17304b','#244a73','#3f6fa3','#9bb9d8']}]},
      options:{plugins:{legend:{display:false}},scales:{y:{grid:{color:grid},ticks:{color:tick}},x:{grid:{display:false},ticks:{color:tick}}}}});
  }

  function renderNav(){
    const r=ROLES[state.role];
    // bottom nav (max 5)
    const bi=$('#bottomItems'); bi.innerHTML=''; bi.style.gridTemplateColumns='repeat('+r.nav.length+',minmax(0,1fr))';
    r.nav.forEach(k=>{
      const b=el('button','relative flex flex-col items-center gap-1 py-1.5 text-[10px] font-semibold');
      const active=state.view===k;
      b.innerHTML=`<span class="w-6 h-6 ${active?'text-brand-600':'text-slate-400'}">${svg(NAV[k].i)}</span><span class="${active?'text-brand-600':'text-slate-400'}">${NAV[k].t}</span>`;
      b.addEventListener('click',()=>go(k)); bi.appendChild(b);
    });
    // drawer nav
    const dn=$('#drawerNav'); dn.innerHTML='';
    r.nav.forEach(k=>{
      const active=state.view===k;
      const a=el('button',`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl ${active?'bg-brand-600 text-white shadow-glow':'hover:bg-slate-100 dark:hover:bg-slate-800'}`);
      a.innerHTML=`<span class="w-5 h-5">${svg(NAV[k].i)}</span><span class="font-semibold">${NAV[k].t}</span>`;
      a.addEventListener('click',()=>{go(k);closeDrawer();}); dn.appendChild(a);
    });
    $('#drawerUser').textContent=r.name; $('#drawerRole').textContent=r.tag;
    { const ds=$('#drawerSchool'); if(ds){ const sc=activeSchool(); ds.textContent=sc.name; ds.title=sc.name+' · '+sc.code; } }
    $('#roleTag').textContent=r.tag;
    $('#chipName').textContent=r.name; $('#chipRole').textContent=r.tag;
    const dotHtml=`<span class="w-4 h-4">${svg(r.icon)}</span>`;
    $('#chipDot').className=`w-8 h-8 rounded-xl grid place-items-center text-white ${r.badge}`; $('#chipDot').innerHTML=dotHtml;
    $('#drawerDot').className=`w-9 h-9 rounded-xl grid place-items-center text-white shrink-0 ${r.badge}`; $('#drawerDot').innerHTML=dotHtml;
  }

  // ---------- SÉLECTION D'ÉTABLISSEMENT (SOUS-DOMAINE) ----------
  function renderTenant(){
    const cards=SCHOOLS.map(s=>`
      <button data-tenant="${s.slug}" class="group text-left rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft hover:-translate-y-0.5 transition border border-slate-200/70 dark:border-slate-800 hover:border-brand-300 card-in flex items-center gap-3">
        <span class="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300 grid place-items-center font-extrabold shrink-0">${s.name.charAt(0)}</span>
        <span class="min-w-0 flex-1"><span class="block font-bold truncate">${s.name}</span><span class="block text-xs text-brand-600 dark:text-brand-300 font-semibold truncate">${s.slug}.xschool.io</span></span>
        <span class="text-[11px] text-slate-400 font-mono shrink-0">${s.code}</span>
        <span class="text-brand-500 opacity-0 group-hover:opacity-100 transition shrink-0">→</span>
      </button>`).join('');
    $('#tenant').innerHTML = `
    <div class="min-h-screen flex flex-col">
      <header class="sticky top-0 z-30 backdrop-blur bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800">
        <div class="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-brand-600 text-white grid place-items-center font-extrabold">X</div>
            <div><p class="font-extrabold leading-none">XSchool</p><p class="text-[11px] text-slate-500">Plateforme multi-établissements</p></div>
          </div>
          <button id="tenantThemeBtn" class="w-9 h-9 grid place-items-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            <svg id="tMoon" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z"/></svg>
            <svg id="tSun" class="w-5 h-5 hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/></svg>
          </button>
        </div>
      </header>
      <main class="flex-1 grid place-items-center px-5 py-10">
        <div class="w-full max-w-md">
          <div class="text-center mb-6 card-in">
            <h1 class="text-2xl lg:text-3xl font-extrabold">Accède à ton établissement</h1>
            <p class="text-sm text-slate-500 mt-2">Saisis l'adresse de ton école pour ouvrir son espace.</p>
          </div>
          <div class="bg-white dark:bg-slate-900 rounded-3xl shadow-soft border border-slate-200/70 dark:border-slate-800 p-6 card-in">
            <form id="tenantForm">
              <label class="block text-xs font-semibold text-slate-500 mb-1">Adresse de l'établissement</label>
              <div class="flex items-stretch rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 overflow-hidden focus-within:border-brand-400">
                <span class="px-3 grid place-items-center text-xs text-slate-400 bg-slate-100 dark:bg-slate-700/50 select-none">https://</span>
                <input id="tenantInput" class="flex-1 min-w-0 bg-transparent px-2 py-2.5 text-sm font-semibold outline-none" placeholder="ltm" autocomplete="off" spellcheck="false">
                <span class="px-3 grid place-items-center text-xs text-slate-400 bg-slate-100 dark:bg-slate-700/50 select-none">.xschool.io</span>
              </div>
              <p id="tenantErr" class="hidden text-xs font-semibold text-rose-500 mt-2"></p>
              <button type="submit" class="mt-4 w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold transition active:scale-95">Continuer →</button>
            </form>
          </div>
          <div class="mt-6 card-in">
            <p class="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 px-1">Établissements enregistrés</p>
            <div class="space-y-2">${cards}</div>
          </div>
          <p class="text-[11px] text-slate-400 mt-6 text-center">Prototype — chaque école possède son propre sous-domaine (espace isolé).</p>
        </div>
      </main>
    </div>`;
    const resolve=slug=>{ slug=(slug||'').trim().toLowerCase().replace(/^https?:\/\//,'').replace(/\.xschool\.io.*$/,'').replace(/[^a-z0-9-]/g,''); return SCHOOLS.find(s=>s.slug===slug); };
    const form=$('#tenantForm'); if(form) form.addEventListener('submit',e=>{ e.preventDefault(); const sc=resolve($('#tenantInput').value); const err=$('#tenantErr'); if(!sc){ err.textContent='Établissement introuvable. Vérifie l\'adresse (ex : ltm.xschool.io).'; err.classList.remove('hidden'); return; } err.classList.add('hidden'); setTenant(sc.id); });
    $('#tenant').querySelectorAll('[data-tenant]').forEach(b=>b.addEventListener('click',()=>{ const sc=resolve(b.dataset.tenant); if(sc) setTenant(sc.id); }));
    const tt=$('#tenantThemeBtn'); if(tt) tt.addEventListener('click',()=>{ const d=!document.documentElement.classList.contains('dark'); applyTheme(d); });
  }
  function setTenant(sid){
    const sc=SCHOOLS.find(s=>s.id===sid)||SCHOOLS[0];
    state.schoolId=sc.id; state.tenant=sc.slug; state.screen='login';
    try{ location.hash=sc.slug; }catch(e){}
    $('#tenant').classList.add('hidden'); $('#login').classList.remove('hidden');
    renderLogin(); window.scrollTo(0,0);
  }
  function backToTenant(){
    state.tenant=''; state.screen='tenant';
    try{ location.hash=''; }catch(e){}
    $('#login').classList.add('hidden'); $('#tenant').classList.remove('hidden');
    renderTenant(); window.scrollTo(0,0);
  }

  // ---------- LOGIN / SÉLECTION D'ESPACE ----------
  function renderLogin(){
    const stats=[['12','Établissements'],['1 240','Élèves'],['98%','Présence'],['24/7','Cloud']];
    const miniStats=stats.map(s=>`<div><p class="text-2xl font-extrabold text-brand-700 dark:text-brand-300">${s[0]}</p><p class="text-xs text-slate-500">${s[1]}</p></div>`).join('');
    const signupClsOpts=DB.classes.filter(c=>activeCycles().includes(c.cycle)).map(c=>`<option value="${c.id}">${clsLabel(c.id)} · ${c.cycle}</option>`).join('')||'<option value="">—</option>';
    const schoolOpts=SCHOOLS.map(s=>`<option value="${s.id}" ${s.id===state.schoolId?'selected':''}>${s.name} — ${s.code}</option>`).join('');
    const clsOptsForSchool=sid=>{ const sc=SCHOOLS.find(x=>x.id===sid)||SCHOOLS[0]; const cy=sc.cycles.filter(c=>CYCLES[c]); return DB.classes.filter(c=>cy.includes(c.cycle)).map(c=>`<option value="${c.id}">${clsLabel(c.id)} · ${c.cycle}</option>`).join('')||'<option value="">— Aucune classe</option>'; };
    const cards = Object.entries(ROLES).map(([k,v])=>`
      <button data-role="${k}" class="group text-left rounded-2xl p-5 bg-white dark:bg-slate-900 shadow-soft hover:-translate-y-1 transition border border-slate-200/70 dark:border-slate-800 hover:border-brand-300 card-in">
        <div class="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300 p-2.5 mb-3">${svg(v.icon)}</div>
        <p class="font-bold">${v.tag}</p>
        <p class="text-xs text-slate-500 mt-1 leading-snug">${v.desc}</p>
        <p class="text-[11px] text-brand-600 dark:text-brand-300 font-semibold mt-3 opacity-0 group-hover:opacity-100 transition">Utiliser cet e-mail →</p>
      </button>`).join('');
    $('#login').innerHTML = `
    <div class="min-h-screen flex flex-col">
      <header class="sticky top-0 z-30 backdrop-blur bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800">
        <div class="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-brand-600 text-white grid place-items-center font-extrabold">X</div>
            <div><p class="font-extrabold leading-none">XSchool</p><p class="text-[11px] text-slate-500">Gestion scolaire</p></div>
          </div>
          <div class="flex items-center gap-2">
            <a href="#espaces" class="hidden sm:inline text-sm font-semibold text-slate-600 dark:text-slate-300 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">Les espaces</a>
            <button id="landThemeBtn" class="w-9 h-9 grid place-items-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <svg id="landMoon" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z"/></svg>
              <svg id="landSun" class="w-5 h-5 hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/></svg>
            </button>
          </div>
        </div>
      </header>
      <main class="flex-1">
        <section class="max-w-6xl mx-auto px-5 py-10 lg:py-16 grid lg:grid-cols-2 gap-10 items-center">
          <div class="card-in">
            <span class="inline-flex items-center gap-2 text-xs font-semibold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-500/15 px-3 py-1 rounded-full">Plateforme EMS • mobile-first</span>
            <h1 class="text-3xl lg:text-5xl font-extrabold leading-tight mt-4">La gestion scolaire,<br><span class="text-brand-700 dark:text-brand-300">claire et unifiée.</span></h1>
            <p class="text-slate-500 mt-4 max-w-md">Notes, bulletins, emplois du temps, pointage des enseignants et scolarité — un espace dédié pour chaque profil, du directeur au parent.</p>
            <div class="grid grid-cols-4 gap-4 mt-8 max-w-md">${miniStats}</div>
          </div>
          <div class="card-in">
           <div id="loginCard" class="bg-white dark:bg-slate-900 rounded-3xl shadow-soft border border-slate-200/70 dark:border-slate-800 p-6 lg:p-8">
            <h2 class="text-lg font-extrabold">Connexion</h2>
            <p class="text-xs text-slate-500 mb-5">Accède à ton espace de travail.</p>
            <form id="loginForm" class="space-y-4">
              <div class="flex items-center gap-3 p-3 rounded-xl bg-brand-50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/20">
                <span class="w-9 h-9 rounded-lg bg-brand-600 text-white grid place-items-center font-extrabold shrink-0">${activeSchool().name.charAt(0)}</span>
                <div class="min-w-0 flex-1"><p class="text-sm font-bold truncate">${activeSchool().name}</p><p class="text-[11px] text-brand-600 dark:text-brand-300 font-semibold truncate">${activeSchool().slug}.xschool.io</p></div>
                <button id="switchTenant" type="button" class="text-[11px] font-bold text-brand-600 dark:text-brand-300 shrink-0">Changer</button>
              </div>
              <label class="block"><span class="text-xs font-semibold text-slate-500">Adresse e-mail</span>
                <input id="loginEmail" type="email" class="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm outline-none focus:border-brand-400" placeholder="exemple@xschool.io"></label>
              <label class="block"><span class="text-xs font-semibold text-slate-500">Mot de passe</span>
                <input id="loginPass" type="password" class="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm outline-none focus:border-brand-400" placeholder="••••••••"></label>
              <div class="flex items-center justify-between text-xs">
                <label class="flex items-center gap-2 text-slate-500"><input type="checkbox" class="rounded"> Se souvenir</label>
                <button id="toReset" type="button" class="text-brand-600 dark:text-brand-300 font-semibold">Mot de passe oublié ?</button>
              </div>
              <p id="loginErr" class="hidden text-xs font-semibold text-rose-500"></p>
              <button type="submit" class="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold transition active:scale-95">Se connecter</button>
            </form>
            <p class="text-[11px] text-slate-400 mt-4 text-center">Ton espace est déterminé par ton e-mail. Démo : mot de passe libre.</p>
            <div class="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-center text-sm">
              <span class="text-slate-500">Nouvel élève / parent ?</span>
              <button id="toSignup" type="button" class="font-bold text-brand-600 dark:text-brand-300 ml-1">Créer mon compte</button>
            </div>
           </div>
           <div id="signupCard" class="hidden bg-white dark:bg-slate-900 rounded-3xl shadow-soft border border-slate-200/70 dark:border-slate-800 p-6 lg:p-8">
            <h2 class="text-lg font-extrabold">Créer mon compte élève</h2>
            <p class="text-xs text-slate-500 mb-4">Ton compte sera activé par l'administration après vérification.</p>
            <button id="gLink" type="button" class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition">
              <svg class="w-4 h-4" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 .5 24 .5 14.6 .5 6.5 5.9 2.6 13.7l7.8 6.1C12.3 13.9 17.6 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 6.1-10 6.1-17.5z"/><path fill="#FBBC05" d="M10.4 28.2a14.6 14.6 0 010-8.4l-7.8-6.1a24 24 0 000 20.6l7.8-6.1z"/><path fill="#34A853" d="M24 47.5c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2 1.4-4.7 2.3-7.7 2.3-6.4 0-11.7-4.4-13.6-10.3l-7.8 6.1C6.5 42.1 14.6 47.5 24 47.5z"/></svg>
              Continuer avec Google
            </button>
            <p id="gLinked" class="hidden mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-300"></p>
            <div class="flex items-center gap-3 my-4"><span class="flex-1 h-px bg-slate-200 dark:bg-slate-700"></span><span class="text-[11px] text-slate-400">ou</span><span class="flex-1 h-px bg-slate-200 dark:bg-slate-700"></span></div>
            <form id="signupForm" class="space-y-3">
              <label class="block"><span class="text-xs font-semibold text-slate-500">Nom complet de l'élève</span>
                <input id="su_name" class="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm outline-none focus:border-brand-400" placeholder="Prénom Nom"></label>
              <label class="block"><span class="text-xs font-semibold text-slate-500">Adresse Gmail</span>
                <input id="su_email" type="email" class="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm outline-none focus:border-brand-400" placeholder="exemple@gmail.com"></label>
              <div class="flex items-center gap-2 p-2.5 rounded-xl bg-brand-50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/20 text-xs">
                <span class="font-bold text-slate-600 dark:text-slate-300">Établissement :</span>
                <span class="font-bold text-brand-700 dark:text-brand-300 truncate">${activeSchool().name}</span>
                <span class="ml-auto text-brand-600 dark:text-brand-300 font-semibold shrink-0">${activeSchool().slug}.xschool.io</span>
              </div>
              <label class="block"><span class="text-xs font-semibold text-slate-500">Classe souhaitée</span>
                <select id="su_cls" class="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm font-semibold outline-none focus:border-brand-400">${clsOptsForSchool(state.schoolId)}</select></label>
              <button type="submit" class="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold transition active:scale-95">Envoyer ma demande</button>
            </form>
            <p class="text-[11px] text-slate-400 mt-3 text-center">Déjà un compte ? <button id="toLogin" type="button" class="font-bold text-brand-600 dark:text-brand-300">Se connecter</button></p>
           </div>
           <div id="resetCard" class="hidden bg-white dark:bg-slate-900 rounded-3xl shadow-soft border border-slate-200/70 dark:border-slate-800 p-6 lg:p-8">
            <h2 class="text-lg font-extrabold">Mot de passe oublié</h2>
            <p class="text-xs text-slate-500 mb-4">Réinitialise ton accès pour cet établissement.</p>
            <div class="flex items-center gap-3 p-3 rounded-xl bg-brand-50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/20 mb-4">
              <span class="w-9 h-9 rounded-lg bg-brand-600 text-white grid place-items-center font-extrabold shrink-0">${activeSchool().name.charAt(0)}</span>
              <div class="min-w-0 flex-1"><p class="text-sm font-bold truncate">${activeSchool().name}</p><p class="text-[11px] text-brand-600 dark:text-brand-300 font-semibold truncate">${activeSchool().slug}.xschool.io</p></div>
            </div>
            <form id="resetStep1" class="space-y-3">
              <label class="block"><span class="text-xs font-semibold text-slate-500">Adresse e-mail du compte</span>
                <input id="rs_email" type="email" class="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm outline-none focus:border-brand-400" placeholder="exemple@xschool.io"></label>
              <button type="submit" class="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold transition active:scale-95">Envoyer le code de réinitialisation</button>
              <p class="text-[11px] text-slate-400 text-center">Un code à 6 chiffres sera envoyé à cette adresse si un compte existe dans cet établissement.</p>
            </form>
            <form id="resetStep2" class="hidden space-y-3">
              <div class="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
                <span>Code envoyé à</span><span id="rs_dest" class="truncate"></span>
              </div>
              <label class="block"><span class="text-xs font-semibold text-slate-500">Code reçu (6 chiffres)</span>
                <input id="rs_code" inputmode="numeric" maxlength="6" class="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm tracking-[0.4em] font-bold outline-none focus:border-brand-400" placeholder="______"></label>
              <label class="block"><span class="text-xs font-semibold text-slate-500">Nouveau mot de passe</span>
                <input id="rs_pass" type="password" class="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm outline-none focus:border-brand-400" placeholder="Au moins 6 caractères"></label>
              <label class="block"><span class="text-xs font-semibold text-slate-500">Confirme le mot de passe</span>
                <input id="rs_pass2" type="password" class="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm outline-none focus:border-brand-400" placeholder="••••••••"></label>
              <button type="submit" class="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold transition active:scale-95">Réinitialiser mon mot de passe</button>
              <button id="rs_resend" type="button" class="w-full text-[11px] font-bold text-brand-600 dark:text-brand-300">Renvoyer le code</button>
            </form>
            <p class="text-[11px] text-slate-400 mt-3 text-center"><button id="rsToLogin" type="button" class="font-bold text-brand-600 dark:text-brand-300">Retour à la connexion</button></p>
           </div>
          </div>
        </section>
        <section id="espaces" class="max-w-6xl mx-auto px-5 py-10 lg:py-14">
          <div class="mb-6"><h2 class="text-2xl font-extrabold">Six espaces, un seul outil</h2><p class="text-sm text-slate-500 mt-1">Chaque rôle dispose de permissions dédiées (RBAC). Clique sur un espace pour pré-remplir l’e-mail de démo.</p></div>
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">${cards}</div>
        </section>
      </main>
      <footer class="border-t border-slate-200 dark:border-slate-800">
        <div class="max-w-6xl mx-auto px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-500">
          <p>© 2026 XSchool — Prototype EMS.</p>
          <p>contact@xschool.io · +228 90 00 00 00</p>
        </div>
      </footer>
    </div>`;
    $('#login').querySelectorAll('[data-role]').forEach(b=>b.addEventListener('click',()=>{ const r=ROLES[b.dataset.role]; if(!r) return; const inp=$('#loginEmail'); if(inp) inp.value=r.email; const err=$('#loginErr'); if(err) err.classList.add('hidden'); const card=$('#loginCard'); if(card) card.scrollIntoView({behavior:'smooth',block:'center'}); if(inp) inp.focus(); }));
    const form=$('#loginForm'); if(form) form.addEventListener('submit',async e=>{
      e.preventDefault();
      const em=(($('#loginEmail')||{}).value||'').trim().toLowerCase();
      const pw=(($('#loginPass')||{}).value||'');
      const err=$('#loginErr');
      if(typeof apiOn==='function' && apiOn()){
        // --- connexion reelle via le backend (JWT) ---
        if(!em||!pw){ if(err){ err.textContent=em?'Saisis ton mot de passe.':'Saisis ton adresse e-mail.'; err.classList.remove('hidden'); } return; }
        const btn=form.querySelector('button[type="submit"]'); const lbl=btn?btn.textContent:''; if(btn){ btn.disabled=true; btn.textContent='Connexion\u2026'; }
        try{
          const role=await apiLogin(em,pw);
          if(err) err.classList.add('hidden');
          try{ await hydrateFromApi(); }catch(_e){}
          enterApp(role);
        }catch(ex){
          if(err){ err.textContent=(ex&&ex.status===401)?'Identifiants invalides.':((ex&&ex.message)||'Connexion impossible.'); err.classList.remove('hidden'); }
        }finally{ if(btn){ btn.disabled=false; btn.textContent=lbl; } }
        return;
      }
      // --- mode prototype hors-ligne : correspondance par e-mail de demo ---
      const entry=Object.entries(ROLES).find(([k,v])=>(v.email||'').toLowerCase()===em);
      if(!entry){ if(err){ err.textContent=em?'Aucun espace associé à cette adresse pour cet établissement.':'Saisis ton adresse e-mail.'; err.classList.remove('hidden'); } return; }
      if(err) err.classList.add('hidden'); enterApp(entry[0]);
    });
    const switchT=$('#switchTenant'); if(switchT) switchT.addEventListener('click',backToTenant);
    // --- Auto-inscription élève (compte en attente de validation admin) ---
    const loginCard=$('#loginCard'), signupCard=$('#signupCard');
    const toSignup=$('#toSignup'); if(toSignup) toSignup.addEventListener('click',()=>{ loginCard.classList.add('hidden'); signupCard.classList.remove('hidden'); });
    const toLogin=$('#toLogin'); if(toLogin) toLogin.addEventListener('click',()=>{ signupCard.classList.add('hidden'); loginCard.classList.remove('hidden'); });
    // --- Récupération de mot de passe par école (simulation, code à 6 chiffres) ---
    const resetCard=$('#resetCard');
    let rstCode='', rstUser=null;
    const showReset=()=>{ loginCard.classList.add('hidden'); signupCard.classList.add('hidden'); resetCard.classList.remove('hidden'); $('#resetStep1').classList.remove('hidden'); $('#resetStep2').classList.add('hidden'); rstCode=''; rstUser=null; };
    const hideReset=()=>{ resetCard.classList.add('hidden'); loginCard.classList.remove('hidden'); };
    const toReset=$('#toReset'); if(toReset) toReset.addEventListener('click',showReset);
    const rsToLogin=$('#rsToLogin'); if(rsToLogin) rsToLogin.addEventListener('click',hideReset);
    const rs1=$('#resetStep1'); if(rs1) rs1.addEventListener('submit',e=>{
      e.preventDefault();
      const email=($('#rs_email').value||'').trim();
      if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ toast('Adresse e-mail invalide'); return; }
      const u=USERS.find(x=>x.schoolId===state.schoolId && x.email.toLowerCase()===email.toLowerCase());
      if(!u){ toast('Si un compte existe pour cette école, un code vient d\'être envoyé'); return; }
      rstUser=u; rstCode=String(Math.floor(100000+Math.random()*900000));
      $('#rs_dest').textContent=u.email;
      $('#resetStep1').classList.add('hidden'); $('#resetStep2').classList.remove('hidden');
      $('#rs_code').value=''; $('#rs_pass').value=''; $('#rs_pass2').value='';
      mailResetModal(u,rstCode);
    });
    const rsResend=$('#rs_resend'); if(rsResend) rsResend.addEventListener('click',()=>{ if(!rstUser) return; rstCode=String(Math.floor(100000+Math.random()*900000)); mailResetModal(rstUser,rstCode); toast('Nouveau code envoyé ✓'); });
    const rs2=$('#resetStep2'); if(rs2) rs2.addEventListener('submit',e=>{
      e.preventDefault();
      const code=($('#rs_code').value||'').trim();
      const p1=$('#rs_pass').value||'', p2=$('#rs_pass2').value||'';
      if(code!==rstCode){ toast('Code incorrect'); return; }
      if(p1.length<6){ toast('Mot de passe trop court (6 caractères min.)'); return; }
      if(p1!==p2){ toast('Les mots de passe ne correspondent pas'); return; }
      const who=rstUser?rstUser.name:'';
      hideReset(); $('#resetStep1').classList.remove('hidden'); $('#resetStep2').classList.add('hidden');
      rstCode=''; rstUser=null;
      toast('Mot de passe réinitialisé ✔'+(who?(' — '+who):''));
    });
    const gLink=$('#gLink'); if(gLink) gLink.addEventListener('click',()=>{
      const nameEl=$('#su_name'), emailEl=$('#su_email'), badge=$('#gLinked');
      const base=(nameEl.value||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'.').replace(/^\.|\.$/g,'');
      const mail=(base||'mon.compte')+'@gmail.com';
      emailEl.value=mail; emailEl.dataset.glinked='1';
      badge.textContent='✓ Compte Google lié : '+mail; badge.classList.remove('hidden');
      toast('Compte Google lié (simulation) ✓');
    });
    const suForm=$('#signupForm'); if(suForm) suForm.addEventListener('submit',e=>{
      e.preventDefault();
      const name=($('#su_name').value||'').trim();
      const email=($('#su_email').value||'').trim();
      const clsId=$('#su_cls').value;
      const schoolId=state.schoolId;
      const glinked=$('#su_email').dataset.glinked==='1';
      if(!name){ toast('Indique le nom complet'); return; }
      if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ toast('Adresse e-mail invalide'); return; }
      if(USERS.some(u=>u.email.toLowerCase()===email.toLowerCase())){ toast('Un compte existe déjà avec cet e-mail'); return; }
      USERS.push({ id:uid('u'), name:name, email:email, role:'student', active:false, status:'pending', schoolId:schoolId, classId:clsId||'', gmail:glinked, perms:{} });
      $('#su_name').value=''; $('#su_email').value=''; delete $('#su_email').dataset.glinked; $('#gLinked').classList.add('hidden');
      signupCard.classList.add('hidden'); loginCard.classList.remove('hidden');
      toast('Demande envoyée ✔ — compte en attente de validation ('+((SCHOOLS.find(s=>s.id===schoolId)||{}).name||'')+')');
    });
    const lt=$('#landThemeBtn'); if(lt) lt.addEventListener('click',()=>{ const d=!document.documentElement.classList.contains('dark'); applyTheme(d); });
  }

  function enterApp(role){
    state.role=role; state.view='dash'; state.screen='app';
    try{ logit('Connexion','Accès espace '+((ROLES[role]&&ROLES[role].tag)||role),'ok'); }catch(e){}
    $('#login').classList.add('hidden');
    $('#app').classList.remove('hidden'); $('#app').classList.add('flex');
    renderNav(); renderView(); window.scrollTo(0,0);
  }

  function logout(){
    try{ if(typeof apiLogout==='function') apiLogout(); }catch(e){}
    state.screen='login'; closeDrawer();
    $('#app').classList.add('hidden'); $('#app').classList.remove('flex');
    $('#login').classList.remove('hidden');
    renderLogin(); window.scrollTo(0,0);
  }
  $('#logoutBtn').addEventListener('click',logout);

  function go(v){ state.view=v; renderNav(); renderView(); $('#main').scrollTo(0,0); }
  // ---------- DRAWER + THEME ----------
  function openDrawer(){ $('#drawer').classList.remove('-translate-x-full'); const s=$('#scrim'); s.classList.remove('opacity-0','pointer-events-none'); s.classList.add('opacity-100'); }
  function closeDrawer(){ $('#drawer').classList.add('-translate-x-full'); const s=$('#scrim'); s.classList.add('opacity-0','pointer-events-none'); s.classList.remove('opacity-100'); }
  $('#menuBtn').addEventListener('click',openDrawer);
  $('#scrim').addEventListener('click',closeDrawer);

  function applyTheme(dark){
    document.documentElement.classList.toggle('dark',dark);
    const sun=$('#iconSun'),moon=$('#iconMoon'); if(sun)sun.classList.toggle('hidden',!dark); if(moon)moon.classList.toggle('hidden',dark);
    const ls=$('#landSun'),lm=$('#landMoon'); if(ls)ls.classList.toggle('hidden',!dark); if(lm)lm.classList.toggle('hidden',dark);
    const ts=$('#tSun'),tm=$('#tMoon'); if(ts)ts.classList.toggle('hidden',!dark); if(tm)tm.classList.toggle('hidden',dark);
    try{ localStorage.setItem('xschool-theme',dark?'dark':'light'); }catch(e){}
  }
  $('#themeBtn').addEventListener('click',()=>{ const d=!document.documentElement.classList.contains('dark'); applyTheme(d); const c=document.getElementById('chart'); if(c) initChart(c); });
  let saved='light'; try{ saved=localStorage.getItem('xschool-theme')||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'); }catch(e){}
  applyTheme(saved==='dark');

  // ---------- INIT ----------
  // Deep-link par sous-domaine simulé : #<slug> ouvre directement l'école
  (async function(){
    // Reprise de session si un token valide existe : on hydrate puis on entre direct.
    if(typeof apiOn==='function' && apiOn() && API.authenticated()){
      try{
        const ok=await hydrateFromApi();
        if(ok){ const u=API.user(); enterApp(u?mapApiRole(u.role):'admin'); return; }
      }catch(e){}
    }
    let h=''; try{ h=(location.hash||'').replace('#','').toLowerCase(); }catch(e){}
    const sc=SCHOOLS.find(s=>s.slug===h);
    if(sc){ setTenant(sc.id); } else { renderTenant(); }
  })();
