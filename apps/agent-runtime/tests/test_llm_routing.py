from src.config.llm_routing import MODELS, get_model


def test_coder_uses_opus():
    assert get_model("coder") == "claude-opus-4-8"


def test_designer_uses_opus_4_7():
    assert get_model("designer") == "claude-opus-4-7"


def test_prospector_uses_gemini_flash():
    assert get_model("prospector") == "gemini/gemini-2.0-flash"


def test_unknown_role_falls_back_to_default():
    model = get_model("unknown_role_xyz")
    assert model == MODELS["default"]


def test_case_insensitive():
    assert get_model("CODER") == get_model("coder")
