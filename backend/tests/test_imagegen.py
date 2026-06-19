"""File-store behavior for the imagegen router: save/read/delete/copy + bulk
delete against a tmp SNOWAN_HOME. No network — the cloud image API is never hit."""
import uuid

import pytest
from fastapi import HTTPException

from snowan import config
from snowan.server import imagegen

# Minimal valid 1x1 PNG so _png_dims has real bytes to parse.
PNG_1x1 = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
    "890000000d4944415478da6364f80f0001050102fdff7eef0000000049454e44ae426082"
)

# A well-formed id (uuid4 hex) that was never saved.
MISSING_ID = uuid.uuid4().hex


@pytest.fixture
def home(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "SNOWAN_HOME", tmp_path)
    return tmp_path


def test_save_read_delete(home):
    image_id = imagegen._save(PNG_1x1)
    path = imagegen._path(image_id)
    assert path.exists()
    assert path.read_bytes() == PNG_1x1

    resp = imagegen.get_file(image_id)
    assert str(resp.path) == str(path)

    assert imagegen.delete_file(image_id) == {"ok": True}
    assert not path.exists()
    # Idempotent: deleting an already-gone file is still ok.
    assert imagegen.delete_file(image_id) == {"ok": True}


def test_get_missing_404(home):
    with pytest.raises(HTTPException) as exc:
        imagegen.get_file(MISSING_ID)
    assert exc.value.status_code == 404


def test_copy_makes_independent_id(home):
    src = imagegen._save(PNG_1x1)
    out = imagegen.copy_file(src)
    new_id = out["id"]
    assert new_id != src
    assert imagegen._path(new_id).read_bytes() == PNG_1x1

    # Deleting the original leaves the copy intact (library independence).
    imagegen.delete_file(src)
    assert not imagegen._path(src).exists()
    assert imagegen._path(new_id).exists()


def test_copy_missing_404(home):
    with pytest.raises(HTTPException) as exc:
        imagegen.copy_file(MISSING_ID)
    assert exc.value.status_code == 404


def test_bulk_delete(home):
    ids = [imagegen._save(PNG_1x1) for _ in range(3)]
    keep = imagegen._save(PNG_1x1)

    # Includes one already-missing (but well-formed) id; bulk delete tolerates it.
    assert imagegen.delete_files(imagegen.IdsBody(ids=ids + [MISSING_ID])) == {"ok": True}
    for image_id in ids:
        assert not imagegen._path(image_id).exists()
    assert imagegen._path(keep).exists()


def test_path_rejects_traversal(home, tmp_path):
    # A traversal id must not resolve outside the artifacts dir.
    victim = tmp_path / "victim.png"
    victim.write_bytes(PNG_1x1)
    with pytest.raises(HTTPException) as exc:
        imagegen.delete_files(imagegen.IdsBody(ids=["../../victim"]))
    assert exc.value.status_code == 400
    assert victim.exists()


def test_png_dims():
    assert imagegen._png_dims(PNG_1x1) == (1, 1)
    assert imagegen._png_dims(b"not a png") == (None, None)
