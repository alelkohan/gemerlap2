import os, glob
dist_path = os.path.join(os.getcwd(), 'dist')
files = glob.glob(os.path.join(dist_path, '**/*.html'), recursive=True)
tags = '<title>Gemerlap TPS</title>\n<link rel="apple-touch-icon" href="/icon.png" />\n<meta name="apple-mobile-web-app-title" content="Gemerlap">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n'
for f in files:
    with open(f, 'r') as file:
        content = file.read()
    if 'apple-mobile-web-app-capable' not in content:
        content = content.replace('</head>', tags + '</head>')
        with open(f, 'w') as file:
            file.write(content)
