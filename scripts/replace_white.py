import os
import re

def replace_white_in_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Failed to read {filepath}: {e}")
        return

    original = content

    # Replace CSS hex codes
    content = re.sub(r'(?i)#ffffff\b', '#f1f0ee', content)
    content = re.sub(r'(?i)#fff\b', '#f1f0ee', content)

    # Replace 'white' as a CSS value or in JSX properties
    # Match preceding: ':', ',', ' ', '="', "='", '`'
    # Match trailing: ' ', ';', ')', ',', '"', "'", '`'
    content = re.sub(r'(?i)(:|,\s*|\s|="|=\'|`)\bwhite\b(?=\s|;|\)|,|"|\'|`)', r'\1#f1f0ee', content)

    # Replace Tailwind utility classes
    content = re.sub(r'\bbg-white\b', 'bg-[#f1f0ee]', content)
    content = re.sub(r'\btext-white\b', 'text-[#f1f0ee]', content)
    content = re.sub(r'\bborder-white\b', 'border-[#f1f0ee]', content)
    content = re.sub(r'\bfill-white\b', 'fill-[#f1f0ee]', content)
    content = re.sub(r'\bstroke-white\b', 'stroke-[#f1f0ee]', content)
    content = re.sub(r'\bring-white\b', 'ring-[#f1f0ee]', content)
    content = re.sub(r'\bfrom-white\b', 'from-[#f1f0ee]', content)
    content = re.sub(r'\bvia-white\b', 'via-[#f1f0ee]', content)
    content = re.sub(r'\bto-white\b', 'to-[#f1f0ee]', content)
    content = re.sub(r'\bshadow-white\b', 'shadow-[#f1f0ee]', content)

    if content != original:
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Updated {filepath}")
        except Exception as e:
            print(f"Failed to write {filepath}: {e}")

def walk_dir(directory):
    for root, dirs, files in os.walk(directory):
        # Exclude directories
        dirs[:] = [d for d in dirs if d not in ('.git', 'node_modules', 'dist', '.tanstack', '.wrangler', 'supabase', '.wrangler-config')]
        for file in files:
            if file.endswith(('.css', '.tsx', '.ts', '.html', '.js', '.jsx')):
                filepath = os.path.join(root, file)
                replace_white_in_file(filepath)

if __name__ == "__main__":
    walk_dir('d:/aslenix-attendance')
