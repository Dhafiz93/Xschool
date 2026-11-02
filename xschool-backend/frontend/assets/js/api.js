/*
 * XSchool — client API (fetch + JWT Bearer).
 * Script classique, portee globale partagee : expose window.API.
 * Charge APRES core.js et AVANT data.js.
 *
 * L'API n'est ACTIVE que si une base est configuree, par ordre de priorite :
 *   1) window.XSCHOOL_API_BASE
 *   2) <meta name="xschool-api" content="https://...">
 *   3) localStorage['xschool-api-base']
 * Sans base configuree, API.enabled() renvoie false et le prototype
 * reste 100% hors-ligne (donnees de demo en memoire).
 *
 * Endpoints backend (Flask) couverts :
 *   POST   /auth/login            -> {access_token, user}
 *   GET    /auth/me               -> {user}
 *   POST   /auth/change-password  <- {old_password, new_password}
 *   GET    /api/schools           -> {items:[{id,name,slug,active}]}        (superadmin)
 *   POST   /api/schools           -> {school}                               (superadmin)
 *   GET    /api/classes           -> {items:[{id,cycle,name,grp,spec}]}     (admin, scope school_id)
 *   POST   /api/classes           -> {klass}                               (admin)
 *   DELETE /api/classes/<id>      -> {status:'ok'}                          (admin)
 *   GET    /api/stats/global      -> {year,scope,total,...,rows:[...]}      (staff, scope school_id)
 *   GET    /api/stats/class/<id>  -> {year,scope,total,...,list:[...]}      (staff, scope school_id)
 *   GET    /api/bulletins/class/<id> -> {year,periods,subjects,students,...}  (staff, scope school_id)
 */
;(function(){
  'use strict';

  var LS_TOKEN = 'xschool-token';
  var LS_BASE  = 'xschool-api-base';
  var LS_USER  = 'xschool-user';

  function metaBase(){
    try{ var m=document.querySelector('meta[name="xschool-api"]'); return (m&&m.content)?m.content.trim():''; }
    catch(e){ return ''; }
  }
  function base(){
    var b='';
    try{ if(typeof window!=='undefined' && window.XSCHOOL_API_BASE) b=String(window.XSCHOOL_API_BASE).trim(); }catch(e){}
    if(!b) b=metaBase();
    if(!b){ try{ b=(localStorage.getItem(LS_BASE)||'').trim(); }catch(e){} }
    return b.replace(/\/+$/,'');
  }
  function setBase(url){ try{ if(url) localStorage.setItem(LS_BASE,String(url).trim()); else localStorage.removeItem(LS_BASE); }catch(e){} }
  function enabled(){ return !!base(); }

  function token(){ try{ return localStorage.getItem(LS_TOKEN)||''; }catch(e){ return ''; } }
  function setToken(t){ try{ if(t) localStorage.setItem(LS_TOKEN,t); else localStorage.removeItem(LS_TOKEN); }catch(e){} }

  function user(){ try{ var s=localStorage.getItem(LS_USER); return s?JSON.parse(s):null; }catch(e){ return null; } }
  function setUser(u){ try{ if(u) localStorage.setItem(LS_USER,JSON.stringify(u)); else localStorage.removeItem(LS_USER); }catch(e){} }

  // Construit une query-string a partir d'un objet (ignore null/''/undefined).
  function qs(params){
    if(!params) return '';
    var parts=[];
    for(var k in params){ if(!Object.prototype.hasOwnProperty.call(params,k)) continue;
      var v=params[k]; if(v===null||v===undefined||v==='') continue;
      parts.push(encodeURIComponent(k)+'='+encodeURIComponent(v)); }
    return parts.length?('?'+parts.join('&')):'';
  }

  // Requete generique. auth=false pour les routes publiques (login).
  async function req(method, path, body, auth){
    var b=base();
    if(!b){ var e0=new Error('API non configuree'); e0.code='no_api'; throw e0; }
    var headers={ 'Accept':'application/json' };
    if(body!=null) headers['Content-Type']='application/json';
    if(auth!==false){ var t=token(); if(t) headers['Authorization']='Bearer '+t; }
    var res;
    try{
      res=await fetch(b+path, { method:method, headers:headers, body:(body!=null?JSON.stringify(body):undefined) });
    }catch(err){ var e1=new Error('Reseau indisponible'); e1.code='network'; throw e1; }
    var data=null; var ct=(res.headers.get('content-type')||'');
    if(ct.indexOf('application/json')>=0){ try{ data=await res.json(); }catch(e){} }
    else { try{ data=await res.text(); }catch(e){} }
    if(!res.ok){
      var code=(data&&data.error)||'';
      var msg=(data&&data.message)||(data&&data.error)||('Erreur '+res.status);
      // Session JWT expiree / absente / invalide : on nettoie la session locale et
      // on signale globalement pour renvoyer l'utilisateur vers l'ecran de connexion.
      if((res.status===401||res.status===422) && (code==='token_expire'||code==='token_absent'||code==='token_invalide')){
        msg=(code==='token_invalide')?'Session invalide, reconnecte-toi.':'Session expiree, reconnecte-toi.';
        try{ setToken(''); setUser(null); }catch(e){}
        try{ if(typeof window!=='undefined' && window.dispatchEvent){ window.dispatchEvent(new CustomEvent('xschool:auth-expired',{ detail:{ code:code } })); } }catch(e){}
      }
      var e2=new Error(msg); e2.status=res.status; e2.code=code; e2.data=data; throw e2;
    }
    return data;
  }

  var API={
    // --- config / etat ---
    base: base, setBase: setBase, enabled: enabled,
    token: token, setToken: setToken,
    user: user, setUser: setUser,
    authenticated: function(){ return !!token(); },

    // --- verbes generiques (chemin relatif a la base, ex: '/api/students') ---
    get:  function(p){ return req('GET', p); },
    post: function(p,b){ return req('POST', p, b); },
    del:  function(p){ return req('DELETE', p); },

    // --- auth ---
    // `identifier` accepte l'email OU le login.
    async login(identifier, password){
      var d=await req('POST','/auth/login',{ identifiant:identifier, password:password }, false);
      if(d && d.access_token){ setToken(d.access_token); setUser(d.user||null); }
      return d; // {access_token, user}
    },
    me: function(){ return req('GET','/auth/me'); }, // {user}
    changePassword: function(oldPassword, newPassword){
      return req('POST','/auth/change-password',{ old_password:oldPassword, new_password:newPassword });
    },
    logout: function(){ setToken(''); setUser(null); },

    // --- etablissements (superadmin) ---
    // Liste PUBLIQUE des etablissements actifs (pre-login, sans JWT).
    publicSchools: function(){ return req('GET','/auth/schools', null, false); }, // {items:[{id,name,slug}]}
    listSchools: function(){ return req('GET','/api/schools'); },          // {items:[...]}
    // Etablissement du compte connecte (tout role). -> {school} ou {school:null}
    currentSchool: function(){ return req('GET','/api/schools/current'); },
    // Sauvegarde les reglages (config) de l'etablissement de l'admin connecte.
    // payload: { config:{...}, name?:string } ou directement les cles de config. -> {school}
    updateCurrentSchoolConfig: function(payload){ return req('PUT','/api/schools/current/config', payload||{}); },
    // Variante superadmin : config d'une ecole precise. -> {school}
    updateSchoolConfig: function(sid, payload){ return req('PUT','/api/schools/'+encodeURIComponent(sid)+'/config', payload||{}); },
    // payload: { name, slug?, admin?:{ full_name, email, login?, password } }
    createSchool: function(payload){ return req('POST','/api/schools', payload||{}); }, // {school, admin?}
    // Ajoute un administrateur a une ecole existante.
    // payload: { full_name, email, login?, password }
    createSchoolAdmin: function(sid, payload){ return req('POST','/api/schools/'+encodeURIComponent(sid)+'/admin', payload||{}); }, // {admin}

    // --- utilisateurs (comptes) ---
    // superadmin : params {school_id} pour ne voir qu'une ecole (sinon toutes).
    // admin : toujours confine a son ecole (le param est ignore cote serveur).
    listUsers: function(params){ return req('GET','/api/users'+qs(params)); },   // {items:[...]}
    // Cree un compte avec mot de passe (admin -> sa propre ecole).
    // payload: { full_name, email, password, role?, login?, school_id? } -> {user}
    createUser: function(payload){ return req('POST','/api/users', payload||{}); },
    // Active/desactive un compte : payload {active:bool}. -> {user}
    updateUser: function(id, payload){ return req('PATCH','/api/users/'+encodeURIComponent(id), payload||{}); },
    // Supprime un compte. -> {status:'ok', id}
    deleteUser: function(id){ return req('DELETE','/api/users/'+encodeURIComponent(id)); },

    // --- classes (admin, scope school_id) ---
    listClasses: function(){ return req('GET','/api/classes'); },          // {items:[...]}
    createClass: function(payload){ return req('POST','/api/classes', payload||{}); }, // {klass}
    updateClass: function(id,payload){ return req('PUT','/api/classes/'+encodeURIComponent(id), payload||{}); }, // {klass} (ex: titulaire_id)
    deleteClass: function(id){ return req('DELETE','/api/classes/'+encodeURIComponent(id)); }, // {status}
    classCards: function(id){ return req('GET','/api/classes/'+encodeURIComponent(id)+'/cards'); }, // {school,klass,year,cards:[...]}

    // --- eleves (scope school_id) ---
    listStudents: function(params){ return req('GET','/api/students'+qs(params)); },        // {items:[...]}
    getStudent: function(id){ return req('GET','/api/students/'+encodeURIComponent(id)); },  // {student}
    createStudent: function(payload){ return req('POST','/api/students', payload||{}); },    // {student}
    updateStudent: function(id,payload){ return req('PUT','/api/students/'+encodeURIComponent(id), payload||{}); }, // {student}
    deleteStudent: function(id){ return req('DELETE','/api/students/'+encodeURIComponent(id)); }, // {status}
    upsertEnrollment: function(id,payload){ return req('POST','/api/students/'+encodeURIComponent(id)+'/enrollments', payload||{}); }, // {enrollment}

    // --- enseignants ---
    listTeachers: function(){ return req('GET','/api/teachers'); },                          // {items:[...]}
    createTeacher: function(payload){ return req('POST','/api/teachers', payload||{}); },     // {teacher}
    updateTeacher: function(id,payload){ return req('PUT','/api/teachers/'+encodeURIComponent(id), payload||{}); }, // {teacher}
    deleteTeacher: function(id){ return req('DELETE','/api/teachers/'+encodeURIComponent(id)); }, // {status}

    // --- matieres ---
    listSubjects: function(){ return req('GET','/api/subjects'); },                          // {items:[...]}
    createSubject: function(payload){ return req('POST','/api/subjects', payload||{}); },     // {subject}
    updateSubject: function(id,payload){ return req('PUT','/api/subjects/'+encodeURIComponent(id), payload||{}); }, // {subject}
    deleteSubject: function(id){ return req('DELETE','/api/subjects/'+encodeURIComponent(id)); }, // {status}

    // --- programme (matiere x classe) ---
    listPrograms: function(params){ return req('GET','/api/programs'+qs(params)); },         // {items:[...]}
    createProgram: function(payload){ return req('POST','/api/programs', payload||{}); },     // {program}
    updateProgram: function(id,payload){ return req('PUT','/api/programs/'+encodeURIComponent(id), payload||{}); }, // {program}
    deleteProgram: function(id){ return req('DELETE','/api/programs/'+encodeURIComponent(id)); }, // {status}

    // --- notes ---
    listGrades: function(params){ return req('GET','/api/grades'+qs(params)); },             // {items:[...]}
    saveGrades: function(payload){ return req('POST','/api/grades', payload||{}); },         // {grade} ou {items:[...]}
    deleteGrade: function(id){ return req('DELETE','/api/grades/'+encodeURIComponent(id)); }, // {status}
    // Import / export Excel des notes (modele .xlsx telecharge puis re-televerse).
    gradesTemplate: function(params){ return req('GET','/api/grades/template'+qs(params)); }, // {filename,mime,data_b64,count}
    gradesImport: function(payload){ return req('POST','/api/grades/import', payload||{}); }, // {items,saved,skipped}

    // --- espace eleve : vue agregee en lecture seule du compte connecte ---
    overview: function(){ return req('GET','/api/me/overview'); }, // {student,classes,programs,subjects,grades,attendance,payments}

    // --- appel / presences ---
    listAttendance: function(params){ return req('GET','/api/attendance'+qs(params)); },     // {items:[...]}
    saveAttendance: function(payload){ return req('POST','/api/attendance', payload||{}); }, // {attendance} ou {items:[...]}
    deleteAttendance: function(id){ return req('DELETE','/api/attendance/'+encodeURIComponent(id)); }, // {status}

    // --- pointage enseignants ---
    listTeacherAttendance: function(params){ return req('GET','/api/teacher-attendance'+qs(params)); },     // {items:[...]}
    saveTeacherAttendance: function(payload){ return req('POST','/api/teacher-attendance', payload||{}); }, // {attendance} ou {items:[...]}
    deleteTeacherAttendance: function(id){ return req('DELETE','/api/teacher-attendance/'+encodeURIComponent(id)); }, // {status}

    // --- discipline ---
    listDiscipline: function(params){ return req('GET','/api/discipline'+qs(params)); },     // {items:[...]}
    createDiscipline: function(payload){ return req('POST','/api/discipline', payload||{}); }, // {discipline}
    deleteDiscipline: function(id){ return req('DELETE','/api/discipline/'+encodeURIComponent(id)); }, // {status}

    // --- paiements ---
    listPayments: function(params){ return req('GET','/api/payments'+qs(params)); },         // {items:[...]}
    createPayment: function(payload){ return req('POST','/api/payments', payload||{}); },     // {payment}
    deletePayment: function(id){ return req('DELETE','/api/payments/'+encodeURIComponent(id)); }, // {status}

    // --- journal d'audit (lecture seule) ---
    listLogs: function(params){ return req('GET','/api/logs'+qs(params)); },                 // {items:[...]}

    // --- notifications WhatsApp / SMS (passerelle serveur) ---
    // Etat de la passerelle + canaux actives de l'ecole.
    // -> {gateway:{provider,configured,whatsapp,sms,simulation}, school:{...}, can_send}
    notifyStatus: function(){ return req('GET','/api/notify/status'); },
    // Envoie un message a une cible via le serveur (sans clic du destinataire).
    // payload: { channel:'whatsapp'|'sms', message, target:'all|class|nouveaux|redoublants|teachers', class_id?, year? }
    // -> {status,channel,target,provider,simulation,total,sans_numero,sent,simulated,failed,recipients:[...]}
    notifySend: function(payload){ return req('POST','/api/notify/send', payload||{}); },

    // --- notifications en page (cloche) de l'utilisateur connecte ---
    // Liste des notifications (option {unread:1, limit:N}). -> {items:[...],unread}
    notifications: function(params){ return req('GET','/api/notifications'+qs(params)); },
    // Nombre de non-lues, pour la pastille. -> {unread}
    notificationsCount: function(){ return req('GET','/api/notifications/count'); },
    // Marque lues : ids = tableau pour un sous-ensemble, sinon toutes. -> {ok,marked}
    notificationsRead: function(ids){ return req('POST','/api/notifications/read', (ids&&ids.length)?{ids:ids}:{}); },

    // --- notifications push (jetons d'appareil : PWA / mobile) ---
    // Enregistre/reactive le jeton de cet appareil. -> {ok}
    pushSubscribe: function(token,platform){ return req('POST','/api/push/subscribe', { token:token, platform:platform||'web' }); },
    // Desinscrit ce jeton (desactive cote serveur). -> {ok}
    pushUnsubscribe: function(token){ return req('POST','/api/push/unsubscribe', { token:token }); },
    // Etat du transport push (diagnostic, sans secret). -> {provider,configured,...}
    pushStatus: function(){ return req('GET','/api/push/status'); },

    // --- statistiques de resultats (calcul serveur) ---
    statsGlobal: function(params){ return req('GET','/api/stats/global'+qs(params)); },      // {year,scope,total,...,rows:[...]}
    statsClass: function(id,params){ return req('GET','/api/stats/class/'+encodeURIComponent(id)+qs(params)); }, // {year,scope,total,...,list:[...]}
    statsSynthesis: function(params){ return req('GET','/api/stats/synthesis'+qs(params)); }, // {year,scope,classes,...,rows:[...]}

    // --- supervision : connexions (reussite/echec/causes) + comptes par profil ---
    statsConnexions: function(params){ return req('GET','/api/stats/connexions'+qs(params)); }, // {jours,global:{...},etablissements:[...]}
    statsUsers: function(params){ return req('GET','/api/stats/users'+qs(params)); },           // {total,global:{<role>:n},etablissements:[...]}

    // --- bulletins annuels (agregation periodes + annuel + rangs, miroir serveur) ---
    bulletinYear: function(id,params){ return req('GET','/api/bulletins/class/'+encodeURIComponent(id)+qs(params)); }, // {year,periods,subjects,students:[...],periodStats,annualStats}

    // --- rendu PDF 100% serveur (WeasyPrint). Renvoie un Blob telechargeable. ---
    // Le client envoie le HTML de l'apercu ; le serveur fait la mise en page.
    async renderPdf(html, filename){
      var b=base(); if(!b){ var e0=new Error('API non configuree'); e0.code='no_api'; throw e0; }
      var headers={ 'Accept':'application/pdf', 'Content-Type':'application/json' };
      var t=token(); if(t) headers['Authorization']='Bearer '+t;
      var res;
      try{ res=await fetch(b+'/api/print/pdf', { method:'POST', headers:headers, body:JSON.stringify({ html:html, filename:filename||'' }) }); }
      catch(err){ var e1=new Error('Reseau indisponible'); e1.code='network'; throw e1; }
      if(!res.ok){
        var msg='Erreur '+res.status;
        try{ var j=await res.json(); if(j&&(j.error||j.detail)) msg=(j.error||'')+(j.detail?(' : '+j.detail):''); }catch(e){}
        var e2=new Error(msg); e2.status=res.status; throw e2;
      }
      return await res.blob();
    }
  };

  try{ window.API=API; }catch(e){}
})();
