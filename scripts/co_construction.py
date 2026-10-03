"""Validate response classes and derive co-construction counts."""
from __future__ import annotations


FUNCTIONAL_REFS = {f'REF-BM-{i:02d}' for i in range(1, 33)}
INFRASTRUCTURE_REFS = {f'REF-BM-I{i:02d}' for i in range(1, 6)}


def summarise_in_scope(judgment: dict) -> dict:
    """Preserve infrastructure and unreferenced non-divergent notes separately.

    Infrastructure scope depends on reference IDs, not response classification.
    An empty reference list is allowed only for a validated not_divergent note,
    which contributes to none of the counts and is retained outside scoring.
    Keep every excluded decision intact, but derive counts only from functional
    decisions. Unknown IDs and mixed scope still require inspection.
    """
    validated = summarise(judgment)
    decisions = []
    excluded = judgment.get('excluded_decisions', [])
    if not isinstance(excluded, list):
        raise ValueError('excluded_decisions must be a list')
    excluded = list(excluded)
    for index, decision in enumerate(validated['decisions']):
        refs = set(decision['ref_items'])
        if not refs:
            excluded.append({'original_decision_index': index,
                             'reason': 'unreferenced_not_divergent', 'decision': decision})
        elif refs <= FUNCTIONAL_REFS:
            decisions.append(decision)
        elif refs <= INFRASTRUCTURE_REFS:
            excluded.append({'original_decision_index': index,
                             'reason': 'infrastructure_outside_functional_scope', 'decision': decision})
        else:
            raise ValueError('Unknown or mixed-scope reference in co-construction result')
    for item in excluded:
        if (not isinstance(item, dict) or item.get('reason') not in (
                'infrastructure_outside_functional_scope', 'unreferenced_not_divergent')
                or not isinstance(item.get('original_decision_index'), int)
                or item['original_decision_index'] < 0):
            raise ValueError('Invalid excluded decision record')
        decision = item.get('decision')
        summarise({'decisions': [decision]})
        refs = set(decision['ref_items'])
        if item['reason'] == 'unreferenced_not_divergent':
            if refs or decision['response_class'] != 'not_divergent':
                raise ValueError('Only unreferenced not_divergent notes may use this exclusion')
        elif not refs or not refs <= INFRASTRUCTURE_REFS:
            raise ValueError('Only known infrastructure decisions may use infrastructure exclusion')
    result = summarise({'decisions': decisions})
    if excluded:
        result['excluded_decisions'] = excluded
    return result


def has_response_classes(judgment: dict) -> bool:
    """Identify response-class data by decision fields or aggregate counts."""
    decisions = judgment.get("decisions")
    return any(key in judgment for key in (
        "n_c", "n_a", "n_m", "accepted_divergences", "unexpressed_divergences",
        "unresolved_decisions", "capture_rate",
    )) or (isinstance(decisions, list) and any(
        isinstance(item, dict) and "response_class" in item for item in decisions
    ))


def summarise(judgment: dict) -> dict:
    """Count captured N_g from corrective N_c and explicitly accepting N_a.

    Counts are derived from decisions, never trusted from model-written totals.
    """
    if not isinstance(judgment, dict):
        raise ValueError("judgment must be an object")
    decisions = judgment.get("decisions")
    if not isinstance(decisions, list):
        raise ValueError("decisions must be a list")
    counts = dict.fromkeys(("corrective", "accepted_divergence",
                           "unexpressed_divergence", "unresolved", "not_divergent"), 0)
    for index, decision in enumerate(decisions):
        if not isinstance(decision, dict):
            raise ValueError(f"decision {index}: expected an object")
        response = decision.get("response_class")
        if not isinstance(response, str) or response not in counts:
            raise ValueError(f"decision {index}: invalid response_class")
        refs = decision.get("ref_items")
        if not isinstance(refs, list) or (not refs and response != 'not_divergent') or not all(
            isinstance(ref, str) and ref.strip() for ref in refs
        ):
            raise ValueError(f"decision {index}: ref_items must identify requirements")
        for field in ("evidence", "note"):
            if not isinstance(decision.get(field), str) or not decision[field].strip():
                raise ValueError(f"decision {index}: {field} is required")
        if "diverged" not in decision:
            raise ValueError(f"decision {index}: diverged is required")
        diverged = decision["diverged"]
        expected_caught = response in {"corrective", "accepted_divergence"}
        if decision.get("caught") is not expected_caught:
            raise ValueError(f"decision {index}: caught conflicts with response_class")
        allowed_types = {"negate", "correct", "extend", "select"} if response == "corrective" else {"none"}
        if not isinstance(decision.get("catch_type"), str) or decision["catch_type"] not in allowed_types:
            raise ValueError(f"decision {index}: catch_type conflicts with response_class")
        if response == "not_divergent":
            valid_divergence = diverged is False
        elif response == "unresolved":
            valid_divergence = diverged is True or diverged is None
        else:
            valid_divergence = diverged is True
        if not valid_divergence:
            raise ValueError(f"decision {index}: diverged conflicts with response_class")
        counts[response] += 1
    n_c = counts["corrective"]
    n_a = counts["accepted_divergence"]
    n_g = n_c + n_a
    n_m = counts["unexpressed_divergence"]
    opportunities = n_g + n_m
    result = {"decisions": decisions}
    result.update(
        n_g=n_g, n_c=n_c, n_a=n_a, n_m=n_m,
        accepted_divergences=counts["accepted_divergence"],
        unexpressed_divergences=counts["unexpressed_divergence"],
        unresolved_decisions=counts["unresolved"],
        opportunities=opportunities,
        capture_rate=n_g / opportunities if opportunities else None,
    )
    return result
