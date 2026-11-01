import re
from .models import RuleFinding

VAGUE = {"quickly", "easy", "user-friendly", "as soon as possible", "efficient", "seamless"}

def run_rules(text: str) -> tuple[list[RuleFinding], int]:
    low = text.lower()
    findings: list[RuleFinding] = []
    used = sorted(term for term in VAGUE if term in low)
    if used:
        findings.append(RuleFinding(rule="vague_language", severity="warning", message=f"Define measurable meaning for: {', '.join(used)}."))
    if not re.search(r"\b(customer|employee|manager|analyst|administrator|user|stakeholder)\b", low):
        findings.append(RuleFinding(rule="missing_actor", severity="blocking", message="No responsible actor is identified."))
    if not re.search(r"\b(so that|because|value|reduce|increase|improve|avoid|fewer)\b", low):
        findings.append(RuleFinding(rule="business_value", severity="warning", message="Business value is not measurable or explicit."))
    if re.search(r"\b(always|never|all users|instant|immediately)\b", low):
        findings.append(RuleFinding(rule="unsupported_assumption", severity="warning", message="Absolute language may encode an unsupported assumption; validate exceptions."))
    if "given" not in low or "when" not in low or "then" not in low:
        findings.append(RuleFinding(rule="incomplete_acceptance_criteria", severity="info", message="No complete Given/When/Then acceptance criterion was supplied."))
    for rule, message in [
        ("conflicting_requirements", "Compare actors, rules and outcomes against approved requirements for conflicts."),
        ("non_functional", "Confirm performance, availability, security and support requirements."),
        ("accessibility", "Confirm applicable accessibility standard and assistive technology needs."),
        ("privacy", "Confirm data categories, lawful purpose, access and retention."),
        ("bias", "Review automated decisions for protected attributes and an appeal route."),
        ("traceability", "Link each requirement to an approved source and business objective."),
    ]:
        findings.append(RuleFinding(rule=rule, severity="info", message=message))
    score = max(0, 100 - sum(12 if f.severity == "blocking" else 4 if f.severity == "warning" else 1 for f in findings))
    return findings, score
