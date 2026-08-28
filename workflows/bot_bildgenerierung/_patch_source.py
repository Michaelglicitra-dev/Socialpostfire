import json
w = json.load(open('_live_export_2026-08-28.json'))
byname = {n['name']: n for n in w['nodes']}

def code(f):
    s = open(f).read()
    assert all(ord(c) < 127 for c in s), 'non-ascii in ' + f
    return s.rstrip('\n') + '\n' if False else s.rstrip('\n')

patches = {
    'Restaurant-Konfiguration': '01_Restaurant-Konfiguration.js',
    'Bild-Modus': '02_Bild-Modus.js',
    'Bild-Request bauen (Foto)': '03_Bild-Request_bauen_Foto.js',
    'Bild-Request bauen (Logo)': '04_Bild-Request_bauen_Logo.js',
    'Bild extrahieren': '05_Bild_extrahieren.js',
}
for name, f in patches.items():
    byname[name]['parameters']['jsCode'] = code(f)

badge = byname['Preis-Badge stempeln']
ops = badge['parameters']['operations']['operations']
txt = [o for o in ops if o.get('operation') == 'text' and str(o.get('fontSize')) == '60']
assert len(txt) == 1, ops
txt[0]['positionX'] = code('06_Preis-Badge_positionX.txt')

for name in ('GPT Bild (Foto + Logo)', 'GPT Bild (nur Logo)'):
    n = byname[name]
    n['retryOnFail'] = True
    n['maxTries'] = 3
    n['waitBetweenTries'] = 5000
    n['onError'] = 'continueRegularOutput'

json.dump(w, open('_deploy_source.json', 'w'), indent=2, ensure_ascii=True)
s = open('_deploy_source.json').read()
assert all(ord(c) < 127 for c in s), 'non-ascii in deploy source'
print('patched ok; badge positionX =', txt[0]['positionX'][:60], '...')
