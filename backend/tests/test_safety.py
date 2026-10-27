import pytest
from fastapi import HTTPException

from app.routers.upload import sniff_extension
from app.services.safety import assert_production_secrets, rate_limit


def test_production_refuses_default_jwt():
    with pytest.raises(RuntimeError):
        assert_production_secrets("production", "change-me-to-a-long-random-string-min-32-chars")
    assert_production_secrets("development", "change-me-to-a-long-random-string-min-32-chars")


async def test_rate_limit_blocks_the_extra_call():
    key = "test-limit-once"
    await rate_limit(key, 2, 60)
    await rate_limit(key, 2, 60)
    with pytest.raises(HTTPException) as caught:
        await rate_limit(key, 2, 60)
    assert caught.value.status_code == 429


def test_id_file_is_checked_by_signature():
    assert sniff_extension(b"\xff\xd8\xff rest") == ".jpg"
    assert sniff_extension(b"GIF89a") is None
    assert sniff_extension(b"%PDF-1.4") == ".pdf"
