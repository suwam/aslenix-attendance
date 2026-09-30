import os

path = "src/components/TaskDialog.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    'bg-muted/5 flex flex-col sm:flex-row items-center justify-between gap-4          <div className="flex items-center gap-2">',
    'bg-muted/5 flex flex-col sm:flex-row items-center justify-between gap-4">\n          <div className="flex items-center gap-2">'
)
content = content.replace(
    '              </Button>\n            )}\n          </div>div>\n        </div>\n      </DialogContent>',
    '              </Button>\n            )}\n          </div>\n        </div>\n      </DialogContent>'
)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
