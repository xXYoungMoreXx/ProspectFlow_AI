import os

files = [
    'apps/api/src/application/auth/auth.handlers.ts',
    'apps/api/src/http/middleware/auth.middleware.ts'
]

for file_path in files:
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        continue
    with open(file_path, 'r') as f:
        content = f.read()

    # The current code has .replace(/\n/g, "\n")
    # We want to change it to .split('\n').join('\n')
    # Note: in Python string literal, we need to be careful.

    # Current code literally contains: .replace(/\n/g, "\n")
    # Actually, let's verify what's in the file.
    if '.replace(/\\n/g, "\n")' in content:
         new_content = content.replace('.replace(/\\n/g, "\n")', ".split('\\n').join('\n')")
    elif '.replace(/\n/g, "\n")' in content:
         # This matches one backslash in regex, which matches newline.
         # This is what CodeQL complained about if it was replacing newline with newline.
         new_content = content.replace('.replace(/\n/g, "\n")', ".split('\\n').join('\n')")
    else:
         print(f"Pattern not found in {file_path}")
         continue

    with open(file_path, 'w') as f:
        f.write(new_content)
    print(f"Updated {file_path}")
