"""Create sample Jira tickets across all 5 teams for AXIS demo."""
from dotenv import load_dotenv
load_dotenv('/Users/gokulravi/Desktop/AXIS/.env')

import os, requests
from requests.auth import HTTPBasicAuth

base = os.environ['JIRA_BASE_URL']
auth = HTTPBasicAuth(os.environ['JIRA_EMAIL'], os.environ['JIRA_API_TOKEN'])
headers = {'Content-Type': 'application/json'}

def doc(text):
    return {"type":"doc","version":1,"content":[{"type":"paragraph","content":[{"type":"text","text":text}]}]}

tickets = [
    {"summary": "Rewards sync failing for members with multiple accounts", "label": "Engineering",
     "body": "The rewards sync job (RWD-sync) is failing silently for members who have merged accounts. The transaction_ref_id deduplication is not handling the legacy account mapping table correctly. Affects ~2,300 members. Fix: join against account_merge_history before dedup check. Assigned to backend infra team. Status: In Progress."},
    {"summary": "JWT token expiry causing logout on mobile app mid-session", "label": "Engineering",
     "body": "Members are being logged out mid-session on iOS. Root cause: the AuthService is not refreshing tokens proactively when under 5 minutes remain. The mobile client relies on server-side push refresh which was removed in v2.4. Fix: re-implement proactive refresh in AuthMiddleware. ETA: next sprint."},
    {"summary": "Benefits card issuance timeout spike — FIS gateway degraded", "label": "Engineering",
     "body": "FIS gateway timeouts increased from 0.2% to 8.7% between 14:00 and 16:30 on June 20. CardService retry logic capped at 3 attempts with exponential backoff. Mitigation: increased timeout from 10s to 15s. Root cause: FIS running batch maintenance. Resolved at 16:45."},
    {"summary": "Migrate Rewards Service from Node 18 to Node 20", "label": "Engineering",
     "body": "Node 18 EOL is September 2025. RWD service needs upgrading to Node 20 LTS. Key changes: native fetch replaces node-fetch, test suite updates needed. Target: complete before August release freeze."},
    {"summary": "member_events DAG failed — stale S3 partition pointer", "label": "Data",
     "body": "Airflow DAG member_events_daily failed on June 21 at 02:15 UTC. Root cause: S3 partition pointer for June 20 was not updated after a manual backfill on June 19. Fix: re-ran backfill for June 20-23, updated partition registry. Dashboard data is now current. Added monitoring alert for stale partitions."},
    {"summary": "Dashboard refresh SLA breached for Enterprise tier clients", "label": "Data",
     "body": "3 Enterprise clients (IDs: 1042, 1087, 1203) experienced dashboard refresh delays exceeding the 4-hour SLA on June 22. Cause: Spark cluster autoscaling lagged — max node limit was 8, should be 20. Fix applied. Client Success notified. Post-mortem scheduled June 25."},
    {"summary": "Build member churn prediction model v2", "label": "Data",
     "body": "Current churn model v1 has 67% accuracy. V2 adds behavioral features: login frequency, reward redemption recency, support ticket count. Training data: 18 months of member activity. Target accuracy 75%+. Delivery end of Q3."},
    {"summary": "Duplicate contact records blocking campaign segmentation", "label": "CRM",
     "body": "Salesforce deduplication job ran incorrectly on June 18 — merged 340 records that should not have been merged. These were contacts from the same company but different business units. Marketing campaigns using these segments are paused. Manual review in progress. ETA to resolve: June 26."},
    {"summary": "Automate renewal reminders 90/60/30 days before contract end", "label": "CRM",
     "body": "Renewal reminders are currently sent manually by account managers. Automate triggers at 90, 60, and 30 days before contract_end_date. Integration with Salesforce Flows and SendGrid. Spec approved by Revenue Ops. Dev starting July 1."},
    {"summary": "CRM pipeline report missing deals closed in last 7 days", "label": "CRM",
     "body": "The weekly CRM pipeline report is not showing deals closed after June 16. Root cause: report filter has a hardcoded date range that was not updated. Quick fix applied June 23. Permanent fix: make date range dynamic, rolling 7 days."},
    {"summary": "T2 escalation SLA breached for Acme Corp", "label": "Client_Success",
     "body": "Acme Corp (Enterprise, ARR $280k) submitted a T2 ticket on June 21 regarding incorrect reward balances for 12 employees. SLA is 4 hours — ticket was open 9 hours before response due to on-call scheduling gap. Escalated to CS Director. Compensation: 1 month service credit offered. Root cause: rewards sync bug. Fix deployed June 23."},
    {"summary": "Client onboarding — TechStartup Inc go-live July 18", "label": "Client_Success",
     "body": "TechStartup Inc (Mid-market, 450 members) signed June 20. Onboarding plan: Week 1 SSO setup and admin training, Week 2 benefits card issuance for all members, Week 3 custom dashboard configuration, Week 4 go-live. Primary CS contact: Sarah M. Target go-live: July 18."},
    {"summary": "Quarterly business review prep — GlobalBank account", "label": "Client_Success",
     "body": "QBR for GlobalBank (Enterprise, ARR $520k) scheduled July 10. Agenda: Q2 usage metrics, rewards redemption rates, upcoming digital card feature preview, renewal discussion. CS lead: James T. Deck due July 7. Key risk: client flagged slow dashboard load times — Data team to provide SLA compliance report."},
    {"summary": "Digital card — Phase 2 spec finalized", "label": "Product",
     "body": "Digital card Phase 2 scope finalized: Apple Wallet and Google Pay support, real-time balance display, transaction push notifications, card freeze/unfreeze from app. Dependencies: CardService API v3 (Engineering ETA August), Wallet Service webhook support. Design review: June 30. Dev start: July 7. Target launch: Q3."},
    {"summary": "Member app v3.1 beta — navigation feedback", "label": "Product",
     "body": "Beta group of 200 members tested new navigation in v3.1. Key findings: 68% found the rewards tab harder to find after it was moved from bottom nav to hamburger menu. Recommendation: revert rewards to bottom nav, keep new profile section in hamburger. Design change approved. Will be in v3.2 build."},
    {"summary": "New feature request — bulk reward issuance for HR admins", "label": "Product",
     "body": "HR admins at 3 Enterprise clients have requested the ability to issue rewards to all employees in bulk via a CSV upload. Currently requires manual one-by-one issuance. Proposed: CSV upload in admin portal, validation step, confirmation email to HR admin. Adding to Q4 roadmap. Discovery sprint in August."},
]

created = 0
for t in tickets:
    payload = {
        "fields": {
            "project": {"key": "SCRUM"},
            "summary": t["summary"],
            "description": doc(t["body"]),
            "issuetype": {"id": "10003"},
            "labels": [t["label"]]
        }
    }
    r = requests.post(f'{base}/rest/api/3/issue', auth=auth, headers=headers, json=payload, timeout=10)
    if r.ok:
        created += 1
        key = r.json()['key']
        print(f"  ✓ {key} [{t['label']}] {t['summary'][:55]}")
    else:
        print(f"  ✗ FAILED: {r.status_code} {r.text[:150]}")

print(f"\n{created}/{len(tickets)} tickets created in Jira.")
