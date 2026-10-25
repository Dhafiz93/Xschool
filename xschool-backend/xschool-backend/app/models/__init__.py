"""Import centralise des modeles pour qu'Alembic/Flask-Migrate les detecte."""
from .school import School, SchoolConfig
from .user import User, ROLES, ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_TEACHER, ROLE_SUPERVISOR, ROLE_STUDENT
from .academics import Cycle, SchoolClass, Subject, Program, DOMAINS
from .people import Student, Enrollment, Teacher
from .grades import Grade, Attendance, Discipline
from .finance import Payment
from .audit import AuditLog

__all__ = [
    "School", "SchoolConfig",
    "User", "ROLES", "ROLE_SUPERADMIN", "ROLE_ADMIN", "ROLE_TEACHER",
    "ROLE_SUPERVISOR", "ROLE_STUDENT",
    "Cycle", "SchoolClass", "Subject", "Program", "DOMAINS",
    "Student", "Enrollment", "Teacher",
    "Grade", "Attendance", "Discipline",
    "Payment",
    "AuditLog",
]
