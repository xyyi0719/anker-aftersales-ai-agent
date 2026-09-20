"""Regression tests for the current offline service (legacy vector tests retired)."""
from fastapi.testclient import TestClient
from retrieval.app import app

def test_auto_initialized():
    result=TestClient(app).get('/healthz').json()
    assert result['index_ready'] and result['chunks_loaded']==17
    assert result['embedding_required'] is False

def test_no_index_write_endpoint():
    assert TestClient(app).post('/index',json={'documents':[]}).status_code==404

def test_unrelated_query():
    result=TestClient(app).post('/retrieve',json={'query':'天气怎么样'}).json()
    assert result['answerable'] is False
