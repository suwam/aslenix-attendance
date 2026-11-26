from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.lib.colors import HexColor
from pathlib import Path

OUT = Path('output/pdf/aslenix-system-report.pdf')
OUT.parent.mkdir(parents=True, exist_ok=True)

NAVY = HexColor('#172554')
BLUE = HexColor('#2563EB')
SKY = HexColor('#EAF2FF')
SLATE = HexColor('#475569')
LIGHT = HexColor('#F8FAFC')
BORDER = HexColor('#CBD5E1')
GREEN = HexColor('#047857')
AMBER = HexColor('#B45309')

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='TitleCustom', parent=styles['Title'], fontName='Helvetica-Bold', fontSize=25, leading=30, textColor=NAVY, spaceAfter=10))
styles.add(ParagraphStyle(name='SubTitle', parent=styles['Normal'], fontName='Helvetica', fontSize=11, leading=16, textColor=SLATE, spaceAfter=16))
styles.add(ParagraphStyle(name='H1Custom', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=17, leading=21, textColor=NAVY, spaceBefore=8, spaceAfter=9))
styles.add(ParagraphStyle(name='H2Custom', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=12.5, leading=16, textColor=BLUE, spaceBefore=8, spaceAfter=5))
styles.add(ParagraphStyle(name='BodyCustom', parent=styles['BodyText'], fontName='Helvetica', fontSize=9.4, leading=13.8, textColor=HexColor('#1E293B'), spaceAfter=6))
styles.add(ParagraphStyle(name='Small', parent=styles['BodyText'], fontName='Helvetica', fontSize=8, leading=10.5, textColor=SLATE))
styles.add(ParagraphStyle(name='CardHead', parent=styles['BodyText'], fontName='Helvetica-Bold', fontSize=10, leading=13, textColor=NAVY, spaceAfter=2))
styles.add(ParagraphStyle(name='CardText', parent=styles['BodyText'], fontName='Helvetica', fontSize=8.5, leading=11.2, textColor=SLATE))
styles.add(ParagraphStyle(name='TOC', parent=styles['BodyText'], fontName='Helvetica', fontSize=10, leading=18, textColor=HexColor('#1E40AF')))

def p(text, style='BodyCustom'):
    return Paragraph(text, styles[style])

def bullet(text):
    return Paragraph('&bull; ' + text, styles['BodyCustom'])

def section(title, intro=None):
    out = [p(title, 'H1Custom')]
    if intro: out.append(p(intro))
    return out

def table(rows, widths, header=True):
    t = Table(rows, colWidths=widths, repeatRows=1 if header else 0, hAlign='LEFT')
    ts = [
        ('VALIGN', (0,0), (-1,-1), 'TOP'), ('GRID', (0,0), (-1,-1), .35, BORDER),
        ('LEFTPADDING', (0,0), (-1,-1), 7), ('RIGHTPADDING', (0,0), (-1,-1), 7),
        ('TOPPADDING', (0,0), (-1,-1), 6), ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('BACKGROUND', (0,1), (-1,-1), colors.white),
    ]
    if header:
        ts += [('BACKGROUND', (0,0), (-1,0), NAVY), ('TEXTCOLOR', (0,0), (-1,0), colors.white), ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold')]
    for i in range(1 if header else 0, len(rows)):
        if i % 2 == 0: ts.append(('BACKGROUND', (0,i), (-1,i), LIGHT))
    t.setStyle(TableStyle(ts))
    return t

def card(title, text, accent=BLUE):
    data = [[p(title, 'CardHead')], [p(text, 'CardText')]]
    t = Table(data, colWidths=[84*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,-1),LIGHT), ('BOX',(0,0),(-1,-1),.55,BORDER),
        ('LINEBEFORE',(0,0),(0,-1),3,accent), ('LEFTPADDING',(0,0),(-1,-1),9), ('RIGHTPADDING',(0,0),(-1,-1),7),
        ('TOPPADDING',(0,0),(-1,0),7), ('BOTTOMPADDING',(0,-1),(-1,-1),7),
    ]))
    return t

def header_footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    if doc.page > 1:
        canvas.setStrokeColor(BORDER); canvas.setLineWidth(.4); canvas.line(18*mm, h-15*mm, w-18*mm, h-15*mm)
        canvas.setFont('Helvetica-Bold', 7.8); canvas.setFillColor(NAVY); canvas.drawString(18*mm, h-11*mm, 'ASLENIX HR & ATTENDANCE PLATFORM')
        canvas.setFont('Helvetica', 7.8); canvas.setFillColor(SLATE); canvas.drawRightString(w-18*mm, h-11*mm, 'System Report | 26 November 2026')
    canvas.setStrokeColor(BORDER); canvas.line(18*mm, 14*mm, w-18*mm, 14*mm)
    canvas.setFont('Helvetica', 7.5); canvas.setFillColor(SLATE)
    canvas.drawString(18*mm, 9*mm, 'Prepared from the current application source and database migration history')
    canvas.drawRightString(w-18*mm, 9*mm, f'Page {doc.page}')
    canvas.restoreState()

story=[]
# Cover
story += [Spacer(1, 29*mm), p('ASLENIX', 'TitleCustom'), p('HR & Attendance Platform', 'TitleCustom')]
story += [p('System Features and Capability Report', 'SubTitle')]
cover = Table([[p('<b>Purpose</b><br/>A practical overview of the modules, workflows, roles, security controls, reporting, and technology included in the current system.', 'BodyCustom'),
                p('<b>Prepared</b><br/>26 November 2026<br/><br/><b>Scope</b><br/>Current repository implementation and migrations.', 'BodyCustom')]], colWidths=[95*mm, 65*mm])
cover.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),SKY),('BOX',(0,0),(-1,-1),.7,HexColor('#93C5FD')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),11),('RIGHTPADDING',(0,0),(-1,-1),11),('TOPPADDING',(0,0),(-1,-1),10),('BOTTOMPADDING',(0,0),(-1,-1),10)]))
story += [Spacer(1, 8*mm), cover, Spacer(1, 17*mm)]
story += [p('Executive summary', 'H2Custom'), p('ASLENIX is a web-based human resource, attendance, and work-management platform. It provides separate employee and administrator workspaces, combining daily attendance, shift handling, leave management, task delivery, communications, recognition, reporting, and operational controls in one system.'), p('The platform is designed around role-aware access: employees use self-service features, while administrators and HR users manage people, policy settings, approvals, corrections, reporting, and attendance operations.'), Spacer(1, 20*mm), p('Report navigation', 'H2Custom')]
story += [p('1. System overview<br/>2. Employee workspace<br/>3. Administrator and HR workspace<br/>4. Core workflows<br/>5. Reporting and analytics<br/>6. Security and governance<br/>7. Architecture and data<br/>8. Operational notes', 'TOC')]
story.append(PageBreak())

# Overview
story += section('1. System overview', 'The platform is organized as a unified operating system for workforce administration. Its major capability areas are below.')
cards = [[card('Workforce administration', 'Employee profiles, approval state, active/suspended status, departments, roles, employee codes, and profile management.', BLUE), card('Time and presence', 'Check-in/out, location-aware attendance, QR and card-reader flows, late and early checkout tracking, work-from-home and attendance history.', GREEN)],
         [card('Leave and schedules', 'Leave requests and balances, conflict handling, holidays, calendar events, flexible shifts, grace periods, and working-day settings.', AMBER), card('Work delivery', 'Tasks, assignments, progress updates, reviews, comments, attachments, sprints, modules, targets, and activity history.', HexColor('#7C3AED'))],
         [card('Communication and engagement', 'Messages, meetings, notifications, WhatsApp notification setup/history, mood logs, achievements, and employee-of-the-month recognition.', HexColor('#DB2777')), card('Operations insight', 'Live dashboard metrics, workforce presence radar, attendance trends, department breakdowns, and downloadable management reporting.', HexColor('#0891B2'))]]
grid=Table(cards,colWidths=[85*mm,85*mm],rowHeights=[39*mm,39*mm,39*mm],hAlign='LEFT'); grid.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),3),('RIGHTPADDING',(0,0),(-1,-1),3),('TOPPADDING',(0,0),(-1,-1),3),('BOTTOMPADDING',(0,0),(-1,-1),3)])); story += [grid, Spacer(1,5*mm)]
story += [p('User roles', 'H2Custom'), table([[p('Role','Small'),p('Primary access','Small'),p('Typical responsibilities','Small')],[p('Employee'),p('Self-service workspace'),p('Check in/out, view attendance, request leave, manage assigned work, attend meetings, message, review notifications and profile.')],[p('Administrator / HR'),p('Administrative workspace'),p('Manage employees, approvals, attendance and corrections, shifts, leave, reports, calendar, recognition, task oversight, settings, notification channels.')],[p('Team lead / task lead'),p('Task-level delegated capability'),p('Task leadership, assignment and workflow controls where configured.')]], [34*mm,46*mm,90*mm])]
story.append(PageBreak())

# employee
story += section('2. Employee workspace', 'Employees access a focused self-service portal once their account has been approved. The navigation separates day-to-day work from administration.')
story += [p('Included employee functions', 'H2Custom'), table([[p('Area','Small'),p('What the employee can do','Small')],[p('Dashboard'),p('See a personal overview of work, attendance and current updates.')],[p('Check-in and attendance'),p('Record attendance, check out, view personal history and status. Attendance supports present, late, work-from-home and leave-related states.')],[p('Leave'),p('Submit, view and manage own leave requests and see leave information.')],[p('Tasks'),p('View assigned tasks, report progress, add notes and comments, attach supporting files, and submit work for review.')],[p('Calendar and meetings'),p('Review shared calendar events and meeting information.')],[p('Messages and notifications'),p('Use internal chat, receive real-time notification updates, mark items read, and view unread counters.')],[p('Canteen attendance'),p('Access the employee-facing canteen attendance workflow where enabled.')],[p('Profile and settings'),p('Maintain profile information and personal settings.')]], [41*mm,129*mm])]
story += [p('Employee task workflow', 'H2Custom'), p('The integrated task process follows the workflow <b>todo - in progress - ready for review - approved - completed</b>. Assigned employees can update progress, enter progress notes, upload attachments, comment, and submit work for review. Management-side review and completion controls remain restricted.')]
story += [p('Employee experience notes', 'H2Custom'), bullet('Responsive web interface with desktop sidebar and mobile navigation drawer.'), bullet('Live notification and chat updates through real-time database channels.'), bullet('Support for Nepal calendar presentation alongside standard dates in dashboard reporting.'), bullet('Account-state handling for pending, rejected, suspended and locked profiles.')]
story.append(PageBreak())

# admin
story += section('3. Administrator and HR workspace', 'Administrators have a dedicated dashboard and an expanded navigation set for daily operations, controls and reporting.')
story += [p('Administrative modules', 'H2Custom'), table([[p('Module','Small'),p('Included administration capabilities','Small')],[p('Operations dashboard'),p('Live counts for employees, active staff, present, absent, late, leave requests, pending approvals and attendance percentage. Includes workforce presence roster, attendance history and department view.')],[p('Employee management'),p('Manage employee records, account approvals, status, employee QR IDs, and administrative password actions.')],[p('Attendance administration'),p('View workforce attendance, make audited corrections, operate card-reader attendance, manage QR attendance and review attendance-related activity.')],[p('Shift management'),p('Create and manage shifts, grace periods, scheduled hours, break duration, working days, and effective-dated employee shift assignments.')],[p('Leave management'),p('Review, approve, reject, cancel or modify leave requests and resolve attendance conflicts.')],[p('Work oversight'),p('Manage tasks, team task leadership, work assignments, progress, sprint/module structures, work-item history and review controls.')],[p('Engagement & communications'),p('Manage meetings, notifications, employee-of-the-month recognition, WhatsApp setup/history, and internal messages.')],[p('Settings & reports'),p('Set operating policies, view system reports and use attendance/operational reporting capabilities.')]], [43*mm,127*mm])]
story += [p('Administrative decision support', 'H2Custom'), p('The dashboard compiles active employee totals, attendance state, late arrivals, pending leave requests and user approvals. It also prepares 7-day, 14-day and current Nepali-month attendance views, department counts and recent operational activity for management review.')]
story.append(PageBreak())

# workflows
story += section('4. Core workflows', 'The following describes the operational flow implemented across the system.')
flow = [[p('<b>1. Account onboarding</b><br/>A user registers and receives a profile. Administrative approval determines whether the account can access the protected application.', 'CardText'),p('<b>2. Daily attendance</b><br/>Employee checks in using supported mechanisms. The system stores attendance state, timing and supporting operational data.', 'CardText'),p('<b>3. Review and correction</b><br/>If needed, an attendance correction request or administrator edit is processed with an audit-aware reason and history.', 'CardText')], [p('<b>4. Leave and schedule</b><br/>Leave is requested, reviewed and reconciled with attendance. Shift rules determine scheduled time, grace and work-duration calculations.', 'CardText'),p('<b>5. Work delivery</b><br/>Tasks are assigned, progress is updated with notes or attachments, then work is submitted for review and completed after approval.', 'CardText'),p('<b>6. Reporting and notification</b><br/>Operational dashboards, reports and notifications surface changes to employees, managers and administrators.', 'CardText')]]
ft=Table(flow,colWidths=[56.5*mm]*3,rowHeights=[43*mm,43*mm]); ft.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),LIGHT),('BOX',(0,0),(-1,-1),.55,BORDER),('INNERGRID',(0,0),(-1,-1),.35,BORDER),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),9),('BOTTOMPADDING',(0,0),(-1,-1),7)])); story += [ft]
story += [p('Attendance methods and controls', 'H2Custom'), bullet('Standard employee check-in/out, including work location handling.'), bullet('Digital QR identity and QR verification flows for approved employees.'), bullet('Administrative card-reader attendance with reader status, employee-card registration and auditable scan history.'), bullet('Flexible shift assignment with scheduled start/end, grace periods, late minutes, early checkout, work minutes and overtime tracking.'), bullet('Automatic checkout support and attendance cut-off controls, backed by database functions and scheduled scripts.'), bullet('Attendance corrections, edit snapshots and audit logs so changes can be reviewed.')]
story += [p('Leave controls', 'H2Custom'), p('Leave management includes requests, balances, holidays, vacation quota handling, approval/rejection/cancellation/modification operations and a conflict process for leave records that overlap attendance records.')]
story.append(PageBreak())

# reporting security
story += section('5. Reporting, analytics and communications', 'The product includes both live operational insight and supporting communication channels.')
story += [p('Reporting and analytics', 'H2Custom'), table([[p('View','Small'),p('Included insight','Small')],[p('Live admin dashboard'),p('Present/absent/late counts, active headcount, pending administrative actions, attendance percentage and live roster status.')],[p('Attendance trends'),p('Rolling 7-day and 14-day history plus Nepali-month-to-date view, split into present, late, work-from-home and absent states.')],[p('Workforce breakdown'),p('Employee grouping by department and current workforce presence radar.')],[p('Administrative reports'),p('Dedicated reports route for management reporting and spreadsheet-style operational output.')],[p('Standup reports'),p('Database structures for daily, weekly and monthly standup reporting.')],[p('Task history'),p('Progress updates, assignment activity and work-item logs for accountability.')]], [49*mm,121*mm])]
story += [p('Communication and engagement', 'H2Custom'), bullet('Internal chat supports conversations, messages, presence and read-state management.'), bullet('Notification system supports unread state, live updates, administrator notices and activity visibility.'), bullet('Meeting module supports employee and administrator meeting views.'), bullet('WhatsApp settings, notification queue/history, and webhook/edge-function integrations are present for outward notification delivery.'), bullet('Employee achievements, employee-of-the-month awards and mood logs support recognition and engagement.')]
story.append(PageBreak())
story += [p('6. Security and governance', 'H1Custom'), p('The implementation uses layered application and database controls. The list below describes included safeguards; actual protection also depends on deployment configuration, user administration and operational policy.')]
story += [table([[p('Control','Small'),p('Implementation evidence','Small')],[p('Authentication and protected routes'),p('Application layout redirects unauthenticated users and prevents protected use for pending, rejected, suspended or locked profiles.')],[p('Role-aware access'),p('User roles and administrator checks are used to separate employee and administration functions; task mutations are restricted by database functions.')],[p('Row-level policy design'),p('The Supabase database schema and migration history include role and authorization functions used by application data access.')],[p('Attendance safeguards'),p('Location guard, trusted-device records, device limits, passkey-related tables, QR approval restriction and card-reader audit entries are included.')],[p('Change accountability'),p('Attendance correction requests, snapshots, audit logs, work assignment activity and task history preserve traceability.')],[p('Notification privacy'),p('Notification and chat updates are targeted by user data and read state, while messaging permission functions are included in migrations.')]], [49*mm,121*mm])]
story.append(PageBreak())

# Architecture
story += section('7. Architecture and data foundation', 'The current implementation is a modern TypeScript web application integrated with Supabase services and server-side operational functions.')
story += [p('Technology stack', 'H2Custom'), table([[p('Layer','Small'),p('Technology / responsibility','Small')],[p('Frontend'),p('React 19, TypeScript, TanStack Start and TanStack Router for the web application and protected route structure.')],[p('UI and visualization'),p('Tailwind CSS, Radix UI components, Lucide icons, Recharts and responsive layouts.')],[p('Data and identity'),p('Supabase JavaScript client, PostgreSQL database, authentication, real-time subscriptions, database functions and migrations.')],[p('Security-related client support'),p('FingerprintJS and Simple WebAuthn libraries for device/passkey-related flows.')],[p('Deployment/build'),p('Vite with Cloudflare plugin and project deployment configuration; Vercel configuration is also present.')],[p('Automation'),p('Node scripts for automatic checkout, weekly report generation, build setup and database-type updates.')]], [49*mm,121*mm])]
story += [p('Core data domains', 'H2Custom'), p('The database migration history defines or extends domains for profiles, roles, attendance, leave requests, notifications, settings, activity logs, tasks, task comments/attachments/assignees, meetings, chat, calendar events, shifts, attendance corrections, device security, card readers, canteen attendance, recognition, moods, WhatsApp notifications, sprints, modules, work items and their histories.')]
story += [p('Data and audit patterns', 'H2Custom'), bullet('Timestamp/update triggers and effective-dated shift assignments preserve operational history.'), bullet('Attendance retains scheduled time, shift snapshots and calculated duration metrics.'), bullet('Work progress, assignment activity and attendance corrections create accountability trails.')]
story += [p('8. Operational notes and recommended next steps', 'H1Custom'), p('This report describes the current implemented scope found in the project source. Before using it as a contractual feature list, validate environment-specific settings, access policies, external messaging credentials, hardware integrations and any features gated by configuration.')]
story += [bullet('Publish an approved role matrix and operating policy for attendance, leave and data retention.'), bullet('Test QR, card-reader, WhatsApp and auto-checkout flows in production before rollout.'), bullet('Periodically review database policies, device/passkey settings and administrator permissions.')]
story += [Spacer(1, 4*mm), p('Basis: current project navigation, application components, package configuration, automation scripts and Supabase migration history. Configured integrations should be verified in the production environment.', 'Small')]

doc = SimpleDocTemplate(str(OUT), pagesize=A4, rightMargin=18*mm, leftMargin=18*mm, topMargin=20*mm, bottomMargin=20*mm, title='ASLENIX HR & Attendance Platform - System Report', author='ASLENIX')
doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
print(OUT)
