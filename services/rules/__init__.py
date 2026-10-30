from services.rules.base import BaseRule
from services.rules.storey_limit import StoreyLimitRule
from services.rules.column_dimension import ColumnDimensionRule
from services.rules.egress_safety import EgressSafetyRule
from services.rules.column_continuity import ColumnContinuityRule

ALL_RULES: list[BaseRule] = [
    StoreyLimitRule(),
    ColumnDimensionRule(),
    EgressSafetyRule(),
    ColumnContinuityRule(),
]

__all__ = [
    "BaseRule",
    "StoreyLimitRule",
    "ColumnDimensionRule",
    "EgressSafetyRule",
    "ColumnContinuityRule",
    "ALL_RULES",
]
