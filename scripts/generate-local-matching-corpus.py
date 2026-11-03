"""Regenerate the browser matcher contract from the existing Python engine (no real user data).

Usage: <backend .venv python> scripts/generate-local-matching-corpus.py <backend repo>
"""
import contextlib
import io
import json
from pathlib import Path
import random
import sys
import tempfile
import unicodedata
from xml.etree import ElementTree as ET
from difflib import SequenceMatcher

backend = Path(sys.argv[1]).resolve()
sys.path.insert(0, str(backend))
from lib.rekordbox.matcher import mark_owned_tracks
from lib.rekordbox.normalizer import normalize_artist, normalize_title_base, normalize_album, artist_identity, title_version_signature, title_annotation_signature

rng = random.Random(1984)
cases = []

def compare(entries, tracks):
    root = ET.Element('DJ_PLAYLISTS')
    collection = ET.SubElement(root, 'COLLECTION')
    for t in entries:
        ET.SubElement(collection, 'TRACK', {k: str(v) for k, v in {'Name': t['title'], 'Artist': t['artist'], 'Album': t.get('album', ''), 'ISRC': t.get('isrc')}.items() if v is not None})
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / 'library.xml'
        ET.ElementTree(root).write(path, encoding='utf-8')
        with contextlib.redirect_stdout(io.StringIO()):
            result = mark_owned_tracks({'tracks': [dict(t) for t in tracks]}, path)
    expected = [{k: t[k] for k in ('owned', 'owned_reason', 'library_match')} for t in result['tracks']]
    cases.append({'entries': entries, 'tracks': tracks, 'expected': expected})

fixture = backend / 'tests/fixtures/rekordbox'
root = ET.parse(fixture / 'golden_library.xml').getroot()
entries = [{'title':t.get('Name','').strip(), 'artist':t.get('Artist','').strip(), 'album':t.get('Album','').strip(), 'isrc':t.get('ISRC')} for t in root.find('COLLECTION')]
compare(entries, json.loads((fixture/'golden_playlist.json').read_text())['tracks'])
versions = ['', ' (Original Mix)', ' - Alice Remix', ' (Bob Remix)', ' - Extended', ' (Extended Mix)', ' (Intro)', ' (Outro)', ' (Chapter A)', ' (Chapter B)', ' (Live)', ' (Clean Version)', ' (Explicit Version)', ' (Part I)', ' (Part II)']
for version in versions:
    for other in versions:
        compare([{'title':'Song'+other, 'artist':'Artist', 'album':'Album'}], [{'title':'Song'+version, 'artist':'Artist', 'album':'Album'}])
credits = ['A & B','B & A','A & C','A, B','A feat. B','A ft B','A featuring B','Earth, Wind & Fire','Artist','', 'Ｂ & Ａ', 'Straße', 'STRASSE', 'İstanbul', 'Björk']
for a in credits:
    b = rng.choice(credits)
    compare([{'title':'Song', 'artist':a, 'album':'Album'}], [{'title':'Song', 'artist':b, 'album':'Album'}])
compare([{'title':'Song', 'artist':'A', 'album':'A', 'isrc':'AAA'},{'title':'Song (Original Mix)', 'artist':'A & B', 'album':'A'}], [{'title':'Song', 'artist':'A & B', 'album':'A'},{'title':'Other', 'artist':'Else','isrc':'AAA'},{'title':'Song', 'artist':'A','isrc':'BBB'}])
strings = ['Song'+v for v in versions]+credits+['Artist - Song [LABEL]','Civic 169.98','Song_Master','Song ft. Singer','Song - Modeā Remix','Song - Modeā Editā','記憶 (夜)','Song|Album','Song - Original Mix Master','A - B - C Remix','Song_(Alice_Remix)','Song (Alice & Bob Remix)']
norms = [{'value':s,'artist':normalize_artist(s),'title':normalize_title_base(s),'album':normalize_album(s),'identity':list(artist_identity(s)),'version':list(title_version_signature(s)),'annotation':list(title_annotation_signature(s))} for s in strings]
pairs = [("Tide", "Diet"), ("Diet", "Tide"), ("", ""), ("a"*200,"b"+"a"*199), ("😀東京abc", "東京😀abc")]
for _ in range(80):
    a = ''.join(rng.choice('ab cde東京') for _ in range(rng.choice([5,25,210])))
    b = a[:len(a)//2]+rng.choice(['x','東京',''])+a[len(a)//2+1:]
    pairs.append((a,b))
corpus = {'source':'Python matcher rules v3; synthetic and committed golden fixture only','cases':cases,'normalizers':norms,'similarity':[{'left':a,'right':b,'ratio':SequenceMatcher(None,a,b).ratio()} for a,b in pairs]}
Path('tests/fixtures/local-matching.json').write_text(json.dumps(corpus,ensure_ascii=False,indent=2)+'\n')
print(f'Generated {len(cases)} matching cases, {len(norms)} normalization cases, {len(pairs)} similarity cases')

# Keep browser casefolding aligned with the Python runtime used as the reference.
folds = {chr(i): chr(i).casefold() for i in range(0x110000) if chr(i).casefold() != chr(i)}
Path("lib/rekordbox/casefold.json").write_text(json.dumps(folds, ensure_ascii=False, indent=2) + "\n")
print(f"Casefold table generated from Python Unicode {unicodedata.unidata_version}")
