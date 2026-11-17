# Narration with ElevenLabs (voice "Laura", the one in the current video).
# Usage: python3 make-voice-elevenlabs.py script.json OUT_DIR [VOICE_ID]
# Sends the key in the xi-api-key header; set it in the environment that runs this.
import json, os, sys, urllib.request
script = json.load(open(sys.argv[1]))
out = sys.argv[2]
voice = sys.argv[3] if len(sys.argv) > 3 else 'FGY2WhTYpPnrIDTdsKH5'  # Laura
os.makedirs(out, exist_ok=True)
lines = script['lines']
for i, line in enumerate(lines):
    body = {
        'text': line['text'],
        'model_id': 'eleven_multilingual_v2',
        'voice_settings': {'stability': 0.38, 'similarity_boost': 0.8, 'style': 0.5, 'use_speaker_boost': True, 'speed': 1.0},
        'previous_text': lines[i - 1]['text'] if i else None,
        'next_text': lines[i + 1]['text'] if i + 1 < len(lines) else None,
    }
    req = urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_128',
                                 data=json.dumps(body).encode(), method='POST',
                                 headers={'xi-api-key': os.environ.get('ELEVENLABS_API_KEY', 'proxy-injected'), 'Content-Type': 'application/json', 'Accept': 'audio/mpeg'})
    with urllib.request.urlopen(req, timeout=120) as r:
        open(os.path.join(out, line['id'] + '.mp3'), 'wb').write(r.read())
    print('ok', line['id'])
