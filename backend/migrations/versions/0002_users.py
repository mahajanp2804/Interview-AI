"""Add user accounts, sign-in tokens and session ownership."""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "auth_tokens",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_auth_tokens_user_id", "auth_tokens", ["user_id"])

    with op.batch_alter_table("sessions") as batch:
        batch.add_column(sa.Column("user_id", sa.Integer(), nullable=True))
        batch.create_foreign_key("fk_sessions_user_id", "users", ["user_id"], ["id"], ondelete="CASCADE")
        batch.create_index("ix_sessions_user_id", ["user_id"])


def downgrade():
    with op.batch_alter_table("sessions") as batch:
        batch.drop_index("ix_sessions_user_id")
        batch.drop_constraint("fk_sessions_user_id", type_="foreignkey")
        batch.drop_column("user_id")
    op.drop_table("auth_tokens")
    op.drop_table("users")
