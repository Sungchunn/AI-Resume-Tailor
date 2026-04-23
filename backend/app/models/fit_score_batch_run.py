"""FitScoreBatchRun model — singleton-style log of each batch invocation.

Read as ``SELECT ... ORDER BY started_at DESC LIMIT 1`` to drive the
"Scores refreshed Xh ago" header on the /jobs page.
"""

from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.sql import func

from app.db.session import Base


class FitScoreBatchRun(Base):
    __tablename__ = "fit_score_batch_runs"

    id = Column(Integer, primary_key=True, index=True)
    started_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )
    completed_at = Column(DateTime(timezone=True), nullable=True)
    users_count = Column(Integer, nullable=False, server_default="0")
    rows_written = Column(Integer, nullable=False, server_default="0")
    # "running" | "completed" | "failed"
    status = Column(String(20), nullable=False, server_default="running")

    def __repr__(self) -> str:
        return (
            f"<FitScoreBatchRun id={self.id} status={self.status} "
            f"started={self.started_at}>"
        )
