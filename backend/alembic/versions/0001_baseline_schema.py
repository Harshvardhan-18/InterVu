"""baseline schema

Revision ID: 0001
Revises: 
Create Date: 2026-10-29 20:56:29.910573

"""
from typing import Sequence, Union

from alembic import context, op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0001'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(name: str) -> bool:
    if context.is_offline_mode():
        # `alembic upgrade head --sql` has no database to inspect: render every table.
        return False
    return sa.inspect(op.get_bind()).has_table(name)


def upgrade() -> None:
    """
    Create the application schema.

    Each table is created only if it is missing. Databases that were set up
    before migrations existed (the app used ``create_all``) already have these
    tables; for them this revision creates whatever is new and otherwise just
    records the baseline. Later revisions are ordinary migrations.
    """
    if not _has_table('research_profiles'):
        op.create_table('research_profiles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('company', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=255), nullable=False),
        sa.Column('skills', sa.JSON(), nullable=False),
        sa.Column('technologies', sa.JSON(), nullable=False),
        sa.Column('topics', sa.JSON(), nullable=False),
        sa.Column('rounds', sa.JSON(), nullable=False),
        sa.Column('behavioral_patterns', sa.JSON(), nullable=False),
        sa.Column('key_insights', sa.JSON(), nullable=False),
        sa.Column('dsa_questions', sa.JSON(), nullable=False),
        sa.Column('difficulty', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('company', 'role', name='uq_company_role')
        )
        op.create_index(op.f('ix_research_profiles_company'), 'research_profiles', ['company'], unique=False)
        op.create_index(op.f('ix_research_profiles_id'), 'research_profiles', ['id'], unique=False)
        op.create_index(op.f('ix_research_profiles_role'), 'research_profiles', ['role'], unique=False)
    if not _has_table('users'):
        op.create_table('users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
        op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    if not _has_table('interviews'):
        op.create_table('interviews',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('company', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=255), nullable=False),
        sa.Column('difficulty', sa.String(length=50), nullable=True),
        sa.Column('blueprint', sa.JSON(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_interviews_id'), 'interviews', ['id'], unique=False)
        op.create_index(op.f('ix_interviews_user_id'), 'interviews', ['user_id'], unique=False)
    if not _has_table('resumes'):
        op.create_table('resumes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('content_type', sa.String(length=100), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
        )
        op.create_index(op.f('ix_resumes_id'), 'resumes', ['id'], unique=False)
    if not _has_table('llm_usage'):
        op.create_table('llm_usage',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('interview_id', sa.Integer(), nullable=True),
        sa.Column('label', sa.String(length=50), nullable=False),
        sa.Column('model', sa.String(length=100), nullable=True),
        sa.Column('input_tokens', sa.Integer(), nullable=False),
        sa.Column('output_tokens', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['interview_id'], ['interviews.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_llm_usage_created_at'), 'llm_usage', ['created_at'], unique=False)
        op.create_index(op.f('ix_llm_usage_id'), 'llm_usage', ['id'], unique=False)
        op.create_index(op.f('ix_llm_usage_interview_id'), 'llm_usage', ['interview_id'], unique=False)
        op.create_index(op.f('ix_llm_usage_user_id'), 'llm_usage', ['user_id'], unique=False)
    if not _has_table('questions'):
        op.create_table('questions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('interview_id', sa.Integer(), nullable=False),
        sa.Column('question', sa.Text(), nullable=False),
        sa.Column('section', sa.String(length=100), nullable=True),
        sa.Column('question_type', sa.String(length=100), nullable=True),
        sa.Column('order_index', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['interview_id'], ['interviews.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_questions_id'), 'questions', ['id'], unique=False)
        op.create_index(op.f('ix_questions_interview_id'), 'questions', ['interview_id'], unique=False)
    if not _has_table('report_shares'):
        op.create_table('report_shares',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('interview_id', sa.Integer(), nullable=False),
        sa.Column('token', sa.String(length=64), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['interview_id'], ['interviews.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('interview_id')
        )
        op.create_index(op.f('ix_report_shares_id'), 'report_shares', ['id'], unique=False)
        op.create_index(op.f('ix_report_shares_token'), 'report_shares', ['token'], unique=True)
    if not _has_table('reports'):
        op.create_table('reports',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('interview_id', sa.Integer(), nullable=False),
        sa.Column('overall_score', sa.Float(), nullable=True),
        sa.Column('report_json', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['interview_id'], ['interviews.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('interview_id')
        )
        op.create_index(op.f('ix_reports_id'), 'reports', ['id'], unique=False)
    if not _has_table('responses'):
        op.create_table('responses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('question_id', sa.Integer(), nullable=False),
        sa.Column('answer', sa.Text(), nullable=True),
        sa.Column('score', sa.Float(), nullable=True),
        sa.Column('evaluation', sa.JSON(), nullable=True),
        sa.Column('feedback', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['question_id'], ['questions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_responses_id'), 'responses', ['id'], unique=False)
        op.create_index(op.f('ix_responses_question_id'), 'responses', ['question_id'], unique=False)


def downgrade() -> None:
    """Drop every application table. This deletes ALL data; it exists for scratch databases."""
    op.drop_index(op.f('ix_responses_question_id'), table_name='responses')
    op.drop_index(op.f('ix_responses_id'), table_name='responses')
    op.drop_table('responses')
    op.drop_index(op.f('ix_reports_id'), table_name='reports')
    op.drop_table('reports')
    op.drop_index(op.f('ix_report_shares_token'), table_name='report_shares')
    op.drop_index(op.f('ix_report_shares_id'), table_name='report_shares')
    op.drop_table('report_shares')
    op.drop_index(op.f('ix_questions_interview_id'), table_name='questions')
    op.drop_index(op.f('ix_questions_id'), table_name='questions')
    op.drop_table('questions')
    op.drop_index(op.f('ix_llm_usage_user_id'), table_name='llm_usage')
    op.drop_index(op.f('ix_llm_usage_interview_id'), table_name='llm_usage')
    op.drop_index(op.f('ix_llm_usage_id'), table_name='llm_usage')
    op.drop_index(op.f('ix_llm_usage_created_at'), table_name='llm_usage')
    op.drop_table('llm_usage')
    op.drop_index(op.f('ix_resumes_id'), table_name='resumes')
    op.drop_table('resumes')
    op.drop_index(op.f('ix_interviews_user_id'), table_name='interviews')
    op.drop_index(op.f('ix_interviews_id'), table_name='interviews')
    op.drop_table('interviews')
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
    op.drop_index(op.f('ix_research_profiles_role'), table_name='research_profiles')
    op.drop_index(op.f('ix_research_profiles_id'), table_name='research_profiles')
    op.drop_index(op.f('ix_research_profiles_company'), table_name='research_profiles')
    op.drop_table('research_profiles')
