"""Paiements / frais de scolarite (scope ecole)."""
from flask import jsonify

from ..extensions import db
from ..models.finance import Payment
from ..models.user import ROLE_ADMIN
from ..utils.security import role_required
from ..utils.tenant import get_scoped_or_404, scoped_query
from . import api_bp
from .common import STAFF, arg, as_float, body, commit, err, intval, log_action, write_school_id


def _dict(p):
    return {
        "id": p.id, "student_id": p.student_id, "year": p.year,
        "amount": as_float(p.amount), "mode": p.mode, "ref": p.ref,
        "label": p.label, "date": p.date,
    }


@api_bp.get("/payments")
@role_required(*STAFF)
def list_payments():
    q = scoped_query(Payment)
    stid = intval(arg("student_id"))
    if stid is not None:
        q = q.filter(Payment.student_id == stid)
    if arg("year"):
        q = q.filter(Payment.year == arg("year"))
    return jsonify(items=[_dict(p) for p in q.order_by(Payment.date.desc()).all()])


@api_bp.post("/payments")
@role_required(ROLE_ADMIN)
def create_payment():
    data = body()
    stid = intval(data.get("student_id"))
    if stid is None:
        return err("eleve_requis")
    sid = write_school_id(data)
    if sid is None:
        return err("ecole_requise")
    p = Payment(
        school_id=sid, student_id=stid,
        year=(data.get("year") or "").strip(),
        amount=as_float(data.get("amount")) or 0,
        mode=(data.get("mode") or "").strip(),
        ref=(data.get("ref") or "").strip(),
        label=(data.get("label") or "").strip(),
        date=(data.get("date") or "").strip(),
    )
    db.session.add(p)
    log_action("create_payment", "payments", f"{p.amount} {p.label}".strip())
    commit()
    return jsonify(payment=_dict(p)), 201


@api_bp.delete("/payments/<int:payment_id>")
@role_required(ROLE_ADMIN)
def delete_payment(payment_id):
    p = get_scoped_or_404(Payment, payment_id)
    log_action("delete_payment", "payments", f"{p.amount} {p.label}".strip())
    db.session.delete(p)
    commit()
    return jsonify(status="ok")
