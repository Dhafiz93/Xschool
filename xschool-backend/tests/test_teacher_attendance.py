#!/usr/bin/env python
"""Tests de validation de l'API de POINTAGE ENSEIGNANT (/api/teacher-attendance).

Ce script verifie de bout en bout le modele + l'API ajoutes pour persister le
pointage des enseignants (present | retard | absent) par (enseignant, date).

Il fonctionne de deux facons :
  * avec pytest      ->  pytest tests/test_teacher_attendance.py
  * en autonome      ->  python tests/test_teacher_attendance.py

Principes :
  * Utilise le client de test Flask (AUCUN serveur a lancer).
  * Tourne sur la base configuree par TestingConfig (TEST_DATABASE_URL,
    sinon xschool_test en local). PostgreSQL requis : les modeles utilisent
    JSONB, SQLite ne convient pas.
  * NON destructif : cree un etablissement de test au slug unique puis le
    supprime a la fin (cascade). Tes donnees existantes ne sont pas touchees.
  * db.create_all() est idempotent : ne cree que les tables manquantes.

Prerequis : une base PostgreSQL de test accessible. Exemple :
  export TEST_DATABASE_URL=postgresql+psycopg://xschool:xschool@localhost:5432/xschool_test
"""
import os
import sys
import uuid

# Rendre le paquet `app` importable quand on lance le script directement.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import TestingConfig  # noqa: E402
from app import create_app  # noqa: E402
from app.extensions import db  # noqa: E402
from app.models.people import Teacher  # noqa: E402
from app.models.school import School  # noqa: E402
from app.models.user import ROLE_ADMIN, User  # noqa: E402


def _seed():
    """Cree un etablissement isole + un admin + un enseignant. Renvoie un dict."""
    tag = uuid.uuid4().hex[:8]
    school = School(name=f"Ecole Test {tag}", slug=f"test-{tag}")
    db.session.add(school)
    db.session.flush()

    admin = User(
        email=f"admin.{tag}@test.local", role=ROLE_ADMIN,
        full_name="Admin Test", school_id=school.id,
    )
    admin.set_password("test1234")
    db.session.add(admin)

    teacher = Teacher(school_id=school.id, nom="Kodjo", prenom="Ama", spec="Maths")
    db.session.add(teacher)
    db.session.commit()
    return {
        "school_id": school.id,
        "email": admin.email,
        "password": "test1234",
        "teacher_id": teacher.id,
    }


def _login(client, email, password):
    r = client.post("/auth/login", json={"identifiant": email, "password": password})
    assert r.status_code == 200, f"login echoue: {r.status_code} {r.get_json()}"
    return r.get_json()["access_token"]


class _Runner:
    """Petit harnais : enregistre chaque verification (OK / ECHEC)."""

    def __init__(self):
        self.ok = 0
        self.fail = 0

    def check(self, label, cond):
        if cond:
            self.ok += 1
            print(f"  [OK]   {label}")
        else:
            self.fail += 1
            print(f"  [FAIL] {label}")


def _run_scenarios(client, headers, teacher_id, runner):
    tid = teacher_id
    h = headers
    url = "/api/teacher-attendance"
    D1, D2, D3 = "2026-10-01", "2026-10-02", "2026-10-03"

    # 1) Au depart : aucun pointage pour cet enseignant.
    r = client.get(f"{url}?teacher_id={tid}", headers=h)
    runner.check("GET initial -> 200", r.status_code == 200)
    runner.check("GET initial -> liste vide", r.get_json().get("items") == [])

    # 2) POST unitaire : un retard est enregistre.
    r = client.post(url, headers=h, json={"teacher_id": tid, "date": D1, "status": "retard"})
    runner.check("POST retard -> 201", r.status_code == 201)
    att = r.get_json().get("attendance")
    runner.check("POST retard -> statut=retard", att and att.get("status") == "retard")

    # 3) GET filtre par date : exactement 1 ligne, le retard.
    r = client.get(f"{url}?teacher_id={tid}&date={D1}", headers=h)
    items = r.get_json().get("items", [])
    runner.check("GET date -> 1 ligne", len(items) == 1 and items[0]["status"] == "retard")

    # 4) Upsert : repointer la MEME date en 'absent' met a jour, ne duplique pas.
    r = client.post(url, headers=h, json={"teacher_id": tid, "date": D1, "status": "absent"})
    runner.check("POST meme date (upsert) -> 201", r.status_code == 201)
    r = client.get(f"{url}?teacher_id={tid}&date={D1}", headers=h)
    items = r.get_json().get("items", [])
    runner.check("Upsert -> toujours 1 ligne, statut=absent",
                 len(items) == 1 and items[0]["status"] == "absent")

    # 5) 'present' = valeur par defaut : la ligne est supprimee (rien a stocker).
    r = client.post(url, headers=h, json={"teacher_id": tid, "date": D1, "status": "present"})
    runner.check("POST present -> 201", r.status_code == 201)
    r = client.get(f"{url}?teacher_id={tid}&date={D1}", headers=h)
    runner.check("POST present -> ligne supprimee (0)", r.get_json().get("items") == [])

    # 6) Statut invalide -> ramene a 'present' -> aucune ligne creee.
    r = client.post(url, headers=h, json={"teacher_id": tid, "date": D1, "status": "n_importe_quoi"})
    runner.check("POST statut invalide -> 201", r.status_code == 201)
    r = client.get(f"{url}?teacher_id={tid}&date={D1}", headers=h)
    runner.check("Statut invalide -> traite comme present (0 ligne)",
                 r.get_json().get("items") == [])

    # 7) POST en lot (bulk) : deux statuts non-present sur deux dates.
    r = client.post(url, headers=h, json={"items": [
        {"teacher_id": tid, "date": D2, "status": "retard"},
        {"teacher_id": tid, "date": D3, "status": "absent"},
    ]})
    runner.check("POST bulk -> 201", r.status_code == 201)
    runner.check("POST bulk -> 2 lignes retournees", len(r.get_json().get("items", [])) == 2)

    # 8) GET par plage [from,to] : recupere les deux.
    r = client.get(f"{url}?teacher_id={tid}&from={D2}&to={D3}", headers=h)
    runner.check("GET plage from/to -> 2 lignes", len(r.get_json().get("items", [])) == 2)

    # 9) DELETE par id : supprime une ligne precise.
    r = client.get(f"{url}?teacher_id={tid}&date={D2}", headers=h)
    row = r.get_json().get("items", [])[0]
    r = client.delete(f"{url}/{row['id']}", headers=h)
    runner.check("DELETE -> 200 status ok",
                 r.status_code == 200 and r.get_json().get("status") == "ok")
    r = client.get(f"{url}?teacher_id={tid}&date={D2}", headers=h)
    runner.check("DELETE -> ligne absente ensuite", r.get_json().get("items") == [])

    # 10) Champs requis manquants -> 400.
    r = client.post(url, headers=h, json={"status": "retard"})
    runner.check("POST sans teacher_id/date -> 400", r.status_code == 400)

    # 11) Sans token -> 401 (route protegee).
    r = client.get(f"{url}?teacher_id={tid}")
    runner.check("GET sans token -> 401", r.status_code == 401)


def _execute():
    """Orchestre : app -> tables -> seed -> scenarios -> nettoyage. Renvoie le Runner."""
    app = create_app(TestingConfig)
    runner = _Runner()
    with app.app_context():
        db.create_all()  # idempotent : ne cree que les tables manquantes
        seed = _seed()
        try:
            client = app.test_client()
            token = _login(client, seed["email"], seed["password"])
            headers = {"Authorization": f"Bearer {token}"}
            _run_scenarios(client, headers, seed["teacher_id"], runner)
        finally:
            # Nettoyage non destructif : supprime l'etablissement de test
            # (cascade -> enseignant, pointages, utilisateur).
            school = db.session.get(School, seed["school_id"])
            if school is not None:
                db.session.delete(school)
                db.session.commit()
    return runner


def test_teacher_attendance_api():
    """Point d'entree pytest : echoue si une verification echoue."""
    runner = _execute()
    assert runner.fail == 0, f"{runner.fail} verification(s) en echec"


if __name__ == "__main__":
    print("== Validation de l'API de pointage enseignant ==")
    r = _execute()
    total = r.ok + r.fail
    print(f"\nResultat : {r.ok}/{total} verifications OK, {r.fail} echec(s).")
    sys.exit(0 if r.fail == 0 else 1)
