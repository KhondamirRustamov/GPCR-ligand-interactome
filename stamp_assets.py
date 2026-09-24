#!/usr/bin/env python3
"""Re-stamp ?v=<content-hash> on style.css / scripts.js in every HTML page.

GitHub Pages sends cache-control: max-age=600 per file, so index.html can update
while a visitor's browser still runs a cached scripts.js. A content-hash query
string makes the URL change whenever the file changes, so that mismatch cannot
happen. Run this after editing scripts.js or style.css, before committing.
"""
import hashlib, re, glob, os
HERE = os.path.dirname(os.path.abspath(__file__))
h8 = lambda p: hashlib.sha1(open(p, 'rb').read()).hexdigest()[:8]
v = {f: h8(os.path.join(HERE, f)) for f in ('scripts.js', 'style.css')}
for page in glob.glob(os.path.join(HERE, '*.html')):
    t = open(page).read(); orig = t
    t = re.sub(r'href="style\.css(\?v=[0-9a-f]+)?"', 'href="style.css?v=%s"' % v['style.css'], t)
    t = re.sub(r'src="scripts\.js(\?v=[0-9a-f]+)?"', 'src="scripts.js?v=%s"' % v['scripts.js'], t)
    if t != orig:
        open(page, 'w').write(t)
        print('stamped', os.path.basename(page))
print('versions:', v)
