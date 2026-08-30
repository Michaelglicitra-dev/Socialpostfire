import json

w = json.load(open('_live_base.json'))
nodes = {n['name']: n for n in w['nodes']}
conn = w['connections']

def code(f):
    s = open(f).read().rstrip('\n')
    assert all(ord(c) < 127 for c in s), 'non-ascii in ' + f
    return s

# --- 1) Code-Nodes ersetzen ---
for name, f in {
    'Restaurant-Konfiguration': '01_Restaurant-Konfiguration.js',
    'Bild-Modus': '02_Bild-Modus.js',
    'Bild-Request bauen (Foto)': '03_Bild-Request_bauen_Foto.js',
    'Bild-Request bauen (Logo)': '04_Bild-Request_bauen_Neu.js',
    'Bild extrahieren': '05_Bild_extrahieren.js',
    'Freigabe-Ergebnis': '07_Freigabe-Ergebnis.js',
    'Freigabe-Ergebnis-Text': '08_Freigabe-Ergebnis-Text.js',
}.items():
    nodes[name]['parameters']['jsCode'] = code(f)

# --- 2) Preis-Badge Zentrierung ---
ops = nodes['Preis-Badge stempeln']['parameters']['operations']['operations']
txt = [o for o in ops if o.get('operation') == 'text' and str(o.get('fontSize')) == '60']
assert len(txt) == 1
txt[0]['positionX'] = code('06_Preis-Badge_positionX.txt')

# --- 3) Logo nicht mehr an die Bild-KI schicken ---
foto = nodes['GPT Bild (Foto + Logo)']
ps = foto['parameters']['bodyParameters']['parameters']
vorher = len(ps)
foto['parameters']['bodyParameters']['parameters'] = [
    x for x in ps if x.get('inputDataFieldName') != 'logo']
assert len(foto['parameters']['bodyParameters']['parameters']) == vorher - 1

# --- 4) Generierungs-Pfad auf images/generations ---
gen = nodes['GPT Bild (nur Logo)']
gen['parameters'] = {
    'method': 'POST',
    'url': 'https://api.openai.com/v1/images/generations',
    'authentication': 'predefinedCredentialType',
    'nodeCredentialType': 'openAiApi',
    'sendBody': True,
    'specifyBody': 'json',
    'jsonBody': '={{ JSON.stringify($json.openai_gen_body) }}',
    'options': {'response': {'response': {'responseFormat': 'json'}}, 'timeout': 240000},
}

# --- 5) Umbenennen (Namen sind nirgends per $() referenziert) ---
umbenennen = {
    'GPT Bild (Foto + Logo)': 'GPT Bild (Foto)',
    'GPT Bild (nur Logo)': 'GPT Bild (Neu)',
    'Bild-Request bauen (Logo)': 'Bild-Request bauen (Neu)',
}
alltext = json.dumps(w)
for alt in umbenennen:
    assert ("$('" + alt + "')") not in alltext, 'Node wird per $() referenziert: ' + alt
for alt, neu in umbenennen.items():
    nodes[alt]['name'] = neu
    if alt in conn:
        conn[neu] = conn.pop(alt)
for quelle in conn.values():
    for lists in quelle.values():
        for gruppe in lists or []:
            for ziel in gruppe or []:
                if ziel['node'] in umbenennen:
                    ziel['node'] = umbenennen[ziel['node']]
nodes = {n['name']: n for n in w['nodes']}

# --- 6) Platz schaffen: alles ab Preis-Badge? nach rechts ---
SCHIEBEN = ['Preis-Badge?', 'Preis-Badge stempeln', 'Finalbild extrahieren', 'imgbb hochladen',
            'Entwurf-Daten bauen', 'Entwurf-Foto senden', 'Entscheidung senden', 'Session DRAFT_OPEN']
for name in SCHIEBEN:
    nodes[name]['position'][0] += 672

# --- 7) Neue Nodes: Logo real aufkomponieren ---
neu_nodes = [
    {'name': 'Logo buendeln', 'type': 'n8n-nodes-base.code', 'typeVersion': 2,
     'position': [6800, 688], 'parameters': {'jsCode': code('09_Logo_buendeln.js')}},
    {'name': 'Logo skalieren', 'type': 'n8n-nodes-base.editImage', 'typeVersion': 1,
     'position': [7024, 688], 'parameters': {
         'operation': 'resize',
         'dataPropertyName': 'logo',
         'width': '={{ $json.logo_box_breite }}',
         'height': '={{ $json.logo_box_hoehe }}',
         'resizeOption': 'maximumArea',
         'options': {'destinationKey': 'logo', 'format': 'png', 'quality': 100}}},
    {'name': 'Logo einfuegen', 'type': 'n8n-nodes-base.editImage', 'typeVersion': 1,
     'position': [7248, 688], 'parameters': {
         'operation': 'composite',
         'dataPropertyName': 'data',
         'dataPropertyNameComposite': 'logo',
         'operator': 'Over',
         'positionX': "={{ $('Logo buendeln').first().json.logo_x }}",
         'positionY': "={{ $('Logo buendeln').first().json.logo_y }}",
         'options': {'destinationKey': 'data', 'format': 'png', 'quality': 100}}},
]
for n in neu_nodes:
    assert n['name'] not in nodes, n['name']
    w['nodes'].append(n)

# --- 8) Umverdrahten: Bild extrahieren -> Logo-Kette -> Preis-Badge? ---
assert conn['Bild extrahieren']['main'] == [[{'node': 'Preis-Badge?', 'type': 'main', 'index': 0}]]
conn['Bild extrahieren']['main'] = [[{'node': 'Logo buendeln', 'type': 'main', 'index': 0}]]
conn['Logo buendeln'] = {'main': [[{'node': 'Logo skalieren', 'type': 'main', 'index': 0}]]}
conn['Logo skalieren'] = {'main': [[{'node': 'Logo einfuegen', 'type': 'main', 'index': 0}]]}
conn['Logo einfuegen'] = {'main': [[{'node': 'Preis-Badge?', 'type': 'main', 'index': 0}]]}

# --- 9) maxTries/waitBetweenTries raus: das SDK uebertraegt sie nicht ---
for n in w['nodes']:
    n.pop('maxTries', None)
    n.pop('waitBetweenTries', None)

json.dump(w, open('_deploy_source.json', 'w'), indent=2, ensure_ascii=True)
s = open('_deploy_source.json').read()
assert all(ord(c) < 127 for c in s), 'non-ascii im Deploy-Source'
print('Nodes:', len(w['nodes']), '| Kette:',
      ' -> '.join(['Bild extrahieren', 'Logo buendeln', 'Logo skalieren', 'Logo einfuegen', 'Preis-Badge?']))
