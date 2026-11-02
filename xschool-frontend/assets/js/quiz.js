/*!
 * XSchool — Lot 3 : moteur de quiz anti-triche on-page.
 * Script classique (aucune IIFE exportée sauf window.XSchoolQuiz).
 * Dépend des globaux : API (api.js), toast (app.js), escH (core.js).
 * À charger APRÈS app.js et exercises.js.
 *
 * API publique :
 *   window.XSchoolQuiz.start(exId, { onDone:function(){...} })
 *
 * Principe anti-triche :
 *   - passage en plein écran ;
 *   - détection des SORTIES (onglet masqué, perte de focus, sortie du plein
 *     écran) : quota de 3 sorties, puis remise automatique de la copie ;
 *   - copier / coller / menu contextuel bloqués et journalisés (hors quota) ;
 *   - chaque incident est signalé au serveur (journal côté enseignant).
 *
 * Chrono COSMÉTIQUE : le serveur reste autoritaire (deadline_at figé au
 * démarrage). L'affichage part de remaining_seconds ; à l'expiration locale
 * on déclenche simplement la remise serveur (qui corrige la copie).
 *
 * iOS : pas de vrai plein écran ni d'haptique — on dégrade proprement, la
 * détection de sortie (visibilitychange / blur) reste active.
 */
;(function(){
  if(typeof window==='undefined') return;
  if(window.XSchoolQuiz && window.XSchoolQuiz.__v) return; // idempotent

  // --- Réglages ---
  var EXIT_QUOTA      = 3;     // nb de sorties tolérées : la 3e remet la copie
  var EXIT_COALESCE_MS = 1200; // fusion des événements de sortie rapprochés
  var AUTOSAVE_MS    = 600;    // anti-rebond de l'autosave
  var Z = 2147483000;         // au-dessus de tout le reste de l'app

  // --- Helpers sûrs (ne cassent pas si un global manque) ---
  function esc(v){ try{ return (typeof escH==='function')?escH(v):soft(v); }catch(e){ return soft(v); } }
  function soft(v){ return (''+(v==null?'':v)).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function toastSafe(m){ try{ if(typeof toast==='function'){ toast(m); return; } }catch(e){} }
  function api(){ try{ if(window.API) return window.API; }catch(e){} try{ return (typeof API!=='undefined')?API:null; }catch(e){} return null; }
  function noop(){}
  function buzz(ms){ try{ if(navigator && navigator.vibrate) navigator.vibrate(ms); }catch(e){} }

  // Mélange Fisher-Yates (copie, sans muter l'entrée).
  function shuffle(arr){
    var a=(arr||[]).slice(), i, j, t;
    for(i=a.length-1;i>0;i--){ j=Math.floor(Math.random()*(i+1)); t=a[i]; a[i]=a[j]; a[j]=t; }
    return a;
  }

  var S = null; // session active (une seule à la fois)

  // mm:ss
  function fmtMMSS(sec){
    sec=Math.max(0, sec|0);
    var m=Math.floor(sec/60), s=sec%60;
    return (m<10?'0':'')+m+':'+(s<10?'0':'')+s;
  }

  // ====================================================================
  // Normalisation des réponses (format serveur)
  //   single/multi -> tableau d'ids d'options ; text -> chaîne.
  // ====================================================================
  function emptyValue(q){ return (q.type==='text') ? '' : []; }

  function readPrefill(questions, answers){
    var out={};
    (questions||[]).forEach(function(q){
      var v=(answers||{})[q.id];
      if(q.type==='text'){ out[q.id]= (typeof v==='string')? v : ''; }
      else { out[q.id]= Array.isArray(v)? v.slice() : (v!=null?[v]:[]); }
    });
    return out;
  }

  // ====================================================================
  // Rendu HTML
  // ====================================================================
  function optRow(q, opt, idx){
    var name='xq_'+q.id;
    var type=(q.type==='multi')?'checkbox':'radio';
    var checked = (S.answers[q.id]||[]).indexOf(opt.id)>=0;
    return '<label class="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-brand-400 transition">'
      + '<input type="'+type+'" name="'+esc(name)+'" value="'+esc(opt.id)+'" '
      + 'data-qid="'+esc(q.id)+'" data-qtype="'+esc(q.type)+'" class="xq-input mt-0.5"'+(checked?' checked':'')+'>'
      + '<span class="text-sm">'+esc(opt.text||('Option '+(idx+1)))+'</span></label>';
  }

  function questionCard(q, n){
    var head='<div class="flex items-center justify-between mb-2">'
      + '<p class="font-bold text-sm">Question '+n+'</p>'
      + '<span class="text-[11px] text-slate-400">'+(q.points||0)+' pt'+((q.points||0)>1?'s':'')+'</span></div>';
    var body;
    if(q.type==='text'){
      var cur=(typeof S.answers[q.id]==='string')?S.answers[q.id]:'';
      body='<textarea data-qid="'+esc(q.id)+'" data-qtype="text" rows="3" '
        + 'class="xq-input w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent p-3 text-sm" '
        + 'placeholder="Ta réponse…">'+esc(cur)+'</textarea>';
    } else {
      var opts=shuffle(q.options||[]); // mélange des options aussi
      body='<div class="space-y-2">'+opts.map(function(o,i){ return optRow(q,o,i); }).join('')
        + '</div>'+(q.type==='multi'?'<p class="text-[10px] text-slate-400 mt-1">Plusieurs réponses possibles.</p>':'');
    }
    return '<div class="rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-soft">'
      + head+'<p class="text-sm mb-3 whitespace-pre-line">'+esc(q.text||'')+'</p>'+body+'</div>';
  }

  function shellHTML(ex){
    var qs=S.questions.map(function(q,i){ return questionCard(q,i+1); }).join('');
    var limited = (S.deadlineTs!=null);
    var chrono = limited
      ? '<span id="xqChrono" class="font-mono font-extrabold text-base tabular-nums">—:—</span>'
      : '<span class="text-[11px] text-slate-300">sans limite</span>';
    return ''
      + '<div class="min-h-full flex flex-col">'
      + '  <div class="sticky top-0 z-10 bg-slate-900 text-white px-4 py-3 flex items-center gap-3 shadow-lg">'
      + '    <div class="flex-1 min-w-0">'
      + '      <p class="font-extrabold truncate">'+esc(ex.title||'Quiz')+'</p>'
      + '      <p class="text-[11px] text-slate-300">Reste en plein écran · quitter la page compte comme une sortie ('+EXIT_QUOTA+' max).</p>'
      + '    </div>'
      + '    <div class="text-right"><p class="text-[10px] uppercase text-slate-400">Temps</p>'+chrono+'</div>'
      + '  </div>'
      + '  <div id="xqWarn" class="hidden px-4 py-2 text-sm font-semibold bg-amber-500 text-white text-center"></div>'
      + '  <div class="flex-1 overflow-y-auto px-4 py-4 space-y-3 max-w-2xl w-full mx-auto">'+qs
      + '    <div class="pt-2"><button id="xqSubmit" class="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-soft">Terminer et remettre</button>'
      + '    <p class="text-[11px] text-slate-400 text-center mt-2">Tes réponses sont enregistrées au fur et à mesure.</p></div>'
      + '  </div>'
      + '</div>';
  }

  // ====================================================================
  // Autosave (anti-rebond par question)
  // ====================================================================
  function scheduleSave(qid){
    if(!S) return;
    if(S.saveTimers[qid]) clearTimeout(S.saveTimers[qid]);
    S.saveTimers[qid]=setTimeout(function(){ flushSave(qid); }, AUTOSAVE_MS);
  }
  function flushSave(qid){
    if(!S || S.done) return;
    var a=api(); if(!a) return;
    var val=S.answers[qid];
    a.post('/api/me/exercises/'+encodeURIComponent(S.exId)+'/quiz/answer',
           { question_id:qid, value:val }).catch(function(e){
      // 409 = quiz terminé / expiré côté serveur : on finalise localement.
      if(e && (e.code==='quiz_termine' || e.code==='quiz_deja_soumis')) finalizeFromServer();
    });
  }

  function onInputChange(ev){
    if(!S || S.done) return;
    var t=ev.target; if(!t || !t.getAttribute) return;
    var qid=t.getAttribute('data-qid'); if(qid==null) return;
    var qtype=t.getAttribute('data-qtype');
    if(qtype==='text'){
      S.answers[qid]=t.value||'';
    } else if(qtype==='multi'){
      var picked=[];
      S.root.querySelectorAll('input[name="xq_'+cssEsc(qid)+'"]').forEach(function(i){ if(i.checked) picked.push(i.value); });
      S.answers[qid]=picked;
    } else { // single
      S.answers[qid]= t.checked ? [t.value] : [];
    }
    scheduleSave(qid);
  }

  // Échappe un id pour un sélecteur [name="xq_<id>"] (les ids quiz sont simples,
  // mais on reste prudent).
  function cssEsc(v){
    v=''+v;
    if(window.CSS && CSS.escape) return CSS.escape(v);
    return v.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  // ====================================================================
  // Chrono cosmétique
  // ====================================================================
  function tick(){
    if(!S || S.done || S.deadlineTs==null) return;
    var remain=Math.round((S.deadlineTs - Date.now())/1000);
    var elc=S.root.querySelector('#xqChrono');
    if(elc){
      elc.textContent=fmtMMSS(remain);
      if(remain<=30) elc.classList.add('text-rose-400');
    }
    if(remain<=0){
      warn('⏰ Temps écoulé — remise automatique de ta copie.');
      submitQuiz(true);
    }
  }

  // ====================================================================
  // Bandeau d'avertissement
  // ====================================================================
  function warn(msg){
    if(!S) return;
    var w=S.root.querySelector('#xqWarn');
    if(!w) return;
    w.textContent=msg;
    w.classList.remove('hidden');
    if(S.warnTimer) clearTimeout(S.warnTimer);
    S.warnTimer=setTimeout(function(){ try{ w.classList.add('hidden'); }catch(e){} }, 4000);
  }

  // ====================================================================
  // Incidents anti-triche
  // ====================================================================
  function reportIncident(type, detail){
    var a=api(); if(!a) return;
    var body={ type:type }; if(detail) body.detail=detail;
    a.post('/api/me/exercises/'+encodeURIComponent(S.exId)+'/quiz/incident', body).catch(noop);
  }

  // Une SORTIE (compte vers le quota) : onglet masqué / blur / sortie plein écran.
  function onExit(type){
    if(!S || S.done || S.submitting) return;
    var now=Date.now();
    // Ignorer les événements déclenchés par nos propres transitions plein écran.
    if(S.ignoreUntil && now < S.ignoreUntil) return;
    // Fusionner les événements rapprochés (blur + visibilitychange en rafale).
    if(S.lastExitTs && (now - S.lastExitTs) < EXIT_COALESCE_MS) return;
    S.lastExitTs=now;
    S.exitCount++;
    reportIncident(type);
    buzz(120);
    if(S.exitCount >= EXIT_QUOTA){
      warn('Trop de sorties ('+S.exitCount+'/'+EXIT_QUOTA+') — ta copie est remise automatiquement.');
      submitQuiz(true);
    } else {
      warn('⚠️ Sortie détectée ('+S.exitCount+'/'+EXIT_QUOTA+'). À '+EXIT_QUOTA+' sorties, la copie est remise.');
    }
  }

  // Incident SANS quota (copier / coller / menu contextuel) : bloqué + journalisé.
  function blockAndLog(type){
    return function(ev){
      if(!S || S.done) return;
      try{ ev.preventDefault(); }catch(e){}
      reportIncident(type);
      warn('Action bloquée pendant le quiz.');
    };
  }

  // ====================================================================
  // Plein écran (dégrade sur iOS : pas de requestFullscreen)
  // ====================================================================
  function fsElement(){ return document.fullscreenElement || document.webkitFullscreenElement || null; }
  function requestFS(node){
    var fn=node.requestFullscreen || node.webkitRequestFullscreen || node.msRequestFullscreen;
    if(!fn) return false;
    try{
      S.ignoreUntil=Date.now()+900; // la transition peut déclencher un blur parasite
      var p=fn.call(node);
      if(p && p.catch) p.catch(noop);
      return true;
    }catch(e){ return false; }
  }
  function exitFS(){
    if(!fsElement()) return;
    var fn=document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
    if(!fn) return;
    try{ S.ignoreUntil=Date.now()+900; var p=fn.call(document); if(p && p.catch) p.catch(noop); }catch(e){}
  }

  // ====================================================================
  // Écouteurs d'événements
  // ====================================================================
  function onVisibility(){ if(document.hidden) onExit('hidden'); }
  function onBlur(){ onExit('blur'); }
  function onFsChange(){
    if(!S || S.done) return;
    // Sortie du plein écran alors que le quiz tourne = une sortie.
    if(!fsElement() && S.wasFullscreen) onExit('fullscreen_exit');
    S.wasFullscreen=!!fsElement();
  }

  function bind(target, type, fn, opts){
    target.addEventListener(type, fn, opts||false);
    S.listeners.push([target, type, fn, opts||false]);
  }
  function attachListeners(){
    bind(document, 'visibilitychange', onVisibility);
    bind(window, 'blur', onBlur);
    bind(document, 'fullscreenchange', onFsChange);
    bind(document, 'webkitfullscreenchange', onFsChange);
    bind(S.root, 'change', onInputChange);
    bind(S.root, 'input', onInputChange);
    // Copier / coller / menu contextuel : bloqués + journalisés (hors quota).
    bind(S.root, 'copy', blockAndLog('copy'));
    bind(S.root, 'cut', blockAndLog('copy'));
    bind(S.root, 'paste', blockAndLog('paste'));
    bind(S.root, 'contextmenu', blockAndLog('contextmenu'));
  }
  function detachListeners(){
    (S.listeners||[]).forEach(function(l){ try{ l[0].removeEventListener(l[1], l[2], l[3]); }catch(e){} });
    S.listeners=[];
  }

  // ====================================================================
  // Remise de la copie
  // ====================================================================
  function submitQuiz(auto){
    if(!S || S.done || S.submitting) return;
    if(!auto){
      var ok=true;
      try{ ok=window.confirm('Remettre ta copie maintenant ? Tu ne pourras plus la modifier.'); }catch(e){}
      if(!ok) return;
    }
    S.submitting=true;
    var btn=S.root.querySelector('#xqSubmit');
    if(btn){ btn.disabled=true; btn.textContent=auto?'Remise automatique…':'Remise en cours…'; }
    // Purge des autosaves en attente (le submit renvoie de toute façon tout).
    try{ Object.keys(S.saveTimers).forEach(function(k){ clearTimeout(S.saveTimers[k]); }); }catch(e){}
    var a=api();
    if(!a){ S.submitting=false; return; }
    a.post('/api/me/exercises/'+encodeURIComponent(S.exId)+'/quiz/submit',
           { answers:S.answers }).then(function(resp){
      showResult((resp&&resp.submission)||{}, auto || !!(resp&&resp.auto));
    }).catch(function(e){
      if(e && (e.code==='quiz_termine' || e.code==='quiz_deja_soumis')){ finalizeFromServer(); return; }
      S.submitting=false;
      if(btn){ btn.disabled=false; btn.textContent='Terminer et remettre'; }
      toastSafe('Remise impossible : '+((e&&e.message)||'erreur')+'. Réessaie.');
    });
  }

  // Le serveur a déjà clôturé (expiration) : on récupère l'état final.
  function finalizeFromServer(){
    var a=api();
    if(!a){ showResult({}, true); return; }
    a.get('/api/me/exercises/'+encodeURIComponent(S.exId)).then(function(resp){
      var ex=(resp&&resp.exercise)||{};
      showResult(ex.submission||{}, true);
    }).catch(function(){ showResult({}, true); });
  }

  // ====================================================================
  // Écran de résultat + fermeture
  // ====================================================================
  function showResult(sub, auto){
    if(!S) return;
    S.done=true;
    stopTimers();
    detachListeners();
    exitFS();
    var graded=(sub && sub.note!=null);
    var noteMax=(sub && sub.note_max!=null)?sub.note_max:null;
    var head = auto ? 'Copie remise automatiquement' : 'Copie remise ✓';
    var scoreBlock = graded
      ? '<p class="text-4xl font-extrabold mt-2">'+esc(sub.note)+'<span class="text-slate-400 text-xl">/'+esc(noteMax!=null?noteMax:'?')+'</span></p>'
      : '<p class="text-sm text-slate-500 mt-2">Ta copie a bien été enregistrée.</p>';
    var incidents = (sub && sub.incident_count) ? sub.incident_count : 0;
    var incBlock = incidents
      ? '<p class="text-[11px] text-amber-600 dark:text-amber-300 mt-2">'+incidents+' incident'+(incidents>1?'s':'')+' enregistré'+(incidents>1?'s':'')+' pendant le quiz.</p>'
      : '';
    S.root.innerHTML='<div class="min-h-full grid place-items-center p-6">'
      + '<div class="rounded-2xl p-8 bg-white dark:bg-slate-900 shadow-soft text-center max-w-sm w-full">'
      + '<div class="w-14 h-14 rounded-full '+(auto?'bg-amber-100 text-amber-600':'bg-emerald-100 text-emerald-600')+' grid place-items-center mx-auto text-2xl">'+(auto?'⏱':'✓')+'</div>'
      + '<p class="font-extrabold text-lg mt-3">'+esc(head)+'</p>'
      + scoreBlock + incBlock
      + '<button id="xqClose" class="w-full mt-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold">Fermer</button>'
      + '</div></div>';
    var cb=S.root.querySelector('#xqClose');
    if(cb) cb.addEventListener('click', closeSession);
  }

  function stopTimers(){
    if(!S) return;
    if(S.tickTimer){ clearInterval(S.tickTimer); S.tickTimer=null; }
    if(S.warnTimer){ clearTimeout(S.warnTimer); S.warnTimer=null; }
    try{ Object.keys(S.saveTimers).forEach(function(k){ clearTimeout(S.saveTimers[k]); }); }catch(e){}
    S.saveTimers={};
  }

  function closeSession(){
    if(!S) return;
    var done=S.onDone;
    stopTimers();
    detachListeners();
    exitFS();
    try{ if(S.overlay && S.overlay.parentNode) S.overlay.parentNode.removeChild(S.overlay); }catch(e){}
    S=null;
    if(typeof done==='function'){ try{ done(); }catch(e){} }
  }

  // ====================================================================
  // API publique : window.XSchoolQuiz.start(exId, { onDone })
  // ====================================================================
  function start(exId, opts){
    opts=opts||{};
    if(S){ toastSafe('Un quiz est déjà en cours.'); return; }
    var a=api();
    if(!a || !a.enabled || !a.enabled()){ toastSafe('Connecte-toi pour passer le quiz.'); return; }
    if(a.authenticated && !a.authenticated()){ toastSafe('Session expirée, reconnecte-toi.'); return; }

    a.post('/api/me/exercises/'+encodeURIComponent(exId)+'/quiz/start', {}).then(function(resp){
      var ex=(resp&&resp.exercise)||{};
      var sub=(resp&&resp.submission)||{};
      var remaining=(resp&&typeof resp.remaining_seconds==='number')?resp.remaining_seconds:null;
      var questions=shuffle(ex.questions||[]); // mélange des questions

      S={
        exId:exId, onDone:opts.onDone,
        exercise:ex, questions:questions,
        answers:readPrefill(questions, sub.answers),
        deadlineTs:(remaining!=null)?(Date.now()+remaining*1000):null,
        exitCount:0, lastExitTs:0, ignoreUntil:0,
        done:false, submitting:false, wasFullscreen:false,
        saveTimers:{}, listeners:[], tickTimer:null, warnTimer:null,
        overlay:null, root:null
      };

      var overlay=document.createElement('div');
      overlay.className='fixed inset-0 bg-slate-100 dark:bg-slate-950 overflow-y-auto';
      overlay.style.zIndex=String(Z);
      overlay.setAttribute('role','dialog');
      overlay.setAttribute('aria-modal','true');
      S.overlay=overlay; S.root=overlay;
      overlay.innerHTML=shellHTML(ex);
      document.body.appendChild(overlay);

      var sb=overlay.querySelector('#xqSubmit');
      if(sb) sb.addEventListener('click', function(){ submitQuiz(false); });

      attachListeners();
      requestFS(overlay);
      S.tickTimer=setInterval(tick, 1000);
      tick();
    }).catch(function(e){
      var code=e&&e.code;
      if(code==='quiz_termine' || code==='quiz_deja_soumis'){
        toastSafe('Ce quiz est déjà terminé.');
        if(typeof opts.onDone==='function'){ try{ opts.onDone(); }catch(x){} }
        return;
      }
      if(code==='compte_non_lie_eleve'){ toastSafe('Ton compte n\'est pas relié à une fiche élève.'); return; }
      if(code==='exercice_non_assigne'){ toastSafe('Ce quiz ne t\'est pas attribué.'); return; }
      if(code==='exercice_introuvable'){ toastSafe('Quiz introuvable.'); return; }
      toastSafe('Impossible de démarrer le quiz : '+((e&&e.message)||'erreur')+'.');
    });
  }

  window.XSchoolQuiz={ __v:1, start:start };

})();
