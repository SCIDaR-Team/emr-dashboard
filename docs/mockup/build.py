css=open("part-css.css").read()
js=open("part-js.js").read()
data=open("data.js").read()
html = (
'<title>EMR Readiness Console</title>\n'
'<style>\n' + css + '\n</style>\n'
'<div id="tip" role="status" aria-live="polite"></div>\n'
'<div id="root"></div>\n'
'<script>\n' + data + '\n</script>\n'
'<script>\n' + js + '\n</script>\n'
)
open("emr-console.html","w").write(html)
print("emr-console.html", len(html), "bytes")
