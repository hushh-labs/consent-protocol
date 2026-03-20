from hushh_mcp.services.renaissance_service import RenaissanceService
from hushh_mcp.services.ria_iam_service import RIAIAMPolicyError, RIAIAMService
from hushh_mcp.services.ria_verification import validate_regulated_runtime_configuration


def test_runtime_persona_only_overrides_for_setup_mode():
    assert (
        RIAIAMService._resolve_full_mode_last_persona(
            personas=["investor"],
            actor_last_persona="investor",
            runtime_last_persona="ria",
        )
        == "ria"
    )


def test_runtime_persona_does_not_override_real_dual_persona_account():
    assert (
        RIAIAMService._resolve_full_mode_last_persona(
            personas=["investor", "ria"],
            actor_last_persona="investor",
            runtime_last_persona="ria",
        )
        == "investor"
    )


def test_professional_inputs_require_individual_name_for_regulatory_verification():
    try:
        RIAIAMService._prepare_professional_onboarding_inputs(
            display_name="Advisor Alpha",
            requested_capabilities=["advisory"],
            individual_legal_name="",
            individual_crd="12345",
            advisory_firm_legal_name="Advisor Alpha LLC",
            advisory_firm_iapd_number="801-12345",
            broker_firm_legal_name=None,
            broker_firm_crd=None,
            bio=None,
            strategy=None,
            disclosures_url=None,
            require_regulatory_identity=True,
        )
    except RIAIAMPolicyError as exc:
        assert "individual_legal_name" in str(exc)
    else:
        raise AssertionError("Expected individual_legal_name to be required")


def test_professional_inputs_require_individual_crd_for_regulatory_verification():
    try:
        RIAIAMService._prepare_professional_onboarding_inputs(
            display_name="Advisor Alpha",
            requested_capabilities=["advisory"],
            individual_legal_name="Advisor Alpha LLC",
            individual_crd="",
            advisory_firm_legal_name="Advisor Alpha LLC",
            advisory_firm_iapd_number="801-12345",
            broker_firm_legal_name=None,
            broker_firm_crd=None,
            bio=None,
            strategy=None,
            disclosures_url=None,
            require_regulatory_identity=True,
        )
    except RIAIAMPolicyError as exc:
        assert "individual_crd" in str(exc)
    else:
        raise AssertionError("Expected individual_crd to be required")


def test_professional_inputs_require_advisory_firm_identifiers_for_advisory():
    try:
        RIAIAMService._prepare_professional_onboarding_inputs(
            display_name="Advisor Alpha",
            requested_capabilities=["advisory"],
            individual_legal_name="Advisor Alpha LLC",
            individual_crd="12345",
            advisory_firm_legal_name="",
            advisory_firm_iapd_number="",
            broker_firm_legal_name=None,
            broker_firm_crd=None,
            bio=None,
            strategy=None,
            disclosures_url="https://example.com/disclosures",
            require_regulatory_identity=True,
        )
    except RIAIAMPolicyError as exc:
        assert "advisory_firm_legal_name" in str(exc) or "advisory_firm_iapd_number" in str(exc)
    else:
        raise AssertionError("Expected advisory firm identifiers to be required")


def test_professional_inputs_accept_dual_capability_payload():
    payload = RIAIAMService._prepare_professional_onboarding_inputs(
        display_name="Advisor Alpha",
        requested_capabilities=["advisory", "brokerage"],
        individual_legal_name="Advisor Alpha LLC",
        individual_crd="12345",
        advisory_firm_legal_name="Advisor Alpha LLC",
        advisory_firm_iapd_number="801-12345",
        broker_firm_legal_name="Broker Alpha LLC",
        broker_firm_crd="56789",
        bio="Tax-aware planning",
        strategy=None,
        disclosures_url="https://example.com/disclosures",
        require_regulatory_identity=True,
    )

    assert payload["display_name"] == "Advisor Alpha"
    assert payload["individual_legal_name"] == "Advisor Alpha LLC"
    assert payload["individual_crd"] == "12345"
    assert payload["requested_capabilities"] == ["advisory", "brokerage"]
    assert payload["disclosures_url"] == "https://example.com/disclosures"


def test_ria_verified_status_helper_matches_expected_statuses():
    assert RIAIAMService._is_verified_ria_status("verified") is True
    assert RIAIAMService._is_verified_ria_status("active") is True
    assert RIAIAMService._is_verified_ria_status("bypassed") is True
    assert RIAIAMService._is_verified_ria_status("submitted") is False


def test_regulated_runtime_guard_requires_iapd_in_production(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.delenv("IAPD_VERIFY_BASE_URL", raising=False)
    monkeypatch.delenv("IAPD_VERIFY_API_KEY", raising=False)
    monkeypatch.setenv("ADVISORY_VERIFICATION_BYPASS_ENABLED", "false")
    monkeypatch.setenv("BROKER_VERIFICATION_BYPASS_ENABLED", "false")

    try:
        validate_regulated_runtime_configuration()
    except RuntimeError as exc:
        assert "IAPD_VERIFY_BASE_URL" in str(exc)
    else:
        raise AssertionError("Expected production runtime guard to require IAPD config")


def test_regulated_runtime_guard_rejects_prod_bypass(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("IAPD_VERIFY_BASE_URL", "https://iapd.example.com")
    monkeypatch.setenv("IAPD_VERIFY_API_KEY", "secret")
    monkeypatch.setenv("ADVISORY_VERIFICATION_BYPASS_ENABLED", "true")
    monkeypatch.setenv("BROKER_VERIFICATION_BYPASS_ENABLED", "false")

    try:
        validate_regulated_runtime_configuration()
    except RuntimeError as exc:
        assert "BYPASS" in str(exc)
    else:
        raise AssertionError("Expected production runtime guard to reject bypass flags")


def test_renaissance_service_exposes_generic_security_list_descriptors():
    descriptors = RenaissanceService().list_descriptors()
    ids = {descriptor.list_id for descriptor in descriptors}

    assert "renaissance_universe" in ids
    assert "renaissance_avoid" in ids
    assert "renaissance_screening_criteria" in ids
