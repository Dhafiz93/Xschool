'use strict';
/*
 * XSchool — Lot 2 : interface du menu « Exercices » (enseignant + élève)
 * + panneau de notifications (cloche).
 *
 * Module autonome chargé APRÈS app.js : il réutilise la portée globale partagée
 * ($, el, svg, I, escH, toast, state, NAV, ROLES, DB, API, apiOn, go,
 * renderView, downloadFile, currentTeacher...). Pour rester « petit ajout »,
 * il n'édite pas les gros fichiers : il enregistre une entrée de menu, branche
 * le rendu de la vue 'exos' et injecte la cloche de notifications.
 *
 * Le moteur de quiz anti-triche (passage du quiz on-page) arrive au Lot 3 :
 * côté élève, « Commencer le quiz » appelle window.XSchoolQuiz s'il est présent,
 * sinon affiche un message indiquant que le module arrive au lot suivant.
 */
(function(){
  // Styles réutilisés (alignes sur le reste du prototype).
  var EXIN='w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm outline-none focus:ring-2 ring-brand-400';
  var EXSEL=EXIN+' font-semibold';
  var EXBTN='px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold active:scale-95 transition';
  var EXBTN2='px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-semibold active:scale-95 transition';

  // État local de la vue Exercices.
  var EXO={ loading:false, items:null, error:'', view:'list', current:null, detail:null,
            subs:null, type:'pdf', builder:null, classmatesOpen:false, classmates:null };

  function esc(v){ try{ return escH(v); }catch(e){ return (''+(v==null?'':v)); } }
  function isTeacher(){ return state.role==='teacher'||state.role==='admin'; }

  // ---- utilitaires format ----
  function fmtDateTime(iso){
    if(!iso) return '';
    try{ var d=new Date(iso); if(isNaN(d.getTime())) return ''; 
      return d.toLocaleDateString('fr-FR')+' '+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}); }
    catch(e){ return ''; }
  }
  function statutLabel(s){
    return ({ assigned:'À faire', in_progress:'En cours', submitted:'Rendu',
              graded:'Corrigé', expired:'Expiré' })[s]||s||'';
  }
  function statutBadge(s){
    var map={ assigned:'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
              in_progress:'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
              submitted:'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
              graded:'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
              expired:'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' };
    return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold '+(map[s]||map.assigned)+'">'+esc(statutLabel(s))+'</span>';
  }
  function typeBadge(t){
    return t==='quiz'
      ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">Quiz</span>'
      : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">PDF</span>';
  }

  // Lit un fichier (input) en data-URL base64 via Promise.
  function readFileB64(file){
    return new Promise(function(resolve,reject){
      var r=new FileReader();
      r.onload=function(){ resolve(String(r.result||'')); };
      r.onerror=function(){ reject(new Error('Lecture impossible')); };
      r.readAsDataURL(file);
    });
  }
  // Identifiant serveur (numérique) d'une classe front ('c3' -> 3).
  function clsApiId(cls){
    if(!cls) return null;
    if(typeof classApiId==='function'){ try{ return classApiId(cls); }catch(e){} }
    if(cls.apiId!=null) return cls.apiId;
    if(typeof _unpfx==='function'){ try{ return _unpfx('c',cls.id); }catch(e){} }
    return null;
  }
  function subApiId(sub){
    if(!sub) return null;
    if(sub.apiId!=null) return sub.apiId;
    if(typeof _unpfx==='function'){ try{ return _unpfx('s',sub.id); }catch(e){} }
    return null;
  }

  // ====================================================================
  // Couche API (routes Lot 1). Chemins bruts via API.get/post/del.
  // ====================================================================
  var EXAPI={
    listTeacher:function(classId){ return API.get('/api/exercises'+(classId!=null?('?class_id='+encodeURIComponent(classId)):'')); },
    get:function(id){ return API.get('/api/exercises/'+encodeURIComponent(id)); },
    create:function(p){ return API.post('/api/exercises',p); },
    publish:function(id){ return API.post('/api/exercises/'+encodeURIComponent(id)+'/publish',{}); },
    remind:function(id){ return API.post('/api/exercises/'+encodeURIComponent(id)+'/remind',{}); },
    del:function(id){ return API.del('/api/exercises/'+encodeURIComponent(id)); },
    submissions:function(id){ return API.get('/api/exercises/'+encodeURIComponent(id)+'/submissions'); },
    subPdf:function(id,subId){ return API.get('/api/exercises/'+encodeURIComponent(id)+'/submissions/'+encodeURIComponent(subId)+'/pdf'); },
    // élève
    mine:function(){ return API.get('/api/me/exercises'); },
    mineDetail:function(id){ return API.get('/api/me/exercises/'+encodeURIComponent(id)); },
    minePdf:function(id){ return API.get('/api/me/exercises/'+encodeURIComponent(id)+'/pdf'); },
    upload:function(id,p){ return API.post('/api/me/exercises/'+encodeURIComponent(id)+'/upload',p); },
    classmates:function(id){ return API.get('/api/me/exercises/'+encodeURIComponent(id)+'/classmates'); },
    // notifications
    notifList:function(){ return API.get('/api/notifications?limit=30'); },
    notifHistory:function(unread){ return API.get('/api/notifications?limit=200'+(unread?'&unread=1':'')); },
    notifCount:function(){ return API.get('/api/notifications/count'); },
    notifRead:function(ids){ return API.post('/api/notifications/read', ids?{ids:ids}:{}); }
  };

  // ====================================================================
  // CÔTÉ ENSEIGNANT
  // ====================================================================
  function teacherClasses(){
    // Admin : toutes les classes de l'école. Enseignant : ses classes si
    // connues, sinon toutes (le serveur filtre de toute façon).
    var all=(typeof DB!=='undefined'&&DB.classes)?DB.classes:[];
    return all;
  }
  function clsLabelSafe(id){
    try{ if(typeof clsLabel==='function') return clsLabel(id); }catch(e){}
    var c=(DB.classes||[]).find(function(x){ return x.id===id; });
    return c?((c.cycle?c.cycle+' ':'')+c.name):('#'+id);
  }

  function emptyBuilder(){ return { duree_min:30, questions:[] }; }
  function newQuestion(){
    return { id:'q'+Date.now()+Math.floor(Math.random()*1000), text:'', type:'single',
             options:[{id:'o1',text:''},{id:'o2',text:''}], correct:[], points:1 };
  }

  // Rendu : liste des exercices de l'enseignant.
  function teacherListHTML(){
    var head='<div class="flex items-center justify-between gap-3 mb-3">'
      + '<div><p class="font-extrabold text-lg">Mes exercices</p>'
      + '<p class="text-xs text-slate-500">Dépose un PDF ou crée un quiz chronométré pour une classe.</p></div>'
      + '<button data-exnew class="'+EXBTN+' flex items-center gap-1.5"><span class="w-4 h-4">'+svg(I.plus)+'</span>Nouvel exercice</button></div>';
    if(EXO.loading) return head+loadingCard();
    if(EXO.error) return head+errorCard(EXO.error);
    var items=EXO.items||[];
    if(!items.length) return head+'<div class="rounded-2xl p-6 bg-white dark:bg-slate-900 shadow-soft card-in text-center text-sm text-slate-500">Aucun exercice pour le moment. Clique sur « Nouvel exercice » pour commencer.</div>';
    var cards=items.map(function(ex){
      var meta=[];
      meta.push(typeBadge(ex.type));
      if(ex.statut==='draft') meta.push('<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">Brouillon</span>');
      else meta.push('<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">Publié</span>');
      if(ex.type==='quiz'){ meta.push('<span class="text-[11px] text-slate-500">'+(ex.duree_min?ex.duree_min+' min':'sans limite')+' · '+(ex.points_total||0)+' pts</span>'); }
      return '<button data-exopen="'+ex.id+'" class="w-full text-left p-3 rounded-2xl bg-white dark:bg-slate-900 shadow-soft card-in hover:ring-2 ring-brand-300 transition">'
        + '<div class="flex items-center justify-between gap-2"><p class="font-bold text-sm truncate">'+esc(ex.title||'(sans titre)')+'</p>'
        + '<span class="text-[11px] text-slate-400 shrink-0">'+esc((''+(ex.created_at||'')).slice(0,10))+'</span></div>'
        + '<p class="text-[11px] text-slate-500 mt-0.5">'+esc(clsLabelSafe('c'+ex.class_id)||('Classe #'+ex.class_id))+'</p>'
        + '<div class="flex items-center gap-2 mt-2 flex-wrap">'+meta.join(' ')+'</div></button>';
    }).join('');
    return head+'<div class="space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">'+cards+'</div>';
  }

  // Rendu : formulaire de création.
  function teacherNewHTML(){
    var classes=teacherClasses();
    var clsOpts=classes.map(function(c){ return '<option value="'+esc(c.id)+'">'+esc(clsLabelSafe(c.id))+'</option>'; }).join('')||'<option value="">Aucune classe</option>';
    var subs=(typeof DB!=='undefined'&&DB.subjects)?DB.subjects:[];
    var subOpts='<option value="">— Matière (optionnel) —</option>'+subs.map(function(s){ return '<option value="'+esc(s.id)+'">'+esc(s.name||('#'+s.id))+'</option>'; }).join('');
    var isQuiz=EXO.type==='quiz';
    var typeToggle='<div class="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-bold">'
      + '<button data-extype="pdf" class="px-3 py-1.5 rounded-lg '+(!isQuiz?'bg-white dark:bg-slate-900 shadow-soft text-brand-600':'text-slate-500')+'">Document PDF</button>'
      + '<button data-extype="quiz" class="px-3 py-1.5 rounded-lg '+(isQuiz?'bg-white dark:bg-slate-900 shadow-soft text-brand-600':'text-slate-500')+'">Quiz</button></div>';
    var common='<div class="grid sm:grid-cols-2 gap-3">'
      + '<label class="block"><span class="text-[11px] font-bold text-slate-400 uppercase">Titre</span><input id="ex_title" class="'+EXIN+' mt-1" placeholder="ex: Devoir maison n°2" value="'+esc((EXO.draft&&EXO.draft.title)||'')+'"></label>'
      + '<label class="block"><span class="text-[11px] font-bold text-slate-400 uppercase">Classe</span><select id="ex_cls" class="'+EXSEL+' mt-1">'+clsOpts+'</select></label>'
      + '<label class="block"><span class="text-[11px] font-bold text-slate-400 uppercase">Matière</span><select id="ex_sub" class="'+EXSEL+' mt-1">'+subOpts+'</select></label>'
      + '<label class="block"><span class="text-[11px] font-bold text-slate-400 uppercase">Échéance (optionnel)</span><input id="ex_deadline" type="date" class="'+EXIN+' mt-1"></label>'
      + '</div>'
      + '<label class="block mt-3"><span class="text-[11px] font-bold text-slate-400 uppercase">Consignes</span><textarea id="ex_consignes" rows="3" class="'+EXIN+' mt-1" placeholder="Explique ce que l\'élève doit faire…"></textarea></label>';
    var body = isQuiz ? quizBuilderHTML() : pdfBlockHTML();
    return '<div class="flex items-center gap-2 mb-3"><button data-exback class="'+EXBTN2+'">← Retour</button><p class="font-extrabold text-lg">Nouvel exercice</p></div>'
      + '<div class="rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft card-in space-y-3">'
      + '<div class="flex items-center justify-between gap-2"><span class="text-[11px] font-bold text-slate-400 uppercase">Type d\'exercice</span>'+typeToggle+'</div>'
      + common + '<div class="pt-2 border-t border-slate-100 dark:border-slate-800">'+body+'</div>'
      + '<div class="flex items-center justify-end gap-2 pt-2">'
      + '<button data-exsave="draft" class="'+EXBTN2+'">Enregistrer le brouillon</button>'
      + '<button data-exsave="publish" class="'+EXBTN+'">Publier &amp; notifier</button></div></div>';
  }
  function pdfBlockHTML(){
    var name=(EXO.draft&&EXO.draft.pdf_name)||'';
    return '<p class="text-[11px] font-bold text-slate-400 uppercase mb-1">Énoncé (PDF)</p>'
      + '<label class="flex items-center gap-3 p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 cursor-pointer">'
      + '<span class="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 grid place-items-center">'+svg(I.doc)+'</span>'
      + '<span class="text-sm"><span class="font-semibold">'+(name?esc(name):'Choisir un fichier PDF')+'</span><br><span class="text-[11px] text-slate-400">8 Mo max</span></span>'
      + '<input id="ex_pdf" type="file" accept="application/pdf" class="hidden"></label>';
  }
  function quizBuilderHTML(){
    var b=EXO.builder||(EXO.builder=emptyBuilder());
    var qs=b.questions.map(function(q,i){ return quizQuestionHTML(q,i); }).join('');
    return '<div class="flex items-center justify-between gap-2 mb-2">'
      + '<p class="text-[11px] font-bold text-slate-400 uppercase">Questions</p>'
      + '<label class="flex items-center gap-2 text-xs font-semibold">Durée <input id="ex_duree" type="number" min="0" value="'+(b.duree_min||0)+'" class="w-20 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 outline-none"> min <span class="text-[10px] text-slate-400">(0 = libre)</span></label></div>'
      + '<div class="space-y-3">'+(qs||'<p class="text-xs text-slate-400">Aucune question. Ajoute-en une ci-dessous.</p>')+'</div>'
      + '<button data-qadd class="'+EXBTN2+' mt-3 flex items-center gap-1.5"><span class="w-4 h-4">'+svg(I.plus)+'</span>Ajouter une question</button>';
  }
  function quizQuestionHTML(q,i){
    var typeSel='<select data-qtype="'+i+'" class="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold outline-none">'
      + '<option value="single"'+(q.type==='single'?' selected':'')+'>Choix unique</option>'
      + '<option value="multi"'+(q.type==='multi'?' selected':'')+'>Choix multiple</option>'
      + '<option value="text"'+(q.type==='text'?' selected':'')+'>Réponse texte</option></select>';
    var opts='';
    if(q.type==='text'){
      opts='<label class="block mt-2"><span class="text-[11px] text-slate-400">Réponse attendue</span>'
        + '<input data-qcorrecttext="'+i+'" class="'+EXIN+' mt-1" value="'+esc(q.correct||'')+'" placeholder="texte exact attendu"></label>';
    } else {
      var mark=(q.type==='multi')?'checkbox':'radio';
      opts=(q.options||[]).map(function(o,j){
        var checked=(q.correct||[]).indexOf(o.id)>=0;
        return '<div class="flex items-center gap-2 mt-1">'
          + '<input type="'+mark+'" data-qcorrect="'+i+'|'+o.id+'" '+(checked?'checked':'')+' class="w-4 h-4 accent-emerald-500" title="Bonne réponse">'
          + '<input data-qopt="'+i+'|'+o.id+'" class="flex-1 px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm outline-none" value="'+esc(o.text||'')+'" placeholder="Option '+(j+1)+'">'
          + '<button data-qoptdel="'+i+'|'+o.id+'" class="w-7 h-7 rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-500/15 grid place-items-center shrink-0">'+svg(I.trash)+'</button></div>';
      }).join('')
      + '<button data-qoptadd="'+i+'" class="text-[11px] font-bold text-brand-600 dark:text-brand-300 mt-1">+ Ajouter une option</button>';
    }
    return '<div class="rounded-xl p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">'
      + '<div class="flex items-center gap-2 mb-2"><span class="text-xs font-bold text-slate-400">Q'+(i+1)+'</span>'+typeSel
      + '<label class="ml-auto flex items-center gap-1 text-xs font-semibold">Points <input data-qpts="'+i+'" type="number" min="0" step="0.5" value="'+(q.points||0)+'" class="w-16 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 outline-none"></label>'
      + '<button data-qdel="'+i+'" class="w-7 h-7 rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-500/15 grid place-items-center">'+svg(I.trash)+'</button></div>'
      + '<input data-qtext="'+i+'" class="'+EXIN+'" value="'+esc(q.text||'')+'" placeholder="Énoncé de la question">'
      + opts+'</div>';
  }

  // Revue du contenu d'un quiz (vue enseignant) : énoncés + corrigé.
  // Permet de REVOIR ses questions/réponses à tout moment, même publié.
  function teacherQuizReviewHTML(ex){
    var qs=(ex&&ex.questions)||[];
    if(!qs.length) return '<p class="text-[11px] text-slate-400 mt-2">Ce quiz n\'a pas encore de questions.</p>';
    var body=qs.map(function(q,i){
      var ans;
      if(q.type==='text'){
        ans='<p class="text-[12px] mt-1"><span class="text-slate-400">Réponse attendue : </span>'
          + '<span class="text-emerald-600 dark:text-emerald-300 font-semibold">'+esc(q.correct||'—')+'</span></p>';
      } else {
        var corr=(q.correct||[]).map(String);
        ans='<div class="space-y-1 mt-1">'+(q.options||[]).map(function(o){
          var isCorr=corr.indexOf(String(o.id))>=0;
          return '<div class="flex items-center gap-2 text-[12px]">'
            + '<span class="'+(isCorr?'text-emerald-600 dark:text-emerald-300':'text-slate-400')+'">'+(isCorr?'✓':'○')+'</span>'
            + '<span class="'+(isCorr?'font-semibold':'')+'">'+esc(o.text||'')+'</span></div>';
        }).join('')+'</div>';
      }
      return '<div class="rounded-xl p-3 bg-slate-50 dark:bg-slate-800/50">'
        + '<p class="text-sm font-bold">'+(i+1)+'. '+esc(q.text||'')
        + ' <span class="text-[11px] text-slate-400 font-normal">('+(q.points||0)+' pt'+(((q.points||0)>1)?'s':'')+')</span></p>'
        + ans+'</div>';
    }).join('');
    return '<details class="mt-2" open><summary class="text-xs font-bold text-brand-600 dark:text-brand-300 cursor-pointer">Revoir les questions et le corrigé</summary>'
      + '<div class="space-y-2 mt-2">'+body+'</div></details>';
  }

  // Rendu : détail d'un exercice (suivi des soumissions).
  function teacherDetailHTML(){
    if(EXO.loading) return '<div class="flex items-center gap-2 mb-3"><button data-exback class="'+EXBTN2+'">← Retour</button></div>'+loadingCard();
    var ex=EXO.detail; if(!ex) return errorCard('Exercice introuvable.');
    var subs=EXO.subs||[];
    var done=subs.filter(function(s){ return s.statut==='submitted'||s.statut==='graded'; }).length;
    // Non-rendus relançables : reçu ou quiz entamé, mais pas encore rendu
    // (on exclut les échéances expirées : la relance n'a plus de sens).
    var pending=subs.filter(function(s){ return s.statut==='assigned'||s.statut==='in_progress'; }).length;
    var rows=subs.map(function(s){
      var right='';
      if(ex.type==='quiz'){
        var noteHtml=(s.note!=null)?('<span class="font-bold text-sm">'+s.note+'<span class="text-slate-400 text-xs">/'+(s.note_max!=null?s.note_max:(ex.points_total||0))+'</span></span>'+(s.auto_soumis?' <span class="text-[10px] text-amber-500">auto</span>':''))
                            :'<span class="text-xs text-slate-400">—</span>';
        var hasWork=(s.statut==='graded'||s.statut==='submitted'||s.statut==='in_progress'||(s.answers&&Object.keys(s.answers).length>0));
        var prev=hasWork?('<button data-expreview="'+s.id+'" class="block text-[11px] font-bold text-brand-600 dark:text-brand-300 mt-0.5">Prévisualiser</button>'):'';
        right=noteHtml+prev;
      } else {
        right=s.has_reponse
          ? '<button data-exdl="'+s.id+'" class="text-[11px] font-bold text-brand-600 dark:text-brand-300">Télécharger</button>'
          : '<span class="text-xs text-slate-400">—</span>';
      }
      var incChip=(s.incident_count)?(' · <span class="text-amber-600 dark:text-amber-300 font-semibold">⚠ '+s.incident_count+'</span>'):'';
      return '<div class="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 shadow-soft card-in">'
        + avatar(s.student_name||'?','w-9 h-9')
        + '<div class="flex-1 min-w-0"><p class="text-sm font-bold truncate">'+esc(s.student_name||'Élève')+'</p>'
        + '<p class="text-[11px] text-slate-500">'+esc(s.matricule||'')+' · '+statutLabel(s.statut)+incChip+'</p></div>'
        + statutBadge(s.statut)+'<div class="text-right whitespace-nowrap">'+right+'</div></div>';
    }).join('')||'<p class="text-xs text-slate-400">Aucun élève rattaché à cet exercice.</p>';
    var info='<div class="rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft card-in">'
      + '<div class="flex items-center gap-2 flex-wrap mb-1">'+typeBadge(ex.type)
      + (ex.type==='quiz'?('<span class="text-[11px] text-slate-500">'+(ex.duree_min?ex.duree_min+' min':'sans limite')+' · '+(ex.points_total||0)+' pts</span>'):'')
      + '</div><p class="font-extrabold">'+esc(ex.title||'')+'</p>'
      + (ex.consignes?('<p class="text-sm text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-line">'+esc(ex.consignes)+'</p>'):'')
      + (ex.type==='pdf'
           ? (ex.has_pdf
               ? ('<button data-extdlteacher="'+ex.id+'" class="'+EXBTN2+' mt-2 inline-flex items-center gap-2"><span class="w-4 h-4">'+svg(I.doc)+'</span>Revoir / télécharger l\'énoncé</button>')
               : '<p class="text-[11px] text-slate-400 mt-2">Aucun énoncé PDF joint.</p>')
           : teacherQuizReviewHTML(ex))
      + (ex.statut==='draft'
           ? ('<div class="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">'
               + '<p class="text-[11px] text-amber-600 dark:text-amber-300 font-semibold mb-2">Brouillon : cet exercice n\'est pas encore visible des élèves.</p>'
               + '<button data-expublish="'+ex.id+'" class="'+EXBTN+' w-full">Publier &amp; notifier les élèves</button></div>')
           : '<p class="text-[11px] text-emerald-600 dark:text-emerald-300 mt-2 font-semibold">✓ Publié — visible des élèves de la classe.</p>')
      + '</div>';
    return '<div class="flex items-center gap-2 mb-3"><button data-exback class="'+EXBTN2+'">← Retour</button>'
      + '<p class="font-extrabold text-lg flex-1 truncate">'+esc(ex.title||'Exercice')+'</p>'
      + '<button data-exdel="'+ex.id+'" class="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-500/15 grid place-items-center">'+svg(I.trash)+'</button></div>'
      + info
      + '<div class="flex items-center justify-between mt-4 mb-2"><h3 class="font-bold">Soumissions</h3><span class="text-xs text-slate-400">'+done+'/'+subs.length+' rendu(s)</span></div>'
      + ((ex.statut!=='draft'&&pending>0)
           ? ('<button data-exremind="'+ex.id+'" class="'+EXBTN2+' w-full mb-2 inline-flex items-center justify-center gap-2 text-amber-600 dark:text-amber-300"><span class="w-4 h-4">'+svg(I.bell)+'</span>Relancer les '+pending+' non-rendu'+(pending>1?'s':'')+'</button>')
           : '')
      + '<div class="space-y-2">'+rows+'</div>';
  }

  function loadingCard(){ return '<div class="rounded-2xl p-6 bg-white dark:bg-slate-900 shadow-soft card-in text-center text-sm text-slate-400">Chargement…</div>'; }
  function errorCard(m){ return '<div class="rounded-2xl p-5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-300 text-sm card-in">'+esc(m)+'</div>'; }

  // ====================================================================
  // PRÉVISUALISATION DU RÉSULTAT (enseignant)
  //   Corrigé par question + journal d'incidents, dans une modale.
  //   Tout est calculé côté front à partir des données déjà chargées
  //   (EXO.detail = questions avec `correct` ; EXO.subs = réponses + incidents).
  // ====================================================================
  var INC_LABELS={ fullscreen_exit:'Sortie du plein écran', hidden:'Onglet/fenêtre masqué',
    blur:'Perte de focus', copy:'Copier', paste:'Coller', contextmenu:'Menu contextuel', autre:'Autre' };
  var _exPrevEsc=null;

  function answersCorrection(ex, sub){
    var qs=ex.questions||[]; var ans=sub.answers||{};
    if(!qs.length) return '<p class="text-xs text-slate-400">Ce quiz n\'a pas de questions.</p>';
    return qs.map(function(q,i){
      var pts=+(q.points||0), ok=false, body='';
      if(q.type==='text'){
        var want=((q.correct||'')+'').trim().toLowerCase();
        var gvRaw=ans[q.id];
        var got=((gvRaw!=null?gvRaw:'')+'').trim().toLowerCase();
        ok = !!want && got===want;
        body='<div class="text-sm space-y-1">'
          + '<p><span class="text-[11px] text-slate-400">Réponse de l\'élève : </span>'+(gvRaw?esc(gvRaw):'<span class="text-slate-400">— vide —</span>')+'</p>'
          + '<p><span class="text-[11px] text-slate-400">Attendu : </span><span class="text-emerald-600 dark:text-emerald-300">'+esc(q.correct||'—')+'</span></p></div>';
      } else {
        var gv=ans[q.id];
        var given=Array.isArray(gv)?gv.map(String):(gv!=null?[String(gv)]:[]);
        var corr=(q.correct||[]).map(String);
        ok = given.length>0 && given.slice().sort().join(',')===corr.slice().sort().join(',');
        body='<div class="space-y-1.5">'+(q.options||[]).map(function(o){
          var isCorr=corr.indexOf(String(o.id))>=0, isPicked=given.indexOf(String(o.id))>=0;
          var cls='border-slate-200 dark:border-slate-700', mark='';
          if(isCorr){ cls='border-emerald-400 bg-emerald-50 dark:bg-emerald-500/10'; mark='<span class="text-[10px] font-bold text-emerald-600">bonne réponse</span>'; }
          if(isPicked && !isCorr){ cls='border-rose-400 bg-rose-50 dark:bg-rose-500/10'; mark='<span class="text-[10px] font-bold text-rose-600">choix élève</span>'; }
          return '<div class="flex items-center gap-2 p-2 rounded-lg border '+cls+'">'
            + '<span class="text-slate-400">'+(isPicked?'●':'○')+'</span>'
            + '<span class="text-sm flex-1">'+esc(o.text||'')+'</span>'+mark+'</div>';
        }).join('')+'</div>';
      }
      var earned=ok?pts:0;
      var badge='<span class="text-xs font-bold '+(ok?'text-emerald-600':'text-rose-500')+'">'+earned+'/'+pts+'</span>';
      return '<div class="rounded-xl p-3 bg-slate-50 dark:bg-slate-800/50">'
        + '<div class="flex items-start justify-between gap-2 mb-2"><p class="text-sm font-bold">'+(i+1)+'. '+esc(q.text||'')+'</p>'+badge+'</div>'
        + body+'</div>';
    }).join('');
  }

  function incidentsCorrection(sub){
    var n=sub.incident_count||0, list=sub.incidents||[];
    var head='<div class="flex items-center justify-between"><h4 class="font-bold text-sm">Incidents anti-triche</h4>'
      + '<span class="text-xs font-bold '+(n?'text-amber-600':'text-slate-400')+'">'+n+'</span></div>';
    if(!n && !list.length) return head+'<p class="text-xs text-slate-400 mt-1">Aucun incident signalé.</p>';
    var rows=list.map(function(it){
      var lab=INC_LABELS[it.type]||it.type||'Incident';
      return '<li class="flex items-center justify-between gap-2 py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">'
        + '<span class="text-xs">'+esc(lab)+(it.detail?(' · '+esc(it.detail)):'')+'</span>'
        + '<span class="text-[10px] text-slate-400">'+esc(fmtDateTime(it.at))+'</span></li>';
    }).join('');
    var more=(n>list.length)?'<p class="text-[10px] text-slate-400 mt-1">… et '+(n-list.length)+' autre(s) (journal tronqué).</p>':'';
    return head+'<ul class="mt-2">'+rows+'</ul>'+more;
  }

  function previewHTML(ex, sub){
    var noteMax=(sub.note_max!=null)?sub.note_max:(ex.points_total||0);
    var noteStr=(sub.note!=null)?(sub.note+'/'+noteMax):'—';
    return '<div class="sticky top-0 bg-white dark:bg-slate-900 px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">'
      + avatar(sub.student_name||'?','w-9 h-9')
      + '<div class="flex-1 min-w-0"><p class="font-extrabold truncate">'+esc(sub.student_name||'Élève')+'</p>'
      + '<p class="text-[11px] text-slate-500">'+esc(sub.matricule||'')+' · '+statutLabel(sub.statut)+(sub.auto_soumis?' · auto':'')+'</p></div>'
      + '<button data-exprevclose class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 grid place-items-center text-slate-500">✕</button></div>'
      + '<div class="p-4 space-y-4">'
      + '<div class="rounded-xl p-4 bg-brand-50 dark:bg-brand-500/10 text-center"><p class="text-[11px] uppercase text-slate-500 font-bold">Note</p>'
      + '<p class="text-3xl font-extrabold mt-1">'+esc(noteStr)+'</p>'
      + (sub.submitted_at?('<p class="text-[11px] text-slate-400 mt-1">Rendu le '+esc(fmtDateTime(sub.submitted_at))+'</p>'):'')+'</div>'
      + '<div><h4 class="font-bold text-sm mb-2">Correction par question</h4><div class="space-y-2">'+answersCorrection(ex, sub)+'</div></div>'
      + '<div class="rounded-xl p-3 bg-slate-50 dark:bg-slate-800/50">'+incidentsCorrection(sub)+'</div>'
      + '</div>';
  }

  function openPreview(subId){
    var ex=EXO.detail; if(!ex) return;
    var sub=(EXO.subs||[]).filter(function(s){ return String(s.id)===String(subId); })[0];
    if(!sub){ toast('Soumission introuvable.'); return; }
    closePreview();
    var ov=document.createElement('div');
    ov.id='exPreviewOverlay';
    ov.className='fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center sm:p-4';
    ov.style.zIndex='9998';
    ov.innerHTML='<div class="bg-white dark:bg-slate-900 w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-2xl">'
      + previewHTML(ex, sub)+'</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e){ if(e.target===ov) closePreview(); });
    var cb=ov.querySelector('[data-exprevclose]'); if(cb) cb.addEventListener('click', closePreview);
    _exPrevEsc=function(e){ if(e.key==='Escape') closePreview(); };
    document.addEventListener('keydown', _exPrevEsc);
  }
  function closePreview(){
    var ov=document.getElementById('exPreviewOverlay'); if(ov && ov.parentNode) ov.parentNode.removeChild(ov);
    if(_exPrevEsc){ document.removeEventListener('keydown', _exPrevEsc); _exPrevEsc=null; }
  }

  // ====================================================================
  // CÔTÉ ÉLÈVE
  // ====================================================================
  function subOf(ex){ return (ex&&ex.submission)||{}; }

  function studentListHTML(){
    var head='<div class="mb-3"><p class="font-extrabold text-lg">Mes exercices</p>'
      + '<p class="text-xs text-slate-500">Télécharge les énoncés, dépose tes réponses et passe tes quiz.</p></div>';
    if(EXO.loading) return head+loadingCard();
    if(EXO.error) return head+errorCard(EXO.error);
    var items=EXO.items||[];
    if(!items.length) return head+'<div class="rounded-2xl p-6 bg-white dark:bg-slate-900 shadow-soft card-in text-center text-sm text-slate-500">Aucun exercice pour le moment. Tu seras notifé(e) dès qu\'un enseignant en dépose un.</div>';
    var cards=items.map(function(ex){
      var s=subOf(ex);
      var right='';
      if(ex.type==='quiz'&&s.statut==='graded'&&s.note!=null){ right='<span class="font-extrabold text-sm text-emerald-600 dark:text-emerald-300">'+s.note+'<span class="text-slate-400 text-xs">/'+(s.note_max!=null?s.note_max:(ex.points_total||0))+'</span></span>'; }
      var meta=[typeBadge(ex.type), statutBadge(s.statut)];
      if(ex.type==='quiz'&&ex.duree_min) meta.push('<span class="text-[11px] text-slate-500">'+ex.duree_min+' min</span>');
      if(ex.echeance) meta.push('<span class="text-[11px] text-slate-500">éch. '+esc(ex.echeance)+'</span>');
      return '<button data-exopen="'+ex.id+'" class="w-full text-left p-3 rounded-2xl bg-white dark:bg-slate-900 shadow-soft card-in hover:ring-2 ring-brand-300 transition">'
        + '<div class="flex items-center justify-between gap-2"><p class="font-bold text-sm truncate">'+esc(ex.title||'(sans titre)')+'</p>'+right+'</div>'
        + '<div class="flex items-center gap-2 mt-2 flex-wrap">'+meta.join(' ')+'</div></button>';
    }).join('');
    return head+'<div class="space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">'+cards+'</div>';
  }

  function studentDetailHTML(){
    if(EXO.loading) return '<div class="flex items-center gap-2 mb-3"><button data-exback class="'+EXBTN2+'">← Retour</button></div>'+loadingCard();
    var ex=EXO.detail; if(!ex) return errorCard('Exercice introuvable.');
    var s=subOf(ex);
    var info='<div class="rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft card-in">'
      + '<div class="flex items-center gap-2 flex-wrap mb-1">'+typeBadge(ex.type)+statutBadge(s.statut)
      + (ex.echeance?('<span class="text-[11px] text-slate-500">échéance '+esc(ex.echeance)+'</span>'):'')+'</div>'
      + '<p class="font-extrabold">'+esc(ex.title||'')+'</p>'
      + (ex.consignes?('<p class="text-sm text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-line">'+esc(ex.consignes)+'</p>'):'')
      + '</div>';
    var action='';
    if(ex.type==='pdf'){
      var done=(s.statut==='submitted'||s.statut==='graded');
      action='<div class="rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft card-in mt-3 space-y-3">'
        + (ex.has_pdf?('<button data-exdlenonce="'+ex.id+'" class="'+EXBTN2+' w-full flex items-center justify-center gap-2"><span class="w-4 h-4">'+svg(I.doc)+'</span>Télécharger l\'énoncé</button>'):'<p class="text-xs text-slate-400">Aucun énoncé PDF joint.</p>')
        + '<div class="pt-2 border-t border-slate-100 dark:border-slate-800">'
        + '<p class="text-[11px] font-bold text-slate-400 uppercase mb-1">Ma réponse</p>'
        + (done?('<p class="text-sm text-emerald-600 dark:text-emerald-300 font-semibold mb-2">✓ Rendue'+(s.reponse_name?(' · '+esc(s.reponse_name)):'')+'</p>'):'')
        + '<label class="flex items-center gap-3 p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 cursor-pointer">'
        + '<span class="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 grid place-items-center">'+svg(I.doc)+'</span>'
        + '<span id="stuPdfLabel" class="text-sm font-semibold">'+(done?'Remplacer ma réponse (PDF)':'Choisir mon fichier PDF')+'</span>'
        + '<input id="stu_pdf" type="file" accept="application/pdf" class="hidden"></label>'
        + '<button data-exupload="'+ex.id+'" class="'+EXBTN+' w-full mt-2">Envoyer ma réponse</button></div></div>';
    } else {
      var qinfo=(ex.duree_min?(ex.duree_min+' min chronométrées'):'sans limite de temps')+' · '+(ex.points_total||((ex.questions||[]).length))+' pts';
      if(s.statut==='graded'){
        action='<div class="rounded-2xl p-5 bg-emerald-50 dark:bg-emerald-500/10 card-in mt-3 text-center">'
          + '<p class="text-xs text-emerald-700 dark:text-emerald-300 font-bold uppercase">Résultat</p>'
          + '<p class="text-3xl font-extrabold mt-1">'+(s.note!=null?s.note:'—')+'<span class="text-slate-400 text-lg">/'+(s.note_max!=null?s.note_max:(ex.points_total||0))+'</span></p>'
          + (s.auto_soumis?'<p class="text-[11px] text-amber-600 dark:text-amber-300 mt-1">Soumis automatiquement (temps écoulé)</p>':'')+'</div>';
      } else {
        var label=(s.statut==='in_progress')?'Reprendre le quiz':'Commencer le quiz';
        action='<div class="rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft card-in mt-3">'
          + '<p class="text-sm"><span class="font-bold">Quiz · </span>'+esc(qinfo)+'</p>'
          + '<p class="text-[11px] text-slate-500 mt-1">Une fois lancé, le chrono tourne côté serveur : quitter la page ne le met pas en pause.</p>'
          + '<button data-exquiz="'+ex.id+'" class="'+EXBTN+' w-full mt-3">'+label+'</button></div>';
      }
    }
    // Qui a rendu (camarades, sans notes).
    var mates='<div class="mt-3"><button data-exmates="'+ex.id+'" class="text-xs font-bold text-brand-600 dark:text-brand-300">'+(EXO.classmatesOpen?'▾':'▸')+' Qui a rendu dans ma classe</button>';
    if(EXO.classmatesOpen){
      if(EXO.classmates===null) mates+='<p class="text-xs text-slate-400 mt-2">Chargement…</p>';
      else { var cm=EXO.classmates||[];
        mates+='<div class="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">'+(cm.length?cm.map(function(m){
          return '<div class="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-900 shadow-soft">'
            + '<span class="w-2 h-2 rounded-full '+(m.soumis?'bg-emerald-500':'bg-rose-500')+'"></span>'
            + '<span class="text-xs truncate '+(m.is_me?'font-bold':'')+'">'+esc(m.student_name)+(m.is_me?' (moi)':'')+'</span></div>';
        }).join(''):'<p class="text-xs text-slate-400">—</p>')+'</div>';
      }
    }
    mates+='</div>';
    return '<div class="flex items-center gap-2 mb-3"><button data-exback class="'+EXBTN2+'">← Retour</button>'
      + '<p class="font-extrabold text-lg flex-1 truncate">'+esc(ex.title||'Exercice')+'</p></div>'
      + info+action+mates;
  }

  // ====================================================================
  // CHARGEMENT DES DONNÉES + ACTIONS
  // ====================================================================
  function exErr(e){
    var map={ titre_requis:'Le titre est obligatoire.', classe_requise:'Choisis une classe.',
      quiz_sans_question:'Ajoute au moins une question.', pdf_manquant:'Joins un fichier PDF.',
      options_insuffisantes:'Chaque question à choix a besoin d\'au moins 2 options.',
      reponse_correcte_requise:'Indique la (ou les) bonne(s) réponse(s).',
      single_une_seule_reponse:'Un choix unique n\'accepte qu\'une bonne réponse.',
      pdf_trop_volumineux:'Fichier trop lourd (8 Mo max).',
      exercice_publie_non_modifiable:'Un exercice publié ne se modifie plus.',
      exercice_non_publie:'Publie d\'abord l\'exercice avant de relancer les élèves.' };
    return map[e&&e.code]||(e&&e.message)||'erreur';
  }
  function dlDataUrl(name, dataUrl){
    try{ var a=document.createElement('a'); a.href=dataUrl; a.download=name||'fichier.pdf';
      document.body.appendChild(a); a.click(); a.remove(); }
    catch(e){ toast('Téléchargement impossible'); }
  }

  function loadList(){
    EXO.loading=true; EXO.error='';
    var p = isTeacher()? EXAPI.listTeacher() : EXAPI.mine();
    p.then(function(r){ EXO.items=(r&&r.items)||[]; EXO.loading=false; renderExos(); })
     .catch(function(e){ EXO.loading=false; EXO.error='Chargement impossible : '+exErr(e); renderExos(); });
  }
  function loadTeacherDetail(id){
    EXO.loading=true; EXO.detail=null; EXO.subs=null; renderExos();
    Promise.all([EXAPI.get(id), EXAPI.submissions(id)]).then(function(res){
      EXO.detail=(res[0]&&res[0].exercise)||null;
      EXO.subs=(res[1]&&res[1].items)||[];
      EXO.loading=false; renderExos();
    }).catch(function(e){ EXO.loading=false; EXO.error=exErr(e); renderExos(); toast('Erreur : '+exErr(e)); });
  }
  function loadStudentDetail(id){
    EXO.loading=true; EXO.detail=null; EXO.classmatesOpen=false; EXO.classmates=null; renderExos();
    EXAPI.mineDetail(id).then(function(r){ EXO.detail=(r&&r.exercise)||null; EXO.loading=false; renderExos(); })
      .catch(function(e){ EXO.loading=false; renderExos(); toast('Erreur : '+exErr(e)); });
  }

  // --- quiz builder helpers ---
  function syncDraftFromDOM(){
    var d=EXO.draft||(EXO.draft={});
    var t=$('#ex_title'); if(t) d.title=t.value;
    var c=$('#ex_consignes'); if(c) d.consignes=c.value;
    var cl=$('#ex_cls'); if(cl) d.cls=cl.value;
    var su=$('#ex_sub'); if(su) d.sub=su.value;
    var dl=$('#ex_deadline'); if(dl) d.deadline=dl.value;
  }
  function syncBuilderFromDOM(){
    var b=EXO.builder; if(!b) return;
    var dd=$('#ex_duree'); if(dd) b.duree_min=Math.max(0, parseInt(dd.value,10)||0);
    b.questions.forEach(function(q,i){
      var t=document.querySelector('[data-qtext="'+i+'"]'); if(t) q.text=t.value;
      var p=document.querySelector('[data-qpts="'+i+'"]'); if(p) q.points=Math.max(0, parseFloat(p.value)||0);
      if(q.type==='text'){ var ct=document.querySelector('[data-qcorrecttext="'+i+'"]'); if(ct) q.correct=ct.value; }
      else { (q.options||[]).forEach(function(o){ var oi=document.querySelector('[data-qopt="'+i+'|'+o.id+'"]'); if(oi) o.text=oi.value; }); }
    });
  }
  function serializeQuestions(){
    var b=EXO.builder||emptyBuilder();
    return b.questions.map(function(q){
      var o={ id:q.id, text:(q.text||'').trim(), type:q.type, points:q.points||0 };
      if(q.type==='text'){ o.correct=(q.correct||'').trim(); }
      else { o.options=(q.options||[]).map(function(x){ return { id:x.id, text:(x.text||'').trim() }; });
             o.correct=(q.correct||[]).slice(); }
      return o;
    });
  }
  function collectPayload(publish){
    syncDraftFromDOM();
    var d=EXO.draft||{};
    var payload={ type:EXO.type, title:(d.title||'').trim(), consignes:(d.consignes||'') };
    var cls=(DB.classes||[]).find(function(c){ return c.id===d.cls; });
    var cid=clsApiId(cls); if(cid!=null) payload.class_id=cid;
    var sub=(DB.subjects||[]).find(function(s){ return s.id===d.sub; });
    var sid=subApiId(sub); if(sid!=null) payload.subject_id=sid;
    if(d.deadline) payload.echeance=d.deadline;
    if(EXO.type==='pdf'){ if(d.pdf_data){ payload.pdf_data=d.pdf_data; payload.pdf_name=d.pdf_name||'exercice.pdf'; } }
    else { syncBuilderFromDOM(); payload.questions=serializeQuestions(); payload.duree_min=(EXO.builder&&EXO.builder.duree_min)||0; }
    if(publish) payload.publish=true;
    return payload;
  }
  function saveExercise(publish){
    var payload=collectPayload(publish);
    if(!payload.title){ toast('Donne un titre à l\'exercice.'); return; }
    if(payload.class_id==null){ toast('Choisis une classe.'); return; }
    if(EXO.type==='quiz' && (!payload.questions||!payload.questions.length)){ toast('Ajoute au moins une question.'); return; }
    if(EXO.type==='pdf' && publish && !payload.pdf_data){ toast('Joins le PDF de l\'énoncé avant de publier.'); return; }
    EXAPI.create(payload).then(function(){
      toast(publish?'Exercice publié & élèves notifiés ✓':'Brouillon enregistré ✓');
      EXO.view='list'; EXO.items=null; EXO.draft=null; EXO.builder=null;
      renderExos(); loadList();
    }).catch(function(e){ toast('Refusé : '+exErr(e)); });
  }

  // ====================================================================
  // CÂBLAGE (délégation d'événements sur #main)
  // ====================================================================
  function wireExos(){
    var main=$('#main'); if(!main) return;
    main.onclick=function(ev){
      var t=ev.target.closest('[data-exnew],[data-exback],[data-exopen],[data-extype],[data-exsave],'
        +'[data-qadd],[data-qdel],[data-qoptadd],[data-qoptdel],[data-exdel],[data-exdl],'
        +'[data-exdlenonce],[data-exupload],[data-exquiz],[data-exmates],[data-expreview],'
        +'[data-extdlteacher],[data-expublish],[data-exremind]');
      if(!t||!main.contains(t)) return;
      var a=t.attributes;
      if(t.hasAttribute('data-exnew')){ EXO.view='new'; EXO.type='pdf'; EXO.draft={}; EXO.builder=emptyBuilder(); renderExos(); return; }
      if(t.hasAttribute('data-exback')){ closePreview(); EXO.view='list'; EXO.detail=null; EXO.subs=null; EXO.classmatesOpen=false; renderExos(); return; }
      if(t.hasAttribute('data-exopen')){ var id=t.getAttribute('data-exopen'); EXO.current=id; EXO.view='detail';
        if(isTeacher()) loadTeacherDetail(id); else loadStudentDetail(id); return; }
      if(t.hasAttribute('data-extype')){ syncDraftFromDOM(); if(EXO.type==='quiz') syncBuilderFromDOM(); EXO.type=t.getAttribute('data-extype'); renderExos(); return; }
      if(t.hasAttribute('data-exsave')){ saveExercise(t.getAttribute('data-exsave')==='publish'); return; }
      if(t.hasAttribute('data-qadd')){ syncBuilderFromDOM(); EXO.builder.questions.push(newQuestion()); renderExos(); return; }
      if(t.hasAttribute('data-qdel')){ syncBuilderFromDOM(); EXO.builder.questions.splice(+t.getAttribute('data-qdel'),1); renderExos(); return; }
      if(t.hasAttribute('data-qoptadd')){ syncBuilderFromDOM(); var qi=+t.getAttribute('data-qoptadd'); var q=EXO.builder.questions[qi];
        q.options.push({ id:'o'+Date.now()+Math.floor(Math.random()*1000), text:'' }); renderExos(); return; }
      if(t.hasAttribute('data-qoptdel')){ syncBuilderFromDOM(); var pr=t.getAttribute('data-qoptdel').split('|'); var q2=EXO.builder.questions[+pr[0]];
        q2.options=q2.options.filter(function(o){ return o.id!==pr[1]; }); q2.correct=(q2.correct||[]).filter(function(c){ return c!==pr[1]; }); renderExos(); return; }
      if(t.hasAttribute('data-exdel')){ var did=t.getAttribute('data-exdel');
        if(!confirm('Supprimer définitivement cet exercice et ses soumissions ?')) return;
        EXAPI.del(did).then(function(){ toast('Exercice supprimé'); EXO.view='list'; EXO.items=null; renderExos(); loadList(); })
          .catch(function(e){ toast('Refusé : '+exErr(e)); }); return; }
      if(t.hasAttribute('data-exdl')){ var subId=t.getAttribute('data-exdl');
        EXAPI.subPdf(EXO.current, subId).then(function(r){ dlDataUrl(r.pdf_name, r.pdf_data); })
          .catch(function(e){ toast('Erreur : '+exErr(e)); }); return; }
      if(t.hasAttribute('data-exdlenonce')){ var eid=t.getAttribute('data-exdlenonce');
        EXAPI.minePdf(eid).then(function(r){ dlDataUrl(r.pdf_name, r.pdf_data); })
          .catch(function(e){ toast('Erreur : '+exErr(e)); }); return; }
      if(t.hasAttribute('data-extdlteacher')){ var exd=EXO.detail;
        if(exd&&exd.pdf_data){ dlDataUrl(exd.pdf_name, exd.pdf_data); } else { toast('Énoncé indisponible.'); } return; }
      if(t.hasAttribute('data-expublish')){ var pid=t.getAttribute('data-expublish'); t.disabled=true; t.textContent='Publication…';
        EXAPI.publish(pid).then(function(){ toast('Publié & élèves notifiés ✓'); EXO.items=null; loadTeacherDetail(pid); })
          .catch(function(e){ toast('Refusé : '+exErr(e)); if(t){ t.disabled=false; t.textContent='Publier & notifier les élèves'; } }); return; }
      if(t.hasAttribute('data-exremind')){ var rid=t.getAttribute('data-exremind'); var oldr=t.innerHTML; t.disabled=true; t.textContent='Envoi du rappel…';
        EXAPI.remind(rid).then(function(r){ var n=(r&&r.notifies)||0;
          toast(n>0?('Rappel envoyé à '+n+' élève'+(n>1?'s':'')+' ✓'):'Aucun élève à relancer ✓'); loadTeacherDetail(rid); })
          .catch(function(e){ toast('Refusé : '+exErr(e)); if(t){ t.disabled=false; t.innerHTML=oldr; } }); return; }
      if(t.hasAttribute('data-exupload')){ var uid=t.getAttribute('data-exupload'); var f=$('#stu_pdf');
        if(!f||!f.files||!f.files[0]){ toast('Choisis d\'abord ton fichier PDF.'); return; }
        var file=f.files[0]; if(file.size>8*1024*1024){ toast('Fichier trop lourd (8 Mo max).'); return; }
        t.disabled=true; t.textContent='Envoi…';
        readFileB64(file).then(function(b64){ return EXAPI.upload(uid,{ pdf_data:b64, pdf_name:file.name }); })
          .then(function(){ toast('Réponse envoyée ✓'); loadStudentDetail(uid); })
          .catch(function(e){ toast('Refusé : '+exErr(e)); if(t){ t.disabled=false; t.textContent='Envoyer ma réponse'; } }); return; }
      if(t.hasAttribute('data-exquiz')){ var quid=t.getAttribute('data-exquiz'); startQuiz(quid); return; }
      if(t.hasAttribute('data-expreview')){ openPreview(t.getAttribute('data-expreview')); return; }
      if(t.hasAttribute('data-exmates')){ var mid=t.getAttribute('data-exmates'); EXO.classmatesOpen=!EXO.classmatesOpen;
        if(EXO.classmatesOpen && EXO.classmates===null){ renderExos();
          EXAPI.classmates(mid).then(function(r){ EXO.classmates=(r&&r.items)||[]; renderExos(); })
            .catch(function(){ EXO.classmates=[]; renderExos(); }); }
        else renderExos(); return; }
    };
    main.onchange=function(ev){
      var el2=ev.target;
      if(el2.id==='ex_pdf'){ var f=el2.files&&el2.files[0]; if(!f) return;
        if(f.size>8*1024*1024){ toast('Fichier trop lourd (8 Mo max).'); el2.value=''; return; }
        syncDraftFromDOM(); if(EXO.type==='quiz') syncBuilderFromDOM();
        readFileB64(f).then(function(b64){ (EXO.draft||(EXO.draft={})).pdf_data=b64; EXO.draft.pdf_name=f.name; renderExos(); }); return; }
      if(el2.id==='stu_pdf'){ var sf=el2.files&&el2.files[0]; var lab=$('#stuPdfLabel'); if(lab&&sf) lab.textContent=sf.name; return; }
      if(el2.hasAttribute&&el2.hasAttribute('data-qtype')){ syncBuilderFromDOM(); var qi=+el2.getAttribute('data-qtype'); var q=EXO.builder.questions[qi];
        q.type=el2.value; if(q.type==='text'){ q.correct=''; } else { if(!q.options||q.options.length<2) q.options=[{id:'o1',text:''},{id:'o2',text:''}]; q.correct=[]; } renderExos(); return; }
      if(el2.hasAttribute&&el2.hasAttribute('data-qcorrect')){ syncBuilderFromDOM(); var pr=el2.getAttribute('data-qcorrect').split('|'); var qq=EXO.builder.questions[+pr[0]]; var oid=pr[1];
        if(qq.type==='single'){ qq.correct=[oid]; }
        else { var set=new Set(qq.correct||[]); if(el2.checked) set.add(oid); else set.delete(oid); qq.correct=Array.from(set); }
        renderExos(); return; }
    };
  }

  // Lancement du quiz anti-triche (moteur = Lot 3).
  function startQuiz(id){
    if(typeof window!=='undefined' && window.XSchoolQuiz && typeof window.XSchoolQuiz.start==='function'){
      try{ window.XSchoolQuiz.start(id, { onDone:function(){ loadStudentDetail(id); } }); return; }catch(e){}
    }
    toast('Le passage du quiz arrive très bientôt (prochain lot).');
  }

  function demoNoticeHTML(){
    return '<div class="mb-3"><p class="font-extrabold text-lg">Exercices</p></div>'
      + '<div class="rounded-2xl p-6 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 text-sm card-in">'
      + 'Le module Exercices fonctionne en mode connecté (données réelles). Connecte-toi à ton espace XSchool pour créer, recevoir et rendre des exercices.</div>';
  }
  function setTitle(){ var vt=$('#viewTitle'); if(vt) vt.textContent=(NAV.exos&&NAV.exos.t)||'Exercices'; }

  function renderExos(){
    var main=$('#main'); if(!main) return;
    if(typeof apiOn==='function' && !apiOn()){ main.innerHTML=demoNoticeHTML(); setTitle(); return; }
    var listView=(EXO.view!=='new'&&EXO.view!=='detail');
    if(listView && EXO.items===null && !EXO.loading && !EXO.error){ loadList(); return; }
    var html;
    if(isTeacher()){
      if(EXO.view==='new') html=teacherNewHTML();
      else if(EXO.view==='detail') html=teacherDetailHTML();
      else html=teacherListHTML();
    } else {
      if(EXO.view==='detail') html=studentDetailHTML();
      else html=studentListHTML();
    }
    main.innerHTML=html;
    try{ main.classList.remove('fade'); void main.offsetWidth; main.classList.add('fade'); }catch(e){}
    setTitle(); wireExos();
  }

  // ====================================================================
  // CLOCHE DE NOTIFICATIONS (topbar)
  // ====================================================================
  var _notifTimer=null;
  function canNotify(){ return (typeof apiOn==='function') && apiOn() && API.authenticated(); }

  function ensureBell(){
    if($('#notifBtn')) return;
    var host=$('#themeBtn'); if(!host||!host.parentNode) return;
    var btn=document.createElement('button');
    btn.id='notifBtn'; btn.type='button'; btn.title='Notifications';
    btn.className='relative w-10 h-10 grid place-items-center rounded-xl bg-white/70 dark:bg-slate-800 shadow-soft active:scale-95 transition';
    btn.innerHTML='<span class="w-[18px] h-[18px]">'+svg(I.bell)+'</span>'
      +'<span id="notifDot" class="hidden absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold grid place-items-center"></span>';
    host.parentNode.insertBefore(btn, host);
    btn.addEventListener('click', openNotif);
  }
  function ensurePanel(){
    var ex=$('#notifPanel'); if(ex) return ex;
    var wrap=document.createElement('div');
    wrap.id='notifPanel'; wrap.className='fixed inset-0 z-[70] hidden';
    wrap.innerHTML='<div id="notifScrim" class="absolute inset-0 bg-black/40"></div>'
      +'<div class="absolute top-0 right-0 h-full w-full max-w-sm bg-white dark:bg-slate-900 shadow-xl flex flex-col">'
      +'<div class="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">'
      +'<p class="font-extrabold">Notifications</p><div class="flex items-center gap-2">'
      +'<button id="notifReadAll" class="text-xs font-bold text-brand-600 dark:text-brand-300">Tout marquer lu</button>'
      +'<button id="notifClose" class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 grid place-items-center text-slate-500">✕</button>'
      +'</div></div><div id="notifList" class="flex-1 overflow-y-auto p-3 space-y-2"></div>'
      +'<div class="p-3 border-t border-slate-100 dark:border-slate-800"><button id="notifAll" type="button" class="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-bold text-brand-600 dark:text-brand-300 active:scale-95 transition">Voir tout l\'historique</button></div></div>';
    document.body.appendChild(wrap);
    $('#notifScrim').addEventListener('click', closeNotif);
    $('#notifClose').addEventListener('click', closeNotif);
    $('#notifAll').addEventListener('click', function(){ closeNotif(); if(typeof go==='function') go('notifs'); });
    $('#notifReadAll').addEventListener('click', function(){ EXAPI.notifRead(null).then(function(){ refreshNotifCount(); loadNotifList(); }).catch(function(){}); });
    $('#notifList').addEventListener('click', function(ev){
      var it=ev.target.closest('[data-notif]'); if(!it) return;
      var nid=+it.getAttribute('data-notif'); var ref=it.getAttribute('data-ref'); var rid=it.getAttribute('data-rid');
      EXAPI.notifRead([nid]).then(function(){ refreshNotifCount(); }).catch(function(){});
      if(ref==='exercise'){ closeNotif(); EXO.view=(rid?'detail':'list'); if(rid){ EXO.current=rid; } 
        if(typeof go==='function') go('exos');
        if(rid){ if(isTeacher()) loadTeacherDetail(rid); else loadStudentDetail(rid); } }
    });
    return wrap;
  }
  function openNotif(){ if(!canNotify()){ toast('Connecte-toi pour voir tes notifications.'); return; } ensurePanel().classList.remove('hidden'); loadNotifList(); }
  function closeNotif(){ var p=$('#notifPanel'); if(p) p.classList.add('hidden'); }
  function loadNotifList(){
    var box=$('#notifList'); if(!box) return;
    box.innerHTML='<p class="text-xs text-slate-400 text-center py-6">Chargement…</p>';
    EXAPI.notifList().then(function(r){
      var items=(r&&r.items)||[];
      if(!items.length){ box.innerHTML='<p class="text-sm text-slate-400 text-center py-8">Aucune notification.</p>'; return; }
      box.innerHTML=items.map(function(n){
        var unread=!n.lu;
        return '<button data-notif="'+n.id+'" data-ref="'+esc(n.ref_type||'')+'" data-rid="'+esc(n.ref_id!=null?n.ref_id:'')+'" '
          +'class="w-full text-left p-3 rounded-xl '+(unread?'bg-brand-50 dark:bg-brand-500/10':'bg-slate-50 dark:bg-slate-800/50')+' hover:ring-2 ring-brand-200 transition">'
          +'<div class="flex items-start gap-2">'+(unread?'<span class="w-2 h-2 rounded-full bg-brand-500 mt-1.5 shrink-0"></span>':'<span class="w-2 h-2 mt-1.5 shrink-0"></span>')
          +'<div class="min-w-0"><p class="text-sm font-bold truncate">'+esc(n.title||'')+'</p>'
          +'<p class="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">'+esc(n.body||'')+'</p>'
          +'<p class="text-[10px] text-slate-400 mt-1">'+esc(fmtDateTime(n.created_at))+'</p></div></div></button>';
      }).join('');
    }).catch(function(e){ box.innerHTML='<p class="text-sm text-rose-500 text-center py-6">'+esc(exErr(e))+'</p>'; });
  }
  function refreshNotifCount(){
    var dot=$('#notifDot'); if(!dot) return;
    if(!canNotify()){ dot.classList.add('hidden'); setAppBadge(0); return; }
    EXAPI.notifCount().then(function(r){ var n=(r&&r.unread)||0;
      if(n>0){ dot.textContent=(n>99?'99+':n); dot.classList.remove('hidden'); } else dot.classList.add('hidden');
      setAppBadge(n);
    }).catch(function(){});
  }

  // ---- Pastille sur l'icone de l'app (PWA) : navigator.setAppBadge ----------
  // Best-effort : silencieux si l'API n'existe pas (navigateur/OS non compatible,
  // app non installee). Ne bloque jamais le reste.
  function setAppBadge(n){
    try{
      if('setAppBadge' in navigator){
        if(n>0){ navigator.setAppBadge(n); }
        else if('clearAppBadge' in navigator){ navigator.clearAppBadge(); }
        else { navigator.setAppBadge(0); }
      }
    }catch(e){}
  }

  // ---- Toasts defilants a l'ecran pour les nouvelles notifications ----------
  // Empiles en haut a droite, glissent a l'entree, disparaissent apres ~6,5 s.
  // Un clic marque lu + ouvre l'exercice concerne.
  var _notifSeen=null;   // dict des ids deja montres (null = 1re passe => pas de spam)
  var _toastHost=null;
  function toastHost(){
    if(_toastHost&&document.body.contains(_toastHost)) return _toastHost;
    var h=document.createElement('div');
    h.id='notifToasts';
    h.className='fixed z-[80] top-3 right-3 left-3 sm:left-auto sm:w-80 flex flex-col gap-2 pointer-events-none';
    document.body.appendChild(h); _toastHost=h; return h;
  }
  function showNotifToast(n){
    var host=toastHost();
    var card=document.createElement('button');
    card.type='button';
    card.className='pointer-events-auto w-full text-left rounded-xl bg-slate-900/95 text-white shadow-soft px-3.5 py-3 translate-x-6 opacity-0 transition-all duration-300';
    card.innerHTML='<div class="flex items-start gap-2">'
      +'<span class="w-[18px] h-[18px] mt-0.5 shrink-0 text-brand-300">'+svg(I.bell)+'</span>'
      +'<div class="min-w-0"><p class="text-sm font-bold truncate">'+esc(n.title||'Notification')+'</p>'
      +'<p class="text-[12px] text-white/70 mt-0.5">'+esc(n.body||'')+'</p></div></div>';
    host.appendChild(card);
    // Limite a 4 toasts simultanes (retire les plus anciens).
    while(host.children.length>4){ host.removeChild(host.firstChild); }
    requestAnimationFrame(function(){ card.classList.remove('translate-x-6','opacity-0'); });
    var dead=false;
    function kill(){ if(dead) return; dead=true; card.classList.add('translate-x-6','opacity-0');
      setTimeout(function(){ if(card.parentNode) card.parentNode.removeChild(card); }, 320); }
    var to=setTimeout(kill, 6500);
    card.addEventListener('click', function(){ clearTimeout(to); kill();
      EXAPI.notifRead([n.id]).then(function(){ refreshNotifCount(); }).catch(function(){});
      if(n.ref_type==='exercise'){ var rid=(n.ref_id!=null?n.ref_id:''); closeNotif();
        EXO.view=(rid?'detail':'list'); if(rid){ EXO.current=rid; }
        if(typeof go==='function') go('exos');
        if(rid){ if(isTeacher()) loadTeacherDetail(rid); else loadStudentDetail(rid); } }
    });
  }
  // Recupere la liste, met a jour pastille + badge PWA, et fait defiler un toast
  // pour chaque nouvelle non-lue apparue depuis la derniere passe.
  function pollNotifs(){
    var dot=$('#notifDot');
    if(!canNotify()){ if(dot) dot.classList.add('hidden'); setAppBadge(0); return; }
    EXAPI.notifList().then(function(r){
      var items=(r&&r.items)||[]; var unread=(r&&r.unread)||0;
      if(dot){ if(unread>0){ dot.textContent=(unread>99?'99+':unread); dot.classList.remove('hidden'); } else dot.classList.add('hidden'); }
      setAppBadge(unread);
      var news=items.filter(function(n){ return !n.lu; });
      if(_notifSeen===null){ _notifSeen={}; news.forEach(function(n){ _notifSeen[n.id]=1; }); return; }
      // Du plus ancien au plus recent : empilement naturel (recent en bas).
      news.slice().reverse().forEach(function(n){ if(!_notifSeen[n.id]){ _notifSeen[n.id]=1; showNotifToast(n); } });
    }).catch(function(){});
  }

  function startNotifPolling(){ if(_notifTimer) return; pollNotifs();
    _notifTimer=setInterval(function(){ if(canNotify()) pollNotifs(); }, 60000); }

  // ====================================================================
  // VUE HISTORIQUE DES NOTIFICATIONS (page complete)
  // ====================================================================
  // Page dediee (menu lateral + lien « Voir tout » de la cloche) : liste
  // complete, filtre Toutes / Non lues, regroupement par jour, « tout marquer
  // lu », clic sur une notif d'exercice -> ouverture de l'exercice concerne.
  var NOTIF={ loading:false, items:null, unread:0, error:'', filter:'all' };

  // Teinte + picto par famille de kind (presentationnel, cale sur le catalogue backend).
  function notifTone(kind){
    kind=kind||'';
    if(kind==='grade_posted') return { icon:I.grade, cls:'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300' };
    if(kind==='exercise_reminder'||kind==='exercise_overdue') return { icon:I.clock, cls:'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300' };
    if(kind==='exercise_submission') return { icon:I.check, cls:'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300' };
    if(kind.indexOf('exercise')===0) return { icon:I.doc, cls:'bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300' };
    return { icon:I.bell, cls:'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300' };
  }
  function dayLabel(iso){
    if(!iso) return '';
    try{
      var d=new Date(iso); if(isNaN(d.getTime())) return '';
      var now=new Date();
      var a=new Date(d.getFullYear(),d.getMonth(),d.getDate());
      var b=new Date(now.getFullYear(),now.getMonth(),now.getDate());
      var diff=Math.round((b-a)/86400000);
      if(diff===0) return "Aujourd'hui";
      if(diff===1) return 'Hier';
      return d.toLocaleDateString('fr-FR',{ weekday:'long', day:'numeric', month:'long', year:'numeric' });
    }catch(e){ return ''; }
  }

  function notifSignInHTML(){
    return '<div class="mb-3"><p class="font-extrabold text-lg">Historique des notifications</p></div>'
      + '<div class="rounded-2xl p-6 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 text-sm card-in">'
      + 'Connecte-toi à ton espace XSchool pour consulter l\'historique de tes notifications.</div>';
  }
  function notifRowHTML(n){
    var unread=!n.lu; var ic=notifTone(n.kind);
    var clickable=(n.ref_type==='exercise');
    var tag=clickable?'button':'div';
    return '<'+tag+' '+(clickable?('type="button" data-notifopen="'+n.id+'" data-rid="'+esc(n.ref_id!=null?n.ref_id:'')+'" '):'')
      +'class="w-full text-left flex items-start gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 shadow-soft card-in '+(clickable?'hover:ring-2 ring-brand-200 transition':'')+'">'
      +'<span class="w-9 h-9 rounded-xl grid place-items-center shrink-0 '+ic.cls+'"><span class="w-[18px] h-[18px]">'+svg(ic.icon)+'</span></span>'
      +'<div class="min-w-0 flex-1">'
      +'<div class="flex items-center gap-2"><p class="text-sm font-bold truncate">'+esc(n.title||'')+'</p>'
      +(unread?'<span class="w-2 h-2 rounded-full bg-brand-500 shrink-0"></span>':'')+'</div>'
      +'<p class="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">'+esc(n.body||'')+'</p>'
      +'<p class="text-[10px] text-slate-400 mt-1">'+esc(fmtDateTime(n.created_at))+'</p>'
      +'</div></'+tag+'>';
  }
  function notifsHTML(){
    var head='<div class="mb-3 flex items-center justify-between gap-2 flex-wrap">'
      +'<p class="font-extrabold text-lg">Historique des notifications</p>'
      +'<button data-notifact="readall" class="'+EXBTN2+' inline-flex items-center gap-2"><span class="w-4 h-4">'+svg(I.check)+'</span>Tout marquer lu</button>'
      +'</div>';
    var f=NOTIF.filter;
    function tab(key,label){ return '<button data-notiffilter="'+key+'" class="px-3 py-1.5 rounded-xl text-sm font-bold '+(f===key?'bg-brand-600 text-white':'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300')+'">'+label+'</button>'; }
    var filters='<div class="flex items-center gap-2 mb-3">'+tab('all','Toutes')+tab('unread','Non lues')+'</div>';
    if(NOTIF.loading && NOTIF.items===null){ return head+filters+'<div class="rounded-2xl p-6 bg-white dark:bg-slate-900 shadow-soft text-center text-sm text-slate-400 card-in">Chargement…</div>'; }
    if(NOTIF.error){ return head+filters+'<div class="rounded-2xl p-6 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-300 text-sm card-in">'+esc(NOTIF.error)+'</div>'; }
    var items=NOTIF.items||[];
    if(!items.length){ return head+filters+'<div class="rounded-2xl p-8 bg-white dark:bg-slate-900 shadow-soft text-center text-sm text-slate-400 card-in">'+(f==='unread'?'Aucune notification non lue. 🎉':'Aucune notification pour le moment.')+'</div>'; }
    var body=''; var lastDay=null;
    items.forEach(function(n){
      var d=dayLabel(n.created_at);
      if(d!==lastDay){ lastDay=d; body+='<p class="text-xs font-bold text-slate-400 uppercase tracking-wide mt-4 mb-1.5 px-1">'+esc(d)+'</p>'; }
      body+=notifRowHTML(n);
    });
    return head+filters+'<div class="space-y-2">'+body+'</div>';
  }
  function loadNotifs(){
    NOTIF.loading=true; NOTIF.error='';
    EXAPI.notifHistory(NOTIF.filter==='unread').then(function(r){
      NOTIF.loading=false; NOTIF.items=(r&&r.items)||[]; NOTIF.unread=(r&&r.unread)||0; renderNotifs();
    }).catch(function(e){ NOTIF.loading=false; NOTIF.error=exErr(e); renderNotifs(); });
  }
  function wireNotifs(){
    var main=$('#main'); if(!main) return;
    main.querySelectorAll('[data-notiffilter]').forEach(function(b){
      b.addEventListener('click', function(){ var f=b.getAttribute('data-notiffilter'); if(f===NOTIF.filter) return;
        NOTIF.filter=f; NOTIF.items=null; NOTIF.error=''; renderNotifs(); });
    });
    var ra=main.querySelector('[data-notifact="readall"]');
    if(ra) ra.addEventListener('click', function(){ EXAPI.notifRead(null).then(function(){ refreshNotifCount(); NOTIF.items=null; loadNotifs(); }).catch(function(){ toast('Action impossible.'); }); });
    main.querySelectorAll('[data-notifopen]').forEach(function(b){
      b.addEventListener('click', function(){
        var nid=+b.getAttribute('data-notifopen'); var rid=b.getAttribute('data-rid');
        EXAPI.notifRead([nid]).then(function(){ refreshNotifCount(); }).catch(function(){});
        EXO.view=(rid?'detail':'list'); if(rid){ EXO.current=rid; }
        if(typeof go==='function') go('exos');
        if(rid){ if(isTeacher()) loadTeacherDetail(rid); else loadStudentDetail(rid); }
      });
    });
  }
  function renderNotifs(){
    var main=$('#main'); if(!main) return;
    var vt=$('#viewTitle'); if(vt) vt.textContent=(NAV.notifs&&NAV.notifs.t)||'Notifications';
    if((typeof apiOn==='function' && !apiOn()) || !canNotify()){ main.innerHTML=notifSignInHTML();
      try{ main.classList.remove('fade'); void main.offsetWidth; main.classList.add('fade'); }catch(e){} return; }
    if(NOTIF.items===null && !NOTIF.loading && !NOTIF.error){ loadNotifs(); }
    main.innerHTML=notifsHTML();
    try{ main.classList.remove('fade'); void main.offsetWidth; main.classList.add('fade'); }catch(e){}
    wireNotifs();
  }

  // ====================================================================
  // ENREGISTREMENT DU MENU + BRANCHEMENT DU RENDU
  // ====================================================================
  function registerMenu(){
    try{
      if(typeof NAV!=='undefined'){
        if(!NAV.exos){ NAV.exos={ t:'Exercices', i:I.doc }; }
        if(!NAV.notifs){ NAV.notifs={ t:'Notifications', i:I.bell }; }
      }
      if(typeof ROLES!=='undefined'){
        if(ROLES.teacher && ROLES.teacher.nav && ROLES.teacher.nav.indexOf('exos')<0){
          var tn=ROLES.teacher.nav; var gi=tn.indexOf('grades'); tn.splice(gi<0?tn.length:gi+1,0,'exos');
        }
        if(ROLES.student && ROLES.student.nav && ROLES.student.nav.indexOf('exos')<0){
          var sn=ROLES.student.nav; var bi=sn.indexOf('bulletin'); sn.splice(bi<0?sn.length:bi+1,0,'exos');
        }
        // Vue historique des notifications : juste apres 'exos' pour les roles
        // qui recoivent des notifications d'exercices (enseignant + eleve).
        ['teacher','student'].forEach(function(rk){
          var r=ROLES[rk];
          if(r && r.nav && r.nav.indexOf('notifs')<0){
            var i=r.nav.indexOf('exos'); r.nav.splice(i<0?r.nav.length:i+1,0,'notifs');
          }
        });
      }
    }catch(e){}
  }
  function patchRender(){
    if(typeof renderView==='function' && !renderView._exosPatched){
      var _orig=renderView;
      renderView=function(){
        if(typeof state!=='undefined' && state && state.view==='exos'){
          if(EXO._last!=='exos'){ EXO.view='list'; EXO.items=null; EXO.error=''; EXO.detail=null; EXO.subs=null; EXO.classmatesOpen=false; EXO.classmates=null; }
          EXO._last='exos'; return renderExos();
        }
        if(typeof state!=='undefined' && state && state.view==='notifs'){
          if(EXO._last!=='notifs'){ NOTIF.items=null; NOTIF.error=''; NOTIF.loading=false; }
          EXO._last='notifs'; return renderNotifs();
        }
        EXO._last=(typeof state!=='undefined'&&state)?state.view:'';
        return _orig.apply(this, arguments);
      };
      renderView._exosPatched=true;
      try{ window.renderView=renderView; }catch(e){}
    }
    // Rafraichir la cloche a chaque entree dans l'app.
    if(typeof enterApp==='function' && !enterApp._exosPatched){
      var _enter=enterApp;
      enterApp=function(){ var r=_enter.apply(this, arguments); try{ ensureBell(); startNotifPolling(); }catch(e){} return r; };
      enterApp._exosPatched=true;
      try{ window.enterApp=enterApp; }catch(e){}
    }
  }

  function init(){
    registerMenu();
    patchRender();
    try{ ensureBell(); }catch(e){}
    try{ ensurePanel(); }catch(e){}
    try{ startNotifPolling(); }catch(e){}
    // Si l'app est deja montee (hot-reload), rafraichir la nav.
    try{ if(typeof renderNav==='function' && $('#app') && !$('#app').classList.contains('hidden')) renderNav(); }catch(e){}
    // Reagir a l'expiration de session (nettoyage de la pastille).
    try{ window.addEventListener('xschool:auth-expired', function(){ var d=$('#notifDot'); if(d) d.classList.add('hidden'); closeNotif(); setAppBadge(0); _notifSeen=null; NOTIF.items=null; NOTIF.error=''; var h=$('#notifToasts'); if(h) h.innerHTML=''; }); }catch(e){}
  }

  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', init); }
  else { init(); }
})();
