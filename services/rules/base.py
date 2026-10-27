"""
Abstract base class for all deterministic compliance rules.

Every rule must implement ``evaluate()`` and expose a unique ``rule_id``
and human-readable ``rule_name``.  The Strategy Pattern lets us compose
an arbitrary set of rules at audit time without modifying the engine core.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

import ifcopenshell

from schemas.compliance import RuleResult


class BaseRule(ABC):
    """Interface that all compliance rule validators must satisfy."""

    @property
    @abstractmethod
    def rule_id(self) -> str:
        """Machine-readable rule identifier (e.g. RULE_A_STOREY_LIMIT)."""
        ...

    @property
    @abstractmethod
    def rule_name(self) -> str:
        """Human-readable rule title shown in the certificate."""
        ...

    @abstractmethod
    def evaluate(
        self,
        model: ifcopenshell.file,
        unit_to_mm: float,
        params: dict[str, Any],
    ) -> RuleResult:
        """
        Run the rule against an opened IFC model.

        Parameters
        ----------
        model:
            An ``ifcopenshell.file`` instance already loaded into memory.
        unit_to_mm:
            Multiplication factor that converts the model's native length
            unit to millimetres (e.g. 1.0 for mm models, 1000.0 for m).
        params:
            Audit parameters supplied by the caller (max floors, min dims …).

        Returns
        -------
        RuleResult
            Populated result including pass/fail status and any violations.
        """
        ...
