"""Import centralise des modeles pour qu'Alembic/Flask-Migrate les detecte."""
from .school import School, SchoolConfig
from .user import User, ROLES, ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_TEACHER, ROLE_SUPERVISOR, ROLE_STUDENT
from .academics import Cycle, SchoolClass, Subject, Program, DOMAINS
from .people import Student, Enrollment, Teacher
from .grades import Grade, Attendance, Discipline, TeacherAttendance
from .finance import Payment
from .audit import AuditLog
from .exercise import (Exercise, ExerciseSubmission, Notification,
                       EXERCISE_TYPES, TYPE_PDF, TYPE_QUIZ)
from .device import DeviceToken

__all__ = [
    "School", "SchoolConfig",
    "User", "ROLES", "ROLE_SUPERADMIN", "ROLE_ADMIN", "ROLE_TEACHER",
    "ROLE_SUPERVISOR", "ROLE_STUDENT",
    "Cycle", "SchoolClass", "Subject", "Program", "DOMAINS",
    "Student", "Enrollment", "Teacher",
    "Grade", "Attendance", "Discipline", "TeacherAttendance",
    "Payment",
    "AuditLog",
    "Exercise", "ExerciseSubmission", "Notification",
    "EXERCISE_TYPES", "TYPE_PDF", "TYPE_QUIZ",
    "DeviceToken",
]
