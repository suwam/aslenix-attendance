import os

path = "src/routes/_app/admin/tasks.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Make some string replacements to improve the admin UI

# 1. Import framer-motion
if 'import { motion' not in content:
    content = content.replace('import { WeeklySprintReport } from "@/components/tasks/WeeklySprintReport";', 'import { WeeklySprintReport } from "@/components/tasks/WeeklySprintReport";\nimport { motion } from "framer-motion";')

# 2. Add an AnimatePresence wrapper for modules
content = content.replace('<div className="space-y-6 mt-8">', '<motion.div className="space-y-6 mt-8" initial="hidden" animate="visible" variants={{hidden: {opacity: 0}, visible: {opacity: 1, transition: {staggerChildren: 0.1}}}}>')
content = content.replace('</div >\n      )}', '</motion.div>\n      )}') # Wait, need to be careful with replace

# Actually, the python script to completely replace it is safer.
