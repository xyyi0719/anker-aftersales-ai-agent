"""Offline BM25 search over versioned FAQ snapshots. No embeddings or API keys."""
import json
import math
import re
from collections import Counter
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / 'knowledge_base'
SAFETY = re.compile(r'召回|recall|爆炸|鼓包|冒烟|起火|漏液|烧焦|异味', re.I)
POLICY = re.compile(r'保修|质保|退货|退款|退换|换货|三包|warranty|refund|赔偿|补偿', re.I)

def tokens(text):
    # CJK bigrams preserve local phrases; latin tokens preserve model/error codes.
    text = text.lower()
    words = re.findall(r'[a-z0-9]+(?:[.%_-][a-z0-9]+)*', text)
    for run in re.findall(r'[\u4e00-\u9fff]+', text):
        words.extend(run[i:i+2] for i in range(len(run)-1))
    return words

class LexicalRetriever:
    def __init__(self):
        self.chunks = json.loads((DATA / 'faq_snapshot.json').read_text())
        self.counts = [Counter(tokens(c['text'] + ' ' + ' '.join(c['keywords']))) for c in self.chunks]
        self.df = Counter(t for c in self.counts for t in c)
        self.avg_len = sum(map(lambda c: sum(c.values()), self.counts)) / len(self.counts)

    def search(self, query, top_k=3, filters=None):
        filters = dict(filters or {})
        out = dict(results=[], confidence=0.0, answerable=False, low_confidence_reason='no_evidence',
                   fallback_message='未找到足够可靠的资料，请补充型号或交由专员确认。',
                   retrieval_mode='offline_bm25', confidence_kind='heuristic_not_probability', mock=True)
        if SAFETY.search(query):
            return dict(out, low_confidence_reason='live_safety_evidence_unavailable')
        if POLICY.search(query):
            return dict(out, low_confidence_reason='policy_requires_verified_order',
                        fallback_message='请提供订单号，以确认购买地区、渠道及适用政策。')
        if set(filters) - {'product', 'region', 'channel'}:
            return dict(out, low_confidence_reason='unsupported_filter')
        product = filters.get('product', '')
        product = {'Anker 737':'Anker737', 'Soundcore Liberty 4':'Soundcore'}.get(product, product)
        if not product:
            if re.search(r'737|a1289|充电宝', query, re.I): product = 'Anker737'
            elif re.search(r'耳机|soundcore|声阔', query, re.I): product = 'Soundcore'
        # FAQ snapshots have no region/channel entitlement. Never treat them as policies.
        if any(filters.get(k) for k in ('region','channel')):
            return dict(out, low_confidence_reason='no_candidate_after_filter')
        qt = set(tokens(query))
        scored = []
        for item, tf in zip(self.chunks, self.counts):
            if product and item['metadata']['product'] != product: continue
            matched = qt & tf.keys()
            aliases = [k for k in item['keywords'] if k.lower() in query.lower()]
            if not matched and not aliases: continue
            raw = 0.0
            length = sum(tf.values())
            for t in matched:
                idf = math.log(1 + (len(self.chunks)-self.df[t]+.5)/(self.df[t]+.5))
                raw += idf * tf[t] * 2.5 / (tf[t] + 1.5 * (.25 + .75*length/self.avg_len))
            coverage = len(matched) / max(len(qt), 1)
            # Do not min-max normalize candidates: all-zero must remain zero.
            confidence = min(.95, .70 + .025*max(map(len,aliases)) if aliases else min(.69, coverage*.65))
            rank = raw + (8 + max(map(len,aliases)) if aliases else 0)
            scored.append((rank, dict(chunk_id=item['chunk_id'], text=item['text'], score=round(confidence,3),
                                    bm25_score=round(raw,3), metadata=item['metadata'])))
        scored.sort(key=lambda r: (-r[0], r[1]['chunk_id']))
        results = [v for _,v in scored[:top_k]]
        confidence = results[0]['score'] if results else 0.0
        answerable = confidence >= .72
        return dict(out, results=results, confidence=confidence, answerable=answerable,
                    low_confidence_reason=None if answerable else 'insufficient_phrase_evidence',
                    fallback_message=None if answerable else out['fallback_message'])

retriever = LexicalRetriever()
