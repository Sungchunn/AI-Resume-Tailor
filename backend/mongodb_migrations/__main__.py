"""Allow running as: python -m mongodb_migrations"""

import sys

from mongodb_migrations.cli import main

if __name__ == "__main__":
    sys.exit(main())
