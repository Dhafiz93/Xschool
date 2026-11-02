"""Blueprint API principal. Les modules de routes s'y rattachent a l'import."""
from flask import Blueprint

api_bp = Blueprint("api", __name__)

# Importer les modules APRES la creation du blueprint (ils utilisent api_bp).
from . import schools  # noqa: E402,F401
from . import users  # noqa: E402,F401
from . import classes  # noqa: E402,F401
from . import students  # noqa: E402,F401
from . import teachers  # noqa: E402,F401
from . import subjects  # noqa: E402,F401
from . import programs  # noqa: E402,F401
from . import grades  # noqa: E402,F401
from . import attendance  # noqa: E402,F401
from . import teacher_attendance  # noqa: E402,F401
from . import discipline  # noqa: E402,F401
from . import payments  # noqa: E402,F401
from . import logs  # noqa: E402,F401
from . import stats  # noqa: E402,F401
from . import supervision  # noqa: E402,F401
from . import bulletins  # noqa: E402,F401
from . import notify  # noqa: E402,F401
from . import exercises  # noqa: E402,F401
from . import me  # noqa: E402,F401
from . import notifications  # noqa: E402,F401
from . import push  # noqa: E402,F401
from . import print_pdf  # noqa: E402,F401
