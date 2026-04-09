import json
import os
import sys

path = r'C:\Users\robin\.claude\projects\E-------fennnec\dc22d863-11a8-49e3-a02c-721f2952fb27.jsonl'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Extract all Write tool calls, last write wins
writes = {}
for line in lines:
    try:
        obj = json.loads(line)
        content = obj.get('message', {}).get('content', [])
        if isinstance(content, list):
            for block in content:
                if isinstance(block, dict) and block.get('type') == 'tool_use' and block.get('name') == 'Write':
                    inp = block.get('input', {})
                    fp = inp.get('file_path', '')
                    writes[fp] = inp.get('content', '')
    except:
        pass

print(f"Total writes: {len(writes)}", file=sys.stderr)

# If a target arg given, dump that file's content
if len(sys.argv) > 1:
    target = sys.argv[1]
    for k, v in writes.items():
        if k.endswith(target):
            sys.stdout.buffer.write(v.encode('utf-8'))
            sys.exit(0)
    print(f"NOT FOUND: {target}", file=sys.stderr)
    sys.exit(1)

for k in sorted(writes.keys()):
    print(len(writes[k]), repr(k))
