"""Create the sessions table (the schema from before migrations existed)."""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Older local databases already have this table from create_all()
    if sa.inspect(op.get_bind()).has_table("sessions"):
        return

    op.create_table(
        "sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("session_uid", sa.String(64), nullable=False),
        sa.Column("role", sa.String(100), nullable=False),
        sa.Column("level", sa.String(50), nullable=False),
        sa.Column("interview_type", sa.String(50), nullable=False),
        sa.Column("difficulty", sa.String(20), nullable=False),
        sa.Column("company", sa.String(100), nullable=True),
        sa.Column("num_questions", sa.Integer(), nullable=False),
        sa.Column("overall_score", sa.Float(), nullable=True),
        sa.Column("grade", sa.String(5), nullable=True),
        sa.Column("duration_min", sa.Integer(), nullable=True),
        sa.Column("answers_count", sa.Integer(), nullable=False),
        sa.Column("qa_data", sa.JSON(), nullable=True),
        sa.Column("feedback_data", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_sessions_id", "sessions", ["id"])
    op.create_index("ix_sessions_session_uid", "sessions", ["session_uid"], unique=True)


def downgrade():
    op.drop_table("sessions")
