import os, subprocess, json, re, shutil

contracts_dir = r'c:\PC\Peach\packages\peach_contracts'
frontend_env = r'c:\PC\Peach\apps\frontend\.env.local'

try: os.remove(os.path.join(contracts_dir, 'Published.toml'))
except: pass
try: os.remove(os.path.join(contracts_dir, 'Move.lock'))
except: pass
try: shutil.rmtree(os.path.join(contracts_dir, 'build'))
except: pass

move_toml_path = os.path.join(contracts_dir, 'Move.toml')
with open(move_toml_path, 'r', encoding='utf-8') as f:
    move_toml = f.read()

move_toml = re.sub(r'peach_contracts\s*=\s*".*?"', 'peach_contracts = "0x0"', move_toml)

with open(move_toml_path, 'w', encoding='utf-8') as f:
    f.write(move_toml)

print('Publishing contract...')
result = subprocess.run(['sui', 'client', 'publish', '--json'], cwd=contracts_dir, capture_output=True, text=True)

if result.returncode != 0:
    print('Error publishing:', result.stderr)
    print(result.stdout)
    exit(1)

try:
    data = json.loads(result.stdout)
except Exception as e:
    print('Error parsing JSON:', e)
    print(result.stdout)
    exit(1)

package_id = None
registry_id = None

for change in data.get('objectChanges', []):
    if change.get('type') == 'published':
        package_id = change.get('packageId')
    elif change.get('type') == 'created':
        obj_type = change.get('objectType', '')
        if '::peach_registry::PeachRegistry' in obj_type:
            registry_id = change.get('objectId')

print(f'Package ID: {package_id}')
print(f'Registry ID: {registry_id}')

if not package_id or not registry_id:
    print('Failed to find IDs in output')
    exit(1)

# Update Move.toml with new package id
move_toml = re.sub(r'peach_contracts\s*=\s*".*?"', f'peach_contracts = "{package_id}"', move_toml)
with open(move_toml_path, 'w', encoding='utf-8') as f:
    f.write(move_toml)

# Update .env.local
with open(frontend_env, 'r', encoding='utf-8') as f:
    env_data = f.read()

env_data = re.sub(r'NEXT_PUBLIC_PEACH_PACKAGE_ID=.*', f'NEXT_PUBLIC_PEACH_PACKAGE_ID={package_id}', env_data)
env_data = re.sub(r'NEXT_PUBLIC_PEACH_REGISTRY_ID=.*', f'NEXT_PUBLIC_PEACH_REGISTRY_ID={registry_id}', env_data)

with open(frontend_env, 'w', encoding='utf-8') as f:
    f.write(env_data)

print('Successfully updated frontend env!')
