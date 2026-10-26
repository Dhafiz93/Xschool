"""Gestion des ecoles (reserve au superadmin). Exemple de ressource CRUD."""
import re

from flask import jsonify, request

from ..extensions import db
from ..models.school import School, SchoolConfig
from ..utils.security import superadmin_required
from . import api_bp


def _slugify(value):
    s = re.sub(r"[^a-z0-9]+", "-", (value or "").lower()).strip("-")
    return s or "ecole"


def _school_dict(s):
    return {"id": s.id, "name": s.name, "slug": s.slug, "active": s.active}


@api_bp.get("/schools")
@superadmin_required
def list_schools():
    rows = db.session.query(School).order_by(School.name).all()
    return jsonify(items=[_school_dict(s) for s in rows])


@api_bp.post("/schools")
@superadmin_required
def create_school():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify(error="nom_requis"), 400

    slug = _slugify(data.get("slug") or name)
    if db.session.query(School).filter(School.slug == slug).first():
        return jsonify(error="slug_deja_utilise", slug=slug), 409

    school = School(name=name, slug=slug)
    school.config = SchoolConfig(
        mentions=[
            {"l": "Excellent", "min": 18}, {"l": "Tres Bien", "min": 16},
            {"l": "Bien", "min": 14}, {"l": "Assez Bien", "min": 12},
            {"l": "Passable", "min": 10},
        ],
        bulletin_fmt_by_cycle={},
    )
    db.session.add(school)
    db.session.commit()
    return jsonify(school=_school_dict(school)), 201
