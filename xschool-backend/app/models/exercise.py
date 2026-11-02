"""Exercices (PDF ou quiz) deposes par les enseignants + soumissions eleves.

Concepts :
  - Exercise           : un exercice cree par un enseignant pour une classe.
                         Type 'pdf' (document a telecharger / reponse a uploader)
                         ou 'quiz' (questions chronometrees, corrigees cote serveur).
  - ExerciseSubmission : l'etat de chaque eleve face a un exercice (recu, en cours,
                         soumis, corrige, expire) + sa reponse et sa note.
  - Notification       : notification en page (cloche) pour un utilisateur.

Stockage des fichiers : comme les photos du projet, les PDF sont stockes en
base64 (data-URL) dans une colonne Text. Pas de systeme de fichiers ni de
stockage objet a configurer ; la taille est bornee cote API.

Les bonnes reponses du quiz vivent dans `questions` (JSONB) et ne sont JAMAIS
renvoyees a l'eleve : la correction se fait cote serveur.
"""
from datetime import datetime

from sqlalchemy import (Boolean, DateTime, ForeignKey, Integer, Numeric,
                        String, Text)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import PKMixin, TimestampMixin, school_fk

# Types d'exercice.
TYPE_PDF = "pdf"
TYPE_QUIZ = "quiz"
EXERCISE_TYPES = (TYPE_PDF, TYPE_QUIZ)

# Statuts d'une soumission eleve.
ST_ASSIGNED = "assigned"       # recu, rien fait
ST_IN_PROGRESS = "in_progress"  # quiz demarre, pas encore soumis
ST_SUBMITTED = "submitted"     # reponse deposee (pdf) ou quiz soumis
ST_GRADED = "graded"           # note disponible (quiz corrige)
ST_EXPIRED = "expired"         # delai du quiz ecoule sans soumission complete

# Codes d'incidents anti-triche (journal cote serveur). Tout code inconnu
# envoye par le client est stocke tel quel sous "autre" (jamais de confiance
# aveugle dans l'entree client).
INC_FULLSCREEN_EXIT = "fullscreen_exit"  # sortie du mode plein ecran
INC_HIDDEN = "hidden"                    # onglet/appli masque (visibilitychange)
INC_BLUR = "blur"                        # la fenetre perd le focus
INC_COPY = "copy"                        # tentative de copie
INC_PASTE = "paste"                      # tentative de collage
INC_CONTEXTMENU = "contextmenu"          # clic droit / menu contextuel
INC_OTHER = "autre"
INCIDENT_TYPES = (
    INC_FULLSCREEN_EXIT, INC_HIDDEN, INC_BLUR,
    INC_COPY, INC_PASTE, INC_CONTEXTMENU, INC_OTHER,
)


class Exercise(PKMixin, TimestampMixin, db.Model):
    __tablename__ = "exercises"

    school_id: Mapped[int] = school_fk()
    # Auteur : fiche enseignant (peut etre nulle si le compte n'est pas lie) +
    # compte utilisateur createur (pour retrouver qui notifier en retour).
    teacher_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("teachers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_by_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # Classe destinataire : les eleves de cette classe recoivent l'exercice.
    class_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("classes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subject_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True, index=True
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    consignes: Mapped[str] = mapped_column(Text, default="")
    type: Mapped[str] = mapped_column(String(10), nullable=False, default=TYPE_PDF)

    # --- Type PDF ---
    pdf_name: Mapped[str] = mapped_column(String(200), default="")
    pdf_data: Mapped[str] = mapped_column(Text, default="")  # data-URL base64

    # --- Type QUIZ ---
    # questions = [ {id, text, type:'single'|'multi'|'text',
    #               options:[{id,text}], correct:[optionId]|'texte', points:int} ]
    # (La cle `correct` n'est jamais exposee a l'eleve.)
    questions: Mapped[list] = mapped_column(JSONB, default=list)
    duree_min: Mapped[int] = mapped_column(Integer, default=0)   # 0 = pas de limite
    points_total: Mapped[float] = mapped_column(Numeric(6, 2), default=0)

    # Echeance facultative (limite de depot) au format texte AAAA-MM-JJ.
    echeance: Mapped[str] = mapped_column(String(10), default="")
    # 'draft' = brouillon (pas encore visible des eleves) | 'published'.
    statut: Mapped[str] = mapped_column(String(12), default="published")
    # Rappel automatique J-1 deja envoye ? Evite les doublons si la commande
    # 'remind-due' tourne plusieurs fois le meme jour (idempotent).
    j1_reminded: Mapped[bool] = mapped_column(Boolean, default=False)

    submissions = relationship(
        "ExerciseSubmission", back_populates="exercise",
        cascade="all, delete-orphan",
    )


class ExerciseSubmission(PKMixin, TimestampMixin, db.Model):
    __tablename__ = "exercise_submissions"

    school_id: Mapped[int] = school_fk()
    exercise_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("exercises.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )

    statut: Mapped[str] = mapped_column(String(12), default=ST_ASSIGNED, index=True)

    # --- Reponse type PDF ---
    reponse_name: Mapped[str] = mapped_column(String(200), default="")
    reponse_data: Mapped[str] = mapped_column(Text, default="")  # data-URL base64

    # --- Reponse type QUIZ ---
    # Chrono cote serveur : le compte a rebours part de `started_at` et expire a
    # `deadline_at`. Page fermee = le temps continue (deadline absolue). Les
    # reponses sont sauvegardees au fil de l'eau dans `answers` (autosave) pour
    # qu'une fermeture de page n'efface pas le travail et que la note finale
    # puisse etre calculee a l'expiration.
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    deadline_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    answers: Mapped[dict] = mapped_column(JSONB, default=dict)  # {questionId: [optId]|'texte'}
    auto_soumis: Mapped[bool] = mapped_column(Boolean, default=False)

    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    note: Mapped[float] = mapped_column(Numeric(6, 2), nullable=True)      # points obtenus
    note_max: Mapped[float] = mapped_column(Numeric(6, 2), nullable=True)  # points possibles

    # --- Journal d'incidents anti-triche (quiz) ---
    # Chaque incident = {"type": <code>, "at": <iso UTC>, "detail": <str?>}.
    # Types attendus : sortie du plein ecran, onglet/fenetre caches, perte de
    # focus, copier/coller, menu contextuel... (cf. INCIDENT_TYPES).
    # `incident_count` est le total reel (meme si la liste est tronquee pour
    # borner la taille en base) : c'est lui qui sert au suivi enseignant.
    incidents: Mapped[list] = mapped_column(JSONB, default=list)
    incident_count: Mapped[int] = mapped_column(Integer, default=0)

    exercise = relationship("Exercise", back_populates="submissions")
    student = relationship("Student")


class Notification(PKMixin, TimestampMixin, db.Model):
    """Notification en page (cloche) pour un utilisateur donne."""

    __tablename__ = "notifications"

    school_id: Mapped[int] = school_fk(nullable=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(40), default="info", index=True)
    title: Mapped[str] = mapped_column(String(200), default="")
    body: Mapped[str] = mapped_column(Text, default="")
    # Reference optionnelle vers l'objet concerne (ex: ('exercise', 42)).
    ref_type: Mapped[str] = mapped_column(String(40), default="")
    ref_id: Mapped[int] = mapped_column(Integer, nullable=True)
    lu: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    lu_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
